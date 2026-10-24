from playwright.sync_api import sync_playwright
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--no-sandbox']);errors=[]
 for width,height in [(1366,768),(1440,900),(1024,600),(390,844),(360,640),(844,390)]:
  page=b.new_page(viewport={'width':width,'height':height},is_mobile=width<851,has_touch=width<851);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.goto('http://localhost:3000');page.wait_for_selector('#fullView');page.wait_for_timeout(100)
  def check():
   g=page.evaluate('''()=>{const a=document.querySelector('.arena').getBoundingClientRect(),bar=document.querySelector('.touchbar').getBoundingClientRect();return {a:{x:a.x,y:a.y,w:a.width,h:a.height,b:a.bottom,r:a.right},bar:{b:bar.bottom,r:bar.right},w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}}''')
   assert g['a']['b']<=height+1 and g['bar']['b']<=height+1 and g['a']['y']>=0 and g['a']['r']<=width+1,g
   assert g['sw']<=width and g['sh']<=height+1,g
   assert abs(g['a']['w']/g['a']['h']-8/9)<.01,g
   return g
  geom=check();page.locator('#playAdventure').scroll_into_view_if_needed();page.click('#playAdventure');page.wait_for_function("state==='play'");check()
  if width<851:
   page.click('#infoToggle');page.wait_for_selector('.sidebar.infos-open');assert page.evaluate("state==='pause'");page.click('#closeInfos');page.click('#resume')
  if (width,height) in [(1366,768),(390,844)]:page.screenshot(path=str(ROOT/f'tests/fit-{width}-{height}.png'),full_page=True)
  page.evaluate('gameTime=40;score=1200;end(false)');check();page.locator('#return').scroll_into_view_if_needed();page.click('#return');page.locator('#wardrobe').scroll_into_view_if_needed();page.click('#wardrobe');page.locator('#collectionBack').scroll_into_view_if_needed();assert page.locator('#collectionBack').is_visible();check()
  print(width,height,'terrain',geom['a']['w'],geom['a']['h'],'sans débordement')
  page.close()
 assert not errors,errors;b.close();print('OK : terrain + commandes entièrement visibles, menus internes défilables, proportions, tiroir mobile et six tailles d’écran. Aucune erreur JS.')
