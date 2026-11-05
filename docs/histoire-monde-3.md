# Monde 3 — L’Heure aux Trousses

Chapitre narratif de la troisième campagne de **La Nuit aux Trousses**.
Rien n’est encore codé : ce document est le texte de référence, prêt à être intégré.

**Version 2 — alignée sur la saga en 5 mondes.** La résolution du sort du Veilleur a été déplacée
au monde 5 ; le monde 3 se termine désormais sur une révélation.

- Arc complet des 5 mondes et règle d’imbrication → `docs/saga-5-mondes.md`
- Bestiaire héritier, 5 boss structurellement différents, difficulté sans surenchère → `docs/monde-3-gameplay.md`

---

## 1. Ce que le jeu raconte déjà (canon à ne pas contredire)

| Élément | Établi par | Contenu |
|---|---|---|
| Monde 1 · la nuit d’Halloween | `game.js` (`worlds`) | Une sorcière traverse cinq univers — forêt des murmures, cimetière oublié, château des vampires, marais des sorcières, fête des ombres — et abat les cinq gardiens avant l’aube. |
| Le Veilleur | `nemesis.js` | Un chasseur à la lanterne la poursuit, vague 4 de chaque univers. Il garde ses marques d’un affrontement à l’autre. « Je t’ai trouvée, sorcière. » |
| Le Serment de l’Aube | `sequel.js` (`grimoireCard`, `renderFinalePanel`) | Dernière rencontre, arme baissée. Le joueur choisit : « Viens voir l’aube. » ou « Veille sur ceux qui restent. » Ce choix est sauvegardé (`progress.choice`). |
| Monde 2 · Les Cinq Heures Perdues | `sequel.js` (`briefing`, `secondWorlds`) | L’aube s’est figée après Halloween. L’Horloger a volé cinq heures de la nuit pour instaurer un jour permanent. La sorcière n’est plus une proie : elle aide le Veilleur à rétablir le cycle. Cinq mondes, cinq gardiens, une heure par monde, trois fragments d’heure par exploration. |
| Personnages jouables | `sequel.js` (`progress.character`) | La sorcière ou le Veilleur. |
| **Fin du monde 2** | `completeSecondWorld()` | **Non écrite.** Le code lève un drapeau, aucun texte. C’est le chaînon manquant. |

Deux dettes narratives sont donc ouvertes : **pourquoi le Veilleur chassait-il ?** et **que devient-il, maintenant qu’il n’a plus rien à chasser ?**
Le monde 3 rembourse les deux, et rend enfin son sens au titre du jeu.

---

## 2. Le fil conducteur

> Les cinq heures volées sont rendues. Le cadran est réparé. Mais entre la dernière heure et la première, il reste une couture : une sixième heure, sans chiffre et sans cloche, que l’Horloger n’a jamais pu voler parce qu’il n’a jamais su la trouver.
> C’est l’heure où l’on court après quelqu’un. **L’heure aux trousses.**
> Elle se réveille, elle réclame ce qu’on lui a pris — et la lanterne du Veilleur brûle avec une de ses flammes.

Trois raisons de tenir cette corde plutôt qu’un nouveau méchant :

1. **Elle explique le monde 1 sans le réécrire.** Le Veilleur ne chassait pas par cruauté : il travaillait, sans le savoir, pour une heure qui n’avait pas de nom. Ses répliques existantes restent vraies, elles prennent seulement un second fond.
2. **Elle donne un prix à la victoire du monde 2.** Réparer le cycle n’était pas gratuit : rendre une heure, c’est rendre aussi ce qu’elle prêtait.
3. **Elle paie le titre.** « Aux trousses » cesse d’être un jeu de mots : c’est le nom de l’heure manquante.

**Enjeu du monde 3 :** retrouver cette heure et comprendre ce qu’elle garde. La décision finale —
lui donner un chiffre, l’éteindre ou la partager — appartient au monde 5.

---

## 3. Le chaînon manquant : épilogue du monde 2

Texte court, à afficher après la victoire contre **L’Horloger de l’Aube**. Il ferme le monde 2 et ouvre le monde 3 sans coupure.

> **LA NUIT A REPRIS SA COURSE**
>
> Les cinq heures sont rentrées dans le cadran. La Ville sans ombres retrouve ses ombres, le désert redevient froid, l’Express s’arrête enfin dans une gare. L’aube a le droit de venir.
>
> L’Horloger, à genoux, ne se défend pas. Il regarde le cadran tourner et il dit une chose étrange : « Je n’en ai pris que cinq. Il en reste une. Je ne l’ai jamais trouvée. »
>
> Ce soir-là, la lanterne du Veilleur baisse pour la première fois.

