'use strict';
/* Monde 3 · La Sixième Heure.
   Ce test charge les VRAIS game.js, journey.js, nemesis.js, sequel.js et
   sixth-hour.js. Il verrouille le cahier des charges :
   1. budgets tenus ( davantage de monstres et de tirs, demandés explicitement ) ;
   2. règles lisibles : mots écrits à l'écran, objectif permanent ;
   3. cinq gardiens SANS barre de vie, aux conditions de victoire distinctes ;
   4. héritage réel des mécaniques des mondes 1 et 2 ;
   5. chaîne de déblocage 1 → 2 → 3 et minutes rendues persistées. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* --- DOM minimal : enough pour les modules de récit, sans navigateur ------ */
const ctx2d = new Proxy({
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  measureText: s => ({ width: String(s).length * 6 })
}, { get: (o, k) => (k in o ? o[k] : () => {}) });

const store = new Map();
const els = new Map();
/* classList réel : un stub vide rendrait tout garde-fou de visibilité aveugle. */
function realClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    toggle(c, force) { const on = force === undefined ? !set.has(c) : !!force; on ? set.add(c) : set.delete(c); return on; },
    contains: c => set.has(c)
  };
}
function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, innerHTML: '', textContent: '', title: '', onclick: null,
    classList: realClassList(),
    getContext: () => ctx2d,
    getBoundingClientRect: () => ({ width: 800, height: 900, top: 0, left: 0 }),
    addEventListener() {}, removeEventListener() {}, setAttribute() {},
    insertAdjacentHTML() {}, insertAdjacentElement() {}, appendChild() {}, remove() {},
    querySelector: sel => makeEl('q:' + sel), querySelectorAll: () => [], before() {}, after() {},
    closest: () => makeEl('closest'), scrollTop: 0, complete: true, naturalWidth: 86, naturalHeight: 124
  };
  return el;
}
function el(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); }

// Comme dans un navigateur, `window` EST l'objet global : les modules écrivent
// `window.Journey` puis lisent le global nu `Journey`.
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.MinuitArt = { witch: { src: 'witch.svg' }, hunter: { src: 'hunter.svg' } };
global.document = {
  head: { appendChild() {}, insertAdjacentHTML() {} },
  body: { innerHTML: '', classList: realClassList(), appendChild() {} },
  getElementById: el,
  querySelector: sel => (sel.includes('journey-result-screen') ? null : (sel === '.sidebar' || sel === '.arena' || sel === '.layout' ? el(sel) : null)),
  querySelectorAll: () => [],
  createElement: () => makeEl('created'),
  addEventListener() {}
};
global.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
global.Image = class { constructor() { this.complete = true; this.naturalWidth = 96; this.naturalHeight = 96; } addEventListener() {} set src(v) { this._src = v; } get src() { return this._src; } };
global.devicePixelRatio = 1;
global.innerWidth = 1366;
global.innerHeight = 900;
global.requestAnimationFrame = () => 0;
global.matchMedia = () => ({ matches: false, addEventListener() {} });
Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [] }, configurable: true });
global.confirm = () => true;
global.fetch = () => Promise.resolve({ json: () => Promise.resolve({}) });
Object.defineProperty(global, 'performance', { value: { now: () => Date.now() }, configurable: true });
global.MutationObserver = class { observe() {} disconnect() {} };
global.Audio = class { play() { return Promise.resolve(); } pause() {} addEventListener() {} };

/* --- Chargement de la chaîne réelle (ordre d'index.html) ----------------- */
let code = '';
for (const file of ['game.js', 'online.js', 'journey.js', 'nemesis.js', 'sequel.js', 'sixth-hour.js', 'sixth-hour-art.js', 'sixth-scenery.js', 'sixth-labyrinth.js']) {
  code += `\n;/* ==== ${file} ==== */\n` + read(file);
}

