import { normaliserCode, codeValide } from './defis.js';

/*
  Inviter.

  Un code de six caractères se recopie mal dans un groupe : il en manque une
  lettre, ou elle arrive en minuscule — l'alphabet des codes exclut déjà ce qui
  se confond. Un lien, lui, s'ouvre. On envoie donc les deux : la phrase avec le
  code en clair, lisible même sans cliquer, et le lien qui remplit le code tout
  seul à l'arrivée.

  Ici, rien que du texte : aucune de ces fonctions ne touche au navigateur, pour
  qu'elles se vérifient une par une.
*/

export const PARAM_CODE = 'defi';

/** L'adresse de l'application, débarrassée des paramètres et de l'ancre. */
export function lienApp(href) {
  let u;
  try { u = new URL(href); } catch { return ''; }
  u.search = '';
  u.hash = '';
  // « …/index.html » est ce que le navigateur affiche, pas ce qu'on dicte.
  if (u.pathname.endsWith('/index.html')) u.pathname = u.pathname.slice(0, -'index.html'.length);
  return u.toString();
}

/** L'adresse qui ouvre l'écran « Rejoindre » avec le code déjà rempli. */
export function lienDefi(code, href) {
  const base = lienApp(href);
  if (!base) return '';
  const c = normaliserCode(code);
  if (!codeValide(c)) return base;
  const u = new URL(base);
  u.searchParams.set(PARAM_CODE, c);
  return u.toString();
}

/** Le code porté par un lien d'invitation, ou rien s'il n'y en a pas de valable. */
export function codeDepuisLien(href) {
  let u;
  try { u = new URL(href); } catch { return null; }
  const brut = u.searchParams.get(PARAM_CODE);
  if (!brut) return null;
  const c = normaliserCode(brut);
  return codeValide(c) ? c : null;
}

/*
  Le message. Le lien reste à part : la feuille de partage du système le place
  elle-même, et l'inclure dans le texte le ferait apparaître deux fois.
*/

export function messageDefi(defi, lien) {
  const lignes = [`« ${defi.nom} » sur Gros Sac : la course au poids perdu.`];
  if (defi.gage) lignes.push(`En jeu : ${defi.gage}`);
  lignes.push(`Code du défi : ${defi.code}`);
  lignes.push('Le lien te met le code tout prêt. Tu te pèses, on compare les pourcentages perdus — jamais les poids.');
  return { titre: `Gros Sac — ${defi.nom}`, texte: lignes.join('\n'), lien };
}

export function messageApp(lien) {
  return {
    titre: 'Gros Sac',
    texte: [
      'Gros Sac : on note son poids, ses jeûnes et ses sessions, et on se tire la bourre sur le pourcentage perdu.',
      'Installe-la, je te fais un défi.',
    ].join('\n'),
    lien,
  };
}

/** Ce qu'on met dans le presse-papiers faute de feuille de partage. */
export function texteComplet({ texte, lien }) {
  return [texte, lien].filter(Boolean).join('\n');
}
