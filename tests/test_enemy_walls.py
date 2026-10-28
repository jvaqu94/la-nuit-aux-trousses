"""Les monstres ne restent pas protégés par une barrière du parcours."""
from playwright.sync_api import sync_playwright


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")

    result = page.evaluate('''()=>{
      enemies=[];shots=[];hostile=[];rockets=[];obstacles=[];drops=[];hazards=[];scares=[];
      schedule=[{time:9999}];spawnIndex=0;routeTimer=99999;obstacleTimer=99999;scareTimer=99999;
      player.inv=999;player.fire=9999;scrollVelocity=0;wave=3;waveTime=0;
      const makeEnemy=()=>({x:100,y:500,baseX:100,hp:1,max:1,r:19,speed:0,kind:'ghost',pattern:9,
        age:0,fire:999,poison:0,poisonTick:0,hit:0});
      const makeGate=()=>({y:500,oldY:500,center:400,width:240,h:44,age:1,hit:0});
      const enemy=makeEnemy();enemies.push(enemy);gates=[makeGate()];
      shots.push({x:100,y:520,vx:0,vy:-600,damage:1,life:2,pierce:0,seen:new Set()});
      update(1/60);
      const contactKill=enemy.dead&&!enemies.includes(enemy);

      enemies=[];shots=[{x:100,y:520,vx:0,vy:-600,damage:1,life:2,pierce:0,seen:new Set()}];
      update(1/60);
      const emptyWallStillBlocks=shots.length===0;

      const approaching=makeEnemy();approaching.hp=approaching.max=50;
      gates=[makeGate()];
      for(let i=0;i<45;i++)clearEnemyFromRoute(approaching,1/60);
      const movedToPassage=approaching.x>280&&approaching.baseX===approaching.x;
      const outsideSolid=!routeSolidAt(approaching.x,approaching.y,approaching.r);
      return {contactKill,emptyWallStillBlocks,movedToPassage,outsideSolid,x:approaching.x};
    }''')
    assert all(result[key] for key in (
        'contactKill', 'emptyWallStillBlocks', 'movedToPassage', 'outsideSolid',
    )), result
    assert not errors, errors
    print('OK : monstre au contact du mur tuable, barrière toujours solide et rapprochement vers le passage.', result['x'])
    browser.close()