code += `
;(function(){
const out={};
const Camp=window.Campaign,SH=window.SixthHour;

/* 1 · Structure du monde 3 */
out.thirdWorlds=Camp.thirdWorlds.map(w=>({name:w.name,kind:w.kind,foes:w.foes,hour:w.hour,short:w.short}));
out.victory=SH.VICTORY;out.budget=SH.BUDGET;out.tuning=SH.TUNING;

/* 2 · Chaîne de déblocage : monde 2 accompli -> monde 3 + carte 02 */
const beforeFresh=Camp.progress.world3Unlocked;
Camp.unlockSecondWorld();
out.unlock={fresh:beforeFresh,world3Unlocked:Camp.progress.world3Unlocked,card:Camp.progress.cardSixthHour,
  world2Completed:Camp.progress.world2Completed,lastWorld:Camp.progress.lastWorld,menuWorld:Camp.menuWorld};

/* 3 applyWorld(3) doit charger les cinq univers du monde 3 */
Camp.useClassicWorld();
const classic=worlds[0].name;
// Première entrée : le briefing s'affiche, puis le choix du personnage lance le vol.
Camp.startWorld(3);
out.briefing={state,started:Camp.progress.world3Started};
document.getElementById('sixthWitch').onclick();
out.apply={activeWorld:Camp.activeWorld,first:worlds[0].name,classic,count:worlds.length,runId,state};

/* 4 · Vagues et objectifs */
function freshWave(w){
  stage=0;world=worlds[0];wave=w;state='play';enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];
  SH.marks.length=0;SH.salt.length=0;player.x=400;player.y=700;player.inv=0;player.dash=0;player.slow=0;lives=3;
  newWave();
}
freshWave(1);out.rule1=SH.RULES[0];
freshWave(2);out.wave2Blocks=SH.waveBlocks();
freshWave(3);waveTime=0;out.wave3Blocks=SH.waveBlocks();waveTime=23;out.wave3Held=SH.waveBlocks();
SH.tick(0.02);out.wave3Minute=!!SH.minute;
if(SH.minute){player.x=SH.minute.x;player.y=SH.minute.y;SH.tick(0.02)}
out.wave3After=SH.waveBlocks();
freshWave(4);out.wave4={blocks:SH.waveBlocks(),seals:enemies.filter(e=>e.seal).length};

/* 5 · Plafond d'ennemis : on tente d'en faire apparaître beaucoup plus */
freshWave(1);
for(let i=0;i<40;i++)spawnEnemy({kind:'wickWarden',x:120+(i%5)*140,group:1,index:i%2,pattern:99});
out.foeCap={live:SH.liveFoes(),max:SH.tune().foes,budget:SH.BUDGET.foes};

/* 6 · Héritage protecteur : les dégâts sont réduits dans le halo, pas ailleurs */
freshWave(1);
spawnEnemy({kind:'wickWarden',x:400,y:300,group:1,index:0,pattern:99});
const warden=enemies[enemies.length-1];warden.y=300;warden.homeY=300;warden.halo=150;
spawnEnemy({kind:'bronzeCrow',x:400,y:300,group:2,index:1,pattern:99});
const inside=enemies[enemies.length-1];inside.y=300;inside.homeY=300;inside.hp=inside.max=100;
const hpBefore=inside.hp;player.x=400;player.y=300;damageEnemy(inside,10,false);
out.wardIn=hpBefore-inside.hp;
player.x=60;player.y=820;inside.x=700;const hp2=inside.hp;damageEnemy(inside,10,false);
out.wardOut=hp2-inside.hp;

/* 7 · Relais annulable : tuer la source annule son télégraphe */
freshWave(1);
spawnEnemy({kind:'waxCourier',x:400,y:300,group:1,index:0,pattern:99});
const courier=enemies[enemies.length-1];courier.y=300;courier.homeY=300;courier.timer=0;
SH.moveEnemy(courier,1/60);
out.marksBefore=SH.marks.length;
const realMark=SH.marks.find(m=>m.real),lureMark=SH.marks.find(m=>!m.real);
out.lureLanguage=!!(realMark&&lureMark);
reward(courier);SH.tick(1/60);
out.relays=SH.habits.relays;

/* 8 · Vague 4 : plus d'inversion. DANGER blesse, LEURRE ne blesse pas,
   dans toutes les vagues — c'était la principale source d'incompréhension. */
freshWave(4);
spawnEnemy({kind:'waxCourier',x:400,y:300,group:1,index:0,pattern:99});
const c4=enemies[enemies.length-1];c4.y=300;c4.homeY=300;c4.timer=0;c4.shotCycle=0;SH.moveEnemy(c4,1/60);
const filled=SH.marks.find(m=>m.real),lure4=SH.marks.find(m=>!m.real);
player.x=filled.x;player.y=filled.y;player.inv=0;player.dash=0;player.shield=0;lives=3;
filled.age=filled.warn;SH.tick(1/60);
out.dangerHurts=lives;
lives=3;player.x=lure4.x;player.y=lure4.y;player.inv=0;lure4.age=lure4.warn;SH.tick(1/60);
out.lureHarmless=lives;
out.noInversion=SH.mission.inverted===undefined;

/* 9 · Cloches fêlées : briser l'une fige les tirs de l'autre */
freshWave(1);
spawnEnemy({kind:'crackedBell',x:300,y:300,group:1,index:0,pattern:99});
const bellA=enemies[enemies.length-1];
spawnEnemy({kind:'crackedBell',x:500,y:300,group:1,index:1,pattern:99});
const bellB=enemies[enemies.length-1];
out.twin=bellA.twin===bellB;
hostile=[{x:500,y:400,vx:0,vy:120,r:7,damage:25,type:'spirit',life:5,owner:bellB,age:0}];
reward(bellA);
out.freeze={frozen:hostile[0].frozen===true,vy:hostile[0].vy,left:hostile[0].freezeLeft};

/* 10 · Marcheuse de sel : elle reprend la position passée du joueur */
freshWave(1);
gameTime=10;player.x=200;player.y=600;SH.tick(1/60);
gameTime=12;player.x=600;player.y=700;
spawnEnemy({kind:'saltWalker',x:400,y:300,group:1,index:0,pattern:99});
const walker=enemies[enemies.length-1];walker.y=300;walker.homeY=300;walker.timer=0;
SH.moveEnemy(walker,1/60);
out.salt={count:SH.salt.length,x:SH.salt[0]&&Math.round(SH.salt[0].x)};

/* 11 · Les cinq gardiens : jauge, pas de barre de vie, victoires distinctes */
function bossFor(index){
  stage=index;world=worlds[index];wave=5;state='play';
  enemies=[];hostile=[];shots=[];drops=[];SH.marks.length=0;SH.salt.length=0;
  player.x=400;player.y=700;player.inv=99;player.dash=0;lives=3;clears=index;
  spawnBoss();
  const e=enemies.find(v=>v.boss);e.y=190;e.age=10;
  return e;
}
out.bosses=[];
for(let i=0;i<5;i++){
  const e=bossFor(i);
  const hp=e.hp;damageEnemy(e,999,false);
  SH.moveBoss(e,1/60);
  out.bosses.push({kind:e.kind,hp,max:e.max,unchanged:e.hp===hp,label:e.label,value:e.value,victory:SH.VICTORY[e.kind]});
}

/* 11a · La Veilleuse : les mèches s'éteignent par la fenêtre de tir, pas par les dégâts */
let v=bossFor(0);
v.windows.forEach(w=>w.open=2);
for(const w of v.windows)shots.push({x:w.x,y:w.y,vx:0,vy:-100,life:1,damage:5,pierce:0,seen:new Set()});
SH.tick(1/60);
out.veilleuse={lit:v.windows.filter(w=>w.lit).length};
v.windows.forEach(w=>{w.lit=false});SH.moveBoss(v,1/60);
out.veilleuse.value=v.value;out.veilleuse.phase=v.phase;
v.core.open=2;shots=[{x:v.core.x,y:v.core.y,vx:0,vy:-100,life:1,damage:5,pierce:0,seen:new Set()}];SH.tick(1/60);SH.moveBoss(v,1/60);out.veilleuse.coreHits=v.core.hits;out.veilleuse.coreValue=v.value;

/* 11b · Le Sonneur : tirer sur la cloche monte la résonance, le battant se frappe à côté */
let s=bossFor(1);
s.clapper.down=false;
shots=[{x:s.bell.x,y:s.bell.y,vx:0,vy:-100,life:1,damage:5,pierce:0,seen:new Set()}];
SH.tick(1/60);
out.sonneur={resonance:s.resonance,strikes:s.strikes};
s.clapper.down=true;s.clapper.x=s.bell.x+150;
shots=[{x:s.clapper.x,y:s.clapper.y,vx:0,vy:-100,life:1,damage:5,pierce:0,seen:new Set()}];
SH.tick(1/60);
out.sonneur.strikesAfter=s.strikes;

/* 11c · Le Passeur : le sable intact ouvre la boucle, les dégâts ne servent à rien */
let p=bossFor(2);
player.x=p.sand[0].x;player.y=p.sand[0].y;SH.moveBoss(p,1/60);
out.passeur={open:p.open>0,fresh:p.sand.filter(z=>z.fresh).length};
shots=[{x:p.x,y:p.y,vx:0,vy:-100,life:1,damage:5,pierce:0,seen:new Set()}];
SH.tick(1/60);
out.passeur.breaks=p.breaks;

/* 11d · La Cueilleuse : allumer coûte de la flamme et réduit la cadence */
let c=bossFor(3);
out.cueilleuse={flameBefore:SH.flame};
player.x=c.lanterns[0].x;player.y=c.lanterns[0].y;SH.moveBoss(c,1/60);SH.tick(1/60);
out.cueilleuse.flameAfter=SH.flame;out.cueilleuse.lit=c.lanterns.filter(l=>l.lit).length;
player.fire=0;SH.tick(1/60);out.cueilleuse.fireUntouched=player.fire===0;
out.cueilleuse.delay=SH.fireDelay();

/* 11e · Le Chasseur : il lit les habitudes et emprunte les plus utilisées */
let h=bossFor(4);
out.chasseur={borrow:h.borrow.slice(),least:h.least,borrowed:h.borrowed,naming:h.naming};
for(let i=0;i<3;i++){h.window=0;SH.moveBoss(h,1/60)}
out.chasseur.after={borrowed:h.borrowed,naming:h.naming};

/* 11f · Boucle de jeu RÉELLE : le dispatch doit tenir les plafonds en partie. */
Camp.beginWorld(3);
stage=0;world=worlds[0];wave=1;state='play';clears=0;
enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];scares=[];
SH.marks.length=0;SH.salt.length=0;newWave();
let maxFoes=0,maxHostile=0,crashes=0;const perStage=[];
for(const index of [0,1,3,4]){
  stage=index;world=worlds[index];wave=1;state='play';
  enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];
  SH.marks.length=0;SH.salt.length=0;newWave();
  let foes=0,shotsMax=0;
  for(let i=0;i<900;i++){
    player.inv=99;player.x=200+(i%400);player.y=650;
    try{update(1/60)}catch(err){crashes++;if(crashes===1)out.crashMessage=String(err&&err.message||err)}
    foes=Math.max(foes,enemies.filter(e=>!e.dead&&!e.boss).length);
    shotsMax=Math.max(shotsMax,hostile.length);
  }
  maxFoes=Math.max(maxFoes,foes);maxHostile=Math.max(maxHostile,shotsMax);
  perStage.push({index,foes,shotsMax,cap:SH.tune().foes});
}
out.loop={crashes,maxFoes,maxHostile,perStage};

/* 11f-bis · RÉGRESSION du bug « la sorcière ne tire plus ».
   tickFlame remontait player.fire à chaque image : flamme < 3 = tir mort. */
Camp.beginWorld(3);stage=3;world=worlds[3];wave=1;state='play';
enemies=[];hostile=[];shots=[];SH.marks.length=0;newWave();
const lamp=SH.isFoeKind('hollowFlame')&&(spawnEnemy({kind:'hollowFlame',x:400,y:300,group:1,index:0,pattern:99}),enemies[enemies.length-1]);
if(lamp){lamp.lit=true;reward(lamp)}
out.shootBug={flame:SH.flame,delay:SH.fireDelay()};
let fired=0,seen=0;
for(let i=0;i<240;i++){
  player.inv=99;player.x=400;player.y=700;
  const before=shots.length;
  update(1/60);
  if(shots.length>before)fired++;
  seen=Math.max(seen,shots.length);
}
out.shootBug.fired=fired;out.shootBug.seen=seen;
out.shootBug.flameEnd=SH.flame;

/* 11f-ter · Toutes les formes tirent vraiment des projectiles. */
const shooters={};
for(const kind of Object.keys(SH.foeNames)){
  freshWave(1);
  spawnEnemy({kind,x:400,y:300,group:1,index:0,pattern:99});
  const foe=enemies[enemies.length-1];
  foe.y=300;foe.homeY=300;foe.timer=0;hostile=[];
  SH.moveEnemy(foe,1/60);
  shooters[kind]=hostile.length;
}
out.shooters=shooters;

/* 11f-quater · Lisibilité : consigne permanente et marche à suivre par gardien. */
freshWave(2);out.clarity={wave2:SH.objectiveText()};
freshWave(3);out.clarity.wave3=SH.objectiveText();
freshWave(4);out.clarity.wave4=SH.objectiveText();
stage=0;world=worlds[0];freshWave(1);out.clarity.wave1=SH.objectiveText();
out.clarity.howto=Object.keys(SH.HOWTO);
out.clarity.plainRules=SH.RULES.every(r=>r.length>25&&!/^[A-ZÉÈÀ]+ ·/.test(r)&&/[a-zéèàù]{4,}/.test(r));

/* 11g · Un gardien dans la boucle réelle : sa jauge remplace la barre de vie. */
stage=0;world=worlds[0];wave=5;state='play';enemies=[];hostile=[];shots=[];
spawnBoss();
let bossCrashes=0;
for(let i=0;i<420;i++){
  player.inv=99;player.x=400;player.y=700;
  try{update(1/60)}catch(err){bossCrashes++;if(bossCrashes===1)out.bossCrashMessage=String(err&&err.message||err)}
}
const liveBoss=enemies.find(e=>e.boss&&!e.dead);
out.loopBoss={crashes:bossCrashes,hp:liveBoss&&liveBoss.hp,label:liveBoss&&liveBoss.label,
  domBarHidden:document.getElementById('bossbar').classList.contains('hidden'),
  hostile:hostile.length};

/* 12 · Minutes rendues : 15 maximum, persistées */
for(let i=0;i<20;i++)Camp.keepMinutes(1);
out.minutes=Camp.progress.minutesKept;

/* 13 · Sauvegarde : ancienne progression acceptée, nouvelle validée */
let legacyOK=true,corruptRejected=false;
try{Camp.validateSave({saves:{[Camp.key]:{version:1,world1Completed:true,world2Unlocked:true,world2Completed:false,cardOath:true,world2Started:true,lastWorld:2,choice:'dawn',character:'witch'}}})}catch{legacyOK=false}
try{Camp.validateSave({saves:{[Camp.key]:{version:1,world1Completed:true,world2Unlocked:true,world2Completed:true,cardOath:true,world2Started:true,lastWorld:3,choice:'',character:'witch',world3Unlocked:true,minutesKept:99}}})}catch{corruptRejected=true}
out.save={legacyOK,corruptRejected};

/* 14 · Code créateur « Monde3 » : même mécanisme que « Monde2 ». */
Camp.progress.world1Completed=false;Camp.progress.world2Unlocked=false;Camp.progress.world2Completed=false;
Camp.progress.world3Unlocked=false;Camp.progress.cardSixthHour=false;Camp.progress.world3Started=false;
const scoresBefore=JSON.stringify(highScores),recordsBefore=records.length,recentBefore=Journey.state.recent.length;
window.MinuitCloud={isTeamAdmin:false};
out.code={nonAdmin:Camp.redeemCreatorCode('Monde3'),nonAdminMonde2:Camp.redeemCreatorCode('Monde2')};
window.MinuitCloud={isTeamAdmin:true};
out.code.wrong=Camp.redeemCreatorCode('Monde4');
out.code.blank=Camp.redeemCreatorCode('');
out.code.accepted=Camp.redeemCreatorCode('  monde3  ');
out.code.state=state;out.code.activeWorld=Camp.activeWorld;
out.code.chain={w1:Camp.progress.world1Completed,w2u:Camp.progress.world2Unlocked,w2:Camp.progress.world2Completed,w3:Camp.progress.world3Unlocked,card:Camp.progress.cardSixthHour};
out.code.noScore=JSON.stringify(highScores)===scoresBefore&&records.length===recordsBefore&&Journey.state.recent.length===recentBefore;
document.getElementById('testWorld3').onclick();
out.code.launched={state,activeWorld:Camp.activeWorld};
// Première entrée : briefing, puis choix du personnage (ici le Veilleur).
document.getElementById('sixthHunter').onclick();
out.code.playing={state,activeWorld:Camp.activeWorld,runId,character:Camp.progress.character};
out.code.monde2StillWorks=Camp.redeemCreatorCode('Monde2');
out.code.finale=!!Camp.finale;
Camp.completeFinale();

/* 15 · Direction artistique et décors PROPRES au monde 3.
   Le monde 3 ne doit plus ni réutiliser les peintures du monde 1, ni dessiner
   ses monstres avec de simples polygones. */
const Art=window.SixthHourArt,Scenery=window.SixthScenery;
const gfx=document.createElement('canvas').getContext('2d');
out.art={kinds:Art.kinds.length,foes:Art.kinds.filter(k=>!Art.isBossKind(k)).length,
  bosses:Art.kinds.filter(k=>Art.isBossKind(k)).length,
  registered:Art.kinds.filter(k=>window.MinuitArt[k]?.src).length,
  unique:new Set(Art.kinds.map(k=>window.MinuitArt[k].src)).size,
  ownPalette:Art.kinds.every(k=>window.MinuitArt[k].src.includes('softglow3')),
  coversBestiary:Camp.thirdWorlds.flatMap(w=>[...w.foes,w.kind]).every(k=>Art.isSixthKind(k)),
  detail:Object.fromEntries(Art.kinds.map(k=>[k,(decodeURIComponent(window.MinuitArt[k].src).match(/<(path|circle|ellipse|rect|polygon)/g)||[]).length])),
  witchDetail:34};
/* Deux garde-fous de rendu, trouvés en rastérisant vraiment les sprites :
   un dégradé sur une boîte de surface nulle ne s'affiche pas, et une pointe
   hors du viewBox est rognée. */
// On n'inspecte que le corps : les <defs> contiennent un motif en notation
// relative (M0 0V6) qui n'a rien à voir avec la silhouette.
const svgOf=k=>{const svg=decodeURIComponent(window.MinuitArt[k].src.replace('data:image/svg+xml;charset=utf-8,',''));
 return svg.slice(0,svg.indexOf('</defs>')+7)+'<body>'+svg.slice(svg.indexOf('</defs>')+7);};
const bodyOf=k=>svgOf(k).split('<body>')[1];
const viewOf=k=>svgOf(k).split('<body>')[0];
const pairs=d=>(d.match(/-?\\d+\\.?\\d*/g)||[]).map(Number);
out.art.noDegenerateGradient=Art.kinds.every(k=>!(bodyOf(k).match(/<path[^>]+>/g)||[]).some(el=>{
 if(!el.includes('url(#'))return false;
 const d=/ d="([^"]+)"/.exec(el);if(!d)return false;
 const n=pairs(d[1]),xs=n.filter((_,i)=>i%2===0),ys=n.filter((_,i)=>i%2===1);
 return n.length>0&&(Math.max(...xs)-Math.min(...xs)<.01||Math.max(...ys)-Math.min(...ys)<.01);
}));
out.art.nothingClipped=Art.kinds.every(k=>{
 const view=/viewBox="([^"]+)"/.exec(viewOf(k))[1].split(/\\s+/).map(Number);
 const [vx,vy,vw,vh]=view;
 const body=bodyOf(k);
 const shapes=(body.match(/<(path|circle|ellipse|rect|polygon)/g)||[]).length;
 const paths=body.match(/<path[^>]+>/g)||[];
 if(shapes<12||paths.length<4)return false;
 return paths.every(el=>{
   const d=/ d="([^"]+)"/.exec(el);if(!d)return true;
   const n=pairs(d[1]),xs=n.filter((_,i)=>i%2===0),ys=n.filter((_,i)=>i%2===1);
   if(n.length<4)return false;
   return xs.every(x=>x>=vx-1&&x<=vx+vw+1)&&ys.every(y=>y>=vy-1&&y<=vy+vh+1);
  });
});
Camp.beginWorld(3);
out.art.drawsFoe=Art.drawActor(gfx,{kind:'wickWarden',seed:1},400,300,1,2,0);
out.art.drawsBoss=Art.drawActor(gfx,{kind:'chasseur',borrowed:1,naming:true},400,300,2.3,2,0);
out.art.rejectsForeign=Art.drawActor(gfx,{kind:'ghost'},400,300,1,2,0);
// sprite() doit déléguer au module artistique, plus dessiner de polygones.
const realDraw=Art.drawActor;let spied=0;
Art.drawActor=function(...a){spied++;return realDraw.apply(this,a)};
sprite(gfx,'wickWarden',400,300,1,0,0);
out.art.spriteDelegates=spied>0;
Art.drawActor=realDraw;
// Le décor peint vient bien du monde 3, univers par univers.
const realPick=Scenery.pick;let picked=[];
Scenery.pick=function(s){picked.push(s);return realPick(s)};
drawBackground(0);
out.art.backgroundUsesWorld3=picked.length>0;
Scenery.pick=realPick;
out.scenery={count:Scenery.images.length,
  unique:new Set(Scenery.images.map(i=>i.src)).size,
  perStage:[0,1,2,3,4].every((s,i)=>Scenery.pick(s)===Scenery.images[i]),
  painted:Scenery.images.every(i=>String(i.src).startsWith('data:image/jpeg;base64,')),
  distinctFromWorld1:Scenery.images.every(i=>!(window.MinuitScenery||[]).some(o=>o.src===i.src))};
Camp.useClassicWorld();
out.art.drawsInWorld1=Art.drawActor(gfx,{kind:'wickWarden'},400,300,1,2,0);
out.scenery.world1=Scenery.pick(0);
Camp.beginWorld(3);

/* 17 · LABYRINTHE : le style de jeu change vraiment (monde 3 seulement). */
const Lab=window.SixthLabyrinth;
out.labyrinth={present:!!Lab};
function labScene(index,w){
  Camp.beginWorld(3);
  stage=index;world=worlds[index];wave=w;state='play';
  enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];
  SH.marks.length=0;SH.salt.length=0;
  player.x=400;player.y=650;player.inv=0;player.dash=0;player.slow=0;
  lives=9;score=0;scrollVelocity=120;
  Lab.reset();Lab.tick(0);
}

/* Le défilement est bien plus rapide, et seulement dans le monde 3. */
labScene(2,1);
const boosted=targetScrollSpeed();
Camp.useClassicWorld();stage=2;world=worlds[2];wave=1;
const classicSpeed=targetScrollSpeed();
out.labyrinth.speed={boosted,classicSpeed,factor:Lab.speedBoost};
Camp.beginWorld(2);stage=2;wave=1;state='play';
out.labyrinth.speedWorld2=targetScrollSpeed();
Camp.useClassicWorld();

/* Chaque rangée laisse une brèche, et la route zigzague. */
labScene(0,1);
const gapsPerRow=[],hpPerStage=[];
for(let i=0;i<10;i++){
  const before=Lab.walls.length;Lab.spawnRow();
  const row=Lab.walls.slice(before);
  gapsPerRow.push(Lab.COLS-row.filter(w=>!w.switch).length);
}
out.labyrinth.rows={count:Lab.walls.length,gaps:gapsPerRow,
  columns:new Set(Lab.walls.map(w=>Math.round((w.x-Lab.CELL/2)/Lab.CELL))).size};
for(const index of [0,2,4]){labScene(index,1);Lab.spawnRow();hpPerStage.push(Lab.walls[0].max)}
out.labyrinth.hpPerStage=hpPerStage;
out.labyrinth.materials=Lab.MATERIALS.map(m=>m.name);

/* Faubourg : les trois runes s'activent dans l'ordre et ouvrent les deux voies. */
labScene(0,1);
for(let i=0;i<3;i++)Lab.spawnRow();
const fork=Lab.routeRows[0];
const forkWalls=Lab.walls.filter(w=>w.row===2);
out.labyrinth.fork={
  every:Lab.FORK_EVERY,
  count:Lab.routeRows.length,
  gates:forkWalls.filter(w=>w.locked).length,
  runes:forkWalls.filter(w=>w.switch).length,
  cache:forkWalls.some(w=>w.routeCache&&w.bonus),
  narrow:fork?.narrowX,
  wide:fork?.wideX,
  labels:/RUNES A → B → C/.test(read('sixth-labyrinth.js'))&&/CACHE FACULTATIVE/.test(read('sixth-labyrinth.js'))
};


/* Les runes A, B, C doivent être activées dans l'ordre pour ouvrir les portes. */
labScene(0,1);for(let i=0;i<3;i++)Lab.spawnRow();
const runes=Lab.walls.filter(w=>w.row===2&&w.switch).sort((a,b)=>a.sequenceIndex-b.sequenceIndex);
const gates=Lab.walls.filter(w=>w.row===2&&w.locked);
Lab.damageBlock(runes[1],99);
const wrongOrderRejected=!runes[1].dead&&runes[1].hp===99;
Lab.damageBlock(runes[0],2);
const secondEnabled=runes[1].hp===2;
Lab.damageBlock(runes[1],2);
const thirdEnabled=runes[2].hp===2;
Lab.damageBlock(runes[2],2);
out.labyrinth.puzzles={runes:runes.length,gates:gates.length,wrongOrderRejected,
  secondEnabled,thirdEnabled,allGatesOpened:gates.every(w=>w.dead)};

/* La cache reste un bonus latéral facultatif, sans contrôler les portes. */
labScene(0,1);for(let i=0;i<3;i++)Lab.spawnRow();
const cache=Lab.walls.find(w=>w.row===2&&w.routeCache&&w.bonus);
const cacheHp=cache&&cache.hp;if(cache)Lab.damageBlock(cache,cacheHp);
out.labyrinth.puzzles.cacheBreakable=!!cache?.dead;
out.labyrinth.puzzles.cacheNotGate=!!cache&&cache.gate==null;
out.labyrinth.puzzles.cacheOptional=!!cache?.optional;
out.labyrinth.puzzles.cacheWidth=cache?.w||0;
labScene(1,1);Lab.spawnRow();Lab.spawnRow();
const bellSwitch=Lab.walls.find(w=>w.row===1&&w.switch&&w.routeId==='narrow');
const narrowGate=Lab.walls.find(w=>w.row===1&&w.locked&&w.routeId==='narrow');
const wideGate=Lab.walls.find(w=>w.row===1&&w.locked&&w.routeId==='wide');
if(bellSwitch)Lab.damageBlock(bellSwitch,bellSwitch.hp);
out.labyrinth.puzzles.bronze={switchBroken:!!bellSwitch?.dead,narrowOpened:!!narrowGate?.dead,wideStillLocked:!!wideGate&&!wideGate.dead};

/* Les tirs cassent le décor : sans tir, pas de sortie. */
labScene(1,1);Lab.spawnRow();
const target=Lab.walls[0];
const hp0=target.hp,score0=score;
shots.push({x:target.x,y:target.y,damage:1,life:1,vx:0,vy:0,r:4});
Lab.tick(0.001);
out.labyrinth.shot={hp0,hp1:target.hp,consumed:shots[0].life<=0};
let guard=0;
while(!target.dead&&guard++<20){
  shots.push({x:target.x,y:target.y,damage:1,life:1,vx:0,vy:0,r:4});
  Lab.tick(0.001);
}
out.labyrinth.shot.broken=target.dead;
out.labyrinth.shot.score=score-score0;
out.labyrinth.shot.counter=Lab.broken;

/* COINCEMENT : le mur descend, pousse le joueur, puis le coince et le blesse. */
labScene(0,1);Lab.spawnRow();
const wall=Lab.walls.find(w=>Math.abs(w.x-400)<Lab.CELL);
player.x=wall.x;
wall.y=player.y-10;
const lives0=lives;
let pushed=0,pinned=0;
for(let i=0;i<400;i++){
  player.inv=0;player.dash=0;
  wall.y=Math.min(H-30-Lab.ROW_H/2-15,wall.y+3);
  Lab.tick(1/60);
  if(player.slow>0)pushed++;
  if(Lab.pinTime>0)pinned++;
}
out.labyrinth.pin={pushed,pinned,lives:lives0-lives,atFloor:Math.abs(player.y-(H-30))<2,slow:player.slow};

/* Une sortie latérale reste possible : le labyrinthe se joue, il ne piège pas. */
labScene(0,1);Lab.spawnRow();
const occupied=new Set(Lab.walls.map(w=>Math.round((w.x-Lab.CELL/2)/Lab.CELL)));
let gapCol=0;while(occupied.has(gapCol))gapCol++;
const edge=Lab.walls.filter(w=>w.x<gapCol*Lab.CELL).pop();
edge.y=600;player.y=600;player.x=edge.x+edge.w/2+13;
const xBefore=player.x;
Lab.tick(1/60);
out.labyrinth.escape={moved:Math.abs(player.x-xBefore)>1,pinTime:Lab.pinTime,gapCol};
/* Face à un bloc voisin, la sortie latérale est refusée : le mur pousse. */
labScene(0,1);Lab.spawnRow();
const pair=Lab.walls.filter(w=>Math.abs(w.x-450)<160);
for(const w of pair)w.y=600;
player.y=600;player.x=400;player.slow=0;
Lab.tick(1/60);
out.labyrinth.noPhase={slow:player.slow,pinTime:Lab.pinTime};

/* Le labyrinthe s'efface au changement de vague et pendant un gardien. */
labScene(0,1);Lab.spawnRow();
const beforeReset=Lab.walls.length;
wave=2;Lab.tick(1/60);
out.labyrinth.resetOnWave={before:beforeReset,after:Lab.walls.length};
labScene(0,5);
for(let i=0;i<600;i++)Lab.tick(1/60);
out.labyrinth.bossWave=Lab.walls.length;
labScene(0,1);
enemies.push({boss:true,dead:false,x:400,y:200,hp:50});
for(let i=0;i<600;i++)Lab.tick(1/60);
out.labyrinth.bossAlive=Lab.walls.length;

/* Mondes 1 et 2 : strictement aucun mur. */
const foreign=[];
for(const w of [1,2]){
  if(w===1)Camp.useClassicWorld();else Camp.beginWorld(2);
  stage=1;wave=1;state='play';Lab.reset();
  for(let i=0;i<600;i++)Lab.tick(1/60);
  foreign.push(Lab.walls.length);
}
out.labyrinth.foreign=foreign;
Camp.useClassicWorld();out.labyrinth.foreignSpeed=targetScrollSpeed();

/* Le rendu ne plante pas et peint vraiment les blocs. */
labScene(2,1);Lab.spawnRow();
for(const w of Lab.walls)w.y=300;
Lab.damageBlock(Lab.walls[0],2);
let painted=0;const realFill=gfx.fillRect.bind(gfx);
gfx.fillRect=function(...a){painted++;return realFill(...a)};
let drawCrash=null;
try{Lab.draw(gfx);SH.draw(gfx)}catch(err){drawCrash=String(err&&err.message||err)}
gfx.fillRect=realFill;
out.labyrinth.draw={crash:drawCrash,painted};

/* La boucle complète doit survivre au labyrinthe sur les cinq univers. */
let labCrashes=0,maxWalls=0;
for(const index of [0,1,2,3,4]){
  labScene(index,1);newWave();
  for(let i=0;i<600;i++){
    player.inv=99;player.x=120+(i%560);player.y=620+(i%80);
    try{update(1/60)}catch(err){labCrashes++;if(labCrashes===1)out.labyrinth.crashMessage=String(err&&err.message||err)}
    maxWalls=Math.max(maxWalls,Lab.walls.length);
  }
}
out.labyrinth.loop={crashes:labCrashes,maxWalls};
Camp.beginWorld(3);

/* 18 · BUTIN DANS LES MURS : le sceau est visible, le tirage est réel. */
const Lab2=window.SixthLabyrinth;
function bonusScene(index){
  Camp.beginWorld(3);stage=index;world=worlds[index];wave=1;state='play';
  enemies=[];hostile=[];shots=[];drops=[];obstacles=[];hazards=[];
  player.x=400;player.y=650;player.inv=99;player.dash=0;lives=9;score=0;
  scrollVelocity=120;Lab2.reset();Lab2.tick(0);
}
out.loot={kinds:Lab2.BONUS.map(b=>b.kind),chance:Lab2.BONUS_CHANCE};
bonusScene(0);
const rolls={none:0};
for(let i=0;i<4000;i++){
  const b=Lab2.rollBonus();
  if(!b){rolls.none++;continue}
  rolls[b.kind]=(rolls[b.kind]||0)+1;
}
out.loot.rolls=rolls;
// Un bloc scellé libère exactement son bonus ; un bloc nu ne libère rien.
Lab2.spawnRow();
const sealed=Lab2.walls[0];sealed.bonus=Lab2.BONUS.find(b=>b.kind==='shield');
const bare=Lab2.walls[1];bare.bonus=null;
drops=[];Lab2.damageBlock(bare,99);
out.loot.bareDrops=drops.length;
drops=[];Lab2.damageBlock(sealed,99);
out.loot.sealedDrops=drops.map(d=>d.kind);
out.loot.sealedAt=drops.length?Math.round(drops[0].x)===Math.round(sealed.x):false;
// Chaque sorte de sceau produit le bon objet, et l'arsenal retombe sur un trésor.
const produced={};
for(const b of Lab2.BONUS){
  bonusScene(2);Lab2.spawnRow();
  const w=Lab2.walls[0];w.bonus=b;drops=[];
  Lab2.damageBlock(w,99);
  produced[b.kind]=drops.map(d=>d.kind);
}
out.loot.produced=produced;
// En partie, les rangées portent vraiment des sceaux.
bonusScene(1);
for(let i=0;i<12;i++)Lab2.spawnRow();
out.loot.onRows={blocks:Lab2.walls.length,sealed:Lab2.walls.filter(w=>w.bonus).length};
let sealPainted=0;
const realFill2=gfx.fillRect.bind(gfx);gfx.fillRect=function(...a){sealPainted++;return realFill2(...a)};
for(const w of Lab2.walls)w.y=300;
Lab2.draw(gfx);gfx.fillRect=realFill2;
out.loot.painted=sealPainted;

/* 19 · VOLET CLAQUEUR : il bouche la route, et sa mort annule le claquement. */
function trickScene(index,w){
  Camp.beginWorld(3);stage=index;world=worlds[index];wave=w;state='play';
  enemies=[];hostile=[];shots=[];drops=[];marks=[];obstacles=[];
  SH.marks.length=0;SH.salt.length=0;SH.start();
  player.x=400;player.y=650;player.inv=0;player.dash=0;player.slow=0;lives=9;score=0;
  scrollVelocity=120;Lab2.reset();Lab2.tick(0);newWave();
}
trickScene(0,1);
spawnEnemy({kind:'shutterImp',x:400,y:300,group:1,index:0,pattern:99});
const imp=enemies[enemies.length-1];
imp.y=300;imp.homeY=300;imp.timer=0;
SH.moveEnemy(imp,1/60);
out.shutter={announced:SH.slams.length,warn:SH.slams[0]&&SH.slams[0].warn};
const wallsBefore=Lab2.walls.length;
SH.tick(0.5);out.shutter.earlyWalls=Lab2.walls.length-wallsBefore;
SH.tick(1.0);
out.shutter.panel=Lab2.walls.filter(w=>w.panel).length;
out.shutter.solid=Lab2.walls.filter(w=>w.panel).map(w=>w.max)[0];
// Tué avant l'échéance, le volet ne claque pas.
trickScene(0,1);
spawnEnemy({kind:'shutterImp',x:400,y:300,group:1,index:0,pattern:99});
const imp2=enemies[enemies.length-1];imp2.y=300;imp2.homeY=300;imp2.timer=0;
SH.moveEnemy(imp2,1/60);
reward(imp2);
SH.tick(1.6);
out.shutter.cancelled=Lab2.walls.filter(w=>w.panel).length;
// Le panneau se casse comme le reste du mur.
trickScene(0,1);
const panel=Lab2.addPanel(400,400);
const panelHp=panel.hp;
shots.push({x:panel.x,y:panel.y,damage:1,life:1,vx:0,vy:0,r:4});
Lab2.tick(0.001);
out.shutter.breakable={hp0:panelHp,hp1:panel.hp};

/* 20 · MOUCHEUR : il vole une mèche, s'en sert de halo, et la rend à sa mort. */
trickScene(3,1);
player.x=400;player.y=650;
spawnEnemy({kind:'snufferHand',x:400,y:400,group:1,index:0,pattern:99});
const snuffer=enemies[enemies.length-1];
snuffer.y=400;snuffer.homeY=400;snuffer.timer=0;
SH.moveEnemy(snuffer,1/60);
const snuffMark=SH.marks[SH.marks.length-1];
out.snuffer={mark:!!snuffMark&&snuffMark.snuff===true,flame0:SH.flame};
player.x=snuffMark.x;player.y=snuffMark.y;
SH.tick(1.3);
out.snuffer.flame1=SH.flame;out.snuffer.stolen=snuffer.stolen;
// Sa flamme volée protège les autres, comme le halo du Garde-mèche.
player.x=720;player.y=820;
spawnEnemy({kind:'waxCourier',x:400,y:400,group:2,index:0,pattern:99});
const shielded=enemies[enemies.length-1];
shielded.x=snuffer.x;shielded.y=snuffer.y;shielded.hp=100;shielded.max=100;
damageEnemy(shielded,10);
out.snuffer.protected=100-shielded.hp;
// Le tuer rend les mèches.
const flameBefore=SH.flame;
reward(snuffer);
out.snuffer.returned=SH.flame-flameBefore;
out.snuffer.haloGone=!!(snuffer.dead);

/* 21 · FAUX-CIERGE : le leurre se paie si on le ramasse, le tir le perce. */
trickScene(0,1);
spawnEnemy({kind:'waxMimic',x:400,y:400,group:1,index:0,pattern:99});
const mimic=enemies[enemies.length-1];
mimic.y=400;mimic.homeY=400;
out.mimic={disguised:mimic.disguise===true,art:!!window.MinuitArt.waxCierge};
const livesBefore=lives;
player.x=mimic.x;player.y=mimic.y;player.inv=0;
SH.tick(0.02);
out.mimic.bitten=livesBefore-lives;out.mimic.revealed=mimic.disguise===false;
// Tirer de loin le démasque sans mordre, et double les dégâts.
trickScene(0,1);
spawnEnemy({kind:'waxMimic',x:400,y:400,group:1,index:0,pattern:99});
const mimic2=enemies[enemies.length-1];
mimic2.y=400;mimic2.homeY=400;mimic2.hp=100;mimic2.max=100;
player.x=700;player.y=820;player.inv=0;
const lives2=lives;
damageEnemy(mimic2,10);
out.mimic.shot={hp:100-mimic2.hp,revealed:mimic2.disguise===false,lives:lives2-lives};
// Percé encore déguisé, il paie.
trickScene(0,1);
spawnEnemy({kind:'waxMimic',x:400,y:400,group:1,index:0,pattern:99});
const mimic3=enemies[enemies.length-1];mimic3.y=400;mimic3.homeY=400;
const scoreBefore=score;reward(mimic3);
out.mimic.bounty=score-scoreBefore;

/* 22 · MINUTES : trois par univers, quinze réellement ramassables. */
Camp.progress.minutesKept=0;
const minutesPerStage=[];
for(let index=0;index<5;index++){
  const before=Camp.progress.minutesKept;
  for(const w of [2,3,4]){
    trickScene(index,w);
    if(w===2){for(const e of enemies)if(e.kind==='wickWarden')e.dead=true}
    if(w===3)waveTime=23;
    if(w===4)SH.mission.seals=2;
    SH.tick(0.02);
    if(SH.minute){player.x=SH.minute.x;player.y=SH.minute.y;SH.tick(0.02)}
  }
  minutesPerStage.push(Camp.progress.minutesKept-before);
}
out.minuteRun={perStage:minutesPerStage,total:Camp.progress.minutesKept,token:!!window.MinuitArt.minuteToken};
trickScene(1,3);waveTime=0;SH.tick(0.02);
out.minuteRun.lockedBeforeHold=!SH.minute;
waveTime=23;SH.tick(0.02);
out.minuteRun.freeAfterHold=!!SH.minute;
out.minuteRun.label=SH.minute?SH.minute.index:0;
trickScene(1,2);
out.minuteRun.guardActive=!!(SH.minute&&SH.minute.guard);
out.minuteRun.objective=SH.objectiveText();

/* 23 · Plus aucun sprite en mode esquisse. */
out.sketch=Art.kinds.filter(k=>{
  const svg=decodeURIComponent(window.MinuitArt[k].src);
  return svg.slice(svg.indexOf('</defs>')).includes('stroke-dasharray');
});
out.faubourg={foes:Camp.thirdWorlds[0].foes.slice(),
  names:Camp.thirdWorlds[0].foes.map(k=>SH.foeNames[k]),
  sprites:Camp.thirdWorlds[0].foes.every(k=>!!window.MinuitArt[k])};

/* 24 · VEILLEUSE : une seule jauge, mèches dessinées, défense, tirage au sort. */
function wickScene(){
  Camp.beginWorld(3);stage=0;world=worlds[0];wave=5;state='play';
  enemies=[];hostile=[];shots=[];drops=[];marks=[];
  SH.marks.length=0;SH.start();
  player.x=400;player.y=700;player.inv=99;player.dash=0;lives=9;
  spawnBoss();
  const e=enemies.find(v=>v.boss&&!v.dead);
  e.y=250;e.age=0;e.relight=999;e.guard=999;e.openTimer=999;
  return e;
}
const veil=wickScene();
out.wicks={count:veil.windows.length,allLit:veil.windows.every(w=>w.lit),
  assets:!!window.MinuitArt.bossWick&&!!window.MinuitArt.bossFlame};
out.wicks.xs=veil.windows.map(w=>Math.round(w.x));
out.wicks.ys=veil.windows.map(w=>Math.round(w.y));
out.wicks.inBounds=veil.windows.every(w=>w.x>=80&&w.x<=720&&w.y>=300&&w.y<=416);
out.wicks.spaced=veil.windows.every((w,i)=>veil.windows.every((o,j)=>i===j||Math.abs(w.x-o.x)>60));
// Deux gardiens successifs ne doivent pas reproduire la même disposition.
const layouts=[out.wicks.xs.join(',')];
for(let i=0;i<6;i++){const v=wickScene();layouts.push(v.windows.map(w=>Math.round(w.x)).join(','))}
out.wicks.distinctLayouts=new Set(layouts).size;
const heights=[out.wicks.ys.join(',')];
for(let i=0;i<6;i++){const v=wickScene();heights.push(v.windows.map(w=>Math.round(w.y)).join(','))}
out.wicks.distinctHeights=new Set(heights).size;

/* Quelle mèche s'ouvre est tiré au sort, pas un tour de rôle 0-1-2-3-4. */
const openings=[];
for(let trial=0;trial<8;trial++){
  const v=wickScene();const seen=[];
  for(let i=0;i<6;i++){v.openTimer=0;SH.moveBoss(v,1/60);seen.push(v.windows.indexOf(v.lastOpen))}
  openings.push(seen.join(''));
}
out.wicks.openings=openings;
out.wicks.roundRobin=openings.filter(s=>s==='012345').length;
out.wicks.distinctOpenings=new Set(openings).size;
out.wicks.noImmediateRepeat=openings.every(s=>s.split('').every((c,i)=>i===0||c!==s[i-1]));

/* Le rallumage choisit une mèche au hasard, pas toujours la première. */
const relit=[];
for(let trial=0;trial<10;trial++){
  const v=wickScene();
  v.windows.forEach(w=>w.lit=false);
  v.windows[1].lit=false;v.relight=0;v.age=0;
  SH.moveBoss(v,1/60);
  relit.push(v.windows.findIndex(w=>w.lit));
}
out.wicks.relit=new Set(relit).size;

/* Défense : chaque mèche allumée est une bouche à feu, plafonnée au budget. */
const gun=wickScene();
gun.guard=0;hostile=[];
SH.moveBoss(gun,1/60);
out.wicks.charge=gun.windows.filter(w=>w.charge>0).length;
out.wicks.beforeCharge=hostile.length;
SH.moveBoss(gun,0.7);
out.wicks.fullVolley=hostile.length;
out.wicks.cap=SH.BUDGET.volley;
const lone=wickScene();
lone.windows.forEach((w,i)=>w.lit=i===0);
lone.guard=0;hostile=[];
SH.moveBoss(lone,1/60);SH.moveBoss(lone,0.7);
out.wicks.lastWickVolley=hostile.length;
// Éteindre une mèche pendant sa charge annule son tir.
const spared=wickScene();
spared.guard=0;hostile=[];
SH.moveBoss(spared,1/60);
spared.windows.forEach(w=>{if(w.charge>0)w.lit=false});
spared.relight=999;
SH.moveBoss(spared,0.7);
out.wicks.cancelledVolley=hostile.length;

/* Rendu : les images de lanterne et de flamme sont vraiment peintes. */
const paintedVeil=wickScene();
let wickImages=[],wickTexts=[];
const realDrawImage=gfx.drawImage?gfx.drawImage.bind(gfx):null;
gfx.drawImage=function(img,...rest){wickImages.push(img);return realDrawImage?realDrawImage(img,...rest):undefined};
const realText=gfx.fillText.bind(gfx);
gfx.fillText=function(t,...rest){wickTexts.push(String(t));return realText(t,...rest)};
let wickCrash=null;
try{SH.draw(gfx)}catch(err){wickCrash=String(err&&err.message||err)}
out.wicks.draw={crash:wickCrash,images:wickImages.length,
  lanterns:wickImages.filter(i=>i===window.MinuitArt.bossWick).length,
  flames:wickImages.filter(i=>i===window.MinuitArt.bossFlame).length};
// Mèche éteinte : plus de flamme, et un état lisible.
paintedVeil.windows[0].lit=false;paintedVeil.windows[0].open=0;paintedVeil.windows[0].charge=0;
wickImages=[];wickTexts=[];
SH.draw(gfx);
out.wicks.dark={flames:wickImages.filter(i=>i===window.MinuitArt.bossFlame).length,
  label:wickTexts.some(t=>t.includes('ÉTEINTE'))};
// Mèche ouverte : consigne de tir explicite.
paintedVeil.windows[1].open=1;wickTexts=[];
SH.draw(gfx);
out.wicks.openLabel=wickTexts.some(t=>t.includes('TIRE SUR LA FLAMME'));
// Mèches tirées aux extrêmes : les libellés ne sortent pas de l’arène.
const edgeVeil=wickScene();
edgeVeil.windows[0].x=80;edgeVeil.windows[0].open=1;
edgeVeil.windows[1].x=720;edgeVeil.windows[1].charge=.4;
edgeVeil.windows[2].x=80;edgeVeil.windows[2].lit=false;edgeVeil.windows[2].open=0;edgeVeil.windows[2].charge=0;
const edgeX=[];
gfx.fillText=function(t,...rest){if(/TIRE SUR LA FLAMME|ELLE VA TIRER|ÉTEINTE/.test(String(t)))edgeX.push(rest[0]);return realText(t,...rest)};
SH.draw(gfx);
out.wicks.labelX={min:Math.min(...edgeX),max:Math.max(...edgeX),count:edgeX.length,arena:W};

// Jauge unique : le canvas porte le nom, le compte et la consigne, sans débord.
wickTexts=[];
const wickWidths=[];
gfx.fillText=function(t,...rest){wickTexts.push(String(t));wickWidths.push(gfx.measureText(String(t)).width);return realText(t,...rest)};
drawBossHealth(gfx,paintedVeil);
out.wicks.gauge={texts:wickTexts.slice(),widest:Math.max(...wickWidths),
  hidden:document.getElementById('bossbar').classList.contains('hidden')};
updateHUD();
out.wicks.gauge.hiddenAfterHUD=document.getElementById('bossbar').classList.contains('hidden');
gfx.drawImage=realDrawImage||(()=>{});gfx.fillText=realText;

/* Épreuves propres aux cinq univers : une action distinctive par monde. */
const trialCounts=[];
function trialScene(index){
 freshWave(1);stage=index;world=worlds[index];
 SH.mission.trial=0;SH.mission.trialDone=false;
}
trialScene(0);
spawnEnemy({kind:'waxMimic',x:400,y:300,group:1,index:0,pattern:99});
const trialMimic=enemies[enemies.length-1];damageEnemy(trialMimic,1,false);reward(trialMimic);
trialCounts.push(SH.mission.trial);
trialScene(1);
spawnEnemy({kind:'crackedBell',x:300,y:300,group:1,index:0,pattern:99});
const trialBell=enemies[enemies.length-1];
spawnEnemy({kind:'crackedBell',x:500,y:300,group:1,index:1,pattern:99});
reward(trialBell);trialCounts.push(SH.mission.trial);
trialScene(2);
SH.salt.push({x:400,y:650,r:62,age:1,life:3});
player.x=400;player.y=650;player.dash=.2;SH.tick(.01);
trialCounts.push(SH.mission.trial);
trialScene(3);
spawnEnemy({kind:'snufferHand',x:400,y:300,group:1,index:0,pattern:99});
const trialSnuffer=enemies[enemies.length-1];trialSnuffer.stolen=1;reward(trialSnuffer);
trialCounts.push(SH.mission.trial);
trialScene(4);
spawnEnemy({kind:'unnamedDigit',x:400,y:300,group:1,index:0,pattern:99});
const trialDigit=enemies[enemies.length-1];trialDigit.digit=SH.mission.digit;damageEnemy(trialDigit,1,false);reward(trialDigit);
trialCounts.push(SH.mission.trial);
out.trials={counts:trialCounts,names:SH.TRIALS.map(t=>t.short),objective:SH.objectiveText()};

/* 16 · Le monde 2 garde son comportement (dispatch non régressé) */
Camp.useClassicWorld();
out.classicAfter=Camp.activeWorld;

globalThis.__RESULT__=out;
})();
`;

