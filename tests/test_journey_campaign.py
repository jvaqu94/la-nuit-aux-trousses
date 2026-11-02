"""Simulation technique invulnérable : progression et objectifs, pas jugement humain de difficulté."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.add_init_script("""(()=>{
      const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');
      localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}));
    })()""")
    page.goto('http://localhost:3000')
    page.wait_for_selector('#playAdventure')
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    result = page.evaluate('''()=>{
      let steps=0;
      while(steps++<125000&&state!=='end'){
        if(state==='choice'){takeChoice(0);continue}
        if(state!=='play')break;
        player.inv=100;
        const boss=enemies.find(enemy=>enemy.boss);
        if(boss){player.x=boss.x;player.y=700}
        else{
          const target=enemies.find(enemy=>enemy.y>0&&enemy.y<550);
          if(target)player.x=target.x;
        }
        for(const drop of drops){drop.x=player.x;drop.y=player.y}
        pointer=null;moveInput={};update(1/60);
      }
      const finaleSeen=state==='sequel-finale';
      if(finaleSeen){
        Campaign.completeFinale();
        if(Coven.dawn){ambient=Coven.dawn.start+Coven.dawn.duration+.1;drawGame()}
      }
      return {
        state,clears,score,time:gameTime,xp:Journey.state.xp,
        stats:Journey.state.recent[0]?.stats,titles:Journey.state.achievements,
        finaleSeen,campaign:Campaign.progress
      };
    }''')
    assert result['state'] == 'end' and result['clears'] == 5, result
    assert result['stats']['waves'] == 25 and result['stats']['bosses'] == 5, result
    assert 'dawn' in result['titles'] and 'breaker' in result['titles'] and result['xp'] > 0, result
    assert result['stats'].get('realmEvents') == 5, result
    assert result['stats'].get('rivalEncounters') == 5, result
    assert result['finaleSeen'], result
    assert result['campaign']['world1Completed'] and result['campaign']['world2Unlocked'], result
    assert result['campaign']['cardOath'] and result['campaign']['lastWorld'] == 2, result
    assert not errors, errors
    print('Campagne technique complète :', result)
    print('OK : 25 vagues, cinq gardiens, rencontre finale, déblocage persistant, XP, objectifs et titres. Invulnérabilité de test : ne valide pas la difficulté humaine.')
    browser.close()
