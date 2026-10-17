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
  ok(await pg.locator('.touche').count() === 31, '31 tables proposées');
  const titres = await pg.locator('.zone-titre').allTextContents();
  ok(titres[0].includes('Salle') && titres[1].includes('Véranda') && titres[2].includes('Tonnelle'),
    'les zones sont nommées dans l’ordre');
  const couleurs = await pg.locator('.zone').evaluateAll((n) => n.map((z) => z.style.getPropertyValue('--zone')));
  ok(new Set(couleurs).size === 3, 'une couleur distincte par zone');
  const colTables = await pg.evaluate(() =>
    getComputedStyle(document.querySelector('.pave')).gridTemplateColumns.split(' ').length);
  ok(colTables === 4, `quatre tables par ligne (${colTables})`);

  // Tout doit se voir d'un coup : c'est l'intérêt du pavé face à la roue.
  const horsEcran = await pg.locator('.touche').evaluateAll((n) => {
    const h = window.innerHeight;
    return n.filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > h || r.top < 0; }).length;
  });
  ok(horsEcran === 0, `toutes les tables tiennent à l’écran sans défiler (${horsEcran} hors champ)`);

  const premiere = await pg.locator('.touche').first().boundingBox();
  ok(premiere.width >= 72 && premiere.height >= 46,
    `les touches sont larges (${Math.round(premiere.width)}×${Math.round(premiere.height)})`);

  console.log('\n== Choix des grillades ==');
  await pg.locator('.touche', { hasText: /^22$/ }).click();
  await pg.waitForTimeout(300);
  ok((await pg.locator('.topbar .titre-table').textContent()).includes('Table 22'),
    'un appui sur une table mène directement aux grillades');
  ok(await pg.locator('.meat').count() === 13, '13 grillades proposées');
  const nomsViandes = await pg.locator('.meat').allTextContents();
  ok(nomsViandes.some((n) => n.includes('Filet')), 'Filet figure sur la carte');
  ok(!nomsViandes.some((n) => n.includes('RibCap')), 'RibCap n’y figure plus');

  // Liserés : quatre familles, et chaque bouton porte celui de la sienne.
  const liserets = await pg.locator('.meat').evaluateAll((n) =>
    n.map((b) => b.style.getPropertyValue('--famille').trim()));
  ok(new Set(liserets).size === 4, `quatre couleurs de liseré (${new Set(liserets).size})`);
  ok(liserets.every(Boolean), 'aucune grillade sans liseré');
  const liseretDe = async (nom) => (await pg.locator('.meat', { hasText: nom }).first()
    .evaluate((b) => b.style.getPropertyValue('--famille').trim()));
  ok(await liseretDe('Côte') === await liseretDe('Filet'), 'Côte et Filet partagent le liseré');
  ok(await liseretDe('Poulet') === await liseretDe('Magret'), 'Poulet et Magret partagent le leur');
  ok(await liseretDe('Côte') !== await liseretDe('Agneau'), 'les familles se distinguent');
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

  console.log('\n== Truffe ==');
  await pg.locator('.meat', { hasText: 'Filet' }).first().click();
  ok(await pg.locator('.truffe-case').count() === 1, 'la case Truffe est proposée avec la cuisson');
  ok(!(await pg.locator('.truffe-case input').isChecked()), 'elle est décochée par défaut');
  await pg.locator('.truffe-case').click();
  ok(await pg.locator('.truffe-case input').isChecked(), 'elle se coche');
  await pg.locator('.cuisson-btn', { hasText: 'Bleu' }).click();
  await pg.waitForTimeout(200);
  const pucesT = await pg.locator('.chip').allTextContents();
  ok(pucesT.some((t) => t.includes('Filet') && t.includes('TRUFFE')), 'TRUFFE s’affiche à côté de la pièce');

  // Une pièce truffée et la même sans truffe restent deux lignes distinctes.
  await pg.locator('.meat', { hasText: 'Filet' }).first().click();
  ok(!(await pg.locator('.truffe-case input').isChecked()), 'la case repart décochée');
  await pg.locator('.cuisson-btn', { hasText: 'Bleu' }).click();
  await pg.waitForTimeout(200);
  ok(await pg.locator('.chip', { hasText: 'Filet' }).count() === 2,
    'truffée ou non, ce sont deux lignes séparées');
  await pg.locator('.chip', { hasText: 'TRUFFE' }).locator('.x').click();
  await pg.locator('.chip', { hasText: 'Filet' }).locator('.x').click();
  await pg.waitForTimeout(200);

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

  console.log('\n== TRUFFE suit jusqu’à la commande envoyée ==');
  await pg.getByRole('button', { name: /Nouvelle commande/ }).click();
  await pg.locator('.touche', { hasText: /^15$/ }).click();
  await pg.waitForTimeout(300);
  await pg.locator('.meat', { hasText: 'Côte' }).first().click();
  await pg.locator('.truffe-case').click();
  await pg.locator('.cuisson-btn', { hasText: 'Saignant' }).click();
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(400);
  const ligneT = await pg.locator('.order', { hasText: 'Table 15' }).locator('.order-line').textContent();
  ok(ligneT.includes('Côte') && ligneT.includes('TRUFFE'), 'l’étiquette apparaît sur la commande en cours');
  await pg.locator('.order', { hasText: 'Table 15' }).getByRole('button', { name: /Servi/ }).click();
  await pg.waitForTimeout(400);

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

  console.log('\n== Effacer une commande par appui long ==');
  const avant = await pg.locator('.order').count();
  const carte = pg.locator('.order').first();
  const tableEffacee = (await carte.locator('.order-table').textContent()).match(/Table (\S+)/)[1];
  const cadre = await carte.boundingBox();
  await pg.mouse.move(cadre.x + cadre.width / 2, cadre.y + 24);
  await pg.mouse.down();
  await pg.waitForTimeout(750);
  await pg.mouse.up();
  ok(await pg.locator('.sheet-backdrop').count() === 1, 'l’appui long ouvre les choix');
  ok((await pg.locator('.sheet').textContent()).includes(tableEffacee), 'la feuille rappelle la table');
  ok(await pg.getByRole('button', { name: /Modifier la commande/ }).isVisible(), 'Modifier est proposé');
  ok(await pg.getByRole('button', { name: 'Effacer' }).isVisible(), 'Effacer aussi');
  await pg.getByRole('button', { name: 'Garder' }).click();
  await pg.waitForTimeout(250);
  ok(await pg.locator('.order').count() === avant, '« Garder » ne supprime rien');

  // Un appui bref ne doit rien déclencher.
  await carte.click({ position: { x: 60, y: 20 } });
  await pg.waitForTimeout(250);
  ok(await pg.locator('.sheet-backdrop').count() === 0, 'un appui bref ne déclenche rien');

  await pg.mouse.move(cadre.x + cadre.width / 2, cadre.y + 24);
  await pg.mouse.down();
  await pg.waitForTimeout(750);
  await pg.mouse.up();
  await pg.getByRole('button', { name: 'Effacer' }).click();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.order').count() === avant - 1, 'la commande quitte le grill');

  console.log('\n== Modifier une commande existante ==');
  const cible = pg.locator('.order').first();
  const tableMod = (await cible.locator('.order-table').textContent()).match(/Table (\S+)/)[1];
  const lignesAvant = await cible.locator('.order-line').count();
  const chronoAvant = await cible.locator('.chrono').textContent();
  const nbAvant = await pg.locator('.order').count();
  const cadreMod = await cible.boundingBox();

  const appuiLong = async (box) => {
    await pg.mouse.move(box.x + box.width / 2, box.y + 24);
    await pg.mouse.down();
    await pg.waitForTimeout(750);
    await pg.mouse.up();
  };
  await appuiLong(cadreMod);
  await pg.getByRole('button', { name: /Modifier la commande/ }).click();
  await pg.waitForTimeout(400);
  ok((await pg.locator('.topbar .titre-table').textContent()).includes(`Table ${tableMod}`), 'la table est reprise');
  ok((await pg.locator('.titre-table .sub').textContent()).includes('Correction'), 'l’écran annonce une correction');
  ok(await pg.locator('.chip').count() === lignesAvant, 'les pièces déjà commandées sont reprises');
  ok((await pg.locator('.footer-bar .btn').textContent()).includes('Enregistrer'),
    'le bouton enregistre au lieu d’envoyer');

  // On ajoute une pièce et on enregistre.
  await pg.locator('.meat', { hasText: 'Bavette' }).first().click();
  await pg.locator('.cuisson-btn', { hasText: 'Bleu' }).click();
  await pg.waitForTimeout(200);
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(500);

  ok(await pg.locator('.order').count() === nbAvant, 'aucune commande n’a été créée en double');
  const modifiee = pg.locator('.order', { hasText: `Table ${tableMod}` }).first();
  ok(await modifiee.locator('.order-line').count() === lignesAvant + 1, 'la pièce ajoutée apparaît');
  ok((await modifiee.locator('.order-line').last().textContent()).includes('Bavette'), 'avec le bon contenu');

  // Le point qui compte : corriger ne doit pas remettre le chronomètre à zéro.
  const chronoApres = await modifiee.locator('.chrono').textContent();
  const sec = (t) => { const m = t.match(/(\d+)′(\d+)/); return m ? +m[1] * 60 + +m[2] : -1; };
  ok(sec(chronoApres) >= sec(chronoAvant),
    `le chronomètre poursuit (${chronoAvant} → ${chronoApres})`);

  // Retirer une pièce fonctionne aussi.
  await appuiLong(await modifiee.boundingBox());
  await pg.getByRole('button', { name: /Modifier la commande/ }).click();
  await pg.waitForTimeout(400);
  await pg.locator('.chip', { hasText: 'Bavette' }).locator('.x').click();
  await pg.waitForTimeout(200);
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(500);
  ok(await pg.locator('.order', { hasText: `Table ${tableMod}` }).first().locator('.order-line').count() === lignesAvant,
    'la pièce retirée disparaît de la commande');

  console.log('\n== Changer la table d’une commande existante ==');
  await appuiLong(await pg.locator('.order', { hasText: `Table ${tableMod}` }).first().boundingBox());
  await pg.getByRole('button', { name: /Modifier la commande/ }).click();
  await pg.waitForTimeout(400);
  const lignesCorrigees = await pg.locator('.chip').count();

  await pg.locator('.titre-table').click();           // le numéro ouvre le pavé
  await pg.waitForTimeout(400);
  ok(await pg.locator('.pave').count() === 3, 'le pavé s’ouvre depuis la correction');

  // En revenir sans choisir ne doit pas abandonner la correction.
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.chip').count() === lignesCorrigees, 'revenir du pavé garde la correction');

  await pg.locator('.titre-table').click();
  await pg.waitForTimeout(400);
  await pg.locator('.touche', { hasText: /^14$/ }).click();
  await pg.waitForTimeout(400);
  ok((await pg.locator('.topbar .titre-table').textContent()).includes('Table 14'), 'la table est changée');
  ok(await pg.locator('.chip').count() === lignesCorrigees, 'les pièces sont conservées');
  ok((await pg.locator('.footer-bar .btn').textContent()).includes('Enregistrer'),
    'on est toujours en correction, pas en nouvelle commande');

  const nbAvantDeplacement = await pg.evaluate(() => 1);   // repère de lisibilité
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(500);
  ok(nbAvantDeplacement === 1 && await pg.locator('.order', { hasText: `Table ${tableMod}` }).count() === 0,
    'la commande a quitté son ancienne table');
  const deplacee = pg.locator('.order', { hasText: 'Table 14' }).first();
  ok(await deplacee.count() === 1, 'elle se retrouve sur la table 14');
  ok(await deplacee.locator('.order-line').count() === lignesAvant, 'avec les mêmes pièces');

  // On la remet où elle était, pour la suite du parcours.
  await appuiLong(await deplacee.boundingBox());
  await pg.getByRole('button', { name: /Modifier la commande/ }).click();
  await pg.waitForTimeout(400);
  await pg.locator('.titre-table').click();
  await pg.waitForTimeout(400);
  await pg.locator('.touche', { hasText: new RegExp(`^${tableMod}$`) }).click();
  await pg.waitForTimeout(400);
  await pg.locator('.footer-bar .btn').click();
  await pg.waitForTimeout(500);

  // Abandonner une correction laisse la commande intacte.
  await appuiLong(await pg.locator('.order', { hasText: `Table ${tableMod}` }).first().boundingBox());
  await pg.getByRole('button', { name: /Modifier la commande/ }).click();
  await pg.waitForTimeout(400);
  await pg.locator('.meat', { hasText: 'Gigot' }).first().click();
  await pg.locator('.cuisson-btn', { hasText: 'Bien Cuit' }).click();
  // Un seul retour : en correction, l'écran de saisie ramène droit à
  // l'accueil, sans repasser par le pavé des tables.
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.newbar').count() > 0, 'le retour ramène à l’accueil');
  ok(await pg.locator('.order', { hasText: `Table ${tableMod}` }).first().locator('.order-line').count() === lignesAvant,
    'une correction abandonnée ne change rien');

  console.log('\n== Historique du jour ==');
  await pg.getByRole('button', { name: 'Historique du jour' }).click();
  await pg.waitForTimeout(500);
  ok((await pg.locator('.topbar .title').textContent()).includes('Historique'), 'l’écran s’ouvre');
  const etats = await pg.locator('.histo-etat').allTextContents();
  ok(etats.some((e) => e.includes('Effacée')), 'la commande effacée y figure');
  ok(etats.some((e) => e.includes('Servie')), 'les commandes servies aussi');

  console.log('\n== Restaurer une commande ==');
  const carteHisto = pg.locator('.histo-item', { hasText: 'Effacée' }).first();
  ok((await carteHisto.textContent()).includes(tableEffacee), 'la bonne table est retrouvée');
  await carteHisto.getByRole('button', { name: /Remettre en cours/ }).click();
  await pg.waitForTimeout(500);
  ok(!(await pg.locator('.histo-item').allTextContents()).some((t) => t.includes('Effacée')),
    'elle disparaît de l’historique');
  await pg.locator('.topbar .btn-quiet').click();
  await pg.waitForTimeout(400);
  ok(await pg.locator('.order').count() === avant, 'elle est de retour sur le grill');
  ok((await pg.locator('.order-table').allTextContents()).some((t) => t.includes(tableEffacee)),
    'avec le bon numéro de table');

  console.log('\n== Statistiques ==');
  await pg.locator('.order').first().getByRole('button', { name: /Servi/ }).click();
  await pg.waitForTimeout(300);
  await pg.getByRole('button', { name: 'Statistiques' }).click();
  await pg.waitForTimeout(400);
  ok((await pg.locator('.topbar .title').textContent()).includes('Statistiques'), 'écran des statistiques');
  const kpis = await pg.locator('.kpi').count();
  // Quatre indicateurs de base, plus celui des truffes dès qu'il y en a eu.
  ok(kpis === 5, `cinq indicateurs clés, truffes comprises (${kpis})`);
  ok((await pg.locator('.kpi').nth(0).textContent()).includes('3'), 'les trois commandes sont comptées');
  const tuileTruffe = await pg.locator('.kpi', { hasText: 'Truffes' }).textContent();
  ok(tuileTruffe.includes('1'), 'la pièce truffée est comptée à part');
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
