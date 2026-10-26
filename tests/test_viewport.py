from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SIZES = [(1366, 768), (1440, 900), (1024, 600), (390, 844), (360, 640), (844, 390)]

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
        page.goto('http://localhost:3000')
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
        check()
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
        check()
        page.locator('#return').scroll_into_view_if_needed()
        page.click('#return')
        page.locator('#wardrobe').scroll_into_view_if_needed()
        page.click('#wardrobe')
        page.locator('#collectionBack').scroll_into_view_if_needed()
        assert page.locator('#collectionBack').is_visible()
        check()
        print(width, height, 'terrain', round(geometry['a']['w'], 1), round(geometry['a']['h'], 1), 'sans débordement')
        page.close()
    assert not errors, errors
    browser.close()
    print('OK : terrain extensible en portrait, format 8:9 ailleurs, commandes tactiles dimensionnées, aucun débordement sur six tailles. Aucune erreur JS.')
