"""Simulation technique invulnérable : progression et objectifs, pas jugement humain de difficulté."""
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");page.goto('http://localhost:3000');page.wait_for_selector('#playAdventure');page.click('#playAdventure');page.wait_for_function("state==='play'")
 result=page.evaluate('''()=>{let steps=0;while(steps++<125000&&state!=='end'){if(state==='choice'){takeChoice(0);continue}if(state!=='play')break;player.inv=100;const boss=enemies.find(e=>e.boss);if(boss){player.x=boss.x;player.y=700}else{const target=enemies.find(e=>e.y>0&&e.y<550);if(target)player.x=target.x}for(const d of drops){d.x=player.x;d.y=player.y}pointer=null;moveInput={};update(1/60)}return {state,clears,score,time:gameTime,xp:Journey.state.xp,stats:Journey.state.recent[0]?.stats,titles:Journey.state.achievements}}''')
 assert result['state']=='end' and result['clears']==5,result
 assert result['stats']['waves']==25 and result['stats']['bosses']==5,result
 assert 'dawn' in result['titles'] and 'breaker' in result['titles'] and result['xp']>0,result
 assert result['stats'].get('realmEvents')==5,result
 assert result['stats'].get('rivalEncounters')==5,result
 assert not errors,errors
 print('Campagne technique complète :',result)
 print('OK : 25 vagues, cinq gardiens, XP, objectifs et titres de victoire. Aucune erreur JavaScript. Invulnérabilité de test : ne valide pas la difficulté humaine.')
 b.close()
