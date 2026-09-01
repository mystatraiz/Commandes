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
//
// `dit` liste ce que la dictée peut renvoyer pour cette cuisson. Les accents,
// la casse et le « s » du pluriel sont ignorés : inutile de les décliner.
export const CUISSONS = [
  { id: 'bleu', nom: 'Bleu',      couleur: '#395EC8', encre: '#FFFFFF',
    dit: ['bleu', 'bleue'] },
  { id: 'saig', nom: 'Saignant',  couleur: '#AA3023', encre: '#FFFFFF',
    dit: ['saignant', 'saignante'] },
  { id: 'apnt', nom: 'À Point',   couleur: '#CE7950', encre: '#241004',
    dit: ['a point', 'apoint', 'au point', 'rose', 'rosee'] },
  { id: 'bcui', nom: 'Bien Cuit', couleur: '#934F00', encre: '#FFFFFF',
    dit: ['bien cuit', 'bien cuite', 'biencuit', 'cuit a coeur'] },
];

// La carte du grill. `sansCuisson` saute l'écran des cuissons : la pièce est
// ajoutée directement à la commande.
//
// `dit` : ce que la dictée peut renvoyer pour cette pièce. Ces listes sont des
// suppositions à partir de vos abréviations — corrigez-les avec vos mots à
// vous, c'est ce qui déterminera la justesse de la reconnaissance vocale.
// Une variante plus longue est reconnue avant une plus courte, donc
// « tomahawk wagyu » l'emporte sur « tomahawk ».
export const GRILLADES = [
  { id: 'etc',    nom: 'ETC',     dit: ['entrecote', 'entre cote', 'etc'] },
  { id: 'cote',   nom: 'Côte',    dit: ['cote de boeuf', 'cote'] },
  { id: 'bavette',nom: 'Bavette', dit: ['bavette'] },
  { id: 'tbone',  nom: 'T-Bone',  dit: ['t bone', 'tbone', 'te bone', 'ti bone'] },
  { id: 'tmhk',   nom: 'Tmhk',    dit: ['tomahawk', 'tomawak', 'tomahak'] },
  { id: 'noix',   nom: 'Noix',    dit: ['noix'] },
  { id: 'tmhkw',  nom: 'TMHKW',   dit: ['tomahawk wagyu', 'tomawak wagyu', 'wagyu'] },
  { id: 'ribcap', nom: 'RibCap',  dit: ['rib cap', 'ribcap', 'ribe cap'] },
  { id: 'chatb',  nom: 'ChatB',   dit: ['chateaubriand', 'chateau briand', 'chato'] },
  { id: 'agneau', nom: 'Agneau',  dit: ['agneau', 'agneaux'] },
  { id: 'magret', nom: 'Magret',  dit: ['magret de canard', 'magret'] },
  { id: 'poulet', nom: 'Poulet', sansCuisson: true, dit: ['poulet'] },
  { id: 'gigot',  nom: 'Gigot',  dit: ["gigot d agneau", 'gigot'] },
];

// Minuteur des commandes en cours (en minutes).
export const SEUIL_ORANGE = 8;
export const SEUIL_ROUGE = 15;

// Les commandes servies sont conservées pour les statistiques, puis purgées.
export const RETENTION_JOURS = 365;

export const cuissonById = (id) => CUISSONS.find((c) => c.id === id) || null;
export const grilladeById = (id) => GRILLADES.find((g) => g.id === id) || null;
