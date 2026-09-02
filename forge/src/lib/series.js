/* Séries jour par jour pour les courbes : poids, activité (kcal, minutes) et
   heures de jeûne. Fonctions pures. */

import { derniersJours } from './temps.js';
import { heuresJeuneDuJour } from './jeune.js';

const vivant = (e) => !e.supprime;

export const pesees = (entrees) =>
  entrees.filter((e) => e.type === 'poids' && vivant(e) && Number.isFinite(e.donnees?.kg))
    .sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : (a.majA || 0) - (b.majA || 0)));

export const sessions = (entrees) =>
  entrees.filter((e) => e.type === 'sport' && vivant(e)).sort((a, b) => (b.debut || 0) - (a.debut || 0));

/** Une pesée par jour : la dernière saisie l'emporte. */
export function poidsParJour(entrees) {
  const m = new Map();
  for (const p of pesees(entrees)) m.set(p.jour, p.donnees.kg);
  return m;
}

export function construireSeries(entrees, nbJours, maintenant = Date.now()) {
  const jours = derniersJours(nbJours, maintenant);
  const pdj = poidsParJour(entrees);
  const kcal = new Map();
  const minutes = new Map();
  const nb = new Map();
  for (const s of sessions(entrees)) {
    if (!s.jour) continue;
    kcal.set(s.jour, (kcal.get(s.jour) || 0) + (Number(s.donnees?.calories) || 0));
    minutes.set(s.jour, (minutes.get(s.jour) || 0) + (Number(s.donnees?.dureeMin) || 0));
    nb.set(s.jour, (nb.get(s.jour) || 0) + 1);
  }
  return {
    jours,
    poids: jours.map((j) => (pdj.has(j) ? pdj.get(j) : null)),
    activite: jours.map((j) => kcal.get(j) || 0),
    minutes: jours.map((j) => minutes.get(j) || 0),
    sessions: jours.map((j) => nb.get(j) || 0),
    jeune: jours.map((j) => Math.round(heuresJeuneDuJour(entrees, j, maintenant) * 10) / 10),
  };
}

/** Moyenne glissante sur n valeurs, en ignorant les trous. */
export function moyenneMobile(valeurs, n = 7) {
  return valeurs.map((_, i) => {
    const fen = valeurs.slice(Math.max(0, i - n + 1), i + 1).filter((v) => v !== null && v !== undefined);
    if (!fen.length) return null;
    return fen.reduce((s, v) => s + v, 0) / fen.length;
  });
}

/** Ramène une série entre 0 et 1 sur sa propre plage — pour superposer des
    grandeurs qui n'ont rien à voir (kg, kcal, heures) sur un même axe indexé. */
export function normaliser(valeurs) {
  const nums = valeurs.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  if (!nums.length) return { valeurs: valeurs.map(() => null), min: 0, max: 0 };
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const plage = max - min || 1;
  return {
    valeurs: valeurs.map((v) => (v === null || v === undefined ? null : (v - min) / plage)),
    min,
    max,
  };
}

/** Bilan du poids : dernier, premier, écart, tendance sur 7 jours. */
export function bilanPoids(entrees, maintenant = Date.now()) {
  const p = pesees(entrees);
  if (!p.length) return null;
  const dernier = p[p.length - 1];
  const premier = p[0];
  const s = construireSeries(entrees, 14, maintenant);
  const mm = moyenneMobile(s.poids, 7);
  const avant = mm[6];
  const apres = mm[13];
  return {
    dernier: dernier.donnees.kg,
    jourDernier: dernier.jour,
    premier: premier.donnees.kg,
    ecartTotal: Math.round((dernier.donnees.kg - premier.donnees.kg) * 10) / 10,
    tendance7j: avant !== null && apres !== null ? Math.round((apres - avant) * 10) / 10 : null,
    nb: p.length,
  };
}

/** Bornes d'axe propres : arrondies à un pas lisible, avec un peu d'air. */
export function bornes(valeurs, { zero = false, marge = 0.1 } = {}) {
  const nums = valeurs.filter((v) => v !== null && v !== undefined && Number.isFinite(v));
  if (!nums.length) return { min: 0, max: 1 };
  let min = zero ? 0 : Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) { min -= 1; max += 1; }
  const plage = max - min;
  const pas = Math.pow(10, Math.floor(Math.log10(plage))) / 2;
  if (!zero) min = Math.floor((min - plage * marge) / pas) * pas;
  max = Math.ceil((max + plage * marge) / pas) * pas;
  return { min, max };
}
