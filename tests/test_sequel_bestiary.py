"""Nouvelle faune du monde 2 : objectifs, télégraphes, gardiens et non-régression."""
import json
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
CAMPAIGN = {
    'version': 1, 'world1Completed': True, 'world2Unlocked': True,
    'world2Completed': False, 'cardOath': True, 'lastWorld': 2,
    'choice': 'dawn', 'character': 'witch', 'world2Started': True,
}
TRAINING = "localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true}))"


def make_page(browser, errors, viewport=None, mobile=False):
    context = browser.new_context(viewport=viewport or {'width': 1280, 'height': 900}, is_mobile=mobile, has_touch=mobile)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.add_init_script(TRAINING)
    page.add_init_script("localStorage.setItem('minuit-campaign-v1',JSON.stringify(%s))" % json.dumps(CAMPAIGN))
    page.goto(URL)
    page.click('#playAdventure')
    page.wait_for_function("state==='play' && Campaign.activeWorld===2")
    return context, page


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    errors = []
    context, page = make_page(browser, errors)

    # Chaque univers possède deux créatures qui n'appartiennent pas au bestiaire initial.
    fauna = page.evaluate('''()=>{
      const result=[];
      for(let index=0;index<5;index++){
        stage=index;world=worlds[index];wave=1;
        const kinds=new Set();for(wave=1;wave<=4;wave++)for(const d of makeSchedule())kinds.add(d.kind);
        result.push({stage,kinds:[...kinds],expected:world.foes});
      }
      return result;
    }''')
    expected = [
        {'lampWisp', 'shadePostman'}, {'glassMite', 'sunMirror'},
        {'rootClock', 'timeLarva'}, {'railImp', 'sunLuggage'},
        {'needleWraith', 'hourHollow'},
    ]
    for index, row in enumerate(fauna):
        assert set(row['kinds']) == expected[index] == set(row['expected']), row

    # Les anciens événements, apparitions et formations ne réécrivent plus ces rencontres.
    legacy = page.evaluate('''()=>{
      wave=3;const before=scares.length;
      const surprise=Surprise.spawn();
      const event=Encounters.startEvent();
      spawnEnemy({kind:'lampWisp',x:400,group:1,index:0,pattern:0});
      const enemy=enemies[enemies.length-1];
      return {surprise,event,newScares:scares.length-before,coop:!!enemy.coop,
        custom:SequelBestiary.moveEnemy(enemy,1/60)};
    }''')
    assert legacy == {'surprise': None, 'event': False, 'newScares': 0, 'coop': False, 'custom': True}, legacy

    # Division et démantèlement : les morts changent réellement la rencontre.
    splits = page.evaluate('''()=>{
      enemies=[];hostile=[];wave=1;stage=1;world=worlds[1];
      spawnEnemy({kind:'glassMite',x:300,y:250,group:70,index:0});const mite=enemies[0];reward(mite);
      const glass=enemies.filter(e=>!e.dead).map(e=>e.kind);
      enemies=[];spawnEnemy({kind:'sunLuggage',x:400,y:250,group:71,index:0});reward(enemies[0]);
      return {glass,luggage:enemies.filter(e=>!e.dead).map(e=>e.kind)};
    }''')
    assert splits['glass'] == ['glassShard', 'glassShard'], splits
    assert splits['luggage'] == ['railImp', 'railImp'], splits

    # Même avec un minuteur épuisé hors terrain, l'entrée laisse le temps de lire le halo.
    entrance = page.evaluate('''()=>{
      stage=0;world=worlds[0];wave=1;enemies=[];hostile=[];
      spawnEnemy({kind:'lampWisp',x:400,y:-35,group:70,index:0});const foe=enemies[0];foe.fire=0;
      SequelBestiary.moveEnemy(foe,1/60);const armed=foe.fire;foe.y=120;SequelBestiary.moveEnemy(foe,.1);
      return {armed,shots:hostile.length,remaining:foe.fire};
    }''')
    assert entrance['armed'] >= .7 and entrance['shots'] == 0 and entrance['remaining'] > 0, entrance

    # Les vagues 2, 3 et 4 ne se résolvent plus par la seule élimination de la salve initiale.
    objectives = page.evaluate('''()=>{
      stage=0;world=worlds[0];enemies=[];hostile=[];wave=2;newWave();
      const captives=SequelBestiary.captives.length,blocked=SequelBestiary.waveBlocks();
      for(const c of SequelBestiary.captives){player.x=c.x;player.y=c.y;player.inv=100;update(1/60)}
      const rescued=SequelBestiary.mission.rescued,unblocked=!SequelBestiary.waveBlocks();
      wave=3;newWave();waveTime=17;const survivalEarly=SequelBestiary.waveBlocks();waveTime=22;const survivalLate=!SequelBestiary.waveBlocks();
      wave=4;newWave();const anchors=enemies.filter(e=>e.kind==='riftAnchor').length;
      return {captives,blocked,rescued,unblocked,survivalEarly,survivalLate,anchors};
    }''')
    assert objectives == {'captives': 2, 'blocked': True, 'rescued': 2, 'unblocked': True,
                          'survivalEarly': True, 'survivalLate': True, 'anchors': 2}, objectives

    # Les cinq duos ont une interaction réelle, interrompue quand le support est détruit.
    duos = page.evaluate('''()=>{
      const specs=[['lampWisp','shadePostman','echo'],['sunMirror','glassMite','prism'],
        ['rootClock','timeLarva','root'],['sunLuggage','railImp','beam'],['hourHollow','needleWraith','hand']];
      const result=[];player.inv=1000;
      for(let index=0;index<specs.length;index++){
        const [supportKind,followerKind,type]=specs[index];stage=index;world=worlds[index];wave=1;
        enemies=[];hostile=[];drops=[];SequelBestiary.effects.length=0;
        spawnEnemy({kind:supportKind,x:300,y:250,group:70,index:0});const support=enemies[0];
        spawnEnemy({kind:followerKind,x:380,y:250,group:70,index:1});const follower=enemies[1];follower.fire=0;
        SequelBestiary.moveEnemy(follower,1/60);const effect=SequelBestiary.effects.find(item=>item.type===type);
        const linked=follower.seqLink===support,sourced=effect?.source===support,cancel=!!effect?.cancelOnDeath;
        reward(support);hostile=[];SequelBestiary.tick(2);
        result.push({type,linked,sourced,cancel,cancelled:!SequelBestiary.effects.some(item=>item.type===type),shots:hostile.length});
      }
      return result;
    }''')
    for index, row in enumerate(duos):
        assert row['linked'] and row['sourced'] and row['cancel'] and row['cancelled'] and row['shots'] == 0, (index, row)

    # Une valise blessée libère un premier contrôleur, puis seulement le dernier à sa destruction.
    luggage = page.evaluate('''()=>{
      stage=3;world=worlds[3];wave=1;enemies=[];hostile=[];drops=[];
      spawnEnemy({kind:'sunLuggage',x:400,y:300,group:70,index:0});const caseEnemy=enemies[0];
      caseEnemy.hp=caseEnemy.max*.5;SequelBestiary.moveEnemy(caseEnemy,1/60);
      const opened=caseEnemy.seqOpened,early=enemies.filter(e=>e.kind==='railImp'&&!e.dead).length;
      reward(caseEnemy);return {opened,early,total:enemies.filter(e=>e.kind==='railImp'&&!e.dead).length};
    }''')
    assert luggage == {'opened': True, 'early': 1, 'total': 2}, luggage

    # Cinq gardiens, cinq langages d'attaque. Aucun tir générique n'est émis au déclenchement.
    bosses = page.evaluate('''()=>{
      const result=[];player.inv=1000;
      for(let index=0;index<5;index++){
        stage=index;world=worlds[index];wave=5;enemies=[];hostile=[];schedule=[];hazards=[];gates=[];obstacles=[];
        SequelBestiary.effects.length=0;spawnBoss();const boss=enemies.find(e=>e.boss);
        boss.y=200;boss.phaseShield=0;boss.fire=99;SequelBestiary.attack(boss);
        result.push({kind:boss.kind,effects:SequelBestiary.effects.map(e=>({type:e.type,warn:e.warn,age:e.age})),
          shots:hostile.length,charge:!!boss.charge,minions:enemies.filter(e=>!e.boss).map(e=>e.kind)});
      }
      return result;
    }''')
    signatures = [
        {'safeLight'}, {'beam'}, {'echo'}, {'train'}, {'freeze', 'hand'},
    ]
    for index, row in enumerate(bosses):
        assert {effect['type'] for effect in row['effects']} == signatures[index], row
        assert row['shots'] == 0 and not row['charge'], row
        assert all(effect['warn'] >= 1.45 and effect['age'] == 0 for effect in row['effects']), row
    assert bosses[1]['minions'] == ['mirrorClone', 'mirrorClone'], bosses[1]

    # Briser un miroir supprime bien un rayon, pas seulement un décor.
    mirror = page.evaluate('''()=>{
      stage=1;world=worlds[1];wave=5;enemies=[];hostile=[];SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;SequelBestiary.attack(boss);
      const clone=enemies.find(e=>e.kind==='mirrorClone');reward(clone);SequelBestiary.effects.length=0;
      boss.cycle=2;SequelBestiary.attack(boss);
      return {clones:enemies.filter(e=>e.kind==='mirrorClone'&&!e.dead).length,
        beams:SequelBestiary.effects.filter(e=>e.type==='beam').length};
    }''')
    assert mirror == {'clones': 1, 'beams': 1}, mirror

    # En phase finale, deux convois laissent toujours une troisième voie libre.
    lanes = page.evaluate('''()=>{
      stage=3;world=worlds[3];wave=5;enemies=[];hostile=[];SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.phase=3;boss.hp=boss.max*.3;
      SequelBestiary.attack(boss);return SequelBestiary.effects.filter(e=>e.type==='train').map(e=>e.y).sort((a,b)=>a-b);
    }''')
    assert len(lanes) == 2 and len(set(lanes)) == 2, lanes

    # Le train télégraphié blesse bien la sorcière qui reste sur sa voie.
    train = page.evaluate('''()=>{
      stage=3;world=worlds[3];wave=5;enemies=[];hostile=[];hazards=[];gates=[];obstacles=[];scares=[];drops=[];
      routeTimer=999;obstacleTimer=999;scareTimer=999;SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.fire=99;player.inv=0;player.shield=0;player.shieldTime=0;player.dash=0;lives=3;
      SequelBestiary.attack(boss);const convoy=SequelBestiary.effects.find(e=>e.type==='train');player.x=400;player.y=convoy.y;
      for(let i=0;i<100;i++)update(1/60);const before=lives;
      for(let i=0;i<85;i++)update(1/60);
      return {before,after:lives,cause:lastDamage};
    }''')
    assert train['before'] == 3 and train['after'] == 2 and 'convoi' in train['cause'], train

    # Le blackout blesse hors du halo après — et seulement après — son avertissement.
    blackout = page.evaluate('''()=>{
      stage=0;world=worlds[0];wave=5;enemies=[];hostile=[];hazards=[];gates=[];obstacles=[];scares=[];drops=[];
      routeTimer=999;obstacleTimer=999;scareTimer=999;SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.fire=99;player.inv=0;player.shield=0;player.shieldTime=0;player.dash=0;lives=3;
      SequelBestiary.attack(boss);const halo=SequelBestiary.effects[0];player.x=halo.x<400?780:20;player.y=800;
      for(let i=0;i<120;i++)update(1/60);const before=lives;
      for(let i=0;i<30;i++)update(1/60);
      return {before,after:lives,cause:lastDamage,warn:halo.warn};
    }''')
    assert blackout['before'] == 3 and blackout['after'] == 2 and 'blackout' in blackout['cause'], blackout

    # L'arrêt du temps fige position ET durée de vie des projectiles, sans figer le pilotage.
    frozen = page.evaluate('''()=>{
      stage=4;world=worlds[4];wave=5;enemies=[];hostile=[];hazards=[];gates=[];obstacles=[];SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.fire=99;player.inv=1000;
      SequelBestiary.attack(boss);shootHostile({x:100,y:100},'spirit',[0],100,0);
      for(let i=0;i<102;i++)update(1/60);const shot=hostile[0],before={x:shot.x,y:shot.y,life:shot.life,px:player.x};
      for(let i=0;i<30;i++)update(1/60);
      return {frozen:SequelBestiary.timeFrozen,before,after:{x:shot.x,y:shot.y,life:shot.life,px:player.x}};
    }''')
    assert frozen['frozen'] and frozen['before'] == frozen['after'], frozen

    # Les phases avancées changent de règle, pas seulement de densité.
    advanced = page.evaluate('''()=>{
      function setup(index,phase,cycle=0){
        stage=index;world=worlds[index];wave=5;enemies=[];hostile=[];drops=[];SequelBestiary.effects.length=0;
        spawnBoss();const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.fire=99;
        boss.phase=phase;boss.hp=boss.max*(phase===2?.5:phase===3?.25:1);boss.cycle=cycle;SequelBestiary.attack(boss);return boss;
      }
      setup(0,2);const mobile=SequelBestiary.effects.find(e=>e.type==='safeLight');
      setup(0,3);const eclipse=SequelBestiary.effects.find(e=>e.type==='safeLight');
      setup(1,2);const reflected=SequelBestiary.effects.filter(e=>e.type==='beam');
      setup(1,3);const cage=SequelBestiary.effects.filter(e=>e.type==='beam');
      setup(2,3);const path=SequelBestiary.effects.find(e=>e.type==='path');
      setup(3,3,1);const crossing=SequelBestiary.effects.filter(e=>e.type==='train');
      setup(4,2,1);const rewind=SequelBestiary.effects.find(e=>e.type==='rewind');
      setup(4,3);const hands=SequelBestiary.effects.filter(e=>e.type==='hand');
      return {mobile:{vx:mobile.vx,sustained:mobile.sustained},eclipse:{shrink:eclipse.shrink},
        reflected:reflected.map(e=>!!Number.isFinite(e.x3)),cage:cage.length,path:path.points.length,
        crossing:crossing.map(e=>!!e.vertical),rewind:rewind.warn,hands:hands.map(e=>e.spin)};
    }''')
    assert advanced['mobile']['vx'] != 0 and advanced['mobile']['sustained'], advanced
    assert advanced['eclipse']['shrink'] > 0, advanced
    assert advanced['reflected'] == [True, True] and advanced['cage'] == 3, advanced
    assert advanced['path'] == 4 and sorted(advanced['crossing']) == [False, True], advanced
    assert advanced['rewind'] >= 1.6 and len(advanced['hands']) == 2 and all(advanced['hands']), advanced

    # Le rembobinage inverse réellement la trajectoire des projectiles.
    reversed_shot = page.evaluate('''()=>{
      stage=4;world=worlds[4];wave=5;enemies=[];hostile=[];drops=[];hazards=[];gates=[];obstacles=[];SequelBestiary.effects.length=0;
      spawnBoss();const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.fire=99;boss.phase=2;boss.hp=boss.max*.5;boss.cycle=1;
      player.inv=1000;SequelBestiary.attack(boss);shootHostile({x:100,y:100},'spirit',[0],100,0);
      for(let i=0;i<102;i++)update(1/60);const shot=hostile[0],before={x:shot.x,y:shot.y};
      for(let i=0;i<30;i++)update(1/60);
      return {reversing:SequelBestiary.timeReversing,before,after:{x:shot.x,y:shot.y}};
    }''')
    assert reversed_shot['reversing'] and reversed_shot['after']['x'] < reversed_shot['before']['x'], reversed_shot

    # Le premier monde repasse par son contrôleur historique, avec sa salve citrouille.
    classic = page.evaluate('''()=>{
      Campaign.useClassicWorld();stage=0;world=worlds[0];wave=5;enemies=[];hostile=[];SequelBestiary.effects.length=0;
      spawnEnemy({kind:'ghost',x:400,y:200,group:0,index:0,pattern:0});const ghost=enemies[0];
      const custom=SequelBestiary.moveEnemy(ghost,1/60);enemies=[];spawnBoss();const boss=enemies[0];
      boss.y=200;boss.phaseShield=0;boss.fire=0;bossAttack(boss,1/60);
      return {custom,kind:boss.kind,shots:hostile.length,campaign:Campaign.activeWorld,display:SequelBestiary.bossDisplayName(boss)};
    }''')
    assert classic['campaign'] == 1 and not classic['custom'] and classic['kind'] == 'pumpkin' and classic['shots'] > 0 and classic['display'] is None, classic
    context.close()

    # Sur téléphone, les instructions restent compactes et les avertissements ont la même durée.
    context, mobile = make_page(browser, errors, {'width': 390, 'height': 844}, True)
    mobile_result = mobile.evaluate('''()=>{
      stage=1;world=worlds[1];wave=5;enemies=[];hostile=[];SequelBestiary.effects.length=0;spawnBoss();
      const boss=enemies.find(e=>e.boss);boss.y=200;boss.phaseShield=0;boss.fire=99;SequelBestiary.attack(boss);
      for(let i=0;i<20;i++)update(1/60);drawGame();
      return {width:document.documentElement.scrollWidth,mode:document.getElementById('modeLabel').textContent,
        warnings:SequelBestiary.effects.map(e=>e.warn),mirrors:enemies.filter(e=>e.kind==='mirrorClone').length,display:SequelBestiary.bossDisplayName(boss)};
    }''')
    assert mobile_result['width'] <= 390 and mobile_result['mirrors'] == 2 and mobile_result['display'] == 'Reine de verre', mobile_result
    assert mobile_result['mode'].startswith('Miroirs ·'), mobile_result
    assert all(value >= 1.45 for value in mobile_result['warnings']), mobile_result
    context.close()

    assert not errors, errors
    print('OK : 10 créatures, 5 duos destructibles, objectifs, phases avancées, blackout, trains, gel/rembobinage, mobile et monde 1.')
    browser.close()
