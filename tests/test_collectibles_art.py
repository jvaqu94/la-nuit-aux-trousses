from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://localhost:3000');page.wait_for_function("window.CollectibleArt&&Object.values(CollectibleArt.art).length>=18&&Object.values(CollectibleArt.art).every(i=>i.complete&&i.naturalWidth===180)");page.click('#playAdventure');page.wait_for_function("state==='play'")
 page.evaluate("enemies=[];obstacles=[];gates=[];wave=2;Adventure.createRisk();const d=Adventure.encounter.seal;d.y=480;d.x=625;NightHazards.spawnCandy('xp',180,480);NightHazards.spawnCandy('points',340,480);NightHazards.spawnCandy('shield',500,670);state='pause';hideOverlay();document.querySelector('#journeyTutor').classList.add('hidden');drawGame()")
 page.screenshot(path=str(Path(__file__).parent/'collectibles-refined.png'),full_page=True)
 assert 'Détruis un rocher' in page.inner_text('.sidebar')
 result=page.evaluate("()=>{state='play';const r=Adventure.encounter;damageObstacle(r.guards[1],999);damageObstacle(r.seal,999);const d=drops.find(d=>d.riskOpened),before=Journey.state.xp;Adventure.collectRisk(d);Adventure.collectRisk(d);return{xp:Journey.state.xp-before,shown:d.riskGrantedXP,points:d.points}}")
 assert result=={'xp':40,'shown':40,'points':800},result
 assert not errors,errors;print('OK : illustrations SVG des bonbons, reliquaires et bonus chargées, coffres/bonbons rendus, utilité explicitée, récompense XP unique et gain affiché exact.');b.close()
