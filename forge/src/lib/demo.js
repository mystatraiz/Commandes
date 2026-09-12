/* Un défi d'exemple, entièrement inventé.

   Une arène vide ne ressemble à rien : au premier lancement, ou avant que les
   copains aient rejoint, il n'y a ni courbe ni fil à regarder. Cet exemple
   montre à quoi ça ressemble une fois lancé — il est affiché comme tel, et
   aucune de ses données ne quitte l'appareil ni ne compte nulle part. */

import { cleJour, debutJour, jourPlus } from './temps.js';

const J = () => cleJour();
const il_y_a = (n) => jourPlus(J(), -n);

/* Dix-huit jours d'un défi de vingt-huit, cinq joueurs. Les séries sont
   écrites à la main pour que chacun raconte quelque chose : Bob décroche,
   Sam fait du yoyo, Momo avance doucement. */
const SERIES = {
  bob:  [0, 0.3, 0.7, 1.0, 1.2, 1.5, 1.9, 2.2, 2.4, 2.6, 2.9, 3.2, 3.5, 3.8, 4.0, 4.3, 4.5, 4.7],
  alex: [0, 0.2, 0.4, 0.5, 0.9, 1.1, 1.0, 1.4, 1.7, null, 2.1, 2.3, 2.2, 2.6, 2.9, 3.1, 3.4, 3.6],
  momo: [0, 0.1, 0.1, 0.3, 0.2, 0.5, 0.6, 0.5, 0.8, 1.0, 0.9, null, 1.3, 1.5, 1.4, 1.7, 1.9, 2.0],
  sam:  [0, -0.2, 0.1, 0.3, 0.1, 0.4, 0.2, 0.0, -0.3, 0.2, 0.5, 0.4, 0.7, 0.6, 0.9, 0.8, 1.1, 0.9],
};

const JOUEURS = [
  { id: 'demo-bob',   pseudo: 'Bob',   emoji: '🐻', depart: 110, visibilite: 'kilos' },
  { id: 'demo-carla', pseudo: 'Carla', emoji: '🦊', depart: 78,  visibilite: 'rang', valeur: 3.9 },
  { id: 'demo-alex',  pseudo: 'Alex',  emoji: '🔥', depart: 96,  visibilite: 'kilos', moi: true },
  { id: 'demo-momo',  pseudo: 'Momo',  emoji: '🦍', depart: 88,  visibilite: 'kilos' },
  { id: 'demo-sam',   pseudo: 'Sam',   emoji: '⚡', depart: 82,  visibilite: 'pourcentage' },
];

const arrondi1 = (x) => Math.round(x * 10) / 10;

export const DEFI_DEMO = {
  id: 'demo',
  nom: 'La Chasse au Gras',
  code: 'ABC234',
  mesure: 'pourcentage',
  debut: il_y_a(17),
  fin: jourPlus(J(), 10),
  gage: 'Le dernier paie la tournée.',
  clos: false,
  estCreateur: true,
  demo: true,
  participation: { pseudo: 'Alex', emoji: '🔥', visibilite: 'kilos', valeur: 3.6, pct: 3.6, kg: 3.5 },
};

export const CLASSEMENT_DEMO = [
  { userId: 'demo-bob',   pseudo: 'Bob',   emoji: '🐻', visibilite: 'kilos',       rang: 1, valeur: 4.7, pct: 4.7, kg: 5.2, moi: false },
  { userId: 'demo-carla', pseudo: 'Carla', emoji: '🦊', visibilite: 'rang',        rang: 2, valeur: null, pct: null, kg: null, moi: false },
  { userId: 'demo-alex',  pseudo: 'Alex',  emoji: '🔥', visibilite: 'kilos',       rang: 3, valeur: 3.6, pct: 3.6, kg: 3.5, moi: true },
  { userId: 'demo-momo',  pseudo: 'Momo',  emoji: '🦍', visibilite: 'kilos',       rang: 4, valeur: 2.0, pct: 2.0, kg: 1.8, moi: false },
  { userId: 'demo-sam',   pseudo: 'Sam',   emoji: '⚡', visibilite: 'pourcentage', rang: 5, valeur: 0.9, pct: 0.9, kg: null, moi: false },
];

/* Un évènement par pesée : c'est ce qui trace les courbes. On ne garde que les
   jours où la série a une valeur, comme dans la vraie vie où l'on saute des
   pesées. */
function evenementsPour(joueur, serie) {
  const out = [];
  let precedent = null;
  serie.forEach((pct, i) => {
    if (pct === null) return;
    const jour = il_y_a(17 - i);
    const kg = arrondi1((pct / 100) * joueur.depart);
    const montrePct = joueur.visibilite !== 'rang';
    const montreKg = joueur.visibilite === 'kilos';
    out.push({
      id: `demo-${joueur.id}-${i}`,
      userId: joueur.id, pseudo: joueur.pseudo, emoji: joueur.emoji, jour,
      pct: montrePct ? pct : null,
      kg: montreKg ? kg : null,
      deltaPct: montrePct && precedent !== null ? arrondi1(precedent.pct - pct) : null,
      deltaKg: montreKg && precedent !== null ? arrondi1(precedent.kg - kg) : null,
      creeA: debutJour(jour) + 8 * 3600000,
      moi: Boolean(joueur.moi),
      reactions: {}, miennes: [], commentaires: [],
    });
    precedent = { pct, kg };
  });
  return out;
}

const tous = JOUEURS.filter((j) => SERIES[j.id.replace('demo-', '')])
  .flatMap((j) => evenementsPour(j, SERIES[j.id.replace('demo-', '')]));

// Du plus récent au plus ancien, comme le vrai fil.
export const FIL_DEMO = tous.sort((a, b) => b.creeA - a.creeA).map((e, i) => {
  // Quelques réactions et vannes sur les plus récents, pour montrer le fil vivant.
  if (i === 0) return { ...e, reactions: { '🔥': 2, '💪': 1 }, commentaires: [
    { id: 'dc1', userId: 'demo-momo', pseudo: 'Momo', emoji: '🦍', moi: false, creeA: e.creeA + 3600000,
      texte: 'Il s’est passé quoi, tu as arrêté de respirer ?' },
  ] };
  if (i === 1) return { ...e, reactions: { '💪': 2 }, commentaires: [
    { id: 'dc2', userId: 'demo-bob', pseudo: 'Bob', emoji: '🐻', moi: false, creeA: e.creeA + 7200000,
      texte: 'Tu remontes, ça m’embête un peu.' },
  ] };
  if (i === 2) return { ...e, reactions: { '😂': 3, '💀': 2 }, miennes: ['😂'], commentaires: [
    { id: 'dc3', userId: 'demo-bob', pseudo: 'Bob', emoji: '🐻', moi: false, creeA: e.creeA + 5400000,
      texte: 'La raclette de samedi a laissé des traces.' },
    { id: 'dc4', userId: 'demo-sam', pseudo: 'Sam', emoji: '⚡', moi: false, creeA: e.creeA + 7200000,
      texte: 'C’est de l’eau. Et les muscles.' },
  ] };
  return e;
});
