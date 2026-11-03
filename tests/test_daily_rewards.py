"""Coffre quotidien : tirage persistant, séries, gains cosmétiques et mobile."""
import json
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
JOURNEY_KEY = 'minuit-journey-v1'
SESSION_KEY = 'minuit-supabase-session-v1'


def session(uid):
    return {
        'access_token': 'daily-test-token', 'refresh_token': 'daily-test-refresh',
        'expires_at': 9999999999,
        'user': {'id': uid, 'displayName': 'Cassiopée'},
    }


def prepare(context, uid=None, journey=None):
    script = "if(!localStorage.getItem('minuit-journey-v1'))localStorage.setItem('minuit-journey-v1',JSON.stringify(%s));" % json.dumps(
        journey or {'version': 1, 'trainingDone': True, 'xp': 0})
    if uid:
        script += "localStorage.setItem('minuit-supabase-session-v1',JSON.stringify(%s));" % json.dumps(session(uid))
    context.add_init_script(script)


def connect(context):
    context.route('https://fkdijgrmgnbpybcfowpr.supabase.co/**', lambda route: route.abort())


def forced_chest(page, uid, value):
    """Enregistre un tirage déterministe puis emprunte l'événement de connexion réel."""
    page.evaluate('''({uid,value})=>{
      const user={id:uid,displayName:'Testeuse'};
      DailyRewards.claim(user,()=>value);
      window.dispatchEvent(new CustomEvent('minuit:account-connected',{detail:{user}}));
    }''', {'uid': uid, 'value': value})
    page.wait_for_selector('#dailyRewardScreen')


