/* Récapitulatif de ce qui est sur le grill à l'instant T.

   Toutes les commandes en cours sont fondues en une seule liste : les pièces
   identiques se regroupent, pour qu'on puisse compter les morceaux d'un coup
   d'œil au lieu de les additionner carte par carte.

   Deux pièces ne sont « identiques » que si la viande, la cuisson ET la truffe
   coïncident : une côte saignante truffée ne se compte pas avec une côte
   saignante ordinaire, sinon le supplément se perdrait dans le total.

   Fonction pure : c'est elle qui donne le compte sur lequel le grill
   travaille, elle doit pouvoir être vérifiée seule. */

import { CUISSONS, GRILLADES } from '../config.js';

const rangGrillade = (id) => {
  const i = GRILLADES.findIndex((g) => g.id === id);
  return i === -1 ? GRILLADES.length : i;       // une pièce retirée de la carte passe en fin
};
const rangCuisson = (id) => {
  const i = CUISSONS.findIndex((c) => c.id === id);
  return i === -1 ? CUISSONS.length : i;
};

/**
 * @param {Array} commandes commandes en cours
 * @returns {{ total: number, nbCommandes: number, groupes: Array }}
 *   groupes : [{ grillade, total, lignes: [{ cuisson, truffe, qte, tables }] }]
 */
export function recapitulatif(commandes) {
  const parGrillade = new Map();
  let total = 0;

  for (const cmd of commandes) {
    for (const l of cmd.lignes) {
      const qte = Number(l.qte) || 0;
      if (qte <= 0) continue;
      total += qte;

      if (!parGrillade.has(l.grillade)) {
        parGrillade.set(l.grillade, { grillade: l.grillade, total: 0, lignes: new Map() });
      }
      const groupe = parGrillade.get(l.grillade);
      groupe.total += qte;

      const cuisson = l.cuisson ?? null;
      const truffe = Boolean(l.truffe);
      const cle = `${cuisson ?? '-'}|${truffe ? 'T' : ''}`;
      if (!groupe.lignes.has(cle)) {
        groupe.lignes.set(cle, { cuisson, truffe, qte: 0, tables: [] });
      }
      const ligne = groupe.lignes.get(cle);
      ligne.qte += qte;
      // La table n'est citée qu'une fois, même si elle a commandé deux fois
      // la même pièce : c'est un repère, pas un compteur.
      if (!ligne.tables.includes(cmd.table)) ligne.tables.push(cmd.table);
    }
  }

  const groupes = [...parGrillade.values()]
    .map((g) => ({
      ...g,
      lignes: [...g.lignes.values()].sort(
        (a, b) => rangCuisson(a.cuisson) - rangCuisson(b.cuisson) || Number(a.truffe) - Number(b.truffe),
      ),
    }))
    // Ordre de la carte : le grill retrouve ses pièces là où il les cherche.
    .sort((a, b) => rangGrillade(a.grillade) - rangGrillade(b.grillade));

  return { total, nbCommandes: commandes.length, groupes };
}
