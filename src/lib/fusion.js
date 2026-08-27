/* Arbitrage entre la version locale d'une commande et celle du serveur.

   Deux téléphones peuvent modifier la même commande pendant une coupure
   réseau. La règle est la dernière écriture gagne, arbitrée sur `majA`, qui
   est posé par la base et non par l'appareil : une horloge déréglée sur un
   téléphone ne peut donc pas faire gagner ses modifications à tort.

   Fonction pure et sans effet de bord : c'est la pièce la plus délicate de la
   synchronisation, elle doit être testable seule. */

/**
 * @returns 'distante' | 'locale' | 'egal'
 */
export function arbitrer(locale, distante) {
  if (!locale) return 'distante';
  if (!distante) return 'locale';

  // Une modification locale pas encore poussée n'a pas encore de `majA`
  // serveur : elle est prioritaire, sinon le serveur l'écraserait avant même
  // de l'avoir reçue.
  if (locale.synchro === false && distante.majA <= (locale.majA ?? 0)) return 'locale';

  const ml = locale.majA ?? 0;
  const md = distante.majA ?? 0;
  if (md > ml) return 'distante';
  if (ml > md) return 'locale';
  return 'egal';
}

/** Passe une ligne de la base au format utilisé dans l'application. */
export function versLocal(ligne) {
  return {
    id: ligne.id,
    table: ligne.num_table,
    lignes: Array.isArray(ligne.lignes) ? ligne.lignes : [],
    creeeA: new Date(ligne.creee_a).getTime(),
    servieA: ligne.servie_a ? new Date(ligne.servie_a).getTime() : null,
    statut: ligne.statut,
    majA: new Date(ligne.maj_a).getTime(),
    synchro: true,
  };
}

/** Passe une commande de l'application au format de la base. */
export function versServeur(cmd) {
  return {
    id: cmd.id,
    num_table: cmd.table,
    lignes: cmd.lignes,
    creee_a: new Date(cmd.creeeA).toISOString(),
    servie_a: cmd.servieA ? new Date(cmd.servieA).toISOString() : null,
    statut: cmd.statut,
  };
}
