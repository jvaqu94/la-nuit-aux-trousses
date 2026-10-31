"""Toutes les pages mobiles utilisent l'écran sans changer le terrain de jeu."""
import json
import os

from playwright.sync_api import sync_playwright

SIZES = [(390, 844), (360, 640)]
BASE_URL = os.environ.get('MINUIT_TEST_URL', 'http://localhost:3000')
PROFILE = {
    'version': 1, 'xp': 650, 'trainingDone': True, 'tutorialDone': True,
    'dodgeGuideDone': True,
    'lifetime': {'waves': 2, 'bosses': 1, 'dashes': 12, 'cleanWaves': 5,
                 'pickups': 20, 'elites': 2, 'kills': 120},
    'mastery': {'selected': 'base', 'done': ['ripple', 'shatter', 'surge', 'rhythm'],
                'unlocked': ['flawless'], 'best': {}},
    'recent': [],
}
INIT = """(()=>{
 localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
 localStorage.setItem('minuit-journey-v1',JSON.stringify(%s));
})()""" % json.dumps(PROFILE)
PAGES = [
    ('accueil', 'LocalLeague.menu()', '.home-menu'),
    ('reglages', 'settings()', '.settings-page'),
    ('compte', 'Journey.archives()', '.account-page'),
    ('grimoire', "LocalLeague.menu();document.querySelector('#wardrobe').click()", '.grimoire-screen'),
    ('preparer', 'Arsenal.prepare()', '.arsenal-screen'),
    ('exploits', 'Adventure.mastery()', '.mastery-list'),
    ('laboratoire', 'Adventure.labMenu()', '.lab-fields'),
    ('defi', "LocalLeague.challenge('daily')", '#launchLocal'),
    ('classee', "LocalLeague.challenge('ranked')", '#launchLocal'),
    ('sprint', 'WeeklySprint.preflight()', '.weekly-preflight'),
    ('guide', "GuidedTraining.openGuide('menu')", '.guide-card'),
    ('scores', 'ArcadeScores.open()', '.arcade-score-screen'),
]
ACTIONS = {
    'preparer': ['#arsenalFly', '#arsenalBack'],
    'exploits': ['#masteryBack'],
    'laboratoire': ['#startLab', '#labBack'],
    'defi': ['#launchLocal', '#localBack'],
    'classee': ['#launchLocal', '#localBack'],
    'sprint': ['#weeklyLaunch', '#weeklyBack'],
    'guide': ['#guideNext', '#guideBack'],
}
SETUP_BOSS = """()=>{
 enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];
 wave=5;spawnBoss();const boss=enemies.find(e=>e.boss);boss.y=210;reward(boss);
 for(let i=0;i<180&&state==='play';i++){player.inv=100;update(1/60)}
 return {state,cards:document.querySelectorAll('.level-reward-card').length};
}"""
GEOMETRY = """()=>{
 const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();
  return{top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
 const overlay=document.querySelector('#overlay');
 return{arena:rect('.arena'),holder:rect('.layout>div:first-child'),overlay:rect('#overlay'),
  header:getComputedStyle(document.querySelector('header')).display,
  touchbar:getComputedStyle(document.querySelector('.touchbar')).display,
  bar:rect('.touchbar'),scrollWidth:document.documentElement.scrollWidth,
  scrollHeight:document.documentElement.scrollHeight,
  overlayClientWidth:overlay.clientWidth,overlayScrollWidth:overlay.scrollWidth,
  maxScroll:overlay.scrollHeight-overlay.clientHeight,innerWidth,innerHeight};
}"""


def assert_full_page(page, label):
    page.evaluate("document.querySelector('#overlay').scrollTop=0")
    page.wait_for_timeout(25)
    data = page.evaluate(GEOMETRY)
    arena, holder, overlay = data['arena'], data['holder'], data['overlay']
    assert holder['top'] <= 8, (label, data)
    assert abs(arena['top'] - holder['top']) <= 2, (label, data)
    assert arena['width'] + 2 >= holder['width'], (label, data)
    assert arena['height'] + 2 >= holder['height'], (label, data)
    assert overlay['height'] + 2 >= arena['height'], (label, data)
    assert data['header'] == 'none' and data['touchbar'] == 'none', (label, data)
    assert data['scrollWidth'] <= data['innerWidth'], (label, data)
    assert data['scrollHeight'] <= data['innerHeight'] + 1, (label, data)
    assert data['overlayScrollWidth'] <= data['overlayClientWidth'] + 1, (label, data)
    if data['maxScroll'] > 1:
        reached = page.evaluate("""()=>{const o=document.querySelector('#overlay');o.scrollTop=o.scrollHeight;
         return Math.abs(o.scrollTop-(o.scrollHeight-o.clientHeight))<2}""")
        assert reached, label
        page.evaluate("document.querySelector('#overlay').scrollTop=0")
        page.wait_for_timeout(25)
    return data


