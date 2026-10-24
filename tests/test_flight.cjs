const fs=require('fs');let env=fs.readFileSync('tests/test_arcade.cjs','utf8').split("eval(fs.readFileSync")[0];eval(env+`;eval(fs.readFileSync('game.js','utf8')+\`
start('story');player.lean=0;player.fire=0;let origin=broomMuzzle();update(.001);if(Math.abs(shots[0].x-player.x)>.1||shots[0].y>origin.y)throw Error('origine du tir');
if(origin.y!==player.y-67)throw Error('manche');
let bonus=score;dailyAward(100,'test');if(score!==bonus||dailyBonus!==0)throw Error('bonus mode normal');
start('daily');wave=2;stage=1;clean=true;dailyWaveReward();if(dailyBonus!==800||score!==800)throw Error('bonus vague');
saveCheckpoint();dailyBonus=0;resumeCheckpoint();if(dailyBonus!==800)throw Error('reprise bonus');
stage=2;wave=4;enemies=[];for(let i=0;i<25;i++)spawnEnemy({x:100+i*20,kind:'spider',pattern:0,group:0,index:i});let tough=enemies.filter(e=>e.elite);if(!tough.length||!enemies.some(e=>e.tier===2)||tough.some(e=>e.max<=4))throw Error('élites');
hostile=[];player.x=500;player.y=700;shootHostile({x:400,y:200,kind:'spider'},'web',[-.4,0,.4],130,Math.PI/2);if(hostile.filter(b=>b.homing).length!==1)throw Error('salve injuste');let web=hostile[1];web.age=.4;let a0=Math.atan2(web.vy,web.vx);steerHostile(web,.1);let a1=Math.atan2(web.vy,web.vx);if(a0===a1||Math.abs(a1-a0)>web.turnRate*.1+.0001)throw Error('guidage');
player.dash=.2;web.x=player.x;web.y=player.y-100;steerHostile(web,.01);if(web.lockRemaining!==0)throw Error('esquive');
for(let i=0;i<300;i++){player.inv=100;update(1/60);drawGame()}
console.log('Vue du dessus / origine, bonus quotidiens, sauvegarde, élites, poursuite limitée et esquive : OK');
\`);`);
