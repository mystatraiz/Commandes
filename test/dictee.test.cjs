/* Test du parcours de dictée dans un vrai navigateur.

   Le moteur de reconnaissance du navigateur est remplacé par un faux, injecté
   avant le chargement de la page : on contrôle ainsi ce qui est « entendu »,
   y compris les cas d'échec (micro refusé, rien entendu). */

const { chromium } = require('playwright');
const { start } = require('./serve.cjs');

const EXE = process.env.CHROME_PATH || undefined;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };

// Faux SpeechRecognition : rejoue un texte, ou déclenche une erreur choisie.
const FAUX_MICRO = `
window.__dictee = { texte: '', erreur: null };
class FauxReco {
  constructor() { this.lang=''; this.continuous=false; this.interimResults=false; }
  start() {
    setTimeout(() => {
      const { texte, erreur } = window.__dictee;
      if (erreur) { this.onerror && this.onerror({ error: erreur }); return; }
      this.onresult && this.onresult({
        resultIndex: 0,
        results: Object.assign([[{ transcript: texte }]], { 0: Object.assign([{ transcript: texte }], { isFinal: true }) }),
      });
      setTimeout(() => this.onend && this.onend(), 30);
    }, 60);
  }
  stop() { setTimeout(() => this.onend && this.onend(), 10); }
}
window.SpeechRecognition = FauxReco;
`;

(async () => {
  const app = await start(0, 'dist');
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(FAUX_MICRO);
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.goto(app.base, { waitUntil: 'networkidle' });

  const dicter = async (texte, erreur = null) => {
    await pg.evaluate(([t, e]) => { window.__dictee = { texte: t, erreur: e }; }, [texte, erreur]);
    await pg.getByRole('button', { name: 'Dicter la commande' }).click();
    await pg.waitForTimeout(500);
  };

  console.log('\n== Le bouton est là ==');
  ok(await pg.getByRole('button', { name: 'Dicter la commande' }).isVisible(),
    'bouton micro présent quand le navigateur sait dicter');

  console.log('\n== Une commande dictée est comprise ==');
  await dicter('table 12 deux côtes saignantes et un poulet');
  await pg.waitForSelector('.relu li');
  ok((await pg.locator('.panel h2').textContent()).includes('12'), 'la table est reconnue');
  ok(await pg.locator('.relu li').count() === 2, 'les deux pièces sont listées');
  ok((await pg.locator('.relu li').first().textContent()).includes('Côte'), 'la première est une côte');
  ok((await pg.locator('.relu li').first().locator('.qte b').textContent()) === '2', 'quantité 2');
  ok(await pg.locator('.relu li').nth(1).locator('.sans').count() === 1, 'le poulet est marqué sans cuisson');

  console.log('\n== Rien n’est envoyé sans relecture ==');
  ok(await pg.locator('.order').count() === 0, 'aucune commande créée à ce stade');
  await pg.getByRole('button', { name: 'Vers la commande' }).click();
  await pg.waitForTimeout(400);
  ok((await pg.locator('.topbar .title').textContent()).includes('Table 12'), 'on arrive sur la saisie, table pré-remplie');
  ok(await pg.locator('.chip').count() === 2, 'les pièces sont pré-remplies');
  ok(await pg.locator('.order').count() === 0, 'toujours rien envoyé avant le geste final');
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.order').count() === 1, 'l’envoi explicite crée la commande');
  ok((await pg.locator('.order-line').first().textContent()).includes('Côte'), 'avec le bon contenu');

  console.log('\n== Retour arrière depuis la saisie ==');
  ok((await pg.locator('.newbar').count()) > 0, 'on est bien revenu à l’accueil');

  console.log('\n== Une cuisson non entendue bloque l’envoi ==');
  await dicter('table 22 une côte');
  await pg.waitForSelector('.relu li');
  ok(await pg.locator('.relu li.manque').count() === 1, 'la ligne incomplète est signalée');
  ok((await pg.locator('.relu .alerte').textContent()).includes('Cuisson'), 'le message dit quoi faire');
  const bouton = pg.getByRole('button', { name: /Cuisson à choisir/ });
  ok(await bouton.isDisabled(), 'impossible de continuer tant que la cuisson manque');
  await pg.locator('.cuissons-choix button', { hasText: 'Saignant' }).first().click();
  await pg.waitForTimeout(200);
  ok(await pg.locator('.relu li.manque').count() === 0, 'le choix lève l’alerte');
  ok(await pg.getByRole('button', { name: 'Vers la commande' }).isEnabled(), 'on peut continuer');

  console.log('\n== Corriger avant d’envoyer ==');
  await pg.locator('.relu .qte button').last().click();
  ok((await pg.locator('.relu li').first().locator('.qte b').textContent()) === '2', 'la quantité s’ajuste');
  await pg.locator('.relu .oter').first().click();
  await pg.waitForTimeout(200);
  ok(await pg.locator('.relu li').count() === 0, 'une ligne peut être retirée');
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(300);

  console.log('\n== Table non reconnue ==');
  await dicter('deux côtes saignantes');
  await pg.waitForTimeout(400);
  ok((await pg.locator('.panel .lede').first().textContent()).includes('table'),
    'l’absence de table est expliquée');
  ok(await pg.getByRole('button', { name: 'Vers la commande' }).isDisabled(),
    'on ne peut pas continuer sans table');
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(300);

  console.log('\n== Le micro refusé est expliqué ==');
  await dicter('', 'not-allowed');
  await pg.waitForTimeout(400);
  ok(await pg.locator('.anomalie').count() === 1, 'un message apparaît');
  ok((await pg.locator('.anomalie').textContent()).includes('micro'), 'il parle du micro');
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(300);

  console.log('\n== Sans réseau, la dictée le dit ==');
  await dicter('', 'network');
  await pg.waitForTimeout(400);
  ok((await pg.locator('.anomalie').textContent()).includes('réseau'), 'la cause réseau est nommée');
  ok((await pg.locator('.anomalie').textContent()).includes('tactile'), 'et l’alternative est rappelée');
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(300);

  console.log('\n== Navigateur sans dictée ==');
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  await ctx2.addInitScript('delete window.SpeechRecognition; delete window.webkitSpeechRecognition;');
  const pg2 = await ctx2.newPage();
  await pg2.goto(app.base, { waitUntil: 'networkidle' });
  ok(await pg2.getByRole('button', { name: 'Dicter la commande' }).count() === 0,
    'le bouton est absent plutôt que défaillant');
  ok(await pg2.getByRole('button', { name: /Nouvelle commande/ }).isVisible(),
    'la saisie tactile reste disponible');

  console.log('\n== Erreurs ==');
  ok(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

  if (process.env.SHOTS) {
    const fs = require('fs'), path = require('path');
    const dir = path.join(__dirname, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    await pg.evaluate(() => { window.__dictee = { texte: 'table 12 deux côtes saignantes un poulet et une bavette', erreur: null }; });
    await pg.getByRole('button', { name: 'Dicter la commande' }).click();
    await pg.waitForSelector('.relu li');
    await pg.screenshot({ path: `${dir}/dictee.png` });
  }

  await b.close(); app.close();
  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
