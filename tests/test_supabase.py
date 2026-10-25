import json
import re
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
USER_ID = '4b1b47de-40f2-45f4-a62c-0f702d85ba01'
BASE = 'https://night-test.supabase.co'
remote = {'payload': None, 'updated_at': '2026-10-25T12:00:00Z'}
calls = []
feedback_failures = 1


def handle(route):
    global feedback_failures
    request = route.request
    path = urlsplit(request.url).path
    method = request.method
    headers = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*',
               'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'}
    if method == 'OPTIONS':
        route.fulfill(status=204, body='', headers=headers)
        return
    body = json.loads(request.post_data) if request.post_data else None
    calls.append({'path': path, 'method': method, 'body': body, 'headers': request.headers, 'url': request.url})
    payload, status = None, 200
    if path == '/auth/v1/token' and method == 'POST':
        payload = {'access_token': 'access-test', 'refresh_token': 'refresh-test',
                   'expires_in': 3600, 'user': {'id': USER_ID, 'email': 'sorciere@example.com'}}
    elif path == '/auth/v1/signup' and method == 'POST':
        pending = body['email'].startswith('nouvelle.')
        payload = {'access_token': None if pending else 'access-test',
                   'refresh_token': None if pending else 'refresh-test',
                   'expires_in': 3600, 'user': {'id': USER_ID, 'email': body['email']}}
    elif path == '/auth/v1/resend' and method == 'POST':
        payload = {}
    elif path == '/auth/v1/logout':
        payload = {}
    elif path == '/rest/v1/game_saves' and method == 'POST':
        remote['payload'] = body['payload']
        remote['updated_at'] = body['client_updated_at']
        payload, status = None, 201
    elif path == '/rest/v1/game_saves' and method == 'GET':
        payload = [remote] if remote['payload'] else []
    elif path == '/rest/v1/rpc/minuit_team_state' and method == 'POST':
        payload = {'team': None, 'scores': []}
    elif path == '/rest/v1/game_feedback' and method == 'POST':
        if feedback_failures:
            feedback_failures -= 1
            payload, status = {'message': 'indisponible pour le test'}, 500
        else:
            payload, status = None, 201
    else:
        payload, status = {'message': 'route inattendue'}, 404
    route.fulfill(status=status, content_type='application/json',
                  body=json.dumps(payload) if payload is not None else '', headers=headers)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.route('**/supabase-config.js*', lambda route: route.fulfill(
        content_type='application/javascript',
        body=f"window.MINUIT_SUPABASE_CONFIG={{url:'{BASE}',publishableKey:'sb_publishable_test'}};"))
    page.route(BASE + '/**', handle)
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    assert page.evaluate('MinuitCloud.configured && !MinuitCloud.connected')

    page.click('#archives')
    page.wait_for_selector('#cloudEmail')
    # Une inscription avec confirmation ne reçoit pas encore de session.
    page.fill('#cloudEmail', 'nouvelle.sorciere@example.com')
    page.fill('#cloudPassword', 'mot-de-passe-inscription')
    page.click('#cloudRegister')
    page.wait_for_function("document.querySelector('#cloudStatus')?.textContent.includes('Compte créé')")
    assert not page.evaluate('MinuitCloud.connected')
    signup = [call for call in calls if call['path'] == '/auth/v1/signup'][-1]
    confirmation = BASE + '/functions/v1/email-confirmation'
    assert parse_qs(urlsplit(signup['url']).query)['redirect_to'] == [confirmation]
    assert 'e2b.app' not in signup['url']
    page.click('#cloudResend')
    page.wait_for_function("document.querySelector('#cloudStatus')?.textContent.includes('Nouvel e-mail')")
    resent = [call for call in calls if call['path'] == '/auth/v1/resend'][-1]
    assert resent['body'] == {'type': 'signup', 'email': 'nouvelle.sorciere@example.com'}
    assert parse_qs(urlsplit(resent['url']).query)['redirect_to'] == [confirmation]
    page.fill('#cloudEmail', 'sorciere@example.com')
    page.fill('#cloudPassword', 'mot-de-passe-jamais-stocke')
    page.click('#cloudLogin')
    page.wait_for_selector('#cloudSync')
    assert page.evaluate("MinuitCloud.connected && MinuitCloud.user.email==='sorciere@example.com'")
    stored = page.evaluate("Object.keys(localStorage).map(key=>localStorage.getItem(key)).join('\\n')")
    assert 'mot-de-passe-jamais-stocke' not in stored

    page.click('#cloudSync')
    page.wait_for_function("document.querySelector('#cloudStatus')?.textContent.includes('envoyée')")
    save_calls = [call for call in calls if call['path'] == '/rest/v1/game_saves' and call['method'] == 'POST']
    assert len(save_calls) == 1, save_calls
    saved = save_calls[0]
    assert saved['body']['user_id'] == USER_ID
    assert saved['body']['payload']['format'] == 'MinuitProgression'
    assert saved['headers']['authorization'] == 'Bearer access-test'
    assert 'minuit-supabase-session-v1' not in saved['body']['payload']['saves']
    assert remote['payload']['saves']['minuit-journey-v1']['xp'] == 0

    # L’échec réseau ne perd ni le vote ni le commentaire ; le second envoi marche.
    page.click('#archivesBack')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    page.evaluate('gameTime=35;score=1250;end(false)')
    page.wait_for_selector('#gameComment')
    page.click('[data-feedback="hard"]')
    page.fill('#gameComment', 'La vague 3 du cimetière est trop difficile.')
    page.click('#sendGameFeedback')
    page.wait_for_function("document.querySelector('#gameFeedbackStatus').textContent.includes('Envoi impossible')")
    assert page.evaluate("Journey.state.recent[0].feedback==='hard' && Journey.state.recent[0].comment.includes('trop difficile')")
    page.click('#sendGameFeedback')
    page.wait_for_function("document.querySelector('#gameFeedbackStatus').textContent.includes('transmis')")
    feedback_calls = [call for call in calls if call['path'] == '/rest/v1/game_feedback']
    assert len(feedback_calls) == 2
    feedback = feedback_calls[-1]['body']
    assert feedback['rating'] == 'hard' and feedback['comment'] == 'La vague 3 du cimetière est trop difficile.'
    assert feedback['stage'] == 1 and feedback['wave'] == 1 and feedback['mode'] == 'free'
    assert feedback_calls[-1]['headers']['authorization'] == 'Bearer access-test'

    # Une restauration cloud passe par la validation et la confirmation existantes.
    remote['payload']['saves']['minuit-journey-v1']['xp'] = 250
    page.click('#return')
    page.click('#archives')
    page.wait_for_selector('#cloudRestore')
    page.click('#cloudRestore')
    page.wait_for_function("document.querySelector('#playAdventure') && Journey.state.xp===250")
    page.wait_for_function('window.MinuitCloud?.connected')

    # Une session expirée est renouvelée sans redemander le mot de passe.
    page.evaluate("const value=JSON.parse(localStorage.getItem('minuit-supabase-session-v1'));value.expires_at=0;localStorage.setItem('minuit-supabase-session-v1',JSON.stringify(value))")
    page.reload()
    page.wait_for_selector('#playAdventure')
    page.click('#archives')
    page.wait_for_selector('#cloudSync')
    page.click('#cloudSync')
    page.wait_for_function("document.querySelector('#cloudStatus')?.textContent.includes('envoyée')")
    refresh_calls = [call for call in calls if call['path'] == '/auth/v1/token' and call['body'].get('refresh_token')]
    assert refresh_calls and refresh_calls[-1]['body']['refresh_token'] == 'refresh-test', refresh_calls
    page.click('#archivesBack')

    # Les avis restent envoyables sans compte : seule la clé publiable est
    # utilisée, et la table n’accorde aucune lecture publique.
    page.click('#archives')
    page.wait_for_selector('#cloudLogout')
    page.click('#cloudLogout')
    page.wait_for_selector('#cloudEmail')
    page.click('#archivesBack')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    page.evaluate('gameTime=20;score=300;end(false)')
    page.click('[data-feedback="fair"]')
    page.fill('#gameComment', 'Difficulté correcte sans compte cloud.')
    page.click('#sendGameFeedback')
    page.wait_for_function("document.querySelector('#gameFeedbackStatus').textContent.includes('transmis')")
    anonymous_feedback = [call for call in calls if call['path'] == '/rest/v1/game_feedback'][-1]
    assert anonymous_feedback['headers']['authorization'] == 'Bearer sb_publishable_test'
    assert anonymous_feedback['body']['rating'] == 'fair'
    assert not page.evaluate('MinuitCloud.connected')

    # La page d’arrivée ne dépend pas de l’URL Arena et retire les jetons du fragment.
    function_source = (ROOT / 'supabase/functions/email-confirmation/index.ts').read_text()
    landing_html = re.search(r'const page = `(.*?)`;', function_source, re.DOTALL).group(1)
    assert landing_html.isascii(), 'Le HTML doit rester lisible même sans charset'
    assert not any(bad in landing_html for bad in ['â€™', 'Ã©', 'Â·'])
    assert "'Content-Type': 'text/html; charset=utf-8'" in function_source
    assert 'new TextEncoder().encode(page)' in function_source
    page.route(BASE + '/functions/v1/email-confirmation*', lambda route: route.fulfill(
        status=200, content_type='text/html', body=landing_html))
    page.goto(BASE + '/functions/v1/email-confirmation#access_token=fragment-prive&type=signup')
    page.wait_for_function("document.querySelector('#title').textContent.includes('confirmée')")
    assert 'Retourne dans l’onglet du jeu' in page.locator('#message').text_content()
    assert page.evaluate('location.hash') == '' and 'fragment-prive' not in page.url
    page.goto(BASE + '/functions/v1/email-confirmation?error=access_denied&error_code=otp_expired')
    page.wait_for_function("document.querySelector('#title').textContent.includes('expiré')")
    assert 'Renvoyer la confirmation' in page.locator('#message').text_content()

    # Le formulaire reste utilisable après restauration et aucune erreur JS ne survient.
    assert not errors, errors
    browser.close()

schema = (ROOT / 'supabase/schema.sql').read_text()
assert 'alter table public.game_saves enable row level security' in schema
assert 'alter table public.game_feedback enable row level security' in schema
assert 'grant select, insert, update on table public.game_saves to authenticated' in schema
assert 'grant select' not in '\n'.join(line for line in schema.splitlines() if 'game_feedback' in line)
print('OK : connexion Supabase simulée, mot de passe non stocké, sauvegarde/restauration, avis privé avec reprise après échec et schéma RLS restrictif.')
