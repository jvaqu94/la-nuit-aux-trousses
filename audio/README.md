# Musiques et arrivées des monstres

Le jeu utilise douze MP3 locaux, stéréo, 44,1 kHz. Aucun service musical n’est nécessaire pendant le jeu.

| Fichier | Univers / fonction |
|---|---|
| `nuitsorc-loop.mp3` | Thème fourni pour la page d’accueil, utilisé sans réencodage |
| `forest.mp3` | Murmures de bruyère — forêt |
| `cemetery.mp3` | Cloches de l’oubli — cimetière |
| `castle.mp3` | Valse carmin — château |
| `marsh.mp3` | Rondes des limons — marais |
| `lanterns.mp3` | Farandole des ombres — fête des lanternes |
| `arrival-*.mp3` | Arrivée des créatures ordinaires dans chaque univers |
| `boss-arrival.mp3` | Arrivée des gardiens, utilisée sans réencodage |

## Thème et adaptations

`nuitsorc-loop.mp3` et `boss-arrival.mp3` ont été fournis par l’auteur du projet. Les cinq mondes reprennent la matière orchestrale du thème d’accueil au lieu d’utiliser les anciennes boucles synthétiques : choix et ordre des phrases de quatre mesures, raccords, filtrage, largeur stéréo, chorus ou réverbération selon l’univers.

Les adaptations sont encodées en 192 kbit/s. Leur tempo et leur tonalité varient ensemble dans Web Audio, comme une variation de bande, afin de ne pas déphaser les canaux : forêt 1,00 ; cimetière 0,88 ; château 1,02 ; marais 0,94 ; lanternes 1,08. Pendant un gardien, le thème du monde accélère encore de 8 % et le signal `boss-arrival.mp3` passe par le bus des effets avec une courte atténuation de la musique.

## Attribution des échantillons d’arrivée

Les cinq arrivées ordinaires utilisent des échantillons **FluidR3_GM**, distribués dans le projet [**midi-js-soundfonts**](https://github.com/gleitz/midi-js-soundfonts) sous licence [**Creative Commons Attribution 3.0**](https://creativecommons.org/licenses/by/3.0/). Les adaptations de ces échantillons comprennent la sélection des notes, la transposition, le mixage, la spatialisation, la réverbération et l’encodage MP3.

Cette attribution concerne les arrivées ordinaires ; elle ne s’applique pas aux deux fichiers fournis par l’auteur ni aux adaptations du thème d’accueil.

## Régénération des mondes

Les MP3 finis sont déjà inclus. Pour reconstruire uniquement les cinq adaptations :

```bash
python -m pip install numpy scipy soundfile lameenc
python tools/generate_music.py
```

Le script lit `audio/nuitsorc-loop.mp3` et ne réencode ni le menu, ni l’arrivée du boss, ni les arrivées ordinaires. La compilation de `lameenc` peut nécessiter un compilateur C.
