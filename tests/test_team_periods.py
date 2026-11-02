"""Podiums, historique et relance des périodes classées sur mobile."""
import copy
import json
import os
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('MINUIT_TEST_URL', 'http://localhost:3000')
API = 'https://night-test.supabase.co'
SESSION = """(()=>{
 localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true,tutorialDone:true}));
 localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
 localStorage.setItem('minuit-supabase-session-v1',JSON.stringify({access_token:'access-alice',refresh_token:'refresh-alice',expires_at:Date.now()/1000+3600,user:{id:'alice',displayName:'Alice'}}));
})()"""
SCORES = [
    {'rank':1,'displayName':'Alice','score':9200,'mode':'ranked','stage':4,'wave':2,'isYou':True,'isAdmin':True},
    {'rank':2,'displayName':'Bob','score':7600,'mode':'ranked','stage':3,'wave':4,'isYou':False,'isAdmin':False},
    {'rank':3,'displayName':'Charlie','score':5600,'mode':'ranked','stage':3,'wave':1,'isYou':False,'isAdmin':False},
    {'rank':4,'displayName':'David','score':1000,'mode':'ranked','stage':1,'wave':5,'isYou':False,'isAdmin':False},
]
TEAM = {
    'id':'team','name':'Les Balais de minuit','code':'ABCDE23456','memberCount':4,
    'totalScore':23400,'isAdmin':True,'rulesConfigured':True,'dailyGameLimit':3,
    'startsAt':'2026-10-26T11:00:00Z','endsAt':'2026-10-30T19:00:00Z',
    'gamesToday':0,'gamesRemaining':3,'periodNumber':3,'archivedPeriods':2,
}
HISTORY = [
    {'periodNumber':2,'startsAt':'2026-10-19T08:00:00Z','endsAt':'2026-10-25T22:59:00Z',
     'archivedAt':'2026-10-26T08:00:00Z','dailyGameLimit':3,'totalScore':12000,'memberCount':3,
     'scores':[{'rank':1,'displayName':'Bob','score':7000,'stage':3,'wave':2,'isYou':False},
               {'rank':2,'displayName':'Alice','score':5000,'stage':2,'wave':5,'isYou':True},
               {'rank':3,'displayName':'David','score':0,'stage':None,'wave':None,'isYou':False}]},
    {'periodNumber':1,'startsAt':None,'endsAt':'2026-10-18T22:59:00Z',
     'archivedAt':'2026-10-19T08:00:00Z','dailyGameLimit':3,'totalScore':4000,'memberCount':2,
     'scores':[{'rank':1,'displayName':'Alice','score':4000,'stage':2,'wave':3,'isYou':True},
               {'rank':2,'displayName':'Bob','score':0,'stage':None,'wave':None,'isYou':False}]},
]


def podium_names(locator):
    return locator.locator('.team-podium-card b').all_inner_texts()


