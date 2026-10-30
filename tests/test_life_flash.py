"""Clignotement rouge réservé à la perte effective d'une vie."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    page.wait_for_timeout(300)

    result = page.evaluate('''()=>{
      enemies=[];hostile=[];obstacles=[];gates=[];drops=[];schedule=[{time:9999}];spawnIndex=0;
      player.fire=9999;player.inv=0;player.dash=0;player.shield=0;lives=3;lifeFlash=0;
      hurt(25,'test');
      const loss={lives,flash:lifeFlash,inv:player.inv};
      let tint='';
      const original=sprite;
      sprite=function(...args){if(args[1]==='witch'&&args[7])tint=args[7];return original(...args)};
      ambient=0;drawGame();sprite=original;
      const redTint=tint;
      lifeFlash=.001;update(1/60);
      const expired=lifeFlash===0;
      player.inv=0;player.dash=0;player.shield=100;player.shieldTime=5;lifeFlash=0;
      const before=lives;hurt(25,'test');
      const shieldOnly=lives===before&&lifeFlash===0;
      player.shield=0;player.inv=0;player.dash=0;player.dashCD=0;lifeFlash=0;
      dodge();
      const dashOnly=lifeFlash===0;
      return {loss,redTint,expired,shieldOnly,dashOnly};
    }''')
    assert result['loss']['lives'] == 2, result
    assert result['loss']['flash'] > 1.7 and result['loss']['inv'] > 1.7, result
    assert 'sepia' in result['redTint'] and 'hue-rotate' in result['redTint'], result
    assert result['expired'] and result['shieldOnly'] and result['dashOnly'], result
    assert not errors, errors
    print('OK : perte de vie = clignotement rouge temporisé ; bouclier et esquive sans faux signal.')
    browser.close()
