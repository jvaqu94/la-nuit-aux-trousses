/* Monde 3 · La Sixième Heure.
   Difficulté par la décision, jamais par le nombre : les budgets sont plafonnés
   aux valeurs du monde 2 (6 ennemis, 2 projectiles par salve, cadence ≥ 4,2 s,
   vitesse ≤ 150). Chaque forme hérite d'une mécanique du monde 1 et d'une du
   monde 2. Aucun gardien n'utilise la courbe PV → 3 phases : chacun a sa jauge
   et sa condition de victoire. */
(()=>{
'use strict';
const active=()=>window.Campaign?.activeWorld===3;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const near=(ax,ay,bx,by,r)=>Math.hypot(ax-bx,ay-by)<r;

const BUDGET={foes:12,volley:4,cadence:1.9,shotSpeed:190,adds:3};
const TUNING=[
 {foes:8,volley:2,cadence:2.8,speed:150,axes:1},
 {foes:9,volley:3,cadence:2.6,speed:160,axes:2},
 {foes:10,volley:3,cadence:2.4,speed:170,axes:2},
 {foes:11,volley:4,cadence:2.2,speed:180,axes:3},
 {foes:12,volley:4,cadence:2.0,speed:190,axes:3}
];
const tune=()=>TUNING[clamp(stage,0,4)];

const foeNames={
 wickWarden:'Garde-mèche',waxCourier:'Facteur de cire',
 bronzeCrow:'Corbeau de bronze',crackedBell:'Cloche fêlée',
 saltWalker:'Marcheuse de sel',printThief:'Voleuse d’empreintes',
 wickPicker:'Cueilleuse de mèches',hollowFlame:'Flamme creuse',waxChorist:'Veilleuse de cire',
 unnamedDigit:'Chiffre sans nom',facelessEcho:'Écho sans visage',
 shutterImp:'Volet claqueur',waxMimic:'Faux-cierge',snufferHand:'Moucheur'
};
const foeKinds=new Set(Object.keys(foeNames));
const bossKinds=new Set(['veilleuse','sonneur','passeur','cueilleuse','chasseur']);
/* Une condition de victoire par gardien : aucune n'est « vider la barre ». */
const VICTORY={
 veilleuse:'Brise la ronde de cire, éteins les flammes, puis frappe le cœur pendant la faille',
 sonneur:'Frappe 3 fois le battant',
 passeur:'Brise 3 fois le sable',
 cueilleuse:'Force 3 cueillettes',
 chasseur:'Réussis 3 gestes non copiés'
};
/* Une phrase par univers, écrite comme une consigne de jeu, pas comme une
   énigme : ce qu'il faut faire, et ce qui arrive si on ne le fait pas. */
const RULES=[
 'TUE le Garde-mèche : tant que son halo luit, TOUT le pack est IMMUNISÉ — lui compris, et chaque monstre porte son cercle. Il luit 2 s puis s’éteint 2,6 s : frappe pendant le creux. Au labyrinthe, tire sur les trois runes dans l’ordre A → B → C pour ouvrir les portes ; une cache latérale reste facultative. CASSE les volets qui claquent. TIRE sur un cierge à sceau rouge avant de le ramasser : c’est un Faux-cierge. RAMASSE les plis cachetés dans l’ordre I → II → III.',
 'CHOISIS une cloche du labyrinthe : aligne-toi dessous et tire pour ouvrir uniquement son passage. En combat, briser une cloche suspend les tirs de sa jumelle pendant 1,5 seconde.',
 'ÉVITE le sel blanc : il te ralentit. Il tombe là où tu étais, pas là où tu es.',
 'ALLUME les lanternes en les touchant. TUE le Moucheur : il souffle une mèche et s’en sert pour protéger les autres — le tuer te la rend.',
 'VISE le chiffre affiché en FAIBLE : il prend deux fois plus de dégâts.'
];
/* Comment battre chaque gardien, en une consigne concrète. */
const HOWTO={
 veilleuse:'D’abord la ronde de cire : deux veilleuses gardent le cœur et rallument les mèches — il faut deux coups chacune, et leur disparition ouvre la cire. Éteints au moins 3 mèches, puis frappe le cœur pendant le flash (3 impacts). Chaque impact brise une phase : la ronde revient plus nombreuse, une mèche repart, mais tu gagnes un bouclier de cire (6 s). Une mèche noire rougeoie avant de recracher une braise.',
 sonneur:'Tire sur le battant quand il descend. Ne touche pas la cloche.',
 passeur:'Marche sur du sable intact, puis tire sur le passeur quand il s’ouvre.',
 cueilleuse:'Allume les 3 lanternes en les touchant, puis tire sur la cueilleuse.',
 chasseur:'Fais le geste écrit à l’écran : il ne sait pas le copier.'
};
const HABITS={relays:'relais brisés',halos:'halos fréquentés',salt:'sable intact foulé',flames:'flammes rendues'};
/* Chaque univers possède une épreuve active pendant les quatre vagues.
   Elle récompense la maîtrise de sa mécanique, sans bloquer la progression. */
const TRIALS=[
 {kind:'waxMimic',short:'SCEAUX',text:'perce 3 Faux-cierges avant leur contact'},
 {kind:'crackedBell',short:'ÉCHOS',text:'brise 3 cloches liées'},
 {kind:'saltDash',short:'TRACES',text:'efface 3 empreintes avec une esquive'},
 {kind:'snufferHand',short:'MÈCHES',text:'reprends 3 mèches volées au Moucheur'},
 {kind:'unnamedDigit',short:'CHIFFRES',text:'abats 3 Chiffres sur leur faiblesse'}
];
function countTrial(kind){
 const trial=TRIALS[clamp(stage,0,4)];
 if(!trial||trial.kind!==kind||mission.trialDone)return;
 mission.trial=Math.min(3,(mission.trial||0)+1);
 score+=120*(stage+1);
 if(mission.trial>=3){
  mission.trialDone=true;
  score+=500*(stage+1);
  say('ÉPREUVE ACCOMPLIE · '+trial.short+' · récompense '+(620*(stage+1))+' points',3);
  particle(player.x,player.y,world.moon,24);
 }else say('ÉPREUVE '+trial.short+' · '+mission.trial+'/3',1.7);
}

let marks=[],salt=[],trail=[],mission={},habits=freshHabits(),boss=null,minute=null,meche=null;
let slams=[],letters=[];
let flame=3,frozen=[],spawnSerial=0,haloTime=0,gesture=null;

function freshHabits(){return{relays:0,halos:0,salt:0,flames:0}}
function reset(){
 marks=[];salt=[];trail=[];mission={};habits=freshHabits();boss=null;minute=null;meche=null;
 slams=[];letters=[];
 flame=3;frozen=[];spawnSerial=0;haloTime=0;gesture=null;
}
const journeyBegin=Journey.begin,journeyRestore=Journey.restore;
Journey.begin=function(...args){const r=journeyBegin(...args);reset();return r};
Journey.restore=function(...args){const r=journeyRestore(...args);reset();return r};

/* Une mèche éteinte porte toujours son propre compte à rebours de rallumage :
   visible, individuelle, et le socle du contre-jeu de la Veilleuse. */
const VIAL_ROMAN=['I','II','III'];
function extinguishWick(w){w.lit=false;w.open=0;w.charge=0;w.relight=11+rng()*2;w.relightMax=w.relight}

/* Popups d'introduction : quand une mécanique majeure apparaît pour la
   première fois, le vol est mis en pause et le popup l'explique. Une seule
   fois par appareil (flag dans localStorage) ; ensuite le bandeau reste la
   source unique des consignes. */
const INTRO_SEEN='minuit-sixth-intros';
function seenIntros(){try{return new Set(JSON.parse(localStorage.getItem(INTRO_SEEN)||'[]'))}catch{return new Set()}}
function world3Intro(s,w){
 if(s===0&&w===1)return{key:'w3-faubourg',title:'Le Faubourg des veilles',body:'<p><b>Les plis cachetés.</b> Une lettre scellée tombe sur les vagues 1 à 3. Ramassées dans l’ordre <b>I → II → III</b> : +250 par pli, et <b>+1000</b> et un <b>bouclier de cire (6 s)</b> pour le sceau complet. Un pli trop tôt se brise et casse ta chaîne.</p><p><b>Le halo du Garde-mèche.</b> Tant qu’il est allumé, <b>tout le pack est IMMUNISÉ</b> — lui compris : un cercle entoure chaque monstre. Il luit 2 s puis s’éteint 2,6 s. <b>Frappe pendant le creux</b>, ou tue d’abord le porteur — le halo tombe avec lui.</p><p><b>PRIME.</b> Chaque vague désigne une famille payante : <b>chaque</b> cible PRIME abattue rapporte +400 et un pas de combo, toute la vague.</p>'};
 if(s===0&&w===2)return{key:'w3-minute1',title:'Minute 1 · Le Garde-mèche',body:'<p>Le Garde-mèche <b>garde la minute</b>. Son halo luit 2 s et s’éteint 2,6 s : au creux, tout le monde redevient vulnérable — lui compris.</p><p><b>Frappe pendant le creux</b>, ou tue-le d’abord. Puis marche sur le cadran pour rendre la minute au monde.</p>'};
 if(s===0&&w===3)return{key:'w3-minute2',title:'Minute 2 · Tenue',body:'<p>Survis <b>22 secondes</b>. La minute se libère ensuite — marche sur le cadran.</p><p><b>La lettre scellée.</b> Une lettre traverse l’univers en vague 3. <b>Saisis-la en vol</b> (ou laisse-la sortir) : <b>MINUTE RENDUE sans un coup, +400</b>. Un tir la brise : +50 seulement. Sans tirer, c’est aussi le chemin de la couronne <b>MAIN LÉGÈRE</b>.</p>'};
 if(s===0&&w===4)return{key:'w3-minute3',title:'Minute 3 · Les sceaux',body:'<p>Deux flammes creuses portent le sceau. <b>Tire dessus</b> pour libérer la minute.</p>'};
 if(w>=1&&w<=4&&s>=1)return{key:'w3-stage-'+s,title:'Nouvelle loi',body:'<p>'+RULES[s]+'</p>'};
 return null;
}
function instructionPopup(key,title,body){
 if(seenIntros().has(key))return false;
 try{const s=seenIntros();s.add(key);localStorage.setItem(INTRO_SEEN,JSON.stringify([...s]))}catch{}
 state='instruction';
 overlay('<section class="instruction-popup" role="dialog" aria-modal="true"><div class="eyebrow">Nouvelle instruction</div><h2 class="local-title">'+title+'</h2><div class="instruction-body">'+body+'</div><button class="primary instruction-ok" id="instructionOk">C’est compris →</button></section>');
 const ov=(typeof document!=='undefined')&&document.getElementById('overlay');
 if(ov&&ov.classList)ov.classList.add('instruction-backdrop');
 const btn=(typeof document!=='undefined')&&document.getElementById('instructionOk');
 if(btn)btn.onclick=()=>{const o=(typeof document!=='undefined')&&document.getElementById('overlay');if(o&&o.classList)o.classList.remove('instruction-backdrop');if(typeof hideOverlay==='function')hideOverlay();state='play'};
 return true;
}

/* --- Mémoire du joueur (héritée du Cerf des heures et de la Larve) --------- */
function remember(dt){
 trail.push({x:player.x,y:player.y,t:gameTime});
 while(trail.length&&gameTime-trail[0].t>13)trail.shift();
}
function pastPlayer(seconds=1.2){
 const target=gameTime-seconds;
 for(let i=trail.length-1;i>=0;i--)if(trail[i].t<=target)return trail[i];
 return trail[0]||{x:player.x,y:player.y};
}

/* --- Télégraphes : plein = réel, pointillé = leurre (langage du monde 1) --- */
function addMark(data){
 if(marks.length>=10)return null;
 const mark={x:clamp(data.x,60,740),y:clamp(data.y,300,820),r:data.r||74,warn:data.warn||1.35,
  life:data.life||.45,age:0,real:data.real!==false,source:data.source||null,label:data.label||'',
  kind:data.kind||'strike',graze:data.graze===true,snuff:data.snuff===true,grazed:false,struck:false};
 marks.push(mark);return mark;
}
const isReal=m=>m.real===true;
let shieldFlash=0;

/* Le halo du Garde-mèche : un bouclier qui s'allume et s'éteint.
   Allumé, il immunise TOUT l'écran — Garde-mèche compris : chaque monstre
   porte son cercle. Éteint, plus personne n'est protégé : la fenêtre de tir. */
function haloActive(warden){return !!warden&&!warden.dead&&warden.haloOn!==false}
const haloSource=e=>!e.dead&&(e.kind==='wickWarden'||(e.kind==='snufferHand'&&e.stolen>0));
function haloLit(){return enemies.some(e=>haloSource(e)&&haloActive(e))}
/* Conservé pour le dessin : trouver un porteur proche (anneau pointillé). */
function wardenNear(x,y){return enemies.find(e=>haloSource(e)&&near(x,y,e.x,e.y,e.halo||150))||null}
function wardenAt(x,y){return haloLit()||null}
function playerInHalo(){return haloLit()}

function liveFoes(){return enemies.filter(e=>!e.dead&&!e.boss).length}

/* --- Apparition : plafond dur, aucun dépassement possible ----------------- */
const baseSpawnEnemy=spawnEnemy;
spawnEnemy=function(d){
 if(active()&&foeKinds.has(d.kind)&&liveFoes()>=tune().foes)return;
 baseSpawnEnemy(d);
 if(!active())return;
 const e=enemies[enemies.length-1];
 if(!e||!foeKinds.has(d.kind))return;
 e.pattern=99;e.speed=0;e.fire=999;e.baseX=d.x;e.x=d.x;
 e.elite=false;e.tier=0;e.r=e.kind==='crackedBell'?24:e.kind==='hollowFlame'?22:20;
 e.homeY=Number.isFinite(d.y)?d.y:250+((d.group||0)%3)*70;
 if(Number.isFinite(d.y))e.y=d.y;
 e.seed=(Number(e.id)||.31)*Math.PI*2;e.dir=(d.index||0)%2?1:-1;
 e.timer=tune().cadence*(.55+((spawnSerial++%3)*.22));
 e.lit=false;e.digit=1+(spawnSerial%5);e.marks=0;e.lastDash=0;e.dashDir=null;e.dashRun=0;
 e.stolen=0;e.slamCd=tune().cadence;e.revealed=false;e.biteCd=0;
 if(e.kind==='waxMimic'){e.disguise=true;e.r=18}
 if(e.kind==='snufferHand')e.halo=130;
 if(e.kind==='crackedBell'){
  const twin=enemies.find(o=>o!==e&&!o.dead&&o.kind==='crackedBell'&&!o.twin);
  if(twin){twin.twin=e;e.twin=twin;twin.linkedBell=true;e.linkedBell=true}
 }
};

function spawnFoe(kind,x,y,index=0){
 spawnEnemy({kind,x,y:y??-35,group:60+(spawnSerial%12),index,pattern:99});
 const e=enemies[enemies.length-1];
 return e&&e.kind===kind?e:null;
}

/* --- Vagues : lecture, minute, tenue, inversion, gardien ------------------ */
const baseSchedule=makeSchedule;
makeSchedule=function(){
 if(!active())return baseSchedule();
 const forms=world.foes,list=[];
 if(wave===5){for(let i=0;i<8;i++)list.push({time:.8+i*.8,x:90+(i*173)%620,kind:forms[i%forms.length],pattern:99,group:1+Math.floor(i/2),index:i%2});return list}
 const count=30+wave*5;
 // Entrée plus régulière : les groupes se chevauchent davantage et réduisent
 // les creux de pression entre deux apparitions.
 for(let i=0;i<count;i++)list.push({time:.35+i*1.0,x:120+(i*173)%560,kind:forms[i%forms.length],pattern:99,group:1+(i%3),index:i%2});
 return list;
};

const baseNewWave=newWave;
newWave=function(...args){
 const plisKeep=(stage===0&&wave>1&&wave<=4&&typeof mission!=='undefined'&&mission&&mission.plis)?mission.plis:null;
 const result=baseNewWave(...args);
 if(!active())return result;
 marks=[];salt=[];minute=null;meche=null;frozen=[];boss=null;gesture=null;haloTime=0;
 mission={key:stage+':'+wave,minuteTaken:false,seals:0,digit:1,digitTimer:5,tenure:0,trial:0,trialDone:false,prime:null,veilleComplete:false,plis:null};
 /* Les plis cachetés du Faubourg : un par vague (I, II, III), à ramasser dans
    l'ordre. L'ensemble est conservé d'une vague à l'autre. */
 if(stage===0&&wave<=4){
  mission.plis=plisKeep||{next:1,got:0};
  if(wave<=3)drops.push({x:120+rng()*560,y:-40,kind:'pli',pli:wave,age:0});
 }
 /* PRIME du Faubourg : une famille de créatures désignée chaque vague, +400
    points et un pas de combo à abattre. Le joueur arbitre ses cibles au lieu
    de tirer dans le tas. Jamais sur la vague du gardien. */
 if(stage===0&&wave<=4){
  const pool=(world&&world.foes||[]).filter(k=>foeNames[k]);
  mission.prime=pool.length?pool[Math.floor(rng()*pool.length)]:null;
 }
 /* La Minute Suspendue : une lettre scellée traverse l'univers en vague 3.
    Elle ne tire pas, ne se laisse ni viser ni toucher par hasard — la saisir en vol (ou laisser traverser) scelle la minute. Un tir la brise : +50. */
 if(wave===3&&letters.length===0)letters.push({x:W+70,y:120+rng()*260,vx:-34,age:0,seed:rng()*Math.PI*2});
 if(wave<=4){const intro=world3Intro(stage,wave);if(intro)instructionPopup(intro.key,intro.title,intro.body)}
 if(wave===2)minute=makeMinute();
 if(wave===4){
  spawnFoe('hollowFlame',240,300,0);spawnFoe('hollowFlame',560,300,1);
  for(const e of enemies)if(e.kind==='hollowFlame'&&!e.dead){e.seal=true;e.lit=true}
 }
 window.Campaign&&window.Campaign.progress&&typeof sequelHUD==='function'&&sequelHUD();
 return result;
};

/* Trois minutes par univers : une par vague 2, 3 et 4, soit les quinze
   annoncées au briefing. Chacune se libère quand l'objectif de la vague est
   rempli — rien de neuf à apprendre, il faut juste marcher dessus. */
function minuteDue(){
 if(wave===2)return true;
 if(wave===3)return waveTime>=22;
 if(wave===4)return (mission.seals||0)>=2;
 return false;
}
function makeMinute(){
 const spots={2:[400,330],3:[250+clamp(stage,0,4)*70,360],4:[550-clamp(stage,0,4)*60,340]};
 const [x,y]=spots[wave]||[400,340];
 return {x:clamp(x,120,680),y:clamp(y,300,420),guard:wave===2,taken:false,age:0,index:wave-1};
}

function waveBlocks(){
 if(!active()||window.SandboxMode||state!=='play'||wave===5)return false;
 if(wave===2)return !mission.minuteTaken;
 if(wave===3)return waveTime<22||!mission.minuteTaken;
 if(wave===4)return mission.seals<2||!mission.minuteTaken;
 return false;
}

/* --- Comportements : un héritage monde 1 × monde 2 par forme -------------- */
function moveEnemy(e,dt){
 if(!active()||!foeKinds.has(e.kind)||e.boss)return false;
 if(e.kind==='waxChorist'){
  const bossRef=boss;
  if(bossRef&&!bossRef.dead){
   e.orbitAngle=(e.orbitAngle??e.seed)+dt*.62;
   e.x=bossRef.x+Math.cos(e.orbitAngle)*165;
   e.y=bossRef.y+30+Math.sin(e.orbitAngle)*64;
  }else{e.y=Math.min(430,e.y+40*dt);e.x+=Math.sin(e.age*2.2)*30*dt}
  return true;
 }
 if(e.immunePing)e.immunePing=Math.max(0,e.immunePing-dt);
 if(e.shieldFx)e.shieldFx=e.shieldFx>0?Math.max(0,e.shieldFx-dt):Math.min(0,e.shieldFx+dt);
 if(e.kind==='wickWarden'){
  e.haloTimer=(e.haloTimer==null?2.1:e.haloTimer)-dt;
  if(e.haloTimer<=0){
   e.haloOn=e.haloOn===false;
   e.haloTimer=e.haloOn?2.0:2.6;
   for(const o of enemies){if(o.dead)continue;if(!o.boss)o.shieldFx=e.haloOn?.85:-.6}
   shieldFlash=e.haloOn?.3:0;
   particle(e.x,e.y,e.haloOn?'#ffd9a0':'#7c8a99',12);
   tone(e.haloOn?196:392,e.haloOn?.4:.18,'sine',.08,.9);
  }
 }
 const t=tune();
 if(e.y<e.homeY)e.y=Math.min(e.homeY,e.y+58*dt);
 else e.y=e.homeY+Math.sin(e.age*.7+e.seed)*16;
 e.x=clamp(e.baseX+Math.sin(e.age*.55+e.seed)*(e.kind==='wickWarden'?55:95),50,750);
 e.timer-=dt;
 if(e.kind==='printThief')trackDash(e);
 if(e.timer>0)return true;
 e.timer=t.cadence;
 const aim=Math.atan2(player.y-e.y,player.x-e.x);
 const volley=Math.max(1,Math.min(t.volley,BUDGET.volley));
 const angles=Array.from({length:volley},(_,i)=>(i-(volley-1)/2)*.22);
 shootHostile(e,'spirit',angles,Math.min(t.speed,BUDGET.shotSpeed),aim);
 e.shotCycle=(e.shotCycle||0)+1;
 if(e.shotCycle%2===0)return true;
 if(e.kind==='waxCourier'){
  /* Leurre du vampire (M1) × écho annulable du facteur d’ombre (M2). */
  const side=rng()<.5?-1:1,source=enemies.find(o=>!o.dead&&o.kind==='wickWarden')||e;
  addMark({x:player.x,y:player.y,r:72,warn:1.35,source,real:true,label:'CIRE'});
  addMark({x:player.x+side*180,y:player.y-40,r:72,warn:1.35,source,real:false,label:'LEURRE'});
 }else if(e.kind==='bronzeCrow'){
  /* Écho du chiffre creux (M2) × frôlement récompensé (M1). */
  addMark({x:player.x,y:player.y,r:66,warn:1.3,source:e,graze:true,label:'BRONZE'});
 }else if(e.kind==='saltWalker'){
  /* Traînée d’ossements (M1) × mémoire du joueur (M2). */
  const past=pastPlayer(1.2);
  salt.push({x:clamp(past.x,50,750),y:clamp(past.y,320,830),r:62,age:0,life:3});
  if(salt.length>7)salt.shift();
 }else if(e.kind==='printThief'){
  if(e.dashRun>=3){
   const dir=e.dashDir||{x:0,y:-1};
   addMark({x:player.x+dir.x*150,y:player.y+dir.y*150,r:78,warn:1.4,source:e,label:'EMPREINTE'});
   e.dashRun=0;
  }
 }else if(e.kind==='wickPicker'){
  /* Protecteur (M1) × prisme annulable (M2) : rallumer lui retire son arme. */
  const lamp=enemies.find(o=>!o.dead&&o.kind==='hollowFlame'&&o.lit);
  if(lamp){lamp.lit=false;particle(lamp.x,lamp.y,'#f4c98f',12);addMark({x:player.x,y:player.y,r:70,warn:1.25,source:e,label:'PRISME'})}
  else e.timer=t.cadence*.6;
 }else if(e.kind==='unnamedDigit'){
  addMark({x:player.x,y:player.y,r:68,warn:1.35,source:e,label:'CHIFFRE '+e.digit});
 }else if(e.kind==='facelessEcho'){
  copyHabit(e,t,aim);
 }else if(e.kind==='shutterImp'){
  /* Obstacle solide destructible (M1) × annonce Relais (M2) : il bouche la
     route que le joueur visait. Tuer le volet annule le claquement. */
  const past=pastPlayer(.6);
  slams.push({x:clamp(past.x,80,720),y:clamp(player.y-210,300,700),age:0,warn:1.3,source:e});
  if(slams.length>4)slams.shift();
 }else if(e.kind==='snufferHand'){
  /* Coût de flamme de la Flamme creuse (M3) × halo protecteur (M1) : il
     souffle une mèche et s'en sert pour couvrir les autres. */
  addMark({x:player.x,y:player.y,r:64,warn:1.2,source:e,label:'MOUCHAGE',snuff:true});
 }else if(e.kind==='waxMimic'){
  if(e.disguise)e.timer=t.cadence*.7;
 }
 return true;
}

function copyHabit(e,t,aim){
 const top=Object.entries(habits).sort((a,b)=>b[1]-a[1])[0][0];
 if(top==='relays'){addMark({x:player.x,y:player.y,r:70,warn:1.3,source:e,label:'EMPRUNT · RELAIS'})}
 else if(top==='halos'){e.halo=140;addMark({x:player.x,y:player.y,r:70,warn:1.4,source:e,label:'EMPRUNT · HALO'})}
 else if(top==='salt'){const past=pastPlayer(1.1);salt.push({x:clamp(past.x,50,750),y:clamp(past.y,320,830),r:60,age:0,life:2.6});if(salt.length>7)salt.shift()}
 else shootHostile(e,'spirit',[0],Math.min(t.speed,BUDGET.shotSpeed),aim);
}

function trackDash(e){
 if(player.dash>0&&e.lastDash<=0){
  const past=pastPlayer(.3),dx=player.x-past.x,dy=player.y-past.y,length=Math.hypot(dx,dy)||1;
  const dir={x:dx/length,y:dy/length};
  if(e.dashDir&&Math.abs(e.dashDir.x-dir.x)<.45&&Math.abs(e.dashDir.y-dir.y)<.45)e.dashRun++;
  else e.dashRun=1;
  e.dashDir=dir;
 }
 e.lastDash=player.dash;
}

/* Cloches fêlées : le lien du monde 1 devient une ressource (temps suspendu M2). */
function breakBell(e){
 const twin=e.twin;
 if(!twin||twin.dead)return;
 let count=0;
 for(const b of hostile){
  if(b.owner!==twin||b.frozen)continue;
  b.frozen=true;b.frozenVx=b.vx;b.frozenVy=b.vy;b.vx=0;b.vy=0;b.freezeLeft=1.5;count++;
 }
 if(count)say('LIEN ROMPU · les tirs de la jumelle sont suspendus',2);
}

/* --- Minute rendue : reliquaire en deux temps (modèle du monde 1) --------- */
function tickMinute(dt){
 if(!minute||minute.taken)return;
 minute.age+=dt;
 if(minute.guard&&!enemies.some(e=>!e.dead&&e.kind==='wickWarden'))minute.guard=false;
 if(minute.guard&&wave!==2)minute.guard=false;
 if(!minute.guard&&near(player.x,player.y,minute.x,minute.y,46)){
  minute.taken=true;mission.minuteTaken=true;keepMinute('MINUTE '+(minute.index||1)+'/3 RENDUE');
 }
}
function keepMinute(label){
 const total=window.Campaign?.keepMinutes?.(1)||0;
 score+=400*(stage+1);particle(player.x,player.y,'#ffd9a0',26);tone(720,.32,'sine',.08,1.3);
 say(label+' · '+total+'/15 conservées pour la fin du voyage',3);
 if(typeof sequelHUD==='function')sequelHUD();
}

/* --- Volet claqueur : il ferme la route, pas la fenêtre de tir ------------ */
function tickSlams(dt){
 for(const sl of slams){
  sl.age+=dt;
  if(sl.done)continue;
  if(!sl.source||sl.source.dead){sl.done=true;sl.cancelled=true;continue}
  if(sl.age>=sl.warn){
   sl.done=true;
   const panel=window.SixthLabyrinth?.addPanel?.(sl.x,sl.y);
   if(panel){particle(sl.x,sl.y,'#8a6f57',16);tone(180,.2,'square',.06,.6);say('VOLET CLAQUÉ · casse-le ou passe ailleurs',2.2)}
  }
 }
 slams=slams.filter(sl=>!sl.done);
}

/* --- Faux-cierge : le leurre du monde 1 déguisé en récompense ------------- */
function tickMimics(dt){
 for(const e of enemies){
  if(e.dead||e.kind!=='waxMimic')continue;
  e.biteCd=Math.max(0,(e.biteCd||0)-dt);
  if(!e.disguise)continue;
  if(near(player.x,player.y,e.x,e.y,46)&&e.biteCd<=0){
   e.disguise=false;e.revealed=true;e.biteCd=2.4;
   hurt(18,'le Faux-cierge');particle(e.x,e.y,'#e8d3ab',22);
   say('FAUX-CIERGE · le sceau rouge était le signe : tire avant de ramasser',2.8);
  }
 }
}

/* --- Tick commun -------------------------------------------------------- */
/* La minute suspendue : la lettre traverse l'écran sans rien tirer. La ramasser
   (ou la laisser traverser intacte) scelle la minute : +400 et une couronne.
   Un tir sur elle brise le sceau : +50, aucun crédit. */
function resolveLetter(L,byShot){
 if(L.dead)return;
 L.dead=true;
 if(byShot){
  score+=50;
  for(let i=0;i<16;i++)particle(L.x,L.y,'#e8d3ab',2);
  say('LE SCEAU SE BRISE · +50 points',1.8);tone(214,.25,'sawtooth',.06,.7);
 }else{
  mission.legere=true;score+=400;
  particle(L.x,L.y,'#ffd9a0',40);say('SCEAU SCELLÉ · +400 points · une minute rendue sans un coup',3);
  tone(392,.4,'sine',.1,1.3);tone(523,.5,'sine',.09,1.2);tone(659,.6,'sine',.08,1.1);
 }
}
function tickLetters(dt){
 for(const L of letters){
  L.age+=dt;L.x+=L.vx*dt;
  if(Math.hypot(L.x-player.x,L.y-player.y)<26)resolveLetter(L,false);
  else if(L.x<-70)resolveLetter(L,false);
 }
 letters=letters.filter(L=>!L.dead);
}
function tick(dt){
 if(!active()||state!=='play')return;
 remember(dt);
 if(!minute&&!mission.minuteTaken&&minuteDue()){
  minute=makeMinute();
  if(wave!==2){particle(minute.x,minute.y,'#ffd9a0',24);tone(880,.3,'sine',.07,1.4);say('MINUTE LIBÉRÉE · marche sur le cadran pour la rendre',2.8)}
 }
 if(wave===2&&minute&&!minute.guard&&!enemies.some(e=>!e.dead&&e.kind==='wickWarden')&&!minute.spawned){
  minute.spawned=true;spawnFoe('wickWarden',400,270,0);
 }
 if(boss)boss.hintCd=Math.max(0,(boss.hintCd||0)-dt);
 mission.digitTimer=(mission.digitTimer||0)-dt;
 if(mission.digitTimer<=0){mission.digitTimer=5;mission.digit=1+((mission.digit||1)%5)}
 for(const m of marks){
  m.age+=dt;
  if(m.source&&m.source.dead){m.age=m.warn+m.life;continue}
  if(!m.struck&&m.age>=m.warn){
   m.struck=true;
   const inside=near(player.x,player.y,m.x,m.y,m.r);
   if(isReal(m)&&m.snuff&&inside&&m.source&&!m.source.dead){
   m.source.stolen=Math.min(3,(m.source.stolen||0)+1);
   flame=Math.max(0,flame-1);habits.flames++;
   particle(player.x,player.y,'#f4c98f',18);tone(240,.24,'sine',.07,.7);
   say('MÈCHE SOUFFLÉE · tue le Moucheur pour la reprendre',2.6);
  }
   else if(isReal(m)&&inside)hurt(25,'la cire annoncée');
   else if(m.graze&&inside&&player.dash>0){m.grazed=true}
   particle(m.x,m.y,isReal(m)?'#ffd9a0':'#b9a7c9',10);
  }
  if(m.graze&&!m.grazed&&m.age>=m.warn-.2&&near(player.x,player.y,m.x,m.y,m.r)&&player.inv<=0){
   m.grazed=true;graze++;window.League?.event?.('graze',1);score+=25*combo;say('FRÔLEMENT TENU · le bronze paie',1.6);
  }
 }
 marks=marks.filter(m=>m.age<m.warn+m.life);
 for(const s of salt){
  s.age+=dt;
  if(s.age>.35&&near(player.x,player.y,s.x,s.y,s.r)){
   if(player.dash>0&&!s.cleansed){
    s.cleansed=true;s.age=s.life;countTrial('saltDash');
    score+=75*(stage+1);particle(s.x,s.y,'#e8dcc0',12);
    say('TRACE EFFACÉE · esquive réussie',1.5);
   }else if(!s.cleansed)player.slow=Math.max(player.slow,.4);
  }
 }
 salt=salt.filter(s=>s.age<s.life);
 for(const b of hostile)if(b.frozen){
  b.freezeLeft-=dt;
  if(b.freezeLeft<=0){b.frozen=false;b.vx=b.frozenVx;b.vy=b.frozenVy}
 }
 if(playerInHalo()){haloTime+=dt;if(haloTime>=1){haloTime=0;habits.halos++}}else haloTime=0;
 tickSlams(dt);
 tickMimics(dt);
 tickMinute(dt);
 tickFlame(dt);
 tickLetters(dt);
 hitTargets();
 if(gesture)gesture.tick(dt);
}

/* La flamme ralentit le tir, elle ne le coupe JAMAIS. Le facteur est appliqué
   par game.js au moment où le prochain tir est armé : toucher player.fire
   pendant l'attente empêchait définitivement de tirer. */
function fireDelay(){
 return active()&&state==='play'?1+(3-flame)*.22:1;
}
function tickFlame(dt){
 if(meche){
  meche.age+=dt;meche.y+=42*dt;
  if(near(player.x,player.y,meche.x,meche.y,44)){flame=Math.min(3,flame+1);meche=null;say('MÈCHE REPRISE · flamme '+flame+'/3',2)}
  else if(meche.y>H+40)meche=null;
 }
}

/* --- Dégâts : héritage protecteur + chiffres du cadran ------------------- */
const baseDamageEnemy=damageEnemy;
damageEnemy=function(e,n,...rest){
 if(!active())return baseDamageEnemy(e,n,...rest);
 if(e.boss&&bossKinds.has(e.kind)){
  e.blockHit=.12;
  if((e.hintCd||0)<=0){e.hintCd=4;say('INSENSIBLE · '+HOWTO[e.kind],2.4)}
  return;
 }
 let value=n;
 if(e.kind==='waxMimic'&&e.disguise){e.cleanSealShot=true;e.disguise=false;e.revealed=true;value*=2}
 if(e.kind==='unnamedDigit'&&e.digit===mission.digit)e.weakHit=true;
 if(e.kind==='unnamedDigit'&&e.digit===mission.digit)value*=2;
 /* Halo allumé : plus personne ne perd de PV — pas même le porteur du cercle. */
 if(haloLit()){e.hit=0;if((e.immunePing||0)<=0)particle(e.x,e.y,'#b9d8ea',8);e.immunePing=.9;return}
 if(e.kind==='hollowFlame'&&e.lit&&stage===2)value*=.55;
 return baseDamageEnemy(e,value,...rest);
};

/* Ramasser un pli cacheté : seulement dans l'ordre I → II → III.
   Un pli touché trop tôt se brise et coûte la chaîne. */
function collectPli(d){
 if(!mission.plis)return true;
 if(d&&d.pli===mission.plis.next){
  mission.plis.next++;mission.plis.got++;
  score+=250;combo=Math.min(8,combo+1);comboTime=Math.max(comboTime,2);
  particle(player.x,player.y,'#ffd9a0',16);tone(700,.2,'triangle',.08,1.3);
  if(mission.plis.got>=3){
   score+=1000;
   /* Le sceau complet paie enfin quelque chose que le vol ressent : un bouclier de cire. */
   player.shield=Math.max(player.shield||0,100);player.shieldTime=Math.max(player.shieldTime||0,6);
   particle(player.x,player.y,'#e8d3ab',28);
   say('SCELLÉ COMPLET · les trois plis cachetés · +1000 · BOUCLIER DE CIRE 6 s',3.2);
  }
  else say('PLI '+VIAL_ROMAN[d.pli-1]+' CACHETÉ · +250 · l’ordre paie',2.2);
  return true;
 }
 combo=1;chain=0;comboTime=0;
 tone(170,.18,'square',.06,.6);
 say('PLI SCELLÉ POUR PLUS TARD · brise le pli '+VIAL_ROMAN[(mission.plis.next||1)-1]+' d’abord',2.2);
 return false;
}

const baseReward=reward;
reward=function(e){
 /* La prime se décide avant que baseReward marque la cible morte. */
 const primePay=active()&&e&&!e.dead&&stage===0&&mission.prime&&!e.boss&&e.kind===mission.prime;
 if(active()&&e&&!e.dead){
  if(e.kind==='crackedBell'){breakBell(e);if(e.linkedBell)countTrial('crackedBell')}
  if(e.kind==='waxMimic'&&e.cleanSealShot)countTrial('waxMimic');
  if(e.kind==='snufferHand'&&e.stolen>0)countTrial('snufferHand');
  if(e.kind==='unnamedDigit'&&e.weakHit)countTrial('unnamedDigit');
  const armed=marks.some(m=>m.source===e&&!m.struck);
  if(armed||e.kind==='wickWarden'||e.kind==='facelessEcho'){
   habits.relays++;
   for(const m of marks)if(m.source===e)m.age=m.warn+m.life;
  }
  if(e.seal){mission.seals=(mission.seals||0)+1;say('SCEAU ÉTEINT · '+mission.seals+'/2',2)}
  if(e.kind==='hollowFlame'&&e.lit){habits.flames++;flame=Math.max(0,flame-1)}
  if(e.kind==='snufferHand'&&e.stolen>0){
   flame=Math.min(3,flame+e.stolen);
   say('MÈCHES REPRISES · flamme '+flame+'/3',2.2);particle(e.x,e.y,'#f4c98f',24);
  }
  if(e.kind==='waxMimic'&&e.disguise){
   score+=250*(stage+1);say('FAUX-CIERGE PERCÉ · +'+250*(stage+1)+' points',2.2);
   particle(e.x,e.y,'#e8d3ab',20);
  }
  if(e.kind==='shutterImp')for(const sl of slams)if(sl.source===e){sl.done=true;sl.cancelled=true}
 }
 const result=baseReward(e);
 /* La prime s'encaisse après le calcul de base : le +400 et le pas de combo
    ne sont pas écrasés par la chaîne. */
 if(primePay){
  score+=400;combo=Math.min(8,combo+1);comboTime=Math.max(comboTime,2);
  /* LE MAILLON PRIME : la prime abattue dépouille l'écran — chaque esprit ennemi devient un cachet. */
  let canceled=0;
  for(const h of hostile){canceled++;score+=50;particle(h.x,h.y,'#ffd25e',6)}
  hostile.length=0;
  particle(e.x,e.y,'#ffd25e',34);particle(e.x,e.y,'#fff5cc',12);tone(660,.2,'square',.07,1.5);
  say('★ PRIME ABATTUE · '+(foeNames[e.kind]||e.kind)+' ★ +'+(400+canceled*50)+(canceled?(' · '+canceled+' esprit'+(canceled>1?'s':'')+' payé'+(canceled>1?'s':'')):''),2.4);
 }
 /* Couronnes de l'heure : maîtrise sans vie perdue, vitesse, et pour la
    Veilleuse, une veille sans tache. Persistantes, jamais d'empowerment. */
 if(active()&&e.boss){
  const guardianKinds=['veilleuse','sonneur','passeur','cueilleuse','chasseur'];
  if(guardianKinds.includes(e.kind)){
   /* Le cachet du cadran : chaque gardien tombé scelle la minute — +1000, sans condition. */
   score+=1000;say('CACHET DU CADRAN · +1000 points',2.6);particle(e.x,e.y,'#ffd9a0',40);tone(659,.5,'sine',.08,1.25);
   const lost=((window.Journey?.run?.stats?.lifeLoss)||0)-(e.lossStart||0);
   const earned=[];
   if(lost<=0&&window.Campaign?.awardCrown?.(e.kind,'patience'))earned.push('SANS BRISURE');
   if((e.age||0)<=90&&window.Campaign?.awardCrown?.(e.kind,'rapide'))earned.push('SOUS 90 SECONDES');
   if(e.kind==='veilleuse'&&!mission.veilleComplete&&window.Campaign?.awardCrown?.('veilleuse','calme'))earned.push('VEILLE CALME');
   if(mission.legere&&window.Campaign?.awardCrown?.('minutes','legere'))earned.push('MAIN LÉGÈRE');
   if(earned.length){say('COURONNE'+(earned.length>1?'S':'')+' DE L’HEURE · '+earned.join(' · '),3);particle(e.x,e.y,'#ffd25e',44)}
  }
 }
 return result;
};

/* Les mèches de la Veilleuse ne sont jamais deux fois au même endroit :
   colonnes mélangées, hauteur et phase de flamme tirées au sort. */
function makeWicks(){
 const cols=[100,215,330,445,560,675];
 for(let i=cols.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));const t=cols[i];cols[i]=cols[j];cols[j]=t}
 return cols.slice(0,5).map(x=>({
  x:clamp(x+rng()*36-18,80,720),
  y:300+Math.floor(rng()*3)*56,
  lit:true,open:0,charge:0,age:0,seed:rng()*Math.PI*2,
  relight:Infinity,relightMax:11
 }));
}

