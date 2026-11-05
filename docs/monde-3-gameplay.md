# Monde 3 — conception du gameplay

Bestiaire héritier, cinq boss structurellement différents, et difficulté qui monte **sans ajouter un
seul monstre ni un seul tir**.

> **État : implémenté et jouable.** Module `sixth-hour.js`, socle de campagne dans `sequel.js`,
> dispatch de récit généralisé dans `game.js`, test `tests/test_sixth_hour.cjs`.
> Deux écarts assumés par rapport au texte initial :
> 1. **aucune forme du monde 2 n’est réutilisée** ( demande : « pas la même forme regraphée ») — les
>    dix formes du monde 3 sont nouvelles ; le rappel rassurant est **mécanique** (langage des
>    télégraphes, relais annulable), pas graphique ;
> 2. la **minute rendue** de la vague 2 est l’objectif d’exploration lui-même : 1 minute en vague 2,
>    plus les minutes des vagues suivantes, 3 par univers et 15 au total.

- Arc narratif des 5 mondes → `docs/saga-5-mondes.md`
- Chapitre narratif du monde 3 → `docs/histoire-monde-3.md`

---

## 1. Cahier des charges reçu

| Demande | Traduction en règle de conception |
|---|---|
| De nouveaux monstres avec les mécaniques **acquises** des mondes précédents | Chaque monstre du monde 3 = **1 mécanique du monde 1 × 1 mécanique du monde 2**, dans un rôle neuf. Lignée écrite noir sur blanc (§3). |
| Difficulté progressive **sans** plus de monstres ni de tirs | Budgets **plafonnés aux valeurs du monde 2**, et parfois inférieurs. La montée se fait sur le **nombre de décisions simultanées** (§2 et §7). |
| Rendre le jeu plus **intellectuel** | On ne gagne plus en visant mieux, mais en **lisant, ordonnant, se retenant et dépensant**. Chaque salle a une règle à comprendre (§4 et §6). |
| Des boss **complètement différents**, pas la même forme regraphée | **Aucun** boss du monde 3 n’utilise la courbe `PV → 3 phases`. Cinq jauges différentes, cinq conditions de victoire différentes, cinq langues de télégraphe différentes (§6). |
| 5 mondes au total, histoire imbriquée | Le monde 3 se termine sur une révélation, pas sur une résolution. Voir `saga-5-mondes.md`. |
| Confort mobile, ennemis lents *(contraintes permanentes)* | **Aucune nouvelle touche.** Tout se résout au déplacement, à la visée, au sort spécial et à l’esquive déjà en place. Vitesses ≤ monde 2. |

---

## 2. Le principe : remplacer la pression par la décision

Le monde 2 augmente la difficulté en **ajoutant des choses à l’écran** (relais, renforts, effets).
Le monde 3 garde l’écran aussi vide qu’au monde 2 et augmente **ce qu’il faut comprendre**.

### Budgets plafonds (relevés dans le code actuel)

| Quantité | Monde 2 (référence codée) | Monde 3 (plafond autorisé) |
|---|---|---|
| Ennemis non-boss simultanés | **6** (`sequel-bestiary.js · reinforce()`) | **6**, jamais plus |
| Projectiles par salve de monstre | 1 à 2 (`[0]`, `[-.16,.16]`) | **2 maximum** |
| Cadence de tir d’un monstre | 3,5 s à 5,6 s (`windup`) | **≥ 4,2 s** (plus lent) |
| Vitesse des projectiles | 125 à 155 | **≤ 150** |
| PV d’un monstre | référence par forme | **identique** à la forme dont il hérite, aucune inflation |
| Adds d’un boss | jusqu’à 2 (`lampWisp`, `hourHollow`) | **2 maximum**, et seulement sur 2 des 5 boss |
| Salves punitives d’un boss | 3 rayons / 4 spirales | **1 seule** onde de sanction, lente et télégraphiée |

