"""Réglages neutres et moteur audio local, avec préférences historiques injectées."""
from playwright.sync_api import sync_playwright

REMOVED = ['reduced', 'scares', 'shake', 'flashSafe', 'bulletContrast', 'effectLevel', 'autoPause']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""
        localStorage.setItem('minuit-settings', JSON.stringify({
            sound: false, music: true, volume: .35, difficulty: 'normal',
            reduced: true, scares: false, shake: false, flashSafe: true,
            bulletContrast: true, effectLevel: 0, autoPause: false
        }));
    """)
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')

    # Le chargement nettoie aussi les exports produits par les anciennes éditions.
    assert page.evaluate('(keys)=>keys.every(key=>!(key in prefs))', REMOVED)
    assert page.evaluate('(keys)=>keys.every(key=>!(key in JSON.parse(localStorage.getItem("minuit-settings"))))', REMOVED)

    page.click('#localSettings')
    page.wait_for_selector('#opt-music')
    for selector in ['#difficulty', '#nickname', '#volume', '#opt-music', '#bindings']:
        assert page.locator(selector).count() == 1, selector
    for selector in ['#opt-scares', '#opt-shake', '#opt-reduced', '#bulletContrast',
                     '#effectLevel', '#flashSafe', '#autoPause']:
        assert not page.locator(selector).count(), selector
    page.click('#save')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")

    # Même injectées après le chargement, ces valeurs ne peuvent plus alléger le jeu.
    neutral = page.evaluate("""()=>{
        Object.assign(prefs, {reduced:true, scares:false, shake:false, flashSafe:true,
            bulletContrast:true, effectLevel:0, autoPause:false});
        enemies=[];scares=[];scareTimer=0;transition=0;
        Surprise.tick(1/60);
        particles=[];particle(100,100,'#ffffff',12);
        savePrefs();
        return {
            scare:scares.length===1,
            particles:particles.length===12,
            cleaned:removedSettings.every(key=>!(key in JSON.parse(localStorage.getItem('minuit-settings'))))
        };
    }""")
    assert all(neutral.values()), neutral

    # Le moteur utilise des sources harmoniques, du bruit rose et une réverbération.
    page.click('#sound')
    page.wait_for_function("audio && audio.state==='running'")
    audio = page.evaluate("""()=>({
        reverb:reverb?.buffer?.duration||0,
        noise:noiseBuffer?.duration||0,
        looping:ambienceSource?.loop===true,
        buses:!!(master&&sfxBus&&musicBus),
        state:audio.state
    })""")
    assert audio['reverb'] > 1 and audio['noise'] >= 3, audio
    assert audio['looping'] and audio['buses'] and audio['state'] == 'running', audio
    page.wait_for_timeout(500)
    assert page.evaluate('ambienceGain.gain.value') > 0
    page.evaluate("tone(220,.12,'sawtooth',.05,.6);tone(660,.2,'sine',.04,1.2);noiseBurst(.1,.02,500)")
    assert not errors, errors

    print('OK : anciennes préférences sans effet, options de facilité absentes, apparitions et particules communes, audio naturel/réverbération/ambiance actifs.')
    browser.close()
