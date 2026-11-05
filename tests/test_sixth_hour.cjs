'use strict';
/* Monde 3 · La Sixième Heure.
   Ce test charge les VRAIS game.js, journey.js, nemesis.js, sequel.js et
   sixth-hour.js. Il verrouille le cahier des charges :
   1. budgets plafonnés (jamais plus de monstres ni de tirs qu'au monde 2) ;
   2. dificultad portée par les décisions, pas par les quantités ;
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
function makeEl(id) {
  const el = {
    id, style: {}, dataset: {}, innerHTML: '', textContent: '', title: '', onclick: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
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
  body: { innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {} },
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
for (const file of ['game.js', 'online.js', 'journey.js', 'nemesis.js', 'sequel.js', 'sixth-hour.js', 'sixth-hour-art.js', 'sixth-scenery.js']) {
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
freshWave(3);waveTime=0;out.wave3Blocks=SH.waveBlocks();waveTime=23;out.wave3After=SH.waveBlocks();
freshWave(4);out.wave4={blocks:SH.waveBlocks(),inverted:SH.mission.inverted,seals:enemies.filter(e=>e.seal).length};

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

/* 8 · Inversion de la règle en vague 4 : le plein devient leurre */
freshWave(4);
spawnEnemy({kind:'waxCourier',x:400,y:300,group:1,index:0,pattern:99});
const c4=enemies[enemies.length-1];c4.y=300;c4.homeY=300;c4.timer=0;SH.moveEnemy(c4,1/60);
const filled=SH.marks.find(m=>m.real);
player.x=filled.x;player.y=filled.y;player.inv=0;player.dash=0;player.shield=0;lives=3;
filled.age=filled.warn;SH.tick(1/60);
out.inversionLives=lives;

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
out.veilleuse.value=v.value;

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
player.fire=0;SH.tick(1/60);out.cueilleuse.cadence=player.fire>0;

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

/* 11g · Un gardien dans la boucle réelle : sa jauge remplace la barre de vie. */
stage=0;world=worlds[0];wave=5;state='play';enemies=[];hostile=[];shots=[];
spawnBoss();
let bossCrashes=0;
for(let i=0;i<420;i++){
  player.inv=99;player.x=400;player.y=700;
  try{update(1/60)}catch(err){bossCrashes++;if(bossCrashes===1)out.bossCrashMessage=String(err&&err.message||err)}
}
const liveBoss=enemies.find(e=>e.boss&&!e.dead);
out.loopBoss={crashes:bossCrashes,hp:liveBoss&&liveBoss.hp,label:liveBoss&&liveBoss.label,hud:document.getElementById('bossphase').textContent};

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
  coversBestiary:Camp.thirdWorlds.flatMap(w=>[...w.foes,w.kind]).every(k=>Art.isSixthKind(k))};
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
 const paths=bodyOf(k).match(/<path[^>]+>/g)||[];
 if(paths.length<8)return false;
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
assert.equal(new Set(r.thirdWorlds.flatMap(w => w.foes)).size, 10, 'dix formes nouvelles, aucune réutilisée');
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
assert.equal(r.wave3After, false);
assert.equal(r.wave4.blocks, true, 'vague 4 : deux sceaux à éteindre');
assert.equal(r.wave4.inverted, true, 'vague 4 : la règle apprise est inversée');
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
assert.equal(r.inversionLives, 3, 'en vague 4 le télégraphe plein devient inoffensif');
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
assert.equal(r.veilleuse.value, 1, 'la jauge de la Veilleuse est complète quand tout est éteint');
assert.ok(r.sonneur.resonance > 0, 'tirer sur la cloche doit faire monter la résonance');
assert.equal(r.sonneur.strikes, 0, 'la cloche n’est pas le battant');
assert.equal(r.sonneur.strikesAfter, 1, 'le battant se frappe hors de l’ombre de la cloche');
assert.equal(r.passeur.open, true, 'fouler le sable intact ouvre la boucle');
assert.equal(r.passeur.fresh, 3);
assert.equal(r.passeur.breaks, 1, 'la brisure ne compte que pendant l’ouverture');
assert.equal(r.cueilleuse.flameAfter, r.cueilleuse.flameBefore - 1, 'allumer coûte une charge de flamme');
assert.equal(r.cueilleuse.lit, 1);
assert.equal(r.cueilleuse.cadence, true, 'la flamme dépensée doit réduire la cadence');
assert.equal(r.chasseur.borrow.length, 3, 'trois emprunts');
assert.ok(r.chasseur.borrow.includes(r.chasseur.least) === false || r.chasseur.least, 'le geste non copié est identifié');
assert.equal(r.chasseur.after.naming, true, 'après trois emprunts il n’a plus de visage');

assert.equal(r.loop.crashes, 0, 'exception dans la boucle de jeu : ' + r.crashMessage);
assert.ok(r.loop.maxFoes <= r.budget.foes, 'la boucle réelle dépasse le plafond d’ennemis : ' + r.loop.maxFoes);
assert.ok(r.loop.maxHostile <= 24, 'la boucle réelle accumule trop de projectiles : ' + r.loop.maxHostile);
for (const s of r.loop.perStage) assert.ok(s.foes <= s.cap, 'plafond dépassé dans l’univers ' + (s.index + 1));
assert.ok(r.loop.perStage.some(s => s.shotsMax > 0), 'les univers armés doivent bien tirer');
assert.equal(r.loopBoss.crashes, 0, 'exception avec un gardien du monde 3 : ' + r.bossCrashMessage);
assert.equal(r.loopBoss.hp, 1, 'le gardien ne doit pas perdre de vie dans la boucle réelle');
assert.ok(r.loopBoss.hud.includes('FENÊTRES'), 'le HUD doit afficher la jauge, pas une barre de vie');

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

assert.equal(r.art.kinds, 15, '10 formes + 5 gardiens doivent avoir leur silhouette');
assert.equal(r.art.foes, 10);
assert.equal(r.art.bosses, 5);
assert.equal(r.art.registered, 15, 'chaque silhouette doit être enregistrée dans MinuitArt');
assert.equal(r.art.unique, 15, 'aucune silhouette ne doit être réutilisée entre formes');
assert.equal(r.art.ownPalette, true, 'les sprites doivent utiliser la palette du monde 3');
assert.equal(r.art.coversBestiary, true, 'tout le bestiaire et les 5 gardiens sont couverts');
assert.equal(r.art.noDegenerateGradient, true, 'un dégradé sur un trait plat ne s’affiche pas');
assert.equal(r.art.nothingClipped, true, 'aucune pointe ne doit dépasser du viewBox');
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

assert.equal(r.classicAfter, 1, 'retour au monde classique intact');

console.log('Monde 3 · La Sixième Heure — boucle réelle sans exception ('+r.loop.maxFoes+' ennemis max, '+r.loop.maxHostile+' projectiles max), budgets plafonnés (≤6 ennemis, ≤2 tirs, cadence ≥4,2 s), décisions 1→3, héritages halo/relais/leurre/lien/mémoire, 5 gardiens sans barre de vie aux victoires distinctes, 15 minutes rendues, codes créateur Monde2/Monde3 sans score, 15 silhouettes et 5 décors peints distincts, déblocage 1→2→3 et sauvegardes rétro-compatibles : OK');

/* journey.js arme des minuteurs de fin de partie : on sort explicitement. */
process.exit(0);
