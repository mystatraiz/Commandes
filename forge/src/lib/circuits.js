/* Circuits de renforcement et leur adaptation au temps disponible.
   Fonctions pures : l'écran ne fait qu'afficher ce qui sort d'ici. */

export const EXERCICES = {
  squat:        { nom: 'Squats',                 zone: 'jambes', consigne: 'Pieds largeur d’épaules, descends sous la parallèle, pousse dans les talons.' },
  fente:        { nom: 'Fentes alternées',       zone: 'jambes', consigne: 'Grand pas, genou arrière vers le sol, buste droit. Alterne.' },
  fente_lat:    { nom: 'Fentes latérales',       zone: 'jambes', consigne: 'Pas large sur le côté, hanche en arrière, l’autre jambe tendue.' },
  squat_saut:   { nom: 'Squats sautés',          zone: 'jambes', consigne: 'Descends, explose vers le haut, réception souple.' },
  pont:         { nom: 'Pont fessier',           zone: 'jambes', consigne: 'Dos au sol, pousse les hanches vers le ciel, serre les fessiers en haut.' },
  mollets:      { nom: 'Mollets sur une jambe',  zone: 'jambes', consigne: 'Monte sur la pointe, descends lentement. Change de jambe à mi-temps.' },
  pompe:        { nom: 'Pompes',                 zone: 'haut',   consigne: 'Corps gainé, coudes à 45°, poitrine près du sol. Sur les genoux si besoin.' },
  pompe_diam:   { nom: 'Pompes diamant',         zone: 'haut',   consigne: 'Mains rapprochées sous la poitrine, coudes le long du corps.' },
  dips:         { nom: 'Dips sur chaise',        zone: 'haut',   consigne: 'Mains sur le bord, descends les coudes à 90°, remonte.' },
  pike:         { nom: 'Pompes pike',            zone: 'haut',   consigne: 'Hanches hautes en V inversé, tête vers le sol, pousse avec les épaules.' },
  superman:     { nom: 'Superman',               zone: 'haut',   consigne: 'Sur le ventre, décolle bras et jambes, tiens une seconde en haut.' },
  rowing_serv:  { nom: 'Rowing serviette',       zone: 'haut',   consigne: 'Serviette autour d’un poteau ou d’une porte, tire les coudes en arrière.' },
  planche:      { nom: 'Planche',                zone: 'core',   consigne: 'Coudes sous les épaules, fessiers serrés, ligne droite. Ne creuse pas.' },
  planche_lat:  { nom: 'Planche latérale',       zone: 'core',   consigne: 'Sur un coude, hanches hautes. Change de côté à mi-temps.' },
  climber:      { nom: 'Mountain climbers',      zone: 'cardio', consigne: 'Position pompe, genoux vers la poitrine en alternance, rapide.' },
  burpee:       { nom: 'Burpees',                zone: 'cardio', consigne: 'Descends, pompe, saute pieds joints, extension complète. Pas de pitié.' },
  jumping:      { nom: 'Jumping jacks',          zone: 'cardio', consigne: 'Ouvre bras et jambes en sautant. Rythme régulier.' },
  genoux:       { nom: 'Montées de genoux',      zone: 'cardio', consigne: 'Genoux à hauteur de hanche, sur place, bras qui pompent.' },
  skater:       { nom: 'Sauts de patineur',      zone: 'cardio', consigne: 'Bond latéral d’une jambe sur l’autre, réception stable. Le geste du padel.' },
  russian:      { nom: 'Russian twists',         zone: 'core',   consigne: 'Assis, pieds décollés, tourne le buste d’un côté à l’autre.' },
  crunch_velo:  { nom: 'Crunchs vélo',           zone: 'core',   consigne: 'Coude vers le genou opposé, l’autre jambe tendue. Lent et contrôlé.' },
  jambes_lev:   { nom: 'Relevés de jambes',      zone: 'core',   consigne: 'Dos plaqué au sol, jambes tendues qui montent et descendent sans toucher.' },
  hollow:       { nom: 'Hollow hold',            zone: 'core',   consigne: 'Bas du dos au sol, épaules et jambes décollées. Respire.' },
  dead_bug:     { nom: 'Dead bug',               zone: 'core',   consigne: 'Sur le dos, bras et jambe opposés qui s’étendent. Le dos ne bouge pas.' },
  rotation:     { nom: 'Rotations explosives',   zone: 'core',   consigne: 'Debout, pieds ancrés, rotation rapide du buste comme un coup droit.' },
  chaise:       { nom: 'Chaise contre le mur',   zone: 'jambes', consigne: 'Dos au mur, cuisses parallèles au sol. Tiens.' },
  sprint_place: { nom: 'Sprint sur place',       zone: 'cardio', consigne: 'Le plus vite possible, sur l’avant du pied.' },
  pas_chasses:  { nom: 'Pas chassés',            zone: 'cardio', consigne: 'Bas sur les appuis, 3 pas à gauche, 3 à droite. Comme au filet.' },
};

/* Chaque circuit liste ses exercices par ordre de priorité : quand le temps
   manque, ce sont les derniers qui sautent. */
