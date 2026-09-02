/* Ce qui donne envie de revenir : XP, niveaux, série de jours, missions du
   jour et badges. Tout est recalculé à partir des entrées — rien n'est stocké,
   donc rien ne peut se désynchroniser entre deux appareils. Fonctions pures. */

import { cleJour, debutJour, jourPlus } from './temps.js';
import { heuresJeuneDuJour, jeunes, dureeJeuneH } from './jeune.js';
import { pesees, sessions, construireSeries } from './series.js';

export const REGLAGES_DEFAUT = {
  prenom: '',
  objectifPoids: null,
  objectifJeuneH: 16,
  objectifSessions: 3,
  poidsRef: 80,
};

export const XP = {
  poids: 10,
  jeuneParHeure: 5,
  jeuneObjectif: 50,
  padel: 60,
  renfo: 40,
  renfoParMin: 1,
  echauffement: 15,
  autre: 30,
  kcalDiviseur: 10,
  mission: 20,
  journeeParfaite: 50,
};

/* ---------------- XP ---------------- */

export function xpSession(s) {
  const d = s.donnees || {};
  const kcal = Math.round((Number(d.calories) || 0) / XP.kcalDiviseur);
  switch (d.sport) {
    case 'padel': return XP.padel + kcal;
    case 'renfo': return XP.renfo + Math.min(60, Number(d.dureeMin) || 0) * XP.renfoParMin + kcal;
    case 'echauffement': return XP.echauffement;
    default: return XP.autre + kcal;
  }
}

export function xpJeune(j, maintenant = Date.now()) {
  if (!j.fin) return 0;
  const h = Math.min(36, dureeJeuneH(j, maintenant));
  if (h < 1) return 0;
  const objectif = Number(j.donnees?.objectifH) || 16;
  return Math.floor(h) * XP.jeuneParHeure + (h >= objectif ? XP.jeuneObjectif : 0);
}

/* ---------------- Journées actives ---------------- */

/** Une journée compte si on y a fait quelque chose : pesée, session, ou au moins 12 h de jeûne. */
export function joursActifs(entrees, maintenant = Date.now()) {
  const jours = new Set();
  for (const p of pesees(entrees)) if (p.jour) jours.add(p.jour);
  for (const s of sessions(entrees)) if (s.jour) jours.add(s.jour);
  // Les jeûnes : on parcourt les journées qu'ils couvrent.
  for (const j of jeunes(entrees)) {
    if (!j.debut) continue;
    const fin = j.fin || maintenant;
    let cle = cleJour(j.debut);
    const derniere = cleJour(fin);
    for (let i = 0; i < 60 && cle <= derniere; i++) {
      if (!jours.has(cle) && heuresJeuneDuJour(entrees, cle, maintenant) >= 12) jours.add(cle);
      cle = jourPlus(cle, 1);
    }
  }
  return jours;
}

export function serie(entrees, maintenant = Date.now()) {
  const actifs = joursActifs(entrees, maintenant);
  const auj = cleJour(maintenant);
  const aujourdhui = actifs.has(auj);
  let cle = aujourdhui ? auj : jourPlus(auj, -1);
  let courante = 0;
  while (actifs.has(cle)) { courante++; cle = jourPlus(cle, -1); }

  // Record : la plus longue suite de jours consécutifs.
  const tries = [...actifs].sort();
  let record = 0;
  let run = 0;
  let prec = null;
  for (const j of tries) {
    run = prec && jourPlus(prec, 1) === j ? run + 1 : 1;
    if (run > record) record = run;
    prec = j;
  }
  return { courante, record: Math.max(record, courante), aujourdhui, joursActifs: actifs.size };
}

/* ---------------- Missions du jour ---------------- */

const MISSIONS_TOURNANTES = [
  { id: 'session',      titre: 'Une session de sport',   detail: 'Padel, renfo, n’importe quoi. Mais quelque chose.' },
  { id: 'renfo15',      titre: '15 min de renfo',        detail: 'Un circuit adapté à ton temps. Lance le lecteur.' },
  { id: 'kcal300',      titre: 'Brûle 300 kcal',         detail: 'Ce que ta montre affiche, cumulé sur la journée.' },
  { id: 'echauffement', titre: 'Échauffement padel',     detail: 'Les 10 minutes qui évitent la blessure.' },
  { id: 'bouge30',      titre: '30 minutes d’activité',  detail: 'Cumulées sur la journée.' },
];

