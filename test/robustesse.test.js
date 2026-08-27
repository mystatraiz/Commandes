const { chromium } = require('playwright');
const { start } = require('./serve');
const EXE=process.env.CHROME_PATH||undefined;
let fails=0; const ok=(c,m)=>{console.log((c?'  PASS ':'  FAIL ')+m); if(!c)fails++;};
(async()=>{
  const server=await start(); const BASE=server.base;
  const b=await chromium.launch({executablePath:EXE});

  // --- Migration depuis gc_state_v1 ---
  console.log('\n== Migration depuis l’ancienne version ==');
  let ctx=await b.newContext({viewport:{width:390,height:780}});
  await ctx.addInitScript(()=>localStorage.setItem('gc_state_v1', JSON.stringify({
    selectedTable:'14', pre:{'Côte':3,'T-Bone':1,'Tmhk':0,'Gigot':0},
    tickets:[{id:Date.now()-9*60000, table:'14', createdAt:'12:30:00',
      items:[{viande:'Bavette',cuisson:'À Point',qty:2},{viande:'Côte',cuisson:'Bleu',qty:1}]}]
  })));
  let pg=await ctx.newPage(); const errs=[];
  pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto(BASE,{waitUntil:'networkidle'});
  ok((await pg.locator('#tab-table').textContent()).includes('14'),'table reprise');
  ok(await pg.locator('[data-preval="Côte"]').textContent()==='3','précuissons repris');
  ok(await pg.locator('#n-tick').textContent()==='1','ancien ticket repris');
  ok(await pg.locator('#n-grill').textContent()==='3','3 pièces à cuire');
  await pg.locator('#tab-t').click();
  ok((await pg.locator('.ticket .age').textContent()).startsWith('9'),'âge du ticket recalculé (9 min)');
  ok(await pg.locator('.ticket').evaluate(e=>e.classList.contains('warn')),'ticket passé en orange après 8 min');
  ok(await pg.evaluate(()=>!!localStorage.getItem('gc_state_v2')),'état migré vers la v2');
  await ctx.close();

  // --- Données corrompues ---
  console.log('\n== Données corrompues ==');
  ctx=await b.newContext({viewport:{width:390,height:780}});
  await ctx.addInitScript(()=>localStorage.setItem('gc_state_v2', JSON.stringify({
    selectedTable:5, draft:{'Côte':'nope','Inconnu':[1,2]}, pre:{'Côte':'x'},
    tickets:[null, 'zut', {table:'9', ts:'abc', items:[{v:'Bavette',c:99,qty:'2'},{v:'X',c:-3,qty:0}]}]
  })));
  pg=await ctx.newPage(); const errs2=[];
  pg.on('pageerror',e=>errs2.push(e.message));
  await pg.goto(BASE,{waitUntil:'networkidle'});
  ok(errs2.length===0,'aucune exception au chargement'+(errs2.length?': '+errs2[0]:''));
  ok(await pg.locator('#grid .cell').count()===52,'la grille se construit quand même');
  ok(await pg.locator('#n-tick').textContent()==='1','seul le ticket exploitable est gardé');
  await pg.locator('#tab-t').click();
  ok(await pg.locator('.ticket li').count()===1,'la ligne à quantité nulle est écartée');
  ok((await pg.locator('.ticket li').textContent()).includes('Bien Cuit'),'cuisson hors bornes ramenée dans la plage');

  // --- Viande retirée de la carte ---
  console.log('\n== Viande absente de la carte ==');
  await pg.locator('#tab-g').click();
  ok((await pg.locator('#summary').textContent()).includes('Bavette'),'la viande reste visible dans la synthèse');
  ok(await pg.locator('#sum-total').textContent()==='2','total correct');
  await ctx.close();

  // --- Hors-ligne ---
  console.log('\n== Fonctionnement hors-ligne ==');
  ctx=await b.newContext({viewport:{width:390,height:780}});
  pg=await ctx.newPage();
  await pg.goto(BASE,{waitUntil:'networkidle'});
  await pg.waitForFunction(()=>navigator.serviceWorker.controller!==null,null,{timeout:10000}).catch(()=>{});
  await pg.waitForTimeout(800);
  await ctx.setOffline(true);
  await pg.reload({waitUntil:'domcontentloaded'});
  ok(await pg.locator('#grid .cell').count()===52,'l’application se charge sans réseau');
  ok(await pg.locator('#tab-table').isVisible(),'interface complète hors-ligne');
  await ctx.close();

  await b.close();
  server.close();
  console.log(fails?`\n${fails} ÉCHEC(S)`:'\nTOUT PASSE');
  process.exit(fails?1:0);
})();
