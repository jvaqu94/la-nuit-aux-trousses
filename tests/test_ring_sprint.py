"""Course aux bonbons : voies, chapelets, obstacles, scores et isolation de la campagne."""
import json
from playwright.sync_api import sync_playwright

URL = 'http://localhost:3000'
TRAINED = "localStorage.setItem('minuit-journey-v1',JSON.stringify({version:1,trainingDone:true,xp:0}))"
SESSION = TRAINED + """;localStorage.setItem('minuit-supabase-session-v1',JSON.stringify({
  access_token:'test-access',refresh_token:'test-refresh',expires_at:Date.now()/1000+3600,
  user:{id:'test-user',displayName:'Sorcière Test'}}));"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1100, 'height': 800})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script(TRAINED)
    page.add_init_script("localStorage.setItem('minuit-broom-sprint-v1',JSON.stringify({version:1,weeks:{legacy:{best:{score:9999}}}}));localStorage.setItem('minuit-candy-sprint-v1',JSON.stringify({version:1,weeks:{legacy:{best:{score:8888}}}}));localStorage.setItem('minuit-candy-sprint-v2',JSON.stringify({version:1,weeks:{legacy:{best:{score:7777}}}}));localStorage.setItem('minuit-candy-sprint-v3',JSON.stringify({version:1,stars:9,cosmetic:'moon',weeks:{legacy:{best:{score:6666}}}}));localStorage.setItem('minuit-candy-sprint-v4',JSON.stringify({version:1,stars:18,cosmetic:'violet',weeks:{legacy:{best:{score:5555}}}}))")
    page.goto(URL);page.wait_for_selector('#weeklySprint');page.click('#weeklySprint')
    assert 'trois voies' in page.locator('.weekly-preflight').inner_text().lower()
    page.click('#weeklyLaunch');page.wait_for_function('WeeklySprint.active')
    # Le rendu utilise les ressources originales et non des personnages/décors factices.
    page.evaluate("""()=>{
      window.__runnerArt={background:0,witch:0,candy:0,crate:0,stone:0,wood:0};
      const image=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(img,...args){if(WeeklySprint.active&&img.src?.includes('/scenery/')){if(img.src.includes('runner-stone'))window.__runnerArt.stone++;else if(img.src.includes('runner-wood'))window.__runnerArt.wood++;else if(!img.src.includes('/flight-'))window.__runnerArt.background++}return image.call(this,img,...args)};
      const old=sprite;sprite=function(g,kind,...args){if(WeeklySprint.active&&kind==='witch')window.__runnerArt.witch++;return old(g,kind,...args)};
      const crate=drawObstacle;drawObstacle=function(g,o,...args){if(WeeklySprint.active&&o.kind==='crate')window.__runnerArt.crate++;return crate(g,o,...args)};
      const candy=CollectibleArt.draw;CollectibleArt.draw=function(g,name,...args){if(WeeklySprint.active&&name==='xp')window.__runnerArt.candy++;return candy(g,name,...args)};
    }""")
    page.wait_for_function("__runnerArt.background>0&&__runnerArt.witch>0&&__runnerArt.candy>0&&__runnerArt.crate>0&&__runnerArt.stone>0&&__runnerArt.wood>0&&MinuitScenery[stage].naturalWidth>0")
    for name in ['forest','cemetery','castle','runner-stone-texture','runner-wood-texture']:
        assert page.request.get(URL+'/scenery/'+name+'.jpg').status==200
    # La projection des volumes dépend de la distance ET de la hauteur.
    perspective=page.evaluate("""()=>{const d=WeeklySprint.course.distance,p=WeeklySprint.scenePoint;
      return {far:p(2,0,d+1800),farTop:p(2,200,d+1800),near:p(2,0,d+400),nearTop:p(2,200,d+400)};}""")
    assert perspective['near'][0]>perspective['far'][0]>400
    assert perspective['near'][1]>perspective['far'][1]
    assert perspective['near'][1]-perspective['nearTop'][1]>perspective['far'][1]-perspective['farTop'][1]>0
    # Les objets du parcours ont bien des faces projetées en plus du décor.
    meshes=page.evaluate("""()=>{const c=WeeklySprint.course,saved=c.objects,original=ctx.fill;let fills=0;
      ctx.fill=function(...args){fills++;return original.apply(this,args)};
      const render=(objects)=>{c.objects=objects;fills=0;drawGame();return fills};
      try{const base=render([]),at=c.distance+600;
        return {candy:render([{kind:'candy',lane:0,at}])-base,wall:render([{kind:'wall',lane:1,at}])-base};
      }finally{c.objects=saved;ctx.fill=original}
    }""")
    assert meshes['candy']>=50 and meshes['wall']>=3,meshes
    # Les abords changent au fil du chemin, sans modifier les collisions.
    assert page.evaluate("new Set(Array.from({length:9},(_,i)=>WeeklySprint.sceneTheme(i*6480))).size===3")
    # Les trois mondes ont tous un décor fonctionnel.
    page.evaluate("""()=>{const previous=stage,oldWorld=world;for(const n of [0,1,2]){stage=n;world=worlds[n];drawGame()}stage=previous;world=oldWorld;}""")
    before=page.evaluate("""()=>({week:WeeklySprint.config.week,seed:WeeklySprint.config.seed,
      rows:Array.from({length:96},(_,i)=>WeeklySprint.courseRow(WeeklySprint.config,i)),
      xp:Journey.state.xp,recent:Journey.state.recent.length,records:records.length,
      ranked:LocalLeague.dayState().rankedUsed,daily:LocalLeague.dayState().dailyUsed,
      standard:Journey.run.combat.standard,transient:Journey.run.transient})""")
    assert page.evaluate("Object.keys(WeeklySprint.data.weeks).length===1 && !WeeklySprint.data.weeks.legacy")
    assert page.evaluate("WeeklySprint.data.stars===18 && WeeklySprint.data.cosmetic==='violet'")
    assert before['standard'] and before['transient']
    assert before['xp']==before['recent']==before['records']==before['ranked']==before['daily']==0
    rows=before['rows']
    assert all(abs(a['candyLane']-b['candyLane'])<=1 for a,b in zip(rows,rows[1:]))
    assert all(sum(row['kind']==kind for row in rows)>=3 for kind in ['stump','pumpkin','arch','branch','ghost','gap'])
    assert sum(row['kind']=='shooter' and not row['corridor'] for row in rows)>=5
    assert sum(row['kind']=='gap' for row in rows)>=10
    assert sum(row['corridor'] for row in rows)>=25 and sum(not row['corridor'] for row in rows)>=50
    assert all(len(row['paths'])==1 if row['corridor'] else len(row['paths'])==2 for row in rows)
    # Les murs sont réservés aux couloirs ; les portions libres proposent deux
    # chapelets et la voie la plus riche porte l'obstacle.
    assert page.evaluate("""()=>{const c=WeeklySprint.course;return c.gates.length>0&&c.gates.every(g=>{
      const objects=c.objects.filter(o=>o.at===g.at),walls=objects.filter(o=>o.kind==='wall');
      return walls.length===2&&new Set(walls.map(o=>o.lane)).size===2&&
        walls.every(o=>o.lane!==g.lane)&&objects.some(o=>o.kind==='candy'&&o.lane===g.lane);
    })&&c.objects.some(o=>o.kind==='candy'&&!c.gates.some(g=>g.at===o.at))}""")
    hazards=page.evaluate("""()=>{const c=WeeklySprint.course,bonus=c.objects.filter(o=>o.kind==='candy'&&o.require);
      return {jump:bonus.filter(o=>o.require==='jump').length,duck:bonus.filter(o=>o.require==='duck').length,
        attached:bonus.every(b=>c.objects.some(o=>o.at===b.at&&o.lane===b.lane&&
         (b.require==='jump'?['stump','pumpkin','gap'].includes(o.kind):['arch','branch'].includes(o.kind)))),
        shots:c.objects.filter(o=>o.kind==='projectile').length,enemies:c.objects.filter(o=>o.kind==='shooter').length,
        ordered:c.gates.every((g,i)=>!i||g.at>=c.gates[i-1].at),
        shotsOpen:c.objects.filter(o=>o.kind==='projectile').every(p=>!c.gates.some(g=>g.at===p.at))};
    }""")
    assert hazards['jump']>0 and hazards['duck']>0 and hazards['attached'] and hazards['shots']>0 and hazards['shots']==hazards['enemies'] and hazards['ordered'] and hazards['shotsOpen'],hazards
    assert page.evaluate("WeeklySprint.course.objects.every(o=>o.kind!=='ring')")
    # Les deux voies libres, les transitions et les fenêtres de réaction sont
    # vérifiées sur 100 parcours hebdomadaires différents.
    assert page.evaluate("""()=>{
      const signatures=new Set();
      for(let seed=0;seed<100;seed++){
        const rows=Array.from({length:96},(_,i)=>WeeklySprint.courseRow({seed},i));
        signatures.add(rows.map(r=>r.candyLane+':'+r.kind).join(','));
        const obstacles=rows.filter(r=>r.kind).map(r=>r.at+540);
        for(let i=0;i<rows.length;i++){
          const r=rows[i];
          if(i&&Math.abs(r.candyLane-rows[i-1].candyLane)>1)return false;
          if(i&&r.at-rows[i-1].at!==1080)return false;
          if(r.corridor){
            if(r.paths.length!==1||r.paths[0].lane!==r.candyLane)return false;
            if(r.kind&&r.paths[0].offsets.some(o=>Math.abs(o-540)<360))return false;
            if(i&&i%2===0&&!rows[i-1].corridor&&r.offsets[0]<720)return false;
          }else{
            if(r.paths.length!==2||r.riskyLane===r.candyLane||Math.abs(r.riskyLane-r.candyLane)>1)return false;
            if(r.paths[1].offsets.length<=r.paths[0].offsets.length)return false;
            if(r.kind&&r.paths[1].offsets.some(o=>Math.abs(o-540)<360))return false;
          }
        }
        if(obstacles.some((o,i)=>i&&o-obstacles[i-1]<1800))return false;
        const layout=WeeklySprint.buildCourse({seed}),shots=layout.objects.filter(o=>o.kind==='projectile'),shooters=layout.objects.filter(o=>o.kind==='shooter');
        const gaps=layout.objects.filter(o=>o.kind==='gap');
        if(shots.length<5||shooters.length!==shots.length||gaps.length<10)return false;
        if(shots.filter(o=>o.at<94500).length<4||gaps.filter(o=>o.at<94500).length<10)return false;
        if(new Set(shooters.map(o=>o.monster)).size<3)return false;
        if(shots.some(shot=>layout.gates.some(g=>g.at===shot.at)))return false;
        const targets=shots.map(shot=>{const row=rows.find(r=>r.at+540===shot.at);return shot.lane===row.candyLane?'safe':shot.lane===row.riskyLane?'rich':'invalid'});
        if(!targets.includes('safe')||!targets.includes('rich')||targets.includes('invalid'))return false;
      }
      return signatures.size>90;
    }""")
    page.evaluate('WeeklySprint.start()')
    assert page.evaluate("JSON.stringify(Array.from({length:96},(_,i)=>WeeklySprint.courseRow(WeeklySprint.config,i)))") == json.dumps(before['rows'],separators=(',',':'),ensure_ascii=False)

    # Choisir la voie risquée rapporte réellement plus sur la même section ;
    # le saut évite l'obstacle et chaque bonbon vaut toujours un seul point.
    choice=page.evaluate("""()=>{
      function run(risky){WeeklySprint.start();const c=WeeklySprint.course,r=WeeklySprint.courseRow(WeeklySprint.config,0);
        c.lane=c.lanePos=risky?r.riskyLane:r.candyLane;
        for(let i=0;i<600&&c.distance<2705;i++){
          const o=c.objects.find(o=>o.kind==='stump'&&o.at>c.distance&&o.at-c.distance<c.speed*.4&&o.lane===c.lane);
          if(o&&!c.actionTime){c.action='jump';c.actionTime=.8}update(1/60);
        }return {candies:c.candies,score,collisions:c.collisions};
      }return {safe:run(false),risky:run(true)};
    }""")
    assert choice['safe']['score']==choice['safe']['candies'] and choice['risky']['score']==choice['risky']['candies']
    assert choice['safe']['collisions']==choice['risky']['collisions']==0 and choice['risky']['candies']>choice['safe']['candies'],choice
    page.evaluate('WeeklySprint.start()')

    # Accélération continue et même ralentissement temporaire lors des collisions.
    speeds=page.evaluate("""()=>{const c=WeeklySprint.course;c.objects=[];c.gates=[];const values=[];
      for(const t of [0,30,60,89]){gameTime=t;update(1/60);values.push(c.speed)}
      c.slow=1;update(1/60);values.push(c.speed);return values}""")
    assert 700 <= speeds[0] < speeds[1] < speeds[2] < speeds[3] < 1401, speeds
    assert abs(speeds[4]-speeds[3]*.7)<.1,speeds
    page.evaluate('WeeklySprint.start()')
    assert page.evaluate("WeeklySprint.course.objects.filter(o=>o.kind==='candy').length")>=280

    # Flèches : voie bornée, animation progressive, saut et glissade.
    page.keyboard.press('ArrowLeft');page.wait_for_function('WeeklySprint.course.lanePos<-.8')
    lane=page.evaluate('({lane:WeeklySprint.course.lane,pos:WeeklySprint.course.lanePos})')
    assert lane['lane']==-1 and lane['pos'] < -.8, lane
    page.keyboard.press('ArrowLeft');assert page.evaluate('WeeklySprint.course.lane')==-1
    page.keyboard.press('ArrowRight');assert page.evaluate('WeeklySprint.course.lane')==0
    page.keyboard.press('ArrowUp');assert page.evaluate("WeeklySprint.course.action==='jump'")
    page.wait_for_function('WeeklySprint.course.actionTime===0');page.keyboard.press('ArrowDown');assert page.evaluate("WeeklySprint.course.action==='duck'")

    # À la souris : survol des trois zones et clic gauche/droit, sans clavier.
    rect=page.locator('#game').bounding_box()
    y=rect['y']+rect['height']*.55
    page.mouse.move(rect['x']+rect['width']*.12,y)
    assert page.evaluate('WeeklySprint.course.lane')==-1
    page.mouse.move(rect['x']+rect['width']*.88,y)
    assert page.evaluate('WeeklySprint.course.lane')==1
    page.mouse.move(rect['x']+rect['width']*.5,y)
    assert page.evaluate('WeeklySprint.course.lane')==0
    page.evaluate("WeeklySprint.course.actionTime=0;WeeklySprint.course.action=''")
    page.mouse.click(rect['x']+rect['width']*.5,y,button='left')
    assert page.evaluate("WeeklySprint.course.action==='jump'")
    page.evaluate("WeeklySprint.course.actionTime=0;WeeklySprint.course.action=''")
    page.mouse.click(rect['x']+rect['width']*.5,y,button='right')
    assert page.evaluate("WeeklySprint.course.action==='duck'")

    # Les vraies entrées clavier et souris permettent de repartir d'un mur.
    for method in ('keyboard','mouse'):
        target=page.evaluate("""()=>{const c=WeeklySprint.course,g=c.gates.find(g=>g.at>c.distance+30&&c.objects.some(o=>o.kind==='candy'&&!o.require&&o.at===g.at)),bad=g.lane===0?-1:0;
          c.distance=g.at-1;c.lane=bad;c.lanePos=bad;c.inv=0;c.slow=0;return {lane:g.lane,bad,count:c.candies};}""")
        page.wait_for_function('WeeklySprint.course.blocked')
        if method=='keyboard':
            page.keyboard.press('ArrowLeft' if target['lane']<target['bad'] else 'ArrowRight')
        else:
            rect=page.locator('#game').bounding_box()
            page.mouse.move(rect['x']+rect['width']*((target['lane']+1)*.34+.16),rect['y']+rect['height']*.55)
        page.wait_for_function('(count)=>!WeeklySprint.course.blocked&&WeeklySprint.course.candies>count',arg=target['count'])

    # Dans une clairière, une vraie commande permet de contourner le fantôme.
    page.evaluate("""()=>{const c=WeeklySprint.course;c.objects=[{kind:'ghost',lane:0,at:c.distance+240}];
      c.gates=[];c.lane=0;c.lanePos=0;c.inv=0;c.slow=0;c.action='';c.actionTime=0;c.collisions=0;}""")
    page.keyboard.press('ArrowLeft')
    page.wait_for_function("WeeklySprint.course.objects[0].done")
    assert page.evaluate('WeeklySprint.course.collisions')==0
    page.evaluate('WeeklySprint.start()')

    # Un mur bloque vraiment la progression, même pendant un saut ou une glissade.
    # Le bonbon reste à ramasser et le chrono continue ; la voie correcte débloque.
    gate=page.evaluate("""()=>{const c=WeeklySprint.course,g=c.gates.find(g=>g.at>c.distance&&c.objects.some(o=>o.kind==='candy'&&!o.require&&o.at===g.at));
      const bad=g.lane===0?-1:0;c.distance=g.at-1;c.lane=bad;c.lanePos=bad;c.inv=0;c.slow=0;
      const count=c.candies,t=gameTime;c.action='jump';c.actionTime=.5;update(.02);
      const jumpBlocked=c.blocked&&c.distance<g.at&&c.candies===count;
      const stoppedAt=c.distance;c.action='duck';c.actionTime=.5;update(.02);
      const duckBlocked=c.blocked&&c.distance===stoppedAt&&c.candies===count;
      const timerAdvanced=gameTime>t;c.lane=g.lane;c.lanePos=g.lane;update(.02);
      return {jumpBlocked,duckBlocked,timerAdvanced,released:!c.blocked&&c.distance>g.at&&c.candies===count+1};
    }""")
    assert gate=={'jumpBlocked':True,'duckBlocked':True,'timerAdvanced':True,'released':True},gate

    # Les bonbons spéciaux ne sont pris que si le geste franchit réellement
    # l'obstacle : pas de point gratuit au sol ou avec le mauvais geste.
    special=page.evaluate("""()=>{const c=WeeklySprint.course;
      function attempt(kind,require,action,time,lane=0){c.gates=[];c.distance=500;c.lane=c.lanePos=lane;c.inv=0;c.slow=0;c.action=action;c.actionTime=time;c.collisions=0;c.candies=0;score=0;
        c.objects=[{at:501,lane:0,kind:'candy',require},{at:501,lane:0,kind}];update(.01);
        return {score,collisions:c.collisions};}
      return {gapFail:attempt('gap','jump','',0),gapJump:attempt('gap','jump','jump',.5),
        crateFail:attempt('stump','jump','duck',.5),crateJump:attempt('stump','jump','jump',.5),
        archFail:attempt('arch','duck','jump',.5),archDuck:attempt('arch','duck','duck',.5),
        otherLane:attempt('arch','duck','duck',.5,1)};
    }""")
    assert special=={'gapFail':{'score':0,'collisions':1},'gapJump':{'score':1,'collisions':0},
        'crateFail':{'score':0,'collisions':1},'crateJump':{'score':1,'collisions':0},
        'archFail':{'score':0,'collisions':1},'archDuck':{'score':1,'collisions':0},'otherLane':{'score':0,'collisions':0}},special
    shots=page.evaluate("""()=>{const c=WeeklySprint.course;
      function pass(lane){c.gates=[];c.distance=500;c.lane=c.lanePos=lane;c.inv=0;c.slow=0;c.collisions=0;c.objects=[{kind:'projectile',lane:0,enemyLane:1.85,at:501}];update(.01);return {collisions:c.collisions,done:c.objects[0].done};}
      return {hit:pass(0),dodge:pass(1)};
    }""")
    assert shots=={'hit':{'collisions':1,'done':True},'dodge':{'collisions':0,'done':True}},shots
    # Le rendu de toutes les nouvelles formes ne doit pas émettre d'erreur.
    page.evaluate("""()=>{const c=WeeklySprint.course,d=c.distance;c.objects=[{kind:'gap',lane:-1,at:d+500},
      {kind:'candy',lane:-1,require:'jump',at:d+500},{kind:'arch',lane:0,at:d+500},
      {kind:'candy',lane:0,require:'duck',at:d+500},{kind:'shooter',lane:1.85,at:d+1025},
      {kind:'projectile',lane:1,enemyLane:1.85,at:d+500}];drawGame()}""")
    page.evaluate('WeeklySprint.start()')

    motion=page.evaluate("""()=>{const c=WeeklySprint.course,saved=c.distance,o={at:3000,lane:0,enemyLane:1.85};
      c.distance=1499;const before=WeeklySprint.projectilePosition(o);
      c.distance=1500;const start=WeeklySprint.projectilePosition(o);
      c.distance=2500;const mid=WeeklySprint.projectilePosition(o);
      c.distance=3000;const end=WeeklySprint.projectilePosition(o);
      c.distance=saved;return {before,start,mid,end};
    }""")
    assert motion['before'] is None and motion['start']['lane']==1.85 and motion['end']['lane']==0
    assert motion['start']['z']>motion['mid']['z']>motion['end']['z'] and 0<motion['mid']['lane']<1.85
    # Les véritables touches du clavier déclenchent le saut/la glissade assez
    # tôt pour attraper le bonbon, puis permettent d'esquiver un tir.
    for kind,require,key in [('gap','jump','ArrowUp'),('arch','duck','ArrowDown')]:
        page.evaluate("""({kind,require})=>{const c=WeeklySprint.course;c.gates=[];c.lane=c.lanePos=0;c.inv=0;c.slow=0;c.action='';c.actionTime=0;c.candies=0;c.collisions=0;score=0;
          const at=c.distance+280;c.objects=[{at,lane:0,kind:'candy',require},{at,lane:0,kind}];}""",{'kind':kind,'require':require})
        page.keyboard.press(key);page.wait_for_function('WeeklySprint.course.objects[0].done')
        assert page.evaluate('WeeklySprint.course.candies===1&&WeeklySprint.course.collisions===0')
    page.evaluate("""()=>{const c=WeeklySprint.course;c.gates=[];c.lane=c.lanePos=0;c.inv=0;c.slow=0;c.collisions=0;
      c.objects=[{kind:'projectile',lane:0,enemyLane:1.85,at:c.distance+350}]}""")
    page.keyboard.press('ArrowRight');page.wait_for_function('WeeklySprint.course.objects[0].done')
    assert page.evaluate('WeeklySprint.course.collisions===0&&WeeklySprint.course.objects[0].fired')
    page.evaluate('WeeklySprint.start()')

    # Validation au point de passage : bonne voie, saut, glissade et collision.
    values=page.evaluate("""()=>{
      const c=WeeklySprint.course;c.objects=[];c.gates=[];c.lane=0;c.lanePos=0;c.inv=0;c.slow=0;c.action='';c.actionTime=0;c.candies=0;c.streak=0;c.bestStreak=0;c.collisions=0;score=0;
      function pass(kind,lane=0,act='',remaining=0){c.action=act;c.actionTime=remaining;const o={at:c.distance+1,lane,kind};c.objects=[o];update(.01);return o.done}
      pass('candy');pass('candy');const candies=c.candies,points=score,streak=c.streak;
      pass('candy',1);const missed=c.candies,missedStreak=c.streak;
      pass('stump',0,'jump',.5);pass('pumpkin',0,'jump',.5);pass('arch',0,'duck',.5);pass('branch',0,'duck',.5);const avoided=c.collisions;
      pass('ghost',0,'jump',.5);c.inv=0;pass('ghost',0,'duck',.5);const collisions=c.collisions,chain=c.streak,slow=c.slow;
      return {candies,points,streak,missed,missedStreak,avoided,collisions,chain,slow};
    }""")
    assert values=={'candies':2,'points':2,'streak':2,'missed':2,'missedStreak':2,'avoided':0,'collisions':2,'chain':0,'slow':1.2},values
    page.evaluate('togglePause()');paused=page.evaluate('gameTime');page.wait_for_timeout(300)
    assert page.evaluate('gameTime')==paused
    page.evaluate('togglePause();gameTime=89.99;update(.02)');page.wait_for_selector('.weekly-result')
    isolated=page.evaluate("""()=>({result:WeeklySprint.result,active:WeeklySprint.active,sandbox:SandboxMode,
      xp:Journey.state.xp,run:Journey.run,recent:Journey.state.recent.length,records:records.length,
      ranked:LocalLeague.dayState().rankedUsed,daily:LocalLeague.dayState().dailyUsed,
      old:localStorage.getItem('minuit-ring-sprint-v1'),saved:JSON.parse(localStorage.getItem('minuit-candy-sprint-v5')),
      hidden:document.querySelector('#runnerControls').classList.contains('hidden')&&document.querySelector('#runnerMission').classList.contains('hidden')})""")
    assert isolated['result']['score']==2 and isolated['result']['candies']==2
    assert not isolated['active'] and not isolated['sandbox'] and isolated['run'] is None and isolated['hidden']
    assert isolated['xp']==isolated['recent']==isolated['records']==isolated['ranked']==isolated['daily']==0
    assert isolated['old'] is None and isolated['saved']['weeks'][before['week']]['best']['score']==2
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-broom-sprint-v1')).weeks.legacy.best.score")==9999
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-candy-sprint-v1')).weeks.legacy.best.score")==8888
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-candy-sprint-v2')).weeks.legacy.best.score")==7777
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-candy-sprint-v3')).weeks.legacy.best.score")==6666
    assert page.evaluate("JSON.parse(localStorage.getItem('minuit-candy-sprint-v4')).weeks.legacy.best.score")==5555
    assert 'candySprintV5=' in page.evaluate('WeeklySprint.shareContent(2).link')
    page.click('#weeklyRetry');page.evaluate('gameTime=89.99;update(.02)');page.wait_for_selector('.weekly-result')
    assert page.evaluate('WeeklySprint.data.weeks[WeeklySprint.result.week].best.score')==2
    # Simulation complète de 90 secondes, départ et fin automatiques.
    page.click('#weeklyRetry');completed=page.evaluate("""()=>{for(let i=0;i<5500&&WeeklySprint.active;i++){const c=WeeklySprint.course;const gate=c.gates.find(g=>g.at>c.distance);if(gate)c.lane=gate.lane;update(1/60);}
      return {result:WeeklySprint.result,passed:WeeklySprint.course.objects.filter(o=>o.done).length,distance:WeeklySprint.course.distance,last:Math.max(...WeeklySprint.course.objects.map(o=>o.at))}}""")
    assert completed['result']['time']==90 and completed['result']['candies']>100 and completed['passed']>100 and completed['last']>completed['distance']+2200,completed
    # Simulation de 12 parcours entiers, avec les vrais objets et gates v5.
    multi=page.evaluate("""()=>{const results=[];
      for(let seed=0;seed<12;seed++){
        WeeklySprint.start();const c=WeeklySprint.course,layout=WeeklySprint.buildCourse({seed});c.objects=layout.objects;c.gates=layout.gates;
        const rows=Array.from({length:96},(_,i)=>WeeklySprint.courseRow({seed},i));let dodging=null;
        for(let i=0;i<5500&&WeeklySprint.active;i++){
          const gate=c.gates.find(g=>g.at>c.distance),row=rows[Math.max(0,Math.min(95,Math.floor((c.distance+350-700)/1080)))];
          if(dodging?.done)dodging=null;
          if(!dodging)dodging=c.objects.find(o=>o.kind==='projectile'&&!o.done&&o.at>c.distance&&o.at-c.distance<c.speed*.55&&Math.abs(o.lane-c.lanePos)<.65)||null;
          const ghost=c.objects.find(o=>o.kind==='ghost'&&o.at>c.distance&&o.at-c.distance<c.speed*.4&&Math.abs(o.lane-c.lanePos)<.6);
          if(dodging)c.lane=dodging.lane===0?1:0;
          else if(ghost)c.lane=gate&&gate.at-ghost.at<1200&&Math.abs(gate.lane-ghost.lane)===1?gate.lane:(ghost.lane===0?1:0);
          else if(gate&&gate.at-c.distance<c.speed*.7)c.lane=gate.lane;else c.lane=row.candyLane;
          const obstacle=c.objects.find(o=>['stump','pumpkin','gap','arch','branch'].includes(o.kind)&&!o.done&&o.at>c.distance&&o.at-c.distance<c.speed*.4&&Math.abs(o.lane-c.lanePos)<.5);
          if(obstacle&&c.actionTime===0){c.action=['stump','pumpkin','gap'].includes(obstacle.kind)?'jump':'duck';c.actionTime=.8;}
          update(1/60);
        }
        results.push({seed,collisions:WeeklySprint.result.collisions,candies:WeeklySprint.result.candies});
      }return results;
    }""")
    assert all(r['collisions']==0 and r['candies']>100 for r in multi),multi
    page.wait_for_selector('.weekly-result');page.click('#weeklyHome');page.wait_for_selector('#weeklySprint')
    # Les contrôles et le libellé d'origine sont restaurés dans le jeu classique.
    page.evaluate('LocalLeague.play()');page.wait_for_function("state==='play'&&!WeeklySprint.active")
    rect=page.locator('#game').bounding_box();page.mouse.move(rect['x']+rect['width']*.25,rect['y']+rect['height']*.7)
    assert page.evaluate('pointer!==null && Math.abs(pointer.x-200)<3')
    assert 'Jeu de tir Halloween' in page.locator('#game').get_attribute('aria-label')
    assert not errors,errors

    friend=browser.new_page(viewport={'width':1100,'height':800});friend.add_init_script(TRAINED)
    friend.goto(URL+'/?candySprintV5='+before['week']+'&target=1234');friend.wait_for_selector('.weekly-friend-target')
    assert 'candySprintV5=' not in friend.url

    old_friend=browser.new_page(viewport={'width':1100,'height':800});old_friend.add_init_script(TRAINED)
    old_friend.goto(URL+'/?candySprint='+before['week']+'&target=9999');old_friend.wait_for_selector('.weekly-friend-target')
    assert 'ancien parcours' in old_friend.locator('.weekly-friend-target').inner_text().lower()
    assert old_friend.evaluate('WeeklySprint.friend===null')
    old_friend.goto(URL+'/?candySprintV2='+before['week']+'&target=888');old_friend.wait_for_selector('.weekly-friend-target')
    assert old_friend.evaluate('WeeklySprint.friend===null') and 'ancien parcours' in old_friend.locator('.weekly-friend-target').inner_text().lower()

    old_friend.goto(URL+'/?candySprintV3='+before['week']+'&target=444');old_friend.wait_for_selector('.weekly-friend-target')
    assert old_friend.evaluate('WeeklySprint.friend===null')

    old_friend.goto(URL+'/?candySprintV4='+before['week']+'&target=444');old_friend.wait_for_selector('.weekly-friend-target')
    assert old_friend.evaluate('WeeklySprint.friend===null')

    rewards=browser.new_page(viewport={'width':1100,'height':900});rewards.add_init_script(TRAINED)
    rewards.goto(URL);rewards.click('#weeklySprint')
    assert rewards.locator('[data-cosmetic="amber"]').is_disabled()
    rewards.click('#weeklyLaunch')
    objectives=rewards.evaluate("""()=>{const c=WeeklySprint.course;c.objects=[];c.gates=[];c.lane=c.lanePos=0;
      c.streak=c.bestStreak=14;c.cleanTime=9.99;c.candies=0;score=0;
      c.objects=[{kind:'candy',lane:0,at:c.distance+1}];update(.02);
      for(let i=0;i<3;i++){c.action='jump';c.actionTime=.5;c.objects=[{kind:'stump',lane:0,at:c.distance+1}];update(.02)}
      return {missions:c.missions,score,candies:c.candies,avoids:c.avoids};
    }""")
    assert objectives=={'missions':[True,True,True],'score':1,'candies':1,'avoids':3},objectives
    rewards.evaluate('gameTime=89.99;update(.02)');rewards.wait_for_selector('.weekly-result')
    assert 'Balai doré' in rewards.locator('.runner-results-missions').inner_text()
    assert rewards.evaluate('WeeklySprint.data.stars')==3
    rewards.evaluate('update(1)');assert rewards.evaluate('WeeklySprint.data.stars')==3
    rewards.click('#weeklyCustomize');rewards.locator('[data-cosmetic="amber"]').click()
    assert rewards.evaluate('WeeklySprint.data.cosmetic')=='amber'
    rewards.reload();rewards.click('#weeklySprint')
    assert rewards.locator('[data-cosmetic="amber"]').evaluate("e=>e.classList.contains('selected')")
    rewards.click('#weeklyLaunch');assert rewards.evaluate('WeeklySprint.course.speed')==700
    assert rewards.evaluate('Journey.run.combat.standard')

    team=browser.new_page(viewport={'width':1100,'height':800});team.add_init_script(SESSION);calls=[]
    def rpc(route):
        req=route.request;calls.append((req.url,req.post_data_json))
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'team':{'name':'Balais Test'},'scores':[{'rank':1,'displayName':'Test','score':321,'played':True,'isYou':True}]}))
    team.route('**/rest/v1/rpc/*',rpc);team.goto(URL)
    team.wait_for_selector('#dailyRewardContinue:not(.hidden)',timeout=6000);team.click('#dailyRewardContinue')
    team.wait_for_selector('#weeklySprint');team.click('#weeklySprint')
    team.wait_for_function("document.querySelector('#weeklyPreflightTeam')?.textContent.includes('Balais Test')")
    team.click('#weeklyLaunch');team.wait_for_function('WeeklySprint.active')
    team.evaluate('score=321;gameTime=89.99;update(.02)');team.wait_for_selector('.weekly-result')
    team.wait_for_function("document.querySelector('#weeklyTeamBoard')?.textContent.includes('Balais Test')")
    submitted=[body for url,body in calls if 'minuit_submit_candy_sprint_v5' in url]
    assert len(submitted)==1 and submitted[0]['p_score']==321 and submitted[0]['p_time_seconds']==90
    assert not any('minuit_submit_broom_sprint' in url or 'minuit_submit_ring_sprint' in url or 'minuit_submit_weekly_sprint' in url or 'minuit_submit_team_score' in url for url,_ in calls)

    mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
    mobile_errors=[];mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
    mobile.add_init_script(TRAINED);mobile.goto(URL);mobile.wait_for_selector('#weeklySprint');mobile.click('#weeklySprint')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth')
    mobile.click('#weeklyLaunch');mobile.wait_for_function('WeeklySprint.active')
    # Événements tactiles injectés dans Chromium, pas des PointerEvent synthétiques.
    touch=mobile.context.new_cdp_session(mobile)
    rect=mobile.locator('#game').bounding_box();x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.55
    def swipe(dx,dy):
        touch.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
        touch.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx,'y':y+dy}]})
        touch.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    swipe(-45,0)
    assert mobile.evaluate('WeeklySprint.course.lane')==-1
    swipe(45,0)
    assert mobile.evaluate('WeeklySprint.course.lane')==0
    swipe(0,-45)
    assert mobile.evaluate("WeeklySprint.course.action==='jump'")
    mobile.evaluate("WeeklySprint.course.actionTime=0;WeeklySprint.course.action=''")
    swipe(0,45)
    assert mobile.evaluate("WeeklySprint.course.action==='duck'")
    mobile.touchscreen.tap(rect['x']+rect['width']*.9,y)
    assert mobile.evaluate('WeeklySprint.course.lane')==1
    mobile.tap('[data-move="left"]');assert mobile.evaluate('WeeklySprint.course.lane')==0
    mobile.tap('[data-move="jump"]');assert mobile.evaluate("WeeklySprint.course.action==='jump'")
    # Un glissement tactile au bon moment attrape le bonbon au-dessus du trou.
    mobile.evaluate("""()=>{const c=WeeklySprint.course;c.gates=[];c.lane=c.lanePos=0;c.inv=0;c.slow=0;c.action='';c.actionTime=0;c.candies=0;c.collisions=0;score=0;
      const at=c.distance+280;c.objects=[{at,lane:0,kind:'candy',require:'jump'},{at,lane:0,kind:'gap'}]}""")
    swipe(0,-45);mobile.wait_for_function('WeeklySprint.course.objects[0].done')
    assert mobile.evaluate('WeeklySprint.course.candies===1&&WeeklySprint.course.collisions===0')
    mobile.evaluate("""()=>{const c=WeeklySprint.course;c.gates=[];c.lane=c.lanePos=0;c.inv=0;c.slow=0;c.collisions=0;
      c.objects=[{kind:'projectile',lane:0,enemyLane:1.85,at:c.distance+350}]}""")
    swipe(45,0);mobile.wait_for_function('WeeklySprint.course.objects[0].done')
    assert mobile.evaluate('WeeklySprint.course.collisions===0&&WeeklySprint.course.objects[0].fired')
    mobile.evaluate('WeeklySprint.start()')
    # Un vrai toucher de la voie du bonbon débloque le mur sur téléphone.
    target=mobile.evaluate("""()=>{const c=WeeklySprint.course,g=c.gates.find(g=>g.at>c.distance+30&&c.objects.some(o=>o.kind==='candy'&&!o.require&&o.at===g.at)),bad=g.lane===0?-1:0;
      c.distance=g.at-1;c.lane=bad;c.lanePos=bad;c.inv=0;c.slow=0;return {lane:g.lane,count:c.candies};}""")
    mobile.wait_for_function('WeeklySprint.course.blocked')
    rect=mobile.locator('#game').bounding_box()
    mobile.touchscreen.tap(rect['x']+rect['width']*((target['lane']+1)*.34+.16),rect['y']+rect['height']*.55)
    mobile.wait_for_function('(count)=>!WeeklySprint.course.blocked&&WeeklySprint.course.candies>count',arg=target['count'])
    mobile.evaluate('gameTime=89.99;update(.02)');mobile.wait_for_selector('.weekly-result')
    assert mobile.evaluate('document.documentElement.scrollWidth<=innerWidth') and not mobile_errors,mobile_errors
    browser.close()
    print('OK : course aux bonbons, chapelets, vitesse, commandes, isolation, team et mobile.')
