"""Suivi créateur : activité classique + classée, sans changer score ni quota."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = os.environ.get('MINUIT_TEST_URL', 'http://localhost:3000')
API = 'https://night-test.supabase.co'
SESSION = """(()=>{
 localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true,tutorialDone:true,dodgeGuideDone:true}));
 localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
 localStorage.setItem('minuit-supabase-session-v1',JSON.stringify({access_token:'access-alice',refresh_token:'refresh-alice',expires_at:Date.now()/1000+3600,user:{id:'alice',displayName:'Alice'}}));
})()"""
SCORES = [
    {'rank': 1, 'displayName': 'Alice', 'score': 9200, 'mode': 'ranked', 'difficulty': 'normal', 'stage': 3, 'wave': 4, 'updatedAt': '2026-10-30T20:00:00Z', 'isYou': True, 'isAdmin': True},
    {'rank': 2, 'displayName': 'Bob', 'score': 5600, 'mode': 'ranked', 'difficulty': 'normal', 'stage': 2, 'wave': 2, 'updatedAt': '2026-10-29T20:00:00Z', 'isYou': False, 'isAdmin': False},
]
TEAM = {
    'team': {'id': 'team', 'name': 'Les Balais de minuit', 'code': 'ABCDE23456', 'memberCount': 2,
             'totalScore': 14800, 'isAdmin': True, 'rulesConfigured': True, 'dailyGameLimit': 3,
             'startsAt': None, 'endsAt': None, 'gamesToday': 0, 'gamesRemaining': 3},
    'scores': SCORES,
}
MEMBERS = [
    {'displayName': 'Alice', 'games': 4, 'points': 18900, 'bestScore': 7800, 'bestProgress': 34,
     'lastPlayedAt': '2026-10-30T20:00:00Z', 'rankedGames': 2, 'freeGames': 2,
     'rankedPoints': 4800, 'freePoints': 14100, 'lastRankedAt': '2026-10-30T19:00:00Z',
     'lastFreeAt': '2026-10-30T20:00:00Z', 'isAdmin': True, 'isYou': True},
    {'displayName': 'Bob', 'games': 2, 'points': 7800, 'bestScore': 7800, 'bestProgress': 22,
     'lastPlayedAt': '2026-10-29T20:00:00Z', 'rankedGames': 0, 'freeGames': 2,
     'rankedPoints': 0, 'freePoints': 7800, 'lastRankedAt': None,
     'lastFreeAt': '2026-10-29T20:00:00Z', 'isAdmin': False, 'isYou': False},
]
DAILY = [
    {'playedOn': '2026-10-30', 'games': 4, 'points': 18900, 'bestScore': 7800, 'bestProgress': 34,
     'rankedGames': 2, 'freeGames': 2, 'rankedPoints': 4800, 'freePoints': 14100},
    {'playedOn': '2026-10-29', 'games': 2, 'points': 7800, 'bestScore': 7800, 'bestProgress': 22,
     'rankedGames': 0, 'freeGames': 2, 'rankedPoints': 0, 'freePoints': 7800},
]
RUNS = [
    {'playedAt': '2026-10-30T20:00:00Z', 'playedOn': '2026-10-30', 'displayName': 'Alice', 'score': 6300, 'stage': 3, 'wave': 4, 'mode': 'free', 'difficulty': 'normal', 'isYou': True},
    {'playedAt': '2026-10-30T19:00:00Z', 'playedOn': '2026-10-30', 'displayName': 'Alice', 'score': 4800, 'stage': 3, 'wave': 1, 'mode': 'ranked', 'difficulty': 'hard', 'isYou': True},
    {'playedAt': '2026-10-29T20:00:00Z', 'playedOn': '2026-10-29', 'displayName': 'Bob', 'score': 7800, 'stage': 2, 'wave': 2, 'mode': 'free', 'difficulty': 'normal', 'isYou': False},
]
MEMBERS_ZERO = [
    {'displayName': 'Alice', 'games': 0, 'points': 0, 'bestScore': 0, 'bestProgress': 0, 'lastPlayedAt': None, 'isAdmin': True, 'isYou': True},
    {'displayName': 'Bob', 'games': 0, 'points': 0, 'bestScore': 0, 'bestProgress': 0, 'lastPlayedAt': None, 'isAdmin': False, 'isYou': False},
]


def stats(full_activity):
    if full_activity:
        return {
            'team': {'name': 'Les Balais de minuit'},
            'period': {'days': 30, 'since': '2026-10-03', 'until': '2026-11-01'},
            'activityScope': 'classic-and-ranked',
            'summary': {'games': 6, 'points': 26700, 'bestScore': 7800, 'bestProgress': 34,
                        'activePlayers': 2, 'rankedGames': 2, 'rankedPoints': 4800,
                        'rankedBestScore': 4800, 'freeGames': 4, 'freePoints': 21900,
                        'freeBestScore': 7800},
            'daily': DAILY, 'members': MEMBERS, 'runs': RUNS, 'highscores': SCORES,
        }
    # Ancien RPC : seules les classées et aucun champ de répartition.
    return {
        'team': {'name': 'Les Balais de minuit'},
        'period': {'days': 30, 'since': '2026-10-03', 'until': '2026-11-01'},
        'summary': {'games': 0, 'points': 0, 'bestScore': 0, 'bestProgress': 0, 'activePlayers': 0},
        'daily': [], 'members': MEMBERS_ZERO, 'runs': [],
    }


with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    errors = []
    for width, height in [(390, 844), (360, 640)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True)
        context.route('**/supabase-config.js*', lambda route: route.fulfill(
            content_type='application/javascript', body=f"window.MINUIT_SUPABASE_CONFIG={{url:'{API}',publishableKey:'test'}};"))
        context.add_init_script(SESSION)
        flags = {'full_activity': True, 'activity_supported': True}
        submissions = []

        def handle(route):
            request = route.request
            path = request.url.split('?')[0]
            status = 200
            if path.endswith('/minuit_team_state'):
                payload = TEAM
            elif path.endswith('/minuit_team_stats'):
                payload = stats(flags['full_activity'])
            elif path.endswith('/minuit_submit_team_score'):
                body = json.loads(request.post_data)
                submissions.append(body)
                if not flags['activity_supported']:
                    status, payload = 400, {'message': 'MODE_INVALID'}
                else:
                    payload = {'bestScore': 9200, 'improved': False, 'duplicate': False,
                               'mode': 'free', 'activityOnly': True, 'gamesToday': 0, 'gamesRemaining': 3}
            else:
                payload = {}
            route.fulfill(status=status, content_type='application/json', body=json.dumps(payload),
                          headers={'Access-Control-Allow-Origin': '*'})

        context.route('**://*.supabase.co/**', handle)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE_URL)
        page.wait_for_selector('#playAdventure')
        page.evaluate('Journey.archives()')
        page.wait_for_selector('#teamStatsOpen')

        sent = page.evaluate("""async()=>{
         const data=await MinuitCloud.finishTeamScore({id:'free-activity-1',score:1234,mode:'free',difficulty:'easy',stage:2,wave:3});
         return {total:data.team.totalScore,remaining:data.team.gamesRemaining,result:data.result,skipped:data.skipped};
        }""")
        assert sent['total'] == 14800 and sent['remaining'] == 3 and not sent['skipped']
        assert sent['result']['mode'] == 'free' and sent['result']['activityOnly'] is True
        assert len(submissions) == 1 and submissions[0]['p_mode'] == 'free' and submissions[0]['p_score'] == 1234

        page.click('#teamStatsOpen')
        page.wait_for_selector('.account-team-stats [data-stat="games"]')
        assert page.locator('[data-stat="games"]').inner_text() == '6'
        assert page.locator('[data-stat="points"]').inner_text().replace('\u202f', ' ').replace('\xa0', ' ') == '26 700'
        assert page.locator('[data-stat="bestScore"]').inner_text().replace('\u202f', ' ').replace('\xa0', ' ') == '7 800'
        assert page.locator('[data-stat="activePlayers"]').inner_text() == '2'
        assert page.locator('[data-mode-stat="ranked-games"]').inner_text() == '2'
        assert page.locator('[data-mode-stat="free-games"]').inner_text() == '4'
        assert page.locator('[data-mode-stat="ranked-points"]').inner_text().replace('\u202f', ' ').replace('\xa0', ' ') == '4 800'
        assert page.locator('[data-mode-stat="free-points"]').inner_text().replace('\u202f', ' ').replace('\xa0', ' ') == '21 900'
        text = page.locator('.account-team-stats').inner_text()
        assert 'CLASSÉE OU CLASSIQUE ?' in text and 'Tous les vols transmis sont inclus' in text
        assert 'Seules les classées alimentent le classement' in text
        members = page.locator('.team-stats-members').inner_text()
        assert 'Classées 2 · Classiques 2' in members and 'Classées 0 · Classiques 2' in members
        assert 'Aventure libre' in page.locator('.team-stats-runs').inner_text()
        assert page.locator('.team-highscore-row').count() == 2
        highscores = page.locator('.team-highscore-list').inner_text().replace('\u202f', ' ').replace('\xa0', ' ')
        assert '9 200' in highscores and '5 600' in highscores
        dimensions = page.evaluate("""()=>{const overlay=document.querySelector('#overlay');return{
         document:document.documentElement.scrollWidth,window:innerWidth,
         overlay:overlay.scrollWidth,client:overlay.clientWidth}}""")
        assert dimensions['document'] <= width and dimensions['overlay'] <= dimensions['client'] + 1, dimensions
        tables = page.locator('.team-stats-table')
        for index in range(tables.count()):
            assert tables.nth(index).evaluate('node=>node.scrollWidth<=node.clientWidth+1')
        assert page.locator('.team-stats-modes').evaluate('node=>node.parentElement.scrollWidth<=node.parentElement.clientWidth+1')
        page.screenshot(path=f'/tmp/team-stats-activity-{width}.png', full_page=False)
        page.locator('.team-mode-activity').scroll_into_view_if_needed()
        page.screenshot(path=f'/tmp/team-stats-activity-modes-{width}.png', full_page=False)

        # Compatibilité avec l’ancien RPC : pas de faux zéros classique/classée,
        # mais les highscores du tableau de bord restent visibles.
        flags['full_activity'] = False
        page.click('#teamStatsRefresh')
        page.wait_for_function("document.querySelectorAll('.team-highscore-row').length===2 && !document.querySelector('.team-mode-activity')")
        assert page.locator('[data-stat="games"]').inner_text() == '0'
        flags['activity_supported'] = False
        old_server = page.evaluate("""async()=>MinuitCloud.submitTeamScore({id:'free-old-server',score:50,mode:'free',difficulty:'normal',stage:1,wave:1})""")
        assert old_server['skipped'] and old_server['reason'] == 'activity-unavailable'
        page.click('#teamStatsBack')
        page.wait_for_selector('.team-summary')
        total = page.locator('.team-summary').inner_text().replace('\u202f', ' ').replace('\xa0', ' ')
        assert '14 800' in total

        # Vrai parcours Classique → fin de vol → envoi d’activité, sans classement.
        flags['activity_supported'] = True
        page.goto(BASE_URL)
        page.wait_for_selector('#playAdventure')
        page.click('#playAdventure')
        page.wait_for_function("state==='play'")
        page.evaluate('gameTime=35;score=1234;end(true)')
        page.wait_for_selector('.journey-result-screen')
        page.wait_for_function("document.querySelector('#teamResultStatus')?.textContent.includes('Activité classique transmise')")
        result_text = page.locator('#teamResultStatus').inner_text()
        assert 'aucun point ajouté au classement' in result_text
        assert page.locator('.team-end-board').count() == 0
        assert submissions[-1]['p_mode'] == 'free' and submissions[-1]['p_score'] == 1234
        assert submissions[-1]['p_run_id'].startswith('free-')
        context.close()
    browser.close()
    assert not errors, errors

stats_sql = (ROOT / 'supabase/team_stats.sql').read_text()
rules_sql = (ROOT / 'supabase/team_rules.sql').read_text()
assert "'activityScope', 'classic-and-ranked'" in stats_sql
assert "and ta.mode in ('ranked', 'free')" in stats_sql
assert "'rankedGames'" in stats_sql and "'freeGames'" in stats_sql
assert '"lastRankedAt"' in stats_sql and '"lastFreeAt"' in stats_sql
assert "and ts.mode = 'ranked'" in stats_sql and 'v_legacy' not in stats_sql
assert 'update public.team_score_attempts' not in stats_sql and 'delete from public.team_score_attempts' not in stats_sql
assert "p_mode not in ('ranked', 'free')" in rules_sql
free_guard = rules_sql.index("if p_mode = 'free' then")
score_write = rules_sql.index('insert into public.team_scores', free_guard)
assert 'return json_build_object' in rules_sql[free_guard:score_write]
assert "'activityOnly', true" in rules_sql[free_guard:score_write]
assert 'grant execute on function public.minuit_team_stats(integer) to authenticated' in stats_sql
print('OK : activité tous les vols, répartition par mode, classique transmise sans score ni quota, ancien RPC et mobile.')
