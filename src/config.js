/* Tout ce qui se règle sans toucher au reste du code : la carte, le plan de
   salle, les cuissons et les seuils des minuteurs. */

// Plan de salle, dans l'ordre où la roue les propose.
export const TABLES = [
  '1', '2', '3', '4', '5', '55', '6', '7', '8', '9',
  '11', '12', '14', '15', '16', '17', '18', '19',
  '21', '22', '23', '24',
  '100', '101', '200', '201', '300', '301', '400', '401',
];

// Les cuissons, de la plus saignante à la plus cuite.
// La couleur reprend celle de la viande à cœur : bleu, rouge, rosé, brun.
//
// Ces quatre teintes servent aussi de marques dans les graphiques : elles ont
// été calées pour rester distinguables par un daltonien (écart ΔE 15,6 entre
// les deux plus proches, pour un seuil de 8). Si vous les modifiez, gardez cet
// écart en tête — c'est ce qui permet de lire la répartition des cuissons.
// Chaque valeur `encre` est la couleur de texte qui passe sur ce fond.
export const CUISSONS = [
  { id: 'bleu', nom: 'Bleu',      couleur: '#395EC8', encre: '#FFFFFF' },
  { id: 'saig', nom: 'Saignant',  couleur: '#AA3023', encre: '#FFFFFF' },
  { id: 'apnt', nom: 'À Point',   couleur: '#CE7950', encre: '#241004' },
  { id: 'bcui', nom: 'Bien Cuit', couleur: '#934F00', encre: '#FFFFFF' },
];

// La carte du grill. `sansCuisson` saute l'écran des cuissons : la pièce est
// ajoutée directement à la commande.
export const GRILLADES = [
  { id: 'etc',    nom: 'ETC' },
  { id: 'cote',   nom: 'Côte' },
  { id: 'bavette',nom: 'Bavette' },
  { id: 'tbone',  nom: 'T-Bone' },
  { id: 'tmhk',   nom: 'Tmhk' },
  { id: 'noix',   nom: 'Noix' },
  { id: 'tmhkw',  nom: 'TMHKW' },
  { id: 'ribcap', nom: 'RibCap' },
  { id: 'chatb',  nom: 'ChatB' },
  { id: 'agneau', nom: 'Agneau' },
  { id: 'magret', nom: 'Magret' },
  { id: 'poulet', nom: 'Poulet', sansCuisson: true },
  { id: 'gigot',  nom: 'Gigot' },
];

// Minuteur des commandes en cours (en minutes).
export const SEUIL_ORANGE = 8;
export const SEUIL_ROUGE = 15;

// Les commandes servies sont conservées pour les statistiques, puis purgées.
export const RETENTION_JOURS = 365;

export const cuissonById = (id) => CUISSONS.find((c) => c.id === id) || null;
export const grilladeById = (id) => GRILLADES.find((g) => g.id === id) || null;
