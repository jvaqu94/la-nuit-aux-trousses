import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://night-test.supabase.co'
ALICE = '4b1b47de-40f2-45f4-a62c-0f702d85ba01'
BOB = '84f2f696-f9f4-4e6f-a25f-62746c598315'
CODE = 'ABCDE23456'
users = {'alice@example.com': ALICE, 'bob@example.com': BOB}
team = None
calls = []


def games_remaining(member):
    limit = team['dailyGameLimit']
    return None if limit is None else max(0, limit - len(member['attempts']))


def member_state(user_id):
    if not team or user_id not in team['members']:
        return {'team': None, 'scores': []}
    members = team['members']
    member = members[user_id]
    ordered = sorted(
        members.items(),
        key=lambda item: (-(item[1].get('score') or 0), item[1]['displayName'].lower()),
    )
    scores = []
    for rank, (member_id, row) in enumerate(ordered, 1):
        scores.append({
            'rank': rank,
            'displayName': row['displayName'],
            'score': row.get('score') or 0,
            'mode': row.get('mode'),
            'difficulty': row.get('difficulty'),
            'stage': row.get('stage'),
            'wave': row.get('wave'),
            'updatedAt': row.get('updatedAt'),
            'isYou': member_id == user_id,
            'isAdmin': member_id == team['adminId'],
        })
    return {
        'team': {
            'id': team['id'],
            'name': team['name'],
            'code': team['code'],
            'memberCount': len(members),
            'totalScore': sum(row.get('score') or 0 for row in members.values()),
            'isAdmin': team['adminId'] == user_id,
            'rulesConfigured': team['rulesConfigured'],
            'dailyGameLimit': team['dailyGameLimit'],
            'startsAt': team['startsAt'],
            'endsAt': team['endsAt'],
            'gamesToday': len(member['attempts']),
            'gamesRemaining': games_remaining(member),
        },
        'scores': scores,
    }


def request_user(request):
    authorization = request.headers.get('authorization', '')
    if authorization.startswith('Bearer access-'):
        user_id = authorization.removeprefix('Bearer access-')
        if user_id in users.values():
            return user_id
    return None