---

## 4. Prologue du monde 3 (écran de briefing)

Même forme et même ton que le briefing du monde 2 : titre, trois phrases, une réplique, une règle.

> **TROISIÈME CAMPAGNE · LA SIXIÈME HEURE**
>
> # L’Heure aux Trousses
>
> Le cycle est réparé, et pourtant la nuit compte une heure de trop. Elle n’a pas de chiffre, pas de cloche, et tout le monde y a couru au moins une fois. C’est l’heure des poursuites. Elle se referme, et ce qu’elle tient encore doit être rendu — à commencer par la flamme du Veilleur.
>
> « Ma lanterne brûle avec une heure qui n’est pas à moi. Le jour où elle la reprend, il ne restera personne pour veiller. »
>
> *Pilotage, tir et esquive sont conservés. La faune est inédite : attentes, traces et flammes prêtées rythment les vagues. Chaque gardien a ses attaques télégraphiées. Trois minutes rendues récompensent l’exploration de chaque univers.*

**Carte de campagne 02 — La Sixième Heure** (grimoire) :

- *Verrouillée* : « Rends les cinq heures volées pour dévoiler cette carte. »
- *Débloquée* : « La chasse a cessé, mais l’heure qui la faisait courir n’a jamais été comptée. Elle veut un chiffre. Le Veilleur a sa flamme. Il ne reste qu’une nuit pour décider qui paiera. »

---

## 5. Les cinq univers

Même structure de données que `secondWorlds` : `name`, `short`, `colors`, `moon`, `boss`, `kind`, `foes`, `hour`.
Palette gothique du jeu principal, lune claire, lisibilité mobile inchangée.

### 5.1 Le Faubourg des veilles

- **Court :** FAUBOURG DES VEILLES · **Heure :** L’heure des fenêtres
- **Décor :** rues basses, fenêtres allumées une à une, cire qui coule des rebords, papillons de suif. `colors:['#2a2440','#141327','#4a3a5c']`, `moon:'#ffd9a0'`.
- **Gardienne :** **La Veilleuse** (`kind:'veilleuse'`) — elle porte une lampe par personne attendue.
- **Ce qui s’y joue :** ici, personne ne dort : chacun attend quelqu’un. L’heure sans nom s’est nourrie de ces attentes. La Veilleuse ne veut pas tuer la sorcière, elle veut la faire asseoir.
- **Réplique :** « Reste un peu. On attend tous quelqu’un, ici. »
- **Battement :** première preuve que l’heure ne poursuit pas par méchanceté : elle recueille ce qu’on lui laisse.

### 5.2 Le Clocher muet

- **Court :** CLOCHER MUET · **Heure :** L’heure qui n’a pas sonné
- **Décor :** bronze vert-de-gris, cloches fêlées, corbeaux de métal, ciel trop proche. `colors:['#1f3340','#101c26','#3c5a63']`, `moon:'#cfe6d8'`.
- **Gardien :** **Le Sonneur sans battant** (`kind:'sonneur'`) — il tire sur une corde qui ne sonne rien.
- **Ce qui s’y joue :** cette cloche devait sonner la sixième heure ; on ne lui a jamais forgé de battant. Faute de nom, l’heure a pris la forme de ce qui se passait en elle : des courses-poursuites.
- **Réplique :** « Je n’ai jamais sonné. Alors j’ai écouté courir. »
- **Battement :** la règle du monde est posée — **une heure sans nom prend la forme de ce qu’on y fait.** C’est la clé de la troisième fin.

### 5.3 L’Estran des pas perdus

- **Court :** ESTRAN · **Heure :** L’heure des traces
- **Décor :** marée basse, sable gris, empreintes qui se remplissent d’eau, varech et lanternes échouées. `colors:['#26333f','#111a24','#465a63']`, `moon:'#e8dcc0'`.
- **Gardien :** **Le Passeur sans ombre** (`kind:'passeur'`) — il franchit les traces comme on franchit un gué.
- **Ce qui s’y joue :** le sable garde toutes les foulées de toutes les poursuites. Celles du Veilleur, nuit après nuit. Et celles de la sorcière, la nuit d’Halloween.
- **Réplique :** « Tes traces y sont déjà. Retourne-toi. »
- **Battement :** le joueur revoit sa propre course du monde 1, dessinée au sol. Selon le choix fait au Serment de l’Aube, les dernières empreintes **s’arrêtent côte à côte** (`choice:'dawn'`) ou **repartent en sens inverse** (`choice:'night'`). Le passé du joueur devient un décor.

### 5.4 Le Bois des lanternes rendues

