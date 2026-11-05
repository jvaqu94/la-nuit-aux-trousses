/* Monde 3 · La Sixième Heure.
   Difficulté par la décision, jamais par le nombre : les budgets sont plafonnés
   aux valeurs du monde 2 (6 ennemis, 2 projectiles par salve, cadence ≥ 4,2 s,
   vitesse ≤ 150). Chaque forme hérite d'une mécanique du monde 1 et d'une du
   monde 2. Aucun gardien n'utilise la courbe PV → 3 phases : chacun a sa jauge
   et sa condition de victoire. */
(()=>{
'use strict';
const active=()=>window.Campaign?.activeWorld===3;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const near=(ax,ay,bx,by,r)=>Math.hypot(ax-bx,ay-by)<r;

const BUDGET={foes:6,volley:2,cadence:4.2,shotSpeed:150,adds:2};
const TUNING=[
 {foes:4,volley:1,cadence:4.6,speed:130,axes:1},
 {foes:5,volley:2,cadence:4.4,speed:135,axes:2},
 {foes:5,volley:2,cadence:4.4,speed:140,axes:2},
 {foes:6,volley:2,cadence:4.2,speed:145,axes:3},
 {foes:6,volley:2,cadence:4.2,speed:150,axes:3}
];
const tune=()=>TUNING[clamp(stage,0,4)];

const foeNames={
 wickWarden:'Garde-mèche',waxCourier:'Facteur de cire',
 bronzeCrow:'Corbeau de bronze',crackedBell:'Cloche fêlée',
 saltWalker:'Marcheuse de sel',printThief:'Voleuse d’empreintes',
 wickPicker:'Cueilleuse de mèches',hollowFlame:'Flamme creuse',
 unnamedDigit:'Chiffre sans nom',facelessEcho:'Écho sans visage'
};
const foeKinds=new Set(Object.keys(foeNames));
const bossKinds=new Set(['veilleuse','sonneur','passeur','cueilleuse','chasseur']);
/* Une condition de victoire par gardien : aucune n'est « vider la barre ». */
const VICTORY={
 veilleuse:'Éteindre les cinq mèches en même temps',
 sonneur:'Frapper trois fois le battant',
 passeur:'Briser trois fois la boucle de sable',
 cueilleuse:'Forcer trois cueillettes',
 chasseur:'Accomplir le geste qu’il n’a pas pu copier'
};
const RULES=[
 'VEILLES · le halo protège aussi tes cibles : plein = réel, pointillé = leurre',
 'SILENCE · briser une cloche fige les tirs de sa jumelle',
 'TRACES · le sel reprend tes positions passées : ne te répète pas',
 'PRÊT · allumer une lanterne coûte de la flamme, donc de la cadence',
 'EMPRUNT · le cadran ne garde que les chiffres qu’il montre'
];
const HABITS={relays:'relais brisés',halos:'halos fréquentés',salt:'sable intact foulé',flames:'flammes rendues'};

let marks=[],salt=[],trail=[],mission={},habits=freshHabits(),boss=null,minute=null,meche=null;
let flame=3,frozen=[],spawnSerial=0,haloTime=0,gesture=null;

function freshHabits(){return{relays:0,halos:0,salt:0,flames:0}}
function reset(){
 marks=[];salt=[];trail=[];mission={};habits=freshHabits();boss=null;minute=null;meche=null;
 flame=3;frozen=[];spawnSerial=0;haloTime=0;gesture=null;
}
const journeyBegin=Journey.begin,journeyRestore=Journey.restore;
Journey.begin=function(...args){const r=journeyBegin(...args);reset();return r};
Journey.restore=function(...args){const r=journeyRestore(...args);reset();return r};

/* --- Mémoire du joueur (héritée du Cerf des heures et de la Larve) --------- */
function remember(dt){
 trail.push({x:player.x,y:player.y,t:gameTime});
 while(trail.length&&gameTime-trail[0].t>13)trail.shift();
}
function pastPlayer(seconds=1.2){
 const target=gameTime-seconds;
 for(let i=trail.length-1;i>=0;i--)if(trail[i].t<=target)return trail[i];
 return trail[0]||{x:player.x,y:player.y};
}

/* --- Télégraphes : plein = réel, pointillé = leurre (langage du monde 1) --- */
function addMark(data){
 if(marks.length>=6)return null;
 const mark={x:clamp(data.x,60,740),y:clamp(data.y,300,820),r:data.r||74,warn:data.warn||1.35,
  life:data.life||.45,age:0,real:data.real!==false,source:data.source||null,label:data.label||'',
  kind:data.kind||'strike',graze:data.graze===true,grazed:false,struck:false};
 marks.push(mark);return mark;
}
const isReal=m=>mission.inverted?!m.real:m.real;

/* Le halo du Garde-mèche : protection du monde 1, lumière du monde 2. */
function wardenAt(x,y){
 return enemies.find(e=>!e.dead&&e.kind==='wickWarden'&&near(x,y,e.x,e.y,e.halo||150))||null;
}
function playerInHalo(){return !!wardenAt(player.x,player.y)}

function liveFoes(){return enemies.filter(e=>!e.dead&&!e.boss).length}

/* --- Apparition : plafond dur, aucun dépassement possible ----------------- */
const baseSpawnEnemy=spawnEnemy;
spawnEnemy=function(d){
 if(active()&&foeKinds.has(d.kind)&&liveFoes()>=tune().foes)return;
 baseSpawnEnemy(d);
 if(!active())return;
 const e=enemies[enemies.length-1];
 if(!e||!foeKinds.has(d.kind))return;
 e.pattern=99;e.speed=0;e.fire=999;e.baseX=d.x;e.x=d.x;
 e.elite=false;e.tier=0;e.r=e.kind==='crackedBell'?24:e.kind==='hollowFlame'?22:20;
 e.homeY=Number.isFinite(d.y)?d.y:250+((d.group||0)%3)*70;
 if(Number.isFinite(d.y))e.y=d.y;
 e.seed=(Number(e.id)||.31)*Math.PI*2;e.dir=(d.index||0)%2?1:-1;
 e.timer=tune().cadence*(.55+((spawnSerial++%3)*.22));
 e.lit=false;e.digit=1+(spawnSerial%5);e.marks=0;e.lastDash=0;e.dashDir=null;e.dashRun=0;
 if(e.kind==='crackedBell'){
  const twin=enemies.find(o=>o!==e&&!o.dead&&o.kind==='crackedBell'&&!o.twin);
  if(twin){twin.twin=e;e.twin=twin}
 }
};

function spawnFoe(kind,x,y,index=0){
 spawnEnemy({kind,x,y:y??-35,group:60+(spawnSerial%12),index,pattern:99});
 const e=enemies[enemies.length-1];
 return e&&e.kind===kind?e:null;
}

/* --- Vagues : lecture, minute, tenue, inversion, gardien ------------------ */
const baseSchedule=makeSchedule;
makeSchedule=function(){
 if(!active())return baseSchedule();
 const forms=world.foes,list=[];
 if(wave===5){list.push({time:1,x:260,kind:forms[0],pattern:99,group:1,index:0},{time:1.4,x:540,kind:forms[1],pattern:99,group:1,index:1});return list}
 const count=8+wave*2;
 for(let i=0;i<count;i++)list.push({time:1+i*2.4,x:i%2?600:200,kind:forms[i%forms.length],pattern:99,group:1+(i%3),index:i%2});
 return list;
};

const baseNewWave=newWave;
newWave=function(...args){
 const result=baseNewWave(...args);
 if(!active())return result;
 marks=[];salt=[];minute=null;meche=null;frozen=[];boss=null;gesture=null;haloTime=0;
 mission={key:stage+':'+wave,minuteTaken:false,seals:0,inverted:wave===4,digit:1,digitTimer:5,tenure:0};
 if(wave===1)say(RULES[clamp(stage,0,4)],3.4);
 if(wave===2){minute={x:400,y:330,guard:true,taken:false,age:0};say('RENDRE UNE MINUTE · éteins sa garde, puis prends-la',3.2)}
 if(wave===3)say('TENUE · 22 secondes avec deux règles actives',2.6);
 if(wave===4){
  say('INVERSION · le plein devient leurre, le pointillé devient réel',3.4);
  spawnFoe('hollowFlame',240,300,0);spawnFoe('hollowFlame',560,300,1);
  for(const e of enemies)if(e.kind==='hollowFlame'&&!e.dead){e.seal=true;e.lit=true}
 }
 window.Campaign&&window.Campaign.progress&&typeof sequelHUD==='function'&&sequelHUD();
 return result;
};

function waveBlocks(){
 if(!active()||window.SandboxMode||state!=='play'||wave===5)return false;
 if(wave===2)return !mission.minuteTaken;
 if(wave===3)return waveTime<22;
 if(wave===4)return mission.seals<2;
 return false;
}

/* --- Comportements : un héritage monde 1 × monde 2 par forme -------------- */
function moveEnemy(e,dt){
 if(!active()||!foeKinds.has(e.kind)||e.boss)return false;
 const t=tune();
 if(e.y<e.homeY)e.y=Math.min(e.homeY,e.y+58*dt);
 else e.y=e.homeY+Math.sin(e.age*.7+e.seed)*16;
 e.x=clamp(e.baseX+Math.sin(e.age*.55+e.seed)*(e.kind==='wickWarden'?55:95),50,750);
 if(e.seal)return true;
 e.timer-=dt;
 if(e.kind==='printThief')trackDash(e);
 if(e.timer>0)return true;
 e.timer=t.cadence;
 const aim=Math.atan2(player.y-e.y,player.x-e.x);
 if(e.kind==='waxCourier'){
  /* Leurre du vampire (M1) × écho annulable du facteur d’ombre (M2). */
  const side=rng()<.5?-1:1,source=enemies.find(o=>!o.dead&&o.kind==='wickWarden')||e;
  addMark({x:player.x,y:player.y,r:72,warn:1.35,source,real:true,label:'CIRE'});
  addMark({x:player.x+side*180,y:player.y-40,r:72,warn:1.35,source,real:false,label:'LEURRE'});
 }else if(e.kind==='bronzeCrow'){
  /* Écho du chiffre creux (M2) × frôlement récompensé (M1). */
  addMark({x:player.x,y:player.y,r:66,warn:1.3,source:e,graze:true,label:'BRONZE'});
 }else if(e.kind==='crackedBell'){
  shootHostile(e,'spirit',[0],Math.min(t.speed,BUDGET.shotSpeed),aim);
 }else if(e.kind==='saltWalker'){
  /* Traînée d’ossements (M1) × mémoire du joueur (M2). */
  const past=pastPlayer(1.2);
  salt.push({x:clamp(past.x,50,750),y:clamp(past.y,320,830),r:62,age:0,life:3});
  if(salt.length>7)salt.shift();
 }else if(e.kind==='printThief'){
  if(e.dashRun>=3){
   const dir=e.dashDir||{x:0,y:-1};
   addMark({x:player.x+dir.x*150,y:player.y+dir.y*150,r:78,warn:1.4,source:e,label:'EMPREINTE'});
   e.dashRun=0;
  }
 }else if(e.kind==='wickPicker'){
  /* Protecteur (M1) × prisme annulable (M2) : rallumer lui retire son arme. */
  const lamp=enemies.find(o=>!o.dead&&o.kind==='hollowFlame'&&o.lit);
  if(lamp){lamp.lit=false;particle(lamp.x,lamp.y,'#f4c98f',12);addMark({x:player.x,y:player.y,r:70,warn:1.25,source:e,label:'PRISME'})}
  else e.timer=t.cadence*.6;
 }else if(e.kind==='hollowFlame'){
  if(e.lit)shootHostile(e,'spirit',[0],Math.min(t.speed,BUDGET.shotSpeed),aim);
 }else if(e.kind==='unnamedDigit'){
  addMark({x:player.x,y:player.y,r:68,warn:1.35,source:e,label:'CHIFFRE '+e.digit});
 }else if(e.kind==='facelessEcho'){
  copyHabit(e,t,aim);
 }
 return true;
}

function copyHabit(e,t,aim){
 const top=Object.entries(habits).sort((a,b)=>b[1]-a[1])[0][0];
 if(top==='relays'){addMark({x:player.x,y:player.y,r:70,warn:1.3,source:e,label:'EMPRUNT · RELAIS'})}
 else if(top==='halos'){e.halo=140;addMark({x:player.x,y:player.y,r:70,warn:1.4,source:e,label:'EMPRUNT · HALO'})}
 else if(top==='salt'){const past=pastPlayer(1.1);salt.push({x:clamp(past.x,50,750),y:clamp(past.y,320,830),r:60,age:0,life:2.6});if(salt.length>7)salt.shift()}
 else shootHostile(e,'spirit',[0],Math.min(t.speed,BUDGET.shotSpeed),aim);
}

function trackDash(e){
 if(player.dash>0&&e.lastDash<=0){
  const past=pastPlayer(.3),dx=player.x-past.x,dy=player.y-past.y,length=Math.hypot(dx,dy)||1;
  const dir={x:dx/length,y:dy/length};
  if(e.dashDir&&Math.abs(e.dashDir.x-dir.x)<.45&&Math.abs(e.dashDir.y-dir.y)<.45)e.dashRun++;
  else e.dashRun=1;
  e.dashDir=dir;
 }
 e.lastDash=player.dash;
}

/* Cloches fêlées : le lien du monde 1 devient une ressource (temps suspendu M2). */
function breakBell(e){
 const twin=e.twin;
 if(!twin||twin.dead)return;
 let count=0;
 for(const b of hostile){
  if(b.owner!==twin||b.frozen)continue;
  b.frozen=true;b.frozenVx=b.vx;b.frozenVy=b.vy;b.vx=0;b.vy=0;b.freezeLeft=1.5;count++;
 }
 if(count)say('LIEN ROMPU · les tirs de la jumelle sont suspendus',2);
}

/* --- Minute rendue : reliquaire en deux temps (modèle du monde 1) --------- */
function tickMinute(dt){
 if(!minute||minute.taken)return;
 minute.age+=dt;
 if(minute.guard&&!enemies.some(e=>!e.dead&&e.kind==='wickWarden'))minute.guard=false;
 if(!minute.guard&&near(player.x,player.y,minute.x,minute.y,46)){
  minute.taken=true;mission.minuteTaken=true;keepMinute('MINUTE RENDUE');
 }
}
function keepMinute(label){
 const total=window.Campaign?.keepMinutes?.(1)||0;
 score+=400*(stage+1);particle(player.x,player.y,'#ffd9a0',26);tone(720,.32,'sine',.08,1.3);
 say(label+' · '+total+'/15 conservées pour la fin du voyage',3);
 if(typeof sequelHUD==='function')sequelHUD();
}

/* --- Tick commun -------------------------------------------------------- */
function tick(dt){
 if(!active()||state!=='play')return;
 remember(dt);
 if(wave===2&&mission.minuteTaken===false&&!minute)minute={x:400,y:330,guard:true,taken:false,age:0};
 if(wave===2&&minute&&!minute.guard&&!enemies.some(e=>!e.dead&&e.kind==='wickWarden')&&!minute.spawned){
  minute.spawned=true;spawnFoe('wickWarden',400,270,0);
 }
 mission.digitTimer=(mission.digitTimer||0)-dt;
 if(mission.digitTimer<=0){mission.digitTimer=5;mission.digit=1+((mission.digit||1)%5)}
 for(const m of marks){
  m.age+=dt;
  if(m.source&&m.source.dead){m.age=m.warn+m.life;continue}
  if(!m.struck&&m.age>=m.warn){
   m.struck=true;
   const inside=near(player.x,player.y,m.x,m.y,m.r);
   if(isReal(m)&&inside)hurt(25,'la cire annoncée');
   else if(m.graze&&inside&&player.dash>0){m.grazed=true}
   particle(m.x,m.y,isReal(m)?'#ffd9a0':'#b9a7c9',10);
  }
  if(m.graze&&!m.grazed&&m.age>=m.warn-.2&&near(player.x,player.y,m.x,m.y,m.r)&&player.inv<=0){
   m.grazed=true;graze++;window.League?.event?.('graze',1);score+=25*combo;say('FRÔLEMENT TENU · le bronze paie',1.6);
  }
 }
 marks=marks.filter(m=>m.age<m.warn+m.life);
 for(const s of salt){
  s.age+=dt;
  if(s.age>.35&&near(player.x,player.y,s.x,s.y,s.r))player.slow=Math.max(player.slow,.4);
 }
 salt=salt.filter(s=>s.age<s.life);
 for(const b of hostile)if(b.frozen){
  b.freezeLeft-=dt;
  if(b.freezeLeft<=0){b.frozen=false;b.vx=b.frozenVx;b.vy=b.frozenVy}
 }
 if(playerInHalo()){haloTime+=dt;if(haloTime>=1){haloTime=0;habits.halos++}}else haloTime=0;
 tickMinute(dt);
 tickFlame(dt);
 hitTargets();
 if(gesture)gesture.tick(dt);
}

/* La flamme est une ressource : la dépenser réduit la cadence de tir. */
function tickFlame(dt){
 if(active()&&flame<3&&state==='play')player.fire=Math.max(player.fire,(3-flame)*.14);
 if(meche){
  meche.age+=dt;meche.y+=42*dt;
  if(near(player.x,player.y,meche.x,meche.y,44)){flame=Math.min(3,flame+1);meche=null;say('MÈCHE REPRISE · flamme '+flame+'/3',2)}
  else if(meche.y>H+40)meche=null;
 }
}

/* --- Dégâts : héritage protecteur + chiffres du cadran ------------------- */
const baseDamageEnemy=damageEnemy;
damageEnemy=function(e,n,...rest){
 if(!active())return baseDamageEnemy(e,n,...rest);
 if(e.boss&&bossKinds.has(e.kind)){e.blockHit=.12;return}
 if(e.kind==='unnamedDigit'&&e.digit!==mission.digit){e.blockHit=.12;return}
 let value=n;
 if(wardenAt(e.x,e.y))value*=.55;
 if(playerInHalo())value*=.55;
 if(e.kind==='hollowFlame'&&e.lit&&stage===2)value*=.55;
 return baseDamageEnemy(e,value,...rest);
};

const baseReward=reward;
reward=function(e){
 if(active()&&e&&!e.dead){
  if(e.kind==='crackedBell')breakBell(e);
  const armed=marks.some(m=>m.source===e&&!m.struck);
  if(armed||e.kind==='wickWarden'||e.kind==='facelessEcho'){
   habits.relays++;
   for(const m of marks)if(m.source===e)m.age=m.warn+m.life;
  }
  if(e.seal){mission.seals=(mission.seals||0)+1;say('SCEAU ÉTEINT · '+mission.seals+'/2',2)}
  if(e.kind==='hollowFlame'&&e.lit){habits.flames++;flame=Math.max(0,flame-1)}
 }
 return baseReward(e);
};

/* --- Gardiens : cinq jauges, cinq victoires ------------------------------ */
const baseSpawnBoss=spawnBoss;
spawnBoss=function(){
 if(!active())return baseSpawnBoss();
 dailyWaveReward();clean=true;
 const kind=world.kind;
 boss={x:400,y:-90,baseX:400,hp:1,max:1,r:50,speed:0,kind,boss:true,age:0,fire:999,cycle:0,adds:999,
  phase:1,phaseShield:0,phaseFlash:0,damageBudget:0,budgetRate:0,poison:0,poisonTick:0,hit:0,blockHit:0,
  timer:0,step:0,value:0,label:'',lossStart:window.Journey?.run?.stats.lifeLoss||0};
 if(kind==='veilleuse'){
  boss.windows=[0,1,2,3,4].map(i=>({x:110+i*145,y:330,lit:true,open:0}));
  boss.tour=0;boss.relight=6;boss.label='FENÊTRE';
 }else if(kind==='sonneur'){
  boss.bell={x:400,y:330,r:58};boss.clapper={x:400,y:236,r:24,down:false};
  boss.resonance=0;boss.strikes=0;boss.ring=0;boss.label='RÉSONANCE';
 }else if(kind==='passeur'){
  boss.sand=[{x:180,y:440},{x:620,y:440},{x:180,y:690},{x:620,y:690}].map(p=>({...p,r:92,fresh:true}));
  boss.open=0;boss.openUsed=false;boss.breaks=0;boss.reset=0;boss.ghost=null;boss.label='SABLE INTACT';
 }else if(kind==='cueilleuse'){
  boss.lanterns=[200,400,600].map(x=>({x,y:340,lit:false}));
  boss.steal=5;boss.vulnerable=0;boss.collected=0;boss.used=false;flame=3;boss.label='LANTERNES';
 }else{
  const order=Object.entries(habits).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  boss.borrow=[order[0],order[1],order[0]];boss.least=order[order.length-1];
  boss.borrowed=0;boss.window=8;boss.grace=1.6;boss.naming=false;boss.halo=null;boss.label='EMPRUNTS';
 }
 enemies.push(boss);schedule=[];
 say(world.boss+' · '+VICTORY[kind],3.6);
 mp3Music?.bossArrival(activeMusicThemes()[stage%activeMusicThemes().length].id);
 if(kind==='veilleuse'){spawnFoe('wickWarden',220,250,0);spawnFoe('wickWarden',580,250,1)}
};

function moveBoss(e,dt,oldX,oldY){
 if(!active()||!bossKinds.has(e.kind))return false;
 boss=e;e.blockHit=Math.max(0,(e.blockHit||0)-dt);
 if(e.y<190){e.y=Math.min(190,e.y+95*dt);return true}
 e.timer+=dt;
 if(e.kind==='veilleuse')tickVeilleuse(e,dt);
 else if(e.kind==='sonneur')tickSonneur(e,dt);
 else if(e.kind==='passeur')tickPasseur(e,dt);
 else if(e.kind==='cueilleuse')tickCueilleuse(e,dt);
 else tickChasseur(e,dt);
 if(e.value>=1&&!e.dead){e.value=1;reward(e)}
 return true;
}

/* 1 · La Veilleuse — placement et fenêtre. Aucun projectile. */
function tickVeilleuse(e,dt){
 const windows=e.windows;
 for(const w of windows)w.open=Math.max(0,w.open-dt);
 if(e.timer>=2.2){
  e.timer=0;windows[e.tour].open=1.6;
  e.tour=(e.tour+1)%windows.length;
 }
 const target=windows[e.tour];
 e.x+=(target.x-e.x)*Math.min(1,dt*2.4);e.y+=(250-e.y)*Math.min(1,dt*2);
 e.relight-=dt;
 if(e.relight<=0){
  e.relight=6;
  const dark=windows.filter(w=>!w.lit);
  if(dark.length){dark[0].lit=true;say('UNE FENÊTRE SE RALLUME',1.8)}
 }
 const lit=windows.filter(w=>w.lit).length;
 e.value=(5-lit)/5;e.label=lit+' / 5 FENÊTRES ALLUMÉES';
 if(lit===5&&e.age>6){e.relight=6;hurt(25,'la veille complète');say('VEILLE COMPLÈTE · une mèche se rallume',2.4);windows[0].lit=false}
}

/* 2 · Le Sonneur — la ligne de tir. Ton propre tir automatique est le danger. */
function tickSonneur(e,dt){
 e.clapper.x=400+Math.sin(e.age*.9)*165;
 e.clapper.down=(e.age%8)<2;
 e.x=e.bell.x;e.y=250;
 if(e.ring>0){
  e.ring+=dt;
  const radius=e.ring*260;
  if(Math.abs(Math.hypot(player.x-e.bell.x,player.y-e.bell.y)-radius)<26)hurt(25,'l’onde du clocher');
  if(e.ring>2)e.ring=0;
 }
 if(e.resonance>=100){e.resonance=0;e.ring=.01;say('LA CLOCHE A SONNÉ · une seule onde, écarte-toi',2.4)}
 e.value=e.strikes/3;e.label=e.strikes+' / 3 FRAPPES · RÉSONANCE '+Math.floor(e.resonance)+' %';
}

/* 3 · Le Passeur — mémoire spatiale. Le danger est ton propre trajet. */
function tickPasseur(e,dt){
 e.x=400+Math.sin(e.age*.4)*150;e.y=210;
 e.open=Math.max(0,e.open-dt);
 for(const zone of e.sand){
  if(zone.fresh&&near(player.x,player.y,zone.x,zone.y,zone.r)){
   zone.fresh=false;e.open=2;e.openUsed=false;habits.salt++;
   say('SABLE INTACT FOULÉ · le Passeur devient solide',2);
  }
 }
 if(e.sand.every(z=>!z.fresh)){
  e.reset+=dt;
  if(e.reset>=5){e.reset=0;for(const z of e.sand)z.fresh=true;say('LA MARÉE EFFACE LES TRACES',2)}
 }
 const past=pastPlayer(3.2);
 e.ghost={x:past.x,y:past.y};
 if(e.age>4&&near(player.x,player.y,past.x,past.y,26))hurt(25,'ton propre sillage');
 e.value=e.breaks/3;e.label=e.breaks+' / 3 BRISURES · '+(e.open>0?'BOUCLE OUVERTE':'SABLE À FOULER');
}

/* 4 · La Cueilleuse — économie. Progresser coûte de la puissance. */
function tickCueilleuse(e,dt){
 e.x=400+Math.sin(e.age*.35)*180;e.y=230;
 e.vulnerable=Math.max(0,e.vulnerable-dt);
 for(const lamp of e.lanterns){
  if(!lamp.lit&&flame>0&&near(player.x,player.y,lamp.x,lamp.y,48)){
   lamp.lit=true;flame--;habits.flames++;particle(lamp.x,lamp.y,'#f4c98f',18);
   say('LANTERNE ALLUMÉE · flamme '+flame+'/3 · cadence réduite',2.2);
   if(flame===0&&!meche)meche={x:clamp(player.x+120,80,720),y:280,age:0};
  }
 }
 e.steal-=dt;
 if(e.steal<=0){
  e.steal=5;
  const lit=e.lanterns.filter(l=>l.lit);
  if(lit.length&&e.vulnerable<=0){lit[0].lit=false;say('ELLE CUEILLE UNE FLAMME',1.8)}
 }
 if(e.lanterns.every(l=>l.lit)&&e.vulnerable<=0&&!e.used){e.vulnerable=3;e.used=true;say('TROIS FLAMMES · elle doit venir les cueillir',2.4)}
 if(e.vulnerable<=0&&e.used){e.used=false}
 e.value=e.collected/3;e.label=e.collected+' / 3 CUEILLETTES · FLAMME '+flame+'/3';
}

/* 5 · Le Chasseur — il lit tes habitudes et emprunte ce que tu utilises le plus. */
function tickChasseur(e,dt){
 e.x=400+Math.sin(e.age*.5)*170;e.y=220;
 if(e.naming){
  e.label='GESTE NON COPIÉ · '+HABITS[e.least];
  e.value=e.borrowed/3;
  offerGesture(e);
  return;
 }
 e.window-=dt;
 const habit=e.borrow[Math.min(e.borrowed,2)];
 e.grace=Math.max(0,(e.grace||1.6)-dt);
 if(habit==='halos'){
  e.halo=e.halo||{x:clamp(player.x,180,620),y:clamp(player.y,420,720),r:150};
  e.halo.r=Math.max(96,e.halo.r-8*dt);
  if(e.grace<=0&&!near(player.x,player.y,e.halo.x,e.halo.y,e.halo.r))hurt(25,'l’obscurité empruntée');
 }else if(habit==='salt'&&e.timer>1.4){
  e.timer=0;const past=pastPlayer(1);
  salt.push({x:clamp(past.x,50,750),y:clamp(past.y,320,830),r:60,age:0,life:2.4});
  if(salt.length>7)salt.shift();
 }else if(habit==='relays'&&e.timer>2.6){
  e.timer=0;
  if(liveFoes()<BUDGET.adds)spawnFoe('facelessEcho',e.x<400?620:180,260,0);
  addMark({x:player.x,y:player.y,r:70,warn:1.4,source:e,label:'EMPRUNT'});
 }else if(habit==='flames'&&e.timer>2.6){
  e.timer=0;flame=Math.max(1,flame-1);say('IL EMPRUNTE TA FLAMME · cadence réduite',1.8);
 }
 if(e.window<=0){
  e.window=8;e.grace=1.6;e.borrowed++;e.halo=null;salt=[];
  if(e.borrowed>=3){e.naming=true;say('IL N’A PLUS DE VISAGE · '+HABITS[e.least],3.4)}
  else say('EMPRUNT '+e.borrowed+'/3 · '+HABITS[e.borrow[Math.min(e.borrowed,2)]],2.6);
 }
 e.value=e.borrowed/3;e.label=e.borrowed+' / 3 EMPRUNTS · '+HABITS[habit];
}

function offerGesture(e){
 if(gesture&&gesture.kind===e.least)return;
 const kind=e.least;
 gesture={kind,done:false,time:0,
  tick(dt){
   this.time+=dt;
   if(this.done)return;
   let ok=false;
   if(kind==='relays')ok=!enemies.some(o=>!o.dead&&o.kind==='facelessEcho');
   else if(kind==='halos')ok=playerInHalo();
   else if(kind==='salt')ok=near(player.x,player.y,140,760,70)||near(player.x,player.y,660,760,70);
   else ok=!!(this.offered&&this.offered.dead);
   if(ok){this.done=true;gesture=null;boss.value=1;say('LE GESTE RENDU · l’heure n’a plus besoin de courir',3)}
  }};
 if(kind==='relays')spawnFoe('facelessEcho',400,280,0);
 if(kind==='halos')spawnFoe('wickWarden',400,300,0);
 if(kind==='flames'){const lamp=spawnFoe('hollowFlame',400,300,0);if(lamp){lamp.lit=true;gesture.offered=lamp}}
 say('ACCOMPLIS : '+HABITS[kind],3);
}

/* --- Frappes du joueur sur les cibles des gardiens ----------------------- */
function consume(shot){shot.life=0}
function hitTargets(){
 const e=boss;
 if(!e||e.dead||!active())return;
 for(const shot of shots){
  if(shot.life<=0)continue;
  if(e.kind==='veilleuse'){
   for(const w of e.windows)if(w.lit&&w.open>0&&near(shot.x,shot.y,w.x,w.y,26)){
    w.lit=false;w.open=0;consume(shot);particle(w.x,w.y,'#ffd9a0',16);tone(560,.2,'sine',.07,1.2);
    say('MÈCHE ÉTEINTE · '+e.windows.filter(v=>!v.lit).length+'/5',1.6);break;
   }
  }else if(e.kind==='sonneur'){
   if(e.clapper.down&&near(shot.x,shot.y,e.clapper.x,e.clapper.y,e.clapper.r+6)){
    e.strikes++;consume(shot);particle(e.clapper.x,e.clapper.y,'#cfe6d8',20);tone(880,.25,'triangle',.08,1.3);
    say('BATTANT FRAPPÉ · '+e.strikes+'/3',1.8);continue;
   }
   if(near(shot.x,shot.y,e.bell.x,e.bell.y,e.bell.r)){e.resonance=Math.min(100,e.resonance+7);consume(shot)}
  }else if(e.kind==='passeur'){
   if(e.open>0&&!e.openUsed&&near(shot.x,shot.y,e.x,e.y,e.r+8)){
    e.openUsed=true;e.breaks++;consume(shot);particle(e.x,e.y,'#e8dcc0',24);say('BOUCLE BRISÉE · '+e.breaks+'/3',1.8);
   }
  }else if(e.kind==='cueilleuse'){
   if(e.vulnerable>0&&near(shot.x,shot.y,e.x,e.y,e.r+8)){
    e.vulnerable=0;e.collected++;consume(shot);flame=3;
    for(const lamp of e.lanterns)lamp.lit=false;
    particle(e.x,e.y,'#f4c98f',26);say('CUEILLETTE FORCÉE · '+e.collected+'/3',2);
   }
  }
 }
}

/* --- Rendu : la silhouette vient de sixth-hour-art.js -------------------
   Les sprites détaillés sont enregistrés dans window.MinuitArt par le module
   artistique, qui ajoute ses couches d'animation. Ce wrapper ne fait que
   router les formes du monde 3 vers lui, y compris hors combat (aperçus). */
const baseSprite=sprite;
sprite=function(g,kind,x,y,s=1,t=0,hit=0,tint=''){
 if(active()&&(foeKinds.has(kind)||bossKinds.has(kind))&&window.SixthHourArt?.drawActor(g,{kind},x,y,s,t,hit))return;
 return baseSprite(g,kind,x,y,s,t,hit,tint);
};

function ring(g,x,y,r,color,dashed){
 g.save();g.strokeStyle=color;g.lineWidth=2.5;
 if(dashed)g.setLineDash([9,9]);
 g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.restore();
}

function draw(g){
 if(!active()||!['play','pause'].includes(state))return;
 for(const e of enemies){
  if(e.dead)continue;
  if(e.kind==='wickWarden'){g.save();g.globalAlpha=.16;g.fillStyle=world.moon;g.beginPath();g.arc(e.x,e.y,e.halo||150,0,Math.PI*2);g.fill();g.restore();ring(g,e.x,e.y,e.halo||150,world.moon+'88')}
  if(e.kind==='hollowFlame')ring(g,e.x,e.y,e.r+9,e.lit?world.moon:'#6b5a7d',!e.lit);
  if(e.kind==='crackedBell'&&e.twin&&!e.twin.dead){g.save();g.strokeStyle='#cfe6d877';g.lineWidth=1.5;g.beginPath();g.moveTo(e.x,e.y);g.lineTo(e.twin.x,e.twin.y);g.stroke();g.restore()}
  if(e.kind==='unnamedDigit'){g.save();g.fillStyle=e.digit===mission.digit?'#ffd9a0':'#7c6a8f';g.font='bold 16px Georgia';g.textAlign='center';g.fillText(String(e.digit),e.x,e.y-30);g.restore()}
  if(e.kind==='printThief'&&e.dashRun){g.save();g.fillStyle='#e8dcc0';g.font='11px Arial';g.textAlign='center';g.fillText('◆'.repeat(Math.min(3,e.dashRun)),e.x,e.y-28);g.restore()}
 }
 for(const s of salt){g.save();g.globalAlpha=Math.min(.5,.15+s.age*.2);g.fillStyle='#e8dcc0';g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill();g.restore()}
 for(const m of marks){
  const real=isReal(m),progress=Math.min(1,m.age/m.warn);
  g.save();g.globalAlpha=m.age>=m.warn?.5:.28;g.fillStyle=real?'#ffd9a0':'#b9a7c9';
  if(real){g.beginPath();g.arc(m.x,m.y,m.r*progress,0,Math.PI*2);g.fill()}
  g.restore();
  ring(g,m.x,m.y,m.r,real?'#ffd9a0':'#b9a7c9',!real);
  if(m.label&&m.age<m.warn){g.save();g.fillStyle=real?'#ffe6bd':'#c8b8d8';g.font=(compactView()?'15px':'11px')+' Arial';g.textAlign='center';g.fillText(m.label,m.x,m.y-m.r-8);g.restore()}
 }
 if(minute&&!minute.taken){
  ring(g,minute.x,minute.y,30,'#ffd9a0',minute.guard);
  g.save();g.fillStyle='#ffd9a0';g.font='22px Georgia';g.textAlign='center';g.fillText('◷',minute.x,minute.y+8);
  g.font=(compactView()?'14px':'10px')+' Arial';g.fillText(minute.guard?'GARDE ALLUMÉE':'MINUTE À PRENDRE',minute.x,minute.y+46);g.restore();
 }
 if(meche){g.save();g.fillStyle='#f4c98f';g.font='20px Georgia';g.textAlign='center';g.fillText('✦',meche.x,meche.y);g.restore()}
 const e=boss;
 if(!e||e.dead)return;
 if(e.kind==='veilleuse')for(const w of e.windows){
  ring(g,w.x,w.y,24,w.lit?'#ffd9a0':'#6b5a7d',!w.lit);
  g.save();g.fillStyle=w.lit?'#ffd9a0':'#4a3a5c';g.beginPath();g.arc(w.x,w.y,w.open>0?12:8,0,Math.PI*2);g.fill();
  if(w.open>0){g.fillStyle='#ffe6bd';g.font='10px Arial';g.textAlign='center';g.fillText('MÈCHE',w.x,w.y-32)}g.restore();
 }
 if(e.kind==='sonneur'){
  ring(g,e.bell.x,e.bell.y,e.bell.r,'#cfe6d8');
  g.save();g.globalAlpha=.12+e.resonance/260;g.fillStyle='#cfe6d8';g.beginPath();g.arc(e.bell.x,e.bell.y,e.bell.r,0,Math.PI*2);g.fill();g.restore();
  ring(g,e.clapper.x,e.clapper.y,e.clapper.r,e.clapper.down?'#ffd9a0':'#5c6f78',!e.clapper.down);
  if(e.ring>0)ring(g,e.bell.x,e.bell.y,e.ring*260,'#ffd9a0');
 }
 if(e.kind==='passeur'){
  for(const z of e.sand){g.save();g.globalAlpha=z.fresh?.22:.06;g.fillStyle='#e8dcc0';g.beginPath();g.arc(z.x,z.y,z.r,0,Math.PI*2);g.fill();g.restore();ring(g,z.x,z.y,z.r,z.fresh?'#e8dcc0':'#5b6a72',!z.fresh)}
  if(e.ghost){g.save();g.globalAlpha=.4;baseSprite(g,'witch',e.ghost.x,e.ghost.y,1,ambient);g.restore()}
  if(e.open>0)ring(g,e.x,e.y,e.r+12,'#ffd9a0');
 }
 if(e.kind==='cueilleuse'){
  for(const lamp of e.lanterns){ring(g,lamp.x,lamp.y,26,lamp.lit?'#f4c98f':'#6b5a7d',!lamp.lit);g.save();g.fillStyle=lamp.lit?'#f4c98f':'#3a2f4a';g.beginPath();g.arc(lamp.x,lamp.y,lamp.lit?13:7,0,Math.PI*2);g.fill();g.restore()}
  if(e.vulnerable>0)ring(g,e.x,e.y,e.r+12,'#ffd9a0');
 }
 if(e.kind==='chasseur'){
  if(e.halo){g.save();g.globalAlpha=.14;g.fillStyle=world.moon;g.beginPath();g.arc(e.halo.x,e.halo.y,e.halo.r,0,Math.PI*2);g.fill();g.restore();ring(g,e.halo.x,e.halo.y,e.halo.r,world.moon)}
  if(e.naming){ring(g,140,760,70,'#fff0bd');ring(g,660,760,70,'#fff0bd')}
 }
}

/* Jauge de gardien : remplace la barre de vie, sans y toucher pour les autres mondes. */
const baseDrawBossHealth=drawBossHealth;
drawBossHealth=function(g,e){
 if(!active()||!bossKinds.has(e.kind))return baseDrawBossHealth(g,e);
 if(e.y<150)return;
 const width=250,left=clamp(e.x-width/2,12,W-width-12),top=e.y-118;
 g.save();g.fillStyle='#120f24eb';g.fillRect(left-8,top-26,width+16,58);
 g.textAlign='center';g.fillStyle='#f8d8b6';g.font=compactView()?'bold 16px Georgia':'13px Georgia';
 g.fillText(world.boss,left+width/2,top-8);
 g.fillStyle='#3b2946';g.fillRect(left,top,width,7);
 g.fillStyle=world.moon;g.fillRect(left,top,width*clamp(e.value||0,0,1),7);
 g.fillStyle='#e2d7e6';g.font=compactView()?'13px Arial':'10px Arial';
 g.fillText(e.label||'',left+width/2,top+22);g.restore();
};

const baseUpdateHUD=updateHUD;
updateHUD=function(...args){
 const result=baseUpdateHUD(...args);
 if(!active())return result;
 const e=enemies.find(v=>v.boss&&!v.dead);
 if(e&&bossKinds.has(e.kind)){
  $('bossbar').classList.remove('hidden');
  $('bossname').textContent=world.boss;
  $('bosshp').style.width=Math.round(clamp(e.value||0,0,1)*100)+'%';
  $('bossphase').textContent=(e.label||'')+' · '+VICTORY[e.kind];
 }
 return result;
};

/* --- Récits : briefing, épilogue du monde 2, révélation du monde 3 -------- */
function briefing(){
 if(!window.Campaign?.progress?.world3Unlocked)return;
 state='sixth-briefing';
 overlay(`<section class="sequel-briefing"><div class="eyebrow">TROISIÈME CAMPAGNE · LA SIXIÈME HEURE</div><h2 class="local-title">L’Heure<br>aux Trousses</h2><p>Le cycle est réparé, et pourtant la nuit compte une heure de trop. Elle n’a pas de chiffre, pas de cloche, et tout le monde y a couru au moins une fois. C’est l’heure des poursuites. Elle se referme, et ce qu’elle tient encore doit être rendu — à commencer par la flamme du Veilleur.</p><blockquote>« Ma lanterne brûle avec une heure qui n’est pas à moi. Le jour où elle la reprend, il ne restera personne pour veiller. »</blockquote><div class="local-rule">Ici, la difficulté ne monte pas avec le nombre d’ennemis : elle monte avec ce qu’il faut comprendre. Chaque gardien a sa jauge et sa condition de victoire — aucune barre de vie. Trois minutes rendues par univers, quinze au total, décident de la fin du voyage.</div><div class="sequel-character-grid"><button class="sequel-character" id="sixthWitch"><span class="sequel-character-art"><img src="${window.MinuitArt.witch.src}" alt=""></span><b>La sorcière</b><small>« Tu m’as chassée toute une nuit. Laisse-moi courir pour toi, cette fois. »</small></button><button class="sequel-character" id="sixthHunter"><span class="sequel-character-art"><img src="${window.MinuitArt.hunter.src}" alt=""></span><b>Le Veilleur</b><small>« C’est ma flamme. C’est ma dette. Reste derrière moi. »</small></button></div><div class="local-actions"><button class="secondary" id="sixthBack">Retour au menu</button></div></section>`);
 /* beginWorld contourne le briefing : sans lui, l'écran se rappellerait en boucle. */
 $('sixthWitch').onclick=()=>{window.Campaign.progress.character='witch';window.Campaign.beginWorld(3)};
 $('sixthHunter').onclick=()=>{window.Campaign.progress.character='hunter';window.Campaign.beginWorld(3)};
 $('sixthBack').onclick=()=>LocalLeague.menu();
 return true;
}

const baseFinish=Journey.finish;
Journey.finish=function(win){
 const world_=window.Campaign?.activeWorld;
 const result=baseFinish(win);
 if(!win||window.SandboxMode)return result;
 const screen=document.querySelector('#overlay .journey-result-screen');
 if(!screen)return result;
 if(world_===2&&window.Campaign.progress.world3Unlocked&&!screen.querySelector('#sixthEpilogue')){
  const box=document.createElement('section');box.className='victory-milestones';box.id='sixthEpilogue';
  box.innerHTML='<b>LA NUIT A REPRIS SA COURSE</b><p>Les cinq heures sont rentrées dans le cadran. L’aube a le droit de venir.<br>L’Horloger, à genoux, ne se défend pas : « Je n’en ai pris que cinq. Il en reste une. Je ne l’ai jamais trouvée. »<br>Ce soir-là, la lanterne du Veilleur baisse pour la première fois.</p><div class="local-actions"><button class="primary" id="enterSixthHour">Entrer dans la sixième heure →</button></div>';
  screen.querySelector('.local-actions')?.before(box);
  $('enterSixthHour').onclick=()=>window.Campaign.startWorld(3);
 }
 if(world_===3&&!screen.querySelector('#sixthRevelation')){
  const box=document.createElement('section');box.className='victory-milestones';box.id='sixthRevelation';
  box.innerHTML='<b>ELLE N’EST PAS VIDE</b><p>« Vous m’avez appelée une heure perdue. Je ne perds rien. Je garde. Tout ce qui n’a jamais été rattrapé est chez moi. Et ceux qui vous ont échappé y vivent encore. »<br>Au fond du Bois des lanternes rendues, il y en a des centaines. Toutes allumées.<br><b>Les Introuvables.</b> Monde 4 · La Veillée.</p>';
  screen.querySelector('.local-actions')?.before(box);
 }
 return result;
};

function start(){reset();mission={key:stage+':'+wave,minuteTaken:false,seals:0,inverted:false,digit:1,digitTimer:5}}
function checkpoint(){return{flame,habits:{...habits},mission:{...mission}}}
function restore(data){
 reset();
 if(!data)return;
 flame=clamp(Number(data.flame)||3,0,3);
 habits={...freshHabits(),...(data.habits||{})};
 mission={...mission,...(data.mission||{})};
}

const style=document.createElement('style');
style.textContent='body.sixth-hour-theme{background:radial-gradient(ellipse at 22% 0,#2a2440,#12101f 68%)}body.sixth-hour-theme .home-hero{border-color:#d9a05f77}body.sixth-hour-theme .home-world-route{color:#ffd9a0}.sixth-hour-home .menu-kicker{color:#ffd9a0}';
document.head.appendChild(style);

window.SixthHour={
 BUDGET,TUNING,foeNames,VICTORY,RULES,HABITS,
 moveEnemy,moveBoss,tick,draw,waveBlocks,briefing,start,checkpoint,restore,keepMinute,
 isFoeKind:k=>foeKinds.has(k),isBossKind:k=>bossKinds.has(k),
 get boss(){return boss},get mission(){return mission},get habits(){return habits},
 get flame(){return flame},get marks(){return marks},get salt(){return salt},
 tune:()=>tune(),liveFoes
};
})();
