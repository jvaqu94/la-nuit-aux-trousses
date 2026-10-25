from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
game = (ROOT / 'game.js').read_text()
hazards = (ROOT / 'night-hazards.js').read_text()
package = (ROOT / 'tools' / 'package.py').read_text()

for asset in ('audio/sfx-pickup-bonus.mp3', 'audio/sfx-boss-dive.mp3'):
    assert (ROOT / asset).exists(), asset

assert "pickup:'audio/sfx-pickup-bonus.mp3'" in game
assert "bossDive:'audio/sfx-boss-dive.mp3'" in game
assert "playSfx('pickup',.62,.045)" in game
assert "playSfx('bossDive',.72,.18)" in hazards
assert "terrainHit?'obstacleCollision':'lifeLoss'" in game
assert "'pickup': 'audio/sfx-pickup-bonus.mp3'" in package
assert "'bossDive': 'audio/sfx-boss-dive.mp3'" in package
