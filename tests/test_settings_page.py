"""Page Réglages : hiérarchie, contrôles d’origine, persistance et retours."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000', wait_until='networkidle')
    page.wait_for_selector('#localSettings')
    page.locator('#localSettings').scroll_into_view_if_needed()
    page.click('#localSettings')
    page.wait_for_selector('.settings-page #save')

    assert page.locator('.settings-grid > .settings-card').count() == 4
    assert page.locator('.settings-card-title h3').all_text_contents() == ['Aventure', 'Audio', 'Commandes', 'Sauvegarde']
    for selector in ['#difficulty', '#nickname', '#volume', '#opt-music', '#bindings',
                     '#exportJourney', '#importJourney', '#saveMessage', '#supabaseMount',
                     '#restartTutorial', '#save', '#settingsCancel']:
        assert page.locator(selector).count() == 1, selector
    assert page.locator('#bindings button').count() == 8
    assert page.evaluate("document.querySelector('#overlay').scrollTop") == 0
    assert page.evaluate("document.querySelector('#overlay').scrollHeight === document.querySelector('#overlay').clientHeight")

    # Le compte reste présent, sans imposer son formulaire dans la page principale.
    assert not page.locator('.settings-cloud').evaluate('(node) => node.open')
    page.click('.settings-cloud summary')
    page.wait_for_selector('#cloudPseudo', state='visible')
    assert not page.locator('#cloudEmail').is_visible()
    page.click('.cloud-email-access summary')
    page.wait_for_selector('#cloudEmail', state='visible')
    assert page.locator('.settings-cloud #supabaseMount').count() == 1
    page.click('.settings-cloud summary')

    # Les nœuds déplacés gardent leurs handlers : volume, pseudo, musique et touches.
    page.select_option('#difficulty', 'easy')
    page.fill('#nickname', 'Test Réglages')
    page.locator('#volume').evaluate("(node) => { node.value = '.55'; node.dispatchEvent(new Event('input', {bubbles:true})); }")
    assert page.locator('#settingsVolumeValue').inner_text() == '55 %'
    page.uncheck('#opt-music')
    page.click('#bindings [data-key="dash"]')
    page.keyboard.press('x')
    page.wait_for_function("document.querySelector('#bindings [data-key=dash]').textContent.includes('x')")
    page.click('#save')
    page.wait_for_selector('.home-menu #playAdventure')
    saved = page.evaluate("({difficulty:prefs.difficulty,name:prefs.name,volume:prefs.volume,music:prefs.music,dash:prefs.keys.dash})")
    assert saved == {'difficulty': 'easy', 'name': 'Test Réglages', 'volume': .55, 'music': False, 'dash': 'x'}, saved

    page.click('#localSettings')
    page.wait_for_selector('.settings-page #save')
    assert page.input_value('#difficulty') == 'easy'
    assert page.input_value('#nickname') == 'Test Réglages'
    assert page.input_value('#volume') == '0.55'
    assert not page.is_checked('#opt-music')
    assert 'x' in page.locator('#bindings [data-key="dash"]').inner_text()

    # Retour sans enregistrer : les changements du formulaire ne sont pas appliqués.
    page.fill('#nickname', 'Valeur temporaire')
    page.select_option('#difficulty', 'hard')
    page.click('#settingsCancel')
    page.wait_for_selector('.home-menu #playAdventure')
    assert page.evaluate('prefs.name') == 'Test Réglages'
    assert page.evaluate('prefs.difficulty') == 'easy'

    # Le contrôle sonore global reste immédiat et indépendant du formulaire Musique.
    page.click('#localSettings')
    page.wait_for_selector('#settingsSoundToggle')
    page.click('#settingsSoundToggle')
    page.wait_for_function('prefs.sound === false')
    assert page.locator('#settingsAudioStatus').inner_text() == 'Aucun son ne sera joué.'
    page.click('#settingsSoundToggle')
    page.wait_for_function("prefs.sound === true && audio && audio.state === 'running'")

    # Restaurer des préférences courantes avant de vérifier la pause.
    page.select_option('#difficulty', 'normal')
    page.fill('#nickname', 'Sorcière')
    page.check('#opt-music')
    page.click('#bindings [data-key="dash"]')
    page.keyboard.press('Space')
    page.wait_for_function("document.querySelector('#bindings [data-key=dash]').textContent.includes('Espace')")
    page.click('#save')
    page.wait_for_selector('.home-menu #playAdventure')

    # Depuis la pause, Annuler et Enregistrer reviennent tous deux à la pause.
    page.click('#playAdventure')
    page.wait_for_function("state === 'play'")
    page.click('#pause')
    page.wait_for_selector('#pauseSettings')
    page.click('#pauseSettings')
    page.wait_for_selector('.settings-page #settingsCancel')
    page.click('#settingsCancel')
    page.wait_for_selector('#resume')
    assert page.evaluate("state === 'pause'")
    page.click('#pauseSettings')
    page.wait_for_selector('.settings-page #save')
    page.locator('#volume').evaluate("(node) => { node.value = '.4'; node.dispatchEvent(new Event('input', {bubbles:true})); }")
    page.click('#save')
    page.wait_for_selector('#resume')
    assert page.evaluate("state === 'pause' && prefs.volume === .4")

    # Mobile : ouverture en haut, pas de débordement et deux actions distinctes.
    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile_errors = []
    mobile.on('pageerror', lambda error: mobile_errors.append(str(error)))
    mobile.goto('http://localhost:3000', wait_until='networkidle')
    mobile.locator('#localSettings').scroll_into_view_if_needed()
    mobile.click('#localSettings')
    mobile.wait_for_selector('.settings-page #save')
    layout = mobile.evaluate("""() => {
        const overlay = document.querySelector('#overlay');
        const header = document.querySelector('.settings-header').getBoundingClientRect();
        const footer = document.querySelector('.settings-actions').getBoundingClientRect();
        const cancel = document.querySelector('#settingsCancel').getBoundingClientRect();
        const save = document.querySelector('#save').getBoundingClientRect();
        return {scroll:overlay.scrollTop, body:document.body.scrollWidth, viewport:innerWidth,
            headerTop:header.top, overlayTop:overlay.getBoundingClientRect().top,
            cancel:{left:cancel.left,right:cancel.right,width:cancel.width},
            save:{left:save.left,right:save.right,width:save.width},
            footer:{left:footer.left,right:footer.right,top:footer.top,bottom:footer.bottom},
            overlayBottom:overlay.getBoundingClientRect().bottom,
            bindingHeight:document.querySelector('#bindings button').getBoundingClientRect().height};
    }""")
    assert layout['scroll'] == 0 and layout['headerTop'] >= layout['overlayTop'], layout
    assert layout['body'] <= layout['viewport'], layout
    for key in ['cancel', 'save']:
        assert layout[key]['width'] >= 120, layout
        assert layout[key]['left'] >= layout['footer']['left'] and layout[key]['right'] <= layout['footer']['right'], layout
    assert layout['footer']['top'] < layout['overlayBottom'], layout
    assert layout['bindingHeight'] >= 43, layout
    mobile.click('.settings-cloud summary')
    mobile.wait_for_selector('#cloudPseudo', state='visible')
    mobile.click('.cloud-email-access summary')
    mobile.wait_for_selector('#cloudEmail', state='visible')
    assert mobile.evaluate('document.body.scrollWidth <= innerWidth')
    mobile.click('#settingsCancel')
    mobile.wait_for_selector('.home-menu #playAdventure')

    assert not errors, errors
    assert not mobile_errors, mobile_errors
    print('OK : réglages hiérarchisés, contrôles conservés, sauvegarde/compte accessibles, retours menu/pause et mobile validés.')
    browser.close()
