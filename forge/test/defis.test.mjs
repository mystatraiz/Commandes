import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleJour, debutJour, jourPlus } from '../src/lib/temps.js';
import {
  statutDefi, joursTotal, joursRestants, progressionTemps, finPour,
  calculerProgres, valeurClassement, aPublier, classer, ecartAuDessus, palmares,
  genererCode, normaliserCode, codeValide, LONGUEUR_CODE,
} from '../src/lib/defis.js';

const J = cleJour();
const H = 3600000;
const defi = (p = {}) => ({ id: 'd1', mesure: 'pourcentage', debut: jourPlus(J, -10), fin: jourPlus(J, 10), ...p });

test('code d’invitation : lisible et sans caractères qui se confondent', () => {
  let n = 0;
  const code = genererCode(() => { n += 0.031; return n % 1; });
  assert.equal(code.length, LONGUEUR_CODE);
  assert.ok(codeValide(code));
  assert.ok(!/[ILO01]/.test(genererCode()), 'ni I, L, O, 0 ni 1');
  assert.equal(normaliserCode(' ab2-c3d '), 'AB2C3D');
  assert.ok(codeValide('ab2-c3d'.slice(0, 7)) === false || codeValide('AB2C3D'));
  assert.ok(!codeValide('ABC'), 'trop court');
  assert.ok(!codeValide('ABCDE0'), '0 n’appartient pas à l’alphabet');
});

test('statut selon la période, journée de fin comprise', () => {
  const maintenant = debutJour(J) + 12 * H;
  assert.equal(statutDefi(defi({ debut: jourPlus(J, 3), fin: jourPlus(J, 20) }), maintenant), 'a_venir');
  assert.equal(statutDefi(defi(), maintenant), 'en_cours');
  assert.equal(statutDefi(defi({ debut: jourPlus(J, -20), fin: jourPlus(J, -1) }), maintenant), 'termine');
  // Le dernier jour, on pèse encore : le défi n'est pas fini avant minuit.
  assert.equal(statutDefi(defi({ debut: jourPlus(J, -20), fin: J }), maintenant), 'en_cours');
  assert.equal(statutDefi(defi({ debut: J, fin: J }), maintenant), 'en_cours');
});

test('durées et décompte', () => {
  const maintenant = debutJour(J) + 12 * H;
  assert.equal(joursTotal({ debut: J, fin: J }), 1);
  assert.equal(joursTotal({ debut: J, fin: jourPlus(J, 13) }), 14);
  assert.equal(finPour(J, 28), jourPlus(J, 27), 'une durée de 28 jours compte la journée de début');
  assert.equal(joursRestants(defi({ debut: jourPlus(J, -5), fin: J }), maintenant), 1, 'le dernier jour, il en reste un');
  assert.equal(joursRestants(defi({ debut: jourPlus(J, -20), fin: jourPlus(J, -1) }), maintenant), 0);
  const p = progressionTemps(defi({ debut: jourPlus(J, -10), fin: jourPlus(J, 9) }), maintenant);
  assert.ok(p > 0.5 && p < 0.56, `à mi-parcours (${p})`);
  assert.equal(progressionTemps(defi({ debut: jourPlus(J, 5), fin: jourPlus(J, 10) }), maintenant), 0);
  assert.equal(progressionTemps(defi({ debut: jourPlus(J, -20), fin: jourPlus(J, -5) }), maintenant), 1);
});

test('progrès : le départ est la dernière pesée d’avant le défi', () => {
  const d = defi({ debut: jourPlus(J, -10), fin: jourPlus(J, 10) });
  const pesees = [
    { jour: jourPlus(J, -30), kg: 105 },   // trop ancienne
    { jour: jourPlus(J, -12), kg: 100 },   // le vrai départ
    { jour: jourPlus(J, -5), kg: 98 },
    { jour: J, kg: 97 },
  ];
  const p = calculerProgres(pesees, d, debutJour(J) + 12 * H);
  assert.equal(p.depart, 100);
  assert.equal(p.actuel, 97);
  assert.equal(p.kg, 3);
  assert.equal(p.pct, 3);
  assert.equal(p.departEstime, false);
  assert.equal(p.pesees, 2);
});

test('progrès : sans pesée antérieure, la première de la période fait foi', () => {
  const d = defi({ debut: jourPlus(J, -10), fin: jourPlus(J, 10) });
  const p = calculerProgres([{ jour: jourPlus(J, -8), kg: 80 }, { jour: J, kg: 78 }], d, debutJour(J) + 12 * H);
  assert.equal(p.depart, 80);
  assert.equal(p.kg, 2);
  assert.equal(p.pct, 2.5);
  assert.equal(p.departEstime, true, 'le départ est signalé comme estimé');
});

test('progrès : un défi terminé garde son résultat figé', () => {
  const d = defi({ debut: jourPlus(J, -20), fin: jourPlus(J, -10) });
  const pesees = [
    { jour: jourPlus(J, -21), kg: 100 },
    { jour: jourPlus(J, -10), kg: 96 },
    { jour: J, kg: 90 },                 // bien après la fin : ne compte pas
  ];
  const p = calculerProgres(pesees, d, debutJour(J) + 12 * H);
  assert.equal(p.actuel, 96);
  assert.equal(p.kg, 4);
});