**Conséquence vérifiable :** à tout instant, le monde 3 affiche *autant ou moins* de dangers qu’une
vague du monde 2. Ce qui monte, c’est le nombre de choses à décider en même temps.

### Les cinq leviers de difficulté autorisés

1. **Ambiguïté lisible** — deux télégraphes, un seul réel. L’indice a été appris plus tôt (plein = réel,
   pointillé = leurre, comme le vampire du monde 1).
2. **Ordre de résolution** — tuer A avant B ouvre une fenêtre ; tuer B avant A la ferme. Le mauvais
   ordre ne tue pas : il fait perdre du temps.
3. **Fenêtre d’action** — la cible n’est frappable que pendant un état lisible, pas en permanence.
4. **Sa propre trace** — le joueur est sa propre source de danger : positions passées, dashes répétés.
5. **Dépense de puissance** — progresser coûte de la flamme, donc des dégâts. Le joueur arbitre.

Interdits explicites : inflation de PV, inflation de vitesse, spam d’adds, projectiles rapides,
mémorisation par cœur d’un pattern long, nouvelle touche, mort instantanée sur erreur de lecture.

---

## 3. Table d’héritage (mécanique → source réelle → nouvel emploi)

| Mécanique acquise | Source codée | Nouvel emploi au monde 3 |
|---|---|---|
| Protecteur de formation (dégâts ×0,55 dans un rayon de 170) | `coven.js · protector()` | Le halo du **Garde-mèche** protège ses alliées **et** éclaire la seule zone où vous voyez. Entrer dedans, c’est être protégé et inefficace. |
| Leurre de charge (vrai doré / faux violet, `fakeX`) | `night-hazards.js · moveBoss()`, `game.js` vampire | Le **Facteur de cire** pose deux annonces ; une seule est réelle. Langage graphique repris à l’identique. |
| Relais annulable (`seqLink`, `cancelOnDeath`) | `sequel-bestiary.js · moveEnemy()` | Tuer la **source** annule l’attaque en cours. Devient un **outil offensif**, plus seulement une priorité. |
| Écho sur position du joueur (`echo`) | `sequel-bestiary.js` (`shadePostman`, `hourHollow`) | Le **Corbeau de bronze** frappe là où vous êtes **maintenant**, avec 1,3 s de délai. Rester immobile devient un choix, pas une erreur. |
| Mémoire du joueur (`pastPlayer`, `seqHistory`) | `sequel-bestiary.js · clockstag`, `timeLarva` | La **Marcheuse de sel** transforme votre sillage en sol ralentissant. Il faut cesser de se répéter. |
| Lien de tisseuses (`web`, rupture du lien) | `coven.js · liveWeb()` | Les **Cloches fêlées** sont liées : briser l’une **suspend** les projectiles de l’autre. Le lien devient une ressource. |
| Temps suspendu (`freeze`) | `sequel-bestiary.js · clockmaker` | Réutilisé tel quel comme **récompense** du bon ordre de destruction, plus comme menace. |
| Halo sûr mobile et rétrécissant (`safeLight`) | `sequel-bestiary.js · lanternier` | Devient la **salle elle-même** au Faubourg : la lumière est un compte à régler, pas un abri. |
| Traînée persistante | `adventure.js · trail()`, boss squelette | Sert de sol hostile au sel de l’Estran. |
| Cicatrices du rival (`scars`, mémoire par univers) | `nemesis.js · memory()` | La **Voleuse d’empreintes** accumule vos habitudes d’esquive et les rejoue. |
| Frôlement récompensé (`graze`, combo) | `game.js` | Devient le **paiement** de la prise de risque intellectuelle : rester dans la zone annoncée rapporte. |
| Reliquaire en deux temps (garde puis sceau) | `adventure.js · createRisk()` | Modèle exact des **minutes rendues** : une protection à ouvrir, puis un objet à prendre. |
| Sort spécial à recharge (`pulse`, `sunray`, `tidewave`) | `arsenal.js`, `adventure.js · tuning()` | Devient une **clé** (allumer, briser, souffler) autant qu’une arme. Arbitrage permanent. |

