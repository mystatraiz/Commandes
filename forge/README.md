# Gros Sac — la course au poids perdu

Le carnet est devenu une arène. On note toujours son poids, ses jeûnes et ses
sessions, mais **quelqu'un regarde** : c'est le seul ressort d'assiduité qui
tienne dans la durée. Un défi, une période, un code à balancer dans le groupe,
et le classement fait le reste.

Application React installable sur téléphone, **utilisable sans réseau**,
adossée à Supabase pour les comptes et les défis.

## Les défis

Un défi porte un **nom**, une **période datée**, une **mesure** et un **code
d'invitation de six lettres**. On le crée, on envoie le code, les autres
entrent le code, choisissent leur pseudo et se pèsent. Trois âges, trois
écrans : la salle d'attente, l'arène, le palmarès.

**La mesure est le pourcentage du poids de départ**, réglable en kilos par
celui qui crée. Sans ça, celui qui part à 110 kg écrase mécaniquement celui qui
part à 75, et le défi meurt au bout d'une semaine faute d'enjeu.

Le **poids de départ** est la dernière pesée d'avant le début du défi. Faute
de pesée antérieure — on rejoint sans s'être pesé — c'est la première pesée de
la période qui fait foi, et le départ est signalé comme estimé : inventer un
poids d'avant fausserait le classement de tout le monde.

Les **ex æquo partagent leur rang** et le suivant saute (1, 2, 2, 4). Qui ne
s'est pas encore pesé ferme la marche **sans rang** plutôt que d'être compté
dernier : il n'a pas encore joué.

Dans le fil, c'est le **kilo** qui passe en gros — « −0,8 kg » se commente,
« −0,8 % » ne dit rien à personne — avec le pourcentage juste dessous, puisque
c'est lui qui classe.

Le **gage** est une phrase libre — « le dernier paie la tournée » — affichée en
grand sur le palmarès. L'application enregistre une phrase, **jamais de
l'argent** : aucun encaissement, aucune cagnotte, rien à déclarer.

### Le fil

Chaque pesée publiée s'inscrit dans le fil du défi, et c'est de là que
viennent les courbes : un point par pesée, une couleur par personne. Sous
chacune, deux phrases sont proposées aux autres — **une pour encourager, une
pour charrier** — envoyées en un appui, plus les réactions et les
commentaires libres.

Personne n'ouvre une application pour regarder une colonne de pourcentages.
Ce qui fait revenir, c'est ce que les copains ont répondu.

La banque compte **209 vannes positives et 221 négatives** (`src/lib/chambrage.js`),
dans un registre de vestiaire : la moquerie porte sur l'effort, le frigo et le
classement, jamais sur ce qu'on ne choisit pas. Le tirage est **déterministe** à
partir de l'identifiant de la pesée : tout le monde se voit proposer la même
paire, sinon deux personnes se répondraient sur des phrases différentes. Le
bouton `↻` en propose une autre.

Une pesée par personne et par jour : se repeser corrige la ligne du jour au
lieu d'inonder le fil. On efface sa propre vanne, jamais celle d'un autre —
pas même quand on a créé le défi.

### Ce que les autres voient de toi

Par défaut, chacun montre **son pourcentage et ses kilos** : entre potes, se
cacher enlève l'essentiel du sel. Le réglage reste, défi par défi, pour qui
préfère **son pourcentage seul** ou **son rang seul**.

**Ton poids absolu ne sort jamais**, quel que soit le réglage. Ce qui circule
est une progression. Qui choisit « rang seul » n'a donc **pas de courbe** — on
ne dessine pas ce qu'on a accepté de ne pas savoir ; il est nommé sous le
graphique plutôt que passé sous silence. Et ce n'est pas une politesse d'affichage : les pesées
restent dans une table que seul ton compte peut lire, la table des
participations n'est lisible que par son propriétaire, et le classement ne
s'obtient que par la fonction `gs_classement()`, qui masque ce que chacun a
choisi de taire. Interroger la base directement ne donne rien de plus que
l'écran. C'est vérifié sur un vrai PostgreSQL par `test/schema.test.sh`.

Une limite à connaître : c'est ton téléphone qui calcule la progression et la
publie. Quelqu'un de déterminé pourrait donc publier un faux chiffre. Entre
potes, c'est un problème social, pas technique — et c'est le prix pour que
personne n'hésite à rejoindre.

### Voir avant de se lancer

Une arène vide ne ressemble à rien : au premier lancement, ou tant que les
copains n'ont pas rejoint, il n'y a ni courbe ni fil à regarder. L'onglet Défis
propose donc **un défi d'exemple** — cinq joueurs inventés, dix-huit jours de
pesées — qui montre le rendu en vrai, et fonctionne même sans compte ni
Supabase. Il s'annonce comme tel, et aucun geste n'y enregistre quoi que ce
soit.

## Le reste, inchangé

**Jeûne** — objectifs 14:10 à OMAD, anneau, chrono, phases du corps heure par
heure, correction de l'heure de début, et **correction d'un jeûne déjà
terminé** : début et fin repris, raccourcis pour reculer la fin, durée
recalculée sous les yeux. Un jeûne qu'on oublie d'arrêter ne pollue plus les
courbes.

**Poids** — saisie au dixième, écarts, objectif, chemin restant.

