"""Régressions ciblées pour les retours d'équilibrage du créateur."""
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

    result = page.evaluate('''()=>{
      player.inv=999;
      stage=0;world=worlds[0];obstacles=[];gates=[];enemies=[];drops=[];
      for(let i=0;i<24;i++)spawnObstacle(80+(i%8)*90,300+Math.floor(i/8)*70);
      const rocks=obstacles.filter(o=>o.kind==='rock');
      const ordinary=rocks.length>0&&rocks.every(o=>o.breakable&&o.hp===4);
      const rock=rocks[0];rock.hp=1;const destroyed=damageObstacle(rock,1)&&rock.dead;

      stage=2;world=worlds[2];wave=4;transition=0;
      for(const key in upgrades)upgrades[key]=0;
      player.x=400;player.y=780;player.missileTime=0;player.rocketUnlocked=false;
      obstacles=[{x:295,y:605,r:35,dead:false},{x:400,y:500,r:35,dead:false}];
      enemies=[{x:505,y:605,r:25,dead:false}];drops=[];
      dropUpgrade(400,500);
      const pair=drops.filter(d=>d.choiceId);
      const clear=pair.length===2&&pair[0].choiceId===pair[1].choiceId&&pair[0].key!==pair[1].key&&
        pair.every(d=>d.y>=300&&d.y<=H-230&&
          !obstacles.some(o=>Math.hypot(o.x-d.x,o.y-d.y)<o.r+48)&&
          !enemies.some(e=>Math.hypot(e.x-d.x,e.y-d.y)<e.r+40));

      enemies=[{x:400,y:600,hp:100,max:100,r:19},{x:700,y:780,hp:100,max:100,r:19}];
      hostile=[{x:410,y:750},{x:700,y:100}];obstacles=[];Arsenal.active.variant=null;Arsenal.active.cooldown=0;
      const cast=Arsenal.cast();
      const pulse=cast&&enemies[0].hp===90&&enemies[1].hp===100&&hostile.length===1&&Arsenal.active.cooldown===18;
      enemies=[];hostile=[];
      return {ordinary,destroyed,clear,pulse,pair:pair.map(d=>({x:d.x,y:d.y}))};
    }''')
    assert all(result[key] for key in ['ordinary', 'destroyed', 'clear', 'pulse']), result
    assert not errors, errors
    print('OK : rochers ordinaires destructibles, choix dégagé et Onde 260/10/18 s.', result['pair'])
    browser.close()
