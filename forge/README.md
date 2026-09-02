# Forge — jeûne, poids & sport

Suivi personnel du jeûne intermittent, du poids et du sport : sessions de
padel avec les calories de la montre, circuits de renforcement adaptés au
temps disponible, échauffement padel guidé de 10 minutes, courbes jour par jour
superposables, et une couche de jeu (XP, niveaux, série, missions, badges)
pour donner envie de revenir tous les jours.

Application React installable sur le téléphone, **utilisable sans réseau**,
synchronisée sur Supabase quand le serveur est configuré — dans le même projet
que l'application du grill, sans rien recréer.

## Les écrans

**Accueil** — la journée d'un coup d'œil : la série de jours actifs (🔥), le
niveau et l'XP, le mot du jour, le jeûne en cours avec son chrono et sa phase,
les trois missions du jour, l'objectif de sessions de la semaine, et les
raccourcis vers la balance, le padel, la renfo et l'échauffement.

**Jeûne** — choix de l'objectif (14:10, 16:8, 18:6, 20:4, OMAD), lancement,
anneau de progression, chrono, et ce qui se passe dans le corps heure par heure
(digestion, glycémie, glycogène, brûlage des graisses, cétose, autophagie).
L'heure de début se corrige après coup si on a oublié de lancer. L'historique
garde chaque jeûne avec sa durée et son objectif atteint ou non.

**Poids** — saisie au dixième de kilo avec deux gros boutons ±, date
modifiable, liste des pesées avec l'écart à la précédente, objectif et chemin
restant.

**Sport** — la liste des sessions par jour, avec calories, durée, intensité,
résultat. Quatre entrées :

- **Padel** : début, durée (60 / 90 / 120 min ou libre), **calories affichées
  par la montre**, intensité de 1 à 5, victoire / défaite / entraînement, note.
