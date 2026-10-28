"""Invitation explicite et accès par pseudo + mot de passe, sans e-mail."""
import json
import os
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://night-test.supabase.co'
CODE = 'ABCDE23456'
accounts = {}
team = None
calls = []


def request_user(request):
    authorization = request.headers.get('authorization', '')
    if authorization.startswith('Bearer access-'):
        user_id = authorization.removeprefix('Bearer access-')
        if any(account['id'] == user_id for account in accounts.values()):
            return user_id
    return None


def team_state(user_id):
    if not team or user_id not in team['members']:
        return {'team': None, 'scores': []}
    members = team['members']
    member = members[user_id]
    ordered = sorted(members.items(), key=lambda item: (-item[1].get('score', 0), item[1]['displayName']))
    games_today = len(member.get('attempts', []))
    return {
        'team': {
            'id': 'team-test', 'name': team['name'], 'code': CODE,
            'memberCount': len(members),
            'totalScore': sum(row.get('score', 0) for row in members.values()),
            'isAdmin': team['admin'] == user_id, 'rulesConfigured': True,
            'dailyGameLimit': 3, 'startsAt': None, 'endsAt': None,
            'gamesToday': games_today, 'gamesRemaining': max(0, 3 - games_today),
        },
        'scores': [
            {'rank': rank, 'displayName': row['displayName'], 'score': row.get('score', 0),
             'mode': row.get('mode'), 'difficulty': row.get('difficulty'),
             'stage': row.get('stage'), 'wave': row.get('wave'),
             'updatedAt': row.get('updatedAt'), 'isYou': member_id == user_id,
             'isAdmin': team['admin'] == member_id}
            for rank, (member_id, row) in enumerate(ordered, 1)
        ],
    }


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
    calls.append({'path': path, 'body': body, 'user_id': user_id})
    payload, status = None, 200

    if path == '/functions/v1/pseudo-auth':
        username = body['username'].strip()
        key = username.casefold()
        action = body['action']
        if action == 'register' and key in accounts:
            payload, status = {'error': 'PSEUDO_UNAVAILABLE'}, 409
        elif action == 'login' and (key not in accounts or accounts[key]['password'] != body['password']):
            payload, status = {'error': 'AUTH_INVALID'}, 401
        else:
            if action == 'register':
                accounts[key] = {
                    'id': 'user-' + re.sub(r'[^a-z0-9]+', '-', key.lower()).strip('-'),
                    'password': body['password'], 'displayName': username,
                }
            account = accounts[key]
            payload = {
                'access_token': 'access-' + account['id'],
                'refresh_token': 'refresh-' + account['id'], 'expires_in': 3600,
                'user': {
                    'id': account['id'], 'email': 'player-technique@players.minuit.invalid',
                    'user_metadata': {'display_name': account['displayName'], 'auth_provider': 'pseudo'},
                },
            }
    elif path == '/auth/v1/logout':
        payload = {}
    elif path.startswith('/rest/v1/rpc/') and not user_id:
        payload, status = {'message': 'AUTH_REQUIRED'}, 401
    elif path == '/rest/v1/rpc/minuit_team_state':
        payload = team_state(user_id)
    elif path == '/rest/v1/rpc/minuit_create_team':
        team = {
            'name': body['p_name'], 'admin': user_id,
            'members': {user_id: {'displayName': body['p_display_name'], 'score': 0, 'attempts': []}},
        }
        payload = team_state(user_id)
    elif path == '/rest/v1/rpc/minuit_join_team':
        if not team or body['p_code'] != CODE:
            payload, status = {'message': 'TEAM_NOT_FOUND'}, 400
        else:
            team['members'][user_id] = {'displayName': body['p_display_name'], 'score': 0, 'attempts': []}
            payload = team_state(user_id)
    elif path == '/rest/v1/rpc/minuit_submit_team_score':
        if not team or user_id not in team['members']:
            payload, status = {'message': 'NOT_IN_TEAM'}, 400
        else:
            member = team['members'][user_id]
            if len(member['attempts']) >= 3:
                payload, status = {'message': 'TEAM_DAILY_LIMIT'}, 400
            else:
                previous = member.get('score', 0)
                member['attempts'].append(body['p_score'])
                if body['p_score'] > previous:
                    member.update({
                        'score': body['p_score'], 'mode': body['p_mode'],
                        'difficulty': body['p_difficulty'], 'stage': body['p_stage'],
                        'wave': body['p_wave'], 'updatedAt': '2026-10-27T12:00:00Z',
                    })
                payload = {
                    'bestScore': member.get('score', 0),
                    'improved': body['p_score'] > previous,
                    'duplicate': False, 'gamesToday': len(member['attempts']),
                    'gamesRemaining': max(0, 3 - len(member['attempts'])),
                }
    else:
        payload, status = {'message': 'route inattendue'}, 404

    route.fulfill(status=status, content_type='application/json',
                  body=json.dumps(payload), headers=cors)