- **Court :** BOIS DES LANTERNES · **Heure :** L’heure des flambeaux rendus
- **Décor :** branches basses, des centaines de lanternes suspendues, éteintes ; une seule brûle encore. `colors:['#2b2338','#141020','#4b3a55']`, `moon:'#f4c98f'`.
- **Gardienne :** **La Cueilleuse de flammes** (`kind:'cueilleuse'`) — elle décroche les heures arrivées à terme.
- **Ce qui s’y joue :** les veilleurs retraités rendent ici leur lanterne quand leur heure est finie. Toutes sont rendues. Une manque : celle du Veilleur, allumée depuis trop longtemps avec une heure empruntée à la sixième.
- **Réplique :** « Toutes ces flammes ont été rapportées. Une seule manque à l’appel. La sienne. »
- **Battement :** la révélation. Le Veilleur ne meurt pas d’une blessure : il s’éteint parce qu’on lui reprend son prêt. Il le savait depuis le début du monde 2 et il n’a rien dit.

### 5.5 Le Cadran noir

- **Court :** CADRAN NOIR · **Heure :** L’heure aux trousses
- **Décor :** une salle ronde, un cadran sans chiffres, cinq encoches occupées et une sixième vide. `colors:['#1a1730','#0d0b1a','#3a2f52']`, `moon:'#fff0bd'`.
- **Gardien final :** **Le Chasseur sans visage** (`kind:'faceless'`) — l’heure elle-même, qui emprunte tour à tour la silhouette du Veilleur puis celle de la sorcière.
- **Ce qui s’y joue :** elle ne veut pas détruire la nuit. Elle veut être comptée. Trois phases : elle court comme le Veilleur, elle vole comme la sorcière, puis elle cesse d’emprunter et n’a plus de forme du tout.
- **Réplique :** « Personne ne m’a nommée. Alors j’ai pris vos courses. Donnez-moi un chiffre, ou je continue. »

---

## 6. Dialogues

Courts, dans la voix déjà installée : le Veilleur parle peu, au présent, sans lyrisme.

**Le Veilleur, à l’entrée de chaque univers**

| Univers | Réplique |
|---|---|
| Faubourg des veilles | « J’ai attendu ici. Je ne savais pas pour qui. » |
| Clocher muet | « Une cloche qui ne sonne pas, ça ne veut pas dire qu’il est minuit. » |
| Estran | « Ne regarde pas trop longtemps. On y voit tout. » |
| Bois des lanternes | « Elle est à moi depuis si longtemps que j’avais fini par y croire. » |
| Cadran noir | « Termine. Je tiendrai la lumière jusqu’au bout. » |

**Variantes selon le choix du Serment de l’Aube** (`progress.choice`)

- `dawn` — « Tu m’as promis une aube. Je viens la chercher, pas la fuir. »
- `night` — « Je veille sur ceux qui restent. Toi, va jusqu’au bout. »

**Variantes selon le personnage jouable** (`progress.character`)

- **Sorcière** — « Tu m’as chassée toute une nuit. Laisse-moi courir pour toi, cette fois. »
- **Veilleur** — « C’est ma flamme. C’est ma dette. Reste derrière moi. »

**La sorcière**, trois répliques maximum, pour ne pas casser son silence :

1. Après le Clocher muet : « Une heure sans nom. Et si on lui en donnait un ? »
2. Après le Bois des lanternes : « Tu ne me l’as pas dit. » — « Tu serais venue quand même. »
3. Au Cadran noir : « On ne rend pas une heure. On la passe. »

---

## 7. La fin du monde 3 — la révélation

Le Chasseur sans visage est vaincu, mais il ne meurt pas : il n’a jamais été vivant. Une fois ses
trois emprunts rendus, il ne reste qu’un contour, et le contour parle.

> **ELLE N’EST PAS VIDE**
>
> « Vous m’avez appelée une heure perdue. Je ne perds rien. Je garde.
> Tout ce qui n’a jamais été rattrapé est chez moi. Vos courses y sont, vos attentes aussi.
> Et ceux qui vous ont échappé y vivent encore. »
>
> Le Cadran noir s’ouvre sur le Bois des lanternes rendues. Toutes les lanternes sont éteintes, sauf
> une — celle du Veilleur. La Cueilleuse montre l’allée, plus loin.
>
> « Celle-ci n’est pas la seule à ne pas avoir été rapportée. Regarde plus loin. »
>
> Au fond du bois, il y en a des centaines. Toutes allumées.

