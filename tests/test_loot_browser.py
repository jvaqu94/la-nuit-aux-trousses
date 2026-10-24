from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1200});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto('http://localhost:3000');page.wait_for_function('MinuitArt.witchFlight.complete && MinuitScenery.every(i=>i.complete)');page.click('#story');page.wait_for_timeout(150)
 page.evaluate("enemies=[];obstacles=[];stage=1;wave=3;world=worlds[1];for(let i=0;i<4;i++)spawnObstacle(180+i*150,370+i%2*120,{kind:i%2?'rock':'crate',breakable:i<3,hp:3,max:4,warn:0,age:2,loot:i%2?'upgrade':'points'});drops.push({x:400,y:570,kind:'heal',bossLife:true,age:0});drops.push({x:520,y:590,kind:'points',points:350,age:0});scrollVelocity=100;updateHUD();state='pause';hideOverlay()")
 page.wait_for_timeout(100);page.screenshot(path='tests/obstacles-treasures.png',full_page=True)
 page.evaluate("state='play';for(let i=0;i<1200;i++){player.inv=100;update(1/60)}")
 print('Rendu obstacles et accélération',page.evaluate('({state,speed:scrollSpeed(),distance:terrainDistance})'))
 print('Campagne',page.evaluate('''()=>{const finish=end;end=win=>state='end';start('story');let i=0,lifeDrops=0;while(i++<125000&&state!=='end'){player.inv=100;const boss=enemies.find(e=>e.boss);if(boss){player.x=boss.x;player.y=700}else{const target=enemies.find(e=>e.y>0&&e.y<550);if(target)player.x=target.x}for(const d of drops){if(d.bossLife)lifeDrops++;d.x=player.x;d.y=player.y}pointer=null;moveInput={};update(1/60)}let result={state,clears,lifeDrops,score};end=finish;if(clears!==5)throw Error('progression bloquée');return result}'''))
 print('Erreurs JS',errors);assert not errors;b.close()