/* --- Gardiens : cinq jauges, cinq victoires ------------------------------ */
let chorusSeq=0;
function spawnChorus(n){
 for(let i=0;i<n;i++){
  const a=Math.random()*Math.PI*2;
  enemies.push({id:'choir-'+(++chorusSeq),kind:'waxChorist',x:400+Math.cos(a)*165,y:190+Math.sin(a)*64,baseX:400,homeY:250,pattern:99,r:17,elite:false,tier:0,hp:2,max:2,speed:0,fire:999,age:0,hit:0,orbitAngle:a,orbitPhase:Math.random()*Math.PI*2,bossChorus:true,seed:Math.random()*Math.PI*2,timer:4,cadence:999,loot:false});
 }
}
function choristsAlive(){return enemies.some(o=>!o.dead&&o.kind==='waxChorist')}
const baseSpawnBoss=spawnBoss;
spawnBoss=function(){
 if(!active())return baseSpawnBoss();
 dailyWaveReward();clean=true;
 const kind=world.kind;
 boss={x:400,y:-90,baseX:400,hp:1,max:1,r:50,speed:0,kind,boss:true,age:0,fire:999,cycle:0,adds:999,
  phase:1,phaseShield:0,phaseFlash:0,damageBudget:0,budgetRate:0,poison:0,poisonTick:0,hit:0,blockHit:0,
  timer:0,step:0,value:0,label:'',lossStart:window.Journey?.run?.stats.lifeLoss||0};
  if(kind==='veilleuse'){
  boss.windows=makeWicks();
  boss.tour=0;boss.label='MÈCHES';boss.core=null;
  boss.openTimer=1.2;boss.guard=1.2;boss.lastOpen=null;boss.volley=null;boss.flareTimer=6;boss.flare=null;
  boss.absorbPing=0;boss.zapPing=0;boss.channelRate=2.6;boss.chorusTick=1.6;
  spawnChorus(2);boss.choirWasUp=true;
 }else if(kind==='sonneur'){
  boss.bell={x:400,y:330,r:58};boss.clapper={x:400,y:236,r:24,down:false};
  boss.resonance=0;boss.strikes=0;boss.ring=0;boss.label='RÉSONANCE';
 }else if(kind==='passeur'){
  boss.sand=[{x:180,y:440},{x:620,y:440},{x:180,y:690},{x:620,y:690}].map(p=>({...p,r:92,fresh:true}));
  boss.open=0;boss.openUsed=false;boss.breaks=0;boss.reset=0;boss.ghost=null;boss.label='SABLE INTACT';
 }else if(kind==='cueilleuse'){
  boss.lanterns=[200,400,600].map(x=>({x,y:340,lit:false}));
  boss.steal=5;boss.vulnerable=0;boss.collected=0;boss.used=false;flame=3;boss.label='LANTERNES';
 }else{
  const order=Object.entries(habits).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
  boss.borrow=[order[0],order[1],order[0]];boss.least=order[order.length-1];
  boss.borrowed=0;boss.window=8;boss.grace=1.6;boss.naming=false;boss.halo=null;boss.label='EMPRUNTS';
 }
 enemies.push(boss);schedule=[];
 const bossShown=instructionPopup('w3-boss-'+kind,world.boss,'<p><b>Pour gagner :</b> '+VICTORY[kind]+'.</p><p>'+HOWTO[kind]+'</p>');
 if(!bossShown)say(world.boss+' · '+VICTORY[kind],3.2);
 mp3Music?.bossArrival(activeMusicThemes()[stage%activeMusicThemes().length].id);
 if(kind==='veilleuse'){spawnFoe('wickWarden',220,250,0);spawnFoe('wickWarden',580,250,1)}
};

