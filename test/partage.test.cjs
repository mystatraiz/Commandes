/* Tests du mode partagé : deux navigateurs distincts, chacun jouant un
   téléphone, face à un faux serveur Supabase. On vérifie le code d'accès, la
   propagation d'une commande d'un appareil à l'autre, la reprise après une
   coupure réseau, et le fait que la saisie continue hors ligne. */

const { chromium } = require('playwright');
const { start: startApp } = require('./serve.cjs');
const { start: startApi, CODE } = require('./faux-supabase.cjs');

const EXE = process.env.CHROME_PATH || undefined;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Attend qu'une condition devienne vraie, plutôt qu'un délai fixe au jugé. */
async function jusqua(fn, limite = 12000, pas = 250) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    if (await fn()) return true;
    await attendre(pas);
  }
  return false;
}

(async () => {
  const api = await startApi(54321);       // port fixe : l'URL est figée dans la compilation
  const app = await startApp(0, 'dist-test');
  const b = await chromium.launch({ executablePath: EXE });

  // Chaque téléphone a son propre contexte : bases et sessions séparées.
  const telephone = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => console.log('    (exception) ' + e.message));
    await pg.goto(app.base, { waitUntil: 'networkidle' });
    return { ctx, pg };
  };

  const A = await telephone();
  const B = await telephone();

  console.log('\n== Code d’accès ==');
  ok(await A.pg.locator('.connexion-carte').isVisible(), 'le code est demandé au premier lancement');
  ok(await A.pg.locator('.orders').count() === 0, 'aucune commande visible avant connexion');

  await A.pg.locator('.champ').fill('mauvais-code');
  await A.pg.getByRole('button', { name: 'Rejoindre' }).click();
  ok(await jusqua(async () => (await A.pg.locator('.erreur').count()) > 0), 'un code erroné est refusé');
  ok((await A.pg.locator('.erreur').textContent()).includes('incorrect'), 'le message dit que le code est incorrect');
  ok(await A.pg.locator('.connexion-carte').isVisible(), 'on reste sur l’écran du code');

  await A.pg.locator('.champ').fill(CODE);
  await A.pg.getByRole('button', { name: 'Rejoindre' }).click();
  ok(await jusqua(async () => (await A.pg.locator('.newbar').count()) > 0), 'le bon code ouvre l’application');

  await B.pg.locator('.champ').fill(CODE);
  await B.pg.getByRole('button', { name: 'Rejoindre' }).click();
  await jusqua(async () => (await B.pg.locator('.newbar').count()) > 0);

  console.log('\n== Une commande passe d’un téléphone à l’autre ==');
  const prendreCommande = async (pg, table, viande, cuisson) => {
    await pg.getByRole('button', { name: /Nouvelle commande/ }).click();
    await pg.locator('.wheel-item', { hasText: new RegExp(`^${table}$`) }).click();
    await attendre(700);
    await pg.locator('.footer-bar .btn').click();
    await pg.locator('.meat', { hasText: viande }).first().click();
    if (cuisson) await pg.locator('.cuisson-btn', { hasText: cuisson }).click();
    await pg.locator('.footer-bar .btn').click();
    await attendre(400);
  };

  await prendreCommande(A.pg, '12', 'Côte', 'Saignant');
  ok(await A.pg.locator('.order').count() === 1, 'la commande apparaît sur le téléphone qui l’a prise');
  ok(await jusqua(() => api.lignes.size === 1), 'elle est bien montée sur le serveur');

  ok(await jusqua(async () => (await B.pg.locator('.order').count()) === 1),
    'elle descend toute seule sur le second téléphone');
  ok((await B.pg.locator('.order-table').textContent()).includes('Table 12'), 'au bon numéro de table');
  ok((await B.pg.locator('.order-line').textContent()).includes('Côte'), 'avec le bon contenu');

  console.log('\n== Servir depuis un téléphone efface sur l’autre ==');
  await B.pg.locator('.order').first().getByRole('button', { name: /Servi/ }).click();
  ok(await jusqua(async () => (await B.pg.locator('.order').count()) === 0), 'la commande part du téléphone B');
  ok(await jusqua(async () => (await A.pg.locator('.order').count()) === 0),
    'et disparaît aussi du téléphone A');

  console.log('\n== Coupure réseau ==');
  await A.ctx.setOffline(true);
  await prendreCommande(A.pg, '22', 'Bavette', 'À Point');
  ok(await A.pg.locator('.order').count() === 1, 'on continue de prendre des commandes hors ligne');
  ok(await jusqua(async () => (await A.pg.locator('.lien-etat.attente').count()) > 0, 6000),
    'l’application signale la commande en attente');
  ok(await B.pg.locator('.order').count() === 0, 'le second téléphone ne la voit pas encore');

  console.log('\n== Retour du réseau ==');
  await A.ctx.setOffline(false);
  ok(await jusqua(() => api.lignes.size === 2, 25000), 'la commande en attente est poussée au retour');
  ok(await jusqua(async () => (await B.pg.locator('.order').count()) === 1, 25000),
    'elle arrive enfin sur le second téléphone');
  ok(await jusqua(async () => (await A.pg.locator('.lien-etat.attente').count()) === 0, 6000),
    'plus rien en attente');

  console.log('\n== Un téléphone qui rejoint récupère l’existant ==');
  const C = await telephone();
  await C.pg.locator('.champ').fill(CODE);
  await C.pg.getByRole('button', { name: 'Rejoindre' }).click();
  ok(await jusqua(async () => (await C.pg.locator('.order').count()) === 1, 20000),
    'un appareil neuf récupère les commandes en cours');
  ok((await C.pg.locator('.order-table').textContent()).includes('Table 22'), 'avec la bonne table');

  console.log('\n== La session est mémorisée ==');
  await A.pg.reload({ waitUntil: 'networkidle' });
  ok(await jusqua(async () => (await A.pg.locator('.newbar').count()) > 0),
    'le code n’est pas redemandé après rechargement');

  await b.close();
  app.close();
  api.close();
  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
