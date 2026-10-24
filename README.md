# La Nuit aux Trousses

Anciennement **Minuit — La chasse maudite**. Le changement de titre ne change ni les mécaniques ni les sauvegardes : les clés `minuit-*`, le format `MinuitProgression` et les identifiants techniques restent inchangés pour préserver la compatibilité des exports existants.

Ouvrir **`La-Nuit-aux-Trousses.html`** pour jouer hors ligne, ou lancer `python server.py` puis ouvrir le port 3000. L’archive principale est **`La-Nuit-aux-Trousses.zip`**.

Jeu de tir vertical Halloween, sans bibliothèque JavaScript, sans image ni police externe. Personnages vectoriels détaillés, cinq décors peints générés pour le jeu et musique synthétisée dans le navigateur. Tous les visuels sont intégrés : aucun chargement externe.

## Obstacles renforcés, charges des boss et bonbons

- Obstacles plus fréquents : intervalle de 6,8 secondes moins l’effet du niveau/vague, plancher 3,4 s, contre environ 7 à 12 secondes auparavant. Plafond de 5 à 8 obstacles selon l’univers, parfois par paires espacées. Une ouverture latérale est conservée à l’apparition et on évite de superposer un nouveau groupe à une barrière proche. La première vague reste une introduction : pas d’obstacle avant 10 secondes, plafond deux ; les vagues suivantes commencent à en générer plus tôt.
- **Charges des cinq gardiens après perte des deux tiers de leur vie** (environ 33 % de vie restante, phase 3). Une trajectoire dorée annonce la plongée pendant 0,85 à 1,15 seconde suivant l’univers. Le boss vise la position de la sorcière avec un léger écart aléatoire, descend jusqu’au bas du terrain puis remonte. La cible ne poursuit pas le joueur après l’annonce.
- Collision continue pendant la descente et la remontée : contact = dégâts, déplacement hors de la trajectoire = évitement, esquive invulnérable = protection. Le bouclier peut absorber les dégâts. Les tirs ordinaires du boss sont suspendus pendant sa charge et son retour, pour éviter une surcharge illisible ; pause et réglages arrêtent l’attaque. Recharge d’environ 5 à 7 secondes avant une autre charge. Les phases et protections des boss restent en place.
- Bonbons dessinés comme des friandises emballées, reconnaissables à leur couleur et leur étiquette : **violet** = 10 à 22 XP selon l’univers, **doré** = 150 à 450 points, **turquoise** = protection d’au moins 50 pour au moins 8 secondes, sans affaiblir un meilleur bouclier déjà actif. Si cette protection est déjà suffisante, +100 points à la place.
- Un bonbon XP est proposé dans chaque vague à partir de 5 secondes ; un second, de type variable, à partir de 13 secondes. Maximum quatre bonbons présents ; pas de nouvelle apparition pendant un boss ou une transition. Il faut les ramasser : pas de récompense simplement à l’apparition.
- Les bonbons XP alimentent la progression permanente, pas le score brut. Les bonbons dorés alimentent le score brut ; le cumul de défi garde ses règles existantes. L’ancien petit bonbon d’armement (tir triple temporaire) reste distinct et fonctionne toujours.
- Les bonbons non ramassés sont inclus dans la sauvegarde de vague. Le compteur d’XP protège contre un double crédit lors de la reprise d’un passage déjà joué ; une friandise déjà consommée ne se règle pas deux fois.

Module : `night-hazards.js`. Test : `python tests/test_charges_sweets.py` (annonce, cible verrouillée, descente/retour, collisions continues et esquive, densité, trois récompenses, limites d’apparition, sauvegarde et XP uniques). La simulation complète des 25 vagues et cinq gardiens passe également avec invulnérabilité technique ; l’équilibrage humain reste à essayer.

## Arsenal jouable : capacités débloquées par objectifs

Le bouton **Préparer mon vol** ouvre désormais un arsenal distinct de la Collection cosmétique. Choisir **un sort spécial**, **un balai de pilotage** et **un compagnon de combat**, puis lancer l’aventure. Les choix sont sauvegardés et figés pour le vol en cours. On peut consulter l’arsenal depuis la pause, mais ces changements ne prennent effet qu’au prochain lancement.

### Sorts actifs

Le tir normal reste automatique. Le sort équipé se déclenche avec **F** (reconfigurable dans Réglages), le bouton à côté de l’esquive, ou **X / bouton 2 de la Gamepad API**. Pas de répétition automatique au maintien. La recharge visible n’avance qu’en jeu, pas en pause.

| Capacité | Objectif permanent | Effet |
|---|---|---|
| Onde améthyste | Disponible au départ | 5 dégâts dans un rayon de 150 autour de la sorcière et dissipation des projectiles proches ; recharge 12 s |
| Marée spectrale | Terminer 3 vagues au total | 4 dégâts dans une zone large devant la sorcière, dissipation des tirs et recul de 70 des créatures ordinaires ; recharge 14 s |
| Lance solaire | Vaincre 2 gardiens au total | Ligne vers le haut, 90 de large, 14 dégâts et dissipation des tirs sur la ligne ; recharge 18 s |

Les sorts endommagent aussi les obstacles destructibles dans leur zone, mais ne détruisent ni barrières ni rochers indestructibles. Ils respectent les boucliers de phase, seuils de phase et budgets de dégâts des boss : pas de suppression instantanée des gardiens. Les zones sont exprimées dans les coordonnées du terrain logique 800×900, pas en pixels d’écran.

### Balais de pilotage

- **Bruyère équilibrée** : disponible au départ ; pilotage habituel et esquive 4 s.
- **Comète vive** : débloquée après **12 esquives effectivement déclenchées**. Vitesse clavier/manette +12 %, esquive de 0,38 s, protection 0,50 s ; en contrepartie, recharge d’esquive de 5 s au lieu de 4 s.
- **Aurore agile** : débloquée après **5 vagues sans dégâts**. Recharge d’esquive 3,2 s ; esquive plus courte (0,26 s), protection 0,38 s et vitesse clavier/manette −10 % (−15 % en précision).

Le suivi direct souris/tactile reste réactif et inchangé ; les différences de protection et de recharge d’esquive s’appliquent à tous les contrôles.

### Compagnons utiles

- **Vol solitaire** : aucune pénalité sur le sort.
- **Chouette éclaireuse**, après **20 objets ramassés** : rayon d’attraction de 155 au lieu de 105 ; recharge du sort +15 %. Elle ne tire pas.
- **Chauve-souris chasseuse**, après **8 élites vaincues** : un projectile dirigé de 1 dégât toutes les 2,5 secondes quand un ennemi est devant ; recharge du sort +25 %. Ce projectile est intercepté normalement par les obstacles et respecte les protections des boss.

Ces objectifs sont cumulables entre les vols, sans hasard et sans coût en XP. Les statistiques déjà enregistrées sont prises en compte rétroactivement. Un déblocage ne change pas automatiquement l’équipement en plein vol.

### Modes, sauvegardes et distinction des récompenses

Les capacités choisies sont utilisables dans l’**aventure libre**. Les défis score et primes utilisent pour tous **Onde améthyste + Bruyère + Vol solitaire** : les anciens joueurs ne gagnent pas un avantage de cumul par leur collection. Le choix personnel reste conservé pour le prochain vol libre.

Les **tenues, couleurs de tirs, aspects de balai et compagnons de Collection** restent des cosmétiques à débloquer par XP. Les compagnons décoratifs ne tirent pas. L’**Arsenal** est le système qui fournit les nouvelles capacités réelles. Les reliques ramassées en vol continuent de renforcer temporairement l’armement, sans écran de sélection et sans remplacer le sort actif.

