from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    result = page.evaluate('''() => {
      const tones = [];
      musicTone = (frequency, duration, type, volume) => tones.push({frequency, duration, type, volume});
      noiseBurst = (duration, volume, frequency) => tones.push({percussion: true, duration, volume, frequency});
      prefs.sound = true;
      prefs.music = true;
      state = 'play';
      const signatures = [];
      const details = [];
      for (stage = 0; stage < 5; stage++) {
        enemies = [];
        tones.length = 0;
        note = 0;
        musicTime = 0;
        musicStage = -1;
        for (let step = 0; step < 18; step++) {
          musicTime = 0;
          music(1 / 60);
        }
        const events = tones.map(event => ({...event}));
        signatures.push(events.map(event => event.percussion
          ? `p${event.frequency}`
          : `${Math.round(event.frequency * 100) / 100}:${event.type}`).join('|'));
        details.push({
          id: musicThemes[stage].id,
          events: events.length,
          melody: events.filter(event => !event.percussion && event.volume === .024).length,
          percussion: events.filter(event => event.percussion).length,
          ambience: musicThemes[stage].ambience
        });
      }
      stage = 0;
      musicStage = 0;
      note = 0;
      enemies = [];
      musicTime = 0;
      music(1 / 60);
      const normalBeat = musicTime;
      musicStage = 0;
      note = 0;
      enemies = [{boss: true}];
      musicTime = 0;
      music(1 / 60);
      const bossBeat = musicTime;
      return {signatures, details, normalBeat, bossBeat};
    }''')
    assert [detail['id'] for detail in result['details']] == ['forest', 'cemetery', 'castle', 'marsh', 'lanterns'], result
    assert len(set(result['signatures'])) == 5, result
    for detail in result['details']:
        assert detail['events'] >= 25 and detail['melody'] > 0 and detail['percussion'] > 0, detail
    assert result['bossBeat'] < result['normalBeat'], result
    assert len({tuple(detail['ambience']) for detail in result['details']}) == 5
    assert not errors, errors
    browser.close()
    print('OK : cinq partitions distinctes, mélodies/basses/accords/percussions, ambiences propres et tempo intensifié pendant les gardiens.')
