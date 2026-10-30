"""Décompte de défaite et page de HI-SCORES plein écran sur ordinateur."""
import os
import re
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]

with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    context = browser.new_context(viewport={'width': 1366, 'height': 900})
    context.route('**/supabase-config.js*', lambda route: route.fulfill(
        content_type='application/javascript', body='window.MINUIT_SUPABASE_CONFIG={};',
    ))
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    page.evaluate('gameTime=35;score=3456;end(false)')

    page.wait_for_selector('.death-transition')
    page.wait_for_function("Number(document.querySelector('#deathCountdown')?.textContent) >= 1")
    countdown = int(page.locator('#deathCountdown').inner_text())
    assert 1 <= countdown <= 9
    assert 'HI-SCORES' in page.locator('#deathCountdownLabel').inner_text()
    assert 'plein écran' in page.locator('.death-transition').inner_text()

    page.wait_for_selector('.journey-result-screen')
    page.wait_for_selector('.journey-result-screen .arcade-score-table')
    metrics = page.evaluate("""() => ({
        overlay:document.querySelector('#overlay').getBoundingClientRect().height,
        holder:document.querySelector('.layout>div:first-child').getBoundingClientRect().height,
        arena:document.querySelector('.arena').getBoundingClientRect().width,
        holderWidth:document.querySelector('.layout>div:first-child').getBoundingClientRect().width,
        sidebar:getComputedStyle(document.querySelector('.sidebar')).display,
        touchbar:getComputedStyle(document.querySelector('.touchbar')).display,
        boardAfterDeath:!!(document.querySelector('.death-note').compareDocumentPosition(document.querySelector('.scoreboard-window')) & Node.DOCUMENT_POSITION_FOLLOWING),
        boardBeforeGrid:!!(document.querySelector('.scoreboard-window').compareDocumentPosition(document.querySelector('.journey-result-grid')) & Node.DOCUMENT_POSITION_FOLLOWING)
    })""")
    assert metrics['overlay'] + 2 >= metrics['holder'], metrics
    assert metrics['arena'] + 2 >= metrics['holderWidth'], metrics
    assert metrics['sidebar'] == 'none' and metrics['touchbar'] == 'none', metrics
    assert metrics['boardAfterDeath'] and metrics['boardBeforeGrid'], metrics
    latest = page.locator('.arcade-score-row.is-last')
    assert latest.count() == 1
    assert int(re.sub(r'\D', '', latest.locator('.arcade-points').inner_text())) == 3456
    assert 'HI-SCORES' in page.locator('.scoreboard-title').inner_text()
    page.screenshot(path='/tmp/death-highscores-desktop.png')
    assert not errors, errors
    print('OK : décompte visible, Top 10 du dernier vol et HI-SCORES plein écran sur ordinateur.')
    context.close()

    # Sans audio disponible, la transition conserve son repli de trois secondes.
    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile.route('**/supabase-config.js*', lambda route: route.fulfill(
        content_type='application/javascript', body='window.MINUIT_SUPABASE_CONFIG={};',
    ))
    phone = mobile.new_page()
    phone_errors = []
    phone.on('pageerror', lambda error: phone_errors.append(str(error)))
    phone.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");phone.goto('http://localhost:3000')
    phone.wait_for_selector('#playAdventure')
    phone.evaluate('MinuitSoundtrack.player.defeat=()=>undefined')
    phone.click('#playAdventure')
    phone.wait_for_function("state==='play'")
    started = time.monotonic()
    phone.evaluate('gameTime=35;score=2345;end(false)')
    phone.wait_for_selector('.death-transition')
    phone.wait_for_function("Number(document.querySelector('#deathCountdown')?.textContent) >= 1")
    assert 1 <= int(phone.locator('#deathCountdown').inner_text()) <= 3
    phone.screenshot(path='/tmp/death-countdown-mobile.png')
    phone.wait_for_selector('.journey-result-screen', timeout=6000)
    elapsed = time.monotonic() - started
    assert 2.7 <= elapsed <= 5.5, elapsed
    phone.wait_for_selector('.journey-result-screen .arcade-score-table')
    dimensions = phone.evaluate("""() => ({
        overlay:document.querySelector('#overlay').getBoundingClientRect().height,
        holder:document.querySelector('.layout>div:first-child').getBoundingClientRect().height,
        arena:document.querySelector('.arena').getBoundingClientRect().width,
        holderWidth:document.querySelector('.layout>div:first-child').getBoundingClientRect().width,
        sidebar:getComputedStyle(document.querySelector('.sidebar')).display,
        touchbar:getComputedStyle(document.querySelector('.touchbar')).display
    })""")
    assert dimensions['overlay'] + 2 >= dimensions['holder'], dimensions
    assert dimensions['arena'] + 2 >= dimensions['holderWidth'], dimensions
    assert dimensions['sidebar'] == 'none' and dimensions['touchbar'] == 'none', dimensions
    assert int(re.sub(r'\D', '', phone.locator('.arcade-score-row.is-last .arcade-points').inner_text())) == 2345
    phone.screenshot(path='/tmp/death-highscores-mobile.png', full_page=True)
    assert not phone_errors, phone_errors
    print('OK : repli sans audio, décompte de trois secondes et bilan plein écran à 390×844.')
    mobile.close()
    browser.close()

source = (ROOT / 'journey.js').read_text()
assert 'queueTeamResult(r);renderResult(r)' in source
assert 'Math.max(3000' in source
assert 'deathCountdownLabel' in source
