"""Grimoire évolutif : synthèse réelle, sorts, exploits, collection et mobile."""
from pathlib import Path
import json
import tempfile
from playwright.sync_api import sync_playwright

PROFILE = {
    'version': 1,
    'xp': 650,
    'selected': {'outfit': 'night', 'spell': 'violet', 'broom': 'classic', 'pet': 'none', 'title': 'novice'},
    'lifetime': {'waves': 2, 'bosses': 1, 'dashes': 12, 'cleanWaves': 5, 'pickups': 20, 'elites': 2, 'kills': 120, 'perfectDodges': 6, 'world_bruyere': 1, 'world_comet-flight': 1},
    'days': {}, 'seen': {}, 'achievements': ['hunter'], 'activeDates': [], 'streak': 0,
    'lastActive': '', 'weeks': [], 'tutorialDone': True, 'trainingDone': True, 'dodgeGuideDone': True,
    'mastery': {'selected': 'base', 'done': [], 'unlocked': [], 'best': {}},
    'recent': [{
        'id': 'page-1', 'day': '2026-10-31', 'world': 'Forêt des murmures', 'score': 12345,
        'xp': 147, 'delta': 0, 'extraXP': 20, 'wave': 3, 'time': 75, 'win': False,
        'cause': 'un fantôme', 'mode': 'free', 'stats': {'kills': 35}, 'unlocks': ['Sorts de marée'],
    }],
}
SEED = "(()=>localStorage.setItem('minuit-journey-v1'," + json.dumps(json.dumps(PROFILE, ensure_ascii=False)) + "))()"


def check_overview(page):
    page.click('#wardrobe')
    page.wait_for_selector('.grimoire-screen')
    assert page.locator('.grimoire-screen h2').inner_text() == 'Un grimoire évolutif.'
    assert page.locator('[data-grimoire-tab="overview"]').get_attribute('aria-selected') == 'true'
    assert '16 / 38 pages dévoilées' in page.locator('.grimoire-book-summary').inner_text()
    last = page.locator('.grimoire-last-page').inner_text()
    assert 'Forêt des murmures' in last and '12 345' in last and '+147' in last and 'Sorts de marée' in last
    chapters = page.locator('.grimoire-next').inner_text()
    assert 'undefined' not in page.locator('.grimoire-overview').inner_text()
    assert 'NaN' not in page.locator('.grimoire-overview').inner_text()
    for text in ['Chouette des brumes', '150 XP restants', 'Marée spectrale', '2 / 3', 'Cadence concentrée', 'Maîtresse des trois balais']:
        assert text in chapters, (text, chapters)
    assert page.locator('.grimoire-seal').inner_text().replace('\n', '') == '42%'


def check_spellbook(page):
    page.click('[data-grimoire-tab="spells"]')
    page.wait_for_selector('.grimoire-spellbook')
    assert page.locator('.grimoire-ability').count() == 9
    assert page.locator('.grimoire-ability.unlocked').count() == 6
    assert page.locator('.grimoire-ability.locked').count() == 3
    tide = page.locator('.grimoire-ability').filter(has_text='Marée spectrale').inner_text()
    assert '2 / 3' in tide and 'vagues terminées' in tide
    assert page.locator('.grimoire-variant').count() == 4
    brooms = page.locator('.grimoire-variant').filter(has_text='Cadence concentrée').inner_text()
    assert '2 / 3' in brooms
    assert page.locator('.grimoire-spellbook .arsenal-illustration').count() == 9
    spellbook_text = page.locator('.grimoire-spellbook').inner_text()
    assert 'undefined' not in spellbook_text and 'NaN' not in spellbook_text
    assert 'Exploit : Terminer un univers avec chacun des 3 balais de pilotage' in brooms


def check_collection(page):
    page.click('[data-grimoire-tab="collection"]')
    page.wait_for_selector('.grimoire-collection')
    assert page.locator('.wardrobe-item').count() == 25
    assert page.locator('.mastery-catalog-row').count() == 7
    collection_text = page.locator('.grimoire-collection').inner_text()
    assert 'undefined' not in collection_text and 'NaN' not in collection_text
    flawless = page.locator('[data-item="flawless-aura"]')
    assert flawless.is_disabled()
    assert 'Gagner une partie sans perdre de vie' in flawless.inner_text()
    assert 'XP' not in flawless.inner_text() and 'NaN' not in flawless.inner_text()
    assert not page.locator('[data-item="hunter"]').is_disabled()
    page.click('[data-item="emerald"]')
    assert page.evaluate("Journey.state.selected.outfit === 'emerald'")
    assert 'equipped' in page.locator('[data-item="emerald"]').get_attribute('class')
    page.locator('#collectionBack').scroll_into_view_if_needed()
    page.click('#collectionBack')
    page.wait_for_selector('#playAdventure')


with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
    screenshots = Path(tmp)
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.add_init_script(SEED)
    page.goto('http://localhost:3000')
    page.wait_for_selector('#wardrobe')
    assert 'Grimoire évolutif' in page.locator('#wardrobe').inner_text()
    check_overview(page)
    page.screenshot(path=str(screenshots / 'grimoire-pages.png'), full_page=True)
    check_spellbook(page)
    page.screenshot(path=str(screenshots / 'grimoire-spells.png'), full_page=True)
    check_collection(page)

    # La consultation depuis la pause conserve le retour au vol, quel que soit le dernier onglet ouvert.
    page.click('#playAdventure')
    page.wait_for_function("state === 'play'")
    page.click('#pause')
    page.click('#panelCollection')
    page.wait_for_selector('.grimoire-screen')
    page.click('[data-grimoire-tab="overview"]')
    page.click('#collectionBack')
    assert page.evaluate("state === 'pause'")
    page.click('#quit')
    page.wait_for_selector('#playAdventure')

    mobile_context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile = mobile_context.new_page()
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.on('dialog', lambda dialog: dialog.accept())
    mobile.add_init_script(SEED)
    mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#wardrobe')
    mobile.click('#wardrobe')
    mobile.wait_for_selector('.grimoire-book-summary')
    for tab in ['overview', 'spells', 'collection']:
        mobile.click(f'[data-grimoire-tab="{tab}"]')
        mobile.wait_for_selector(f'#grimoireTab-{tab}[aria-selected="true"]')
        assert mobile.evaluate('document.documentElement.scrollWidth <= 390')
    mobile.screenshot(path=str(screenshots / 'grimoire-mobile.png'), full_page=True)
    mobile.locator('#collectionBack').scroll_into_view_if_needed()
    assert mobile.locator('#collectionBack').is_visible()

    fresh_context = browser.new_context(viewport={'width': 1024, 'height': 768})
    fresh = fresh_context.new_page()
    fresh.on('pageerror', lambda error: errors.append(str(error)))
    fresh.add_init_script("(()=>localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true})))()")
    fresh.goto('http://localhost:3000')
    fresh.click('#wardrobe')
    fresh.wait_for_selector('.grimoire-empty-page')
    assert '8 / 38 pages dévoilées' in fresh.locator('.grimoire-book-summary').inner_text()
    assert fresh.locator('.grimoire-chapter').count() == 4
    assert 'Ton histoire commence au prochain vol.' in fresh.locator('.grimoire-empty-page').inner_text()
    assert not errors, errors
    browser.close()
    print('OK : Grimoire évolutif, nouveau profil, dernière page, prochains objectifs, 9 capacités, 4 variantes, 25 cosmétiques, 7 maîtrises, pause et mobile.')
