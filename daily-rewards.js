/* Coffre de connexion : tirage sauvegardé avant toute animation, sans bonus de jeu. */
(()=>{'use strict';
const JOURNEY_KEY='minuit-journey-v1';
const RARITIES={
 common:{label:'Commune',xp:40,cosmetics:0,color:'#b9c9d7'},
 rare:{label:'Rare',xp:60,cosmetics:1,color:'#79d8e8'},
 epic:{label:'Épique',xp:120,cosmetics:1,color:'#c598f2'},
 legendary:{label:'Légendaire',xp:200,cosmetics:2,color:'#f2c879'}
};
let activeUser='',opening=false,presented=false,sequence=0,timers=[];
const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const userId=user=>typeof user==='string'?user:String(user?.id||'');
const clampRandom=value=>Math.max(0,Math.min(1-Number.EPSILON,Number.isFinite(value)?value:0));
function secureRandom(){try{const values=new Uint32Array(1);crypto.getRandomValues(values);return values[0]/4294967296}catch{return Math.random()}}
function odds(streak=1){const step=Math.max(0,Math.min(6,Math.floor(streak||1)-1));return {common:70-step*5,rare:22+step,epic:7+step*3,legendary:1+step}}
function roll(streak=1,value=secureRandom()){
 const weights=odds(streak),draw=clampRandom(value)*100;let cursor=0;
 for(const rarity of ['common','rare','epic','legendary']){cursor+=weights[rarity];if(draw<cursor)return rarity}
 return 'legendary';
}
function daysBetween(from,to){return Math.round((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000)}
function nextStreak(lastClaim,current,today){
 if(!lastClaim)return 1;
 if(lastClaim>=today)return Math.max(1,Number(current)||1);
 return Math.min(100000,daysBetween(lastClaim,today)===1?Math.max(0,Number(current)||0)+1:1);
}
function account(uid,create=false){
 const rewards=Journey.state.dailyRewards;if(!rewards||typeof rewards!=='object')return null;
 let value=rewards[uid];
 if(value&&(typeof value!=='object'||Array.isArray(value))){if(!create)return null;value=rewards[uid]=null}
 if(!value&&create)value=rewards[uid]={lastClaim:'',streak:0,pending:null,lastResult:null};
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 value.lastClaim=typeof value.lastClaim==='string'?value.lastClaim:'';
 value.streak=Math.max(0,Math.min(100000,Math.floor(Number(value.streak)||0)));
 return value;
}
function pickCosmetics(count,random){
 const gifted=new Set(Journey.state.giftedCosmetics||[]),xp=Number(Journey.state.xp)||0;
 const pool=Journey.dailyCosmetics().filter(item=>xp<item.xp&&!gifted.has(item.id));
 for(let index=pool.length-1;index>0;index--){const other=Math.floor(clampRandom(random())*(index+1));[pool[index],pool[other]]=[pool[other],pool[index]]}
 const selected=pool.slice(0,count);
 return {cosmetics:selected.map(item=>item.id),conversionXP:(count-selected.length)*100};
}
function claim(user=window.MinuitCloud?.user,random=secureRandom){
 const uid=userId(user);if(!uid)return null;
 const saved=account(uid,true),today=dateKey();
 if(saved.pending||saved.lastClaim>=today)return saved.pending||null;
 saved.streak=nextStreak(saved.lastClaim,saved.streak,today);
 const rarity=roll(saved.streak,clampRandom(random())),definition=RARITIES[rarity],picked=pickCosmetics(definition.cosmetics,random);
 saved.lastClaim=today;
 saved.pending={day:today,rarity,xp:definition.xp,cosmetics:picked.cosmetics,conversionXP:picked.conversionXP,createdAt:new Date().toISOString()};
 Journey.saveProgress();
 return saved.pending;
}
function clearTimers(){for(const timer of timers)clearTimeout(timer);timers=[]}
function later(callback,delay,id){const timer=setTimeout(()=>{timers=timers.filter(value=>value!==timer);if(id===sequence)callback()},delay);timers.push(timer)}
function streakSteps(streak){return `<div class="daily-streak-steps" aria-label="Palier ${Math.min(7,streak)} sur 7">${Array.from({length:7},(_,index)=>`<i class="${index<Math.min(7,streak)?'filled':''}">${index<Math.min(7,streak)?'✦':'·'}</i>`).join('')}</div>`}
function chestHTML(){
 return `<div class="daily-chest-stage" aria-hidden="true">
  <div class="daily-magic-halo"></div><div class="daily-magic-ring daily-ring-one"></div><div class="daily-magic-ring daily-ring-two"></div>
  <div class="daily-particles">${Array.from({length:14},(_,index)=>`<i style="--particle:${index};--angle:${index*25.714}deg"></i>`).join('')}</div>
  <div class="daily-chest-light"></div>
  <div class="daily-chest-3d">
   <div class="daily-chest-base daily-face-front"><i></i><i></i><span class="daily-chest-lock">✦</span></div>
   <div class="daily-chest-base daily-face-back"><i></i><i></i></div>
   <div class="daily-chest-base daily-face-left"><i></i></div><div class="daily-chest-base daily-face-right"><i></i></div>
   <div class="daily-chest-base daily-face-bottom"></div><div class="daily-chest-interior"></div>
   <div class="daily-chest-lid">
    <div class="daily-lid-face daily-lid-front"><i></i><i></i></div><div class="daily-lid-face daily-lid-back"><i></i><i></i></div>
    <div class="daily-lid-face daily-lid-left"><i></i></div><div class="daily-lid-face daily-lid-right"><i></i></div>
    <div class="daily-lid-face daily-lid-top"><i></i><i></i></div><div class="daily-lid-inner"></div>
   </div>
  </div><div class="daily-chest-shadow"></div>
 </div>`;
}
function show(pending,saved,replay=false){
 clearTimers();opening=true;presented=true;const id=++sequence,legendary=pending.rarity==='legendary';
 state='daily-reward';
 overlay(`<section class="daily-reward-screen" id="dailyRewardScreen" aria-label="Coffre de connexion quotidienne">
  <div class="daily-reward-heading"><div class="eyebrow">CONNEXION QUOTIDIENNE · ${pending.day===dateKey()?'COFFRE DU JOUR':'COFFRE RETROUVÉ'}</div><h2 id="dailyRewardTitle">Le coffre des nuits</h2><p id="dailyRewardIntro">Ta série de <b>${saved.streak} jour${saved.streak>1?'s':''}</b> fait briller la magie.</p>${streakSteps(saved.streak)}</div>
  ${chestHTML()}
  <div class="daily-reward-status" id="dailyRewardStatus" role="status" aria-live="polite"><span class="daily-waiting-dot"></span>${replay?'Le coffre se souvient de ta récompense…':'La magie choisit ta récompense…'}</div>
  <section class="daily-reward-loot hidden" id="dailyRewardLoot" aria-label="Récompense obtenue"></section>
  <div class="daily-reward-footer"><small id="dailyRewardNote">XP et apparences uniquement · aucun avantage en partie</small><button class="primary hidden" id="dailyRewardContinue">Continuer →</button></div>
 </section>`);
 const duration=reducedMotion()?650:2400,openingAt=reducedMotion()?180:1940;
 later(()=>{document.getElementById('dailyRewardScreen')?.classList.add('is-opening');playSfx('chestOpen',legendary ? .9 : .68,.11)},openingAt,id);
 later(()=>reveal(userId(activeUser),replay?pending:null),duration,id);
}
function cosmeticCard(item){
 return `<article class="daily-loot-card daily-loot-cosmetic" style="--loot-color:${item.color||'#d9b5ff'}"><span class="daily-loot-kind">APPARENCE DÉBLOQUÉE</span><div class="daily-loot-art">${Journey.collectionArt(item)}</div><strong>${safeText(item.name)}</strong><small>${({outfit:'Tenue',spell:'Couleur de sorts',broom:'Balai',pet:'Compagnon décoratif'})[item.kind]||'Collection'}</small></article>`;
}
function reveal(uid,replayedResult=null){
 if(state!=='daily-reward'||!opening)return;
 const screen=document.getElementById('dailyRewardScreen');if(!screen){opening=false;return}
 const result=replayedResult||Journey.grantDailyReward(uid);opening=false;
 if(!result){LocalLeague.menu();return}
 const definition=RARITIES[result.rarity]||RARITIES.common;
 screen.classList.remove('is-opening');screen.classList.add('is-revealed','daily-rarity-'+result.rarity);screen.style.setProperty('--rarity',definition.color);
 const items=result.cosmetics.map(id=>Journey.items.find(item=>item.id===id)).filter(Boolean),totalXP=result.totalXP;
 document.getElementById('dailyRewardTitle').textContent=result.rarity==='legendary'?'Trésor légendaire !':result.rarity==='epic'?'Magie éclatante !':result.rarity==='rare'?'Belle surprise !':'Douceur de minuit !';
 document.getElementById('dailyRewardIntro').innerHTML=`RÉCOMPENSE <b>${definition.label.toUpperCase()}</b> · ${replayedResult?'déjà obtenue aujourd’hui':'elle est déjà sauvegardée'}`;
 const status=document.getElementById('dailyRewardStatus');status.innerHTML='<span aria-hidden="true">✦</span> Le coffre a parlé !';
 const loot=document.getElementById('dailyRewardLoot');loot.classList.remove('hidden');
 loot.innerHTML=`<article class="daily-loot-card daily-loot-xp"><span class="daily-loot-kind">EXPÉRIENCE</span><div class="daily-loot-art"><img src="${window.CollectibleArt?.art?.xp?.src||''}" alt="" draggable="false"></div><strong>+${totalXP} XP</strong><small>Progression du Grimoire</small></article>${items.map(cosmeticCard).join('')}`;
 document.getElementById('dailyRewardNote').textContent=replayedResult?'Coffre déjà ouvert : aucun gain supplémentaire. Reviens demain pour une nouvelle récompense.':result.conversionXP?`${result.conversionXP} XP remplacent les apparences déjà débloquées. La suite de ta série est enregistrée.`:'La suite de ta série est enregistrée. Reviens demain pour un nouveau coffre.';
 const button=document.getElementById('dailyRewardContinue');button.classList.remove('hidden');button.onclick=()=>{clearTimers();sequence++;LocalLeague.menu();setTimeout(()=>onAccount(window.MinuitCloud?.user),0)};button.focus({preventScroll:true});
 tone(result.rarity==='legendary'?660:520,.34,'sine',.075,1.5);
}
function onAccount(user){
 const uid=userId(user);
 if(!uid){if(state==='daily-reward'){clearTimers();sequence++;opening=false;LocalLeague.menu()}activeUser='';presented=false;return}
 if(navigator.onLine===false)return;
 if(uid===activeUser&&state==='daily-reward')return;
 if(uid!==activeUser){clearTimers();sequence++;opening=false;presented=false;activeUser=uid}
 const saved=account(uid,false),pending=saved?.pending||claim(uid);
 if(pending){show(pending,account(uid));return}
 // Coffre déjà ouvert aujourd'hui : on ne rejoue plus la scène d'ouverture à
 // chaque connexion / rechargement / retour au premier plan.
 presented=true;
}
function validDay(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))}
function validatePending(pending){
 if(!pending||typeof pending!=='object'||Array.isArray(pending)||!validDay(pending.day)||!RARITIES[pending.rarity])throw new Error('Coffre quotidien invalide');
 if(!Number.isInteger(pending.xp)||pending.xp<0||pending.xp>1000||!Number.isInteger(pending.conversionXP)||pending.conversionXP<0||pending.conversionXP>200)throw new Error('Gains quotidiens invalides');
 if(!Array.isArray(pending.cosmetics)||pending.cosmetics.length>2||new Set(pending.cosmetics).size!==pending.cosmetics.length)throw new Error('Apparences quotidiennes invalides');
 const eligible=new Set(Journey.dailyCosmetics().map(item=>item.id));if(pending.cosmetics.some(id=>!eligible.has(id)))throw new Error('Apparence quotidienne inconnue');
}
// Une sauvegarde ancienne ou endommagée ne doit pas empêcher la connexion.
function isReplayable(result,day){
 try{validatePending(result);return result.day===day&&Number.isInteger(result.totalXP)&&result.totalXP===result.xp+result.conversionXP}catch{return false}
}
function validateSave(save){
 const gifted=save.giftedCosmetics??[];if(!Array.isArray(gifted)||gifted.length>Journey.dailyCosmetics().length||new Set(gifted).size!==gifted.length)throw new Error('Apparences offertes invalides');
 const eligible=new Set(Journey.dailyCosmetics().map(item=>item.id));if(gifted.some(id=>!eligible.has(id)))throw new Error('Apparence offerte inconnue');
 const rewards=save.dailyRewards??{};if(!rewards||typeof rewards!=='object'||Array.isArray(rewards)||Object.keys(rewards).length>100)throw new Error('Historique des coffres invalide');
 for(const [uid,saved] of Object.entries(rewards)){
  if(!uid||uid.length>128||!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error('Compte du coffre invalide');
  if(saved.lastClaim&&!validDay(saved.lastClaim))throw new Error('Date du coffre invalide');
  if(!Number.isInteger(saved.streak)||saved.streak<0||saved.streak>100000)throw new Error('Série du coffre invalide');
  if(saved.pending)validatePending(saved.pending);
 }
}
const baseValidate=Journey.validate;
Journey.validate=function(bundle){const result=baseValidate(bundle),save=result?.saves?.[JOURNEY_KEY];if(save)validateSave(save);return result};
window.addEventListener('minuit:account-connected',event=>setTimeout(()=>onAccount(event.detail?.user||window.MinuitCloud?.user),0));
window.addEventListener('minuit:account-disconnected',()=>onAccount(null));
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state==='league-menu'&&window.MinuitCloud?.connected)onAccount(window.MinuitCloud.user)});
window.addEventListener('online',()=>{if(state==='league-menu'&&window.MinuitCloud?.connected)onAccount(window.MinuitCloud.user)});
window.DailyRewards={check:onAccount,claim,odds,roll,nextStreak,rarities:RARITIES,get activeUser(){return activeUser},get opening(){return opening}};
setTimeout(()=>{if(window.MinuitCloud?.connected)onAccount(window.MinuitCloud.user)},180);
})();
