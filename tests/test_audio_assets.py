"""Chargement réel de tous les bruitages déclarés par le jeu."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    errors, failed, missing_http = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('requestfailed', lambda request: failed.append(request.url))
    page.on('response', lambda response: missing_http.append(
        f'{response.status} {response.url}'
    ) if '/audio/' in response.url and response.status >= 400 else None)

    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.wait_for_function("audio?.state==='running'")
    page.wait_for_function(
        'Object.keys(sfxPaths).every(id=>sfxBuffers.has(id))', timeout=20000,
    )
    result = page.evaluate("""() => {
        const ids = Object.keys(sfxPaths);
        for (const id of ids) playSfx(id, .12, 0);
        return {
            declared: ids.length,
            loaded: ids.filter(id => sfxBuffers.has(id)).length,
            triggered: ids.filter(id => sfxLast.has(id)).length,
            missing: ids.filter(id => !sfxBuffers.has(id)),
        };
    }""")
    assert result['declared'] >= 23, result
    assert result['loaded'] == result['declared'], result
    assert result['triggered'] == result['declared'], result
    assert not missing_http, missing_http
    assert not failed, failed
    assert not errors, errors
    browser.close()
    print(f"OK : {result['declared']} bruitages servis, décodés et déclenchés sans erreur réseau.")
