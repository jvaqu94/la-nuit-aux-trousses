"""Parcours réels Chromium, avec base temporaire et deux navigateurs logiques."""
import tempfile,os,importlib.util,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(dir=ROOT/'tests') as tmp:
 os.environ['MINUIT_DB']=str(Path(tmp)/'browser.sqlite3')
 spec=importlib.util.spec_from_file_location('browser_server',ROOT/'server.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
 server=s.ThreadingHTTPServer(('127.0.0.1',0),s.Handler);server.daemon_threads=True;threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_port)
 try:
  with sync_playwright() as p:
   b=p.chromium.launch(headless=True,args=['--no-sandbox']);a=b.new_context(viewport={'width':1440,'height':1200});watch=b.new_context(viewport={'width':1280,'height':1000});page=a.new_page();viewer=watch.new_page();errors=[]
   for tab in [page,viewer]:tab.on('pageerror',lambda e:errors.append(str(e)));tab.on('dialog',lambda d:d.accept());tab.goto(url);tab.wait_for_selector('#leagueRanked')
   page.click('#account');page.click('#switchAuth');page.fill('#authName','SorciereBrowser');page.fill('#authPassword','une-nuit-secrete');page.click('#authSubmit');page.wait_for_selector('#leagueRanked')
   page.click('#leagueRanked');page.wait_for_selector('#launchLeague');assert page.locator('.daily-card').count()==3
   page.click('#launchLeague');page.wait_for_function("state==='play'&&League.active")
   page.evaluate("player.inv=999;score=2200;gameTime=1;League.tick(2.1)")
   viewer.wait_for_function("document.querySelector('#leaderboard').textContent.replace(/\\s/g,'').includes('2200')")
   assert page.evaluate("diff===1&&mode==='story'")
   page.evaluate('end(false)');page.wait_for_function("document.querySelector('#submitstatus').textContent.includes('validé')")
   page.click('#return');page.click('#leagueRanked');page.wait_for_selector('#launchLeague');page.click('#launchLeague');page.wait_for_function("state==='play'");page.evaluate("player.inv=999;score=1000;gameTime=1;end(false)");page.wait_for_function("document.querySelector('#submitstatus').textContent.includes('validé')")
   assert page.evaluate("document.querySelector('#leaguePanel .league-total').textContent.replace(/\\s/g,'').startsWith('2200')")
   page.click('#return');page.click('#leagueDaily');page.wait_for_selector('#launchLeague');page.screenshot(path=str(ROOT/'tests/league-objectives-before.png'),full_page=True)
   page.click('#launchLeague');page.wait_for_function("state==='play'&&mode==='daily'");page.evaluate('player.inv=999')
   assert page.locator('#questHUD').is_visible();assert page.locator('#questHUD .questrow').count()==3
   # Sauvegarde / rechargement : même jeton, aucun nouvel essai.
   token=page.evaluate('session');page.evaluate('saveCheckpoint()');page.reload();page.wait_for_selector('#leagueResume');page.click('#leagueResume');page.wait_for_function("state==='play'");assert page.evaluate('session')==token
   profile=page.request.get(url+'/api/state').json()['user'];assert profile['dailyLeft']==0 and profile['rankedLeft']==1
   page.evaluate("player.inv=999;reward({x:200,y:200,elite:true,tier:1});damageObstacle({x:200,y:200,kind:'crate',breakable:true,hp:1,loot:'points'},5);dailyWaveReward();score=3000;gameTime=4;League.event('kills',12);League.event('graze',5);League.event('obstacles',1);League.tick(2.1)")
   page.wait_for_timeout(150);page.screenshot(path=str(ROOT/'tests/league-objectives-live.png'),full_page=True)
   page.evaluate("gameTime=10;League.event('kills',48);League.event('waves',6);League.event('cleanWaves',3);League.event('graze',15);League.event('elites',8);League.event('bosses',1);League.event('obstacles',5);League.tick(2.1)")
   page.wait_for_function("document.querySelectorAll('#questHUD .claimed').length===3")
   result=page.request.get(url+'/api/state').json();bonus=sum(g['reward'] for g in result['goals']);assert result['user']['total']==2200+bonus
   viewer.wait_for_function("n=>document.querySelector('#leaderboard').textContent.replace(/\\s/g,'').includes(String(n))",arg=2200+bonus)
   assert page.evaluate('dailyBonus')==bonus
   page.evaluate('end(false)');page.wait_for_function("document.querySelector('#submitstatus').textContent.includes('validé')")
   assert page.request.get(url+'/api/state').json()['user']['total']==2200+bonus
   page.click('#return');page.click('#leagueDaily');page.wait_for_selector('#launchLeague');assert page.locator('#launchLeague').is_disabled()
   # Fin en panne réseau : file d’attente conservée et validation au retour.
   page.click('#leagueBack');page.click('#leagueRanked');page.wait_for_selector('#launchLeague');page.click('#launchLeague');page.wait_for_function("state==='play'")
   page.route('**/api/run/progress',lambda route:route.abort())
   page.evaluate("player.inv=999;score=9000;gameTime=2;end(false)");page.wait_for_selector('#retrySync')
   assert page.evaluate("Object.values(JSON.parse(localStorage.getItem('minuit-league-outbox-1'))).some(p=>p.finish)")
   page.unroute('**/api/run/progress');page.click('#retrySync');page.wait_for_function("document.querySelector('#submitstatus').textContent.includes('synchronisé')")
   assert page.request.get(url+'/api/state').json()['user']['total']==9000+bonus
   page.click('#return')
   # Connexion du même compte dans un autre contexte : cumul et quotas partagés.
   viewer.click('#account');viewer.fill('#authName','SorciereBrowser');viewer.fill('#authPassword','une-nuit-secrete');viewer.click('#authSubmit');viewer.wait_for_selector('#leagueRanked');assert viewer.request.get(url+'/api/state').json()['user']['dailyLeft']==0
   # Mobile : objectifs lisibles avant lancement et pas de débordement horizontal.
   mobile=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));mp.goto(url);mp.wait_for_selector('#leagueRanked');mp.click('#account');mp.fill('#authName','SorciereBrowser');mp.fill('#authPassword','une-nuit-secrete');mp.click('#authSubmit');mp.wait_for_selector('#leagueRanked');mp.click('#leagueDaily');mp.wait_for_selector('#launchLeague');assert mp.locator('.daily-card').count()==3;assert mp.evaluate('document.documentElement.scrollWidth<=390&&innerWidth===390');mp.screenshot(path=str(ROOT/'tests/league-mobile.png'),full_page=True)
   assert not errors,errors
   print('OK Chromium : inscription, classées, SSE inter-joueurs, objectifs avant et pendant, primes uniques, reprise sans nouvel essai, compte multi-appareils, quotas et mobile. Aucune erreur JS.')
   b.close()
 finally:server.shutdown();server.server_close()