function moveBoss(e,dt,oldX,oldY){
 if(!active()||!bossKinds.has(e.kind))return false;
 boss=e;e.blockHit=Math.max(0,(e.blockHit||0)-dt);
 if(e.y<190){e.y=Math.min(190,e.y+95*dt);return true}
 e.timer+=dt;
 if(e.kind==='veilleuse')tickVeilleuse(e,dt);
 else if(e.kind==='sonneur')tickSonneur(e,dt);
 else if(e.kind==='passeur')tickPasseur(e,dt);
 else if(e.kind==='cueilleuse')tickCueilleuse(e,dt);
 else tickChasseur(e,dt);
 if(e.value>=1&&!e.dead){e.value=1;reward(e)}
 return true;
}

/* 1 · La Veilleuse — elle défend ses mèches. Chaque fenêtre encore allumée
   peut tirer : plus il en reste, plus la salve est dense. Éteindre une mèche
   supprime donc une bouche à feu, ce qui rend la suivante plus accessible.
   La ronde de cire (les Veilleuses) garde le cœur et rallume les flammes :
   tant qu'au moins une veilleuse est en vie, seuls les cierges peuvent être
   atteints — le cœur lui, reste clos sous la cire. */
function tickChorusLogic(e,dt){
 const choir=enemies.filter(o=>!o.dead&&o.kind==='waxChorist');
 e.chorusTick=(e.chorusTick||1.5)-dt;
 if(e.chorusTick<=0){
  e.chorusTick=e.channelRate||2.6;
  const dark=(e.windows||[]).filter(w=>!w.lit&&!(w.zap>0));
  if(dark.length&&choir.length){
   let pick=null,best=Infinity;
   for(const w of dark)for(const c of choir){const d=Math.hypot(w.x-c.x,w.y-c.y);if(d<best){best=d;pick={w,c}}}
   if(pick){pick.w.zap=1.15;pick.w.zapBy=pick.c}
  }
 }
}
function tickVeilleuse(e,dt){
 e.absorbPing=Math.max(0,(e.absorbPing||0)-dt);
 e.zapPing=Math.max(0,(e.zapPing||0)-dt);
 tickChorusLogic(e,dt);
 if(e.phase===2){
  const core=e.core;if(!core)return;
  core.x=e.x;core.y=e.y+26;
  core.open=Math.max(0,core.open-dt);core.flash=Math.max(0,core.flash-dt);
  core.openTimer-=dt;core.attack-=dt;
  if(core.openTimer<=0){core.open=.95;core.openTimer=2.35;say('LE CŒUR BATT · frappe pendant le flash',1.4);tone(65,.38,'sine',.09,.8)}
  /* Cendres : une demi-seconde après chaque impact, le cœur souffle une
     couronne de dix braises. Le coup récompense, puis il punit le camping. */
  if(core.ember){
   core.ember-=dt;
   if(core.ember<=0){
    core.ember=null;
    for(let i=0;i<10;i++){
     const a=i*Math.PI/5;
     hostile.push({x:core.x,y:core.y,vx:Math.cos(a)*132,vy:Math.sin(a)*132,type:'spirit',r:7,damage:25,life:3.4,grazed:false,age:0,speed:132});
    }
    say('LE CŒUR CRACHE DES CENDRES · écarte-toi',2);
    particle(core.x,core.y,'#ffb37a',22);tone(150,.3,'sine',.09,.7);
   }
  }
  /* La veille ne s'éteint jamais vraiment : une mèche noire se réchauffe et
     recrache une braise, annoncée par le même anneau orangé que la salve. */
  e.flareTimer=(e.flareTimer||6)-dt;
  if(e.flareTimer<=0&&!e.flare){
   e.flareTimer=7+rng()*2.5;
   const dark=(e.windows||[]).filter(w=>!w.lit);
   if(dark.length)e.flare={wick:dark[Math.floor(rng()*dark.length)],charge:.75};
  }
  if(e.flare){
   const f=e.flare;f.charge-=dt;f.wick.charge=Math.max(0,f.charge);
   if(f.charge<=0){
    const aim=Math.atan2(player.y-f.wick.y,player.x-f.wick.x);
    shootHostile({x:f.wick.x,y:f.wick.y,boss:true,phase:2},'spirit',[0],168,aim);
    particle(f.wick.x,f.wick.y,'#ff9d7a',8);f.wick.charge=0;e.flare=null;tone(260,.16,'triangle',.05,.8);
   }
  }
  if(core.attack<=0){core.attack=1.9;const aim=Math.atan2(player.y-core.y,player.x-core.x);shootHostile({x:core.x,y:core.y,boss:true,phase:2},'spirit',[-.18,0,.18],145,aim)}
  e.value=.5+core.hits/6;e.label='CŒUR · '+core.hits+'/3 IMPACTS';
  const choirUp=enemies.some(o=>!o.dead&&o.kind==='waxChorist');
  if(e.choirWasUp&&!choirUp&&e.core){
   e.choirWasUp=false;e.core.open=1.7;e.core.openTimer=2.1;
   say('LA CIRE DÉCHIRE · le cœur bat à nu',2.8);tone(120,.7,'sine',.1,.7);particle(e.x,e.y,'#ffd9a0',34);
  }
  return;
 }
 const windows=e.windows;
 for(const w of windows){
  w.open=Math.max(0,w.open-dt);
  w.charge=Math.max(0,(w.charge||0)-dt);
  w.age=(w.age||0)+dt;
  /* Chaque mèche éteinte porte son propre rallumage visible : la Veilleuse
     ne se contente plus d'en relancer une au hasard, chacune recompte. */
  if(w.zap>0){
   w.zap-=dt;
   if(w.zapBy&&w.zapBy.dead)w.zap=0;
   if(w.zap<=0){
    w.zap=0;const srcC=w.zapBy;w.zapBy=null;
    if(!w.lit){w.lit=true;w.relight=Infinity;w.open=0;w.charge=0;w.seed=rng()*Math.PI*2;w.age=0;
     particle(w.x,w.y,'#ffb37a',14);tone(640,.2,'sine',.06,1.1);
     if((e.zapPing||0)<=0){e.zapPing=1.6;say('LA RONDE RALLUME UNE MÈCHE · éteins-la maintenant',1.6)}}
   }
  }
  if(!w.lit&&isFinite(w.relight)&&w.relight>0){
   w.relight-=dt;
   if(w.relight<=0){
    w.lit=true;w.relight=Infinity;w.open=0;w.charge=0;w.seed=rng()*Math.PI*2;w.age=0;
    particle(w.x,w.y,'#ffd9a0',14);tone(640,.2,'sine',.06,1.1);
    say('UNE MÈCHE SE RALLUME · '+windows.filter(v=>!v.lit).length+' éteintes',1.8);
   }
  }
 }
 // Quelle mèche s'ouvre est tiré au sort, jamais deux fois la même de suite.
 e.openTimer=(e.openTimer||0)-dt;
 if(e.openTimer<=0){
  e.openTimer=1.9+rng()*1.2;
  const lit=windows.filter(w=>w.lit);
  const pool=lit.length?lit:windows;
  const rest=pool.filter(w=>w!==e.lastOpen);
  const from=rest.length?rest:pool;
  const pick=from[Math.floor(rng()*from.length)];
  pick.open=1.7;e.lastOpen=pick;
 }
 const target=e.lastOpen||windows[0];
 e.x+=(target.x-e.x)*Math.min(1,dt*2.4);e.y+=(250-e.y)*Math.min(1,dt*2);
 // Salve de cire : la Veille garde tout son feu tant que la veille est complète.
 // Cinq mèches allumées tirent toutes les ~2,2 s ; chaque extinction lui
 // reprend une bouche à feu et étire le délai jusqu'à ~4,5 s pour la dernière.
 e.guard=(e.guard||0)-dt;
 if(e.guard<=0&&!e.volley){
  const lit=windows.filter(w=>w.lit);
  if(lit.length){
   e.guard=clamp(4.6-lit.length*.5,1.9,4.4)+rng()*.4;
   const count=Math.min(BUDGET.volley,lit.length);
   const picked=lit.slice().sort((a,b)=>Math.abs(a.x-player.x)-Math.abs(b.x-player.x)).slice(0,count);
   for(const w of picked)w.charge=.75;
   e.volley=picked;
  }else e.guard=1;
 }
 if(e.volley&&e.volley.every(w=>w.charge<=0)){
  for(const w of e.volley){
   if(!w.lit)continue;
   const aim=Math.atan2(player.y-w.y,player.x-w.x);
   shootHostile({x:w.x,y:w.y,boss:true,phase:1},'spirit',[0],Math.min(168,BUDGET.shotSpeed),aim);
   particle(w.x,w.y,'#ffd9a0',6);
  }
  tone(260,.16,'triangle',.05,.8);
  e.volley=null;
 }
 const lit=windows.filter(w=>w.lit).length;
 /* Tout passe par les bougies : trois mèches éteintes et la cire se fend —
    le cœur s'expose en plein plat sur le torse, battant. */
 const wicksDown=5-lit;
 const choirCount=enemies.filter(o=>!o.dead&&o.kind==='waxChorist').length;
 e.value=Math.min(.49,(Math.min(3,wicksDown)/3)*.49);
 e.label='MÈCHES ÉTEINTES '+Math.min(3,wicksDown)+'/3 · RONDE '+choirCount;
 if(!e.core&&wicksDown>=3){e.phase=2;e.core={x:e.x,y:e.y+26,r:26,open:0,openTimer:1.1,attack:1.9,hits:0,flash:0,ember:null};e.flareTimer=5;for(const w of windows)w.relight=Infinity;e.value=.5;e.label='CŒUR · 0/3 IMPACTS';say('LA CIRE SE FEND · le cœur bat à nu — frappe-le pendant le flash',4);particle(e.x,e.y,'#ffd9a0',34);tone(120,.7,'sine',.1,.7)}
 if(lit===5&&e.age>6){
  mission.veilleComplete=true;
  hurt(25,'la veille complète');
  say('VEILLE COMPLÈTE · une seule mèche s’éteint',2.4);
  extinguishWick(windows[Math.floor(rng()*windows.length)]);
 }
}

