from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
game = (ROOT / 'game.js').read_text()
hazards = (ROOT / 'night-hazards.js').read_text()
adventure = (ROOT / 'adventure.js').read_text()
package = (ROOT / 'tools' / 'package.py').read_text()

for asset in (
    'audio/sfx-pickup-bonus.mp3',
    'audio/sfx-boss-dive.mp3',
    'audio/sfx-obstacle-hit.mp3',
    'audio/sfx-obstacle-break.mp3',
    'audio/sfx-chest-touch.mp3',
    'audio/sfx-chest-open.mp3',
):
    assert (ROOT / asset).exists(), asset

assert "pickup:'audio/sfx-pickup-bonus.mp3'" in game
assert "bossDive:'audio/sfx-boss-dive.mp3'" in game
assert "obstacleHit:'audio/sfx-obstacle-hit.mp3'" in game
assert "obstacleBreak:'audio/sfx-obstacle-break.mp3'" in game
assert "chestTouch:'audio/sfx-chest-touch.mp3'" in game
assert "chestOpen:'audio/sfx-chest-open.mp3'" in game
assert "playSfx('pickup',.62,.045)" in game
assert "playSfx('bossDive',.72,.18)" in hazards
assert "terrainHit?'obstacleCollision':'lifeLoss'" in game
assert "playSfx('lifeLoss',.9,.08)" in game
assert "playSfx('obstacleHit',.5,.045)" in game
assert "playSfx('obstacleBreak',.76,.08)" in game
assert "playSfx('chestTouch',.58,.12)" in game
assert "playSfx('chestOpen',.82,.18)" in adventure
for key in ('pickup', 'bossDive', 'obstacleHit', 'obstacleBreak', 'chestTouch', 'chestOpen'):
    assert f"'{key}': 'audio/" in package
