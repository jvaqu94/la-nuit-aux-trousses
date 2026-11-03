/* Course aux bonbons : runner hebdomadaire déterministe, isolé de l’aventure. */
(()=>{'use strict';
const KEY='minuit-candy-sprint-v5',DURATION=90,SPEED=700,MAX_SPEED=1400,VIEW=2200,ROW_SPACING=1080;
// Les peintures frontales de l’aventure, intégrées aussi dans l’édition autonome.
const runnerScenery=['forest','cemetery','castle'].map(name=>{const image=new Image();image.src=window.MinuitRunnerSceneryData?.[name]||'scenery/'+name+'.jpg';return image});
const stoneTexture=new Image();stoneTexture.src=window.MinuitRunnerSceneryData?.stone||'scenery/runner-stone-texture.jpg';
const woodTexture=new Image();woodTexture.src=window.MinuitRunnerSceneryData?.wood||'scenery/runner-wood-texture.jpg';
let data={version:1,weeks:{}},active=false,config=null,result=null,course=null,friend=null,legacyChallenge=false,teamEpoch=0;
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||'null');
 if(saved?.version===1&&saved.weeks&&typeof saved.weeks==='object')data=saved;
 else { // Les étoiles et apparences survivent au changement de parcours, pas les records.
  for(const key of ['minuit-candy-sprint-v4','minuit-candy-sprint-v3']){
   try{const previous=JSON.parse(localStorage.getItem(key)||'null');if(previous?.version===1){data.stars=Math.max(0,Math.floor(Number(previous.stars)||0));data.cosmetic=previous.cosmetic;break}}catch{}
  }
 }
}catch{}
const fmt=n=>Math.floor(Number(n)||0).toLocaleString('fr-FR');
function weekInfo(){const date=new Date(dateKey()+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));const week=date.toISOString().slice(0,10);return{week,seed:hash('minuit-candy-race-v5:'+week),stage:hash('minuit-candy-world-v1:'+week)%Math.min(3,worlds.length),label:date.toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'})}}
function weekData(week){return data.weeks[week]||(data.weeks[week]={best:null,runs:[]})}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}
// Parcours hebdomadaire déterministe : les changements restent adjacents,
// mais leur rythme, les chapelets et les obstacles varient d'une section à l'autre.
function laneForPair(info,pair){
 let lane=0;
 for(let i=1;i<=pair;i++){
  const choice=hash(info.seed+':lane:'+i);
  if(choice%5!==0)lane=lane===0?(choice%2?1:-1):0;
 }
 return lane;
}
function obstacleForPair(info,pair){
 if(pair===0)return 'stump'; // Un premier obstacle familier pour apprendre.
 // Plus de brèches et de tireurs ; le mélange conserve des moments de respiration.
 const kinds=['stump','pumpkin','arch','branch','ghost','gap','gap','gap','shooter','shooter','shooter','shooter',null];
 const block=Math.floor((pair-1)/kinds.length),slot=(pair-1)%kinds.length;
 for(let i=kinds.length-1;i>0;i--){const j=hash(info.seed+':obstacles:'+block+':'+i)%(i+1);[kinds[i],kinds[j]]=[kinds[j],kinds[i]]}
 const chosen=kinds[slot];return corridorPair(pair)&&chosen==='shooter'?'gap':chosen;
}
function corridorPair(pair){return pair%6===3||pair%6===4}
function courseRow(info,index){
 const pair=Math.floor(index/2),candyLane=laneForPair(info,pair),previous=laneForPair(info,Math.floor(Math.max(0,index-1)/2));
 const corridor=corridorPair(pair),afterFree=index%2===0&&pair>0&&!corridorPair(pair-1)&&corridor;
 let kind=index%2?obstacleForPair(info,pair):null;
 if(index===95&&kind==='ghost')kind='arch';
 const afterGhost=index>0&&index%2===0&&obstacleForPair(info,pair-1)==='ghost'&&corridorPair(pair-1);
 let offsets=kind==='ghost'&&corridor?[]:kind&&corridor?[0,180,900]:[0,180,360,540,720,900];
 if(candyLane!==previous||afterGhost)offsets=offsets.filter(offset=>offset>=360);
 // Au retour vers un couloir, même la voie risquée opposée a le temps de rejoindre l'ouverture.
 if(afterFree)offsets=offsets.filter(offset=>offset>=720);
 const riskyLane=candyLane===0?(hash(info.seed+':risk:'+pair)%2?1:-1):0;
 let paths;
 if(corridor)paths=[{lane:candyLane,offsets}];
 else {
  // La voie la moins riche a moins de bonbons ; les tirs peuvent viser l'une ou l'autre.
  const safe=index%2?[0,720]:[0,360,720];
  const rich=kind?[0,180,900]:[0,180,360,540,720,900];
  paths=[{lane:candyLane,offsets:safe},{lane:riskyLane,offsets:rich}];
 }
 const bonus=kind==='stump'||kind==='pumpkin'||kind==='gap'?'jump':kind==='arch'||kind==='branch'?'duck':null;
 return {index,at:700+index*ROW_SPACING,candyLane,riskyLane,kind,corridor,offsets,paths,bonus};
}

function buildCourse(info){
 const objects=[],candyGates=[];
 for(let i=0;i<96;i++){
  const row=courseRow(info,i);
  for(const path of row.paths)for(const offset of path.offsets){
   const at=row.at+offset;objects.push({at,lane:path.lane,kind:'candy'});
   if(row.corridor){
    candyGates.push({at,lane:row.candyLane});
    for(const lane of [-1,0,1])if(lane!==row.candyLane)objects.push({at,lane,kind:'wall',style:hash(info.seed+':wall:'+Math.floor(i/6))%3});
   }
  }
  if(row.kind){
   const at=row.at+540;
   const lane=row.corridor?row.candyLane:row.kind==='shooter'&&hash(info.seed+':target:'+i)%2===0?row.candyLane:row.riskyLane;
   if(row.bonus){
    // Ramasser ce bonbon exige de franchir l'obstacle à la bonne hauteur.
    objects.push({at,lane,kind:'candy',require:row.bonus});
    if(row.corridor){candyGates.push({at,lane});for(const other of [-1,0,1])if(other!==lane)objects.push({at,lane:other,kind:'wall',style:hash(info.seed+':wall:'+Math.floor(i/6))%3});}
   }
   if(row.kind==='shooter'){
    const side=lane>0?1:lane<0?-1:(hash(info.seed+':shooter:'+i)%2?1:-1),enemyLane=side*1.85;
    // Le tir part du bord 1500 unités avant l'impact, toujours dans une section ouverte.
    const monster=['skull','vampire','demon','ghost'][hash(info.seed+':monster:'+i)%4];
    objects.push({at:at+525,lane:enemyLane,kind:'shooter',monster});
    objects.push({at,lane,kind:'projectile',enemyLane});
   }else objects.push({at,lane,kind:row.kind});
  }
 }
 objects.sort((a,b)=>a.at-b.at);candyGates.sort((a,b)=>a.at-b.at);
 return {objects,gates:candyGates};
}

