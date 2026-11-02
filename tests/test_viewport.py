from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(1366, 768), (1440, 900), (1024, 600), (390, 844), (360, 640), (844, 390)]


def assert_flight_hud(page):
    data = page.evaluate('''() => {
      const box = selector => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
      };
      const hud = document.querySelector('.hud');
      return {
        status:box('.game-status'), hud:box('.hud'), arena:box('.arena'),
        blocks:['#score','#wave','#lives'].map(box),
        parent:hud.parentElement.id, arenaHud:document.querySelectorAll('.arena .hud').length,
        arenaFlightPanels:document.querySelectorAll('.arena #synergyHUD,.arena #combatHUD,.arena #adventureStatus').length,
        flightPanels:['synergyHUD','combatHUD','adventureStatus'].map(id=>{
          const el=document.getElementById(id),r=el.getBoundingClientRect();
          return {id,parent:el.parentElement.id,hidden:el.classList.contains('hidden'),top:r.top,bottom:r.bottom,height:r.height};
        }),
        build:box('#gameBuildSlot'),equipment:box('#gameEquipmentSlot'),details:box('#gameDetails'),
        detailsInArena:!!document.querySelector('.arena #gameDetails'),
        toast:box('#toast'),toastText:document.querySelector('#toast').textContent,
        toastParent:document.querySelector('#toast').parentElement.id,
        overlayParent:document.querySelector('#overlay').parentElement.className,
        secondTitle:document.querySelectorAll('main .heading h1').length,
        modeInHud:!!document.querySelector('.hud #modeLabel'),
        position:getComputedStyle(hud).position,
        scrollWidth:document.documentElement.scrollWidth,innerWidth,innerHeight
      };
    }''')
    assert data['parent'] == 'gameStatus' and data['modeInHud'], data
    assert data['toastParent'] == 'arenaTop' and data['overlayParent'] == 'arena', data
    assert data['arenaHud'] == 0 and data['arenaFlightPanels'] == 3 and data['detailsInArena'], data
    assert data['secondTitle'] == 0 and data['position'] == 'static', data
    assert data['hud']['bottom'] <= data['arena']['top'] + 1, data
    assert data['status']['bottom'] <= data['arena']['top'] + 1, data
    assert data['hud']['top'] >= data['status']['top'] - 1, data
    assert data['details']['height'] > 0 and abs(data['details']['top'] - data['arena']['top']) <= 2, data
    assert data['details']['bottom'] <= data['arena']['top'] + 90, data
    if data['innerWidth'] <= 850:
        if data['innerHeight'] > data['innerWidth']:
            assert -1 <= data['arena']['top'] - data['status']['bottom'] <= 8, data
        if data['toastText']:
            assert data['toast']['top'] >= data['details']['bottom'] - 1, data
            assert data['toast']['bottom'] <= data['arena']['top'] + data['arena']['height'] * .25, data
    for block in data['blocks']:
        assert block['height'] > 0 and block['top'] >= data['status']['top'] - 1, data
        assert block['bottom'] <= data['status']['bottom'] + 1, data
    for panel in data['flightPanels']:
        expected_parent = 'gameBuildSlot' if panel['id'] == 'synergyHUD' else 'gameEquipmentSlot'
        assert panel['parent'] == expected_parent, data
        if not panel['hidden']:
            assert panel['height'] > 0 and panel['top'] >= data['details']['top'] - 1, data
            assert panel['bottom'] <= data['details']['bottom'] + 1, data
    assert data['build']['right'] <= data['equipment']['left'] + 1, data
    assert data['scrollWidth'] <= data['innerWidth'], data


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []
    for width, height in SIZES:
        page = browser.new_page(
            viewport={'width': width, 'height': height},
            is_mobile=width < 851,
            has_touch=width < 851,
        )
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");page.goto('http://localhost:3000')
        page.wait_for_selector('#fullView', state='attached')
        page.wait_for_timeout(100)

        def check(home=False):
            geometry = page.evaluate('''() => {
              const arena = document.querySelector('.arena').getBoundingClientRect();
              const bar = document.querySelector('.touchbar').getBoundingClientRect();
              return {
                a: {x: arena.x, y: arena.y, w: arena.width, h: arena.height,
                    b: arena.bottom, r: arena.right},
                bar: {b: bar.bottom, r: bar.right},
                w: innerWidth, h: innerHeight,
                sw: document.documentElement.scrollWidth,
                sh: document.documentElement.scrollHeight
              };
            }''')
            arena = geometry['a']
            assert arena['b'] <= height + 1 and geometry['bar']['b'] <= height + 1, geometry
            assert arena['y'] >= 0 and arena['r'] <= width + 1, geometry
            assert geometry['sw'] <= width and geometry['sh'] <= height + 1, geometry
            # L’accueil smartphone utilise toute la hauteur ; le format 8:9 redevient
            # obligatoire dès que le vol commence.
            if home:
                return geometry
            ratio = arena['h'] / arena['w']
            if width <= 600 and height > width:
                # En portrait, le terrain grandit avec l’écran jusqu’à 1,45,
                # sans jamais rétrécir sous l’ancien rapport de 9 / 8.
                assert 9 / 8 - .01 <= ratio <= 1.45 + .01, geometry
                if (width, height) == (390, 844):
                    assert ratio > 1.4, geometry
            else:
                assert abs(arena['w'] / arena['h'] - 8 / 9) < .01, geometry
            return geometry

        geometry = check(home=True)
        page.locator('#playAdventure').scroll_into_view_if_needed()
        page.click('#playAdventure')
        page.wait_for_function("state === 'play'")
        page.wait_for_timeout(100)
        page.wait_for_function("document.querySelector('.arena').getBoundingClientRect().bottom <= innerHeight + 1")
        check()
        assert_flight_hud(page)
        # Cas réel : une synergie nommée et un effet à compte à rebours doivent
        # rester dans le bandeau, y compris après le réajustement du terrain.
        page.evaluate("upgrades.poison=1;upgrades.spread=1;player.missileTime=5;updateLoadout();say('Information haute de test',5)")
        page.wait_for_function("document.querySelector('#synergyHUD').innerText.includes('Contagion de minuit') && document.querySelector('#adventureStatus').innerText.includes('MISSILES')")
        page.wait_for_function("document.querySelector('#gameDetails').getBoundingClientRect().height > 0 && document.querySelector('#gameDetails').getBoundingClientRect().bottom <= document.querySelector('.arena').getBoundingClientRect().top + 90")
        assert 'SORT PRÊT' in page.locator('#adventureStatus').inner_text()
        assert 'MISSILES' not in page.locator('#graze').inner_text()
        check()
        assert_flight_hud(page)
        if width < 851:
            controls = page.evaluate('''() => ['pause', 'specialCast', 'dash'].map(id => {
              const r = document.getElementById(id).getBoundingClientRect();
              return {id, width: r.width, height: r.height, bottom: r.bottom};
            })''')
            minimum = 50 if height > width else 38
            for control in controls:
                assert control['height'] >= minimum - 1, control
                assert control['width'] >= 50 and control['bottom'] <= height + 1, control
            assert page.locator('#touchStick').count() == 1
            assert page.evaluate("getComputedStyle(document.querySelector('#game')).touchAction") == 'none'
            page.click('#infoToggle')
            page.wait_for_selector('.sidebar.infos-open')
            assert page.evaluate("state === 'pause'")
            page.click('#closeInfos')
            page.click('#resume')
        if (width, height) in [(1366, 768), (390, 844)]:
            page.screenshot(path=str(ROOT / f'tests/fit-{width}-{height}.png'), full_page=True)
        page.evaluate('gameTime=40;score=1200;end(false)')
        page.wait_for_selector('.journey-result-screen')
        assert page.evaluate("document.querySelector('#adventureStatus').classList.contains('hidden')")
        # Le bilan est une page plein écran sur toutes les tailles ; le ratio
        # 8:9 redevient obligatoire à la reprise du vol.
        check(home=True)
        page.locator('#return').scroll_into_view_if_needed()
        page.click('#return')
        page.locator('#wardrobe').scroll_into_view_if_needed()
        page.click('#wardrobe')
        page.locator('#collectionBack').scroll_into_view_if_needed()
        assert page.locator('#collectionBack').is_visible()
        # Comme l’accueil, le Grimoire est une page plein écran sur téléphone ;
        # le ratio du terrain ne s’applique pas à cette consultation.
        check(home=width < 851)
        print(width, height, 'terrain', round(geometry['a']['w'], 1), round(geometry['a']['h'], 1), 'sans débordement')
        page.close()
    assert not errors, errors
    browser.close()
    print('OK : HUD principal externe, build et effets dans le haut du cadre de jeu, six tailles sans débordement.')