**Sport** — padel avec les calories de la montre, autres sports, et six
**circuits de renfo adaptés au temps disponible** (5 à 60 min) : le nombre de
tours, les exercices conservés et le rythme travail/repos se recalculent selon
les minutes annoncées. Un lecteur guidé enchaîne les étapes avec compte à
rebours, consignes et bips, écran maintenu allumé.

**Échauffement padel** — dix minutes en dix étapes, joué par le même lecteur.

**Courbes** — poids, activité et heures de jeûne, sur 7 à 90 jours. Panneaux
alignés à curseur partagé, superposition indexée (chaque courbe ramenée sur sa
propre plage, pour voir si le poids décroche quand l'activité monte, sans le
piège du double axe), ou tableau.

**Progression** — XP, niveaux, série de jours, missions quotidiennes, badges.
Tout est recalculé depuis les entrées, donc deux appareils ne peuvent pas
afficher des scores différents.

## Où sont les données

Chaque appareil écrit d'abord dans **IndexedDB** (secours `localStorage`), et
tout fonctionne sans réseau. Supabase s'ajoute par-dessus : les entrées
personnelles montent dès que possible, les participations circulent en temps
réel. En cas de conflit, la dernière écriture gagne, arbitrée sur un
horodatage posé par la base et non par le téléphone.

### Installation

Une seule passe de SQL, préfixée `gs_`, qui cohabite avec le projet du grill.

1. Supabase → **SQL Editor** → coller `supabase/schema.sql` → Run. Le script
   est rejouable, et reprend une installation « Forge » antérieure s'il y en a
   une.
2. **Authentication → Providers** : activer Email. Chaque participant crée son
   compte depuis l'application.
3. Dans Vercel, ajouter `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
   (Project Settings → API dans Supabase), avec le préfixe `VITE_`, qui est
   voulu : l'application est un site statique, la clé `anon` est publique par
   conception et n'autorise rien par elle-même. Ce sont les règles d'accès en
   base qui protègent les données.

Sans ces variables, tout reste sur l'appareil, sans comptes ni défis.

## Développement

```bash
cd forge
npm install
npm run dev       # développement
npm run build     # production dans dist/
npm run icons     # régénère les PNG depuis public/icon.svg
npm test          # unitaires, navigateur, schéma
```

`npm test` enchaîne :

- `test/*.test.mjs` — les fonctions pures : arbitrage de synchronisation,
  séries jour par jour, XP et badges, adaptation des circuits au temps, et
  **les défis** (périodes, choix du poids de départ, classement avec ex æquo,
  et le fait que le poids absolu ne figure dans rien de ce qui est publié) ;
- `test/app.test.cjs` — le parcours complet dans un navigateur mobile simulé ;
- `test/schema.test.sh` — le schéma sur un vrai PostgreSQL avec **quatre
  comptes** : les pesées restent privées, un défi n'existe pas pour qui n'y
  participe pas, « mon rang seul » est tenu par la base et non par l'écran, on
  ne contourne pas l'affichage en lisant la table, et le fil n'est lisible
  qu'entre participants — chacun n'effaçant que ses propres vannes.

`SHOTS=1 npm test` écrit des captures dans `test/captures/`. Si Chromium est
ailleurs : `CHROME_PATH=/chemin/vers/chrome npm test`.

## Organisation

Le dossier s'appelle encore `forge/` : le renommer obligerait à reprendre le
réglage **Root Directory** du projet Vercel, pour rien.

```
supabase/schema.sql       comptes, défis, classement, règles d'accès
src/
  supabase.js             comptes, profil
  defis.js                les défis côté réseau (code, classement, fil)
  db.js                   IndexedDB (+ secours localStorage)
  sync.js                 synchronisation locale d'abord
  App.jsx                 navigation, données, actions
  screens/                Accueil, Defis, CreerDefi, RejoindreDefi, Arene,
                          Jeune, Poids, Sport, FormSession, Renfo, Lecteur,
                          Echauffement, Courbes, Profil, Connexion
  components/             Graphique, CourbesDefi, Fil, Anneau, Nav, Feuille,
                          Toast, MajPWA
  lib/
    defis.js              périodes, progrès, classement — le cœur du jeu
    chambrage.js          430 vannes et leur tirage déterministe
    demo.js               le défi d'exemple, entièrement inventé
    jeune.js              objectifs, phases, heures par journée
    series.js             séries jour par jour, normalisation
    gamification.js       XP, niveaux, série, missions, badges
    circuits.js           exercices et adaptation au temps
    echauffement.js       les dix étapes
    fusion.js             arbitrage local / serveur
    temps.js              horloge, formats, clés de jour
    son.js                bips du lecteur
test/                     tests (+ serveur statique, générateur d'icônes)
```

## Reprendre des données déjà saisies

Rien à faire : les entrées écrites avant la création du compte portent le
marqueur « pas encore synchronisée » et montent au premier échange, rattachées
au compte qui vient de se connecter. Les pesées passées comptent donc dès le
premier défi.

## Ce qui reste à faire

- **Test d'intégration à deux navigateurs** contre un faux serveur Supabase,
  comme celui du grill : deux joueurs, un code, un classement qui bouge. Pour
  l'instant, le serveur est couvert par le test de schéma et le client par ses
  tests unitaires, mais le trajet complet ne l'est pas.
- **Courbes superposées des participants** dans l'arène, pour voir qui décroche
  et quand.
- **Défis sport et jeûne**, quand celui du poids aura fait ses preuves : le
  moteur est prévu pour, seule la mesure change.
