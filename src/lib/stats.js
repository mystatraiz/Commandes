import { CUISSONS, GRILLADES, cuissonById, grilladeById } from '../config.js';

/** Nombre total de pièces d'une commande. */
export const nbPieces = (cmd) => cmd.lignes.reduce((s, l) => s + l.qte, 0);

/**
 * Agrège un lot de commandes en tout ce qu'affiche l'écran des statistiques.
 * Les commandes encore en cours comptent dans les volumes ; seules les
 * commandes servies alimentent le temps de service, qui n'a de sens qu'une
 * fois la commande partie.
 */
export function calculer(commandes) {
  const pieces = { total: 0, parGrillade: {}, parCuisson: {} };
  const parTable = {};
  const parHeure = Array.from({ length: 24 }, () => 0);
  const durees = [];

  for (const cmd of commandes) {
    const n = nbPieces(cmd);
    pieces.total += n;
    parTable[cmd.table] = (parTable[cmd.table] || 0) + n;
    parHeure[new Date(cmd.creeeA).getHours()] += n;

    if (cmd.statut === 'servie' && cmd.servieA > cmd.creeeA) durees.push(cmd.servieA - cmd.creeeA);

    for (const l of cmd.lignes) {
      pieces.parGrillade[l.grillade] = (pieces.parGrillade[l.grillade] || 0) + l.qte;
      // Le poulet n'a pas de cuisson : il ne doit pas fausser la répartition.
      if (l.cuisson) pieces.parCuisson[l.cuisson] = (pieces.parCuisson[l.cuisson] || 0) + l.qte;
    }
  }

  const piecesAvecCuisson = Object.values(pieces.parCuisson).reduce((a, b) => a + b, 0);

  const classementGrillades = GRILLADES
    .map((g) => ({ id: g.id, nom: g.nom, n: pieces.parGrillade[g.id] || 0 }))
    // Une grillade retirée de la carte reste comptée si elle figure dans l'historique.
    .concat(
      Object.keys(pieces.parGrillade)
        .filter((id) => !grilladeById(id))
        .map((id) => ({ id, nom: id, n: pieces.parGrillade[id] })),
    )
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  const repartitionCuissons = CUISSONS
    .map((c) => ({
      id: c.id,
      nom: c.nom,
      couleur: c.couleur,
      n: pieces.parCuisson[c.id] || 0,
      part: piecesAvecCuisson ? (pieces.parCuisson[c.id] || 0) / piecesAvecCuisson : 0,
    }))
    .filter((x) => x.n > 0);

  const tables = Object.entries(parTable)
    .map(([table, n]) => ({ table, n }))
    .sort((a, b) => b.n - a.n);

  const dureeMoyenne = durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : 0;
  const heurePointe = parHeure.reduce((best, n, h) => (n > parHeure[best] ? h : best), 0);

  return {
    nbCommandes: commandes.length,
    pieces: pieces.total,
    piecesAvecCuisson,
    moyenneParCommande: commandes.length ? pieces.total / commandes.length : 0,
    dureeMoyenne,
    nbServies: durees.length,
    classementGrillades,
    repartitionCuissons,
    tables,
    parHeure,
    heurePointe: parHeure[heurePointe] > 0 ? heurePointe : null,
    cuissonFavorite: repartitionCuissons.length
      ? repartitionCuissons.reduce((a, b) => (b.n > a.n ? b : a))
      : null,
  };
}

export { cuissonById, grilladeById };
