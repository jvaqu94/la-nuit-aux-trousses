/* Faune, objectifs et gardiens exclusifs aux Cinq Heures Perdues. */
(()=>{
'use strict';
const active=()=>window.Campaign?.activeWorld===2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const bossKinds=new Set((window.Campaign?.worlds||[]).map(w=>w.kind));
const foeNames={
 lampWisp:'Lueur de réverbère',shadePostman:'Facteur d’ombre',
 glassMite:'Mite de verre',glassShard:'Éclat de mite',sunMirror:'Miroir de midi',
 rootClock:'Racine du cadran',timeLarva:'Larve des heures',
 railImp:'Lutin contrôleur',sunLuggage:'Valise solaire',
 needleWraith:'Spectre-aiguille',hourHollow:'Chiffre creux',
 mirrorClone:'Miroir de la Reine',riftAnchor:'Ancre de faille',captiveSoul:'Heure captive'
};
const customKinds=new Set(Object.keys(foeNames).filter(k=>k!=='captiveSoul'));

/* Silhouettes locales : aucun sprite du premier bestiaire n’est réutilisé. */
function foeAsset(id,body){
 const image=new Image();
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-48 -48 96 96" fill="none" stroke-linecap="round" stroke-linejoin="round"><defs><radialGradient id="glow"><stop stop-color="#fffbd8"/><stop offset=".45" stop-color="#f5cf8b"/><stop offset="1" stop-color="#b66d72"/></radialGradient><linearGradient id="metal" x2="1" y2="1"><stop stop-color="#eef4df"/><stop offset=".5" stop-color="#9ea9b4"/><stop offset="1" stop-color="#44485e"/></linearGradient></defs>${body}</svg>`);
 window.MinuitArt[id]=image;
}
foeAsset('lampWisp',`<path d="M0-38 9-22 7-9 20 2 12 31 0 41-12 31-20 2-7-9-9-22Z" fill="#28394d" stroke="#f4d99a" stroke-width="2"/><path d="M-13-15 0-26 13-15M-17 5 0 15 17 5M0 15 0 34" stroke="#d5c38f" stroke-width="2"/><ellipse cy="-3" rx="9" ry="13" fill="url(#glow)"/><path d="M-5-5 0-11 5-5 0 5Z" fill="#fffce1"/>`);
foeAsset('shadePostman',`<path d="M-27 35-20-11 0-30 21-10 29 35 8 26 0 39-9 26Z" fill="#25283d" stroke="#9ca8c0" stroke-width="2"/><path d="M-17-14 0-29 18-14L12 2 0 10-13 1Z" fill="#121b2c" stroke="#d8cba6" stroke-width="2"/><path d="M-8-8-2-6M5-6 10-9" stroke="#ffe6a6" stroke-width="3"/><path d="M-29 7-42 24-20 20M29 7 42 24 20 20" fill="#3c4057" stroke="#b7a98e" stroke-width="2"/><rect x="-15" y="12" width="30" height="19" rx="2" fill="#d7c69f" stroke="#50465a" stroke-width="2"/><path d="M-14 13 0 23 14 13" stroke="#67576a" stroke-width="2"/>`);
foeAsset('glassMite',`<path d="M0-34 15-12 11 16 0 37-12 15-15-12Z" fill="#9ed5dc" fill-opacity=".55" stroke="#e8ffff" stroke-width="2"/><path d="M0-29 0 30M-12-10 10 13M12-10-10 13" stroke="#f7e4c7" stroke-width="1.5"/><path d="M-13-8-36-25-28 4-12 12M13-8 36-25 28 4 12 12M-10 14-29 34-5 27M10 14 29 34 5 27" fill="#86b8ca" fill-opacity=".45" stroke="#d9f4ee" stroke-width="2"/><circle cy="-17" r="4" fill="#fff6d5"/>`);
foeAsset('glassShard',`<path d="M0-40 13-5 5 38-9 13Z" fill="#a8e0e5" fill-opacity=".65" stroke="#f2ffff" stroke-width="2"/><path d="M0-31 2 23M-5 9 8-4" stroke="#fff0cf" stroke-width="2"/>`);
foeAsset('sunMirror',`<ellipse cy="-2" rx="25" ry="34" fill="#49667d" fill-opacity=".65" stroke="url(#metal)" stroke-width="5"/><ellipse cy="-2" rx="18" ry="27" fill="#c5e5df" fill-opacity=".35" stroke="#fff2c9" stroke-width="1.5"/><path d="M-11-20 12 16M-16-5 3 22" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><path d="M-31 27-15 38 0 31 16 39 31 26M0 32 0 45" stroke="#d5b886" stroke-width="3"/><circle cx="29" cy="-29" r="6" fill="url(#glow)"/>`);
foeAsset('rootClock',`<path d="M-23 28-19-15 0-30 20-14 24 28 11 21 4 43-4 27-14 42-13 21Z" fill="#27473f" stroke="#9ac49f" stroke-width="2"/><circle cy="-5" r="19" fill="#152e31" stroke="#d9c28c" stroke-width="3"/><path d="M0-5 0-18M0-5 12 2M-31 19-43 35M29 17 43 34M-18 28-27 44M17 28 25 45" stroke="#c6a979" stroke-width="3"/><circle cy="-5" r="3" fill="#ffe5a4"/>`);
foeAsset('timeLarva',`<path d="M-31 21Q-42-5-21-20T8-27Q36-28 35-4T17 26Q-4 42-31 21Z" fill="#45675f" stroke="#c5d8a8" stroke-width="2"/><path d="M-23-16-11 24M-7-25 3 31M11-25 19 22" stroke="#1d3a3b" stroke-width="3"/><circle cx="22" cy="-8" r="10" fill="#172c36" stroke="#edcf8e" stroke-width="2"/><path d="M22-8 22-14M22-8 27-5" stroke="#ffe8ac" stroke-width="2"/><path d="M-29 22-39 35M-12 31-17 43M8 28 13 40" stroke="#a5c29b" stroke-width="3"/>`);
foeAsset('railImp',`<path d="M-20 34-17-12 0-28 18-11 22 34 0 25Z" fill="#49384f" stroke="#d6aa7c" stroke-width="2"/><path d="M-18-20-8-36 15-34 26-19 10-15-13-15Z" fill="#242b40" stroke="#f0c486" stroke-width="2"/><path d="M-9-7-2-5M5-5 11-8" stroke="#ffe4a4" stroke-width="3"/><path d="M-18 3-38 14M18 2 38-12" stroke="#b48d72" stroke-width="5"/><rect x="24" y="-10" width="22" height="15" rx="2" fill="#e5d3a8" stroke="#4d4050" stroke-width="2"/><path d="M28-5 42-5M28 0 37 0" stroke="#725a60" stroke-width="2"/>`);
foeAsset('sunLuggage',`<rect x="-32" y="-24" width="64" height="55" rx="9" fill="#70505a" stroke="#e0b780" stroke-width="3"/><path d="M-13-24-12-38 12-38 13-24M-32-5 32-5M-18-5-18 31M18-5 18 31" stroke="#d7b381" stroke-width="3"/><rect x="-8" y="-12" width="16" height="15" rx="3" fill="#242c3d" stroke="#ffe0a0" stroke-width="2"/><path d="M-25 32-30 42M25 32 30 42" stroke="#8e6a66" stroke-width="5"/><circle cy="-5" r="4" fill="url(#glow)"/>`);
foeAsset('needleWraith',`<path d="M0-44 11-17 8 3 25 29 0 20-25 29-8 3-11-17Z" fill="#30374f" stroke="#d9c28f" stroke-width="2"/><path d="M0-36 0 35" stroke="#f2e2b4" stroke-width="3"/><path d="M-4-27 0-38 4-27M-13 8 0 15 13 8" stroke="#9da9c1" stroke-width="2"/><circle cy="-8" r="7" fill="#151d31" stroke="#ffe2a0" stroke-width="2"/><path d="M0-8 0-12M0-8 4-6" stroke="#fff0bc" stroke-width="1.5"/>`);
foeAsset('hourHollow',`<path d="M-25-31 0-41 26-30 32 2 17 35 0 43-18 34-32 2Z" fill="#30394e" stroke="#c5ad82" stroke-width="3"/><path d="M0-25 12-9 7 19-8 24-14 3Z" fill="#121c30" stroke="#8e9aad" stroke-width="2"/><path d="M-29-9-43-20M28-10 43-22M-20 30-33 42M20 30 33 42" stroke="#d5bd8c" stroke-width="4"/><path d="M-5-3 5-3M0-10 0 12" stroke="#ffe6a8" stroke-width="3"/>`);
foeAsset('mirrorClone',`<path d="M0-42 29-20 25 20 0 42-25 20-29-20Z" fill="#86b9c7" fill-opacity=".4" stroke="#efffff" stroke-width="3"/><path d="M0-34 0 34M-21-17 20 18M21-17-20 18" stroke="#ffe5c1" stroke-width="2"/><ellipse cy="-3" rx="9" ry="14" fill="#e6f7ef" fill-opacity=".5"/>`);
foeAsset('riftAnchor',`<circle cy="-7" r="27" fill="#232c41" stroke="#d2b685" stroke-width="4"/><circle cy="-7" r="17" stroke="#8798ae" stroke-width="2" stroke-dasharray="4 5"/><path d="M0-7 0-23M0-7 13 0M-31 19-41 40M31 19 41 40M0 20 0 45" stroke="#e1c28a" stroke-width="4"/><path d="M-12 36 0 45 12 36" stroke="#e1c28a" stroke-width="4"/>`);
foeAsset('captiveSoul',`<circle cy="-5" r="26" fill="#bce7df" fill-opacity=".12" stroke="#ffe6a7" stroke-width="2" stroke-dasharray="4 5"/><path d="M0-28 12-8 8 17 0 32-9 16-12-8Z" fill="#e6f5dc" fill-opacity=".65" stroke="#fff4c9" stroke-width="2"/><path d="M-5-7 0-13 5-7 0 4Z" fill="#fffce5"/><path d="M-28 22-38 34M28 22 38 34" stroke="#c6a976" stroke-width="3"/>`);

let effects=[],captives=[],playerTrail=[],mission={},reinforcementTimer=3,trailTimer=0,timeFreeze=0,spawnSerial=0;
function reset(){effects=[];captives=[];playerTrail=[];mission={};reinforcementTimer=3;trailTimer=0;timeFreeze=0;spawnSerial=0}
const journeyBegin=Journey.begin,journeyRestore=Journey.restore;
Journey.begin=function(...args){const result=journeyBegin(...args);reset();return result};
Journey.restore=function(...args){const result=journeyRestore(...args);reset();return result};

function spawnFoe(kind,x,y,index=0){
 spawnEnemy({kind,x,y,group:80+(spawnSerial++%20),index,pattern:99});
 return enemies[enemies.length-1];
}
const baseSpawnEnemy=spawnEnemy;
spawnEnemy=function(d){
 baseSpawnEnemy(d);const e=enemies[enemies.length-1];
 if(!active()||!e||!customKinds.has(d.kind))return;
 e.pattern=99;e.baseX=d.x;e.x=d.x;if(Number.isFinite(d.y))e.y=d.y;
 e.seqSeed=(Number(e.id)||.37)*Math.PI*2;e.seqDir=(d.index||0)%2?1:-1;e.seqHomeY=Number.isFinite(d.y)?d.y:245+((d.group||0)%3)*82;e.seqHomeX=d.x;e.fire=1.5+(Number(e.id)||.2)%1.1;e.seqHold=0;
 if(d.kind==='glassShard'){e.hp=e.max=1;e.r=14;e.speed=125+stage*12;e.elite=false;e.tier=0;e.fire=999}
 if(d.kind==='sunLuggage'){e.hp=e.max=Math.ceil(e.hp*2.2);e.r=27;e.speed*=.62}
 if(d.kind==='rootClock'){e.hp=e.max=Math.ceil(e.hp*1.6);e.r=25;e.speed*=.72}
 if(d.kind==='riftAnchor'){e.hp=e.max=12+stage*4;e.r=30;e.speed=0;e.elite=false;e.tier=0;e.fire=3.8}
 if(d.kind==='mirrorClone'){e.hp=e.max=10;e.r=29;e.speed=0;e.elite=false;e.tier=0;e.fire=999}
};
const baseSchedule=makeSchedule;
makeSchedule=function(){
 let list=baseSchedule();if(!active())return list;
 const caps=[5,4,4,4,3],cap=caps[Math.max(0,Math.min(4,wave-1))];
 list=list.filter(d=>(d.group||0)<cap&&(d.index||0)<3+(stage>=3?1:0));
 for(const d of list){
  const forms=world.foes;d.kind=forms[((d.group||0)+((d.index||0)%2))%forms.length];d.pattern=99;
  if(stage===0)d.x=clamp(125+(d.index%4)*175+(d.group%2)*35,70,730);
  if(stage===1)d.x=clamp(400+(d.index-1.5)*82+(d.group%2?65:-65),65,735);
  if(stage===2)d.x=d.index%2?610:190;
  if(stage===3)d.x=d.index%2?715:85;
  if(stage===4)d.x=clamp(400+Math.cos((d.index||0)*Math.PI/2)*245,80,720);
 }
 return list.sort((a,b)=>a.time-b.time);
};

function setupMission(force=false){
 if(!active())return;const key=stage+':'+wave;if(!force&&mission.key===key)return;
 mission={key,rescued:0,needed:wave===2?2:0};captives=[];reinforcementTimer=3.5;
 if(wave===2)captives=[{x:205,y:390,age:0,rescued:false},{x:595,y:510,age:0,rescued:false}];
 if(wave===4&&!enemies.some(e=>e.kind==='riftAnchor'&&!e.dead)){spawnFoe('riftAnchor',205,300,0);spawnFoe('riftAnchor',595,355,1)}
 if(wave===1)say(['LUEURS · téléportation annoncée','MITES · elles se divisent sous les tirs','RACINES · brise-les avant la route figée','CONVOIS · lis la voie','CHIFFRES · attaques en différé'][stage],3.2);
}
const baseNewWave=newWave;
newWave=function(...args){const result=baseNewWave(...args);if(active()){effects=[];timeFreeze=0;setupMission(true)}return result};

function reinforce(){
 if(enemies.filter(e=>!e.dead&&!e.boss).length>=6)return;
 const forms=world.foes,side=(spawnSerial%2)?650:150;
 spawnFoe(forms[spawnSerial%forms.length],side,undefined,spawnSerial%3);
 spawnFoe(forms[(spawnSerial+1)%forms.length],800-side,undefined,(spawnSerial+1)%3);
}
function waveBlocks(){
 if(!active()||window.SandboxMode||state!=='play'||wave===5)return false;setupMission();
 if(wave===2)return mission.rescued<2;
 if(wave===3)return waveTime<22;
 return false;
}
function missionText(){
 const boss=enemies.find(e=>e.boss&&!e.dead);
 if(boss)return({lanternier:'Halo sûr',glassqueen:'Miroirs',clockstag:'Échos',conductor:'Voies',clockmaker:'Aiguilles'})[boss.kind]||'Gardien';
 if(wave===2)return 'Libération '+mission.rescued+'/2';
 if(wave===3)return 'Survie '+Math.max(0,Math.ceil(22-waveTime))+' s';
 if(wave===4)return 'Ancres '+Math.max(0,2-enemies.filter(e=>e.kind==='riftAnchor'&&!e.dead).length)+'/2';
 return 'Chasse';
}
const baseHUD=updateHUD;
updateHUD=function(...args){
 baseHUD(...args);if(!active()||state!=='play')return;setupMission();
 $('modeLabel').textContent=missionText()+' · ✦'+(window.Campaign?.hourObjective.got||0)+'/3';
 if(player.slow>0)$('graze').textContent='RACINES · −'+Math.round((1-WEB_SPEED_FACTOR)*100)+' %';
};
const baseSpawnBoss=spawnBoss;
spawnBoss=function(...args){const result=baseSpawnBoss(...args);if(active()){toastTime=0;$('toast').textContent=''}return result};

function fire(e,type,angles,speed,angle=Math.PI/2,move='straight',extra={}){
 const before=hostile.length;shootHostile(e,type,angles,speed,angle);
 for(let i=before;i<hostile.length;i++)Object.assign(hostile[i],{seqMove:move},extra);
}
function aimed(e,target=player){return Math.atan2(target.y-e.y,target.x-e.x)}
function windup(e,dt,interval){
 // Hors terrain, le chrono reste armé : l'entrée ne déclenche jamais un tir instantané.
 if(e.y<=45||e.y>=700){e.fire=Math.max(e.fire,.7);return false}
 e.fire-=dt;if(e.fire<=0){e.fire=interval;return true}return false;
}
function descend(e,dt,target){if(e.y<target)e.y=Math.min(target,e.y+(e.speed||65)*dt)}
function addEffect(data){
 if(effects.length>=18)return null;const effect={age:0,warn:1.5,life:.5,tick:0,...data};effects.push(effect);return effect;
}
function pastPlayer(seconds=1){
 if(!playerTrail.length)return{x:player.x,y:player.y};const target=gameTime-seconds;let best=playerTrail[0];
 for(const p of playerTrail){best=p;if(p.time>=target)break}return{x:best.x,y:best.y};
}
function moveEnemy(e,dt){
 if(!active()||!customKinds.has(e.kind)||e.boss)return false;
 if(timeFreeze>0&&!['mirrorClone','riftAnchor'].includes(e.kind))return true;
 const seed=e.seqSeed||0,aim=aimed(e);
 if(e.kind==='lampWisp'){
  const target=e.seqHomeY;descend(e,dt,target);e.x=clamp(e.baseX+Math.sin(e.age*.9+seed)*105,45,755);
  if(windup(e,dt,3.6)){e.baseX=clamp(W-e.x,90,710);e.x=e.baseX;particle(e.x,e.y,'#ffe6a4',12);fire(e,'spirit',[0],125,aim,'spiral',{seqCenterX:e.x,seqCenterY:e.y,seqRadius:5,seqAngle:aim,seqSpin:2.7})}
 }else if(e.kind==='shadePostman'){
  descend(e,dt,350+(e.id%1)*100);e.x+=e.seqDir*145*dt;if(e.x<65||e.x>735){e.x=clamp(e.x,65,735);e.seqDir*=-1}
  if(windup(e,dt,4.2))addEffect({type:'echo',x:player.x,y:player.y,warn:1.25,life:.45,shots:1});
 }else if(e.kind==='glassMite'){
  e.y+=e.speed*.82*dt;e.x=clamp(e.baseX+Math.sin(e.age*2.2+seed)*72,35,765);
  if(windup(e,dt,3.5))fire(e,'spirit',[0],145,aim,'bounce',{seqBounces:1});
 }else if(e.kind==='glassShard'){
  e.y+=e.speed*1.3*dt;e.x+=e.seqDir*105*dt;
 }else if(e.kind==='sunMirror'){
  descend(e,dt,e.seqHomeY);e.x=clamp(e.baseX+Math.sin(e.age*.75+seed)*135,55,745);
  if(windup(e,dt,4))fire(e,'bone',[-.16,.16],150,aim,'bounce',{seqBounces:2});
 }else if(e.kind==='rootClock'){
  descend(e,dt,300+(e.id%1)*80);e.x=clamp(e.baseX+Math.sin(e.age*.55)*24,55,745);
  if(windup(e,dt,4.8))addEffect({type:'root',x:clamp(player.x,90,710),y:clamp(player.y-35,330,790),r:82,warn:1.35,life:3.8});
 }else if(e.kind==='timeLarva'){
  const target=e.seqHomeY;if(e.y<target-60)e.y+=e.speed*dt;else e.y=target+Math.sin(e.age*.85+seed)*55;e.x=clamp(e.baseX+Math.sin(e.age*.65+seed)*90,45,755);
  if(windup(e,dt,3.9)){const past=pastPlayer(1.15);fire(e,'bone',[0],155,aimed(e,past),'straight')}
 }else if(e.kind==='railImp'){
  descend(e,dt,e.seqHomeY);e.x+=e.seqDir*190*dt;if(e.x<55||e.x>745){e.x=clamp(e.x,55,745);e.seqDir*=-1}
  if(windup(e,dt,5.4))addEffect({type:'train',x:e.seqDir>0?-140:940,y:clamp(e.y+140,370,740),dir:e.seqDir,warn:1.7,life:2.4,small:true});
 }else if(e.kind==='sunLuggage'){
  descend(e,dt,325);e.x=clamp(e.baseX+Math.sin(e.age*.5+seed)*65,60,740);
  if(windup(e,dt,4.4))fire(e,'fire',[-.28,.28],135,aim,'bounce',{seqBounces:1});
 }else if(e.kind==='needleWraith'){
  const target=e.seqHomeY;e.seqHomeY=Math.min(360,e.seqHomeY+12*dt);e.x=clamp(e.baseX+Math.cos(e.age*1.35+seed)*100,50,750);e.y=e.y<target-70?e.y+e.speed*dt:target+Math.sin(e.age*1.35+seed)*45;
  if(windup(e,dt,4.7))addEffect({type:'hand',x:e.x,y:e.y,angle:aim,length:420,warn:1.3,life:.32,small:true});
 }else if(e.kind==='hourHollow'){
  descend(e,dt,e.seqHomeY);e.x=clamp(e.baseX+Math.sin(e.age*.8+seed)*150,55,745);
  if(windup(e,dt,4.1)){e.baseX=clamp(W-e.x,90,710);e.x=e.baseX;addEffect({type:'echo',x:player.x,y:player.y,warn:1.35,life:.45,shots:4})}
 }else if(e.kind==='mirrorClone'){
  e.y=e.seqHomeY+Math.sin(e.age*.8+seed)*12;
 }else if(e.kind==='riftAnchor'){
  if(windup(e,dt,5.6)){reinforce();fire(e,'hex',[0],125,aim,'straight')}
 }
 e.x=clamp(e.x,25,775);return true;
}

function moveProjectile(b,dt){
 if(!active())return false;
 if(timeFreeze>0){b.seqFrozen=true;return true}b.seqFrozen=false;b.age=(b.age||0)+dt;b.life-=dt;
 if(b.seqMove==='spiral'){
  b.seqRadius+=58*dt;b.seqAngle+=b.seqSpin*dt;b.x=b.seqCenterX+Math.cos(b.seqAngle)*b.seqRadius;b.y=b.seqCenterY+Math.sin(b.seqAngle)*b.seqRadius;b.vx=-Math.sin(b.seqAngle)*150;b.vy=Math.cos(b.seqAngle)*150;
 }else{
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  if(b.seqMove==='bounce'&&(b.x<18||b.x>782)&&b.seqBounces>0){b.x=clamp(b.x,18,782);b.vx*=-1;b.seqBounces--;particle(b.x,b.y,'#dff9f2',5)}
 }
 return true;
}

function ensureMirrors(e){
 if(e.seqMirrorsSpawned)return;e.seqMirrorsSpawned=true;
 spawnFoe('mirrorClone',125,285,0);spawnFoe('mirrorClone',675,285,1);
}
function bossPattern(e){
 const phase=e.phase;e.cycle++;
 if(e.kind==='lanternier'){
  if(e.cycle%3===1){const side=e.cycle%2?-1:1,x=clamp(player.x+side*155,145,655),y=clamp(player.y-35,390,745);addEffect({type:'safeLight',x,y,r:155-phase*9,warn:2.25,life:.65});say('NOIR TOTAL · rejoignez le cercle de lumière',2.2)}
  else for(let i=0;i<phase+1;i++){const angle=Math.PI*.25+i*Math.PI*.5;fire(e,'spirit',[0],120,angle,'spiral',{seqCenterX:e.x,seqCenterY:e.y,seqRadius:8,seqAngle:angle,seqSpin:(i%2?-1:1)*2.4})}
  if(phase>=2&&e.cycle%4===0&&enemies.filter(n=>n.kind==='lampWisp'&&!n.dead).length<2)spawnFoe('lampWisp',e.x<400?650:150,undefined,e.cycle);
 }else if(e.kind==='glassqueen'){
  ensureMirrors(e);const mirrors=enemies.filter(n=>n.kind==='mirrorClone'&&!n.dead),origins=mirrors.length?mirrors:[e],target={x:W-player.x,y:player.y};
  if(e.cycle%2){for(const m of origins.slice(0,2))addEffect({type:'beam',x:m.x,y:m.y,x2:target.x,y2:target.y,warn:1.55,life:.42,label:'REFLET'})}
  else for(const m of origins.slice(0,2))fire(m,'spirit',[-.1,.1],145,aimed(m,target),'bounce',{seqBounces:2});
  e.seqHold=1.1;e.x=origins.length?origins[e.cycle%origins.length].x:W-e.x;particle(e.x,e.y,'#dffcff',18);
 }else if(e.kind==='clockstag'){
  const count=1+phase;for(let i=0;i<count;i++){const past=pastPlayer(1+i*.55);addEffect({type:'echo',x:past.x,y:past.y,warn:1.45+i*.12,life:.45,shots:4+(phase===3?2:0)})}
  if(phase>=2){const past=pastPlayer(1.8);addEffect({type:'root',x:clamp(past.x,90,710),y:clamp(past.y,330,790),r:88,warn:1.5,life:3.2,damage:true})}
  if(e.seqHistory?.length){const old=e.seqHistory[0];e.x=old.x;e.y=old.y;e.seqHold=.8;particle(e.x,e.y,'#b8efd4',20)}
  say('ÉCHOS · quittez vos anciennes positions',2);
 }else if(e.kind==='conductor'){
  const lanes=[380,545,710],safe=(e.cycle+1)%3;
  lanes.forEach((y,i)=>{if(i===safe)return;if(phase===1&&i!==e.cycle%3)return;addEffect({type:'train',x:(i+e.cycle)%2?-140:940,y,dir:(i+e.cycle)%2?1:-1,warn:1.9,life:2.5})});
  if(e.cycle%3===0)addEffect({type:'beam',x:player.x,y:240,x2:player.x,y2:900,warn:1.45,life:.35,label:'CONTRÔLE'});
  say('CONVOI CÉLESTE · une voie reste libre',1.8);
 }else if(e.kind==='clockmaker'){
  if(e.cycle%3===1){addEffect({type:'freeze',x:400,y:230,warn:1.55,life:2.15});say('TEMPS SUSPENDU · les projectiles reprendront',2.2)}
  const angle=Math.atan2(player.y-230,player.x-400);addEffect({type:'hand',x:400,y:230,angle,length:950,warn:1.75,life:.42});
  if(phase===3)addEffect({type:'hand',x:400,y:230,angle:angle+Math.PI/2,length:950,warn:1.9,life:.42});
  if(e.cycle%4===0&&enemies.filter(n=>n.kind==='hourHollow'&&!n.dead).length<2)spawnFoe('hourHollow',e.cycle%2?170:630,undefined,e.cycle);
 }
}
function moveBoss(e,dt){
 if(!active()||!bossKinds.has(e.kind))return false;
 e.phaseShield=Math.max(0,(e.phaseShield||0)-dt);e.phaseFlash=Math.max(0,(e.phaseFlash||0)-dt);e.blockHit=Math.max(0,(e.blockHit||0)-dt);e.damageBudget=Math.min(e.budgetRate*.65,(e.damageBudget||0)+e.budgetRate*dt);
 const phase=1+(e.hp/e.max<=.660001?1:0)+(e.hp/e.max<=.330001?1:0);
 if(phase!==e.phase){e.phase=phase;e.phaseShield=1.2;e.phaseFlash=1.45;e.fire=1.8;e.damageBudget=0;say(world.boss+' · Phase '+phase,2);particle(e.x,e.y,world.moon,46);tone(90+phase*45,.32,'sawtooth',.09,.35)}
 if(e.y<175){e.y=Math.min(190,e.y+95*dt);return true}
 e.seqHold=Math.max(0,(e.seqHold||0)-dt);
 if(e.kind==='lanternier'){e.x=400+Math.sin(e.age*.36)*205;e.y=195+Math.sin(e.age*.55)*22}
 if(e.kind==='glassqueen'){ensureMirrors(e);if(e.seqHold<=0){e.x=400+Math.sin(e.age*.3)*175;e.y=190+Math.sin(e.age*.5)*18}}
 if(e.kind==='clockstag'){
  if(e.seqHold<=0){e.x=400+Math.sin(e.age*.55)*245;e.y=190+Math.abs(Math.sin(e.age*.8))*42}
  e.seqHistory=e.seqHistory||[];e.seqHistoryClock=(e.seqHistoryClock||0)-dt;if(e.seqHistoryClock<=0){e.seqHistoryClock=.25;e.seqHistory.push({x:e.x,y:e.y,time:gameTime});e.seqHistory=e.seqHistory.filter(p=>gameTime-p.time<3).slice(-12)}
 }
 if(e.kind==='conductor'){const target=[185,400,615][e.cycle%3];e.x+=(target-e.x)*Math.min(1,dt*2.8);e.y=180}
 if(e.kind==='clockmaker'){e.x=400;e.y=190}
 if(e.phaseShield>0)return true;e.fire-=dt;
 if(e.fire<=0){bossPattern(e);e.fire=Math.max(2.35,3.75-e.phase*.28-stage*.08)}
 return true;
}

const baseReward=reward;
reward=function(e){
 const wasDead=e.dead;baseReward(e);if(!active()||wasDead||!e.dead)return;
 if(e.kind==='glassMite')for(const side of [-1,1]){const child=spawnFoe('glassShard',clamp(e.x+side*22,30,770),e.y,side<0?0:1);child.seqDir=side}
 if(e.kind==='sunLuggage')for(const side of [-1,1]){const child=spawnFoe('railImp',clamp(e.x+side*35,45,755),e.y,side<0?0:1);child.seqDir=side;child.fire=2.5}
 if(e.kind==='glassqueen')for(const n of enemies)if(n.kind==='mirrorClone')n.dead=true;
 if(e.boss){effects=[];captives=[];timeFreeze=0}
};

function segmentDistance(px,py,a,b,c,d){const dx=c-a,dy=d-b,t=clamp(((px-a)*dx+(py-b)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(px-a-t*dx,py-b-t*dy)}
function tickEffects(dt){
 for(const f of effects){
  f.age+=dt;f.tick-=dt;const ready=f.age>=f.warn;
  if(f.type==='safeLight'&&ready&&!f.hit){f.hit=true;if(Math.hypot(player.x-f.x,player.y-f.y)>f.r)hurt(25,'le blackout du Lanternier',{kind:'zone',x:f.x,y:f.y,r:f.r})}
  if(f.type==='echo'&&ready&&!f.fired){f.fired=true;const count=f.shots||4;fire({x:f.x,y:f.y},'spirit',Array.from({length:count},(_,i)=>i*Math.PI*2/count),125,0,'straight');particle(f.x,f.y,'#c6f1e6',12)}
  if(f.type==='root'&&ready&&Math.hypot(player.x-f.x,player.y-f.y)<f.r){player.slow=Math.max(player.slow,.45);if(f.damage&&f.tick<=0){hurt(20,'les racines du Cerf des heures',{kind:'zone',x:f.x,y:f.y,r:f.r});f.tick=.8}}
  if(['beam','hand'].includes(f.type)&&ready&&f.tick<=0){const x2=f.type==='hand'?f.x+Math.cos(f.angle)*f.length:f.x2,y2=f.type==='hand'?f.y+Math.sin(f.angle)*f.length:f.y2;if(segmentDistance(player.x,player.y,f.x,f.y,x2,y2)<(f.small?11:16)){hurt(25,f.type==='hand'?'l’aiguille du cadran':'le rayon de la Reine de verre',{kind:'zone',x:player.x,y:player.y,r:12});f.tick=.55}}
  if(f.type==='train'&&ready){f.x+=f.dir*(f.small?500:620)*dt;if(f.tick<=0&&Math.abs(player.x-f.x)<(f.small?75:105)&&Math.abs(player.y-f.y)<31){hurt(30,'un convoi de l’Express céleste',{kind:'terrain',x:f.x,y:f.y,r:35});f.tick=.8}}
 }
 effects=effects.filter(f=>f.age<f.warn+f.life&&(f.type!=='train'||f.x>-260&&f.x<1060));
 timeFreeze=effects.some(f=>f.type==='freeze'&&f.age>=f.warn)?0.12:0;
}
function tick(dt){
 if(!active()||state!=='play')return;setupMission();
 trailTimer-=dt;if(trailTimer<=0){trailTimer=.18;playerTrail.push({x:player.x,y:player.y,time:gameTime});playerTrail=playerTrail.filter(p=>gameTime-p.time<4).slice(-24)}
 if(transition>0){effects=[];timeFreeze=0;return}
 tickEffects(dt);
 if(wave<5&&spawnIndex>=schedule.length){const needs=wave===2?mission.rescued<2:wave===3?waveTime<22:waveTime<15;if(needs&&enemies.filter(e=>!e.dead).length<3){reinforcementTimer-=dt;if(reinforcementTimer<=0){reinforcementTimer=4.2;reinforce()}}}
 if(wave===2)for(const c of captives){if(c.rescued)continue;c.age+=dt;c.x+=Math.sin(c.age*.9+c.y)*12*dt;if(Math.hypot(player.x-c.x,player.y-c.y)<58){c.rescued=true;mission.rescued++;score+=300;particle(c.x,c.y,'#fff0b0',25);tone(660,.25,'sine',.08,1.4);say('HEURE LIBÉRÉE · '+mission.rescued+'/2',2)}}
}

function drawEffect(g,f){
 const ready=f.age>=f.warn,p=clamp(f.age/f.warn,0,1),pulse=.55+.35*Math.sin(ambient*12);
 if(f.type==='safeLight'){
  g.save();g.fillStyle=ready?'#050817a8':'#05081766';g.beginPath();g.rect(0,0,W,H);g.arc(f.x,f.y,f.r,0,Math.PI*2,true);g.fill('evenodd');g.restore();ring(f.x,f.y,f.r,ready?'#fff0b5':'#ffe5a0',!ready);g.fillStyle='#fff0c5';g.font='bold '+(compactView()?19:14)+'px Arial';g.textAlign='center';g.fillText(ready?'HALO SÛR':'REJOIGNEZ LE HALO',f.x,f.y-f.r-14);
 }else if(f.type==='echo'){
  ring(f.x,f.y,28+(1-p)*38,ready?'#fff0bd':'#aee8dc',!ready);line(g,f.x-18,f.y,f.x+18,f.y,'#d9f4df',2);line(g,f.x,f.y-18,f.x,f.y+18,'#d9f4df',2);g.fillStyle='#e9f8df';g.font='bold '+(compactView()?16:12)+'px Arial';g.textAlign='center';g.fillText('ÉCHO',f.x,f.y-42);
 }else if(f.type==='root'){
  g.globalAlpha=ready?.65:pulse;ring(f.x,f.y,f.r,ready?'#9fc795':'#e0c58d',!ready);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;line(g,f.x+Math.cos(a)*15,f.y+Math.sin(a)*15,f.x+Math.cos(a)*f.r,f.y+Math.sin(a)*f.r,ready?'#8eb786':'#d5bd89',3)}g.globalAlpha=1;g.fillStyle='#e5d7aa';g.font='bold '+(compactView()?16:11)+'px Arial';g.textAlign='center';g.fillText('RACINES',f.x,f.y-f.r-10);
 }else if(f.type==='beam'||f.type==='hand'){
  const x2=f.type==='hand'?f.x+Math.cos(f.angle)*f.length:f.x2,y2=f.type==='hand'?f.y+Math.sin(f.angle)*f.length:f.y2;g.setLineDash(ready?[]:[12,10]);line(g,f.x,f.y,x2,y2,'#171729',ready?(f.small?12:22):10);line(g,f.x,f.y,x2,y2,ready?'#fff0cf':'#b9e5df',ready?(f.small?5:9):3);g.setLineDash([]);ring(f.x,f.y,18,ready?'#fff0c0':'#b9e5df',!ready);if(!ready){g.fillStyle='#e9f3d8';g.font='bold '+(compactView()?16:11)+'px Arial';g.textAlign='center';g.fillText(f.label||'AIGUILLE',clamp((f.x+x2)/2,90,710),clamp((f.y+y2)/2-18,180,820))}
 }else if(f.type==='train'){
  if(!ready){g.fillStyle='#e7c88a18';g.fillRect(0,f.y-37,W,74);for(const off of [-24,24])line(g,0,f.y+off,W,f.y+off,'#d6b67c99',3);g.fillStyle='#ffe0a3';g.font='bold '+(compactView()?18:13)+'px Arial';g.textAlign='center';g.fillText('CONVOI · CHANGEZ DE VOIE',400,f.y-46);g.font='26px Arial';g.fillText(f.dir>0?'→ → →':'← ← ←',400,f.y+9)}
  else{g.save();g.translate(f.x,f.y);const length=f.small?150:210;g.fillStyle='#282b41';g.strokeStyle='#edc487';g.lineWidth=3;g.fillRect(-length/2,-30,length,60);g.strokeRect(-length/2,-30,length,60);g.fillStyle='#f4d795';for(let x=-length/2+16;x<length/2-12;x+=34)g.fillRect(x,-17,20,19);g.fillStyle='#fff1c0';g.fillRect(f.dir>0?length/2-8:-length/2,-8,8,18);g.restore()}
 }else if(f.type==='freeze'){
  ring(f.x,f.y,55+p*25,ready?'#e9f8ff':'#c5dce8',!ready);for(let i=0;i<12;i++){const a=i*Math.PI/6;line(g,f.x+Math.cos(a)*45,f.y+Math.sin(a)*45,f.x+Math.cos(a)*55,f.y+Math.sin(a)*55,'#e5f2e8',2)}g.fillStyle='#e9f6ed';g.font='bold '+(compactView()?20:14)+'px Arial';g.textAlign='center';g.fillText(ready?'TEMPS SUSPENDU':'ARRÊT DU TEMPS',f.x,f.y-78);
 }
}
function draw(g){
 if(!active())return;g.save();
 for(const f of effects)drawEffect(g,f);
 for(const c of captives)if(!c.rescued){ring(c.x,c.y,46+Math.sin(ambient*4)*4,'#fff0b0',true);sprite(g,'captiveSoul',c.x,c.y,.85,ambient);g.fillStyle='#fff1c2';g.font='bold '+(compactView()?16:11)+'px Arial';g.textAlign='center';g.fillText('LIBÉRER',c.x,c.y-52)}
 for(const e of enemies){if(e.dead||!customKinds.has(e.kind))continue;if(e.fire>0&&e.fire<.7&&!['mirrorClone','glassShard'].includes(e.kind)){ring(e.x,e.y,e.r+12,'#ffe2a0',true);g.fillStyle='#fff0c2';g.font='bold 16px Arial';g.textAlign='center';g.fillText('!',e.x,e.y-e.r-17)}if(e.kind==='riftAnchor'||e.kind==='mirrorClone'){g.fillStyle=e.kind==='riftAnchor'?'#ffe0a0':'#d9f7f2';g.font='bold '+(compactView()?14:10)+'px Arial';g.textAlign='center';g.fillText(e.kind==='riftAnchor'?'ANCRE':'MIROIR',e.x,e.y-45)}}
 if(timeFreeze>0){g.fillStyle='#c9edf010';g.fillRect(0,0,W,H)}
 g.restore();
}

window.SequelBestiary={moveEnemy,moveBoss,moveProjectile,tick,draw,waveBlocks,attack:e=>{if(active()&&bossKinds.has(e.kind))bossPattern(e)},isCustomKind:k=>customKinds.has(k),names:foeNames,get effects(){return effects},get captives(){return captives},get mission(){return{...mission}},get timeFrozen(){return timeFreeze>0}};
})();