/* 2 · Le Sonneur — la ligne de tir. Ton propre tir automatique est le danger. */
function tickSonneur(e,dt){
 e.clapper.x=400+Math.sin(e.age*.9)*165;
 e.clapper.down=(e.age%8)<2;
 e.x=e.bell.x;e.y=250;
 if(e.ring>0){
  e.ring+=dt;
  const radius=e.ring*260;
  if(Math.abs(Math.hypot(player.x-e.bell.x,player.y-e.bell.y)-radius)<26)hurt(25,'l’onde du clocher');
  if(e.ring>2)e.ring=0;
 }
 if(e.resonance>=100){e.resonance=0;e.ring=.01;say('LA CLOCHE A SONNÉ · une seule onde, écarte-toi',2.4)}
 e.value=e.strikes/3;e.label=e.strikes+' / 3 FRAPPES · RÉSONANCE '+Math.floor(e.resonance)+' %';
}

/* 3 · Le Passeur — mémoire spatiale. Le danger est ton propre trajet. */
function tickPasseur(e,dt){
 e.x=400+Math.sin(e.age*.4)*150;e.y=210;
 e.open=Math.max(0,e.open-dt);
 for(const zone of e.sand){
  if(zone.fresh&&near(player.x,player.y,zone.x,zone.y,zone.r)){
   zone.fresh=false;e.open=2;e.openUsed=false;habits.salt++;
   say('SABLE INTACT FOULÉ · le Passeur devient solide',2);
  }
 }
 if(e.sand.every(z=>!z.fresh)){
  e.reset+=dt;
  if(e.reset>=5){e.reset=0;for(const z of e.sand)z.fresh=true;say('LA MARÉE EFFACE LES TRACES',2)}
 }
 const past=pastPlayer(3.2);
 e.ghost={x:past.x,y:past.y};
 if(e.age>4&&near(player.x,player.y,past.x,past.y,26))hurt(25,'ton propre sillage');
 e.value=e.breaks/3;e.label=e.breaks+' / 3 BRISURES · '+(e.open>0?'BOUCLE OUVERTE':'SABLE À FOULER');
}