with sync_playwright() as p:
    launch = {'headless': True, 'args': ['--no-sandbox']}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    browser = p.chromium.launch(**launch)
    errors = []

    def make_page(mobile=False, url='http://localhost:3000'):
        context = browser.new_context(
            viewport={'width': 390, 'height': 844} if mobile else {'width': 1366, 'height': 900},
            is_mobile=mobile, has_touch=mobile,
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
        page.wait_for_function("document.querySelector('#playAdventure') || document.querySelector('#teamInviteCard')")
        return context, page

    # Alice crée son accès sans e-mail puis une team.
    context_a, alice = make_page()
    alice.click('#archives')
    alice.wait_for_selector('#cloudPseudo', state='visible')
    assert not alice.locator('#cloudEmail').is_visible()
    alice.fill('#cloudPseudo', 'Alice')
    alice.fill('#cloudPseudoPassword', 'mot-de-passe-alice')
    alice.click('#cloudPseudoRegister')
    alice.wait_for_selector('#teamCreate')
    assert alice.evaluate("MinuitCloud.connected && MinuitCloud.user.displayName === 'Alice'")
    assert alice.input_value('#teamDisplayName') == 'Alice'
    assert alice.locator('#teamDisplayName').get_attribute('readonly') is not None
    assert alice.evaluate("prefs.name === 'Alice' && scorePlayerName() === 'Alice'")
    assert alice.evaluate("JSON.parse(localStorage.getItem('minuit-settings')).name === 'Alice'")
    assert 'players.minuit.invalid' not in alice.locator('#supabaseMount').inner_text()

    # Le pseudo du compte remplace « Sorcière » dans les nouveaux records locaux.
    alice.click('#archivesBack')
    alice.click('#localSettings')
    alice.wait_for_selector('.settings-page #nickname')
    assert alice.input_value('#nickname') == 'Alice'
    assert alice.locator('#nickname').get_attribute('readonly') is not None
    assert 'Pseudo du compte connecté' in alice.locator('#nickname').evaluate("node=>node.closest('.settings-field').innerText")
    alice.click('#settingsCancel')
    alice.wait_for_selector('#playAdventure')
    alice.click('#playAdventure')
    alice.wait_for_function("state==='play'")
    alice.evaluate('gameTime=25;score=4321;end(false)')
    alice.wait_for_function("window.MinuitLastScore?.score===4321")
    assert alice.evaluate("MinuitLastScore.name === 'Alice' && records[0].name === 'Alice'")
    alice.wait_for_selector('#return', state='visible')
    alice.click('#return')
    alice.click('#arcadeScores')
    alice.wait_for_selector('.arcade-score-screen')
    assert alice.locator('.arcade-score-group').first.locator('.arcade-player').first.inner_text() == 'Alice'
    alice.click('#arcadeScoresBack')
    alice.click('#archives')
    alice.wait_for_selector('#teamCreate')

    alice.fill('#teamName', 'Les Balais de minuit')
    alice.click('#teamCreate')
    alice.wait_for_selector('#teamCopyCode')
    whatsapp = alice.locator('#teamWhatsApp').get_attribute('href')
    message = parse_qs(urlsplit(whatsapp).query)['text'][0]
    invitation = re.search(r'https?://\S+', message).group(0)

    # Bob arrive par le lien : l’invitation est visible avant toute connexion.
    context_b, bob = make_page(
        mobile=True,
        url=invitation + '&access_token=secret&refresh_token=secret#fragment-prive',
    )
    bob.wait_for_selector('#teamInviteCard', state='visible')
    bob.wait_for_timeout(100)
    invite_bounds = bob.evaluate("""() => {
        const card = document.querySelector('#teamInviteCard').getBoundingClientRect();
        const overlay = document.querySelector('#overlay').getBoundingClientRect();
        return {top:card.top, bottom:card.bottom, overlayTop:overlay.top, overlayBottom:overlay.bottom};
    }""")
    assert invite_bounds['top'] >= invite_bounds['overlayTop'] - 1, invite_bounds
    assert invite_bounds['bottom'] <= invite_bounds['overlayBottom'] + 1, invite_bounds
    assert 'ABCDE-23456' in bob.locator('#teamInviteCard').inner_text()
    assert 'Créer mon accès et rejoindre' in bob.locator('#cloudPseudoRegister').inner_text()
    assert bob.locator('#cloudPseudo').is_visible()
    assert not bob.locator('#cloudEmail').is_visible()
    assert bob.evaluate("location.search === '' && location.hash === ''")
    assert bob.evaluate('document.documentElement.scrollWidth <= innerWidth')

    # Le code survit à un rechargement, même après nettoyage de l’URL.
    bob.reload()
    bob.wait_for_selector('#teamInviteCard', state='visible')
    assert 'ABCDE-23456' in bob.locator('#teamInviteCard').inner_text()
    bob.fill('#cloudPseudo', 'Bob')
    bob.fill('#cloudPseudoPassword', 'mot-de-passe-bob')
    bob.click('#cloudPseudoRegister')
    bob.wait_for_selector('.home-menu')
    bob.wait_for_selector('#playAdventure', state='visible')
    assert not bob.locator('#teamCopyCode').count()
    assert 'Compte créé' in bob.locator('#archives b').inner_text()
    assert 'Tu es dans la team' in bob.locator('#archives b').inner_text()
    assert 'Ton prochain score comptera' in bob.locator('#archives small').inner_text()
    assert bob.locator('#archives').evaluate("node=>node.classList.contains('home-account-welcome')")
    assert bob.evaluate('MinuitCloud.inTeam && MinuitCloud.connected')
    assert bob.evaluate("document.querySelector('#overlay').scrollTop === 0")
    bob.screenshot(path='/tmp/invite-home-mobile.png')

    # Le premier vol de l’invité compte immédiatement, avant la fin du décompte de mort.
    bob.click('#playAdventure')
    bob.wait_for_function("state==='play'")
    bob.evaluate('gameTime=35;score=2345;end(false)')
    bob.wait_for_selector('.death-transition')
    assert bob.locator('#deathCountdown').is_visible()
    assert 'HI-SCORES' in bob.locator('#deathCountdownLabel').inner_text()
    deadline = time.monotonic() + 2
    submissions = []
    while time.monotonic() < deadline:
        submissions = [call for call in calls if call['path'].endswith('/minuit_submit_team_score')]
        if submissions:
            break
        bob.wait_for_timeout(50)
    assert submissions, 'Le score doit être envoyé pendant le décompte, pas après.'
    assert bob.locator('.death-transition').count() == 1
    assert submissions[0]['user_id'] == 'user-bob'
    assert submissions[0]['body']['p_score'] == 2345
    assert submissions[0]['body']['p_mode'] == 'free'
    bob.screenshot(path='/tmp/death-countdown-mobile.png')
    bob.wait_for_selector('.journey-result-screen')
    bob.wait_for_selector('.journey-result-screen .arcade-score-table')
    bob.wait_for_function("document.querySelector('#teamResultStatus').textContent.includes('2 parties restantes')")
    assert team['members']['user-bob']['attempts'] == [2345]
    assert team['members']['user-bob']['score'] == 2345
    result_metrics = bob.evaluate("""() => ({
        overlay:document.querySelector('#overlay').getBoundingClientRect().height,
        holder:document.querySelector('.layout>div:first-child').getBoundingClientRect().height,
        arena:document.querySelector('.arena').getBoundingClientRect().width,
        holderWidth:document.querySelector('.layout>div:first-child').getBoundingClientRect().width,
        sidebar:getComputedStyle(document.querySelector('.sidebar')).display,
        overflow:document.documentElement.scrollWidth>390,
        boardAfterDeath:!!(document.querySelector('.death-note').compareDocumentPosition(document.querySelector('.scoreboard-window')) & Node.DOCUMENT_POSITION_FOLLOWING),
        boardBeforeGrid:!!(document.querySelector('.scoreboard-window').compareDocumentPosition(document.querySelector('.journey-result-grid')) & Node.DOCUMENT_POSITION_FOLLOWING)
    })""")
    assert result_metrics['overlay'] + 2 >= result_metrics['holder'], result_metrics
    assert result_metrics['arena'] + 2 >= result_metrics['holderWidth'], result_metrics
    assert result_metrics['sidebar'] == 'none' and not result_metrics['overflow'], result_metrics
    assert result_metrics['boardAfterDeath'] and result_metrics['boardBeforeGrid'], result_metrics
    bob.screenshot(path='/tmp/death-highscores-mobile.png')
    bob.click('#return')
    bob.wait_for_selector('#playAdventure')
    bob.click('#archives')
    bob.wait_for_selector('#teamCopyCode')
    assert bob.locator('.team-row').count() == 2
    assert 'Bob' in bob.locator('.team-leaderboard').inner_text()
    assert int(re.sub(r'\D', '', bob.locator('.team-summary b').last.inner_text())) == 2345
    assert int(re.sub(r'\D', '', bob.locator('.team-row.team-you .team-score').inner_text())) == 2345
    assert '1/3 parties' in bob.locator('.team-rules-summary').inner_text()
    assert bob.evaluate("MinuitCloud.user.displayName === 'Bob'")
    assert bob.evaluate("prefs.name === 'Bob' && scorePlayerName() === 'Bob'")
    assert bob.evaluate("sessionStorage.getItem('minuit-team-invite-v1') === null")
    assert not bob.locator('#teamInviteCard').count()
    joins = [call for call in calls if call['path'].endswith('/minuit_join_team')]
    assert len(joins) == 1 and joins[0]['body']['p_code'] == CODE
    assert joins[0]['body']['p_display_name'] == 'Bob'
    assert not [call for call in calls if call['path'] == '/auth/v1/signup']
    stored = bob.evaluate("Object.keys(localStorage).map(key => localStorage.getItem(key)).join('\\n')")
    assert 'mot-de-passe-bob' not in stored

    # Le même pseudo et mot de passe retrouvent la team après déconnexion.
    bob.click('#cloudLogout')
    bob.wait_for_selector('#cloudPseudo', state='visible')
    bob.fill('#cloudPseudo', 'Bob')
    bob.fill('#cloudPseudoPassword', 'mot-de-passe-bob')
    bob.click('#cloudPseudoLogin')
    bob.wait_for_selector('#teamCopyCode')
    assert bob.locator('.team-row').count() == 2
    bob.reload()
    bob.wait_for_selector('#playAdventure')
    assert bob.evaluate("MinuitCloud.user.displayName === 'Bob' && prefs.name === 'Bob' && scorePlayerName() === 'Bob'")
    bob.click('#archives')
    bob.wait_for_selector('#teamCopyCode')
    assert bob.locator('.team-row').count() == 2

    # Un mauvais mot de passe ne révèle pas si le pseudo existe.
    bob.click('#cloudLogout')
    bob.wait_for_selector('#cloudPseudo', state='visible')
    bob.fill('#cloudPseudo', 'Bob')
    bob.fill('#cloudPseudoPassword', 'mot-de-passe-faux')
    bob.click('#cloudPseudoLogin')
    bob.wait_for_function("document.querySelector('#cloudStatus').textContent.includes('Pseudo ou mot de passe incorrect')")
    assert not bob.evaluate('MinuitCloud.connected')

    # Le visiteur peut aussi refuser explicitement l’invitation.
    context_c, guest = make_page(mobile=True, url=invitation)
    guest.wait_for_selector('#teamInviteCard', state='visible')
    guest.click('#teamInviteDismiss')
    guest.wait_for_selector('#cloudPseudo', state='visible')
    assert not guest.locator('#teamInviteCard').count()
    assert guest.evaluate("sessionStorage.getItem('minuit-team-invite-v1') === null")

    # Une jointure refusée ne renvoie pas à l’accueil et conserve l’invitation.
    team = None
    context_d, failed_join = make_page(mobile=True, url=invitation)
    failed_join.wait_for_selector('#teamInviteCard', state='visible')
    failed_join.fill('#cloudPseudo', 'Carole')
    failed_join.fill('#cloudPseudoPassword', 'mot-de-passe-carole')
    failed_join.click('#cloudPseudoRegister')
    failed_join.wait_for_function("document.querySelector('#teamStatus')?.textContent.includes('Aucune team')")
    assert failed_join.locator('#teamJoin').is_visible()
    assert not failed_join.locator('.home-menu').count()
    assert failed_join.evaluate('MinuitCloud.connected && !MinuitCloud.inTeam')
    assert failed_join.evaluate("sessionStorage.getItem('minuit-team-invite-v1') === 'ABCDE23456'")

    assert not errors, errors
    print('OK : invitation, retour à l’accueil, décompte de mort, HI-SCORES plein écran et premier vol compté dans la team.')
    context_a.close()
    context_b.close()
    context_c.close()
    context_d.close()
    browser.close()

source = (ROOT / 'supabase/functions/pseudo-auth/index.ts').read_text()
browser_source = (ROOT / 'supabase.js').read_text()
assert 'SUPABASE_SERVICE_ROLE_KEY' in source
assert 'email_confirm: true' in source
assert "toLocaleLowerCase('fr-FR')" in source
assert 'SUPABASE_SERVICE_ROLE_KEY' not in browser_source
assert '/functions/v1/pseudo-auth' in browser_source
print('OK : création confirmée côté serveur, identité normalisée et aucune clé secrète dans le navigateur.')
