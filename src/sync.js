/* Synchronisation entre les téléphones.

   Principe : locale d'abord. Chaque appareil écrit dans sa propre base et
   reste utilisable seul ; la synchronisation vient par-dessus. Si le réseau
   tombe en plein service, on continue de prendre des commandes, et tout se
   recolle au retour.

   Le serveur ne fait jamais autorité sur ce qui n'a pas encore été poussé :
   une commande saisie hors ligne attend son tour, elle n'est pas écrasée. */

import * as db from './db.js';
import { supabase, partageActif, TABLE } from './supabase.js';
import { arbitrer, versLocal, versServeur } from './lib/fusion.js';

const CLE_DERNIERE_SYNC = 'grill.derniereSync';
const REPRISE_MAX = 5000;   // commandes récupérées par un appareil qui rejoint
// Filet de rattrapage quand le temps réel n'a pas transmis un évènement.
// Réglable pour que les tests n'aient pas à patienter quinze secondes.
const RETENTE_MS = Number(import.meta.env.VITE_SYNC_MS) || 15000;

let abonnes = new Set();
let canal = null;
let minuterie = 0;
let enCours = false;
let etat = { actif: false, connecte: false, tempsReel: false, enAttente: 0, erreur: null };

/* ---------------- Abonnement de l'interface ---------------- */

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

/* ---------------- Marqueur de dernière synchronisation ---------------- */

/** null tant qu'aucune synchronisation n'a abouti : la première passe ne
    filtre alors sur rien, pour ne pas dépendre de l'horloge de l'appareil. */
const lireDerniereSync = () => {
  const v = Number(localStorage.getItem(CLE_DERNIERE_SYNC));
  return Number.isFinite(v) && v > 0 ? v : null;
};
const ecrireDerniereSync = (t) => {
  try { localStorage.setItem(CLE_DERNIERE_SYNC, String(t)); } catch {}
};

/* ---------------- Fusion d'une commande venue du serveur ---------------- */

async function fusionner(distante) {
  const locale = await db.lire(distante.id);
  if (arbitrer(locale, distante) === 'distante') {
    await db.enregistrer(distante);
    return true;
  }
  return false;
}

/* ---------------- Pousser ce qui attend ---------------- */

/** Commandes écrites localement mais pas encore acceptées par le serveur. */
async function enAttenteLocales() {
  const locales = await db.toutesLesCommandes();
  return locales.filter((c) => c.synchro === false);
}

async function pousser() {
  const aPousser = await enAttenteLocales();
  majEtat({ enAttente: aPousser.length });
  if (!aPousser.length) return true;

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(aPousser.map(versServeur))
    .select();

  if (error) {
    majEtat({ erreur: error.message });
    return false;
  }
  // On relit la ligne écrite : c'est la base qui pose `maj_a`, et c'est cette
  // valeur qui servira d'arbitre par la suite.
  for (const ligne of data || []) await db.enregistrer(versLocal(ligne));
  majEtat({ enAttente: 0, erreur: null });
  return true;
}

/* ---------------- Tirer ce qui a changé ---------------- */

async function tirer() {
  const depuis = lireDerniereSync();

  // Premier contact : on prend les commandes les plus récemment touchées, sans
  // filtre de date. Ensuite seulement, on avance de façon incrémentale.
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

  // Le repère avance sur l'horodatage du serveur, jamais sur celui de
  // l'appareil : un téléphone dont l'heure avance se rendrait sinon aveugle
  // aux commandes que le serveur vient tout juste d'écrire.
  if (plusRecent) ecrireDerniereSync(plusRecent);
  return { ok: true, changements: modifiees > 0 };
}

/* ---------------- Cycle complet ---------------- */

export async function synchroniser() {
  if (!partageActif || !supabase) return;

  // Le compteur d'attente est rafraîchi avant toute autre considération :
  // hors ligne, c'est justement la seule information qui compte pour le
  // service, et elle ne doit pas dépendre d'un échange réussi.
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
    // « Connecté » veut dire que l'échange a réussi. Le temps réel n'est qu'une
    // accélération : s'il tombe, la synchronisation périodique suffit et il
    // serait faux d'annoncer l'appareil hors ligne.
    const ok = okPousser && okTirer;
    majEtat({ connecte: ok, erreur: ok ? null : etat.erreur });
    if (changements) prevenir();
  } catch (e) {
    majEtat({ connecte: false, erreur: e.message });
  } finally {
    enCours = false;
  }
}

/* ---------------- Démarrage ---------------- */

export async function demarrer() {
  if (!partageActif || !supabase) {
    majEtat({ actif: false });
    return;
  }
  majEtat({ actif: true });

  await synchroniser();

  // Temps réel : les commandes des autres téléphones arrivent sans délai.
  if (!canal) {
    canal = supabase
      .channel('commandes-partagees')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE },
        async (message) => {
          if (message.eventType === 'DELETE') {
            if (message.old?.id) { await db.supprimer(message.old.id); prevenir(); }
            return;
          }
          if (await fusionner(versLocal(message.new))) prevenir();
        },
      )
      .subscribe((statut) => {
        majEtat({ tempsReel: statut === 'SUBSCRIBED' });
        // Une reconnexion peut avoir laissé passer des évènements : on rattrape.
        if (statut === 'SUBSCRIBED') synchroniser();
      });
  }

  // Filet de sécurité : le temps réel peut manquer un évènement après une
  // coupure, un passage en arrière-plan ou une mise en veille.
  clearInterval(minuterie);
  minuterie = setInterval(synchroniser, RETENTE_MS);

  window.addEventListener('online', synchroniser);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) synchroniser();
  });
}

export async function arreter() {
  clearInterval(minuterie);
  if (canal) { await supabase.removeChannel(canal); canal = null; }
  majEtat({ actif: false, connecte: false, tempsReel: false });
}