/* 4 · La Cueilleuse — économie. Progresser coûte de la puissance. */
function tickCueilleuse(e,dt){
 e.x=400+Math.sin(e.age*.35)*180;e.y=230;
 e.vulnerable=Math.max(0,e.vulnerable-dt);
 for(const lamp of e.lanterns){
  if(!lamp.lit&&flame>0&&near(player.x,player.y,lamp.x,lamp.y,48)){
   lamp.lit=true;flame--;habits.flames++;particle(lamp.x,lamp.y,'#f4c98f',18);
   say('LANTERNE ALLUMÉE · flamme '+flame+'/3 · cadence réduite',2.2);
   if(flame===0&&!meche)meche={x:clamp(player.x+120,80,720),y:280,age:0};
  }
 }
 e.steal-=dt;
 if(e.steal<=0){
  e.steal=5;
  const lit=e.lanterns.filter(l=>l.lit);
  if(lit.length&&e.vulnerable<=0){lit[0].lit=false;say('ELLE CUEILLE UNE FLAMME',1.8)}
 }
 if(e.lanterns.every(l=>l.lit)&&e.vulnerable<=0&&!e.used){e.vulnerable=3;e.used=true;say('TROIS FLAMMES · elle doit venir les cueillir',2.4)}
 if(e.vulnerable<=0&&e.used){e.used=false}
 e.value=e.collected/3;e.label=e.collected+' / 3 CUEILLETTES · FLAMME '+flame+'/3';
}

/* 5 · Le Chasseur — il lit tes habitudes et emprunte ce que tu utilises le plus. */
function tickChasseur(e,dt){
 e.x=400+Math.sin(e.age*.5)*170;e.y=220;
 if(e.naming){
  e.label='GESTE NON COPIÉ · '+HABITS[e.least];
  e.value=e.borrowed/3;
  offerGesture(e);
  return;
 }
 e.window-=dt;
 const habit=e.borrow[Math.min(e.borrowed,2)];
 e.grace=Math.max(0,(e.grace||1.6)-dt);
 if(habit==='halos'){
  e.halo=e.halo||{x:clamp(player.x,180,620),y:clamp(player.y,420,720),r:150};
  e.halo.r=Math.max(96,e.halo.r-8*dt);
  if(e.grace<=0&&!near(player.x,player.y,e.halo.x,e.halo.y,e.halo.r))hurt(25,'l’obscurité empruntée');
 }else if(habit==='salt'&&e.timer>1.4){
  e.timer=0;const past=pastPlayer(1);
  salt.push({x:clamp(past.x,50,750),y:clamp(past.y,320,830),r:60,age:0,life:2.4});
  if(salt.length>7)salt.shift();
 }else if(habit==='relays'&&e.timer>2.6){
  e.timer=0;
  if(liveFoes()<BUDGET.adds)spawnFoe('facelessEcho',e.x<400?620:180,260,0);
  addMark({x:player.x,y:player.y,r:70,warn:1.4,source:e,label:'EMPRUNT'});
 }else if(habit==='flames'&&e.timer>2.6){
  e.timer=0;flame=Math.max(1,flame-1);say('IL EMPRUNTE TA FLAMME · cadence réduite',1.8);
 }
 if(e.window<=0){
  e.window=8;e.grace=1.6;e.borrowed++;e.halo=null;salt=[];
  if(e.borrowed>=3){e.naming=true;say('IL N’A PLUS DE VISAGE · '+HABITS[e.least],3.4)}
  else say('EMPRUNT '+e.borrowed+'/3 · '+HABITS[e.borrow[Math.min(e.borrowed,2)]],2.6);
 }
 e.value=e.borrowed/3;e.label=e.borrowed+' / 3 EMPRUNTS · '+HABITS[habit];
}

function offerGesture(e){
 if(gesture&&gesture.kind===e.least)return;
 const kind=e.least;
 gesture={kind,done:false,time:0,
  tick(dt){
   this.time+=dt;
   if(this.done)return;
   let ok=false;
   if(kind==='relays')ok=!enemies.some(o=>!o.dead&&o.kind==='facelessEcho');
   else if(kind==='halos')ok=playerInHalo();
   else if(kind==='salt')ok=near(player.x,player.y,140,760,70)||near(player.x,player.y,660,760,70);
   else ok=!!(this.offered&&this.offered.dead);
   if(ok){this.done=true;gesture=null;boss.value=1;say('LE GESTE RENDU · l’heure n’a plus besoin de courir',3)}
  }};
 if(kind==='relays')spawnFoe('facelessEcho',400,280,0);
 if(kind==='halos')spawnFoe('wickWarden',400,300,0);
 if(kind==='flames'){const lamp=spawnFoe('hollowFlame',400,300,0);if(lamp){lamp.lit=true;gesture.offered=lamp}}
 say('ACCOMPLIS : '+HABITS[kind],3);
}

/* --- Frappes du joueur sur les cibles des gardiens ----------------------- */
function consume(shot){shot.life=0}
function hitTargets(){
 const e=boss;
 if(!e||e.dead||!active())return;
 for(const shot of shots){
  if(shot.life<=0)continue;
  /* La minute suspendue : tout tir sur la lettre brise le sceau. */
  for(const L of letters)if(!L.dead&&near(shot.x,shot.y,L.x,L.y,24)){resolveLetter(L,true);consume(shot)}
  if(e.kind==='veilleuse'&&e.phase===2&&e.core){
   const core=e.core;
   if(choristsAlive()){
    /* La ronde couvre le cœur : le tir y échoue tant qu'une veilleuse veille. */
    if(near(shot.x,shot.y,core.x,core.y,core.r+8)){
     consume(shot);particle(core.x,core.y,'#dcecf5',6);
     if((e.absorbPing||0)<=0){e.absorbPing=1.3;say('LA RONDE ABSORBE LE TIR · brise d’abord une veilleuse',1.8);tone(280,.09,'square',.045,.5)}
    }
   }else if(core.open>0&&near(shot.x,shot.y,core.x,core.y,core.r+8)){
    core.hits++;core.open=0;core.openTimer=1.35;core.flash=.3;core.ember=.5;consume(shot);particle(core.x,core.y,'#e8d3ab',26);tone(920,.24,'triangle',.09,1.45);
    /* Chaque impact brise une phase : la ronde revient, plus nombreuse, une
       mèche repart — mais la sorcière gagne un bouclier de cire. */
    player.shield=Math.max(player.shield||0,100);player.shieldTime=Math.max(player.shieldTime||0,6);
    const refill=core.hits===1?2:core.hits===2?3:0;
    if(refill){spawnChorus(refill);e.choirWasUp=true}
    const dark=(e.windows||[]).filter(w=>!w.lit);
    if(dark.length){const w=dark[Math.floor(rng()*dark.length)];w.lit=true;w.relight=Infinity;w.open=0;w.charge=0;w.zap=0;w.seed=rng()*Math.PI*2;particle(w.x,w.y,'#ffb37a',10)}
    if(core.hits===1)e.channelRate=2.1;else if(core.hits===2)e.channelRate=1.7;
    say('CŒUR FRAPPÉ · '+core.hits+'/3 · PHASE BRISÉE — bouclier de cire 6 s'+(refill?' — la ronde revient ('+refill+')':''),2.6);
   }
  }else if(e.kind==='veilleuse'){
   /* La ronde couvre tout le corps du gardien ; seules les mèches restent
      shootables — les cierges sont la voie ouverte du combat. */
   if(choristsAlive()&&near(shot.x,shot.y,e.x,e.y,e.r+8)){
    consume(shot);particle(e.x,e.y,'#dcecf5',6);
    if((e.absorbPing||0)<=0){e.absorbPing=1.3;say('LA RONDE ABSORBE LE TIR · brise d’abord une veilleuse',1.8);tone(280,.09,'square',.045,.5)}
   }else{
    for(const w of e.windows)if(w.lit&&w.open>0&&near(shot.x,shot.y,w.x,w.y,26)){
     extinguishWick(w);consume(shot);particle(w.x,w.y,'#ffd9a0',16);tone(560,.2,'sine',.07,1.2);
     say('MÈCHE ÉTEINTE · '+e.windows.filter(v=>!v.lit).length+'/5',1.6);break;
    }
   }
  }else if(e.kind==='sonneur'){
   if(e.clapper.down&&near(shot.x,shot.y,e.clapper.x,e.clapper.y,e.clapper.r+6)){
    e.strikes++;consume(shot);particle(e.clapper.x,e.clapper.y,'#cfe6d8',20);tone(880,.25,'triangle',.08,1.3);
    say('BATTANT FRAPPÉ · '+e.strikes+'/3',1.8);continue;
   }
   if(near(shot.x,shot.y,e.bell.x,e.bell.y,e.bell.r)){e.resonance=Math.min(100,e.resonance+7);consume(shot)}
  }else if(e.kind==='passeur'){
   if(e.open>0&&!e.openUsed&&near(shot.x,shot.y,e.x,e.y,e.r+8)){
    e.openUsed=true;e.breaks++;consume(shot);particle(e.x,e.y,'#e8dcc0',24);say('BOUCLE BRISÉE · '+e.breaks+'/3',1.8);
   }
  }else if(e.kind==='cueilleuse'){
   if(e.vulnerable>0&&near(shot.x,shot.y,e.x,e.y,e.r+8)){
    e.vulnerable=0;e.collected++;consume(shot);flame=3;
    for(const lamp of e.lanterns)lamp.lit=false;
    particle(e.x,e.y,'#f4c98f',26);say('CUEILLETTE FORCÉE · '+e.collected+'/3',2);
   }
  }
 }
}

/* --- Rendu : la silhouette vient de sixth-hour-art.js -------------------
   Les sprites détaillés sont enregistrés dans window.MinuitArt par le module
   artistique, qui ajoute ses couches d'animation. Ce wrapper ne fait que
   router les formes du monde 3 vers lui, y compris hors combat (aperçus). */
const baseSprite=sprite;
sprite=function(g,kind,x,y,s=1,t=0,hit=0,tint=''){
 if(active()&&(foeKinds.has(kind)||bossKinds.has(kind))&&window.SixthHourArt?.drawActor(g,{kind},x,y,s,t,hit))return;
 return baseSprite(g,kind,x,y,s,t,hit,tint);
};

function ring(g,x,y,r,color,dashed){
 g.save();g.strokeStyle=color;g.lineWidth=2.5;
 if(dashed)g.setLineDash([9,9]);
 g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.restore();
}

/* Objets du monde 3 : une vraie image, un halo, une légende lisible. */
function drawItem(g,key,x,y,size,label,color){
 const image=window.MinuitArt?.[key];
 g.save();
 const halo=g.createRadialGradient(x,y,2,x,y,size*.8);
 halo.addColorStop(0,color+'55');halo.addColorStop(1,color+'00');
 g.fillStyle=halo;g.beginPath();g.arc(x,y,size*.8,0,Math.PI*2);g.fill();
 if(image?.complete&&image.naturalWidth)g.drawImage(image,x-size/2,y-size/2,size,size);
 g.textAlign='center';g.fillStyle=color;g.font='bold '+(compactView()?'14px':'10px')+' Arial';
 g.fillText(label,x,y+size*.62);
 g.restore();
}

