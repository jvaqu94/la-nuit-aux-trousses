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
    assert page.locator('.main-menu button').count() == 13

    # La course remplace l’ancien Sprint : sa mécanique est testée dans
    # test_ring_sprint.py ; les bilans de campagne restent indépendants.
    page.click('#weeklySprint')
    assert '90 secondes' in page.locator('.weekly-preflight').inner_text()
    page.click('#weeklyBack')
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
    normal.wait_for_function("document.querySelector('#adventureStatus').innerText.includes('MISSILES')")
    assert 'SORT PRÊT' in normal.locator('#adventureStatus').inner_text()
    flight_panels = normal.evaluate("""()=>['synergyHUD','combatHUD','adventureStatus'].map(id=>{
      const el=document.getElementById(id),details=el.closest('#gameDetails'),strip=details?.getBoundingClientRect(),arena=document.querySelector('.arena').getBoundingClientRect(),r=el.getBoundingClientRect();
      return {id,inGameStatus:!!el.closest('#gameStatus'),inArena:!!el.closest('.arena'),atTop:!!strip&&strip.top>=arena.top-1&&strip.bottom<=arena.top+90,atBottom:!details&&r.bottom>=arena.bottom-60&&r.bottom<=arena.bottom+1,transparent:Number(getComputedStyle(el).opacity)<.7};
    })""")
    assert all(panel['inArena'] and not panel['inGameStatus'] and ((panel['atBottom'] and panel['transparent']) if panel['id'] == 'combatHUD' else panel['atTop']) for panel in flight_panels), flight_panels
    normal.evaluate("Journey.state.combat.selected.spell='pulse';lives=1;player.inv=0;player.dash=0;hurt(25,'test bilan')")
    normal.wait_for_selector('.journey-result-screen:not(.weekly-result)', timeout=15000)
    assert normal.evaluate("document.querySelector('#adventureStatus').classList.contains('hidden')")
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

    browser.close()
    print('OK : synergies et bilans de campagne préservés avec la chevauchée de minuit.')