Les choix, objectifs, recharges et points de reprise sont inclus dans l’export/import. Une reprise ne remet pas gratuitement la recharge à zéro. La sauvegarde reste entièrement locale et ne constitue pas un système anti-triche.

Tests : `python tests/test_arsenal_browser.py` vérifie effets réels et compromis, dégâts et attraction dans la simulation, projectiles du compagnon, protections des boss, objectifs, pause, reprise, choix figés, import/export d’un vol actif, remappage et bouton tactile. Les tests du Grimoire et de l’affichage passent également. La manette a une liaison logicielle mais n’a pas été essayée sur matériel physique.

## Affichage adapté à la fenêtre

Le terrain et les commandes tiennent maintenant dans la hauteur de la fenêtre, sans défilement de la page ni déformation du jeu. Le format 8:9 est conservé. Sur ordinateur, les informations défilent dans une colonne indépendante. Sur mobile, elles s’ouvrent avec le bouton **Infos** et le jeu se met en pause. Les menus longs restent défilables à l’intérieur du terrain. Un bouton **⛶** permet de demander le plein écran lorsque le navigateur ou l’aperçu l’autorise.

`viewport.js` ajuste le canvas au redimensionnement et au changement d’orientation. Vérification : `python tests/test_viewport.py`, à 1366×768, 1440×900, 1024×600, 390×844, 360×640 et 844×390.

## Nouveauté : Le Grimoire des nuits

Le jeu reste **sans compte**. Une progression cosmétique persistante donne désormais un objectif à chaque vol, même sans battre son record.

### Trois façons de jouer

1. **Aventure libre illimitée** : bouton principal, difficulté réglable. Chaque vol rapporte de l’expérience, contribue aux contrats du carnet et aux exploits, et conserve ses records personnels. Aucune limite quotidienne. Pas de points de cumul de défi dans ce mode.
2. **Défi score optionnel** : trois essais par jour, difficulté Nuit noire. Seule l’amélioration du meilleur score journalier augmente le cumul local.
3. **Défi primes optionnel** : un essai séparé par jour. Les trois objectifs affichés avant et pendant le vol créditent chacun leur prime de points une seule fois. Le score brut de cet essai n’est pas un quatrième score classé.

Les anciennes données locales sont conservées. L’XP est un nouveau compteur distinct du score, et n’importe pas les anciens points de compte. Tout reste local, modifiable dans le navigateur : aucun anti-triche ou classement partagé n’est prétendu.

### Boucle de progression

- **Expérience de vol** : 60 XP par vague, 250 par gardien, 1 XP toutes les deux créatures (plafond 400), 5 XP par tranche de 20 secondes (30 minutes maximum prises en compte), et 300 XP pour une victoire complète. Les vols quittés gardent l’XP de leur effort. Un identifiant de vol et des compteurs maximaux évitent de régler deux fois une même reprise de vague.
- **Carnet quotidien dans tous les modes** : 30 créatures (+60 XP), deux vagues (+80 XP), six frôlements (+90 XP). Progrès cumulables sur plusieurs vols ; +100 XP si les trois contrats sont remplis. Ce carnet est distinct des primes de points du Défi séparé.
- **Retour en jeu** : première vague de la journée +40 XP ; trois journées jouées dans la même semaine, du lundi au dimanche, +120 XP une fois par semaine. Les dates et renouvellements suivent Europe/Paris. La série de nuits est informative : une absence ne retire jamais d’XP ni de récompense.
- **Collection** : tenues aux palettes différentes, couleurs des sorts, balais lumineux et petits compagnons purement décoratifs. Paliers à 100 / 240 / 450 / 800 / 1 300 / 2 000 / 3 000 / 4 500 XP. Sélection persistante et aperçu dans la collection.
- **Titres d’exploits** : 100 créatures, un gardien, cinq vagues sans dégâts, trois journées différentes et victoire sur les cinq univers. Aucune récompense ne donne de dégâts, bouclier, vitesse ou vie supplémentaire. Les compagnons de collection ne tirent pas.
- **Niveaux** : seuil du niveau suivant = 120 × niveau actuel². Le menu montre la prochaine récompense et l’expérience manquante.

### Accompagnement et bilan

Les quatre conseils de première partie expliquent mouvement / tir automatique, esquive / précision, bouclier et ramassage, sans arrêter le vol. Ils s’adaptent au tactile, sont fermables et peuvent être réactivés dans Réglages.

Le bilan distingue score et écart au record, expérience de vol, XP de contrats déjà créditée, ajout réel au cumul, progression dans les univers, objectifs, déblocages et essais optionnels restants. Rejouer relance l’aventure libre, sans quota. L’avis « trop difficile / bien dosé / trop facile » et les trente derniers vols sont conservés **uniquement localement**, avec durée, étape, source du dernier dégât et statistiques : ce sont des éléments pour le futur équilibrage humain, pas des analyses envoyées à un service.

### Export / import

Dans **Sauvegarde** au menu ou dans **Réglages** : exporter un fichier JSON contenant XP, collection, journal, cumul local, records, réglages et point de reprise en début de vague. Aucun cookie, mot de passe, ancienne session de compte ou image n’est exporté.

Importer remplace les données, ne les fusionne pas. Le format, la version et la structure sont validés avant écriture, avec confirmation. Une copie locale permet d’**annuler le dernier import** depuis Sauvegarde. Un fichier invalide ne modifie pas la progression. L’import est limité à 2 Mo. L’export est indispensable avant d’effacer les données du navigateur ou pour transférer sa progression sur un autre appareil.

Fichier ajouté : `journey.js` ; stockage principal `minuit-journey-v1`. La version autonome intègre aussi le Grimoire et fonctionne sans API, si le navigateur autorise son stockage local.

### Vérifications de cette édition

- `python tests/test_journey_browser.py` : progression, contrats et récompenses uniques, tutoriel, reprise, cosmétiques, bilan, feedback, série et prime hebdomadaire, export/import dans un second navigateur, refus d’un fichier invalide, annulation d’import, réglages et mobile à 390 px. Aucun appel API de compte.
- `python tests/test_no_account_browser.py` : modes de défi 3+1, primes de points uniques et anciennes sauvegardes.
- `python tests/test_journey_campaign.py` : simulation invulnérable des 25 vagues et cinq gardiens, jusqu’à la victoire ; 933 secondes de temps de jeu simulé et aucune erreur JavaScript. **Ce test ne juge pas la difficulté pour un humain.**
- Tests Node des HI-SCORE, butins, bouclier, esquive, arsenal, parcours et phases des boss toujours passants.

Playwright et Chromium sont nécessaires pour les tests navigateur ; le serveur doit tourner sur le port 3000. Les contextes de test n’utilisent pas la progression du joueur.

## Historique : première version sans connexion


La connexion et l’inscription ne sont plus proposées. Le jeu s’ouvre directement, sans pseudo obligatoire ni mot de passe et sans appel aux API de compte.

