"""Esquive lisible et disposition tactile droitière/gauchère, sans changer l'équilibrage."""
import os
from playwright.sync_api import sync_playwright


def button_order(page):
    return page.evaluate("""() => [...document.querySelectorAll('#pause,#specialCast,#dash')]
        .filter(node => node.getClientRects().length)
        .sort((a,b) => a.getBoundingClientRect().left-b.getBoundingClientRect().left)
        .map(node => node.id)""")


def assert_buttons_fit(page):
    geometry = page.evaluate("""() => {
        const bar=document.querySelector('.touchbar').getBoundingClientRect();
        const buttons=[...document.querySelectorAll('#pause,#specialCast,#dash')].map(node=>{
            const r=node.getBoundingClientRect();
            return {id:node.id,left:r.left,right:r.right,height:r.height};
        }).sort((a,b)=>a.left-b.left);
        return {bar:{left:bar.left,right:bar.right},buttons};
    }""")
    assert all(button['height'] >= 50 for button in geometry['buttons']), geometry
    assert all(button['left'] >= geometry['bar']['left']-1 and button['right'] <= geometry['bar']['right']+1
               for button in geometry['buttons']), geometry
    assert all(a['right'] <= b['left']+1 for a,b in zip(geometry['buttons'],geometry['buttons'][1:])), geometry


