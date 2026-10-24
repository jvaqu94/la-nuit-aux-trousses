/* Continuité du combat : fondu du décor seulement, pression progressive. */
(()=>{'use strict';let fade=null;
const oldBackground=drawBackground;
const oldTransition=beginTransition;beginTransition=function(boss=false){if(transition>0)return;const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;oldBackground(ambient);canvas.getContext('2d').drawImage(c,0,0,c.width,c.height,0,0,W,H);oldTransition(boss);fade={image:canvas,from:stage,to:boss?Math.min(4,stage+1):stage,total:transition};};
drawBackground=function(t){if(!fade||state!=='play'&&state!=='pause'){oldBackground(t);return}const p=Math.max(0,Math.min(1,1-transition/fade.total)),a=p*p*(3-2*p),savedStage=stage,savedWorld=world;try{stage=fade.to;world=worlds[stage];oldBackground(t)}finally{stage=savedStage;world=savedWorld}ctx.save();ctx.globalAlpha=1-a;ctx.drawImage(fade.image,0,0,W,H);ctx.globalAlpha=fade.from===fade.to?Math.sin(Math.PI*p)*.14:0;ctx.fillStyle='#352941';ctx.fillRect(0,0,W,H);ctx.restore();if(transition<=0)fade=null};
const begin=Journey.begin,restore=Journey.restore;Journey.begin=function(...a){fade=null;begin(...a)};Journey.restore=function(...a){fade=null;restore(...a)};
window.FlightFlow={get fade(){return fade}};
})();
