# La Nuit aux Trousses

**La Nuit aux Trousses** est un shoot’em up vertical sur le thème d’Halloween. Aux commandes de son balai, une sorcière doit traverser cinq univers, survivre à 25 vagues et vaincre cinq gardiens avant l’aube.

Le jeu fonctionne dans le navigateur, y compris hors ligne, sans compte ni installation. Il utilise uniquement HTML, CSS et JavaScript natifs : Canvas 2D, illustrations SVG, Web Audio et stockage local. Aucune bibliothèque, police, image ou musique distante n’est nécessaire pendant le jeu.

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Commandes](#commandes)
- [Modes de jeu](#modes-de-jeu)
- [Contenu et mécaniques](#contenu-et-mécaniques)
- [Progression et sauvegardes](#progression-et-sauvegardes)
- [Supabase : cloud, teams et avis](#supabase--cloud-teams-et-avis)
- [Affichage et son](#affichage-et-son)
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
| Se déplacer | Flèches, ZQSD ou WASD | Pointer à la souris ; glisser sur le terrain au doigt | Stick gauche |
| Mouvement de précision | Maj | — | Gâchette |
| Esquive | Espace | Bouton **Esquive** | A / bouton 0 |
| Sort spécial | F | Bouton **Sort spécial** | X / bouton 2 |
| Pause | P ou Échap | Bouton **Pause** | Start |

- La précision ralentit le déplacement et affiche la zone de collision de la sorcière.
- L’esquive et le sort spécial possèdent chacun un temps de recharge. Avec le balai initial, l’esquive protège pendant **0,45 s** et se recharge en **4 s** : il faut l’utiliser au contact du danger, pas trop tôt.
- Un nouveau profil termine d’abord **dix exercices réels et obligatoires** : pilotage, esquive sur projectile, évolutions d’esquive avec Comète et Aurore, sort spécial, comparaison des trois évolutions d’attaque, attaque surprise, destruction d’une caisse, relique, catalogue des bonus et bouclier. Il n’y a ni bouton **Passer** ou **Quitter**, ni score ou récompense persistante pendant ce premier parcours. Les profils déjà actifs sont migrés sans ce blocage.
- Après validation, **S’entraîner** permet de rejouer librement les dix exercices dans le laboratoire isolé. Comète laisse automatiquement la place à Aurore après son esquive. Dans l’exercice de comparaison, Espace déclenche successivement Onde, Marée et Lance ; en vol normal, Espace reste l’esquive et F le sort spécial. Le catalogue illustré présente **10 reliques et 7 bonus immédiats ou bonbons** avec leurs effets réels. Le projectile d’apprentissage est entouré et le bouton s’illumine au bon moment. Les consignes restent affichées jusqu’à validation ; elles ne réapparaissent pas automatiquement pendant les vols normaux.
- Sur tactile, le glisser est relatif : poser le doigt ne téléporte pas la sorcière. Une pastille indique le point de départ et le mouvement. Un second doigt peut déclencher **Sort spécial** ou **Esquive** sans interrompre le pilotage. Le bouton **Esquive** rappelle sa double utilité : **bond + protection**. Une traînée lumineuse, des silhouettes résiduelles et un anneau rendent le déplacement et la courte protection visibles, sans changer leurs durées ni les collisions.
- Les touches principales peuvent être reconfigurées dans **Réglages**.
- Le thème de l’accueil est préparé et lancé dès l’ouverture lorsque le navigateur l’autorise. Si l’autoplay est bloqué, le premier geste sur la page démarre la musique déjà préchargée. Le bouton **Thème de minuit** de l’accueil permet de couper ou de réactiver le son ; ce choix reste enregistré.
- Sur smartphone, l’accueil occupe toute la zone disponible. **Compte & team** et la section **Ton vol** sont visibles sans défilement, y compris à 360×640 ; le reste du menu défile dans la même fenêtre.
- Dans **Réglages → Commandes**, la disposition tactile peut rester équilibrée ou suivre la main du joueur : **Droitière — boutons d’action à gauche**, **Gauchère — boutons d’action à droite**. Le choix est sauvegardé sur l’appareil et inclus dans les exports ; le pilotage relatif et le multipoint restent identiques.
- Sur téléphone, le plein écran et le son sont tentés dès l’ouverture. Si le navigateur impose un geste utilisateur, le premier toucher les active automatiquement, sans panneau supplémentaire. Les **Réglages**, la fenêtre **Compte & team**, le **Hi-score** et le classement de team occupent toute la hauteur disponible ; les Réglages présentent les commandes tactiles à la place des raccourcis clavier.

## Modes de jeu

| Mode | Règles principales |
|---|---|
| **Partie classique** | Vols illimités, difficulté réglable, progression et highscore classique (`normal`, `easy` ou `hard`). Ce mode ne compte pas pour la team. |
| **Partie classée** | Trois essais par jour, en difficulté **Nuit noire**, avec prévol et highscore `ranked` séparé. L’entrée est affichée uniquement lorsqu’une team est confirmée ; sans team, elle est masquée. Seule l’amélioration du meilleur score du jour augmente le cumul local ; ce mode seul alimente le classement de la team. |
| **Défi primes** | Un essai séparé par jour et trois objectifs à prime unique. Le score brut de cet essai ne constitue pas un quatrième score classé. |
| **Sprint hebdo** | Trois vagues puis un gardien, environ 3–5 minutes, graine commune du lundi au dimanche et équipement normalisé. Records hebdomadaires séparés, défi ami par lien et classement de team dédié ; aucun essai quotidien, XP ou record de campagne n’est utilisé. Le bilan détaille les sources de points, le meilleur combo et chaque section par rapport au record précédent. Un bouton permet de s’entraîner contre le gardien de la semaine dans le Laboratoire, puis de revenir au prévol. |
| **Entraînement guidé** | Dix exercices interactifs avec consignes illustrées et validation manuelle. Aucun score, XP, déblocage ou essai quotidien n’est crédité. |
| **Laboratoire** | Entraînement libre avec les sorts, balais, compagnons, variantes et charges de boss. Ne crédite ni score, ni XP, ni déblocage et ne consomme aucun essai quotidien. |

Les essais et objectifs quotidiens sont renouvelés à minuit, heure d’**Europe/Paris**. Leur comptage est local : il ne s’agit ni d’un système compétitif sécurisé ni d’un mécanisme anti-triche.

Les défis et le Sprint imposent l’équipement de base afin que l’Arsenal débloqué dans l’aventure ne donne pas d’avantage permanent.

Pendant un vol, les **synergies nommées** signalent les combinaisons de reliques déjà actives : Essaim crépitant (Roquettes + Fragmentation), Contagion de minuit (Venin + Contagion), Chœur spectral (Familier + Rayon spectral), etc. Elles sont purement informatives et ne changent aucune statistique. Le bilan reprend le build, compare le score au record personnel, indique un objectif chiffré et le déblocage le plus proche, puis permet de rejouer avec le même équipement ou de changer immédiatement de balai et de sort.

Le menu principal sépare **Jouer** et **S’entraîner**, puis regroupe les défis, la personnalisation et les options. Le **Guide illustré** est consultable à la demande. Les notifications ordinaires restent au moins 2,8 secondes, attendent leur tour au lieu de s’écraser et affichent l’icône de la relique, du bonbon, du bouclier ou de la créature concernée. Les alertes de boss restent prioritaires.

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

- des formations de créatures, des élites et des petits groupes coopératifs ; les champions de rang 2 sont présentés comme des mini-boss avec nom, barre de vie et indice sur leurs attaques ;
- des barrières, des passages, des rochers et des obstacles destructibles ;
- des charges de boss propres à chaque gardien ;
- des séquences de terrain propres aux cinq univers ;
- **le Veilleur**, un chasseur récurrent qui intervient pendant les quatrièmes vagues ; sa prime de points tombe à sa position et doit être ramassée, sans crédit automatique ;
- une scène de victoire à l’aube après le dernier gardien.

Les transitions utilisent des fondus sans interrompre le combat : les ennemis, projectiles et objets déjà présents ne sont pas supprimés arbitrairement.

### Arsenal et reliques

Le menu **Préparer mon vol** permet de choisir :

- un **sort actif**, déclenché manuellement ;
- un **balai**, qui modifie le pilotage ou l’esquive ;
- un **compagnon de combat**, avec ses avantages et ses contreparties.

Ces éléments et leurs variantes se débloquent par objectifs cumulatifs. Les choix sont conservés et figés pour le vol en cours.

Pendant une partie, les reliques ramassées renforcent temporairement l’armement : cadence, projectiles, poison, missiles, familiers, tirs traversants ou rayon. Leur effet est résumé sous leur nom et expliqué au ramassage. Elles ne remplacent pas le sort actif. La plupart de ces améliorations se déchargent au changement d’univers.

### Équilibrage des dangers et des bonus

- Les **rochers et coffres ordinaires sont tous destructibles** : un rocher ne peut plus devenir aléatoirement un mur infranchissable qui protège indéfiniment une créature. Les gardes et le sceau d’un coffre scellé conservent leurs règles explicites ; les barrières de parcours restent des passages à franchir.
- Les monstres qui approchent une barrière sont ramenés vers son passage au lieu de rester cachés dans la pierre. Si un chevauchement subsiste, le tir touche le monstre avant d’être absorbé par le mur ; une barrière vide bloque toujours les projectiles.
- Quand deux reliques sont proposées, elles apparaissent ensemble dans une **zone dégagée devant la sorcière**, avec un espacement suffisant pour lire et atteindre chaque choix.
- Le bouclier spectral dure **6 s**, le bouclier d’un bonbon turquoise **5 s** et la protection de transition **3 s**.
- Les roquettes spectrales durent **15 s** et le triple tir des bonbons **12 s**.
- L’**Onde améthyste** (touche **F**) atteint un rayon de **260**, inflige **10 dégâts** et se recharge en **18 s**. La variante **Onde diffuse** utilise un rayon de **320**, **6 dégâts** et **20 s** de recharge. **Cadence concentrée** conserve ses malus automatiques de dégâts et de recharge.

### Confort de combat

Sur téléphone, les textes essentiels sont agrandis sans réduire le terrain ni les cibles tactiles. Les projectiles ennemis possèdent des couleurs distinctes, un contour sombre et un repère lumineux ; ces ajouts graphiques ne changent pas leur hitbox. Les impacts renforcent le flash et l’impulsion déjà présents, avec au plus un son de dégât toutes les 65 ms pour éviter la saturation. Il n’y a ni secousse d’écran ni option de facilité.

Une perte effective de vie fait clignoter la sorcière en rouge pendant l’invulnérabilité, avec un anneau d’alerte et un léger voile qui s’estompe. Le bouclier, l’esquive et l’invulnérabilité initiale ne déclenchent pas ce signal réservé aux vies perdues.

Les bonbons apportent de l’XP, des points ou un bouclier. Des cœurs peuvent restaurer une vie. Les coffres scellés doivent être dégagés de leurs rochers puis ouverts avant de récupérer leur butin.

### Score et Grimoire

Le **score** et l’**XP** sont deux progressions distinctes :

- le score dépend notamment des éliminations, des combos, des frôlements et des objectifs de défi ;
- l’XP alimente les niveaux et la **Collection** du Grimoire ;
- les apparences de la Collection sont cosmétiques ;
- les capacités réelles de l’Arsenal se débloquent séparément, par exploits.

Le Grimoire contient également les contrats quotidiens, les exploits, les records, le bilan des vols et le journal local.

### Un grimoire évolutif

L’entrée **Grimoire évolutif** de l’accueil réunit la progression dans un même écran, également accessible depuis la pause et le bilan d’un vol :

- **Pages** compte les pages dévoilées, résume le dernier vol et indique les objectifs les plus proches dans la Collection, l’Arsenal, les variantes et les maîtrises cosmétiques ;
- **Sorts & exploits** présente les vraies capacités et leurs compromis avec les illustrations de l’Arsenal, ainsi que la progression des quatre variantes ;
- **Collection** conserve l’aperçu et l’équipement des apparences, et détaille les sept sceaux de maîtrise avec leurs conditions réelles et des médaillons illustrés.

Les badges de reliques affichés dans **Ton Grimoire** pendant les vols reprennent également les illustrations vectorielles des objets au sol. Le médaillon de progression et les sceaux utilisent les mêmes personnages, matières et couleurs que le jeu ; les sceaux verrouillés sont désaturés et portent un cadenas.

Cette présentation utilise les progressions existantes : elle n’ajoute ni monnaie, ni bonus de puissance, ni nouvelle règle de déblocage. Les défis classés, quotidiens et Sprint restent normalisés.

### Reconstitution du coup fatal

Après une défaite, **Revoir le coup fatal** permet de rejouer une reconstitution des cinq dernières secondes disponibles avant le choc, avec pause, ralenti et curseur temporel.

Cette fonction n’enregistre ni vidéo ni son. Elle ne modifie ni la partie terminée, ni les scores, ni les sauvegardes.

## Progression et sauvegardes

Par défaut, la progression est enregistrée dans le **`localStorage` du navigateur**, sans compte. Une synchronisation Supabase optionnelle peut être activée depuis **Compte & team**, directement sur l’accueil, pour la retrouver sur un autre appareil.

- Un point de reprise est enregistré au début des vagues.
- Les records sont séparés par difficulté et par date pour les défis.
- La reprise d’un défi existant ne consomme pas un nouvel essai.
- Le Laboratoire préserve la progression et le point de reprise du vol en cours.
- Effacer les données du site ou du navigateur peut effacer définitivement la progression locale.

Les **Réglages** conservent les exports et imports locaux, tandis que le compte et la team sont placés hors de cet écran. Depuis l’accueil, **Compte & team** ouvre deux onglets : le premier reste réservé à la connexion et à la team ; **Vols & sauvegarde** regroupe les exports/imports, l’annulation du dernier import, les derniers vols et leurs avis locaux. Le fichier JSON contient notamment la progression, les records, les réglages et le point de reprise.

> **Avant de changer de navigateur ou d’appareil sans cloud, exporter sa sauvegarde.** L’import remplace les données actuelles au lieu de les fusionner. Les fichiers sont validés avant écriture, limités à 2 Mo et le dernier import peut être annulé.

### Highscores arcade

Le bouton **Highscores** du menu ouvre un véritable tableau de borne d’arcade : rangs, pseudos, mondes atteints et scores sur six chiffres. Le **Top 10** est également intégré au bilan de fin de vol, avec le dernier résultat surligné en doré.

Après une défaite, une transition affiche un **compte à rebours visible** avant l’ouverture du bilan. Elle dure au moins trois secondes et s’adapte à la durée du jingle, avec un repli identique si l’audio est indisponible. Le score d’une **partie classée** est envoyé à la team dès la fin du vol, sans attendre cette transition ; une partie classique ou un défi quotidien n’est pas envoyé. La page **HI-SCORES / bilan du vol** utilise ensuite toute la zone de jeu : elle conserve le score, le record de la catégorie choisie, le Top 10 local correspondant, le classement de team pour le classé et les actions pour rejouer ou revenir au menu.

- Les onglets **Clair de lune**, **Nuit noire**, **Cauchemar**, **Partie classée** et **Défi du jour** conservent des classements distincts ; un défi d’un autre jour ne se mélange pas au défi courant.
- Lorsque la liste dépasse la fenêtre, elle défile verticalement en boucle. Le survol fait une pause temporaire ; le bouton de défilement, la molette, le toucher et les touches de navigation permettent une consultation manuelle.
- Avec la préférence système « réduire les animations », le tableau est manuel par défaut. Le défilement peut toujours être activé explicitement.
- Sur smartphone, trois à six lignes sont visibles selon la hauteur disponible, avec le titre, les scores et les commandes dans la fenêtre plein écran.
- Quand un compte avec pseudo est connecté, ce pseudo est automatiquement utilisé pour les nouveaux records au lieu de « Sorcière ». Les scores déjà enregistrés conservent leur nom d’origine.
- Ces records restent locaux à l’appareil. Les catégories classique, classée, défi quotidien et Sprint ne sont jamais mélangées. Le classement amical de team et sa synchronisation optionnelle continuent de fonctionner séparément dans le bilan.

## Supabase : cloud, teams et avis

La configuration publique du projet est déjà renseignée dans `supabase-config.js` et le schéma `supabase/schema.sql` est appliqué avec ses règles RLS. Le menu **Compte & team** permet de créer un accès avec **un pseudo et un mot de passe, sans adresse e-mail**, d’envoyer sa progression et de la récupérer sur un autre appareil. Les comptes e-mail existants restent utilisables via la section dépliable prévue à cet effet. Après un premier envoi manuel, les modifications sont synchronisées automatiquement au maximum toutes les 30 secondes.

La sauvegarde cloud est **optionnelle** : le jeu local et les exports restent disponibles sans compte ou hors ligne. Un accès possède un emplacement, remplacé à chaque envoi. Le mot de passe n’est pas stocké par le jeu et la session Supabase n’est jamais incluse dans les exports. Sans adresse e-mail, le joueur doit conserver son mot de passe : aucune récupération par message n’est possible.

La confirmation d’adresse reste obligatoire **uniquement pour l’inscription avec e-mail**, pas pour l’accès par pseudo. Les nouveaux liens e-mail aboutissent à la page Supabase **`email-confirmation`**, indépendante de la prévisualisation Arena : après confirmation, revenir dans le jeu et se connecter. Si un ancien e-mail affiche **Missing traffic access token**, du code HTML brut ou des accents corrompus, ouvrir **Utiliser une adresse e-mail** dans **Compte & team**, puis choisir **Renvoyer la confirmation** et ouvrir uniquement le nouveau lien.

### Teams et highscores

Le menu **Compte & team** permet, après connexion, de créer une team ou de rejoindre celle d’un autre joueur avec un code de 10 caractères. Le pseudo du compte est utilisé dans la team ; les comptes e-mail sans pseudo peuvent choisir leur nom de team. Les adresses e-mail ne sont jamais affichées dans le classement.

- Un compte appartient à une seule team à la fois ; il doit la quitter avant d’en rejoindre une autre.
- **Le créateur devient administrateur** et configure les règles dès la création : 1 à 100 parties classées comptabilisées par joueur et par jour, ou illimité, ainsi qu’une période optionnelle de début et de fin.
- Seul l’administrateur peut modifier ces règles, réinitialiser la campagne ou supprimer explicitement la team. S’il quitte la team sans la supprimer, le membre le plus ancien reprend ce rôle.
- Le créateur dispose aussi d’une page **Statistiques de la team** sur 7, 30, 90 ou 365 jours : synthèse, parties et points par jour, activité par membre et 50 derniers vols avec monde, vague et mode. Les **points gagnés** additionnent les scores de tous les vols classés comptabilisés, et non les seuls highscores. Cette page et son RPC sont réservés à l’administrateur et ne renvoient aucun e-mail ni identifiant de connexion.
- Dans **Compte & team**, la section **Administration · Campagne** reste directement visible pour l’administrateur, hors du volet repliable des règles. **Remettre les scores et les parties à zéro** demande une confirmation puis supprime toutes les tentatives et tous les highscores de la team pour tous les membres. La team, ses membres, son code et ses règles sont conservés ; les autres appareils voient la remise à zéro après actualisation.
- Sur tous les appareils, **Inviter par e-mail** ouvre la messagerie avec le destinataire, l’objet, le code et le lien préremplis ; l’envoi est confirmé dans la messagerie et l’adresse n’est pas enregistrée par le jeu. Sur smartphone, le code peut aussi être partagé par **WhatsApp** ou **Messenger**. Le lien `?team=CODE` ouvre directement une **carte d’invitation** dans **Compte & team**, sans jeton de session. Le code est prérempli et conservé après rechargement ; le visiteur peut créer son accès ou se connecter avec son pseudo et son mot de passe pour rejoindre immédiatement la team. Après une jointure réussie, le jeu revient automatiquement à l’accueil avec une confirmation ; en cas d’échec, l’erreur et l’invitation restent affichées. Le visiteur peut aussi ignorer l’invitation.
- Après chaque vol classé, le score est transmis automatiquement. Chaque vol classé comptabilisé consomme une partie du jour, même s’il n’améliore pas le record ; un identifiant unique évite le double comptage en cas de renvoi.
- La limite quotidienne suit le fuseau **Europe/Paris**. Hors période ou au-delà de la limite, le vol classé reste jouable localement mais ne compte pas pour la team. Les parties classiques et les défis quotidiens ne sont jamais comptés dans le classement de campagne.
- Seul le **meilleur score de chaque membre** est conservé ; le tableau affiche aussi le total de ces records et les parties restantes.
- Quitter la team retire le score et les tentatives du joueur de son classement. Une team vide est supprimée.
- Les tables de teams ne sont pas accessibles directement par l’API : des fonctions authentifiées contrôlent chaque opération et aucune donnée de team n’est publique.

Les fichiers `supabase/teams.sql`, `supabase/team_rules.sql` et `supabase/team_stats.sql` contiennent le schéma et ces fonctions. `supabase/weekly_sprint.sql` ajoute une table et deux RPC distincts pour le Sprint : `minuit_weekly_sprint_board` et `minuit_submit_weekly_sprint`. Ils n’écrivent jamais dans `team_scores` ou `team_score_attempts`, ne consomment pas les parties quotidiennes et sont également réservés aux membres authentifiés de la team. Le classement est **amical** : le serveur vérifie le compte, la team et les valeurs transmises, mais ne peut pas prouver le déroulé d’une partie exécutée dans un navigateur modifiable. Une compétition anti-triche nécessiterait une validation serveur ou un système de rejeu signé.

Le bilan de vol conserve toujours localement l’appréciation **Trop difficile / Bien dosé / Trop facile** et un commentaire facultatif. Avec Supabase configuré, une copie privée peut être envoyée pour l’équilibrage, même sans compte. Les avis ne sont pas publiés dans le jeu et aucune lecture publique de leur table n’est autorisée.

La procédure complète et les consignes de sécurité sont dans [`supabase/README.md`](supabase/README.md). **Aucune clé secrète ou `service_role` ne doit être placée dans le navigateur.**

## Affichage et son

- Terrain au format 8:9 sur ordinateur et en paysage. En portrait sur mobile, il peut occuper davantage de hauteur, jusqu’à un rapport hauteur/largeur de 1,45, selon la place disponible.
- Interface dédiée sur mobile, commandes principales agrandies et panneau d’informations séparé avec mise en pause.
- Mode plein écran lorsque le navigateur l’autorise.
- Volume, musique et ambiance réglables sans modifier la partie.
- Six boucles **MP3 locales, stéréo, 44,1 kHz** : le thème fourni **`nuitsorc-loop.mp3`** dans le menu, utilisé sans réencodage, et cinq compositions dédiées encodées en 192 kbit/s. Elles sont décodées par Web Audio, avec fondu entre les mondes et bouclage précis.
- Cinq identités musicales distinctes : **Murmures de bruyère** (forêt), **Cloches de l’oubli** (cimetière), **Valse carmin** (château), **Rondes des limons** (marais) et **Farandole des ombres** (lanternes). Chaque boucle a été recomposée pour correspondre aux instruments, à la palette et au rythme de son univers tout en gardant une finition cinématique au niveau du menu.
- La forêt privilégie harpe et bois mystérieux, le cimetière célesta et cloches, le château une valse gothique, le marais une pulsation liquide et syncopée, et les lanternes un carnaval spectral plus vif. Pendant les gardiens, la boucle du monde accélère de 8 % avec une transition progressive.
- Les sons d’arrivée des créatures ordinaires ont été retirés : ils surchargeaient le mix pendant les vagues. Chaque gardien possède maintenant un stinger terrifiant adapté à son monde (`boss-forest.mp3`, `boss-cemetery.mp3`, `boss-castle.mp3`, `boss-marsh.mp3`, `boss-lanterns.mp3`), avec une courte atténuation de la boucle.
- Les autres effets, le vent et le bruit rose restent générés localement. Si une boucle est absente ou illisible, l’ancienne partition procédurale du monde prend le relais sans interrompre les effets sonores.
- Les tirs standards, salves, missiles, rayon et sort spécial utilisent des effets dédiés. Les impacts sont différenciés entre coup léger, coup lourd et gardien, avec une limite de voix et un verrouillage temporel pour rester lisibles pendant les salves.
- Aucun service musical externe n’est utilisé. Le HTML autonome embarque les MP3 et fonctionne hors ligne ; seuls deux tampons de musique décodés sont conservés à la fois pour limiter la mémoire. Les détails audio figurent dans [`audio/README.md`](audio/README.md).
- Pause automatique lorsque la fenêtre perd le focus, identique pour toutes les parties.

Hors choix explicite du niveau de difficulté, les réglages ne modifient pas le challenge. Les secousses ont été supprimées et aucune option ne permet de désactiver les apparitions ou d’alléger les effets et la présentation des dangers. Les anciennes préférences de ce type sont ignorées lors du chargement et retirées lors de la prochaine sauvegarde. Le jeu contient des effets lumineux et ne propose plus de mode visuel allégé.

## Structure du projet

| Fichier ou dossier | Rôle |
|---|---|
| `index.html` | Page d’entrée et chargement des modules JavaScript. |
| `game.js` | Boucle de jeu, campagne, ennemis, boss, collisions, score et interface principale. |
| `music.js` | Lecteur local des boucles MP3, fondus, bouclage, intensification et mémoire limitée. |
| `audio/` | Thème d’accueil, cinq adaptations, six signaux d’arrivée et crédits audio. |
| `characters.js` | Illustrations SVG des personnages et ressources visuelles intégrées. |
| `journey.js` | Grimoire, XP, contrats, collection, bilans, avis et export/import. |
| `online.js` | Défis et cumul locaux, sans compte dans l’interface actuelle. |
| `arsenal.js` | Sorts, balais, compagnons et équipement. |
| `arsenal-art.js` | Illustrations vectorielles locales et pastilles courtes des neuf choix d’équipement. |
| `adventure.js` | Exploits, variantes, Laboratoire et coffres scellés. |
| `encounters.js` | Formations, séquences de terrain, statistiques de vol et confort. |
| `night-hazards.js` | Obstacles, charges des gardiens et bonbons. |
| `flow.js` | Fondus et continuité des transitions. |
| `surprise.js` | Apparitions soudaines et présentation de la défaite. |
| `coven.js` | Coopération entre créatures et scène de victoire. |
| `nemesis.js` | Rencontres avec le Veilleur. |
| `combat-feel.js` | Impacts, reliques explicites, champions et retour d’esquive sans coach invasif. |
| `onboarding.js` | Menu hiérarchisé, guide illustré, notifications stables et entraînement guidé. |
| `synergies.js` | Noms et annonces des combinaisons de reliques, sans modifier leurs statistiques. |
| `weekly.js` | Sprint hebdomadaire, records séparés, partage amical et classement de team dédié. |
| `replay.js` | Bilan personnalisé, prochain objectif et relance avec le même équipement. |
| `home.js` | Accueil avec sorcière de profil, musique, accès direct Compte & team et pleine hauteur sur smartphone. |
| `settings-page.js` | Réglages pleine hauteur sur téléphone, commandes tactiles, audio et sauvegarde locale. |
| `collision-replay.js` | Reconstitution locale du coup fatal. |
| `arcade-scores.js` | Top 10 arcade, catégories locales, surlignage du dernier vol et défilement contrôlable. |
| `collectible-art.js` | Illustrations des bonus et objets ramassables. |
| `viewport.js` | Mode téléphone, plein écran automatique dès que permis, terrain et commandes adaptés à la fenêtre. |
| `supabase.js` | Client REST Supabase optionnel, accès pseudo/e-mail, invitations, cloud, teams, highscores et avis. |
| `supabase/functions/pseudo-auth/index.ts` | Fonction serveur d’inscription et connexion par pseudo, sans e-mail ni clé secrète dans le navigateur. |
| `supabase-config.js` | URL et clé publiable du projet ; des valeurs vides désactivent le cloud pour un fonctionnement local. |
| `supabase/` | Schéma SQL RLS et guide de configuration. |
| `server.py` | Serveur HTTP local et ancien backend SQLite de ligue. |
| `scenery/` | Images sources des décors. |
| `tests/` | Tests Node, Python et Playwright, ainsi que leurs captures. |
| `tools/generate_music.py` | Montage stéréo des cinq adaptations à partir du thème fourni, avec NumPy, SciPy, SoundFile et lameenc. |
| `tools/package.py` | Génération du HTML autonome et des archives, avec les MP3 incorporés. |
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
python tests/test_settings_audio.py
python tests/test_settings_page.py
python tests/test_soundtrack.py
python tests/test_music_mp3.py
python tests/test_supabase.py
python tests/test_teams.py
python tests/test_mode_selection_browser.py
python tests/test_pseudo_invite.py
python tests/test_journey_browser.py
python tests/test_no_account_browser.py
python tests/test_home.py
python tests/test_arcade_scores.py
python tests/test_arsenal_browser.py
python tests/test_adventure.py
python tests/test_encounters.py
python tests/test_combat_feel.py
python tests/test_onboarding.py
python tests/test_flow.py
python tests/test_surprise_ui.py
python tests/test_vertical_drift.py
python tests/test_coven_dawn.py
python tests/test_rival_replay.py
python tests/test_sealed_chest.py
python tests/test_bonus_art.py
python tests/test_collectibles_art.py
python tests/test_charges_sweets.py
python tests/test_touch_controls.py
python tests/test_viewport.py
```

La campagne technique complète se vérifie avec :

```bash
python tests/test_journey_campaign.py
```

Cette campagne automatique utilise l’invulnérabilité pour contrôler les 25 vagues, les cinq gardiens et les événements. Elle valide l’intégration technique, **pas l’équilibrage ressenti par un joueur**.

Les tests `tests/test_league_server.py` et `tests/test_league_browser.py` concernent l’ancienne ligue avec comptes et utilisent des données temporaires. Ils sont distincts du parcours local actuel.

## Générer les versions distribuables

Les MP3 sont déjà fournis et aucune bibliothèque n’est nécessaire pour les écouter. Pour reconstruire les cinq adaptations de monde à l’identique, l’outil facultatif utilise Python, NumPy, SciPy, SoundFile et lameenc. Le thème du menu, l’arrivée du boss et les arrivées ordinaires ne sont pas réencodés :

```bash
python -m pip install numpy scipy soundfile lameenc
python tools/generate_music.py
```

Après une modification des sources, des MP3 ou de ce README :

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
- Le jeu n’a pas de dépendance JavaScript ou Python externe à l’exécution. NumPy, SciPy, SoundFile et lameenc ne servent qu’à régénérer les adaptations, déjà fournies en MP3.
- Les scripts, images et douze MP3 de la version autonome sont intégrés au fichier HTML, ces derniers en data URI.
- Le parcours local ne demande aucun compte. La sauvegarde cloud et les teams sont optionnelles ; il n’existe aucun classement mondial public.
- Le serveur conserve d’anciennes routes de ligue et une base SQLite pour des raisons historiques ; elles ne sont pas utilisées par le parcours local actuel.
- Le stockage local est modifiable par l’utilisateur et ne fournit aucune protection anti-triche.
- La compatibilité manette dépend du navigateur et du mapping du matériel.

Le projet s’appelait auparavant **Minuit — La chasse maudite**. Les clés `minuit-*`, le format `MinuitProgression` et plusieurs noms de fichiers sont volontairement conservés afin de préserver les sauvegardes et les exports existants.
