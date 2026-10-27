from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
game = (ROOT / 'game.js').read_text()
hazards = (ROOT / 'night-hazards.js').read_text()
adventure = (ROOT / 'adventure.js').read_text()
package = (ROOT / 'tools' / 'package.py').read_text()

assets = (
    'audio/sfx-pickup-bonus.mp3',
    'audio/sfx-boss-dive.mp3',
    'audio/sfx-obstacle-hit.mp3',
    'audio/sfx-obstacle-break.mp3',
    'audio/sfx-chest-touch.mp3',
    'audio/sfx-chest-open.mp3',
    'audio/sfx-life-loss-clear.mp3',
    'audio/sfx-kill-ghost.mp3',
    'audio/sfx-kill-skull.mp3',
    'audio/sfx-kill-vampire.mp3',
    'audio/sfx-kill-spider.mp3',
    'audio/sfx-kill-demon.mp3',
)
for asset in assets:
    assert (ROOT / asset).exists(), asset

for key in ('pickup', 'bossDive', 'obstacleHit', 'obstacleBreak', 'chestTouch', 'chestOpen', 'lifeLossClear', 'killGhost', 'killSkull', 'killVampire', 'killSpider', 'killDemon'):
    assert f"{key}:" in game
    assert f"'{key}': 'audio/" in package

assert "playSfx('pickup',.62,.045)" in game
assert "playSfx('bossDive',.72,.18)" in hazards
assert "terrainHit?'obstacleCollision':'lifeLoss'" in game
assert "playSfx('lifeLossClear',.96,.08)" in game
assert "const killSfxByKind=" in game
assert "killSfxByKind[e.kind]||'killDemon'" in game
assert "playSfx('obstacleHit',.5,.045)" in game
assert "playSfx('obstacleBreak',.76,.08)" in game
assert "playSfx('chestTouch',.58,.12)" in game
assert "playSfx('chestOpen',.82,.18)" in adventure