- Les trois parties du jour, l’essai Défi séparé, les objectifs visibles et leurs primes uniques sont conservés **localement dans le navigateur**.
- Le cumul local reste la somme des meilleurs scores de chaque jour et des primes du Défi. Il est distinct des anciens points des comptes : aucune ancienne donnée de compte n’est supprimée ou convertie.
- Le classement partagé est temporairement désactivé. Le panneau affiche le cumul local et le Top 10 personnel.
- L’entraînement reste illimité et libre d’accès. Le bouton « Rejouer » d’un entraînement relance bien un entraînement, sans quota.
- Les essais sont renouvelés à minuit, heure de Paris. Ces limites sont maintenant locales, non sécurisées : effacer les données du navigateur les réinitialise. Les points ne sont pas synchronisés entre appareils.
- Une ancienne sauvegarde liée à un compte peut être reprise sans connexion, en entraînement non classé. Les nouvelles parties du jour ont leurs sauvegardes locales et se reprennent sans nouvel essai.
- La version autonome propose aussi ces fonctions locales, sous réserve que le navigateur autorise le stockage des fichiers locaux.
- L’ancien module est conservé dans `online-accounts-backup.js`, non chargé et non exposé par le serveur. La base SQLite et le backend historique sont conservés pour une éventuelle réactivation ; ils ne participent plus au jeu courant.

Vérification actuelle : `python tests/test_no_account_browser.py`, avec le serveur sur le port 3000 et Playwright/Chromium. Le test vérifie l’absence de connexion et d’appels API, les objectifs, les primes uniques, le cumul, la reprise et le mobile. Les tests de l’ancien parcours de connexion sont historiques.

## Jouer

L’aperçu de l’application est déjà lancé sur le port 3000.

Pour le lancer ailleurs, Python 3 suffit :

```sh
python server.py
```

Ouvrir http://localhost:3000. Le serveur écoute sur toutes les interfaces. `PORT=8080 python server.py` permet de changer le port.

`La-Nuit-aux-Trousses.html` est la version en un seul fichier : elle fonctionne hors ligne, mais sans classement partagé. Les sauvegardes locales dépendent des autorisations du navigateur pour les fichiers locaux.

## Commandes

- Flèches, ZQSD ou WASD : mouvement.
- Maj : mouvement de précision et affichage de la zone de collision (rayon de 6 unités).
- Espace : esquive, 0,32 seconde d’élan et courte invulnérabilité, recharge de 4 secondes.
- P ou Échap : pause.
- Souris : guider la sorcière.
- Tactile : glisser sur le terrain, bouton d’esquive séparé.
- Manette compatible Gamepad API : stick gauche, gâchette pour la précision, A pour l’esquive, Start pour la pause. 

Les touches principales sont reconfigurables dans Réglages. Le son est désactivé par défaut ; l’activer avec le bouton Son.

## Contenu

- Cinq univers : forêt, cimetière, château, marais, fête des ombres.
- Cinq vagues scénarisées par univers, puis boss à trois phases.
- Trois difficultés : Clair de lune, Nuit noire, Cauchemar.
- Trois familles d’améliorations tombent en bonus sur le terrain et se cumulent au ramassage, sans écran de sélection :
  - **Explosions** : missiles guidés temporaires (10 s, 1 par salve, puis 2 dès le troisième univers), fragmentation, réactions en chaîne, flamme maudite qui embrase les toiles.
  - **Malédictions** : poison, contagion, cadence, dégâts et double tir.
  - **Spectres** : familiers, tirs traversants, rayon périodique.
- Boss : graines/flammes, murs d’os à passages, vampires et doubles, araignée et points d’ancrage destructibles, lanternes qui protègent le dévoreur.
- Bouclier : 100 points, 12 secondes. Sa jauge et sa durée restent au-dessus de la sorcière.
- Surprises avec matérialisation avant les dégâts ; tirs et obstacles restent lisibles.
- Derniers univers : plus de panneaux explicites pour les obstacles, mais ombre d’arrivée conservée.
- Éblouissements dessinés sous les tirs ; option d’effets réduits et de désactivation des secousses.
- Score : combos jusqu’à ×8, frôlements de projectiles et bonus de boss sans dégâts.
- Sauvegarde au début de chaque vague, reprise depuis le menu. Les améliorations sont propres à un univers : elles se déchargent lors du passage au suivant (seule la moitié entière du rang de cadence peut subsister).
- Défi quotidien : graine datée selon Europe/Paris, difficulté fixe, surprises activées. Les effets visuels ne consomment pas le générateur aléatoire du gameplay.
- Records locaux séparés par difficulté ; scores quotidiens filtrés par date.

## Historique suspendu : ligue avec comptes, objectifs et cumul

- **Compte pseudo / mot de passe** : pseudo de 3 à 20 caractères, mot de passe de 8 à 128 caractères. Le même compte fonctionne sur plusieurs appareils utilisant la même instance du serveur. Pas de récupération par e-mail : conserver ses identifiants.
- **3 parties classées + 1 essai Défi séparé par compte et par jour**. Un essai est réservé dès le lancement, même s’il est ensuite abandonné. La reprise de sa sauvegarde avec le même compte n’utilise pas de nouvel essai. Une partie expire après 24 heures.
- **Entraînement illimité**, sans compte et sans contribution au classement de ligue. La difficulté des entraînements reste réglable. Parties classées et Défi en difficulté Nuit noire ; les apparitions dommageables y restent activées. Les réglages d’accessibilité visuelle sont conservés.
- **Cumul = somme des meilleurs scores classés de chaque jour + primes d’objectifs uniques de chaque jour**. On ne cumule pas les trois scores classés entre eux. Une moins bonne partie ne retire jamais de points.
- **Trois objectifs datés**, communs à tous, visibles avant lancement et dans un suivi repliable pendant le vol. Les compteurs concernent créatures, vagues, vagues sans dégâts, frôlements, obstacles, élites ou gardiens selon le tirage du jour.
- Les objectifs et leurs primes se réalisent dans **l’essai Défi séparé**, pas dans les trois parties classées. Pendant une classée, le suivi rappelle cette règle. Une prime acquise augmente le score personnel du défi et, après validation serveur, le cumul du compte, une seule fois par objectif et par jour. **Le score brut du Défi ne constitue pas un quatrième score classé.**
- Remise à zéro des **essais et objectifs à minuit, fuseau Europe/Paris** (heure d’été/hiver comprise). Le cumul historique est conservé. Une partie entamée avant minuit reste rattachée à sa date de lancement.
- Classement général **Top 20**, diffusé par événements serveur SSE : les autres joueurs voient les nouvelles valeurs sans recharger. La progression est envoyée environ toutes les deux secondes de jeu et à l’atteinte d’un objectif. Repli sur interrogation périodique si nécessaire. En fin de partie, un résultat non transmis est gardé localement dans une file d’attente et retenté à la reconnexion ; il faut le synchroniser dans les 24 heures suivant le lancement.
- Les HI-SCORE et Top 10 personnels restent enregistrés dans le navigateur. Les anciens records locaux ne sont pas importés comme points de ligue.

### Serveur et données

Bibliothèque standard Python 3.9+ (base de fuseaux système requise), SQLite dans `minuit-scores.sqlite3`. `MINUIT_DB=/chemin/base.sqlite3` permet de choisir une autre base. Les tables historiques sont conservées ; les nouvelles tables `league_*` stockent comptes, sessions, essais, meilleurs scores journaliers et primes uniques. Les fichiers de base ne sont pas accessibles par les routes statiques et ne sont **jamais inclus dans le ZIP**.

Mots de passe dérivés par PBKDF2-SHA256 avec sel individuel, sessions par cookie HttpOnly / SameSite=Lax, contrôle d’origine des requêtes JSON, limitation des requêtes d’authentification. Le cookie est marqué Secure lorsque le proxy indique HTTPS. Quotas et primes sont contrôlés dans des transactions SQLite et ne dépendent pas du stockage local : effacer son navigateur ne rend pas ses essais.