/* La minute suspendue : enveloppe crème, sceau de cire rouge, halo doré. */
function drawLetter(g,L){
 const sway=Math.sin(L.age*1.7+L.seed)*.07,pulse=1+Math.sin(L.age*3.2)*.06;
 g.save();g.translate(L.x,L.y);g.rotate(sway);
 const halo=g.createRadialGradient(0,0,2,0,0,64*pulse);
 halo.addColorStop(0,'#ffd9a060');halo.addColorStop(1,'#ffd9a000');
 g.fillStyle=halo;g.beginPath();g.arc(0,0,64*pulse,0,Math.PI*2);g.fill();
 g.fillStyle='#f2e4c2';g.fillRect(-34,-22,68,44);
 g.strokeStyle='#7a5a3a';g.lineWidth=2;g.strokeRect(-34,-22,68,44);
 g.beginPath();g.moveTo(-32,-20);g.lineTo(0,11);g.lineTo(32,-20);g.stroke();
 g.fillStyle='#a33a2a';g.beginPath();g.arc(0,5,13,0,Math.PI*2);g.fill();
 g.strokeStyle='#6b2317';g.lineWidth=2;g.beginPath();g.arc(0,5,9,0,Math.PI*2);g.stroke();
 g.restore();
 g.save();g.textAlign='center';g.font='700 '+(compactView()?'12px':'10px')+' Arial';g.fillStyle='#ffe6bd';g.strokeStyle='#000a';g.lineWidth=2.4;g.strokeText('NE TIRE PAS',L.x,L.y-36);g.fillText('NE TIRE PAS',L.x,L.y-36);g.restore();
}
/* Les mèches du gardien : lanterne de fer, flamme qui vacille, fumée quand
   elle est éteinte, et anneau de charge quand elle s'apprête à tirer. */
function drawWicks(g,e){
 const lantern=window.MinuitArt?.bossWick,fire=window.MinuitArt?.bossFlame;
 for(const [i,w] of e.windows.entries()){
  const t=(w.age||0)+(w.seed||0),flick=.92+Math.sin(t*9)*.06+Math.sin(t*23)*.03;
  const sway=Math.sin(t*4.2)*1.8;
  g.save();
  if(w.lit){
   const halo=g.createRadialGradient(w.x,w.y,3,w.x,w.y,62);
   halo.addColorStop(0,'#ffd9a055');halo.addColorStop(.5,'#e5854e22');halo.addColorStop(1,'#e5854e00');
   g.fillStyle=halo;g.beginPath();g.arc(w.x,w.y,62,0,Math.PI*2);g.fill();
  }
  if(lantern?.complete&&lantern.naturalWidth)g.drawImage(lantern,w.x-37,w.y-11,74,74);
  if(w.lit){
   if(fire?.complete&&fire.naturalWidth){
    const size=54*flick;
    g.drawImage(fire,w.x-size/2+sway,w.y+2-size/2,size,size);
   }else{
    g.fillStyle='#ffd9a0';g.beginPath();g.ellipse(w.x+sway,w.y-6,7*flick,15*flick,0,0,Math.PI*2);g.fill();
   }
  }else{
   // Mèche noircie et filet de fumée : on voit qu'elle est prise.
   g.strokeStyle='#4a3b46';g.lineWidth=2.4;
   g.beginPath();g.moveTo(w.x,w.y+14);g.lineTo(w.x,w.y+6);g.stroke();
   for(let i=0;i<3;i++){
    const rise=(t*22+i*16)%48;
    g.globalAlpha=Math.max(0,.34-rise/150);g.fillStyle='#b9a7c9';
    g.beginPath();g.arc(w.x+Math.sin((t+i)*2)*5,w.y+4-rise,3+i*1.1,0,Math.PI*2);g.fill();
   }
   g.globalAlpha=1;
   // Compte à rebours de rallumage : l'anneau se remplit, puis la mèche repart.
   if(isFinite(w.relight)&&w.relight<Infinity){
    const total=w.relightMax||11,progress=clamp(1-w.relight/total,0,1);
    g.strokeStyle=progress<.6?'#d9a05f':'#ff9d7a';
    g.globalAlpha=.35+progress*.55;g.lineWidth=3;
    g.beginPath();g.arc(w.x,w.y,26,-Math.PI/2,-Math.PI/2+progress*Math.PI*2);g.stroke();
    g.globalAlpha=1;
   }
  }
  if(w.charge>0){
   const pulse=1-w.charge/.75;
   g.strokeStyle='#ff9d7a';g.lineWidth=2.6;g.globalAlpha=.5+pulse*.5;
   g.beginPath();g.arc(w.x,w.y,30+pulse*8,0,Math.PI*2);g.stroke();g.globalAlpha=1;
  }
  if(w.open>0)ring(g,w.x,w.y,32,'#fff5cc');
  g.textAlign='center';
  /* Libellé recentré si la mèche est tirée au bord de l’arène. */
  const lx=clamp(w.x,92,W-92);
  if(w.open>0){
   g.fillStyle='#fff5cc';g.font='bold '+(compactView()?'16px':'12px')+' Arial';
   g.fillText('TIRE SUR LA FLAMME',lx,w.y-44-(i%2)*14);
  }else if(w.charge>0){
   g.fillStyle='#ff9d7a';g.font='bold '+(compactView()?'14px':'10px')+' Arial';
   g.fillText('ELLE VA TIRER',lx,w.y-44-(i%2)*14);
  }else if(!w.lit){
   g.fillStyle='#8d7a9c';g.font=(compactView()?'13px':'9px')+' Arial';
   g.fillText(isFinite(w.relight)&&w.relight<Infinity?'ÉTEINTE · '+Math.ceil(w.relight)+'s':'ÉTEINTE',lx,w.y-40-(i%2)*13);
  }
  g.restore();
 }
}

/* La minute à rendre : cadran de montre, aiguille qui tourne, état explicite. */
function drawMinute(g,m){
 const total=window.Campaign?.progress?.minutesKept||0;
 const bob=Math.sin(m.age*2)*3;
 ring(g,m.x,m.y,34,'#ffd9a0',m.guard);
 drawItem(g,'minuteToken',m.x,m.y+bob,62,'','#ffd9a0');
 g.save();g.translate(m.x,m.y+bob);
 g.strokeStyle='#fff5cc';g.lineWidth=2;g.lineCap='round';
 const a=m.age*1.1-Math.PI/2;
 g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*13,Math.sin(a)*13);g.stroke();
 g.restore();
 g.save();g.textAlign='center';
 g.fillStyle=m.guard?'#ff9d7a':'#ffd9a0';g.font='bold '+(compactView()?'16px':'12px')+' Arial';
 g.fillText(m.guard?'MINUTE SOUS GARDE':'MINUTE '+(m.index||1)+'/3 À PRENDRE',m.x,m.y+52);
 g.fillStyle='#ffe6bd';g.font=(compactView()?'13px':'10px')+' Arial';
 g.fillText(m.guard?'tue le Garde-mèche, puis marche dessus':'marche dessus · '+total+'/15 rendues',m.x,m.y+67);
 g.restore();
}

/* Le Chœur de cire : des veilleuses de cire gardent le cœur et rallument les
   flammes. Corps de cire, flamme centrale, et l'amorce de rallumage posée sur
   la mèche visée AVANT qu'elle ne reparte — la voir grandir, c'est la course. */
