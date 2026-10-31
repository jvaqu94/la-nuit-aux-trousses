/* Renforcements de fin de monde : quatre choix durables, distincts des reliques de vol. */
(()=>{
'use strict';
const MAX_RANK=4;
let rewardOpen=false;
const catalog=[
 {id:'power',name:'Grimoire de puissance',icon:'✦',art:'bonus-fire',color:'#e8b878'},
 {id:'companion',name:'Compagnon lunaire',icon:'◆',art:'bonus-familiar',color:'#b8dfe5'},
 {id:'armor',name:'Armure des trois balles',icon:'⬟',art:'bonus-pickup-shield',color:'#a9d9c5'},
 {id:'life',name:'Cœur supplémentaire',icon:'♥',art:'bonus-heal',color:'#efb0ae'}
];
function enabled(){return !window.SandboxMode&&!window.Adventure?.training&&!window.WeeklySprint?.active&&['story','ranked','daily'].includes(mode)}
function rank(value){return Number.isFinite(value)?Math.max(0,Math.min(MAX_RANK,Math.floor(value))):0}
function capacityFor(armor){return armor>0?2+armor:0}
function ensure(){
 if(!player.rewards||typeof player.rewards!=='object'||Array.isArray(player.rewards))player.rewards={power:0,companion:0,armor:0,armorCharges:0,life:0,choices:0};
 const r=player.rewards;
 for(const key of ['power','companion','armor','life','choices'])r[key]=rank(r[key]);
 r.armorCharges=Number.isFinite(r.armorCharges)?Math.max(0,Math.min(capacityFor(r.armor),Math.floor(r.armorCharges))):0;
 choiceCount=r.choices;
 return r;
}
function maxLives(){return 5+(enabled()?ensure().life:0)}
function shotDamage(base){return (Number(base)||0)+(enabled()?ensure().power:0)}
function familiarCount(base){return Math.max(0,Math.floor(Number(base)||0))+(enabled()&&ensure().companion?1:0)}
function companionDamage(base){return (Number(base)||0)+(enabled()?Math.max(0,ensure().companion-1):0)}
function art(item){const src=window.CollectibleArt?.art?.[item.art]?.src;return src?`<img src="${src}" alt="" aria-hidden="true">`:`<span class="level-reward-fallback" aria-hidden="true">${item.icon}</span>`}
function detail(item,r){
 if(item.id==='power')return `Tir automatique : <strong>+1 dégât</strong><small>Puissance durable actuelle : +${r.power}</small>`;
 if(item.id==='companion')return r.companion?`Le compagnon gagne <strong>+1 dégât</strong> par tir<small>Un compagnon conservé · niveau ${r.companion}</small>`:`Un compagnon <strong>tire avec toi</strong><small>Conservé dans tous les mondes</small>`;
 if(item.id==='armor')return r.armor?`Armure : <strong>+1 charge</strong> par monde<small>${capacityFor(r.armor)} charges actuellement · recharge au prochain monde</small>`:`Absorbe <strong>3 projectiles</strong> par monde<small>Recharge à chaque nouveau monde</small>`;
 return `<strong>+1 vie</strong> maintenant et +1 vie maximum<small>Maximum actuel : ${5+r.life} vies</small>`;
}
function showChoice(){
 if(!rewardOpen)return false;
 const r=ensure(),next=worlds[Math.min(worlds.length-1,stage+1)];
 overlay(`<section class="level-reward-screen" aria-label="Choix de récompense de fin de monde"><div class="eyebrow">GARDIEN VAINCU · RENFORCEMENT ${Math.min(4,r.choices+1)} / 4</div><h2>Choisis ton<br>compétence.</h2><p>Le gardien est tombé. Choisis un renforcement durable avant d’entrer dans <strong>${safeText(next.name)}</strong>.</p><div class="level-reward-grid">${offered.map((item,i)=>`<button type="button" class="level-reward-card" id="levelReward${i}" style="--reward-color:${item.color}" aria-label="${safeText(item.name)}"><span class="level-reward-key">${i+1}</span><span class="level-reward-art">${art(item)}</span><strong class="level-reward-name">${safeText(item.name)}</strong><span class="level-reward-detail">${detail(item,r)}</span><span class="level-reward-pick">Choisir →</span></button>`).join('')}</div><small class="level-reward-note">Les reliques de vol se déchargent comme avant. Ces compétences restent dans ce vol et dans sa sauvegarde.</small></section>`);
 for(let i=0;i<offered.length;i++){const button=$('levelReward'+i);if(button)button.onclick=()=>takeChoice(i)}
 return true;
}
function openChoice(){
 if(rewardOpen&&state==='choice')return true;
 rewardOpen=true;state='choice';transition=0;offered=catalog.map(item=>({...item}));showChoice();return true;
}
function maybeOpenChoice(){
 if(rewardOpen&&state!=='choice'){rewardOpen=false;offered=[]}
 if(!transitionBoss||stage>=4||state!=='play'||!enabled()||(!pendingBoss&&clears<1))return false;
 return openChoice();
}
function prepareNextWorld(){
 if(!transitionBoss||!enabled())return;
 const r=ensure();if(r.armor)r.armorCharges=capacityFor(r.armor);
}
const baseAdvanceStage=advanceStage;
advanceStage=function(...args){
 if(maybeOpenChoice())return false;
 const boss=transitionBoss;if(boss)prepareNextWorld();
 return baseAdvanceStage(...args);
};
function apply(id){
 const r=ensure();
 if(id==='power')r.power=Math.min(MAX_RANK,r.power+1);
 if(id==='companion')r.companion=Math.min(MAX_RANK,r.companion+1);
 if(id==='armor'){r.armor=Math.min(MAX_RANK,r.armor+1);r.armorCharges=capacityFor(r.armor)}
 if(id==='life'){r.life=Math.min(MAX_RANK,r.life+1);lives=Math.min(5+r.life,lives+1)}
 r.choices=Math.min(MAX_RANK,r.choices+1);choiceCount=r.choices;
}
function takeChoice(choice=0){
 if(!rewardOpen||state!=='choice')return false;
 const index=typeof choice==='string'?offered.findIndex(item=>item.id===choice):Number(choice),item=Number.isInteger(index)?offered[index]:null;
 if(!item)return false;
 apply(item.id);rewardOpen=false;offered=[];state='play';hideOverlay();prepareNextWorld();baseAdvanceStage();updateLoadout();updateHUD();playSfx('pickup',.5,.05);say(item.name+' · '+world.name,2.8);return true;
}
window.takeChoice=takeChoice;
function syncHUD(){
 const el=$('levelRewardsHUD');if(!el)return;
 const r=ensure(),has=r.power||r.companion||r.armor||r.life,visible=enabled()&&has&&['play','pause','choice'].includes(state);
 el.classList.toggle('hidden',!visible);if(!visible)return;
 const parts=[];if(r.power)parts.push('✦ TIR +'+r.power);if(r.companion)parts.push('◆ COMPAGNON N'+r.companion);if(r.armor)parts.push('⬟ '+r.armorCharges+'/'+capacityFor(r.armor)+' BALLES');if(r.life)parts.push('♥ MAX +'+r.life);
 el.textContent=parts.join(' · ');
}
function drawArmor(){
 const r=ensure();if(!enabled()||!r.armor||!['play','pause','choice'].includes(state))return;
 const g=ctx,count=capacityFor(r.armor),step=Math.PI*2/count;g.save();g.lineWidth=2;
 for(let i=0;i<count;i++){const a=-Math.PI/2+i*step;g.strokeStyle=i<r.armorCharges?'#b4e5d2':'#62546b';g.beginPath();g.arc(player.x,player.y,49,a+.06,a+step-.06);g.stroke()}
 if(player.shieldHit>0){g.globalAlpha=Math.min(1,player.shieldHit*4);g.strokeStyle='#e6f4d8';g.lineWidth=3;g.beginPath();g.arc(player.x,player.y,55,0,Math.PI*2);g.stroke()}
 g.restore();
}
const baseHurt=hurt;
hurt=function(n=25,source='une créature de la nuit',detail){
 const r=ensure();
 if(enabled()&&state==='play'&&detail?.kind==='shot'&&r.armorCharges>0&&player.shield<=0&&player.inv<=0&&player.dash<=0){
  r.armorCharges--;player.inv=.45;player.shieldHit=.22;particle(player.x,player.y,'#b4e5d2',12);playSfx('impactLight',.35,.06);tone(480,.1,'triangle',.08);say('Armure · '+r.armorCharges+' charge'+(r.armorCharges>1?'s':'')+' restante'+(r.armorCharges?'':' · prochain monde pour recharger'),1.4);syncHUD();return true;
 }
 return baseHurt(n,source,detail);
};
const baseUpdateLoadout=updateLoadout;
updateLoadout=function(...args){
 const result=baseUpdateLoadout(...args),r=ensure();
 if(r.choices&&$('badges'))$('badges').insertAdjacentHTML('beforeend',`<span class="badge level-reward-badge" title="Compétences de fin de monde">✦ ${r.choices} compétence${r.choices>1?'s':''} de gardien</span>`);
 return result;
};
const baseUpdateHUD=updateHUD;
updateHUD=function(...args){const result=baseUpdateHUD(...args);syncHUD();return result};
const baseDrawGame=drawGame;
drawGame=function(...args){const result=baseDrawGame(...args);drawArmor();return result};
window.addEventListener('keydown',event=>{if(state!=='choice'||event.repeat)return;if(/^[1-4]$/.test(event.key)){event.preventDefault();takeChoice(Number(event.key)-1)}});
const style=document.createElement('style');style.textContent=`
.level-rewards-hud{position:absolute;right:17px;bottom:43px;z-index:3;max-width:calc(100% - 34px);padding:5px 8px;border:1px solid #a8d4c055;border-radius:6px;background:#171323d9;color:#c7e6d6;font:700 8px/1.35 Arial;letter-spacing:.5px;pointer-events:none;text-align:right}
.level-reward-badge{border-color:#c6a16a66;color:#e8c78e!important}.overlay:has(.level-reward-screen){justify-content:flex-start;padding:22px;background:linear-gradient(180deg,#110d22e8,#171126f5);overflow:auto}
.level-reward-screen{width:min(960px,100%);max-height:100%;margin:auto;padding:4px;text-align:center}.level-reward-screen h2{margin:7px 0 10px;font-size:clamp(30px,4.5vw,54px)}.level-reward-screen p{max-width:600px;margin:0 auto 12px;font-size:12px;line-height:1.5}.level-reward-screen p strong{color:#f2cf9b;font-weight:400}
.level-reward-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;width:100%;margin:13px 0}.level-reward-card{position:relative;display:flex;min-width:0;min-height:260px;flex-direction:column;align-items:center;padding:12px 10px 10px;border:1px solid color-mix(in srgb,var(--reward-color) 45%,transparent);border-radius:11px;background:linear-gradient(150deg,#302239ee,#1a1428f5);color:#e9dcee;cursor:pointer;transition:transform .15s,border-color .15s,background .15s}.level-reward-card:hover,.level-reward-card:focus-visible{transform:translateY(-3px);border-color:var(--reward-color);background:#3b2948;outline:none}.level-reward-key{position:absolute;top:8px;left:9px;display:grid;place-items:center;width:20px;height:20px;border:1px solid #b89a6b66;border-radius:5px;color:#eac88f;font:10px Arial}.level-reward-art{display:grid;place-items:center;width:100%;height:108px}.level-reward-art img{display:block;width:100%;height:108px;object-fit:contain}.level-reward-fallback{font-size:60px;color:var(--reward-color)}.level-reward-name{min-height:32px;color:var(--reward-color);font-size:12px;line-height:1.3}.level-reward-detail{display:block;margin-top:9px;color:#c9b9d1;font-size:10px;line-height:1.45}.level-reward-detail strong{color:#f1d4a5;font-weight:700}.level-reward-detail small{display:block;margin-top:7px;color:#9585a6;font-size:8px;line-height:1.4}.level-reward-pick{margin-top:auto;padding-top:12px;color:#f2c887;font-size:10px;font-weight:700}.level-reward-note{display:block;max-width:650px;margin:8px auto 0;color:#9e8cac;font-size:9px;line-height:1.5;letter-spacing:0}
@media(max-width:850px){.level-rewards-hud{right:8px;bottom:53px;font-size:8px}.overlay:has(.level-reward-screen){padding:14px 10px}.level-reward-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.level-reward-card{min-height:205px;padding:9px 8px}.level-reward-art,.level-reward-art img{height:78px}.level-reward-name{font-size:11px;min-height:29px}.level-reward-detail{font-size:10px}.level-reward-detail small{font-size:9px}.level-reward-screen p{font-size:11px}.level-reward-note{font-size:10px}}
@media(max-width:390px){.level-reward-card{min-height:190px;padding:8px 6px}.level-reward-art,.level-reward-art img{height:65px}.level-reward-name{font-size:10px}.level-reward-detail{font-size:9px}.level-reward-detail small{font-size:8px}.level-reward-pick{font-size:9px;padding-top:8px}}
@media(max-height:500px){.overlay:has(.level-reward-screen){padding:9px}.level-reward-screen h2{font-size:28px;margin:3px 0 5px}.level-reward-screen p{margin-bottom:5px;font-size:10px}.level-reward-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:7px 0}.level-reward-card{min-height:145px;padding:6px}.level-reward-art,.level-reward-art img{height:48px}.level-reward-name{font-size:9px;min-height:23px}.level-reward-detail{margin-top:4px;font-size:8px}.level-reward-detail small{display:none}.level-reward-pick{padding-top:5px;font-size:8px}.level-reward-note{display:none}}
`;
document.head.appendChild(style);
if(document.querySelector('.arena')&&!$('levelRewardsHUD'))document.querySelector('.arena').insertAdjacentHTML('beforeend','<div class="level-rewards-hud hidden" id="levelRewardsHUD" aria-live="polite"></div>');
window.LevelRewards={showChoice,takeChoice,maxLives,shotDamage,familiarCount,companionDamage,snapshot:()=>({...ensure()}),get pending(){return rewardOpen},get offers(){return offered}};
ensure();syncHUD();
})();
