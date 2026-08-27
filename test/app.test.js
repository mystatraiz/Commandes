const { chromium } = require('playwright');
const { start } = require('./serve');
const EXE = process.env.CHROME_PATH || undefined;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  PASS ' : '  FAIL ') + m); if (!c) fails++; };

(async () => {
  const server = await start(); const BASE = server.base;
  const b = await chromium.launch({ executablePath: EXE });
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.goto(BASE, { waitUntil: 'networkidle' });

  console.log('\n== Chargement ==');
  ok(await pg.locator('#grid .cell').count() === 52, '52 cellules (13 viandes x 4 cuissons)');
  ok(await pg.locator('.pre-item').count() === 4, '4 compteurs de précuisson');
  ok(await pg.locator('#send').isDisabled(), 'Envoyer désactivé quand la saisie est vide');

  console.log('\n== Pas de débordement horizontal ==');
  const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
                                        bsh: document.body.scrollHeight, bch: document.body.clientHeight }));
  ok(ov.sw <= ov.cw + 1, `largeur ${ov.sw} <= ${ov.cw}`);
  ok(ov.bsh <= ov.bch + 1, `pas de défilement de page (${ov.bsh} <= ${ov.bch})`);

  console.log('\n== Appui court = +1 ==');
  const cell = pg.locator('.cell[data-v="Côte"][data-c="1"]');
  await cell.tap(); await cell.tap(); await cell.tap();
  ok((await cell.textContent()).trim() === '3', 'trois appuis -> 3');
  ok(await cell.evaluate(e => e.classList.contains('has')), 'la case est mise en évidence');
  ok((await pg.locator('#send-n').textContent()) === '3', 'compteur du bouton Envoyer = 3');
  ok(!(await pg.locator('#send').isDisabled()), 'Envoyer réactivé');

  console.log('\n== Appui long = remise à zéro de la case ==');
  const box = await cell.boundingBox();
  await pg.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); // 4
  await pg.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await pg.mouse.down(); await pg.waitForTimeout(750); await pg.mouse.up();
  ok((await cell.textContent()).trim() === '·', 'appui long -> case vidée');

  console.log('\n== Annulation ==');
  await pg.locator('#undo').click();
  ok((await cell.textContent()).trim() === '4', 'annuler restaure la valeur 4');

  console.log('\n== Persistance après rechargement ==');
  await pg.reload({ waitUntil: 'networkidle' });
  ok((await pg.locator('.cell[data-v="Côte"][data-c="1"]').textContent()).trim() === '4', 'la saisie survit au rechargement');

  console.log('\n== Envoi sans table ==');
  await pg.locator('#send').click();
  ok((await pg.locator('#toast .msg').textContent()).includes('table'), 'refus + invitation à choisir une table');
  ok(await pg.locator('#table-modal').isVisible() === false, 'la modale ne s’ouvre pas toute seule');

  console.log('\n== Sélection de table ==');
  await pg.locator('#tab-table').click();
  ok(await pg.locator('#table-modal').isVisible(), 'modale ouverte');
  await pg.locator('.table-option[data-t="12"]').click();
  ok((await pg.locator('#tab-table').textContent()).includes('12'), 'table 12 sélectionnée');
  ok(await pg.locator('#table-modal').isHidden(), 'modale fermée');

  console.log('\n== Envoi ==');
  await pg.locator('.cell[data-v="Poulet"][data-c="3"]').tap();
  await pg.locator('#send').click();
  ok((await pg.locator('.cell[data-v="Côte"][data-c="1"]').textContent()).trim() === '·', 'la grille est vidée après envoi');
  ok(await pg.locator('#n-tick').textContent() === '1', 'badge Tickets = 1');
  ok(await pg.locator('#n-grill').textContent() === '5', 'badge Grill = 5 pièces');

  console.log('\n== Synthèse grill ==');
  await pg.locator('#tab-g').click();
  ok(await pg.locator('#p-g').isVisible(), 'panneau Grill visible');
  ok(await pg.locator('#sum-total').textContent() === '5', 'total à cuire = 5');
  ok(await pg.locator('.sum-row:not(.head)').count() === 2, '2 viandes listées');
  ok((await pg.locator('.sum-row:not(.head)').first().textContent()).includes('12'), 'le numéro de table est rappelé');

  console.log('\n== Tickets ==');
  await pg.locator('#tab-t').click();
  ok(await pg.locator('.ticket').count() === 1, '1 ticket');
  ok(/\d+′\d\d/.test(await pg.locator('.ticket .age').textContent()), 'minuteur affiché');
  await pg.locator('.ticket li').first().click();
  ok(await pg.locator('.ticket li').first().evaluate(e => e.classList.contains('done')), 'ligne cochée comme servie');
  await pg.locator('#tab-g').click();
  ok(await pg.locator('#sum-total').textContent() === '1', 'la ligne servie sort de la synthèse');

  console.log('\n== Table occupée signalée ==');
  await pg.locator('#tab-table').click();
  ok(await pg.locator('.table-option[data-t="12"]').evaluate(e => e.classList.contains('busy')), 'table 12 marquée occupée');
  await pg.locator('#table-cancel').click();

  console.log('\n== Terminé + annulation ==');
  await pg.locator('#tab-t').click();
  await pg.locator('.ticket [data-act="done"]').click();
  ok(await pg.locator('.ticket').count() === 0, 'ticket clos');
  await pg.locator('#toast .btn').click();
  ok(await pg.locator('.ticket').count() === 1, 'annulation restaure le ticket');

  console.log('\n== Précuisson ==');
  await pg.locator('#tab-s').click();
  await pg.locator('[data-pre="Côte"][data-d="1"]').click();
  await pg.locator('[data-pre="Côte"][data-d="1"]').click();
  ok(await pg.locator('[data-preval="Côte"]').textContent() === '2', 'précuisson +2');
  await pg.locator('[data-pre="Côte"][data-d="-1"]').click();
  ok(await pg.locator('[data-preval="Côte"]').textContent() === '1', 'précuisson -1');
  await pg.locator('[data-pre="Côte"][data-d="-1"]').click();
  await pg.locator('[data-pre="Côte"][data-d="-1"]').click();
  ok(await pg.locator('[data-preval="Côte"]').textContent() === '0', 'ne descend pas sous zéro');

  console.log('\n== Service worker ==');
  await pg.waitForTimeout(1200);
  const swOk = await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => !!r));
  ok(swOk, 'service worker enregistré');

  console.log('\n== Erreurs console ==');
  ok(errs.length === 0, 'aucune erreur JS' + (errs.length ? ': ' + errs.join(' | ') : ''));

  // Captures d'écran facultatives : SHOTS=1 npm test
  if (process.env.SHOTS) {
    const dir = require('path').join(__dirname, 'captures');
    require('fs').mkdirSync(dir, { recursive: true });
    for (const [tab, name] of [['#tab-s','saisie'], ['#tab-g','grill'], ['#tab-t','tickets']]) {
      await pg.locator(tab).click();
      await pg.screenshot({ path: `${dir}/${name}.png` });
    }
    await pg.locator('#tab-table').click();
    await pg.screenshot({ path: `${dir}/tables.png` });
    console.log('\nCaptures écrites dans ' + dir);
  }

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