test('progrès : aucune pesée exploitable', () => {
  const d = defi({ debut: jourPlus(J, -2), fin: jourPlus(J, 10) });
  assert.equal(calculerProgres([], d), null);
  assert.equal(calculerProgres([{ jour: jourPlus(J, 5), kg: 80 }], d, debutJour(J) + 12 * H), null,
    'une pesée postérieure à aujourd’hui ne fait pas un départ');
});

test('une reprise de poids donne des valeurs négatives', () => {
  const d = defi({ debut: jourPlus(J, -10), fin: jourPlus(J, 10) });
  const p = calculerProgres([{ jour: jourPlus(J, -11), kg: 80 }, { jour: J, kg: 82 }], d, debutJour(J) + 12 * H);
  assert.equal(p.kg, -2);
  assert.equal(p.pct, -2.5);
});

test('la mesure du défi choisit la valeur de classement', () => {
  const p = { kg: 3, pct: 3.75 };
  assert.equal(valeurClassement(p, 'kilos'), 3);
  assert.equal(valeurClassement(p, 'pourcentage'), 3.75);
  assert.equal(valeurClassement(null, 'kilos'), null);
});

test('publication : le poids absolu ne part jamais, les chiffres suivent le réglage', () => {
  const progres = { depart: 100, actuel: 96, kg: 4, pct: 4 };
  const d = defi({ mesure: 'pourcentage' });

  const rang = aPublier(progres, d, 'rang');
  assert.equal(rang.valeur, 4, 'la valeur de classement part toujours, sinon pas de classement');
  assert.equal(rang.pct, null);
  assert.equal(rang.kg, null);

  const pct = aPublier(progres, d, 'pourcentage');
  assert.equal(pct.pct, 4);
  assert.equal(pct.kg, null, 'les kilos restent cachés');

  const kilos = aPublier(progres, d, 'kilos');
  assert.equal(kilos.pct, 4);
  assert.equal(kilos.kg, 4);

  for (const v of ['rang', 'pourcentage', 'kilos']) {
    const publie = aPublier(progres, d, v);
    assert.ok(!('depart' in publie) && !('actuel' in publie), `poids absent en ${v}`);
    assert.ok(!Object.values(publie).includes(100), `le poids de départ ne fuit pas en ${v}`);
  }
});

test('classement : ex æquo partagés, rang suivant sauté', () => {
  const c = classer([
    { userId: 'a', pseudo: 'Alex', valeur: 3.2 },
    { userId: 'b', pseudo: 'Bob', valeur: 4.5 },
    { userId: 'c', pseudo: 'Chris', valeur: 3.2 },
    { userId: 'd', pseudo: 'Dan', valeur: 1 },
  ]);
  assert.deepEqual(c.map((p) => [p.pseudo, p.rang]), [['Bob', 1], ['Alex', 2], ['Chris', 2], ['Dan', 4]]);
});

test('classement : ceux qui ne se sont pas pesés ferment la marche, sans rang', () => {
  const c = classer([
    { userId: 'a', pseudo: 'Alex', valeur: null },
    { userId: 'b', pseudo: 'Bob', valeur: 2 },
    { userId: 'c', pseudo: 'Zoé', valeur: undefined },
  ]);
  assert.deepEqual(c.map((p) => p.pseudo), ['Bob', 'Alex', 'Zoé']);
  assert.equal(c[0].rang, 1);
  assert.equal(c[1].rang, null);
  assert.equal(c[2].rang, null);
});

test('classement : même ordre quel que soit l’appareil', () => {
  const gens = [
    { userId: 'a', pseudo: 'Alex', valeur: 2 },
    { userId: 'b', pseudo: 'Bob', valeur: 2 },
    { userId: 'c', pseudo: 'Chris', valeur: 2 },
  ];
  const a = classer(gens).map((p) => p.pseudo);
  const b = classer([...gens].reverse()).map((p) => p.pseudo);
  assert.deepEqual(a, b, 'le tri secondaire sur le pseudo rend l’ordre stable');
});

test('écart à celui de devant', () => {
  const c = classer([
    { userId: 'a', pseudo: 'Alex', valeur: 3.2 },
    { userId: 'b', pseudo: 'Bob', valeur: 4.5 },
    { userId: 'd', pseudo: 'Dan', valeur: null },
  ]);
  assert.equal(ecartAuDessus(c, 'a'), 1.3);
  assert.equal(ecartAuDessus(c, 'b'), null, 'le premier n’a personne devant');
  assert.equal(ecartAuDessus(c, 'd'), null, 'sans valeur, pas d’écart');
  assert.equal(ecartAuDessus(c, 'inconnu'), null);
});

test('palmarès : les trois premiers seulement', () => {
  const c = classer([1, 2, 3, 4, 5].map((n) => ({ userId: `u${n}`, pseudo: `P${n}`, valeur: n })));
  assert.deepEqual(palmares(c).map((p) => p.pseudo), ['P5', 'P4', 'P3']);
  assert.deepEqual(palmares(classer([])), []);
});
