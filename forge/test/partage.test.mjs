import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PARAM_CODE, lienApp, lienDefi, codeDepuisLien, messageDefi, messageApp, texteComplet,
} from '../src/lib/partage.js';

test('lien de l’application : ni paramètre, ni ancre, ni index.html', () => {
  assert.equal(lienApp('https://grossac.app/index.html?defi=ABC234#x'), 'https://grossac.app/');
  assert.equal(lienApp('https://grossac.app/'), 'https://grossac.app/');
  assert.equal(lienApp('http://localhost:5173/?a=1'), 'http://localhost:5173/');
  // Déployé dans un sous-dossier, le chemin reste : le lien doit ouvrir l'app.
  assert.equal(lienApp('https://x.fr/gs/index.html'), 'https://x.fr/gs/');
  assert.equal(lienApp('pas une adresse'), '');
});

test('lien d’invitation : le code voyage dans l’adresse', () => {
  const l = lienDefi('abc-234', 'https://grossac.app/?defi=VIEUX');
  assert.equal(l, `https://grossac.app/?${PARAM_CODE}=ABC234`);
  assert.equal(codeDepuisLien(l), 'ABC234');
  // Un aller-retour ne doit rien perdre, quelle que soit la casse d'origine.
  assert.equal(codeDepuisLien(lienDefi('xy7k9m', 'https://x.fr/gs/')), 'XY7K9M');
});

test('lien d’invitation : un code douteux ne passe pas', () => {
  // Ni code absent, ni code tronqué, ni caractère exclu de l'alphabet.
  assert.equal(codeDepuisLien('https://grossac.app/'), null);
  assert.equal(codeDepuisLien(`https://grossac.app/?${PARAM_CODE}=ABC`), null);
  assert.equal(codeDepuisLien(`https://grossac.app/?${PARAM_CODE}=ABCDE0`), null);
  assert.equal(codeDepuisLien(`https://grossac.app/?${PARAM_CODE}=`), null);
  assert.equal(codeDepuisLien('n’importe quoi'), null);
  // Sans code valable, on partage au moins l'application.
  assert.equal(lienDefi('', 'https://grossac.app/'), 'https://grossac.app/');
});

test('message d’invitation à un défi : le code en clair, le lien à part', () => {
  const defi = { nom: 'Opération bikini', code: 'ABC234', gage: 'le dernier paie la tournée' };
  const lien = lienDefi(defi.code, 'https://grossac.app/');
  const m = messageDefi(defi, lien);
  assert.match(m.titre, /Opération bikini/);
  assert.match(m.texte, /ABC234/, 'le code se lit même sans cliquer');
  assert.match(m.texte, /le dernier paie la tournée/);
  // La feuille de partage place l'adresse elle-même : pas deux fois.
  assert.ok(!m.texte.includes('http'), 'le lien reste hors du texte');
  assert.equal(m.lien, lien);
  assert.equal(texteComplet(m), `${m.texte}\n${lien}`);
});

test('message d’invitation à un défi : sans gage, rien d’inventé', () => {
  const m = messageDefi({ nom: 'Sec en mars', code: 'XY7K9M' }, 'https://grossac.app/?defi=XY7K9M');
  assert.ok(!m.texte.includes('En jeu'));
  assert.match(m.texte, /XY7K9M/);
});

test('message d’invitation à l’application : pas de code de défi', () => {
  const m = messageApp(lienApp('https://grossac.app/?defi=ABC234'));
  assert.equal(m.lien, 'https://grossac.app/');
  assert.ok(!m.texte.includes('ABC234'));
  assert.ok(!codeDepuisLien(m.lien), 'inviter sur l’app n’inscrit personne à un défi');
  assert.match(m.texte, /Gros Sac/);
});