export const CIRCUITS = [
  {
    id: 'full', nom: 'Full Body Blitz', accroche: 'Tout le corps, aucune excuse',
    cible: 'Renfo général', difficulte: 2, teinte: 'lime',
    exercices: ['squat', 'pompe', 'fente', 'planche', 'climber', 'pont', 'dips', 'superman', 'burpee', 'russian'],
  },
  {
    id: 'padel', nom: 'Padel Power', accroche: 'Jambes, hanches, rotation',
    cible: 'Spécifique padel', difficulte: 3, teinte: 'feu',
    exercices: ['fente_lat', 'skater', 'rotation', 'squat_saut', 'planche_lat', 'pas_chasses', 'pont', 'pompe', 'chaise', 'genoux'],
  },
  {
    id: 'core', nom: 'Core Steel', accroche: 'Un centre en acier',
    cible: 'Abdos et gainage', difficulte: 2, teinte: 'acier',
    exercices: ['planche', 'crunch_velo', 'planche_lat', 'jambes_lev', 'dead_bug', 'russian', 'hollow', 'superman', 'climber'],
  },
  {
    id: 'hiit', nom: 'HIIT Inferno', accroche: 'Brûle. Tout.',
    cible: 'Cardio intense', difficulte: 3, teinte: 'feu',
    exercices: ['burpee', 'climber', 'squat_saut', 'jumping', 'sprint_place', 'skater', 'genoux', 'pompe'],
  },
  {
    id: 'haut', nom: 'Haut du corps Titan', accroche: 'Bras, épaules, dos',
    cible: 'Haut du corps', difficulte: 2, teinte: 'acier',
    exercices: ['pompe', 'dips', 'pike', 'rowing_serv', 'superman', 'pompe_diam', 'planche', 'climber'],
  },
  {
    id: 'jambes', nom: 'Jambes de fer', accroche: 'Le padel se gagne aux appuis',
    cible: 'Bas du corps', difficulte: 2, teinte: 'lime',
    exercices: ['squat', 'fente', 'pont', 'fente_lat', 'chaise', 'mollets', 'squat_saut', 'skater'],
  },
];

export const circuitById = (id) => CIRCUITS.find((c) => c.id === id) || null;

export const DUREES = [5, 10, 15, 20, 30, 45];

/** Rythme travail / repos selon le temps disponible : court = dense. */
export function rythme(minutes) {
  if (minutes <= 10) return { travailS: 30, reposS: 10, reposToursS: 20 };
  if (minutes <= 20) return { travailS: 40, reposS: 15, reposToursS: 30 };
  if (minutes <= 35) return { travailS: 40, reposS: 20, reposToursS: 45 };
  return { travailS: 45, reposS: 15, reposToursS: 60 };
}

/** Durée totale : travail + repos entre exercices (aucun après le dernier du tour) + repos entre tours. */
export const dureePlanS = (k, tours, r) => tours * k * r.travailS + tours * (k - 1) * r.reposS + Math.max(0, tours - 1) * r.reposToursS;

/**
 * Adapte un circuit au temps dont on dispose.
 * Cherche le couple (tours, nombre d'exercices) qui remplit au mieux le temps,
 * en préférant au moins 4 exercices et au moins 2 tours quand c'est possible.
 */
export function adapterCircuit(circuit, minutes) {
  minutes = Math.max(3, Math.min(90, Number(minutes) || 15));
  const r = rythme(minutes);
  const budget = minutes * 60;
  const n = circuit.exercices.length;
  let meilleur = null;
  for (let tours = 1; tours <= 8; tours++) {
    for (let k = 3; k <= n; k++) {
      const duree = dureePlanS(k, tours, r);
      if (duree > budget) continue;
      let score = duree;
      if (k < 4) score -= 200;
      if (tours < 2) score -= 150;
      if (tours > 5) score -= 60 * (tours - 5);
      if (!meilleur || score > meilleur.score) meilleur = { tours, k, duree, score };
    }
  }
  // Trop court pour un tour complet de trois exercices : on fait un tour du minimum.
  if (!meilleur) meilleur = { tours: 1, k: Math.min(3, n), duree: dureePlanS(Math.min(3, n), 1, r), score: 0 };
  const exercices = circuit.exercices.slice(0, meilleur.k).map((id) => ({ id, ...EXERCICES[id] }));
  const plan = { circuit, minutes, ...r, tours: meilleur.tours, exercices, dureeS: meilleur.duree };
  return { ...plan, etapes: construireEtapes(plan) };
}

/** Déroulé seconde par seconde : ce que joue le lecteur. */
export function construireEtapes(plan) {
  const etapes = [];
  for (let t = 1; t <= plan.tours; t++) {
    plan.exercices.forEach((ex, i) => {
      etapes.push({ type: 'travail', nom: ex.nom, consigne: ex.consigne, dureeS: plan.travailS, tour: t, index: i });
      const dernier = i === plan.exercices.length - 1;
      if (!dernier) {
        const suivant = plan.exercices[i + 1];
        etapes.push({ type: 'repos', nom: 'Repos', consigne: `Ensuite : ${suivant.nom}`, dureeS: plan.reposS, tour: t, index: i });
      } else if (t < plan.tours) {
        etapes.push({ type: 'repos', nom: `Fin du tour ${t}`, consigne: `Souffle. Tour ${t + 1} : ${plan.exercices[0].nom}`, dureeS: plan.reposToursS, tour: t, index: i });
      }
    });
  }
  return etapes;
}

/** Estimation de dépense pour une session de renfo, si la montre n'a rien dit.
    MET moyen 6 : kcal ≈ MET × 3,5 × poids / 200 par minute. */
export function estimerCalories(dureeMin, poidsKg = 80, intensite = 3) {
  const met = 4 + intensite;
  return Math.round((met * 3.5 * poidsKg) / 200 * dureeMin);
}
