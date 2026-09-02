import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CIRCUITS, EXERCICES, adapterCircuit, rythme, estimerCalories } from '../src/lib/circuits.js';
import { ECHAUFFEMENT_PADEL, dureeEchauffementS } from '../src/lib/echauffement.js';

test('tous les circuits référencent des exercices connus', () => {
  for (const c of CIRCUITS) for (const id of c.exercices) assert.ok(EXERCICES[id], `${c.id} : ${id}`);
  assert.ok(CIRCUITS.length >= 5);
});

test('le plan tient toujours dans le temps demandé', () => {
  for (const c of CIRCUITS) {
    for (const m of [3, 5, 7, 10, 12, 15, 20, 25, 30, 45, 60]) {
      const p = adapterCircuit(c, m);
      assert.ok(p.dureeS <= m * 60, `${c.id} ${m} min : ${p.dureeS}s`);
      assert.ok(p.dureeS >= m * 60 * 0.7, `${c.id} ${m} min : n’utilise que ${p.dureeS}s`);
      assert.ok(p.exercices.length >= 3);
      assert.ok(p.tours >= 1);
      const attendu = p.tours * p.exercices.length * 2 - 1;
      assert.equal(p.etapes.length, attendu, 'travail + repos, sans repos après la dernière étape');
      assert.equal(p.etapes.reduce((s, e) => s + e.dureeS, 0), p.dureeS);
      assert.equal(p.etapes[p.etapes.length - 1].type, 'travail');
    }
  }
});

test('plus de temps → plus de travail, et le rythme se détend', () => {
  const c = CIRCUITS[0];
  const p5 = adapterCircuit(c, 5);
  const p30 = adapterCircuit(c, 30);
  assert.ok(p30.tours * p30.exercices.length > p5.tours * p5.exercices.length);
  assert.ok(rythme(5).travailS < rythme(45).travailS);
  assert.ok(p30.tours >= 2, 'avec 30 minutes on fait plusieurs tours');
});

test('les exercices gardés sont les premiers (priorité)', () => {
  const c = CIRCUITS[0];
  const p = adapterCircuit(c, 10);
  assert.deepEqual(p.exercices.map((e) => e.id), c.exercices.slice(0, p.exercices.length));
});

test('estimation de calories', () => {
  assert.equal(estimerCalories(20, 80, 3), Math.round((7 * 3.5 * 80) / 200 * 20));
  assert.ok(estimerCalories(20, 100, 3) > estimerCalories(20, 80, 3));
});

test('l’échauffement padel dure exactement 10 minutes', () => {
  assert.equal(dureeEchauffementS(), 600);
  assert.equal(ECHAUFFEMENT_PADEL.etapes.length, 10);
  assert.ok(ECHAUFFEMENT_PADEL.etapes.every((e) => e.type === 'travail' && e.consigne && e.phase));
});
