"""Suite : rencontre, sauvegarde anticipée, deuxième campagne, reprise et mobile."""
import json
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
TRAINING = "(()=>{const profile=JSON.parse(localStorage.getItem('minuit-journey-v1')||'{}');localStorage.setItem('minuit-journey-v1',JSON.stringify({...profile,version:1,trainingDone:true}))})()"
CAMPAIGN = {
    'version': 1, 'world1Completed': True, 'world2Unlocked': True,
    'world2Completed': False, 'cardOath': True, 'lastWorld': 2,
    'choice': 'dawn', 'character': 'witch', 'world2Started': True,
}


def make_page(browser, errors, viewport=None, mobile=False, campaign=None):
    context = browser.new_context(
        viewport=viewport or {'width': 1440, 'height': 1000},
        is_mobile=mobile, has_touch=mobile,
    )
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.add_init_script(TRAINING)
    if campaign:
        page.add_init_script("localStorage.setItem('minuit-campaign-v1',JSON.stringify(%s))" % json.dumps(campaign))
    page.goto(URL)
    page.wait_for_selector('#playAdventure')
    return context, page


def finish_first_world(page):
    page.click('#playAdventure')
    page.wait_for_function("state==='play'")
    return page.evaluate('''()=>{
      League.event('rivalEncounters',4);League.event('rivalRepelled',4);
      stage=4;world=worlds[4];wave=5;clears=4;enemies=[];
      spawnBoss();const guardian=enemies[0];guardian.y=300;reward(guardian);
      return {
        state,score,lives,recorded,
        progress:Campaign.progress,
        stored:JSON.parse(localStorage.getItem('minuit-campaign-v1')),
        records:JSON.parse(localStorage.getItem('minuit-v2-scores')||'[]').length,
      };
    }''')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []

    # Le déblocage est écrit par reward(), avant la rencontre et avant l'aube.
    context, page = make_page(browser, errors)
    victory = finish_first_world(page)
    assert victory['state'] == 'sequel-finale' and victory['recorded'], victory
    assert victory['stored']['world1Completed'] and victory['stored']['world2Unlocked'], victory
    assert victory['stored']['cardOath'] and victory['stored']['lastWorld'] == 2, victory
    assert page.locator('#skipDawn').count() == 0 and page.locator('#skipFinale').is_visible()
    page.evaluate('ambient=Campaign.finale.start+2.3;drawGame()')
    page.click('#finaleApproach')
    choices = page.locator('[data-finale-choice]').all_inner_texts()
    assert choices == ['« Viens voir l’aube. »', '« Veille sur ceux qui restent. »'], choices
    assert 'Cinq rencontres' in page.locator('#finalePanel').inner_text()
    page.click('[data-finale-choice="night"]')
    assert page.evaluate('Campaign.progress.choice') == 'night'
    assert page.evaluate('score') == victory['score'] and page.evaluate('lives') == victory['lives']
    page.click('#finaleContinue')
    page.wait_for_selector('#skipDawn')
    page.click('#skipDawn')
    page.wait_for_selector('#enterWorld2')
    page.click('#enterWorld2')
    page.wait_for_selector('.sequel-briefing')
    assert 'trois fragments d’heure' in page.locator('.sequel-briefing').inner_text()
    page.click('#chooseHunter')
    page.wait_for_function("state==='play' && Campaign.activeWorld===2")
    second = page.evaluate('''()=>({
      world:world.name,bosses:worlds.map(item=>item.boss),runId,
      character:Campaign.progress.character,
      checkpoint:JSON.parse(localStorage.getItem('minuit-checkpoint')).campaign,
      category:difficultyName(runId)
    })''')
    assert second['world'] == 'La Ville sans ombres' and second['checkpoint'] == 2, second
    assert second['character'] == 'hunter' and second['runId'] == 'world2-normal', second
    assert second['category'].startswith('Monde 2'), second
    assert second['bosses'] == [
        'Le Lanternier blanc', 'La Reine de verre', 'Le Cerf des heures',
        'Le Contrôleur céleste', 'L’Horloger de l’Aube',
    ], second

    # Un fragment se libère en volant vers lui, puis son objectif reprend avec le checkpoint.
    fragment = page.evaluate('''()=>{
      gameTime+=3.1;update(1/60);
      const shard=Campaign.hourObjective.shards[0];
      if(!shard)return {spawned:false};
      shard.y=320;player.x=shard.x;player.y=shard.y;pointer=null;moveInput={};player.inv=100;const before=score;update(1/60);
      saveCheckpoint();
      return {spawned:true,got:Campaign.hourObjective.got,scoreGain:score-before,
        saved:JSON.parse(localStorage.getItem('minuit-checkpoint')).hourObjective.got};
    }''')
    assert fragment['spawned'] and fragment['got'] == 1 and fragment['saved'] == 1, fragment
    assert fragment['scoreGain'] > 0, fragment
    page.reload()
    page.wait_for_selector('#localResume')
    page.click('#localResume')
    page.wait_for_function("state==='play' && Campaign.activeWorld===2")
    resumed = page.evaluate('''()=>({character:Campaign.progress.character,
      got:Campaign.hourObjective.got,runId,
      campaign:JSON.parse(localStorage.getItem('minuit-checkpoint')).campaign})''')
    assert resumed == {'character': 'hunter', 'got': 1, 'runId': 'world2-normal', 'campaign': 2}, resumed

    # Rejouer le premier monde ne change jamais le point de reprise proposé au lancement.
    page.click('#pause')
    page.click('#quit')
    page.wait_for_selector('#campaignWorld1')
    page.click('#campaignWorld1')
    page.click('#playAdventure')
    page.wait_for_function("state==='play' && Campaign.activeWorld===1")
    assert page.evaluate('Campaign.progress.lastWorld') == 2
    page.reload()
    page.wait_for_selector('#campaignWorld2')
    assert page.evaluate('Campaign.menuWorld') == 2
    assert 'Continuer' in page.locator('#playAdventure').inner_text()
    assert 'Les Cinq Heures Perdues' in page.locator('.sequel-menu-subtitle').inner_text()
    assert page.locator('#localResume').count() == 1  # l'ancien vol reste seulement une reprise explicite
    context.close()

    # Fermer pendant la rencontre ne retire ni la carte ni le nouveau monde.
    context, page = make_page(browser, errors)
    finish_first_world(page)
    page.reload()
    page.wait_for_selector('#campaignWorld2')
    assert page.evaluate("Campaign.progress.world2Unlocked && Campaign.progress.cardOath && Campaign.menuWorld===2")
    page.click('#wardrobe')
    page.click('[data-grimoire-tab="collection"]')
    page.wait_for_selector('.campaign-grimoire-card.unlocked')
    assert page.locator('.campaign-grimoire-card').count() == 1
    assert 'Le Serment de l’Aube' in page.locator('.campaign-grimoire-card').inner_text()
    assert page.locator('.wardrobe-item').count() == 25  # aucun doublon et aucun objet de puissance ajouté
    exported = page.evaluate('Journey.bundle()')
    assert exported['saves']['minuit-campaign-v1']['world2Unlocked'], exported
    assert page.evaluate('(bundle)=>Journey.validate(bundle)===bundle', exported)
    context.close()

    # Les cinq mondes de la suite sont traversés par le vrai moteur, avec leurs cinq gardiens.
    context, page = make_page(browser, errors, campaign=CAMPAIGN)
    page.click('#playAdventure')
    page.wait_for_function("state==='play' && Campaign.activeWorld===2")
    result = page.evaluate('''()=>{
      const seen=new Set();let steps=0;
      while(steps++<150000&&state!=='end'){
        if(state==='choice'){takeChoice(0);continue}
        if(state!=='play')break;
        player.inv=100;
        const boss=enemies.find(enemy=>enemy.boss);
        if(boss){seen.add(boss.kind);player.x=boss.x;player.y=700}
        else{
          const target=enemies.find(enemy=>enemy.y>0&&enemy.y<550);
          if(target)player.x=target.x;
        }
        for(const drop of drops){drop.x=player.x;drop.y=player.y}
        pointer=null;moveInput={};update(1/60);
      }
      return {state,clears,seen:[...seen],progress:Campaign.progress,
        stats:Journey.state.recent[0]?.stats,
        records:JSON.parse(localStorage.getItem('minuit-v2-scores')||'[]').map(row=>row.category)};
    }''')
    assert result['state'] == 'end' and result['clears'] == 5, result
    assert set(result['seen']) == {'lanternier', 'glassqueen', 'clockstag', 'conductor', 'clockmaker'}, result
    assert result['stats']['waves'] == 25 and result['stats']['bosses'] == 5, result
    assert not result['stats'].get('rivalEncounters'), result  # le Veilleur est désormais allié
    assert result['progress']['world2Completed'] and result['progress']['lastWorld'] == 2, result
    assert 'world2-normal' in result['records'], result
    page.click('#return')
    page.wait_for_selector('.campaign-switch')
    assert '5/5 heures' in page.locator('.home-world-route').inner_text()

    # Les formats historiques restent explicitement rattachés au premier monde.
    page.click('#labMenu')
    page.wait_for_selector('#labBoss')
    assert page.evaluate('Campaign.activeWorld') == 1
    assert page.locator('#labBoss option').all_inner_texts() == [
        'Jack, le roi creux', 'Le fossoyeur éternel', 'La comtesse de minuit',
        'La tisseuse des marais', 'Le dévoreur de lanternes',
    ]
    page.click('#startLab')
    page.wait_for_function("state==='play' && Adventure.training")
    assert page.evaluate("Campaign.activeWorld===1 && world.name==='La forêt des murmures'")
    page.evaluate('Adventure.exitLab()')
    page.wait_for_selector('#weeklySprint')
    page.click('#weeklySprint')
    page.wait_for_selector('.weekly-preflight')
    assert page.evaluate('Campaign.activeWorld') == 1
    assert 'L’Horloger de l’Aube garde la fin' not in page.locator('.weekly-preflight').inner_text()
    page.click('#weeklyBack')
    page.wait_for_selector('.campaign-switch')
    context.close()

    # Le menu enrichi et la scène restent utilisables sur téléphone.
    for width, height in [(390, 844), (360, 640)]:
        context, mobile = make_page(browser, errors, {'width': width, 'height': height}, True, {**CAMPAIGN, 'world2Started': False})
        geometry = mobile.evaluate('''()=>{
          const overlay=document.querySelector('#overlay').getBoundingClientRect();
          const play=document.querySelector('#playAdventure').getBoundingClientRect();
          const flight=[...document.querySelectorAll('.menu-group')].find(node=>node.textContent.includes('TON VOL')).getBoundingClientRect();
          const visible=rect=>rect.top>=overlay.top&&rect.bottom<=overlay.bottom;
          return {width:document.documentElement.scrollWidth,play:visible(play),flight:visible(flight)};
        }''')
        assert geometry['width'] <= width and geometry['play'] and geometry['flight'], (width, geometry)
        mobile.click('#playAdventure')
        mobile.wait_for_selector('.sequel-briefing')
        assert mobile.evaluate('document.documentElement.scrollWidth') <= width
        assert mobile.locator('#chooseWitch').is_visible() and mobile.locator('#chooseHunter').is_visible()
        context.close()

    assert not errors, errors
    print('OK : sauvegarde avant cinématique, deux choix, reprise monde 2, fragments, cinq nouveaux gardiens, carte unique, export et mobile.')
    browser.close()
