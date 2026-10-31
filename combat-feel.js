/* Confort de combat : lisibilité, apprentissage de l’esquive et présentation.
   Aucun réglage de dégâts, de vitesse, de PV ou de collision n’est modifié ici. */
(()=>{
'use strict';
let guideThreat=null,success=null,dashVisual=null,dashCredit=false,localGuideDone=false,lastChampion=-99,lastCoachKey='',lastTime=0;
const coach=document.createElement('div');coach.id='dodgeCoach';coach.className='dodge-coach hidden';coach.setAttribute('role','status');coach.setAttribute('aria-live','polite');document.querySelector('.arena').appendChild(coach);
const css=document.createElement('style');css.textContent=`
.dodge-coach{position:absolute;z-index:5;top:126px;left:50%;transform:translateX(-50%);width:min(390px,88%);padding:10px 14px;border:1px solid #f2ca8caa;border-radius:10px;background:#191326ed;box-shadow:0 8px 28px #08050f88;pointer-events:none;text-align:center;backdrop-filter:blur(4px)}
.dodge-coach b{display:block;color:#ffe0a9;font-size:12px;letter-spacing:.7px;line-height:1.35}.dodge-coach span{display:block;color:#e4d6ec;font-size:11px;line-height:1.45;margin-top:4px}
#dash.dash-ready{border-color:#c9b6f2;color:#f2e8ff;background:linear-gradient(145deg,#49345f,#2d213e)}
#dash.dash-coach{border-color:#ffe0a1;color:#fff3d4;background:linear-gradient(145deg,#725042,#3d2940);animation:dashCoachPulse .48s ease-in-out infinite alternate}
#dash small{display:none}
@keyframes dashCoachPulse{from{box-shadow:0 0 0 0 #ffda8a22}to{box-shadow:0 0 0 5px #ffda8a38,0 0 22px #ffc56e55}}
.replay-mode #dodgeCoach,.dawn-flight #dodgeCoach,.arena:has(.overlay:not(.hidden)) #dodgeCoach{display:none!important}
@media(max-width:850px){
.dodge-coach{top:124px;padding:11px 13px;width:min(410px,91%)}.dodge-coach b{font-size:13px}.dodge-coach span{font-size:12px}.bossbar small{font-size:12px}.bossbar .phase{font-size:11px}
#dash{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:96px;line-height:1.05}#dash small{display:block;margin-top:4px;color:#d9c9e8;font-size:7px;font-weight:400;letter-spacing:0;white-space:nowrap}#dash.dash-ready small{color:#fff0ba}
.touchbar[data-touch-layout=left]{justify-content:flex-start}.touchbar[data-touch-layout=left] #specialCast{order:1;flex:0 1 150px;max-width:46%}.touchbar[data-touch-layout=left] #dash{order:2;flex:0 0 auto}.touchbar[data-touch-layout=left] #hint{order:3}.touchbar[data-touch-layout=left] #pause{order:4;margin-left:auto}
.touchbar[data-touch-layout=right]{justify-content:flex-end}.touchbar[data-touch-layout=right] #pause{order:1;margin-right:auto}.touchbar[data-touch-layout=right] #hint{order:2}.touchbar[data-touch-layout=right] #specialCast{order:3;flex:0 1 150px;max-width:46%}.touchbar[data-touch-layout=right] #dash{order:4;flex:0 0 auto}
}
@media(max-height:500px){.dodge-coach{top:112px;padding:6px 9px;width:min(390px,76%)}.dodge-coach b{font-size:11px}.dodge-coach span{font-size:10px;margin-top:2px}}
`;document.head.appendChild(css);

const championProfiles={
 spider:['REINE TISSEUSE','toiles ralentissantes'],skull:['OSSUAIRE VIVANT','volées d’os'],bone:['OSSUAIRE VIVANT','volées d’os'],
 pumpkin:['COURGE ANCIENNE','flammes en éventail'],vampire:['VAMPIRE ÉCARLATE','projectiles sanguins'],
 zombie:['REVENANT PESTILENT','projectiles de poison'],demon:['DÉMON DES BRUMES','malédictions et éclats'],
 ghost:['SPECTRE ERRANT','trajectoire flottante'],bat:['ESSAIM NOCTURNE','vol et tirs sanguins'],lantern:['PORTE-LANTERNE','malédictions de formation']
};
const quick={rocket:'GUIDÉS · '+MINUIT_BALANCE.missiles.duration+' s',fragment:'ROQUETTE → 8 TIRS',chain:'+1 EXPLOSION',flame:'POISON + TOILES',poison:'DÉGÂTS CONTINUS',spread:'POISON CONTAGIEUX',fire:'TIR RENFORCÉ',familiar:'+1 COMPAGNON',pierce:'+1 TRAVERSÉE',laser:'RAYON AUTOMATIQUE'};
function shortEffect(key){return quick[key]||'EFFET MAGIQUE'}
function effect(key){
 const rank=upgrades[key]||0;
 if(key==='rocket')return rank+' missile'+(rank>1?'s':'')+' guidé'+(rank>1?'s':'')+' toutes les 2,25 s · '+MINUIT_BALANCE.missiles.duration+' s';
 if(key==='fragment')return 'chaque roquette libère 8 tirs en cercle';
 if(key==='chain')return 'une seconde explosion frappe un ennemi proche';
 if(key==='flame')return 'les explosions empoisonnent et brûlent les toiles';
 if(key==='poison')return 'les tirs infligent des dégâts continus';
 if(key==='spread')return 'les ennemis vaincus contaminent leurs proches';
 if(key==='fire')return rank>=3?'double tir, en plus de la cadence et des dégâts':rank===2?'dégâts des tirs ×2':'tirs plus rapides';
 if(key==='familiar')return rank+' compagnon'+(rank>1?'s':'')+' tire'+(rank>1?'nt':'')+' avec toi';
 if(key==='pierce')return 'chaque tir traverse '+rank+' ennemi'+(rank>1?'s':'')+' supplémentaire'+(rank>1?'s':'');
 if(key==='laser')return 'un rayon vertical frappe automatiquement';
 return 'effet actif pour ce vol';
}
function guideDone(){return window.Journey?!!Journey.state.dodgeGuideDone:localGuideDone}
function completeGuide(){localGuideDone=true;window.Journey?.completeDodgeGuide?.()}
function hideCoach(){coach.classList.add('hidden');lastCoachKey=''}
function reset(){guideThreat=null;success=null;dashVisual=null;dashCredit=false;lastChampion=-99;lastTime=0;hideCoach();const dash=$('dash');dash?.classList.remove('dash-ready','dash-coach')}

/* Les champions existants deviennent de vraies rencontres annoncées, sans
   toucher à leurs statistiques ni à leur fréquence d’apparition. */
const spawnBase=spawnEnemy;spawnEnemy=function(d){const count=enemies.length;spawnBase(d);if(enemies.length<=count)return;const e=enemies[enemies.length-1];if(!e||e.tier!==2||e.boss||e.rival)return;const profile=championProfiles[e.kind]||['CHAMPION DES OMBRES','salves renforcées'];e.championName=profile[0];e.championHint=profile[1];if(!e.coop&&gameTime-lastChampion>=2.8){lastChampion=gameTime;say('CHAMPION · '+profile[0]+' · '+profile[1],3,e.kind);tone(118,.2,'triangle',.055,.55);noiseBurst(.09,.012,260)}};

/* Le nom seul ne suffit pas : l’effet utile est annoncé au ramassage. */
const collectBase=collectUpgrade;collectUpgrade=function(d){const wasTaken=d?.taken,beforeRank=d?.key?upgrades[d.key]:0,beforeScore=score,result=collectBase(d),def=upgradeDefs.find(v=>v[0]===d?.key);if(!wasTaken&&def){if(d.key!=='rocket'&&beforeRank===upgrades[d.key]&&score>beforeScore)say(def[2]+' · rang maximum · points bonus',3,'bonus-'+d.key);else say(def[2]+' · '+effect(d.key),3.8,'bonus-'+d.key)}return result};

/* Une salve ne crédite qu’une esquive précise, même avec plusieurs projectiles. */
function onDodge(){dashCredit=false;const duration=dashInv();dashVisual={life:duration,max:duration,sample:0,ghosts:[{x:player.x,y:player.y,life:.28,max:.28}]}}
function perfectDodge(){if(dashCredit)return;const first=!guideDone();dashCredit=true;success={x:player.x,y:player.y,life:.55,max:.55};guideThreat=null;hideCoach();window.League?.event?.('perfectDodges',1);if(first){completeGuide();say('ESQUIVE RÉUSSIE · tir traversé sans dégâts',2.8,'dodge')}particle(player.x,player.y,'#d9f5ff',10);tone(920,.13,'sine',.06,1.35);noiseBurst(.07,.012,1450)}
const hurtBase=hurt;hurt=function(n,source,detail){const precise=state==='play'&&player.dash>0&&detail?.kind==='shot',result=hurtBase(n,source,detail);if(precise)perfectDodge();return result};

function threatTime(b){
 const rx=b.x-player.x,ry=b.y-player.y,vx=b.vx||0,vy=b.vy||0,a=vx*vx+vy*vy;if(a<1)return null;
 const radius=(b.r||7)+18,c=rx*rx+ry*ry-radius*radius,q=2*(rx*vx+ry*vy);if(c<=0)return 0;if(q>=0)return null;
 const disc=q*q-4*a*c;if(disc<0)return null;const t=(-q-Math.sqrt(disc))/(2*a);return t>=0&&t<=1.25?t:null;
}
function nearestThreat(){let best=null;for(const b of hostile){if(b.life<=0)continue;const time=threatTime(b);if(time!==null&&(!best||time<best.time))best={b,time}}return best}
function dashInv(){return window.Arsenal?.dashInv?.()||.45}
function syncCoach(){
 if(!guideThreat||guideDone()||state!=='play')return hideCoach();
 const ready=player.dashCD<=0,now=ready&&guideThreat.time<=Math.max(.3,dashInv()),mode=!ready?'wait':now?'now':'prepare',key=mode+(ready?'':'-'+Math.ceil(player.dashCD));if(key===lastCoachKey&&!coach.classList.contains('hidden'))return;lastCoachKey=key;
 const touch=window.matchMedia?.('(pointer:coarse)').matches||innerWidth<=850,action=touch?'Touche ESQUIVE':'Appuie sur ESPACE';
 coach.innerHTML=mode==='wait'?'<b>ESQUIVE EN RECHARGE · '+Math.ceil(player.dashCD)+' s</b><span>Déplace-toi hors de la trajectoire et attends qu’elle soit prête.</span>':mode==='now'?'<b>ESQUIVE MAINTENANT</b><span>Tir ciblé : '+action+' · '+dashInv().toFixed(2).replace('.',',')+' s sans dégâts.</span>':'<b>TIR EN APPROCHE · PRÉPARE L’ESQUIVE</b><span>'+action+' quand l’anneau se referme, pas trop tôt.</span>';
 coach.classList.remove('hidden');
}
function syncTouchLayout(){const bar=document.querySelector('.touchbar');if(!bar)return;const layout=['left','right'].includes(prefs.touchLayout)?prefs.touchLayout:'left';if(bar.dataset.touchLayout!==layout)bar.dataset.touchLayout=layout}
function syncDash(){syncTouchLayout();const dash=$('dash');if(!dash)return;const ready=state==='play'&&player.dashCD<=0,now=ready&&guideThreat&&guideThreat.time<=Math.max(.3,dashInv());dash.classList.toggle('dash-ready',ready);dash.classList.toggle('dash-coach',!!now);dash.setAttribute('aria-disabled',String(!ready));dash.title=ready?'Esquive prête : bond rapide + '+dashInv().toFixed(2)+' s sans dégâts. Utilise-la au contact d’un tir.':'Esquive en recharge : '+Math.max(0,player.dashCD).toFixed(1)+' s';dash.setAttribute('aria-label',ready?'Esquive prête · bond rapide · '+dashInv().toFixed(2)+' secondes de protection':'Esquive en recharge · '+Math.ceil(player.dashCD)+' secondes')}
const hudBase=updateHUD;updateHUD=function(){hudBase();syncDash()};
const updateBase=update;update=function(dt){updateBase(dt);if(gameTime<lastTime)reset();lastTime=gameTime;if(dashVisual){dashVisual.life=Math.max(0,dashVisual.life-dt);dashVisual.sample-=dt;if(player.dash>0&&dashVisual.sample<=0){dashVisual.ghosts.unshift({x:player.x,y:player.y,life:.28,max:.28});dashVisual.ghosts.length=Math.min(5,dashVisual.ghosts.length);dashVisual.sample=.045}for(const ghost of dashVisual.ghosts)ghost.life-=dt;dashVisual.ghosts=dashVisual.ghosts.filter(ghost=>ghost.life>0);if(dashVisual.life<=0&&!dashVisual.ghosts.length)dashVisual=null}if(success){success.life-=dt;if(success.life<=0)success=null}guideThreat=state==='play'&&window.GuidedTraining?.showProjectileCue?nearestThreat():null;if(window.GuidedTraining?.showCoach)syncCoach();else hideCoach();syncDash()};

function drawDashTrail(g){
 if(!dashVisual)return;
 const ghosts=dashVisual.ghosts;
 g.save();g.lineCap='round';
 for(let i=ghosts.length-1;i>=0;i--){const from=ghosts[i],to=i?ghosts[i-1]:player,alpha=Math.max(0,from.life/from.max);g.globalAlpha=.08+alpha*.2;if(Math.hypot(to.x-from.x,to.y-from.y)>2)line(g,from.x,from.y,to.x,to.y,'#9de7ff',3+alpha*6)}
 g.restore();
 for(const ghost of ghosts){const alpha=Math.max(0,ghost.life/ghost.max);g.save();g.globalAlpha=.08+alpha*.27;sprite(g,'witch',ghost.x,ghost.y,1.15,ambient,0,'brightness(1.45) saturate(.55)');g.restore()}
}
function drawEnemy(g,e){
 if(e.dead||e.rival||e.node||!(e.fire>0&&e.fire<.45)||e.y<80||e.y>560)return;
 if(e.boss&&(e.y<160||e.phaseShield>0||e.charge))return;if(!e.boss&&!e.lantern&&(wave<3&&stage===0))return;
 const colors={spider:'#bceeff',skull:'#f4e2bd',bone:'#f4e2bd',pumpkin:'#ffb36e',vampire:'#ff91aa',zombie:'#c5f28e',demon:'#e5b4ff',ghost:'#c7f2f2',bat:'#ff91aa',lantern:'#e5b4ff'},p=1-e.fire/.45;
 g.save();g.globalAlpha=.3+p*.65;g.strokeStyle=colors[e.kind]||'#edc0ff';g.lineWidth=2+p*1.5;g.setLineDash([5,4]);g.beginPath();g.arc(e.x,e.y,e.r+10+(1-p)*8,0,Math.PI*2);g.stroke();g.restore();
}
function draw(g){
 if(state!=='play'){guideThreat=null;hideCoach();syncDash();return}
 if(guideThreat&&hostile.includes(guideThreat.b)){const {b,time}=guideThreat,p=Math.max(0,Math.min(1,time/1.25));g.save();g.strokeStyle=time<=dashInv()?'#fff0b9':'#f2c987';g.lineWidth=2.5;g.globalAlpha=.7+.25*Math.sin(ambient*14);g.beginPath();g.arc(b.x,b.y,(b.r||7)+7+p*25,0,Math.PI*2);g.stroke();g.restore()}
 if(dashVisual?.life>0){const remain=Math.max(0,Math.min(1,dashVisual.life/dashVisual.max)),elapsed=1-remain;g.save();g.fillStyle='#9de7ff';g.globalAlpha=.055+.07*remain;g.beginPath();g.arc(player.x,player.y,42,0,Math.PI*2);g.fill();g.strokeStyle='#bfefff';g.lineWidth=4;g.globalAlpha=.35+.5*remain;g.beginPath();g.arc(player.x,player.y,44+Math.sin(ambient*20)*2,0,Math.PI*2);g.stroke();g.strokeStyle='#fff0ae';g.lineWidth=3;g.globalAlpha=.95;g.beginPath();g.arc(player.x,player.y,49,-Math.PI/2,-Math.PI/2+Math.PI*2*remain);g.stroke();if(elapsed<.6){g.strokeStyle='#c8f5ff';g.lineWidth=3;g.globalAlpha=(1-elapsed/.6)*.7;g.beginPath();g.arc(player.x,player.y,40+elapsed*105,0,Math.PI*2);g.stroke()}g.fillStyle='#effcff';g.globalAlpha=Math.min(1,remain*4);g.font='bold '+(compactView()?19:15)+'px Arial';g.textAlign='center';g.fillText('ESQUIVE · PROTÉGÉE',player.x,player.y-66);g.restore()}
 if(success){const p=1-success.life/success.max;g.save();g.globalAlpha=Math.max(0,success.life/success.max);g.strokeStyle='#dff8ff';g.fillStyle='#effcff';g.lineWidth=3;g.beginPath();g.arc(success.x,success.y,25+p*65,0,Math.PI*2);g.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=28+p*45;line(g,success.x+Math.cos(a)*r,success.y+Math.sin(a)*r,success.x+Math.cos(a)*(r+12),success.y+Math.sin(a)*(r+12),'#e8fbff',2)}g.font='bold '+(compactView()?22:17)+'px Arial';g.textAlign='center';g.fillText('ESQUIVE !',success.x,success.y-48-p*22);g.restore()}
}
const begin=window.Journey?.begin,restore=window.Journey?.restore;if(begin)Journey.begin=function(...a){reset();return begin(...a)};if(restore)Journey.restore=function(...a){reset();return restore(...a)};
const startBase=start;start=function(...a){reset();return startBase(...a)};const resumeBase=resumeCheckpoint;resumeCheckpoint=function(...a){reset();return resumeBase(...a)};
syncTouchLayout();
window.CombatFeel={shortEffect,effect,draw,drawEnemy,drawDashTrail,nearestThreat,reset,onDodge,syncTouchLayout,get dashVisual(){return dashVisual},get guideThreat(){return guideThreat},get success(){return success}};
})();
