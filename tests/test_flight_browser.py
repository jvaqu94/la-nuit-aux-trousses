from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path(__file__).parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1200});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto('http://localhost:3000');page.wait_for_function('MinuitArt.witchFlight.complete && MinuitScenery.every(i=>i.complete)');assert page.evaluate('MinuitArt.witchFlight.naturalWidth')>0
 page.click('#daily');page.wait_for_timeout(100)
 print('Défi',page.evaluate("(()=>{dailyAward(150,'test');if(!document.getElementById('dailyinfo').textContent.includes('+150'))throw Error('bonus masqué');return {mode,score,dailyBonus}})()"))
 page.evaluate("stage=1;wave=4;world=worlds[1];enemies=[];hostile=[];gates=[];player.x=400;player.y=740;player.inv=0;player.shield=100;player.shieldTime=12;for(let i=0;i<12;i++)spawnEnemy({x:95+i*54,kind:i%2?'spider':'skull',pattern:0,group:0,index:i});enemies.forEach((e,i)=>{e.y=190+(i%3)*110;e.age=i*.2});for(let i=0;i<3;i++)shootHostile({x:200+i*200,y:330,kind:'spider'},'web',[0],130,Math.PI/2);updateHUD();state='pause';hideOverlay()")
 page.wait_for_timeout(100);page.screenshot(path=str(OUT/'flight-overhead.png'),full_page=True)
 print('Partie de bout en bout',page.evaluate('''()=>{const finish=end;end=win=>{state='end'};start('daily');let i=0;while(i++<120000&&state!=='end'){player.inv=100;let boss=enemies.find(e=>e.boss);if(boss){player.x=boss.x;player.y=700}else{let e=enemies.find(e=>e.y>0&&e.y<500);if(e)player.x=e.x}for(let d of drops){d.x=player.x;d.y=player.y}pointer=null;moveInput={};update(1/60)}const r={state,clears,score,bonus:dailyBonus,eliteKills:dailyEliteKills};end=finish;if(clears!==5||dailyBonus<=0)throw Error('partie bloquée');return r}'''))
 page.reload();page.wait_for_selector('#continue');page.click('#continue');assert page.evaluate('dailyBonus')>0
 mobile=b.new_page(viewport={'width':390,'height':844},has_touch=True,is_mobile=True);mobile.on('pageerror',lambda e:errors.append(str(e)));mobile.goto('http://localhost:3000');mobile.click('#story');mobile.wait_for_timeout(200);assert not mobile.evaluate('document.documentElement.scrollWidth>innerWidth')
 print('Erreurs JS',errors);assert not errors;b.close()
