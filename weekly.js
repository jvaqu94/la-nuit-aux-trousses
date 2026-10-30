/* Sprint hebdomadaire : trois vagues, un gardien, graine commune et scores séparés. */
(()=>{
'use strict';
const KEY='minuit-weekly-sprints-v1';
let data={version:1,weeks:{}},active=false,config=null,result=null,countdown=0,teamEpoch=0,friend=null;
const fmt=value=>Math.floor(Number(value)||0).toLocaleString('fr-FR');
const timeLabel=value=>Math.floor((Number(value)||0)/60)+' min '+String(Math.floor(Number(value)||0)%60).padStart(2,'0')+' s';
const cleanRun=value=>{
 if(!value||typeof value!=='object'||!Number.isFinite(value.score)||value.score<0)return null;
 return{id:String(value.id||'').slice(0,80),week:String(value.week||''),seed:Number(value.seed)>>>0,score:Math.floor(value.score),time:Math.max(0,Math.floor(Number(value.time)||0)),wave:Math.max(1,Math.min(3,Math.floor(Number(value.wave)||1))),won:!!value.won,world:String(value.world||'').slice(0,80),date:String(value.date||'').slice(0,40),build:value.build&&typeof value.build==='object'?value.build:null};
};
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||'null');
 if(saved?.version===1&&saved.weeks&&typeof saved.weeks==='object'){
  for(const [week,value] of Object.entries(saved.weeks)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||!value||typeof value!=='object')continue;
   const best=cleanRun(value.best),last=cleanRun(value.last),runs=Array.isArray(value.runs)?value.runs.map(cleanRun).filter(Boolean).slice(0,8):[];
   data.weeks[week]={best,last,runs};
  }
 }
}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}}
function weekInfo(){
 const day=dateKey(),date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
 const week=date.toISOString().slice(0,10),seed=hash('minuit-weekly-sprint-v1:'+week),stage=hash('minuit-weekly-world-v1:'+week)%worlds.length;
 const label=date.toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'});
 return{week,seed,stage,label};
}
function weekData(week){return data.weeks[week]||(data.weeks[week]={best:null,last:null,runs:[]})}
function clearCountdown(){if(countdown){clearInterval(countdown);countdown=0}}
function shareContent(scoreValue){
 const info=config||result?.info||weekInfo(),score=Math.floor(Number(scoreValue)||0),url=location.protocol==='file:'?'':new URL(location.href);
 let link='';if(url){url.search='';url.hash='';url.searchParams.set('sprint',info.week);url.searchParams.set('target',String(score));link=url.href}
 const text='Sprint hebdo · La Nuit aux Trousses — semaine du '+info.label+' : '+fmt(score)+' points. La même graine pour tous cette semaine. Peux-tu battre mon score ?';
 return{text,link,message:text+(link?'\n'+link:''),whatsapp:'https://wa.me/?text='+encodeURIComponent(text+(link?'\n'+link:'')),messenger:link?'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link):''};
}
async function copyChallenge(scoreValue,status){
 const share=shareContent(scoreValue);try{await navigator.clipboard.writeText(share.message);if(status)status.textContent='Défi copié. Envoie-le à un ami ou dans ta team.'}catch{prompt('Copie ce défi :',share.message)}
}
function bindShare(scoreValue,prefix='weekly'){
 const score=Math.floor(Number(scoreValue)||0),share=shareContent(score),whats=$(prefix+'WhatsApp'),messenger=$(prefix+'Messenger'),copy=$(prefix+'Copy'),status=$(prefix+'ShareStatus');
 if(whats)whats.href=share.whatsapp;if(messenger){messenger.href=share.messenger||'#';messenger.classList.toggle('hidden',!share.messenger)}
 if(copy)copy.onclick=()=>copyChallenge(score,status);
}
function teamRows(board){
 const rows=Array.isArray(board?.scores)?board.scores:[];if(!rows.length)return'<div class="tiny">Aucun membre n’a encore joué ce Sprint.</div>';
 return rows.slice(0,10).map((row,index)=>{const played=row.played!==false&&row.score!==null&&row.score!==undefined;return`<div class="weekly-team-row ${row.isYou?'team-you':''}"><b>#${Number(row.rank)||index+1}</b><span>${safeText(row.displayName||'Sorcière')}${row.isYou?'<small>TOI</small>':''}</span><strong>${played?fmt(row.score):'—'}</strong><small>${played?(row.won?'Gardien vaincu':'Vague '+Number(row.wave||1)+'/3')+' · '+timeLabel(row.time):'Pas encore de vol'}</small></div>`}).join('');
}
function paintTeam(element,board){
 if(!element)return;
 if(!board||board.skipped||!board.team){element.innerHTML='<div class="tiny">Le record reste sur cet appareil. Rejoins une team pour comparer ce Sprint avec ses membres.</div>';return}
 const mine=(board.scores||[]).find(row=>row.isYou),rank=mine?.rank||'—';
 element.innerHTML=`<div class="weekly-team-heading"><span>TEAM · ${safeText(board.team.name||'Ta team')}</span><b>TA POSITION : #${rank}</b></div><div class="weekly-team-board">${teamRows(board)}</div><div class="tiny">Meilleur Sprint de la semaine pour chaque membre · classement séparé de la campagne.</div>`;
}
function syncTeam(element,week,promise){
 if(!element)return;if(!window.MinuitCloud?.connected){paintTeam(element,null);return}
 const epoch=++teamEpoch;element.innerHTML='<div class="tiny">Chargement du classement Sprint de la team…</div>';
 const request=promise||Promise.resolve().then(()=>window.MinuitCloud.weeklySprintBoard?.(week));
 Promise.resolve(request).then(board=>{if(epoch===teamEpoch&&element.isConnected)paintTeam(element,board)}).catch(error=>{if(epoch===teamEpoch&&element.isConnected)element.innerHTML='<div class="tiny">Record local conservé. Classement team indisponible : '+safeText(error.message||'service hors ligne')+'</div>'});
}
function buildHTML(build){
 if(!build)return'';
 const synergies=(build.activated||[]).map(id=>BuildSynergies.byId(id)).filter(Boolean),equipment=BuildSynergies.equipmentNames(build.equipment);
 return`<section class="replay-card weekly-build-card"><small>BUILD DÉCOUVERT DANS CE SPRINT</small><h3>${synergies.length?synergies.length+' synergie'+(synergies.length>1?'s':'')+' activée'+(synergies.length>1?'s':''):'Un build à explorer'}</h3>${synergies.length?`<div class="replay-synergy-list">${synergies.map(item=>`<div class="replay-synergy"><b>✦ ${safeText(item.name)}</b><span>${safeText(item.description)}</span>${(build.discovered||[]).includes(item.id)?'<em>Nouvelle combinaison découverte</em>':''}</div>`).join('')}</div>`:'<p class="replay-empty">Aucune paire nommée cette fois. Au prochain vol, cherche deux reliques complémentaires.</p>'}<div class="replay-equipment">Équipement normalisé : ${safeText(equipment.join(' · ')||'Onde améthyste · Bruyère équilibrée · Vol solitaire')}.<br>Les synergies décrivent les mécaniques existantes, sans bonus de puissance.</div></section>`;
}
function recordLocal(win,build,info){
 const value=cleanRun({id:info.id,week:info.week,seed:info.seed,score:Math.floor(score),time:Math.floor(gameTime),wave:Math.max(1,Math.min(3,wave-2)),won:win,world:world.name,date:new Date().toISOString(),build});
 const week=weekData(info.week),previousBest=week.best?.score||0,isRecord=value.score>previousBest;
 week.last=value;week.runs.unshift(value);week.runs=week.runs.slice(0,8);
 if(!week.best||value.score>week.best.score||(value.score===week.best.score&&(value.won&&!week.best.won||value.won===week.best.won&&value.time<week.best.time)))week.best=value;
 save();return{...value,previousBest,isRecord,info,build};
}
function finish(win){
 if(!active||!config||recorded)return;
 const info={...config},build=BuildSynergies.snapshot(),submissionValue={week:info.week,runId:info.id,score:Math.floor(score),time:Math.max(0,Math.floor(gameTime)),wave:Math.max(1,Math.min(3,wave-2)),won:!!win};
 release();recorded=true;state='end';try{localStorage.removeItem('minuit-checkpoint')}catch{}
 result=recordLocal(!!win,build,info);active=false;config=null;$('questHUD').classList.add('hidden');
 const submission=window.MinuitCloud?.connected&&window.MinuitCloud.submitWeeklySprint?Promise.resolve().then(()=>window.MinuitCloud.submitWeeklySprint(submissionValue)):null;
 Journey.abandon();window.SandboxMode=false;result.submission=submission;
 if(win){present();return}
 let deadline=0;const reveal=()=>{clearCountdown();if(state==='end'&&result)present()};
 const schedule=ms=>{clearCountdown();const delay=Math.max(3000,Math.min(8500,(Number(ms)||1200)-250));deadline=performance.now()+delay;const paint=()=>{if(state!=='end'||!result){clearCountdown();return}if(performance.now()>=deadline){reveal();return}const number=$('deathCountdown');if(number)number.textContent=String(Math.max(1,Math.ceil((deadline-performance.now())/1000)))};paint();countdown=setInterval(paint,100)};
 const cue=window.MinuitSoundtrack?.player?.defeat?.();if(cue?.then)cue.then(schedule).catch(()=>schedule(0));else schedule(0);
 overlay(`<div class="death-transition" role="alert"><div class="death-transition-mark">✦</div><h2>VOUS AVEZ PERDU</h2><p>Le Sprint est terminé, mais ton record hebdomadaire est conservé.</p><div class="death-countdown"><b id="deathCountdown" aria-live="polite">…</b><span id="deathCountdownLabel">Préparation des HI-SCORES Sprint…</span></div><small>La page des HI-SCORES Sprint va s’afficher en plein écran.<br>Aucun essai quotidien ni score de campagne n’a été utilisé.</small></div>`);
}
function present(){
 const current=result;if(!current)return;state='end';const best=weekData(current.week).best,difference=current.score-current.previousBest;
 const friendCard=friend&&friend.week===current.week?`<section class="replay-card"><small>DÉFI AMI · SCORE PARTAGÉ</small><h3>${current.score>friend.score?'Score ami battu !':current.score===friend.score?'Égalité avec ton ami':'Encore '+fmt(friend.score-current.score)+' points'}</h3><p>Ton score : ${fmt(current.score)} · score à battre : ${fmt(friend.score)}.</p></section>`:'';
 const history=(weekData(current.week).runs||[]).slice(0,3).map((run,index)=>`<div class="weekly-last-run"><span>${index===0?'Dernier Sprint':'Sprint précédent'} · ${run.won?'gardien vaincu':'vague '+run.wave+'/3'}</span><b>${fmt(run.score)}</b><small>${timeLabel(run.time)}</small></div>`).join('');
 overlay(`<section class="journey-result-screen weekly-result" aria-label="Highscores et bilan du Sprint hebdomadaire"><div class="eyebrow">SPRINT HEBDO · SEMAINE DU ${safeText(current.info.label.toUpperCase())}</div><h2 class="local-title ${current.won?'':'death-title'}">${current.won?'Le gardien du Sprint est tombé !':'Vous êtes mort !'}</h2>${current.won?'':'<div class="death-note" role="alert">Vous avez perdu votre dernière vie.<br>Le record Sprint est sauvegardé séparément.</div>'}<div class="journey-result-grid"><div><small>SCORE DU SPRINT</small><b>${fmt(current.score)}</b><span>${current.isRecord?'Nouveau record hebdomadaire !':difference===0?'Record personnel égalé':fmt(Math.max(0,-difference))+' points pour battre ton record'}</span></div><div><small>RECORD PERSONNEL</small><b>${fmt(best?.score||current.score)}</b><span>${current.previousBest?'Avant ce vol : '+fmt(current.previousBest)+' points.':'Premier score inscrit cette semaine.'}</span></div><div><small>PARCOURS</small><b>${current.won?'3 vagues + gardien':'Vague '+current.wave+' / 3'}</b><span>${safeText(current.world)} · graine commune ${current.seed}</span></div><div><small>TEMPS DE VOL</small><b>${timeLabel(current.time)}</b><span>Format court · trois vagues puis un gardien.</span></div></div>${friendCard}${buildHTML(current.build)}<section class="replay-card weekly-scoreboard"><div class="scoreboard-title"><span>HI-SCORES · SPRINT HEBDO</span><b>RECORDS SÉPARÉS</b></div>${history}<div id="weeklyTeamBoard" class="weekly-team-board-wrap"></div></section><div class="local-actions weekly-share-actions"><a class="secondary" id="weeklyWhatsApp" target="_blank" rel="noopener">WhatsApp</a><a class="secondary" id="weeklyMessenger" target="_blank" rel="noopener">Messenger</a><button class="secondary" id="weeklyCopy">Copier le défi</button></div><div class="tiny" id="weeklyShareStatus" role="status">Le lien contient la semaine et le score à battre, sans donnée de compte.</div><div class="local-actions replay-result-actions"><button class="primary" id="weeklyRetry">Rejouer le Sprint →</button><button class="secondary" id="weeklyHome">Retour à l’accueil</button></div><div class="tiny">Illimité, sans essai quotidien, sans XP et sans inscription dans les records de campagne.</div></section>`);
 $('weeklyRetry').onclick=start;$('weeklyHome').onclick=()=>LocalLeague.menu();bindShare(best?.score||current.score);syncTeam($('weeklyTeamBoard'),current.week,current.submission);
}
function start(){
 clearCountdown();active=false;config=null;result=null;friend=friend&&friend.week===weekInfo().week?friend:null;
 if(!LocalLeague.startTransient())return false;
 const info=weekInfo();config={...info,id:'sprint-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)};
 stage=info.stage;world=worlds[stage];wave=3;diff=1;lives=3;runId='normal';dailyDate=dateKey();seed=info.seed;session=config.id;active=true;
 schedule=[];enemies=[];shots=[];hostile=[];rockets=[];drops=[];hazards=[];obstacles=[];scares=[];
 newWave();updateLoadout();updateHUD();customHUD();
 $('modeLabel').textContent='↯ Sprint hebdo · '+info.week;say('Sprint hebdo · trois vagues, puis '+world.boss,3.2);
 return true;
}
function prepareWave(){
 if(!active||!config||wave<3||wave>5)return;
 const first=schedule.map(item=>({...item})),second=first.map(item=>({...item,time:item.time+22,x:800-item.x,pattern:((item.pattern||0)+1)%4}));
 schedule=[...first,...second].sort((a,b)=>a.time-b.time);say('Sprint · Vague '+(wave-2)+'/3'+(wave===5?' · le gardien approche':''),2.4);customHUD();
}
function customHUD(){
 if(!active||!config)return;const boss=enemies.some(enemy=>enemy.boss&&!enemy.dead),best=weekData(config.week).best?.score||0;
 $('wave').textContent=boss?'GARDIEN':String(Math.max(1,wave-2)).padStart(2,'0')+' / 03';$('realmHUD').textContent=world.short;
 $('hiValue').textContent=String(Math.max(best,Math.floor(score))).padStart(6,'0');$('hiValue').parentElement?.classList.toggle('record-live',score>best);
 $('status').textContent=world.name+' · '+timeLabel(gameTime)+' · SPRINT HEBDO';
}
function guardianDefeated(){return!!(active&&config&&wave===5)}
function preflight(){
 clearCountdown();const info=weekInfo(),week=weekData(info.week),best=week.best;state='weekly-preflight';
 const friendNote=friend&&friend.week===info.week?`<div class="weekly-friend-target"><small>DÉFI AMI REÇU</small><b>${fmt(friend.score)} points à battre</b><span>La comparaison apparaîtra dans ton bilan.</span></div>`:'';
 overlay(`<section class="weekly-preflight"><div class="eyebrow">MODE COURT · MÊME GRAINE POUR TOUS</div><h2 class="local-title">Le Sprint de la semaine.</h2><p>Trois vagues, puis un gardien. Environ 3 à 5 minutes, avec l’équipement de défi normalisé et la difficulté Nuit noire.</p><div class="weekly-rule-grid"><div><b>01</b><span>Trois vagues d’environ 40 secondes, sans écran de choix.</span></div><div><b>02</b><span>${safeText(worlds[info.stage].boss)} garde la fin du Sprint.</span></div><div><b>03</b><span>Rejoue librement pour améliorer ton record avant lundi.</span></div></div><div class="weekly-seed"><span>SEMAINE DU ${safeText(info.label.toUpperCase())}</span><b>GRAINE ${info.seed}</b><small>${safeText(worlds[info.stage].name)} · renouvellement lundi, heure de Paris</small></div>${friendNote}<div class="weekly-personal-best"><small>TON RECORD HEBDOMADAIRE</small><b>${best?fmt(best.score):'—'}</b><span>${best?timeLabel(best.time)+' · '+(best.won?'gardien vaincu':'vague '+best.wave+'/3'):'Ton premier Sprint inscrira un record séparé.'}</span></div><section class="replay-card"><small>AMIS & TEAM</small><div id="weeklyPreflightTeam"></div></section><div class="local-actions"><button class="primary" id="weeklyLaunch">Lancer le Sprint →</button><button class="secondary" id="weeklyBack">Retour</button></div>${best?'<div class="local-actions weekly-share-actions"><a class="secondary" id="weeklyWhatsApp" target="_blank" rel="noopener">Défier sur WhatsApp</a><a class="secondary" id="weeklyMessenger" target="_blank" rel="noopener">Messenger</a><button class="secondary" id="weeklyCopy">Copier le défi</button></div><div class="tiny" id="weeklyShareStatus">Un ami ouvre le lien, joue la même graine et compare son score au tien.</div>':''}<div class="tiny">Aucun essai quotidien consommé. Pas d’XP ni de score de campagne. Aucun malus si tu ne joues pas chaque semaine.</div></section>`);
 $('weeklyLaunch').onclick=start;$('weeklyBack').onclick=()=>LocalLeague.menu();if(best)bindShare(best.score);syncTeam($('weeklyPreflightTeam'),info.week);
}
function discard(){
 clearCountdown();const had=active||result||Journey.run?.transient;if(!had)return false;
 active=false;config=null;result=null;if(Journey.run?.transient)Journey.abandon();window.SandboxMode=false;$('questHUD').classList.add('hidden');return true;
}
function installMenu(){
 if(state!=='league-menu'||document.querySelector('#overlay .training-mode'))return;
 const lab=$('labMenu'),grid=lab?.closest('.menu-grid');if(!grid||$('weeklySprint'))return;
 const button=document.createElement('button');button.type='button';button.id='weeklySprint';button.className='secondary menu-card-button';button.innerHTML='<span class="menu-card-icon">↯</span><span>Sprint hebdo</span>';button.onclick=preflight;grid.insertBefore(button,grid.firstChild);GuidedTraining.applyRequirement();
}
const oldEnd=end;end=function(win){if(active)return finish(win);return oldEnd(win)};
const oldMenu=menu;menu=function(...args){if(discard())return LocalLeague.menu();return oldMenu(...args)};
const oldPlay=LocalLeague.play;LocalLeague.play=function(...args){discard();return oldPlay(...args)};
const oldChallenge=LocalLeague.challenge;LocalLeague.challenge=function(...args){discard();return oldChallenge(...args)};
const oldLocalMenu=LocalLeague.menu;LocalLeague.menu=function(...args){discard();return oldLocalMenu(...args)};
const oldEvent=League.event;League.event=function(metric,n=1){if(active){Journey.event(metric,n);return}return oldEvent(metric,n)};
const oldTick=League.tick;League.tick=function(dt){const result=oldTick(dt);customHUD();return result};
const oldJourneyMenu=Journey.menu;Journey.menu=function(...args){const value=oldJourneyMenu(...args);installMenu();return value};
const css=document.createElement('style');css.textContent=`
.weekly-preflight{width:min(760px,100%);min-height:100%;margin:0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.weekly-preflight>p{max-width:580px}.weekly-rule-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%;margin:12px 0}.weekly-rule-grid>div{padding:11px;text-align:left;border:1px solid #755c8055;border-radius:9px;background:#251c32bb}.weekly-rule-grid b{display:block;color:#efbe85;font-size:16px}.weekly-rule-grid span{display:block;margin-top:5px;color:#c2afc9;font-size:10px;line-height:1.5}.weekly-seed{display:flex;flex-direction:column;gap:4px;margin:8px 0 12px;padding:10px 16px;border:1px solid #b3895d66;border-radius:9px;background:#38243788}.weekly-seed span{color:#c4a4cd;font-size:8px;letter-spacing:1px}.weekly-seed b{color:#ffd08e;font-size:13px;letter-spacing:1px}.weekly-seed small{margin:0;color:#b8a5c1;font-size:9px;letter-spacing:0}.weekly-personal-best{display:flex;flex-direction:column;margin:4px 0 12px}.weekly-personal-best small{margin:0;color:#b99bc7;font-size:8px}.weekly-personal-best b{color:#ffd08e;font-size:28px}.weekly-personal-best span{color:#baa8c4;font-size:10px}.weekly-friend-target{display:flex;flex-direction:column;gap:4px;margin:6px 0 10px;padding:10px 15px;border:1px solid #d4a56b88;border-radius:9px;background:#5a392b55}.weekly-friend-target small{margin:0;color:#d9b58c;font-size:8px}.weekly-friend-target b{color:#ffe0a6;font-size:18px}.weekly-friend-target span{color:#c9b4c8;font-size:9px}.weekly-share-actions{margin:9px 0}.weekly-share-actions a{text-decoration:none}.weekly-team-board-wrap{width:100%;margin-top:10px}.weekly-team-heading{display:flex;justify-content:space-between;gap:8px;margin-bottom:7px;color:#e6c9a5;font-size:9px}.weekly-team-heading b{color:#ffd08e}.weekly-team-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:4px 7px;align-items:center;padding:7px 5px;border-top:1px solid #ffffff0d;color:#d4c2de;font-size:10px;text-align:left}.weekly-team-row>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.weekly-team-row>span small{margin-left:5px;color:#ffc57e;font-size:7px}.weekly-team-row>strong{color:#ffd08e}.weekly-team-row>small{grid-column:2/-1;color:#9f8ead;font-size:8px}.weekly-team-row.team-you{background:#b0884433;border-radius:6px}.weekly-last-run{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;padding:8px 4px;border-top:1px solid #ffffff0d;color:#c8b5d2;font-size:10px;text-align:left}.weekly-last-run b{color:#ffd08e}.weekly-last-run small{margin:0;color:#a493b1;font-size:9px}.weekly-result .weekly-scoreboard{max-width:720px}.overlay:has(.weekly-preflight),.overlay:has(.weekly-result){justify-content:flex-start}.weekly-preflight>.local-actions,.weekly-result>.local-actions{flex-shrink:0}
@media(max-width:850px){.weekly-preflight{padding:4px 0;min-height:100%}.weekly-preflight>p{font-size:11px;margin-bottom:10px}.weekly-rule-grid{grid-template-columns:1fr;gap:5px;margin:8px 0}.weekly-rule-grid>div{display:grid;grid-template-columns:28px 1fr;gap:5px;padding:8px;text-align:left}.weekly-rule-grid span{margin:0}.weekly-seed{margin:5px 0 8px;padding:8px 12px}.weekly-personal-best{margin-bottom:8px}.weekly-preflight .replay-card{margin:6px 0}.weekly-result{min-height:100%}.weekly-share-actions{flex-wrap:wrap}.weekly-share-actions a,.weekly-share-actions button{min-height:42px}.weekly-last-run{grid-template-columns:minmax(0,1fr) auto}.weekly-last-run small{grid-column:1/-1}.weekly-team-heading{font-size:8px}}
`;document.head.appendChild(css);
try{
 const url=new URL(location.href),week=url.searchParams.get('sprint'),target=Number(url.searchParams.get('target'));
 if(/^\d{4}-\d{2}-\d{2}$/.test(week||'')&&Number.isFinite(target)&&target>=0&&target<=100000000)friend={week,score:Math.floor(target)};
 if(week||url.searchParams.has('target')){url.searchParams.delete('sprint');url.searchParams.delete('target');history.replaceState(null,'',url.pathname+(url.searchParams.size?'?'+url.searchParams:'')+url.hash)}
}catch{}
window.WeeklySprint={start,preflight,prepareWave,guardianDefeated,weekInfo,shareContent,get active(){return active},get result(){return result},get config(){return config},get data(){return data},get isResult(){return!!result&&state==='end'},get friend(){return friend}};
Journey.menu();if(friend&&friend.week===weekInfo().week)setTimeout(preflight,0);
})();
