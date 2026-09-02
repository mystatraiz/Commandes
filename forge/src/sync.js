/* Synchronisation avec Supabase, locale d'abord.

   L'appareil écrit dans sa propre base et reste utilisable seul ; la
   synchronisation vient par-dessus. Une entrée saisie hors ligne attend son
   tour, elle n'est jamais écrasée avant d'avoir été poussée. */

import * as db from './db.js';
import { supabase, syncActive, TABLE } from './supabase.js';
import { arbitrer, versLocal, versServeur } from './lib/fusion.js';

const CLE_DERNIERE_SYNC = 'forge.derniereSync';
const REPRISE_MAX = 5000;
const RETENTE_MS = Number(import.meta.env.VITE_SYNC_MS) || 20000;

const abonnes = new Set();
let canal = null;
let minuterie = 0;
let enCours = false;
let etat = { actif: false, connecte: false, tempsReel: false, enAttente: 0, erreur: null };

export function surChangement(callback) {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}
const prevenir = () => abonnes.forEach((f) => f(etat));
export const etatSync = () => etat;
function majEtat(patch) {
  etat = { ...etat, ...patch };
  prevenir();
}

const lireDerniereSync = () => {
  const v = Number(localStorage.getItem(CLE_DERNIERE_SYNC));
  return Number.isFinite(v) && v > 0 ? v : null;
};
const ecrireDerniereSync = (t) => {
  try { localStorage.setItem(CLE_DERNIERE_SYNC, String(t)); } catch {}
};

async function fusionner(distante) {
  const locale = await db.lire(distante.id);
  if (arbitrer(locale, distante) === 'distante') {
    await db.enregistrer(distante);
    return true;
  }
  return false;
}

async function enAttenteLocales() {
  const locales = await db.toutesLesEntrees();
  return locales.filter((e) => e.synchro === false);
}

async function pousser() {
  const aPousser = await enAttenteLocales();
  majEtat({ enAttente: aPousser.length });
  if (!aPousser.length) return true;
  const { data, error } = await supabase.from(TABLE).upsert(aPousser.map(versServeur)).select();
  if (error) {
    majEtat({ erreur: error.message });
    return false;
  }
  for (const ligne of data || []) await db.enregistrer(versLocal(ligne));
  majEtat({ enAttente: 0, erreur: null });
  return true;
}

async function tirer() {
  const depuis = lireDerniereSync();
  const requete = supabase.from(TABLE).select('*');
  const { data, error } = depuis === null
    ? await requete.order('maj_a', { ascending: false }).limit(REPRISE_MAX)
    : await requete.gte('maj_a', new Date(depuis).toISOString()).order('maj_a', { ascending: true });
  if (error) {
    majEtat({ erreur: error.message });
    return { ok: false, changements: false };
  }
  let modifiees = 0;
  let plusRecent = 0;
  for (const ligne of data || []) {
    const locale = versLocal(ligne);
    if (locale.majA > plusRecent) plusRecent = locale.majA;
    if (await fusionner(locale)) modifiees++;
  }
  if (plusRecent) ecrireDerniereSync(plusRecent);
  return { ok: true, changements: modifiees > 0 };
}

export async function synchroniser() {
  if (!syncActive || !supabase) return;
  majEtat({ enAttente: (await enAttenteLocales()).length });
  if (enCours) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    majEtat({ connecte: false });
    return;
  }
  enCours = true;
  try {
    const okPousser = await pousser();
    const { ok: okTirer, changements } = await tirer();
    const ok = okPousser && okTirer;
    majEtat({ connecte: ok, erreur: ok ? null : etat.erreur });
    if (changements) prevenir();
  } catch (e) {
    majEtat({ connecte: false, erreur: e.message });
  } finally {
    enCours = false;
  }
}

export async function demarrer() {
  if (!syncActive || !supabase) {
    majEtat({ actif: false });
    return;
  }
  majEtat({ actif: true });
  await synchroniser();

  if (!canal) {
    canal = supabase
      .channel('forge-entrees')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, async (message) => {
        if (message.eventType === 'DELETE') {
          if (message.old?.id) { await db.supprimerPhysiquement(message.old.id); prevenir(); }
          return;
        }
        if (await fusionner(versLocal(message.new))) prevenir();
      })
      .subscribe((statut) => {
        majEtat({ tempsReel: statut === 'SUBSCRIBED' });
        if (statut === 'SUBSCRIBED') synchroniser();
      });
  }

  clearInterval(minuterie);
  minuterie = setInterval(synchroniser, RETENTE_MS);
  window.addEventListener('online', synchroniser);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) synchroniser(); });
}

export async function arreter() {
  clearInterval(minuterie);
  if (canal) { await supabase.removeChannel(canal); canal = null; }
  try { localStorage.removeItem(CLE_DERNIERE_SYNC); } catch {}
  majEtat({ actif: false, connecte: false, tempsReel: false });
}
