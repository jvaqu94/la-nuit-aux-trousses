from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':1200},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://localhost:3000');page.wait_for_selector('#story')
    page.screenshot(path='checks-menu.png',full_page=True)
    page.click('#story');page.wait_for_timeout(500)
    assert page.locator('#overlay').evaluate('(e)=>e.classList.contains("hidden")')
    result=page.evaluate('''()=>{
      // Bouclier : dégâts et durée indépendants.
      player.shield=100;player.shieldTime=12;player.inv=0;hurt(25);
      if(player.shield!==75)throw Error('bouclier');
      player.shieldTime=.01;update(.02);if(player.shield!==0)throw Error('expiration');
      // Esquive, précision et armes.
      player.dashCD=0;dodge();if(player.dash<=0)throw Error('esquive');
      for(let k in upgrades)upgrades[k]=2;upgrades.fire=3;upgrades.rocket=4;
      enemies=[];schedule=[];spawnIndex=0;waveTime=0;
      for(let i=0;i<6;i++)spawnEnemy({x:100+i*110,kind:world.foes[i%world.foes.length],pattern:i%4});
      for(let i=0;i<600;i++){player.inv=100;update(1/60);if(state==='choice'){takeChoice(0)}}
      // Cinq boss : trois phases, récompense, transitions et victoire.
      let phases=[];
      for(let st=0;st<5;st++){
        stage=st;world=worlds[st];wave=5;state='play';enemies=[];spawnBoss();
        const boss=enemies.find(e=>e.boss);boss.y=140;
        for(let ph of [1,2,3]){boss.hp=boss.max*(ph===1?.9:ph===2?.55:.2);boss.fire=0;boss.adds=0;bossAttack(boss,.02);phases.push(boss.phase);drawGame()}
        damageEnemy(boss,1e6);
        if(st<4){if(state!=='choice')throw Error('choix boss');takeChoice(0);if(stage!==st+1)throw Error('univers')}
        else if(state!=='end')throw Error('victoire');
      }
      return {phases,state,clears};
    }''')
    print('Mécaniques',json.dumps(result))
    page.click('#return');page.click('#settings');page.locator('#opt-reduced').check();page.locator('#nickname').fill('Test');page.click('#save')
    page.click('#daily');page.wait_for_timeout(300)
    page.evaluate("player.inv=100;player.shield=100;player.shieldTime=12;upgrades.rocket=3;upgrades.familiar=2;upgrades.poison=2;upgrades.laser=2;updateLoadout();for(let i=0;i<360;i++)update(1/60)")
    page.screenshot(path='checks-game.png',full_page=True)
    page.click('#pause');assert page.locator('#resume').is_visible();page.click('#resume')
    page.reload();page.wait_for_selector('#continue');page.click('#continue')
    print('Reprise',page.evaluate('({state,stage,wave,mode})'))
    page.evaluate('end(false)');page.wait_for_timeout(300)
    print('Publication',page.locator('#submitstatus').inner_text())
    page.click('#return');page.click('#onlinetab');page.wait_for_timeout(300)
    print('Serveur',page.locator('#netstatus').inner_text())
    mobile=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.on('pageerror',lambda e:errors.append(str(e)))
    mobile.goto('http://localhost:3000');mobile.click('#story');mobile.wait_for_timeout(150)
    mobile.screenshot(path='checks-mobile.png',full_page=True)
    print('Mobile overflow',mobile.evaluate('document.documentElement.scrollWidth > innerWidth'))
    print('Erreurs',errors)
    assert not errors
    b.close()