const vm = require('node:vm');
const sandbox = global;
vm.runInThisContext(code, { filename: 'sixth-hour-chain.js' });
const r = globalThis.__RESULT__;

/* --- Assertions --------------------------------------------------------- */
assert.equal(r.thirdWorlds.length, 5, 'le monde 3 doit avoir cinq univers');
assert.equal(new Set(r.thirdWorlds.map(w => w.kind)).size, 5, 'cinq gardiens distincts');
assert.equal(new Set(r.thirdWorlds.flatMap(w => w.foes)).size, 13, 'treize formes nouvelles, aucune réutilisée');
for (const w of r.thirdWorlds) assert.ok(w.hour && w.short && w.name, 'chaque univers porte son heure');

assert.equal(r.unlock.world3Unlocked, true, 'finir le monde 2 doit ouvrir le monde 3');
assert.equal(r.unlock.card, true, 'la carte La Sixième Heure doit être débloquée');
assert.equal(r.unlock.world2Completed, true);
assert.equal(r.briefing.state, 'sixth-briefing', 'la première entrée doit ouvrir le briefing');
assert.equal(r.briefing.started, false);
assert.equal(r.apply.state, 'play', 'le choix du personnage doit lancer le vol');
assert.equal(r.apply.activeWorld, 3);
assert.equal(r.apply.count, 5);
assert.notEqual(r.apply.first, r.apply.classic, 'applyWorld(3) doit remplacer les univers');
assert.equal(r.apply.runId, 'world3-normal', 'records séparés du monde 3');

