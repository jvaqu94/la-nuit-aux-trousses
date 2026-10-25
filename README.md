# La Nuit aux Trousses

**La Nuit aux Trousses** est un shoot’em up vertical sur le thème d’Halloween. Aux commandes de son balai, une sorcière doit traverser cinq univers, survivre à 25 vagues et vaincre cinq gardiens avant l’aube.

Le jeu fonctionne dans le navigateur, y compris hors ligne, sans compte ni installation. Il utilise uniquement HTML, CSS et JavaScript natifs : Canvas 2D, illustrations SVG, Web Audio et stockage local. Aucune bibliothèque, police, image ou musique distante n’est nécessaire pendant le jeu.

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Commandes](#commandes)
- [Modes de jeu](#modes-de-jeu)
- [Contenu et mécaniques](#contenu-et-mécaniques)
- [Progression et sauvegardes](#progression-et-sauvegardes)
- [Affichage, son et accessibilité](#affichage-son-et-accessibilité)
- [Structure du projet](#structure-du-projet)
- [Tests](#tests)
- [Générer les versions distribuables](#générer-les-versions-distribuables)
- [Notes techniques](#notes-techniques)

## Démarrage rapide

### Jouer hors ligne

Ouvrir **`La-Nuit-aux-Trousses.html`** dans un navigateur récent.

Cette version autonome regroupe tout le code et toutes les ressources dans un seul fichier. Elle ne demande ni Python, ni serveur, ni connexion réseau.

> Le stockage des pages ouvertes avec `file://` dépend du navigateur. Pour une sauvegarde locale plus fiable, utiliser le serveur local ci-dessous et exporter régulièrement sa progression.

### Lancer un serveur local

**Prérequis :** Python 3.9 ou supérieur, avec les données de fuseaux horaires du système.

À la racine du projet :

```bash
python server.py
```

Puis ouvrir <http://localhost:3000>.

Le serveur écoute sur toutes les interfaces. Pour utiliser un autre port :

```bash
PORT=8080 python server.py
```

Aucune dépendance Python externe n’est nécessaire pour lancer le jeu. L’interface actuelle fonctionne sans compte et n’appelle pas les anciennes API de ligue.

## Commandes

Le tir principal est **automatique**.

| Action | Clavier | Souris / tactile | Manette compatible Gamepad API |
|---|---|---|---|
| Se déplacer | Flèches, ZQSD ou WASD | Déplacer le pointeur ou glisser sur le terrain | Stick gauche |
| Mouvement de précision | Maj | — | Gâchette |
| Esquive | Espace | Bouton **Esquive** | A / bouton 0 |
| Sort spécial | F | Bouton du sort | X / bouton 2 |
| Pause | P ou Échap | Bouton **Pause** | Start |

- La précision ralentit le déplacement et affiche la zone de collision de la sorcière.
- L’esquive et le sort spécial possèdent chacun un temps de recharge.
- Les touches principales peuvent être reconfigurées dans **Réglages**.
- Le son est désactivé par défaut et s’active avec le bouton **Son**.

## Modes de jeu

| Mode | Règles principales |
|---|---|
| **Aventure libre** | Vols illimités, difficulté réglable, progression et records personnels. |
| **Défi score** | Trois essais par jour, en difficulté **Nuit noire**. Seule l’amélioration du meilleur score du jour augmente le cumul local. |
| **Défi primes** | Un essai séparé par jour et trois objectifs à prime unique. Le score brut de cet essai ne constitue pas un quatrième score classé. |
| **Laboratoire** | Entraînement libre avec les sorts, balais, compagnons, variantes et charges de boss. Ne crédite ni score, ni XP, ni déblocage et ne consomme aucun essai quotidien. |

Les essais et objectifs quotidiens sont renouvelés à minuit, heure d’**Europe/Paris**. Leur comptage est local : il ne s’agit ni d’un système compétitif sécurisé ni d’un mécanisme anti-triche.

Les défis imposent l’équipement de base afin que l’Arsenal débloqué dans l’aventure ne donne pas d’avantage permanent.

## Contenu et mécaniques

### Campagne

| Univers | Gardien |
|---|---|
| La forêt des murmures | Jack, le roi creux |
| Le cimetière oublié | Le fossoyeur éternel |
| Le château des vampires | La comtesse de minuit |
| Le marais des sorcières | La tisseuse des marais |
| La fête des ombres | Le dévoreur de lanternes |

Chaque univers comprend cinq vagues, puis un gardien en trois phases. La difficulté **Clair de lune**, **Nuit noire** ou **Cauchemar** peut être choisie pour l’aventure libre.

La campagne comprend notamment :

- des formations de créatures, des élites et des petits groupes coopératifs ;
- des barrières, des passages, des rochers et des obstacles destructibles ;
- des charges de boss propres à chaque gardien ;
- des séquences de terrain propres aux cinq univers ;
- **le Veilleur**, un chasseur récurrent qui intervient pendant les quatrièmes vagues ;
- une scène de victoire à l’aube après le dernier gardien.

Les transitions utilisent des fondus sans interrompre le combat : les ennemis, projectiles et objets déjà présents ne sont pas supprimés arbitrairement.

### Arsenal et reliques

Le menu **Préparer mon vol** permet de choisir :

- un **sort actif**, déclenché manuellement ;
- un **balai**, qui modifie le pilotage ou l’esquive ;
- un **compagnon de combat**, avec ses avantages et ses contreparties.

Ces éléments et leurs variantes se débloquent par objectifs cumulatifs. Les choix sont conservés et figés pour le vol en cours.

Pendant une partie, les reliques ramassées renforcent temporairement l’armement : cadence, projectiles, poison, missiles, familiers, tirs traversants ou rayon. Elles ne remplacent pas le sort actif. La plupart de ces améliorations se déchargent au changement d’univers.

Les bonbons apportent de l’XP, des points ou un bouclier. Des cœurs peuvent restaurer une vie. Les coffres scellés doivent être dégagés de leurs rochers puis ouverts avant de récupérer leur butin.

### Score et Grimoire

Le **score** et l’**XP** sont deux progressions distinctes :

- le score dépend notamment des éliminations, des combos, des frôlements et des objectifs de défi ;
- l’XP alimente les niveaux et la **Collection** du Grimoire ;
- les apparences de la Collection sont cosmétiques ;
- les capacités réelles de l’Arsenal se débloquent séparément, par exploits.

Le Grimoire contient également les contrats quotidiens, les exploits, les records, le bilan des vols et le journal local.

### Reconstitution du coup fatal

Après une défaite, **Revoir le coup fatal** permet de rejouer une reconstitution des cinq dernières secondes disponibles avant le choc, avec pause, ralenti et curseur temporel.

Cette fonction n’enregistre ni vidéo ni son. Elle ne modifie ni la partie terminée, ni les scores, ni les sauvegardes.

## Progression et sauvegardes

La progression est enregistrée dans le **`localStorage` du navigateur**, sans compte ni synchronisation entre appareils.

- Un point de reprise est enregistré au début des vagues.
- Les records sont séparés par difficulté et par date pour les défis.
- La reprise d’un défi existant ne consomme pas un nouvel essai.
- Le Laboratoire préserve la progression et le point de reprise du vol en cours.
- Effacer les données du site ou du navigateur peut effacer définitivement la progression locale.

Le menu **Sauvegarde**, également accessible depuis les réglages, permet d’exporter un fichier JSON contenant notamment la progression, les records, les réglages et le point de reprise.

> **Avant de changer de navigateur ou d’appareil, exporter sa sauvegarde.** L’import remplace les données actuelles au lieu de les fusionner. Les fichiers sont validés avant écriture, limités à 2 Mo et le dernier import peut être annulé.

## Affichage, son et accessibilité

- Terrain au format 8:9, adapté à la fenêtre et aux changements d’orientation.
- Interface dédiée sur mobile, avec panneau d’informations séparé et mise en pause.
- Mode plein écran lorsque le navigateur l’autorise.
- Réglages de volume, musique évolutive et effets sonores synthétisés.
- Options de réduction des effets, flashs, particules et secousses.
- Contraste renforcé des projectiles ennemis.
- Pause automatique lorsque la fenêtre perd le focus, activée par défaut.

Les options de confort réduisent certains effets visuels, mais ne constituent pas une garantie médicale contre les risques de photosensibilité.

## Structure du projet

| Fichier ou dossier | Rôle |
|---|---|
| `index.html` | Page d’entrée et chargement des modules JavaScript. |
| `game.js` | Boucle de jeu, campagne, ennemis, boss, collisions, score et interface principale. |
| `characters.js` | Illustrations SVG des personnages et ressources visuelles intégrées. |
| `journey.js` | Grimoire, XP, contrats, collection, bilans et export/import. |
| `online.js` | Défis et cumul locaux, sans compte dans l’interface actuelle. |
| `arsenal.js` | Sorts, balais, compagnons et équipement. |
| `adventure.js` | Exploits, variantes, Laboratoire et coffres scellés. |
| `encounters.js` | Formations, séquences de terrain, statistiques de vol et confort. |
| `night-hazards.js` | Obstacles, charges des gardiens et bonbons. |
| `flow.js` | Fondus et continuité des transitions. |
| `surprise.js` | Apparitions soudaines et présentation de la défaite. |
| `coven.js` | Coopération entre créatures et scène de victoire. |
| `nemesis.js` | Rencontres avec le Veilleur. |
| `collision-replay.js` | Reconstitution locale du coup fatal. |
| `collectible-art.js` | Illustrations des bonus et objets ramassables. |
| `viewport.js` | Adaptation du terrain à la fenêtre. |
| `server.py` | Serveur HTTP local et ancien backend SQLite de ligue. |
| `scenery/` | Images sources des décors. |
| `tests/` | Tests Node, Python et Playwright, ainsi que leurs captures. |
| `tools/package.py` | Génération du HTML autonome et des archives. |
| `La-Nuit-aux-Trousses.html` | Version autonome générée, prête à jouer. |
| `La-Nuit-aux-Trousses.zip` | Archive distribuable générée. |

Les fichiers `minuit-autonome.html`, `Minuit-edition-nocturne.zip` et `minuit-v1.html` sont conservés pour compatibilité ou historique. Les scripts `patch_*.py`, le fragment `bonus_art_fragment.txt` et `online-accounts-backup.js` ne sont pas nécessaires pour jouer.

Modifier les fichiers sources plutôt que le HTML autonome, qui est régénéré par l’outil de packaging.

## Tests

### Prérequis

Les tests `.cjs` demandent **Node.js**. Les tests navigateur demandent **Python**, **Playwright** et **Chromium** :

```bash
python -m pip install playwright
python -m playwright install chromium
```

La plupart des tests Playwright attendent le jeu sur le port 3000. Dans un premier terminal :

```bash
python server.py
```

Les tests Playwright utilisent des navigateurs isolés et ne partagent pas la progression du joueur.

### Tests Node

À exécuter depuis la racine du projet :

```bash
node tests/test_highscore.cjs
node tests/test_loot.cjs
node tests/test_flight.cjs
node tests/test_arcade.cjs
node tests/balance-node.cjs
```

### Tests navigateur principaux

```bash
python tests/test_journey_browser.py
python tests/test_no_account_browser.py
python tests/test_arsenal_browser.py
python tests/test_adventure.py
python tests/test_encounters.py
python tests/test_flow.py
python tests/test_surprise_ui.py
python tests/test_vertical_drift.py
python tests/test_coven_dawn.py
python tests/test_rival_replay.py
python tests/test_sealed_chest.py
python tests/test_bonus_art.py
python tests/test_collectibles_art.py
python tests/test_charges_sweets.py
python tests/test_viewport.py
```

La campagne technique complète se vérifie avec :

```bash
python tests/test_journey_campaign.py
```

Cette campagne automatique utilise l’invulnérabilité pour contrôler les 25 vagues, les cinq gardiens et les événements. Elle valide l’intégration technique, **pas l’équilibrage ressenti par un joueur**.

Les tests `tests/test_league_server.py` et `tests/test_league_browser.py` concernent l’ancienne ligue avec comptes et utilisent des données temporaires. Ils sont distincts du parcours local actuel.

## Générer les versions distribuables

Après une modification des sources ou de ce README :

```bash
python tools/package.py
```

Le script régénère :

- `La-Nuit-aux-Trousses.html` ;
- son alias historique `minuit-autonome.html` ;
- `La-Nuit-aux-Trousses.zip` ;
- son alias historique `Minuit-edition-nocturne.zip`.

Les archives sont construites à partir d’une liste explicite de fichiers. Les bases SQLite, sauvegardes personnelles et captures de test n’y sont pas incluses.

## Notes techniques

- **Aucun build ni framework** n’est nécessaire pour jouer ou développer.
- Le jeu n’a pas de dépendance JavaScript ou Python externe à l’exécution.
- Les ressources de la version autonome sont intégrées au fichier HTML.
- L’interface actuelle ne propose ni inscription, ni connexion, ni classement partagé.
- Le serveur conserve d’anciennes routes de ligue et une base SQLite pour des raisons historiques ; elles ne sont pas utilisées par le parcours local actuel.
- Le stockage local est modifiable par l’utilisateur et ne fournit aucune protection anti-triche.
- La compatibilité manette dépend du navigateur et du mapping du matériel.

Le projet s’appelait auparavant **Minuit — La chasse maudite**. Les clés `minuit-*`, le format `MinuitProgression` et plusieurs noms de fichiers sont volontairement conservés afin de préserver les sauvegardes et les exports existants.
