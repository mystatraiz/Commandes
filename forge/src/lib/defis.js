/* Les défis : périodes, mesures, progrès et classement.

   Tout est pur et testable seul. C'est ici que se décide qui gagne, donc la
   moindre approximation se voit dans le classement d'un groupe entier. */

import { cleJour, debutJour } from './temps.js';

/* ---------------- Réglages d'un défi ---------------- */

export const MESURES = [
  {
    id: 'pourcentage', nom: '% du poids', court: '%',
    detail: 'Part du poids de départ. Met les gabarits à égalité.',
  },
  {
    id: 'kilos', nom: 'Kilos perdus', court: 'kg',
    detail: 'Le plus direct, mais avantage les plus lourds au départ.',
  },
];

/* Ce que les autres ont le droit de voir. Le poids absolu, lui, n'est jamais
   publié — quel que soit le réglage. Ce qui circule est une progression.

   Le défaut montre tout : entre potes, cacher ses chiffres enlève l'essentiel
   du sel. Le réglage reste pour qui n'est pas à l'aise. */
export const VISIBILITES = [
  { id: 'kilos', nom: 'Pourcentage et kilos', detail: 'Tout le monde voit ta progression, dans les deux unités.' },
  { id: 'pourcentage', nom: 'Pourcentage seul', detail: 'Ta progression en part du poids de départ, sans les kilos.' },
  { id: 'rang', nom: 'Mon rang seul', detail: 'Les autres voient ta place, ni tes chiffres ni ta courbe.' },
];

export const VISIBILITE_DEFAUT = 'kilos';

export const DUREES_DEFI = [
  { jours: 14, nom: '2 semaines' },
  { jours: 28, nom: '4 semaines' },
  { jours: 42, nom: '6 semaines' },
  { jours: 90, nom: '3 mois' },
];

export const mesureById = (id) => MESURES.find((m) => m.id === id) || MESURES[0];

/* ---------------- Code d'invitation ----------------
   Six caractères, sans I, L, O, 0 ni 1 : un code se lit à voix haute et se
   recopie d'un message, il ne doit pas se confondre. */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const LONGUEUR_CODE = 6;

export function genererCode(hasard = Math.random) {
  let code = '';
  for (let i = 0; i < LONGUEUR_CODE; i++) code += ALPHABET[Math.floor(hasard() * ALPHABET.length)];
  return code;
}

