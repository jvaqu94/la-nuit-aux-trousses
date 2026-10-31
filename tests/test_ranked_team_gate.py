"""L’entrée classée dépend de l’appartenance réelle à une team."""
import json
from playwright.sync_api import sync_playwright

SESSION = """(()=>{
  localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}));
  localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
  localStorage.setItem('minuit-supabase-session-v1',JSON.stringify({
    access_token:'token',refresh_token:'refresh',expires_at:4102444800,
    user:{id:'user-test',displayName:'Test'}
  }));
})()"""

TEAM = {
    'id':'team-test','name':'Team test','code':'ABCDE23456','memberCount':1,
    'totalScore':0,'isAdmin':True,'rulesConfigured':True,'dailyGameLimit':3,
    'gamesToday':0,'gamesRemaining':3,
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []

    without_team = browser.new_page(viewport={'width':1000,'height':800})
    without_team.on('pageerror', lambda error: errors.append(str(error)))
    without_team.add_init_script(SESSION)
    without_team.route('**/rest/v1/rpc/minuit_team_state', lambda route: route.fulfill(
        status=200, content_type='application/json', body=json.dumps({'team':None,'scores':[]})))
    without_team.goto('http://localhost:3000')
    without_team.wait_for_selector('#playAdventure')
    without_team.wait_for_function('MinuitCloud.teamLoaded')
    assert without_team.locator('#playRanked').count() == 0
    assert without_team.locator('#localRanked').count() == 0
    assert not without_team.evaluate('MinuitCloud.inTeam')

    with_team = browser.new_page(viewport={'width':1000,'height':800})
    with_team.on('pageerror', lambda error: errors.append(str(error)))
    with_team.add_init_script(SESSION)
    with_team.route('**/rest/v1/rpc/minuit_team_state', lambda route: route.fulfill(
        status=200, content_type='application/json', body=json.dumps({
            'team':TEAM, 'scores':[{'displayName':'Test','isYou':True,'score':0}],
        })))
    with_team.goto('http://localhost:3000')
    with_team.wait_for_selector('#playRanked')
    assert with_team.locator('#localRanked').is_visible()
    assert with_team.evaluate('MinuitCloud.inTeam && MinuitCloud.teamLoaded')
    assert not errors, errors
    browser.close()
    print('OK : classé masqué sans team et affiché après confirmation de la team.')
