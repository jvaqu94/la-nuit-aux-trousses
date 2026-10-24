"""Reconstruit l’édition autonome et l’archive sans données privées."""
from pathlib import Path
import re,zipfile
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'index.html').read_text()
for name in ['characters.js','game.js','online.js','journey.js','viewport.js','arsenal.js','collectible-art.js','night-hazards.js','adventure.js','encounters.js','flow.js','surprise.js','coven.js','nemesis.js','collision-replay.js']:
 code=(ROOT/name).read_text().replace('</script','<\\/script')
 html=re.sub(r'<script src="'+re.escape(name)+r'(?:\?[^\"]*)?"></script>',lambda m:'<script>'+code+'</script>',html)
(ROOT/'La-Nuit-aux-Trousses.html').write_text(html)
# Alias historiques maintenus pour les anciens liens et outils.
(ROOT/'minuit-autonome.html').write_text(html)
with zipfile.ZipFile(ROOT/'La-Nuit-aux-Trousses.zip','w',zipfile.ZIP_DEFLATED) as z:
 for name in ['index.html','characters.js','game.js','online.js','journey.js','viewport.js','arsenal.js','collectible-art.js','night-hazards.js','adventure.js','encounters.js','flow.js','surprise.js','coven.js','nemesis.js','collision-replay.js','server.py','README.md','La-Nuit-aux-Trousses.html','tools/package.py']:
  z.write(ROOT/name,'La-Nuit-aux-Trousses/'+name)
 for path in sorted((ROOT/'scenery').glob('*.jpg')):z.write(path,'La-Nuit-aux-Trousses/'+str(path.relative_to(ROOT)))
 for name in ['test_rival_replay.py','test_coven_dawn.py','test_vertical_drift.py','test_surprise_ui.py','test_flow.py','test_sealed_chest.py','test_bonus_art.py','test_collectibles_art.py','test_encounters.py','test_adventure.py','test_charges_sweets.py','test_arsenal_browser.py','test_viewport.py','test_journey_browser.py','test_journey_campaign.py','test_no_account_browser.py','test_highscore.cjs','test_loot.cjs','test_flight.cjs','test_arcade.cjs']:
  z.write(ROOT/'tests'/name,'La-Nuit-aux-Trousses/tests/'+name)
import shutil
shutil.copyfile(ROOT/'La-Nuit-aux-Trousses.zip',ROOT/'Minuit-edition-nocturne.zip')
print('La Nuit aux Trousses : archive et HTML autonome prêts : Grimoire intégré, aucune base ni sauvegarde personnelle incluse.')