---

## 4. Bestiaire du monde 3

Huit formes nouvelles, deux par univers, plus un rappel rassurant par univers : **une forme du monde 2
conservée telle quelle** (`lampWisp`, `sunMirror`, `rootClock`, `sunLuggage`, `hourHollow`). Le joueur
retrouve toujours une règle connue à côté de la nouvelle.

### 4.1 `wickWarden` — Garde-mèche *(Faubourg des veilles)*

- **Héritage :** protecteur (`coven.js`) × halo sûr (`lanternier`).
- **Comportement :** descend lentement, allume une fenêtre, puis tient un halo de 150 px. Dans le halo,
  ses alliées prennent 55 % de dégâts en moins — **et les vôtres aussi**. Hors du halo, la salle est
  sombre : les télégraphes adverses n’y sont visibles qu’à 60 %.
- **Ce qu’il demande :** comprendre que le confort et l’efficacité sont opposés. Faut-il entrer et
  gratter, ou sortir et frapper la source à l’aveugle une fois son annonce repérée ?
- **Budget :** 0 projectile. Son seul danger est l’obscurité qu’il fabrique.

### 4.2 `waxCourier` — Facteur de cire *(Faubourg des veilles)*

- **Héritage :** leurre du vampire (M1) × écho annulable du facteur d’ombre (M2).
- **Comportement :** annonce **deux** zones : l’une pleine (réelle), l’autre pointillée (leurre). Les
  deux apparaissent en même temps, au même format. S’il est lié à un Garde-mèche vivant, tuer le
  Garde-mèche annule l’écho réel.
- **Ce qu’il demande :** lire avant de bouger. Le réflexe du monde 2 — foncer tuer la source — reste
  valable, mais il faut d’abord savoir laquelle des deux annonces est vraie.
- **Budget :** 1 écho, 1,3 s d’annonce, 4,6 s de cadence.

### 4.3 `bronzeCrow` — Corbeau de bronze *(Clocher muet)*

- **Héritage :** écho du chiffre creux (M2) × frôlement récompensé (M1).
- **Comportement :** marque votre position actuelle toutes les 4,4 s. L’écho tombe 1,3 s plus tard.
  **Rester dans la zone annoncée jusqu’à l’impact puis partir** compte comme frôlement et alimente le
  combo ; partir trop tôt ne rapporte rien.
- **Ce qu’il demande :** transformer une menace en revenu. Le joueur apprend à doser son départ.
- **Budget :** 1 écho, aucun projectile libre.

### 4.4 `crackedBell` — Cloche fêlée *(Clocher muet)*

- **Héritage :** lien de tisseuses (M1) × temps suspendu (M2).
- **Comportement :** toujours **par deux**, reliées par un fil visible. Chacune tire 1 projectile lent.
  Briser l’une **fige 1,5 s** les projectiles déjà en vol de l’autre, puis la survivante tire 2 au lieu
  de 1 (budget total inchangé : 2).
- **Ce qu’il demande :** l’ordre et le **moment** de la destruction. Tuer trop tôt gaspille la fenêtre ;
  attendre que l’autre ait tiré transforme la fenêtre en couloir sûr.
- **Budget :** 2 projectiles à elles deux, cadence 4,4 s.

### 4.5 `saltWalker` — Marcheuse de sel *(Estran des pas perdus)*

- **Héritage :** traînée d’ossements (M1) × mémoire du joueur (M2).
- **Comportement :** toutes les 4,4 s, elle solidifie **vos positions d’il y a 1,2 s** en une ligne de
  sel qui ralentit (même effet que la toile). Le sel reste 3 s.
- **Ce qu’il demande :** arrêter de tourner en rond. Le joueur qui oscille sur place se construit
  lui-même une prison ; celui qui trace une route large garde de la place.
