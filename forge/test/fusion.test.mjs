import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arbitrer, versLocal, versServeur } from '../src/lib/fusion.js';

test('arbitrage : le serveur l’emporte quand il est plus récent', () => {
  assert.equal(arbitrer(null, { id: 'a', majA: 10 }), 'distante');
  assert.equal(arbitrer({ id: 'a', majA: 10 }, null), 'locale');
  assert.equal(arbitrer({ id: 'a', majA: 10, synchro: true }, { id: 'a', majA: 20 }), 'distante');
  assert.equal(arbitrer({ id: 'a', majA: 30, synchro: true }, { id: 'a', majA: 20 }), 'locale');
  assert.equal(arbitrer({ id: 'a', majA: 20, synchro: true }, { id: 'a', majA: 20 }), 'egal');
});

test('arbitrage : une modification hors ligne n’est pas écrasée avant d’être poussée', () => {
  assert.equal(arbitrer({ id: 'a', majA: 5, synchro: false }, { id: 'a', majA: 5 }), 'locale');
  assert.equal(arbitrer({ id: 'a', majA: 5, synchro: false }, { id: 'a', majA: 40 }), 'distante');
});

test('conversions aller-retour', () => {
  const ligne = {
    id: 'x1', type: 'sport', jour: '2026-09-02', debut: '2026-09-02T18:00:00.000Z', fin: '2026-09-02T19:30:00.000Z',
    donnees: { sport: 'padel', calories: 620 }, supprime: false, maj_a: '2026-09-02T19:31:00.000Z', user_id: 'u',
  };
  const local = versLocal(ligne);
  assert.equal(local.debut, Date.parse('2026-09-02T18:00:00.000Z'));
  assert.equal(local.majA, Date.parse('2026-09-02T19:31:00.000Z'));
  assert.equal(local.synchro, true);
  assert.equal(local.donnees.calories, 620);
  const retour = versServeur(local);
  assert.equal(retour.debut, '2026-09-02T18:00:00.000Z');
  assert.equal(retour.fin, '2026-09-02T19:30:00.000Z');
  assert.ok(!('maj_a' in retour), 'maj_a est posé par la base');
  assert.ok(!('user_id' in retour), 'user_id est posé par la base');
  assert.ok(!('synchro' in retour));
});

test('données serveur incomplètes', () => {
  const l = versLocal({ id: 'y', type: 'poids', jour: '2026-09-01', donnees: null, maj_a: '2026-09-01T08:00:00Z' });
  assert.deepEqual(l.donnees, {});
  assert.equal(l.debut, null);
  assert.equal(l.supprime, false);
});
