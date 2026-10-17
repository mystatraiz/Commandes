/* Tout ce qui se règle sans toucher au reste du code : la carte, le plan de
   salle, les cuissons et les seuils des minuteurs. */

// Plan de salle, par zone. C'est l'ordre d'affichage du pavé de sélection :
// chaque zone a sa couleur, et ses tables sont posées comme sur un clavier.
//
// Les trois couleurs ont été calées pour le fond sombre : chacune ressort
// nettement de la surface (contraste supérieur à 5,5) et les trois se
// distinguent entre elles. Elles sont volontairement éloignées des teintes
// des cuissons, qui veulent dire autre chose.
export const ZONES = [
  {
    id: 'salle',
    nom: 'Salle',
    couleur: '#16A4E2',
    tables: ['1', '2', '3', '4', '5', '55', '6', '7', '8', '9', '11'],
  },
  {
    id: 'veranda',
    nom: 'Véranda',
    couleur: '#4EB068',
    tables: ['15', '16', '17', '18', '19', '21', '22', '23', '24', '25'],
  },
  {
    id: 'tonnelle',
    nom: 'Tonnelle',
    couleur: '#C876C1',
    tables: ['100', '101', '200', '201', '300', '301', '400', '401'],
  },
];

// Liste à plat, dérivée des zones : utilisée par la dictée et les contrôles.
export const TABLES = ZONES.flatMap((z) => z.tables);

export const zoneDeTable = (table) =>
  ZONES.find((z) => z.tables.includes(String(table))) || null;

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

// Familles de viandes, repérées par le liseré de couleur du bouton.
//
// Les quatre teintes restent distinguables sous les deux daltonismes les plus
// courants (pire écart 10, pour un seuil usuel de 8) et ressortent toutes du
// fond des touches. Le liseré reste malgré tout un repère secondaire : le nom
// de la pièce est toujours écrit, la couleur ne porte jamais seule
// l'information.
export const FAMILLES = [
  { id: 'rouge', nom: 'Bœuf',     couleur: '#E54D42' },
  { id: 'jaune', nom: 'Pièces d\u2019exception', couleur: '#EBD229' },
  { id: 'rose',  nom: 'Agneau',   couleur: '#D75EB4' },
  { id: 'vert',  nom: 'Volaille', couleur: '#54BF5C' },
];

export const familleById = (id) => FAMILLES.find((f) => f.id === id) || null;

// Supplément proposé à la commande, coché au moment de choisir la cuisson.
export const TRUFFE = {
  nom: 'Truffe',
  etiquette: 'TRUFFE',
  dit: ['aux truffes', 'avec truffe', 'truffee', 'truffe'],
};

// La carte du grill, groupée par famille pour que les liserés se suivent.
// `sansCuisson` saute l'écran des cuissons : la pièce est ajoutée directement.
//
// `dit` : ce que la dictée peut renvoyer pour cette pièce. Ces listes sont des
// suppositions à partir de vos abréviations — corrigez-les avec vos mots à
// vous, c'est ce qui déterminera la justesse de la reconnaissance vocale.
// Les accents, la casse et le « s » du pluriel sont ignorés. Une variante plus
// longue est reconnue avant une plus courte, donc « tomahawk wagyu »
// l'emporte sur « tomahawk ».
export const GRILLADES = [
  { id: 'etc',    nom: 'ETC',     famille: 'rouge', dit: ['entrecote', 'entre cote', 'etc'] },
  { id: 'cote',   nom: 'Côte',    famille: 'rouge', dit: ['cote de boeuf', 'cote'] },
  { id: 'bavette',nom: 'Bavette', famille: 'rouge', dit: ['bavette'] },
  { id: 'tbone',  nom: 'T-Bone',  famille: 'rouge', dit: ['t bone', 'tbone', 'te bone', 'ti bone'] },
  { id: 'tmhk',   nom: 'Tmhk',    famille: 'rouge', dit: ['tomahawk', 'tomawak', 'tomahak'] },
  { id: 'filet',  nom: 'Filet',   famille: 'rouge', dit: ['filet de boeuf', 'filet'] },
  { id: 'noix',   nom: 'Noix',    famille: 'jaune', dit: ['noix'] },
  { id: 'tmhkw',  nom: 'TMHKW',   famille: 'jaune', dit: ['tomahawk wagyu', 'tomawak wagyu', 'wagyu'] },
  { id: 'chatb',  nom: 'ChatB',   famille: 'jaune', dit: ['chateaubriand', 'chateau briand', 'chato'] },
  { id: 'agneau', nom: 'Agneau',  famille: 'rose',  dit: ['agneau', 'agneaux'] },
  { id: 'gigot',  nom: 'Gigot',   famille: 'rose',  dit: ['gigot d agneau', 'gigot'] },
  { id: 'poulet', nom: 'Poulet',  famille: 'vert',  sansCuisson: true, dit: ['poulet'] },
  { id: 'magret', nom: 'Magret',  famille: 'vert',  dit: ['magret de canard', 'magret'] },
];

// Minuteur des commandes en cours (en minutes).
export const SEUIL_ORANGE = 8;
export const SEUIL_ROUGE = 15;

// Les commandes servies sont conservées pour les statistiques, puis purgées.
export const RETENTION_JOURS = 365;

export const cuissonById = (id) => CUISSONS.find((c) => c.id === id) || null;
export const grilladeById = (id) => GRILLADES.find((g) => g.id === id) || null;
