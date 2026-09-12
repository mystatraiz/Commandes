/* Les défis côté réseau.

   À la différence des entrées personnelles, un défi n'a pas de sens hors
   ligne : il suppose d'autres joueurs. On ne fait donc pas de « locale
   d'abord » ici — mais on garde en cache le dernier classement connu, pour que
   l'arène montre quelque chose dans le métro plutôt qu'une page vide. */

import { supabase, syncActive, TABLE_DEFIS, TABLE_PARTICIPATIONS } from './supabase.js';
import { genererCode, normaliserCode } from './lib/defis.js';

const CACHE = 'grossac.classements';
const nouvelId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const indisponible = { ok: false, message: 'Les défis demandent un compte : la synchronisation n’est pas configurée.' };

function echec(error) {
  const m = error?.message || 'Erreur inconnue';
  if (/fetch|network|failed to fetch/i.test(m)) return { ok: false, message: 'Serveur injoignable. Vérifie ta connexion.' };
  if (/code inconnu/i.test(m)) return { ok: false, message: 'Ce code ne correspond à aucun défi.' };
  if (/défi clos/i.test(m)) return { ok: false, message: 'Ce défi est clos.' };
  if (/défi terminé/i.test(m)) return { ok: false, message: 'Ce défi est déjà terminé.' };
  if (/non membre/i.test(m)) return { ok: false, message: 'Tu ne participes pas à ce défi.' };
  if (/gs_defis|gs_participations|does not exist|schema cache/i.test(m)) {
    return { ok: false, message: 'La base n’est pas à jour : lance supabase/schema.sql dans le SQL Editor.' };
  }
  return { ok: false, message: m };
}

/* ---------------- Cache du dernier classement connu ---------------- */

