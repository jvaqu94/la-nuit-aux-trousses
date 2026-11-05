/* Deuxième campagne, rencontre du Veilleur et progression de mondes. */
(()=>{
'use strict';
const KEY='minuit-campaign-v1';
const blank=()=>({version:1,world1Completed:false,world2Unlocked:false,world2Completed:false,cardOath:false,lastWorld:1,choice:'',character:'witch',world2Started:false,world3Unlocked:false,world3Started:false,world3Completed:false,cardSixthHour:false,minutesKept:0});
function normalize(value){
 const source=value&&typeof value==='object'?value:{},result={...blank()};
 for(const key of ['world1Completed','world2Unlocked','world2Completed','cardOath','world2Started','world3Unlocked','world3Started','world3Completed','cardSixthHour'])result[key]=source[key]===true;
 if(result.world2Completed)result.world2Unlocked=true;
 if(result.world2Unlocked){result.world1Completed=true;result.cardOath=true}
 if(result.world3Completed)result.world3Unlocked=true;
 if(result.world3Unlocked){result.world2Completed=true;result.cardSixthHour=true}
 result.minutesKept=Math.max(0,Math.min(15,Math.floor(Number(source.minutesKept)||0)));
 result.lastWorld=result.world3Unlocked?3:result.world2Unlocked?2:1;
 result.choice=['dawn','night'].includes(source.choice)?source.choice:'';
 result.character=['witch','hunter'].includes(source.character)?source.character:'witch';
 return result;
}
let progress=blank();
try{progress=normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch{}
let activeWorld=1,menuWorld=progress.world2Unlocked?progress.lastWorld:1,finale=null,sequelGradientCache=[];
const firstWorlds=worlds.map(item=>({...item}));
const secondWorlds=[
 {name:'La Ville sans ombres',short:'VILLE BLANCHE',colors:['#25384b','#111d30','#476273'],moon:'#ffe4a8',boss:'Le Lanternier blanc',kind:'lanternier',foes:['lampWisp','shadePostman'],hour:'L’heure des refuges'},
 {name:'Le Désert de midi',short:'DÉSERT DE VERRE',colors:['#4a3044','#191b30','#806052'],moon:'#ffd69b',boss:'La Reine de verre',kind:'glassqueen',foes:['glassMite','sunMirror'],hour:'L’heure des mirages'},
 {name:'La Forêt du cadran',short:'FORÊT DU CADRAN',colors:['#173b3b','#0d202a','#315a52'],moon:'#b8efd4',boss:'Le Cerf des heures',kind:'clockstag',foes:['rootClock','timeLarva'],hour:'L’heure des racines'},
 {name:'L’Express du soleil',short:'EXPRESS DU SOLEIL',colors:['#3b2947','#151a2c','#72505b'],moon:'#ffca91',boss:'Le Contrôleur céleste',kind:'conductor',foes:['railImp','sunLuggage'],hour:'L’heure du voyage'},
 {name:'Le Palais de l’aube',short:'PALAIS DE L’AUBE',colors:['#30384e','#141a2b','#696174'],moon:'#fff0bd',boss:'L’Horloger de l’Aube',kind:'clockmaker',foes:['needleWraith','hourHollow'],hour:'L’heure du grand cadran'}
];
/* Monde 3 · La Sixième Heure : cinq univers, cinq veilles, cinq gardiens sans barre de vie. */
const thirdWorlds=[
 {name:'Le Faubourg des veilles',short:'FAUBOURG',colors:['#2a2440','#141327','#4a3a5c'],moon:'#ffd9a0',boss:'La Veilleuse',kind:'veilleuse',foes:['wickWarden','waxCourier','shutterImp','waxMimic'],hour:'L’heure des fenêtres'},
 {name:'Le Clocher muet',short:'CLOCHER',colors:['#1f3340','#101c26','#3c5a63'],moon:'#cfe6d8',boss:'Le Sonneur sans battant',kind:'sonneur',foes:['bronzeCrow','crackedBell'],hour:'L’heure qui n’a pas sonné'},
 {name:'L’Estran des pas perdus',short:'ESTRAN',colors:['#26333f','#111a24','#465a63'],moon:'#e8dcc0',boss:'Le Passeur sans ombre',kind:'passeur',foes:['saltWalker','printThief'],hour:'L’heure des traces'},
 {name:'Le Bois des lanternes rendues',short:'LANTERNES RENDUES',colors:['#2b2338','#141020','#4b3a55'],moon:'#f4c98f',boss:'La Cueilleuse de flammes',kind:'cueilleuse',foes:['wickPicker','hollowFlame','snufferHand'],hour:'L’heure des flambeaux rendus'},
 {name:'Le Cadran noir',short:'CADRAN NOIR',colors:['#1a1730','#0d0b1a','#3a2f52'],moon:'#fff0bd',boss:'Le Chasseur sans visage',kind:'chasseur',foes:['unnamedDigit','facelessEcho'],hour:'L’heure aux trousses'}
];
function save(){
 if(window.MinuitImporting)return;
 try{localStorage.setItem(KEY,JSON.stringify(progress));window.MinuitCloud?.schedule?.()}catch{}
}
function validateSave(bundle){
 const value=bundle.saves[KEY];
 if(value==null)return bundle;
 const booleans=['world1Completed','world2Unlocked','world2Completed','cardOath','world2Started'];
 const optionalBooleans=['world3Unlocked','world3Started','world3Completed','cardSixthHour'];
 const minutes=value.minutesKept;
 if(minutes!=null&&(!Number.isInteger(minutes)||minutes<0||minutes>15))throw Error('Minutes rendues invalides.');
 if(value.version!==1||booleans.some(key=>typeof value[key]!=='boolean')||optionalBooleans.some(key=>value[key]!=null&&typeof value[key]!=='boolean')||![1,2,3].includes(value.lastWorld)||!['','dawn','night'].includes(value.choice)||!['witch','hunter'].includes(value.character))throw Error('Progression des mondes invalide.');
 return bundle;
}
function unlockFirstWorld(){
 const fresh=!progress.world1Completed;
 progress.world1Completed=true;progress.world2Unlocked=true;progress.cardOath=true;progress.lastWorld=2;menuWorld=2;
 save();return fresh;
}
function completeSecondWorld(){
 if(progress.world2Completed)return;
 progress.world2Completed=true;progress.lastWorld=2;save();
}
function world2Clears(){
 if(progress.world2Completed)return 5;
 try{const cp=checkpoint();return cp?.campaign===2?Math.max(0,Math.min(5,Number(cp.clears)||0)):0}catch{return 0}
}
function unlockSecondWorld(){
 const fresh=!progress.world3Unlocked;
 progress.world2Completed=true;progress.world3Unlocked=true;progress.cardSixthHour=true;progress.lastWorld=3;menuWorld=3;
 save();return fresh;
}
function completeThirdWorld(){
 if(progress.world3Completed)return;
 progress.world3Completed=true;progress.lastWorld=3;save();
}
function keepMinutes(n){
 const before=progress.minutesKept;
 progress.minutesKept=Math.max(0,Math.min(15,before+Math.max(0,Math.floor(Number(n)||0))));
 if(progress.minutesKept!==before)save();
 return progress.minutesKept;
}
function world3Clears(){
 if(progress.world3Completed)return 5;
 try{const cp=checkpoint();return cp?.campaign===3?Math.max(0,Math.min(5,Number(cp.clears)||0)):0}catch{return 0}
}
function applyWorld(id){
 activeWorld=[2,3].includes(id)?id:1;
 const source=activeWorld===3?thirdWorlds:activeWorld===2?secondWorlds:firstWorlds;
 worlds.splice(0,worlds.length,...source.map(item=>({...item})));
 backgroundGradientCache=[];terrainCache=[];sequelGradientCache=[];
 stage=Math.max(0,Math.min(4,Number(stage)||0));world=worlds[stage];
 document.body.classList.toggle('sequel-theme',activeWorld===2);
 document.body.classList.toggle('sixth-hour-theme',activeWorld===3);
 audioSignature='';
}
function hunterActive(){return [2,3].includes(activeWorld)&&progress.character==='hunter'&&['play','pause','choice'].includes(state)&&!window.Adventure?.training&&!window.WeeklySprint?.active}
let hourObjective={stage:-1,got:0,spawned:0,next:0,shards:[]};
function sequelHUD(){
 if(activeWorld===3&&state==='play'){$('modeLabel').textContent='◷ La Sixième Heure · '+(progress.character==='hunter'?'Le Veilleur':'La sorcière')+' · Minutes rendues '+progress.minutesKept+'/15';return}
 if(activeWorld===2&&state==='play')$('modeLabel').textContent='✦ Les Cinq Heures Perdues · '+(progress.character==='hunter'?'Le Veilleur':'La sorcière')+' · Fragments '+hourObjective.got+'/3';
}
function resetHourObjective(){hourObjective={stage,got:0,spawned:0,next:gameTime+3,shards:[]};sequelHUD()}
function tickHourObjective(dt){
 if(hourObjective.stage!==stage)resetHourObjective();
 if(hourObjective.spawned<3&&gameTime>=hourObjective.next){
  const index=hourObjective.spawned++;hourObjective.next=gameTime+12;
  hourObjective.shards.push({x:125+(stage*173+index*257)%550,y:185,age:0,index});
  say('Fragment d’heure détecté · explore sa lueur',2.2);
 }
 for(const shard of hourObjective.shards){
  shard.age+=dt;shard.y+=(43+stage*5)*dt;
  if(shard.y>H+45){shard.y=180;shard.x=110+(shard.index*277+stage*131+Math.floor(gameTime))%570}
  if(Math.hypot(player.x-shard.x,player.y-shard.y)<48){
   shard.collected=true;hourObjective.got++;score+=300*(stage+1);particle(shard.x,shard.y,'#ffe2a0',28);tone(660+hourObjective.got*90,.35,'sine',.08,1.35);
   if(hourObjective.got===3){score+=750;say('VOIE LIBÉRÉE · 3/3 fragments · +750',3)}else say('FRAGMENT LIBÉRÉ · '+hourObjective.got+'/3',2.4);
   updateHUD();sequelHUD();
  }
 }
 hourObjective.shards=hourObjective.shards.filter(shard=>!shard.collected);
}
function drawHourObjective(g){
 for(const shard of hourObjective.shards){
  g.save();g.translate(shard.x,shard.y);g.rotate(shard.age*.45);g.shadowBlur=22;g.shadowColor='#ffe1a0';g.strokeStyle='#ffe3a5';g.lineWidth=3;g.beginPath();g.arc(0,0,22,0,Math.PI*2);g.stroke();g.lineWidth=1;g.beginPath();g.arc(0,0,16,0,Math.PI*2);g.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;line(g,Math.cos(a)*17,Math.sin(a)*17,Math.cos(a)*23,Math.sin(a)*23,'#fff0bd',2)}line(g,0,0,0,-13,'#fff4cc',2);line(g,0,0,10,5,'#fff4cc',2);ellipse(g,0,0,3,3,'#fff8dc');g.restore();
  g.fillStyle='#fff0c4';g.font='bold 9px Arial';g.textAlign='center';g.fillText('HEURE À LIBÉRER',shard.x,shard.y+39);
 }
}

/* Cinq silhouettes originales, conservées en SVG local comme les autres acteurs. */
function bossAsset(id,body){
 const image=new Image();
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -65 120 130" fill="none" stroke-linecap="round" stroke-linejoin="round"><defs><linearGradient id="metal" x2=".8" y2="1"><stop stop-color="#fff0c4"/><stop offset=".45" stop-color="#b7a68e"/><stop offset="1" stop-color="#4b4c63"/></linearGradient><linearGradient id="cloth" x2=".7" y2="1"><stop stop-color="#7d7194"/><stop offset=".5" stop-color="#3b3858"/><stop offset="1" stop-color="#191d32"/></linearGradient><radialGradient id="light"><stop stop-color="#fffbe0"/><stop offset=".45" stop-color="#ffd488"/><stop offset="1" stop-color="#c97c67"/></radialGradient></defs>${body}</svg>`);
 window.MinuitArt[id]=image;
}
bossAsset('lanternier',`<path d="M-25 57-19-5 0-19 20-5 28 57 0 45Z" fill="url(#cloth)" stroke="#cab58f" stroke-width="2"/><path d="M-18 1 0 13 19 0M-13 19 0 29 14 18" stroke="#ece0bb" stroke-width="2"/><path d="M-15-18Q0-35 16-18L12 2 0 11-13 1Z" fill="url(#metal)" stroke="#51465b" stroke-width="2"/><path d="M-29-27 0-40 29-27 17-20-18-20Z" fill="#30374c" stroke="#f2d69c" stroke-width="2"/><path d="M-6-45 0-58 7-45 0-36Z" fill="url(#light)"/><path d="M-35 5-47 37M31 4 45 34" stroke="url(#metal)" stroke-width="7"/><path d="M38 27Q49 13 54 28L51 50 39 50Z" fill="#34344a" stroke="#f5d591" stroke-width="2"/><ellipse cx="46" cy="38" rx="7" ry="10" fill="url(#light)"/><path d="M-7-15 7-15" stroke="#fff4c6" stroke-width="3"/>`);
bossAsset('glassqueen',`<path d="M0 41-39 57-25 5-13-10 13-10 28 6 40 57Z" fill="#7187a4" fill-opacity=".65" stroke="#d9e8e6" stroke-width="2"/><path d="M-25 7 0 28 27 5M0 28 0 51M-15-7 0 11 16-8" stroke="#f7d7c2" stroke-width="1.5"/><path d="M-15-27Q0-42 16-26L12-7 0 3-13-8Z" fill="#e8c5b6" stroke="#6b5269" stroke-width="2"/><path d="M-25-31-18-54-5-39 4-61 14-39 28-53 23-27Z" fill="url(#metal)" stroke="#f3e5c5" stroke-width="2"/><path d="M-9-23-2-21M6-21 12-24" stroke="#503e5c" stroke-width="2"/><path d="M-37 15-52 1-48 29-35 38ZM37 14 51-2 49 29 36 39Z" fill="#a8d7df" fill-opacity=".45" stroke="#e9ffff"/><path d="M-46 6-39 26M45 5 39 27" stroke="#fff" stroke-opacity=".65"/>`);
bossAsset('clockstag',`<path d="M-30 53Q-35 16-19-2L-13-22 13-22 22-1Q36 19 30 53L10 43 0 54-12 43Z" fill="url(#cloth)" stroke="#90bda9" stroke-width="2"/><path d="M-16-24Q0-39 17-24L13 3 0 17-14 3Z" fill="#9e8269" stroke="#e0c99e" stroke-width="2"/><path d="M-11-28-29-45-35-60M-25-41-42-43M-18-34-18-55M12-28 30-45 36-60M26-41 43-43M19-34 19-55" stroke="url(#metal)" stroke-width="4"/><path d="M-9-13-3-11M6-11 11-14" stroke="#fff1b5" stroke-width="3"/><path d="M0-7-4 2 0 5 5 1Z" fill="#25343b"/><circle cy="30" r="15" fill="#182d35" stroke="#e3c98f" stroke-width="2"/><path d="M0 30 0 20M0 30 9 34" stroke="#ffe4a6" stroke-width="2"/><circle cy="30" r="3" fill="#ffe4a6"/>`);
bossAsset('conductor',`<path d="M-28 56-20-8 0-18 21-7 29 56 8 45 0 55-10 45Z" fill="#4c3f61" stroke="#d2a980" stroke-width="2"/><path d="M-16-4 0 9 17-5M0 9 0 43M-13 19 13 19" stroke="#e8c796" stroke-width="2"/><path d="M-14-31Q0-43 15-30L12-10 0 0-13-11Z" fill="#c79582" stroke="#4d3d55" stroke-width="2"/><path d="M-26-34-17-48 17-48 29-34 12-29-17-29Z" fill="#272a43" stroke="#e0b782" stroke-width="2"/><path d="M-17-48 0-58 18-48" fill="#3e3a55" stroke="#e0b782" stroke-width="2"/><path d="M-8-23-2-21M5-21 11-23" stroke="#ffe5ae" stroke-width="2"/><path d="M-29 2-45 27M28 1 45-16" stroke="#56445e" stroke-width="8"/><circle cx="46" cy="-20" r="12" fill="url(#metal)" stroke="#fff0bd" stroke-width="2"/><path d="M46-20 46-27M46-20 52-17" stroke="#3f3b50" stroke-width="2"/><path d="M-42 28-52 48" stroke="#e8d5aa" stroke-width="3"/>`);
bossAsset('clockmaker',`<circle cy="-18" r="45" stroke="#b89b71" stroke-width="4"/><circle cy="-18" r="35" stroke="#6e6479" stroke-width="2" stroke-dasharray="3 6"/><path d="M0-18 0-48M0-18 24-4M0-18-21-35" stroke="#ffe0a0" stroke-width="3"/><path d="M-32 58-25-3 0-19 26-2 34 58 13 45 0 58-14 45Z" fill="url(#cloth)" stroke="#d0af7e" stroke-width="2"/><path d="M-15-29Q0-43 16-28L12-6 0 4-13-7Z" fill="#b58d7c" stroke="#493d50" stroke-width="2"/><path d="M-25-35 0-55 27-34 17-27-18-27Z" fill="#242b40" stroke="#ecc98c" stroke-width="2"/><path d="M-8-20-2-18M5-18 11-20" stroke="#fff0b8" stroke-width="3"/><path d="M-18 3 0 17 19 2M-14 24 14 24M0 17 0 47" stroke="#d9bc8a" stroke-width="2"/><path d="M-35 5-49 35M34 5 49 35" stroke="#575064" stroke-width="8"/><circle cx="-49" cy="38" r="10" fill="url(#light)"/><circle cx="49" cy="38" r="10" fill="url(#light)"/>`);

/* Décor de la seconde campagne : pas de photographies ni de ressources distantes. */
function drawSecondBackground(t){
 const g=ctx,index=Math.max(0,Math.min(4,stage)),w=worlds[index];
 let bg=sequelGradientCache[index];
 if(!bg){bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,w.colors[0]);bg.addColorStop(.58,w.colors[1]);bg.addColorStop(1,w.colors[2]);sequelGradientCache[index]=bg}
 g.fillStyle=bg;g.fillRect(0,0,W,H);
 const drift=terrainDistance*.18;
 for(let i=0;i<52;i++){
  const x=(i*137.3)%W,y=(i*83.7+drift*(1+i%3))%H;
  g.globalAlpha=.12+(Math.sin(t*.7+i)+1)*.08;ellipse(g,x,y,1+i%2,1+i%2,w.moon);
 }
 g.globalAlpha=1;
 const halo=g.createRadialGradient(625,155,12,625,155,190);halo.addColorStop(0,w.moon+'44');halo.addColorStop(1,w.moon+'00');g.fillStyle=halo;g.fillRect(420,-40,410,410);
 g.strokeStyle=w.moon+'55';g.lineWidth=3;g.beginPath();g.arc(625,155,55,0,Math.PI*2);g.stroke();g.lineWidth=1;g.beginPath();g.arc(625,155,43,0,Math.PI*2);g.stroke();
 for(let i=0;i<12;i++){const a=i*Math.PI/6+t*.035;line(g,625+Math.cos(a)*45,155+Math.sin(a)*45,625+Math.cos(a)*53,155+Math.sin(a)*53,w.moon+'88',2)}
 line(g,625,155,625+Math.sin(t*.08)*30,155-Math.cos(t*.08)*30,w.moon,3);line(g,625,155,647,166,w.moon,2);ellipse(g,625,155,4,4,w.moon);
 const base=650,scroll=terrainDistance*.32;
 if(index===0){
  for(let i=0;i<10;i++){const x=((i*113-scroll)%1000+1000)%1000-100,h=100+(i*47)%170;g.fillStyle=i%2?'#1a2838':'#223447';g.fillRect(x,base-h,78,h+250);for(let y=base-h+25;y<base-15;y+=34){g.fillStyle=w.moon+'33';g.fillRect(x+14,y,9,14);g.fillRect(x+50,y,9,14)}line(g,x+78,base-h,x+78,base+120,'#8ca0a522',2)}
 }else if(index===1){
  for(let layer=0;layer<3;layer++){g.fillStyle=['#624658','#4c3c50','#312e42'][layer];g.beginPath();g.moveTo(0,H);for(let x=0;x<=W;x+=25)g.lineTo(x,610+layer*90+Math.sin(x*.009+layer+scroll*.002)*42);g.lineTo(W,H);g.closePath();g.fill()}
  for(let i=0;i<9;i++){const x=(i*127+scroll*.4)%950-60,y=490+(i%4)*83;poly(g,[[x,y-45],[x+16,y],[x,y+45],[x-13,y]],'#c3e0dc22','#f4dfbd55')}
 }else if(index===2){
  for(let i=0;i<12;i++){const x=((i*91-scroll*.55)%1000+1000)%1000-100,h=130+(i*37)%140;line(g,x,base-h,x,base+160,i%2?'#142d30':'#1d3837',12);for(let j=0;j<4;j++)poly(g,[[x,base-h-35+j*37],[x-48+j*5,base-h+45+j*37],[x+48-j*5,base-h+45+j*37]],i%2?'#1c3c38':'#244840');g.strokeStyle=w.moon+'33';g.beginPath();g.arc(x,base-h+45,15,0,Math.PI*2);g.stroke()}
 }else if(index===3){
  g.fillStyle='#171c2c';g.fillRect(0,610,W,290);for(let i=0;i<8;i++){const x=((i*160-scroll*1.4)%1200+1200)%1200-200;g.fillStyle=i%2?'#473747':'#362f43';g.fillRect(x,510,132,160);g.fillStyle=w.moon+'44';for(let wx=x+17;wx<x+115;wx+=32)g.fillRect(wx,540,18,25);line(g,x,510,x+132,510,'#d0a17766',3)}
  for(let y=690;y<900;y+=55){line(g,0,y,W,y,'#b98b6755',3);for(let x=-((scroll*2)%80);x<W;x+=80)line(g,x,y-10,x+30,y+10,'#6c5360',5)}
 }else{
  for(let i=0;i<7;i++){const x=((i*157-scroll*.25)%1100+1100)%1100-150,y=500+(i%3)*110,r=45+(i%3)*18;g.strokeStyle=i%2?w.moon+'44':'#9e8b9c55';g.lineWidth=8;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();for(let a=0;a<8;a++){const angle=a*Math.PI/4+t*.05*(i%2?1:-1);line(g,x+Math.cos(angle)*(r-8),y+Math.sin(angle)*(r-8),x+Math.cos(angle)*(r+10),y+Math.sin(angle)*(r+10),w.moon+'44',5)}}
  g.fillStyle='#171d2d99';g.fillRect(0,735,W,165);for(let x=30;x<W;x+=125){g.fillStyle='#242c3e';g.fillRect(x,610,70,290);poly(g,[[x-10,610],[x+35,560],[x+80,610]],'#242c3e')}
 }
 g.globalAlpha=1;
 const shade=g.createLinearGradient(0,280,0,H);shade.addColorStop(0,'#080c1700');shade.addColorStop(1,'#080c1744');g.fillStyle=shade;g.fillRect(0,280,W,H-280);
}
const baseBackground=drawBackground;
drawBackground=function(t){if(activeWorld===2)drawSecondBackground(t);else baseBackground(t)};

/* Les gardiens du monde 2 utilisent SequelBestiary, sans salves ni charges du monde 1. */

/* Le Veilleur ne chasse plus pendant la seconde campagne. */
if(window.Nemesis){
 const wants=Nemesis.wants,tick=Nemesis.tick;
 Nemesis.wants=function(...args){return [2,3].includes(activeWorld)?false:wants(...args)};
 Nemesis.tick=function(...args){if(![2,3].includes(activeWorld))return tick(...args)};
}

/* Style du Veilleur jouable : plus lent, tir en éventail et lanterne de départ. */
const baseSprite=sprite;
sprite=function(g,kind,x,y,s=1,t=0,hit=0,tint=''){
 if(kind==='witch'&&hunterActive())return baseSprite(g,'hunter',x,y,s*1.3,t,hit,tint);
 return baseSprite(g,kind,x,y,s,t,hit,tint);
};
const baseMuzzle=broomMuzzle;
broomMuzzle=function(){return hunterActive()?{x:player.x,y:player.y-58}:baseMuzzle()};
if(window.Arsenal?.speed){const speed=Arsenal.speed;Arsenal.speed=function(focus){return speed(focus)*(hunterActive()?.9:1)}}
const baseUpdate=update;
update=function(dt){
 const before=shots.length;baseUpdate(dt);
 if(activeWorld===2&&state==='play'&&!window.SandboxMode&&!window.WeeklySprint?.active)tickHourObjective(dt);
 if(!hunterActive()||state!=='play'||shots.length<=before)return;
 const created=shots.slice(before).filter(shot=>!shot.familiar&&!shot.hunterSide);
 if(!created.length)return;
 player.fire=Math.max(player.fire,.28);
 for(const side of [-1,1])shots.push({x:player.x,y:player.y-52,vx:side*105,vy:-590,damage:.75,life:2,pierce:0,seen:new Set(),hunterSide:true});
};

/* Sauvegarde du monde et du personnage dans le checkpoint existant. */
const baseSaveCheckpoint=saveCheckpoint;
saveCheckpoint=function(...args){
 const result=baseSaveCheckpoint(...args);
 if(window.SandboxMode)return result;
 try{const cp=JSON.parse(localStorage.getItem('minuit-checkpoint')||'null');if(cp&&state==='play'){cp.campaign=activeWorld;cp.character=progress.character;if(activeWorld===2)cp.hourObjective={got:hourObjective.got};if(activeWorld===3)cp.sixthHour=window.SixthHour?.checkpoint?.()||null;localStorage.setItem('minuit-checkpoint',JSON.stringify(cp))}}catch{}
 return result;
};
const baseResume=resumeCheckpoint;
resumeCheckpoint=function(...args){
 const cp=checkpoint();applyWorld([2,3].includes(cp?.campaign)?cp.campaign:1);
 if(cp?.character)progress.character=cp.character;
 const result=baseResume(...args);
 if(state==='play'&&activeWorld===2){const got=Math.max(0,Math.min(3,Number(cp?.hourObjective?.got)||0));hourObjective={stage,got,spawned:got,next:gameTime+2,shards:[]};runId='world2-'+prefs.difficulty;sequelHUD();updateHUD();refreshBoard();saveCheckpoint()}
 if(state==='play'&&activeWorld===3){runId='world3-'+prefs.difficulty;window.SixthHour?.restore?.(cp?.sixthHour);sequelHUD();updateHUD();refreshBoard();saveCheckpoint()}
 return result;
};
const baseChallenge=LocalLeague.challenge;
LocalLeague.challenge=function(...args){applyWorld(1);return baseChallenge(...args)};
const baseDifficultyName=difficultyName;
difficultyName=function(value){return String(value).startsWith('world3-')?'Monde 3 · '+baseDifficultyName(String(value).slice(7)):String(value).startsWith('world2-')?'Monde 2 · '+baseDifficultyName(String(value).slice(7)):baseDifficultyName(value)};

const leaguePlay=LocalLeague.play;
function startWorld(id){
 if(id===3&&!progress.world3Unlocked)return false;
 if(id===2&&!progress.world2Unlocked)return false;
 if(window.GuidedTraining?.required?.()){applyWorld(1);leaguePlay();return true}
 applyWorld(id);leaguePlay();
 if(state!=='play'){applyWorld(menuWorld);return false}
 if(id===2){
  progress.world2Started=true;save();runId='world2-'+prefs.difficulty;recordAtStart=getHighScore();
  if(Journey.run)Journey.run.record=recordAtStart;
  if(hunterActive()){player.shield=Math.max(player.shield,50);player.shieldTime=Math.max(player.shieldTime,MINUIT_BALANCE.shield.duration)}
  resetHourObjective();
  updateHUD();refreshBoard();saveCheckpoint();say(world.name+' · '+(progress.character==='hunter'?'La veille recommence':'Une nouvelle expédition'),3);
 }
 if(id===3){
  progress.world3Started=true;save();runId='world3-'+prefs.difficulty;recordAtStart=getHighScore();
  if(Journey.run)Journey.run.record=recordAtStart;
  window.SixthHour?.start?.();
  updateHUD();sequelHUD();refreshBoard();saveCheckpoint();say(world.name+' · '+thirdWorlds[stage].hour,3);
 }
 return true;
}
LocalLeague.play=function(){if(window.SandboxMode||window.Adventure?.training)applyWorld(1);return startWorld([2,3].includes(activeWorld)&&progress.world2Unlocked?activeWorld:1)};
const startTransient=LocalLeague.startTransient;
LocalLeague.startTransient=function(...args){applyWorld(1);return startTransient(...args)};
function briefing(){
 if(!progress.world2Unlocked)return;
 state='sequel-briefing';applyWorld(2);
 overlay(`<section class="sequel-briefing"><div class="eyebrow">DEUXIÈME CAMPAGNE · CINQ HEURES À RETROUVER</div><h2 class="local-title">Les Cinq Heures<br>Perdues</h2><p>L’aube s’est figée après Halloween. L’Horloger a volé cinq heures de la nuit pour instaurer un jour permanent. La sorcière n’est plus une proie : elle choisit d’aider le Veilleur à rétablir le cycle.</p><blockquote>« Je t’ai chassée. Je ne te demande pas de l’oublier. Je te demande de m’aider à sauver la nuit. »</blockquote><div class="local-rule">Pilotage et tir sont conservés, mais la faune est inédite : libération, survie et sabotage rythment les vagues. Chaque gardien possède ses propres attaques télégraphiées. Les trois fragments d’heure récompensent l’exploration.</div><div class="sequel-character-grid"><button class="sequel-character" id="chooseWitch"><span class="sequel-character-art"><img src="${window.MinuitArt.witch.src}" alt=""></span><b>La sorcière</b><small>Pilotage et attaque actuels, mobile et familière.</small></button><button class="sequel-character" id="chooseHunter"><span class="sequel-character-art"><img src="${window.MinuitArt.hunter.src}" alt=""></span><b>Le Veilleur</b><small>Vol plus lourd, carreaux en éventail et lanterne protectrice au départ.</small></button></div><div class="tiny">Cette campagne possède ses propres records. Les modes classés et quotidiens du premier monde restent inchangés.</div><div class="local-actions"><button class="secondary" id="sequelBriefBack">Retour au menu</button></div></section>`);
 $('chooseWitch').onclick=()=>{progress.character='witch';save();startWorld(2)};
 $('chooseHunter').onclick=()=>{progress.character='hunter';save();startWorld(2)};
 $('sequelBriefBack').onclick=()=>LocalLeague.menu();
}
function requestWorld(id){if(id===3&&!progress.world3Started){const screen=window.SixthHour?.briefing?.();return screen===undefined?startWorld(id):screen}if(id===2&&!progress.world2Started)return briefing();return startWorld(id)}

/* Accueil évolutif : le monde le plus avancé reste le point de reprise par défaut. */
function customizeHome(){
 const home=document.querySelector('.home-menu');if(!home)return;
 home.classList.toggle('sequel-home',menuWorld===2);home.classList.toggle('sixth-hour-home',menuWorld===3);home.classList.toggle('first-complete-home',menuWorld===1);
 const copy=home.querySelector('.menu-copy'),route=home.querySelector('.home-world-route');
 if(!copy||!route)return;
 const second=menuWorld===2,third=menuWorld===3;
 home.querySelector('.menu-kicker').textContent=third?'TROISIÈME CAMPAGNE · LA SIXIÈME HEURE':second?'DEUXIÈME CAMPAGNE · L’AUBE EST FIGÉE':'PREMIÈRE CAMPAGNE · MONDE ACCOMPLI';
 home.querySelector('.menu-copy p').textContent=third?'Le cycle est réparé, mais une heure sans chiffre se réveille. Cinq gardiens, cinq règles à comprendre : ici on ne gagne pas en tirant plus.':'Retrouve les cinq heures volées et affronte les gardiens de l’Horloger. La première nuit reste acquise.';
 route.innerHTML=third?'<span>5 univers</span><i>·</i><span>'+world3Clears()+'/5 veilles</span><i>·</i><span>'+progress.minutesKept+'/15 minutes rendues</span>':second?'<span>5 nouveaux mondes</span><i>·</i><span>25 vagues</span><i>·</i><span>'+world2Clears()+'/5 heures</span>':'<span>Monde 1 terminé ✓</span><i>·</i><span>Rejouable librement</span>';
 let subtitle=home.querySelector('.sequel-menu-subtitle');
 if(!subtitle){subtitle=document.createElement('div');subtitle.className='sequel-menu-subtitle';home.querySelector('h1').insertAdjacentElement('afterend',subtitle)}
 subtitle.textContent=third?'La Sixième Heure':second?'Les Cinq Heures Perdues':'La Nuit aux Trousses · Halloween';
 let switcher=home.querySelector('.campaign-switch');
 if(!switcher){switcher=document.createElement('div');switcher.className='campaign-switch';route.insertAdjacentElement('afterend',switcher)}
 switcher.innerHTML=`<button type="button" id="campaignWorld1" class="${menuWorld===1?'active':''}">1 · Halloween ✓</button><button type="button" id="campaignWorld2" class="${second?'active':''}">2 · Heures perdues ✓</button>${progress.world3Unlocked?'<button type="button" id="campaignWorld3" class="'+(third?'active':'')+'">3 · Sixième heure</button>':''}${second||third?'<button type="button" id="campaignCharacter">'+(progress.character==='hunter'?'Veilleur':'Sorcière')+' · changer</button>':''}`;
 $('campaignWorld1').onclick=()=>{menuWorld=1;applyWorld(1);Journey.menu()};
 $('campaignWorld2').onclick=()=>{menuWorld=2;applyWorld(2);Journey.menu()};
 if($('campaignWorld3'))$('campaignWorld3').onclick=()=>{menuWorld=3;applyWorld(3);Journey.menu()};
 if($('campaignCharacter'))$('campaignCharacter').onclick=third?()=>window.SixthHour?.briefing?.():briefing;
 const play=$('playAdventure');
 if(play){play.innerHTML='<span class="button-icon">'+(third?'◷':'✦')+'</span><span>'+(third?(progress.world3Completed?'Rejouer le monde 3':'Continuer'):second?(progress.world2Completed?'Rejouer le monde 2':'Continuer'):'Rejouer le monde 1')+'<small>'+(third?'La Sixième Heure':second?'Les Cinq Heures Perdues':'La première nuit · progression conservée')+'</small></span>';play.onclick=()=>requestWorld(menuWorld)}
}
const baseHome=Journey.menu;
Journey.menu=function(...args){
 if(progress.world2Unlocked&&![1,2,3].includes(menuWorld))menuWorld=progress.lastWorld;
 applyWorld(progress.world2Unlocked?menuWorld:1);
 const result=baseHome(...args);
 if(state==='league-menu'&&progress.world2Unlocked)customizeHome();
 return result;
};

/* La carte de campagne ne modifie ni les cosmétiques ni les statistiques. */
function grimoireCard(){
 const unlocked=progress.cardOath;
 return `<section class="campaign-grimoire-section"><h3>CARTES DE CAMPAGNE</h3><article class="campaign-grimoire-card ${unlocked?'unlocked':'locked'}"><div class="campaign-card-art" aria-hidden="true"><span class="campaign-card-clock">◷</span><img src="${window.MinuitArt.witch.src}" alt=""><img src="${window.MinuitArt.hunter.src}" alt=""></div><div class="campaign-card-copy"><small>CARTE 01 · ${unlocked?'DÉBLOQUÉE':'VERROUILLÉE'}</small><h3>Le Serment de l’Aube</h3><p>${unlocked?'La chasse est terminée. Cinq heures de la nuit ont disparu. Pour les retrouver, l’ancienne proie et son chasseur devront voler dans la même direction.':'Vaincs les cinq gardiens du premier monde pour dévoiler cette carte.'}</p><b>${unlocked?'Monde 2 débloqué · Les Cinq Heures Perdues':'Premier monde à accomplir'}</b></div></article>${sixthCard()}</section>`;
}
function sixthCard(){
 const unlocked=progress.cardSixthHour;
 return `<article class="campaign-grimoire-card ${unlocked?'unlocked':'locked'}"><div class="campaign-card-art" aria-hidden="true"><span class="campaign-card-clock">◷</span><img src="${window.MinuitArt.witch.src}" alt=""><img src="${window.MinuitArt.hunter.src}" alt=""></div><div class="campaign-card-copy"><small>CARTE 02 · ${unlocked?'DÉBLOQUÉE':'VERROUILLÉE'}</small><h3>La Sixième Heure</h3><p>${unlocked?'La chasse a cessé, mais l’heure qui la faisait courir n’a jamais été comptée. Elle veut un chiffre. Le Veilleur a sa flamme. Il ne reste qu’une nuit pour décider qui paiera.':'Rends les cinq heures volées pour dévoiler cette carte.'}</p><b>${unlocked?'Monde 3 débloqué · '+progress.minutesKept+'/15 minutes rendues':'Deuxième monde à accomplir'}</b></div></article>`;
}

/* Rencontre finale : pas de dégâts, pas de duel et aucun résultat fabriqué par le code créateur. */
function finaleDialogue(){
 const stats=finale?.preview?{}:Journey.state.recent[0]?.stats||{};
 if((stats.rivalRepelled||0)>=3)return'Cinq rencontres. Tu n’as plus rien à me prouver.';
 if((stats.rivalEncounters||0)>=3)return'Nos routes se sont croisées toute la nuit. Cette fois, je ne te barrerai pas le passage.';
 if(stats.rivalEncounters)return'Tu m’as glissé entre les doigts… mais tu es arrivée jusqu’à l’aube.';
 return'Je t’ai chassée toute la nuit. Cette fois, je te laisse passer.';
}
function renderFinalePanel(){
 if(!finale||!$('finalePanel'))return;
 const panel=$('finalePanel');
 if(finale.phase==='arrival')panel.innerHTML=`<small>LE DERNIER PASSAGE</small><p>Le Veilleur apparaît devant la sorcière, <b>arme baissée</b>.</p>${finale.ready?'<button class="primary" id="finaleApproach">S’approcher du Veilleur →</button>':'<span class="finale-wait">La nuit retient son souffle…</span>'}`;
 else if(finale.phase==='choice')panel.innerHTML=`<small>LE VEILLEUR</small><p>« ${finaleDialogue()} »</p><div class="finale-choices"><button class="primary" data-finale-choice="dawn">« Viens voir l’aube. »</button><button class="secondary" data-finale-choice="night">« Veille sur ceux qui restent. »</button></div>`;
 else panel.innerHTML=`<small>${finale.choice==='dawn'?'VERS L’AUBE, ENSEMBLE':'LA VEILLE CONTINUE'}</small><p>${finale.choice==='dawn'?'« Pour une fois, je la regarderai. » Il range son arme et prend place aux côtés de la sorcière.':'« À la prochaine nuit, sorcière. » Il la salue et retourne vers ceux qui ont besoin de lui.'}</p><button class="primary" id="finaleContinue">Continuer vers l’aube →</button>`;
 if($('finaleApproach'))$('finaleApproach').onclick=()=>{finale.phase='choice';finale.phaseStart=ambient;renderFinalePanel()};
 for(const button of panel.querySelectorAll('[data-finale-choice]'))button.onclick=()=>chooseFinale(button.dataset.finaleChoice);
 if($('finaleContinue'))$('finaleContinue').onclick=completeFinale;
}
function chooseFinale(choice){
 if(!finale||!['dawn','night'].includes(choice))return;
 finale.choice=choice;progress.choice=choice;save();finale.phase='resolution';finale.phaseStart=ambient;renderFinalePanel();tone(choice==='dawn'?523:392,.5,'sine',.045,1.2);
}
function decorateResult(){
 if(!progress.world2Unlocked)return;
 const screen=document.querySelector('#overlay .journey-result-screen');if(!screen)return;
 const actions=screen.querySelector('.local-actions');
 if(actions&&!screen.querySelector('#enterWorld2')){
  const button=document.createElement('button');button.id='enterWorld2';button.className='primary';button.textContent='Entrer dans le nouveau monde →';button.onclick=()=>requestWorld(2);actions.insertBefore(button,actions.firstChild);
 }
 if(!screen.querySelector('.campaign-unlock-note')){
  const note=document.createElement('div');note.className='journey-unlocked campaign-unlock-note';note.innerHTML='✦ Premier monde accompli · <b>Les Cinq Heures Perdues</b> et la carte <b>Le Serment de l’Aube</b> sont débloqués.';actions?.before(note);
 }
}
function beginFinale(onComplete,options={}){
 if(finale)return true;
 const preview=options.preview===true;
 if(!preview&&!(activeWorld===1&&progress.world2Unlocked&&clears>=5&&state==='end'))return false;
 if(!preview)decorateResult();
 finale={start:ambient,phaseStart:ambient,phase:'arrival',ready:false,choice:progress.choice||'dawn',preview,onComplete};
 state='sequel-finale';document.body.classList.add('sequel-finale-active');hideOverlay();moveInput={};pointer=null;
 document.querySelector('.arena').insertAdjacentHTML('beforeend','<button id="skipFinale" type="button">Passer la rencontre</button><section id="finalePanel" class="finale-panel" aria-live="polite"></section>');
 $('skipFinale').onclick=completeFinale;renderFinalePanel();tone(392,.6,'sine',.045,1.2);return true;
}
function completeFinale(){
 if(!finale)return;
 const preview=finale.preview,callback=finale.onComplete;
 finale=null;$('skipFinale')?.remove();$('finalePanel')?.remove();document.body.classList.remove('sequel-finale-active');
 if(preview){showUnlockedWorld();return}
 state='end';if(typeof callback==='function')callback();
}
function showUnlockedWorld(){
 state='sequel-unlock';applyWorld(2);
 overlay(`<section class="sequel-unlocked"><div class="eyebrow">PREMIER MONDE ACCOMPLI ✓</div><h2 class="local-title">Les Cinq Heures<br>Perdues</h2><p>Le nouveau monde et la carte <b>Le Serment de l’Aube</b> sont débloqués. Le code de test n’a enregistré aucun score.</p><div class="campaign-unlock-card"><span>◷</span><div><b>L’aube s’est figée.</b><small>5 mondes · 5 gardiens · 5 heures à retrouver</small></div></div><div class="local-actions"><button class="primary" id="testWorld2">Tester le nouveau monde →</button><button class="secondary" id="unlockMenu">Menu</button></div></section>`);
 $('testWorld2').onclick=()=>requestWorld(2);$('unlockMenu').onclick=()=>LocalLeague.menu();
}
function drawFinale(g){
 if(!finale)return;
 const t=ambient-finale.start,pt=ambient-finale.phaseStart;
 const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#29334f');sky.addColorStop(.45,'#936f84');sky.addColorStop(.78,'#e0b68e');sky.addColorStop(1,'#61717b');g.fillStyle=sky;g.fillRect(0,0,W,H);
 for(let i=0;i<30;i++){g.globalAlpha=.15+(Math.sin(t+i)+1)*.1;ellipse(g,(i*97)%W,(i*53)%410,1.5,1.5,'#fff0ca')}g.globalAlpha=1;
 const halo=g.createRadialGradient(630,210,15,630,210,190);halo.addColorStop(0,'#fff4c888');halo.addColorStop(1,'#fff4c800');g.fillStyle=halo;g.fillRect(420,0,400,410);ellipse(g,630,210,46,46,'#ffe5ae');
 g.fillStyle='#4b5066';g.beginPath();g.moveTo(0,H);for(let x=0;x<=W;x+=30)g.lineTo(x,690+Math.sin(x*.011)*45);g.lineTo(W,H);g.closePath();g.fill();g.fillStyle='#303c4c';g.beginPath();g.moveTo(0,H);for(let x=0;x<=W;x+=30)g.lineTo(x,770+Math.cos(x*.009)*30);g.lineTo(W,H);g.closePath();g.fill();
 const meetingY=compactView()?460:580,rise=compactView()?90:150;
 let witchY=735,hunterX=400,hunterY=255,witchX=400;
 if(finale.phase==='arrival')witchY-=Math.min(1,t/3)*(735-meetingY);
 if(finale.phase==='choice')witchY=meetingY;
 if(finale.phase==='resolution'){
  const p=Math.min(1,pt/7);witchY=meetingY-p*rise;
  if(finale.choice==='dawn'){hunterX=485;hunterY=255+p*((meetingY-rise)-255);witchX=350}else{hunterX=400-p*330;hunterY=255+p*30}
 }
 sprite(g,'hunter',hunterX,hunterY,1.75,ambient);sprite(g,'witch',witchX,witchY,1.35,ambient);
 g.textAlign='center';g.fillStyle='#fff0d2';g.font='30px Georgia';g.fillText('Le dernier passage',400,105);g.font='13px Arial';g.fillStyle='#f4dfca';g.fillText('Aucune arme. Aucun dernier duel.',400,133);
 if(finale.phase==='arrival'&&t>=2.2&&!finale.ready){finale.ready=true;renderFinalePanel()}
 if(finale.phase==='resolution'&&pt>=8)completeFinale();
}
const baseDrawGame=drawGame;
drawGame=function(){if(finale)drawFinale(ctx);else{baseDrawGame();if(activeWorld===2&&['play','pause'].includes(state))drawHourObjective(ctx)}};

/* La sauvegarde intervient avant le résultat et avant toute cinématique. */
const baseReward=reward;
reward=function(e){
 if(e?.boss&&!e.dead&&!window.SandboxMode&&stage===4&&clears===4){
  if(activeWorld===1)unlockFirstWorld();else if(activeWorld===2)unlockSecondWorld();else if(activeWorld===3)completeThirdWorld();
 }
 const result=baseReward(e);
 if(e?.boss&&activeWorld===2&&!window.SandboxMode&&clears<5)say('HEURE RÉCUPÉRÉE · '+clears+'/5 · '+worlds[stage].hour,3);
 return result;
};

/* Écran de déblocage du monde 3, sur le modèle de showUnlockedWorld.
   Aucun score, aucun résultat de vol n'est fabriqué : seuls les drapeaux de
   progression sont écrits, exactement comme pour le code Monde2. */
function showUnlockedThirdWorld(){
 state='sixth-unlock';applyWorld(3);
 overlay(`<section class="sequel-unlocked"><div class="eyebrow">DEUXIÈME MONDE ACCOMPLI ✓</div><h2 class="local-title">La Sixième<br>Heure</h2><p>Le monde 3 et la carte <b>La Sixième Heure</b> sont débloqués. Le code de test n’a enregistré aucun score.</p><div class="campaign-unlock-card"><span>◷</span><div><b>Une heure sans chiffre se réveille.</b><small>5 univers · 5 gardiens sans barre de vie · 15 minutes à rendre</small></div></div><div class="local-rule">Ici la difficulté monte par la décision, pas par le nombre : mêmes budgets qu’au monde 2, une règle à lire par univers.</div><div class="local-actions"><button class="primary" id="testWorld3">Tester le monde 3 →</button><button class="secondary" id="unlockMenu3">Menu</button></div></section>`);
 $('testWorld3').onclick=()=>requestWorld(3);$('unlockMenu3').onclick=()=>LocalLeague.menu();
}
function redeemCreatorCode(value){
 const code=String(value||'').trim().toLowerCase();
 if(!window.MinuitCloud?.isTeamAdmin)return false;
 if(code==='monde2'){unlockFirstWorld();beginFinale(null,{preview:true});return true}
 if(code==='monde3'){unlockFirstWorld();unlockSecondWorld();showUnlockedThirdWorld();return true}
 return false;
}
window.addEventListener('keydown',event=>{if(finale&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();completeFinale()}},true);
window.addEventListener('pagehide',save);

const style=document.createElement('style');
style.textContent=`
.team-creator-test{margin:10px 0;padding:11px;border:1px solid #7699ad66;border-radius:9px;background:#192b3688}.team-creator-test>b{color:#b9e0e5;font-size:10px;letter-spacing:1px}.team-creator-test p{margin:5px 0 9px;color:#a9b9c8;font-size:10px;line-height:1.5}.team-creator-test label{display:block;margin:0 0 5px;color:#d1e0e4;font-size:10px}.team-creator-code-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px}.team-creator-code-row input{min-width:0;width:100%;padding:10px;border:1px solid #65879b;border-radius:7px;background:#151f2d;color:#eef7f5;font:12px Arial}.team-creator-code-row button{min-height:40px}
.sequel-theme body,body.sequel-theme{background:radial-gradient(ellipse at 20% 0,#213a4b,#111321 68%)}body.sequel-theme .home-hero{border-color:#b9c6a777;background:linear-gradient(135deg,#273d4b,#151729 72%)}body.sequel-theme .home-visual{background:radial-gradient(circle at 47% 38%,#c6b07944,transparent 48%),linear-gradient(165deg,#29424d,#151a30 72%,#1a1b28)}body.sequel-theme .home-moon{background:radial-gradient(circle at 35% 28%,#fffbe0,#f2d69b 55%,#a9b9b4 100%);box-shadow:0 0 35px #ffe5a855,0 0 95px #8db4b433}body.sequel-theme .home-hero .menu-copy h1 span:last-child{color:#dce4bd}body.sequel-theme .home-world-route{color:#d9dfb5}body.sequel-theme .home-menu .menu-primary .primary{border-color:#e5e5b055;background:linear-gradient(135deg,#e4d68d,#91b9ae);box-shadow:0 8px 24px #87b3aa30;color:#172b35}body.sequel-theme .home-menu .menu-primary .primary small{color:#29434b;opacity:.88}body.sequel-theme .home-account-access{border-color:#8da8a777;background:linear-gradient(110deg,#2b3e47,#202235)}
.sequel-menu-subtitle{margin:-7px 0 10px;color:#e7d6a5;font:italic 15px Georgia;letter-spacing:.4px}.campaign-switch{display:flex;flex-wrap:wrap;gap:5px;margin:-7px 0 12px}.campaign-switch button{min-height:30px;padding:5px 8px;border:1px solid #6e728855;border-radius:7px;background:#1d2132;color:#b9b7ca;font-size:8px}.campaign-switch button.active{border-color:#e0c88988;background:#39434a;color:#fff0c2}#campaignCharacter{margin-left:auto;color:#d6c8e3}
.campaign-grimoire-section{width:100%;margin:18px 0 4px}.campaign-grimoire-section>h3{margin:9px 0;color:#b7a1c6;font-size:9px;letter-spacing:2px;text-align:left}.campaign-grimoire-card{display:grid;grid-template-columns:minmax(210px,.8fr) minmax(0,1.2fr);min-height:235px;overflow:hidden;border:1px solid #d4b77988;border-radius:14px;background:linear-gradient(140deg,#303349,#1c1d30);text-align:left;box-shadow:0 12px 35px #0003}.campaign-grimoire-card.locked{filter:saturate(.45);opacity:.7}.campaign-card-art{position:relative;display:flex;align-items:flex-end;justify-content:center;min-height:220px;overflow:hidden;background:radial-gradient(circle at 65% 28%,#ffe2a066,transparent 32%),linear-gradient(165deg,#4d546e,#8a6877 58%,#243642)}.campaign-card-art img{position:relative;width:105px;height:150px;object-fit:contain;margin:0 -15px 13px;filter:drop-shadow(0 8px 7px #0007)}.campaign-card-art img:last-child{width:94px;height:137px}.campaign-card-clock{position:absolute;top:15px;right:20px;color:#ffe4a4;font-size:61px;line-height:1;text-shadow:0 0 24px #ffe3a666}.campaign-card-copy{display:flex;flex-direction:column;justify-content:center;padding:20px}.campaign-card-copy small{color:#c7b28e;font-size:8px;letter-spacing:1.4px}.campaign-card-copy h3{margin:7px 0;color:#f3d69b;font:26px Georgia}.campaign-card-copy p{color:#c7bdd1;font-size:11px;line-height:1.65}.campaign-card-copy>b{margin-top:auto;color:#b9dbcd;font-size:10px;line-height:1.5}
.sequel-finale-active .hud,.sequel-finale-active #combatHUD,.sequel-finale-active #adventureStatus,.sequel-finale-active .toast,.sequel-finale-active .bossbar,.sequel-finale-active .touchbar{display:none!important}#skipFinale{position:absolute;z-index:14;top:15px;right:15px;min-height:39px;padding:9px 12px;border:1px solid #e3cda477;border-radius:8px;background:#24263cdd;color:#f4e4c8;font:11px Arial}.finale-panel{position:absolute;z-index:13;left:50%;bottom:22px;transform:translateX(-50%);width:min(610px,calc(100% - 34px));padding:15px 17px;border:1px solid #e4cda066;border-radius:13px;background:linear-gradient(145deg,#202338ee,#171a2df2);box-shadow:0 12px 35px #0005;text-align:center;backdrop-filter:blur(6px)}.finale-panel>small{color:#e4c691;font-size:9px;letter-spacing:2px}.finale-panel p{max-width:560px;margin:7px auto 12px;color:#e2d7e4;font-size:13px;line-height:1.55}.finale-panel p b{color:#ffe3ad}.finale-panel button{min-height:42px;margin:3px;padding:10px 15px}.finale-choices{display:flex;justify-content:center;flex-wrap:wrap;gap:7px}.finale-wait{color:#b9adc4;font-size:10px}.sequel-briefing,.sequel-unlocked{width:min(760px,100%);margin:auto}.sequel-briefing>p,.sequel-unlocked>p{max-width:650px}.sequel-briefing blockquote{max-width:620px;margin:12px auto;padding:12px 15px;border-left:2px solid #d9be8b;background:#ffffff08;color:#e6d3b7;font:italic 15px/1.6 Georgia}.sequel-character-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:15px 0}.sequel-character{display:flex;min-height:220px;flex-direction:column;align-items:center;padding:13px;border:1px solid #8fa9a566;border-radius:12px;background:linear-gradient(145deg,#293a48,#1c1c30);color:#ecdfcb}.sequel-character:hover,.sequel-character:focus-visible{border-color:#e2cd91;transform:translateY(-2px)}.sequel-character-art{display:grid;place-items:center;width:100%;height:120px}.sequel-character-art img{width:115px;height:120px;object-fit:contain}.sequel-character b{color:#f0d7a4;font-size:15px}.sequel-character small{margin-top:7px;color:#bfc4d0;font-size:10px;line-height:1.5;letter-spacing:0}.campaign-unlock-card{display:flex;align-items:center;gap:15px;width:min(480px,100%);margin:15px auto;padding:15px;border:1px solid #b6c5a777;border-radius:12px;background:#263943aa;text-align:left}.campaign-unlock-card>span{color:#ffe0a0;font-size:52px}.campaign-unlock-card b,.campaign-unlock-card small{display:block}.campaign-unlock-card b{color:#f0d9a9}.campaign-unlock-card small{margin-top:5px;color:#b9c9ce;font-size:10px;line-height:1.5}
@media(max-width:650px){.sequel-menu-subtitle{font-size:12px;margin:-3px 0 7px}.campaign-switch{justify-content:center;margin-bottom:8px}.campaign-switch button{min-height:28px;font-size:7px}#campaignCharacter{margin-left:0}.campaign-grimoire-card{grid-template-columns:1fr;min-height:0}.campaign-card-art{min-height:150px;height:150px}.campaign-card-art img{width:79px;height:112px;margin-bottom:6px}.campaign-card-art img:last-child{width:72px;height:105px}.campaign-card-clock{font-size:43px}.campaign-card-copy{padding:14px}.campaign-card-copy h3{font-size:22px}.campaign-card-copy p{font-size:10px}.finale-panel{bottom:12px;padding:12px 10px}.finale-panel p{font-size:12px}.finale-panel button{width:100%;margin:3px 0;font-size:11px}.finale-choices{display:block}#skipFinale{top:9px;right:9px;font-size:10px}.sequel-character-grid{gap:7px}.sequel-character{min-height:190px;padding:9px}.sequel-character-art{height:94px}.sequel-character-art img{height:94px;width:90px}.sequel-character small{font-size:9px}.sequel-briefing blockquote{font-size:12px}.team-creator-code-row{grid-template-columns:minmax(0,1fr) auto}}
@media(prefers-reduced-motion:reduce){.sequel-character{transition:none}}
`;
document.head.appendChild(style);
window.Campaign={validateSave,beginFinale,completeFinale,grimoireCard,redeemCreatorCode,showUnlockedThirdWorld,startWorld:requestWorld,beginWorld:startWorld,briefing,unlockFirstWorld,unlockSecondWorld,completeThirdWorld,keepMinutes,useClassicWorld:()=>applyWorld(1),get progress(){return progress},get activeWorld(){return activeWorld},get menuWorld(){return menuWorld},get finale(){return finale},get hourObjective(){return hourObjective},get worlds(){return activeWorld===3?thirdWorlds:secondWorlds},get secondWorlds(){return secondWorlds},get thirdWorlds(){return thirdWorlds},get key(){return KEY}};
applyWorld(progress.world2Unlocked?progress.lastWorld:1);
if(progress.world2Unlocked&&state==='league-menu')Journey.menu();
})();
