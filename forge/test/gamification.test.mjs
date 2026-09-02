import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleJour, debutJour, jourPlus } from '../src/lib/temps.js';
import { niveau, seuilNiveau, serie, missionsDuJour, calculerXp, badges, xpSession, xpJeune, resume, message, REGLAGES_DEFAUT } from '../src/lib/gamification.js';

const J = cleJour();
const H = 3600000;
const minuit = debutJour(J);
const maintenant = minuit + 20 * H;

test('niveaux : seuils croissants et noms', () => {
  assert.equal(niveau(0).n, 1);
  assert.equal(niveau(0).nom, 'Recrue');
  assert.equal(niveau(299).n, 1);
  assert.equal(niveau(300).n, 2);
  assert.equal(niveau(seuilNiveau(10)).nom, 'Immortel');
  assert.equal(niveau(seuilNiveau(12)).nom, 'Immortel 3');
  assert.ok(niveau(450).progression > 0 && niveau(450).progression < 1);
});

test('XP par geste', () => {
  assert.equal(xpSession({ donnees: { sport: 'padel', calories: 600 } }), 120);
  assert.equal(xpSession({ donnees: { sport: 'renfo', dureeMin: 20, calories: 0 } }), 60);
  assert.equal(xpSession({ donnees: { sport: 'echauffement' } }), 15);
  assert.equal(xpJeune({ debut: 0, fin: 16 * H, donnees: { objectifH: 16 } }), 80 + 50);
  assert.equal(xpJeune({ debut: 0, fin: 14 * H, donnees: { objectifH: 16 } }), 70);
  assert.equal(xpJeune({ debut: 0, fin: null }), 0, 'un jeûne en cours ne rapporte rien encore');
});

test('série : jours consécutifs, aujourd’hui optionnel', () => {
  const e = [
    { id: 'a', type: 'poids', jour: jourPlus(J, -1), donnees: { kg: 80 } },
    { id: 'b', type: 'poids', jour: jourPlus(J, -2), donnees: { kg: 80 } },
    { id: 'c', type: 'poids', jour: jourPlus(J, -3), donnees: { kg: 80 } },
    { id: 'd', type: 'poids', jour: jourPlus(J, -10), donnees: { kg: 80 } },
    { id: 'e', type: 'poids', jour: jourPlus(J, -11), donnees: { kg: 80 } },
    { id: 'f', type: 'poids', jour: jourPlus(J, -12), donnees: { kg: 80 } },
    { id: 'g', type: 'poids', jour: jourPlus(J, -13), donnees: { kg: 80 } },
  ];
  const s = serie(e, maintenant);
  assert.equal(s.courante, 3, 'la série tient tant qu’aujourd’hui n’est pas fini');
  assert.equal(s.aujourdhui, false);
  assert.equal(s.record, 4);
  const s2 = serie([...e, { id: 'h', type: 'sport', jour: J, debut: maintenant - H, donnees: { sport: 'padel' } }], maintenant);
  assert.equal(s2.courante, 4);
  assert.equal(s2.aujourdhui, true);
  assert.equal(serie([], maintenant).courante, 0);
});

test('un jeûne de 12 h rend la journée active, pas un jeûne de 3 h', () => {
  const long = [{ id: 'j', type: 'jeune', debut: minuit + 2 * H, fin: minuit + 15 * H, donnees: {} }];
  assert.equal(serie(long, maintenant).aujourdhui, true);
  const court = [{ id: 'j', type: 'jeune', debut: minuit + 2 * H, fin: minuit + 5 * H, donnees: {} }];
  assert.equal(serie(court, maintenant).aujourdhui, false);
});

test('missions du jour : trois, dont deux fixes', () => {
  const m = missionsDuJour([], REGLAGES_DEFAUT, maintenant);
  assert.equal(m.length, 3);
  assert.deepEqual(m.slice(0, 2).map((x) => x.id), ['poids', 'jeune']);
  assert.ok(m.every((x) => x.fait === false));
  const e = [
    { id: 'p', type: 'poids', jour: J, donnees: { kg: 80 } },
    { id: 'j', type: 'jeune', debut: minuit - 6 * H, fin: minuit + 11 * H, donnees: { objectifH: 16 } },
  ];
  const m2 = missionsDuJour(e, REGLAGES_DEFAUT, maintenant);
  assert.equal(m2[0].fait, true);
  assert.equal(m2[1].fait, true, 'un jeûne de 17 h terminé aujourd’hui valide la mission');
});

test('XP total et journée parfaite', () => {
  const e = [
    { id: 'p', type: 'poids', jour: J, donnees: { kg: 80 } },
    { id: 'j', type: 'jeune', debut: minuit - 6 * H, fin: minuit + 11 * H, donnees: { objectifH: 16 } },
  ];
  const { total } = calculerXp(e, REGLAGES_DEFAUT, maintenant);
  // 10 (poids) + 17×5 + 50 (jeûne) + 2 missions × 20 = 185, plus la veille active par le jeûne (6 h < 12 : non)
  assert.equal(total, 10 + 85 + 50 + 40);
  const missionsCompletes = [...e,
    { id: 's', type: 'sport', jour: J, debut: minuit + 12 * H, donnees: { sport: 'renfo', dureeMin: 30, calories: 400 } },
    { id: 'w', type: 'sport', jour: J, debut: minuit + 9 * H, donnees: { sport: 'echauffement', dureeMin: 10 } },
  ];
  const r = resume(missionsCompletes, REGLAGES_DEFAUT, maintenant);
  assert.equal(r.missions.filter((m) => m.fait).length, 3, 'renfo 30 min à 400 kcal + échauffement : toute mission tournante est couverte');
  assert.equal(r.journeesParfaites, 1);
  assert.equal(message({ serie: r.serie, missions: r.missions, jeuneEnCours: null }), 'Journée parfaite. Reviens demain, on remet ça.');
});

test('badges : obtenus et progression', () => {
  const e = [];
  for (let i = 0; i < 10; i++) e.push({ id: `s${i}`, type: 'sport', jour: jourPlus(J, -i), debut: debutJour(jourPlus(J, -i)) + 10 * H, donnees: { sport: 'padel', calories: 600, dureeMin: 90 } });
  const b = badges(e, REGLAGES_DEFAUT, maintenant);
  const par = Object.fromEntries(b.map((x) => [x.id, x]));
  assert.equal(par.padel_10.obtenu, true);
  assert.equal(par.padel_25.obtenu, false);
  assert.equal(par.padel_25.progres, 10 / 25);
  assert.equal(par.serie_7.obtenu, true);
  assert.equal(par.kcal_5000.obtenu, true);
  assert.equal(par.premier_pas.obtenu, true);
  assert.equal(par.jeune_16.obtenu, false);
});

test('le message pousse quand la série est en danger', () => {
  const e = [{ id: 'a', type: 'poids', jour: jourPlus(J, -1), donnees: { kg: 80 } }];
  const r = resume(e, REGLAGES_DEFAUT, maintenant);
  assert.match(message({ serie: r.serie, missions: r.missions, jeuneEnCours: null }), /série de 1 jour est en jeu/);
});
