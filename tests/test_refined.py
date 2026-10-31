from playwright.sync_api import sync_playwright
from pathlib import Path
ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1200})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");page.goto('http://localhost:3000');page.wait_for_function('MinuitArt.witch.complete && MinuitScenery.every(i=>i.complete)')
 page.screenshot(path=str(ROOT/'refined-menu.png'),full_page=True)
 page.click('#playAdventure');page.wait_for_function("state==='play'");page.wait_for_timeout(150)
 print('Pilotage et bonus',page.evaluate('''()=>{
   player.inv=100;pointer={x:600,y:600};update(1/60);
   if(player.x!==600||player.y!==600)throw Error('latence souris');
   pointer=null;moveInput={arrowright:true};const x=player.x;update(1/60);moveInput={};if(player.x<=x)throw Error('clavier');
   drops=[{x:player.x,y:player.y,kind:'upgrade',key:'rocket'}];update(1/60);if(upgrades.rocket!==1)throw Error('relique');
   player.shield=100;player.shieldTime=6;player.inv=0;hurt(25);if(player.shield!==75)throw Error('shield');
   player.shieldTime=.01;update(.02);if(player.shield!==0)throw Error('expiration');
   for(const k in upgrades)upgrades[k]=2;upgrades.rocket=4;upgrades.fire=3;
   for(let i=0;i<600;i++){player.inv=100;update(1/60)}
   if(state!=='play')throw Error('interruption');
   return {state,rocket:upgrades.rocket,drops:drops.length};
 }'''))
 page.evaluate("enemies=[];shots=[];hostile=[];rockets=[];drops=[];player.x=400;player.y=700;player.inv=0;player.shield=100;player.shieldTime=6;for(let i=0;i<7;i++)spawnEnemy({x:110+i*95,kind:['pumpkin','bat','spider','ghost','skull','vampire','demon'][i],pattern:0});enemies.forEach((e,i)=>e.y=180+i%2*120);dropUpgrade(330,520,'rocket');dropUpgrade(440,470,'poison');dropUpgrade(550,540,'familiar');state='pause';hideOverlay();")
 page.wait_for_timeout(100);page.screenshot(path=str(ROOT/'refined-game.png'),full_page=True)
 # Le vol sans téléportation vers les ennemis peut dépasser 1 000 s simulés au dernier gardien.
 print('Campagne avec récompenses',page.evaluate('''()=>{const originalEnd=end;end=win=>{state='end'};start('story');let n=0,phases=new Set();while(n++<100000&&state!=='end'){if(state==='choice'){takeChoice(0);continue}player.inv=100;let boss=enemies.find(e=>e.boss);if(boss){player.x=boss.x;phases.add(stage+':'+boss.phase)}for(let d of drops)if(d.kind==='upgrade'){d.x=player.x;d.y=player.y}update(1/60)}let result={state,clears,stage,wave,seconds:gameTime,upgrades,phases:[...phases].length};end=originalEnd;if(clears!==5)throw Error('progression bloquée '+JSON.stringify(result));return result}'''))
 print('Déterminisme',page.evaluate('''()=>{const run=(reduced)=>{prefs.reduced=reduced;start('daily');for(let i=0;i<600;i++){player.inv=100;update(1/60)}return JSON.stringify({seed,score,enemies:enemies.map(e=>[e.x,e.y,e.hp]),drops})};return run(false)===run(true)}'''))
 page.reload();page.wait_for_selector('#localResume');page.click('#localResume');page.wait_for_function("state==='play'");assert page.evaluate('state')=='play'
 page.click('#pause');page.click('#resume');assert page.evaluate('state')=='play'
 mobile=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 mobile.on('pageerror',lambda e:errors.append(str(e)));mobile.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");mobile.goto('http://localhost:3000');mobile.wait_for_function('MinuitScenery.every(i=>i.complete)');mobile.click('#playAdventure');mobile.wait_for_function("state==='play'");mobile.wait_for_timeout(200);mobile.screenshot(path=str(ROOT/'refined-mobile.png'),full_page=True)
 assert not mobile.evaluate('document.documentElement.scrollWidth > innerWidth')
 print('Erreurs JS',errors);assert not errors
 b.close()
