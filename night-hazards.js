/* Obstacles renforcés, charges télégraphiées et bonbons identifiables. */
(()=>{
'use strict';
function moveBoss(e,dt,oldPX=player.x,oldPY=player.y){
 e.exposed=Math.max(0,(e.exposed||0)-dt);
 if(!e.charge){if(e.phase!==3||e.phaseShield>0||e.y<160)return false;e.chargeWait=Math.max(0,(e.chargeWait??.7)-dt);if(e.chargeWait>0)return false;
 let tx=Math.max(85,Math.min(W-85,player.x+(rng()-.5)*110));if(e.kind==='spider'&&Math.abs(tx-e.x)<140)tx=Math.max(85,Math.min(715,e.x+(e.x>=400?-180:180)));const ty=Math.max(510,Math.min(e.kind==='demon'?750:850,player.y+75));
 e.charge={mode:'warn',round:1,time:0,sx:e.x,sy:e.y,tx,ty,homeX:e.x,fakeX:tx<400?Math.min(715,tx+250):Math.max(85,tx-250)};if(stage<2)say(({pumpkin:'CHARGE LOURDE',skull:'CHARGE D’OS',vampire:'DORÉ = CHARGE · VIOLET = LEURRE',spider:'CHARGE DIAGONALE',demon:'DOUBLE CHARGE'})[e.kind]||'CHARGE · ESQUIVE',1.8);if(stage<2)tone(150,.22,'triangle',.09,.65)
 }
 const c=e.charge,ox=e.x,oy=e.y,wasDiving=c.mode==='dive';c.time+=dt;
 if(c.mode==='recover'){if(c.time>=1.4){e.charge=null;e.chargeWait=7;e.fire=Math.max(e.fire,1.3)}return true}
 if(c.mode==='warn'){if(c.time>=(stage>=2?0:stage===1?.65:e.kind==='vampire'?1.45:c.round===2?.9:1.15)){c.mode='dive';c.time=0;c.dodged=false}return true}
 if(c.mode==='dive'){
 const distance=Math.hypot(c.tx-e.x,c.ty-e.y),step=((e.kind==='pumpkin'?440:e.kind==='demon'?570:500)*(1+stage*.14))*dt;
 if(distance<=step){e.x=c.tx;e.y=c.ty;c.mode='return';c.time=0;
 if(e.kind==='spider')hazards.push({type:'web',x:e.x,y:e.y-35,r:72,age:0,warn:.6,life:4,tick:0});
 }else{e.x+=(c.tx-e.x)/distance*step;e.y+=(c.ty-e.y)/distance*step}
 if(e.kind==='skull')window.Adventure?.trail?.(e,ox,oy);
 }else{
 const homeY=e.kind==='demon'&&c.round===1?380:210,distance=Math.hypot(c.homeX-e.x,homeY-e.y),step=(330+stage*40)*dt;
 if(distance<=step){e.x=c.homeX;e.y=homeY;
 if(e.kind==='demon'&&c.round===1){c.round=2;c.mode='warn';c.time=0;c.sx=e.x;c.sy=e.y;c.tx=Math.max(85,Math.min(715,player.x+(rng()-.5)*90));c.ty=Math.min(850,player.y+55);if(stage<2)say('DEUXIÈME CHARGE · ESQUIVE !',1.2);return true}
 if(e.kind==='pumpkin'){c.mode='recover';c.time=0;e.exposed=1.4;say('Le roi creux reprend son souffle · vulnérable !',1.4);return true}
 e.charge=null;e.chargeWait=Math.max(3.2,7-stage*.9);e.fire=Math.max(e.fire,1.3);return true}
 e.x+=(c.homeX-e.x)/distance*step;e.y+=(homeY-e.y)/distance*step
 }
 const sx=ox-oldPX,sy=oy-oldPY,dx=(e.x-player.x)-sx,dy=(e.y-player.y)-sy,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,-(sx*dx+sy*dy)/length)):0,distance=Math.hypot(sx+t*dx,sy+t*dy);
 if((c.mode==='dive'||wasDiving)&&distance<e.r+18&&player.dash>0&&!c.dodged){c.dodged=true;League.event('perfectDodges',1);say('Esquive précise !',1.5)}
 if(distance<e.r+6)hurt(35,c.mode==='return'?'le retour du gardien':'la charge du gardien',{kind:'boss',x:e.x,y:e.y,r:e.r});return true
}
function spawnCandy(type=null,x=null,y=-28){const roll=rng(),kind=type||(roll<.45?'xp':roll<.75?'points':'shield');const candy={kind:'sweet',sweetType:kind,x:x??(80+rng()*640),y,age:0,xp:10+stage*3,points:150+stage*75,taken:false};drops.push(candy);return candy}
function collectCandy(d){if(d.taken)return false;d.taken=true;League.event('candies',1);
 if(d.sweetType==='xp'){const before=Journey.state.xp;League.event('candyXP',d.xp||10);const gain=Journey.state.xp-before;say(gain>0?'BONBON VIOLET · +'+gain+' XP':'BONBON VIOLET · XP déjà conservée à la reprise',2.5)}
 else if(d.sweetType==='points'){score+=d.points||150;say('BONBON DORÉ · +'+(d.points||150)+' points',2.5)}
 else{if(player.shield>=50&&player.shieldTime>=8){score+=100;say('BONBON TURQUOISE · bouclier déjà chargé · +100 points',2.5)}else{player.shield=Math.max(player.shield,50);player.shieldTime=Math.max(player.shieldTime,8);say('BONBON TURQUOISE · bouclier 50 · 8 secondes',2.5)}}
 particle(d.x,d.y,d.sweetType==='xp'?'#c7a0f3':d.sweetType==='points'?'#ffce84':'#88e3ce',12);return true
}
function tick(){if(window.SandboxMode)return;if(state!=='play'||transition>0||enemies.some(e=>e.boss)||!Journey.run)return;const key=stage+'-'+wave,r=Journey.run;r.sweets??={key,mask:0};if(r.sweets.key!==key)r.sweets={key,mask:0};for(let i=0;i<2;i++){if(waveTime<(i?13:5)||r.sweets.mask&(1<<i))continue;r.sweets.mask|=1<<i;if(drops.filter(d=>d.kind==='sweet').length>=4)continue;let x=80+rng()*640;for(let tries=0;tries<5&&obstacles.some(o=>!o.dead&&o.y<180&&Math.abs(o.x-x)<o.r+50);tries++)x=80+rng()*640;spawnCandy(i===0?'xp':null,x)}}
function drawCandy(g,d,t){if(window.CollectibleArt){const bob=Math.sin(t*2+d.x)*2;if(CollectibleArt.draw(g,d.sweetType,d.x,d.y+bob,90,80)){const label=d.sweetType==='xp'?'+'+(d.xp||10)+' XP · COLLECTION':d.sweetType==='points'?'+'+(d.points||150)+' POINTS':'BOUCLIER 50 · 8 s';CollectibleArt.label(g,label,d.x,d.y+46,d.sweetType==='xp'?'#d5b8e5':d.sweetType==='points'?'#efd39e':'#b6e1d0',12);return}}const color=d.sweetType==='xp'?'#c4a0f5':d.sweetType==='points'?'#ffcc7c':'#8be2ce',label=d.sweetType==='xp'?'+'+(d.xp||10)+' XP':d.sweetType==='points'?'+'+(d.points||150):'BOUCLIER';g.save();g.translate(d.x,d.y+Math.sin(t*3+d.x)*3);g.rotate(Math.sin(t*2)*.10);g.fillStyle=color+'55';g.strokeStyle=color;g.lineWidth=1.7;for(const side of [-1,1]){g.beginPath();g.moveTo(side*11,0);g.lineTo(side*25,-10);g.lineTo(side*22,0);g.lineTo(side*25,10);g.closePath();g.fill();g.stroke()}g.fillStyle='#21172def';g.beginPath();g.ellipse(0,0,14,17,0,0,Math.PI*2);g.fill();g.stroke();g.strokeStyle=color;g.beginPath();g.moveTo(-7,-12);g.lineTo(7,12);g.moveTo(-11,-3);g.lineTo(3,13);g.stroke();g.rotate(-Math.sin(t*2)*.10);g.font='bold 10px Arial';g.textAlign='center';g.fillStyle='#130d20e8';g.fillRect(-35,23,70,17);g.fillStyle=color;g.fillText(label,0,35);g.restore()}
function draw(g){for(const e of enemies){const c=e.charge;if(stage>=2||!e.boss||e.dead||!c)continue;g.save();if(c.mode==='warn'){const dx=c.tx-c.sx,dy=c.ty-c.sy,len=Math.hypot(dx,dy),nx=-dy/len*(e.r+12),ny=dx/len*(e.r+12);g.fillStyle='#f6b87422';g.beginPath();g.moveTo(c.sx+nx,c.sy+ny);g.lineTo(c.tx+nx,c.ty+ny);g.lineTo(c.tx-nx,c.ty-ny);g.lineTo(c.sx-nx,c.sy-ny);g.closePath();g.fill();g.strokeStyle='#ffd193bb';g.lineWidth=3;g.setLineDash([12,12]);g.beginPath();g.moveTo(c.sx,c.sy);g.lineTo(c.tx,c.ty);g.stroke();g.setLineDash([]);g.beginPath();g.arc(c.tx,c.ty,e.r+12,0,Math.PI*2);g.stroke();g.fillStyle='#ffe0b2';g.font='bold 13px Arial';g.textAlign='center';g.fillText('CHARGE · ESQUIVE',Math.max(110,Math.min(690,c.tx)),Math.min(H-20,Math.max(310,c.ty+87)))}else{g.strokeStyle='#f7bd8c88';g.lineWidth=4;g.beginPath();g.arc(e.x,e.y,e.r+9,0,Math.PI*2);g.stroke()}g.restore()}}
window.NightHazards={moveBoss,tick,draw,drawCandy,collectCandy,spawnCandy};
const panel=document.createElement('section');panel.className='panel';panel.innerHTML='<h3>BONBONS DE LA NUIT</h3><div class="tiny"><span style="color:#c4a0f5">Violet : XP persistante.</span><br><span style="color:#ffcc7c">Doré : points pour le score.</span><br><span style="color:#8be2ce">Turquoise : bouclier temporaire.</span><br>Ramasse-les comme les reliques. Un bonbon XP apparaît dans chaque vague, puis un second bonbon de type variable.</div>';document.querySelector('.sidebar').appendChild(panel);
})();
