/* Échauffement padel de 10 minutes, à jouer avant chaque session.
   Progressif : on réveille, on mobilise, on active, on accélère. */

const E = (nom, dureeS, consigne, phase) => ({ type: 'travail', nom, consigne, dureeS, phase, tour: 1 });

export const ECHAUFFEMENT_PADEL = {
  id: 'echauffement_padel',
  nom: 'Échauffement padel',
  accroche: '10 minutes pour arriver chaud sur la piste',
  dureeS: 600,
  etapes: [
    E('Trottinement léger',            90, 'Autour de la piste ou sur place. Relâché, on respire par le nez.', 'Réveil'),
    E('Talons-fesses & montées de genoux', 60, '30 s de chaque. Amplitude, pas vitesse.', 'Réveil'),
    E('Rotations articulaires',        90, 'Chevilles, genoux, hanches, épaules, poignets : 10 cercles dans chaque sens.', 'Mobilité'),
    E('Fentes marchées + rotation',    60, 'Fente avant, rotation du buste vers la jambe avant. Ouvre la hanche.', 'Mobilité'),
    E('Balancés de jambes',            45, 'Une main sur la vitre : avant-arrière puis latéral. Change de jambe à mi-temps.', 'Mobilité'),
    E('Pas chassés au filet',          60, 'Bas sur les appuis, 4 pas à gauche, 4 à droite. Comme en match.', 'Activation'),
    E('Squats + sauts légers',         45, '8 squats puis petits sauts pieds joints. Réception souple.', 'Activation'),
    E('Épaules & coude',               60, 'Cercles de bras, rotations externes coude au corps, poignet qui tourne la raquette.', 'Activation'),
    E('Shadow padel',                  60, 'À vide : volées de coup droit et revers, bandeja, smash. Jeu de jambes complet.', 'Accélération'),
    E('Sprints réaction',              30, '3 à 5 sprints de 5 m, départ sur signal. Fin : tu es prêt.', 'Accélération'),
  ],
};

export const dureeEchauffementS = () => ECHAUFFEMENT_PADEL.etapes.reduce((s, e) => s + e.dureeS, 0);