with sync_playwright() as p:
    options = {'headless': True, 'args': ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']}
    if os.environ.get('CHROMIUM_PATH'):
        options['executable_path'] = os.environ['CHROMIUM_PATH']
    browser = p.chromium.launch(**options)
    page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""
        const current=JSON.parse(localStorage.getItem('minuit-settings')||'{}');
        localStorage.setItem('minuit-settings', JSON.stringify({...current,sound:false,music:false}));
        const journey=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');
        localStorage.setItem('minuit-journey-v1',JSON.stringify({...journey,version:1,trainingDone:true}));
    """)
    page.goto('http://localhost:3000', wait_until='domcontentloaded')
    page.wait_for_selector('.home-menu #localSettings')
    page.evaluate('Journey.state.tutorialDone=true;Journey.state.dodgeGuideDone=true')

    # Le réglage est explicite et Annuler ne modifie ni la préférence ni la disposition.
    page.click('#localSettings')
    page.wait_for_selector('.settings-page #touchLayout', state='visible')
    labels = page.locator('#touchLayout option').all_text_contents()
    assert labels == [
        'Droitier · Esquive et sort spécial à gauche',
        'Gaucher · Esquive et sort spécial à droite',
    ], labels
    assert page.input_value('#touchLayout') == 'left'
    assert 'bond rapide' in page.locator('.settings-touch-controls').inner_text()
    page.select_option('#touchLayout', 'right')
    page.click('#settingsCancel')
    page.wait_for_selector('.home-menu #playAdventure')
    assert page.evaluate("prefs.touchLayout === 'left'")

    # Droitière : les deux boutons d'action sont à gauche, la pause passe à droite.
    page.click('#localSettings')
    page.select_option('#touchLayout', 'left')
    page.click('#save')
    page.wait_for_selector('.home-menu #playAdventure')
    assert page.evaluate("prefs.touchLayout === 'left' && JSON.parse(localStorage.getItem('minuit-settings')).touchLayout === 'left'")
    page.click('#playAdventure')
    page.wait_for_function("state === 'play'")
    assert button_order(page) == ['specialCast', 'dash', 'pause'], button_order(page)
    assert_buttons_fit(page)
    page.wait_for_function("document.querySelector('#dash').innerText.includes('Bond + protection')")
    assert 'Bond + protection' in page.locator('#dash').inner_text()

    # Gauchère : les actions passent à droite. Enregistrer depuis la pause revient à la pause.
    page.click('#pause')
    page.wait_for_selector('#pauseSettings')
    page.click('#pauseSettings')
    page.wait_for_selector('.settings-page #touchLayout', state='visible')
    page.select_option('#touchLayout', 'right')
    page.click('#save')
    page.wait_for_selector('#resume')
    assert page.evaluate("state === 'pause' && prefs.touchLayout === 'right'")
    page.click('#resume')
    page.wait_for_function("state === 'play'")
    assert button_order(page) == ['pause', 'specialCast', 'dash'], button_order(page)
    assert_buttons_fit(page)

    # L'effet suit le bond et toute la protection, sans toucher aux valeurs de référence.
    effect = page.evaluate("""() => {
        enemies=[];shots=[];hostile=[];rockets=[];drops=[];hazards=[];obstacles=[];scares=[];
        schedule=[];spawnIndex=0;waveTime=0;transition=0;pointer=null;moveInput={};
        Object.assign(player,{x:300,y:700,inv:0,dash:0,dashCD:0,shield:0,shieldTime:0});
        const balance={duration:Arsenal.dashDuration(),inv:Arsenal.dashInv(),speed:Arsenal.dashSpeed(),cooldown:Arsenal.dashCooldown()};
        const before={x:player.x,lives};
        moveInput[prefs.keys.right.toLowerCase()]=true;
        dodge();
        for(let i=0;i<5;i++)update(1/60);
        moveInput={};
        hurt(25,'test pendant la protection');
        const texts=[],arcs=[];
        const fillText=ctx.fillText,arc=ctx.arc;
        try {
            ctx.fillText=function(text,...args){texts.push(String(text));return fillText.call(this,text,...args)};
            ctx.arc=function(...args){arcs.push(args);return arc.apply(this,args)};
            CombatFeel.draw(ctx);
            CombatFeel.drawDashTrail(ctx);
        } finally {ctx.fillText=fillText;ctx.arc=arc}
        updateHUD();drawGame();
        return {balance,moved:player.x-before.x,livesBefore:before.lives,livesAfter:lives,
            visual:CombatFeel.dashVisual && {life:CombatFeel.dashVisual.max>0?CombatFeel.dashVisual.life:0,
                max:CombatFeel.dashVisual.max,ghosts:CombatFeel.dashVisual.ghosts.length},
            texts,arcRadii:arcs.map(args=>args[2]),dash:player.dash,inv:player.inv,
            dashLabel:document.querySelector('#dash').innerText};
    }""")
    assert effect['balance'] == {'duration': .32, 'inv': .45, 'speed': 2.2, 'cooldown': 4}, effect
    assert effect['moved'] > 20 and effect['dash'] > 0 and effect['inv'] > 0, effect
    assert effect['livesAfter'] == effect['livesBefore'], effect
    assert effect['visual'] and effect['visual']['max'] == .45 and effect['visual']['ghosts'] >= 2, effect
    assert 0 < effect['visual']['life'] < .45, effect
    assert 'ESQUIVE · PROTÉGÉE' in effect['texts'], effect
    assert any(44 <= radius <= 50 for radius in effect['arcRadii']), effect
    assert 'Recharge' in effect['dashLabel'], effect
    if os.environ.get('DODGE_SCREENSHOT'):
        page.screenshot(path=os.environ['DODGE_SCREENSHOT'], full_page=True)

    # Les silhouettes et la protection disparaissent seules ; aucune aide automatique n'est ajoutée.
    expired = page.evaluate("""() => {
        for(let i=0;i<60;i++)update(1/60);
        return {visual:CombatFeel.dashVisual,dash:player.dash,inv:player.inv,
            cooldown:player.dashCD,order:document.querySelector('.touchbar').dataset.touchLayout};
    }""")
    assert expired['visual'] is None and expired['dash'] == 0 and expired['inv'] == 0, expired
    assert 0 < expired['cooldown'] < 4 and expired['order'] == 'right', expired

    # Le choix survit au rechargement et une nouvelle annulation le laisse intact.
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('.home-menu #localSettings')
    assert page.evaluate("prefs.touchLayout === 'right' && document.querySelector('.touchbar').dataset.touchLayout === 'right'")
    page.click('#localSettings')
    page.wait_for_selector('.settings-page #touchLayout', state='visible')
    assert page.input_value('#touchLayout') == 'right'
    page.select_option('#touchLayout', 'left')
    page.click('#settingsCancel')
    page.wait_for_selector('.home-menu #playAdventure')
    assert page.evaluate("prefs.touchLayout === 'right'")
    page.close()

    # Le profil droitier reste sans chevauchement sur le plus petit portrait cible.
    narrow = browser.new_page(viewport={'width': 360, 'height': 640}, is_mobile=True, has_touch=True)
    narrow_errors = []
    narrow.on('pageerror', lambda error: narrow_errors.append(str(error)))
    narrow.add_init_script("localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false,touchLayout:'standard'}));localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))")
    narrow.goto('http://localhost:3000', wait_until='domcontentloaded')
    narrow.wait_for_selector('.home-menu #playAdventure')
    narrow.evaluate('Journey.state.tutorialDone=true;Journey.state.dodgeGuideDone=true')
    narrow.click('#playAdventure')
    narrow.wait_for_function("state === 'play'")
    assert button_order(narrow) == ['specialCast', 'dash', 'pause'], button_order(narrow)
    assert_buttons_fit(narrow)
    assert narrow.evaluate("prefs.touchLayout === 'left'"), 'La disposition standard historique doit migrer vers droitier.'
    narrow.evaluate("prefs.touchLayout='right';savePrefs()")
    assert button_order(narrow) == ['pause', 'specialCast', 'dash'], button_order(narrow)
    assert_buttons_fit(narrow)
    narrow.close()

    # Le même effet est actif sur PC, tandis que le libellé tactile reste réservé au tactile.
    desktop = browser.new_page(viewport={'width': 1366, 'height': 768})
    desktop_errors = []
    desktop.on('pageerror', lambda error: desktop_errors.append(str(error)))
    desktop.add_init_script("localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))")
    desktop.goto('http://localhost:3000', wait_until='domcontentloaded')
    desktop.wait_for_selector('.home-menu #playAdventure')
    desktop.evaluate('Journey.state.tutorialDone=true;Journey.state.dodgeGuideDone=true')
    desktop.click('#playAdventure')
    desktop.wait_for_function("state === 'play'")
    desktop_effect = desktop.evaluate("""() => {
        enemies=[];hostile=[];schedule=[];spawnIndex=0;waveTime=0;transition=0;pointer=null;moveInput={};
        Object.assign(player,{x:300,y:700,inv:0,dash:0,dashCD:0});
        moveInput[prefs.keys.right.toLowerCase()]=true;dodge();
        for(let i=0;i<5;i++)update(1/60);
        moveInput={};updateHUD();
        return {ghosts:CombatFeel.dashVisual.ghosts.length,max:CombatFeel.dashVisual.max,
            label:document.querySelector('#dash').textContent,small:document.querySelectorAll('#dash small').length};
    }""")
    assert desktop_effect['ghosts'] >= 2 and desktop_effect['max'] == .45, desktop_effect
    assert desktop_effect['small'] == 0 and 'Bond + protection' not in desktop_effect['label'], desktop_effect
    desktop.close()

    assert not errors and not narrow_errors and not desktop_errors, errors + narrow_errors + desktop_errors
    browser.close()
    print('OK : effet PC/mobile, équilibrage inchangé, profils droitière/gauchère, 360/390 px, annulation et persistance.')
