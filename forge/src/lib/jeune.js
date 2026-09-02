/* Le jeûne : objectifs, phases et calcul des heures par journée. Fonctions pures. */

import { debutJour } from './temps.js';

export const OBJECTIFS_JEUNE = [
  { h: 14, nom: '14:10', sous: 'Doux' },
  { h: 16, nom: '16:8', sous: 'Classique' },
  { h: 18, nom: '18:6', sous: 'Sérieux' },
  { h: 20, nom: '20:4', sous: 'Guerrier' },
  { h: 24, nom: 'OMAD', sous: 'Un repas' },
];

/** Ce qui se passe dans le corps, heure après heure. Repères usuels, pas un avis médical. */
export const PHASES = [
  { depuis: 0,  nom: 'Digestion',             detail: 'Le corps traite le dernier repas. La glycémie monte puis redescend.' },
  { depuis: 4,  nom: 'Glycémie en baisse',    detail: 'L’insuline chute, le corps pioche dans le glycogène.' },
  { depuis: 8,  nom: 'Glycogène qui s’épuise', detail: 'Les réserves de sucre fondent. La faim monte : elle passe.' },
  { depuis: 12, nom: 'Brûlage des graisses',  detail: 'Le corps bascule sur les graisses comme carburant.' },
  { depuis: 16, nom: 'Cétose',                detail: 'Production de cétones, clarté mentale. La zone qui paie.' },
  { depuis: 24, nom: 'Autophagie profonde',   detail: 'Nettoyage cellulaire. Hydrate-toi, sel et électrolytes.' },
];

export function phaseCourante(heures) {
  let p = PHASES[0];
  for (const x of PHASES) if (heures >= x.depuis) p = x;
  const suivante = PHASES.find((x) => x.depuis > heures) || null;
  return { ...p, suivante };
}

const vivant = (e) => !e.supprime;

export const jeunes = (entrees) => entrees.filter((e) => e.type === 'jeune' && vivant(e));

/** Le jeûne en cours (sans fin), le plus récent s'il y en a plusieurs par erreur. */
export function jeuneEnCours(entrees) {
  return jeunes(entrees)
    .filter((j) => j.debut && !j.fin)
    .sort((a, b) => b.debut - a.debut)[0] || null;
}

export const dureeJeuneMs = (j, maintenant = Date.now()) => Math.max(0, (j.fin || maintenant) - j.debut);
export const dureeJeuneH = (j, maintenant = Date.now()) => dureeJeuneMs(j, maintenant) / 3600000;

/** Heures de jeûne rattachées à une journée : la part de chaque jeûne qui tombe dedans. */
export function heuresJeuneDuJour(entrees, cle, maintenant = Date.now()) {
  const d0 = debutJour(cle);
  const d1 = d0 + 86400000;
  let ms = 0;
  for (const j of jeunes(entrees)) {
    if (!j.debut) continue;
    const fin = j.fin || maintenant;
    const a = Math.max(j.debut, d0);
    const b = Math.min(fin, d1);
    if (b > a) ms += b - a;
  }
  return Math.min(24, ms / 3600000);
}

/** Jeûnes terminés, du plus récent au plus ancien. */
export function jeunesTermines(entrees) {
  return jeunes(entrees).filter((j) => j.debut && j.fin).sort((a, b) => b.debut - a.debut);
}
