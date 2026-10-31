const fs=require('fs');
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{})});
const els={},store={};
function element(id){return els[id]||(els[id]={id,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',getContext:()=>context,getBoundingClientRect:()=>({width:800,height:900}),addEventListener(){},insertAdjacentHTML(){},setAttribute(){},closest:()=>({style:{}})})}
global.window={addEventListener(){}};
global.document={head:{insertAdjacentHTML(){},appendChild(){}},body:{innerHTML:'',classList:{add(){},remove(){},toggle(){}}},getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:()=>({getContext:()=>context,textContent:''})};
global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
global.devicePixelRatio=1;global.requestAnimationFrame=()=>{};global.fetch=()=>Promise.resolve({json:()=>Promise.resolve({token:'test'})});global.navigator={getGamepads:()=>[]};global.confirm=()=>true;
const assert=(condition,message)=>{if(!condition)throw Error(message)};
eval(fs.readFileSync('game.js','utf8')+'\n'+fs.readFileSync('level-rewards.js','utf8')+`
start('story');
enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];gates=[];wave=5;spawnBoss();
const first=enemies.find(e=>e.boss);first.y=210;reward(first);
for(let i=0;i<180&&state==='play';i++){player.inv=100;update(1/60)}
assert(state==='choice','le premier gardien doit ouvrir le choix');
assert(stage===0&&offered.length===4&&window.LevelRewards.pending,'quatre récompenses après le premier gardien');
assert(document.getElementById('overlay').innerHTML.includes('Grimoire de puissance'),'carte de tir affichée');
window.takeChoice(0);
assert(state==='play'&&stage===1&&wave===1,'le choix doit ouvrir le deuxième monde');
assert(player.rewards.power===1&&window.LevelRewards.shotDamage(1)===2,'tir renforcé');
let cp=JSON.parse(store['minuit-checkpoint']);assert(cp.stage===1&&cp.player.rewards.power===1,'récompense dans le checkpoint');
function chooseAt(nextStage,index){stage=nextStage;world=worlds[nextStage];wave=5;transitionBoss=true;pendingBoss=true;state='play';advanceStage();assert(state==='choice','choix au monde '+nextStage);window.takeChoice(index);assert(stage===nextStage+1,'transition après choix');}
chooseAt(1,1);assert(window.LevelRewards.familiarCount(0)===1,'compagnon persistant');
chooseAt(2,2);assert(player.rewards.armorCharges===3,'armure initialisée à trois balles');
player.shield=0;player.shieldTime=0;player.dash=0;const before=lives;
for(let i=0;i<3;i++){player.inv=0;hurt(25,'test',{kind:'shot'});assert(lives===before,'armure absorbe le projectile '+(i+1))}
assert(player.rewards.armorCharges===0,'trois charges consommées');player.inv=0;hurt(25,'test',{kind:'shot'});assert(lives===before-1,'quatrième projectile sans armure');
chooseAt(3,3);assert(player.rewards.life===1&&window.LevelRewards.maxLives()===6,'vie et maximum augmentés');
saveCheckpoint();player.rewards={power:0,companion:0,armor:0,armorCharges:0,life:0,choices:0};resumeCheckpoint();
const restored=window.LevelRewards.snapshot();assert(restored.power===1&&restored.companion===1&&restored.armor===1&&restored.life===1&&restored.choices===4,'reprise des quatre récompenses');
const oldEnd=end;end=win=>{state='end'};stage=4;world=worlds[4];wave=5;enemies=[];const final={boss:true,x:400,y:210,hp:0,max:900,r:52,kind:'demon',dead:false,lossStart:0};enemies.push(final);reward(final);assert(state==='end'&&!window.LevelRewards.pending,'pas de choix après la victoire finale');end=oldEnd;
start('story');enemies=[];hostile=[];shots=[];drops=[];hazards=[];obstacles=[];upgrades.familiar=0;
player.rewards.companion=3;assert(window.LevelRewards.familiarCount(0)===3,'chaque choix de compagnon ajoute un compagnon');
assert(window.LevelRewards.familiarCount(2)===5,'les compagnons de gardien s’ajoutent aux familiers de reliques');
assert(window.LevelRewards.companionDamage(1)===1,'le rang ne cumule plus un bonus de dégâts sur chaque compagnon');
player.x=400;player.y=780;const left=companionFormation(0,4,0),right=companionFormation(1,4,0);
assert(left.x===360&&right.x===440&&!left.orbital&&!right.orbital,'les deux premiers compagnons encadrent la sorcière');
for(const i of [2,3]){const p=companionFormation(i,4,0),radius=Math.hypot((p.x-player.x)/64,(p.y-player.y)/48);assert(p.orbital&&Math.abs(radius-1)<1e-9,'le compagnon '+(i+1)+' suit l’orbite')}
const orbitStart=companionFormation(2,4,0),orbitLater=companionFormation(2,4,1);assert(orbitStart.x!==orbitLater.x||orbitStart.y!==orbitLater.y,'l’orbite est animée');
player.rewards.companion=2;stage=1;world=worlds[1];wave=5;transitionBoss=true;pendingBoss=true;state='play';advanceStage();assert(state==='choice','le troisième choix ouvre les récompenses');assert(document.getElementById('overlay').innerHTML.includes('rejoint l’orbite'),'la carte annonce le compagnon orbital');window.takeChoice(1);assert(player.rewards.companion===3,'le troisième choix ajoute bien un troisième compagnon');
player.fire=0;shots=[];ambient=0;update(1/60);const familiarShots=shots.filter(s=>s.familiar);
assert(familiarShots.length===3,'chaque compagnon tire');assert(familiarShots.every(s=>s.damage===1),'les tirs gardent leurs dégâts de base');
for(let i=0;i<3;i++)assert(Math.abs(familiarShots[i].x-companionFormation(i,3,ambient).x)<1e-9,'le tir '+(i+1)+' part de la position visible du compagnon');
console.log('Récompenses : quatre cartes, compagnons cumulés sur les côtés et en orbite, tirs positionnés, armure, vie, checkpoint et victoire finale OK');
`);
