# Grill — Commandes

Prise de commandes au grill : on saisit table par table, l'application se
souvient de ce qui est en cours, depuis combien de temps, et garde l'historique
pour les statistiques du service.

Application React installable sur téléphone ou tablette, **utilisable sans
réseau**. Plusieurs téléphones peuvent partager les mêmes commandes en temps
réel, sans jamais dépendre du réseau pour continuer à travailler.

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

Chaque téléphone écrit d'abord dans **IndexedDB**, la base du navigateur. Les
commandes survivent donc à un plantage, à une fermeture brutale ou à un
redémarrage. Si IndexedDB est indisponible (navigation privée, réglage
restrictif), l'application bascule seule sur `localStorage` plutôt que
d'interrompre le service.

La commande **en cours de saisie** est enregistrée à chaque appui, séparément :
si l'écran se verrouille au milieu d'une prise, elle est proposée telle quelle
au redémarrage.

Les commandes servies restent en mémoire pour alimenter les statistiques, puis
sont purgées localement au-delà d'un an (`RETENTION_JOURS`).

## Partage entre plusieurs téléphones

Quand le serveur est configuré (voir plus bas), les commandes sont partagées :
une prise sur un téléphone apparaît sur tous les autres en moins d'une seconde,
et une commande marquée servie disparaît partout.

Le principe est **locale d'abord**. Le serveur ne remplace pas la base du
téléphone, il s'ajoute par-dessus : chaque appareil continue d'écrire chez lui
et reste pleinement utilisable seul. Si le wifi tombe en plein coup de feu, on
continue de prendre des commandes ; l'accueil affiche alors « en attente », et
tout part au retour du réseau. C'est le point important : une panne de réseau
ne doit jamais empêcher de travailler.

Les identifiants de commande sont générés sur l'appareil, donc deux téléphones
qui saisissent hors ligne en même temps ne peuvent pas entrer en collision. Si
la même commande est modifiée des deux côtés, la dernière écriture l'emporte,
arbitrée sur `maj_a` — un horodatage posé par la base et non par le téléphone,
pour qu'une horloge déréglée sur un appareil ne fausse pas l'arbitrage.

Un téléphone qui rejoint récupère les 5 000 commandes les plus récemment
modifiées, puis se met à jour de façon incrémentale.

L'indicateur en haut de l'accueil dit où on en est : **Partagé** quand tout
circule, **Hors ligne** quand le serveur est injoignable, **N en attente**
quand des commandes prises hors ligne n'ont pas encore été transmises.

### Mettre en place le serveur

L'offre gratuite de Supabase donne droit à **deux projets actifs, tous
comptes et organisations confondus** — créer une nouvelle organisation ne
débloque rien. Ce n'est pas un obstacle : l'application n'a besoin que d'une
table, et **elle peut s'installer dans un projet que vous utilisez déjà**,
sans le perturber.

Tout est prévu pour cette cohabitation : la table s'appelle
`grill_commandes` et la fonction interne est préfixée de la même façon, donc
aucune collision avec vos objets existants ; le script ne modifie rien de ce
qui s'y trouve déjà. Le volume est négligeable — une commande pèse environ
200 octets, soit quelques mégaoctets par an, face aux 500 Mo de l'offre
gratuite.

Le point qui compte vraiment est l'accès : la règle n'autorise pas « tout
compte connecté au projet », mais uniquement l'adresse du compte du
restaurant. Les utilisateurs de l'autre application hébergée sur le même
projet ne peuvent donc ni lire ni modifier vos commandes.

1. Ouvrir un de vos projets Supabase existants (ou en créer un si vous avez
   un emplacement libre).
2. Dans **SQL Editor**, coller le contenu de `supabase/schema.sql` et lancer.
   Cela crée la table, les index, la règle d'accès et la diffusion en temps
   réel.
3. Ouvrir **Authentication → Users → Add user** et créer le compte partagé :
   l'adresse `service@grill.local` et, comme mot de passe, le **code d'accès**
   que vous distribuerez à l'équipe. Cochez la confirmation automatique de
   l'adresse si elle est proposée.
4. Dans **Project Settings → API**, relever l'URL du projet et la clé
   publique (`anon`).
5. Dans Vercel, **Settings → Environment Variables**, ajouter :

   | Variable | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | l'URL du projet Supabase |
   | `VITE_SUPABASE_ANON_KEY` | la clé publique `anon` |

6. Redéployer. L'application demande alors le code au premier lancement de
   chaque téléphone, puis mémorise la session.

La clé `anon` est faite pour être publique : elle ne donne accès à rien sans
le code, puisque la règle d'accès ne reconnaît que le compte du restaurant.

Si vous préférez une autre adresse que `service@grill.local`, changez-la aux
trois endroits : dans le compte Supabase, dans la règle d'accès de
`supabase/schema.sql`, et via la variable `VITE_SUPABASE_COMPTE`.

**Sans ces deux variables, rien ne change** : l'application fonctionne comme
avant, chaque téléphone gardant ses commandes pour lui. C'est aussi ce qui
permet de la faire tourner en local sans serveur.

Pour changer le code d'accès, il suffit de modifier le mot de passe de ce
compte dans Supabase ; les téléphones déjà connectés le restent jusqu'à
déconnexion.

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

`npm test` enchaîne trois suites :

- `test/fusion.test.cjs` — l'arbitrage entre la version locale et celle du
  serveur, testé comme une fonction pure ;
- `test/app.test.cjs` — le parcours complet dans un navigateur, en mode local ;
- `test/partage.test.cjs` — **deux navigateurs jouant deux téléphones** face à
  un faux serveur Supabase (`test/faux-supabase.cjs`) : code d'accès,
  propagation d'une commande d'un appareil à l'autre, coupure réseau, saisie
  hors ligne et rattrapage au retour, reprise par un appareil qui rejoint.

Le faux serveur ne simule volontairement pas le temps réel : cela vérifie du
même coup que la synchronisation périodique suffit quand le websocket ne passe
pas.

`SHOTS=1 npm test` écrit en plus des captures des écrans dans `test/captures/`.
Si Chromium est déjà installé ailleurs : `CHROME_PATH=/chemin/vers/chrome npm test`.

## Organisation

```
index.html                coquille de la page
vite.config.js            build + génération du PWA (manifeste, service worker)
public/                   icônes
supabase/schema.sql       à coller dans Supabase pour créer la base partagée
src/
  config.js               carte, plan de salle, cuissons, seuils
  db.js                   IndexedDB (+ secours localStorage) et brouillon
  supabase.js             connexion au serveur et code d'accès
  sync.js                 synchronisation entre téléphones
  App.jsx                 navigation, données, actions
  screens/
    Accueil.jsx           commandes en cours
    ChoixTable.jsx        étape 1 — la roue
    Saisie.jsx            étape 2 — grillades et cuissons
    Stats.jsx             statistiques et vue tableau
    Connexion.jsx         saisie du code d'accès
  components/
    Roue.jsx              le sélecteur de table
    Toast.jsx             messages et annulation
    MajPWA.jsx            proposition de mise à jour
  lib/
    temps.js              horloge partagée et formats de durée
    stats.js              agrégation des commandes
    fusion.js             arbitrage local / serveur (fonction pure)
test/                     tests navigateur (+ serveur statique intégré)
```
