/* Synergies nommées : lecture du build existant, sans bonus ni statistique ajoutée. */
(()=>{
'use strict';
const KEY='minuit-build-synergies-v1';
const definitions=[
 {id:'rocket-fragment',name:'Essaim crépitant',needs:['rocket','fragment'],description:'Roquettes spectrales + Fragmentation : chaque explosion libère les éclats déjà prévus par les reliques.'},
 {id:'poison-spread',name:'Contagion de minuit',needs:['poison','spread'],description:'Venin de minuit + Contagion : les créatures empoisonnées transmettent leur malédiction en tombant.'},
 {id:'familiar-laser',name:'Chœur spectral',needs:['familiar','laser'],description:'Familier lunaire + Rayon spectral : les tirs des compagnons accompagnent le rayon de la colonne de tir.'},
 {id:'fragment-chain',name:'Résonance explosive',needs:['fragment','chain'],description:'Fragmentation + Réaction en chaîne : les déflagrations successives produisent leurs éclats habituels.'},
 {id:'flame-poison',name:'Braise venimeuse',needs:['flame','poison'],description:'Flamme maudite + Venin de minuit : les explosions peuvent appliquer le poison dont les dégâts dépendent du Venin.'},
 {id:'fire-pierce',name:'Volée perforante',needs:['fire','pierce'],description:'Grimoire de puissance + Aiguilles fantômes : la cadence et les projectiles traversants composent le même tir automatique.'}
];
const ids=new Set(definitions.map(d=>d.id));
let seen=new Set(),current=null,last=null,lastSignature='';
try{const value=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(value))seen=new Set(value.filter(id=>ids.has(id)))}catch{}
const byId=id=>definitions.find(d=>d.id===id);
const saveSeen=()=>{try{localStorage.setItem(KEY,JSON.stringify([...seen]))}catch{}};
const equipmentIds=()=>{const combat=Journey.run?.combat;return{spell:combat?.spell||'pulse',broom:combat?.broom||'bruyere',pet:combat?.pet||'solo'}};
function equipmentNames(equipment){return['spell','broom','pet'].map(kind=>Arsenal.catalog.find(item=>item.kind===kind&&item.id===equipment?.[kind])?.name).filter(Boolean)}
function newCurrent(restored=false){
 const run=Journey.run;if(!run){current=null;render();return}
 const activated=restored&&Array.isArray(run.synergies)?run.synergies.filter(id=>ids.has(id)):[];
 current={id:run.id,activated:[...new Set(activated)],discovered:[],upgrades:restored&&run.synergyLevels?{...run.synergyLevels}:{},equipment:equipmentIds()};
 scan(false);
}
function snapshot(){
 if(!current)return null;
 return{id:current.id,activated:[...current.activated],discovered:[...current.discovered],upgrades:{...current.upgrades},equipment:{...current.equipment}};
}
function scan(notify=true){
 const run=Journey.run;
 if(!run||!current||current.id!==run.id||window.SandboxMode&&!window.WeeklySprint?.active){render();return}
 for(const key in upgrades)current.upgrades[key]=Math.max(current.upgrades[key]||0,Number(upgrades[key])||0);
 current.equipment=equipmentIds();
 const activated=[];
 for(const synergy of definitions){
  if(current.activated.includes(synergy.id)||!synergy.needs.every(key=>(Number(upgrades[key])||0)>0))continue;
  current.activated.push(synergy.id);activated.push(synergy);
  if(!seen.has(synergy.id)){seen.add(synergy.id);current.discovered.push(synergy.id);saveSeen()}
 }
 run.synergies=[...current.activated];run.synergyLevels={...current.upgrades};
 if(notify&&activated.length&&state==='play')say('Synergie'+(activated.length>1?'s':'')+' activée'+(activated.length>1?'s':'')+' · '+activated.map(d=>d.name).join(' · '),3.2);
 render();
}
function render(){
 const hud=$('synergyHUD'),list=$('synergyLoadout');if(!hud||!list)return;
 const visible=!!current&&['play','pause'].includes(state)&&(!window.SandboxMode||!!window.WeeklySprint?.active);
 const active=current?current.activated.map(byId).filter(Boolean):[];
 const signature=visible+'|'+active.map(d=>d.id).join(',');if(signature===lastSignature)return;lastSignature=signature;
 hud.classList.toggle('hidden',!visible||!active.length);list.classList.toggle('hidden',!visible||!active.length);
 if(!visible||!active.length){hud.innerHTML='';list.innerHTML='';return}
 const title=active.map(d=>d.name+' — '+d.description).join('\n');
 hud.title=title;hud.setAttribute('aria-label',active.length+' synergie'+(active.length>1?'s':'')+' active'+(active.length>1?'s':'')+' : '+active.map(d=>d.name).join(', '));
 hud.innerHTML='<span>✦ SYNERGIE'+(active.length>1?'S':'')+' · BUILD</span><b>'+active.slice(-2).map(d=>safeText(d.name)).join(' · ')+'</b>'+(active.length>2?'<small>+'+(active.length-2)+' autre'+(active.length>3?'s':'')+'</small>':'');
 list.innerHTML='<small>SYNERGIES DU VOL · SANS BONUS AJOUTÉ</small>'+active.map(d=>'<span title="'+safeText(d.description)+'">✦ '+safeText(d.name)+'</span>').join('');
}
const oldBegin=Journey.begin;Journey.begin=function(...args){const result=oldBegin(...args);newCurrent(false);return result};
const oldRestore=Journey.restore;Journey.restore=function(...args){const result=oldRestore(...args);newCurrent(true);return result};
const oldFinish=Journey.finish;Journey.finish=function(...args){if(current)last=snapshot();const result=oldFinish(...args);current=null;render();return result};
const oldAbandon=Journey.abandon;Journey.abandon=function(...args){if(current)last=snapshot();const result=oldAbandon(...args);current=null;render();return result};
const oldLoadout=updateLoadout;updateLoadout=function(...args){const result=oldLoadout(...args);scan(true);return result};
const oldTick=League.tick;League.tick=function(dt){const result=oldTick(dt);if(state==='play')scan(true);else render();return result};
const css=document.createElement('style');css.textContent=`
.synergy-hud{position:absolute;z-index:3;top:105px;left:13px;max-width:min(330px,58%);padding:7px 9px;border:1px solid #d6ac6c66;border-radius:8px;background:#171222c9;box-shadow:0 5px 18px #08051055;pointer-events:none;text-align:left;backdrop-filter:blur(3px)}
.synergy-hud span{display:block;color:#c5a6d5;font-size:7px;letter-spacing:1.2px}.synergy-hud b{display:block;margin-top:3px;color:#ffd493;font-size:10px;line-height:1.35}.synergy-hud small{display:block;margin-top:2px;color:#b9a4c6;font-size:8px}
.synergy-loadout{margin-top:9px;padding-top:8px;border-top:1px solid #7f5f8133;text-align:left}.synergy-loadout small{display:block;margin-bottom:5px;color:#a893b7;font-size:7px;letter-spacing:.8px}.synergy-loadout span{display:block;margin-top:4px;color:#e8bf88;font-size:9px;line-height:1.4}
.replay-personal-cards{display:contents}.replay-card{width:100%;max-width:720px;margin:10px 0;padding:12px;border:1px solid #8f6d7d66;border-radius:10px;background:linear-gradient(135deg,#2c2039cc,#181422dd);text-align:left}
.replay-card>small{display:block;color:#b79bc7;font-size:8px;letter-spacing:1.3px}.replay-card h3{margin:6px 0;color:#f2cc98;font:600 17px Georgia,serif}.replay-card p{margin:5px 0;color:#c4b1cf;font-size:10px;line-height:1.55}.replay-card .replay-progress{height:5px;margin:9px 0 5px;border-radius:5px;background:#49364f;overflow:hidden}.replay-card .replay-progress i{display:block;height:100%;background:linear-gradient(90deg,#a681cf,#ffc279)}
.replay-synergy-list{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.replay-synergy{padding:8px;border:1px solid #72587355;border-radius:7px;background:#1b1527aa}.replay-synergy b{display:block;color:#f0c58f;font-size:10px}.replay-synergy span{display:block;margin-top:3px;color:#b8a6c5;font-size:9px;line-height:1.45}.replay-synergy em{display:block;margin-top:4px;color:#9ed7bc;font-size:8px;font-style:normal}
.replay-equipment{margin-top:8px;color:#d1b9dc;font-size:9px;line-height:1.55}.replay-empty{color:#aa98b8;font-size:10px;line-height:1.55}.replay-result-actions{margin-top:10px}.replay-result-actions button{min-height:42px}
@media(max-width:850px){.synergy-hud{top:98px;left:8px;max-width:62%;padding:5px 7px}.synergy-hud b{font-size:8px}.synergy-hud span{font-size:6px}.replay-card{padding:10px}.replay-synergy-list{grid-template-columns:1fr}.replay-result-actions{display:grid;grid-template-columns:1fr;width:100%}.replay-result-actions button{width:100%}}
@media(max-height:500px){.synergy-hud{top:58px;max-width:48%}.synergy-hud b{font-size:7px}}
`;document.head.appendChild(css);
document.querySelector('.arena').insertAdjacentHTML('beforeend','<div id="synergyHUD" class="synergy-hud hidden"></div>');
$('badges').insertAdjacentHTML('afterend','<div id="synergyLoadout" class="synergy-loadout hidden"></div>');
window.BuildSynergies={definitions,byId,equipmentNames,snapshot,get current(){return snapshot()},get last(){return last},get discovered(){return[...seen]},scan};
render();
})();
