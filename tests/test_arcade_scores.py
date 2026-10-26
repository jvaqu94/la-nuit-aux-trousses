"""Tableau arcade : Top 10, catégories, dernier vol et défilement contrôlable."""
from playwright.sync_api import sync_playwright

SEED = """()=>{
  prefs.sound=false;dailyDate=dateKey();
  const normal=Array.from({length:12},(_,i)=>({name:'Sorcière '+(i+1),score:(i+1)*1375,category:'normal',date:dailyDate,stage:i%5+1,clears:i%5,win:false,time:40+i}));
  records=[...normal,
    {name:'Claire 1',score:4200,category:'easy',date:dailyDate,stage:2,clears:1,win:false,time:50},
    {name:'Claire 2',score:3200,category:'easy',date:dailyDate,stage:1,clears:0,win:false,time:40},
    {name:'Cauchemar',score:9900,category:'hard',date:dailyDate,stage:4,clears:3,win:false,time:90},
    {name:'Quotidien',score:7700,category:'daily',date:dailyDate,stage:3,clears:2,win:false,time:70},
    {name:'Ancien défi',score:19999,category:'daily',date:'2000-01-01',stage:5,clears:5,win:true,time:100}
  ];
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#arcadeScores')
    page.evaluate(SEED)
    page.click('#arcadeScores')
    page.wait_for_selector('.arcade-score-screen')

    rows = page.locator('.arcade-score-group').first.locator('.arcade-score-row')
    assert rows.count() == 10
    assert rows.first.locator('.arcade-rank').inner_text() == '01'
    assert rows.first.locator('.arcade-player').inner_text() == 'Sorcière 12'
    assert rows.first.locator('.arcade-points').inner_text() == '016500'
    assert rows.last.locator('.arcade-rank').inner_text() == '10'
    assert rows.last.locator('.arcade-points').inner_text() == '004125'
    assert 'Sorcière 2' not in page.locator('#arcadeBoardTable').inner_text()
    assert page.locator('.arcade-score-duplicate').count() == 1
    assert 'is-auto' in page.locator('.arcade-score-table').get_attribute('class')

    track = page.locator('.arcade-score-track')
    page.locator('.arcade-marquee').hover()
    page.evaluate('document.activeElement?.blur()')
    assert track.evaluate("e=>getComputedStyle(e).animationName") == 'arcade-score-scroll'
    track.evaluate("e=>e.style.animationDelay='-6s'")
    page.wait_for_timeout(100)
    before = track.evaluate('e=>getComputedStyle(e).transform')
    page.wait_for_timeout(350)
    after = track.evaluate('e=>getComputedStyle(e).transform')
    assert before != 'none' and after != 'none' and before != after, (before, after)

    page.click('.arcade-scroll-toggle')
    assert 'is-manual' in page.locator('.arcade-score-table').get_attribute('class')
    assert track.evaluate("e=>getComputedStyle(e).animationName") == 'none'
    assert not page.locator('.arcade-score-duplicate').is_visible()
    viewport = page.locator('.arcade-score-viewport')
    assert viewport.evaluate('e=>e.scrollHeight>e.clientHeight')
    viewport.evaluate('e=>e.scrollTop=120')
    assert viewport.evaluate('e=>e.scrollTop') == 120
    viewport.hover()
    page.mouse.wheel(0, 40)
    page.wait_for_timeout(80)
    first_wheel = viewport.evaluate('e=>e.scrollTop')
    page.mouse.wheel(0, 40)
    page.wait_for_timeout(80)
    second_wheel = viewport.evaluate('e=>e.scrollTop')
    assert first_wheel > 120 and second_wheel > first_wheel, (first_wheel, second_wheel)
    page.click('.arcade-scroll-toggle')
    assert 'is-auto' in page.locator('.arcade-score-table').get_attribute('class')
    assert viewport.evaluate('e=>e.scrollTop') == 0
    page.evaluate('document.activeElement?.blur()')
    viewport.hover()
    assert track.evaluate("e=>getComputedStyle(e).animationPlayState") == 'paused'
    page.locator('.arcade-marquee').hover()
    assert track.evaluate("e=>getComputedStyle(e).animationPlayState") == 'running'

    page.click('#arcadeTab-easy')
    easy = page.locator('.arcade-score-group').first.locator('.arcade-score-row')
    assert easy.count() == 2 and 'is-static' in page.locator('.arcade-score-table').get_attribute('class')
    assert 'Claire 1' in easy.first.inner_text() and 'Claire 2' in easy.last.inner_text()
    assert page.locator('.arcade-scroll-toggle').count() == 0
    page.click('#arcadeTab-daily')
    assert page.locator('.arcade-score-group').first.locator('.arcade-score-row').count() == 1
    assert 'Quotidien' in page.locator('#arcadeBoardTable').inner_text()
    assert 'Ancien défi' not in page.locator('#arcadeBoardTable').inner_text()
    page.click('#arcadeTab-hard')
    assert page.locator('.arcade-score-group').first.locator('.arcade-score-row').count() == 1
    assert 'Cauchemar' in page.locator('#arcadeBoardTable').inner_text()

    page.click('#arcadeScoresBack')
    page.wait_for_selector('#arcadeScores')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    page.evaluate('score=23456;gameTime=75;end(false)')
    page.wait_for_selector('.scoreboard-window .arcade-score-table', timeout=10000)
    result_rows = page.locator('.scoreboard-window .arcade-score-group').first.locator('.arcade-score-row')
    assert result_rows.count() == 10
    last = result_rows.first
    assert last.get_attribute('data-last-score') == 'true'
    assert 'DERNIER VOL' in last.inner_text() and '023456' in last.inner_text()
    assert 'is-auto' in page.locator('.scoreboard-window .arcade-score-table').get_attribute('class')
    assert page.evaluate("document.querySelector('.journey-result-grid').nextElementSibling===document.querySelector('.scoreboard-window')")
    assert page.locator('.scoreboard-window > .scoreboard-row').count() == 0
    assert page.locator('#teamResultStatus').count() == 1

    # Même hors du Top 10, le vol qui vient de se terminer garde son rang réel.
    page.click('#retry')
    page.wait_for_function("state==='play'")
    page.evaluate('score=100;gameTime=80;end(false)')
    page.wait_for_selector('.scoreboard-window .arcade-outside', timeout=10000)
    assert 'RANG 14' in page.locator('.scoreboard-window .arcade-outside').inner_text()
    assert page.locator('.scoreboard-window .arcade-score-group [data-last-score]').count() == 0
    assert page.locator('.scoreboard-window .arcade-outside [data-last-score]').count() == 1

    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile_errors = []
    mobile.on('pageerror', lambda error: mobile_errors.append(str(error)))
    mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#arcadeScores')
    mobile.evaluate(SEED)
    mobile.click('#arcadeScores')
    mobile.wait_for_selector('.arcade-score-screen')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    bounds = mobile.evaluate('''()=>{const table=document.querySelector('.arcade-score-table').getBoundingClientRect();const score=document.querySelector('.arcade-score-row .arcade-points').getBoundingClientRect();return {tableRight:table.right,scoreRight:score.right,left:table.left}}''')
    assert bounds['left'] >= 0 and bounds['scoreRight'] <= bounds['tableRight'] + 1, bounds
    mobile.click('.arcade-scroll-toggle')
    assert 'is-manual' in mobile.locator('.arcade-score-table').get_attribute('class')
    mobile.locator('.arcade-score-viewport').evaluate('e=>e.scrollTop=100')
    assert mobile.locator('.arcade-score-viewport').evaluate('e=>e.scrollTop') == 100
    mobile.screenshot(path='/tmp/arcade-mobile.png', full_page=True)

    reduced = browser.new_context(viewport={'width': 1000, 'height': 800}, reduced_motion='reduce')
    calm = reduced.new_page()
    calm_errors = []
    calm.on('pageerror', lambda error: calm_errors.append(str(error)))
    calm.goto('http://localhost:3000')
    calm.wait_for_selector('#arcadeScores')
    calm.evaluate(SEED)
    calm.click('#arcadeScores')
    calm.wait_for_selector('.arcade-score-table.is-manual')
    assert calm.locator('.arcade-score-track').evaluate("e=>getComputedStyle(e).animationName") == 'none'
    assert not calm.locator('.arcade-score-duplicate').is_visible()
    calm.click('.arcade-scroll-toggle')
    assert 'is-auto' in calm.locator('.arcade-score-table').get_attribute('class')

    assert not errors, errors
    assert not mobile_errors, mobile_errors
    assert not calm_errors, calm_errors
    reduced.close()
    browser.close()
    print('Highscores arcade OK : Top 10 trié, catégories isolées, défilement fluide et manuel, dernier vol, mobile et mouvement réduit.')
