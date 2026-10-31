from playwright.sync_api import sync_playwright


def snapshot(page):
    return page.evaluate('''() => ({
      player: {x: player.x, y: player.y},
      pointer: pointer && {x: pointer.x, y: pointer.y},
      drag: drag && {id: drag.id, touch: drag.touch},
      stick: !document.getElementById('touchStick').classList.contains('hidden'),
      cooldown: Arsenal.active.cooldown,
      dashCooldown: player.dashCD
    })''')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []
    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#playAdventure')
    mobile.evaluate('Journey.state.tutorialDone=true')
    mobile.click('#playAdventure')
    mobile.wait_for_function("state === 'play'")
    mobile.evaluate('player.inv=999;enemies=[];hostile=[];obstacles=[];shots=[];drops=[]')
    assert 'SORT SPÉCIAL' in mobile.locator('#specialCast').inner_text()

    arena = mobile.locator('.arena').bounding_box()
    special = mobile.locator('#specialCast').bounding_box()
    dash = mobile.locator('#dash').bounding_box()
    start_x = arena['x'] + arena['width'] * .5
    start_y = arena['y'] + arena['height'] * .65
    special_point = {'x': special['x'] + special['width'] / 2,
                     'y': special['y'] + special['height'] / 2, 'id': 2}
    dash_point = {'x': dash['x'] + dash['width'] / 2,
                  'y': dash['y'] + dash['height'] / 2, 'id': 2}
    first = {'x': start_x, 'y': start_y, 'id': 1}
    cdp = mobile.context.new_cdp_session(mobile)

    def touch(event_type, points):
        cdp.send('Input.dispatchTouchEvent', {'type': event_type, 'touchPoints': points})
        mobile.wait_for_timeout(80)

    # Le contact initial ne téléporte pas la sorcière au point touché.
    initial = snapshot(mobile)
    touch('touchStart', [first])
    pressed = snapshot(mobile)
    assert pressed['drag']['touch'] and pressed['stick'], pressed
    assert pressed['pointer'] is None, pressed
    assert abs(pressed['player']['x'] - initial['player']['x']) < 1, (initial, pressed)
    assert abs(pressed['player']['y'] - initial['player']['y']) < 1, (initial, pressed)

    # Le glisser est relatif et l’indicateur reste visible pendant le geste.
    first = {'x': start_x + 35, 'y': start_y - 65, 'id': 1}
    touch('touchMove', [first])
    moved = snapshot(mobile)
    assert moved['pointer'] is not None and moved['stick'], moved
    assert moved['player']['x'] > pressed['player']['x'] + 10, moved
    assert moved['player']['y'] < pressed['player']['y'] - 10, moved
    active_id = moved['drag']['id']

    # Un vrai second contact tactile déclenche le sort sans voler le pointeur
    # de pilotage. Le premier doigt peut ensuite continuer son glisser.
    touch('touchStart', [first, special_point])
    cast = snapshot(mobile)
    assert cast['cooldown'] > 0, cast
    assert cast['drag']['id'] == active_id and cast['stick'], cast
    assert cast['pointer'] == moved['pointer'], (moved, cast)
    assert 'recharge' in mobile.locator('#specialCast').get_attribute('aria-label')

    first = {'x': start_x + 60, 'y': start_y - 95, 'id': 1}
    touch('touchMove', [first, special_point])
    continued = snapshot(mobile)
    assert continued['pointer']['x'] > cast['pointer']['x'] + 5, continued
    assert continued['pointer']['y'] < cast['pointer']['y'] - 5, continued
    assert continued['drag']['id'] == active_id and continued['cooldown'] > 0, continued
    touch('touchEnd', [])
    released = snapshot(mobile)
    assert released['drag'] is None and released['pointer'] is None and not released['stick'], released

    # Le bouton d’esquive obéit à la même règle multipoint.
    first = {'x': start_x, 'y': start_y, 'id': 1}
    touch('touchStart', [first])
    touch('touchStart', [first, dash_point])
    dodged = snapshot(mobile)
    assert dodged['dashCooldown'] > 0 and dodged['drag']['touch'] and dodged['stick'], dodged
    touch('touchEnd', [])

    # En mode gaucher, les mêmes vrais contacts multiples doivent fonctionner
    # après le déplacement des deux actions à droite.
    mobile.evaluate("prefs.touchLayout='right';savePrefs();player.dashCD=0;Arsenal.active.cooldown=0")
    special = mobile.locator('#specialCast').bounding_box()
    dash = mobile.locator('#dash').bounding_box()
    pause = mobile.locator('#pause').bounding_box()
    assert pause['x'] < special['x'] < dash['x'], (pause, special, dash)
    special_point = {'x': special['x'] + special['width'] / 2,
                     'y': special['y'] + special['height'] / 2, 'id': 2}
    dash_point = {'x': dash['x'] + dash['width'] / 2,
                  'y': dash['y'] + dash['height'] / 2, 'id': 2}
    first = {'x': start_x, 'y': start_y, 'id': 1}
    touch('touchStart', [first])
    right_pressed = snapshot(mobile)
    touch('touchStart', [first, special_point])
    right_cast = snapshot(mobile)
    assert right_cast['cooldown'] > 0, right_cast
    assert right_cast['drag']['id'] == right_pressed['drag']['id'] and right_cast['stick'], right_cast
    touch('touchEnd', [])
    mobile.evaluate('player.dashCD=0')
    touch('touchStart', [first])
    touch('touchStart', [first, dash_point])
    right_dodged = snapshot(mobile)
    assert right_dodged['dashCooldown'] > 0 and right_dodged['drag']['touch'] and right_dodged['stick'], right_dodged
    touch('touchEnd', [])
    mobile.click('#pause')
    assert mobile.evaluate("state === 'pause'")
    mobile.click('#resume')
    assert mobile.evaluate('document.documentElement.scrollWidth <= 390 && document.documentElement.scrollHeight <= 844')
    mobile.close()

    # La souris conserve son pilotage direct et ne fait pas apparaître le
    # retour visuel réservé au toucher.
    desktop = browser.new_page(viewport={'width': 1366, 'height': 768})
    desktop.on('pageerror', lambda error: errors.append(str(error)))
    desktop.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");desktop.goto('http://localhost:3000')
    desktop.wait_for_selector('#playAdventure')
    desktop.evaluate('Journey.state.tutorialDone=true')
    desktop.click('#playAdventure')
    desktop.wait_for_function("state === 'play'")
    arena = desktop.locator('.arena').bounding_box()
    desktop.mouse.move(arena['x'] + arena['width'] * .4, arena['y'] + arena['height'] * .7)
    desktop.mouse.down()
    desktop.wait_for_timeout(60)
    mouse = snapshot(desktop)
    assert mouse['drag']['touch'] is False and mouse['pointer'] is not None and not mouse['stick'], mouse
    desktop.mouse.up()
    assert snapshot(desktop)['pointer'] is None
    assert 'F · PRÊT' in desktop.locator('#specialCast').inner_text()
    assert not errors, errors
    browser.close()
    print('OK : glisser relatif sans saut, sort et esquive au second doigt dans les profils droitier et gaucher, pilotage conservé, souris compatible. Aucune erreur JS.')