def parse_date(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')) if value else None


def handle(route):
    global team
    request = route.request
    path = urlsplit(request.url).path
    method = request.method
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    }
    if method == 'OPTIONS':
        route.fulfill(status=204, body='', headers=cors)
        return
    body = json.loads(request.post_data) if request.post_data else {}
    user_id = request_user(request)
    call = {'path': path, 'body': body, 'user_id': user_id, 'url': request.url}
    calls.append(call)
    payload = None
    status = 200

    if path == '/auth/v1/token' and method == 'POST':
        user_id = users[body['email']]
        payload = {
            'access_token': 'access-' + user_id,
            'refresh_token': 'refresh-' + user_id,
            'expires_in': 3600,
            'user': {'id': user_id, 'email': body['email']},
        }
    elif path == '/auth/v1/logout':
        payload = {}
    elif path.startswith('/rest/v1/rpc/') and not user_id:
        payload, status = {'message': 'AUTH_REQUIRED'}, 401
    elif path == '/rest/v1/rpc/minuit_team_state':
        payload = member_state(user_id)
    elif path == '/rest/v1/rpc/minuit_create_team':
        if team or member_state(user_id)['team']:
            payload, status = {'message': 'ALREADY_IN_TEAM'}, 400
        else:
            team = {
                'id': '7d7e7382-1648-4e34-a6a2-f6d616bd4f75',
                'name': body['p_name'].strip(),
                'code': CODE,
                'adminId': user_id,
                'rulesConfigured': True,
                'dailyGameLimit': body['p_daily_game_limit'],
                'startsAt': body['p_starts_at'],
                'endsAt': body['p_ends_at'],
                'members': {
                    user_id: {'displayName': body['p_display_name'].strip(), 'attempts': [], 'runs': set()},
                },
            }
            payload = member_state(user_id)
    elif path == '/rest/v1/rpc/minuit_update_team_rules':
        if not team or team['adminId'] != user_id:
            payload, status = {'message': 'TEAM_ADMIN_REQUIRED'}, 400
        else:
            team['dailyGameLimit'] = body['p_daily_game_limit']
            team['startsAt'] = body['p_starts_at']
            team['endsAt'] = body['p_ends_at']
            team['rulesConfigured'] = True
            payload = member_state(user_id)
    elif path == '/rest/v1/rpc/minuit_join_team':
        normalized = re.sub(r'[^A-Za-z0-9]', '', body['p_code']).upper()
        if not team or team['code'] != normalized:
            payload, status = {'message': 'TEAM_NOT_FOUND'}, 400
        elif user_id in team['members']:
            payload, status = {'message': 'ALREADY_IN_TEAM'}, 400
        else:
            team['members'][user_id] = {
                'displayName': body['p_display_name'].strip(), 'attempts': [], 'runs': set(),
            }
            payload = member_state(user_id)
    elif path == '/rest/v1/rpc/minuit_submit_team_score':
        if not team or user_id not in team['members']:
            payload, status = {'message': 'NOT_IN_TEAM'}, 400
        else:
            member = team['members'][user_id]
            run_id = body['p_run_id']
            if run_id in member['runs']:
                payload = {
                    'bestScore': member.get('score') or 0,
                    'improved': False,
                    'duplicate': True,
                    'gamesToday': len(member['attempts']),
                    'gamesRemaining': games_remaining(member),
                }
            elif not team['rulesConfigured']:
                payload, status = {'message': 'TEAM_RULES_REQUIRED'}, 400
            elif team['startsAt'] and datetime.now(timezone.utc) < parse_date(team['startsAt']):
                payload, status = {'message': 'TEAM_PERIOD_NOT_STARTED'}, 400
            elif team['endsAt'] and datetime.now(timezone.utc) >= parse_date(team['endsAt']):
                payload, status = {'message': 'TEAM_PERIOD_ENDED'}, 400
            elif team['dailyGameLimit'] is not None and len(member['attempts']) >= team['dailyGameLimit']:
                payload, status = {'message': 'TEAM_DAILY_LIMIT'}, 400
            else:
                previous = member.get('score')
                improved = previous is None or body['p_score'] > previous
                member['runs'].add(run_id)
                member['attempts'].append(body['p_score'])
                if improved:
                    member.update({
                        'score': body['p_score'],
                        'mode': body['p_mode'],
                        'difficulty': body['p_difficulty'],
                        'stage': body['p_stage'],
                        'wave': body['p_wave'],
                        'updatedAt': '2026-10-25T13:00:00Z',
                    })
                payload = {
                    'bestScore': member['score'],
                    'improved': improved,
                    'duplicate': False,
                    'gamesToday': len(member['attempts']),
                    'gamesRemaining': games_remaining(member),
                }
    elif path == '/rest/v1/rpc/minuit_delete_team':
        if not team or team['adminId'] != user_id:
            payload, status = {'message': 'TEAM_ADMIN_REQUIRED'}, 400
        else:
            team = None
            payload = {'team': None, 'scores': [], 'deleted': True}
    elif path == '/rest/v1/rpc/minuit_leave_team':
        if team:
            was_admin = team['adminId'] == user_id
            team['members'].pop(user_id, None)
            if not team['members']:
                team = None
            elif was_admin:
                team['adminId'] = next(iter(team['members']))
        payload = {'team': None, 'scores': []}
    else:
        payload, status = {'message': 'route inattendue'}, 404

    call['status'] = status
    route.fulfill(
        status=status,
        content_type='application/json',
        body=json.dumps(payload) if payload is not None else '',
        headers=cors,
    )


def login(page, email):
    if not page.locator('#cloudEmail').count():
        page.click('#archives')
    page.wait_for_selector('#cloudEmail')
    page.fill('#cloudEmail', email)
    page.fill('#cloudPassword', 'mot-de-passe-jamais-stocke')
    page.click('#cloudLogin')
    page.wait_for_selector('#cloudSync')


