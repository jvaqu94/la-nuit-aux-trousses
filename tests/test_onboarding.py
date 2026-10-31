"""Accueil, guide illustré, notifications stables et entraînement sans progression."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')

    assert page.locator('.main-menu button').count() == 13
    assert 'Éclaircir les ombres' not in page.locator('.main-menu').inner_text()
    assert page.locator('#playAdventure').is_visible()
    assert page.locator('#localRanked').count() == 0 and page.locator('#labMenu').is_visible()
    assert page.locator('#trainingRequiredNote').is_visible()
    assert page.locator('#playRanked').count() == 0 and page.locator('#localRanked').count() == 0 and page.locator('#labMenu').is_disabled() and page.locator('#weeklySprint').is_disabled()
    assert 'Entraînement obligatoire' in page.locator('#playAdventure').inner_text()

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
    page.wait_for_selector('#trainingRequiredNote')

    # Premier profil : les dix exercices sont obligatoires et aucun ne peut être passé.
    page.click('#playAdventure')
    page.wait_for_function("GuidedTraining.active&&state==='play'")
    assert page.locator('#trainingSkip').is_hidden() and page.locator('#trainingQuit').is_hidden()
    assert page.locator('#score').is_hidden() and page.locator('#hiValue').is_hidden()
    assert 'sans score ni récompense' in page.locator('#modeLabel').inner_text()
    assert '1 / 10' in page.locator('#trainingProgress').inner_text()
    page.click('#pause')
    assert page.locator('#quit').is_disabled()
    page.click('#resume')

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

    # Les deux évolutions utilisent les vraies valeurs de leur balai.
    page.wait_for_function("GuidedTraining.step==='dodgeStyles'")
    assert page.evaluate("Arsenal.active.broom==='comet-flight'&&Arsenal.dashInv()===.5&&Arsenal.dashCooldown()===5")
    assert page.locator('[data-training-broom="aurora-flight"]').is_disabled()
    page.click('#dash')
    page.wait_for_function("document.querySelector('[data-training-broom=comet-flight]').textContent.includes('✓')")
    # Aucun clic sur Aurore : elle doit être sélectionnée automatiquement après Comète.
    page.wait_for_function("Arsenal.active.broom==='aurora-flight'&&player.dashCD===0")
    assert page.locator('[data-training-broom="aurora-flight"]').is_enabled()
    assert page.evaluate('Arsenal.dashDuration()===.26&&Arsenal.dashInv()===.38&&Arsenal.dashCooldown()===3.2')
    page.click('#dash')
    page.wait_for_function('GuidedTraining.exerciseDone')
    page.click('#trainingNext')

    page.keyboard.press('f')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate('Arsenal.active.cooldown>0')
    page.click('#trainingNext')

    # Espace déclenche les trois vraies attaques, sans déclencher d’esquive.
    page.wait_for_function("GuidedTraining.step==='attackStyles'")
    assert page.locator('[data-training-attack]').count() == 3
    assert 'rayon 260' in page.locator('[data-training-attack="pulse"]').inner_text()
    assert '340 × 340' in page.locator('[data-training-attack="tidewave"]').inner_text()
    assert 'largeur 90' in page.locator('[data-training-attack="sunray"]').inner_text()
    page.keyboard.press('Space')
    page.wait_for_function("Arsenal.active.spell==='pulse'&&Arsenal.active.cooldown>0")
    page.wait_for_function("$('trainingCard').classList.contains('attack-preview')")
    preview = page.evaluate('''()=>{const card=$('trainingCard').getBoundingClientRect(),arena=document.querySelector('.arena').getBoundingClientRect();return{height:card.height,clear:card.bottom<=arena.top+90}}''')
    assert preview['height'] <= 64 and preview['clear'], preview
    assert page.evaluate('hostile.length===0&&enemies.every(e=>e.hp<500)')
    page.wait_for_function("Arsenal.active.spell==='tidewave'&&Arsenal.active.cooldown===0")
    assert page.evaluate('player.dash===0&&player.dashCD===0')
    assert '✓' in page.locator('[data-training-attack="pulse"]').inner_text()
    page.keyboard.press('Space')
    page.wait_for_function("Arsenal.active.spell==='tidewave'&&Arsenal.active.cooldown>0")
    assert page.evaluate('hostile.length===1&&hostile[0].x===690&&enemies.every(e=>e.hp<500)&&enemies[0].y<=490')
    page.wait_for_function("Arsenal.active.spell==='sunray'&&Arsenal.active.cooldown===0")
    assert page.evaluate('player.dash===0&&player.dashCD===0')
    assert '✓' in page.locator('[data-training-attack="tidewave"]').inner_text()
    page.keyboard.press('Space')
    page.wait_for_function("Arsenal.active.spell==='sunray'&&Arsenal.active.cooldown>0")
    assert page.evaluate('hostile.length===1&&hostile[0].x===620&&enemies[0].hp<500&&enemies[1].hp===500')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate("Arsenal.active.spell==='sunray'&&player.dash===0&&player.dashCD===0")
    page.click('#trainingNext')

    # La vraie apparition doit être évitée, sans perdre de vie.
    page.wait_for_function("GuidedTraining.step==='surprise'&&scares.length>0", timeout=5000)
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(800)
    page.keyboard.up('ArrowRight')
    page.wait_for_function('GuidedTraining.exerciseDone', timeout=5000)
    # Une caisse percutée disparaît sans être détruite : elle doit être reproposée.
    page.evaluate("document.querySelector('#trainingNext').click();player.fire=999")
    page.wait_for_function("GuidedTraining.step==='chest'&&obstacles.length===1")
    lost = page.evaluate('''()=>{const chest=obstacles[0];player.x=chest.x;player.y=chest.y;player.inv=0;player.dash=0;update(1/60);return {remaining:obstacles.length,done:GuidedTraining.exerciseDone,lives}}''')
    assert lost == {'remaining': 0, 'done': False, 'lives': 5}, lost
    page.wait_for_function("GuidedTraining.step==='chest'&&obstacles.length===1&&!GuidedTraining.exerciseDone", timeout=3000)
    page.evaluate('player.fire=0')
    page.wait_for_function("GuidedTraining.step==='chest'&&GuidedTraining.exerciseDone", timeout=5000)
    page.click('#trainingNext')

    page.evaluate('drops=[]')  # Une relique manquée doit être reproposée.
    page.wait_for_function("drops.some(d=>d.kind==='upgrade'&&d.key==='fragment')")
    page.keyboard.down('ArrowUp')
    page.wait_for_timeout(750)
    page.keyboard.up('ArrowUp')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate('upgrades.fragment===1')
    page.click('#trainingNext')

    # Dix reliques et sept bonus immédiats/bonbons sont présentés.
    page.click('#trainingBonusGallery')
    page.wait_for_selector('.training-bonus-gallery')
    assert page.locator('.training-bonus-item').count() == 17
    assert page.locator('.training-bonus-item img').count() == 17
    page.click('#bonusGalleryBack')
    page.wait_for_function('GuidedTraining.exerciseDone')
    page.click('#trainingNext')

    page.keyboard.down('ArrowUp')
    page.wait_for_timeout(750)
    page.keyboard.up('ArrowUp')
    page.wait_for_function('GuidedTraining.exerciseDone')
    assert page.evaluate('player.shield===100')
    page.click('#trainingNext')
    page.wait_for_selector('#trainingPlay')
    assert page.evaluate("GuidedTraining.finished&&state==='training-complete'")
    completed = page.evaluate("JSON.parse(localStorage.getItem('minuit-journey-v1'))")
    assert completed['trainingDone'] is True and completed['xp'] == 0 and completed['recent'] == [], completed
    assert page.evaluate("localStorage.getItem('minuit-v2-scores')===null&&localStorage.getItem('minuit-highscores')===null")

    # Le bouton final lance cette fois une vraie partie hors bac à sable.
    page.click('#trainingPlay')
    page.wait_for_function("state==='play'&&!Adventure.training")
    assert page.evaluate('Journey.state.trainingDone&&!SandboxMode')
    page.keyboard.press('Space')
    assert page.evaluate('player.dash>0&&Arsenal.active.cooldown===0'), 'Espace doit rester l’esquive en vol normal'
    normal = page.evaluate('''()=>{
      enemies=[];obstacles=[];gates=[];scares=[];drops=[];
      player.x=400;player.y=700;player.inv=999;player.dash=0;player.dashCD=0;CombatFeel.reset();
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
      say('Bouclier spectral · 6 secondes',.2);
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
    # Rejouer l’entraînement reste libre et ne modifie plus la sauvegarde si on le quitte.
    before = page.evaluate('JSON.stringify(Object.fromEntries(Object.entries(localStorage)))')
    page.click('#startGuided')
    page.wait_for_function("GuidedTraining.active&&state==='play'")
    assert page.locator('#trainingSkip').is_visible() and page.locator('#trainingQuit').is_visible()
    page.click('#trainingSkip')
    page.wait_for_function("GuidedTraining.step==='dodge'")
    page.click('#trainingQuit')
    page.wait_for_selector('#startGuided')
    after = page.evaluate('JSON.stringify(Object.fromEntries(Object.entries(localStorage)))')
    assert before == after, 'Le rejeu quitté a modifié une sauvegarde ou une progression'
    assert page.evaluate('!GuidedTraining.active&&!Adventure.training&&!SandboxMode')
    assert page.locator('#trainingRequiredNote').count() == 0
    page.reload(wait_until='domcontentloaded')
    page.wait_for_selector('.home-menu #playAdventure')
    assert page.evaluate('Journey.state.trainingDone')
    assert page.locator('#trainingRequiredNote').count() == 0
    assert page.locator('#localRanked').count() == 0 and page.locator('#labMenu').is_enabled() and page.locator('#weeklySprint').is_enabled()

    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#playAdventure')
    assert mobile.evaluate('document.documentElement.scrollWidth<=390&&document.documentElement.scrollHeight<=844')
    assert mobile.locator('#playAdventure').is_visible() and mobile.locator('#localSettings').is_visible()
    mobile.click('#playAdventure')
    mobile.wait_for_function('GuidedTraining.active')
    assert mobile.locator('#trainingSkip').is_hidden() and mobile.locator('#trainingQuit').is_hidden()
    assert mobile.evaluate('''()=>{const r=$('trainingCard').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&parseFloat(getComputedStyle($('trainingText')).fontSize)>=10}''')
    assert mobile.locator('#dash').is_visible() and mobile.locator('#specialCast').is_visible()

    # Sur petit téléphone, le bouton tactile enchaîne les mêmes attaques sans déborder.
    mobile_attacks = browser.new_page(viewport={'width': 360, 'height': 640}, is_mobile=True, has_touch=True)
    mobile_attacks.on('pageerror', lambda error: errors.append(str(error)))
    mobile_attacks.add_init_script("localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))")
    mobile_attacks.goto('http://localhost:3000')
    mobile_attacks.wait_for_selector('#startGuided', state='visible')
    mobile_attacks.click('#startGuided')
    mobile_attacks.wait_for_function("GuidedTraining.active&&state==='play'")
    for _ in range(4):
        mobile_attacks.click('#trainingSkip')
    mobile_attacks.wait_for_function("GuidedTraining.step==='attackStyles'")
    bounds = mobile_attacks.evaluate('''()=>{const card=$('trainingCard').getBoundingClientRect(),arena=document.querySelector('.arena').getBoundingClientRect(),touch=document.querySelector('.touchbar').getBoundingClientRect();return{left:card.left,right:card.right,top:card.top,bottom:card.bottom,arenaBottom:arena.bottom,touchTop:touch.top,overflow:document.documentElement.scrollWidth>innerWidth}}''')
    assert bounds['left'] >= 0 and bounds['right'] <= 360 and not bounds['overflow'], bounds
    assert bounds['bottom'] <= bounds['arenaBottom'] + 1 and bounds['bottom'] <= bounds['touchTop'] + 1, bounds
    mobile_attacks.screenshot(path='/tmp/training-attacks-mobile.png', full_page=True)
    def assert_attack_preview():
        mobile_attacks.wait_for_function("$('trainingCard').classList.contains('attack-preview')")
        preview = mobile_attacks.evaluate('''()=>{const card=$('trainingCard').getBoundingClientRect(),arena=document.querySelector('.arena').getBoundingClientRect(),canvas=c.getBoundingClientRect();return{height:card.height,clear:card.bottom<=arena.top+90,targets:enemies.every(e=>canvas.top+e.y/H*canvas.height>card.bottom),overflow:document.documentElement.scrollWidth>innerWidth}}''')
        assert preview['height'] <= 64 and preview['clear'] and preview['targets'] and not preview['overflow'], preview
    mobile_attacks.click('#specialCast');assert_attack_preview()
    mobile_attacks.screenshot(path='/tmp/training-attacks-mobile-preview.png', full_page=True)
    mobile_attacks.wait_for_function("Arsenal.active.spell==='tidewave'&&Arsenal.active.cooldown===0")
    mobile_attacks.click('#specialCast');assert_attack_preview()
    mobile_attacks.wait_for_function("Arsenal.active.spell==='sunray'&&Arsenal.active.cooldown===0")
    mobile_attacks.click('#specialCast');assert_attack_preview()
    mobile_attacks.wait_for_function('GuidedTraining.exerciseDone')
    assert mobile_attacks.evaluate('player.dash===0&&player.dashCD===0')

    # Les profils déjà actifs avant l’ajout du drapeau ne sont pas bloqués.
    legacy = browser.new_page(viewport={'width': 1100, 'height': 800})
    legacy.on('pageerror', lambda error: errors.append(str(error)))
    legacy.add_init_script("""
        localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,tutorialDone:true,xp:0,recent:[],seen:{},activeDates:[]}));
        localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:false}));
    """)
    legacy.goto('http://localhost:3000', wait_until='domcontentloaded')
    legacy.wait_for_selector('.home-menu #playAdventure')
    assert legacy.evaluate('Journey.state.trainingDone')
    assert legacy.locator('#trainingRequiredNote').count() == 0
    assert legacy.locator('#localRanked').count() == 0

    assert not errors, errors
    browser.close()
    print('OK : menu hiérarchisé, guide illustré, notifications stables et iconographiées, dix exercices obligatoires, enchaînements automatiques des esquives et attaques, bonus présentés, sauvegarde du rejeu inchangée, aperçu des trois attaques dégagé et mobile sans débordement.')