- **Budget :** 0 projectile. Le danger, c’est le joueur.

### 4.6 `printThief` — Voleuse d’empreintes *(Estran des pas perdus)*

- **Héritage :** cicatrices du Veilleur (M1) × miroir de la Reine (M2).
- **Comportement :** enregistre la **direction** de vos esquives. Après trois dashes dans la même
  direction, elle envoie une onde **devant** vous, dans cette direction, annoncée 1,4 s. Varier remet
  son compteur à zéro ; le compteur est visible sous elle (1 à 3 marques).
- **Ce qu’elle demande :** surveiller sa propre habitude. C’est le monstre qui prépare au boss final.
- **Budget :** 1 onde, 2 projectiles maximum, cadence 4,4 s.

### 4.7 `wickPicker` — Cueilleuse de mèches *(Bois des lanternes)*

- **Héritage :** protecteur (M1) × prisme annulable (M2).
- **Comportement :** vole la flamme d’une lanterne du décor pour armer un prisme. Tant que la lanterne
  est éteinte, le prisme est annoncé mais inoffensif. **Rallumer la lanterne** (sort spécial) lui
  retire son arme — et vous coûte une charge de flamme.
- **Ce qu’elle demande :** dépenser pour désarmer, ou encaisser l’attaque en gardant sa puissance.
- **Budget :** 1 prisme, cadence 4,2 s.

### 4.8 `hollowFlame` — Flamme creuse *(Bois des lanternes)*

- **Héritage :** lanterne protectrice (M1) × lueur en spirale (M2).
- **Comportement :** objet vivant à double effet. **Allumée**, elle ouvre le passage et supprime les
  ralentissements autour d’elle, mais alimente le bouclier de la Cueilleuse. **Éteinte**, le passage
  se referme et la Cueilleuse redevient frappable.
- **Ce qu’elle demande :** alterner. Aucune des deux positions n’est bonne en permanence ; il faut
  tenir un rythme, et le rythme est lisible (anneau plein / anneau vide).
- **Budget :** 1 projectile en spirale, lent, cadence 4,2 s.

### 4.9 Supports du Cadran noir *(deux formes, univers 5)*

- `unnamedDigit` — **Chiffre sans nom** : hérite du chiffre creux (M2) et du langage des phases (M1).
  Il porte un chiffre de 1 à 5 et n’est frappable que lorsque la salle affiche ce chiffre. Mémorisation
  douce : la salle l’affiche en grand, aucune surprise.
- `facelessEcho` — **Écho sans visage** : hérite du miroir (M2) et des cicatrices (M1). Il rejoue la
  mécanique que vous avez **le plus utilisée dans la vague** (relais brisés, halos fréquentés, sel
  évité, flammes dépensées). Il ne fait jamais plus de dégâts que la forme copiée.

---

## 5. Structure des vagues (calquée sur le monde 2, donc implémentable)

Le monde 2 utilise déjà : vague 1 chasse + annonce, vague 2 libération, vague 3 survie 22 s, vague 4
ancres, vague 5 boss (`setupMission`, `waveBlocks`). Le monde 3 garde exactement cinq vagues et
remplace les objectifs :

| Vague | Objectif monde 2 | Objectif monde 3 | Ce qu’elle enseigne |
|---|---|---|---|
| 1 | Chasse + annonce du relais | **Lecture** : une seule règle, annoncée en clair | Le vocabulaire de l’univers |
| 2 | Libération 2 captives | **Rendre une minute** : ouvrir une protection puis prendre la minute (modèle du reliquaire) | La règle appliquée sous pression douce |
| 3 | Survie 22 s | **Tenue** : 22 s avec deux règles actives | Combiner sans paniquer |
| 4 | Détruire 2 ancres | **Inversion** : la règle apprise est inversée une fois, annoncée | Souplesse, pas par cœur |
| 5 | Boss | **Gardien** : condition de victoire unique (§6) | L’examen de l’univers |

