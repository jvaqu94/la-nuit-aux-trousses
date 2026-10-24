from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:3000');page.wait_for_selector('#story');page.click('#story')
 print(page.evaluate('''()=>{
  if(Object.values(upgrades).some(v=>v))throw Error('arsenal initial');
  if(eligibleUpgrades().length)throw Error('bonus vague 1');
  wave=2;if(eligibleUpgrades().some(d=>d[0]!=='fire'))throw Error('déblocages précoces');
  wave=3;collectUpgrade({key:'rocket'});collectUpgrade({key:'rocket'});
  if(upgrades.rocket!==1||player.missileTime!==10)throw Error('cumul missiles');
  upgrades.fire=1;enemies=[];schedule=[{time:1e9}];spawnIndex=0;waveTime=0;let maxSalve=0;
  for(let i=0;i<650;i++){player.inv=100;update(1/60);maxSalve=Math.max(maxSalve,rockets.length)}
  if(player.missileTime!==0||upgrades.rocket!==0||rockets.length)throw Error('expiration');
  if(upgrades.fire!==1)throw Error('arme permanente perdue');
  stage=2;world=worlds[2];collectUpgrade({key:'rocket'});collectUpgrade({key:'rocket'});collectUpgrade({key:'rocket'});
  if(upgrades.rocket!==2||player.missileTime!==10)throw Error('plafond tardif');
  saveCheckpoint();resumeCheckpoint();if(player.missileTime!==10||upgrades.rocket!==2)throw Error('reprise');
  return {vague1:'sort simple',deblocage:'progressif',duree:player.missileTime,maxMissilesTardifs:upgrades.rocket};
 }'''))
 print('Erreurs JS',errors);assert not errors;b.close()
