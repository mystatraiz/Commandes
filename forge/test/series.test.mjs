import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleJour, debutJour, jourPlus, derniersJours } from '../src/lib/temps.js';
import { heuresJeuneDuJour, jeuneEnCours, phaseCourante } from '../src/lib/jeune.js';
import { construireSeries, normaliser, moyenneMobile, bornes, bilanPoids } from '../src/lib/series.js';

const J = cleJour();
const H = 3600000;

test('clés de jour', () => {
  assert.equal(derniersJours(3).length, 3);
  assert.equal(derniersJours(3)[2], J);
  assert.equal(jourPlus(jourPlus(J, -1), 1), J);
  assert.equal(cleJour(debutJour(J)), J);
});

test('heures de jeûne réparties sur les journées', () => {
  const minuit = debutJour(J);
  const entrees = [
    // 20 h → 12 h le lendemain : 4 h la veille, 12 h aujourd'hui
    { id: 'j1', type: 'jeune', debut: minuit - 4 * H, fin: minuit + 12 * H, donnees: { objectifH: 16 } },
  ];
  assert.equal(heuresJeuneDuJour(entrees, jourPlus(J, -1), minuit + 20 * H), 4);
  assert.equal(heuresJeuneDuJour(entrees, J, minuit + 20 * H), 12);
  assert.equal(heuresJeuneDuJour(entrees, jourPlus(J, -2), minuit + 20 * H), 0);
});

test('un jeûne en cours compte jusqu’à maintenant', () => {
  const minuit = debutJour(J);
  const entrees = [{ id: 'j1', type: 'jeune', debut: minuit + 2 * H, fin: null, donnees: {} }];
  assert.equal(heuresJeuneDuJour(entrees, J, minuit + 8 * H), 6);
  assert.equal(jeuneEnCours(entrees).id, 'j1');
  assert.equal(jeuneEnCours([{ ...entrees[0], supprime: true }]), null);
});

test('phases du jeûne', () => {
  assert.equal(phaseCourante(2).nom, 'Digestion');
  assert.equal(phaseCourante(13).nom, 'Brûlage des graisses');
  assert.equal(phaseCourante(13).suivante.depuis, 16);
  assert.equal(phaseCourante(30).suivante, null);
});

test('séries jour par jour', () => {
  const minuit = debutJour(J);
  const entrees = [
    { id: 'p1', type: 'poids', jour: J, donnees: { kg: 84.2 }, majA: 2 },
    { id: 'p0', type: 'poids', jour: J, donnees: { kg: 99 }, majA: 1 },      // écrasée par la plus récente
    { id: 'p2', type: 'poids', jour: jourPlus(J, -2), donnees: { kg: 85 }, majA: 1 },
    { id: 's1', type: 'sport', jour: J, debut: minuit + 10 * H, donnees: { sport: 'padel', calories: 600, dureeMin: 90 } },
    { id: 's2', type: 'sport', jour: J, debut: minuit + 18 * H, donnees: { sport: 'renfo', calories: 150, dureeMin: 20 } },
    { id: 's3', type: 'sport', jour: J, debut: minuit + 19 * H, donnees: { sport: 'autre' }, supprime: true },
  ];
  const s = construireSeries(entrees, 3, minuit + 20 * H);
  assert.deepEqual(s.jours, [jourPlus(J, -2), jourPlus(J, -1), J]);
  assert.deepEqual(s.poids, [85, null, 84.2]);
  assert.deepEqual(s.activite, [0, 0, 750]);
  assert.deepEqual(s.minutes, [0, 0, 110]);
  assert.deepEqual(s.sessions, [0, 0, 2]);
  const b = bilanPoids(entrees, minuit + 20 * H);
  assert.equal(b.dernier, 84.2);
  assert.equal(b.ecartTotal, -0.8);
});

test('normalisation et moyenne mobile', () => {
  const n = normaliser([80, null, 90, 85]);
  assert.deepEqual(n.valeurs, [0, null, 1, 0.5]);
  assert.equal(n.min, 80);
  assert.deepEqual(normaliser([null, null]).valeurs, [null, null]);
  assert.deepEqual(moyenneMobile([1, null, 3, 5], 2), [1, 1, 3, 4]);
  const b = bornes([84.2, 85.1, 83.9]);
  assert.ok(b.min < 83.9 && b.max > 85.1);
  assert.equal(bornes([100, 300], { zero: true }).min, 0);
});