assert.equal(r.wave2Blocks, true, 'vague 2 : la minute doit être rendue');
assert.equal(r.wave3Blocks, true, 'vague 3 : tenue de 22 s');
assert.equal(r.wave3Held, true, 'vague 3 : la minute libérée doit encore être ramassée');
assert.equal(r.wave3Minute, true, 'vague 3 : la minute se libère après la tenue');
assert.equal(r.wave3After, false, 'vague 3 : minute rendue, la vague peut finir');
assert.equal(r.wave4.blocks, true, 'vague 4 : deux sceaux à éteindre');
assert.equal(r.wave4.seals, 2, 'vague 4 : deux sceaux à éteindre');
assert.equal(r.wave4.seals, 2);

assert.ok(r.foeCap.live <= r.foeCap.max, 'plafond d’ennemis dépassé : ' + JSON.stringify(r.foeCap));
assert.ok(r.foeCap.max <= r.foeCap.budget, 'le plafond doit rester dans le budget du monde 2');
for (const t of r.tuning) {
  assert.ok(t.foes <= r.budget.foes, 'trop d’ennemis simultanés');
  assert.ok(t.volley <= r.budget.volley, 'trop de projectiles par salve');
  assert.ok(t.cadence >= r.budget.cadence, 'cadence plus rapide que le monde 2');
  assert.ok(t.speed <= r.budget.shotSpeed, 'projectiles plus rapides que le monde 2');
}
assert.deepEqual(r.tuning.map(t => t.axes), [1, 2, 2, 3, 3], 'la difficulté doit monter par les décisions');

