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
    'mastery': {'selected': 'base', 'done': [], 'unlocked': ['flawless'], 'best': {}},
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
    assert '17 / 38 pages dévoilées' in page.locator('.grimoire-book-summary').inner_text()
    last = page.locator('.grimoire-last-page').inner_text()
    assert 'Forêt des murmures' in last and '12 345' in last and '+147' in last and 'Sorts de marée' in last
    chapters = page.locator('.grimoire-next').inner_text()
    assert 'undefined' not in page.locator('.grimoire-overview').inner_text()
    assert 'NaN' not in page.locator('.grimoire-overview').inner_text()
    for text in ['Chouette des brumes', '150 XP restants', 'Marée spectrale', '2 / 3', 'Cadence concentrée', 'Maîtresse des trois balais']:
        assert text in chapters, (text, chapters)
    assert page.locator('.grimoire-seal').inner_text().replace('\n', '') == '45%'
    assert page.locator('.grimoire-seal-crest img').get_attribute('src') == page.evaluate('MinuitArt.witch.src')
    page.wait_for_function("document.querySelector('.grimoire-seal-crest img').complete && document.querySelector('.grimoire-seal-crest img').naturalWidth > 0")
    assert page.evaluate("(()=>{const r=document.querySelector('.grimoire-seal-crest img').getBoundingClientRect();return !!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.grimoire-seal-crest')})()")
    assert page.locator('.grimoire-seal').get_attribute('aria-label') == '45 % du grimoire dévoilé'
    assert page.locator('.grimoire-page-mark img').count() == 1


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
    assert page.locator('.mastery-badge').count() == 7
    assert page.locator('.mastery-badge img').count() == 7
    assert page.locator('.mastery-catalog-row.done').count() == 1
    assert page.locator('.mastery-catalog-row.locked').count() == 6
    assert page.locator('.mastery-badge-lock').count() == 6
    assert page.locator('[data-mastery-badge="reliquary"] img').get_attribute('src') == page.evaluate("CollectibleArt.art['chest-open'].src")
    assert page.locator('[data-mastery-badge="cleanBoss"] img').get_attribute('src') == page.evaluate('MinuitArt.pumpkin.src')
    collection_text = page.locator('.grimoire-collection').inner_text()
    assert 'undefined' not in collection_text and 'NaN' not in collection_text
    assert not page.locator('[data-item="flawless-aura"]').is_disabled()
    dodge = page.locator('[data-item="dodge-wisp"]')
    assert dodge.is_disabled()
    assert 'Réaliser 10 esquives parfaites' in dodge.inner_text()
    assert 'XP' not in dodge.inner_text() and 'NaN' not in dodge.inner_text()
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
    page.evaluate("upgrades.fire=2;upgrades.rocket=1;upgrades.familiar=1;player.missileTime=9.2;updateLoadout()")
    assert page.locator('#badges .relic-badge').count() == 3
    assert page.locator('#badges .relic-badge-icon img').count() == 3
    assert page.locator('#badges .relic-badge').filter(has_text='Grimoire de puissance').locator('img').get_attribute('src') == page.evaluate("CollectibleArt.art['bonus-fire'].src")
    assert 'Rang 2 / 3' in page.locator('#badges .relic-badge').filter(has_text='Grimoire de puissance').inner_text()
    assert '10 s · 1 / salve' in page.locator('#badges .relic-badge').filter(has_text='Roquettes spectrales').inner_text()
    assert page.evaluate("getComputedStyle(document.querySelector('#badges')).display") == 'grid'
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
    mobile.click('#collectionBack')
    mobile.click('#playAdventure')
    mobile.wait_for_function("state === 'play'")
    mobile.evaluate("upgrades.fire=2;upgrades.rocket=1;upgrades.familiar=1;player.missileTime=9.2;updateLoadout()")
    mobile.click('#infoToggle')
    mobile.wait_for_selector('.sidebar.infos-open')
    mobile.locator('#badges').scroll_into_view_if_needed()
    assert mobile.locator('#badges .relic-badge').count() == 3
    assert mobile.locator('#badges .relic-badge-icon img').count() == 3
    assert mobile.evaluate("getComputedStyle(document.querySelector('#badges .relic-badge-copy b')).fontSize") == '11px'
    assert mobile.evaluate('document.documentElement.scrollWidth <= 390')

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
    print('OK : badges illustrés, Grimoire évolutif, nouveau profil, dernière page, objectifs, capacités, variantes, 7 sceaux, pause et mobile.')
