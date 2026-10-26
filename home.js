/* Accueil : portrait de la sorcière et thème musical prêt dès l’arrivée. */
(()=>{
'use strict';
const baseMenu=Journey.menu;
const unlockEvents=['pointerdown','touchstart','keydown'];
let unlockBound=false;
function removeAudioUnlock(){
 if(!unlockBound)return;unlockBound=false;
 for(const type of unlockEvents)window.removeEventListener(type,unlockHomeAudio,true);
}
function updateHomeAudio(){
 const button=$('homeSoundToggle');if(!button)return;
 const enabled=prefs.sound&&prefs.music,running=enabled&&audio?.state==='running';
 const label=$('homeSoundLabel'),note=$('homeAudioNote'),icon=$('homeSoundIcon');
 button.setAttribute('aria-pressed',String(running));
 button.setAttribute('aria-label',running?'Couper la musique de l’accueil':'Lancer la musique de l’accueil');
 button.classList.toggle('is-playing',running);
 const write=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value};
 write(icon,running?'♫':'♪');
 write(label,!enabled?'Activer la musique':running?'Thème de minuit':'Lancer la musique');
 write(note,!enabled?'Son coupé':running?(mp3Music?.current==='menu'?'Lecture en cours':'Chargement du thème…'):'Un geste pour démarrer');
 if(running||!enabled)removeAudioUnlock();else if(audio)installAudioUnlock();
}
function unlockHomeAudio(event){
 if(event?.target?.closest?.('#homeSoundToggle'))return;
 if(!prefs.sound||!prefs.music){removeAudioUnlock();return}
 startHomeAudio();
}
function installAudioUnlock(){
 if(unlockBound)return;unlockBound=true;
 for(const type of unlockEvents)window.addEventListener(type,unlockHomeAudio,true);
}
function startHomeAudio(){
 if(!prefs.sound||!prefs.music){updateHomeAudio();return Promise.resolve(false)}
 initAudio();
 if(!audio){updateHomeAudio();return Promise.resolve(false)}
 // Précharger et programmer le MP3 même si le contexte est encore suspendu :
 // il sera ainsi prêt au premier geste autorisé par le navigateur.
 audioSignature='';syncAudio();
 let resumed;
 try{resumed=audio.resume()}catch{resumed=Promise.reject(Error('Audio indisponible'))}
 if(audio.state!=='running')installAudioUnlock();
 updateHomeAudio();
 return Promise.resolve(resumed).then(()=>{
  audioSignature='';syncAudio();
  if(audio.state==='running')removeAudioUnlock();else installAudioUnlock();
  updateHomeAudio();return audio.state==='running';
 }).catch(()=>{installAudioUnlock();updateHomeAudio();return false});
}
function toggleHomeAudio(){
 const playing=prefs.sound&&prefs.music&&audio?.state==='running';
 if(playing){
  prefs.sound=false;savePrefs();audioSignature='';syncAudio();removeAudioUnlock();
  audio?.suspend().catch(()=>{});updateHomeAudio();return;
 }
 if(!prefs.sound||!prefs.music){prefs.sound=true;prefs.music=true;savePrefs()}
 startHomeAudio();
}
Journey.menu=function(){
 baseMenu();if(state!=='league-menu'||Adventure.training)return;
 const ids=['playAdventure','localResume','localRanked','localDaily','prepareFlight','wardrobe','masteryMenu','archives','localSettings','labMenu','startGuided','localHelp'],actions={};
 for(const id of ids)if($(id))actions[id]=$(id).onclick;
 const level=Math.floor(Math.sqrt(Math.max(0,Journey.state.xp)/120))+1,finishedLabel=GuidedTraining.finished?'Revoir l’entraînement':'S’entraîner';
 const button=(id,label,icon)=>`<button class="secondary menu-card-button" id="${id}"><span class="menu-card-icon">${icon}</span><span>${label}</span></button>`;
 overlay(`<section class="main-menu redesigned-menu home-menu"><section class="menu-hero-card home-hero"><div class="menu-visual home-visual" id="menuVisual"><div class="home-stars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="home-moon" aria-hidden="true"></div><div class="home-cloud home-cloud-one" aria-hidden="true"></div><div class="home-cloud home-cloud-two" aria-hidden="true"></div><img class="home-witch" src="${window.MinuitArt.witch.src}" alt="Sorcière de profil, volant sur son balai devant la lune" draggable="false"><div class="home-visual-caption"><span>LA SORCIÈRE DE MINUIT</span><small>Le vol commence avant l’aube</small></div></div><div class="menu-copy"><div class="menu-kicker">UN SHOOT’EM UP ARCADE · MINUIT → AUBE</div><h1><span>La Nuit</span><span>aux Trousses</span></h1><p>Enfourche ton balai, traverse cinq mondes et repousse les gardiens de la nuit.</p><div class="home-world-route" aria-label="Contenu de l’aventure"><span>5 mondes</span><i>·</i><span>25 vagues</span><i>·</i><span>5 gardiens</span></div><div class="menu-primary"><button class="primary" id="playAdventure"><span class="button-icon">✦</span>Jouer maintenant</button><button class="secondary training-entry" id="startGuided"><span class="button-icon">⌁</span>${finishedLabel}<small>5 exercices · sans score ni progression</small></button></div>${actions.localResume?'<button class="secondary resume-button" id="localResume">↻ Reprendre le vol sauvegardé</button>':''}</div></section><section class="menu-status"><div class="home-level"><b>NIVEAU ${level}</b><span>${Journey.state.xp} XP · ${Journey.state.achievements.length} succès</span></div><button class="home-sound-button" id="homeSoundToggle" type="button" aria-pressed="false"><span id="homeSoundIcon">♪</span><span><b id="homeSoundLabel">Thème de minuit</b><small id="homeAudioNote" role="status">Préparation du thème…</small></span></button></section><button class="home-account-access" id="archives" type="button"><span class="home-account-icon" aria-hidden="true">☁</span><span><b>Compte & team</b><small>Pseudo · sauvegarde · invitations</small></span><i aria-hidden="true">→</i></button><div class="home-menu-panels"><section class="menu-group"><h2>TON VOL</h2><div class="menu-grid three">${button('prepareFlight','Préparer mon vol','✦')}${button('wardrobe','Collection','◇')}${button('masteryMenu','Exploits & variantes','★')}</div></section><section class="menu-group"><h2>DÉFIS & PRATIQUE</h2><div class="menu-grid">${button('localRanked','Partie classée','◆')}${button('localDaily','Défi du jour','☾')}${button('labMenu','Laboratoire libre','⚗')}</div></section></div><div class="menu-bottom"><button class="secondary" id="localHelp">? Guide illustré</button><button class="secondary" id="localSettings">⚙ Réglages</button></div></section>`);
 for(const [id,handler]of Object.entries(actions))if($(id)&&handler)$(id).onclick=handler;
 $('homeSoundToggle').onclick=toggleHomeAudio;
 updateHomeAudio();
 if(prefs.sound&&prefs.music&&(!audio||audio.state!=='running'||mp3Music?.key!=='menu'))startHomeAudio();else removeAudioUnlock();
};
const style=document.createElement('style');style.textContent=`
.home-menu{max-width:850px!important}
.home-menu .home-hero{display:grid;grid-template-columns:minmax(285px,.95fr) minmax(0,1.05fr);gap:0;align-items:stretch;min-height:340px;padding:0;overflow:hidden;border-color:#b8926655;background:linear-gradient(135deg,#291b38,#12101f 72%);box-shadow:0 22px 70px #05030caa,inset 0 1px #fff1d608}
#menuVisual.home-visual{position:relative;display:block;min-height:340px;border:0;border-radius:0;background:radial-gradient(circle at 47% 38%,#80516b55,transparent 48%),linear-gradient(165deg,#271b3c,#11152a 72%,#17101f);box-shadow:inset -30px 0 60px #0d0c1a55;overflow:hidden;isolation:isolate}
.home-moon{position:absolute;z-index:-1;width:190px;height:190px;left:50%;top:43%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff9d9,#f5d5a0 55%,#c88771 100%);box-shadow:0 0 35px #ffd89b55,0 0 95px #dd8d7533}
.home-moon:before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 28% 64%,#a76f6626 0 9%,transparent 10%),radial-gradient(circle at 69% 32%,#a76f6629 0 13%,transparent 14%),radial-gradient(circle at 72% 72%,#a76f661c 0 7%,transparent 8%)}
.home-witch{position:absolute;z-index:2;width:310px;max-width:108%;left:50%;top:45%;transform:translate(-50%,-50%);filter:drop-shadow(0 12px 12px #08061188) drop-shadow(0 0 14px #f0b78022);pointer-events:none;user-select:none}
.home-cloud{position:absolute;z-index:3;width:210px;height:35px;border-radius:50%;background:linear-gradient(90deg,transparent,#b5a3c92b,transparent);filter:blur(7px);pointer-events:none}
.home-cloud-one{left:-35px;bottom:68px;transform:rotate(-6deg)}.home-cloud-two{right:-60px;top:75px;transform:rotate(5deg);opacity:.65}
.home-stars i{position:absolute;width:3px;height:3px;border-radius:50%;background:#ffe4ac;box-shadow:0 0 8px #ffd18c}.home-stars i:nth-child(1){left:15%;top:16%}.home-stars i:nth-child(2){right:14%;top:20%;width:2px;height:2px}.home-stars i:nth-child(3){left:22%;top:52%;width:2px;height:2px}.home-stars i:nth-child(4){right:18%;top:57%}.home-stars i:nth-child(5){left:46%;top:9%;width:2px;height:2px}
.home-visual-caption{position:absolute;z-index:4;left:18px;bottom:16px;display:flex;flex-direction:column;gap:3px;text-shadow:0 2px 5px #090612}.home-visual-caption span{color:#f5d6a1;font-size:8px;font-weight:800;letter-spacing:2px}.home-visual-caption small{color:#c2aec9;font-size:9px}
.home-hero .menu-copy{padding:28px 27px 25px 20px;text-align:left;align-self:center}.home-hero .menu-copy h1{margin:8px 0 14px;font-size:clamp(40px,4.4vw,56px);line-height:.93;letter-spacing:-1.8px;text-shadow:0 3px 20px #0005}.home-hero .menu-copy h1 span{display:block;white-space:nowrap}.home-hero .menu-copy h1 span:last-child{color:#f3c692;font-size:.86em;font-style:italic}.home-hero .menu-copy p{max-width:370px;margin-bottom:12px;color:#cdbbd7;font-size:12px;line-height:1.65}
.home-world-route{display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:0 0 17px;color:#d7b98f;font-size:9px;font-weight:700;letter-spacing:.4px}.home-world-route i{color:#765b7c;font-style:normal}
.home-menu .menu-primary{grid-template-columns:1.25fr 1fr;gap:8px}.home-menu .menu-primary>button{min-height:55px}.home-menu .menu-primary .primary{border:1px solid #ffd09955;background:linear-gradient(135deg,#ffbd72,#ed8854);box-shadow:0 8px 24px #e8874530;font-size:14px}.home-menu .training-entry{background:#2d223c;border-color:#8f70a0}.home-menu .resume-button{margin-top:8px}
.home-menu .menu-status{margin:10px 0 0;padding:9px 11px;border:1px solid #76608044;border-radius:10px;background:#191324aa}.home-level{display:flex;align-items:center;gap:4px}.home-level span{color:#a995b8;font-size:9px}
.home-sound-button{display:flex;align-items:center;gap:8px;margin:0;padding:6px 10px;border:1px solid #a47b5355;border-radius:8px;background:#2c2035;color:#f1cc93;text-align:left;min-height:40px}.home-sound-button>span:first-child{font-size:19px;line-height:1}.home-sound-button>span:last-child{display:flex;flex-direction:column;gap:2px}.home-sound-button b{font-size:9px;letter-spacing:.3px}.home-sound-button small{color:#a995b8;font-size:8px}.home-sound-button.is-playing{border-color:#b98b5e88;background:linear-gradient(135deg,#3d2a37,#251d35)}.home-sound-button.is-playing>span:first-child{color:#ffd88d;text-shadow:0 0 10px #ffbd69}
.home-account-access{display:flex;align-items:center;gap:11px;width:100%;margin:10px 0 0;padding:10px 13px;border:1px solid #b78a5d66;border-radius:10px;background:linear-gradient(110deg,#34243e,#211a31);color:#f2d5aa;text-align:left;box-shadow:inset 0 1px #ffffff08}.home-account-access:hover{border-color:#d3a66f;background:linear-gradient(110deg,#40304a,#292037)}.home-account-icon{display:grid;place-items:center;flex:0 0 31px;height:31px;border-radius:8px;background:#563c4d;color:#ffd28f;font-size:17px}.home-account-access>span:nth-child(2){display:flex;flex:1;flex-direction:column;gap:3px}.home-account-access b{font-size:11px;letter-spacing:.3px}.home-account-access small{color:#ad9abb;font-size:9px}.home-account-access i{color:#e8bc82;font-size:17px;font-style:normal}
.home-menu-panels{display:grid;grid-template-columns:.88fr 1.12fr;gap:14px;margin-top:11px}.home-menu-panels .menu-group{min-width:0;margin:0;padding:11px;border:1px solid #6e587744;border-radius:10px;background:#17122088}.home-menu-panels .menu-group h2{margin-bottom:8px;color:#d9bfdf}.home-menu-panels .menu-grid.three{grid-template-columns:1fr}.home-menu-panels .menu-card-button{min-height:35px;padding:7px 9px;border-color:#634d7344;background:linear-gradient(135deg,#2a2038,#211a30);font-size:10px}.home-menu-panels .menu-card-button:hover{border-color:#b98c6877;background:#35263f}.home-menu-panels .menu-card-icon{width:23px;height:23px;background:#493049}
.home-menu .menu-bottom{margin-top:11px}.home-menu .menu-bottom button{border-color:#6c547b55;background:#1e172c}
@media(max-width:850px){
 body:has(.home-menu) .arena:has(.overlay:not(.hidden)){width:100%!important;height:100%!important;max-height:100%!important;aspect-ratio:auto!important}
 .overlay:has(.home-menu){justify-content:flex-start;padding:10px}
 .home-menu{width:100%;max-width:none!important;min-height:100%}
}
@media(max-width:650px){
 .home-menu .home-hero{grid-template-columns:1fr;min-height:0}#menuVisual.home-visual{min-height:110px;height:110px}.home-moon{width:84px;height:84px;top:46%}.home-witch{width:150px;top:48%}.home-cloud-one{bottom:19px}.home-cloud-two{top:23px}.home-visual-caption{left:10px;bottom:7px}.home-visual-caption span{font-size:5px;letter-spacing:1.2px}.home-visual-caption small{display:none}
 .home-hero .menu-copy{padding:10px 12px 12px;text-align:center}.home-hero .menu-copy .menu-kicker{font-size:7px}.home-hero .menu-copy h1{font-size:clamp(26px,7.7vw,30px);letter-spacing:-1px;line-height:1;margin:5px 0 7px;white-space:normal}.home-hero .menu-copy h1 span{display:inline;white-space:normal}.home-hero .menu-copy h1 span:last-child:before{content:" "}.home-hero .menu-copy p{margin:0 auto 7px;font-size:10px;line-height:1.4}.home-world-route{justify-content:center;margin-bottom:8px;font-size:7px}.home-menu .menu-primary{grid-template-columns:1fr 1fr}.home-menu .menu-primary>button{min-height:44px;padding:9px 7px}.home-menu .menu-primary .primary{font-size:12px}.home-menu .training-entry small{font-size:7px}
 .home-menu .menu-status{flex-direction:row;align-items:center;margin-top:7px;padding:5px 7px;gap:7px}.home-level{display:block}.home-level b{display:block;margin:0 0 2px;font-size:8px}.home-level span{font-size:7px}.home-sound-button{padding:4px 7px;min-height:34px}.home-sound-button b{font-size:8px}.home-sound-button small{font-size:7px}
 .home-account-access{margin-top:7px;padding:7px 10px;min-height:45px}.home-account-icon{flex-basis:28px;height:28px}.home-account-access b{font-size:11px}.home-account-access small{font-size:8px}
 .home-menu-panels{grid-template-columns:1fr;gap:7px;margin-top:7px}.home-menu-panels .menu-group{padding:8px}.home-menu-panels .menu-group h2{margin-bottom:6px}.home-menu-panels .menu-grid.three{grid-template-columns:1fr 1fr}.home-menu-panels .menu-grid.three .menu-card-button:last-child{grid-column:1/-1}.home-menu-panels .menu-card-button{min-height:35px;padding:6px 7px}.home-menu .menu-bottom{margin-top:7px}.home-menu .menu-bottom button{min-height:36px;padding:7px 10px}
}
@media(max-height:500px) and (min-width:651px){.home-menu .home-hero{min-height:275px}#menuVisual.home-visual{min-height:275px}.home-witch{width:255px}.home-moon{width:150px;height:150px}.home-hero .menu-copy{padding-top:18px;padding-bottom:18px}.home-hero .menu-copy h1{font-size:39px}.home-menu-panels{margin-top:8px}}
@media(prefers-reduced-motion:reduce){.home-menu *{scroll-behavior:auto}}
`;
document.head.appendChild(style);setInterval(updateHomeAudio,800);Journey.menu();
})();