Routes : `GET /api/state`, `GET /api/run?token=…`, `GET /api/events`, `POST /api/register`, `/api/login`, `/api/logout`, `/api/run/start`, `/api/run/progress`. Les anciennes publications anonymes via `/api/start` et `POST /api/scores` sont désactivées. Aucun service tiers.

**Limite importante : ce n’est pas un anti-triche autoritaire.** Les quotas, comptes et primes uniques sont gérés par le serveur, mais les scores et événements de gameplay sont déclarés par le navigateur, avec des contrôles de cohérence seulement. Une compétition publique dotée de prix nécessiterait une validation des parties côté serveur. Un hébergement durable nécessite aussi HTTPS via proxy correctement configuré, sauvegardes cohérentes de la base SQLite (API de sauvegarde SQLite), supervision et durcissement du serveur HTTP. Le cumul est partagé entre les visiteurs de **la même instance**, pas entre plusieurs copies du jeu lancées avec des bases distinctes.

Dans cette ancienne configuration avec comptes, la version autonome ne proposait que l’entraînement local. Le mode actuel sans connexion, décrit en tête de document, permet aussi les défis et le cumul locaux. Le mode en ligne demande `python server.py` et l’ouverture du jeu via son URL HTTP.

## Vérifications réalisées

- Validation syntaxique JS et Python.
- Tests automatisés dans Chromium avec Playwright : durée et résistance du bouclier, esquive, armes, trois phases des cinq boss, ramassage de reliques, transitions sans interruption, victoire, réglages, reprise, publication et lecture des scores.
- Simulation complète des 25 vagues et 5 boss avec invulnérabilité de test, sans blocage de progression.
- Défi quotidien déterministe, y compris avec effets réduits.
- Affichage à 1440 px et mobile 390 px, sans débordement horizontal ; aucune erreur JavaScript dans ces tests.
- Tests actuels de la ligue : `python tests/test_league_server.py` et `python tests/test_league_browser.py` (Playwright + Chromium). Ils démarrent leur propre serveur sur un port libre avec une base temporaire : aucun faux compte ajouté à la vraie ligue. Les anciennes simulations navigateur utilisent les menus historiques ; ne pas les confondre avec le parcours actuel de connexion.

Une simulation automatisée ne remplace pas des sessions humaines d’équilibrage. La compatibilité manette dépend du navigateur et du matériel ; pas de test matériel physique effectué ici.

## Fichiers

- `index.html`, `game.js` : jeu.
- `online.js` : défis et cumul locaux sans compte.
- `journey.js` : progression, collection, tutoriel, bilans, export/import et journal local.
- `characters.js` : personnages SVG et décors intégrés.
- `scenery/` : sources des cinq décors.
- `server.py` : serveur et classement, bibliothèque standard Python uniquement.
- `La-Nuit-aux-Trousses.html` : copie jouable hors ligne.
- `minuit-v1.html` : sauvegarde du prototype avant cette refonte.

## Révision : chasse aux reliques

- Sorcière redessinée : visage et regard, cheveux, grand chapeau orné, corset, cape et écharpe animées, bottines, sacoche, fiole et balai détaillé.
- Bestiaire réillustré avec ombrages, dégradés, textures et détails propres à chaque espèce.
- Cinq environnements peints, animés par la brume, les feuilles, les particules et un léger mouvement de caméra.
- Souris : suivi direct restauré, sans limitation artificielle de vitesse hors ralentissement/précision. Clavier plus réactif, diagonales normalisées ; manette prioritaire sur la souris quand utilisée.
- Tir principal depuis la baguette, lueurs d’impact, inclinaison et traînée de vol.
- Aucun choix d’amélioration : les reliques tombent sur le terrain. Bonus plus rares et déblocages progressifs ; aucun bonus d’arme à la première vague, missiles possibles à partir de la vague 3. Un bonus d’arme et un bouclier après un boss.
- Attraction des bonus à proximité, transitions courtes jouables, bonus conservés entre vagues.
- Le format de sauvegarde et la graine du défi quotidien ont changé pour cette révision ; les anciens checkpoints ne sont plus proposés, mais les records sont conservés.

## Rééquilibrage : puissance maîtrisée

- Départ au sort simple : aucun bonus d’arme pendant la vague 1.
- Cadence accessible à partir de la vague 2 ; missiles à partir de la vague 3 ; poison à partir de la vague 4.
- Familiers et tirs traversants reportés aux univers suivants ; lasers, fragmentation et synergies explosives réservés au troisième univers et au-delà.
- Reliques moins fréquentes : seuil d’éliminations de 18 au premier univers, puis 14, chance supplémentaire de 2,5 %, sans accumulation de reliques sur le terrain. Bonus de transition seulement après les vagues paires.
- Missiles guidés : durée de 10 secondes, renouvelée mais jamais additionnée au ramassage. Une roquette par salve au début ; deux au maximum dès le troisième univers. Salves espacées de 2,25 secondes, dégâts et rayon d’explosion réduits. À expiration, arrêt de l’arme et disparition des roquettes restantes.
- Durée restante indiquée dans le HUD et le grimoire. Les autres améliorations restent acquises pendant l’univers en cours, puis se déchargent à sa sortie.
- Tests des règles et de l’expiration exécutés avec `node tests/balance-node.cjs`. Le scénario Playwright correspondant est fourni dans `tests/test_balance.py`. Les anciennes simulations documentent les versions précédentes.

## Révision : vol arcade et parcours

- Cinq nouveaux fonds en **vue aérienne**, conçus sans horizon ni lune, défilent du haut vers le bas. Les raccords des tuiles sont fondus et mis en cache ; le défilement s’arrête en pause et suit la vitesse du parcours.
- Barrières transversales à franchir par leurs ouvertures : passages plus étroits et légèrement mobiles dans les univers avancés. La décoration varie entre pierres, clôtures, racines et lanternes.
- Collisions continues : un déplacement rapide à la souris ne permet pas de sauter une barrière. Le contact inflige des dégâts et repousse la sorcière du bon côté. Les barrières interceptent également les sorts et les missiles ; le rayon spectral conserve sa fonction traversante.
- Les obstacles du parcours avancent à la même vitesse que le terrain ; les zones d’éblouissement ne sont pas générées sur les barrières proches.
- À chaque changement d’univers : missiles et bonus offensifs se déchargent, cadence divisée par deux et arrondie vers le bas, récupération limitée à 50 points de bouclier pour 8 secondes, sans vie automatique. Une nouvelle relique est proposée sur le terrain du nouvel univers, après la décharge.
- Boss : santé renforcée selon l’univers et l’arsenal, armure, limitation des rafales excessives, trois phases obligatoires et courte protection entre les phases. Attaques et renforts s’accélèrent progressivement.
- Barre de vie, nom et phase dessinés **au-dessus du boss**, dans ses coordonnées, et non fixés en haut de l’écran.
- Vérifications : `node tests/test_arcade.cjs` et `python tests/test_arcade_browser.py`. Ce dernier a parcouru les 25 vagues et cinq boss avec invulnérabilité de test, sans blocage ni erreur JavaScript ; défilement, pause et affichage mobile vérifiés. Ces tests ne remplacent pas l’équilibrage humain.

## Révision : sorcière aérienne, élites et défis