- **Renfo** : six circuits (Full Body Blitz, Padel Power, Core Steel, HIIT
  Inferno, Haut du corps Titan, Jambes de fer). On indique le temps dont on
  dispose — de 5 à 60 minutes — et **le plan s'adapte** : nombre de tours,
  nombre d'exercices conservés, rythme travail / repos. Le lecteur enchaîne
  ensuite les étapes avec un gros compte à rebours, la consigne de chaque
  exercice, des bips aux changements, pause et passage d'étape, et empêche
  l'écran de s'éteindre. À la fin, on saisit les calories de la montre (ou on
  garde l'estimation).
- **Échauffement padel** : dix minutes en dix étapes, du trottinement aux
  sprints de réaction, jouées par le même lecteur.
- **Autre** : course, vélo, ce qu'on veut.

**Courbes** — poids, activité (kcal) et heures de jeûne, jour par jour, sur
7, 14, 30 ou 90 jours. Trois lectures : **Panneaux** (un graphique par
grandeur, axes alignés, curseur partagé), **Superposées** (chaque courbe
ramenée sur sa propre plage, 0 % = son minimum, 100 % = son maximum, pour voir
si le poids décroche quand l'activité et le jeûne montent), **Tableau**. Le
poids porte en plus sa moyenne glissante sur 7 jours. Chaque série s'active ou
se masque d'un appui ; la bulle affiche toujours les vraies valeurs.

**Profil** — niveau, série, badges (29, avec leur progression), réglages
(prénom, objectif de poids, jeûne par défaut, sessions par semaine, poids de
référence pour estimer les calories), export JSON, déconnexion.

## La couche de jeu

Tout est **recalculé à partir des entrées**, rien n'est stocké : deux appareils
ne peuvent donc jamais afficher des scores différents.

- **XP** — pesée +10 ; jeûne terminé +5 par heure, +50 si l'objectif est
  atteint ; padel +60, renfo +40 (+1 par minute), autre +30, échauffement +15 ;
  plus les calories divisées par 10. Chaque mission accomplie +20, les trois
  dans la journée +50 (« journée parfaite »).
- **Niveaux** — Recrue, Rookie, Combattant, Guerrier, Vétéran, Élite,
  Champion, Légende, Titan, Immortel. Le seuil du niveau n est 150 × n × (n − 1).
- **Série** — jours consécutifs « actifs » : une pesée, une session, ou au
  moins 12 h de jeûne rattachées à la journée. La flamme clignote quand la
  série du jour n'est pas encore assurée.
- **Missions du jour** — toujours « Monte sur la balance » et « Jeûne N h »,
  plus une mission tournante (session, 15 min de renfo, 300 kcal,
  échauffement, 30 min d'activité).
- **Badges** — jeûnes (12 h, 16 h, 20 h, 24 h, 10 et 50 jeûnes), séries (3, 7,
  14, 30, 100 jours), padel (1, 10, 25, 50), renfo (1, 10, 25), échauffements,
  calories cumulées, pesées, kilos perdus, journées parfaites.

Les barèmes sont dans `src/lib/gamification.js`, les circuits et exercices
dans `src/lib/circuits.js`, l'échauffement dans `src/lib/echauffement.js`.

## Où sont les données

Chaque appareil écrit d'abord dans **IndexedDB** (secours `localStorage`). Tout
fonctionne sans réseau. Quand Supabase est configuré, chaque entrée est
poussée dès que possible et les autres appareils la reçoivent en temps réel ;
en cas de conflit, la dernière écriture gagne, arbitrée sur un horodatage posé
par la base. Les suppressions sont logiques (`supprime`), pour qu'elles se
propagent aussi.

### Installer dans le projet Supabase du grill

L'application n'a besoin que d'une table, préfixée `forge_`, qui cohabite avec
`grill_commandes`. **Chaque ligne n'est visible que par le compte qui l'a
créée** : le compte du restaurant ne voit rien ici, et réciproquement — c'est
ce que vérifie `test/schema.test.sh` sur un vrai PostgreSQL.

1. Ouvrir le projet Supabase existant, **SQL Editor**, coller
   `supabase/schema.sql`, lancer.
2. **Authentication → Users → Add user** : créer votre compte, par exemple
   `moi@forge.local`, avec comme mot de passe le **code d'accès** que
   l'application demandera. Cocher la confirmation automatique de l'adresse.
3. Dans Vercel, importer ce dépôt en **nouveau projet** avec `forge` comme
   **Root Directory** (Settings → General), puis ajouter les variables :

   | Variable | Valeur |
   |---|---|
   | `VITE_SUPABASE_URL` | l'URL du projet Supabase (la même que pour le grill) |
   | `VITE_SUPABASE_ANON_KEY` | la clé publique `anon` (la même aussi) |
   | `VITE_SUPABASE_COMPTE` | l'adresse du compte créé à l'étape 2, si différente de `moi@forge.local` |

4. Déployer. Au premier lancement, l'application demande le code, puis
   mémorise la session.

Sans ces variables, tout reste sur l'appareil : c'est aussi le mode des tests
et du développement local.

## Installation sur le téléphone

Ouvrir l'adresse du site, puis **Android / Chrome** : menu ⋮ → « Installer
l'application » ; **iPhone / Safari** : Partager → « Sur l'écran d'accueil ».
L'application s'ouvre en plein écran, fonctionne hors connexion, et propose de
recharger quand une nouvelle version est en ligne.

## Développement

```bash
cd forge
npm install
npm run dev       # développement
npm run build     # production dans dist/
npm run icons     # régénère les PNG de l'icône depuis public/icon.svg
npm test          # tout : unitaires, navigateur, schéma
```

`npm test` enchaîne :

- `test/*.test.mjs` — les fonctions pures : arbitrage de synchronisation,
  séries jour par jour et heures de jeûne réparties sur les journées, XP /
  niveaux / série / missions / badges, adaptation des circuits au temps (le
  plan tient toujours dans le budget, plus de temps donne plus de travail),
  échauffement de dix minutes pile ;
- `test/app.test.cjs` — le parcours complet dans un navigateur mobile simulé
  (Playwright) : jeûne lancé, corrigé et terminé, pesée, session de padel,
  circuit adapté et joué dans le lecteur, échauffement, courbes dans les trois
  modes, gamification, persistance, bouton retour ;
- `test/schema.test.sh` — le schéma sur un vrai PostgreSQL et l'isolation
  entre comptes (ignoré si PostgreSQL est absent).

`SHOTS=1 npm test` écrit des captures dans `test/captures/`. Si Chromium est
ailleurs : `CHROME_PATH=/chemin/vers/chrome npm test`.

## Organisation

```
index.html                coquille de la page
vite.config.js            build + PWA (manifeste, service worker)
public/                   icônes, polices (Barlow, licence OFL)
supabase/schema.sql       à coller dans Supabase
supabase/vider.sql        remise à zéro
src/
  supabase.js             connexion et code d'accès
  db.js                   IndexedDB (+ secours localStorage)
  sync.js                 synchronisation locale d'abord
  App.jsx                 navigation, données, actions
  screens/
    Accueil.jsx           la journée
    Jeune.jsx             chrono, phases, historique
    Poids.jsx             pesées
    Sport.jsx             sessions
    FormSession.jsx       saisie padel / autre
    Renfo.jsx             circuits et temps disponible
    Lecteur.jsx           déroulé guidé (circuits, échauffement)
    Echauffement.jsx      programme padel 10 min
    Courbes.jsx           panneaux, superposition, tableau
    Profil.jsx            niveau, badges, réglages
    Connexion.jsx         code d'accès
  components/
    Graphique.jsx         courbes SVG avec curseur et bulle
    Anneau.jsx            anneau de progression
    Nav.jsx, Feuille.jsx, Toast.jsx, MajPWA.jsx
  lib/
    jeune.js              objectifs, phases, heures par journée
    series.js             séries jour par jour, normalisation, bornes
    gamification.js       XP, niveaux, série, missions, badges
    circuits.js           exercices, circuits, adaptation au temps
    echauffement.js       les dix étapes
    fusion.js             arbitrage local / serveur
    temps.js              horloge, formats, clés de jour
    son.js                bips du lecteur
test/                     tests (+ serveur statique, générateur d'icônes)
```