assert.ok(r.wardIn < r.wardOut && r.wardIn > 0, 'le halo protecteur doit réduire les dégâts (héritage monde 1)');
assert.equal(r.marksBefore, 2, 'le facteur de cire annonce un réel et un leurre');
assert.equal(r.lureLanguage, true);
assert.ok(r.relays >= 1, 'tuer la source doit compter comme relais brisé');
assert.equal(r.noInversion, true, 'l’inversion plein/pointillé est supprimée');
assert.ok(r.dangerHurts < 3, 'un cercle DANGER doit blesser, y compris en vague 4');
assert.equal(r.lureHarmless, 3, 'un cercle LEURRE ne doit jamais blesser');
assert.equal(r.twin, true, 'les cloches doivent être liées');
assert.equal(r.freeze.frozen, true, 'briser une cloche fige les tirs de sa jumelle');
assert.equal(r.freeze.vy, 0);
assert.ok(r.freeze.left > 1, 'la fenêtre de suspension doit être exploitable');
assert.equal(r.salt.count, 1, 'la marcheuse de sel reprend une position passée');
assert.ok(Math.abs(r.salt.x - 200) < 40, 'le sel doit viser l’ancienne position, pas l’actuelle');

const kinds = r.bosses.map(b => b.kind);
assert.deepEqual(kinds, ['veilleuse', 'sonneur', 'passeur', 'cueilleuse', 'chasseur']);
for (const b of r.bosses) {
  assert.equal(b.hp, 1, 'aucun gardien du monde 3 ne doit avoir de barre de vie');
  assert.equal(b.unchanged, true, 'les dégâts ne doivent pas entamer un gardien du monde 3');
  assert.ok(b.label, 'chaque gardien affiche sa jauge');
  assert.ok(b.victory, 'chaque gardien a une condition de victoire');
}
assert.equal(new Set(r.bosses.map(b => b.victory)).size, 5, 'cinq conditions de victoire différentes');

