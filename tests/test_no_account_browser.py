from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1440,'height':1100});errors=[];api=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:api.append(r.url) if '/api/' in r.url else None);page.on('dialog',lambda d:d.accept());page.goto('http://localhost:3000');page.wait_for_selector('#localRanked')
 assert not page.locator('#account').count() and not page.locator('input[type=password]').count()
 page.click('#localRanked');page.wait_for_selector('#launchLocal');assert page.locator('.local-card').count()==3;page.click('#launchLocal');page.wait_for_function("state==='play'&&League.active")
 page.evaluate('player.inv=999;score=1300;League.tick(2.1);saveCheckpoint()');before=page.evaluate('League.snapshot()');page.reload();page.wait_for_selector('#localResume');page.click('#localResume');page.wait_for_function("state==='play'");assert page.evaluate('League.snapshot().id')==before['id'];assert page.evaluate("Object.values(JSON.parse(localStorage.getItem('minuit-local-league-v1')).days)[0].rankedUsed") == 1
 page.evaluate('score=1500;end(false)');page.click('#return');page.click('#localDaily');page.wait_for_selector('#launchLocal');page.click('#launchLocal');page.wait_for_function("state==='play'&&mode==='daily'")
 page.evaluate("player.inv=999;League.event('kills',12);League.event('waves',2);League.event('cleanWaves',1);League.event('graze',5);League.event('elites',1);League.event('obstacles',1);League.tick(2.1)")
 assert not page.locator('#questHUD').is_visible();page.screenshot(path=str(ROOT/'tests/no-account-live.png'),full_page=True)
 page.evaluate("League.event('kills',40);League.event('waves',4);League.event('cleanWaves',3);League.event('graze',20);League.event('elites',8);League.event('bosses',1);League.event('obstacles',6);League.tick(2.1)")
 assert page.locator('#questHUD .done.local-quest-row').count()==3
 bonus=page.evaluate('dailyBonus');assert bonus>0
 earned=page.evaluate("Object.values(JSON.parse(localStorage.getItem('minuit-local-league-v1')).days)[0].bonus");assert earned==bonus
 page.evaluate("League.event('waves',8);League.event('kills',80);League.tick(2.1)");assert page.evaluate('dailyBonus')==bonus
 page.evaluate('end(false)');page.click('#return');page.click('#localDaily');page.wait_for_selector('#launchLocal');assert page.locator('#launchLocal').is_disabled()
 page.click('#localBack');page.click('#playAdventure');page.wait_for_function("state==='play'&&!League.active");page.evaluate('end(false)');page.click('#retry');page.wait_for_function("state==='play'&&!League.active")
 page.reload();page.wait_for_selector('#localResume');page.click('#localResume');page.wait_for_function("state==='play'");assert not page.evaluate('League.active')
 # An old account-based checkpoint can be resumed as a free, unranked game.
 page.evaluate("saveCheckpoint();const cp=JSON.parse(localStorage.getItem('minuit-checkpoint'));cp.league={token:'ancien-jeton',owner:999,mode:'ranked',day:cp.dailyDate};localStorage.setItem('minuit-checkpoint',JSON.stringify(cp))");page.reload();page.wait_for_selector('#localResume');page.click('#localResume');page.wait_for_function("state==='play'");assert not page.evaluate('League.active')
 assert not api,api;assert not errors,errors
 mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mobile.on('dialog',lambda d:d.accept());mobile.goto('http://localhost:3000');mobile.wait_for_selector('#localDaily');mobile.click('#localDaily');mobile.wait_for_selector('#launchLocal');assert mobile.evaluate('document.documentElement.scrollWidth<=390');mobile.screenshot(path=str(ROOT/'tests/no-account-mobile.png'),full_page=True);mobile.click('#launchLocal');mobile.wait_for_function("state==='play'");assert not mobile.locator('#questHUD').is_visible();mobile.click('#pause');assert mobile.locator('#pausedJournal').is_visible();mobile.click('#resume')
 print('OK : jeu sans connexion, aucun appel API, objectifs/primes uniques, cumul local, 3+1 essais, reprise locale et ancienne sauvegarde, entraînement/rejouer illimités, mobile sans débordement. Aucune erreur JS.')
 browser.close()