function lireCache() {
  try { return JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { return {}; }
}
export function classementEnCache(defiId) {
  return lireCache()[defiId] || null;
}
function ecrireCache(defiId, lignes) {
  try {
    const tout = lireCache();
    tout[defiId] = { lignes, a: Date.now() };
    localStorage.setItem(CACHE, JSON.stringify(tout));
  } catch {}
}
export function viderCache() {
  try { localStorage.removeItem(CACHE); } catch {}
}

/* ---------------- Lecture ---------------- */

/** Mes défis, avec ma propre participation — celle des autres passe par le classement. */
export async function mesDefis() {
  if (!syncActive) return { ok: false, defis: [], message: indisponible.message };
  const { data: parts, error: e1 } = await supabase
    .from(TABLE_PARTICIPATIONS).select('*').order('rejoint_a', { ascending: false });
  if (e1) return { ...echec(e1), defis: [] };
  if (!parts?.length) return { ok: true, defis: [] };

  const { data: defis, error: e2 } = await supabase
    .from(TABLE_DEFIS).select('*').in('id', parts.map((p) => p.defi_id));
  if (e2) return { ...echec(e2), defis: [] };

  const parId = new Map(parts.map((p) => [p.defi_id, p]));
  return {
    ok: true,
    defis: (defis || [])
      .map((d) => ({ ...d, participation: parId.get(d.id) }))
      .sort((a, b) => (a.fin < b.fin ? 1 : a.fin > b.fin ? -1 : 0)),
  };
}

/** Aperçu avant de s'engager : ce que montre un code, sans rejoindre. */
export async function apercu(code) {
  if (!syncActive) return indisponible;
  const { data, error } = await supabase.rpc('gs_apercu', { p_code: normaliserCode(code) });
  if (error) return echec(error);
  const defi = Array.isArray(data) ? data[0] : data;
  if (!defi) return { ok: false, message: 'Ce code ne correspond à aucun défi.' };
  return { ok: true, defi };
}

/** Le classement, seule porte d'entrée sur la progression des autres. */
export async function classement(defiId) {
  if (!syncActive) return { ...indisponible, lignes: [] };
  const { data, error } = await supabase.rpc('gs_classement', { p_defi: defiId });
  if (error) {
    const cache = classementEnCache(defiId);
    return { ...echec(error), lignes: cache?.lignes || [], depuisCache: Boolean(cache), cacheA: cache?.a };
  }
  const lignes = (data || []).map((l) => ({
    userId: l.user_id, pseudo: l.pseudo, emoji: l.emoji, visibilite: l.visibilite,
    rang: l.rang, valeur: l.valeur === null ? null : Number(l.valeur),
    pct: l.pct === null ? null : Number(l.pct), kg: l.kg === null ? null : Number(l.kg),
    majA: l.maj_a ? new Date(l.maj_a).getTime() : null, moi: l.moi,
  }));
  ecrireCache(defiId, lignes);
  return { ok: true, lignes };
}

/* ---------------- Écriture ---------------- */

/**
 * Créer un défi. Le code est tiré sur l'appareil ; en cas de collision avec un
 * défi existant, on retire — c'est plus simple qu'un aller-retour pour
 * réserver un code, et une collision sur six caractères reste rare.
 */
export async function creer({ nom, mesure, debut, fin, gage, pseudo, emoji, visibilite }) {
  if (!syncActive) return indisponible;
  for (let essai = 0; essai < 5; essai++) {
    const defi = {
      id: nouvelId(), nom: String(nom).trim(), code: genererCode(), mesure,
      debut, fin, gage: gage?.trim() || null,
    };
    const { error } = await supabase.from(TABLE_DEFIS).insert(defi);
    if (error) {
      if (/duplicate key|gs_defis_code_key/i.test(error.message)) continue;   // code déjà pris
      return echec(error);
    }
    const { error: e2 } = await supabase
      .from(TABLE_PARTICIPATIONS)
      .insert({ defi_id: defi.id, pseudo, emoji, visibilite });
    if (e2) return echec(e2);
    return { ok: true, defi };
  }
  return { ok: false, message: 'Impossible de tirer un code libre. Réessaie.' };
}

export async function rejoindre({ code, pseudo, emoji, visibilite }) {
  if (!syncActive) return indisponible;
  const { data, error } = await supabase.rpc('gs_rejoindre', {
    p_code: normaliserCode(code), p_pseudo: pseudo, p_emoji: emoji, p_visibilite: visibilite,
  });
  if (error) return echec(error);
  return { ok: true, defiId: data };
}

/** Publie ce que le réglage de visibilité autorise. Le poids ne part jamais. */
export async function publier(defiId, { valeur, pct, kg }) {
  if (!syncActive) return indisponible;
  const { error } = await supabase
    .from(TABLE_PARTICIPATIONS)
    .update({ valeur, pct, kg })
    .eq('defi_id', defiId);
  return error ? echec(error) : { ok: true };
}

export async function reglerVisibilite(defiId, visibilite) {
  if (!syncActive) return indisponible;
  const { error } = await supabase.from(TABLE_PARTICIPATIONS).update({ visibilite }).eq('defi_id', defiId);
  return error ? echec(error) : { ok: true };
}

export async function majPseudo(defiId, { pseudo, emoji }) {
  if (!syncActive) return indisponible;
  const { error } = await supabase.from(TABLE_PARTICIPATIONS).update({ pseudo, emoji }).eq('defi_id', defiId);
  return error ? echec(error) : { ok: true };
}

export async function quitter(defiId) {
  if (!syncActive) return indisponible;
  const { error } = await supabase.from(TABLE_PARTICIPATIONS).delete().eq('defi_id', defiId);
  return error ? echec(error) : { ok: true };
}

/** Clore : le créateur seul, et sans effacer le palmarès. */
export async function clore(defiId) {
  if (!syncActive) return indisponible;
  const { error } = await supabase.from(TABLE_DEFIS).update({ clos: true }).eq('id', defiId);
  return error ? echec(error) : { ok: true };
}

/* ---------------- Temps réel ----------------
   Une pesée d'un adversaire fait bouger le classement sans rien toucher. */

export function surChangement(callback) {
  if (!syncActive || !supabase) return () => {};
  const canal = supabase
    .channel('gs-participations')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_PARTICIPATIONS }, (m) => {
      callback(m.new?.defi_id || m.old?.defi_id || null);
    })
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}
