/* Analyse d'une commande dictée.

   Fonction pure : du texte entre, une commande structurée sort. Aucun appel
   réseau, aucun modèle — le vocabulaire est fermé (30 tables, 13 grillades,
   4 cuissons), un appariement sur mots-clés est donc à la fois suffisant et
   prévisible. C'est aussi ce qui la rend testable ligne à ligne, ce qui compte
   pour une pièce dont une erreur envoie la mauvaise viande au grill.

   Le résultat n'est jamais envoyé tel quel : il pré-remplit l'écran de saisie,
   que le service relit et corrige avant d'envoyer. */

import { CUISSONS, GRILLADES, TABLES } from '../config.js';

/** Minuscules, sans accents, ponctuation en espaces. */
export function normaliser(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Nombres dits en toutes lettres. La dictée renvoie souvent des chiffres, mais
// pas toujours — « deux côtes » reste fréquent.
const MOTS_NOMBRES = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7,
  huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14,
  quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100,
};

const quantiteDuMot = (mot) => {
  if (/^\d+$/.test(mot)) return parseInt(mot, 10);
  return MOTS_NOMBRES[mot] ?? null;
};

/* ---------------- Index des mots-clés ---------------- */

// Les variantes les plus longues d'abord : « tomahawk wagyu » doit gagner
// contre « tomahawk », sinon la pièce la plus chère part en simple tomahawk.
function indexer(entrees) {
  const liste = [];
  for (const e of entrees) {
    const mots = e.dit && e.dit.length ? e.dit : [e.nom];
    for (const m of mots) liste.push({ id: e.id, cle: normaliser(m) });
  }
  return liste.filter((x) => x.cle).sort((a, b) => b.cle.length - a.cle.length);
}

const IDX_GRILLADES = indexer(GRILLADES);
const IDX_CUISSONS = indexer(CUISSONS);

/* Le « s » du pluriel est ignoré des deux côtés : la configuration n'a pas à
   lister « côte » et « côtes », et une dictée au pluriel reste reconnue. */
const memeMot = (a, b) => a === b || a === b + 's' || a + 's' === b;

/** Toutes les positions où un mot-clé apparaît, sans chevauchement. */
function reperer(mots, index) {
  const trouves = [];
  const pris = new Array(mots.length).fill(false);
  for (const { id, cle } of index) {
    const morceaux = cle.split(' ');
    for (let i = 0; i + morceaux.length <= mots.length; i++) {
      if (pris.slice(i, i + morceaux.length).some(Boolean)) continue;
      let ok = true;
      for (let k = 0; k < morceaux.length; k++) if (!memeMot(mots[i + k], morceaux[k])) { ok = false; break; }
      if (!ok) continue;
      for (let k = 0; k < morceaux.length; k++) pris[i + k] = true;
      trouves.push({ id, debut: i, fin: i + morceaux.length - 1 });
    }
  }
  return trouves.sort((a, b) => a.debut - b.debut);
}

/* ---------------- Numéro de table ---------------- */

function trouverTable(mots, debutsGrillades) {
  const connues = new Set(TABLES);

  // Après le mot « table » : le cas normal.
  for (let i = 0; i < mots.length; i++) {
    if (mots[i] !== 'table' && mots[i] !== 'tables') continue;
    for (let k = i + 1; k <= Math.min(i + 4, mots.length - 1); k++) {
      if (connues.has(mots[k])) return { table: mots[k], fin: k };
      // « cinquante cinq », « cent un », « deux cent un »
      const compose = composer(mots, k, connues, debutsGrillades);
      if (compose) return { table: String(compose.valeur), fin: compose.fin };
    }
  }
  // Sans le mot « table » : un nombre isolé qui correspond à une table connue.
  for (let i = 0; i < mots.length; i++) {
    if (connues.has(mots[i])) return { table: mots[i], fin: i };
    const compose = composer(mots, i, connues, debutsGrillades);
    if (compose) return { table: String(compose.valeur), fin: compose.fin };
  }
  return { table: null, fin: -1 };
}

/* Additionne les nombres dits en toutes lettres : « deux cent un » = 201.

   Chaque longueur possible est évaluée, et on retient la plus longue qui
   tombe sur une table connue. Sans cela, « deux cent un » s'arrêterait sur
   « deux » — une table réelle, mais pas celle qui a été dite — et « table
   douze une bavette » finirait sur la table 1 en absorbant la quantité. */
