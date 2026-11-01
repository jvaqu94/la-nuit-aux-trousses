"""Régressions mobiles des bilans, de l'entraînement et des statistiques de team."""
import json
import os

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('MINUIT_TEST_URL', 'http://localhost:3000')
API = 'https://night-test.supabase.co'
SIZES = [(390, 844), (360, 640)]
TRAINED = """(()=>{
 localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true,tutorialDone:true,dodgeGuideDone:true}));
 localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
})()"""
SESSION = """(()=>{
 localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true,tutorialDone:true,dodgeGuideDone:true}));
 localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
 localStorage.setItem('minuit-supabase-session-v1',JSON.stringify({access_token:'access-alice',refresh_token:'refresh-alice',expires_at:Date.now()/1000+3600,user:{id:'alice',displayName:'Alice'}}));
})()"""
TEAM = {
    'team': {'id': 'team', 'name': 'Les Balais de minuit', 'code': 'ABCDE23456',
             'memberCount': 2, 'totalScore': 14800, 'isAdmin': True,
             'rulesConfigured': True, 'dailyGameLimit': 3, 'startsAt': None,
             'endsAt': None, 'gamesToday': 1, 'gamesRemaining': 2},
    'scores': [
        {'rank': 1, 'displayName': 'Alice', 'score': 9200, 'mode': 'ranked', 'stage': 3, 'wave': 4, 'isYou': True, 'isAdmin': True},
        {'rank': 2, 'displayName': 'Bob', 'score': 5600, 'mode': 'ranked', 'stage': 2, 'wave': 2, 'isYou': False, 'isAdmin': False},
    ],
}
STATS = {
    'summary': {'games': 8, 'points': 27400, 'bestScore': 9200, 'bestProgress': 34, 'activePlayers': 2},
    'daily': [
        {'playedOn': '2026-11-01', 'games': 5, 'points': 14800, 'bestScore': 9200, 'bestProgress': 34},
        {'playedOn': '2026-10-31', 'games': 3, 'points': 12600, 'bestScore': 5600, 'bestProgress': 22},
    ],
    'members': [
        {'displayName': 'Alice', 'games': 5, 'points': 18100, 'bestScore': 9200, 'bestProgress': 34, 'lastPlayedAt': '2026-11-01T20:00:00Z', 'isAdmin': True, 'isYou': True},
        {'displayName': 'Bob', 'games': 3, 'points': 9300, 'bestScore': 5600, 'bestProgress': 22, 'lastPlayedAt': '2026-10-31T20:00:00Z', 'isAdmin': False, 'isYou': False},
    ],
    'runs': [
        {'playedAt': '2026-11-01T20:00:00Z', 'playedOn': '2026-11-01', 'displayName': 'Alice', 'score': 9200, 'stage': 3, 'wave': 4, 'mode': 'ranked', 'difficulty': 'hard', 'isYou': True},
        {'playedAt': '2026-10-31T20:00:00Z', 'playedOn': '2026-10-31', 'displayName': 'Bob', 'score': 5600, 'stage': 2, 'wave': 2, 'mode': 'ranked', 'difficulty': 'normal', 'isYou': False},
    ],
}
SPRINT = """()=>{
 WeeklySprint.start();enemies=[];spawnEnemy({x:400,kind:'ghost',pattern:0,group:0,index:0});reward(enemies[0]);
 gameTime=12;beginTransition(false);score+=60;transition=0;advanceStage();
 combo=2;graze++;League.event('graze',1);score+=50;gameTime=28;beginTransition(false);transition=0;advanceStage();
 combo=1;gameTime=47;wave=5;enemies=[];spawnBoss();const guardian=enemies.find(enemy=>enemy.boss);gameTime=65;reward(guardian);
}"""
TRAIN_TO_BONUS = """()=>{GuidedTraining.start();for(let i=0;i<8;i++)document.querySelector('#trainingSkip').click()}"""


def assert_no_horizontal(page, label):
    dimensions = page.evaluate("""()=>{const o=document.querySelector('#overlay');return{
     document:document.documentElement.scrollWidth,window:innerWidth,
     overlay:o.scrollWidth,client:o.clientWidth}}""")
    assert dimensions['document'] <= dimensions['window'], (label, dimensions)
    assert dimensions['overlay'] <= dimensions['client'] + 1, (label, dimensions)


def assert_visible(page, selectors, label):
    for selector in selectors:
        box = page.locator(selector).bounding_box()
        assert box and box['y'] >= 0 and box['y'] + box['height'] <= page.evaluate('innerHeight') + 1, (label, selector, box)
        assert box['height'] >= 43, (label, selector, box)


def assert_bottom_note_clear(page, action_selector, note_selector, label):
    page.evaluate("document.querySelector('#overlay').scrollTop=document.querySelector('#overlay').scrollHeight")
    page.wait_for_timeout(30)
    action = page.locator(action_selector).bounding_box()
    note = page.locator(note_selector).bounding_box()
    assert action and note
    overlap = max(0, min(action['y'] + action['height'], note['y'] + note['height']) - max(action['y'], note['y']))
    assert overlap <= 1, (label, action, note)
    page.evaluate("document.querySelector('#overlay').scrollTop=0")


def fresh(page):
    page.goto(BASE_URL)
    page.wait_for_selector('#playAdventure')


