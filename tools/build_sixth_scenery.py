#!/usr/bin/env python3
"""Régénère sixth-scenery.js depuis les peintures sources de La Sixième Heure.

Même convention que characters.js : les décors sont embarqués en base64 pour
que le jeu fonctionne sans requête réseau, y compris dans les éditions
autonomes. Les JPEG sources restent dans scenery/.

    python3 tools/build_sixth_scenery.py
"""
import base64
import io
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# L'ordre suit thirdWorlds dans sequel.js : ne pas le réordonner.
UNIVERSES = [
    ('faubourg', 'Le Faubourg des veilles'),
    ('clocher', 'Le Clocher muet'),
    ('estran', 'L’Estran des pas perdus'),
    ('lanternes', 'Le Bois des lanternes rendues'),
    ('cadran', 'Le Cadran noir'),
]
WIDTH = 768
QUALITY = 82


def encode(path):
    """Rééchantillonne et compresse : le canvas dessine déjà en 800 px de large."""
    try:
        from PIL import Image
    except ImportError:
        return path.read_bytes(), None
    with Image.open(path) as image:
        image = image.convert('RGB')
        if image.width > WIDTH:
            height = round(image.height * WIDTH / image.width)
            image = image.resize((WIDTH, height), Image.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
        return buffer.getvalue(), image.size


def main():
    entries, total = [], 0
    for slug, label in UNIVERSES:
        source = ROOT / 'scenery' / f'sixth-{slug}.jpg'
        if not source.exists():
            raise SystemExit(f'Décor manquant : {source}')
        data, size = encode(source)
        total += len(data)
        entries.append((label, base64.b64encode(data).decode('ascii')))
        print(f'{slug:10} {size or "source"} · {len(data) / 1024:.0f} Ko')

    head = """/* Décors peints de La Sixième Heure (monde 3).
   Fichier généré par tools/build_sixth_scenery.py depuis scenery/sixth-*.jpg.
   Chaque univers a sa peinture : le monde 3 ne réutilise aucun décor du monde 1.
   pick(stage) ne renvoie une image que lorsque le monde 3 est actif, afin de
   laisser les mondes 1 et 2 (et les courses hebdomadaires) intacts. */
(()=>{
'use strict';
const sources=[
"""
    body = ',\n'.join(
        f'/* {label} */\n"data:image/jpeg;base64,{payload}"' for label, payload in entries
    )
    tail = """
];
const images=sources.map(src=>{const image=new Image();image.src=src;return image});
const pick=stage=>{
 if(window.Campaign?.activeWorld!==3)return null;
 const index=Math.max(0,Math.min(images.length-1,Number(stage)||0));
 const image=images[index];
 return image?.complete&&image.naturalWidth?image:null;
};
window.SixthScenery={images,pick,get ready(){return images.every(i=>i.complete&&i.naturalWidth)}};
})();
"""
    target = ROOT / 'sixth-scenery.js'
    target.write_text(head + body + tail, encoding='utf-8')
    print(f'sixth-scenery.js · {target.stat().st_size / 1024:.0f} Ko '
          f'({total / 1024:.0f} Ko de JPEG, {len(entries)} univers)')


if __name__ == '__main__':
    main()
