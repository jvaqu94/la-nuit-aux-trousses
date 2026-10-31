"""Choix classique/classé : catégories, reprise et nouvelle tentative."""
from playwright.sync_api import sync_playwright

INIT = """(()=>{
  const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');
  localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}));
  const settings=JSON.parse(localStorage.getItem('minuit-settings')||'{}');
  localStorage.setItem('minuit-settings',JSON.stringify({...settings,sound:false,music:false}));
})()"""

def result(page):
    page.wait_for_selector('.journey-result-screen .arcade-score-table', timeout=15000)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1366,'height':1000})
    page=context.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('dialog',lambda dialog:dialog.accept())
    page.add_init_script(INIT)
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    assert page.locator('#playRanked').count()==0 and page.locator('#localRanked').count()==0
    page.evaluate("window.MinuitCloud={inTeam:true,connected:false,configured:false};Journey.menu()")
    page.wait_for_selector('#playRanked')
    assert page.locator('#playAdventure').is_visible()
    assert 'Classique' in page.locator('#playAdventure').inner_text()
    assert 'Classée' in page.locator('#playRanked').inner_text()

    # La partie classique conserve la catégorie de difficulté et ne devient pas classée.
    page.click('#playAdventure')
    page.wait_for_function("state==='play' && mode==='story' && runId==='normal' && !League.active")
    page.evaluate('score=4200;gameTime=35;end(false)')
    result(page)
    assert page.evaluate("MinuitLastScore.category")=='normal'
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-highscores')).normal")>=4200
    assert not page.evaluate("Object.prototype.hasOwnProperty.call(JSON.parse(localStorage.getItem('minuit-highscores')),'ranked')")
    assert 'NUIT NOIRE' in page.locator('.arcade-result-caption').inner_text().upper()
    page.click('#return')
    page.wait_for_selector('#playRanked')

    # Le bouton classé ouvre le prévol existant, puis le moteur porte réellement ranked.
    page.click('#playRanked')
    page.wait_for_selector('#launchLocal')
    assert 'highscore classé' in page.locator('#overlay').inner_text()
    page.click('#launchLocal')
    page.wait_for_function("state==='play' && mode==='ranked' && runId==='ranked' && League.active")
    assert page.evaluate('diff')==1
    page.evaluate('score=7100;gameTime=40;saveCheckpoint()')
    run_id=page.evaluate('League.snapshot().id')
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-checkpoint')).runId")=='ranked'

    # La reprise ne change ni le mode ni la catégorie et ne consomme pas un essai.
    page.reload()
    page.wait_for_selector('#localResume')
    page.click('#localResume')
    page.wait_for_function("state==='play' && mode==='ranked' && runId==='ranked' && League.active")
    assert page.evaluate('League.snapshot().id')==run_id
    assert page.evaluate("Object.values(JSON.parse(localStorage.getItem('minuit-local-league-v1')).days)[0].rankedUsed")==1
    page.evaluate('score=7600;end(false)')
    result(page)
    assert page.evaluate("MinuitLastScore.category")=='ranked'
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-highscores')).ranked")==7600
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-highscores')).normal")==4200
    assert 'PARTIE CLASSÉE' in page.locator('.arcade-result-caption').inner_text().upper()
    assert page.locator('.scoreboard-window .arcade-score-row').first.locator('.arcade-points').inner_text()=='007600'

    # Rejouer depuis un bilan classé revient au prévol classé, pas à une partie libre.
    page.click('#retry')
    page.wait_for_selector('#launchLocal')
    assert page.evaluate("Object.values(JSON.parse(localStorage.getItem('minuit-local-league-v1')).days)[0].rankedUsed")==1
    page.click('#launchLocal')
    page.wait_for_function("state==='play' && mode==='ranked' && runId==='ranked'")
    assert page.evaluate("Object.values(JSON.parse(localStorage.getItem('minuit-local-league-v1')).days)[0].rankedUsed")==2
    page.evaluate('score=100;end(false)')
    result(page)
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-highscores')).ranked")==7600
    page.click('#return')
    page.wait_for_selector('#arcadeScores')
    page.click('#arcadeScores')
    page.wait_for_selector('.arcade-score-screen')
    page.click('#arcadeTab-ranked')
    ranked_text=page.locator('#arcadeBoardTable').inner_text()
    assert '007600' in ranked_text and '000100' in ranked_text
    assert '004200' not in ranked_text
    page.click('#arcadeTab-normal')
    normal_text=page.locator('#arcadeBoardTable').inner_text()
    assert '004200' in normal_text and '007600' not in normal_text
    assert page.evaluate("Journey.validate(Journey.bundle()).saves['minuit-v2-scores'].some(row=>row.category==='ranked')")

    # Les deux choix restent visibles et utilisables sur un petit écran.
    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.add_init_script(INIT)
    mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#playAdventure')
    assert mobile.locator('#playRanked').count()==0 and mobile.locator('#localRanked').count()==0
    mobile.evaluate("window.MinuitCloud={inTeam:true,connected:false,configured:false};Journey.menu()")
    mobile.wait_for_selector('#playRanked')
    assert mobile.locator('#playAdventure').is_visible() and mobile.locator('#playRanked').is_visible()
    assert mobile.evaluate('document.documentElement.scrollWidth<=390')
    for selector in ['#playAdventure','#playRanked']:
        box=mobile.locator(selector).bounding_box()
        assert box and box['width']>=40 and box['height']>=40, (selector,box)
    assert not errors,errors
    browser.close()
    print('OK : choix classique/classé, catégories séparées, checkpoint, retry et accueil mobile.')
