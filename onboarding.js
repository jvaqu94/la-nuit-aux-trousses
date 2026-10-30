/* Accueil allégé, aide illustrée et entraînement réellement interactif.
   Le laboratoire garantit l’isolation de la sauvegarde ; ce module ne change ni les
   collisions, ni les dégâts, ni les temporisations des vols normaux. */
(()=>{
'use strict';
const $=id=>document.getElementById(id),arena=document.querySelector('.arena');
const coarse=()=>matchMedia('(pointer:coarse)').matches;
let active=false,finished=false,requiredRun=false,stepIndex=0,exercise={},guidePage=0,guideReturn='menu';

function artSource(name){
 name=({'pickup-shield':'bonus-pickup-shield',heal:'bonus-heal'})[name]||name;
 return CollectibleArt?.art?.[name]?.src||MinuitArt?.[name]?.src||'';
}
function iconNode(name,extra=''){
 const wrap=document.createElement('span');wrap.className='lesson-icon '+extra;wrap.setAttribute('aria-hidden','true');
 if(name==='special'){
  wrap.classList.add('spell-icon');wrap.textContent='✦';return wrap;
 }
 const sourceName=name==='dodge'||name==='move'?'witch':name,src=artSource(sourceName);
 if(src){const img=document.createElement('img');img.src=src;img.alt='';wrap.appendChild(img)}
 if(name==='dodge'||name==='move'){const mark=document.createElement('b');mark.className='icon-mark';mark.textContent=name==='dodge'?'✦':'↔';wrap.appendChild(mark)}
 return wrap;
}

/* Une notification courte reste lisible, les suivantes attendent leur tour et les
   répétitions sont supprimées. Les alertes de boss restent prioritaires. */
let currentMessage=null,messageQueue=[];
const recentMessages=new Map(),urgent=/GARDIEN|CHAMPION|CHARGE|VEILLEUR/i;
function messageIcon(text,explicit){
 if(explicit)return explicit;
 for(const d of upgradeDefs)if(text.includes(d[2]))return 'bonus-'+d[0];
 if(/BONBON VIOLET/i.test(text))return 'xp';
 if(/BONBON DORÉ/i.test(text))return 'points';
 if(/BONBON TURQUOISE/i.test(text))return 'shield';
 if(/Bouclier spectral/i.test(text))return 'pickup-shield';
 if(/Vie récupérée|Vies au maximum|Vie du gardien/i.test(text))return 'heal';
 if(/ESQUIVE/i.test(text))return 'dodge';
 if(/TRIPLE TIR/i.test(text))return 'bonus-fire';
 if(/RELIQUAIRE|Trésor découvert|SCEAU/i.test(text))return 'chest';
 if(/VEILLEUR/i.test(text))return 'hunter';
 if(/TISSEUSES|TOILE/i.test(text))return 'spider';
 if(/MENEUR|PROTECTEUR/i.test(text))return 'lantern';
 if(/GARDIEN|CHARGE/i.test(text))return world?.kind||'pumpkin';
 if(/sort spécial|Onde améthyste|Marée céleste|Lance solaire/i.test(text))return 'special';
 return '';
}
function showMessage(message){
 currentMessage=message;toast=message.text;toastTime=message.duration;
 const root=$('toast'),card=document.createElement('div');card.className='toast-card';root.replaceChildren(card);
 const iconName=messageIcon(message.text,message.icon);if(iconName)card.appendChild(iconNode(iconName));
 const copy=document.createElement('span');copy.className='toast-copy';copy.textContent=message.text;card.appendChild(copy);
}
function clearMessages(){currentMessage=null;messageQueue=[];toast='';toastTime=0;$('toast').replaceChildren()}
say=function(text,time=2.8,icon=''){
 if(!text||active)return;
 text=String(text);const now=performance.now(),last=recentMessages.get(text)||-1e9,isUrgent=urgent.test(text);
 if(!isUrgent&&now-last<8000)return;recentMessages.set(text,now);
 if(recentMessages.size>60){const oldest=recentMessages.keys().next().value;recentMessages.delete(oldest)}
 const message={text,icon,urgent:isUrgent,duration:Math.max(2.8,Math.min(4.8,+time||0),Math.min(4.8,text.length/23))};
 if(currentMessage&&toastTime>0){
  if(message.urgent){messageQueue=messageQueue.filter(m=>m.urgent);showMessage(message)}
  else if(!messageQueue.some(m=>m.text===text)){if(messageQueue.length<2)messageQueue.push(message);else messageQueue[messageQueue.length-1]=message;}
 }else showMessage(message);
};

const steps=[
 {id:'move',icon:'move',title:'Pilote ton balai',
  text:()=>coarse()?'Glisse un doigt dans la zone de jeu. Le balai suit ton geste sans téléportation.':'Utilise les flèches ou ZQSD/WASD. Maintien Maj pour un déplacement de précision.',
  goal:'Déplace-toi dans la zone. Le tir vers les cibles est automatique.',success:'Pilotage compris · le tir est automatique.'},
 {id:'dodge',icon:'dodge',title:'Traverse un tir avec l’esquive',
  text:()=>coarse()?'Pilote avec un doigt et touche « Esquive » avec un autre au contact du projectile orange.':'Appuie sur Espace au contact du projectile orange. Le bond protège brièvement, puis doit se recharger.',
  goal:'Le halo et le bouton signalent le bon moment. Traverse le tir sans perdre de vie.',success:'Esquive réussie · tu as traversé le tir sans dégâts.'},
 {id:'dodgeStyles',icon:'dodge',title:'Compare les évolutions d’esquive',
  text:()=> 'Les balais modifient réellement le bond, la protection et la recharge. Déclenche une esquive avec Comète vive : après la fin complète de l’esquive, Aurore agile est sélectionnée automatiquement.',
  goal:'Déclenche une esquive avec Comète, puis une avec Aurore. Le passage à Aurore est automatique.',success:'Comète et Aurore essayées · chaque évolution a un avantage et un compromis.'},
 {id:'special',icon:'special',title:'Libère ton sort spécial',
  text:()=>coarse()?'Touche « Sort spécial ». L’onde blesse les cibles et dissipe les projectiles proches.':'Appuie sur F. L’onde blesse les cibles et dissipe les projectiles proches, puis doit se recharger.',
  goal:'Déclenche le sort au milieu des cibles et des projectiles.',success:'Sort spécial déclenché · les tirs proches ont été dissipés.'},
 {id:'attackStyles',icon:'special',title:'Compare les évolutions d’attaque',
  text:()=>coarse()?'Touche « Sort spécial » pour chaque attaque. Onde, Marée puis Lance s’enchaînent automatiquement après un court instant. En vol normal, le bouton utilise ton équipement.':'Dans cet exercice, appuie sur Espace pour déclencher chaque attaque. Onde, Marée puis Lance s’enchaînent automatiquement après un court instant. En vol normal, le sort spécial reste sur F.',
  goal:'Essaie les trois formes : Onde autour de toi, Marée devant toi, puis Lance en ligne étroite.',success:'Onde, Marée et Lance essayées · trois zones et trois compromis distincts.'},
 {id:'surprise',icon:'demon',title:'Réagis à une attaque surprise',
  text:()=> 'Une apparition ne blesse qu’après s’être matérialisée. Dès qu’elle surgit, sors rapidement de sa trajectoire ou utilise ton esquive. Elle réapparaîtra si tu te fais toucher.',
  goal:'Évite l’apparition jusqu’à sa disparition sans perdre de vie.',success:'Attaque surprise évitée · déplacement ou esquive au bon moment.'},
 {id:'chest',icon:'chest',title:'Brise les coffres et obstacles',
  text:()=> 'Le tir automatique détruit les caisses et les rochers. Ils libèrent ensuite des points, un bouclier ou une relique. Un reliquaire scellé demande, lui, de briser un rocher de la barricade avant son sceau.',
  goal:'Reste aligné avec la caisse pour la briser. Un coffre fermé ne se ramasse pas.',success:'Caisse brisée · le butin libéré peut maintenant être ramassé.'},
 {id:'relic',icon:'bonus-fragment',title:'Ramasse une relique',
  text:()=> 'Les reliques portent un nom, une couleur et un effet précis. Leur effet ne dure que pendant le vol. Celle-ci ajoute des éclats aux explosions de roquettes.',
  goal:'Rejoins la relique Fragmentation pour la ramasser.',success:'Fragmentation · chaque roquette libère 8 tirs en cercle.'},
 {id:'bonuses',icon:'bonus-fire',title:'Présentation des différents bonus',
  text:()=> 'Reliques d’arme, vies, points, boucliers et bonbons ont des effets distincts. Ouvre le catalogue illustré pour apprendre à les reconnaître avant de les ramasser.',
  goal:'Consulte la présentation complète des bonus, puis reviens à l’entraînement.',success:'Bonus présentés · tu sais distinguer améliorations de vol, score, vies et protection.'},
 {id:'shield',icon:'pickup-shield',title:'Utilise un bouclier spectral',
  text:()=> 'Le bouclier turquoise absorbe les dégâts pendant '+MINUIT_BALANCE.shield.duration+' secondes. Il ne remplace pas une vie : surveille ses deux jauges.',
  goal:'Rejoins le bouclier pour le ramasser.',success:'Bouclier actif · jauge de protection et durée visibles.'}
];
const attackProfiles=[
 {id:'pulse',name:'Onde améthyste',summary:`Autour de toi : rayon ${MINUIT_BALANCE.pulse.radius} · ${MINUIT_BALANCE.pulse.damage} dégâts · recharge ${MINUIT_BALANCE.pulse.cooldown} s.`},
 {id:'tidewave',name:'Marée spectrale',summary:'Devant toi : zone 340 × 340 · 4 dégâts · recul 70 · recharge 14 s.'},
 {id:'sunray',name:'Lance solaire',summary:'Ligne étroite : largeur 90 · 14 dégâts · recharge 18 s.'}
];
function makeTarget(x,y,hp=100){return{x,y,baseX:x,r:35,hp,max:hp,speed:0,fire:9999,age:0,pattern:9,tier:0,kind:'pumpkin',boss:false,dead:false,poison:0,poisonTick:0,hit:0}}
function makeBullet(x,y,vx=0,vy=0,speed=0){return{x,y,vx,vy,speed,r:10,life:20,type:'fire',damage:25,grazed:false,homing:false,lockRemaining:0,age:0}}
function prepareAttack(index){
 const profile=attackProfiles[index];if(!profile)return;
 enemies=[];hostile=[];shots=[];rockets=[];obstacles=[];player.x=400;player.y=780;player.vx=0;player.vy=0;player.inv=1;player.fire=0;
 Arsenal.active.spell=profile.id;Arsenal.active.cooldown=0;exercise.attackWait=0;
 if(profile.id==='pulse'){
  enemies=[makeTarget(320,690,500),makeTarget(480,690,500)];
  for(let i=0;i<8;i++){const a=i*Math.PI/4;hostile.push(makeBullet(400+Math.cos(a)*120,780+Math.sin(a)*120))}
 }else if(profile.id==='tidewave'){
  enemies=[makeTarget(400,560,500),makeTarget(510,590,500)];
  hostile=[makeBullet(350,600),makeBullet(450,600),makeBullet(690,600)];
 }else{
  enemies=[makeTarget(400,540,500),makeTarget(620,540,500)];
  hostile=[makeBullet(400,610),makeBullet(620,610)];
 }
}
function setupStep(index){
 if(!active)return;stepIndex=index;const step=steps[index];
 enemies=[];hostile=[];shots=[];rockets=[];drops=[];obstacles=[];hazards=[];gates=[];scares=[];particles=[];
 transition=0;transitionBoss=false;waveTime=0;spawnIndex=0;schedule=[{time:99999}];obstacleTimer=99999;
 player.x=400;player.y=780;player.vx=0;player.vy=0;player.inv=1;player.dash=0;player.dashCD=0;player.shield=0;player.shieldTime=0;player.fire=0;
 if(Arsenal.active){Arsenal.active.cooldown=0;Arsenal.active.petCooldown=0;Arsenal.active.broom='bruyere';Arsenal.active.spell='pulse'}
 exercise={done:false,wait:.75,distance:0,lastX:player.x,lastY:player.y,tried:[],dashReady:true,switchWait:0,attackWait:0,spawned:false,hits:0,chest:null};
 if(step.id==='move')enemies=[makeTarget(400,330,500)];
 if(step.id==='dodgeStyles')Arsenal.active.broom='comet-flight';
 if(step.id==='special'){
  enemies=[makeTarget(330,650,80),makeTarget(470,650,80)];
  for(let i=0;i<8;i++){const a=i*Math.PI/4;hostile.push(makeBullet(400+Math.cos(a)*120,780+Math.sin(a)*120))}
 }
 if(step.id==='attackStyles')prepareAttack(0);
 if(step.id==='chest')exercise.chest=spawnObstacle(400,570,{kind:'crate',r:25,breakable:true,hp:3,max:3,age:2,warn:0,loot:'points'});
 if(step.id==='relic')drops=[{x:400,y:560,kind:'upgrade',key:'fragment',age:0}];
 if(step.id==='shield')drops=[{x:400,y:560,kind:'shield',age:0}];
 CombatFeel.reset();clearMessages();renderStep();
}
function goalText(step){
 if(exercise.done)return '✓ '+step.success;
 if(step.id==='dodgeStyles'&&exercise.tried?.length){
  if(exercise.switchWait>0)return '✓ Comète validée. Fin de l’esquive, puis passage automatique à Aurore…';
  const names={'comet-flight':'Comète','aurora-flight':'Aurore'},done=exercise.tried.map(id=>names[id]).join(' et '),remaining=['comet-flight','aurora-flight'].filter(id=>!exercise.tried.includes(id)).map(id=>names[id]).join(' puis ');return '✓ '+done+' essayée. Encore : '+remaining+'.';
 }
 if(step.id==='attackStyles'&&exercise.tried?.length){
  const done=exercise.tried.map(id=>attackProfiles.find(profile=>profile.id===id)?.name).filter(Boolean).join(' · '),next=attackProfiles[exercise.tried.length];
  if(exercise.attackWait>0)return '✓ '+done+(next?' · attaque suivante automatique…':'');
  if(next)return '✓ '+done+'. '+(coarse()?'Touche « Sort spécial »':'Espace')+' pour '+next.name+'.';
 }
 return step.goal;
}
function renderStep(){
 const step=steps[stepIndex],card=$('trainingCard');card.classList.remove('hidden');card.dataset.step=step.id;
 $('trainingProgress').textContent=(requiredRun?'ENTRAÎNEMENT OBLIGATOIRE · ':'ENTRAÎNEMENT GUIDÉ · ')+(stepIndex+1)+' / '+steps.length;
 $('trainingTitle').textContent=step.title;$('trainingText').textContent=step.text();
 $('trainingGoal').textContent=goalText(step);$('trainingGoal').classList.toggle('done',!!exercise.done);
 const art=$('trainingIcon');art.replaceChildren(iconNode(step.icon));
 $('trainingNext').disabled=!exercise.done;$('trainingNext').textContent=stepIndex===steps.length-1?'Terminer':'Suivant';
 $('trainingSkip').classList.toggle('hidden',requiredRun);$('trainingQuit').classList.toggle('hidden',requiredRun);
 renderDetails();
}
function renderDetails(){
 const root=$('trainingDetails');if(!root)return;root.replaceChildren();const step=steps[stepIndex];
 if(step.id==='dodgeStyles'){
  const note=document.createElement('div');note.className='training-profile-note';note.textContent='Bruyère validée : bond 0,32 s · protection 0,45 s · recharge 4 s.';root.appendChild(note);
  const profiles=[{id:'comet-flight',name:'Comète vive',summary:'Bond 0,38 s · protection 0,50 s · recharge 5 s · vitesse +12 %.'},{id:'aurora-flight',name:'Aurore agile',summary:'Bond 0,26 s · protection 0,38 s · recharge 3,2 s · vitesse réduite.'}];
  for(const profile of profiles){
   const button=document.createElement('button'),locked=profile.id==='aurora-flight'&&!exercise.tried.includes('comet-flight');button.type='button';button.className='training-profile'+(Arsenal.active?.broom===profile.id?' selected':'');button.dataset.trainingBroom=profile.id;button.disabled=!!exercise.done||exercise.switchWait>0||exercise.tried?.includes(profile.id)||locked;
   const title=document.createElement('b');title.textContent=(exercise.tried?.includes(profile.id)?'✓ ':'')+profile.name;const small=document.createElement('small');small.textContent=profile.summary;button.append(title,small);
   button.onclick=()=>{if(exercise.done||exercise.switchWait>0||exercise.tried.includes(profile.id)||profile.id==='aurora-flight'&&!exercise.tried.includes('comet-flight'))return;exercise.switchWait=0;Arsenal.active.broom=profile.id;player.dash=0;player.dashCD=0;player.inv=0;exercise.dashReady=true;CombatFeel.reset();renderStep()};root.appendChild(button);
  }
  const live=document.createElement('div');live.className='training-profile-live';live.textContent='Balai actuel : '+Arsenal.dashDuration().toFixed(2).replace('.',',')+' s de bond · '+Arsenal.dashInv().toFixed(2).replace('.',',')+' s de protection · '+Arsenal.dashCooldown().toFixed(1).replace('.',',')+' s de recharge.';root.appendChild(live);
 }
 if(step.id==='attackStyles'){
  for(const profile of attackProfiles){
   const current=Arsenal.active?.spell===profile.id,row=document.createElement('div');row.className='training-profile attack-profile'+(current?' selected':'');row.dataset.trainingAttack=profile.id;
   const title=document.createElement('b');title.textContent=(exercise.tried?.includes(profile.id)?'✓ ':current?'→ ':'')+profile.name;const small=document.createElement('small');small.textContent=profile.summary;row.append(title,small);root.appendChild(row);
  }
 }
 if(step.id==='bonuses'){const button=document.createElement('button');button.type='button';button.id='trainingBonusGallery';button.className='secondary';button.textContent=exercise.done?'✓ Catalogue consulté':'Ouvrir le catalogue illustré';button.disabled=!!exercise.done;button.onclick=showBonusGallery;root.appendChild(button)}
}
function completeStep(){if(exercise.done)return;exercise.done=true;renderStep();tone(760,.16,'sine',.045,1.3)}
function tickTraining(dt,before){
 if(exercise.done)return;const id=steps[stepIndex].id;
 exercise.distance+=Math.hypot(player.x-before.x,player.y-before.y);
 if(id==='move'&&exercise.distance>=130)completeStep();
 if(id==='dodge'){
  if(CombatFeel.success){hostile=[];completeStep();return}
  if(!hostile.length){exercise.wait-=dt;if(exercise.wait<=0){hostile=[makeBullet(player.x,player.y-310,0,155,155)];exercise.wait=1}}
 }
 if(id==='dodgeStyles'){
  if(exercise.switchWait>0){
   exercise.switchWait-=dt;
   if(exercise.switchWait<=0){exercise.switchWait=0;Arsenal.active.broom='aurora-flight';player.dash=0;player.dashCD=0;player.inv=0;exercise.dashReady=true;CombatFeel.reset();renderStep()}
   return;
  }
  if(player.dashCD<=0)exercise.dashReady=true;
  else if(exercise.dashReady){
   exercise.dashReady=false;const broom=Arsenal.active?.broom;
   if(['comet-flight','aurora-flight'].includes(broom)&&!exercise.tried.includes(broom)){
    exercise.tried.push(broom);if(broom==='comet-flight'&&!exercise.tried.includes('aurora-flight'))exercise.switchWait=Math.max(Arsenal.dashDuration(),Arsenal.dashInv());renderStep();
   }
   if(exercise.tried.length===2)completeStep();
  }
 }
 if(id==='special'&&Arsenal.active?.cooldown>0)completeStep();
 if(id==='attackStyles'){
  if(exercise.attackWait>0){
   exercise.attackWait-=dt;
   if(exercise.attackWait<=0){exercise.attackWait=0;if(exercise.tried.length>=attackProfiles.length)completeStep();else{prepareAttack(exercise.tried.length);renderStep()}}
   return;
  }
  const spell=Arsenal.active?.spell;
  if(Arsenal.active?.cooldown>0&&attackProfiles.some(profile=>profile.id===spell)&&!exercise.tried.includes(spell)){exercise.tried.push(spell);exercise.attackWait=.8;renderStep()}
 }
 if(id==='surprise'){
  if(!exercise.spawned){exercise.wait-=dt;if(exercise.wait<=0){Surprise.spawn();exercise.spawned=true;exercise.hits=Adventure.lab?.hits||0}}
  else if(!scares.length){if((Adventure.lab?.hits||0)===exercise.hits)completeStep();else{exercise.spawned=false;exercise.wait=.75}}
 }
 if(id==='chest'&&exercise.chest?.dead)completeStep();
 if((id==='relic'||id==='shield')&&!drops.length){exercise.wait-=dt;if(exercise.wait<=0){drops=[{x:400,y:560,kind:id==='relic'?'upgrade':'shield',key:id==='relic'?'fragment':undefined,age:0}];exercise.wait=1}}
 if(id==='relic'&&upgrades.fragment>0)completeStep();
 if(id==='shield'&&player.shield>0)completeStep();
}
function nextStep(){if(!active)return;if(stepIndex<steps.length-1)setupStep(stepIndex+1);else finishTraining()}
function finishTraining(){
 Adventure.completeGuided();finished=true;state='training-complete';$('trainingCard').classList.add('hidden');clearMessages();
 overlay(`<section class="training-finish"><div class="menu-kicker">ENTRAÎNEMENT TERMINÉ</div><h2>Tu es prête pour la nuit</h2><div class="guide-art finish-art" id="finishArt"></div><p>Pilotage, esquives et leurs évolutions, sort spécial et ses trois formes, attaque surprise, coffres, reliques, bonus et bouclier : les ${steps.length} exercices sont terminés.</p><p class="tiny">L’aventure et les défis sont maintenant débloqués. En vol normal, aucune consigne automatique ne viendra couvrir le combat. Le guide et l’entraînement restent disponibles dans le menu.</p><div class="training-finish-actions"><button class="primary" id="trainingPlay">Commencer l’aventure</button><button class="secondary" id="trainingAgain">Refaire les exercices</button><button class="secondary" id="trainingMenu">Retour au menu</button></div></section>`);
 $('finishArt').append(iconNode('move'),iconNode('dodge'),iconNode('demon'),iconNode('chest'),iconNode('bonus-fire'),iconNode('pickup-shield'));
 $('trainingPlay').onclick=()=>{exitTraining();LocalLeague.play()};
 $('trainingAgain').onclick=()=>{requiredRun=false;state='play';hideOverlay();setupStep(0)};
 $('trainingMenu').onclick=exitTraining;
}
function startTraining(){
 if(active)return;active=true;finished=false;requiredRun=!Journey.state.trainingDone;
 try{Adventure.startGuided()}catch(error){active=false;requiredRun=false;throw error}
 document.body.classList.add('guided-training');$('modeLabel').textContent=(requiredRun?'Entraînement obligatoire':'Entraînement guidé')+' · sans score ni récompense';$('labTools').classList.add('hidden');$('adventureStatus').classList.add('hidden');setupStep(0);
}
function exitTraining(){
 if(!active)return;active=false;requiredRun=false;document.body.classList.remove('guided-training');$('trainingCard').classList.add('hidden');clearMessages();
 if(Adventure.training)Adventure.exitLab();else LocalLeague.menu();
}
arena.insertAdjacentHTML('beforeend',`<section class="training-card hidden" id="trainingCard" aria-label="Exercice d’entraînement"><div id="trainingIcon" class="training-icon"></div><div class="training-copy"><div class="menu-kicker" id="trainingProgress"></div><h3 id="trainingTitle"></h3><p id="trainingText"></p><p class="training-goal" id="trainingGoal"></p><div class="training-details" id="trainingDetails"></div></div><div class="training-nav"><button class="primary" id="trainingNext" disabled>Suivant</button><button class="secondary" id="trainingSkip">Passer</button><button class="secondary" id="trainingQuit">Quitter</button></div></section>`);
$('trainingNext').onclick=nextStep;$('trainingSkip').onclick=()=>{if(!requiredRun)nextStep()};$('trainingQuit').onclick=()=>{if(!requiredRun)exitTraining()};
window.addEventListener('keydown',event=>{
 if(!active||state!=='play'||steps[stepIndex]?.id!=='attackStyles'||(event.key!==' '&&event.code!=='Space'))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(event.repeat||exercise.done||exercise.attackWait>0||Arsenal.active?.cooldown>0)return;
 Arsenal.cast();
},true);
const trainingPause=pauseScreen;pauseScreen=function(){trainingPause();if(active&&requiredRun&&$('quit')){$('quit').disabled=true;$('quit').textContent='Termine l’entraînement pour continuer';$('quit').title='Le premier entraînement est obligatoire.'}};

function showBonusGallery(){
 if(!active||steps[stepIndex].id!=='bonuses')return;state='training-bonus';$('trainingCard').classList.add('hidden');
 const relics=upgradeDefs.map(d=>({icon:'bonus-'+d[0],name:d[2],text:d[3]+' Rang maximum : '+d[4]+'.'}));
 const immediate=[
  {icon:'bonus-pickup-shield',name:'Bouclier spectral',text:'100 points de protection pendant '+MINUIT_BALANCE.shield.duration+' s. Les dégâts vident sa jauge avant les vies.'},
  {icon:'bonus-heal',name:'Cœur de soin',text:'Rend une vie, ou accorde 250 points si toutes les vies sont déjà présentes.'},
  {icon:'bonus-points',name:'Trésor',text:'Ajoute immédiatement les points indiqués au score du vol.'},
  {icon:'bonus-candy',name:'Triple tir',text:'Trois projectiles à chaque tir pendant '+MINUIT_BALANCE.tripleShot.duration+' s.'},
  {icon:'xp',name:'Bonbon violet',text:'Ajoute de l’expérience de collection persistante, sans augmenter la puissance.'},
  {icon:'points',name:'Bonbon doré',text:'Ajoute les points indiqués au score du vol.'},
  {icon:'shield',name:'Bonbon turquoise',text:'Recharge le bouclier à 50 points pendant '+MINUIT_BALANCE.shield.candyDuration+' s.'}
 ];
 const card=item=>`<article class="training-bonus-item"><span class="training-bonus-art" data-bonus-art="${item.icon}"></span><div><b>${safeText(item.name)}</b><p>${safeText(item.text)}</p></div></article>`;
 overlay(`<section class="training-bonus-gallery"><div class="menu-kicker">PRÉSENTATION DES BONUS</div><h2>Reconnaître chaque récompense</h2><p>Les reliques améliorent les armes pendant le vol actuel. Les autres bonus donnent une protection, une vie, des points ou de l’expérience selon leur icône.</p><h3>Reliques d’arme</h3><div class="training-bonus-grid">${relics.map(card).join('')}</div><h3>Bonus immédiats et bonbons</h3><div class="training-bonus-grid">${immediate.map(card).join('')}</div><button class="primary" id="bonusGalleryBack">J’ai compris · revenir à l’entraînement</button></section>`);
 document.querySelectorAll('[data-bonus-art]').forEach(node=>node.appendChild(iconNode(node.dataset.bonusArt)));
 $('bonusGalleryBack').onclick=()=>{state='play';hideOverlay();$('trainingCard').classList.remove('hidden');completeStep()};
}

const guidePages=[
 {icon:'move',title:'Pilotage et tir automatique',text:()=>coarse()?'Glisse dans la zone de jeu pour piloter. Le second doigt reste libre pour l’esquive et le sort spécial.':'Flèches ou ZQSD/WASD pour piloter ; Maj pour la précision. Le tir est automatique.',notes:['Le balai ne se téléporte pas au doigt.','Les cibles sont touchées par les projectiles violets.']},
 {icon:'dodge',title:'Esquive : traverser sans dégâts',text:()=>coarse()?'Touche « Esquive » au contact d’un tir avec un second doigt.':'Appuie sur Espace au contact d’un tir.',notes:['0,45 seconde d’invulnérabilité.','4 secondes de recharge. Maj ne rend pas invulnérable.']},
 {icon:'special',title:'Sort spécial et recharge',text:()=>coarse()?'Le bouton « Sort spécial » déclenche l’équipement choisi dans Préparer mon vol.':'La touche F déclenche l’équipement choisi dans Préparer mon vol.',notes:['L’Onde améthyste blesse autour de toi et dissipe les tirs proches.','La Marée attaque devant toi et repousse ; la Lance solaire frappe une ligne étroite plus fortement.','La jauge du bouton indique la recharge ; aucun sort ne change la difficulté des ennemis.']},
 {icons:['bonus-rocket','bonus-fragment','bonus-familiar'],title:'Reliques : image, nom et effet',text:()=> 'Ramasse les reliques sur le terrain. Leur illustration et leur nom permettent de les reconnaître avant et après le ramassage.',notes:[`Roquettes : missiles guidés pendant ${MINUIT_BALANCE.missiles.duration} secondes.`,'Fragmentation : chaque roquette libère 8 tirs en cercle.','Familier lunaire : un compagnon tire à tes côtés.']},
 {icons:['pickup-shield','xp','points','shield'],title:'Bouclier et bonbons',text:()=> 'Le bouclier spectral absorbe les dégâts pendant '+MINUIT_BALANCE.shield.duration+' secondes. Les bonbons ont des couleurs et des emblèmes distincts.',notes:['Violet : expérience de collection.','Doré : points. Turquoise : recharge de bouclier.','Le bouclier ne rend pas invulnérable et ne remplace pas une vie.']},
 {icons:['pumpkin','hunter','spider'],title:'Créatures et attaques',text:()=> 'Chaque silhouette annonce un comportement. Les champions affichent leur nom et leur attaque ; les gardiens télégraphient leurs charges.',notes:['Les toiles ralentissent, les projectiles orange font perdre une vie.','Les reliquaires scellés sont facultatifs : aucun passage ne dépend de leur ouverture.']}
];
function renderGuide(){
 const page=guidePages[guidePage],icons=page.icons||[page.icon];
 overlay(`<section class="guide-card"><div class="menu-kicker">GUIDE ILLUSTRÉ · ${guidePage+1} / ${guidePages.length}</div><h2>${safeText(page.title)}</h2><div class="guide-art" id="guideArt"></div><p>${safeText(page.text())}</p><ul class="guide-notes">${page.notes.map(n=>'<li>'+safeText(n)+'</li>').join('')}</ul><div class="guide-nav"><button class="secondary" id="guidePrev" ${guidePage===0?'disabled':''}>Précédent</button><button class="primary" id="guideNext">${guidePage===guidePages.length-1?'Terminer':'Suivant'}</button><button class="secondary" id="guideBack">Retour</button></div></section>`);
 const art=$('guideArt');for(const name of icons)art.appendChild(iconNode(name));
 $('guidePrev').onclick=()=>{if(guidePage>0){guidePage--;renderGuide()}};
 $('guideNext').onclick=()=>{if(guidePage<guidePages.length-1){guidePage++;renderGuide()}else closeGuide()};$('guideBack').onclick=closeGuide;
}
function openGuide(returnTo='menu'){guideReturn=returnTo;guidePage=0;state='help';clearMessages();renderGuide()}
function closeGuide(){if(guideReturn==='settings')settings();else LocalLeague.menu()}
function applyRequirement(){
 if(Journey.state.trainingDone||!$('playAdventure'))return;
 const play=$('playAdventure');play.innerHTML='<span class="button-icon">⌁</span>Entraînement obligatoire';play.onclick=()=>{activateAudio();startTraining()};$('startGuided')?.classList.add('hidden');
 let note=$('trainingRequiredNote');const route=document.querySelector('.home-world-route');
 if(!note&&route){route.id='trainingRequiredNote';route.className='training-required-note home-required-note';note=route}
 if(!note){document.querySelector('.menu-primary')?.insertAdjacentHTML('afterend','<div class="training-required-note" id="trainingRequiredNote"></div>');note=$('trainingRequiredNote')}
 if(note)note.innerHTML='<b>Première connexion</b> · '+steps.length+' exercices obligatoires avant de jouer. Sans score ni récompense.';
 for(const id of ['localResume','localRanked','localDaily','prepareFlight','labMenu','weeklySprint'])if($(id)){$(id).disabled=true;$(id).title='Termine d’abord l’entraînement obligatoire.';$(id).setAttribute('aria-describedby','trainingRequiredNote')}
}

/* Tous les réglages restent accessibles, mais les deux décisions principales et les
   catégories sont immédiatement identifiables. Les IDs d’origine sont conservés. */
const previousMenu=Journey.menu;
Journey.menu=function(){
 document.body.classList.add('menu-open');
 previousMenu();if(state!=='league-menu'||Adventure.training)return;
 const ids=['playAdventure','localResume','localRanked','localDaily','prepareFlight','wardrobe','masteryMenu','archives','localSettings','labMenu'],actions={};
 for(const id of ids)if($(id))actions[id]=$(id).onclick;
 clearMessages();const level=Math.floor(Math.sqrt(Math.max(0,Journey.state.xp)/120))+1,finishedLabel=finished?'Revoir l’entraînement':'S’entraîner';
 const button=(id,label,icon)=>`<button class="secondary menu-card-button" id="${id}"><span class="menu-card-icon">${icon}</span><span>${label}</span></button>`;
 overlay(`<main class="main-menu redesigned-menu"><section class="menu-hero-card"><div class="menu-visual" id="menuVisual"></div><div class="menu-copy"><div class="menu-kicker">UN VOL ARCADE · MINUIT → AUBE</div><h1>La Nuit<br>aux Trousses</h1><p>Traverse cinq univers peints, améliore tes sorts et affronte les gardiens de l’aube.</p><div class="menu-primary"><button class="primary" id="playAdventure"><span class="button-icon">✦</span>Jouer maintenant</button><button class="secondary training-entry" id="startGuided"><span class="button-icon">⌁</span>${finishedLabel}<small>${steps.length} exercices · sans score ni progression</small></button></div>${actions.localResume?'<button class="secondary resume-button" id="localResume">↻ Reprendre le vol sauvegardé</button>':''}</div></section><section class="menu-status"><div><b>NIVEAU ${level}</b><span>${Journey.state.xp} XP · ${Journey.state.achievements.length} succès</span></div><span class="menu-audio-note">♪ Le premier clic lance la musique</span></section><section class="menu-group"><h2>TON VOL</h2><div class="menu-grid three">${button('prepareFlight','Préparer mon vol','✦')}${button('wardrobe','Collection','◇')}${button('masteryMenu','Exploits & variantes','★')}</div></section><section class="menu-group"><h2>DÉFIS & SAUVEGARDE</h2><div class="menu-grid">${button('localRanked','Partie classée','◆')}${button('localDaily','Défi du jour','☾')}${button('archives','Sauvegarde & partage','↗')}${button('labMenu','Laboratoire libre','⚗')}</div></section><div class="menu-bottom"><button class="secondary" id="localHelp">? Guide illustré</button><button class="secondary" id="localSettings">⚙ Réglages</button></div></main>`);
 const visual=$('menuVisual');for(const icon of ['pumpkin','spell','lantern'])visual.appendChild(iconNode(icon));
 for(const [id,handler]of Object.entries(actions))if($(id)&&handler)$(id).onclick=id==='playAdventure'?()=>{activateAudio();handler()}:handler;
 $('startGuided').onclick=()=>{activateAudio();startTraining()};$('localHelp').onclick=()=>openGuide('menu');
 applyRequirement();
};

const previousUpdate=update;update=function(dt){
 const before={x:player.x,y:player.y};previousUpdate(dt);
 if(currentMessage&&toastTime<=0){currentMessage=null;if(messageQueue.length)showMessage(messageQueue.shift());else{toast='';$('toast').replaceChildren()}}
 if(active&&state==='play')tickTraining(dt,before);
};
window.GuidedTraining={start:startTraining,exit:exitTraining,openGuide,applyRequirement,required:()=>!Journey.state.trainingDone,stepCount:steps.length,get active(){return active},get finished(){return finished},get step(){return active?steps[stepIndex].id:null},get stepIndex(){return stepIndex},get exerciseDone(){return!!exercise.done},get showProjectileCue(){return active&&state==='play'&&steps[stepIndex]?.id==='dodge'&&!exercise.done},showCoach:false};

const style=document.createElement('style');style.textContent=`
body.menu-open>header,body.menu-open main .heading,body.menu-open .sidebar,body.menu-open .touchbar,body.menu-open>.footer{display:none!important}body.menu-open main{padding-top:0}body.menu-open .layout{display:block}body.menu-open .arena{height:min(900px,100vh);min-height:620px;border-radius:0;box-shadow:none}#menuVisual{display:flex;align-items:center;justify-content:center;gap:4px;min-height:170px;border:1px solid #b88cc055;border-radius:16px;background:radial-gradient(circle at 50% 42%,#8f5a7650,#1a1229 68%);box-shadow:inset 0 0 36px #d4936c18;overflow:hidden}#menuVisual .lesson-icon{width:78px;height:78px;transform:translateY(7px)}#menuVisual .lesson-icon:first-child{width:105px;height:105px;z-index:2}#menuVisual .lesson-icon:last-child{width:64px;height:64px;opacity:.75}.redesigned-menu{max-width:760px!important}.menu-hero-card{display:grid;grid-template-columns:210px 1fr;gap:20px;align-items:center;padding:18px;border:1px solid #a57db455;border-radius:18px;background:linear-gradient(145deg,#21172fe8,#100d1be8);box-shadow:0 18px 70px #05030ccc}.menu-copy{text-align:left}.menu-copy h1{font-family:Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:.92;margin:5px 0 12px;color:#fff0e1}.menu-copy p{font-size:12px;line-height:1.6;color:#c9bad5;margin:0 0 14px}.button-icon{margin-right:6px;color:#ffd08b}.menu-primary{display:grid;grid-template-columns:1.35fr 1fr;gap:8px}.menu-primary>button{min-height:52px;margin:0}.menu-primary .primary{font-size:14px}.training-entry{font-size:10px;border-color:#b99bd4}.training-entry small{display:block;font-size:8px;margin-top:4px;color:#cfc0d9}.resume-button{margin-top:8px;width:100%;font-size:10px}.menu-status{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:13px 3px 3px;color:#cbb5d8;font-size:10px}.menu-status b{color:#f0d49c;margin-right:10px}.menu-audio-note{color:#e8be87}.redesigned-menu .menu-group{margin-top:12px;padding-top:12px;border-top:1px solid #76608055}.redesigned-menu .menu-group h2{font-size:10px;letter-spacing:1.5px;color:#e6d4ee;margin:0 0 7px}.redesigned-menu .menu-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px}.redesigned-menu .menu-grid.three{grid-template-columns:repeat(3,1fr)}.menu-card-button{display:flex;align-items:center;gap:8px;min-height:42px;margin:0;padding:9px;text-align:left;background:#2a2038}.menu-card-icon{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:#4a3157;color:#ffd08b;font-size:15px}.menu-bottom{display:flex;justify-content:center;gap:8px;margin-top:12px}.menu-bottom button{margin:0;font-size:10px}@media(max-width:650px){.menu-hero-card{grid-template-columns:1fr;gap:10px;padding:13px}.menu-copy{text-align:center}.menu-copy h1{font-size:36px}.menu-copy p{font-size:11px}.menu-primary{grid-template-columns:1fr 1fr}.menu-status{align-items:flex-start;flex-direction:column;gap:5px}.redesigned-menu .menu-grid.three{grid-template-columns:1fr 1fr}.redesigned-menu .menu-grid.three .menu-card-button:last-child{grid-column:1/-1}.menu-bottom{justify-content:stretch}.menu-bottom button{flex:1}}#toast{max-width:min(92%,650px)}.toast-card{display:flex;align-items:center;justify-content:center;gap:10px;line-height:1.45}.toast-copy{display:block}.toast-card .lesson-icon{width:46px;height:46px;flex:0 0 46px}.lesson-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;width:74px;height:74px;flex:0 0 auto}.lesson-icon img{display:block;width:100%;height:100%;object-fit:contain}.lesson-icon .icon-mark{position:absolute;right:-2px;bottom:0;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#302342;border:2px solid #e4d4ff;color:#fff;font-size:18px;box-shadow:0 0 16px #b89cff88}.spell-icon{border-radius:50%;color:#fff4ff;font-size:38px;background:radial-gradient(circle at 35% 30%,#f7e5ff 0 5%,#c598ff 12%,#7847bc 35%,#2b1b48 68%);border:2px solid #dbc1ff;box-shadow:0 0 24px #ad7bff77,inset 0 0 15px #fff5}.overlay:has(.main-menu){justify-content:flex-start;padding:20px 14px;overflow-y:auto}.main-menu{width:100%;max-width:610px;margin:auto;text-align:left}.menu-heading{display:block;height:auto;padding:0;border:0;text-align:center}.menu-heading h1{font-size:29px;line-height:1.05;margin:5px 0 8px}.menu-heading p{font-size:11px;line-height:1.5;margin:0 auto 15px;max-width:440px}.menu-kicker{font-size:8px;letter-spacing:2px;color:#d0b6df;text-transform:uppercase}.menu-primary{display:grid;grid-template-columns:1fr 1.35fr;gap:9px}.menu-primary>button{min-height:54px;margin:0}.menu-primary>button:first-child{font-size:17px}.training-entry{border-color:#b99bd4}.training-entry small{display:block;font-size:8px;font-weight:400;letter-spacing:.2px;margin-top:4px}.main-menu>#localResume{width:100%;margin-top:9px;border-color:#c3a6dc}.menu-progress{display:flex;justify-content:space-between;gap:12px;margin:13px 2px 4px;color:#cbb5d8;font-size:10px}.menu-progress b{color:#f0d49c}.menu-group{margin-top:12px;padding-top:10px;border-top:1px solid #76608055}.menu-group h2{font-size:10px;letter-spacing:1.2px;color:#e6d4ee;margin:0 0 7px}.menu-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.menu-grid.three{grid-template-columns:repeat(3,1fr)}.menu-grid button{min-height:35px;margin:0;padding:7px 9px;font-size:10px;text-align:left;background:#2a2038}.training-card{position:absolute;z-index:7;left:12px;right:12px;top:104px;display:grid;grid-template-columns:66px 1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid #b99bd4;border-radius:14px;background:linear-gradient(135deg,#241b35f5,#161224f5);box-shadow:0 8px 35px #090612aa;pointer-events:auto}.training-card h3{font-size:15px;color:#fff0ff;margin:3px 0}.training-card p{font-size:10px;line-height:1.45;margin:3px 0;color:#d8c8e4}.training-card .training-goal{color:#f1d7a2}.training-card .training-goal.done{color:#a9f1d7}.training-icon .lesson-icon{width:64px;height:64px}.training-nav{display:flex;flex-direction:column;gap:5px}.training-nav button{font-size:9px;padding:7px 10px;margin:0;min-width:76px}.training-nav button:disabled{opacity:.4}.guided-training .hud>div:first-child{visibility:hidden}.guided-training #labTools,.guided-training #adventureStatus,.guided-training #journeyTutor,.guided-training #dodgeCoach,.guided-training #questHUD,.guided-training #toast{display:none!important}.guide-card,.training-finish{width:100%;max-width:590px;text-align:center;margin:auto}.guide-card h2,.training-finish h2{font-size:23px;margin:8px 0;color:#f1e2fa}.guide-card>p,.training-finish>p{font-size:12px;line-height:1.6;color:#d9c9e4}.guide-art{display:flex;align-items:center;justify-content:center;gap:12px;min-height:100px;margin:10px 0}.guide-art .lesson-icon{width:90px;height:90px}.guide-notes{text-align:left;max-width:510px;margin:12px auto 18px;padding-left:22px;color:#cdbbda;font-size:11px;line-height:1.65}.guide-nav,.training-finish-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:8px}.guide-nav button,.training-finish-actions button{margin:0;padding:10px 16px}.finish-art .lesson-icon{width:64px;height:64px}@media(max-width:850px){.overlay:has(.main-menu){padding:14px 10px}.menu-heading h1{font-size:25px}.menu-heading p{font-size:10px;margin-bottom:11px}.menu-primary>button{min-height:50px}.menu-grid.three{grid-template-columns:1fr 1fr}.menu-grid.three button:last-child{grid-column:1/-1}.training-card{top:96px;grid-template-columns:52px 1fr;gap:8px;padding:9px}.training-icon .lesson-icon{width:50px;height:50px}.training-card h3{font-size:13px}.training-card p{font-size:10px}.training-nav{grid-column:1/-1;flex-direction:row;justify-content:flex-end}.training-nav button{min-width:0;flex:1;padding:6px}.toast-card .lesson-icon{width:40px;height:40px;flex-basis:40px}.toast-card{gap:7px}.guide-art .lesson-icon{width:72px;height:72px}.guide-card h2{font-size:20px}}@media(max-height:500px){.training-card{top:68px;padding:6px;grid-template-columns:42px 1fr auto}.training-card p{font-size:8px}.training-card h3{font-size:11px}.training-nav{grid-column:auto;flex-direction:column}.training-icon .lesson-icon{width:40px;height:40px}.menu-heading p{display:none}.menu-group{margin-top:7px;padding-top:6px}.menu-progress{margin-top:8px}}
`;
style.textContent+=`
.training-required-note{margin-top:9px;padding:9px 11px;border:1px solid #d0a16877;border-radius:9px;background:#4b302888;color:#f0d5a7;font-size:10px;line-height:1.5}.training-required-note b{color:#ffe3b4}.home-required-note{margin:0 0 10px}.main-menu button:disabled{opacity:.48;cursor:not-allowed}.training-details{display:grid;gap:5px;margin-top:7px}.training-profile-note,.training-profile-live{color:#c9b5d7;font-size:8px;line-height:1.4}.training-profile-live{color:#f0d49c}.training-profile{display:grid;gap:2px;padding:6px 8px;border:1px solid #765888;border-radius:7px;background:#2b213b;color:#eadcf2;text-align:left}.training-profile.selected{border-color:#b9e5ef;background:#303048}.training-profile b{font-size:9px}.training-profile small{font-size:8px;line-height:1.35;color:#cdbbd8}#trainingBonusGallery{margin:2px 0 0;padding:7px 9px;font-size:9px}.training-bonus-gallery{width:min(920px,100%);margin:auto;text-align:left}.training-bonus-gallery>h2{margin:7px 0;color:#f2e2fa;font-size:25px;text-align:center}.training-bonus-gallery>h3{margin:15px 0 7px;color:#edc990;font-size:12px;letter-spacing:1px}.training-bonus-gallery>p{color:#cfbddb;font-size:11px;line-height:1.55;text-align:center}.training-bonus-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.training-bonus-item{display:flex;align-items:center;gap:9px;min-width:0;padding:8px;border:1px solid #70547e66;border-radius:9px;background:#21182ddd}.training-bonus-art{flex:0 0 54px}.training-bonus-art .lesson-icon{width:54px;height:54px}.training-bonus-item b{color:#eed9b8;font-size:11px}.training-bonus-item p{margin:4px 0 0;color:#c9b7d4;font-size:9px;line-height:1.45}.training-bonus-gallery>.primary{display:block;margin:16px auto 0}@media(max-width:850px){.training-profile{padding:5px 7px}.training-profile b{font-size:10px}.training-profile small{font-size:9px}.training-profile-note,.training-profile-live{font-size:8px}.training-bonus-grid{grid-template-columns:1fr}.training-bonus-gallery>h2{font-size:21px}.training-bonus-item p{font-size:10px}}@media(max-height:500px){.training-card{max-height:250px;overflow:auto}.training-bonus-gallery>h2{font-size:18px}.training-bonus-item{padding:6px}}
`;document.head.appendChild(style);Journey.menu();
})();
