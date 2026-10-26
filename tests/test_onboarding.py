"""Accueil, guide illustré, notifications stables et entraînement sans progression."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#startGuided')

    assert page.locator('.main-menu button').count() == 12
    assert 'Éclaircir les ombres' not in page.locator('.main-menu').inner_text()
    assert page.locator('#playAdventure').is_visible()
    assert page.locator('#localRanked').is_visible() and page.locator('#labMenu').is_visible()

    page.click('#localHelp')
    page.wait_for_selector('.guide-card')
    titles = []
    for index in range(6):
        titles.append(page.locator('.guide-card h2').inner_text())
        if index == 3:
            assert page.locator('#guideArt img').count() == 3
            page.wait_for_function("[...document.querySelectorAll('#guideArt img')].every(i=>i.complete&&i.naturalWidth)")
        if index < 5:
            page.click('#guideNext')
    assert titles[0] == 'Pilotage et tir automatique' and titles[-1] == 'Créatures et attaques'
    page.click('#guideBack')
    page.wait_for_selector('#startGuided')

    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    normal = page.evaluate('''()=>{
      enemies=[];obstacles=[];gates=[];scares=[];drops=[];
      player.x=400;player.y=700;player.inv=999;player.dashCD=0;
      hostile=[{x:400,y:560,vx:0,vy:200,type:'fire',r:7,life:5,age:0}];
      gameTime=20;Journey.tick(1.1);update(1/60);hostile=[];
      return {tutor:!$('journeyTutor').classList.contains('hidden'),
              coach:$('dodgeCoach')&&!$('dodgeCoach').classList.contains('hidden'),
              threat:CombatFeel.guideThreat};
    }''')
    assert normal == {'tutor': False, 'coach': False, 'threat': None}, normal

    notices = page.evaluate('''()=>{
      toastTime=0;
      say('Fragmentation · chaque roquette libère 8 tirs en cercle',.2);
      const first={text:$('toast').innerText,time:toastTime,icon:$('toast').querySelector('img')?.src};
      say('Bouclier spectral · 12 secondes',.2);
      const queued=$('toast').innerText;update(1);const afterOne=$('toast').innerText;
      for(let i=0;i<6&&!$('toast').innerText.includes('Bouclier spectral');i++){toastTime=0;update(0)}
      return {first,queued,afterOne,second:$('toast').innerText,
              secondIcon:$('toast').querySelector('img')?.src,
              fragment:CollectibleArt.art['bonus-fragment'].src,
              shield:CollectibleArt.art['bonus-pickup-shield'].src};
    }''')
    assert notices['first']['time'] >= 2.8, notices
    assert notices['queued'] == notices['first']['text'] == notices['afterOne'], notices
    assert notices['first']['icon'] == notices['fragment'], 'icône de relique absente'
    assert 'Bouclier spectral' in notices['second'] and notices['secondIcon'] == notices['shield'], 'file ou icône de bouclier incorrecte'

    page.evaluate('end(false)')
    page.click('#return')
    page.wait_for_selector('#startGuided')
    before = page.evaluate('JSON.stringify(Object.fromEntries(Object.entries(localStorage)))')
    page.click('#startGuided')
    page.wait_for_function("GuidedTraining.active&&state==='play'")
    assert page.evaluate("Adventure.training&&SandboxMode&&GuidedTraining.step==='move'")
    assert page.locator('#trainingIcon img').count() == 1

    page.keyboard.down('ArrowLeft')
    page.wait_for_timeout(600)
    page.keyboard.up('ArrowLeft')
    page.wait_for_function('GuidedTraining.exerciseDone')

    page.click('#trainingNext')
    page.wait_for_function("GuidedTraining.step==='dodge'&&hostile.length>0&&hostile[0].y>player.y-45", timeout=10000)
    assert page.evaluate("hostile[0].type==='fire'&&hostile[0].damage===25")
    page.keyboard.press('Space')
    page.wait_for_function('GuidedTraining.exerciseDone', timeout=3000)
    assert page.evaluate('lives===5&&player.dashCD>0&&!!CombatFeel.success')

    page.click('#trainingNext')
    page.keyboard.press('f')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate('Arsenal.active.cooldown>0')

    page.click('#trainingNext')
    page.evaluate('drops=[]')  # Une relique manquée doit être reproposée.
    page.wait_for_function("drops.some(d=>d.kind==='upgrade'&&d.key==='fragment')")
    page.keyboard.down('ArrowUp')
    page.wait_for_timeout(750)
    page.keyboard.up('ArrowUp')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate('upgrades.fragment===1')

    page.click('#trainingNext')
    assert page.locator('#trainingIcon img').count() == 1
    page.keyboard.down('ArrowUp')
    page.wait_for_timeout(750)
    page.keyboard.up('ArrowUp')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate('player.shield===100')

    page.click('#trainingNext')
    page.wait_for_selector('#trainingPlay')
    assert page.evaluate("GuidedTraining.finished&&state==='training-complete'")
    page.click('#trainingMenu')
    page.wait_for_selector('#startGuided')
    after = page.evaluate('JSON.stringify(Object.fromEntries(Object.entries(localStorage)))')
    assert before == after, 'L’entraînement a modifié une sauvegarde ou une progression'
    assert page.evaluate('!GuidedTraining.active&&!Adventure.training&&!SandboxMode')

    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#startGuided')
    assert mobile.evaluate('document.documentElement.scrollWidth<=390&&document.documentElement.scrollHeight<=844')
    assert mobile.locator('#playAdventure').is_visible() and mobile.locator('#localSettings').is_visible()
    mobile.click('#startGuided')
    mobile.wait_for_function('GuidedTraining.active')
    assert mobile.evaluate('''()=>{const r=$('trainingCard').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&parseFloat(getComputedStyle($('trainingText')).fontSize)>=10}''')
    assert mobile.locator('#dash').is_visible() and mobile.locator('#specialCast').is_visible()

    assert not errors, errors
    browser.close()
    print('OK : menu hiérarchisé, guide illustré, notifications stables et iconographiées, cinq exercices réels, sauvegarde strictement inchangée, mobile sans débordement.')
