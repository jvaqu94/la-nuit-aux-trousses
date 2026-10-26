"""Accueil : sorcière de profil, musique au lancement et déblocage navigateur."""
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
AUTOPLAY_BLOCK = """
window.__homeGesture = false;
window.addEventListener('pointerdown', () => { window.__homeGesture = true; }, true);
window.addEventListener('keydown', () => { window.__homeGesture = true; }, true);
const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
if (NativeAudioContext) {
  class GestureAudioContext extends NativeAudioContext {
    constructor(...args) { super(...args); this.suspend(); }
    resume() {
      if (!window.__homeGesture) return Promise.reject(new DOMException('Un geste est requis', 'NotAllowedError'));
      return super.resume();
    }
  }
  window.AudioContext = GestureAudioContext;
  window.webkitAudioContext = GestureAudioContext;
}
"""

MOBILE_GEOMETRY = """()=>{
  const overlayNode=document.querySelector('#overlay'),overlay=overlayNode.getBoundingClientRect();
  const holder=document.querySelector('.layout>div:first-child').getBoundingClientRect();
  const play=document.querySelector('#playAdventure').getBoundingClientRect();
  const sound=document.querySelector('#homeSoundToggle').getBoundingClientRect();
  const account=document.querySelector('#archives').getBoundingClientRect();
  const flight=[...document.querySelectorAll('.menu-group')].find(node=>node.textContent.includes('TON VOL')).getBoundingClientRect();
  const title=document.querySelector('.menu-copy h1');
  const visible=rect=>rect.top>=overlay.top&&rect.bottom<=overlay.bottom;
  return {width:document.documentElement.scrollWidth,inner:innerWidth,
    playVisible:visible(play),soundVisible:visible(sound),accountVisible:visible(account),tonVolVisible:visible(flight),
    fullHeight:overlay.height+2>=holder.height,titleOverflow:title.scrollWidth>title.clientWidth+1,
    visualHeight:document.querySelector('#menuVisual').getBoundingClientRect().height};
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 900})
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append(request.url))
    page.goto(URL)
    page.wait_for_selector('#homeSoundToggle')
    page.wait_for_function("audio?.state==='running' && mp3Music?.current==='menu' && !!mp3Music.source")
    page.wait_for_function("document.querySelector('#homeAudioNote').textContent==='Lecture en cours'")
    assert any('nuitsorc-loop.mp3' in url for url in requests)
    portrait = page.evaluate("""()=>{
      const image=document.querySelector('.home-witch'),menu=document.querySelector('.home-menu');
      const title=document.querySelector('.menu-copy h1');
      return {src:image.src===MinuitArt.witch.src,loaded:image.complete&&image.naturalWidth>0,
        alt:image.alt,menuHeight:menu.getBoundingClientRect().height,
        titleOverflow:title.scrollWidth>title.clientWidth+1,buttons:menu.querySelectorAll('button').length};
    }""")
    assert portrait['src'] and portrait['loaded'] and 'profil' in portrait['alt'], portrait
    assert portrait['menuHeight'] < 760 and not portrait['titleOverflow'], portrait
    assert portrait['buttons'] == 13, portrait
    assert page.locator('#menuVisual .lesson-icon').count() == 0

    page.click('#homeSoundToggle')
    page.wait_for_function("!prefs.sound && audio?.state==='suspended' && mp3Music.source===null")
    assert page.locator('#homeSoundLabel').inner_text() == 'Activer la musique'
    page.click('#homeSoundToggle')
    page.wait_for_function("prefs.sound && audio?.state==='running' && mp3Music?.current==='menu' && !!mp3Music.source")
    page.click('#archives')
    page.wait_for_selector('#cloudPseudo', state='visible')
    assert page.locator('.settings-page').count() == 0
    page.click('#archivesBack')
    page.wait_for_selector('.home-account-access')
    page.click('#arcadeScores')
    page.wait_for_selector('.arcade-score-screen')
    page.click('#arcadeScoresBack')
    page.wait_for_selector('#homeSoundToggle')
    page.wait_for_function("mp3Music?.current==='menu'")

    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mobile_errors = []
    mobile.on('pageerror', lambda error: mobile_errors.append(str(error)))
    mobile.goto(URL)
    mobile.wait_for_selector('#homeSoundToggle')
    mobile.wait_for_function("audio?.state==='running' && mp3Music?.current==='menu'")
    geometry = mobile.evaluate(MOBILE_GEOMETRY)
    assert geometry['width'] <= geometry['inner'], geometry
    assert geometry['playVisible'] and geometry['soundVisible'], geometry
    assert geometry['accountVisible'] and geometry['tonVolVisible'], geometry
    assert geometry['fullHeight'] and not geometry['titleOverflow'], geometry
    assert 109 <= geometry['visualHeight'] <= 111, geometry

    mobile.set_viewport_size({'width': 360, 'height': 640})
    mobile.wait_for_timeout(150)
    compact = mobile.evaluate(MOBILE_GEOMETRY)
    assert compact['width'] <= compact['inner'], compact
    assert compact['accountVisible'] and compact['tonVolVisible'], compact
    assert compact['fullHeight'] and not compact['titleOverflow'], compact

    silent = browser.new_page(viewport={'width': 1000, 'height': 800})
    silent.add_init_script("localStorage.setItem('minuit-settings',JSON.stringify({sound:false,music:true,volume:.35,difficulty:'normal',name:'Sorcière'}))")
    silent.goto(URL)
    silent.wait_for_selector('#homeSoundToggle')
    assert silent.evaluate('audio===null')
    silent.click('#homeSoundToggle')
    silent.wait_for_function("prefs.sound && audio?.state==='running' && mp3Music?.current==='menu'")

    # Simule strictement la politique d’un navigateur qui exige une activation.
    blocked = browser.new_page(viewport={'width': 1100, 'height': 800})
    blocked_errors = []
    blocked.on('pageerror', lambda error: blocked_errors.append(str(error)))
    blocked.add_init_script(AUTOPLAY_BLOCK)
    blocked.goto(URL)
    blocked.wait_for_selector('#homeSoundToggle')
    blocked.wait_for_function("audio?.state==='suspended' && mp3Music?.key==='menu'")
    assert blocked.locator('#homeAudioNote').inner_text() == 'Un geste pour démarrer'
    blocked.click('#arcadeScores')
    blocked.wait_for_selector('.arcade-score-screen')
    blocked.wait_for_function("audio?.state==='running' && mp3Music?.current==='menu' && !!mp3Music.source")

    assert not errors, errors
    assert not mobile_errors, mobile_errors
    assert not blocked_errors, blocked_errors
    browser.close()
    print('OK : accueil remanié, sorcière de profil, MP3, compte direct, pleine hauteur mobile et Ton vol visible à 390×844 comme à 360×640.')