**Ce que le joueur comprend :** la sixième heure n’est pas un voleur, c’est un **registre**. Elle
conserve la trace de tout ce qui n’a pas été rattrapé — et elle est habitée. Ceux qui ont échappé à une
chasse, une nuit, et qu’on n’a jamais retrouvés : **les Introuvables**.

**Ce qui n’est pas résolu :** la flamme du Veilleur est seulement *reconnue* comme un prêt. Personne
ne la lui reprend encore. C’est ce qui rend le monde 4 nécessaire.

**Carte de campagne 03 — La Veillée** *(débloquée à la fin du monde 3)* :
« Ils n’ont pas d’heure à eux. Ils vivent de celle des autres, comme lui. L’Ordre les compte encore. »

Les trois issues **Rendre / Éteindre / Partager** concluent le **monde 5** : voir `saga-5-mondes.md`.
Les **minutes rendues** du monde 3 en sont la première moitié de la condition.

---

## 8. Graine à semer dans le monde 1 (facultatif, rétro-compatible)

Une seule réplique, à ajouter à **La comtesse de minuit** (château des vampires, troisième univers du monde 1). Elle ne change rien au gameplay et éclaire tout le monde 3 :

> « Je ne compte plus mes nuits, sorcière. Je vis dans une heure qu’aucun cadran n’a jamais comptée. »

Dite en phase 2, elle transforme un boss de milieu de course en première mention de la sixième heure. Les joueurs qui refont le monde 1 après le monde 2 la comprennent différemment — c’est le meilleur retour sur investissement narratif du projet.

---

## 9. Si « troisième monde » désignait le château des vampires

Le texte ci-dessus reste valable : le château devient le lieu où la sixième heure est mentionnée pour la première fois. Ajouts possibles, tous dans le thème actuel :

- **Univers 3 du monde 1 — Le château des vampires, « Valse carmin ».** Salle de bal, vitraux, portraits, lustres qui tombent en zone télégraphiée. La Comtesse ne règne pas sur le château : elle s’y abrite, parce qu’une heure non comptée ne peut pas la trouver.
- **Réplique de la Comtesse en phase 3 :** « Tu veux me tuer ? Commence par me trouver une heure où je puisse mourir. »
- **Après sa défaite**, une ligne sobre, sans cinématique : « Elle s’éteint en regardant le cadran. Aucune heure n’y manquait. »

---

## 10. Points de branchement dans le code (pour l’intégration, plus tard)

Repérés dans l’état actuel du dépôt — aucun n’est modifié à ce stade.

| Besoin | Fichier / ancrage | Note |
|---|---|---|
| Épilogue du monde 2 | `sequel.js` · `completeSecondWorld()` | Lever le drapeau **puis** afficher le texte du §3. |
| Nouveaux univers | `sequel.js` · `secondWorlds` | Ajouter `thirdWorlds` avec les mêmes clés (`hour` compris). |
| Drapeaux de progression | `sequel.js` · `blank()`, `normalize()`, `validateSave()` | `world3Unlocked`, `world3Started`, `world3Completed`, `cardSixthHour` ; les listes de booléens sont explicites, penser aux trois. |
| Monde actif | `sequel.js` · `activeWorld=id===2?2:1`, `applyWorld`, `drawBackground`, `hunterActive`, `sequelHUD` | Le clamp à 2 est le seul vrai obstacle technique. |
| Briefing | `sequel.js` · `briefing()` | Texte du §4, choix du personnage conservé. |
| Objectif d’exploration | `sequel.js` · `hourObjective`, `tickHourObjective` | 3 collectibles par univers : ce sont les **minutes rendues**, condition de l’issue C. |
| Accueil et sélecteur | `sequel.js` · `customizeHome()` | Bouton `3 · Sixième heure`, sous-titre, reprise par défaut. |
| Carte de campagne | `sequel.js` · `grimoireCard()` | Carte 02 « La Sixième Heure ». |
| Fin à choix | `sequel.js` · `beginFinale`, `renderFinalePanel`, `chooseFinale` | Réutiliser la scène sans dégâts ; trois boutons au lieu de deux, le troisième conditionnel. |
| Réplique de la Comtesse | `game.js` · `bossAttack` (branche `kind==='vampire'`) | Phase 2, un `say()` suffit. |
| Garde-fous | `tests/` + `index.html` (cache) + `tools/package.py` | Un test de campagne, bump de cache, régénération des HTML autonomes. |

---

## 11. Résumé en une phrase

**Monde 1 :** on la chasse. **Monde 2 :** ils réparent la nuit ensemble. **Monde 3 :** on découvre
qui le faisait courir, et que l’heure manquante est habitée. **Monde 4 :** il faut protéger ceux qui
y vivent. **Monde 5 :** il faut décider qui paie.