function shareContent(value){const info=config||result?.info||weekInfo(),points=Math.max(0,Math.floor(Number(value)||0)),url=location.protocol==='file:'?null:new URL(location.href);if(url){url.search='';url.hash='';url.searchParams.set('candySprintV5',info.week);url.searchParams.set('target',String(points))}const link=url?.href||'',text='Course aux bonbons · semaine du '+info.label+' : '+fmt(points)+' bonbons. Sauras-tu battre mon record ?';return{text,link,message:text+(link?'\n'+link:''),whatsapp:'https://wa.me/?text='+encodeURIComponent(text+(link?'\n'+link:'')),messenger:link?'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link):''}}
function bindShare(points){const share=shareContent(points);if($('weeklyWhatsApp'))$('weeklyWhatsApp').href=share.whatsapp;if($('weeklyMessenger')){$('weeklyMessenger').href=share.messenger||'#';$('weeklyMessenger').classList.toggle('hidden',!share.messenger)}if($('weeklyCopy'))$('weeklyCopy').onclick=async()=>{try{await navigator.clipboard.writeText(share.message);$('weeklyShareStatus').textContent='Défi copié !'}catch{prompt('Copie ce défi :',share.message)}}}
function teamRows(board){const rows=Array.isArray(board?.scores)?board.scores:[];if(!rows.length)return'<div class="tiny">Aucun membre n’a encore joué cette course.</div>';return rows.slice(0,10).map((row,i)=>`<div class="weekly-team-row"><b>#${Number(row.rank)||i+1}</b><span>${safeText(row.displayName||'Sorcière')}${row.isYou?' · TOI':''}</span><strong>${row.played===false||row.score==null?'—':fmt(row.score)}</strong></div>`).join('')}
function syncTeam(element,week,promise){if(!element)return;if(!window.MinuitCloud?.connected||!window.MinuitCloud.candySprintBoard){element.innerHTML='<div class="tiny">Record local conservé. Connecte-toi et rejoins une team pour comparer les scores.</div>';return}const epoch=++teamEpoch;element.innerHTML='<div class="tiny">Chargement du classement…</div>';Promise.resolve(promise||window.MinuitCloud.candySprintBoard(week)).then(board=>{if(epoch!==teamEpoch||!element.isConnected)return;element.innerHTML=board?.team?`<div class="weekly-team-heading">TEAM · ${safeText(board.team.name||'Ta team')}</div>${teamRows(board)}<div class="tiny">Classement amical · séparé de l’ancien Sprint et de la campagne.</div>`:'<div class="tiny">Rejoins une team pour comparer tes courses.</div>'}).catch(()=>{if(epoch===teamEpoch&&element.isConnected)element.innerHTML='<div class="tiny">Classement de course indisponible. Ton record local reste conservé.</div>'})}
function preflight(){window.Campaign?.useClassicWorld?.();const info=weekInfo(),best=weekData(info.week).best;state='weekly-preflight';overlay(`<section class="weekly-preflight"><div class="eyebrow">SPRINT HEBDO · COURSE À TROIS VOIES</div><h2 class="local-title">La course aux bonbons</h2><p>90 secondes de vol automatique sur un chemin hanté. La vitesse augmente progressivement ! Suis les chapelets de bonbons et esquive les obstacles.</p><div class="weekly-rule-grid"><div><b>01 · CHANGE DE VOIE</b><span>Clavier : ← →. Souris : déplace le curseur. Téléphone : glisse ou touche une voie.</span></div><div><b>02 · ESQUIVE</b><span>Dans les sections libres, vise les voies riches, mais attention aux obstacles. Dans les couloirs murés, suis l’ouverture. Saute les trous, caisses et citrouilles ; baisse-toi sous les arches. Certains bonbons ne se ramassent qu’en sautant ou en se baissant. Change de voie pour éviter les tirs et les fantômes ; le chrono continue. Clavier : ↑ / ↓. Souris : clic gauche / clic droit. Au doigt : glisse vers le haut / bas ou utilise les boutons.</span></div><div><b>03 · RAMASSE</b><span>Suis les bonbons : chacun vaut un point. La plus grande récolte gagne ! Une collision interrompt la série et ralentit brièvement le vol. Réussis les objectifs pour gagner des étoiles cosmétiques.</span></div></div><div class="weekly-seed"><b>SEMAINE DU ${safeText(info.label.toUpperCase())}</b><small>Même parcours pour tous · renouvellement lundi, heure de Paris</small></div>${friend&&friend.week===info.week?`<div class="weekly-friend-target">DÉFI AMI · ${fmt(friend.score)} points à battre</div>`:''}${legacyChallenge?'<div class="weekly-friend-target">Ce défi utilisait l’ancien parcours. Partage un nouveau défi pour comparer les scores sur le parcours varié.</div>':''}${cosmeticCards()}<div class="weekly-personal-best"><small>TON RECORD HEBDOMADAIRE</small><b>${best?fmt(best.score):'—'}</b></div><section class="replay-card"><small>CLASSEMENT DE TEAM</small><div id="weeklyPreflightTeam"></div></section><div class="local-actions"><button class="primary" id="weeklyLaunch">Prendre le départ →</button><button class="secondary" id="weeklyBack">Retour</button></div>${best?'<div class="local-actions weekly-share-actions"><a class="secondary" id="weeklyWhatsApp" target="_blank" rel="noopener">WhatsApp</a><a class="secondary" id="weeklyMessenger" target="_blank" rel="noopener">Messenger</a><button class="secondary" id="weeklyCopy">Copier le défi</button></div><div class="tiny" id="weeklyShareStatus"></div>':''}<div class="tiny">Essais illimités · équipement normalisé · pas d’XP ni de score de campagne. Les records de l’ancienne course restent séparés.</div></section>`);$('overlay').scrollTop=0;bindCosmetics();$('weeklyLaunch').onclick=start;$('weeklyBack').onclick=()=>LocalLeague.menu();if(best)bindShare(best.score);syncTeam($('weeklyPreflightTeam'),info.week)}

function start(){
 window.Campaign?.useClassicWorld?.();active=false;result=null;config=null;if(!LocalLeague.startTransient())return false;
 const info=weekInfo();config={...info,id:'candy-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
 stage=info.stage;world=worlds[stage];score=0;gameTime=0;terrainDistance=0;combo=1;player.x=400;player.y=780;player.lean=0;
 gates=[];enemies=[];obstacles=[];shots=[];hostile=[];drops=[];particles=[];
 const layout=buildCourse(info),objects=layout.objects,candyGates=layout.gates;
 course={objects,gates:candyGates,distance:0,speed:SPEED,blocked:false,lane:0,lanePos:0,action:'',actionTime:0,streak:0,bestStreak:0,candies:0,collisions:0,slow:0,inv:0,feedback:[],avoids:0,cleanTime:0,missions:[false,false,false],sparkle:0,padDirection:0,padAction:0};
 active=true;release();GuidedTraining.clearMessages();$('dash').disabled=true;$('specialCast').disabled=true;$('dash').classList.add('hidden');$('specialCast').classList.add('hidden');$('hint').textContent='← → : voies · ↑ / ↓ : esquive · souris : déplacer / cliquer · P : pause';c.setAttribute('aria-label','Course à trois voies : flèches ou souris pour choisir la voie ; haut ou clic gauche pour sauter, bas ou clic droit pour se baisser. Sur téléphone, glisser ou utiliser les boutons.');document.querySelector('.hud-lives .hud-label').textContent='BONBONS';$('bossbar').classList.add('hidden');$('questHUD').classList.add('hidden');$('modeLabel').textContent='✦ Course aux bonbons · '+info.week;setRunnerControls(true);hud();say('Choisis ta voie, évite les obstacles !',3);return true;
}
function hud(){if(!active)return;const best=weekData(config.week).best?.score||0;$('score').textContent=String(Math.floor(score)).padStart(6,'0');$('combo').textContent='SÉRIE '+course.streak;$('wave').textContent=Math.ceil(Math.max(0,DURATION-gameTime))+' s';$('realmHUD').textContent='SPRINT';$('hiValue').textContent=String(Math.max(best,Math.floor(score))).padStart(6,'0');$('lives').textContent=course.candies+' bonbons';$('graze').textContent=course.blocked?'MUR · CHANGE DE VOIE':course.slow>0?'RALENTIE':'RÉCOLTE';$('dailyBonusHUD').textContent='';$('status').textContent='COURSE AUX BONBONS · '+Math.ceil(Math.max(0,DURATION-gameTime))+' s restantes'}
const cosmetics=[{id:'classic',name:'Balai classique',stars:0,color:''},{id:'amber',name:'Balai doré',stars:3,color:'#ffd488'},{id:'moon',name:'Balai lunaire',stars:9,color:'#a8e9e3'},{id:'violet',name:'Balai des étoiles',stars:18,color:'#d5a8ff'}];
function stars(){return Math.max(0,Math.floor(Number(data.stars)||0))}
function selectedCosmetic(){return cosmetics.find(item=>item.id===data.cosmetic&&stars()>=item.stars)||cosmetics[0]}
function cosmeticCards(){return `<div class="runner-wardrobe"><b>✦ ATELIER DU BALAI · ${stars()} étoiles</b><small>Gagne 1 étoile par objectif réussi. Apparences sans bonus, sauvegardées sur cet appareil.</small><div class="runner-cosmetics">${cosmetics.map(item=>`<button type="button" class="${selectedCosmetic().id===item.id?'selected':''}" data-cosmetic="${item.id}" ${stars()<item.stars?'disabled':''}><i style="--swatch:${item.color||'#bda7c4'}"></i>${item.name}<small>${stars()<item.stars?item.stars+' étoiles':'Disponible'}</small></button>`).join('')}</div></div>`}
function bindCosmetics(){document.querySelectorAll('[data-cosmetic]').forEach(button=>button.onclick=()=>{const choice=cosmetics.find(item=>item.id===button.dataset.cosmetic);if(!choice||stars()<choice.stars)return;data.cosmetic=choice.id;save();document.querySelectorAll('[data-cosmetic]').forEach(el=>el.classList.toggle('selected',el.dataset.cosmetic===choice.id))})}
function updateMissions(dt,oldCollisions){
 if(course.collisions!==oldCollisions||course.blocked)course.cleanTime=0;else course.cleanTime+=dt;
 const values=[course.bestStreak,course.avoids,course.cleanTime],targets=[15,3,10];
 for(let i=0;i<3;i++)if(!course.missions[i]&&values[i]>=targets[i]){course.missions[i]=true;course.feedback.push({text:'OBJECTIF RÉUSSI ✦',color:'#ffe3a6',life:1.1});tone(840,.12,'sine',.045,1.3)}
 const panel=$('runnerMission');if(!panel)return;
 const next=[`Série de 15 · ${Math.min(15,values[0])}/15`,`3 sauts/glissades · ${Math.min(3,values[1])}/3`,`10 s sans choc · ${Math.min(10,Math.floor(values[2]))}/10`];
 const content='<b>OBJECTIFS · '+course.missions.filter(Boolean).length+'/3 ✦</b>'+next.map((text,i)=>'<span>'+(course.missions[i]?'✓ ':'○ ')+text+'</span>').join('');
 if(panel.innerHTML!==content)panel.innerHTML=content;
}
function setLane(lane){if(!active||state!=='play'||!course)return;course.lane=Math.max(-1,Math.min(1,lane))}
function steer(direction){if(!active||state!=='play'||!course)return;setLane(course.lane+direction)}
function action(kind){if(!active||state!=='play'||!course||course.actionTime>0)return;course.action=kind;course.actionTime=.8}
function validAction(kind){return kind==='jump'?course.action==='jump'&&course.actionTime>.08&&course.actionTime<.72:kind==='duck'?course.action==='duck'&&course.actionTime>.08:true}
function tick(dt){
 if(!active||state!=='play')return;
 const gp=navigator.getGamepads?.()[0];
 if(gp){const direction=gp.axes[0]>.5?1:gp.axes[0]<-.5?-1:0;if(direction&&direction!==course.padDirection)steer(direction);course.padDirection=direction;const jump=!!gp.buttons[0]?.pressed,duck=!!gp.buttons[1]?.pressed;if(jump&&!course.padAction)action('jump');else if(duck&&!course.padAction)action('duck');course.padAction=jump||duck;if(gp.buttons[9]?.pressed&&!padPause)togglePause();padPause=gp.buttons[9]?.pressed}
 if(state!=='play')return;
 gameTime=Math.min(DURATION,gameTime+dt);if(toastTime>0){toastTime-=dt;if(toastTime<=0)GuidedTraining.clearMessages()}
 course.slow=Math.max(0,course.slow-dt);course.inv=Math.max(0,course.inv-dt);
 course.actionTime=Math.max(0,course.actionTime-dt);if(!course.actionTime)course.action='';
 // Mouvement amorti mais réactif ; la position réelle sert aussi aux collisions.
 course.lanePos+=(course.lane-course.lanePos)*(1-Math.exp(-dt*15));
 const oldCollisions=course.collisions;course.sparkle=Math.max(0,course.sparkle-dt);
 const old=course.distance;const speed=SPEED+(MAX_SPEED-SPEED)*Math.min(1,gameTime/DURATION);course.speed=speed*(course.slow>0?.7:1);
 let next=old+course.speed*dt;course.blocked=false;
 // Un mur arrête réellement le balai. Le temps continue et le joueur peut
 // changer de voie à tout moment ; aucun bonbon n'est consommé avant le passage.
 for(const gate of course.gates){
  if(gate.at<=old)continue;if(gate.at>next)break;
  if(Math.abs(gate.lane-course.lanePos)>.48){
   next=gate.at-.001;course.blocked=true;
   if(course.inv<=0){course.collisions++;course.streak=0;combo=1;course.slow=1.2;course.inv=1;course.feedback.push({text:'MUR · CHANGE DE VOIE !',color:'#ffb4a3',life:.8});playSfx('obstacleCollision',.7,.08)}
   break;
  }
 }
 course.distance=next;
 for(const o of course.objects){
  if(o.kind==='projectile'&&!o.fired&&o.at>old&&o.at-old<=1500){o.fired=true;tone(240,.12,'triangle',.03,.8)}
  if(o.done||o.at>course.distance||o.at<old)continue;o.done=true;
  if(o.kind==='wall'||o.kind==='shooter')continue;
  if(Math.abs(o.lane-course.lanePos)>.48)continue;
  if(o.kind==='candy'){
   if(o.require&&!validAction(o.require))continue;
   course.candies++;course.streak++;course.bestStreak=Math.max(course.bestStreak,course.streak);score=course.candies;
   course.sparkle=.3;if(course.candies%2===1)tone(510+Math.min(course.streak,20)*10,.06,'sine',.035,1.12);
   if([5,10,20,40,80].includes(course.streak)){course.feedback.push({text:'SÉRIE '+course.streak+' !',color:'#ffe1a7',life:1});tone(720,.12,'sine',.045,1.2)}
  }
  else if(((o.kind==='stump'||o.kind==='pumpkin'||o.kind==='gap')&&validAction('jump'))||((o.kind==='arch'||o.kind==='branch')&&validAction('duck'))){
   course.avoids++;course.feedback.push({text:(o.kind==='stump'||o.kind==='pumpkin'||o.kind==='gap')?'BIEN SAUTÉ !':'BIEN ESQUIVÉ !',color:'#b9edee',life:.7});
  }else if(course.inv<=0){course.collisions++;course.streak=0;combo=1;course.slow=1.2;course.inv=1;course.feedback.push({text:o.kind==='gap'?'TROU !':o.kind==='projectile'?'TOUCHÉE !':'AÏE !',color:'#ffb4a3',life:.8});playSfx('obstacleCollision',.7,.08)}
 }
 updateMissions(dt,oldCollisions);
 for(const f of course.feedback)f.life-=dt;course.feedback=course.feedback.filter(f=>f.life>0);music(dt);hud();if(gameTime>=DURATION)finish();
}
// Vue pseudo-3D : les éléments se rapprochent du point de fuite jusqu'au balai.
// Projection perspective commune aux bonbons, murs, route et décor.
function projection(at,lane){
 const depth=Math.max(-.2,Math.min(1,(at-course.distance)/VIEW)),focal=1300,far=1/(1+VIEW/focal);
 const p=(1/(1+depth*VIEW/focal)-far)/(1-far),y=245+535*p,width=74+646*p;
 return{x:400+lane*width/3,y,scale:width*1.09/720,width,depth};
}
function polygon(g,points,fill){g.beginPath();g.moveTo(points[0][0],points[0][1]);for(const point of points.slice(1))g.lineTo(point[0],point[1]);g.closePath();g.fillStyle=fill;g.fill()}
// Les points du décor sont en coordonnées monde (largeur, hauteur, distance).
function worldPoint(x,h,z){const p=projection(z,0);return[400+x*p.width/3,p.y-h*p.scale]}
function face3d(g,vertices,color,texture){
 const points=vertices.map(v=>worldPoint(v[0],v[1],v[2]));polygon(g,points,color);
 const image=texture==='wood'||texture==='foliage'?runnerScenery[0]:window.MinuitScenery?.[stage];
 if(!texture||!image?.complete||!image.naturalWidth)return;
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 if(w<2||h<2)return;
 const crop=texture==='foliage'?[.02,.16,.3,.48]:texture==='wood'?[.02,.35,.19,.4]:[.30,.25,.4,.4];
 g.save();g.beginPath();g.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))g.lineTo(p[0],p[1]);g.closePath();g.clip();g.globalAlpha*=texture==='stone'?.48:.65;
 g.drawImage(image,image.naturalWidth*crop[0],image.naturalHeight*crop[1],image.naturalWidth*crop[2],image.naturalHeight*crop[3],x,y,w,h);g.restore();
}
function solid3d(g,x,z,w,d,h,colors,base=0,texture='stone'){
 const l=x-w/2,r=x+w/2,near=z-d/2,far=z+d/2,b=base,t=base+h;
 face3d(g,[[r,b,near],[r,b,far],[r,t,far],[r,t,near]],colors[1],texture);
 face3d(g,[[l,b,near],[r,b,near],[r,t,near],[l,t,near]],colors[0],texture);
 face3d(g,[[l,t,near],[r,t,near],[r,t,far],[l,t,far]],colors[2],texture);
}
function pyramid3d(g,x,z,w,d,base,height,colors,texture='stone'){
 const l=x-w/2,r=x+w/2,near=z-d/2,far=z+d/2,tip=[x,base+height,z];
 face3d(g,[[l,base,far],[r,base,far],tip],colors[2],texture);
 face3d(g,[[r,base,far],[r,base,near],tip],colors[1],texture);
 face3d(g,[[r,base,near],[l,base,near],tip],colors[0],texture);
 face3d(g,[[l,base,near],[l,base,far],tip],colors[2],texture);
}
function branch3d(g,x,z,h,dx,dh,w){
 const near=z-30,far=z+30,tip=x+dx,top=h+dh,colors=['#43333f','#29232f','#69515a'];
 face3d(g,[[x-w/2,h,far],[x+w/2,h,far],[tip+w*.15,top,far-12],[tip-w*.15,top,far-12]],colors[2],'wood');
 face3d(g,[[x+w/2,h,near],[x+w/2,h,far],[tip+w*.15,top,far-12],[tip+w*.15,top,near+12]],colors[1],'wood');
 face3d(g,[[x-w/2,h,near],[x+w/2,h,near],[tip+w*.15,top,near+12],[tip-w*.15,top,near+12]],colors[0],'wood');
}
function tree3d(g,x,z,variation){
 const trunk=['#493945','#292631','#69525c'];solid3d(g,x,z,.24,95,240,trunk,0,'wood');
 branch3d(g,x,z,185,-.43,90,.22);branch3d(g,x,z,190,.45,115,.22);
 branch3d(g,x,z,220,.04,190,.20);branch3d(g,x-.30,z,245,-.23,85,.10);branch3d(g,x+.30,z,260,.22,95,.10);
 // La même lanterne illustrée que dans l'aventure, sur la branche.
 if(variation%2===0){const q=worldPoint(x+.37,168,z-40),p=projection(z,0);sprite(g,'lantern',q[0],q[1],.65*p.scale,ambient)}
}
function tomb3d(g,x,z,variation){
 const stone=['#39484b','#212c35','#626d6d'];
 solid3d(g,x,z,.48,95,130,stone);pyramid3d(g,x,z,.48,95,130,28,stone);
 solid3d(g,x,z,.15,85,82,stone,135);solid3d(g,x,z,.48,80,18,stone,175);
 // Symbole gravé sur la face exposée de la stèle.
 const q=worldPoint(x,66,z-75);const p=projection(z,0);g.fillStyle='#bdd7c488';g.font=`bold ${Math.max(4,24*p.scale)}px Arial`;g.textAlign='center';g.fillText(variation%2?'✦':'☾',q[0],q[1]);
}
function tower3d(g,x,z,variation){
 const stone=['#493843','#211c2c','#715362'];
 solid3d(g,x,z,.80,200,310,stone);
 pyramid3d(g,x,z,1.02,230,310,110,['#512e43','#281e30','#805068']);
 const p=projection(z,0),q=worldPoint(x,165,z-100);
 g.fillStyle='#efb77b99';g.beginPath();g.ellipse(q[0],q[1],8*p.scale,21*p.scale,0,0,Math.PI*2);g.fill();
 if(variation%2){solid3d(g,x,z,.88,215,16,stone,270);}
}
function sceneryTheme(at){
 // Le ciel peint reste celui de la semaine ; les abords changent doucement de
 // portion en portion lorsque leurs éléments entrent dans le champ de vision.
 const section=Math.max(0,Math.floor(at/(ROW_SPACING*6)));
 return (stage+section+hash(config.seed+':scenery:'+Math.floor(section/3))%3)%3;
}
function drawWorld3d(g){
 // Eléments fixes en espace monde : ils grossissent et passent près du balai.
 const step=440,start=Math.floor((course.distance-220)/step)*step,items=[];
 for(let at=start;at<course.distance+VIEW;at+=step){
  const index=Math.floor(at/step);for(const side of [-1,1])items.push({at,x:side*(1.85+((index+2)%3)*.12),variant:Math.abs(index+(side>0?1:0))});
 }
 items.sort((a,b)=>b.at-a.at);
 for(const item of items){
  const d=(item.at-course.distance)/VIEW;g.save();g.globalAlpha=Math.max(.22,Math.min(1,1.1-d*.7));
  const theme=sceneryTheme(item.at);
  if(theme===0)tree3d(g,item.x,item.at,item.variant);
  else if(theme===1){if(item.variant%3===0)tree3d(g,item.x,item.at,item.variant);else tomb3d(g,item.x,item.at,item.variant)}
  else if(item.variant%3===0)tower3d(g,item.x,item.at,item.variant);
  else if(item.variant%3===1)tomb3d(g,item.x,item.at,item.variant);
  else tree3d(g,item.x,item.at,item.variant);
  g.restore();
 }
}
function draw(){
 const g=ctx;
 // Le ciel reprend l'illustration d'origine comme lointain ; le sol et les
 // silhouettes proches sont réellement construits en volumes projetés.
 const painting=runnerScenery[stage];
 if(painting?.complete&&painting.naturalWidth)g.drawImage(painting,0,0,painting.naturalWidth,painting.naturalHeight*.37,-8-course.lanePos*5,0,W+16,245);
 else{const sky=g.createLinearGradient(0,0,0,245);sky.addColorStop(0,world.colors[0]);sky.addColorStop(1,world.colors[1]);g.fillStyle=sky;g.fillRect(0,0,W,245)}
 const land=g.createLinearGradient(0,245,0,H);land.addColorStop(0,stage===1?'#354e50':'#4c3c51');land.addColorStop(.45,stage===1?'#1a3438':'#2c263a');land.addColorStop(1,'#100e1c');g.fillStyle=land;g.fillRect(0,245,W,H-245);
 // Un sol texturé projeté par bandes jusqu'au point de fuite, y compris sur les côtés.
 const terrain=window.MinuitScenery?.[stage];
 if(terrain?.complete&&terrain.naturalWidth){
  g.save();g.beginPath();g.rect(0,245,W,H-245);g.clip();g.globalAlpha=.65;
  const step=60,repeat=1440,firstBand=Math.floor((course.distance-300)/step)*step;
  for(let at=firstBand;at<course.distance+VIEW;at+=step){
   const start=Math.max(at,course.distance-300),end=Math.min(at+step,course.distance+VIEW),near=projection(start,0),far=projection(end,0),sy=((start%repeat+repeat)%repeat)/repeat*terrain.naturalHeight,sh=(end-start)/repeat*terrain.naturalHeight;
   g.drawImage(terrain,terrain.naturalWidth*.2,sy,terrain.naturalWidth*.6,sh,0,far.y,W,near.y-far.y+1);
  }
  g.restore();
 }
 const mist=g.createLinearGradient(0,220,0,320);mist.addColorStop(0,stage===1?'#354e5000':'#4c3c5100');mist.addColorStop(.5,stage===1?'#354e50cc':'#4c3c51cc');mist.addColorStop(1,stage===1?'#354e5000':'#4c3c5100');g.fillStyle=mist;g.fillRect(0,220,W,100);
 const road=g.createLinearGradient(0,245,0,H);road.addColorStop(0,'#453b5270');road.addColorStop(.35,'#38313bcc');road.addColorStop(1,'#211b28f2');
 polygon(g,[[363,245],[437,245],[800,H],[0,H]],road);
 // Le sol peint de l'aventure est projeté en fines bandes, pour suivre la fuite
 // sans déformer le panorama frontal ni faire défiler les bâtiments vus de dessus.
 const ground=window.MinuitScenery?.[stage];
 if(ground?.complete&&ground.naturalWidth){
  g.save();g.beginPath();g.moveTo(363,245);g.lineTo(437,245);g.lineTo(W,H);g.lineTo(0,H);g.closePath();g.clip();g.globalAlpha=.38;
  const step=60,repeat=1440,firstBand=Math.floor((course.distance-300)/step)*step;
  for(let at=firstBand;at<course.distance+VIEW;at+=step){
   const start=Math.max(at,course.distance-300),end=Math.min(at+step,course.distance+VIEW),near=projection(start,0),far=projection(end,0),sy=((start%repeat+repeat)%repeat)/repeat*ground.naturalHeight,sh=(end-start)/repeat*ground.naturalHeight;
   const width=(near.width+far.width)*.5;
   g.drawImage(ground,ground.naturalWidth*.3,sy,ground.naturalWidth*.4,sh,400-width/2,far.y,width,near.y-far.y+1);
  }
  g.restore();
 }
 // Pavés, bordures et lanternes avancent en profondeur avec le parcours.
 const first=Math.floor(course.distance/180)*180+180;
 for(let at=first;at<course.distance+VIEW;at+=180){
  const p=projection(at,0),half=p.width*.5;
  g.strokeStyle='#d7b99a35';g.lineWidth=Math.max(.5,p.scale*2.4);g.beginPath();g.moveTo(400-half,p.y);g.lineTo(400+half,p.y);g.stroke();
  if(Math.round(at/180)%4===0){for(const side of [-1,1]){const lamp=projection(at,side*1.65);sprite(g,'lantern',lamp.x,lamp.y-28*lamp.scale,.9*lamp.scale,ambient)}}
 }
 for(const lane of [-.5,.5]){const far=projection(course.distance+VIEW,lane),near=projection(course.distance,lane);g.save();g.strokeStyle='#e5c6a950';g.lineWidth=2;g.setLineDash([14,14]);g.lineDashOffset=-course.distance*.1;g.beginPath();g.moveTo(far.x,far.y);g.lineTo(near.x,near.y);g.lineTo(400+lane*284,H);g.stroke();g.restore()}
 for(const side of [-1,1]){const far=projection(course.distance+VIEW,side*1.5),near=projection(course.distance,side*1.5);g.strokeStyle='#d4b18a99';g.lineWidth=3;g.beginPath();g.moveTo(far.x,far.y);g.lineTo(near.x,near.y);g.lineTo(side<0?0:W,H);g.stroke()}
 drawWorld3d(g);
 const visible=course.objects.filter(o=>(!o.done||o.kind==='gap'&&o.at+120>course.distance)&&o.at>=course.distance-(o.kind==='gap'?120:0)&&o.at-course.distance<VIEW).sort((a,b)=>b.at-a.at);
 for(const o of visible)drawObject(g,o);
 const px=400+course.lanePos*240, jump=course.action==='jump'?Math.sin((.8-course.actionTime)/.8*Math.PI)*115:0,duck=course.action==='duck';
 g.save();g.fillStyle='#09071188';g.beginPath();g.ellipse(px,795,46-jump*.12,12,0,0,Math.PI*2);g.fill();g.restore();
 if(course.inv<=0||Math.floor(course.inv*9)%2===0)drawWitch(g,px,765-jump,duck);
 g.save();g.textAlign='center';g.font='bold 25px Arial';g.lineWidth=5;g.strokeStyle='#1a1027';for(let i=0;i<course.feedback.length;i++){const f=course.feedback[i];g.globalAlpha=Math.min(1,f.life*4);g.strokeText(f.text,400,345-i*28);g.fillStyle=f.color;g.fillText(f.text,400,345-i*28)}g.restore();
}
function groundShadow(g,o,radius){
 const p=projection(o.at,o.lane);g.fillStyle='#08071180';g.beginPath();g.ellipse(p.x,p.y+3*p.scale,radius*p.scale,9*p.scale,0,0,Math.PI*2);g.fill();
}
// Texture projetée sur deux triangles : les joints suivent vraiment les faces 3D.
function textureTriangle(g,image,vertices,uv,opacity,clipQuad){
 const [[x1,y1],[x2,y2],[x3,y3]]=vertices,[[u1,v1],[u2,v2],[u3,v3]]=uv;
 const det=u1*(v2-v3)+u2*(v3-v1)+u3*(v1-v2);if(Math.abs(det)<1e-8)return;
 const a=(x1*(v2-v3)+x2*(v3-v1)+x3*(v1-v2))/det,c=(x1*(u3-u2)+x2*(u1-u3)+x3*(u2-u1))/det;
 const e=(x1*(u2*v3-u3*v2)+x2*(u3*v1-u1*v3)+x3*(u1*v2-u2*v1))/det;
 const b=(y1*(v2-v3)+y2*(v3-v1)+y3*(v1-v2))/det,d=(y1*(u3-u2)+y2*(u1-u3)+y3*(u2-u1))/det;
 const f=(y1*(u2*v3-u3*v2)+y2*(u3*v1-u1*v3)+y3*(u1*v2-u2*v1))/det;
 g.save();g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.lineTo(x3,y3);if(clipQuad)g.lineTo(clipQuad[0],clipQuad[1]);g.closePath();g.clip();g.globalAlpha*=opacity;g.transform(a,b,c,d,e,f);g.drawImage(image,0,0);g.restore();
}
function texturedFace3d(g,vertices,color,image,opacity=.9){
 const points=vertices.map(v=>worldPoint(v[0],v[1],v[2]));polygon(g,points,color);
 if(!image||!image.width||!image.height||image.complete===false)return;
 const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height,uv=[[0,h],[w,h],[w,0],[0,0]];
 // Une seule projection suffit aux petites faces lointaines ; deux triangles
 // corrigent la perspective des faces proches, où elle est plus visible.
 const extent=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
 if(extent<48)textureTriangle(g,image,[points[0],points[1],points[2]],[uv[0],uv[1],uv[2]],opacity,points[3]);
 else {
  textureTriangle(g,image,[points[0],points[1],points[2]],[uv[0],uv[1],uv[2]],opacity);
  textureTriangle(g,image,[points[0],points[2],points[3]],[uv[0],uv[2],uv[3]],opacity);
 }
}
function materialBox(g,x,z,w,d,h,base,colors,image){
 const front=z-d/2,far=z+d/2,l=x-w/2,r=x+w/2,side=x>0?l:r;
 texturedFace3d(g,[[side,base,front],[side,base,far],[side,base+h,far],[side,base+h,front]],colors[1],image,.74);
 texturedFace3d(g,[[l,base,front],[r,base,front],[r,base+h,front],[l,base+h,front]],colors[0],image,.88);
 texturedFace3d(g,[[l,base+h,front],[r,base+h,front],[r,base+h,far],[l,base+h,far]],colors[2],image,.67);
}
function wall3d(g,o){
 // Des blocs de pierre réellement texturés sur leurs trois faces projetées.
 const x=o.lane,z=o.at,w=.82,d=155,h=116,front=z-d/2;
 materialBox(g,x,z,w,d,h,0,['#4c4552','#27313a','#9a8891'],stoneTexture);
 // Créneaux et renforts alternent par portion, sans changer la collision du mur.
 const p=projection(front,x);
 if(p.scale>.32&&o.style===1){
  for(const side of [-1,1])materialBox(g,x+side*.29,z,.17,d,22,h,['#4c4552','#27313a','#9a8891'],stoneTexture);
 }else if(p.scale>.32&&o.style===2){
  for(const side of [-1,1])materialBox(g,x+side*.29,front-5,.075,16,h,0,['#98674e','#49312e','#cb9b69'],woodTexture);
 }
 const mark=worldPoint(x,54,front);
 g.fillStyle='#f2d7a2';g.textAlign='center';g.font=`bold ${Math.max(4,15*p.scale)}px Arial`;g.fillText('✦',mark[0],mark[1]);
}
function crate3d(g,o){
 // Illustration originale devant, bois peint sur le dessus et le côté du cube.
 const x=o.lane,z=o.at,w=.40,d=150,h=82,front=z-d/2;
 groundShadow(g,o,45);materialBox(g,x,z,w,d,h,0,['#98674e','#49312e','#cb9b69'],woodTexture);
 const p=projection(front,x),width=w*p.width/3,height=h*p.scale;
 g.save();g.translate(p.x,p.y-height/2);g.scale(width/46,height/46);drawObstacle(g,{x:0,y:0,kind:'crate',hit:0,breakable:false});g.restore();
 const label=worldPoint(x,h+23,front);g.fillStyle='#fff0d4';g.textAlign='center';g.font=`bold ${Math.max(4,17*p.scale)}px Arial`;g.fillText('↑ SAUTE',label[0],label[1]);
}
function arch3d(g,o){
 const x=o.lane,z=o.at,front=z-70;
 groundShadow(g,o,65);
 for(const offset of [-.30,.30])materialBox(g,x+offset,z,.13,120,102,0,['#62586a','#3d3545','#9b8998'],stoneTexture);
 materialBox(g,x,z,.78,140,28,102,['#98674e','#563934','#d5a175'],woodTexture);
 const p=projection(front,x),from=worldPoint(x-.36,115,front),to=worldPoint(x+.36,115,front);
 g.strokeStyle='#e6c390';g.lineWidth=Math.max(.7,3*p.scale);g.beginPath();g.moveTo(from[0],from[1]);g.lineTo(to[0],to[1]);g.stroke();
 const label=worldPoint(x,153,front);g.fillStyle='#fff0e8';g.textAlign='center';g.font=`bold ${Math.max(4,17*p.scale)}px Arial`;g.fillText('↓ BAISSE',label[0],label[1]);
}
function pumpkin3d(g,o){
 // Citrouille native sur un petit socle de pierre en volume : obstacle à sauter.
 const x=o.lane,z=o.at;groundShadow(g,o,50);
 materialBox(g,x,z,.52,140,27,0,['#514853','#2b343a','#9a8991'],stoneTexture);
 const p=projection(z-60,x),q=worldPoint(x,73,z-60);
 sprite(g,'pumpkin',q[0],q[1],1.32*p.scale,ambient);
 const label=worldPoint(x,142,z-70);g.fillStyle='#fff0d4';g.textAlign='center';g.font=`bold ${Math.max(4,17*p.scale)}px Arial`;g.fillText('↑ SAUTE',label[0],label[1]);
}
function branchObstacle3d(g,o){
 // Branches et linteau en volume signalent un passage où se baisser.
 const x=o.lane,z=o.at,front=z-70;groundShadow(g,o,65);
 for(const side of [-1,1]){
  materialBox(g,x+side*.30,z,.14,120,106,0,['#66483b','#342934','#aa7955'],woodTexture);
  branch3d(g,x+side*.30,z,101,side*.16,47,.12);
 }
 materialBox(g,x,z,.78,140,28,102,['#98674e','#563934','#d5a175'],woodTexture);
 const p=projection(front,x),label=worldPoint(x,164,front);
 g.fillStyle='#fff0e8';g.textAlign='center';g.font=`bold ${Math.max(4,17*p.scale)}px Arial`;g.fillText('↓ BAISSE',label[0],label[1]);
}
function gap3d(g,o){
 // Ouverture dans la route, avec rebords et faces en profondeur.
 const x=o.lane,z=o.at,w=.76,near=z-120,far=z+120,l=x-w/2,r=x+w/2;
 const tl=worldPoint(l,0,far),tr=worldPoint(r,0,far),bl=worldPoint(l,0,near),br=worldPoint(r,0,near);
 polygon(g,[tl,tr,br,bl],'#070814');
 polygon(g,[tl,tr,worldPoint(r,-45,far),worldPoint(l,-45,far)],'#312d3a');
 polygon(g,[tr,br,worldPoint(r,-35,near),worldPoint(r,-45,far)],'#1c1a28');
 g.strokeStyle='#b59b8a';g.lineWidth=Math.max(1,2.5*projection(z,x).scale);g.beginPath();g.moveTo(bl[0],bl[1]);g.lineTo(tl[0],tl[1]);g.lineTo(tr[0],tr[1]);g.lineTo(br[0],br[1]);g.stroke();
 const label=worldPoint(x,64,near),p=projection(near,x);g.fillStyle='#ffe5bd';g.textAlign='center';g.font=`bold ${Math.max(5,17*p.scale)}px Arial`;g.fillText('↑ SAUTE',label[0],label[1]);
}
function shooter3d(g,o){
 const p=projection(o.at,o.lane);groundShadow(g,o,40);
 const q=worldPoint(o.lane,105,o.at);sprite(g,o.monster||'skull',q[0],q[1],1.6*p.scale,ambient);
 const flare=worldPoint(o.lane,85,o.at-35);g.fillStyle='#ffbd75aa';g.beginPath();g.arc(flare[0],flare[1],7*p.scale,0,Math.PI*2);g.fill();
}
function projectilePosition(o){
 const remaining=o.at-course.distance;if(remaining>1500||remaining<0)return null;
 const t=Math.max(0,Math.min(1,1-remaining/1500));
 return {remaining,lane:o.lane+(o.enemyLane-o.lane)*(1-t),z:o.at+remaining*.35};
}
function projectile3d(g,o){
 const shot=projectilePosition(o);if(!shot)return;
 const {remaining,lane,z}=shot,p=projection(z,lane),q=worldPoint(lane,62,z),radius=Math.max(2,18*p.scale);
 const glow=g.createRadialGradient(q[0],q[1],0,q[0],q[1],radius*2.2);glow.addColorStop(0,'#fff0ae');glow.addColorStop(.35,'#ff9b57');glow.addColorStop(1,'#d35d4a00');g.fillStyle=glow;g.beginPath();g.arc(q[0],q[1],radius*2.2,0,Math.PI*2);g.fill();
 g.strokeStyle='#ffe0a0';g.lineWidth=Math.max(1,2*p.scale);g.beginPath();g.arc(q[0],q[1],radius,0,Math.PI*2);g.stroke();
 if(remaining<1100){g.fillStyle='#ffe2b0';g.textAlign='center';g.font=`bold ${Math.max(6,14*p.scale)}px Arial`;g.fillText('↔ TIR',q[0],q[1]-radius*2.2-5*p.scale)}
}
function candy3d(g,o){
 // Bonbon enveloppé : une sphère maillée, des papillotes à facettes et un sceau étoilé.
 const x=o.lane,z=o.at,center=(o.require==='jump'?158:o.require==='duck'?35:62)+Math.sin(ambient*3+z*.01)*3,phase=ambient*1.5+z*.004;
 groundShadow(g,o,40);
 // À distance, l'illustration originale est plus lisible et moins coûteuse que
 // ses nombreuses facettes ; le volume complet apparaît en s'approchant.
 const distant=projection(z,x);
 if(distant.scale<.32){const mark=worldPoint(x,center+13,z);window.CollectibleArt?.draw(g,'xp',mark[0],mark[1],192*distant.scale,132*distant.scale);return}
 for(const side of [-1,1]){
  const inner=x+side*.12,outer=x+side*.29,near=z-20,far=z+20;
  face3d(g,[[inner,center-12,far],[outer,center-25,far],[outer,center+25,far],[inner,center+12,far]],'#6f4d99');
  face3d(g,[[inner,center-12,near],[outer,center-25,near],[outer+side*.025,center-10,near],[outer,center,near],[outer+side*.025,center+10,near],[outer,center+25,near],[inner,center+12,near]],side<0?'#9e7abe':'#75569c');
  face3d(g,[[inner,center+12,near],[outer,center+25,near],[outer,center+25,far],[inner,center+12,far]],'#d7b2e1');
  // Les reflets et plis de l'emballage sont repris du bonbon illustré original.
  const wing=[[inner,center-12,near],[outer,center-25,near],[outer+side*.025,center-10,near],[outer,center,near],[outer+side*.025,center+10,near],[outer,center+25,near],[inner,center+12,near]].map(v=>worldPoint(v[0],v[1],v[2]));
  const front=projection(z-36,x),mark=worldPoint(x,center+13,z-36);
  g.save();g.beginPath();g.moveTo(wing[0][0],wing[0][1]);for(const pt of wing.slice(1))g.lineTo(pt[0],pt[1]);g.closePath();g.clip();g.globalAlpha=.9;window.CollectibleArt?.draw(g,'xp',mark[0],mark[1],192*front.scale,132*front.scale);g.restore();
  const a=worldPoint(inner,center,near-1),b=worldPoint(outer,center+18,near-1),c=worldPoint(outer,center-18,near-1),p=projection(near,x);
  g.strokeStyle='#ecd5ef99';g.lineWidth=Math.max(.5,1.5*p.scale);g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.moveTo(a[0],a[1]);g.lineTo(c[0],c[1]);g.stroke();
 }
 const latitudes=5,longitudes=10,grid=[],faces=[],colors=['#4f376b','#644881','#7e5fa2','#9c78b7','#bda0d2','#ddc4e8'];
 for(let i=0;i<=latitudes;i++){
  const lat=-Math.PI/2+i*Math.PI/latitudes,row=[];
  for(let j=0;j<=longitudes;j++){
   const lon=j*Math.PI*2/longitudes+phase,rr=Math.cos(lat);
   const wx=x+.15*rr*Math.cos(lon),wh=center+31*Math.sin(lat),wz=z+36*rr*Math.sin(lon);
   row.push({point:worldPoint(wx,wh,wz),z:wz});
  }
  grid.push(row);
 }
 for(let i=0;i<latitudes;i++)for(let j=0;j<longitudes;j++){
  const q=[grid[i][j],grid[i][j+1],grid[i+1][j+1],grid[i+1][j]],brightness=Math.max(0,Math.min(5,Math.floor((Math.cos(j*Math.PI*2/longitudes)*.45+Math.sin(i*Math.PI/latitudes)*.45+.6)*4)));
  faces.push({points:q.map(v=>v.point),depth:q.reduce((sum,v)=>sum+v.z,0)/4,color:colors[brightness]});
 }
 faces.sort((a,b)=>b.depth-a.depth);for(const face of faces)polygon(g,face.points,face.color);
 const front=projection(z-36,x),mark=worldPoint(x,center+13,z-36);
 // Illustration d'origine appliquée sur la face : la silhouette et les flancs
 // restent des volumes 3D, et le sceau conserve les détails du jeu de base.
 g.save();g.beginPath();g.ellipse(mark[0],mark[1],25*front.scale,29*front.scale,0,0,Math.PI*2);g.clip();
 if(!window.CollectibleArt?.draw(g,'xp',mark[0],mark[1],150*front.scale,132*front.scale)){
  g.fillStyle='#fff4e4';g.textAlign='center';g.font=`bold ${Math.max(4,22*front.scale)}px Arial`;g.fillText('★',mark[0],mark[1]+7*front.scale);
 }
 g.restore();
 const glint=worldPoint(x-.045,center+19,z-32);g.fillStyle='#fff5ffbb';g.beginPath();g.ellipse(glint[0],glint[1],5*front.scale,2.5*front.scale,-.3,0,Math.PI*2);g.fill();
}
function drawObject(g,o){
 if(o.kind==='wall')return wall3d(g,o);
 if(o.kind==='gap')return gap3d(g,o);
 if(o.kind==='shooter')return shooter3d(g,o);
 if(o.kind==='projectile')return projectile3d(g,o);
 if(o.kind==='stump')return crate3d(g,o);
 if(o.kind==='pumpkin')return pumpkin3d(g,o);
 if(o.kind==='branch')return branchObstacle3d(g,o);
 if(o.kind==='candy')return candy3d(g,o);
 if(o.kind==='arch')return arch3d(g,o);
 const p=projection(o.at,o.lane),s=p.scale;g.save();g.translate(p.x,p.y);g.scale(s,s);g.textAlign='center';
 g.fillStyle='#0a081079';g.beginPath();g.ellipse(0,3,o.kind==='arch'?66:42,10,0,0,Math.PI*2);g.fill();
 g.save();g.globalAlpha=.28;sprite(g,'ghost',7,-69,1.9,ambient);g.restore();sprite(g,'ghost',0,-65,1.9,ambient);
 g.fillStyle='#dff8ff';g.font='bold 17px Arial';g.fillText('← ÉVITE →',0,-125);
 g.restore();
}
function drawWitch(g,x,y,duck){
 // La même illustration et les mêmes décorations que la sorcière de l'aventure.
 g.save();g.translate(x,y);if(duck)g.scale(1,.64);
 const look=selectedCosmetic();
 if(look.color){g.save();g.strokeStyle=look.color;g.fillStyle=look.color;g.globalAlpha=.7;g.lineWidth=3;g.beginPath();g.moveTo(-7,52);g.quadraticCurveTo(-14,69+Math.sin(ambient*6)*4,-9,82);g.moveTo(7,52);g.quadraticCurveTo(14,70-Math.sin(ambient*6)*4,9,82);g.stroke();for(let i=0;i<3;i++){g.beginPath();g.arc((i-1)*11,63+(ambient*22+i*9)%25,2.3,0,Math.PI*2);g.fill()}g.restore()}
 if(course.sparkle>0){g.save();g.fillStyle='#ffe5a9';g.globalAlpha=course.sparkle/.3;for(let i=0;i<6;i++){const a=i*Math.PI/3+ambient*2,r=30+(1-course.sparkle/.3)*32;g.beginPath();g.arc(Math.cos(a)*r,-25+Math.sin(a)*r,2.5,0,Math.PI*2);g.fill()}g.restore()}
 const previousLean=player.lean;player.lean=Math.max(-.18,Math.min(.18,(course.lane-course.lanePos)*.2));
 sprite(g,'witch',0,-42,1.55,ambient,0,'none');player.lean=previousLean;
 if(look.color){g.save();g.strokeStyle=look.color;g.globalAlpha=.85;g.lineWidth=2;g.beginPath();g.moveTo(-7,29);g.lineTo(7,29);for(const x of [-7,-3,3,7]){g.moveTo(x,34);g.lineTo(x*1.6,46)}g.stroke();g.restore()}
 g.restore();
}

function setRunnerControls(show){let panel=$('runnerMission');if(!panel){panel=document.createElement('div');panel.id='runnerMission';panel.setAttribute('aria-label','Objectifs de la course');document.querySelector('.arena').appendChild(panel)}panel.classList.toggle('hidden',!show);if(show)panel.innerHTML='';let controls=$('runnerControls');if(!controls){controls=document.createElement('div');controls.id='runnerControls';controls.setAttribute('aria-label','Commandes de la course');controls.innerHTML='<button type="button" data-move="left" aria-label="Voie gauche">←</button><button type="button" data-move="jump" aria-label="Sauter">↑</button><button type="button" data-move="duck" aria-label="Se baisser">↓</button><button type="button" data-move="right" aria-label="Voie droite">→</button>';document.querySelector('.arena').appendChild(controls);controls.addEventListener('click',e=>{const move=e.target.closest('button')?.dataset.move;if(move==='left')steer(-1);if(move==='right')steer(1);if(move==='jump')action('jump');if(move==='duck')action('duck')})}controls.classList.toggle('hidden',!show)}
let gesture=null;
window.addEventListener('keydown',e=>{if(!active||state!=='play'||e.repeat||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;const key=e.key.toLowerCase(),k=prefs.keys;let handled=true;if(key==='arrowleft'||key==='a'||key==='q'||key===String(k.left).toLowerCase())steer(-1);else if(key==='arrowright'||key==='d'||key===String(k.right).toLowerCase())steer(1);else if(key==='arrowup'||key==='w'||key==='z'||key===' '||key===String(k.up).toLowerCase())action('jump');else if(key==='arrowdown'||key==='s'||key===String(k.down).toLowerCase())action('duck');else handled=false;if(handled){e.preventDefault();e.stopImmediatePropagation()}},true);
function mouseLane(e){const rect=c.getBoundingClientRect(),relative=(e.clientX-rect.left)/rect.width;setLane(relative<1/3?-1:relative>2/3?1:0)}
c.addEventListener('pointerdown',e=>{
 if(!active||state!=='play')return;
 if(e.pointerType==='mouse'){
  mouseLane(e);if(e.button===0)action('jump');else if(e.button===2)action('duck');
 }else{
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};try{c.setPointerCapture(e.pointerId)}catch{}
 }
 e.preventDefault();e.stopImmediatePropagation();
},true);
c.addEventListener('pointermove',e=>{
 if(!active||state!=='play')return;
 if(e.pointerType==='mouse'){mouseLane(e);e.preventDefault();e.stopImmediatePropagation();return}
 if(!gesture||gesture.id!==e.pointerId)return;
 const x=e.clientX-gesture.x,y=e.clientY-gesture.y;
 if(Math.max(Math.abs(x),Math.abs(y))>=28){if(Math.abs(x)>Math.abs(y))steer(x>0?1:-1);else action(y<0?'jump':'duck');gesture.x=e.clientX;gesture.y=e.clientY;gesture.moved=true}
 e.preventDefault();e.stopImmediatePropagation();
},true);
function endGesture(e){
 if(!active)return;
 if(e.pointerType==='mouse'){e.preventDefault();e.stopImmediatePropagation();return}
 if(!gesture||gesture.id!==e.pointerId)return;
 if(!gesture.moved&&e.type==='pointerup')mouseLane(e);
 gesture=null;e.preventDefault();e.stopImmediatePropagation();
}
c.addEventListener('pointerup',endGesture,true);c.addEventListener('pointercancel',endGesture,true);

function finish(){if(!active)return;const info={...config},week=weekData(info.week),previous=week.best?.score||0;result={info,week:info.week,score:Math.floor(score),candies:course.candies,bestStreak:course.bestStreak,collisions:course.collisions,time:DURATION,missions:course.missions.slice(),starsEarned:course.missions.filter(Boolean).length,isRecord:!week.best||score>previous};const oldStars=stars();data.stars=oldStars+result.starsEarned;result.unlocked=cosmetics.filter(item=>item.stars>oldStars&&item.stars<=data.stars).map(item=>item.name);week.runs=Array.isArray(week.runs)?week.runs:[];week.runs.unshift({...result});week.runs=week.runs.slice(0,8);if(!week.best||result.score>week.best.score)week.best={...result};save();const submission=window.MinuitCloud?.connected&&window.MinuitCloud.submitCandySprint?window.MinuitCloud.submitCandySprint({week:info.week,runId:info.id,score:result.score,time:DURATION,wave:3,won:true}):null;active=false;config=null;release();restoreControls();Journey.abandon();window.SandboxMode=false;state='end';present(submission)}
function present(submission){if(!result)return;const r=result,best=weekData(r.week).best;state='end';overlay(`<section class="journey-result-screen weekly-result"><div class="eyebrow">COURSE AUX BONBONS · SEMAINE DU ${safeText(r.info.label.toUpperCase())}</div><h2 class="local-title">La course est terminée !</h2><div class="journey-result-grid"><div><small>BONBONS RAMASSÉS</small><b>${fmt(r.score)}</b><span>${r.isRecord?'Nouveau record !':'Retente ta chance'}</span></div><div><small>RECORD HEBDOMADAIRE</small><b>${fmt(best.score)}</b></div><div><small>COLLISIONS</small><b>${r.collisions}</b><span>Les murs bloquent le passage</span></div><div><small>MEILLEURE SÉRIE</small><b>${r.bestStreak}</b><span>bonbons consécutifs sans collision</span></div></div><section class="replay-card runner-results-missions"><small>OBJECTIFS · +${r.starsEarned} ÉTOILE${r.starsEarned>1?'S':''}</small><div>${r.missions.map((done,i)=>(done?'✓ ':'○ ')+['Série de 15','3 sauts ou glissades','10 s sans collision'][i]).join(' · ')}</div>${r.unlocked.length?'<strong>Débloqué : '+r.unlocked.join(', ')+'</strong>':''}<p>Étoiles au total : ${stars()} · apparences uniquement, sans bonus.</p></section>${friend&&friend.week===r.week?`<section class="replay-card"><small>DÉFI AMI</small><h3>${r.score>friend.score?'Score ami battu !':r.score===friend.score?'Égalité avec ton ami':'Score à battre : '+fmt(friend.score)}</h3></section>`:''}<section class="replay-card weekly-scoreboard"><small>CLASSEMENT DE TEAM</small><div id="weeklyTeamBoard"></div></section><div class="local-actions weekly-share-actions"><a class="secondary" id="weeklyWhatsApp" target="_blank" rel="noopener">WhatsApp</a><a class="secondary" id="weeklyMessenger" target="_blank" rel="noopener">Messenger</a><button class="secondary" id="weeklyCopy">Copier le défi</button></div><div class="tiny" id="weeklyShareStatus">Partage le parcours et ton record.</div><div class="local-actions"><button class="primary" id="weeklyRetry">Rejouer →</button><button class="secondary" id="weeklyCustomize">Choisir mon balai</button><button class="secondary" id="weeklyHome">Retour à l’accueil</button></div><div class="tiny">Récolte isolée de la campagne et des anciennes courses · aucun gain d’XP.</div></section>`);$('overlay').scrollTop=0;$('weeklyRetry').onclick=start;$('weeklyCustomize').onclick=preflight;$('weeklyHome').onclick=()=>LocalLeague.menu();bindShare(best.score);syncTeam($('weeklyTeamBoard'),r.week,submission)}
function restoreControls(){gesture=null;setRunnerControls(false);$('dash').disabled=false;$('specialCast').disabled=false;$('dash').classList.remove('hidden');$('specialCast').classList.remove('hidden');GuidedTraining.clearMessages();$('hint').textContent='MAJ : précision · ESPACE : esquive · P : pause';c.setAttribute('aria-label','Jeu de tir Halloween. Flèches pour bouger, Maj pour la précision, espace pour esquiver.');document.querySelector('.hud-lives .hud-label').textContent='VIES'}
function discard(){const had=active||result;active=false;config=null;result=null;course=null;if(had){restoreControls();release();if(Journey.run?.transient)Journey.abandon();window.SandboxMode=false;$('questHUD').classList.add('hidden')}return had}
function installMenu(){if(state!=='league-menu'||document.querySelector('#overlay .training-mode'))return;const lab=$('labMenu'),grid=lab?.closest('.menu-grid');if(!grid||$('weeklySprint'))return;const button=document.createElement('button');button.type='button';button.id='weeklySprint';button.className='secondary menu-card-button';button.innerHTML='<span class="menu-card-icon">↯</span><span>Course aux bonbons<small>Sprint hebdo · 90 s</small></span>';button.onclick=preflight;grid.insertBefore(button,grid.firstChild);GuidedTraining.applyRequirement()}
const oldUpdate=update;update=function(dt){if(active)return tick(dt);return oldUpdate(dt)};
const oldDraw=drawGame;drawGame=function(){if(active&&course)return draw();return oldDraw()};
const oldDodge=dodge;dodge=function(){if(!active)return oldDodge()};
const oldMenu=menu;menu=function(...args){if(discard())return LocalLeague.menu();return oldMenu(...args)};
const oldPlay=LocalLeague.play;LocalLeague.play=function(...args){discard();return oldPlay(...args)};
const oldChallenge=LocalLeague.challenge;LocalLeague.challenge=function(...args){discard();return oldChallenge(...args)};
const oldLocalMenu=LocalLeague.menu;LocalLeague.menu=function(...args){discard();return oldLocalMenu(...args)};
const oldJourneyMenu=Journey.menu;Journey.menu=function(...args){const value=oldJourneyMenu(...args);installMenu();return value};
const css=document.createElement('style');css.textContent=`#runnerMission{position:absolute;top:10px;left:10px;z-index:3;display:flex;flex-direction:column;gap:2px;padding:6px 9px;border:1px solid #d8b88755;border-radius:8px;background:#171323c9;color:#efe3ec;font-size:10px;line-height:1.25;pointer-events:none}#runnerMission b{color:#ffd39d;font-size:10px}.runner-wardrobe{margin:10px 0;padding:10px;border:1px solid #755c8055;border-radius:10px;background:#251c32bb;width:100%;text-align:left}.runner-wardrobe>b,.runner-wardrobe>small{display:block}.runner-wardrobe>b{color:#ffd08e}.runner-wardrobe>small{margin:5px 0;color:#c2afc9}.runner-cosmetics{display:flex;flex-wrap:wrap;gap:6px}.runner-cosmetics button{flex:1;min-width:100px;padding:7px;border:1px solid #765d81;border-radius:8px;background:#211a30;color:#efe3ec;font-size:10px}.runner-cosmetics button.selected{border-color:#ffd08e;box-shadow:0 0 0 1px #ffd08e}.runner-cosmetics button:disabled{opacity:.5}.runner-cosmetics small{display:block;font-size:9px;margin-top:3px}.runner-cosmetics i{display:inline-block;width:9px;height:9px;margin-right:5px;border-radius:50%;background:var(--swatch)}.runner-results-missions strong{display:block;color:#ffd08e;margin-top:6px}@media(max-width:850px){#runnerMission{font-size:8px;padding:4px 6px;gap:1px}#runnerMission b{font-size:8px}}#runnerControls{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:10px;z-index:4;touch-action:manipulation}#runnerControls button{width:50px;height:45px;border:1px solid #e1b9d888;border-radius:12px;background:#21152acb;color:#fff2d9;font-size:23px;box-shadow:0 4px 14px #05020a55}#runnerControls button:active{background:#8b5c80} #weeklySprint small{display:block;margin-top:3px;color:#bdaac8;font-size:8px}.weekly-preflight{width:min(760px,100%);min-height:100%;margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.weekly-preflight>p{max-width:580px}.weekly-rule-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;margin:12px 0}.weekly-rule-grid>div{padding:12px;text-align:left;border:1px solid #755c8055;border-radius:9px;background:#251c32bb}.weekly-rule-grid b,.weekly-rule-grid span{display:block}.weekly-rule-grid b{color:#efbe85;font-size:11px}.weekly-rule-grid span{margin-top:7px;color:#c2afc9;font-size:10px;line-height:1.5}.weekly-seed,.weekly-personal-best,.weekly-friend-target{display:flex;flex-direction:column;gap:5px;margin:8px;padding:10px;color:#ffd08e}.weekly-personal-best b{font-size:28px}.weekly-team-row{display:grid;grid-template-columns:30px 1fr auto;text-align:left;gap:8px;padding:7px;border-top:1px solid #ffffff16;font-size:10px}.weekly-team-heading{color:#ffd08e}.weekly-share-actions{flex-wrap:wrap;margin:10px}.weekly-share-actions a{text-decoration:none}.overlay:has(.weekly-preflight),.overlay:has(.weekly-result){justify-content:flex-start}@media(max-width:850px){.weekly-rule-grid{grid-template-columns:1fr;gap:5px}.weekly-rule-grid>div{padding:8px}.weekly-preflight{padding:4px 0}.weekly-share-actions a,.weekly-share-actions button{min-height:42px}}`;document.head.appendChild(css);
try{const url=new URL(location.href),week=url.searchParams.get('candySprintV5'),target=Number(url.searchParams.get('target'));if(/^\d{4}-\d{2}-\d{2}$/.test(week||'')&&Number.isFinite(target)&&target>=0&&target<=100000000)friend={week,score:Math.floor(target)};legacyChallenge=!week&&(url.searchParams.has('candySprint')||url.searchParams.has('candySprintV2')||url.searchParams.has('candySprintV3')||url.searchParams.has('candySprintV4'));if(week||legacyChallenge||url.searchParams.has('broomSprint')){url.searchParams.delete('candySprintV5');url.searchParams.delete('candySprintV4');url.searchParams.delete('candySprintV3');url.searchParams.delete('candySprintV2');url.searchParams.delete('candySprint');url.searchParams.delete('broomSprint');url.searchParams.delete('target');history.replaceState(null,'',url.pathname+(url.searchParams.size?'?'+url.searchParams:'')+url.hash)}}catch{}
window.WeeklySprint={start,preflight,weekInfo,shareContent,courseRow,buildCourse,projectilePosition,scenePoint:worldPoint,sceneTheme:sceneryTheme,get active(){return active},get result(){return result},get config(){return config},get data(){return data},get course(){return course},get isResult(){return!!result&&state==='end'},get friend(){return friend}};
Journey.menu();if((friend&&friend.week===weekInfo().week)||legacyChallenge)setTimeout(preflight,0);
})();