Les **minutes rendues** — 3 par univers, 15 au total — restent l’objectif d’exploration. Elles ne
servent pas à finir le monde 3 : elles sont la première moitié de la condition de l’issue **Partager**
au monde 5.

---

## 6. Les cinq gardiens : cinq structures, pas cinq costumes

**Règle absolue :** aucun de ces cinq combats n’utilise `PV → 3 phases → phaseShield → salve + adds`.
Chacun a sa **jauge**, sa **condition de victoire**, son **échec doux** et sa **langue d’annonce**.

### 6.1 La Veilleuse — *le registre des fenêtres*

- **Jauge :** 5 fenêtres, allumées ou éteintes. **Pas de barre de vie.**
- **Boucle :** elle fait une tournée annoncée entre les fenêtres. Une mèche n’est frappable que
  pendant qu’elle la quitte (fenêtre de 1,6 s). Elle rallume une fenêtre toutes les 6 s.
- **Victoire :** les 5 mèches éteintes en même temps.
- **Échec doux :** si les 5 fenêtres sont allumées, la veille est complète : vous perdez un cœur, une
  mèche se rallume, le combat continue. Jamais de mort sèche.
- **Langue :** parcours en pointillé au sol + mèche qui blanchit quand elle devient frappable.
- **Ce qu’elle exige :** être au bon endroit au bon moment. Zéro projectile, deux escortes maximum.
- **Verbe :** *placer*.

### 6.2 Le Sonneur sans battant — *la ligne de tir*

- **Jauge :** résonance, 0 à 100. **Pas de barre de vie.**
- **Boucle :** le tir automatique est toujours actif. Chaque balle qui touche la cloche ajoute de la
  résonance ; à 100, une **seule** onde radiale lente part, puis la jauge retombe. Le battant descend
  2 s toutes les 8 s, **derrière** la cloche : pour le toucher sans faire sonner la cloche, il faut
  tirer depuis un angle, pas de face.
- **Victoire :** 3 frappes sur le battant.
- **Échec doux :** l’onde ne fait qu’un cœur et remet la jauge à zéro ; aucune accumulation.
- **Langue :** cône de tir materialisé au sol, cloche qui vibre visiblement à chaque impact.
- **Ce qu’il exige :** comprendre que **son propre tir automatique est le danger**. Aucune nouvelle
  touche : on résout tout en se déplaçant pour changer sa ligne de tir.
- **Verbe :** *se taire en tirant ailleurs*.

### 6.3 Le Passeur sans ombre — *la boucle de sable*

- **Jauge :** sable intact, 4 zones. **Pas de barre de vie.**
- **Boucle :** l’arène enregistre vos 12 dernières secondes et les rejoue sous forme d’un fantôme qui
  refait exactement votre trajet. Vos empreintes restent visibles. Tant que vous restez dans vos
  traces, le Passeur est intangible. Poser le pied sur du **sable intact** ouvre la boucle 2 s : il
  devient solide.
- **Victoire :** 3 brisures pendant une ouverture.
- **Échec doux :** croiser son propre fantôme coûte un cœur, sans réinitialiser le sable.
- **Langue :** empreintes sombres = déjà foulées, sable clair = intact ; le fantôme est translucent.
- **Ce qu’il exige :** de la mémoire spatiale et l’arrêt de l’oscillation. C’est l’aboutissement du
  sel de l’Estran, et l’héritier direct du Cerf des heures — mais inversé : là où le Cerf vous
  punissait de rester, le Passeur vous punit de revenir.
- **Verbe :** *ne pas se répéter*.

### 6.4 La Cueilleuse de flammes — *le prêt*

- **Jauge :** votre flamme, 3 charges, et 3 lanternes suspendues. **Pas de barre de vie.**
- **Boucle :** allumer une lanterne coûte **une charge de flamme** et retire un tiers de votre cadence
  de tir. Elle vient éteindre les lanternes allumées, sur trajet annoncé. Quand les 3 brûlent ensemble,
  elle est obligée de venir les cueillir : elle est frappable 3 s.
