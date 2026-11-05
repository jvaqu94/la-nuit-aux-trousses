# La Nuit aux Trousses — saga en 5 mondes

Document de référence narratif. Remplace l’arc « fin du Veilleur au monde 3 » de la première version de
`histoire-monde-3.md` : la résolution est déplacée au **monde 5**, pour que les cinq mondes s’imbriquent
au lieu de se succéder.

- Bestiaire, boss et courbe de difficulté du monde 3 → `docs/monde-3-gameplay.md`
- Chapitre détaillé du monde 3 (univers, dialogues, carte) → `docs/histoire-monde-3.md`

---

## 1. La règle d’imbrication

Chaque monde **rend jouable la conséquence du précédent**. Trois fils passent d’un monde à l’autre,
et aucun n’est abandonné en route :

| Fil | Question posée | Réponse partielle |
|---|---|---|
| **La chasse** | Pourquoi le Veilleur poursuivait-il la sorcière ? | M1 la pose, M3 la retourne, M5 la solde. |
| **L’heure manquante** | Où est passée la sixième heure ? | M2 la révèle, M3 l’ouvre, M4 la peuple, M5 la nomme. |
| **La lanterne** | À qui est la flamme du Veilleur ? | M1 l’allume, M2 la fait baisser, M3 en révèle le prêt, M4 en fait une dette, M5 la rend. |

Et une règle de gameplay identique : **chaque monde hérite des mécaniques du précédent et n’en ajoute
qu’une seule.** Le monde 5 est l’examen des quatre autres. Rien n’est jetable.

---

## 2. Les cinq mondes

### Monde 1 — La Nuit aux Trousses *(existant)*

Halloween. Une sorcière traverse cinq univers et abat cinq gardiens avant l’aube. Un chasseur à la
lanterne, **le Veilleur**, la poursuit à chaque avant-dernière vague. À la fin, il baisse son arme :
le joueur choisit de l’emmener voir l’aube ou de le laisser veiller.

**Ce que le monde 1 lègue :** la chasse, les formations (meneur, protecteur, tisseuses), les charges
télégraphiées et leurs leurres, le frôlement récompensé, les reliquaires scellés.
**Graine à ajouter (une réplique, zéro gameplay) :** la Comtesse de minuit, en phase 2 —
« Je ne compte plus mes nuits, sorcière. Je vis dans une heure qu’aucun cadran n’a jamais comptée. »

### Monde 2 — Les Cinq Heures Perdues *(existant)*

L’aube s’est figée. **L’Horloger** a volé cinq heures de la nuit pour installer un jour permanent.
La sorcière n’est plus une proie : elle aide le Veilleur à rétablir le cycle. Cinq mondes de jour
immobile, cinq heures à reprendre, trois fragments d’heure par exploration.

**Ce que le monde 2 lègue :** les **relais** (une source arme une alliée ; tuer la source annule son
attaque), les effets télégraphiés (écho, racine, rayon, convoi, aiguille, halo sûr), la **mémoire du
joueur** (on frappe là où il était), le temps suspendu et le rembobinage, les missions de vague
(libération, survie, ancres).
**Fin à écrire (elle manque dans le code) :** l’Horloger, à genoux, ne se défend pas —
« Je n’en ai pris que cinq. Il en reste une. Je ne l’ai jamais trouvée. »
Ce soir-là, la lanterne du Veilleur baisse pour la première fois.

### Monde 3 — La Sixième Heure *(implémenté — voir `monde-3-gameplay.md`)*

Le cycle est réparé, mais il reste une couture entre la dernière heure et la première : une heure
sans chiffre et sans cloche. **On y a tous couru au moins une fois.** La sorcière et le Veilleur y
entrent pour la retrouver avant qu’elle ne reprenne ce qu’elle a prêté.

Cinq univers, cinq gardiens qui **ne se combattent pas de la même façon** : on n’y gagne pas en
vidant une barre de vie mais en tenant un registre, en se taisant, en brisant une boucle, en
dépensant sa propre flamme, en se reconnaissant.

**Révélation de fin (moteur du monde 4) :** la sixième heure n’est pas un voleur, c’est un
**registre**. Elle garde la trace de tout ce qui n’a jamais été rattrapé. Et elle n’est pas vide :
des gens y vivent. Ceux qui ont échappé à une chasse, une nuit, et qui n’ont jamais été retrouvés.
**Les Introuvables.**
**Dernière image :** dans le Bois des lanternes rendues, toutes les lanternes sont éteintes sauf une.
La Cueilleuse montre l’allée : « Celle-ci n’est pas la seule à ne pas avoir été rapportée. Regarde
plus loin. » Il y en a des centaines, au fond du bois. Toutes allumées.

**Ce que le monde 3 lègue :** la **décision** comme difficulté — ordre de destruction, fenêtres de
silence, gestion de sa propre trace, dépense de sa propre puissance. Voir `monde-3-gameplay.md`.

### Monde 4 — La Veillée des Introuvables