assert.equal(r.veilleuse.lit, 0, 'les mèches s’éteignent par la fenêtre de tir');
assert.equal(r.veilleuse.value, .5, 'éteindre les mèches déclenche la seconde phase sans tuer le boss');
assert.equal(r.veilleuse.phase, 2, 'la Veilleuse révèle son cœur après les cinq mèches');
assert.equal(r.veilleuse.coreHits, 1, 'le cœur doit être frappé pendant son ouverture');
assert.ok(r.veilleuse.coreValue > .5, 'les impacts du cœur font progresser la seconde phase');
assert.ok(r.sonneur.resonance > 0, 'tirer sur la cloche doit faire monter la résonance');
assert.equal(r.sonneur.strikes, 0, 'la cloche n’est pas le battant');
assert.equal(r.sonneur.strikesAfter, 1, 'le battant se frappe hors de l’ombre de la cloche');
assert.equal(r.passeur.open, true, 'fouler le sable intact ouvre la boucle');
assert.equal(r.passeur.fresh, 3);
assert.equal(r.passeur.breaks, 1, 'la brisure ne compte que pendant l’ouverture');
assert.equal(r.cueilleuse.flameAfter, r.cueilleuse.flameBefore - 1, 'allumer coûte une charge de flamme');
assert.equal(r.cueilleuse.lit, 1);
assert.equal(r.cueilleuse.fireUntouched, true, 'le tick ne doit plus remonter player.fire');
assert.ok(r.cueilleuse.delay > 1, 'la flamme dépensée ralentit le tir');
assert.ok(r.cueilleuse.delay <= 2, 'le ralentissement reste borné, le tir n’est jamais coupé');
assert.equal(r.chasseur.borrow.length, 3, 'trois emprunts');
assert.ok(r.chasseur.borrow.includes(r.chasseur.least) === false || r.chasseur.least, 'le geste non copié est identifié');
assert.equal(r.chasseur.after.naming, true, 'après trois emprunts il n’a plus de visage');

assert.equal(r.loop.crashes, 0, 'exception dans la boucle de jeu : ' + r.crashMessage);
assert.ok(r.loop.maxFoes <= r.budget.foes, 'la boucle réelle dépasse le plafond d’ennemis : ' + r.loop.maxFoes);
assert.ok(r.loop.maxHostile <= 90, 'la boucle réelle accumule trop de projectiles : ' + r.loop.maxHostile);
assert.ok(r.loop.maxHostile >= 6, 'les monstres doivent tirer davantage : ' + r.loop.maxHostile);
assert.ok(r.loop.maxFoes >= 6, 'il doit y avoir plus de monstres : ' + r.loop.maxFoes);
for (const s of r.loop.perStage) assert.ok(s.foes <= s.cap, 'plafond dépassé dans l’univers ' + (s.index + 1));
assert.ok(r.loop.perStage.some(s => s.shotsMax > 0), 'les univers armés doivent bien tirer');
assert.equal(r.loopBoss.crashes, 0, 'exception avec un gardien du monde 3 : ' + r.bossCrashMessage);
assert.equal(r.loopBoss.hp, 1, 'le gardien ne doit pas perdre de vie dans la boucle réelle');
assert.ok(r.loopBoss.label.includes('FENÊTRES'), 'la jauge doit compter les mèches, pas des points de vie');
assert.equal(r.loopBoss.domBarHidden, true, 'la barre DOM doit rester masquée : une seule jauge');
assert.ok(r.loopBoss.hostile > 0, 'la Veilleuse doit défendre ses mèches par des tirs');

assert.equal(r.minutes, 15, 'quinze minutes rendues au maximum');
assert.equal(r.save.legacyOK, true, 'une sauvegarde antérieure au monde 3 reste valide');
assert.equal(r.save.corruptRejected, true, 'des minutes hors bornes doivent être refusées');
assert.equal(r.code.nonAdmin, false, 'le code Monde3 doit rester réservé à l’administrateur');
assert.equal(r.code.nonAdminMonde2, false, 'la garde admin du code Monde2 est inchangée');
assert.equal(r.code.wrong, false, 'un code inconnu ne change rien');
assert.equal(r.code.blank, false);
assert.equal(r.code.accepted, true, 'le code Monde3 doit être accepté pour l’administrateur');
assert.equal(r.code.state, 'sixth-unlock', 'le code ouvre l’écran de déblocage du monde 3');
assert.equal(r.code.activeWorld, 3);
assert.deepEqual(r.code.chain, { w1: true, w2u: true, w2: true, w3: true, card: true }, 'toute la chaîne 1 → 2 → 3 doit être cohérente');
assert.equal(r.code.noScore, true, 'le code de test ne doit fabriquer aucun score ni résultat');
assert.equal(r.code.launched.state, 'sixth-briefing', '« Tester le monde 3 » ouvre le briefing au premier lancement');
assert.equal(r.code.launched.activeWorld, 3);
assert.equal(r.code.playing.state, 'play', 'le choix du personnage lance le vol');
assert.equal(r.code.playing.activeWorld, 3);
assert.equal(r.code.playing.runId, 'world3-normal');
assert.equal(r.code.playing.character, 'hunter', 'le Veilleur est jouable au monde 3');
assert.equal(r.code.monde2StillWorks, true, 'le code Monde2 continue de fonctionner');
assert.equal(r.code.finale, true, 'Monde2 ouvre toujours sa rencontre');

