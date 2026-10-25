"""Confort de combat : guide réel, impacts limités et invariants de gameplay."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state === 'play'")

    guide = page.evaluate('''() => {
      Journey.state.tutorialDone = true;
      Journey.state.dodgeGuideDone = false;
      $('journeyTutor').classList.add('hidden');
      enemies = []; obstacles = []; gates = []; scares = []; drops = [];
      schedule = []; spawnIndex = 0; waveTime = 0; transition = 0;
      player.x = 400; player.y = 700; player.inv = 0;
      player.dash = 0; player.dashCD = 0;
      hostile = [{x:400,y:560,vx:0,vy:200,type:'fire',r:7,damage:25,
                  life:5,grazed:false,homing:false,age:0,lockRemaining:0}];
      update(1/60);
      return {time:CombatFeel.guideThreat?.time,
              text:$('dodgeCoach').innerText,
              visible:!$('dodgeCoach').classList.contains('hidden'),
              dash:$('dash').className,
              tutorFont:parseFloat(getComputedStyle(document.querySelector('#journeyTutor span')).fontSize),
              dashFont:parseFloat(getComputedStyle($('dash')).fontSize)};
    }''')
    assert guide['visible'] and guide['time'] > 0, guide
    assert 'PRÉPARE' in guide['text'] and 'pas trop tôt' in guide['text'], guide
    assert 'dash-ready' in guide['dash'], guide
    assert guide['tutorFont'] >= 12 and guide['dashFont'] >= 11, guide

    # Les gestionnaires installés par le jeu d’origine doivent eux aussi
    # réinitialiser le crédit : ce test n’appelle pas un nouveau bouton.
    perfect = page.evaluate('''() => {
      const before = lives;
      hostile[0].x = player.x; hostile[0].y = player.y;
      $('dash').onclick();
      update(1/60); // collision réelle avec le projectile du guide
      hurt(25,'une flamme',{kind:'shot',x:player.x,y:player.y,r:7});
      const first = Journey.run.stats.perfectDodges;
      player.dash = 0; player.inv = 0; player.dashCD = 0;
      $('dash').onclick();
      hurt(25,'une flamme',{kind:'shot',x:player.x,y:player.y,r:7});
      return {before,lives,first,total:Journey.run.stats.perfectDodges,
              done:Journey.state.dodgeGuideDone,success:!!CombatFeel.success};
    }''')
    assert perfect['lives'] == perfect['before'], perfect
    assert perfect['first'] == 1 and perfect['total'] == 2, perfect
    assert perfect['done'] and perfect['success'], perfect

    limited = page.evaluate('''() => {
      let tones = 0, noises = 0;
      const baseTone = tone, baseNoise = noiseBurst;
      tone = (...args) => {tones++; return baseTone(...args)};
      noiseBurst = (...args) => {noises++; return baseNoise(...args)};
      const enemy = {x:400,y:300,hp:1000,max:1000,r:20,hit:0,dead:false};
      enemies = [enemy];
      for (let i=0;i<20;i++) damageEnemy(enemy,1,false);
      const first = {tones,noises,hp:enemy.hp};
      gameTime += .1;
      damageEnemy(enemy,1,false);
      const second = {tones,noises};
      const beforeDeaths = tones;
      const fallen = () => ({x:400,y:300,hp:0,max:1,r:19,kind:'ghost',dead:false,elite:false,boss:false,poison:0});
      reward(fallen()); reward(fallen());
      const deathSounds = tones - beforeDeaths;
      tone = baseTone; noiseBurst = baseNoise;
      return {first,second,deathSounds};
    }''')
    assert limited['first'] == {'tones':1,'noises':0,'hp':980}, limited
    assert limited['second']['tones'] == 2 and limited['deathSounds'] == 1, limited

    projectiles = page.evaluate('''() => {
      const types = ['fire','blood','poison','hex','spirit','web','bone','hunter'];
      return types.map(type => {
        const b = {x:200,y:300,vx:30,vy:130,type,r:type==='web'?13:7,
                   life:4,homing:true,lockRemaining:1};
        const before = JSON.stringify(b);
        drawHostile(ctx,b,ambient);
        return before === JSON.stringify(b);
      });
    }''')
    assert all(projectiles), projectiles

    relic = page.evaluate('''() => {
      enemies = []; hostile = []; upgrades.fragment = 0;
      const drop = {x:400,y:500,kind:'upgrade',key:'fragment'};
      drawRelic(ctx,drop,ambient);
      collectUpgrade(drop);
      return {text:$('toast').textContent,rank:upgrades.fragment,
              short:CombatFeel.shortEffect('fragment')};
    }''')
    assert relic['rank'] == 1 and '8 tirs en cercle' in relic['text'], relic
    assert '8 TIRS' in relic['short'], relic

    champion = page.evaluate('''() => {
      enemies = []; stage = 2; world = worlds[2]; wave = 4;
      spawnEnemy({x:400,kind:'pumpkin',pattern:0,group:0,index:7});
      const e = enemies.at(-1);
      return {name:e.championName,hint:e.championHint,hp:e.hp,max:e.max,
              r:e.r,speed:e.speed,tier:e.tier,toast:$('toast').textContent};
    }''')
    assert champion['tier'] == 2 and champion['name'] == 'COURGE ANCIENNE', champion
    assert champion['max'] == 19 and champion['hp'] == 19 and champion['r'] == 25, champion
    assert 'flammes en éventail' in champion['toast'], champion

    assert page.evaluate('document.documentElement.scrollWidth <= 390 && document.documentElement.scrollHeight <= 844')
    assert not errors, errors
    browser.close()
    print('OK : guide sur projectile réel, esquive unique par activation, impacts limités, hitboxes intactes, relique explicite, champion présenté sans statistiques ajoutées, mobile lisible.')
