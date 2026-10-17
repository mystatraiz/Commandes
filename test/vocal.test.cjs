/* Tests de l'analyse d'une commande dictée.

   C'est la pièce qui décide quelle viande part au grill : chaque cas y est
   figé, y compris ceux où l'analyse doit refuser de deviner. */

let fails = 0;
const ok = (c, m) => { console.log((c ? '  OK   ' : '  ÉCHEC ') + m); if (!c) fails++; };

(async () => {
  const { analyser, normaliser } = await import('../src/lib/vocal.js');

  // Raccourci de lecture : « 2 cote/saig » décrit une ligne attendue.
  const resume = (r) => r.lignes
    .map((l) => `${l.qte} ${l.grillade}/${l.cuisson ?? '-'}${l.truffe ? '+T' : ''}${l.incomplete ? '!' : ''}`)
    .join(' + ');
  const cas = (texte, table, attendu, libelle) => {
    const r = analyser(texte);
    const obtenu = resume(r);
    ok(r.table === table && obtenu === attendu,
      `${libelle}\n         « ${texte} »\n         attendu : table ${table} · ${attendu || '(rien)'}\n         obtenu  : table ${r.table} · ${obtenu || '(rien)'}`);
  };

  const { ZONES, TABLES, zoneDeTable } = await import('../src/config.js');

  console.log('\n== Plan de salle ==');
  ok(TABLES.length === new Set(TABLES).size, 'aucun numéro de table en double entre les zones');
  ok(TABLES.length === ZONES.reduce((n, z) => n + z.tables.length, 0),
    'la liste à plat reprend exactement les tables des zones');
  ok(ZONES.every((z) => z.couleur && z.nom), 'chaque zone a un nom et une couleur');
  ok(new Set(ZONES.map((z) => z.couleur)).size === ZONES.length, 'une couleur distincte par zone');
  ok(zoneDeTable('201')?.id === 'tonnelle', 'une table est rattachée à sa zone');
  ok(zoneDeTable('26') === null, 'un numéro absent du plan n’appartient à aucune zone');
  ok(zoneDeTable('12')?.id === 'salle', 'les tables 12 et 14 sont rattachées à la Salle');
  ok(zoneDeTable('14')?.id === 'salle', 'la 14 aussi');

  console.log('\n== Normalisation ==');
  ok(normaliser('Côte à Point !') === 'cote a point', 'accents et ponctuation retirés');
  ok(normaliser("l’entrecôte") === 'l entrecote', 'apostrophe traitée comme une séparation');

  console.log('\n== Commandes courantes ==');
  cas('table 22 deux côtes saignantes et un poulet', '22',
    '2 cote/saig + 1 poulet/-', 'plusieurs pièces dans une phrase');
  cas('table 25 une bavette à point', '25', '1 bavette/apnt', 'une pièce simple');
  cas('table 7 trois gigots bien cuits et deux magrets rosés', '7',
    '3 gigot/bcui + 2 magret/apnt', 'quantités et cuissons multiples');

  console.log('\n== Numéros de table ==');
  cas('table onze une bavette à point', '11', '1 bavette/apnt',
    'nombre en toutes lettres, sans absorber la quantité qui suit');
  cas('table cinquante cinq deux entrecôtes bleues', '55', '2 etc/bleu', 'nombre composé');
  cas('table deux cent un un tomahawk saignant', '201', '1 tmhk/saig', 'centaine composée');
  cas('table cent une côte bleue', '100', '1 cote/bleu', 'la centaine ne mange pas la quantité');
  cas('quinze une côte saignante', '15', '1 cote/saig', 'le mot « table » peut manquer');
  ok(analyser('deux côtes saignantes').table === null, 'aucune table inventée si rien ne correspond');
  ok(analyser('table 13 une côte bleue').table === null, 'une table hors du plan de salle est refusée');
  ok(analyser('table 26 une côte bleue').table === null, 'un numéro absent du plan n’est jamais retenu');
  cas('table 12 une côte bleue', '12', '1 cote/bleu', 'une table rajoutée au plan est reconnue');
  cas('table quatorze une côte bleue', '14', '1 cote/bleu', 'y compris dite en toutes lettres');
  cas('table 25 une côte bleue', '25', '1 cote/bleu', 'une table ajoutée au plan est reconnue');

  console.log('\n== Pluriels et variantes ==');
  cas('table 5 deux entrecôtes bleues', '5', '2 etc/bleu', 'pluriel non listé dans la configuration');
  cas('table 5 une entrecôte bleue', '5', '1 etc/bleu', 'singulier');
  cas('table 5 une côte de bœuf bien cuite', '5', '1 cote/bcui', 'formulation longue');
  cas('table 5 un châteaubriand à point', '5', '1 chatb/apnt', 'nom complet d’une abréviation');

  console.log('\n== Carte à jour ==');
  const { grilladeById } = await import('../src/lib/stats.js');
  ok(!grilladeById('ribcap'), 'RibCap est retiré de la carte');
  cas('table 22 un filet saignant', '22', '1 filet/saig', 'Filet est reconnu');
  cas('table 22 deux filets de bœuf bleus', '22', '2 filet/bleu', 'sous sa forme longue aussi');

  console.log('\n== Un qualificatif ne déborde pas sur la pièce suivante ==');
  // Le piège : la cuisson de la pièce d'avant ne doit pas être recopiée sur la
  // suivante, sinon une pièce part sur une cuisson que personne n'a demandée.
  cas('table 22 deux filets bleus et une côte', '22', '2 filet/bleu + 1 cote/-!',
    'la côte sans cuisson reste à compléter');
  cas('table 22 un filet bleu et une bavette à point', '22', '1 filet/bleu + 1 bavette/apnt',
    'chaque pièce garde la sienne');

  console.log('\n== Truffe ==');
  cas('table 22 une côte saignante avec truffe', '22', '1 cote/saig+T', 'supplément reconnu après la pièce');
  cas('table 22 une côte truffée saignante', '22', '1 cote/saig+T', 'ou collé au nom de la pièce');
  cas('table 22 deux filets bleus truffés et une côte saignante', '22',
    '2 filet/bleu+T + 1 cote/saig', 'la truffe ne déborde pas sur la pièce suivante');
  cas('table 22 une côte saignante et une côte saignante truffée', '22',
    '1 cote/saig + 1 cote/saig+T', 'truffée ou non, ce sont deux lignes distinctes');
  cas('table 22 une côte saignante', '22', '1 cote/saig', 'sans truffe, rien n’est ajouté');

  console.log('\n== La variante la plus longue gagne ==');
  cas('table 9 un tomahawk wagyu saignant', '9', '1 tmhkw/saig',
    'tomahawk wagyu ne doit pas être pris pour un tomahawk simple');
  cas('table 9 un tomahawk saignant', '9', '1 tmhk/saig', 'tomahawk simple reste reconnu');

  console.log('\n== Le poulet n’a pas de cuisson ==');
  cas('table 3 deux poulets', '3', '2 poulet/-', 'aucune cuisson attendue');
  cas('table 3 deux poulets bien cuits', '3', '2 poulet/-',
    'une cuisson dite par erreur est ignorée plutôt que retenue');

  console.log('\n== Ce qui manque est signalé, jamais deviné ==');
  cas('table 22 une côte', '22', '1 cote/-!', 'cuisson absente marquée à compléter');
  cas('table 22 une côte et un poulet', '22', '1 cote/-! + 1 poulet/-',
    'seule la pièce concernée est marquée');

  console.log('\n== Cumul et quantités ==');
  cas('table 4 une côte saignante et une côte saignante', '4', '2 cote/saig',
    'deux fois la même pièce se cumulent');
  cas('table 4 une côte saignante et une côte bleue', '4', '1 cote/saig + 1 cote/bleu',
    'des cuissons différentes restent séparées');
  cas('table 4 côte saignante', '4', '1 cote/saig', 'sans quantité, on compte une pièce');
  cas('table 4 quatre côtes bleues', '4', '4 cote/bleu',
    'la quantité ne se confond pas avec le numéro de table');

  console.log('\n== Formulations inversées ==');
  cas('table 8 saignant une côte', '8', '1 cote/saig', 'cuisson annoncée avant la pièce');

  console.log('\n== Entrées vides ou inexploitables ==');
  ok(analyser('').lignes.length === 0, 'texte vide : aucune ligne');
  ok(analyser('   ').lignes.length === 0, 'espaces seuls : aucune ligne');
  ok(analyser('bonjour ça va').lignes.length === 0, 'phrase hors sujet : aucune ligne');
  ok(analyser(null).lignes.length === 0, 'valeur nulle tolérée');

  console.log('\n== Mots non reconnus signalés ==');
  const r = analyser('table 22 une côte saignante et des frites');
  ok(r.motsIgnores.includes('frites'), 'ce qui n’a pas été compris est rapporté');

  console.log(fails ? `\n${fails} ÉCHEC(S)` : '\nTOUT PASSE');
  process.exit(fails ? 1 : 0);
})();