- **Victoire :** 3 cueillettes forcées.
- **Récupération :** à 0 charge, une mèche tombe du décor ; la reprendre rend une charge. Aucune
  impasse, aucun game over sur la ressource.
- **Langue :** anneau de flamme autour du personnage, 1 à 3 traits ; lanternes pleines ou vides.
- **Ce qu’elle exige :** accepter de devenir plus faible pour avancer. Le seul boss du jeu où
  **progresser réduit les dégâts du joueur**.
- **Verbe :** *donner*.

### 6.5 Le Chasseur sans visage — *l’examen*

- **Jauge :** 3 emprunts. **Pas de barre de vie.**
- **Boucle :** il lit les statistiques du vol en cours (`Journey.run.stats`) et équipe les **deux
  mécaniques du monde 3 que vous avez le plus utilisées**. Il les retourne contre vous, une par une,
  chacune annoncée par la phrase du gardien dont elle vient. Après le troisième emprunt, il n’a plus
  de forme : il ne peut plus copier que ce que vous n’avez **pas** utilisé.
- **Victoire :** exécuter le geste qu’il n’a pas pu copier — la mécanique délaissée du monde 3. Le
  jeu l’affiche en clair, il n’y a rien à deviner.
- **Échec doux :** un emprunt raté recommence l’emprunt, il ne réinitialise pas le combat.
- **Langue :** il prend la silhouette et la couleur du gardien emprunté, puis devient un contour vide.
- **Ce qu’il exige :** de la variété sur tout le monde, pas de la maîtrise d’une seule astuce. C’est
  le seul boss du jeu qui **lit la partie du joueur**.
- **Verbe :** *se reconnaître*.

### Matrice d’unicité (contrôle de non-redondance)

| Boss | Jauge | Victoire | Source du danger | Interaction clé | Adds |
|---|---|---|---|---|---|
| La Veilleuse | 5 fenêtres | Tout éteindre | L’obscurité | Placement + fenêtre de 1,6 s | 2 |
| Le Sonneur | Résonance | 3 frappes | **Votre propre tir** | Ligne de tir | 0 |
| Le Passeur | Sable intact | 3 brisures | **Votre propre trajet** | Mémoire spatiale | 0 |
| La Cueilleuse | 3 charges | 3 cueillettes | Votre appauvrissement | Dépense volontaire | 0 |
| Le Chasseur | 3 emprunts | Geste non copié | **Vos habitudes** | Variété sur le monde | 0 |

Aucune ligne ne partage sa condition de victoire, sa jauge ni sa source de danger avec une autre.
Trois des cinq boss ne tirent **jamais**.

---

## 7. Courbe de difficulté

| Univers | Ennemis simultanés | Projectiles/salve | Cadence | Vitesse | Décisions simultanées | Nouveauté cognitive |
|---|---|---|---|---|---|---|
| 1 · Faubourg | 4 | 1 | 4,6 s | 130 | **1** | Lire un double télégraphe |
| 2 · Clocher | 5 | 1–2 | 4,4 s | 135 | **2** | Choisir l’ordre et l’instant |
| 3 · Estran | 5 | 2 | 4,4 s | 140 | **2** | Gérer sa propre trace |
| 4 · Bois | 6 | 2 | 4,2 s | 145 | **3** | Dépenser sa puissance |
| 5 · Cadran | 6 | 2 | 4,2 s | 150 | **3** | Tout, plus l’inversion |
| *Référence monde 2* | *6* | *1–2* | *3,5–5,6 s* | *125–155* | *1–2* | *relais + effets* |

La progression est **entièrement portée par la colonne « décisions simultanées »**. Toutes les
colonnes quantitatives restent à la valeur du monde 2 ou en dessous.

### Garde-fous