function drawChorus(g,e){
 const choir=enemies.filter(o=>!o.dead&&o.kind==='waxChorist');
 if(!choir.length)return;
 g.save();
 g.globalAlpha=.22;g.setLineDash([6,12]);g.strokeStyle='#ffd9a0';g.lineWidth=1.4;
 g.beginPath();g.ellipse(e.x,e.y+30,165,64,0,0,Math.PI*2);g.stroke();g.setLineDash([]);g.globalAlpha=1;
 for(const c of choir){
  const bob=Math.sin((gameTime+c.orbitPhase||0)*2.2)*2;
  g.save();g.translate(c.x,c.y+bob);
  const flick=.92+Math.sin(((gameTime||0)+c.orbitPhase||0)*7)*.08;
  const halo=g.createRadialGradient(0,0,1,0,0,26);
  halo.addColorStop(0,'#ffd9a055');halo.addColorStop(1,'#ffd9a000');g.fillStyle=halo;g.beginPath();g.arc(0,0,26,0,Math.PI*2);g.fill();
  g.fillStyle='#e8d3ab';g.strokeStyle='#5a4636';g.lineWidth=1.8;
  g.beginPath();g.moveTo(-7,9);g.quadraticCurveTo(-9,-6,0,-10);g.quadraticCurveTo(9,-6,7,9);g.closePath();g.fill();g.stroke();
  g.fillStyle='#1a1428';g.beginPath();g.arc(0,-1,3.6*flick,0,Math.PI*2);g.fill();
  g.fillStyle='#ffd25e';g.beginPath();g.ellipse(0,-7,1.6*flick,3*flick,0,0,Math.PI*2);g.fill();
  g.restore();
 }
 for(const w of e.windows||[]){
  if(w.zap>0&&w.zapBy&&!w.zapBy.dead){
   const p=1-Math.max(0,w.zap)/1.15;
   g.save();
   g.globalAlpha=.28+.6*p;g.strokeStyle='#ffb37a';g.lineWidth=2.2;g.setLineDash([5,7]);g.lineDashOffset=-((gameTime||0)*30)%12;
   g.beginPath();g.moveTo(w.zapBy.x,w.zapBy.y);g.lineTo(w.x,w.y);g.stroke();g.setLineDash([]);
   g.globalAlpha=.9;g.strokeStyle='#ff9d7a';g.lineWidth=2.5;
   g.beginPath();g.arc(w.x,w.y,31-p*12,-Math.PI/2,-Math.PI/2+p*Math.PI*2);g.stroke();
   g.fillStyle='#ffd9a0';g.font='bold 8px Arial';g.textAlign='center';g.fillText('LA RONDE RALLUME',w.x,w.y+26);
   g.restore();
  }
 }
 g.restore();
}
function draw(g){
 if(!active()||!['play','pause'].includes(state))return;
 for(const e of enemies){
  if(e.dead)continue;
  if(e.kind==='wickWarden'||(e.kind==='snufferHand'&&e.stolen>0)){
   const haloOn=haloActive(e);
   if(haloOn){g.save();g.globalAlpha=.16;g.fillStyle=world.moon;g.beginPath();g.arc(e.x,e.y,e.halo||150,0,Math.PI*2);g.fill();g.restore();ring(g,e.x,e.y,e.halo||150,world.moon+'88')}
   else{g.save();g.globalAlpha=.5;g.setLineDash([7,9]);g.strokeStyle='#7c8a99';g.lineWidth=2;g.beginPath();g.arc(e.x,e.y,e.halo||150,0,Math.PI*2);g.stroke();g.restore();g.save();g.textAlign='center';g.fillStyle='#aab9c6';g.font='bold '+(compactView()?'11px':'8px')+' Arial';g.fillText('HALO ÉTEINT',e.x,e.y-10);g.restore()}
  }
  if(e.kind==='hollowFlame')ring(g,e.x,e.y,e.r+9,e.lit?world.moon:'#6b5a7d',!e.lit);
  if(e.kind==='crackedBell'&&e.twin&&!e.twin.dead){g.save();g.strokeStyle='#cfe6d877';g.lineWidth=1.5;g.beginPath();g.moveTo(e.x,e.y);g.lineTo(e.twin.x,e.twin.y);g.stroke();g.restore()}
  if(e.kind==='unnamedDigit'){
   const weak=e.digit===mission.digit;
   g.save();g.textAlign='center';g.fillStyle=weak?'#ffd9a0':'#7c6a8f';g.font='bold 16px Georgia';
   g.fillText(String(e.digit),e.x,e.y-30);
   if(weak){g.fillStyle='#ffe6bd';g.font='bold '+(compactView()?'14px':'10px')+' Arial';g.fillText('FAIBLE ×2',e.x,e.y-44)}
   g.restore();
  }
  if(!e.boss&&enemies.some(haloSource)){
   const covered=haloLit();
   if(covered){g.save();g.globalAlpha=.92;g.setLineDash([10,7]);g.lineDashOffset=-(ambient*46)%17;g.lineWidth=2.6;g.strokeStyle='#ffd25e';g.beginPath();g.arc(e.x,e.y,e.r+7,0,Math.PI*2);g.stroke();g.setLineDash([]);g.restore()}
   g.save();g.textAlign='center';g.fillStyle=covered?'#ffd25e':'#ffb08a';g.font=(compactView()?'13px':'9px')+' Arial';g.fillText(covered?'IMMUNISÉ':'OUVERT',e.x,e.y+e.r+16);g.restore()
  }
  if(e.shieldFx){
   g.save();g.globalAlpha=Math.min(1,Math.abs(e.shieldFx)*1.5);g.setLineDash(e.shieldFx>0?[12,8]:[5,7]);g.lineWidth=e.shieldFx>0?3.4:2;g.strokeStyle=e.shieldFx>0?'#ffd25e':'#8a99a6';
   const rr=e.r+9+(e.shieldFx>0?(.85-e.shieldFx)*78:(.6+e.shieldFx)*46);
   g.beginPath();g.arc(e.x,e.y,Math.max(4,rr),0,Math.PI*2);g.stroke();g.setLineDash([]);g.restore()
  }
  if(e.kind==='waxMimic'){
   g.save();g.textAlign='center';
   g.fillStyle=e.disguise?'#e8b9a0':'#ff9d7a';g.font='bold '+(compactView()?'14px':'10px')+' Arial';
   g.fillText(e.disguise?'CIERGE · SCEAU ROUGE':'FAUX-CIERGE',e.x,e.y+e.r+18);
   if(e.disguise){g.fillStyle='#c8a08c';g.font=(compactView()?'12px':'9px')+' Arial';g.fillText('tire dessus avant de ramasser',e.x,e.y+e.r+31)}
   g.restore();
  }
  /* Marqueur PRIME : un losange d'or sur la famille désignée, visible de loin. */
  if(stage===0&&mission.prime&&!e.boss&&e.kind===mission.prime){
   g.save();g.translate(e.x,e.y-e.r-22);
   g.rotate(Math.PI/4);g.fillStyle='#ffd25e';g.fillRect(-5.5,-5.5,11,11);
   g.strokeStyle='#2a1f08';g.lineWidth=1.6;g.strokeRect(-5.5,-5.5,11,11);
   g.rotate(-Math.PI/4);g.fillStyle='#2a1f08';g.beginPath();g.arc(0,0,2,0,Math.PI*2);g.fill();
   g.restore();
   g.save();g.textAlign='center';g.fillStyle='#ffd25e';g.font='bold '+(compactView()?'14px':'10px')+' Arial';
   g.fillText('PRIME',e.x,e.y-e.r-29);g.restore();
  }
  if(e.kind==='snufferHand'&&e.stolen>0){
   g.save();g.textAlign='center';g.fillStyle='#f4c98f';g.font='bold '+(compactView()?'14px':'10px')+' Arial';
   g.fillText('MÈCHES VOLÉES '+'✦'.repeat(e.stolen),e.x,e.y-e.r-12);
   g.fillStyle='#ffe6bd';g.font=(compactView()?'12px':'9px')+' Arial';g.fillText('tue-le pour les reprendre',e.x,e.y-e.r-25);
   g.restore();
  }
  if(e.kind==='printThief'&&e.dashRun){g.save();g.fillStyle='#e8dcc0';g.font='11px Arial';g.textAlign='center';g.fillText('◆'.repeat(Math.min(3,e.dashRun)),e.x,e.y-28);g.restore()}
 }
 for(const sl of slams){
  const left=Math.max(0,sl.warn-sl.age),progress=Math.min(1,sl.age/sl.warn);
  g.save();g.translate(sl.x,sl.y);
  g.globalAlpha=.22+progress*.3;g.fillStyle='#8a6f57';g.fillRect(-47,-23,94,46);
  g.globalAlpha=1;g.strokeStyle='#c79b6d';g.lineWidth=2;g.setLineDash([8,6]);g.strokeRect(-47,-23,94,46);g.setLineDash([]);
  g.textAlign='center';g.fillStyle='#ff9d7a';g.font='bold '+(compactView()?'17px':'12px')+' Arial';
  g.fillText('VOLET',0,-32);
  g.fillStyle='#e8dcc0';g.font=(compactView()?'13px':'10px')+' Arial';g.fillText(left.toFixed(1)+' s',0,4);
  g.restore();
 }
 for(const s of salt){g.save();g.globalAlpha=Math.min(.5,.15+s.age*.2);g.fillStyle='#e8dcc0';g.beginPath();g.arc(s.x,s.y,s.r,0,Math.PI*2);g.fill();g.restore()}
 for(const m of marks){
  const real=isReal(m),progress=Math.min(1,m.age/m.warn);
  g.save();g.globalAlpha=m.age>=m.warn?.5:.28;g.fillStyle=real?'#ffd9a0':'#b9a7c9';
  if(real){g.beginPath();g.arc(m.x,m.y,m.r*progress,0,Math.PI*2);g.fill()}
  g.restore();
  ring(g,m.x,m.y,m.r,real?'#ffd9a0':'#b9a7c9',!real);
  if(m.age<m.warn){
   g.save();g.textAlign='center';
   g.fillStyle=real?'#ff9d7a':'#9d8fb5';g.font='bold '+(compactView()?'19px':'14px')+' Arial';
   g.fillText(real?'DANGER':'LEURRE',m.x,m.y-m.r-10);
   if(m.label){g.fillStyle=real?'#ffe6bd':'#c8b8d8';g.font=(compactView()?'14px':'10px')+' Arial';g.fillText(m.label,m.x,m.y-m.r+6)}
   g.restore();
  }
 }
 if(minute&&!minute.taken)drawMinute(g,minute);
 if(meche)drawItem(g,'mecheToken',meche.x,meche.y,46,'MÈCHE · +1 FLAMME','#f4c98f');
 const e=boss;
 if(!e||e.dead)return;
 if(e.kind==='veilleuse'){
  drawChorus(g,e);
  drawWicks(g,e);
  /* Le cœur, visible dès le premier battement : un charbon retenu tenu par la
     cire (phase 1), puis à nu et battant sur le torse (phase 2) — on sait
     exactement ce qu'il faut atteindre. */
  {
   const hx=e.x,hy=e.y+26;
   if(e.phase===1||!e.core){
    const breathe=1+Math.sin(ambient*2.1)*.06;
    g.save();g.globalAlpha=.7;g.fillStyle='#5a2c22';g.beginPath();g.ellipse(hx,hy,15*breathe,13*breathe,0,0,Math.PI*2);g.fill();
    g.fillStyle='#2c1611';g.beginPath();g.ellipse(hx,hy,9.5*breathe,8.5*breathe,0,0,Math.PI*2);g.fill();g.restore();
   }else{
    const c=e.core,open=c.open>0,pulse=open?1.9+Math.sin(ambient*16)*.12:1+Math.sin(ambient*3)*.1;
    g.save();
    const halo=g.createRadialGradient(hx,hy,2,hx,hy,46*pulse);
    halo.addColorStop(0,open?'#ff7d4d':'#a84a2e');halo.addColorStop(1,'#ff7d4d00');
    g.globalAlpha=open?.85:.35;g.fillStyle=halo;g.beginPath();g.arc(hx,hy,46*pulse,0,Math.PI*2);g.fill();
    g.globalAlpha=1;
    g.fillStyle=open?'#ff5c33':'#7a3a2a';g.beginPath();g.ellipse(hx,hy,15*pulse,13*pulse,0,0,Math.PI*2);g.fill();
    g.fillStyle=open?'#ffd0a1':'#a06a4a';g.beginPath();g.ellipse(hx,hy,8.5*pulse,7*pulse,0,0,Math.PI*2);g.fill();
    g.strokeStyle=open?'#ffd9a0':'#4a2c33';g.lineWidth=1.6;
    for(const off of [[-8,4],[0,7],[8,4]]){g.beginPath();g.moveTo(hx+off[0],hy-2);g.lineTo(hx+off[0]*1.6,hy+off[1]+4);g.stroke()}
    g.textAlign='center';g.font='bold '+(compactView()?'15px':'11px')+' Arial';
    g.fillStyle=open?'#ffe6bd':'#c8b9d5';
    g.fillText(open?'FRAPPE LE CŒUR':'CŒUR FERMÉ',hx,hy-34);
    g.fillText('IMPACTS '+c.hits+'/3',hx,hy+42);
    g.restore();
   }
  }
 }
 if(e.kind==='sonneur'){
  ring(g,e.bell.x,e.bell.y,e.bell.r,'#cfe6d8');
  g.save();g.globalAlpha=.12+e.resonance/260;g.fillStyle='#cfe6d8';g.beginPath();g.arc(e.bell.x,e.bell.y,e.bell.r,0,Math.PI*2);g.fill();g.restore();
  ring(g,e.clapper.x,e.clapper.y,e.clapper.r,e.clapper.down?'#ffd9a0':'#5c6f78',!e.clapper.down);
  if(e.ring>0)ring(g,e.bell.x,e.bell.y,e.ring*260,'#ffd9a0');
 }
 if(e.kind==='passeur'){
  for(const z of e.sand){g.save();g.globalAlpha=z.fresh?.22:.06;g.fillStyle='#e8dcc0';g.beginPath();g.arc(z.x,z.y,z.r,0,Math.PI*2);g.fill();g.restore();ring(g,z.x,z.y,z.r,z.fresh?'#e8dcc0':'#5b6a72',!z.fresh)}
  if(e.ghost){g.save();g.globalAlpha=.4;baseSprite(g,'witch',e.ghost.x,e.ghost.y,1,ambient);g.restore()}
  if(e.open>0)ring(g,e.x,e.y,e.r+12,'#ffd9a0');
 }
 if(e.kind==='cueilleuse'){
  for(const lamp of e.lanterns){ring(g,lamp.x,lamp.y,26,lamp.lit?'#f4c98f':'#6b5a7d',!lamp.lit);g.save();g.fillStyle=lamp.lit?'#f4c98f':'#3a2f4a';g.beginPath();g.arc(lamp.x,lamp.y,lamp.lit?13:7,0,Math.PI*2);g.fill();g.restore()}
  if(e.vulnerable>0)ring(g,e.x,e.y,e.r+12,'#ffd9a0');
 }
 if(e.kind==='chasseur'){
  if(e.halo){g.save();g.globalAlpha=.14;g.fillStyle=world.moon;g.beginPath();g.arc(e.halo.x,e.halo.y,e.halo.r,0,Math.PI*2);g.fill();g.restore();ring(g,e.halo.x,e.halo.y,e.halo.r,world.moon)}
  if(e.naming){ring(g,140,760,70,'#fff0bd');ring(g,660,760,70,'#fff0bd')}
 }
}

/* Jauge de gardien : remplace la barre de vie, sans y toucher pour les autres mondes. */
const baseDrawBossHealth=drawBossHealth;
drawBossHealth=function(g,e){
 if(!active()||!bossKinds.has(e.kind))return baseDrawBossHealth(g,e);
 if(e.y<150)return;
 const width=250,left=clamp(e.x-width/2,12,W-width-12),top=e.y-118;
 g.save();
 /* La consigne est repliée sur la largeur du panneau : jamais de texte qui déborde. */
 const howFont=compactView()?'11px Arial':'9px Arial';
 g.font=howFont;
 const how=[];let line='';
 for(const word of String(HOWTO[e.kind]||'').split(' ')){
  const next=line?line+' '+word:word;
  if(line&&g.measureText(next).width>width){how.push(line);line=word}else line=next;
 }
 if(line)how.push(line);
 if(shieldFlash>0){g.save();g.globalAlpha=shieldFlash;g.fillStyle='#ffd9a0';g.fillRect(0,0,W,H);g.restore();shieldFlash=Math.max(0,shieldFlash-.022)}
 if(letters.length)for(const L of letters)drawLetter(g,L);
 if(combo>1&&comboTime>0){
  const frac=Math.max(0,Math.min(1,comboTime/2)),cx=W-56,cy=H-46,r=22;
  g.save();
  g.strokeStyle='#3a3344';g.lineWidth=4;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.stroke();
  g.strokeStyle=frac>.3?'#ffd25e':'#ff7d4d';g.beginPath();g.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+Math.PI*2*frac);g.stroke();
  g.fillStyle='#ffe6bd';g.font='700 '+(compactView()?'13px':'11px')+' Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('×'+combo,cx,cy);g.fillText('COMBO',cx,cy-32);
  g.restore();
 }
 g.fillStyle='#120f24eb';g.fillRect(left-8,top-26,width+16,63+how.length*13);
 g.textAlign='center';g.fillStyle='#f8d8b6';g.font=compactView()?'bold 16px Georgia':'13px Georgia';
 g.fillText(world.boss,left+width/2,top-8);
 g.fillStyle='#3b2946';g.fillRect(left,top,width,7);
 g.fillStyle=world.moon;g.fillRect(left,top,width*clamp(e.value||0,0,1),7);
 g.fillStyle='#e2d7e6';g.font=compactView()?'13px Arial':'10px Arial';
 g.fillText(e.label||'',left+width/2,top+22);
 g.fillStyle='#bda9c8';g.font=howFont;
 how.forEach((text,i)=>g.fillText(text,left+width/2,top+40+i*13));g.restore();
};

/* Une seule jauge pour les gardiens du monde 3 : celle dessinée sur le canvas,
   comme dans les mondes 1 et 2. Le jeu de base masque #bossbar dans updateHUD ;
   la réafficher ici créait une seconde jauge superposée. */
const baseUpdateHUD=updateHUD;
updateHUD=function(...args){
 const result=baseUpdateHUD(...args);
 refreshObjective();
 return result;
};

/* --- Récits : briefing, épilogue du monde 2, révélation du monde 3 -------- */
function briefing(){
 if(!window.Campaign?.progress?.world3Unlocked)return;
 state='sixth-briefing';
 let crownsBlurb='';try{crownsBlurb=crownsHTML()}catch(err){console.warn('crowns',err)}
 overlay('<section class="sequel-briefing"><div class="eyebrow">TROISIÈME CAMPAGNE · LA SIXIÈME HEURE</div><h2 class="local-title">L’Heure<br>aux Trousses</h2><p>Le cycle est réparé, et pourtant la nuit compte une heure de trop. Elle n’a pas de chiffre, pas de cloche, et tout le monde y a couru au moins une fois. C’est l’heure des poursuites. Elle se referme, et ce qu’elle tient encore doit être rendu — à commencer par la flamme du Veilleur.</p><blockquote>« Ma lanterne brûle avec une heure qui n’est pas à moi. Le jour où elle la reprend, il ne restera personne pour veiller. »</blockquote><div class="local-rule">Ici, la difficulté ne monte pas avec le nombre d’ennemis : elle monte avec ce qu’il faut comprendre. Chaque gardien a sa jauge et sa condition de victoire — aucune barre de vie. Trois minutes rendues par univers, quinze au total, décident de la fin du voyage.</div>'+crownsBlurb+`<div class="sequel-character-grid"><button class="sequel-character" id="sixthWitch"><span class="sequel-character-art"><img src="${window.MinuitArt.witch.src}" alt=""></span><b>La sorcière</b><small>« Tu m’as chassée toute une nuit. Laisse-moi courir pour toi, cette fois. »</small></button><button class="sequel-character" id="sixthHunter"><span class="sequel-character-art"><img src="${window.MinuitArt.hunter.src}" alt=""></span><b>Le Veilleur</b><small>« C’est ma flamme. C’est ma dette. Reste derrière moi. »</small></button></div><div class="local-actions"><button class="secondary" id="sixthBack">Retour au menu</button></div></section>`);
 /* beginWorld contourne le briefing : sans lui, l'écran se rappellerait en boucle. */
 $('sixthWitch').onclick=()=>{window.Campaign.progress.character='witch';window.Campaign.beginWorld(3)};
 $('sixthHunter').onclick=()=>{window.Campaign.progress.character='hunter';window.Campaign.beginWorld(3)};
 $('sixthBack').onclick=()=>LocalLeague.menu();
 return true;
}