export function missionsDuJour(entrees, reglages = REGLAGES_DEFAUT, maintenant = Date.now()) {
  const auj = cleJour(maintenant);
  const objectif = Number(reglages.objectifJeuneH) || 16;
  const duJour = sessions(entrees).filter((s) => s.jour === auj);
  const kcal = duJour.reduce((s, x) => s + (Number(x.donnees?.calories) || 0), 0);
  const minutes = duJour.reduce((s, x) => s + (Number(x.donnees?.dureeMin) || 0), 0);
  const heuresJeune = heuresJeuneDuJour(entrees, auj, maintenant);
  const jeuneAtteint = heuresJeune >= objectif
    || jeunes(entrees).some((j) => j.debut && (j.fin || maintenant) >= debutJour(auj) && dureeJeuneH(j, maintenant) >= objectif);

  const numJour = Math.floor(debutJour(auj) / 86400000);
  const tournante = MISSIONS_TOURNANTES[numJour % MISSIONS_TOURNANTES.length];

  const faits = {
    poids: pesees(entrees).some((p) => p.jour === auj),
    jeune: jeuneAtteint,
    session: duJour.some((s) => s.donnees?.sport !== 'echauffement'),
    renfo15: duJour.some((s) => s.donnees?.sport === 'renfo' && (Number(s.donnees?.dureeMin) || 0) >= 15),
    kcal300: kcal >= 300,
    echauffement: duJour.some((s) => s.donnees?.sport === 'echauffement'),
    bouge30: minutes >= 30,
  };

  return [
    { id: 'poids', titre: 'Monte sur la balance', detail: 'Chaque jour, même quand ça ne te plaît pas.', xp: XP.mission, fait: faits.poids },
    { id: 'jeune', titre: `Jeûne ${objectif} h`, detail: `${Math.floor(heuresJeune)} h rattachées à aujourd’hui pour l’instant.`, xp: XP.mission, fait: faits.jeune },
    { ...tournante, xp: XP.mission, fait: faits[tournante.id] },
  ];
}

/** Total XP, en incluant les missions accomplies chaque jour actif. */
export function calculerXp(entrees, reglages = REGLAGES_DEFAUT, maintenant = Date.now()) {
  let total = 0;
  for (const s of sessions(entrees)) total += xpSession(s);
  for (const j of jeunes(entrees)) total += xpJeune(j, maintenant);
  total += pesees(entrees).length * XP.poids;

  let journeesParfaites = 0;
  for (const jour of joursActifs(entrees, maintenant)) {
    const m = missionsDuJour(entrees, reglages, debutJour(jour) + 43200000);
    const faites = m.filter((x) => x.fait).length;
    total += faites * XP.mission;
    if (faites === m.length) { total += XP.journeeParfaite; journeesParfaites++; }
  }
  return { total, journeesParfaites };
}

/** XP gagnée sur une journée donnée (pour le « +120 XP aujourd'hui »). */
export function xpDuJour(entrees, reglages = REGLAGES_DEFAUT, maintenant = Date.now()) {
  const auj = cleJour(maintenant);
  let xp = 0;
  for (const s of sessions(entrees)) if (s.jour === auj) xp += xpSession(s);
  for (const j of jeunes(entrees)) if (j.fin && cleJour(j.fin) === auj) xp += xpJeune(j, maintenant);
  xp += pesees(entrees).filter((p) => p.jour === auj).length * XP.poids;
  const m = missionsDuJour(entrees, reglages, maintenant);
  const faites = m.filter((x) => x.fait).length;
  xp += faites * XP.mission + (faites === m.length ? XP.journeeParfaite : 0);
  return xp;
}

/* ---------------- Niveaux ---------------- */

const NOMS_NIVEAUX = ['Recrue', 'Rookie', 'Combattant', 'Guerrier', 'Vétéran', 'Élite', 'Champion', 'Légende', 'Titan', 'Immortel'];

