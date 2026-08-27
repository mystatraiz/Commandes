# Grill — Commandes

Prise de commandes au grill : on saisit table par table, l'application se
souvient de ce qui est en cours, depuis combien de temps, et garde l'historique
pour les statistiques du service.

Application React installable sur téléphone ou tablette, **utilisable sans
réseau**. Les données restent sur l'appareil : rien n'est envoyé nulle part.

## Le parcours

**Écran d'accueil** — la liste des commandes en cours, de la plus ancienne à la
plus récente, avec pour chacune le numéro de table, l'heure de prise, le détail
des pièces et un chronomètre qui tourne. Le liseré passe au orange après
8 minutes, au rouge après 15. Un bouton **✓ Servi** fait disparaître la commande
une fois envoyée en salle — avec possibilité d'annuler si c'est une fausse
manœuvre. Le bouton **Nouvelle commande** est en haut, toujours accessible.

**Étape 1 — la table.** Une roue façon sélecteur iOS, dans l'ordre du plan de
salle. On la fait tourner ou on tape directement le numéro voulu.

**Étape 2 — les grillades.** Les pièces en deux colonnes. Un appui ouvre le
choix de la cuisson, quatre grandes touches de couleur ; l'appui sur la cuisson
ramène aussitôt à la liste des grillades, et on enchaîne. Chaque bouton porte
une pastille avec le nombre de pièces déjà commandées. Le récapitulatif s'écrit
en bas au fur et à mesure ; le `×` d'une ligne retire une pièce.

**Le poulet n'a pas de cuisson** : un appui l'ajoute directement, sans passer
par l'écran des couleurs.

**Envoyer** ramène à l'accueil, où la commande vient s'inscrire sous les
précédentes, chronomètre lancé.

## Statistiques

Accessibles par l'icône en haut à droite de l'accueil, sur quatre périodes
(aujourd'hui, 7 jours, 30 jours, tout) :

- nombre de commandes, de pièces, moyenne par commande et temps de service moyen ;
- répartition des cuissons les plus demandées, en part du total ;
- classement des grillades, de la plus servie à la moins servie ;
- activité par tranche horaire, qui fait ressortir les coups de feu ;
- classement des tables.

L'icône ☰ bascule sur une **vue tableau** : les mêmes chiffres sans dépendre des
couleurs, utile pour recopier ou imprimer.

## Où sont les données

Les commandes sont écrites dans **IndexedDB**, la base du navigateur. Elles
survivent donc à un plantage, à une fermeture brutale ou à un redémarrage de
l'appareil. Si IndexedDB est indisponible (navigation privée, réglage
restrictif), l'application bascule seule sur `localStorage` plutôt que
d'interrompre le service.

La commande **en cours de saisie** est enregistrée à chaque appui, séparément :
si l'écran se verrouille au milieu d'une prise, elle est proposée telle quelle
au redémarrage.

Les commandes servies sont conservées pour alimenter les statistiques, puis
purgées automatiquement au-delà d'un an (`RETENTION_JOURS`).

Tout est **local à l'appareil**. Deux tablettes ne partagent pas leurs
commandes — il faudrait pour cela un serveur, ce que l'application ne fait pas
aujourd'hui.

## Installation sur le téléphone ou la tablette

Ouvrir l'adresse du site, puis :

- **Android / Chrome** : menu ⋮ → « Installer l'application ».
- **iPhone / iPad, Safari** : bouton Partager → « Sur l'écran d'accueil ».

L'application s'ouvre en plein écran et fonctionne hors connexion. Quand une
nouvelle version est en ligne, un bandeau propose de recharger : rien n'est
jamais imposé en plein service.

## Mise en ligne

Le projet est un site statique construit par Vite ; il se déploie sur Vercel
sans configuration (framework détecté automatiquement, sortie dans `dist/`).

```bash
npm install
npm run dev       # développement, rechargement à chaud
npm run build     # production dans dist/
npm run preview   # vérifier le build en local
```

Sur Vercel : importer le dépôt, laisser les réglages proposés, déployer.

## Adapter la carte

Tout se règle dans `src/config.js`, sans toucher au reste :

```js
export const TABLES      = ['1','2','3', …];   // ordre de la roue
export const CUISSONS    = [ … ];              // libellés et couleurs
export const GRILLADES   = [ … ];              // la carte du grill
export const SEUIL_ORANGE = 8;                 // minutes avant le orange
export const SEUIL_ROUGE  = 15;                // minutes avant le rouge
export const RETENTION_JOURS = 365;            // durée de l'historique
```

Pour qu'une pièce saute l'écran des cuissons, lui ajouter `sansCuisson: true` —
c'est ce qui est fait pour le poulet.

Retirer une grillade de la carte ne casse pas l'historique : les commandes
passées qui la mentionnent restent comptées dans les statistiques.

**Les quatre couleurs de cuisson ne sont pas choisies au hasard.** Elles servent
aussi de marques dans les graphiques et ont été calées pour rester
distinguables par un daltonien — l'écart entre les deux plus proches est de
15,6 là où le seuil admis est 8. Si vous les modifiez, gardez cet écart en tête,
sans quoi la répartition des cuissons devient illisible pour une partie des
lecteurs.

## Tests

Les tests pilotent un vrai navigateur (Playwright) sur l'application construite,
en simulant un téléphone tactile : parcours complet de prise de commande, roue,
cumul des pièces identiques, cas du poulet, persistance après rechargement,
commande servie et son annulation, statistiques, vue tableau et bouton retour.

```bash
npm run build
npm test
```

`SHOTS=1 npm test` écrit en plus des captures des écrans dans `test/captures/`.
Si Chromium est déjà installé ailleurs : `CHROME_PATH=/chemin/vers/chrome npm test`.

## Organisation

```
index.html                coquille de la page
vite.config.js            build + génération du PWA (manifeste, service worker)
public/                   icônes
src/
  config.js               carte, plan de salle, cuissons, seuils
  db.js                   IndexedDB (+ secours localStorage) et brouillon
  App.jsx                 navigation, données, actions
  screens/
    Accueil.jsx           commandes en cours
    ChoixTable.jsx        étape 1 — la roue
    Saisie.jsx            étape 2 — grillades et cuissons
    Stats.jsx             statistiques et vue tableau
  components/
    Roue.jsx              le sélecteur de table
    Toast.jsx             messages et annulation
    MajPWA.jsx            proposition de mise à jour
  lib/
    temps.js              horloge partagée et formats de durée
    stats.js              agrégation des commandes
test/                     tests navigateur (+ serveur statique intégré)
```