Dans l’heure non comptée vit une ville de gens qui n’ont jamais été rattrapés : déserteurs, enfants
partis la nuit d’Halloween, proies du Veilleur, veilleurs eux-mêmes. Ils n’ont pas d’heure à eux :
ils vivent de celle des autres, comme lui.

L’**Ordre des Veilleurs** n’était pas une police : c’était un **service du registre**. Compter les
introuvables pour que l’heure reste solvable. Son émissaire, **Le Registre**, vient solder les comptes :
rendre chaque introuvable à l’heure qui l’a prêté — c’est-à-dire les effacer.

Le Veilleur découvre qu’il a été fabriqué pour ça, et que la sorcière de la nuit d’Halloween était un
nom sur sa liste. Elle n’a pas été chassée par hasard : **elle était la dernière ligne.**

**Nouveau verbe du monde 4 :** *protéger quelqu’un d’autre que soi.* On escorte, on couvre, on choisit
qui l’on peut garder. Les mécaniques du monde 3 reviennent retournées : ce n’est plus votre trace qu’il
faut gérer, c’est celle d’un fragile ; ce n’est plus votre flamme qu’il faut dépenser, c’est la sienne.
**Fin :** le Registre est brisé. Sans registre, l’heure ne se referme plus : elle déborde. Les Introuvables commencent à apparaître en plein jour, et la nuit, elle, se met à perdre ses heures une
par une — cette fois sans personne pour les voler.

### Monde 5 — L’Heure aux Trousses

Il faut donner un statut à la sixième heure, sinon elle emporte le cycle qu’on a réparé au monde 2.
Trois gestes possibles, et un seul peut être fait. Le titre du jeu est enfin payé : « aux trousses »
n’était pas une expression, c’était un nom d’heure.

Les trois issues, déplacées ici depuis la première version du document :

| Issue | Geste | Prix | Condition |
|---|---|---|---|
| **Rendre** | Inscrire l’heure au cadran | Une heure inscrite exige un veilleur : le Veilleur prend le poste et ne le quitte plus. | Aucune |
| **Éteindre** | Souffler la flamme | Plus de poursuite, plus d’introuvables : ils s’effacent avec l’heure. Le Veilleur aussi. | Aucune |
| **Partager** | La passer ensemble | Une heure occupée volontairement n’a plus besoin de courir. Elle devient celle qu’on passe avec quelqu’un. | Les **minutes rendues** des mondes 3 et 4 |

Dernière réplique, selon le choix fait au **Serment de l’Aube** dès le monde 1 :

- `dawn` — « Pour une fois, je la regarderai. » Ils restent jusqu’à ce que le ciel change de couleur.
- `night` — « À la prochaine nuit, sorcière. » Il retourne vers ceux qui restent, mais sa lanterne,
  désormais, est à lui.

**Boss final :** le Chasseur sans visage, qui n’a jamais eu d’autre forme que celle des gens qu’il a
fait courir. Il emprunte, dans l’ordre, les mécaniques des quatre mondes précédents. On ne le bat pas
en dégâts : on lui donne ce qu’il n’a jamais eu — un nom, une place, ou un adieu.

---

## 2bis. Tester sans tout rejouer

Espace **Test du créateur** (administrateur de la team, page Compte) → champ **Code** :
`Monde2` ouvre la rencontre et les Cinq Heures Perdues, **`Monde3`** débloque la chaîne complète
et propose **Tester le monde 3**. Aucun score ni résultat n’est fabriqué.

## 3. Table d’imbrication (ce que chaque monde reprend)

| Monde | Hérite de | Ajoute un verbe | Ouvre le suivant par |
|---|---|---|---|
| 1 · Halloween | — | **Traverser** | La chasse sans motif + la réplique de la Comtesse |
| 2 · Heures perdues | formations, charges, leurres, frôlement | **Récupérer** (relais, mémoires, temps) | « Il en reste une. » |
| 3 · Sixième heure | relais, halos, échos, trace du joueur, leurres | **Décider** (ordre, silence, trace, dépense) | Les Introuvables |
| 4 · Veillée | tout le monde 3, retourné vers autrui | **Protéger** | L’heure déborde |
| 5 · Heure aux trousses | les quatre verbes, dans un seul combat | **Nommer** | — |

---

## 4. Ce qui change dans `histoire-monde-3.md`

1. Les trois issues (§7) **ne sont plus à la fin du monde 3** : elles concluent le monde 5.
2. Le monde 3 se termine sur la révélation des Introuvables (§2 ci-dessus), pas sur le sort du Veilleur.
3. La dette de flamme du Veilleur n’est pas payée au monde 3 : elle est **reconnue**. C’est ce qui
   rend le monde 4 nécessaire.
4. Les « minutes rendues » du monde 3 ne servent plus à une fin immédiate : elles sont la première
   moitié de la condition de l’issue **Partager** au monde 5.

Le reste du chapitre (cinq univers, gardiens, dialogues, carte « La Sixième Heure ») est inchangé et
reste valable.
