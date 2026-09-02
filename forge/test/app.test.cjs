/* Parcours complet dans un vrai navigateur (Playwright), en simulant un
   téléphone : jeûne, poids, session de padel, courbes, renfo adapté au temps,
   échauffement, gamification. Mode local, sans Supabase. */
const { chromium } = require('playwright');
const { start } = require('./serve.cjs');

const EXE = process.env.CHROME_PATH || undefined;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = await start();
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, locale: 'fr-FR' });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push('exception: ' + e.message));
  pg.on('console', (m) => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
  await pg.goto(server.base, { waitUntil: 'networkidle' });

  console.log('\n== Accueil ==');
  ok(await pg.locator('.entete-accueil h1').isVisible(), 'l’accueil s’affiche');
  ok((await pg.locator('.flamme').textContent()).includes('0'), 'série à zéro au départ');
  ok(await pg.locator('.mission').count() === 3, '3 missions du jour');
  ok((await pg.locator('.niveau .nom').textContent()) === 'Recrue', 'niveau 1 : Recrue');
  const deb = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(deb.sw <= deb.cw + 1, `pas de débordement horizontal (${deb.sw} <= ${deb.cw})`);

  console.log('\n== Jeûne ==');
  await pg.getByRole('button', { name: /Lancer un jeûne 16 h/ }).click();
  await attendre(400);
  ok(await pg.locator('.carte.hero .eyebrow', { hasText: 'Jeûne en cours' }).isVisible(), 'le jeûne démarre depuis l’accueil');
  ok(/00:00:0\d/.test(await pg.locator('.carte.hero .chiffre.lg').textContent()), 'le chrono tourne');
  await pg.locator('.nav button', { hasText: 'Jeûne' }).click();
  await attendre(300);
  ok(await pg.locator('.jeune-hero .chrono').isVisible(), 'écran jeûne avec anneau et chrono');
  ok((await pg.locator('.phase-ligne.courante .n').textContent()).includes('Digestion'), 'phase courante : digestion');
  // On recule le début de 17 h pour simuler un jeûne complet.
  await pg.getByRole('button', { name: 'Heure de début' }).click();
  const il17h = await pg.evaluate(() => {
    const d = new Date(Date.now() - 17 * 3600000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  await pg.locator('#heure-jeune').fill(il17h);
  await pg.getByRole('button', { name: 'Corriger' }).click();
  await attendre(400);
  ok(/^1[67]:/.test(await pg.locator('.jeune-hero .chrono').textContent()), 'le début corrigé donne un chrono à 17 h');
  ok((await pg.locator('.phase-ligne.courante .n').textContent()).includes('Cétose'), 'phase : cétose');
  await pg.getByRole('button', { name: 'Terminer' }).click();
  await attendre(500);
  ok(await pg.locator('.toast.xp').isVisible(), 'un toast annonce l’XP gagnée');
  ok((await pg.locator('.toast').textContent()).includes('objectif atteint'), 'objectif 16 h atteint');
  ok(await pg.locator('.liste .ligne').count() === 1, 'le jeûne passe dans l’historique');
  ok((await pg.locator('.liste .ligne .v').textContent()).includes('objectif atteint'), 'marqué comme réussi');

  console.log('\n== Poids ==');
  await pg.locator('.nav button', { hasText: 'Accueil' }).click();
  await attendre(300);
  await pg.locator('.action', { hasText: 'Poids' }).click();
  await attendre(300);
  await pg.locator('.champ.grand').fill('84,3');
  await pg.getByRole('button', { name: 'Enregistrer' }).click();
  await attendre(500);
  ok((await pg.locator('.toast').textContent()).includes('84,3 kg'), 'la pesée est confirmée');
  ok((await pg.locator('.tuiles.trois .tuile').first().textContent()).includes('84,3'), 'le poids apparaît sur l’accueil');
  ok((await pg.locator('.mission').first().textContent()).includes('✓') || (await pg.locator('.mission.fait').count()) >= 1, 'la mission « balance » est cochée');

  console.log('\n== Session padel ==');
  await pg.locator('.action', { hasText: 'Padel' }).click();
  await attendre(300);
  ok((await pg.locator('.topbar h1').textContent()).includes('Session padel'), 'formulaire padel');
  await pg.locator('#calories').fill('640');
  await pg.locator('.puce', { hasText: '90 min' }).click();
  await pg.locator('.puce', { hasText: 'Victoire' }).click();
  await pg.getByRole('button', { name: 'Valider la session' }).click();
  await attendre(500);
  ok((await pg.locator('.toast').textContent()).includes('XP'), 'XP créditée pour la session');
  await pg.locator('.nav button', { hasText: 'Sport' }).click();
  await attendre(300);
  ok(await pg.locator('.ligne', { hasText: 'Padel' }).count() === 1, 'la session est listée');
  ok((await pg.locator('.ligne', { hasText: 'Padel' }).textContent()).includes('640'), 'avec ses calories');
  ok((await pg.locator('.ligne', { hasText: 'Padel' }).textContent()).includes('Victoire'), 'et son résultat');

  console.log('\n== Renfo adapté au temps ==');
  await pg.locator('.action', { hasText: 'Renfo' }).click();
  await attendre(300);
  ok(await pg.locator('.circuit').count() >= 5, 'plusieurs circuits proposés');
  const lire = async () => Number((await pg.locator('.plan .tuile').nth(0).locator('.v').textContent()).trim()) * Number((await pg.locator('.plan .tuile').nth(1).locator('.v').textContent()).trim());
  await pg.locator('.puce', { hasText: /^5 min$/ }).click();
  const petit = await lire();
  await pg.locator('.puce', { hasText: /^30 min$/ }).click();
  const grand = await lire();
  ok(grand > petit, `30 min donne plus de travail que 5 min (${grand} > ${petit} exercices×tours)`);
  await pg.locator('.circuit', { hasText: 'Padel Power' }).click();
  ok((await pg.locator('.plan .eyebrow').textContent()).includes('Padel Power'), 'le plan suit le circuit choisi');
  await pg.locator('.puce', { hasText: /^5 min$/ }).click();
  await pg.getByRole('button', { name: /^Lancer/ }).click();
  await attendre(600);
  ok(await pg.locator('.lecteur .compte').isVisible(), 'le lecteur démarre');
  ok(await pg.locator('.lecteur .nom-ex').isVisible(), 'avec le nom de l’exercice');
  const c1 = Number(await pg.locator('.lecteur .compte').textContent());
  await attendre(1500);
  const c2 = Number(await pg.locator('.lecteur .compte').textContent());
  ok(c2 < c1, `le compte à rebours descend (${c1} → ${c2})`);
  await pg.getByRole('button', { name: 'Pause' }).click();
  const c3 = Number(await pg.locator('.lecteur .compte').textContent());
  await attendre(1200);
  ok(Number(await pg.locator('.lecteur .compte').textContent()) === c3, 'la pause fige le compte');
  await pg.getByRole('button', { name: 'Reprendre' }).click();
  // On passe toutes les étapes pour arriver au récapitulatif.
  for (let i = 0; i < 40; i++) {
    if (await pg.locator('.recap-fin').count()) break;
    await pg.getByRole('button', { name: 'Passer' }).click();
    await attendre(60);
  }
  ok(await pg.locator('.recap-fin').isVisible(), 'récapitulatif de fin de session');
  ok(await pg.locator('#kcal-fin').isVisible(), 'les calories de la montre peuvent être saisies');
  await pg.locator('#kcal-fin').fill('120');
  await pg.getByRole('button', { name: 'Enregistrer la session' }).click();
  await attendre(500);
  ok(await pg.locator('.ligne', { hasText: 'Padel Power' }).count() === 1, 'la session de renfo est enregistrée avec le nom du circuit');

  console.log('\n== Échauffement padel ==');
  await pg.locator('.action', { hasText: 'Échauff' }).click();
  await attendre(300);
  ok(await pg.locator('.plan ol li').count() === 10, '10 étapes');
  ok((await pg.locator('.carte.hero .chiffre').textContent()).trim() === '10:00', 'dix minutes pile');
  await pg.getByRole('button', { name: 'Lancer l’échauffement' }).click();
  await attendre(500);
  ok((await pg.locator('.lecteur .nom-ex').textContent()).includes('Trottinement'), 'le lecteur commence par le trottinement');
  await pg.getByRole('button', { name: 'Quitter' }).click();
  await attendre(300);
  await pg.getByRole('button', { name: 'Abandonner' }).click();
  await attendre(400);
  ok(await pg.locator('.nav').isVisible(), 'l’abandon ramène à l’application');

  console.log('\n== Courbes ==');
  await pg.locator('.nav button', { hasText: 'Courbes' }).click();
  await attendre(400);
  ok(await pg.locator('.graphique').count() === 3, 'trois panneaux : poids, activité, jeûne');
  await pg.locator('.segment button', { hasText: 'Superposées' }).click();
  await attendre(300);
  ok(await pg.locator('.graphique').count() === 1, 'un seul graphique en mode superposé');
  ok(await pg.locator('.legende span').count() === 3, 'légende à trois séries avec leurs plages');
  ok(await pg.locator('.graphique .courbe').count() === 3, 'trois courbes superposées');
  await pg.locator('.puce', { hasText: 'Jeûne' }).click();
  ok(await pg.locator('.graphique .courbe').count() === 2, 'une série se masque d’un appui');
  const boite = await pg.locator('.graphique svg').boundingBox();
  await pg.mouse.move(boite.x + boite.width * 0.97, boite.y + boite.height / 2);   // dernier jour : la seule pesée
  await attendre(200);
  ok(await pg.locator('.graphique .bulle').isVisible(), 'la bulle de survol apparaît');
  ok((await pg.locator('.graphique .bulle').textContent()).includes('kg'), 'avec les vraies valeurs (kg)');
  await pg.locator('.segment button', { hasText: 'Tableau' }).click();
  ok(await pg.locator('table.data tbody tr').count() === 30, 'vue tableau sur 30 jours');
  await pg.locator('.segment button', { hasText: /^7 j$/ }).click();
  ok(await pg.locator('table.data tbody tr').count() === 7, 'période 7 jours');

  console.log('\n== Gamification ==');
  await pg.locator('.nav button', { hasText: 'Accueil' }).click();
  await attendre(300);
  ok((await pg.locator('.flamme').textContent()).includes('1'), 'la série passe à 1 jour');
  ok((await pg.locator('.niveau .nom').textContent()) !== 'Recrue', 'le niveau a progressé');
  ok(await pg.locator('.mission.fait').count() >= 2, 'au moins deux missions cochées');
  await pg.locator('.nav button', { hasText: 'Profil' }).click();
  await attendre(300);
  ok(await pg.locator('.badge.obtenu').count() >= 3, 'des badges sont débloqués');
  await pg.locator('#prenom').fill('Alex');
  await pg.locator('#obj-poids').fill('78');
  await pg.getByRole('button', { name: 'Enregistrer' }).click();
  await attendre(400);
  await pg.locator('.nav button', { hasText: 'Accueil' }).click();
  await attendre(300);
  ok((await pg.locator('.entete-accueil h1').textContent()).includes('Alex'), 'le prénom est repris sur l’accueil');

  console.log('\n== Persistance ==');
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForSelector('.entete-accueil');
  ok((await pg.locator('.entete-accueil h1').textContent()).includes('Alex'), 'les réglages survivent au rechargement');
  ok((await pg.locator('.tuiles.trois .tuile').first().textContent()).includes('84,3'), 'le poids aussi');

  console.log('\n== Bouton retour ==');
  await pg.locator('.action', { hasText: 'Poids' }).click();
  await attendre(300);
  await pg.goBack();
  await attendre(300);
  ok(await pg.locator('.nav').isVisible(), 'retour du navigateur : on revient à l’accueil sans quitter');

  console.log('\n== Erreurs ==');
  ok(erreurs.length === 0, 'aucune erreur JavaScript' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));

  if (process.env.SHOTS) {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(__dirname, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    await pg.screenshot({ path: `${dir}/accueil.png`, fullPage: true });
    await pg.locator('.nav button', { hasText: 'Jeûne' }).click(); await attendre(300);
    await pg.screenshot({ path: `${dir}/jeune.png`, fullPage: true });
    await pg.locator('.nav button', { hasText: 'Sport' }).click(); await attendre(300);
    await pg.screenshot({ path: `${dir}/sport.png`, fullPage: true });
    await pg.locator('.action', { hasText: 'Renfo' }).click(); await attendre(300);
    await pg.screenshot({ path: `${dir}/renfo.png`, fullPage: true });
    await pg.getByRole('button', { name: /^Lancer/ }).click(); await attendre(500);
    await pg.screenshot({ path: `${dir}/lecteur.png` });
    await pg.getByRole('button', { name: 'Quitter' }).click(); await attendre(200);
    await pg.getByRole('button', { name: 'Abandonner' }).click(); await attendre(300);
    await pg.locator('.nav button', { hasText: 'Courbes' }).click(); await attendre(400);
    await pg.screenshot({ path: `${dir}/courbes.png`, fullPage: true });
    await pg.locator('.segment button', { hasText: 'Superposées' }).click(); await attendre(300);
    await pg.screenshot({ path: `${dir}/courbes-superposees.png`, fullPage: true });
    await pg.locator('.nav button', { hasText: 'Profil' }).click(); await attendre(300);
    await pg.screenshot({ path: `${dir}/profil.png`, fullPage: true });
    console.log('\nCaptures dans ' + dir);
  }

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
