"""Entrée classée : team requise et période fermée clairement annoncée."""
import json
import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('MINUIT_TEST_URL', 'http://localhost:3000')
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
ENDED_TEAM = {
    **TEAM,
    'startsAt':'2026-10-26T11:00:00Z',
    'endsAt':'2026-10-30T19:00:00Z',
}


def route_team(page, team):
    page.add_init_script(SESSION)
    page.route('**/rest/v1/rpc/minuit_team_state', lambda route: route.fulfill(
        status=200, content_type='application/json', body=json.dumps({
            'team':team,
            'scores':[{'displayName':'Test','isYou':True,'score':0}] if team else [],
        })))


with sync_playwright() as p:
    launch = {'headless':True, 'args':['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    errors = []

    without_team = browser.new_page(viewport={'width':1000,'height':800})
    without_team.on('pageerror', lambda error: errors.append(str(error)))
    route_team(without_team, None)
    without_team.goto(BASE_URL)
    without_team.wait_for_selector('#playAdventure')
    without_team.wait_for_function('MinuitCloud.teamLoaded')
    assert without_team.locator('#playRanked').count() == 0
    assert without_team.locator('#localRanked').count() == 0
    assert not without_team.evaluate('MinuitCloud.inTeam')
    assert without_team.evaluate('MinuitCloud.rankedNotice') == ''

    with_team = browser.new_page(viewport={'width':1000,'height':800})
    with_team.on('pageerror', lambda error: errors.append(str(error)))
    route_team(with_team, TEAM)
    with_team.goto(BASE_URL)
    with_team.wait_for_selector('#playRanked')
    assert with_team.locator('#localRanked').is_visible()
    assert with_team.evaluate('MinuitCloud.inTeam && MinuitCloud.teamLoaded')
    assert with_team.evaluate('MinuitCloud.rankedNotice') == ''
    assert 'Période terminée' not in with_team.locator('#overlay').inner_text()

    # La période reste volontairement fermée : ne pas promettre trois essais team
    # disponibles ni laisser le joueur découvrir le refus seulement après son vol.
    ended = browser.new_page(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    ended.on('pageerror', lambda error: errors.append(str(error)))
    route_team(ended, ENDED_TEAM)
    ended.goto(BASE_URL)
    ended.wait_for_selector('#localRanked')
    ended.wait_for_function('MinuitCloud.teamLoaded')
    assert 'Période classée terminée' in ended.evaluate('MinuitCloud.rankedNotice')
    assert 'Période terminée' in ended.locator('#overlay').inner_text()
    assert 'Team fermée' not in ended.locator('#overlay').inner_text()

    ended.click('#localRanked')
    ended.wait_for_selector('#launchLocal')
    preflight = ended.locator('#overlay').inner_text()
    assert 'Période classée terminée' in preflight
    assert 'ni le highscore ni le décompte de la team' in preflight
    assert ended.locator('#launchLocal').is_enabled(), 'l’affichage ne doit pas bloquer le jeu local'

    ended.click('#localBack')
    ended.wait_for_selector('#archives')
    ended.click('#archives')
    ended.wait_for_selector('.team-rules-summary')
    summary = ended.locator('.team-rules-summary').inner_text()
    assert 'décompte team suspendu' in summary
    assert 'Période classée terminée' in summary
    assert '3 restantes' not in summary
    status = ended.locator('#teamStatus').inner_text()
    assert 'Période classée terminée' in status and 'highscore' in status

    ended.click('#teamBoardOpen')
    ended.wait_for_selector('.account-team-board')
    board = ended.locator('.account-team-board').inner_text()
    assert 'Période classée terminée' in board and 'décompte team suspendu' in board

    assert not errors, errors
    browser.close()
    print('OK : classé masqué sans team, actif inchangé et période terminée annoncée avant le vol et dans les highscores.')