assert.equal(r.art.kinds, 18, '13 formes + 5 gardiens doivent avoir leur silhouette');
assert.equal(r.art.foes, 13);
assert.equal(r.art.bosses, 5);
assert.equal(r.art.registered, 18, 'chaque silhouette doit être enregistrée dans MinuitArt');
assert.equal(r.art.unique, 18, 'aucune silhouette ne doit être réutilisée entre formes');
assert.equal(r.art.ownPalette, true, 'les sprites doivent utiliser la palette du monde 3');
assert.equal(r.art.coversBestiary, true, 'tout le bestiaire et les 5 gardiens sont couverts');
assert.equal(r.art.noDegenerateGradient, true, 'un dégradé sur un trait plat ne s’affiche pas');
assert.equal(r.art.nothingClipped, true, 'aucune pointe ne doit dépasser du viewBox');
for (const [kind, count] of Object.entries(r.art.detail)) {
  const floor = ['veilleuse','sonneur','passeur','cueilleuse','chasseur'].includes(kind) ? 24 : 18;
  assert.ok(count >= floor, kind + ' est trop pauvre face à la sorcière : ' + count + ' éléments');
}
assert.equal(r.art.drawsFoe, true);
assert.equal(r.art.drawsBoss, true);
assert.equal(r.art.rejectsForeign, false, 'le module ne touche pas aux formes des autres mondes');
assert.equal(r.art.spriteDelegates, true, 'sprite() doit déléguer, plus dessiner de polygones');
assert.equal(r.art.backgroundUsesWorld3, true, 'drawBackground doit demander le décor du monde 3');
assert.equal(r.art.drawsInWorld1, false, 'hors du monde 3, la direction artistique s’efface');
assert.equal(r.scenery.count, 5, 'un décor peint par univers');
assert.equal(r.scenery.unique, 5, 'les cinq décors doivent être distincts');
assert.equal(r.scenery.perStage, true, 'chaque univers reçoit son propre décor');
assert.equal(r.scenery.painted, true, 'décors peints embarqués, aucune requête réseau');
assert.equal(r.scenery.distinctFromWorld1, true, 'aucun décor du monde 1 n’est réutilisé');
assert.equal(r.scenery.world1, null, 'les mondes 1 et 2 gardent leurs décors');

/* Le bug bloquant : flamme épuisée, la sorcière doit continuer à tirer. */
assert.ok(r.shootBug.flame < 3, 'le scénario doit bien épuiser une flamme');
assert.ok(r.shootBug.fired > 3, 'la sorcière ne tire plus quand la flamme est dépensée : ' + r.shootBug.fired);
assert.ok(r.shootBug.seen > 0, 'aucun tir joueur n’a été créé');
for (const [kind, count] of Object.entries(r.shooters)) assert.ok(count > 0, kind + ' ne tire aucun projectile');
assert.ok(Object.values(r.shooters).every(n => n <= r.budget.volley), 'salve au-dessus du budget');
assert.ok(r.clarity.wave1.length > 25, 'la consigne d’univers doit être une phrase');
assert.ok(r.clarity.wave2.includes('Garde-mèche'), 'la vague 2 doit dire quoi tuer');
assert.ok(/\d+ s/.test(r.clarity.wave3), 'la vague 3 doit afficher le temps restant');
assert.ok(r.clarity.wave4.includes('/2'), 'la vague 4 doit compter les sceaux');
assert.equal(r.clarity.howto.length, 5, 'une marche à suivre par gardien');
assert.equal(r.clarity.plainRules, true, 'des consignes, plus des énigmes en capitales');

/* Le labyrinthe : du décor solide, une brèche, et un vrai risque de coincement. */
assert.equal(r.labyrinth.present, true, 'le module labyrinthe doit être chargé');
assert.ok(r.labyrinth.speed.boosted > r.labyrinth.speed.classicSpeed * 1.4, 'le défilement du monde 3 doit être nettement accéléré');
assert.ok(r.labyrinth.speed.boosted <= 260, 'le défilement reste plafonné');
assert.equal(r.labyrinth.speedWorld2, r.labyrinth.speed.classicSpeed, 'le monde 2 ne doit pas être accéléré');
assert.equal(r.labyrinth.foreignSpeed, 74, 'le monde 1 garde sa vitesse');
assert.deepEqual(r.labyrinth.foreign, [0, 0], 'aucun mur dans les mondes 1 et 2');
assert.equal(r.labyrinth.rows.count, 82, 'dix rangées avec trois bifurcations, portes de cire, runes et caches');
assert.ok(r.labyrinth.rows.gaps.every(n => n >= 0), 'les rangées ne doivent jamais compter de cellules en double');
assert.ok(r.labyrinth.rows.gaps.some(n => n === 0), 'les bifurcations du Faubourg commencent fermées par les portes du puzzle');
assert.equal(r.labyrinth.rows.columns, 8, 'la route doit balayer toute la largeur');
assert.deepEqual(r.labyrinth.hpPerStage, [3, 5, 7], 'le décor durcit avec les univers');
assert.deepEqual(r.labyrinth.materials, ['CIRE', 'BRONZE', 'SEL', 'BOIS', 'OBSIDIENNE'], 'une matière par univers');
assert.equal(r.labyrinth.fork.every,3,'une bifurcation toutes les trois rangées');
assert.equal(r.labyrinth.fork.count,1,'une bifurcation est créée sur la troisième rangée');
assert.equal(r.labyrinth.fork.gates,3,'les trois cellules de passage sont verrouillées avant la résolution');
assert.equal(r.labyrinth.fork.runes,3,'le puzzle comporte trois runes à activer');
assert.equal(r.labyrinth.fork.cache,true,'la cache facultative doit être dans un bloc adjacent à la voie large');
assert.equal(r.labyrinth.fork.labels,true,'les runes et la cache facultative sont identifiées à l’écran');
assert.equal(r.labyrinth.puzzles.runes,3,'trois runes sont présentes');
assert.equal(r.labyrinth.puzzles.gates,3,'trois portes bloquent les passages');
assert.equal(r.labyrinth.puzzles.wrongOrderRejected,true,'une rune inactive ne peut pas être activée hors ordre');
assert.equal(r.labyrinth.puzzles.secondEnabled,true,'la rune B devient vulnérable après A');
assert.equal(r.labyrinth.puzzles.thirdEnabled,true,'la rune C devient vulnérable après B');
assert.equal(r.labyrinth.puzzles.allGatesOpened,true,'la troisième rune ouvre toutes les portes');
assert.equal(r.labyrinth.puzzles.cacheBreakable,true,'la cache latérale reste destructible');
assert.equal(r.labyrinth.puzzles.cacheNotGate,true,'la cache ne commande pas les portes');
assert.equal(r.labyrinth.puzzles.cacheOptional,true,'la cache reste facultative');
assert.equal(r.labyrinth.puzzles.cacheWidth,88,'la cache forme une alcôve distincte du passage');
assert.deepEqual(r.labyrinth.puzzles.bronze,{switchBroken:true,narrowOpened:true,wideStillLocked:true},'la cloche choisie ouvre uniquement sa route dans le Clocher');
assert.equal(r.labyrinth.shot.hp1, r.labyrinth.shot.hp0 - 1, 'un tir doit entamer le bloc');
assert.equal(r.labyrinth.shot.consumed, true, 'le tir est arrêté par le décor');
assert.equal(r.labyrinth.shot.broken, true, 'le bloc doit céder sous les tirs');
assert.equal(r.labyrinth.shot.score, 30, 'casser le décor rapporte des points');
assert.ok(r.labyrinth.shot.counter > 0, 'les destructions sont comptées');
assert.ok(r.labyrinth.pin.pushed > 100, 'le mur doit repousser le joueur vers le bas');
assert.ok(r.labyrinth.pin.pinned > 60, 'sans brèche ni tir, le joueur doit rester coincé');
assert.equal(r.labyrinth.pin.atFloor, true, 'le coincement se fait contre le bord bas');
assert.ok(r.labyrinth.pin.lives > 0, 'rester coincé doit coûter des vies');
assert.ok(r.labyrinth.pin.slow > 0, 'le mur ralentit le joueur');
assert.equal(r.labyrinth.escape.moved, true, 'une brèche voisine doit rester atteignable');
assert.equal(r.labyrinth.escape.pinTime, 0, 'sortir par la brèche ne coince pas');
assert.ok(r.labyrinth.noPhase.slow > 0, 'deux blocs jointifs ne doivent pas laisser passer le joueur');
assert.equal(r.labyrinth.resetOnWave.after, 0, 'le labyrinthe se vide au changement de vague');
assert.ok(r.labyrinth.resetOnWave.before > 0, 'la scène de reset devait contenir des murs');
assert.equal(r.labyrinth.bossWave, 0, 'pas de labyrinthe sur la vague du gardien');
assert.equal(r.labyrinth.bossAlive, 0, 'l’arène se vide dès qu’un gardien est vivant');
assert.equal(r.labyrinth.draw.crash, null, 'le rendu du labyrinthe ne doit pas planter');
assert.ok(r.labyrinth.draw.painted > 20, 'les blocs doivent être réellement peints');
assert.equal(r.labyrinth.loop.crashes, 0, 'la boucle complète doit tenir avec le labyrinthe : ' + r.labyrinth.crashMessage);
assert.ok(r.labyrinth.loop.maxWalls > 8, 'le labyrinthe doit vraiment se remplir en partie');

