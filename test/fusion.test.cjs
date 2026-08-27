/* Tests de l'arbitrage entre la version locale d'une commande et celle du
   serveur. C'est la pièce la plus délicate de la synchronisation : elle décide
   qui gagne quand deux téléphones ont modifié la même commande. */

let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };

(async () => {
  const { arbitrer, versLocal, versServeur } = await import('../src/lib/fusion.js');

  console.log('\n== Arbitrage ==');
  ok(arbitrer(null, { id: 'a', majA: 10 }) === 'distante',
    'une commande inconnue localement est reprise du serveur');
  ok(arbitrer({ id: 'a', majA: 10 }, null) === 'locale',
    'une commande absente du serveur est conservée');
  ok(arbitrer({ id: 'a', majA: 10, synchro: true }, { id: 'a', majA: 20 }) === 'distante',
    'la version la plus récente du serveur gagne');
  ok(arbitrer({ id: 'a', majA: 30, synchro: true }, { id: 'a', majA: 20 }) === 'locale',
    'une version serveur plus ancienne est ignorée');
  ok(arbitrer({ id: 'a', majA: 20, synchro: true }, { id: 'a', majA: 20 }) === 'egal',
    'deux versions identiques ne déclenchent aucune écriture');

  console.log('\n== Saisie hors ligne ==');
  // Le cas qui compte : une commande prise sans réseau ne doit jamais être
  // écrasée par la version du serveur avant d'avoir été poussée.
  ok(arbitrer({ id: 'a', majA: 0, synchro: false }, { id: 'a', majA: 0 }) === 'locale',
    'une modification locale non poussée résiste au serveur');
  ok(arbitrer({ id: 'a', majA: 5, synchro: false }, { id: 'a', majA: 5 }) === 'locale',
    'à horodatage égal, la modification non poussée l’emporte');
  ok(arbitrer({ id: 'a', majA: 5, synchro: false }, { id: 'a', majA: 40 }) === 'distante',
    'mais une modification serveur postérieure reste prioritaire');

  console.log('\n== Conversions ==');
  const ligneServeur = {
    id: 'x1', num_table: '12',
    lignes: [{ grillade: 'cote', cuisson: 'saig', qte: 2 }],
    creee_a: '2026-08-27T18:30:00.000Z',
    servie_a: null, statut: 'en_cours',
    maj_a: '2026-08-27T18:31:00.000Z',
  };
  const local = versLocal(ligneServeur);
  ok(local.table === '12', 'num_table devient table');
  ok(local.creeeA === Date.parse('2026-08-27T18:30:00.000Z'), 'les dates deviennent des horodatages');
  ok(local.servieA === null, 'une commande non servie garde servieA à null');
  ok(local.majA === Date.parse('2026-08-27T18:31:00.000Z'), 'majA est repris du serveur');
  ok(local.synchro === true, 'ce qui vient du serveur est marqué synchronisé');
  ok(local.lignes.length === 1 && local.lignes[0].qte === 2, 'les lignes sont conservées');

  const retour = versServeur(local);
  ok(retour.num_table === '12' && retour.id === 'x1', 'aller-retour sans perte d’identité');
  ok(retour.creee_a === '2026-08-27T18:30:00.000Z', 'la date de création est restituée telle quelle');
  ok(!('maj_a' in retour), 'maj_a n’est jamais envoyé : c’est la base qui le pose');
  ok(!('synchro' in retour), 'le marqueur local ne part pas sur le serveur');

  console.log('\n== Données serveur incomplètes ==');
  const abime = versLocal({ id: 'y', num_table: '5', lignes: null, creee_a: '2026-08-27T18:00:00.000Z', maj_a: '2026-08-27T18:00:00.000Z', statut: 'en_cours', servie_a: null });
  ok(Array.isArray(abime.lignes) && abime.lignes.length === 0, 'des lignes absentes donnent un tableau vide, pas une erreur');

  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
