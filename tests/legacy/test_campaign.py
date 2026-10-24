from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1100});errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.goto('http://localhost:3000');page.wait_for_selector('#story')
 page.screenshot(path='checks-menu.png',full_page=True)
 print(page.evaluate('''()=>{start('story');let n=0,history=[];while(n++<65000&&state!=='end'){if(state==='choice'){history.push([stage,wave]);let i=offered.findIndex(d=>d[0]==='rocket'||d[0]==='fire'||d[0]==='laser');takeChoice(Math.max(0,i))}if(state==='play'){player.inv=100;const boss=enemies.find(e=>e.boss);if(boss)player.x=boss.x;update(1/60)}}return {state,stage,wave,clears,history,seconds:gameTime,iterations:n}}'''))
 print('Déterminisme',page.evaluate('''()=>{const run=(reduced)=>{prefs.reduced=reduced;start('daily');for(let i=0;i<600;i++){player.inv=100;update(1/60)}return JSON.stringify({seed,score,positions:enemies.map(e=>[e.x,e.y,e.hp]),drops})};return run(false)===run(true)}'''))
 print('Erreurs',errs)
 assert not errs
 b.close()
