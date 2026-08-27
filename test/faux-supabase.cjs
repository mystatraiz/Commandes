/* Faux serveur Supabase pour les tests.

   Reproduit le strict nécessaire de l'authentification et de l'API REST :
   assez pour exercer pour de vrai le moteur de synchronisation (connexion,
   envoi, réception, arbitrage) sans dépendre d'un projet en ligne.
   Le temps réel n'est pas simulé — c'est justement l'occasion de vérifier que
   la synchronisation périodique suffit quand le websocket ne passe pas. */

const http = require('http');

const CODE = 'grill-test';

function start(port = 0) {
  const lignes = new Map();       // id -> ligne
  // Comme `now()` en base : l'heure réelle, strictement croissante.
  let dernier = 0;
  const prochainMajA = () => {
    dernier = Math.max(Date.now(), dernier + 1);
    return new Date(dernier).toISOString();
  };

  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Range',
  };
  const json = (res, code, corps) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(corps));
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }

    let brut = '';
    req.on('data', (c) => { brut += c; });
    req.on('end', () => {
      const corps = brut ? JSON.parse(brut) : null;

      // ---- Authentification ----
      if (url.pathname === '/auth/v1/token') {
        if (corps?.password !== CODE) {
          return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        }
        return json(res, 200, {
          access_token: 'jeton-de-test', token_type: 'bearer', expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-de-test',
          user: { id: 'utilisateur-test', aud: 'authenticated', role: 'authenticated', email: corps.email },
        });
      }
      if (url.pathname.startsWith('/auth/v1/')) return json(res, 200, {});

      // ---- REST ----
      if (url.pathname === '/rest/v1/grill_commandes') {
        if (req.method === 'GET') {
          let sortie = [...lignes.values()];
          const filtre = url.searchParams.get('maj_a');       // ex. « gte.2026-... »
          if (filtre?.startsWith('gte.')) {
            const seuil = Date.parse(filtre.slice(4));
            sortie = sortie.filter((l) => Date.parse(l.maj_a) >= seuil);
          }
          sortie.sort((a, b) => Date.parse(a.maj_a) - Date.parse(b.maj_a));
          return json(res, 200, sortie);
        }
        if (req.method === 'POST') {
          const entrantes = Array.isArray(corps) ? corps : [corps];
          const ecrites = entrantes.map((l) => {
            // maj_a est posé par le serveur, jamais par le client : c'est ce que
            // fait le déclencheur SQL en production.
            const ligne = { ...l, maj_a: prochainMajA() };
            lignes.set(ligne.id, ligne);
            return ligne;
          });
          return json(res, 201, ecrites);
        }
      }
      json(res, 404, { message: 'non géré par le faux serveur : ' + url.pathname });
    });
  });

  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    server.base = `http://127.0.0.1:${server.address().port}`;
    // Permet aux tests d'injecter une commande « venue d'un autre téléphone ».
    server.injecter = (ligne) => { lignes.set(ligne.id, { ...ligne, maj_a: prochainMajA() }); };
    server.lignes = lignes;
    resolve(server);
  }));
}

module.exports = { start, CODE };
