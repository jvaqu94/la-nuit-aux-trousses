"""Vrais MP3 locaux : décodage, boucles, mondes, gardiens et retour au menu."""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
IDS = ['menu', 'forest', 'cemetery', 'castle', 'marsh', 'lanterns']
SAMPLES = dict(zip(IDS, [4197935, 2638999, 2757879, 2791095, 2566203, 2664286]))
RATES = {'forest': 1, 'cemetery': .88, 'castle': 1.02, 'marsh': .94, 'lanterns': 1.08}


def mpeg_header(data, name):
    # Les fichiers fournis peuvent commencer par une métadonnée ID3.
    for offset in range(min(len(data) - 4, 131072)):
        a, b, c, d = data[offset:offset + 4]
        if a == 0xFF and b & 0xE0 == 0xE0 and (b >> 3) & 3 == 3 and (b >> 1) & 3 == 1:
            if c >> 4 not in (0, 15) and (c >> 2) & 3 != 3 and d >> 6 in (0, 1):
                return data[offset:offset + 4]
    raise AssertionError(f'En-tête MPEG absent : {name}')


for track in IDS:
    filename = 'nuitsorc-loop' if track == 'menu' else track
    data = (ROOT / 'audio' / f'{filename}.mp3').read_bytes()
    assert len(data) > 100_000, track
    header = mpeg_header(data, track)
    # MPEG 1 Layer III, 128 ou 192 kbit/s, 44,1 kHz, stéréo ou joint stéréo.
    assert header[2] >> 4 in (9, 11) and (header[2] >> 2) & 3 == 0, track
for track in IDS[1:]:
    boss_data = (ROOT / 'audio' / f'boss-{track}.mp3').read_bytes()
    assert len(boss_data) > 30_000 and mpeg_header(boss_data, f'boss-{track}')[2] >> 4 in (9, 11)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    errors, failed = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('requestfailed', lambda request: failed.append(request.url))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#sound')
    page.wait_for_function("mp3Music?.current==='menu' && !!mp3Music.source")

    menu = page.evaluate("""()=>({
      channels:mp3Music.buffer.numberOfChannels,
      loop:mp3Music.source.loop,
      start:mp3Music.source.loopStart,
      duration:mp3Music.source.loopEnd-mp3Music.source.loopStart,
      state:audio.state
    })""")
    assert menu['channels'] == 2 and menu['loop'] and menu['state'] == 'running', menu
    assert .024 < menu['start'] < .026, menu
    assert abs(menu['duration'] - SAMPLES['menu'] / 44100) < .002, menu

    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    details = []
    for index, track in enumerate(IDS[1:]):
        page.evaluate("""index=>{stage=index;world=worlds[index];enemies=[];audioSignature='';syncAudio()}""", index)
        page.wait_for_function("id=>mp3Music?.current===id && !!mp3Music.source", arg=track)
        page.wait_for_function("expected=>mp3Music.current===expected.id && Math.abs(mp3Music.source.playbackRate.value-expected.rate)<.02", arg={'id': track, 'rate': RATES[track]})
        detail = page.evaluate("""()=>{
          const player=mp3Music,buffer=player.buffer,a=buffer.getChannelData(0),b=buffer.getChannelData(1);
          const start=Math.round(player.source.loopStart*buffer.sampleRate),end=Math.min(a.length-1,Math.round(player.source.loopEnd*buffer.sampleRate)-1);
          let signature=2166136261;
          for(let i=start;i<end;i+=4093)signature=Math.imul(signature^Math.floor((a[i]+1)*1000000),16777619);
          return {id:player.current,channels:buffer.numberOfChannels,loop:player.source.loop,
            duration:player.source.loopEnd-player.source.loopStart,cache:player.buffers.size,
            signature:signature>>>0,seam:Math.abs(a[end]-a[start])+Math.abs(b[end]-b[start])};
        }""")
        assert detail['id'] == track and detail['channels'] == 2 and detail['loop'], detail
        assert abs(detail['duration'] - SAMPLES[track] / 44100) < .002, detail
        assert detail['cache'] <= 2 and detail['seam'] < .15, detail
        details.append(detail)
    assert len({detail['signature'] for detail in details}) == 5, details

    page.evaluate("stage=0;world=worlds[0];enemies=[];audioSignature='';syncAudio()")
    page.wait_for_function("mp3Music?.current==='forest' && !!mp3Music.source")
    page.evaluate("enemies=[];spawnBoss();audioSignature='';syncAudio()")
    page.wait_for_function("mp3Music.arrivalBuffers.has('boss-forest')")
    boss_cue = page.evaluate("""()=>{const b=mp3Music.arrivalBuffers.get('boss-forest');return {channels:b.numberOfChannels,duration:b.duration,effects:mp3Music.effectsDestination===sfxBus}}""")
    assert boss_cue['channels'] == 2 and 10 < boss_cue['duration'] < 13 and boss_cue['effects'], boss_cue
    page.wait_for_function('mp3Music.source.playbackRate.value>1.06')
    assert page.evaluate('mp3Music.current') == 'forest'
    page.wait_for_timeout(400)
    assert page.evaluate('ambienceGain.gain.value') > 0
    page.evaluate("enemies=[];audioSignature='';syncAudio()")
    page.wait_for_function('mp3Music.source.playbackRate.value<1.01')

    page.evaluate("state='pause';audioSignature='';syncAudio()")
    assert page.evaluate('mp3Music.current') == 'forest'
    page.evaluate("state='play';audioSignature='';LocalLeague.menu();syncAudio()")
    page.wait_for_function("mp3Music?.current==='menu' && !!mp3Music.source")
    page.evaluate("prefs.music=false;audioSignature='';syncAudio()")
    page.wait_for_function('mp3Music.source===null')
    page.wait_for_timeout(300)
    page.evaluate("stage=0;world=worlds[0];state='play';enemies=[];spawnEnemy({x:400,kind:'ghost',pattern:0})")
    assert page.evaluate('mp3Music.source===null && mp3Music.effectsDestination===sfxBus')

    assert not errors, errors
    assert not failed, failed

    # Le livrable file:// doit lire les mêmes six morceaux en contexte hors ligne.
    offline = browser.new_context(offline=True, viewport={'width': 390, 'height': 844})
    solo = offline.new_page()
    solo_errors, remote = [], []
    solo.on('pageerror', lambda error: solo_errors.append(str(error)))
    solo.on('request', lambda request: remote.append(request.url) if request.url.startswith(('http://', 'https://')) else None)
    solo.goto((ROOT / 'La-Nuit-aux-Trousses.html').as_uri())
    solo.wait_for_selector('#playAdventure')
    solo.click('#sound')
    solo.wait_for_function("mp3Music?.current==='menu' && !!mp3Music.source")
    solo.click('#playAdventure')
    solo.wait_for_function("state==='play'")
    for index, track in enumerate(IDS[1:]):
        solo.evaluate("index=>{stage=index;world=worlds[index];enemies=[];audioSignature='';syncAudio()}", index)
        solo.wait_for_function("id=>mp3Music?.current===id && !!mp3Music.source", arg=track)
        solo.evaluate("spawnEnemy({x:400,kind:world.foes[0],pattern:0})")
    solo.evaluate("enemies=[];spawnBoss();audioSignature='';syncAudio()")
    solo.wait_for_function("mp3Music.arrivalBuffers.has('boss-forest')")
    assert not solo_errors, solo_errors
    assert not remote, remote
    offline.close()
    browser.close()
    print('OK : thème fourni au menu, cinq compositions dédiées et tempos, arrivée boss uniquement, raccords, cache, bus effets et autonome hors ligne.')