- **Règle annoncée** : chaque univers ouvre par une phrase courte, comme le monde 2 (`RELAIS · …`).
- **Indice après deux échecs** : si le joueur échoue deux fois au même objectif, l’indice passe de
  visuel à textuel. Aucune aide n’est donnée d’emblée.
- **Échec doux partout** : une erreur de lecture coûte du temps ou un cœur, jamais la partie.
- **Aucune nouvelle commande** : déplacement, visée, sort spécial, esquive. Le sort spécial sert de clé.
- **Lisibilité mobile** : un télégraphe = une forme + une couleur, jamais la couleur seule ; taille
  minimale des zones reprise du monde 2 ; le HUD reste hors de la zone de jeu.
- **Plafond dur** : si une mécanique devait dépasser 6 ennemis ou 2 projectiles par salve, c’est la
  mécanique qui change, pas le plafond.

---

## 8. Intégration dans le code

| Besoin | Ancrage vérifié | Note |
|---|---|---|
| Nouvel univers | `sequel.js · secondWorlds` | Ajouter `thirdWorlds`, mêmes clés (`name`, `short`, `colors`, `moon`, `boss`, `kind`, `foes`, `hour`). |
| Monde actif | `sequel.js · activeWorld=id===2?2:1`, `applyWorld`, `drawBackground`, `hunterActive`, `sequelHUD` | Le clamp à 2 est le principal obstacle. |
| Bestiaire | `sequel-bestiary.js · foeNames`, `customKinds`, `moveEnemy` | Nouveau module `third-bestiary.js` sur le même modèle, actif si `activeWorld===3`. |
| Héritage des mécaniques | `coven.js · protector`, `night-hazards.js · moveBoss`, `sequel-bestiary.js · addEffect/pastPlayer` | Réutiliser les fonctions existantes plutôt que les recopier : l’héritage doit être réel dans le code. |
| Vagues et objectifs | `sequel-bestiary.js · setupMission`, `waveBlocks`, `missionText` | Mêmes cinq vagues, objectifs du §5. |
| **Boss sans barre de vie** | `sequel-bestiary.js · moveBoss`, `game.js · drawBossHealth`, `updateHUD` | Il faut une **jauge alternative** : c’est le seul vrai chantier technique du monde 3. Prévoir `boss.gauge` et un rendu dédié, `boss.max` restant inutilisé. |
| Boss qui lit le joueur | `Journey.run.stats`, `League.event` | Compteurs à ajouter : relais brisés, halos fréquentés, sel évité, flammes dépensées. |
| Minutes rendues | `sequel.js · hourObjective`, `tickHourObjective` | 3 par univers, 15 au total, persistées pour le monde 5. |
| Plafonds | `sequel-bestiary.js · reinforce()` (6), `game.js · shootHostile` | Constants de budget explicites pour le monde 3, testées. |
| Drapeaux | `sequel.js · blank/normalize/validateSave` | `world3Unlocked`, `world3Started`, `world3Completed`, `minutesKept`. |
| Garde-fous de test | `tests/` | Un test asserting : ≤6 ennemis, ≤2 projectiles/salve, cadence ≥4,2 s, **aucun** boss du monde 3 en courbe de vie, 5 conditions de victoire distinctes. |

---

## 8bis. Révision après retour en jeu

Quatre corrections demandées explicitement, qui **remplacent** les contraintes initiales correspondantes :

