"""Une esquive manuelle réussit au frôlement, sans contact ni aide automatique."""
import os
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    options = {'headless': True, 'args': ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']}
    if os.environ.get('CHROMIUM_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = p.chromium.launch(**options)
    page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""
        localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
        localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true,tutorialDone:true,dodgeGuideDone:false}));
    """)
    page.goto('http://localhost:3000', wait_until='domcontentloaded')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state === 'play'")

    near = page.evaluate("""() => {
        enemies=[];shots=[];rockets=[];drops=[];hazards=[];obstacles=[];scares=[];gates=[];
        schedule=[];spawnIndex=0;waveTime=0;transition=0;pointer=null;moveInput={};
        Object.assign(player,{x:400,y:700,inv:0,dash:0,dashCD:0,shield:0,shieldTime:0,fire:999});
        Journey.state.dodgeGuideDone=false;
        const before=lives;
        hostile=[{x:442,y:700,vx:0,vy:0,type:'fire',r:7,damage:25,life:5,
                  grazed:false,homing:false,age:0,lockRemaining:0}];
        const distance=Math.hypot(hostile[0].x-player.x,hostile[0].y-player.y);
        const contact=distance<hostile[0].r+6;
        dodge();update(1/60);
        const first=Journey.run.stats.perfectDodges;
        hostile.push({x:player.x-40,y:player.y,vx:0,vy:0,type:'blood',r:7,damage:25,life:5,
                      grazed:false,homing:false,age:0,lockRemaining:0});
        update(1/60);
        return {before,lives,distance,contact,first,total:Journey.run.stats.perfectDodges,
                projectiles:hostile.length,success:!!CombatFeel.success,
                active:document.querySelector('#dash').classList.contains('dash-active'),
                label:document.querySelector('#dash').innerText,
                aria:document.querySelector('#dash').getAttribute('aria-label'),
                radius:CombatFeel.nearRadius};
    }""")
    assert not near['contact'] and near['distance'] > 13, near
    assert near['distance'] <= near['radius'] + 7, near
    assert near['lives'] == near['before'] and near['success'], near
    assert near['first'] == 1 and near['total'] == 1, ('un seul crédit par activation', near)
    assert near['projectiles'] == 2, ('le frôlement ne doit pas effacer les projectiles', near)
    assert near['active'] and 'Esquive active' in near['label'] and 'Recharge' not in near['label'], near
    assert 'Protection d’esquive active' in near['aria'], near

    tail = page.evaluate("""() => {
        CombatFeel.reset();hostile=[];
        Object.assign(player,{dash:0,dashCD:0,inv:0});
        dodge();
        // Le bond est terminé, mais la protection d’esquive est encore active.
        player.dash=0;player.inv=.2;
        const before=lives;
        hurt(25,'un tir pendant la fin de protection',{kind:'shot',x:player.x,y:player.y,r:7});
        return {before,lives,total:Journey.run.stats.perfectDodges,
                success:!!CombatFeel.success,dash:player.dash,inv:player.inv};
    }""")
    assert tail['dash'] == 0 and tail['inv'] > 0, tail
    assert tail['lives'] == tail['before'] and tail['success'] and tail['total'] == 2, tail

    manual = page.evaluate("""() => {
        CombatFeel.reset();hostile=[];
        Object.assign(player,{x:400,y:700,dash:0,dashCD:0,inv:0});
        hostile=[{x:442,y:700,vx:0,vy:0,type:'fire',r:7,damage:25,life:5,
                  grazed:false,homing:false,age:0,lockRemaining:0}];
        const total=Journey.run.stats.perfectDodges;
        update(1/60); // Aucun appui : la proximité seule ne doit rien déclencher.
        return {total,after:Journey.run.stats.perfectDodges,success:CombatFeel.success,
                dash:player.dash,dashCD:player.dashCD,visual:CombatFeel.dashVisual};
    }""")
    assert manual['after'] == manual['total'] and not manual['success'], manual
    assert manual['dash'] == 0 and manual['dashCD'] == 0 and manual['visual'] is None, manual

    assert not errors, errors
    browser.close()
    print('OK : esquive manuelle validée au frôlement sans contact, pendant toute la protection, sans double crédit ni assistance automatique.')
