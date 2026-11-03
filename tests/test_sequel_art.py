"""Rendu animé du monde 2 : assets, phases, hitboxes, mobile et charge."""
import json
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
CAMPAIGN = {
    'version': 1, 'world1Completed': True, 'world2Unlocked': True,
    'world2Completed': False, 'cardOath': True, 'lastWorld': 2,
    'choice': 'dawn', 'character': 'witch', 'world2Started': True,
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1280, 'height': 900})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.add_init_script("localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))")
    page.add_init_script("localStorage.setItem('minuit-campaign-v1',JSON.stringify(%s))" % json.dumps(CAMPAIGN))
    page.goto(URL)
    page.click('#playAdventure')
    page.wait_for_function("state==='play' && Campaign.activeWorld===2 && window.SequelArt")
    page.wait_for_function('SequelArt.kinds.every(k=>MinuitArt[k]?.complete)')

    # Toutes les illustrations sont locales, valides et réellement peintes.
    assets = page.evaluate('''()=>SequelArt.kinds.map(kind=>({kind,
      width:MinuitArt[kind].naturalWidth,height:MinuitArt[kind].naturalHeight,
      local:MinuitArt[kind].src.startsWith('data:image/svg+xml')}))''')
    assert len(assets) == 19 and all(a['width'] > 0 and a['height'] > 0 and a['local'] for a in assets), assets

    # Les empreintes pixel prouvent que les auras et les phases ne sont pas cosmétiques sur le papier.
    art = page.evaluate('''()=>{
      function paint(kind,phase,time,opened=false,hpRatio=1){
        const canvas=document.createElement('canvas');canvas.width=260;canvas.height=260;
        const g=canvas.getContext('2d'),boss=SequelArt.isBossKind(kind);
        const e={kind,boss,x:130,y:125,r:boss?52:24,hp:100,max:100,phase,age:time,fire:2,
          phaseFlash:0,seqSeed:.7,seqOpened:opened};
        e.hp=e.max*hpRatio;
        const before=JSON.stringify({x:e.x,y:e.y,r:e.r,hp:e.hp,max:e.max,phase:e.phase});
        const drawn=SequelArt.drawActor(g,e,130,125,boss?1.8:1.7,time,0);
        const after=JSON.stringify({x:e.x,y:e.y,r:e.r,hp:e.hp,max:e.max,phase:e.phase});
        const pixels=g.getImageData(0,0,260,260).data;let painted=0;
        for(let i=3;i<pixels.length;i+=4)if(pixels[i])painted++;
        const data=canvas.toDataURL();let hash=2166136261;
        for(let i=0;i<data.length;i++)hash=Math.imul(hash^data.charCodeAt(i),16777619);
        return {drawn,painted,unchanged:before===after,hash:hash>>>0};
      }
      const creatures=['lampWisp','shadePostman','glassMite','glassShard','sunMirror','rootClock',
        'timeLarva','railImp','sunLuggage','needleWraith','hourHollow','mirrorClone','riftAnchor','captiveSoul'];
      const animated=creatures.map(kind=>[kind,paint(kind,1,0),paint(kind,1,1.25)]);
      const bosses=['lanternier','glassqueen','clockstag','conductor','clockmaker'].map(kind=>
        [kind,paint(kind,1,1.2,false,.5),paint(kind,2,1.2,false,.5),paint(kind,3,1.2,false,.5)]);
      return {animated,bosses,closed:paint('sunLuggage',1,1.2,false),opened:paint('sunLuggage',1,1.2,true),
        healthy:paint('glassqueen',1,1.2,false,1),damaged:paint('glassqueen',1,1.2,false,.2)};
    }''')
    for kind, first, second in art['animated']:
        assert first['drawn'] and first['painted'] > 1500 and first['unchanged'], (kind, first)
        assert first['hash'] != second['hash'], ('animation absente', kind)
    for kind, phase1, phase2, phase3 in art['bosses']:
        assert all(p['drawn'] and p['painted'] > 3000 and p['unchanged'] for p in (phase1, phase2, phase3)), kind
        assert len({phase1['hash'], phase2['hash'], phase3['hash']}) == 3, ('phases identiques', kind)
    assert art['closed']['hash'] != art['opened']['hash'], 'La valise ouverte doit être visible.'
    assert art['healthy']['hash'] != art['damaged']['hash'], 'Les dégâts doivent laisser des marques.'

    # Scène dense : le nouveau rendu reste au-dessus du seuil de fluidité du projet.
    page.evaluate('''()=>{
      stage=4;world=worlds[4];wave=5;enemies=[];hostile=[];particles=[];drops=[];
      hazards=[];obstacles=[];SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies[0];boss.y=230;boss.phase=3;boss.hp=boss.max*.25;boss.phaseShield=0;boss.fire=999;
      const forms=['lampWisp','shadePostman','glassMite','sunMirror','rootClock','timeLarva','railImp','sunLuggage','needleWraith','hourHollow'];
      forms.forEach((kind,i)=>{spawnEnemy({kind,x:80+(i%5)*160,y:390+Math.floor(i/5)*105,group:80+i,index:i});const e=enemies[enemies.length-1];e.fire=999;e.age=1.2});
      for(let i=0;i<260;i++)hostile.push({x:20+(i%26)*30,y:560+Math.floor(i/26)*18,vx:0,vy:0,type:i%2?'hex':'bone',r:7,damage:1,life:8,grazed:false,homing:false,age:0});
      for(let i=0;i<180;i++)particle(60+(i%30)*23,710+Math.floor(i/30)*10,'#c291e7',1);
      player.inv=1000;state='pause';drawGame();
    }''')
    performance = page.evaluate('''async()=>{
      const frames=[];let last=performance.now();const end=last+2500;
      return await new Promise(resolve=>{function sample(now){frames.push(now-last);last=now;
        if(now<end)return requestAnimationFrame(sample);const usable=frames.slice(2);
        const avg=usable.reduce((a,b)=>a+b,0)/usable.length;
        resolve({fps:1000/avg,frames:usable.length});}requestAnimationFrame(sample)});
    }''')
    assert performance['fps'] >= 40, performance

    # Le rendu étendu ne capture pas les acteurs du premier monde.
    classic = page.evaluate('''()=>{
      Campaign.useClassicWorld();stage=0;world=worlds[0];enemies=[];
      spawnEnemy({kind:'ghost',x:400,y:250,group:0,index:0,pattern:0});const ghost=enemies[0];
      const canvas=document.createElement('canvas'),g=canvas.getContext('2d');
      return {custom:SequelArt.drawActor(g,ghost,100,100,1,1,0),campaign:Campaign.activeWorld,r:ghost.r};
    }''')
    assert classic['custom'] is False and classic['campaign'] == 1, classic
    context.close()

    # Vérification sur téléphone avec le gardien et ses deux aiguilles actives.
    context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile = context.new_page()
    mobile.on('pageerror', lambda error: errors.append(str(error)))
    mobile.add_init_script("localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))")
    mobile.add_init_script("localStorage.setItem('minuit-campaign-v1',JSON.stringify(%s))" % json.dumps(CAMPAIGN))
    mobile.goto(URL)
    mobile.click('#playAdventure')
    mobile.wait_for_function("state==='play' && Campaign.activeWorld===2 && window.SequelArt")
    mobile_result = mobile.evaluate('''()=>{
      stage=4;world=worlds[4];wave=5;enemies=[];hostile=[];drops=[];hazards=[];obstacles=[];
      SequelBestiary.effects.length=0;spawnBoss();const boss=enemies[0];boss.y=230;boss.phase=3;
      boss.hp=boss.max*.25;boss.phaseShield=0;boss.fire=99;boss.cycle=0;player.inv=1000;
      SequelBestiary.attack(boss);for(let i=0;i<20;i++)update(1/60);drawGame();
      return {width:document.documentElement.scrollWidth,r:boss.r,phase:boss.phase,
        hands:SequelBestiary.effects.filter(e=>e.type==='hand').length,
        drawn:SequelArt.drawActor(document.createElement('canvas').getContext('2d'),boss,100,100,2.3,1.2,0)};
    }''')
    assert mobile_result['width'] <= 390 and mobile_result['r'] == 52, mobile_result
    assert mobile_result['hands'] == 2 and mobile_result['drawn'], mobile_result
    context.close()

    assert not errors, errors
    print('OK : 19 illustrations animées, 5 boss × 3 phases, valise ouverte, hitboxes, monde 1, mobile et fluidité.', performance)
    browser.close()
