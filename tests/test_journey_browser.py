"""Parcours du Grimoire dans Chromium : stockage de test isolé par contexte."""
from pathlib import Path
import json,tempfile
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);context=b.new_context(viewport={'width':1440,'height':1100},accept_downloads=True);page=context.new_page();errors=[];api=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.on('request',lambda r:api.append(r.url) if '/api/' in r.url else None);page.goto('http://localhost:3000');page.wait_for_selector('#playAdventure');assert page.evaluate('Journey.state.xp')==0
 page.click('#playAdventure');page.wait_for_function("state==='play'");assert not page.evaluate('League.active');assert page.locator('#journeyTutor').is_visible();page.evaluate('gameTime=9;League.tick(1.1)');assert 'ESQUIVE' in page.locator('#journeyTutor').inner_text();page.click('#skipTutor');assert page.evaluate('Journey.state.tutorialDone')
 page.evaluate('saveCheckpoint()');cp=page.evaluate("localStorage.getItem('minuit-checkpoint')")
 page.evaluate("player.inv=999;League.event('kills',35);League.event('waves',2);League.event('graze',6);League.tick(1.1)");xp=page.evaluate('Journey.state.xp');assert xp==370,xp
 assert not page.locator('#questHUD').is_visible();page.click('#pause');assert page.locator('#pausedJournal').is_visible();assert 'CARNET' in page.locator('#pausedJournal').inner_text();page.click('#resume')
 # Reprise au début de vague : événements déjà vus et contrats ne sont pas payés deux fois.
 page.reload();page.wait_for_selector('#localResume');page.click('#localResume');page.wait_for_function("state==='play'");page.evaluate("League.event('kills',35);League.event('waves',2);League.event('graze',6)");assert page.evaluate('Journey.state.xp')==xp
 page.evaluate('gameTime=42;score=3900;end(false)');assert page.locator('.journey-result-grid').count()==1;after=page.evaluate('Journey.state.xp');assert after==517,after
 assert page.evaluate('Journey.state.recent[0].delta')==0;assert page.evaluate('Journey.state.recent[0].extraXP')==370
 assert 'Sorts de marée' in page.locator('.journey-unlocked').inner_text();page.click('[data-feedback="fair"]');assert page.evaluate('Journey.state.recent[0].feedback')=='fair';page.screenshot(path=str(ROOT/'tests/journey-summary.png'),full_page=True)
 page.click('#resultCollection');page.wait_for_selector('[data-item="emerald"]');assert not page.locator('[data-item="emerald"]').is_disabled();assert page.locator('[data-item="bat"]').is_disabled();page.click('[data-item="emerald"]');page.click('[data-item="tide"]');page.click('[data-item="comet"]');assert page.evaluate("Journey.state.selected.outfit==='emerald'&&Journey.state.selected.spell==='tide'&&Journey.state.selected.broom==='comet'");page.screenshot(path=str(ROOT/'tests/journey-collection.png'),full_page=True);page.click('#collectionBack')
 # Restaurer une copie d'une partie déjà réglée ne permet pas de regagner son expérience.
 page.evaluate('(cp)=>localStorage.setItem("minuit-checkpoint",cp)',cp);page.reload();page.wait_for_selector('#localResume');page.click('#localResume');page.wait_for_timeout(100);assert page.evaluate("state==='league-menu'");assert page.evaluate('Journey.state.xp')==after
 page.evaluate("localStorage.removeItem('minuit-checkpoint')");page.click('#playAdventure');page.wait_for_function("state==='play'");page.click('#pause');page.click('#panelCollection');page.wait_for_selector('[data-item="night"]');page.click('[data-item="night"]');page.click('[data-item="emerald"]');page.click('#collectionBack');assert page.evaluate("state==='pause'")
 page.click('#quit');page.wait_for_selector('#playAdventure');assert not page.locator('#localResume').count()
 # Trois jours dans la même semaine : prime hebdomadaire et série conservée.
 # Le jour réel précédent peut déjà appartenir à la série, donc au moins trois.
 for day in ['2026-10-26','2026-10-27','2026-10-28']:
  page.evaluate('(day)=>{dateKey=()=>day}',day);page.click('#playAdventure');page.wait_for_function("state==='play'");page.evaluate("League.event('waves',1);gameTime=20;end(false)");page.click('#return')
 assert page.evaluate("Journey.state.weeks.includes('2026-10-26')&&Journey.state.streak>=3")
 assert page.evaluate("Journey.state.achievements.includes('regular')")
 # Export réel puis import dans un autre navigateur logique.
 page.click('#archives');page.wait_for_selector('#exportJourney')
 with page.expect_download() as download:page.click('#exportJourney')
 file=Path(tmp)/'save.json';download.value.save_as(file);payload=json.loads(file.read_text());assert payload['format']=='MinuitProgression';assert 'password' not in payload['saves'];assert set(payload['saves'])=={'minuit-settings','minuit-highscores','minuit-v2-scores','minuit-checkpoint','minuit-local-league-v1','minuit-journey-v1'}
 exported_xp=payload['saves']['minuit-journey-v1']['xp']
 mobile_context=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);mobile=mobile_context.new_page();mobile.on('dialog',lambda d:d.accept());mobile.on('pageerror',lambda e:errors.append(str(e)));mobile.goto('http://localhost:3000');mobile.wait_for_selector('#playAdventure');mobile.click('#archives');mobile.set_input_files('#importJourney',str(file));mobile.wait_for_selector('#playAdventure');assert mobile.evaluate('Journey.state.xp')==exported_xp;assert mobile.evaluate("Journey.state.selected.outfit==='emerald'");assert mobile.evaluate('document.documentElement.scrollWidth<=390')
 mobile.screenshot(path=str(ROOT/'tests/journey-mobile.png'),full_page=True)
 mobile.click('#archives');bad=Path(tmp)/'bad.json';payload['saves']['minuit-journey-v1']['xp']=-10;bad.write_text(json.dumps(payload));mobile.set_input_files('#importJourney',str(bad));mobile.wait_for_function("document.querySelector('#saveMessage').textContent.includes('invalide')");assert mobile.evaluate('Journey.state.xp')==exported_xp
 mobile.click('#archivesBack');mobile.click('#playAdventure');mobile.wait_for_function("state==='play'");mobile.evaluate('player.inv=999;League.tick(1.1)');assert not mobile.locator('#questHUD').is_visible();mobile.evaluate('score=200;gameTime=20;end(false)');assert mobile.evaluate('document.documentElement.scrollWidth<=390');mobile.locator('#retry').scroll_into_view_if_needed();assert mobile.locator('#retry').is_visible()
 mobile.click('#return');mobile.click('#archives');mobile.click('#rollbackImport');mobile.wait_for_selector('#playAdventure');assert mobile.evaluate('Journey.state.xp')==0
 mobile.click('#playAdventure');mobile.wait_for_function("state==='play'");mobile.click('#settings');mobile.wait_for_selector('#exportJourney');assert mobile.locator('#restartTutorial').count()==1;mobile.click('#settings');assert mobile.locator('#exportJourney').count()==1;mobile.click('#save');mobile.wait_for_function("state==='play'")
 assert not errors,errors;assert not api,api
 print('OK : aventure illimitée, tutoriel, XP/contrats uniques, reprise anti-double récompense, collection équipée, bilan, feedback, série/hebdo, export-import inter-navigateurs, rejet import invalide, mobile et absence de comptes/API.')
 b.close()
