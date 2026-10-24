from pathlib import Path
p=Path('adventure.js');s=p.read_text();start=s.index('function createRisk()');end=s.index('\nfunction collectRisk',start)
s=s[:start]+'''function createRisk(){if(training||wave<2||!Journey.run||riskActive()||gates.length||obstacles.some(o=>!o.dead&&o.y<500))return false;const right=rng()>.5,cx=right?610:190;
 risk={x:cx,y:-70,side:right?'right':'left',age:0,breached:false,points:800+stage*200,xp:40+stage*10,guards:[]};
 for(const dx of [-66,0,66])risk.guards.push(spawnObstacle(cx+dx,25,{kind:'rock',r:32,breakable:true,hp:4+stage*2,max:4+stage*2,riskGuard:true,warn:1.2}));
 risk.seal=spawnObstacle(cx,-70,{kind:'rock',r:36,breakable:true,hp:20+stage*5,max:20+stage*5,riskSeal:true,riskChest:true,points:risk.points,riskXP:risk.xp,warn:1.2});
 say('RELIQUAIRE SCELLÉ · brise une ouverture, puis le sceau · +'+risk.points+' pts / +'+risk.xp+' XP · facultatif',4);return true}
function openRisk(o){if(o.dead||!risk)return;const owner=risk;o.dead=true;owner.opened=true;League.event('sealedChests',1);particle(o.x,o.y,'#e4cf9f',24);tone(640,.25,'triangle',.08,1.4);
 drops.push({x:o.x,y:o.y,kind:'points',points:owner.points,riskChest:true,riskOpened:true,riskXP:owner.xp,age:2,taken:false});
 if(eligibleUpgrades().length)dropUpgrade(o.x,Math.max(170,o.y-65));say('SCEAU BRISÉ · ramasse le butin !',3)}
const originalObstacleDamage=damageObstacle;damageObstacle=function(o,n){if(!o.riskGuard&&!o.riskSeal)return originalObstacleDamage(o,n);if(o.dead||!risk||!Number.isFinite(n)||n<=0)return false;if(o.riskSeal&&!risk.breached){o.hit=.1;return false}o.hp=Math.max(0,o.hp-n);o.hit=.15;particle(o.x,o.y,o.riskSeal?'#d8b8e2':'#a5cdb7',3);if(o.hp>0)return false;if(o.riskGuard){o.dead=true;risk.breached=true;League.event('obstacles',1);particle(o.x,o.y,'#a4c9b2',12);say('Ouverture créée · vise maintenant le sceau',2)}else openRisk(o);return true};
const originalObstacleDraw=drawObstacle;drawObstacle=function(g,o){if(o.riskSeal){drawChest(g,o,ambient);return}originalObstacleDraw(g,o);if(o.riskGuard&&o.age>=o.warn){g.save();g.fillStyle='#241b32';g.fillRect(o.x-25,o.y-43,50,7);g.fillStyle='#b3d2ae';g.fillRect(o.x-24,o.y-42,48*Math.max(0,o.hp/o.max),5);g.restore()}};
''' +s[end:]
s=s.replace("function collectRisk(d){if(d.taken)return;", "function collectRisk(d){if(d.taken||!d.riskOpened)return false;")
s=s.replace("if(window.CollectibleArt){CollectibleArt.label(g,'RELIQUAIRE · FACULTATIF'", "if(window.CollectibleArt){CollectibleArt.label(g,d.riskSeal?'RELIQUAIRE SCELLÉ':'BUTIN LIBÉRÉ'")
s=s.replace("g.fillText('XP : progression de collection',d.x,d.y+78)", "g.fillText(d.riskSeal?(risk?.breached?'2 · DÉTRUIS LE SCEAU':'1 · BRISE LES ROCHERS'):'RAMASSE LE BUTIN',d.x,d.y+78);if(d.riskSeal){g.fillStyle='#21172e';g.fillRect(d.x-43,d.y-38,86,8);g.fillStyle=risk?.breached?'#cfb3e2':'#8f9baf';g.fillRect(d.x-42,d.y-37,84*Math.max(0,d.hp/d.max),6);g.strokeStyle=risk?.breached?'#d6b0e4':'#b6c3ce';g.lineWidth=2;g.beginPath();g.arc(d.x,d.y,27,0,Math.PI*2);g.stroke();g.font='bold 11px Arial';g.fillStyle='#e2d7e6';g.fillText(Math.ceil(d.hp)+' / '+d.max,d.x,d.y+5)}")
s=s.replace("if(risk){risk.age+=dt;if(risk.age>1.2)risk.y+=scrollSpeed()*dt;if(risk.y>1050||transition>0||boss)risk=null}", "if(risk){risk.age+=dt;risk.y=risk.seal.y;if(risk.y>960||transition>0||boss){risk.seal.dead=true;for(const o of risk.guards)o.dead=true;risk=null}}")
start=s.index(" if(risk){g.save();g.fillStyle='#d9b583'");end=s.index('\nfunction renderStatus',start);s=s[:start]+"}\n"+s[end:]
s=s.replace('get lab(){return lab}', 'get lab(){return lab},get encounter(){return risk}')
a=s.index("info.innerHTML='<h3>LES RELIQUAIRES BONUS");b=s.index("';document.querySelector('.sidebar').appendChild(info)",a)
s=s[:a]+"info.innerHTML='<h3>RELIQUAIRES SCELLÉS · FACULTATIFS</h3><div class=\"tiny\">1. Détruis un rocher pour ouvrir la barricade.<br>2. Tire sur le sceau jusqu’à vider sa jauge.<br>3. Ramasse le butin libéré avant sa sortie de l’écran.<br><br>Points + XP de collection annoncés sur le coffre ; une relique d’arme en plus si le budget du niveau le permet. Les sorts et explosions peuvent aider.<br><br>Le coffre fermé ne se ramasse pas. Aucun gain si tu ne l’ouvres pas ; tu peux ignorer toute la rencontre en passant à côté. Pas de récompense exclusive obligatoire.</div>"+s[b:]
p.write_text(s)
p=Path('game.js');s=p.read_text().replace("hurt(30,'un obstacle');o.y=1000", "hurt(30,'un obstacle');if(!o.riskGuard&&!o.riskSeal)o.y=1000")
s=s.replace("d.y+=(d.riskChest?(d.age>1.2?scrollSpeed():0)","d.y+=(d.riskChest?(d.riskOpened?65:d.age>1.2?scrollSpeed():0)")
p.write_text(s)
p=Path('index.html');s=p.read_text().replace('bonus-polish-20261024-3','sealed-reliquary-20261024-4');p.write_text(s)
