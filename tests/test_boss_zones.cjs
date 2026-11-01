const fs=require('fs');
const context=new Proxy({createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),measureText:s=>({width:s.length*6})},{get:(o,k)=>o[k]||(()=>{})});
const els={},store={};
function element(id){return els[id]||(els[id]={id,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},innerHTML:'',textContent:'',getContext:()=>context,getBoundingClientRect:()=>({width:800,height:900}),addEventListener(){},insertAdjacentHTML(){},setAttribute(){},closest:()=>({style:{}})})}
global.window={addEventListener(){}};
global.document={head:{insertAdjacentHTML(){},appendChild(){}},body:{innerHTML:'',classList:{add(){},remove(){},toggle(){}}},getElementById:element,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){},createElement:()=>({getContext:()=>context,textContent:''})};
global.localStorage={getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=String(v),removeItem:k=>delete store[k]};
global.devicePixelRatio=1;global.requestAnimationFrame=()=>{};global.fetch=()=>Promise.resolve({json:()=>Promise.resolve({token:'test'})});global.navigator={getGamepads:()=>[]};global.confirm=()=>true;
const assert=(condition,message)=>{if(!condition)throw Error(message)};
eval(fs.readFileSync('game.js','utf8')+`\n
start('story');
function reset(){
 state='play';stage=0;world=worlds[0];wave=1;waveTime=0;gameTime=0;transition=0;pendingBoss=false;
 enemies=[];hostile=[];shots=[];rockets=[];drops=[];hazards=[];obstacles=[];gates=[];scares=[];particles=[];
 schedule=[{time:9999}];spawnIndex=0;routeTimer=9999;obstacleTimer=9999;scareTimer=9999;
 lives=3;player.x=400;player.y=600;player.inv=0;player.dash=0;player.shield=0;player.shieldTime=0;player.slow=0;
 player.fire=999;player.rocket=999;player.laser=999;player.missileTime=0;player.candy=0;pointer=null;moveInput={};
}
function groundZone(type){reset();hazards=[{type,x:400,y:600,r:80,age:2,warn:1,life:5,tick:0}];update(1/60)}
groundZone('flame');
assert(lives===2,'la flamme du premier gardien doit toujours blesser');
groundZone('glare');
assert(lives===2,'les zones d’éclat des autres gardiens doivent blesser');
assert(lastDamage==='l’éclat maléfique','la cause de l’éclat doit être identifiable');
groundZone('web');
assert(lives===3,'une toile au sol ne doit retirer aucune vie');
assert(player.slow>.99&&player.slow<=1,'la toile au sol doit laisser une seconde de ralentissement');
assert(document.getElementById('graze').textContent==='TOILE −50 %','le HUD doit rendre le ralentissement visible');
reset();hostile=[{x:400,y:600,vx:0,vy:0,r:13,damage:25,type:'web',life:5,speed:0,age:1,homing:false}];update(1/60);
assert(lives===3,'un projectile de toile ne doit retirer aucune vie');
assert(player.slow>.99&&player.slow<=1,'le projectile de toile doit ralentir');
assert(hostile.length===0,'le projectile de toile disparaît après contact');
reset();hostile=[{x:400,y:600,vx:0,vy:0,r:7,damage:25,type:'fire',life:5,speed:0,age:1,homing:false}];update(1/60);
assert(lives===2,'les autres projectiles doivent conserver leurs dégâts');
function travel(slowed){
 reset();player.slow=slowed?1:0;moveInput[prefs.keys.right.toLowerCase()]=true;
 const before=player.x;update(1/60);return player.x-before;
}
const normal=travel(false),slowed=travel(true);
assert(normal>0&&Math.abs(slowed/normal-WEB_SPEED_FACTOR)<1e-9,'la vitesse sous toile doit être exactement réduite de moitié');
function pointerTravel(slowed){
 reset();player.slow=slowed?1:0;pointer={x:700,y:600};
 const before=player.x;update(1/60);return player.x-before;
}
const pointerNormal=pointerTravel(false),pointerSlowed=pointerTravel(true);
assert(pointerNormal>0&&Math.abs(pointerSlowed/pointerNormal-WEB_SPEED_FACTOR)<1e-9,'le suivi tactile doit aussi être réduit de moitié');
console.log('Zones de boss : flamme et éclat blessent, toiles non létales, ralentissement clavier/tactile de 50 % et HUD OK');
`);
