from pathlib import Path
p=Path('game.js');s=p.read_text()
# Ne plus purger le terrain ou les tirs lors des frontières de vagues/univers.
a=s.index('function newWave()');b=s.index('\nfunction spawnEnemy',a);block=s[a:b].replace('gates=[];','').replace('hazards=[];obstacles=[];scares=[];hostile=[];','');s=s[:a]+block+s[b:]
a=s.index('function beginTransition(');b=s.index('\nfunction advanceStage',a);block=s[a:b].replace("transition=boss?3.6:1.6;hostile=[];scares=[];hazards=[];obstacles=[];gates=[];player.inv=Math.max(player.inv,transition+.4);", "transition=boss?2.6:1.8;");s=s[:a]+block+s[b:]
a=s.index('function advanceStage(');b=s.index('\nfunction updateLoadout',a);block=s[a:b].replace('shots=[];rockets=[];drops=drops.filter(d=>d.bossLife&&d.y<950);','').replace('player.shield=50;player.shieldTime=8;', 'player.shield=Math.max(player.shield,35);player.shieldTime=Math.max(player.shieldTime,5);');s=s[:a]+block+s[b:]
s=s.replace('clean=true;gates=[];obstacles=[];const power=', 'clean=true;const power=')
s=s.replace('hostile=[];hazards=[];obstacles=[];scares=[];rockets=[];shots=[];enemies.forEach(n=>n.dead=true);shake=8;', 'shake=8;')
s=s.replace('e.damageBudget=0;hostile=[];say(world.boss', 'e.damageBudget=0;say(world.boss')
# Plus de résistance et d'occupation de l'espace, mais premier univers intact.
s=s.replace('const density=diff>1?7:6;', 'const density=(diff>1?7:6)+Math.floor(stage*.75);')
s=s.replace('base=1+Math.floor((wave+stage)/3)', 'base=1+Math.floor((wave+stage)/3)+Math.floor(stage*1.25)')
s=s.replace('(43+stage*9+wave*4)', '(43+stage*13+wave*4)')
s=s.replace('fire:2+rng()*2,poison:', 'fire:Math.max(.8,2-stage*.22)+rng()*1.5,poison:')
s=s.replace('e.fire=Math.max(2,4.5-stage*.25)', 'e.fire=Math.max(1.25,4.5-stage*.65)')
s=s.replace("stage>2?[-.15,.15]:[0],(100+stage*10)*diff", "stage>=3?[-.2,0,.2]:stage===2?[-.13,.13]:[0],(100+stage*22)*diff")
s=s.replace('(125+stage*12)*diff', '(125+stage*23)*diff')
s=s.replace('Math.max(.6,(1.75-phase*.22-stage*.1)', 'Math.max(.48,(1.75-phase*.22-stage*.14)')
p.write_text(s)
p=Path('night-hazards.js');s=p.read_text().replace("};hostile=[];say(({pumpkin:", "};if(stage<2)say(({pumpkin:")
s=s.replace("1.8);tone(150,.22,'triangle',.09,.65)", "1.8);if(stage<2)tone(150,.22,'triangle',.09,.65)")
s=s.replace("(e.kind==='vampire'?1.45:c.round===2?.9:stage===0?1.15:Math.max(.85,1.1-stage*.05))", "(stage>=2?0:stage===1?.65:e.kind==='vampire'?1.45:c.round===2?.9:1.15)")
s=s.replace("(e.kind==='pumpkin'?440:e.kind==='demon'?570:500+stage*35)", "((e.kind==='pumpkin'?440:e.kind==='demon'?570:500)*(1+stage*.14))")
s=s.replace('step=330*dt','step=(330+stage*40)*dt').replace('Math.max(5.2,7-stage*.35)', 'Math.max(3.2,7-stage*.9)')
s=s.replace("say('DEUXIÈME CHARGE · ESQUIVE !',1.2)", "if(stage<2)say('DEUXIÈME CHARGE · ESQUIVE !',1.2)")
s=s.replace("if(!e.boss||e.dead||!c)continue;", "if(stage>=2||!e.boss||e.dead||!c)continue;")
p.write_text(s)
p=Path('adventure.js');s=p.read_text().replace("if(e.kind==='vampire'&&c?.mode==='warn')", "if(stage<2&&e.kind==='vampire'&&c?.mode==='warn')")
s=s.replace('||transition>0||boss){risk.seal.dead=true;', '||boss){risk.seal.dead=true;');p.write_text(s)
p=Path('encounters.js');s=p.read_text().replace("if(transition>0||event.stage!==stage||enemies.some(e=>e.boss))", "if(enemies.some(e=>e.boss))");p.write_text(s)
p=Path('index.html');s=p.read_text().replace('</body>', '<script src="flow.js?v=continuous-combat-20261024-1"></script></body>');import re;s=re.sub(r'\?v=[^" ]+', '?v=continuous-combat-20261024-1',s);p.write_text(s)
p=Path('server.py');s=p.read_text().replace("'/collectible-art.js'", "'/collectible-art.js','/flow.js'");p.write_text(s)
p=Path('tools/package.py');s=p.read_text().replace("'encounters.js'", "'encounters.js','flow.js'");p.write_text(s)