with sync_playwright() as p:
    launch = {'headless':True,'args':['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, timezone_id='Europe/Paris')
    context.route('**/supabase-config.js*', lambda route: route.fulfill(
        content_type='application/javascript',
        body=f"window.MINUIT_SUPABASE_CONFIG={{url:'{API}',publishableKey:'test'}};"))
    context.add_init_script(SESSION)
    team = copy.deepcopy(TEAM)
    scores = copy.deepcopy(SCORES)
    history = copy.deepcopy(HISTORY)
    calls = []

    def handle(route):
        global scores
        request = route.request
        path = request.url.split('?')[0]
        body = json.loads(request.post_data) if request.post_data else {}
        calls.append((path, body))
        if path.endswith('/minuit_team_state'):
            payload = {'team':team,'scores':scores}
        elif path.endswith('/minuit_team_period_history'):
            payload = {'team':{'name':team['name']},'periods':history}
        elif path.endswith('/minuit_update_team_rules'):
            team.update({'dailyGameLimit':body['p_daily_game_limit'],'startsAt':body['p_starts_at'],
                         'endsAt':body['p_ends_at'],'rulesConfigured':True})
            payload = {'team':team,'scores':scores}
        elif path.endswith('/minuit_start_team_period'):
            history.insert(0, {
                'periodNumber':team['periodNumber'],'startsAt':team['startsAt'],'endsAt':team['endsAt'],
                'archivedAt':datetime.now().isoformat(),'dailyGameLimit':team['dailyGameLimit'],
                'totalScore':team['totalScore'],'memberCount':len(scores),'scores':copy.deepcopy(scores),
            })
            team.update({'periodNumber':team['periodNumber']+1,'archivedPeriods':len(history),
                         'dailyGameLimit':body['p_daily_game_limit'],'startsAt':body['p_starts_at'],
                         'endsAt':body['p_ends_at'],'totalScore':0})
            scores = [dict(row, score=0) for row in scores]
            payload = {'team':team,'scores':scores}
        else:
            payload = {}
        route.fulfill(status=200, content_type='application/json', body=json.dumps(payload),
                      headers={'Access-Control-Allow-Origin':'*'})

    context.route('**://*.supabase.co/**', handle)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(BASE_URL)
    page.wait_for_selector('#playRanked')
    page.wait_for_function('MinuitCloud.teamLoaded')
    home = page.locator('#overlay').inner_text()
    assert 'Période terminée' in home and 'Team fermée' not in home

    page.evaluate('Journey.archives()')
    page.wait_for_selector('.team-podium')
    assert podium_names(page.locator('#teamCard .team-podium')) == ['Alice','Bob','Charlie']
    assert page.locator('#teamCard .team-row').count() == 4
    summary = page.locator('.team-rules-summary').inner_text()
    assert 'Période classée terminée' in summary and 'team reste ouverte aux inscriptions' in summary

    # Le tableau courant présente le top 3 et les quatre lignes complètes.
    page.click('#teamBoardOpen')
    page.wait_for_selector('.account-team-board .team-podium')
    assert podium_names(page.locator('.account-team-board .team-podium')) == ['Alice','Bob','Charlie']
    assert page.locator('.account-team-board .team-row').count() == 4

    # L'historique est accessible à partir du highscore et contient la période affichée.
    page.click('#teamBoardHistory')
    page.wait_for_selector('.team-history-archives .team-period-card')
    assert page.locator('.team-history-archives .team-period-card').count() == 2
    assert page.locator('.account-team-history .team-period-card').count() == 3
    assert 'période terminée' in page.locator('.team-history-current').inner_text().lower()
    first_archive = page.locator('.team-history-archives .team-period-card').first
    assert podium_names(first_archive.locator('.team-podium')) == ['Bob','Alice','David']
    first_archive.locator('.team-period-full summary').click()
    assert first_archive.locator('.team-row').count() == 3
    page.click('#teamHistoryBack')
    page.wait_for_selector('#teamNewPeriod', state='attached')

    # Prolonger au vendredi 6 novembre à 23:59 conserve la même période et ses scores.
    page.click('.team-admin-panel summary')
    page.fill('#teamEditEndsAt','2026-11-06T23:59')
    page.click('#teamSaveRules')
    page.wait_for_function("document.querySelector('#teamStatus').textContent.includes('classement sont conservés')")
    assert calls[-1][0].endswith('/minuit_update_team_rules')
    assert calls[-1][1]['p_ends_at'].startswith('2026-11-06T22:59:00')
    assert len(history) == 2 and team['periodNumber'] == 3 and team['totalScore'] == 23400

    # Une nouvelle période archive l'ancien podium avant de remettre les scores à zéro.
    page.click('.team-admin-panel summary')
    future = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%dT23:59')
    page.fill('#teamEditEndsAt',future)
    page.click('#teamNewPeriod')
    page.wait_for_function("document.querySelector('#teamStatus').textContent.includes('Nouvelle période lancée')")
    assert calls[-1][0].endswith('/minuit_start_team_period')
    assert calls[-1][1]['p_starts_at'] != TEAM['startsAt'], 'le nouveau départ par défaut est maintenant'
    assert team['periodNumber'] == 4 and team['totalScore'] == 0 and len(history) == 3
    assert history[0]['periodNumber'] == 3 and history[0]['totalScore'] == 23400

    page.click('#teamHistoryOpen')
    page.wait_for_function("document.querySelectorAll('.team-history-archives .team-period-card').length===3")
    newest = page.locator('.team-history-archives .team-period-card').first
    assert 'Période 3' in newest.inner_text()
    assert podium_names(newest.locator('.team-podium')) == ['Alice','Bob','Charlie']
    newest.locator('.team-period-full summary').click()
    assert newest.locator('.team-row').count() == 4
    assert '23 400' in newest.inner_text().replace('\u202f',' ').replace('\xa0',' ')
    assert 'Période 4' in page.locator('.team-history-current').inner_text()

    dimensions = page.evaluate("""()=>({document:document.documentElement.scrollWidth,window:innerWidth,
      overlay:document.querySelector('#overlay').scrollWidth,client:document.querySelector('#overlay').clientWidth})""")
    assert dimensions['document'] <= 390 and dimensions['overlay'] <= dimensions['client'] + 1, dimensions
    assert not errors, errors
    browser.close()
    print('OK : podium, highscore complet, inscriptions ouvertes, prolongation au 6 novembre et nouvelle période archivée sur mobile.')
