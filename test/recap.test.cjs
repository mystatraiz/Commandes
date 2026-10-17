/* Tests du récapitulatif du grill : c'est le compte sur lequel le grill
   travaille, il doit être juste même quand les commandes se ressemblent. */

let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };

(async () => {
  const { recapitulatif } = await import('../src/lib/recap.js');
  const cmd = (table, ...lignes) => ({ table, lignes });
  const l = (grillade, cuisson, qte = 1, truffe = false) =>
    truffe ? { grillade, cuisson, qte, truffe: true } : { grillade, cuisson, qte };

  console.log('\n== Regroupement ==');
  let r = recapitulatif([
    cmd('22', l('cote', 'saig', 2)),
    cmd('12', l('cote', 'saig', 1)),
  ]);
  ok(r.total === 3, 'le total additionne les pièces de toutes les commandes');
  ok(r.groupes.length === 1, 'la même viande ne fait qu’un groupe');
  ok(r.groupes[0].lignes.length === 1, 'la même cuisson ne fait qu’une ligne');
  ok(r.groupes[0].lignes[0].qte === 3, 'les quantités se cumulent');
  ok(r.groupes[0].lignes[0].tables.join(' ') === '22 12', 'les tables concernées sont citées');

  console.log('\n== Ce qui ne doit pas se confondre ==');
  r = recapitulatif([cmd('22', l('cote', 'saig', 1), l('cote', 'bleu', 1))]);
  ok(r.groupes[0].lignes.length === 2, 'deux cuissons restent deux lignes');

  r = recapitulatif([cmd('22', l('cote', 'saig', 1), l('cote', 'saig', 1, true))]);
  ok(r.groupes[0].lignes.length === 2, 'truffée ou non, ce sont deux lignes');
  ok(r.groupes[0].total === 2, 'mais la viande totalise les deux');
  ok(r.groupes[0].lignes[1].truffe === true, 'la truffée vient après la nature');

  console.log('\n== Une table n’est citée qu’une fois ==');
  r = recapitulatif([cmd('22', l('cote', 'saig', 1), l('cote', 'saig', 2))]);
  ok(r.groupes[0].lignes[0].qte === 3, 'deux lignes identiques de la même table se cumulent');
  ok(r.groupes[0].lignes[0].tables.length === 1, 'sans citer la table deux fois');

  console.log('\n== Ordre ==');
  r = recapitulatif([cmd('22', l('poulet', null, 1), l('cote', 'saig', 1), l('bavette', 'bleu', 1))]);
  ok(r.groupes.map((g) => g.grillade).join(' ') === 'cote bavette poulet',
    'les viandes suivent l’ordre de la carte, pas celui de la saisie');

  r = recapitulatif([cmd('22', l('cote', 'bcui', 1), l('cote', 'bleu', 1), l('cote', 'apnt', 1))]);
  ok(r.groupes[0].lignes.map((x) => x.cuisson).join(' ') === 'bleu apnt bcui',
    'les cuissons vont de la plus saignante à la plus cuite');

  console.log('\n== Pièce sans cuisson ==');
  r = recapitulatif([cmd('22', l('poulet', null, 2))]);
  ok(r.groupes[0].lignes[0].cuisson === null, 'le poulet n’a pas de cuisson inventée');
  ok(r.total === 2, 'il compte tout de même dans le total');

  console.log('\n== Cas limites ==');
  ok(recapitulatif([]).total === 0, 'aucune commande : total nul');
  ok(recapitulatif([]).groupes.length === 0, 'et aucun groupe');
  ok(recapitulatif([cmd('22')]).total === 0, 'une commande sans ligne ne casse rien');
  r = recapitulatif([cmd('22', l('cote', 'saig', 0), l('cote', 'bleu', 2))]);
  ok(r.total === 2 && r.groupes[0].lignes.length === 1, 'une ligne à quantité nulle est ignorée');

  r = recapitulatif([cmd('22', l('ribcap', 'saig', 1), l('cote', 'saig', 1))]);
  ok(r.groupes.map((g) => g.grillade).join(' ') === 'cote ribcap',
    'une viande retirée de la carte est comptée, et placée en fin');

  console.log('\n== Le total correspond à la somme des groupes ==');
  r = recapitulatif([
    cmd('1', l('cote', 'saig', 2), l('poulet', null, 1)),
    cmd('2', l('agneau', 'bleu', 3), l('cote', 'saig', 1, true)),
    cmd('3', l('cote', 'saig', 1)),
  ]);
  const somme = r.groupes.reduce((s, g) => s + g.total, 0);
  const sommeLignes = r.groupes.reduce((s, g) => s + g.lignes.reduce((n, x) => n + x.qte, 0), 0);
  ok(r.total === 8, `total attendu 8 (obtenu ${r.total})`);
  ok(somme === r.total, 'la somme des viandes égale le total');
  ok(sommeLignes === r.total, 'la somme des lignes aussi — rien ne se perd au regroupement');

  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
