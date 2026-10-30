from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()");page.goto('http://localhost:3000');page.wait_for_selector('#playAdventure');page.click('#playAdventure');page.wait_for_function("state==='play'")
 print(page.evaluate('''()=>{
  if(Object.values(upgrades).some(v=>v))throw Error('arsenal initial');
  if(eligibleUpgrades().length)throw Error('bonus vague 1');
  wave=2;if(eligibleUpgrades().some(d=>d[0]!=='fire'))throw Error('déblocages précoces');
  wave=3;collectUpgrade({key:'rocket'});collectUpgrade({key:'rocket'});
  if(upgrades.rocket!==1||player.missileTime!==15)throw Error('cumul missiles');
  upgrades.fire=1;enemies=[];schedule=[{time:1e9}];spawnIndex=0;waveTime=0;let maxSalve=0;
  for(let i=0;i<1000;i++){player.inv=100;update(1/60);maxSalve=Math.max(maxSalve,rockets.length)}
  if(player.missileTime!==0||upgrades.rocket!==0||rockets.length)throw Error('expiration');
  if(upgrades.fire!==1)throw Error('arme permanente perdue');
  stage=2;world=worlds[2];collectUpgrade({key:'rocket'});collectUpgrade({key:'rocket'});collectUpgrade({key:'rocket'});
  if(upgrades.rocket!==2||player.missileTime!==15)throw Error('plafond tardif');
  saveCheckpoint();resumeCheckpoint();if(player.missileTime!==15||upgrades.rocket!==2)throw Error('reprise');
  return {vague1:'sort simple',deblocage:'progressif',duree:player.missileTime,maxMissilesTardifs:upgrades.rocket};
 }'''))
 print('Erreurs JS',errors);assert not errors;b.close()
