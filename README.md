# Grill — Gestion des Commandes

Aide-mémoire des commandes au grill : on saisit ce qui est commandé table par table,
et l'application se souvient de ce qui reste à cuire et depuis combien de temps.

Application web autonome (un seul fichier `index.html`), installable sur téléphone
ou tablette et **utilisable sans réseau**. Aucune donnée ne quitte l'appareil :
tout est conservé dans le stockage local du navigateur.

## Les trois écrans

| Écran | À quoi il sert |
|---|---|
| **Saisie** | La grille viandes × cuissons. On tape les quantités, on choisit la table, on envoie. |
| **Grill** | La synthèse : le total de chaque cuisson à faire, toutes tables confondues. C'est la vue à garder sous les yeux pendant le service. |
| **Tickets** | Les commandes envoyées, la plus ancienne en premier, avec le temps écoulé. |

Les onglets **Grill** et **Tickets** affichent une pastille avec, respectivement,
le nombre de pièces encore à cuire et le nombre de tickets ouverts.

## Utilisation

**Saisir une commande**

1. Appuyer sur le bouton **Table** en haut à gauche et choisir le numéro.
   Les tables ayant déjà un ticket ouvert sont signalées par une pastille dorée.
2. Dans la grille, appuyer sur une case pour ajouter une pièce (un appui = +1).
   Un **appui long** sur une case la remet à zéro.
3. Appuyer sur **Envoyer**. Le bouton affiche le nombre total de pièces saisies.

**Suivre la cuisson**

- L'onglet **Grill** regroupe toutes les commandes ouvertes : pour chaque viande et
  chaque cuisson, le nombre de pièces à faire et les tables qui les attendent.
- Dans **Tickets**, appuyer sur une ligne la barre pour indiquer qu'elle est servie ;
  elle sort aussitôt du total de l'onglet Grill. **Terminé** clôt le ticket entier.
- Le minuteur de chaque ticket passe en orange après 8 minutes, en rouge après 15.

**Précuisson**

La bande du haut suit le stock de pièces déjà précuites (Côte, T-Bone, Tmhk, Gigot).
Les boutons `−` et `+` ajustent le compteur ; envoyer une commande décrémente
automatiquement le stock des pièces concernées.

**En cas d'erreur**

Le bouton **↶** annule la dernière action, quelle qu'elle soit : un appui de trop,
une remise à zéro, un RAZ, un envoi, un ticket clôturé par erreur. Les messages de
confirmation proposent aussi « Annuler » directement.

Rien n'est jamais perdu à la fermeture : la saisie en cours, les tickets et les
compteurs sont enregistrés à chaque geste et rechargés au démarrage.

## Installation sur le téléphone ou la tablette

Ouvrir l'adresse du site, puis :

- **Android / Chrome** : menu ⋮ → « Installer l'application ».
- **iPhone / iPad, Safari** : bouton Partager → « Sur l'écran d'accueil ».

L'application s'ouvre alors en plein écran et fonctionne même sans connexion.
Quand une nouvelle version est publiée, un message « Nouvelle version disponible »
propose de recharger — jamais pendant un geste, le rechargement n'est fait
qu'après acceptation.

## Adapter la carte

Tout se règle en haut du script dans `index.html` :

```js
const VIANDES     = ["ETC","Côte","Bavette", …];  // lignes de la grille
const CUIS        = ["Bleu","Saignant","À Point","Bien Cuit"];
const TABLES      = ["1","2","3", …];             // plan de salle
const PRE_VIANDES = ["Côte","T-Bone","Tmhk","Gigot"]; // suivi de précuisson

const WARN_MIN = 8;   // ticket orange après N minutes
const HOT_MIN  = 15;  // ticket rouge après N minutes
```

Ajouter ou retirer une viande ne casse rien : les tickets déjà ouverts qui
mentionnent une viande retirée restent affichés dans la synthèse.

Après toute modification, incrémenter `CACHE` en haut de `sw.js`
(`grill-v3` → `grill-v4`) pour que les appareils déjà installés récupèrent
la nouvelle version.

## Tests

Les tests pilotent un vrai navigateur (Playwright) sur l'application servie
localement — parcours complet de saisie, persistance, migration des anciennes
données, tolérance aux données corrompues et fonctionnement hors-ligne.

```bash
npm install     # installe Playwright (et son navigateur)
npm test        # lance les deux suites, serveur inclus
```

`SHOTS=1 npm test` écrit en plus des captures des trois écrans dans `test/captures/`.
Si Chromium est déjà installé ailleurs : `CHROME_PATH=/chemin/vers/chrome npm test`.

`npm start` sert le dépôt en local pour essayer l'application dans un navigateur.

## Fichiers

```
index.html                 application complète (interface + logique)
manifest.json              déclaration PWA (nom, icônes, couleurs)
sw.js                      service worker — cache hors-ligne
icon.svg                   icône source
icon-192.png  icon-512.png  icon-maskable-512.png
test/                      tests navigateur (+ serveur statique intégré)
```

Les icônes PNG sont produites à partir de `icon.svg`. Pour les régénérer après
modification du dessin, ouvrir `icon.svg` dans un navigateur et exporter en
192×192 et 512×512, ou utiliser n'importe quel convertisseur SVG → PNG.
