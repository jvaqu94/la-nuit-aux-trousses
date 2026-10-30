"""Synergies, bilan personnalisé et Sprint hebdomadaire isolé de la campagne."""
import json
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
TRAINED = "localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))"
SESSION = """
localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}));
localStorage.setItem('minuit-supabase-session-v1',JSON.stringify({
  access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,
  user:{id:'test-user',displayName:'Sorcière Test'}
}));
"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script(TRAINED)
    page.goto(URL)
    page.wait_for_selector('#weeklySprint')
    assert page.locator('.main-menu button').count() == 14

    # Graine commune, trois vagues allégées et équipement de défi normalisé.
    page.click('#weeklySprint')
    page.wait_for_selector('.weekly-preflight')
    assert 'Trois vagues' in page.locator('.weekly-preflight').inner_text()
    assert 'tirs automatiques ×2' in page.locator('.weekly-preflight').inner_text()
    page.click('#weeklyLaunch')
    page.wait_for_function('WeeklySprint.active')
    first = page.evaluate("""()=>({
      week:WeeklySprint.config.week,seed:WeeklySprint.config.seed,stage,wave,diff,lives,
      schedule:JSON.stringify(schedule),transient:Journey.run.transient,
      standard:Journey.run.combat.standard,hud:document.querySelector('#wave').textContent,
      checkpoint:localStorage.getItem('minuit-checkpoint'),xp:Journey.state.xp,
      recent:Journey.state.recent.length,records:records.length,
      ranked:LocalLeague.dayState().rankedUsed,daily:LocalLeague.dayState().dailyUsed
    })""")
    assert first['wave'] == 3 and first['diff'] == 1 and first['lives'] == 3
    assert first['transient'] and first['standard'] and first['hud'] == '01 / 03'
    assert first['checkpoint'] is None and first['xp'] == 0
    assert first['recent'] == first['records'] == 0
    assert first['ranked'] == first['daily'] == 0
    assert len(json.loads(first['schedule'])) == 31
    assert page.evaluate("""()=>{prefs.touchLayout='left';savePrefs();const saved=JSON.parse(localStorage.getItem('minuit-settings')).touchLayout==='left';prefs.touchLayout='standard';savePrefs();return saved}""")
    # Le tir principal est deux fois plus efficace, sans amplifier le familier
    # ni modifier les dégâts et le périmètre du sort spécial.
    combat = page.evaluate("""()=>{
      const sample=()=>{shots=[];player.fire=0;update(.001);return shots.map(shot=>({damage:shot.damage,familiar:!!shot.familiar}))};
      upgrades.fire=0;upgrades.familiar=0;const base=sample();
      upgrades.fire=3;const powered=sample();
      upgrades.fire=0;upgrades.familiar=1;const withFamiliar=sample();
      upgrades.familiar=0;shots=[];
      player.inv=999;enemies=[{x:player.x,y:player.y-80,hp:100,max:100,r:19}];hostile=[];
      Arsenal.active.cooldown=0;transition=0;const cast=Arsenal.cast(),spellDamage=100-enemies[0].hp;
      enemies=[];hostile=[];return {base,powered,withFamiliar,cast,spellDamage};
    }""")
    assert [shot['damage'] for shot in combat['base']] == [2], combat
    assert len(combat['powered']) == 2 and all(shot['damage'] == 4 for shot in combat['powered']), combat
    assert any(shot['familiar'] and shot['damage'] == 1 for shot in combat['withFamiliar']), combat
    assert combat['cast'] and combat['spellDamage'] == 10, combat
    page.evaluate('WeeklySprint.start()')
    page.wait_for_function('WeeklySprint.active')
    second = page.evaluate("({seed:WeeklySprint.config.seed,stage,schedule:JSON.stringify(schedule)})")
    assert second['seed'] == first['seed'] and second['stage'] == first['stage']
    assert second['schedule'] == first['schedule']

    # Le gardien emprunte le vrai reward(), mais termine le Sprint avant la
    # victoire de campagne du monde 5 et avant tout record normal.
    page.evaluate("""()=>{
      wave=5;enemies=[];spawnBoss();
      const guardian=enemies.find(enemy=>enemy.boss);window.__sprintGuardianHP=guardian.hp;reward(guardian);
    }""")
    page.wait_for_selector('.weekly-result')
    assert '3 vagues + gardien' in page.locator('.weekly-result').inner_text()
    assert page.evaluate('window.__sprintGuardianHP') == 585
    isolated = page.evaluate("""()=>({
      active:WeeklySprint.active,sandbox:SandboxMode,run:Journey.run,
      recent:Journey.state.recent.length,records:records.length,xp:Journey.state.xp,
      ranked:LocalLeague.dayState().rankedUsed,daily:LocalLeague.dayState().dailyUsed,
      saved:JSON.parse(localStorage.getItem('minuit-weekly-sprints-v1')).weeks[WeeklySprint.result.week].best.won,
      campaignSaved:localStorage.getItem('minuit-v2-scores')
    })""")
    assert not isolated['active'] and not isolated['sandbox'] and isolated['run'] is None
    assert isolated['recent'] == isolated['records'] == isolated['xp'] == 0
    assert isolated['ranked'] == isolated['daily'] == 0
    assert isolated['saved'] and isolated['campaignSaved'] is None

    # Une défaite a le même décompte explicite, puis un high score Sprint plein écran.
    page.click('#weeklyRetry')
    page.wait_for_function('WeeklySprint.active')
    page.evaluate("lives=1;player.inv=0;player.dash=0;hurt(25,'test Sprint')")
    page.wait_for_selector('.death-transition')
    assert page.locator('#deathCountdown').is_visible()
    page.wait_for_selector('.weekly-result .death-note', timeout=15000)
    assert 'HI-SCORES · SPRINT HEBDO' in page.locator('.weekly-result').inner_text()
    assert not errors, errors

    # Les synergies ne changent aucune statistique et sont reprises au bilan normal.
    normal = browser.new_page(viewport={'width': 1366, 'height': 900})
    normal_errors = []
    normal.on('pageerror', lambda error: normal_errors.append(str(error)))
    normal.add_init_script(TRAINED)
    normal.goto(URL)
    normal.wait_for_selector('#weeklySprint')
    normal.evaluate("""()=>{
      Journey.state.combat.unlocked=Arsenal.catalog.map(item=>item.id);
      Journey.state.combat.selected.spell='sunray';
      Journey.state.combat.selected.broom='comet-flight';
      LocalLeague.play();
    }""")
    normal.wait_for_function("state==='play'&&Journey.run?.combat?.spell==='sunray'")
    normal.evaluate("""()=>{
      upgrades.rocket=1;upgrades.fragment=1;upgrades.poison=1;upgrades.spread=1;
      upgrades.familiar=1;upgrades.laser=1;player.missileTime=15;
      window.__beforeSynergies=JSON.stringify({upgrades,score,lives,diff});
      updateLoadout();
      window.__afterSynergies=JSON.stringify({upgrades,score,lives,diff});
    }""")
    assert normal.evaluate('window.__beforeSynergies') == normal.evaluate('window.__afterSynergies')
    names = normal.evaluate('BuildSynergies.current.activated')
    assert {'rocket-fragment', 'poison-spread', 'familiar-laser'} <= set(names)
    assert 'Contagion de minuit' in normal.locator('#synergyHUD').inner_text()
    normal.evaluate("Journey.state.combat.selected.spell='pulse';lives=1;player.inv=0;player.dash=0;hurt(25,'test bilan')")
    normal.wait_for_selector('.journey-result-screen:not(.weekly-result)', timeout=15000)
    build_card = normal.locator('.replay-build-card').inner_text()
    assert 'Essaim crépitant' in build_card and 'Contagion de minuit' in build_card and 'Chœur spectral' in build_card
    assert 'Lance solaire' in build_card and 'Comète vive' in build_card
    assert normal.locator('.replay-goal-card').is_visible()
    assert 'Rejouer avec ce build' in normal.locator('#retry').inner_text()
    normal.click('#replayChangeBuild')
    normal.wait_for_selector('.arsenal-grid')
    normal.click('#arsenalBack')
    normal.wait_for_selector('.home-menu')

    # Le même test de relance est refait sur un nouveau vol pour vérifier que le
    # choix du bilan restaure bien le build figé, et non une sélection modifiée ensuite.
    normal.evaluate("Journey.state.combat.selected.spell='sunray';Journey.state.combat.selected.broom='comet-flight';LocalLeague.play()")
    normal.wait_for_function("state==='play'&&Journey.run?.combat?.spell==='sunray'")
    normal.evaluate('end(true)')
    normal.wait_for_selector('.journey-result-screen:not(.weekly-result)')
    normal.evaluate("Journey.state.combat.selected.spell='pulse';Journey.state.combat.selected.broom='bruyere'")
    normal.click('#retry')
    normal.wait_for_function("state==='play'&&Journey.run?.combat?.spell==='sunray'")
    assert normal.evaluate('Journey.run.combat.broom') == 'comet-flight'
    assert not normal_errors, normal_errors

    # Contrôle isolé hors Sprint : mêmes dégâts de sort, tir et gardien d'origine.
    balance = browser.new_page(viewport={'width': 1100, 'height': 800})
    balance.add_init_script(TRAINED)
    balance.goto(URL)
    balance.wait_for_selector('#playAdventure')
    balance.evaluate('LocalLeague.play()')
    balance.wait_for_function("state==='play'")
    normal_balance = balance.evaluate("""()=>{
      upgrades.fire=0;upgrades.familiar=0;shots=[];player.fire=0;update(.001);
      const shotDamage=shots.find(shot=>!shot.familiar)?.damage;shots=[];
      player.inv=999;enemies=[{x:player.x,y:player.y-80,hp:100,max:100,r:19}];hostile=[];
      Arsenal.active.cooldown=0;transition=0;const cast=Arsenal.cast(),spellDamage=100-enemies[0].hp;
      enemies=[];hostile=[];stage=4;world=worlds[4];wave=5;spawnBoss();
      return {shotDamage,cast,spellDamage,bossHP:enemies.find(enemy=>enemy.boss).hp,sprint:WeeklySprint.active};
    }""")
    assert normal_balance == {'shotDamage': 1, 'cast': True, 'spellDamage': 10, 'bossHP': 900, 'sprint': False}, normal_balance
    balance.close()

    # Le partage ami ouvre directement le bon Sprint avec une cible chiffrée.
    week = page.evaluate('WeeklySprint.weekInfo().week')
    friend = browser.new_page(viewport={'width': 1100, 'height': 800})
    friend.add_init_script(TRAINED)
    friend.goto(URL + '/?sprint=' + week + '&target=1234')
    friend.wait_for_selector('.weekly-friend-target')
    assert '1 234' in friend.locator('.weekly-friend-target').inner_text() or '1234' in friend.locator('.weekly-friend-target').inner_text().replace(' ', '')
    assert 'sprint=' not in friend.url and 'target=' not in friend.url

    # RPC dédié : aucune conversion en mode free et aucun appel au score de campagne.
    team = browser.new_page(viewport={'width': 1200, 'height': 850})
    team_errors, submissions, campaign_calls = [], [], []
    team.on('pageerror', lambda error: team_errors.append(str(error)))
    team.add_init_script(SESSION)

    def weekly_rpc(route):
        request = route.request
        if 'minuit_submit_team_score' in request.url:
            campaign_calls.append(request.url)
            route.fulfill(status=500, body='{}')
            return
        if 'minuit_submit_weekly_sprint' in request.url:
            body = request.post_data_json
            submissions.append(body)
            payload = {'team': {'name': 'Balais Test', 'memberCount': 2}, 'scores': [
                {'rank': 1, 'displayName': 'Sorcière Test', 'score': body['p_score'], 'time': body['p_time_seconds'], 'wave': body['p_wave'], 'won': body['p_won'], 'played': True, 'isYou': True},
                {'rank': 2, 'displayName': 'Amie Test', 'score': 4000, 'time': 190, 'wave': 3, 'won': True, 'played': True, 'isYou': False},
            ], 'result': {'bestScore': body['p_score'], 'improved': True}}
        else:
            payload = {'team': {'name': 'Balais Test', 'memberCount': 2}, 'scores': [
                {'rank': 1, 'displayName': 'Amie Test', 'score': 4000, 'time': 190, 'wave': 3, 'won': True, 'played': True, 'isYou': False},
                {'rank': 2, 'displayName': 'Sorcière Test', 'score': None, 'played': False, 'isYou': True},
            ]}
        route.fulfill(status=200, content_type='application/json', body=json.dumps(payload))

    team.route('**/rest/v1/rpc/*', weekly_rpc)
    team.goto(URL)
    team.wait_for_selector('#weeklySprint')
    team.click('#weeklySprint')
    team.wait_for_function("document.querySelector('#weeklyPreflightTeam')?.textContent.includes('Balais Test')")
    team.click('#weeklyLaunch')
    team.wait_for_function('WeeklySprint.active')
    team.evaluate('score=4321;gameTime=195;wave=5;end(true)')
    team.wait_for_function("document.querySelector('#weeklyTeamBoard')?.textContent.includes('TA POSITION : #1')")
    assert len(submissions) == 1
    assert submissions[0]['p_score'] == 4321 and submissions[0]['p_wave'] == 3 and submissions[0]['p_won']
    assert 'p_mode' not in submissions[0] and not campaign_calls
    assert not team_errors, team_errors

    # Mobile : préflight et high score utilisent toute la fenêtre sans déborde­ment horizontal.
    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile_errors = []
    mobile.on('pageerror', lambda error: mobile_errors.append(str(error)))
    mobile.add_init_script(TRAINED)
    mobile.goto(URL)
    mobile.wait_for_selector('#weeklySprint')
    mobile.click('#weeklySprint')
    mobile.wait_for_selector('.weekly-preflight')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.click('#weeklyLaunch')
    mobile.wait_for_function('WeeklySprint.active')
    mobile.evaluate('end(true)')
    mobile.wait_for_selector('.weekly-result')
    geometry = mobile.evaluate("""()=>{
      const overlay=document.querySelector('#overlay').getBoundingClientRect();
      const holder=document.querySelector('.layout>div:first-child').getBoundingClientRect();
      return {width:document.documentElement.scrollWidth,inner:innerWidth,fullHeight:overlay.height+2>=holder.height};
    }""")
    assert geometry['width'] <= geometry['inner'] and geometry['fullHeight'], geometry
    assert not mobile_errors, mobile_errors

    browser.close()
    print('OK : synergies informatives, bilan et relance, Sprint allégé et dégâts contrôlés, campagne inchangée, décompte, partage, team dédiée et mobile.')
