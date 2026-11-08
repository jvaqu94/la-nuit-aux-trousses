/* Monde 3 · Le labyrinthe de La Sixième Heure.
   Le style de jeu change : le défilement s'accélère et des rangées de décor
   solide descendent vers le joueur. Chaque rangée laisse une brèche ; il faut
   la trouver, ou détruire le bloc à temps. Sans brèche ni tir, le mur pousse
   le joueur vers le bas et finit par le COINCER contre le bord de l'écran.

   Tout est porté par ce module : SixthHour.tick et SixthHour.draw sont
   enveloppés, et targetScrollSpeed est relayé. Les mondes 1 et 2, les courses
   hebdomadaires et le duel ne sont pas touchés. */
(()=>{
'use strict';
const SH=window.SixthHour;
if(!SH)return;
const active=()=>window.Campaign?.activeWorld===3&&state==='play';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const TAU=Math.PI*2;

/* Une matière par univers : le mur appartient au décor, pas à un autre monde. */
const MATERIALS=[
 {name:'CIRE',fill:'#e8d3ab',shade:'#b39a8c',edge:'#6d5a63',crack:'#4a3b46',glow:'#ffd9a0'},
 {name:'BRONZE',fill:'#9fc7b4',shade:'#4d8079',edge:'#26403f',crack:'#16292b',glow:'#cfe6d8'},
 {name:'SEL',fill:'#e6e2d2',shade:'#a9a89b',edge:'#5b6068',crack:'#3b4148',glow:'#ffffff'},
 {name:'BOIS',fill:'#8a6f57',shade:'#5a4636',edge:'#2f2419',crack:'#1d160f',glow:'#f4c98f'},
 {name:'OBSIDIENNE',fill:'#4a4568',shade:'#2a2447',edge:'#12101f',crack:'#080711',glow:'#dcbc7c'}
];
const CELL=100,COLS=8,ROW_H=46,PLAYER_R=15;
/* Butin caché dans le mur. Le sceau est visible AVANT de casser : le joueur
   choisit quel bloc ouvrir, au lieu de subir un tirage au sort invisible.
   Ce sont exactement les bonus du jeu principal, ramassés par le même code. */
const BONUS=[
 {kind:'points',weight:34,label:'TRÉSOR',color:'#f4ce83'},
 {kind:'shield',weight:20,label:'BOUCLIER',color:'#8ee9e2'},
 {kind:'candy',weight:16,label:'TRIPLE TIR',color:'#ffb0d8'},
 {kind:'pierceShot',weight:9,label:'PERCE-CIRE',color:'#9fd9e7'},
 {kind:'heal',weight:14,label:'VIE',color:'#ff8e7b'},
 {kind:'upgrade',weight:8,label:'ARSENAL',color:'#c291e7'}
];
/* Le pictogramme est tracé, pas écrit : les glyphes Unicode manquent dans
   beaucoup de polices et le sceau deviendrait un carré vide. */
function drawSeal(g,kind){
 g.beginPath();
 if(kind==='points'){g.moveTo(0,-6);g.lineTo(4.5,0);g.lineTo(0,6);g.lineTo(-4.5,0);g.closePath();g.fill()}
 else if(kind==='shield'){g.moveTo(-4.5,-5);g.lineTo(4.5,-5);g.lineTo(4.5,1);g.lineTo(0,6);g.lineTo(-4.5,1);g.closePath();g.fill()}
 else if(kind==='candy'){g.rect(-5,-5,2.4,10);g.rect(-1.2,-5,2.4,10);g.rect(2.6,-5,2.4,10);g.fill()}
 else if(kind==='pierceShot'){g.rect(-1.6,-6.5,3.2,7);g.moveTo(0,8);g.lineTo(4.6,-.5);g.lineTo(-4.6,-.5);g.closePath();g.rect(-5.5,-8,2.6,2.6);g.rect(2.9,-8,2.6,2.6);g.fill()}
 else if(kind==='heal'){g.rect(-1.7,-5.5,3.4,11);g.rect(-5.5,-1.7,11,3.4);g.fill()}
 else{g.moveTo(0,-6);g.lineTo(5,2);g.lineTo(1.8,2);g.lineTo(1.8,6);g.lineTo(-1.8,6);g.lineTo(-1.8,2);g.lineTo(-5,2);g.closePath();g.fill()}
}
/* Rareté du butin : un sceau doit rester une occasion, pas la norme.
   À 38 %, presque un mur sur deux était une récompense et le labyrinthe
   devenait un distributeur ; 20 % rend le choix du bloc à ouvrir décisif. */
const BONUS_CHANCE=.20;
function rollBonus(){
 if(rng()>=BONUS_CHANCE)return null;
 const total=BONUS.reduce((n,b)=>n+b.weight,0);
 let roll=rng()*total;
 for(const b of BONUS){roll-=b.weight;if(roll<0)return b}
 return BONUS[0];
}
function releaseBonus(w){
 if(!w.bonus)return null;
 const x=clamp(w.x,40,W-40),y=clamp(w.y,160,H-100);
 if(w.bonus.kind==='upgrade'){
  const before=drops.length;dropUpgrade(x,y);
  if(drops.length===before)drops.push({x,y,kind:'points',points:150+stage*100,age:0});
 }else if(w.bonus.kind==='points'){
  drops.push({x,y,kind:'points',points:150+stage*100+wave*20,age:0});
 }else drops.push({x,y,kind:w.bonus.kind,age:0});
 say('SCEAU BRISÉ · '+w.bonus.label,2);
 return w.bonus.kind;
}
/* Les brèches alternent : la route dessine un vrai zigzag de labyrinthe. */
const ROUTE=[1,5,2,6,3,7,4,0,2,5];
/* Une ligne sur trois propose deux itinéraires lisibles :
   passage étroit avec cache garanti, ou passage large sans détour. */
const FORK_EVERY=3;
const ROUTE_CACHE=[BONUS[1],BONUS[2],BONUS[0],BONUS[4],BONUS[3]];

let walls=[],routeRows=[],timer=2.4,rowIndex=0,key='',pinTime=0,pinHurt=0,broken=0,warned=false,puzzleProgress={};
/* Le moment fort des runes : éclats de cire qui volent + éclair d'or. */
let debris=[],flashT=0;

function reset(){walls=[];routeRows=[];timer=2.4;rowIndex=0;pinTime=0;pinHurt=0;broken=0;warned=false;puzzleProgress={};debris=[];flashT=0}

function material(){return MATERIALS[clamp(stage,0,4)]}

/* Une rangée : les lignes ordinaires gardent leur brèche en zigzag.
   Une ligne sur trois devient une bifurcation : un couloir étroit qui cache
   un butin garanti, ou un couloir large plus confortable. */
function spawnRow(){
 const row=rowIndex,narrow=ROUTE[row%ROUTE.length];
 const forkEvery=stage===1?2:FORK_EVERY;
 const fork=row%forkEvery===forkEvery-1;
 const wideStart=(narrow+4)%COLS;
 const cacheCell=(wideStart+2)%COLS;
 const gaps=new Set([narrow]);
 if(fork){gaps.add(wideStart);gaps.add((wideStart+1)%COLS)}
 if(fork&&stage===0)gaps.add(cacheCell);
 const hp=3+clamp(stage,0,4);
 for(let c=0;c<COLS;c++){
  if(gaps.has(c))continue;
  const bonus=rollBonus();
  walls.push({x:c*CELL+CELL/2,y:-ROW_H,w:CELL-6,h:ROW_H,hp,max:hp,hit:0,dead:false,row,bonus,routeCache:false});
 }
 if(fork&&stage===0){
  // Faubourg : les deux voies sont fermées par des portes de cire.
  // Il faut toucher les trois runes dans l'ordre A -> B -> C. Une seule
  // rune est vulnérable à la fois ; la troisième ouvre les deux itinéraires.
  const routeCells=[narrow,wideStart,(wideStart+1)%COLS];
  for(const c of routeCells)walls.push({x:c*CELL+CELL/2,y:-ROW_H,w:CELL-6,h:ROW_H,
   hp:99,max:99,hit:0,dead:false,row,bonus:null,locked:true,routeId:'wax-puzzle',gate:'wax'});
  const runeXs=[narrow*CELL+CELL/2,wideStart*CELL+CELL/2,(wideStart+1)*CELL+CELL/2];
  runeXs.forEach((x,index)=>walls.push({x,y:-ROW_H+48,w:46,h:34,
   hp:index===0?2:99,max:index===0?2:99,hit:0,dead:false,row,bonus:null,
   switch:true,sequenceIndex:index,runeLabel:String.fromCharCode(65+index)}));
  // Une cache dans une alcôve latérale : elle ne commande pas l'ouverture
  // des portes et reste facultative après la résolution des runes.
  walls.push({x:cacheCell*CELL+CELL/2,y:-ROW_H,w:CELL-12,h:ROW_H-8,
   hp:4,max:4,hit:0,dead:false,row,bonus:ROUTE_CACHE[row%ROUTE_CACHE.length],
   routeCache:true,optional:true});
 }
 if(fork&&stage===1){
  // Clocher : les deux itinéraires sont verrouillés. Il faut choisir une cloche
  // et l'aligner avec le tir automatique pour ouvrir uniquement sa route.
  const choices=[
   {routeId:'narrow',cells:[narrow],x:narrow*CELL+CELL/2},
   {routeId:'wide',cells:[wideStart,(wideStart+1)%COLS],x:wideStart*CELL+CELL}
  ];
  for(const choice of choices){
   for(const c of choice.cells)walls.push({x:c*CELL+CELL/2,y:-ROW_H,w:CELL-6,h:ROW_H,hp:99,max:99,hit:0,dead:false,row,
    bonus:null,locked:true,routeId:choice.routeId,gate:'bronze'});
   walls.push({x:choice.x,y:-ROW_H+48,w:46,h:34,hp:2,max:2,hit:0,dead:false,row,
    bonus:null,switch:true,routeId:choice.routeId});
  }
 }
 if(fork)routeRows.push({row,y:-ROW_H,narrowX:narrow*CELL+CELL/2,
  wideX:wideStart*CELL+CELL,wideStart,cacheX:cacheCell*CELL+CELL/2,
  switches:stage===0?[narrow*CELL+CELL/2,wideStart*CELL+CELL/2,(wideStart+1)*CELL+CELL/2]:
   stage===1?[narrow*CELL+CELL/2,wideStart*CELL+CELL]:null,stage});
  if(fork&&typeof tone==='function'){if(stage===1)tone(1175,.34,'sine',.08,1.5);else if(stage===0)tone(196,.55,'triangle',.08,1.3)}
 rowIndex++;
}

/* Panneau posé par un Volet claqueur : il bouche la route que le joueur visait.
   Même matière, même solidité, mêmes tirs — rien de neuf à apprendre. */
function addPanel(x,y){
 if(!active()||wave===5||enemies.some(e=>e.boss&&!e.dead))return null;
 const hp=2+clamp(stage,0,4);
 const panel={x:clamp(x,CELL/2,W-CELL/2),y:clamp(y,120,H-160),w:CELL-6,h:ROW_H,
  hp,max:hp,hit:0,dead:false,row:-1,bonus:null,panel:true};
 walls.push(panel);return panel;
}

/* Le moment fort : les portes de cire éclatent au lieu de disparaître.
   Une cloche de bronze n'ouvre que sa route ; les trois runes ouvrent tout. */
function detonateGates(row,opts){
 opts=opts||{};
 const toast=opts.toast||'LE PASSAGE SE LIBÈRE';
 const routeId=('routeId' in opts)?opts.routeId:null;
 const gates=walls.filter(w=>!w.dead&&w.locked&&w.row===row&&(routeId===null||w.routeId===routeId));
 if(typeof noiseBurst==='function')noiseBurst(.22,.03,820);
 tone(523,.45,'triangle',.08,1.25);
 tone(784,.5,'sine',.06,1.15);
 tone(1175,.6,'sine',.05,1.1);
 if(!gates.length){say(toast,2.4);return}
 let cx=0;for(const g of gates)cx+=g.x;cx/=gates.length;
 const waxColors=['#e8d3ab','#cbb493','#ffd9a0','#b39a8c'];
 for(const g of gates){
  g.dead=true;broken++;
  particle(g.x,g.y,'#ffd9a0',26);
  particle(g.x,g.y,'#e8d3ab',18);
  particle(g.x,g.y,'#8a6f57',12);
  for(let i=0;i<11;i++){
   const a=rng()*TAU,sp=90+rng()*175;
   debris.push({x:g.x+(rng()-.5)*34,y:g.y+(rng()-.5)*18,
    vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-70,rot:rng()*TAU,vr:(rng()-.5)*11,
    size:4+rng()*7.5,life:.8+rng()*.4,max:1.2,color:waxColors[i%waxColors.length]});
  }
 }
 flashT=.85;
 if(opts.reward){
  score+=250;
  drops.push({x:clamp(cx,60,W-60),y:clamp(gates[0].y,170,H-140),kind:'shield',age:0});
 }
 say(toast,opts.reward?3.2:2.6);
}

function breakBlock(w){
 w.dead=true;broken++;
 score+=30;particle(w.x,w.y,material().glow,14);
 tone(320,.16,'triangle',.05,1.1);
 if(w.switch&&stage===0){
  const progress=puzzleProgress[w.row]||0;
  if(w.sequenceIndex===progress){
   puzzleProgress[w.row]=progress+1;
   /* L'ordre paie : +1 combo par rune validée, +2 sur la troisième, et une
      bourse croissante. Tirer au hasard n'ouvre rien ; tirer dans l'ordre
      construit une chaîne. */
   const rewardPts=w.sequenceIndex===2?400*(stage+1):150*(stage+1);
   score+=rewardPts;combo=Math.min(8,combo+(w.sequenceIndex===2?2:1));
   const next=walls.find(v=>!v.dead&&v.switch&&v.row===w.row&&v.sequenceIndex===progress+1);
   if(next){next.hp=2;next.max=2;say('RUNE '+w.runeLabel+' VALIDÉE · +'+rewardPts+' · vise la rune '+next.runeLabel,2.2);tone(660,.16,'sine',.05,1.2)}
   else{
    detonateGates(w.row,{reward:true,toast:'LES TROIS RUNES RÉSONNENT · LES DEUX PASSAGES S’OUVRENT · +250 · UN DON DE CIRE TOMBE'});
   }
  }
 }else if(w.switch){
  detonateGates(w.row,{routeId:w.routeId,toast:'RÉSONANCE · '+(w.routeId==='narrow'?'PASSAGE ÉTROIT':'PASSAGE LARGE')+' OUVERT'});
 }
 if(w.routeCache){const cachePts=100*(stage+1);score+=cachePts;combo=Math.min(8,combo+1);say('CACHE DU FAUBOURG · butin découvert · +'+cachePts+' · combo +1',2.4)}
 if(w.bonus){particle(w.x,w.y,w.bonus.color,20);tone(660,.22,'sine',.06,1.3)}
 releaseBonus(w);
}

function damageBlock(w,amount){
 if(w.dead||w.locked)return;
 if(w.switch&&stage===0&&(w.sequenceIndex!==(puzzleProgress[w.row]||0)))return;
 w.hp-=amount;w.hit=.16;
 particle(w.x,w.y,material().fill,4);
 if(w.hp<=0)breakBlock(w);
}

/* Le mur pousse le joueur vers le bas ; au bord de l'écran il le coince. */
function resolvePlayer(w,dt){
 const dx=player.x-w.x,dy=player.y-w.y;
 const overlapX=w.w/2+PLAYER_R-Math.abs(dx),overlapY=w.h/2+PLAYER_R-Math.abs(dy);
 if(overlapX<=0||overlapY<=0)return false;
 // Une sortie latérale n'est offerte que si elle débouche sur une vraie brèche.
 // Sinon le joueur oscillerait entre deux blocs et traverserait le mur.
 if(overlapX<overlapY&&overlapX<40){
  const nx=clamp(player.x+Math.sign(dx||1)*overlapX,20,W-20);
  const blocked=nx<=20||nx>=W-20||walls.some(o=>o!==w&&!o.dead
   &&Math.abs(o.y-w.y)<ROW_H*.6&&Math.abs(nx-o.x)<o.w/2+PLAYER_R);
  if(!blocked){player.x=nx;return false}
 }
 const floor=H-30,pushed=w.y+w.h/2+PLAYER_R;
 player.y=Math.min(floor,pushed);
 player.slow=Math.max(player.slow,.35);
 if(pushed>=floor-1){
  pinTime+=dt;pinHurt-=dt;
  if(!warned){warned=true;say('COINCÉ · détruis le bloc au-dessus de toi pour te dégager',2.6)}
  if(pinHurt<=0){pinHurt=1.3;hurt(14,'le mur qui se referme')}
  return true;
 }
 return false;
}

function tick(dt){
 if(!active()){if(walls.length)reset();return}
 const current=stage+':'+wave;
 if(current!==key){key=current;reset()}
 // L'arène d'un gardien reste lisible : pas de labyrinthe pendant le boss.
 if(wave===5||enemies.some(e=>e.boss&&!e.dead)){if(walls.length)walls=[];return}
 timer-=dt;
 if(timer<=0){
  spawnRow();
  timer=Math.max(2.1,3.4-clamp(stage,0,4)*.22);
 }
 const speed=scrollSpeed();
 for(const route of routeRows)route.y+=speed*dt;
 routeRows=routeRows.filter(route=>route.y<H+ROW_H);
 let pinned=false;
 for(const w of walls){
  if(w.dead)continue;
  w.y+=speed*dt;
  w.hit=Math.max(0,w.hit-dt);
  for(const s of shots){
   if(s.life<=0)continue;
   if(Math.abs(s.x-w.x)<w.w/2+4&&Math.abs(s.y-w.y)<w.h/2+4){damageBlock(w,s.damage);s.life=0}
  }
  if(!w.dead&&resolvePlayer(w,dt))pinned=true;
 }
 if(!pinned){pinTime=0;warned=false}
 walls=walls.filter(w=>!w.dead&&w.y<H+ROW_H);
 for(let i=debris.length-1;i>=0;i--){const d=debris[i];d.vy+=620*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.rot+=d.vr*dt;d.life-=dt;if(d.life<=0)debris.splice(i,1)}
 flashT=Math.max(0,flashT-dt);
}

function drawBlock(g,w){
 const m=material(),x=-w.w/2,y=-w.h/2,damage=1-w.hp/w.max;
 g.save();g.translate(w.x,w.y);
 if(w.hit>0){g.shadowBlur=14;g.shadowColor=m.glow}
 const grad=g.createLinearGradient(x,y,x+w.w,y+w.h);
 grad.addColorStop(0,m.fill);grad.addColorStop(.55,m.shade);grad.addColorStop(1,m.edge);
 g.fillStyle=grad;g.fillRect(x,y,w.w,w.h);
 g.strokeStyle=m.edge;g.lineWidth=2;g.strokeRect(x,y,w.w,w.h);
 // Matière : joints de pierre, coulures de cire ou veines de bronze.
 g.strokeStyle=m.shade;g.lineWidth=1;g.globalAlpha=.7;
 g.beginPath();g.moveTo(x,y);g.lineTo(x+w.w,y);g.moveTo(x+6,y+w.h*.5);g.lineTo(x+w.w-6,y+w.h*.5);g.stroke();
 g.globalAlpha=1;
 g.fillStyle=m.glow;g.globalAlpha=.18;g.fillRect(x+3,y+3,w.w-6,4);g.globalAlpha=1;
 // Rivets et biseau : le bloc appartient à la matière de l'univers.
 g.fillStyle=m.edge;
 for(const rx of [x+7,x+w.w-7])for(const ry of [y+8,y+w.h-8]){
  g.beginPath();g.arc(rx,ry,2.6,0,TAU);g.fill();
 }
 g.fillStyle=m.fill;g.globalAlpha=.5;
 for(const rx of [x+6.2,x+w.w-7.8])for(const ry of [y+7.2,y+w.h-8.8]){
  g.beginPath();g.arc(rx,ry,1.1,0,TAU);g.fill();
 }
 g.globalAlpha=1;
 // Fissures proportionnelles aux dégâts : on voit ce qu'il reste à casser.
 if(damage>0){
  g.strokeStyle=m.crack;g.lineWidth=1.6;
  const n=Math.round(damage*4)+1;
  for(let i=0;i<n;i++){
   const px=x+10+i*(w.w-20)/Math.max(1,n);
   g.beginPath();g.moveTo(px,y+3);g.lineTo(px+6,y+w.h*.45);g.lineTo(px-4,y+w.h-4);g.stroke();
  }
 }
 // Petite jauge de solidité, lisible même sur téléphone.
 g.fillStyle='#0f0c1acc';g.fillRect(x+8,y+w.h-9,w.w-16,4);
 g.fillStyle=m.glow;g.fillRect(x+8,y+w.h-9,(w.w-16)*clamp(w.hp/w.max,0,1),4);
 if(w.switch){
  g.save();const isRune=stage===0;
  const prog=isRune?(puzzleProgress[w.row]||0):0;
  const runeState=!isRune?'bell':w.sequenceIndex<prog?'done':w.sequenceIndex===prog?'active':'locked';
  g.globalAlpha=1;
  if(isRune){
   g.textAlign='center';
   if(runeState==='done'){
    /* Validée : cachet d'or plein et coche gravée — la rangée se souvient. */
    const stamp=g.createRadialGradient(-2,-9,1,0,-2,15);
    stamp.addColorStop(0,'#ffe9a8');stamp.addColorStop(.6,'#e8b85c');stamp.addColorStop(1,'#9a6b25');
    g.beginPath();g.arc(0,-2,12.5,0,TAU);g.fillStyle=stamp;g.fill();
    g.strokeStyle='#241d13';g.lineWidth=2.4;g.stroke();
    g.strokeStyle='#241d13';g.lineWidth=2.7;g.lineCap='round';g.lineJoin='round';
    g.beginPath();g.moveTo(-6.2,-2.2);g.lineTo(-1.6,3);g.lineTo(7.2,-7.4);g.stroke();
    g.fillStyle='#ffe9a8';g.globalAlpha=.92;g.font='bold 7px Arial';g.fillText('VALIDÉE',0,22);
   }else if(runeState==='active'){
    /* Allumée : halo pointillé tournant, cœur de cire chaude, lettre noire. */
    const pulse=1+Math.sin((gameTime||0)*6)*.08;
    g.scale(pulse,pulse);
    const hot=g.createRadialGradient(-2,-9,1,0,-2,16);
    hot.addColorStop(0,'#fff3c8');hot.addColorStop(.55,'#f2c77e');hot.addColorStop(1,'#8a5a1d');
    g.beginPath();g.arc(0,-2,12.5,0,TAU);g.fillStyle=hot;g.fill();
    g.strokeStyle='#241d13';g.lineWidth=2.4;g.stroke();
    g.fillStyle='#241d13';g.font='bold 12px Arial';g.fillText(w.runeLabel||'A',0,2);
    g.setLineDash([4,5]);g.lineDashOffset=-((gameTime||0)*30)%9;
    g.strokeStyle='#fff0b3';g.lineWidth=1.7;g.globalAlpha=.95;
    g.beginPath();g.arc(0,-2,17.5,0,TAU);g.stroke();g.setLineDash([]);
    g.fillStyle='#ffd977';g.font='bold 7px Arial';g.fillText('VISE-LA',0,22);
   }else{
    /* Scellée : ombre et lettre sourde — son tour viendra. */
    g.beginPath();g.arc(0,-2,12,0,TAU);g.fillStyle='#3a3048';g.fill();
    g.strokeStyle='#1f1830';g.lineWidth=2;g.stroke();
    g.fillStyle='#8d7fa8';g.font='bold 11px Arial';g.fillText(w.runeLabel||'?',0,2);
    g.fillStyle='#6d6088';g.font='bold 7px Arial';g.fillText('SCELLÉE',0,22);
   }
  }else{
   /* Clocher : une vraie cloche de bronze vus de face avec son battant — elle pulse et se nomme. */
   const pulse=1+Math.sin((gameTime||0)*5)*.06;
   g.translate(0,-1);g.scale(pulse,pulse);
   const bell=g.createLinearGradient(-14,-16,14,16);
   bell.addColorStop(0,'#f2e6b8');bell.addColorStop(.32,'#cfe6d8');bell.addColorStop(.68,'#4d8079');bell.addColorStop(1,'#26403f');
   g.beginPath();
   g.moveTo(-11.5,8);g.quadraticCurveTo(-12.5,-9,0,-13);g.quadraticCurveTo(12.5,-9,11.5,8);
   g.lineTo(15,12.5);g.lineTo(-15,12.5);g.closePath();
   g.fillStyle=bell;g.fill();g.strokeStyle='#0f2426';g.lineWidth=2.4;g.stroke();
   g.strokeStyle='#0f2426';g.lineWidth=1.5;
   g.beginPath();g.moveTo(-12,2);g.lineTo(12,2);g.moveTo(-12.7,7.2);g.lineTo(12.7,7.2);g.stroke();
   g.beginPath();g.arc(0,-15,2.6,0,TAU);g.fillStyle='#eafff3';g.fill();g.strokeStyle='#0f2426';g.stroke();
   g.beginPath();g.arc(0,17,3.2,0,TAU);g.fillStyle='#eafff3';g.fill();g.strokeStyle='#0f2426';g.stroke();
   g.globalAlpha=.9*g.globalAlpha;g.setLineDash([4,5]);g.strokeStyle='#eafff3';g.lineWidth=1.7;
   g.beginPath();g.arc(0,1,20+Math.sin((gameTime||0)*5)*1.8,0,TAU);g.stroke();g.setLineDash([]);
   /* Le libellé est placé dans un cadre distinct pour ne pas hériter du scale du battant. */
   g.restore();g.save();
   g.fillStyle='#eafff3';g.font='bold 8px Arial';g.textAlign='center';
   g.fillText(w.routeId==='wide'?'CLOCHE B · OUVRIR':'CLOCHE A · OUVRIR',0,29);
  }
  g.restore();
 }
 if(w.locked){g.fillStyle='#cfe6d8';g.font='bold 9px Arial';g.textAlign='center';g.fillText('SCELLÉ',0,-6)}
 if(w.gate==='wax'){g.fillStyle='#ff9aa4';g.font='bold 12px Arial';g.textAlign='center';g.fillText('SCEAU',0,12)}
 if(w.gate==='bronze'){g.strokeStyle='#cfe6d8';g.lineWidth=1.6;g.beginPath();g.arc(0,7,4.5,0,TAU);g.stroke();g.fillStyle='#cfe6d8';g.beginPath();g.arc(0,7,1.4,0,TAU);g.fill()}
 if(w.bonus){
  // Cire à cacheter et glyphe : on voit quel bloc vaut la peine d'être ouvert.
  g.fillStyle=w.bonus.color;g.globalAlpha=.9;
  g.beginPath();g.arc(0,-2,9,0,TAU);g.fill();
  g.globalAlpha=1;g.strokeStyle=m.crack;g.lineWidth=1.4;
  g.beginPath();g.arc(0,-2,9,0,TAU);g.stroke();
  g.save();g.translate(0,-2);g.fillStyle='#1a1428';drawSeal(g,w.bonus.kind);g.restore();
 }
 g.restore();
}

function draw(g){
 if(!active()||(!walls.length&&!routeRows.length))return;
 const m=material();
 for(const w of walls){
  if(w.dead)continue;
  if(w.y<0){
   // Annonce la rangée avant qu'elle n'entre : le joueur a le temps de viser.
   g.save();g.globalAlpha=.5;g.strokeStyle=m.glow;g.lineWidth=2;g.setLineDash([7,7]);
   g.beginPath();g.moveTo(w.x-w.w/2,6);g.lineTo(w.x+w.w/2,6);g.stroke();g.restore();
   continue;
  }
  drawBlock(g,w);
 }
 if(flashT>0){
  const k=flashT/.85;
  g.save();g.globalCompositeOperation='lighter';
  const blast=g.createRadialGradient(W/2,H*.38,30,W/2,H*.38,Math.max(W,H)*.68);
  blast.addColorStop(0,'rgba(255,240,190,'+(.55*k).toFixed(3)+')');
  blast.addColorStop(.5,'rgba(255,220,150,'+(.16*k).toFixed(3)+')');
  blast.addColorStop(1,'rgba(255,220,150,0)');
  g.fillStyle=blast;g.fillRect(0,0,W,H);g.restore();
 }
 for(const d of debris){
  const a=clamp(d.life/d.max,0,1);
  g.save();g.translate(d.x,d.y);g.rotate(d.rot);g.globalAlpha=a;
  g.fillStyle=d.color;g.strokeStyle='#241d13';g.lineWidth=1.3;
  g.beginPath();g.moveTo(-d.size,d.size*.45);g.lineTo(-d.size*.28,-d.size);g.lineTo(d.size,-d.size*.3);g.lineTo(d.size*.42,d.size);g.closePath();g.fill();g.stroke();g.restore();
 }
 /* Les deux issues d'une bifurcation restent identifiées jusqu'à la sortie
    de la rangée : le choix est visuel, pas caché dans le code. */
 for(const route of routeRows){
  if(route.y<34||route.y>H-28)continue;
  g.fillStyle='rgba(12,10,24,.62)';g.fillRect(0,route.y-ROW_H/2-12,W,(compactView()?26:22));
  g.save();g.textAlign='center';g.font='bold '+(compactView()?'12px':'11px')+' Arial';
  if(route.stage===0){
   const prog=puzzleProgress[route.row]||0;
   /* Progression lisible : trois pastilles — ✓ validée, lettre allumée à son tour, sombre en attente. */
   const chipY=route.y-ROW_H/2-8,chipX=Math.round(W/2)-28;
   g.save();g.lineWidth=1.6;g.textAlign='center';
   for(let i=0;i<3;i++){
    const cxp=chipX+i*28,done=i<prog,live=i===prog;
    g.beginPath();g.arc(cxp,chipY,8.5,0,TAU);
    g.fillStyle=done?'#e8b85c':live?'#f2c77e':'#3a3048';g.fill();
    g.strokeStyle=done?'#241d13':live?'#fff0b3':'#241d33';g.stroke();
    g.fillStyle=done||live?'#241d13':'#8d7fa8';
    g.font='bold 9px Arial';
    g.fillText(done?'✓':String.fromCharCode(65+i),cxp,chipY+3);
    if(i<2){g.strokeStyle=i<prog?'#e8b85c':'#4a3b46';g.beginPath();g.moveTo(cxp+9,chipY);g.lineTo(cxp+19,chipY);g.stroke()}
   }
   g.restore();
   if(prog>=3){
    g.fillStyle='#8ee9e2';g.fillText('LES DEUX ROUTES SONT LIBRES',route.narrowX,route.y-ROW_H/2-5);
    g.fillStyle='#8ee9e2';g.fillText('SEUL L’ABÎME DE CIRE RESTE',route.wideX,route.y-ROW_H/2-5);
    if(route.cacheX!=null){g.fillStyle='#f4ce83';g.fillText('CACHE FACULTATIVE',route.cacheX,route.y-ROW_H/2-5)}
   }else{
    const runeNext=['A','B','C'][prog];
    g.fillStyle='#ffd9a0';g.fillText('RUNES A → B → C',route.narrowX,route.y-ROW_H/2-5);
    g.fillStyle='#cfe6d8';g.fillText('RUNE '+runeNext+' ALLUMÉE',route.wideX,route.y-ROW_H/2-5);
    if(route.cacheX!=null){g.fillStyle='#f4ce83';g.fillText('CACHE FACULTATIVE',route.cacheX,route.y-ROW_H/2-5)}
   }
  }else if(route.stage===1){
   g.fillStyle='#cfe6d8';g.fillText('CLOCHE A · OUVRIR',route.narrowX,route.y-ROW_H/2-5);
   g.fillText('CLOCHE B · OUVRIR',route.wideX,route.y-ROW_H/2-5);
  }else{
   g.fillStyle='#ffd9a0';g.fillText('ÉTROIT · CACHE À CASSER',route.narrowX,route.y-ROW_H/2-5);
   g.fillStyle='#cfe6d8';g.fillText('LARGE · SÛR',route.wideX,route.y-ROW_H/2-5);
  }
  g.restore();
 }
 if(pinTime>.2){
  g.save();g.textAlign='center';g.fillStyle='#ff9d7a';
  g.font='bold '+(compactView()?'20px':'14px')+' Arial';
  g.fillText('COINCÉ · CASSE LE BLOC',clamp(player.x,120,W-120),player.y-42);
  g.restore();
 }
}

/* --- Branchement : on relaie les points d'entrée existants --------------- */
const baseTick=SH.tick,baseDraw=SH.draw;
SH.tick=function(dt){baseTick(dt);tick(dt)};
SH.draw=function(g){baseDraw(g);draw(g)};
const baseTarget=targetScrollSpeed;
targetScrollSpeed=function(){
 const value=baseTarget();
 return window.Campaign?.activeWorld===3?Math.min(260,value*1.5):value;
};

window.SixthLabyrinth={
 tick,draw,reset,spawnRow,damageBlock,addPanel,
 get walls(){return walls},get pinTime(){return pinTime},get broken(){return broken},
 get speedBoost(){return 1.5},get routeRows(){return routeRows},FORK_EVERY,
 MATERIALS,CELL,COLS,ROW_H,BONUS,BONUS_CHANCE,rollBonus,releaseBonus
};
})();