/* Butin caché dans les murs : sceau visible, tirage réel, bons objets. */
assert.deepEqual(r.loot.kinds, ['points', 'shield', 'candy', 'heal', 'upgrade'], 'le mur doit donner les bonus du jeu principal');
assert.ok(r.loot.chance >= .15 && r.loot.chance <= .22, 'le sceau doit rester une occasion, pas la norme : ' + r.loot.chance);
assert.ok(r.loot.rolls.none > 3000 && r.loot.rolls.none < 3400, 'environ quatre blocs sur cinq doivent rester vides : ' + r.loot.rolls.none);
for (const kind of r.loot.kinds) assert.ok(r.loot.rolls[kind] > 30, 'le sort ' + kind + ' ne sort jamais');
assert.equal(r.loot.bareDrops, 0, 'un bloc sans sceau ne doit rien lâcher');
assert.deepEqual(r.loot.sealedDrops, ['shield'], 'le bloc scellé lâche exactement son bonus');
assert.equal(r.loot.sealedAt, true, 'le bonus tombe là où le bloc a cassé');
for (const kind of r.loot.kinds) {
  const got = r.loot.produced[kind];
  assert.equal(got.length, 1, kind + ' doit produire un seul objet');
  assert.ok(got[0] === kind || (kind === 'upgrade' && got[0] === 'points'), kind + ' produit le mauvais objet : ' + got);
}
assert.ok(r.loot.onRows.sealed >= 4, 'les rangées doivent encore porter quelques sceaux');
assert.ok(r.loot.onRows.sealed <= r.loot.onRows.blocks * .4, 'le mur ne doit pas devenir un distributeur de bonus : ' + r.loot.onRows.sealed + '/' + r.loot.onRows.blocks);
assert.ok(r.loot.onRows.sealed < r.loot.onRows.blocks, 'tous les blocs ne sont pas scellés');
assert.ok(r.loot.painted > 100, 'les sceaux doivent être dessinés');

/* Volet claqueur : annoncé, solide, destructible, annulable. */
assert.equal(r.shutter.announced, 1, 'le volet annonce son claquement');
assert.equal(r.shutter.warn, 1.3, 'le délai doit rester lisible');
assert.equal(r.shutter.earlyWalls, 0, 'rien ne doit claquer avant l’annonce');
assert.equal(r.shutter.panel, 1, 'le volet doit poser un panneau solide');
assert.equal(r.shutter.solid, 2, 'le panneau a sa solidité propre');
assert.equal(r.shutter.cancelled, 0, 'tuer le volet annule le claquement');
assert.equal(r.shutter.breakable.hp1, r.shutter.breakable.hp0 - 1, 'le panneau se casse comme le mur');

/* Moucheur : vol de mèche, halo protecteur, restitution à sa mort. */
assert.equal(r.snuffer.mark, true, 'le mouchage doit être télégraphié');
assert.ok(r.snuffer.flame0 > 0, 'le scénario doit partir avec une flamme');
assert.equal(r.snuffer.flame1, r.snuffer.flame0 - 1, 'le Moucheur souffle une mèche');
assert.equal(r.snuffer.stolen, 1, 'la mèche volée doit être portée');
assert.equal(r.snuffer.protected, 5.5, 'la flamme volée protège les autres (dégâts ×0,55)');
assert.equal(r.snuffer.returned, 1, 'tuer le Moucheur rend la mèche');

/* Faux-cierge : le ramasser mord, le tirer perce. */
assert.equal(r.mimic.disguised, true, 'le Faux-cierge arrive déguisé');
assert.equal(r.mimic.art, true, 'le cierge-appât a son visuel');
assert.equal(r.mimic.bitten, 1, 'ramasser le faux cierge doit coûter une vie');
assert.equal(r.mimic.revealed, true, 'la morsure tombe le déguisement');
assert.equal(r.mimic.shot.hp, 20, 'tirer sur le leurre double les dégâts');
assert.equal(r.mimic.shot.revealed, true, 'le tir démasque le Faux-cierge');
assert.equal(r.mimic.shot.lives, 0, 'tirer de loin ne doit pas mordre');
assert.ok(r.mimic.bounty >= 250, 'percer le leurre paie : ' + r.mimic.bounty);

/* Minutes : trois par univers, quinze réellement ramassables, bel objet. */
assert.deepEqual(r.minuteRun.perStage, [3, 3, 3, 3, 3], 'trois minutes par univers');
assert.equal(r.minuteRun.total, 15, 'les quinze minutes annoncées doivent être atteignables');
assert.equal(r.minuteRun.token, true, 'la minute doit avoir son propre visuel');
assert.equal(r.minuteRun.lockedBeforeHold, true, 'la minute attend la fin de la tenue');
assert.equal(r.minuteRun.freeAfterHold, true, 'la minute se libère après la tenue');
assert.equal(r.minuteRun.label, 2, 'chaque minute porte son rang dans l’univers');
assert.equal(r.minuteRun.guardActive, true, 'la première minute reste sous garde');
assert.ok(r.minuteRun.objective.includes('MINUTE 1/3'), 'le bandeau doit compter les minutes');

/* Plus aucun sprite en mode esquisse, et le Faubourg a son bestiaire. */
assert.deepEqual(r.sketch, [], 'silhouettes encore en pointillés de brouillon : ' + r.sketch.join(', '));
assert.equal(r.faubourg.foes.length, 4, 'le Faubourg gagne deux formes');
assert.equal(r.faubourg.sprites, true, 'chaque forme du Faubourg a sa silhouette');
assert.ok(r.faubourg.names.includes('Volet claqueur') && r.faubourg.names.includes('Faux-cierge'), 'les nouvelles formes sont nommées en français');

/* La Veilleuse : une seule jauge, des flammes dessinées, une défense, du hasard. */
assert.equal(r.wicks.count, 5, 'cinq mèches à éteindre');
assert.equal(r.wicks.allLit, true, 'elles démarrent allumées');
assert.equal(r.wicks.assets, true, 'lanterne et flamme ont leur visuel');
assert.equal(r.wicks.inBounds, true, 'les mèches restent dans l’arène');
assert.equal(r.wicks.spaced, true, 'deux mèches ne doivent pas se superposer');
assert.ok(r.wicks.distinctLayouts >= 5, 'la disposition doit changer d’un gardien à l’autre');
assert.ok(r.wicks.distinctHeights >= 3, 'la hauteur des mèches doit varier aussi');
assert.equal(r.wicks.roundRobin, 0, 'l’ouverture ne doit plus être un tour de rôle fixe');
assert.ok(r.wicks.distinctOpenings >= 5, 'l’ordre d’ouverture doit varier d’un combat à l’autre : ' + r.wicks.distinctOpenings);
assert.equal(r.wicks.noImmediateRepeat, true, 'la même mèche ne s’ouvre pas deux fois de suite');
assert.ok(r.wicks.relit >= 3, 'le rallumage doit choisir une mèche au hasard');
assert.equal(r.wicks.beforeCharge, 0, 'la salve doit être annoncée avant de partir');
assert.equal(r.wicks.charge, r.wicks.cap, 'toutes les mèches proches chargent, dans la limite du budget');
assert.equal(r.wicks.fullVolley, r.wicks.cap, 'cinq mèches allumées donnent la salve maximale');
assert.ok(r.wicks.fullVolley <= r.wicks.cap, 'la salve ne dépasse jamais le budget du monde');
assert.equal(r.wicks.lastWickVolley, 1, 'une seule mèche allumée ne tire qu’un projectile');
assert.equal(r.wicks.cancelledVolley, 0, 'éteindre une mèche pendant sa charge annule son tir');
assert.equal(r.wicks.draw.crash, null, 'le rendu des mèches ne doit pas planter');
assert.equal(r.wicks.draw.lanterns, 5, 'chaque mèche doit être dessinée comme une lanterne');
assert.equal(r.wicks.draw.flames, 5, 'chaque mèche allumée doit porter une flamme dessinée');
assert.equal(r.wicks.dark.flames, 4, 'une mèche éteinte n’a plus de flamme');
assert.equal(r.wicks.dark.label, true, 'l’état éteint doit rester lisible');
assert.equal(r.wicks.openLabel, true, 'la fenêtre de tir doit être annoncée');
assert.equal(r.wicks.gauge.hidden, true, 'la barre DOM ne doit pas réapparaître');
assert.equal(r.wicks.gauge.hiddenAfterHUD, true, 'updateHUD ne doit pas créer une seconde jauge');
assert.ok(r.wicks.gauge.texts.some(t => t.includes('Veilleuse')), 'la jauge canvas porte le nom du gardien');
assert.ok(r.wicks.gauge.texts.some(t => t.includes('Tire sur la flamme')), 'la jauge canvas porte la consigne');
assert.ok(!r.wicks.gauge.texts.some(t => t.includes('PHASE')), 'les gardiens du monde 3 n’ont pas de phases de vie');
assert.ok(r.wicks.gauge.widest <= 250, 'la consigne doit tenir dans le panneau de jauge : ' + r.wicks.gauge.widest);
assert.equal(r.wicks.labelX.count, 3, 'les trois états de mèche sont libellés');
assert.ok(r.wicks.labelX.min >= 92, 'un libellé ne déborde pas à gauche : ' + r.wicks.labelX.min);
assert.ok(r.wicks.labelX.max <= r.wicks.labelX.arena - 92, 'un libellé ne déborde pas à droite : ' + r.wicks.labelX.max);

assert.deepEqual(r.trials.counts,[1,1,1,1,1],'chaque univers doit valider son épreuve avec sa mécanique propre');
assert.deepEqual(r.trials.names,['SCEAUX','ÉCHOS','TRACES','MÈCHES','CHIFFRES'],'les cinq épreuves doivent rester distinctes');
assert.ok(r.trials.objective.includes('ÉPREUVE CHIFFRES 1/3'),'la progression de l’épreuve doit rester visible dans le bandeau');
assert.equal(r.classicAfter, 1, 'retour au monde classique intact');

console.log('Monde 3 · La Sixième Heure — boucle réelle sans exception ('+r.loop.maxFoes+' ennemis max, '+r.loop.maxHostile+' projectiles max), budgets relevés (≤12 ennemis, ≤4 tirs, cadence ≥1,9 s), toutes les formes tirent, héritages halo/relais/leurre/lien/mémoire, 5 gardiens sans barre de vie aux victoires distinctes, 15 minutes rendues, codes créateur Monde2/Monde3 sans score, tir jamais coupé même flamme épuisée, consignes en clair, 18 silhouettes et 5 décors vus de dessus, cinq épreuves de maîtrise spécifiques au monde 3, labyrinthe destructible à butin scellé (défilement ×1,5, brèches, coincement meurtrier, mondes 1 et 2 intacts), 3 pièges vicieux (volet claqueur, moucheur de mèches, faux-cierge), 15 minutes ramassables et dessinées, Faubourg remis dans son thème, aucun sprite en esquisse, Veilleuse à jauge unique avec mèches dessinées, salve de défense et tirage aléatoire, déblocage 1→2→3 et sauvegardes rétro-compatibles : OK');

/* journey.js arme des minuteurs de fin de partie : on sort explicitement. */
process.exit(0);