export const seuilNiveau = (n) => 150 * n * (n - 1);   // niveau 1 à 0, 2 à 300, 3 à 900, 10 à 13 500

export function niveau(xp) {
  let n = 1;
  while (seuilNiveau(n + 1) <= xp) n++;
  const base = seuilNiveau(n);
  const suivant = seuilNiveau(n + 1);
  const nom = n <= NOMS_NIVEAUX.length ? NOMS_NIVEAUX[n - 1] : `Immortel ${n - NOMS_NIVEAUX.length + 1}`;
  return { n, nom, xp, base, suivant, dansNiveau: xp - base, pourSuivant: suivant - base, progression: (xp - base) / (suivant - base) };
}

/* ---------------- Semaine ---------------- */

export function semaine(entrees, reglages = REGLAGES_DEFAUT, maintenant = Date.now()) {
  const auj = cleJour(maintenant);
  const d = new Date(`${auj}T12:00:00`);
  const decal = (d.getDay() + 6) % 7;   // lundi = 0
  const lundi = jourPlus(auj, -decal);
  const s = sessions(entrees).filter((x) => x.jour >= lundi && x.jour <= auj && x.donnees?.sport !== 'echauffement');
  return {
    lundi,
    sessions: s.length,
    objectif: Number(reglages.objectifSessions) || 3,
    kcal: s.reduce((t, x) => t + (Number(x.donnees?.calories) || 0), 0),
    minutes: s.reduce((t, x) => t + (Number(x.donnees?.dureeMin) || 0), 0),
  };
}

/* ---------------- Badges ---------------- */

export function badges(entrees, reglages = REGLAGES_DEFAUT, maintenant = Date.now()) {
  const p = pesees(entrees);
  const s = sessions(entrees);
  const jf = jeunes(entrees).filter((j) => j.fin);
  const parSport = (id) => s.filter((x) => x.donnees?.sport === id).length;
  const kcal = s.reduce((t, x) => t + (Number(x.donnees?.calories) || 0), 0);
  const maxJeune = jf.reduce((m, j) => Math.max(m, dureeJeuneH(j, maintenant)), 0);
  const nbJeunes12 = jf.filter((j) => dureeJeuneH(j, maintenant) >= 12).length;
  const { record } = serie(entrees, maintenant);
  const perdu = p.length >= 2 ? Math.max(0, p[0].donnees.kg - p[p.length - 1].donnees.kg) : 0;
  const { journeesParfaites } = calculerXp(entrees, reglages, maintenant);
  const total = p.length + s.length + jeunes(entrees).length;

  const B = (id, nom, detail, icone, valeur, cible) => ({
    id, nom, detail, icone, valeur, cible, obtenu: valeur >= cible, progres: Math.min(1, valeur / cible),
  });

  return [
    B('premier_pas', 'Premier pas', 'Une première entrée. Tout commence là.', '🚀', total, 1),
    B('jeune_1', 'À jeun', 'Un jeûne de 12 h terminé.', '⏱️', nbJeunes12, 1),
    B('jeune_16', 'Seize', 'Un jeûne de 16 h.', '🔥', maxJeune >= 16 ? 1 : 0, 1),
    B('jeune_20', 'Guerrier', 'Un jeûne de 20 h.', '⚔️', maxJeune >= 20 ? 1 : 0, 1),
    B('jeune_24', 'Un jour entier', 'Un jeûne de 24 h.', '🌑', maxJeune >= 24 ? 1 : 0, 1),
    B('jeune_10', 'Discipline', '10 jeûnes de 12 h ou plus.', '🧱', nbJeunes12, 10),
    B('jeune_50', 'Moine', '50 jeûnes de 12 h ou plus.', '🏯', nbJeunes12, 50),
    B('serie_3', 'Ça prend', '3 jours de suite.', '🔗', record, 3),
    B('serie_7', 'Une semaine', '7 jours de suite.', '📅', record, 7),
    B('serie_14', 'Deux semaines', '14 jours de suite.', '🛡️', record, 14),
    B('serie_30', 'Un mois', '30 jours de suite. Personne ne t’arrête.', '👑', record, 30),
    B('serie_100', 'Centurion', '100 jours de suite.', '🏛️', record, 100),
    B('padel_1', 'Sur la piste', 'Première session de padel.', '🎾', parSport('padel'), 1),
    B('padel_10', 'Habitué', '10 sessions de padel.', '🏟️', parSport('padel'), 10),
    B('padel_25', 'Vétéran de la vitre', '25 sessions de padel.', '🥇', parSport('padel'), 25),
    B('padel_50', 'Pro du padel', '50 sessions de padel.', '🏆', parSport('padel'), 50),
    B('renfo_1', 'Premier circuit', 'Une session de renfo.', '💪', parSport('renfo'), 1),
    B('renfo_10', 'Forgé', '10 sessions de renfo.', '🔩', parSport('renfo'), 10),
    B('renfo_25', 'Acier', '25 sessions de renfo.', '⚙️', parSport('renfo'), 25),
    B('echauff_10', 'Jamais à froid', '10 échauffements padel.', '🌡️', parSport('echauffement'), 10),
    B('kcal_5000', 'Fournaise', '5 000 kcal brûlées.', '🔥', kcal, 5000),
    B('kcal_25000', 'Réacteur', '25 000 kcal brûlées.', '☄️', kcal, 25000),
    B('poids_7', 'Sur la balance', '7 pesées.', '⚖️', p.length, 7),
    B('poids_30', 'Rigueur', '30 pesées.', '📊', p.length, 30),
    B('moins_2', 'Moins 2', '2 kg de moins qu’au départ.', '📉', perdu, 2),
    B('moins_5', 'Moins 5', '5 kg de moins qu’au départ.', '🎯', perdu, 5),
    B('moins_10', 'Moins 10', '10 kg de moins qu’au départ.', '💎', perdu, 10),
    B('parfaite_1', 'Journée parfaite', 'Les trois missions du jour accomplies.', '⭐', journeesParfaites, 1),
    B('parfaite_7', 'Sans faute', '7 journées parfaites.', '🌟', journeesParfaites, 7),
  ];
}