function composer(mots, debut, connues, debutsGrillades) {
  let total = 0, courant = 0;
  let meilleur = null;
  for (let i = debut; i < Math.min(debut + 4, mots.length); i++) {
    const n = quantiteDuMot(mots[i]);
    if (n === null) break;
    // Un nombre immédiatement suivi d'une grillade est la quantité de cette
    // pièce, pas la fin du numéro de table : « table cent une côte » désigne
    // la table 100 avec une côte, et non la table 101.
    if (debutsGrillades.has(i + 1)) break;
    if (n === 100) { courant = (courant || 1) * 100; total += courant; courant = 0; }
    else if (n >= 20 && courant === 0) courant = n;
    else courant += n;
    const valeur = total + courant;
    if (connues.has(String(valeur))) meilleur = { valeur, fin: i };
  }
  return meilleur;
}

/* ---------------- Analyse complète ---------------- */

/**
 * @returns {{ table: string|null, lignes: Array<{grillade, cuisson, qte, incomplete?}>,
 *             motsIgnores: string[] }}
 */
export function analyser(texte) {
  const mots = normaliser(texte).split(' ').filter(Boolean);
  if (!mots.length) return { table: null, lignes: [], motsIgnores: [] };

  // Les grillades sont repérées d'abord : leur position sert à distinguer une
  // quantité d'un morceau de numéro de table.
  const grillades = reperer(mots, IDX_GRILLADES);
  const cuissons = reperer(mots, IDX_CUISSONS);
  const debutsGrillades = new Set(grillades.map((g) => g.debut));
  const { table, fin: finTable } = trouverTable(mots, debutsGrillades);

  const lignes = [];
  for (let g = 0; g < grillades.length; g++) {
    const ici = grillades[g];
    const suivante = grillades[g + 1];
    const def = GRILLADES.find((x) => x.id === ici.id);

    // Quantité : le nombre le plus proche avant la grillade, sans remonter
    // au-delà du numéro de table ni de la grillade précédente.
    const planchers = [finTable, g > 0 ? grillades[g - 1].fin : -1];
    let qte = 1;
    for (let i = ici.debut - 1; i > Math.max(...planchers); i--) {
      const n = quantiteDuMot(mots[i]);
      if (n !== null) { qte = Math.min(99, Math.max(1, n)); break; }
      if (i < ici.debut - 3) break;   // trop loin, ce n'est plus sa quantité
    }

    // Cuisson : la première entre cette grillade et la suivante, sinon celle
    // qui la précède immédiatement (« saignant, une côte »).
    let cuisson = null;
    const borne = suivante ? suivante.debut : mots.length;
    const apres = cuissons.find((c) => c.debut > ici.fin && c.debut < borne);
    if (apres) cuisson = apres.id;
    else {
      const avant = [...cuissons].reverse()
        .find((c) => c.fin < ici.debut && c.fin > (g > 0 ? grillades[g - 1].fin : finTable));
      if (avant) cuisson = avant.id;
    }
    if (def?.sansCuisson) cuisson = null;

    const ligne = { grillade: ici.id, cuisson, qte };
    // Signalée plutôt que devinée : une cuisson inventée enverrait la mauvaise
    // pièce au grill. L'interface la fera compléter d'un appui.
    if (!def?.sansCuisson && !cuisson) ligne.incomplete = true;

    // Deux fois la même pièce et la même cuisson se cumulent.
    const jumelle = lignes.find((l) => l.grillade === ligne.grillade && l.cuisson === ligne.cuisson);
    if (jumelle) jumelle.qte = Math.min(99, jumelle.qte + ligne.qte);
    else lignes.push(ligne);
  }

  // Ce qui n'a été reconnu ni comme table, ni comme pièce, ni comme cuisson :
  // utile pour dire au service ce qui a été laissé de côté.
  const reconnus = new Set(['table', 'tables', 'et', 'de', 'la', 'le', 'les', 'un', 'une', 'avec', 'plus', 'pour']);
  for (const t of [...grillades, ...cuissons]) for (let i = t.debut; i <= t.fin; i++) reconnus.add(String(i));
  const motsIgnores = mots.filter((m, i) =>
    !reconnus.has(String(i)) && !reconnus.has(m) && quantiteDuMot(m) === null && i !== finTable);

  return { table, lignes, motsIgnores };
}