def finish(page):
    page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
    page.click('#dailyRewardContinue')
    page.wait_for_selector('#playAdventure')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []

    # Invité : aucun coffre. Les fonctions pures restent testables sans compte.
    context = browser.new_context(viewport={'width': 1100, 'height': 800}, reduced_motion='reduce')
    connect(context)
    prepare(context)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector('#playAdventure')
    page.wait_for_timeout(350)
    assert page.locator('#dailyRewardScreen').count() == 0
    rules = page.evaluate('''()=>({
      day1:DailyRewards.odds(1),day7:DailyRewards.odds(7),day12:DailyRewards.odds(12),
      rolls:[DailyRewards.roll(1,.2),DailyRewards.roll(1,.75),DailyRewards.roll(1,.95),DailyRewards.roll(1,.999)],
      first:DailyRewards.nextStreak('',0,'2026-11-03'),
      consecutive:DailyRewards.nextStreak('2026-11-02',4,'2026-11-03'),
      capped:DailyRewards.nextStreak('2026-11-02',8,'2026-11-03'),
      missed:DailyRewards.nextStreak('2026-10-30',6,'2026-11-03'),
      same:DailyRewards.nextStreak('2026-11-03',6,'2026-11-03')
    })''')
    assert rules['day1'] == {'common': 70, 'rare': 22, 'epic': 7, 'legendary': 1}
    assert rules['day7'] == rules['day12'] == {'common': 40, 'rare': 28, 'epic': 25, 'legendary': 7}
    assert rules['rolls'] == ['common', 'rare', 'epic', 'legendary']
    assert (rules['first'], rules['consecutive'], rules['capped'], rules['missed'], rules['same']) == (1, 5, 9, 1, 6)

    # Chaque rareté applique exactement la table validée ; les comptes sont indépendants.
    expected = [('rare', .75, 60, 1), ('epic', .95, 120, 1), ('legendary', .999, 200, 2)]
    for index, (rarity, value, xp, cosmetics) in enumerate(expected):
        uid = 'daily-rarity-' + rarity
        before = page.evaluate('Journey.state.xp')
        forced_chest(page, uid, value)
        pending = page.evaluate('(uid)=>Journey.state.dailyRewards[uid].pending', uid)
        assert pending['rarity'] == rarity and pending['xp'] == xp
        assert len(pending['cosmetics']) == cosmetics and pending['conversionXP'] == 0
        assert page.evaluate('Journey.state.xp') == before, 'Le gain ne doit pas précéder la révélation.'
        assert '%' not in page.locator('#dailyRewardScreen').inner_text()
        page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
        result = page.evaluate('(uid)=>Journey.state.dailyRewards[uid].lastResult', uid)
        assert result['totalXP'] == xp and len(result['cosmetics']) == cosmetics
        assert page.evaluate('Journey.state.xp') == before + xp
        assert page.evaluate('(uid)=>Journey.state.dailyRewards[uid].pending===null', uid)
        assert page.evaluate('(ids)=>ids.every(id=>Journey.isEarned(Journey.items.find(item=>item.id===id)))', result['cosmetics'])
        finish(page)

    # Un seul emplacement restant : l'autre apparence devient 100 XP.
    page.evaluate('Journey.state.xp=3000')
    forced_chest(page, 'daily-partial-conversion', .999)
    page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
    partial = page.evaluate("Journey.state.dailyRewards['daily-partial-conversion'].lastResult")
    assert partial['cosmetics'] == ['aurora'] and partial['conversionXP'] == 100 and partial['totalXP'] == 300
    finish(page)

    # Collection complète : les deux emplacements sont convertis, jamais les titres d'exploit/maîtrise.
    page.evaluate('Journey.state.xp=100000')
    forced_chest(page, 'daily-full-conversion', .999)
    page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
    full = page.evaluate("Journey.state.dailyRewards['daily-full-conversion'].lastResult")
    assert full['cosmetics'] == [] and full['conversionXP'] == 200 and full['totalXP'] == 400
    assert page.evaluate('Journey.state.xp') == 100400
    assert page.evaluate('''()=>Journey.dailyCosmetics().every(item=>Number.isFinite(item.xp)&&item.xp>0&&!item.achievement&&!item.mastery)''')
    finish(page)

    # Le bundle et l'export acceptent les nouveaux champs, mais rejettent une apparence interdite.
    assert page.evaluate('''()=>{const checked=Journey.validate(Journey.bundle());return !!checked.saves['minuit-journey-v1'].dailyRewards}''')
    assert page.evaluate('''()=>{
      const bundle=Journey.bundle(),save=bundle.saves['minuit-journey-v1'];
      const first=Object.values(save.dailyRewards)[0];first.pending={day:'2026-11-03',rarity:'rare',xp:60,conversionXP:0,cosmetics:['dodge-wisp']};
      try{Journey.validate(bundle);return false}catch(error){return /Apparence/.test(error.message)}
    }''')
    context.close()

    # Session restaurée : le tirage est déjà dans localStorage avant l'ouverture.
    context = browser.new_context(viewport={'width': 1100, 'height': 800})
    connect(context)
    uid = 'daily-reload-account'
    prepare(context, uid)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector('#dailyRewardScreen')
    first = page.evaluate('''uid=>({pending:Journey.state.dailyRewards[uid].pending,
      stored:JSON.parse(localStorage.getItem('minuit-journey-v1')).dailyRewards[uid].pending,xp:Journey.state.xp})''', uid)
    assert first['pending'] == first['stored'] and first['xp'] == 0
    transform_1 = page.evaluate("getComputedStyle(document.querySelector('.daily-chest-3d')).transform")
    page.wait_for_timeout(300)
    transform_2 = page.evaluate("getComputedStyle(document.querySelector('.daily-chest-3d')).transform")
    assert transform_1 != transform_2, 'Le coffre doit réellement tourner.'
    page.reload()
    page.wait_for_selector('#dailyRewardScreen')
    second = page.evaluate('(uid)=>Journey.state.dailyRewards[uid].pending', uid)
    assert second == first['pending'], 'Le rechargement ne doit jamais retirer le coffre.'
    page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
    credited = page.evaluate('''uid=>({xp:Journey.state.xp,result:Journey.state.dailyRewards[uid].lastResult,
      again:Journey.grantDailyReward(uid)})''', uid)
    assert credited['xp'] == credited['result']['totalXP'] and credited['again'] is None
    page.reload()
    page.wait_for_selector('#playAdventure')
    page.wait_for_timeout(500)
    assert page.locator('#dailyRewardScreen').count() == 0
    assert page.evaluate('Journey.state.xp') == credited['xp']
    context.close()

    # Hors ligne, même une session conservée ne déclenche pas de nouveau coffre.
    context = browser.new_context(viewport={'width': 900, 'height': 700}, reduced_motion='reduce')
    connect(context)
    uid = 'daily-offline-account'
    prepare(context, uid)
    context.add_init_script("window.__dailyTestOnline=false;Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.__dailyTestOnline})")
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL)
    page.wait_for_selector('#playAdventure')
    page.wait_for_timeout(400)
    assert page.locator('#dailyRewardScreen').count() == 0
    assert page.evaluate('(uid)=>!Journey.state.dailyRewards[uid]', uid)
    page.evaluate("window.__dailyTestOnline=true;window.dispatchEvent(new Event('online'))")
    page.wait_for_selector('#dailyRewardScreen')
    page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
    context.close()

    # Légendaire sur les deux tailles mobiles : trois cartes lisibles et bouton accessible.
    for width, height in [(390, 844), (360, 640)]:
        context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=True, has_touch=True, reduced_motion='reduce')
        prepare(context)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(URL)
        page.wait_for_selector('#playAdventure')
        forced_chest(page, 'daily-mobile-' + str(width), .999)
        page.wait_for_selector('#dailyRewardContinue:not(.hidden)', timeout=5000)
        metrics = page.evaluate('''()=>{
          const button=document.getElementById('dailyRewardContinue').getBoundingClientRect();
          const screen=document.getElementById('dailyRewardScreen');
          const overlaps=[...document.querySelectorAll('.daily-loot-cosmetic')].some(card=>
            card.querySelector('.daily-loot-art').getBoundingClientRect().bottom>card.querySelector('strong').getBoundingClientRect().top);
          return {width:innerWidth,scroll:document.documentElement.scrollWidth,bottom:button.bottom,
            screenBottom:screen.getBoundingClientRect().bottom,cards:document.querySelectorAll('.daily-loot-card').length,overlaps};
        }''')
        assert metrics['scroll'] == metrics['width'] == width
        assert metrics['cards'] == 3 and not metrics['overlaps']
        assert 0 < metrics['bottom'] <= metrics['screenBottom'] + 1
        finish(page)
        context.close()

    browser.close()
    assert not errors, errors
    print('Coffre quotidien : invité/hors ligne, 4 raretés, séries, conversions, rechargement, exports et mobile validés.')