def team_route(route):
    path = route.request.url.split('?')[0]
    payload = TEAM if path.endswith('/minuit_team_state') else STATS if path.endswith('/minuit_team_stats') else {}
    route.fulfill(status=200, content_type='application/json', body=json.dumps(payload),
                  headers={'Access-Control-Allow-Origin': '*'})


with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    errors = []
    for width, height in SIZES:
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        context.route('**/supabase-config.js*', lambda route: route.fulfill(
            content_type='application/javascript', body='window.MINUIT_SUPABASE_CONFIG={};'))
        context.add_init_script(TRAINED)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))

        fresh(page)
        page.evaluate("LocalLeague.menu();document.querySelector('#wardrobe').click()")
        page.wait_for_selector('.grimoire-screen')
        assert_visible(page, ['#collectionBack'], f'{width} grimoire')
        assert_no_horizontal(page, f'{width} grimoire')

        fresh(page)
        page.click('#playAdventure')
        page.wait_for_function("state==='play'")
        page.evaluate('score=23456;gameTime=75;upgrades.rocket=2;upgrades.fragment=1;upgrades.familiar=1;end(false)')
        page.wait_for_selector('.journey-result-screen', timeout=8000)
        assert_visible(page, ['#retry', '#replayChangeBuild', '#resultCollection', '#return'], f'{width} bilan campagne')
        assert_no_horizontal(page, f'{width} bilan campagne')
        assert_bottom_note_clear(page, '.journey-result-screen .replay-result-actions', '#submitstatus', f'{width} bilan campagne')

        fresh(page)
        page.evaluate(SPRINT)
        page.wait_for_selector('.weekly-result')
        assert_visible(page, ['#weeklyRetry', '#weeklyTrainGuardian', '#weeklyHome'], f'{width} bilan Sprint')
        assert_no_horizontal(page, f'{width} bilan Sprint')
        assert_bottom_note_clear(page, '.weekly-result .replay-result-actions', '.weekly-result>.tiny:last-child', f'{width} bilan Sprint')

        fresh(page)
        page.evaluate(TRAIN_TO_BONUS)
        page.wait_for_selector('#trainingBonusGallery')
        page.click('#trainingBonusGallery')
        page.wait_for_selector('.training-bonus-gallery')
        assert_visible(page, ['#bonusGalleryBack'], f'{width} galerie bonus')
        assert_no_horizontal(page, f'{width} galerie bonus')
        page.click('#bonusGalleryBack')
        page.evaluate("document.querySelector('#trainingNext').click();document.querySelector('#trainingSkip').click()")
        page.wait_for_selector('.training-finish')
        assert_no_horizontal(page, f'{width} fin entrainement')
        assert_visible(page, ['#trainingPlay', '#trainingAgain', '#trainingMenu'], f'{width} fin entrainement')
        icons = page.locator('.finish-art .lesson-icon')
        assert icons.count() == 6
        bounds = icons.evaluate_all("nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}})")
        overlay = page.locator('#overlay').bounding_box()
        assert all(item['width'] > 0 and item['left'] >= overlay['x'] and item['right'] <= overlay['x'] + overlay['width'] + 1 for item in bounds), bounds

        fresh(page)
        page.evaluate('help()')
        page.wait_for_selector('#back')
        assert_visible(page, ['#back'], f'{width} aide')
        assert_no_horizontal(page, f'{width} aide')
        context.close()

        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        context.route('**/supabase-config.js*', lambda route: route.fulfill(
            content_type='application/javascript', body=f"window.MINUIT_SUPABASE_CONFIG={{url:'{API}',publishableKey:'test'}};"))
        context.route('**://*.supabase.co/**', team_route)
        context.add_init_script(SESSION)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE_URL)
        page.wait_for_selector('#playAdventure')
        page.evaluate('Journey.archives()')
        page.wait_for_selector('#teamCopyCode')
        page.click('#teamStatsOpen')
        page.wait_for_selector('.account-team-stats [data-stat="games"]')
        assert_visible(page, ['#teamStatsBack'], f'{width} statistiques team')
        assert_no_horizontal(page, f'{width} statistiques team')
        assert page.locator('.team-stats-day').count() == 2
        assert page.locator('.team-stats-member').count() == 2
        assert page.locator('.team-stats-run').count() == 2
        tables = page.locator('.team-stats-table')
        for index in range(tables.count()):
            table = tables.nth(index)
            assert table.evaluate('node=>node.scrollWidth<=node.clientWidth+1')
            assert table.locator('thead').is_hidden()
            labels = table.locator('td').evaluate_all("cells=>cells.every(cell=>cell.dataset.label&&getComputedStyle(cell,'::before').content!=='none')")
            assert labels
        text = page.locator('.account-team-stats').inner_text().replace('\u202f', ' ').replace('\xa0', ' ')
        for expected in ['27 400', '18 100', '9 300', 'DERNIERS VOLS COMPTABILISÉS']:
            assert expected in text, (width, expected, text)
        labels = set(page.locator('.account-team-stats td').evaluate_all("cells=>cells.map(cell=>cell.dataset.label)"))
        assert {'Date', 'Membre', 'Monde atteint', 'Points gagnés', 'Record', 'Dernier vol'} <= labels
        page.evaluate("document.querySelector('#overlay').scrollTop=document.querySelector('#overlay').scrollHeight")
        assert_visible(page, ['#teamStatsBack'], f'{width} statistiques team défilées')
        context.close()
    browser.close()
    assert not errors, errors
    print('OK : bilans, Grimoire, galerie, fin d’entraînement et statistiques de team optimisés à 390×844 et 360×640.')
