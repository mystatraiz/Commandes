/* Les défis côté réseau.

   À la différence des entrées personnelles, un défi n'a pas de sens hors
   ligne : il suppose d'autres joueurs. On ne fait donc pas de « locale
   d'abord » ici — mais on garde en cache le dernier classement connu, pour que
   l'arène montre quelque chose dans le métro plutôt qu'une page vide. */

import { supabase, syncActive, utilisateurCourant, TABLE_DEFIS, TABLE_PARTICIPATIONS } from './supabase.js';
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

/* ---------------- Le fil ----------------

   Une pesée publiée est ce qui reste d'une pesée après le filtre de
   visibilité : la progression, jamais le poids. C'est elle qui alimente les
   courbes, et c'est à elle que se rattachent les vannes. */

const TABLE_EVENEMENTS = 'gs_evenements';
const TABLE_REACTIONS = 'gs_reactions';
const TABLE_COMMENTAIRES = 'gs_commentaires';
const FIL_MAX = 60;

export async function fil(defiId) {
  if (!syncActive) return { ...indisponible, evenements: [] };
  const moi = (await utilisateurCourant())?.id || null;

  const { data: evts, error } = await supabase
    .from(TABLE_EVENEMENTS).select('*')
    .eq('defi_id', defiId).order('cree_a', { ascending: false }).limit(FIL_MAX);
  if (error) return { ...echec(error), evenements: [] };
  if (!evts?.length) return { ok: true, evenements: [] };

  const ids = evts.map((e) => e.id);
  const [{ data: reacs }, { data: coms }] = await Promise.all([
    supabase.from(TABLE_REACTIONS).select('*').in('evenement_id', ids),
    supabase.from(TABLE_COMMENTAIRES).select('*').in('evenement_id', ids).order('cree_a', { ascending: true }),
  ]);

  const parEvt = new Map(ids.map((id) => [id, { reactions: {}, miennes: [], commentaires: [] }]));
  for (const r of reacs || []) {
    const bloc = parEvt.get(r.evenement_id);
    if (!bloc) continue;
    bloc.reactions[r.emoji] = (bloc.reactions[r.emoji] || 0) + 1;
    if (r.user_id === moi) bloc.miennes.push(r.emoji);
  }
  for (const c of coms || []) {
    const bloc = parEvt.get(c.evenement_id);
    if (bloc) bloc.commentaires.push({
      id: c.id, userId: c.user_id, pseudo: c.pseudo, emoji: c.emoji,
      texte: c.texte, creeA: new Date(c.cree_a).getTime(), moi: c.user_id === moi,
    });
  }

  return {
    ok: true,
    evenements: evts.map((e) => ({
      id: e.id, userId: e.user_id, pseudo: e.pseudo, emoji: e.emoji, jour: e.jour,
      pct: e.pct === null ? null : Number(e.pct),
      kg: e.kg === null ? null : Number(e.kg),
      deltaPct: e.delta_pct === null ? null : Number(e.delta_pct),
      deltaKg: e.delta_kg === null ? null : Number(e.delta_kg),
      creeA: new Date(e.cree_a).getTime(),
      moi: e.user_id === moi,
      ...parEvt.get(e.id),
    })),
  };
}

/** Une pesée par personne et par jour : se repeser corrige, ça n'inonde pas le fil. */
export async function publierEvenement(defiId, champs) {
  if (!syncActive) return indisponible;
  const moi = (await utilisateurCourant())?.id;
  if (!moi) return { ok: false, message: 'Connexion requise.' };
  const ligne = {
    id: `${defiId}-${moi}-${champs.jour}`,
    defi_id: defiId, user_id: moi, pseudo: champs.pseudo, emoji: champs.emoji, jour: champs.jour,
    pct: champs.pct, kg: champs.kg, delta_pct: champs.deltaPct, delta_kg: champs.deltaKg,
  };
  const { error } = await supabase
    .from(TABLE_EVENEMENTS).upsert(ligne, { onConflict: 'defi_id,user_id,jour' });
  return error ? echec(error) : { ok: true };
}

export async function reagir(evenementId, emoji, actif) {
  if (!syncActive) return indisponible;
  if (actif) {
    const { error } = await supabase.from(TABLE_REACTIONS).insert({ evenement_id: evenementId, emoji });
    // Deux appuis rapides sur le même emoji : la clé primaire refuse, et c'est
    // exactement ce qu'on voulait.
    if (error && !/duplicate key/i.test(error.message)) return echec(error);
    return { ok: true };
  }
  const moi = (await utilisateurCourant())?.id;
  const { error } = await supabase
    .from(TABLE_REACTIONS).delete().eq('evenement_id', evenementId).eq('emoji', emoji).eq('user_id', moi);
  return error ? echec(error) : { ok: true };
}

export async function commenter(evenementId, { pseudo, emoji, texte }) {
  if (!syncActive) return indisponible;
  const propre = String(texte || '').trim().slice(0, 400);
  if (!propre) return { ok: false, message: 'Écris quelque chose.' };
  const { error } = await supabase.from(TABLE_COMMENTAIRES).insert({
    id: nouvelId(), evenement_id: evenementId, pseudo, emoji, texte: propre,
  });
  return error ? echec(error) : { ok: true };
}

export async function supprimerCommentaire(id) {
  if (!syncActive) return indisponible;
  const { error } = await supabase.from(TABLE_COMMENTAIRES).delete().eq('id', id);
  return error ? echec(error) : { ok: true };
}

/* ---------------- Temps réel ----------------
   Une pesée d'un adversaire fait bouger le classement sans rien toucher. */

export function surChangement(callback) {
  if (!syncActive || !supabase) return () => {};
  const canal = supabase.channel('gs-fil');
  const ecouter = (table, quoi) => canal.on(
    'postgres_changes', { event: '*', schema: 'public', table },
    (m) => callback(quoi, m.new?.defi_id || m.old?.defi_id || null),
  );
  ecouter(TABLE_PARTICIPATIONS, 'classement');
  ecouter(TABLE_EVENEMENTS, 'fil');
  // Les réactions et les vannes ne portent pas l'identifiant du défi : on
  // rafraîchit le fil ouvert, c'est le seul qui puisse les afficher.
  ecouter(TABLE_REACTIONS, 'fil');
  ecouter(TABLE_COMMENTAIRES, 'fil');
  canal.subscribe();
  return () => { supabase.removeChannel(canal); };
}