/* Couronnes de l'heure : trois maîtrises pour la Veilleuse, deux pour
   chaque autre gardien. Persistantes, sans bonus — le prestige, pas la puissance. */
const CROWN_DEFS=[
 {kind:'veilleuse',name:'La Veilleuse',slots:[['patience','SANS BRISURE','gagne sans perdre de cœur'],['calme','VEILLE CALME','jamais de Veille complète'],['rapide','SOUS 90 SECONDES','gagne en moins de 90 s']]},
 {kind:'sonneur',name:'Le Sonneur sans battant',slots:[['patience','SANS BRISURE','gagne sans perdre de cœur'],['rapide','SOUS 90 SECONDES','gagne en moins de 90 s']]},
 {kind:'passeur',name:'Le Passeur sans ombre',slots:[['patience','SANS BRISURE','gagne sans perdre de cœur'],['rapide','SOUS 90 SECONDES','gagne en moins de 90 s']]},
 {kind:'cueilleuse',name:'La Cueilleuse de flammes',slots:[['patience','SANS BRISURE','gagne sans perdre de cœur'],['rapide','SOUS 90 SECONDES','gagne en moins de 90 s']]},
 {kind:'chasseur',name:'Le Chasseur sans visage',slots:[['patience','SANS BRISURE','gagne sans perdre de cœur'],['rapide','SOUS 90 SECONDES','gagne en moins de 90 s']]},
 {kind:'minutes',name:'Les Minutes',slots:[['legere','MAIN LÉGÈRE','scelle une minute sans tirer']]}
];
const crownTotal=()=>CROWN_DEFS.reduce((n,d)=>n+d.slots.length,0);
const crownsEarned=()=>CROWN_DEFS.reduce((n,d)=>n+((window.Campaign?.crownsOf?.(d.kind))||[]).length,0);
function crownsHTML(){
 const rows=CROWN_DEFS.map(d=>{
  const got=(window.Campaign?.crownsOf?.(d.kind))||[];
  const cells=d.slots.map(([id,label,hint])=>{
   const ok=got.includes(id);
   return '<span class="crown-slot'+(ok?' earned':'')+'" title="'+hint+'">'+(ok?'✦':'◇')+' '+label+'</span>';
  }).join('');
  return '<span class="crown-row"><b>'+d.name+'</b>'+cells+'</span>';
 }).join('');
 return '<div class="crowns-panel"><div class="crowns-head"><b>COURONNES DE L’HEURE</b><span>'+crownsEarned()+' / '+crownTotal()+'</span></div>'+rows+'</div>';
}

const baseFinish=Journey.finish;
Journey.finish=function(win){
 const world_=window.Campaign?.activeWorld;
 const result=baseFinish(win);
 if(!win||window.SandboxMode)return result;
 const screen=document.querySelector('#overlay .journey-result-screen');
 if(!screen)return result;
 if(world_===3&&!screen.querySelector('#sixthCrowns')){
  try{
   const box=document.createElement('section');box.className='victory-milestones crowns-victory';box.id='sixthCrowns';
   box.innerHTML=crownsHTML();
   screen.querySelector('.local-actions')?.before(box);
  }catch(err){console.warn('crowns',err)}
 }
 if(world_===2&&window.Campaign.progress.world3Unlocked&&!screen.querySelector('#sixthEpilogue')){
  const box=document.createElement('section');box.className='victory-milestones';box.id='sixthEpilogue';
  box.innerHTML='<b>LA NUIT A REPRIS SA COURSE</b><p>Les cinq heures sont rentrées dans le cadran. L’aube a le droit de venir.<br>L’Horloger, à genoux, ne se défend pas : « Je n’en ai pris que cinq. Il en reste une. Je ne l’ai jamais trouvée. »<br>Ce soir-là, la lanterne du Veilleur baisse pour la première fois.</p><div class="local-actions"><button class="primary" id="enterSixthHour">Entrer dans la sixième heure →</button></div>';
  screen.querySelector('.local-actions')?.before(box);
  $('enterSixthHour').onclick=()=>window.Campaign.startWorld(3);
 }
 if(world_===3&&!screen.querySelector('#sixthRevelation')){
  const box=document.createElement('section');box.className='victory-milestones';box.id='sixthRevelation';
  box.innerHTML='<b>ELLE N’EST PAS VIDE</b><p>« Vous m’avez appelée une heure perdue. Je ne perds rien. Je garde. Tout ce qui n’a jamais été rattrapé est chez moi. Et ceux qui vous ont échappé y vivent encore. »<br>Au fond du Bois des lanternes rendues, il y en a des centaines. Toutes allumées.<br><b>Les Introuvables.</b> Monde 4 · La Veillée.</p>';
  screen.querySelector('.local-actions')?.before(box);
 }
 return result;
};

function start(){reset();mission={key:stage+':'+wave,minuteTaken:false,seals:0,inverted:false,digit:1,digitTimer:5}}
function checkpoint(){return{flame,habits:{...habits},mission:{...mission}}}
function restore(data){
 reset();
 if(!data)return;
 flame=clamp(Number(data.flame)||3,0,3);
 habits={...freshHabits(),...(data.habits||{})};
 mission={...mission,...(data.mission||{})};
}

/* Bandeau d'objectif : une consigne permanente, hors du canvas, pour ne pas
   avoir à mémoriser un message qui disparaît. */
const objectiveBar=document.createElement('div');
objectiveBar.id='sixthObjective';objectiveBar.className='sixth-objective hidden';
objectiveBar.setAttribute('role','status');
(document.getElementById('gameStatus')||document.body).appendChild(objectiveBar);
function withTrial(text){
 const trial=TRIALS[clamp(stage,0,4)];
 if(!trial)return text;
 if(mission.trialDone)return text+' · ÉPREUVE '+trial.short+' ✓';
 return text+' · ÉPREUVE '+trial.short+' '+(mission.trial||0)+'/3 : '+trial.text;
}
/* Priorité de la veille : la cible la plus urgente, nommée en clair.
   Le Faubourg n'est stratégique que si le joueur sait lire sa menace. */
function stageZeroTriage(){
 if(stage!==0)return '';
 if(enemies.some(e=>!e.dead&&e.kind==='shutterImp'&&slams.some(s=>s.source===e)))return 'Volet claqueur : claquement imminent — tue-le ou casse le panneau';
 if(enemies.some(e=>!e.dead&&e.kind==='wickWarden'))return 'Garde-mèche : son halo luit 2 s et s’éteint 2,6 s — frappe pendant le creux, plus personne n’y a de cercle';
 if(enemies.some(e=>!e.dead&&e.kind==='waxCourier')&&marks.some(m=>m.real&&!m.struck))return 'Facteur de cire : le cercle PLEIN est le vrai, le pointillé est un leurre';
 if(enemies.some(e=>!e.dead&&e.kind==='waxMimic'))return 'Faux-cierge : tire dessus de loin, ne le ramasse pas';
 return '';
}
function objectiveText(){
 if(!active()||state!=='play')return '';
 const e=enemies.find(v=>v.boss&&!v.dead);
 if(e&&bossKinds.has(e.kind))return 'GARDIEN · '+(VICTORY[e.kind]||'')+' — '+(HOWTO[e.kind]||'');
 const kept=window.Campaign?.progress?.minutesKept||0;
 const tally=' · '+kept+'/15 rendues';
 let suffix='';
 if(wave===3&&letters.some(L=>!L.dead))suffix+=' · LETTRE EN VOL : saisis-la sans tirer, c’est la minute';
 if(stage===0){
  if(mission.prime)suffix+=' · PRIME : '+(foeNames[mission.prime]||mission.prime)+' (+400/cible)';
  if(mission.plis)suffix+=mission.plis.got>=3?' · PLIS ✓':' · PLIS '+(mission.plis.got||0)+'/3';
  const triage=stageZeroTriage();
  if(triage)suffix+=' — PRIORITÉ : '+triage;
 }
 if(wave===2)return withTrial(mission.minuteTaken?'MINUTE 1/3 RENDUE'+tally+' · finis la vague':'MINUTE 1/3 · tue le Garde-mèche qui la protège, puis marche sur le cadran')+suffix;
 if(wave===3)return withTrial(mission.minuteTaken?'MINUTE 2/3 RENDUE'+tally:(waveTime<22?'TENUE · survis '+Math.max(0,Math.ceil(22-waveTime))+' s, la minute se libère ensuite':'MINUTE 2/3 LIBÉRÉE · marche sur le cadran'))+suffix;
 if(wave===4)return withTrial(mission.minuteTaken?'MINUTE 3/3 RENDUE'+tally:(mission.seals>=2?'MINUTE 3/3 LIBÉRÉE · marche sur le cadran':'SCEAUX · tire sur les 2 flammes creuses marquées SCEAU ('+(mission.seals||0)+'/2), ils libèrent la minute'))+suffix;
 return withTrial(RULES[clamp(stage,0,4)])+suffix;
}
function refreshObjective(){
 const bossAlive=enemies.some(e=>e.boss&&!e.dead);
 const text=bossAlive?'':objectiveText();
 objectiveBar.textContent=text;
 objectiveBar.classList.toggle('hidden',bossAlive||!text);
}

const style=document.createElement('style');
style.textContent='#overlay.instruction-backdrop{background:radial-gradient(ellipse at center,rgba(15,12,27,.36),rgba(15,12,27,.62))!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.instruction-popup{width:min(560px,94vw);background:#221d36ee;border:1px solid #ffd9a066;border-left:4px solid #ffd9a0;border-radius:14px;padding:18px 22px;text-align:left;color:#efe4f7;box-shadow:0 20px 60px #000a}.instruction-popup .eyebrow{color:#ffd9a0;letter-spacing:2px;font-size:10px;margin-bottom:6px}.instruction-popup h2.local-title{margin:4px 0 10px;font-size:clamp(22px,4vw,30px)}.instruction-popup .instruction-body p{margin:0 0 10px;font-size:13px;line-height:1.6;color:#d9cbdf}.instruction-popup .instruction-body b{color:#ffd9a0}.instruction-ok{margin-top:4px}.crowns-panel{margin:10px 0;padding:9px 12px;border:1px solid #d9a05f55;border-left:3px solid #ffd25e;border-radius:9px;background:#241f36cc;display:flex;flex-direction:column;gap:6px}.crowns-head{display:flex;justify-content:space-between;color:#ffd9a0;font:700 11px Georgia;letter-spacing:1px}.crowns-head span{color:#ffe6bd}.crown-row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;color:#bda9c8;font:10px Arial}.crown-row b{color:#e8dcc0;min-width:150px;font-weight:600}.crown-slot{padding:2px 7px;border:1px solid #4a3b46;border-radius:20px;color:#8d7a9c;font:600 9px Arial;letter-spacing:.6px}.crown-slot.earned{border-color:#ffd25e88;color:#ffd25e;background:#ffd25e14}body.sixth-hour-theme{background:radial-gradient(ellipse at 22% 0,#2a2440,#12101f 68%)}body.sixth-hour-theme .home-hero{border-color:#d9a05f77}body.sixth-hour-theme .home-world-route{color:#ffd9a0}.sixth-hour-home .menu-kicker{color:#ffd9a0}.heading.game-status{position:relative}.sixth-objective{position:absolute;top:calc(100% + 4px);left:50%;right:auto;transform:translateX(-50%);width:max-content;max-width:min(560px,94%);z-index:6;margin:0;padding:5px 14px;border:1px solid #d9a05f55;border-left:3px solid #ffd9a0;border-radius:9px;background:rgba(20,16,32,.82);color:#ffe6bd;font-size:12px;line-height:1.35;letter-spacing:.2px;text-align:center;box-shadow:0 8px 24px #0006;pointer-events:none;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.sixth-objective.hidden{display:none}@media(max-width:720px){.sixth-objective{font-size:12px}}';
document.head.appendChild(style);

window.SixthHour={
 BUDGET,TUNING,foeNames,VICTORY,RULES,HOWTO,HABITS,TRIALS,fireDelay,objectiveText,
 bossDelay:()=>active()?7.5:16,
 moveEnemy,moveBoss,tick,draw,waveBlocks,briefing,start,checkpoint,restore,keepMinute,collectPli,resolveLetter,
 get letters(){return letters},
 isFoeKind:k=>foeKinds.has(k),isBossKind:k=>bossKinds.has(k),
 get boss(){return boss},get mission(){return mission},get habits(){return habits},
 get flame(){return flame},get marks(){return marks},get salt(){return salt},
 get minute(){return minute},get slams(){return slams},get meche(){return meche},minuteDue,
 tune:()=>tune(),liveFoes
};
})();
