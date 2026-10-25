# Musiques, tirs et impacts

Le jeu utilise les boucles musicales, les signaux d’arrivée et huit effets de combat MP3 locaux. Aucun service musical n’est nécessaire pendant le jeu.

| Fichier | Univers / fonction |
|---|---|
| `nuitsorc-loop.mp3` | Thème fourni pour la page d’accueil, utilisé sans réencodage |
| `forest.mp3` | Murmures de bruyère — forêt |
| `cemetery.mp3` | Cloches de l’oubli — cimetière |
| `castle.mp3` | Valse carmin — château |
| `marsh.mp3` | Rondes des limons — marais |
| `lanterns.mp3` | Farandole des ombres — fête des lanternes |
| `boss-forest.mp3` | Arrivée terrifiante de Jack, forêt |
| `boss-cemetery.mp3` | Arrivée terrifiante du fossoyeur, cimetière |
| `boss-castle.mp3` | Arrivée terrifiante de la comtesse, château |
| `boss-marsh.mp3` | Arrivée terrifiante de la tisseuse, marais |
| `boss-lanterns.mp3` | Arrivée terrifiante du dévoreur, lanternes |
| `sfx-player-shot.mp3` | Tir standard |
| `sfx-player-spread.mp3` | Tir renforcé ou triple tir |
| `sfx-player-missile.mp3` | Lancement des missiles guidés |
| `sfx-player-laser.mp3` | Rayon solaire |
| `sfx-player-special.mp3` | Sort spécial équipé |
| `sfx-impact-light.mp3` | Impact léger sur une créature |
| `sfx-impact-heavy.mp3` | Impact lourd ou élite |
| `sfx-impact-boss.mp3` | Impact sur un gardien |

## Nouvelles ambiances par monde

`nuitsorc-loop.mp3` a été fourni par l’auteur du projet. Les cinq boucles de monde ont été entièrement recomposées pour avoir une identité propre tout en conservant une finition cinématique cohérente avec le menu :

- **Forêt** : bois murmurants, harpe, cordes graves et clochettes cristallines, avec un motif mystérieux en ré mineur.
- **Cimetière** : célesta, cloches lointaines, piano feutré et cordes suspendues, dans une couleur élégiaque en mi mineur.
- **Château** : valse gothique de cordes, clavecin, piano et violon dramatique, en sol mineur.
- **Marais** : basse liquide, clarinette basse, percussions syncopées et textures de roseaux, en la mineur.
- **Lanternes** : célesta spectral, pizzicati, marimba, clarinette et carillon, pour une fête inquiétante en do mineur.

Les nouvelles boucles sont encodées en 192 kbit/s, stéréo 44,1 kHz, avec un nettoyage des silences de fin et un fondu très court pour des transitions plus propres. Leur tempo et leur tonalité varient ensemble dans Web Audio, comme une variation de bande, afin de ne pas déphaser les canaux : forêt 1,00 ; cimetière 0,88 ; château 1,02 ; marais 0,94 ; lanternes 1,08. Pendant un gardien, le thème du monde accélère encore de 8 % et le stinger dédié passe par le bus des effets avec une courte atténuation de la musique.

## Attribution des échantillons d’arrivée

Chaque monde possède désormais un stinger de boss dédié : même palette instrumentale que son ambiance, mais avec une montée dissonante, une tension plus sombre et un impact final terrifiant. La musique du monde est brièvement atténuée pendant le stinger. Les sons d’arrivée des créatures ordinaires (`arrival-*.mp3`) restent retirés du gameplay afin de préserver la lisibilité sonore pendant les vagues.

## Effets de combat

Les effets de tir sont préchargés dès l’activation du son puis lus via le bus d’effets, avec une limite de voix simultanées pour éviter la saturation. Le tir standard, les salves, les missiles, le rayon et le sort spécial ont chacun leur timbre. Les impacts sont également différenciés selon la puissance du coup et le type d’ennemi ; un verrouillage temporel conserve la lisibilité pendant les salves et les rayons.

## Régénération des mondes

Les MP3 finis sont déjà inclus. Le script historique `tools/generate_music.py` reste disponible pour l’ancienne méthode d’adaptation du thème, mais les cinq fichiers distribués sont désormais les compositions dédiées décrites ci-dessus.

```bash
python -m pip install numpy scipy soundfile lameenc
python tools/generate_music.py
```

Le script lit `audio/nuitsorc-loop.mp3` et ne réencode ni le menu, ni l’arrivée du boss, ni les arrivées ordinaires. La compilation de `lameenc` peut nécessiter un compilateur C.
