/* Arbitrage entre la version locale d'une entrée et celle du serveur.

   Plusieurs appareils (téléphone, tablette) peuvent modifier la même entrée
   hors ligne. La règle est la dernière écriture gagne, arbitrée sur `majA`,
   posé par la base et non par l'appareil.

   Fonction pure, testable seule. */

/** @returns 'distante' | 'locale' | 'egal' */
export function arbitrer(locale, distante) {
  if (!locale) return 'distante';
  if (!distante) return 'locale';
  if (locale.synchro === false && distante.majA <= (locale.majA ?? 0)) return 'locale';
  const ml = locale.majA ?? 0;
  const md = distante.majA ?? 0;
  if (md > ml) return 'distante';
  if (ml > md) return 'locale';
  return 'egal';
}

const versMs = (x) => (x ? new Date(x).getTime() : null);
const versIso = (ms) => (ms ? new Date(ms).toISOString() : null);

/** Ligne de la base → entrée de l'application. */
export function versLocal(ligne) {
  return {
    id: ligne.id,
    type: ligne.type,
    jour: ligne.jour || null,
    debut: versMs(ligne.debut),
    fin: versMs(ligne.fin),
    donnees: ligne.donnees && typeof ligne.donnees === 'object' ? ligne.donnees : {},
    supprime: Boolean(ligne.supprime),
    majA: versMs(ligne.maj_a) || 0,
    synchro: true,
  };
}

/** Entrée de l'application → ligne de la base. `maj_a` et `user_id` sont posés par la base. */
export function versServeur(e) {
  return {
    id: e.id,
    type: e.type,
    jour: e.jour || null,
    debut: versIso(e.debut),
    fin: versIso(e.fin),
    donnees: e.donnees || {},
    supprime: Boolean(e.supprime),
  };
}
