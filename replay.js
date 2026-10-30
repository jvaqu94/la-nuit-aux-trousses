/* Bilan de rejouabilité : record, build, prochain objectif et relance rapide. */
(()=>{
'use strict';
let pending=null;
const fmt=value=>Math.floor(Number(value)||0).toLocaleString('fr-FR');
const metricLabels={waves:'vagues à terminer',bosses:'gardiens à vaincre',dashes:'esquives à réaliser',cleanWaves:'vagues sans dégâts à terminer',pickups:'objets à ramasser',elites:'élites à vaincre'};
function nextUnlock(){
 const state=Journey.state,combat=Arsenal.catalog.filter(item=>item.metric&&!state.combat.unlocked.includes(item.id)).map(item=>({item,remaining:Math.max(0,item.target-(state.lifetime[item.metric]||0))})).sort((a,b)=>a.remaining-b.remaining)[0];
 const cosmetic=Journey.items.filter(item=>item.xp>state.xp).sort((a,b)=>a.xp-b.xp)[0];
 return{combat,cosmetic};
}
function goalHTML(result){
 const difference=result.score-result.record,target=Math.max(result.record+1,difference>0?Math.ceil(result.score*1.05):result.record+1),progress=Math.max(3,Math.min(100,result.score/Math.max(1,target)*100));
 const title=difference>0?'Record battu de '+fmt(difference)+' points':difference===0?'Record personnel égalé':'Encore '+fmt(-difference)+' points pour ton record';
 const next=nextUnlock(),lines=[];
 if(result.unlocks?.length)lines.push('Débloqué pendant ce vol : '+result.unlocks.join(' · ')+'.');
 if(next.combat)lines.push('Prochaine capacité : '+next.combat.item.name+' — encore '+fmt(next.combat.remaining)+' '+(metricLabels[next.combat.item.metric]||'objectifs')+'.');
 if(next.cosmetic)lines.push('Collection : '+next.cosmetic.name+' — encore '+fmt(next.cosmetic.xp-Journey.state.xp)+' XP.');
 if(!lines.length)lines.push('Ta collection est complète : vise un nouveau record ou une synergie jamais découverte.');
 return`<section class="replay-card replay-goal-card"><small>TON PROCHAIN OBJECTIF</small><h3>${safeText(title)}</h3><div class="replay-progress" aria-hidden="true"><i style="width:${progress}%"></i></div><p>Vise <b>${fmt(target)} point${target>1?'s':''}</b> au prochain vol. ${lines.map(safeText).join('<br>')}</p></section>`;
}
function buildHTML(build){
 if(!build)return'';
 const active=(build.activated||[]).map(id=>BuildSynergies.byId(id)).filter(Boolean),equipment=BuildSynergies.equipmentNames(build.equipment);
 let suggestion='';
 if(!active.length){
  const partial=BuildSynergies.definitions.find(synergy=>synergy.needs.some(key=>(build.upgrades?.[key]||0)>0)&&!synergy.needs.every(key=>(build.upgrades?.[key]||0)>0));
  if(partial){const missing=partial.needs.find(key=>!(build.upgrades?.[key]>0)),relic=upgradeDefs.find(def=>def[0]===missing)?.[2]||missing;suggestion='Piste du prochain vol : ajoute '+relic+' pour révéler « '+partial.name+' ».'}
  else suggestion='Au prochain vol, ramasse deux reliques complémentaires pour révéler une synergie nommée.';
 }
 return`<section class="replay-card replay-build-card"><small>BUILD DE CE VOL</small><h3>${active.length?active.length+' synergie'+(active.length>1?'s':'')+' dans ton grimoire':'Ton prochain build reste à découvrir'}</h3>${active.length?`<div class="replay-synergy-list">${active.map(item=>`<div class="replay-synergy"><b>✦ ${safeText(item.name)}</b><span>${safeText(item.description)}</span>${(build.discovered||[]).includes(item.id)?'<em>Découverte dans ce vol</em>':''}</div>`).join('')}</div>`:'<p class="replay-empty">'+safeText(suggestion)+'</p>'}<div class="replay-equipment">Équipement : ${safeText(equipment.join(' · ')||'équipement du défi')}.<br>Ces noms rendent les combinaisons existantes plus lisibles ; ils n’ajoutent aucun bonus.</div></section>`;
}
function equip(build){
 const selected=Journey.state.combat?.selected;if(!selected||!build?.equipment)return;
 for(const kind of ['spell','broom','pet']){
  const id=build.equipment[kind],item=Arsenal.catalog.find(entry=>entry.kind===kind&&entry.id===id);
  if(item&&Journey.state.combat.unlocked.includes(id))selected[kind]=id;
 }
}
function enhance(){
 const screen=document.querySelector('#overlay .journey-result-screen:not(.weekly-result)');
 if(!screen||!pending||WeeklySprint.isResult||screen.dataset.replayResult===pending.id)return;
 const grid=screen.querySelector('.journey-result-grid');if(!grid)return;
 screen.dataset.replayResult=pending.id;
 const cards=document.createElement('div');cards.className='replay-personal-cards';cards.innerHTML=goalHTML(pending)+buildHTML(pending.build);grid.insertAdjacentElement('afterend',cards);
 const retry=screen.querySelector('#retry');if(retry){
  retry.parentElement?.classList.add('replay-result-actions');
  if(pending.mode==='free'){
   retry.innerHTML='Rejouer avec ce build →';retry.onclick=()=>{equip(pending.build);LocalLeague.play()};
  }
  if(!screen.querySelector('#replayChangeBuild')){
   const change=document.createElement('button');change.type='button';change.id='replayChangeBuild';change.className='secondary';change.textContent='Changer balai / sort';change.onclick=()=>Arsenal.prepare();retry.insertAdjacentElement('afterend',change);
  }
 }
}
const oldFinish=Journey.finish;Journey.finish=function(win){
 const id=Journey.run?.id,build=BuildSynergies.snapshot(),result=oldFinish(win),saved=Journey.state.recent.find(entry=>entry.id===id);
 pending=saved?{...saved,build:build||BuildSynergies.last}:null;enhance();return result;
};
const observer=new MutationObserver(enhance);observer.observe($('overlay'),{childList:true,subtree:true});
window.Replayability={enhance,get pending(){return pending}};
})();
