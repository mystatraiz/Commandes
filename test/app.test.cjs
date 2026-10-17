/* Tests de bout en bout : on pilote un vrai navigateur sur l'application
   construite, en simulant un téléphone tactile. */
const { chromium } = require('playwright');
const { start } = require('./serve.cjs');

const EXE = process.env.CHROME_PATH || undefined;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };

(async () => {
  const server = await start();
  const BASE = server.base;
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push('exception: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
  await pg.goto(BASE, { waitUntil: 'networkidle' });

  console.log('\n== Écran d’accueil ==');
  ok(await pg.getByRole('button', { name: /Nouvelle commande/ }).isVisible(), 'bouton « Nouvelle commande » présent en haut');
  ok((await pg.locator('.empty h2').textContent()).includes('libre'), 'état vide expliqué');
  const posBouton = await pg.getByRole('button', { name: /Nouvelle commande/ }).boundingBox();
  const posListe = await pg.locator('.content').boundingBox();
  ok(posBouton.y < posListe.y, 'le bouton est bien au-dessus de la liste');

  console.log('\n== Pas de débordement ==');
  const deb = await pg.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
  }));
  ok(deb.sw <= deb.cw + 1, `largeur ${deb.sw} <= ${deb.cw}`);

  console.log('\n== Pavé de sélection des tables ==');
  await pg.getByRole('button', { name: /Nouvelle commande/ }).click();
  ok(await pg.locator('.pave').count() === 3, 'trois zones affichées');
  ok(await pg.locator('.touche').count() === 29, '29 tables proposées');
  const titres = await pg.locator('.zone-titre').allTextContents();
  ok(titres[0].includes('Salle') && titres[1].includes('Véranda') && titres[2].includes('Tonnelle'),
    'les zones sont nommées dans l’ordre');
  const couleurs = await pg.locator('.zone').evaluateAll((n) => n.map((z) => z.style.getPropertyValue('--zone')));
  ok(new Set(couleurs).size === 3, 'une couleur distincte par zone');

  // Tout doit se voir d'un coup : c'est l'intérêt du pavé face à la roue.
  const horsEcran = await pg.locator('.touche').evaluateAll((n) => {
    const h = window.innerHeight;
    return n.filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > h || r.top < 0; }).length;
  });
  ok(horsEcran === 0, `toutes les tables tiennent à l’écran sans défiler (${horsEcran} hors champ)`);

  const premiere = await pg.locator('.touche').first().boundingBox();
  ok(premiere.width >= 44 && premiere.height >= 44,
    `les touches sont assez grandes pour le doigt (${Math.round(premiere.width)}×${Math.round(premiere.height)})`);

  console.log('\n== Choix des grillades ==');
  await pg.locator('.touche', { hasText: /^22$/ }).click();
  await pg.waitForTimeout(300);
  ok((await pg.locator('.topbar .title').textContent()).includes('Table 22'),
    'un appui sur une table mène directement aux grillades');
  ok(await pg.locator('.meat').count() === 13, '13 grillades proposées');
  const cols = await pg.evaluate(() => getComputedStyle(document.querySelector('.meats')).gridTemplateColumns.split(' ').length);
  ok(cols === 2, `2 colonnes en portrait (${cols})`);
  ok(await pg.locator('.footer-bar .btn').isDisabled(), 'envoi impossible tant que rien n’est choisi');

  console.log('\n== Viande puis cuisson ==');
  await pg.locator('.meat', { hasText: 'Côte' }).first().click();
  ok(await pg.locator('.sheet').isVisible(), 'le panneau des cuissons s’ouvre');
  ok(await pg.locator('.cuisson-btn').count() === 4, '4 cuissons proposées');
  await pg.locator('.cuisson-btn', { hasText: 'Saignant' }).click();
  ok(await pg.locator('.sheet').count() === 0, 'retour immédiat aux grillades');
  ok((await pg.locator('.chip').first().textContent()).includes('Côte'), 'la pièce entre dans la commande');
  ok(await pg.locator('.meat', { hasText: 'Côte' }).first().locator('.count').textContent() === '1', 'compteur sur le bouton');

  // Deux fois la même viande et la même cuisson se cumulent.
  await pg.locator('.meat', { hasText: 'Côte' }).first().click();
  await pg.locator('.cuisson-btn', { hasText: 'Saignant' }).click();
  ok(await pg.locator('.chip').count() === 1, 'les pièces identiques se cumulent');
  ok((await pg.locator('.chip').first().textContent()).includes('2×'), 'la quantité passe à 2');

  console.log('\n== Le poulet n’a pas de cuisson ==');
  await pg.locator('.meat', { hasText: 'Poulet' }).click();
  ok(await pg.locator('.sheet').count() === 0, 'aucun panneau de cuisson pour le poulet');
  ok(await pg.locator('.chip').count() === 2, 'le poulet est ajouté directement');
  const puceP = await pg.locator('.chip', { hasText: 'Poulet' }).textContent();
  ok(!/Bleu|Saignant|Point|Cuit/.test(puceP), 'aucune cuisson affichée pour le poulet');

  console.log('\n== Correction d’une erreur ==');
  await pg.locator('.meat', { hasText: 'Bavette' }).click();
  await pg.locator('.cuisson-btn', { hasText: 'Bleu' }).click();
  ok(await pg.locator('.chip').count() === 3, '3 lignes dans la commande');
  await pg.locator('.chip', { hasText: 'Bavette' }).locator('.x').click();
  ok(await pg.locator('.chip').count() === 2, 'la ligne retirée disparaît');

  console.log('\n== Envoi ==');
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.order').count() === 1, 'la commande apparaît sur l’accueil');
  ok((await pg.locator('.order-table').textContent()).includes('Table 22'), 'au bon numéro de table');
  ok(/\d+′\d\d/.test(await pg.locator('.chrono').textContent()), 'un chronomètre démarre');
  ok(await pg.locator('.order-line').count() === 2, 'les deux lignes sont reprises');

  console.log('\n== Les commandes s’empilent dans l’ordre ==');
  await pg.getByRole('button', { name: /Nouvelle commande/ }).click();
  await pg.locator('.touche', { hasText: /^101$/ }).click();
  await pg.waitForTimeout(300);
  await pg.locator('.meat', { hasText: 'Magret' }).click();
  await pg.locator('.cuisson-btn', { hasText: 'À Point' }).click();
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(400);
  const tables = await pg.locator('.order-table').allTextContents();
  ok(tables.length === 2 && tables[0].includes('22') && tables[1].includes('101'),
    'la nouvelle commande se place en dessous de la précédente');

  console.log('\n== Persistance après rechargement ==');
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForSelector('.order');
  ok(await pg.locator('.order').count() === 2, 'les commandes survivent au rechargement');

  console.log('\n== Commande servie ==');
  await pg.locator('.order').first().getByRole('button', { name: /Servi/ }).click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('.order').count() === 1, 'la commande servie disparaît');
  ok((await pg.locator('.toast').textContent()).includes('servie'), 'confirmation affichée');
  await pg.locator('.toast .btn-primary').click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('.order').count() === 2, 'l’annulation la remet en cours');

  console.log('\n== Tables déjà servies repérées ==');
  await pg.getByRole('button', { name: /Nouvelle commande/ }).click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('.touche.occupee').count() >= 1, 'une table avec commande en cours est marquée');
  ok((await pg.locator('.touche.occupee').first().locator('.pastille').textContent()) === '1',
    'la pastille donne le nombre de commandes en cours');
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(300);

  console.log('\n== Statistiques ==');
  await pg.locator('.order').first().getByRole('button', { name: /Servi/ }).click();
  await pg.waitForTimeout(300);
  await pg.getByRole('button', { name: 'Statistiques' }).click();
  await pg.waitForTimeout(400);
  ok((await pg.locator('.topbar .title').textContent()).includes('Statistiques'), 'écran des statistiques');
  const kpis = await pg.locator('.kpi').count();
  ok(kpis === 4, '4 indicateurs clés');
  ok((await pg.locator('.kpi').nth(0).textContent()).includes('2'), '2 commandes comptées');
  ok(await pg.locator('.stack-seg').count() >= 1, 'répartition des cuissons tracée');
  ok(await pg.locator('.bars .bar-row').count() >= 2, 'classement des grillades tracé');
  ok(await pg.locator('.hours .col').count() >= 1, 'activité par heure tracée');
  // Le poulet est compté dans les pièces mais pas dans la répartition des cuissons.
  const texteCuissons = await pg.locator('.panel', { hasText: 'Cuissons les plus' }).textContent();
  ok(!texteCuissons.includes('Poulet'), 'le poulet n’apparaît pas dans les cuissons');

  console.log('\n== Vue tableau ==');
  await pg.getByRole('button', { name: /Voir le tableau/ }).click();
  await pg.waitForTimeout(300);
  ok(await pg.locator('table.data').count() >= 2, 'tableaux affichés');
  ok(await pg.locator('.stack-seg').count() === 0, 'les graphiques laissent la place');
  const th = await pg.locator('table.data th').allTextContents();
  ok(th.some((t) => /Grillade/i.test(t)) && th.some((t) => /Cuisson/i.test(t)), 'colonnes attendues');

  console.log('\n== Bouton retour du navigateur ==');
  await pg.goBack();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.order').count() === 1, 'retour à l’accueil sans quitter l’application');

  console.log('\n== Erreurs ==');
  ok(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

  if (process.env.SHOTS) {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(__dirname, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    await pg.screenshot({ path: `${dir}/accueil.png` });
    await pg.getByRole('button', { name: 'Statistiques' }).click();
    await pg.waitForTimeout(500);
    await pg.screenshot({ path: `${dir}/stats.png`, fullPage: true });
    await pg.goBack();
    await pg.getByRole('button', { name: /Nouvelle commande/ }).click();
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: `${dir}/tables.png` });
    await pg.locator('.touche', { hasText: /^22$/ }).click();
    await pg.locator('.meat', { hasText: 'Côte' }).first().click();
    await pg.waitForTimeout(300);
    await pg.screenshot({ path: `${dir}/cuissons.png` });
    console.log('\nCaptures dans ' + dir);
  }

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
