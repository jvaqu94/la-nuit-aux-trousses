"""Régression UI : le choix doit suivre le premier gardien, aussi sur tactile."""
from playwright.sync_api import sync_playwright

INIT = """(()=>{
  const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');
  localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}));
  const settings=JSON.parse(localStorage.getItem('minuit-settings')||'{}');
  localStorage.setItem('minuit-settings',JSON.stringify({...settings,sound:false,music:false}));
})()"""

SETUP_BOSS = """()=>{
  enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];
  wave=5;spawnBoss();const boss=enemies.find(e=>e.boss);boss.y=210;reward(boss);
  for(let i=0;i<180&&state==='play';i++){player.inv=100;update(1/60)}
  return {state,stage,offers:offered.map(x=>x.id),cards:document.querySelectorAll('.level-reward-card').length};
}"""

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/tmp/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--single-process'])
    errors=[]
    page=browser.new_page(viewport={'width':1280,'height':1000})
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.add_init_script(INIT)
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    result=page.evaluate(SETUP_BOSS)
    assert result['state']=='choice' and result['stage']==0,result
    assert result['offers']==['power','companion','armor','life'] and result['cards']==4,result
    assert page.locator('.level-reward-screen').is_visible()
    page.click('#levelReward0')
    page.wait_for_function("state==='play'&&stage===1")
    assert page.evaluate('player.rewards.power')==1
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-checkpoint')).player.rewards.power")==1
    browser.close()

    # Le Chromium embarqué fonctionne en processus unique : isoler le téléphone.
    browser=p.chromium.launch(headless=True,executable_path='/tmp/chromium',args=['--no-sandbox','--disable-dev-shm-usage','--single-process'])
    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile.on('pageerror',lambda error:errors.append(str(error)))
    mobile.add_init_script(INIT)
    mobile.goto('http://localhost:3000')
    mobile.wait_for_selector('#playAdventure')
    mobile.click('#playAdventure')
    mobile.wait_for_function("state==='play'")
    result=mobile.evaluate(SETUP_BOSS)
    assert result['state']=='choice' and result['cards']==4,result
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.locator('#levelReward2').tap()
    mobile.wait_for_function("state==='play'&&stage===1")
    assert mobile.evaluate('player.rewards.armorCharges')==3
    assert not errors,errors
    print('UI récompenses : premier gardien, quatre cartes, clic, tactile, checkpoint et mobile OK')
    browser.close()