/* ---------------- Le mot du jour ---------------- */

const PUNCHLINES = [
  'Pas d’excuses. Des résultats.',
  'La discipline bat la motivation. Tous les jours.',
  'Ce que tu ne fais pas aujourd’hui, tu le paies demain.',
  'Personne ne viendra le faire à ta place.',
  'Le corps suit la tête. Décide.',
  'Un jour de plus. C’est tout ce qu’on te demande.',
  'Les autres dorment. Toi, tu forges.',
];

export function message(etat, maintenant = Date.now()) {
  const { serie: s, missions, jeuneEnCours } = etat;
  const faites = missions.filter((m) => m.fait).length;
  if (faites === missions.length) return 'Journée parfaite. Reviens demain, on remet ça.';
  if (!s.aujourdhui && s.courante > 0) return `Ta série de ${s.courante} jour${s.courante > 1 ? 's' : ''} est en jeu. Bouge.`;
  if (jeuneEnCours) return 'Le jeûne tourne. Tiens bon, l’eau est ton alliée.';
  if (s.courante === 0) return 'Zéro série. Ça commence maintenant.';
  const numJour = Math.floor(debutJour(maintenant) / 86400000);
  return PUNCHLINES[numJour % PUNCHLINES.length];
}

/* ---------------- Tout en une passe ---------------- */

export function resume(entrees, reglages = REGLAGES_DEFAUT, maintenant = Date.now()) {
  const { total, journeesParfaites } = calculerXp(entrees, reglages, maintenant);
  const s = serie(entrees, maintenant);
  const missions = missionsDuJour(entrees, reglages, maintenant);
  const b = badges(entrees, reglages, maintenant);
  const series7 = construireSeries(entrees, 7, maintenant);
  return {
    xp: total,
    xpAujourdhui: xpDuJour(entrees, reglages, maintenant),
    niveau: niveau(total),
    serie: s,
    missions,
    badges: b,
    nbBadges: b.filter((x) => x.obtenu).length,
    journeesParfaites,
    semaine: semaine(entrees, reglages, maintenant),
    series7,
  };
}