/** Tolère les espaces, les tirets et les minuscules de la saisie. */
export function normaliserCode(saisi) {
  return String(saisi || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function codeValide(saisi) {
  const c = normaliserCode(saisi);
  return c.length === LONGUEUR_CODE && [...c].every((x) => ALPHABET.includes(x));
}

/* ---------------- Période ---------------- */

/** La journée de fin est comprise dans le défi : on pèse encore ce matin-là. */
const finExclusive = (defi) => debutJour(defi.fin) + 86400000;

export function statutDefi(defi, maintenant = Date.now()) {
  if (maintenant < debutJour(defi.debut)) return 'a_venir';
  if (maintenant >= finExclusive(defi)) return 'termine';
  return 'en_cours';
}

export const STATUTS = {
  a_venir: { nom: 'À venir', teinte: 'acier' },
  en_cours: { nom: 'En cours', teinte: 'lime' },
  termine: { nom: 'Terminé', teinte: 'feu' },
};

export function joursTotal(defi) {
  return Math.round((debutJour(defi.fin) - debutJour(defi.debut)) / 86400000) + 1;
}

/** Jours restants, journée en cours comprise. Zéro une fois le défi fini. */
export function joursRestants(defi, maintenant = Date.now()) {
  return Math.max(0, Math.ceil((finExclusive(defi) - maintenant) / 86400000));
}

/** Part du temps écoulée, entre 0 et 1 — de quoi comparer l'avance au calendrier. */
export function progressionTemps(defi, maintenant = Date.now()) {
  const d0 = debutJour(defi.debut);
  const total = finExclusive(defi) - d0;
  return Math.max(0, Math.min(1, (maintenant - d0) / total));
}

/** Fin proposée pour une durée choisie, la journée de début comptant pour une. */
export function finPour(debut, jours) {
  return cleJour(debutJour(debut) + (jours - 1) * 86400000);
}

/* ---------------- Progrès d'un participant ---------------- */

const arrondi1 = (x) => Math.round(x * 10) / 10;

/**
 * Progrès calculé sur les seules pesées de l'appareil.
 *
 * Départ : la dernière pesée au plus tard le jour du début. À défaut — on
 * rejoint un défi sans s'être pesé avant — la première pesée de la période,
 * car inventer un poids d'avant fausserait le classement.
 * Actuel : la dernière pesée de la période, jamais au-delà de la fin ni
 * d'aujourd'hui, pour qu'un défi terminé garde son résultat figé.
 *
 * Perdre du poids donne des valeurs positives.
 */
export function calculerProgres(pesees, defi, maintenant = Date.now()) {
  const jourMax = cleJour(Math.min(maintenant, finExclusive(defi) - 1));
  const triees = [...pesees].filter((p) => p.jour && Number.isFinite(p.kg)).sort((a, b) => (a.jour < b.jour ? -1 : a.jour > b.jour ? 1 : 0));

  const avant = triees.filter((p) => p.jour <= defi.debut);
  const dedans = triees.filter((p) => p.jour >= defi.debut && p.jour <= jourMax);

  const depart = avant.length ? avant[avant.length - 1] : dedans[0];
  if (!depart) return null;
  const actuel = dedans.length ? dedans[dedans.length - 1] : depart;

  const kg = arrondi1(depart.kg - actuel.kg);
  // Variation depuis la pesée précédente : c'est elle qu'on annonce dans le
  // fil, parce que « −0,8 kg depuis hier » se commente, pas « 3,6 % au total ».
  const precedente = dedans.length > 1 ? dedans[dedans.length - 2] : null;
  return {
    depart: depart.kg,
    actuel: actuel.kg,
    kg,
    pct: arrondi1(((depart.kg - actuel.kg) / depart.kg) * 100),
    deltaKg: precedente ? arrondi1(actuel.kg - precedente.kg) : null,
    deltaPct: precedente ? arrondi1(((actuel.kg - precedente.kg) / depart.kg) * 100) : null,
    pesees: dedans.length,
    derniereA: actuel.jour,
    departEstime: avant.length === 0,
  };
}

/** La valeur qui sert au classement, selon la mesure du défi. */
export function valeurClassement(progres, mesure) {
  if (!progres) return null;
  return mesure === 'kilos' ? progres.kg : progres.pct;
}

/**
 * Ce qui part sur le serveur.
 *
 * La valeur de classement part toujours, sinon le serveur ne peut pas ordonner.
 * Les chiffres d'affichage, eux, suivent le réglage : à « rang », ils restent
 * sur l'appareil, et c'est la base qui refuse de les montrer aux autres.
 */
export function aPublier(progres, defi, visibilite) {
  const valeur = valeurClassement(progres, defi.mesure);
  return {
    valeur,
    pct: visibilite === 'pourcentage' || visibilite === 'kilos' ? progres?.pct ?? null : null,
    kg: visibilite === 'kilos' ? progres?.kg ?? null : null,
  };
}

/**
 * La pesée telle qu'elle part dans le fil : progression et variation, filtrées
 * par la visibilité. Ici encore, le poids n'a aucune place.
 */
export function evenementAPublier(progres, visibilite) {
  if (!progres) return null;
  const montrePct = visibilite === 'pourcentage' || visibilite === 'kilos';
  return {
    jour: progres.derniereA,
    pct: montrePct ? progres.pct : null,
    kg: visibilite === 'kilos' ? progres.kg : null,
    deltaPct: montrePct ? progres.deltaPct : null,
    deltaKg: visibilite === 'kilos' ? progres.deltaKg : null,
  };
}

/* ---------------- Classement ---------------- */

/**
 * Classement à l'ancienne : deux ex æquo partagent le rang et le suivant saute
 * (1, 2, 2, 4). Ceux qui ne se sont pas encore pesés ferment la marche sans
 * rang plutôt que d'être comptés derniers — ils n'ont pas encore joué.
 *
 * Le tri secondaire sur le pseudo garde le même ordre d'un appareil à l'autre.
 */
export function classer(participants) {
  const joue = participants.filter((p) => Number.isFinite(p.valeur));
  const enAttente = participants.filter((p) => !Number.isFinite(p.valeur));

  joue.sort((a, b) => b.valeur - a.valeur || String(a.pseudo || '').localeCompare(String(b.pseudo || ''), 'fr'));

  let rang = 0;
  let precedente = null;
  const classes = joue.map((p, i) => {
    if (precedente === null || p.valeur !== precedente) rang = i + 1;
    precedente = p.valeur;
    return { ...p, rang };
  });

  return [
    ...classes,
    ...enAttente
      .slice()
      .sort((a, b) => String(a.pseudo || '').localeCompare(String(b.pseudo || ''), 'fr'))
      .map((p) => ({ ...p, rang: null })),
  ];
}

/** Ce qu'il manque au deuxième pour passer premier — le chiffre qui fait revenir. */
export function ecartAuDessus(classement, userId) {
  const i = classement.findIndex((p) => p.userId === userId);
  if (i <= 0) return null;
  const moi = classement[i];
  const devant = classement[i - 1];
  if (!Number.isFinite(moi.valeur) || !Number.isFinite(devant.valeur)) return null;
  return arrondi1(devant.valeur - moi.valeur);
}

/** Libellé d'une valeur de classement selon la mesure. */
export function formatValeur(valeur, mesure) {
  if (!Number.isFinite(valeur)) return '—';
  const v = arrondi1(valeur).toLocaleString('fr-FR');
  return mesure === 'kilos' ? `${v} kg` : `${v} %`;
}

/** Le podium d'un défi terminé, gage compris. */
export function palmares(classement) {
  return classement.filter((p) => p.rang !== null && p.rang <= 3);
}