- La sorcière est maintenant vue strictement de dessus, orientée vers le haut et à cheval sur un balai vertical. Nouvelle illustration SVG détaillée avec cape, chapeau, mains sur le manche et embout magique. Les sorts et le rayon partent du bout du manche, en suivant son inclinaison. La jauge du bouclier reste au-dessus de l’ensemble.
- Des élites apparaissent à partir de la vague 3, puis des champions dans les univers avancés. Ils ont davantage de points d’énergie, une barre visible, un anneau distinctif, une silhouette plus grande et un rythme d’attaque accru. Les ennemis ordinaires à plusieurs points de vie ont aussi une petite jauge.
- Les araignées tirent des toiles guidées : 0,3 seconde d’amorçage, puis environ 1,6 à 2,1 secondes de correction de trajectoire, avec une vitesse de rotation limitée. Une seule toile est guidée dans chaque salve, les autres restent balistiques. Le verrouillage cesse à très courte distance, ou si la sorcière esquive à proximité. Les projectiles sont interceptés par les barrières.
- Dans les niveaux avancés, certains vampires et démons renforcés ont également un projectile guidé dans leurs salves.
- Historique, avant la ligue : le défi quotidien ajoutait des points au score de **la partie en cours** : 150 × numéro d’univers × vague terminée ; +100 × univers pour une vague sans dégâts ; 750 × univers pour un gardien (+500 × univers sans dégâts) ; 100 × univers × rang pour une élite ; +150 tous les huit frôlements. Ces anciens bonus répétables sont désactivés dans la ligue actuelle et remplacés par les trois primes quotidiennes décrites plus haut.
- Total des bonus visible dans le HUD, règles dans le panneau du défi, détail à la fin et sauvegarde dans le checkpoint.
- Tests : `node tests/test_flight.cjs` vérifie l’origine des tirs, le calcul des points, la reprise, les élites, le guidage limité et la rupture du verrouillage. `python tests/test_flight_browser.py` a aussi validé la campagne complète, le rendu de l’illustration et l’affichage mobile dans Chromium sans erreur JS.

## Révision : butin des gardiens et obstacles destructibles

- Après la défaite d’un gardien non final : 70 % de chance de laisser un cœur. Il faut le ramasser pour gagner une vie (maximum cinq ; +250 points si les vies sont pleines). La vie automatique de changement d’univers a été retirée. Les cœurs de gardiens non ramassés sont conservés lors de la transition et dans le checkpoint.
- Coffres destructibles et rochers identifiés par un anneau vert : points de résistance, éclats et petite jauge après un impact. Les rochers bardés de fer et les barrières du parcours restent indestructibles. Le butin n’est révélé qu’après destruction.
- Sorts, missiles, fragments et rayon peuvent endommager ces obstacles. La destruction donne un petit score immédiat puis libère, selon le contenu tiré à l’apparition, des points à collecter, une amélioration d’arme ou un bouclier. Les restrictions de déblocage et de rareté des améliorations restent applicables ; si aucune arme n’est disponible, le trésor devient un bonus de points.
- Défilement plus rapide selon l’univers et la vague, accélération supplémentaire dans certaines sections intermédiaires, ralentissement de lisibilité pendant les boss. La vitesse cible est plafonnée et atteinte progressivement pour éviter les changements brusques. Terrain, barrières et obstacles partagent la même vitesse à chaque pas de simulation.
- Vitesse relative affichée en bas du jeu (« VOL »).
- Tests exécutés : `node tests/test_loot.cjs` et `python tests/test_loot_browser.py` ; vie du boss, ramassage, transition et sauvegarde, destruction sans double récompense, obstacles indestructibles, butin d’arme, synchronisation du défilement et pause. La campagne complète a également été simulée jusqu’aux cinq gardiens vaincus, sans erreur JavaScript.

## HI-SCORE visible

- Record personnel affiché en permanence dans le HUD et sauvegardé dans le navigateur, y compris lorsqu’une partie est interrompue.
- Reprise des scores précédents et ancien record du prototype.
- Records séparés par difficulté et par date pour le défi quotidien.
- Notification et couleur dédiée lors du dépassement du record ; récapitulatif de fin avec « Nouveau HI-SCORE ».
- Classement personnel local porté à dix entrées ; la nouvelle ligue affiche un Top 20 général séparé.
- Test : `node tests/test_highscore.cjs`.

## Maîtrise, gardiens et laboratoire

Depuis le menu : **Exploits & variantes**, **Préparer mon vol**, **Laboratoire**.