def assert_actions(page, label, selectors):
    for selector in selectors:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 0 and box['y'] + box['height'] <= page.evaluate('innerHeight') + 1, (label, selector, box)
        assert box['height'] >= 43, (label, selector, box)


def assert_game(page):
    data = page.evaluate(GEOMETRY)
    arena = data['arena']
    ratio = arena['height'] / arena['width']
    assert 1.12 <= ratio <= 1.46, data
    assert data['header'] == 'flex' and data['touchbar'] == 'flex', data
    assert arena['bottom'] <= data['innerHeight'] + 1 and data['bar']['bottom'] <= data['innerHeight'] + 1, data
    assert data['scrollWidth'] <= data['innerWidth'], data


with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    errors = []
    for width, height in SIZES:
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=True, has_touch=True)
        context.route('**/supabase-config.js*', lambda route: route.fulfill(
            content_type='application/javascript', body='window.MINUIT_SUPABASE_CONFIG={};'))
        context.add_init_script(INIT)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE_URL)
        page.wait_for_selector('.home-menu')
        for name, script, selector in PAGES:
            page.evaluate(script)
            page.wait_for_selector(selector)
            assert_full_page(page, f'{width} {name}')
            if name in ACTIONS:
                assert_actions(page, f'{width} {name}', ACTIONS[name])
            if name in ('defi', 'classee'):
                cards = page.locator('.local-card').evaluate_all(
                    "cards=>cards.map(card=>{const r=card.getBoundingClientRect();return{left:r.left,width:r.width}})")
                assert len(cards) == 3 and len({card['left'] for card in cards}) == 1, cards
                assert all(card['width'] > 250 for card in cards), cards
            if name == 'guide':
                for number in range(2, 7):
                    page.click('#guideNext')
                    page.wait_for_function(f"document.querySelector('.guide-card .menu-kicker').textContent.includes('{number} / 6')")
                    assert_full_page(page, f'{width} guide {number}')
                    assert_actions(page, f'{width} guide {number}', ACTIONS['guide'])

        # Isoler complètement le parcours en vol et son stockage local.
        context.close()
        context = browser.new_context(viewport={'width': width, 'height': height},
                                      is_mobile=True, has_touch=True)
        context.route('**/supabase-config.js*', lambda route: route.fulfill(
            content_type='application/javascript', body='window.MINUIT_SUPABASE_CONFIG={};'))
        context.add_init_script(INIT)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE_URL)
        page.wait_for_selector('#playAdventure')
        assert not page.evaluate('GuidedTraining.required()')
        page.click('#playAdventure')
        page.wait_for_function("state==='play'")
        page.wait_for_timeout(120)
        assert_game(page)
        page.click('#pause')
        page.wait_for_selector('#resume')
        assert_full_page(page, f'{width} pause')
        assert_actions(page, f'{width} pause', ['#resume'])
        page.click('#resume')
        page.wait_for_function("state==='play'")
        page.wait_for_timeout(120)
        assert_game(page)

        result = page.evaluate(SETUP_BOSS)
        assert result == {'state': 'choice', 'cards': 4}, (width, result, page.evaluate("({mode,training:Adventure.training,guided:GuidedTraining.active,weekly:WeeklySprint.active,transitionBoss,pendingBoss,clears})"))
        assert_full_page(page, f'{width} recompense')
        page.locator('#levelReward2').tap()
        page.wait_for_function("state==='play'&&stage===1")
        page.wait_for_timeout(120)
        assert_game(page)

        page.evaluate('gameTime=35;score=2345;end(false)')
        page.wait_for_selector('.death-transition')
        assert_full_page(page, f'{width} transition de mort')
        page.wait_for_function("Number(document.querySelector('#deathCountdown')?.textContent) >= 1")
        assert 1 <= int(page.locator('#deathCountdown').inner_text()) <= 9
        context.close()

    # La règle commune est strictement mobile : une page desktop garde le cadre 8:9.
    desktop = browser.new_context(viewport={'width': 1280, 'height': 900})
    desktop.add_init_script(INIT)
    page = desktop.new_page()
    page.goto(BASE_URL)
    page.wait_for_selector('.home-menu')
    page.evaluate('Arsenal.prepare()')
    page.wait_for_selector('.arsenal-screen')
    ratio = page.evaluate("""()=>{const r=document.querySelector('.arena').getBoundingClientRect();return r.width/r.height}""")
    assert abs(ratio - 8 / 9) < .01, ratio
    desktop.close()
    browser.close()
    assert not errors, errors
    print('OK : 12 pages, 6 pages du guide, actions, pause, récompense, mort et reprise à 390×844 et 360×640 ; desktop 8:9 conservé.')
