"""Reconstruit l’édition autonome et l’archive sans données privées."""
from pathlib import Path
import re, zipfile, base64, json

ROOT = Path(__file__).resolve().parents[1]
html = (ROOT / 'index.html').read_text()

for name in ['supabase-config.js', 'characters.js', 'music.js', 'game.js', 'online.js', 'journey.js', 'viewport.js', 'arsenal.js', 'collectible-art.js', 'night-hazards.js', 'adventure.js', 'encounters.js', 'flow.js', 'surprise.js', 'coven.js', 'nemesis.js', 'combat-feel.js', 'onboarding.js', 'collision-replay.js', 'supabase.js', 'settings-page.js', 'home.js', 'arcade-scores.js']:
    code = (ROOT / name).read_text().replace('</script', '<\\/script')
    if name == 'music.js':
        sources = {}
        for track in ['menu', 'forest', 'cemetery', 'castle', 'marsh', 'lanterns']:
            filename = 'nuitsorc-loop' if track == 'menu' else track
            sources[track] = 'data:audio/mpeg;base64,' + base64.b64encode((ROOT / 'audio' / f'{filename}.mp3').read_bytes()).decode('ascii')
        sources.update({'boss-' + track: 'data:audio/mpeg;base64,' + base64.b64encode((ROOT / 'audio' / f'boss-{track}.mp3').read_bytes()).decode('ascii') for track in ['forest', 'cemetery', 'castle', 'marsh', 'lanterns']})
        sources['defeat'] = 'data:audio/mpeg;base64,' + base64.b64encode((ROOT / 'audio' / 'defeat.mp3').read_bytes()).decode('ascii')
        code = 'window.MinuitMusicData=' + json.dumps(sources, separators=(',', ':')) + ';\n' + code
    if name == 'game.js':
        sfx = {
            key: 'data:audio/mpeg;base64,' + base64.b64encode((ROOT / path).read_bytes()).decode('ascii')
            for key, path in {
                'shot': 'audio/sfx-player-shot.mp3',
                'spread': 'audio/sfx-player-spread.mp3',
                'missile': 'audio/sfx-player-missile.mp3',
                'laser': 'audio/sfx-player-laser.mp3',
                'special': 'audio/sfx-player-special.mp3',
                'impactLight': 'audio/sfx-impact-light.mp3',
                'impactHeavy': 'audio/sfx-impact-heavy.mp3',
                'impactBoss': 'audio/sfx-impact-boss.mp3',
                'lifeLoss': 'audio/sfx-player-life-loss.mp3',
                'obstacleCollision': 'audio/sfx-obstacle-collision.mp3',
                'surpriseMonster': 'audio/sfx-surprise-monster.mp3',
                'pickup': 'audio/sfx-pickup-bonus.mp3',
                'bossDive': 'audio/sfx-boss-dive.mp3',
                'obstacleHit': 'audio/sfx-obstacle-hit.mp3',
                'obstacleBreak': 'audio/sfx-obstacle-break.mp3',
                'chestTouch': 'audio/sfx-chest-touch.mp3',
                'chestOpen': 'audio/sfx-chest-open.mp3',
                'lifeLossClear': 'audio/sfx-life-loss-clear.mp3',
                'killGhost': 'audio/sfx-kill-ghost.mp3',
                'killSkull': 'audio/sfx-kill-skull.mp3',
                'killVampire': 'audio/sfx-kill-vampire.mp3',
                'killSpider': 'audio/sfx-kill-spider.mp3',
                'killDemon': 'audio/sfx-kill-demon.mp3',
            }.items()
        }
        code = 'window.MinuitSfxData=' + json.dumps(sfx, separators=(',', ':')) + ';\n' + code
    html = re.sub(r'<script src="' + re.escape(name) + r'(?:\?[^"]*)?"></script>', lambda m: '<script>' + code + '</script>', html)

(ROOT / 'La-Nuit-aux-Trousses.html').write_text(html)
# Alias historiques maintenus pour les anciens liens et outils.
(ROOT / 'minuit-autonome.html').write_text(html)

with zipfile.ZipFile(ROOT / 'La-Nuit-aux-Trousses.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for name in ['index.html', 'supabase-config.js', 'characters.js', 'music.js', 'game.js', 'online.js', 'journey.js', 'viewport.js', 'arsenal.js', 'collectible-art.js', 'night-hazards.js', 'adventure.js', 'encounters.js', 'flow.js', 'surprise.js', 'coven.js', 'nemesis.js', 'combat-feel.js', 'onboarding.js', 'collision-replay.js', 'supabase.js', 'settings-page.js', 'home.js', 'arcade-scores.js', 'server.py', 'README.md', 'audio/README.md', 'supabase/README.md', 'supabase/schema.sql', 'supabase/teams.sql', 'supabase/team_rules.sql', 'supabase/team_stats.sql', 'supabase/functions/email-confirmation/index.ts', 'supabase/functions/pseudo-auth/index.ts', 'La-Nuit-aux-Trousses.html', 'tools/package.py', 'tools/generate_music.py']:
        z.write(ROOT / name, 'La-Nuit-aux-Trousses/' + name)
    for path in sorted((ROOT / 'audio').glob('*.mp3')):
        z.write(path, 'La-Nuit-aux-Trousses/' + str(path.relative_to(ROOT)))
    for path in sorted((ROOT / 'scenery').glob('*.jpg')):
        z.write(path, 'La-Nuit-aux-Trousses/' + str(path.relative_to(ROOT)))
    for name in ['test_settings_audio.py', 'test_soundtrack.py', 'test_music_mp3.py', 'test_supabase.py', 'test_teams.py', 'test_pseudo_invite.py', 'test_rival_replay.py', 'test_coven_dawn.py', 'test_vertical_drift.py', 'test_surprise_ui.py', 'test_flow.py', 'test_enemy_walls.py', 'test_sealed_chest.py', 'test_bonus_art.py', 'test_collectibles_art.py', 'test_encounters.py', 'test_combat_feel.py', 'test_life_flash.py', 'test_audio_feedback.py', 'test_audio_assets.py', 'test_onboarding.py', 'test_adventure.py', 'test_charges_sweets.py', 'test_arsenal_browser.py', 'test_touch_controls.py', 'test_viewport.py', 'test_journey_browser.py', 'test_journey_campaign.py', 'test_no_account_browser.py', 'test_home.py', 'test_settings_page.py', 'test_arcade_scores.py', 'test_highscore.cjs', 'test_loot.cjs', 'test_flight.cjs', 'test_arcade.cjs']:
        z.write(ROOT / 'tests' / name, 'La-Nuit-aux-Trousses/tests/' + name)

import shutil
shutil.copyfile(ROOT / 'La-Nuit-aux-Trousses.zip', ROOT / 'Minuit-edition-nocturne.zip')
print('La Nuit aux Trousses : archive et HTML autonome prêts : Grimoire intégré, aucune base ni sauvegarde personnelle incluse.')