### Cinq charges différentes
À partir du dernier tiers de vie, chaque gardien verrouille et annonce sa trajectoire avant de partir. La charge laisse le temps de changer de côté ou d'utiliser l'esquive.
- Roi creux : charge lourde, puis récupération de 1,4 s avec vulnérabilité (+25 % avant les limites d'armure et de débit).
- Gardien des os : traînée d'ossements, visible 0,6 s avant d'être dangereuse et disparaissant après 4,5 s.
- Comtesse : faux tracé violet explicitement inoffensif ; le tracé doré indique la vraie charge, annoncée pendant 1,45 s.
- Tisseuse : plongeon diagonal et poche de toile temporaire au point d'arrivée.
- Dévoreur : deux descentes plus courtes, avec une nouvelle visée annoncée avant la seconde.

### Exploits et variantes de sorts
Les objectifs sont cumulatifs entre les vrais vols. Une seule variante compatible s'applique par vol ; la sélectionner ne change pas le sort choisi dans l'Arsenal.
- **Onde diffuse** : 3 esquives de charge au dernier moment. Rayon 200, dégâts 3, recharge 14 s.
- **Lance éventail** : détruire 3 obstacles avec un seul sort. Largeur 140, dégâts 9, recharge 20 s.
- **Marée de recul** : vaincre un gardien sans perdre de cœur (le bouclier peut absorber des coups). Recul 110, dégâts 2, recharge 12 s.
- **Cadence concentrée** : terminer au moins un univers avec chacun des trois balais de pilotage. Recharge −15 %, dégâts −20 %.

Ces variantes sont des compromis, pas des améliorations gratuites. Elles sont conservées dans la progression exportable et dans le point de reprise. Les défis classés/primes imposent toujours l'équipement de base sans variante. Le laboratoire ne valide aucun exploit.

### Lisibilité et détours
La préparation résume les effets, pénalités et compatibilité de la variante. En vol, le bouton indique explicitement **PRÊT** ou la recharge restante ; le statut rappelle bouclier, cadence temporaire, missiles et variante. Les tirs du compagnon sont dorés pour les distinguer des sorts de la sorcière.

À partir de la deuxième vague, si le terrain disponible le permet, un coffre facultatif peut apparaître entre deux rochers. L'autre côté reste libre des obstacles ajoutés par ce détour ; ce n'est pas une zone d'invulnérabilité face aux ennemis. Les obstacles et passages ordinaires ne sont pas ajoutés pendant le détour. Récompense : 500 + 150 × indice d'univers points et 25 + 5 × indice d'univers XP. L'indice commence à zéro. Les XP utilisent le registre anti-double-crédit existant.

### Laboratoire illimité
Tester tous les sorts, balais, compagnons et variantes, même verrouillés, contre des cibles/caisses ou l'une des cinq charges. **Réarmer** réinitialise l'exercice et les recharges ; **Changer l'exercice** ouvre les réglages ; **Quitter le labo** revient au menu. Les impacts sont comptés et les cœurs restaurés.

Aucune XP, aucun record, déblocage ou résultat de défi n'y est crédité. Aucun des essais quotidiens n'est consommé. La progression et un éventuel point de reprise sont préservés, y compris en rechargeant la page pendant l'exercice. La sauvegarde du vrai vol reprend depuis son dernier point enregistré, pas depuis l'état du laboratoire.

### Vérifications de cette édition
`python tests/test_adventure.py` : isolation de l'XP/quota/sauvegarde et des réglages du laboratoire, retour au vrai vol et rechargement interrompu, cinq charges et double charge finale, coffre et XP uniques, quatre variantes et compromis numériques.

Régressions également exécutées : charges/bonbons, Arsenal, absence de compte, export/import du Grimoire, six tailles d'écran, tests Node des records/butin/vol/passages, campagne complète de 25 vagues et 5 gardiens sans erreur JavaScript. La campagne automatisée utilise l'invulnérabilité : elle vérifie la progression technique, pas la difficulté ressentie par un joueur.

## Rencontres, reliques et confort de pilotage

Cette édition ajoute `encounters.js`, sans réseau ni nouvelle dépendance dans le jeu.

- **Formations lisibles** : après la première vague, les groupes utilisent une espèce cohérente. Chauves-souris en formation décalée, fantômes en mouvement d'encerclement, araignées tenant des colonnes avec ralentissement de descente. La première vague garde sa programmation plus douce ; les seuils de tir ennemi restent inchangés.
- **Reliques exclusives en vol** : à partir de la troisième vague du premier univers, lorsqu'au moins deux améliorations sont admissibles, une récompense peut proposer deux objets espacés. Ramasser l'un annule immédiatement l'autre. Aucun écran de choix, aucune interruption, aucun dépassement du budget d'améliorations existant. Si une seule amélioration convient, elle reste seule. Pas de paire supplémentaire tant qu'une paire précédente attend d'être ramassée.
- **Une séquence par univers**, pendant la troisième vague : branches qui se resserrent, procession spectrale, herses mobiles, brumes/toiles ralentissantes et lanternes dansantes. Les séquences réservent leur passage, attendent la sortie des obstacles et du détour à coffre, annoncent leur arrivée et dessinent une ouverture claire. La vague ne se termine pas au milieu de la traversée. La première vague n'en contient aucune. Les ennemis présents peuvent toujours tirer : une ouverture libre de décor n'est pas une invulnérabilité.
- **Impacts** : petit recul purement visuel, anneaux brefs, fissures sur les créatures affaiblies et son grave distinct lorsque le bouclier de phase du boss bloque un tir. Ni déplacement des collisions ni pause artificielle. Effets additionnels bornés à 32 anneaux.
- **Bilan utile** : principale catégorie de dangers réellement subis (bouclier compris), utilisations et dégâts directs des sorts, coffres, esquives précises et choix de reliques. Le prochain déblocage proche tient compte des capacités ET des variantes. Le bouton « S'entraîner contre ce gardien » démarre directement la charge du gardien de l'univers atteint, sans quota ni récompense. Les dégâts de poison différés et dégâts aux obstacles ne sont pas inclus dans les dégâts directs de sort affichés.
- **Confort**, dans Réglages : projectiles ennemis à contour clair/foncé et cœur jaune, particules normales/discrètes/minimales, réduction des flashs et suppression des secousses, pause automatique quand la fenêtre perd le focus (activée par défaut). La reprise reste manuelle. Ces options sont sauvegardées et exportées avec les réglages existants. Le mode anti-flash réduit aussi les éblouissements et désactive le flash d'impact des ennemis ; il ne constitue pas une garantie médicale d'absence de risque photosensible.

### Contrôles de cette mise à jour
`python tests/test_encounters.py` couvre formations, première vague inchangée, annulation de la seconde relique, cinq événements, métriques de combat, réglages, pause hors focus, bilan et entraînement ciblé. La campagne automatique vérifie désormais l'apparition des cinq événements en plus des 25 vagues et cinq gardiens.

Régressions exécutées : laboratoire et sauvegardes, Arsenal, bonbons/charges, export/import, jeu sans compte, quotas, six tailles d'écran, tests Node records/butin/vol/passages. Les simulations de campagne sont invulnérables : un test humain reste nécessaire pour juger l'équilibrage et le ressenti.

## Objets illustrés et utilité des coffres

`collectible-art.js` ajoute quatre illustrations SVG embarquées, mises en cache sous forme d'images : reliquaire en bois violet, ferrures patinées et serrure en lune ; trois confiseries à papier plissé, volumes dégradés et emblèmes étoile/pièce/bouclier. La palette reprend les violets, ors et verts des personnages. Aucun téléchargement externe et aucun changement des zones de ramassage.

Les reliquaires affichent désormais leur caractère facultatif, leurs points et leur XP exacte, ainsi que « XP : progression de collection ». Le panneau d'aide explique que les points servent au score du vol et que l'XP fait progresser les niveaux/apparences, pas les capacités de combat. Aucun sort exclusif n'est enfermé dans ces coffres : les ignorer ne bloque rien. Le message de ramassage affiche le gain d'XP réellement crédité, même à la reprise d'une sauvegarde déjà récompensée. Récompenses et risques restent inchangés.

Les bonbons affichent directement leur effet : XP de collection, points ou bouclier 50 / 8 s. Les illustrations sont distinguées par forme et emblème en plus de leur couleur. Les options de réduction de mouvement/particules restent respectées.

Vérification dédiée : `python tests/test_collectibles_art.py` (chargement des quatre SVG, rendu en jeu, explication d'utilité, XP unique et gain affiché). Régressions exécutées : laboratoire, charges/bonbons, rencontres et six tailles de fenêtre.

## Tous les bonus harmonisés et bouclier actif

Le détour à coffre est désormais libellé **« Contourner le coffre · sans rochers »** : seule l'absence des rochers du détour est indiquée. Les tirs ennemis restent dangereux.

L'atlas SVG embarqué comprend maintenant 18 illustrations : reliquaire, trois bonbons, bouclier, cœur de soin, pièce, bonus de triple tir et dix reliques d'armes. Les objets reprennent les matières et couleurs des personnages (verre, dorures patinées, gemmes et grimoire). Le nom, la durée ou le prochain rang sont indiqués sous chaque objet. Le bonus temporaire de trois projectiles est correctement nommé « Triple tir », et non « cadence ».

Le bouclier actif entoure la sorcière d'une enveloppe translucide avec segments de résistance. Sa jauge reste au-dessus du personnage ; résistance et secondes restantes sont séparées. La couleur devient ambrée sous 25 points ou dans les trois dernières secondes, sans clignotement. Une onde discrète signale un impact absorbé, désactivée avec les options de confort appropriées. Le bouclier disparaît à zéro résistance ou à expiration ; l'enveloppe n'agrandit pas les collisions et ne donne pas de protection supplémentaire.

Aucun équilibrage modifié : bouclier ramassable 100 points / 12 s, bonbon de bouclier au moins 50 / 8 s, soin +1 vie (ou points si vies maximales), triple tir 8 s, missiles 10 s et capacités des reliques inchangées. Test dédié : `python tests/test_bonus_art.py`, avec contrôle du rendu des 18 images, résistance, absorption de dégâts, expiration, soin et triple tir. Tests laboratoire/Arsenal/bonbons et six tailles d'écran également exécutés.

## Remplacement du détour : barricade + coffre scellé

Cette version **remplace l'ancien coffre directement ramassable et son texte « passage libre »**. À partir de la deuxième vague, une rencontre facultative peut apparaître d'un côté du terrain :

1. Trois rochers destructibles protègent l'approche. Détruire l'un d'eux crée une ouverture et rend le sceau vulnérable.
2. Le coffre fermé est une cible, pas un objet ramassable. Sa jauge indique 20 + 5 × indice d'univers points de résistance. Les rochers ont 4 + 2 × indice d'univers points chacun. Tirs normaux, laser, explosions et sorts spéciaux peuvent contribuer ; le sceau reste insensible tant qu'aucun rocher n'a été détruit.
3. Le sceau détruit ouvre le coffre (illustration distincte), libère le butin à ramasser et, si les améliorations admissibles/budget le permettent, une relique d'arme. Les choix de reliques existants restent applicables.

Récompense du coffre : **800 + 200 × indice d'univers points et 40 + 10 × indice d'univers XP de collection**. Indice de 0 à 4. L'XP utilise le registre anti-double-crédit ; les gains ne sont versés qu'au ramassage du butin libéré. La destruction d'un rocher compte normalement pour les objectifs d'obstacles, mais ne libère pas le trésor du coffre à elle seule. Un sceau non détruit avant sa sortie ne donne pas la récompense du coffre.

Le terrain extérieur reste contournable naturellement, sans texte trompeur de sécurité et sans barrière sur toute la largeur. Les obstacles et passages ordinaires ne se superposent pas à cette rencontre. Les ennemis restent actifs. Aucune rencontre de ce type à la première vague ni dans le laboratoire. À la reprise d'une vague depuis une sauvegarde, la rencontre peut être retentée ; l'XP déjà créditée reste protégée contre le double gain.

Test dédié : `python tests/test_sealed_chest.py` — verrouillage, ouverture dans les rochers, jauge du sceau, ouverture unique, récompense, limite des reliques, apport des sorts et expiration sans trésor. Test complémentaire avec le tir de base continu dans l'axe : ouverture en environ 5,3 s dans le premier univers (mesure technique, pas validation de difficulté humaine). Régressions laboratoire, Arsenal, bonbons, rencontres, quotas, six tailles d'écran et campagne complète 25 vagues / cinq gardiens / cinq événements réussies. L'atlas comprend désormais 19 images, dont les deux états du coffre.

## Combat continu, fondus et difficulté progressive

Cette édition remplace les précédentes règles d'annonce des charges et de nettoyage entre vagues.

**Charges des boss** : premier univers annoncé normalement ; deuxième univers annonce raccourcie à 0,65 s ; troisième, quatrième et cinquième univers **sans texte, son, trajectoire, cercle ni leurre visuel d'annonce de charge**, conformément au choix demandé. Les autres informations de combat (barre de vie, phase, zones dangereuses déjà posées) restent visibles. Vitesse de descente multipliée par 1 + 0,14 × indice d'univers ; retour plus rapide et intervalle entre charges réduit. Une charge tardive exige donc davantage de réaction et d'anticipation du rythme du boss. Le laboratoire reproduit ces mêmes comportements.

**Transitions** : `flow.js` applique un fondu progressif au décor, jamais un écran opaque devant les projectiles. Fondu de vague 1,8 s, fondu d'univers 2,6 s. Les tirs alliés/ennemis, missiles déjà lancés, ennemis survivants et objets restent actifs : aucune purge lors du démarrage de la transition, de la nouvelle vague, du changement d'univers ou de la mort du boss. Ils disparaissent seulement selon leur vie, sortie du terrain, destruction ou interaction normale. Les changements de phase et débuts de charge des boss ne purgent plus les tirs ennemis. Aucune invulnérabilité automatique de transition. Les armes équipées/reliques conservent leurs règles antérieures de décharge à l'entrée d'un nouvel univers ; les projectiles déjà partis restent présents. Le petit bouclier d'entrée est ramené à au moins 35 / 5 s sans écraser un meilleur bouclier actif.

**Pression croissante** : plus de groupes dans les derniers univers, résistance de base accrue selon l'univers, vitesse des créatures augmentée, tirs ordinaires plus fréquents et plus rapides, éventails renforcés et cadence des boss plus soutenue. Les quotas de projectiles et protections anti-burst des boss sont conservés. La programmation douce de la première vague reste inchangée.

Tests : `python tests/test_flow.py` vérifie le fondu, l'identité et le mouvement des ennemis/projectiles entre frontières, l'absence de purge à la mort du boss, la progression chiffrée et la suppression des indices de charge tardifs. Campagne de 25 vagues, cinq boss et cinq événements terminée sans erreur JS ; régressions sauvegarde, Arsenal, laboratoire, coffres, bonbons, quotas et six tailles d'écran réussies, ainsi que les tests Node records/butin/vol/passages. Comme toujours, la campagne technique invulnérable ne valide pas la difficulté ressentie par un joueur.

## Apparitions soudaines, mort explicite et carnet hors du terrain

`surprise.js` remplace les anciennes silhouettes et anneaux annonçant longuement les apparitions. L'apparition devient brusquement visible après 0,16 s, avec une silhouette plus imposante, un son bref synchronisé (si le son est activé) et une avancée rapide vers la position de la sorcière mémorisée au départ. Elle ne suit pas les mouvements ultérieurs. Les dégâts ne commencent qu'à 0,64 s dans le premier univers, 0,54 s ensuite : il reste donc un court temps d'évitement après sa manifestation. Une apparition inflige au plus un impact effectif et disparaît après 1,65 s. Pas de flash plein écran ; les options de confort suppriment le sursaut d'échelle et les effets additionnels correspondants. Le laboratoire reste exempt d'apparitions automatiques.

La perte de la dernière vie affiche **« Vous êtes mort ! »**, **« Plus aucune vie · fin de partie »** et un message explicite de dernière vie perdue, avant le bilan habituel. Les résultats, XP et commandes de reprise ne sont pas supprimés. L'écran de victoire reste distinct.

Le carnet et les objectifs détaillés ne se superposent plus au terrain. Ils sont consultables dans **Pause**, dans une carte « Carnet & objectifs · jeu en pause ». Leurs compteurs et récompenses continuent de fonctionner normalement ; les objectifs restent également accessibles avant les défis et dans le bilan. Le volet ne réapparaît pas au-dessus du bilan de mort. Les tests historiques de carnet ont été adaptés à cette nouvelle présentation, sans retirer les contrôles de primes/XP/quotas.

Test dédié : `python tests/test_surprise_ui.py` — manifestation soudaine, délai avant dégâts, impact unique, évitement, carnet caché pendant le vol et visible en pause, mort par perte réelle de la dernière vie et conservation du bilan. Régressions laboratoire, transitions, sauvegardes/export-import, absence de compte, six tailles d'écran et campagne complète exécutées sans erreur JS. Les simulations invulnérables ne valident pas le ressenti de surprise ni la difficulté humaine.

## Déplacements verticaux aléatoires des monstres

Les créatures ordinaires ne suivent plus seulement une descente régulière et des mouvements latéraux : une dérive verticale aléatoire s'ajoute aux formations existantes. Les destinations changent à intervalles espacés avec interpolation douce, sans téléportation ni tirage aléatoire à chaque image. Les trajectoires diffèrent entre individus ; leur générateur local ne consomme pas la séquence aléatoire des récompenses ou des tirs.

La première vague conserve son mouvement d'introduction. Les vagues suivantes du premier univers ont de faibles variations de descente ; les univers avancés augmentent l'amplitude et la fréquence, jusqu'à de vraies remontées suivies de nouvelles descentes. Le mouvement reste borné autour d'une progression descendante pour qu'aucun monstre ne stationne indéfiniment dans le niveau. Les déplacements horizontaux et particularités des formations restent appliqués. Boss, sentinelles fixes et cibles immobiles de laboratoire ne sont pas concernés : leurs comportements propres sont préservés.

`python tests/test_vertical_drift.py` contrôle les remontées, la continuité des positions, la progression d'amplitude, les trajectoires variées mais reproductibles et la première vague inchangée. Régressions rencontres, Arsenal, laboratoire, apparitions/carnet, transitions, six tailles d'écran et campagne complète (25 vagues, cinq gardiens, cinq événements) exécutées sans erreur JS. La simulation de campagne reste un contrôle technique invulnérable, pas une validation de difficulté humaine.

## Deux priorités : ennemis coopératifs et victoire à l'aube

Seules les deux priorités retenues sont implémentées ici, dans `coven.js`. Le rival, les portails alternatifs et le bestiaire ne font pas partie de cette mise à jour.

### Petits groupes coopératifs
Les groupes réutilisent les créatures déjà programmées, sans ajouter de vague ni augmenter leur nombre. Ils sont introduits séparément :
- **Meneur** : dès la troisième vague du premier univers, un chef signalé par une couronne guide deux escortes. Les escortes se dispersent et hésitent brièvement lorsqu'il est vaincu. Le premier vol d'introduction reste inchangé.
- **Porte-lanterne protecteur** : dès les vagues suivantes du cimetière, il réduit de 45 % les dégâts reçus par ses deux alliés à moins de 170 unités. Liens et anneaux rendent la protection visible ; éliminer le porteur ou sortir de son rayon la supprime immédiatement. Il ne se protège pas lui-même et ne rend personne invincible.
- **Tisseuses** : dans le marais, deux araignées créent un lien ralentissant. Le lien est visible en pointillés pendant 0,9 s avant de devenir actif ; il ne cause pas de dégâts supplémentaires. Éliminer une araignée rompt immédiatement le lien. Le lien n'est actif que lorsque les deux créatures sont visibles et suffisamment proches.

Le château reprend les meneurs ; le dernier univers alterne ces familles selon les vagues, un groupe coopératif à la fois dans la programmation. Les boss, leurs mécanismes propres et les cibles de laboratoire restent inchangés. Les meneurs/protecteurs vaincus et les liens rompus sont comptés dans le bilan, sans nouvelle prime d'XP exploitable.

### Une fin mise en scène
Après le dernier gardien, la victoire et ses récompenses sont enregistrées immédiatement et une courte séquence montre la sorcière poursuivre son vol vers l'aube. Le ciel s'éclaircit progressivement, le soleil et les reliefs apparaissent et les ennemis survivants s'enfuient. Le HUD de combat est masqué pendant cette scène. Il ne s'agit plus d'un combat : aucun impact tardif ne peut annuler une victoire déjà acquise.

La scène dure 6,5 s (4,5 s avec réduction du mouvement), puis le bilan s'affiche automatiquement. Le bouton **Voir le bilan**, Échap ou Espace permettent de la passer. Passer l'animation ne change ni les points, ni l'XP, ni les quotas et ne peut pas créditer une seconde fois la récompense. Le bilan de victoire rappelle les gardiens vaincus sans perte de cœur, esquives précises, meneurs/protecteurs, toiles rompues et reliquaires conquis. L'écran de mort reste distinct et explicite.

### Vérifications
`python tests/test_coven_dawn.py` : première vague préservée, réduction des dégâts et fin de protection, formation puis dispersion, délai et rupture des toiles, victoire sauvegardée avant l'animation, passage manuel et fin automatique, bilan et crédit unique. Campagne complète 25 vagues / cinq boss / cinq événements terminée avec les métriques de coopération. Régressions laboratoire, Arsenal, mouvement vertical, apparitions/carnet, transitions, coffres, bonbons, export/import, quotas et six tailles d'écran exécutées sans erreur JS ; tests Node records/butin/vol/passages également réussis. Le test de série quotidienne accepte désormais une série d'au moins trois jours, car le jour réel précédant les trois dates simulées peut déjà en faire partie.

La campagne automatisée utilise toujours l'invulnérabilité : ces contrôles valident l'intégration technique, pas le ressenti humain de difficulté.

## Les deux priorités suivantes : le Veilleur et le coup fatal

Cette édition implémente uniquement le rival récurrent et la reconstitution du coup fatal. Les chemins alternatifs, le bestiaire et les nouvelles interactions de décor ne sont pas ajoutés ici.

### Le Veilleur, chasseur de sorcières
`nemesis.js` ajoute un personnage illustré original (manteau, chapeau, masque et arbalète). Il intervient brièvement pendant la quatrième vague de chaque univers, jamais pendant un boss ou au laboratoire. Sa rencontre attend que les passages/rochers et le reliquaire facultatif aient quitté le terrain ; les nouveaux passages/obstacles ordinaires sont temporairement suspendus pour éviter leur superposition avec le duel. Le combat normal et les créatures déjà présentes continuent.

Ses tactiques évoluent : tir visé, éventail, salves alternées, balayage et salve finale à ouverture. Il se retire après environ 10,5 s, puis quitte le terrain ; la progression ne dépend pas de sa défaite. Vider sa résistance provoque une fuite anticipée et rapporte 600 + 200 × indice d'univers points, une seule fois par rencontre. Il ne remplace aucun gardien et ne donne pas de nouvelle prime d'XP indépendante. Les tirs déjà partis restent dangereux, conformément aux règles de combat continu.

Les marques des affrontements précédents sont visibles sur son manteau à la rencontre suivante. Cet historique appartient **au vol en cours**, pas à toutes les parties ; il suit le point de reprise et l'export/import. Les répliques passent par les toasts existants, sans boîte de dialogue ni interruption.

### Revoir le coup fatal
`collision-replay.js` conserve localement un tampon borné des cinq dernières secondes de jeu actif, échantillonné à environ 15 positions par seconde, puis interpolé pendant la lecture. Il ne capture ni vidéo ni son, n'envoie aucune donnée et n'écrit pas ce tampon dans la sauvegarde. Il est effacé au prochain vol/rechargement. Si la partie a duré moins de cinq secondes, seule la durée disponible est montrée.

Après une mort réelle à la dernière vie, **Revoir le coup fatal** ouvre une reconstitution en lecture seule, avec caméra centrée sur la sorcière, position du choc et danger surlignés. La cause, le bouclier, son temps restant, l'esquive et la recharge du sort sont rappelés. Les projectiles, créatures, barrières, rochers, apparitions et zones principales sont reconstruits ; les effets décoratifs sont simplifiés. Ce n'est pas une vidéo pixel à pixel de l'écran original.

Commandes : lecture/pause, recommencer, ×0,5/×1, curseur temporel, **Retour au bilan** ou Échap. La simulation réelle reste arrêtée ; aucun score, XP, vie, quota ou résultat n'est changé. Les métadonnées du danger sont enregistrées au moment du contact, avant sa destruction éventuelle. Les morts de laboratoire et les victoires n'ouvrent pas cette fonction.

### Contrôles de cette édition
`python tests/test_rival_replay.py` : rival récurrent, changement de tactique, marques, fuite et récompense unique, historique à la reprise ; tampon borné, projectile fatal identifié, lecture/ralenti/retour et comparaison exacte des sauvegardes avant/après lecture. La campagne vérifie désormais les cinq rencontres du Veilleur en plus des 25 vagues, cinq boss et cinq événements.

Régressions exécutées : victoire à l'aube, coopération, laboratoire, charges, Arsenal, apparitions/carnet, transitions sans purge, coffres scellés, bonbons, export/import, jeu sans compte, quotas, six tailles d'écran et tests Node records/butin/vol/passages. Les simulations invulnérables vérifient la progression technique, pas le ressenti de difficulté.