def finish_run(page, score):
    if page.locator('#playAdventure').count():
        page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    page.evaluate(f'gameTime=35;score={score};end(false)')
    page.wait_for_selector('#teamResultStatus')


def score_total(page):
    text = page.locator('.team-summary b').last.inner_text()
    return int(re.sub(r'\D', '', text))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []

    def make_page(email, mobile=False, url='http://localhost:3000'):
        context = browser.new_context(
            viewport={'width': 390, 'height': 844} if mobile else {'width': 1366, 'height': 1000},
            is_mobile=mobile,
            has_touch=mobile,
        )
        context.route('**/supabase-config.js*', lambda route: route.fulfill(
            content_type='application/javascript',
            body=f"window.MINUIT_SUPABASE_CONFIG={{url:'{BASE}',publishableKey:'sb_publishable_test'}};",
        ))
        context.route(BASE + '/**', handle)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('dialog', lambda dialog: dialog.accept())
        page.goto(url)
        page.wait_for_selector('#playAdventure')
        login(page, email)
        return context, page

    context_a, alice = make_page('alice@example.com')
    alice.wait_for_selector('#teamCreate')
    alice.fill('#teamDisplayName', 'Alice')
    alice.fill('#teamName', 'Les Balais de minuit')
    alice.select_option('#teamRulesDailyLimit', '2')
    alice.fill('#teamRulesStartsAt', '2026-10-24T00:00')
    alice.fill('#teamRulesEndsAt', '2026-10-27T00:00')
    alice.click('#teamCreate')
    alice.wait_for_selector('#teamCopyCode')
    assert alice.locator('#teamCopyCode').inner_text() == 'ABCDE-23456'
    assert alice.locator('.team-row').count() == 1
    assert 'Alice' in alice.locator('.team-leaderboard').inner_text()
    assert alice.locator('#teamSaveRules').count() == 1
    assert '0/2 parties' in alice.locator('.team-rules-summary').inner_text()
    assert 'alice@example.com' not in alice.locator('#teamCard').inner_text()
    assert 'Supabase' not in alice.locator('body').inner_text()
    assert not alice.locator('#teamWhatsApp').is_visible()
    whatsapp = alice.locator('#teamWhatsApp').get_attribute('href')
    message = parse_qs(urlsplit(whatsapp).query)['text'][0]
    invitation = re.search(r'https?://\S+', message).group(0)
    assert parse_qs(urlsplit(invitation).query)['team'] == [CODE]
    assert 'ABCDE-23456' in message
    messenger = alice.locator('#teamMessenger').get_attribute('href')
    messenger_link = parse_qs(urlsplit(messenger).query)['u'][0]
    assert parse_qs(urlsplit(messenger_link).query)['team'] == [CODE]
    assert all(secret not in whatsapp + messenger for secret in ['access_token', 'refresh_token', 'traffic_access_token'])

    # L’invitation e-mail prépare le destinataire, l’objet, le code et le même lien sans jeton.
    assert alice.locator('#teamEmailInvite').is_visible()
    alice.evaluate("document.getElementById('teamEmailInvite').addEventListener('click',event=>event.preventDefault())")
    alice.fill('#teamInviteEmail', 'adresse-invalide')
    alice.click('#teamEmailInvite')
    assert 'adresse e-mail valide' in alice.locator('#teamStatus').inner_text()
    alice.fill('#teamInviteEmail', 'friend@example.com')
    email_invite = alice.locator('#teamEmailInvite').get_attribute('href')
    parsed_email = urlsplit(email_invite)
    email_query = parse_qs(parsed_email.query)
    assert parsed_email.scheme == 'mailto' and unquote(parsed_email.path) == 'friend@example.com'
    assert 'Les Balais de minuit' in email_query['subject'][0]
    assert 'ABCDE-23456' in email_query['body'][0]
    assert invitation in email_query['body'][0]
    assert all(secret not in email_invite for secret in ['access_token', 'refresh_token', 'traffic_access_token'])
    alice.click('#teamEmailInvite')
    assert 'Invitation préparée pour friend@example.com' in alice.locator('#teamStatus').inner_text()

    # Bob ouvre une invitation sur mobile : le code est prérempli et les jetons sont retirés de l’URL.
    context_b, bob = make_page('bob@example.com', mobile=True, url='http://localhost:3000/?team=abcde-23456&access_token=secret&refresh_token=secret&traffic_access_token=secret#session_id=secret')
    bob.wait_for_selector('#teamJoin')
    assert bob.locator('#teamCode').input_value() == 'ABCDE-23456'
    assert bob.evaluate("location.search==='' && location.hash===''")
    assert 'secret' not in bob.evaluate('location.href')
    bob.fill('#teamDisplayName', 'Bob')
    bob.click('#teamJoin')
    bob.wait_for_selector('#teamCopyCode')
    assert bob.locator('.team-row').count() == 2
    assert bob.locator('#teamSaveRules').count() == 0
    assert bob.locator('#teamDelete').count() == 0
    assert bob.locator('#teamWhatsApp').is_visible() and bob.locator('#teamMessenger').is_visible()
    assert bob.locator('#teamEmailInvite').is_visible() and bob.locator('#teamInviteEmail').is_visible()
    assert bob.evaluate('document.documentElement.scrollWidth<=390')
    assert 'bob@example.com' not in bob.locator('#teamCard').inner_text()

    alice.click('#teamRefresh')
    alice.wait_for_function("document.querySelectorAll('.team-row').length===2")
    assert 'Bob' in alice.locator('.team-leaderboard').inner_text()

    # Deux parties par jour : le score faible compte quand même comme une tentative.
    alice.click('#archivesBack')
    finish_run(alice, 1500)
    alice.wait_for_function("document.querySelector('#teamResultStatus')?.textContent.includes('1 partie restante')")

    bob.click('#archivesBack')
    finish_run(bob, 2200)
    bob.wait_for_function("document.querySelector('#teamResultStatus')?.textContent.includes('Nouveau highscore')")

    alice.click('#retry')
    alice.wait_for_function("state==='play'")
    alice.evaluate('gameTime=40;score=900;end(false)')
    alice.wait_for_function("document.querySelector('#teamResultStatus')?.textContent.includes('0 partie restante')")
    assert team['members'][ALICE]['score'] == 1500

    # La troisième partie est refusée, sans effacer le record ni interdire le jeu local.
    alice.click('#retry')
    alice.wait_for_function("state==='play'")
    alice.evaluate('gameTime=45;score=1800;end(false)')
    alice.wait_for_function("document.querySelector('#teamResultStatus')?.textContent.includes('limite de parties comptabilisées')")
    assert len(team['members'][ALICE]['attempts']) == 2
    assert team['members'][ALICE]['score'] == 1500

    alice.click('#return')
    alice.click('#archives')
    alice.wait_for_function("document.querySelectorAll('.team-row').length===2 && document.querySelector('.team-row').textContent.includes('Bob')")
    assert score_total(alice) == 3700
    assert '2/2 parties' in alice.locator('.team-rules-summary').inner_text()

    # Seul l’admin peut relever la limite ; la nouvelle tentative est alors acceptée.
    alice.click('.team-admin-panel summary')
    alice.select_option('#teamEditDailyLimit', '3')
    alice.click('#teamSaveRules')
    alice.wait_for_function("document.querySelector('#teamStatus').textContent.includes('Règles de la team enregistrées')")
    assert team['dailyGameLimit'] == 3
    assert '2/3 parties' in alice.locator('.team-rules-summary').inner_text()

    alice.click('#archivesBack')
    finish_run(alice, 1800)
    alice.wait_for_function("document.querySelector('#teamResultStatus')?.textContent.includes('Nouveau highscore')")
    assert len(team['members'][ALICE]['attempts']) == 3
    assert team['members'][ALICE]['score'] == 1800

    alice.click('#return')
    alice.click('#archives')
    alice.wait_for_function("document.querySelectorAll('.team-row').length===2 && document.querySelector('.team-row').textContent.includes('Bob')")
    alice.wait_for_function("document.querySelector('.team-rules-summary').textContent.includes('3/3 parties')")
    assert 'Bob' in alice.locator('.team-row').first.inner_text()
    assert 'Alice' in alice.locator('.team-row').nth(1).inner_text()
    assert score_total(alice) == 4000

    # Le départ retire le membre, ses tentatives et son highscore du total.
    bob.click('#return')
    bob.click('#archives')
    bob.wait_for_selector('#teamLeave')
    bob.click('#teamLeave')
    bob.wait_for_selector('#teamJoin')
    alice.click('#teamRefresh')
    alice.wait_for_function("document.querySelectorAll('.team-row').length===1")
    assert 'Bob' not in alice.locator('.team-leaderboard').inner_text()
    assert score_total(alice) == 1800

    # Le départ du dernier membre efface la team et ses données.
    alice.click('#teamLeave')
    alice.wait_for_selector('#teamJoin')
    assert team is None
    assert 'team vide' in alice.locator('#teamStatus').inner_text()

    # Une nouvelle team à deux membres peut être supprimée explicitement par son admin.
    alice.fill('#teamDisplayName', 'Alice')
    alice.fill('#teamName', 'Team à supprimer')
    alice.click('#teamCreate')
    alice.wait_for_selector('#teamDelete')
    bob.fill('#teamDisplayName', 'Bob')
    bob.fill('#teamCode', CODE)
    bob.click('#teamJoin')
    bob.wait_for_selector('#teamCopyCode')
    assert bob.locator('#teamDelete').count() == 0
    alice.click('#teamRefresh')
    alice.wait_for_function("document.querySelectorAll('.team-row').length===2")
    alice.click('#teamDelete')
    alice.wait_for_selector('#teamJoin')
    assert team is None
    assert 'Team supprimée' in alice.locator('#teamStatus').inner_text()
    bob.click('#teamRefresh')
    bob.wait_for_selector('#teamJoin')
    deletion = [call for call in calls if call['path'].endswith('/minuit_delete_team')]
    assert len(deletion) == 1 and deletion[0]['user_id'] == ALICE and deletion[0]['status'] == 200

    stored = alice.evaluate("Object.keys(localStorage).map(key=>localStorage.getItem(key)).join('\\n')")
    assert 'mot-de-passe-jamais-stocke' not in stored
    assert 'friend@example.com' not in stored
    submissions = [call for call in calls if call['path'].endswith('/minuit_submit_team_score')]
    assert [call['body']['p_score'] for call in submissions] == [1500, 2200, 900, 1800, 1800]
    assert submissions[3]['status'] == 400 and submissions[4]['status'] == 200
    assert all(call['body']['p_mode'] == 'free' and call['body']['p_run_id'] for call in submissions)
    assert len({(call['user_id'], call['body']['p_run_id']) for call in submissions}) == 5
    assert not errors, errors
    print('OK : admin, règles, limite, invitations préremplies, e-mail/WhatsApp/Messenger, départ du dernier membre, suppression admin et mobile.')
    context_a.close()
    context_b.close()
    browser.close()

schema = (ROOT / 'supabase/teams.sql').read_text()
rules = (ROOT / 'supabase/team_rules.sql').read_text()
assert schema.count('security definer') == 5
assert rules.count('security definer') == 6
assert 'revoke all on table public.team_scores from anon, authenticated' in schema
assert 'revoke all on table public.team_score_attempts from anon, authenticated' in rules
assert "set search_path = ''" in rules
assert 'minuit_update_team_rules' in rules and 'TEAM_DAILY_LIMIT' in rules
assert 'TEAM_PERIOD_NOT_STARTED' in rules and 'TEAM_PERIOD_ENDED' in rules
assert 'grant execute on function public.minuit_update_team_rules(integer, timestamptz, timestamptz) to authenticated' in rules
assert 'grant execute on function public.minuit_delete_team() to authenticated' in rules
assert 'delete from public.teams t' in rules and 't.created_by = v_uid' in rules
assert not any('to anon' in line for line in (schema + rules).splitlines() if line.strip().startswith('grant execute'))
print('OK : tentatives privées, fonctions authentifiées uniquement, règles serveur et search_path figé.')