1. **Décors vus de dessus.** Les peintures en perspective sont remplacées par des vues orthographiques (caméra à la verticale, sans horizon), en portrait pour le défilement vertical.
2. **Bug de tir corrigé.** `tickFlame` remontait `player.fire` à chaque image : dès la première flamme dépensée, le délai ne redescendait jamais à zéro et la sorcière cessait de tirer. Le ralentissement est désormais un facteur appliqué à l'armement du tir (`fireDelay`, borné à ×1,66), jamais pendant l'attente.
3. **Plus de monstres, et ils tirent tous.** Budgets relevés : 8 → 12 ennemis, 2 → 4 projectiles par salve, cadence 2,8 → 2,0 s, vitesse 150 → 190. Chaque forme tire une salve à chaque cycle et garde sa mécanique signature un cycle sur deux.
4. **Mécanisme rendu compréhensible.** Bandeau d'objectif permanent hors canvas, mots **DANGER** / **LEURRE** écrits sur les cercles, suppression de l'inversion de la vague 4, Chiffre sans nom simplement **FAIBLE ×2** au lieu d'immunisé, mention **PROTÉGÉ ½ dégâts**, et réponse **INSENSIBLE ·** + marche à suivre quand on tire sur un gardien.

## 9. Ce qui est vérifié par le test

`tests/test_sixth_hour.cjs` charge les vrais `game.js`, `online.js`, `journey.js`, `nemesis.js`,
`sequel.js` et `sixth-hour.js`, puis :

- fait tourner **la boucle de jeu réelle** 900 images par univers (1, 2, 4, 5) et 420 images avec un
  gardien : aucune exception, plafonds respectés (5 ennemis et 1 projectile maximum observés) ;
- vérifie que les dégâts n’entament **aucun** des cinq gardiens et que le HUD affiche leur jauge ;
- rejoue chaque condition de victoire (mèches, battant, sable, flamme, emprunts) ;
- contrôle les héritages : halo protecteur, relais annulable, leurre plein/pointillé, inversion de
  vague 4, lien des cloches qui fige les tirs, sel sur la position passée ;
- valide la chaîne 1 → 2 → 3, le briefing sans boucle, les 15 minutes et la rétro-compatibilité des
  sauvegardes.

## 9bis. Direction artistique livrée

- **Cinq décors peints distincts** (`scenery/sixth-*.jpg` → `sixth-scenery.js`) :
  le monde 3 ne réutilise plus les peintures du monde 1. `SixthScenery.pick(stage)`
  s'efface hors du monde 3, donc mondes 1 et 2 et courses hebdomadaires sont intacts.
- `applyWorld` vide déjà `terrainCache` et `backgroundGradientCache` : le changement
  de monde ne peut pas laisser le décor précédent en mémoire.
- **Quinze silhouettes SVG** (`sixth-hour-art.js`), une par forme et une par gardien,
  plus deux couches Canvas pilotées par l'état du combat (`e.lit`, `e.dashRun`,
  `e.twin`, `boss.windows`, `boss.strikes`, `boss.breaks`, `boss.lanterns`,
  `boss.borrowed`, `boss.halo`). Aucune hitbox modifiée, aucun anneau de lisibilité
  supprimé : les télégraphes de jeu restent dessinés par `sixth-hour.js`.
- Deux défauts de rendu trouvés en rastérisant les sprites, corrigés et verrouillés
  par le test : pointes rognées par le viewBox, et dégradés dégénérés sur les traits
  parfaitement horizontaux ou verticaux (invisibles en navigateur).

![Aperçu des cinq univers](apercu-monde-3.jpg)

## 10. Découpage de livraison (historique)

1. **Socle** : `activeWorld===3`, `thirdWorlds`, jauge de boss alternative, plafonds de budget + tests.
2. **Univers 1 + La Veilleuse** : Garde-mèche, Facteur de cire, vague d’inversion, minute rendue.
   C’est la tranche qui valide tout le principe — jouable de bout en bout.
3. **Univers 2 + Le Sonneur** (ligne de tir), puis **3 + Le Passeur** (sable).
4. **Univers 4 + La Cueilleuse** (économie de flamme).
5. **Univers 5 + Le Chasseur** (lecture du joueur) et la révélation des Introuvables.
6. Épilogue du monde 2 et carte « La Sixième Heure », pour que l’enchaînement soit lisible.

Chaque tranche est jouable et testable séparément ; aucune n’attend les suivantes.
