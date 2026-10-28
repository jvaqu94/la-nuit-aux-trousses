/* Le terrain et ses commandes tiennent dans la fenêtre ; les infos défilent à part. */
(()=>{
'use strict';
const phoneMode=(window.matchMedia?.('(pointer:coarse)').matches||navigator.maxTouchPoints>0)&&Math.min(window.screen.width||innerWidth,window.screen.height||innerHeight)<=600;
document.documentElement.classList.toggle('phone-mode',phoneMode);
const css=document.createElement('style');css.textContent=`
html{height:100%;overflow:hidden}body{height:100vh;height:100dvh;min-height:0;overflow:hidden;display:flex;flex-direction:column;overscroll-behavior:none}canvas{touch-action:none;user-select:none;-webkit-user-select:none}header{height:48px;min-height:48px;padding:0 18px;flex-shrink:0}header .logo{font-size:18px;letter-spacing:3px}header .sound{padding:7px 11px;font-size:11px}main{width:100%;max-width:none;min-height:0;flex:1;margin:0;padding:8px 14px 10px;display:flex;flex-direction:column}.heading{height:36px;min-height:36px;flex-shrink:0;margin:0 0 8px}.heading .eyebrow{font-size:8px;letter-spacing:2px}.heading h1{font-size:20px;margin:3px 0 0}.heading .tag{font-size:9px;padding:6px 9px}.layout{flex:1;min-height:0;grid-template-columns:var(--field-width,400px) 260px;justify-content:center;gap:14px;align-items:stretch}.layout>div:first-child{height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.arena,.arena:has(.overlay:not(.hidden)){width:var(--field-width,400px)!important;height:var(--field-height,450px)!important;min-height:0!important;max-width:100%;aspect-ratio:8/9!important;flex:none;border-radius:12px}.touchbar{width:var(--field-width,400px);max-width:100%;height:36px;min-height:36px;flex:none;margin-top:6px;align-items:center}.touchbar button{height:34px;padding:7px 12px;font-size:11px}.key-label{font-size:9px;text-align:center}.sidebar{height:100%;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;padding-right:4px;display:block}.sidebar .panel{margin-bottom:12px}.footer{display:none}.overlay{overscroll-behavior:contain;scrollbar-width:thin;padding:18px 20px}.overlay>*{flex-shrink:0}.overlay .local-title,.overlay .league-overlay-title{font-size:clamp(25px,3.6vh,42px)!important}.journey-menu-progress{max-width:400px}.journey-contracts{margin-top:12px}.journey-small{margin:7px 0}.journey-main-actions{margin-top:10px}.info-shade{position:fixed;inset:0;background:#080611b8;z-index:19}.sidebar .drawer-close{display:none}.view-controls{white-space:nowrap}.touch-stick{position:absolute;width:72px;height:72px;border:1px solid #e0d0ef66;border-radius:50%;background:#1c142b55;box-shadow:inset 0 0 18px #c4a5e511;pointer-events:none;z-index:4;transform:translate(-50%,-50%)}.touch-stick i{position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px;border-radius:50%;background:#d8bdf0aa;border:1px solid #f4e5ffbb;box-shadow:0 0 16px #b58bd255}.hud{top:12px;left:13px;right:13px;font-size:8px;letter-spacing:1px}.hud b{font-size:18px}.hud .hearts{font-size:15px}.highscore-line{font-size:8px}.journey-tutor{top:89px}.local-quests{bottom:34px}.toast{font-size:10px;bottom:10px}
.phone-mode #fullView{display:none}@media(min-width:851px){#infoToggle{display:none}}
@media(max-width:850px){header{height:42px;min-height:42px;padding:0 10px}header .logo{font-size:15px;letter-spacing:2px}header small{display:none}header>div:last-child{gap:5px!important}header .sound{font-size:10px;padding:6px 8px}main{padding:6px 8px 8px}.heading{height:34px;min-height:34px;margin-bottom:5px}.heading .eyebrow{font-size:7px;letter-spacing:1px}.heading h1{font-size:18px}.heading .tag{font-size:8px;max-width:45%;padding:4px 7px}.layout{grid-template-columns:minmax(0,1fr);gap:0}.sidebar{display:none}.sidebar.infos-open{display:block;position:fixed;z-index:20;top:42px;bottom:0;right:0;height:auto;width:min(360px,94vw);background:#181123;padding:16px;box-shadow:-20px 0 60px #0008}.sidebar .drawer-close{display:block;width:100%;margin-bottom:14px;padding:10px;background:#3d2a4b;border:1px solid #8b6d99;color:#f1dfeb;border-radius:8px}.overlay{padding:15px 12px}.overlay p{font-size:11px}.journey-tutor{top:89px;padding:8px 10px}.journey-tutor span{font-size:9px}.hud b{font-size:16px}.hud .hearts{font-size:13px}.local-quests{width:140px;font-size:8px;left:7px;bottom:29px}.touchbar .key-label{font-size:8px;max-width:45%}.layout .touchbar{height:56px;min-height:56px;margin-top:8px;gap:6px}.layout .touchbar button{height:50px;min-height:50px;padding:8px 10px;font-size:11px;border-radius:10px}.touchbar #specialCast{flex:1 1 auto;max-width:none;font-size:11px;font-weight:700;white-space:normal;line-height:1.15;background:linear-gradient(145deg,#4b3061,#31203f);border-color:#b18acc;color:#f2d9ff}.touchbar #specialCast.spell-ready{background:linear-gradient(145deg,#67417d,#3d2851);border-color:#d4a9ed;box-shadow:0 0 16px #b277c822}.touchbar #dash{min-width:82px}.overlay .journey-small{font-size:9px}}
@media(max-height:500px){header{height:34px;min-height:34px}.heading{display:none}main{padding:4px 8px}.layout .touchbar{height:40px;min-height:40px;margin-top:4px}.layout .touchbar button{height:38px;min-height:38px;padding:4px 9px;font-size:10px}.sidebar.infos-open{top:34px}.hud{top:6px;left:7px;right:7px;font-size:6px}.hud b{font-size:13px;margin-top:3px}.hud .hearts{font-size:10px}.highscore-line{font-size:6px;margin:2px 0}.hud #combo{font-size:6px}.local-quests{transform:scale(.72);transform-origin:bottom left;bottom:20px}.journey-tutor{top:66px;width:90%;padding:5px 7px}.journey-tutor span{font-size:8px}.journey-tutor b{font-size:7px}.toast{font-size:7px}.overlay .local-title{font-size:24px!important}}
`;
css.textContent+=`header .logo{display:flex;flex-direction:column;gap:1px;flex-shrink:0;line-height:1.05;letter-spacing:1.7px}header .logo .brand-top{color:#f2e9df;font-size:11px;font-weight:700;letter-spacing:3px}header .logo .brand-bottom{color:#e1b38b;font-size:15px;white-space:nowrap}header .logo i{font-style:normal;font-size:12px;margin-left:6px;color:#f1bb7a}.heading>div:first-child{min-width:0}.heading h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:850px){header .logo .brand-top{font-size:9px;letter-spacing:2px}header .logo .brand-bottom{font-size:12px;letter-spacing:1px}header .logo i{font-size:9px;margin-left:4px}.heading h1{font-size:16px}.heading .tag{max-width:40%}}@media(max-height:500px){header .logo .brand-top{font-size:8px}header .logo .brand-bottom{font-size:11px}}`;
css.textContent+=`
/* Lisibilité mobile : le terrain garde ses dimensions, seuls les textes et
   contrastes d’interface grandissent. */
@media(max-width:850px){
 .heading .eyebrow{font-size:9px}.heading .tag{font-size:10px}
 .hud{font-size:10px;letter-spacing:.5px;text-shadow:0 1px 3px #000}.hud b{font-size:20px}.hud .hearts{font-size:16px}.highscore-line,.hud #combo{font-size:10px}
 .toast{font-size:14px;line-height:1.4;bottom:12px;text-shadow:0 2px 4px #000,0 0 9px #000}
 .journey-tutor{top:104px;width:min(420px,91%);padding:11px 12px}.journey-tutor b{font-size:11px}.journey-tutor span{font-size:12px;line-height:1.45}
 .local-quests{width:168px;padding:8px 9px}.local-quests button{font-size:10px}.local-quest-row .line,.local-quest-row .line span,.local-quest-row b{font-size:10px}.local-quest-note{font-size:9px}
 .combat-hud{font-size:10px!important;top:92px}
 .overlay p{font-size:13px}.overlay .journey-small{font-size:12px;line-height:1.55}.overlay small,.overlay .tiny{font-size:11px}
 .local-card strong{font-size:13px}.local-card span{font-size:11px}.journey-contract>div:first-child,.journey-contract b{font-size:11px}.journey-contract small{font-size:10px}
 .arsenal-card b{font-size:14px!important}.arsenal-card span{font-size:12px!important}.arsenal-card em,.arsenal-card small{font-size:11px!important}.flight-analysis p{font-size:12px!important}
 .sidebar.infos-open .tiny,.sidebar.infos-open .journey-small,.sidebar.infos-open .local-note,.sidebar.infos-open .muted,.sidebar.infos-open .item span{font-size:12px!important}.sidebar.infos-open .panel h3{font-size:12px}.sidebar.infos-open .badge{font-size:11px}
 .touchbar button,.touchbar #specialCast{font-size:12px!important}
}
@media(max-width:370px) and (min-height:501px){.hud{font-size:9px}.hud b{font-size:18px}.local-quests{width:152px}.touchbar button,.touchbar #specialCast{font-size:11px!important}}
@media(max-height:500px){
 .hud{font-size:8px}.hud b{font-size:15px}.hud .hearts{font-size:12px}.highscore-line,.hud #combo{font-size:8px}.combat-hud{font-size:8px!important;top:60px}
 .toast{font-size:10px;bottom:7px}.journey-tutor{top:66px;padding:6px 8px}.journey-tutor b{font-size:9px}.journey-tutor span{font-size:10px}
 .local-quests{width:150px}.local-quests button,.local-quest-row .line,.local-quest-row .line span,.local-quest-row b{font-size:9px}.local-quest-note{font-size:8px}
 .overlay p{font-size:11px}.overlay .journey-small{font-size:10px}.touchbar button,.touchbar #specialCast{font-size:11px!important}
}
`;
css.textContent+=`
@media(max-width:850px){
 body:has(.account-page) .arena:has(.overlay:not(.hidden)),body:has(.account-team-board) .arena:has(.overlay:not(.hidden)),body:has(.arcade-score-screen) .arena:has(.overlay:not(.hidden)){width:100%!important;height:100%!important;max-height:100%!important;aspect-ratio:auto!important}
 .overlay:has(.account-page),.overlay:has(.account-team-board),.overlay:has(.arcade-score-screen){justify-content:flex-start;padding:10px}
 .account-team-board{width:100%;min-height:100%}
}
`;
css.textContent+=`
/* Le bilan et ses HI-SCORES utilisent toute la surface disponible. */
body:has(.journey-result-screen) .layout{grid-template-columns:minmax(0,1fr)!important}
body:has(.journey-result-screen) .sidebar,body:has(.journey-result-screen) .touchbar{display:none!important}
body:has(.journey-result-screen) .arena:has(.overlay:not(.hidden)){width:100%!important;height:100%!important;max-height:100%!important;aspect-ratio:auto!important}
.overlay:has(.journey-result-screen){justify-content:flex-start;padding:14px}
@media(max-width:850px){.overlay:has(.journey-result-screen){padding:10px}}
`;
document.head.appendChild(css);
const holder=document.querySelector('.layout>div:first-child'),arena=document.querySelector('.arena'),aside=document.querySelector('.sidebar'),bar=document.querySelector('.touchbar');
arena.insertAdjacentHTML('beforeend','<div class="touch-stick hidden" id="touchStick" aria-hidden="true"><i></i></div>');
let scheduled=false;
function fit(){scheduled=false;const space=Math.max(80,holder.clientHeight-bar.offsetHeight-6),width=Math.max(80,innerWidth>850?document.querySelector('.layout').clientWidth-274:holder.clientWidth),portrait=innerWidth<=850&&innerHeight>innerWidth;const h=Math.floor(Math.min(space,width*(portrait?1.45:9/8))),w=Math.floor(portrait?Math.min(width,h*8/9):h*8/9);document.querySelector('.layout').style.setProperty('--field-width',w+'px');holder.style.setProperty('--field-width',w+'px');holder.style.setProperty('--field-height',h+'px');resize()}
function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(fit)}}
if(window.ResizeObserver)new ResizeObserver(schedule).observe(holder);
window.addEventListener('resize',schedule);window.visualViewport?.addEventListener('resize',schedule);document.addEventListener('fullscreenchange',schedule);
$('settings').insertAdjacentHTML('beforebegin','<button class="sound" id="infoToggle" aria-expanded="false">Infos</button><button class="sound view-controls" id="fullView" title="Plein écran" aria-label="Activer le plein écran">⛶</button>');
const shade=document.createElement('div');shade.className='info-shade hidden';document.body.appendChild(shade);
aside.insertAdjacentHTML('afterbegin','<button class="drawer-close" id="closeInfos">Fermer les informations ×</button>');
function close(){aside.classList.remove('infos-open');shade.classList.add('hidden');$('infoToggle').setAttribute('aria-expanded','false')}
$('infoToggle').onclick=()=>{if(aside.classList.contains('infos-open'))return close();if(state==='play')pauseScreen();aside.classList.add('infos-open');shade.classList.remove('hidden');$('infoToggle').setAttribute('aria-expanded','true');$('closeInfos').focus()};$('closeInfos').onclick=close;shade.onclick=close;
aside.addEventListener('click',e=>{if(e.target.closest('#panelCollection'))close()});
window.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
$('fullView').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw Error()}catch{say('Plein écran indisponible ici ; le terrain reste ajusté à la fenêtre.',4)}schedule()};
// Sur téléphone, le plein écran est tenté à l’ouverture puis au premier geste
// autorisé. Aucun bouton ou panneau supplémentaire ne vient couvrir le jeu.
const phoneFullscreenEvents=['pointerdown','touchstart','keydown'];
let phoneFullscreenPending=false;
function removePhoneFullscreenListeners(){for(const type of phoneFullscreenEvents)window.removeEventListener(type,requestPhoneFullscreen,true)}
async function requestPhoneFullscreen(){
 if(!phoneMode||phoneFullscreenPending)return;
 const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
 if(!request||document.fullscreenElement||document.webkitFullscreenElement){removePhoneFullscreenListeners();return}
 phoneFullscreenPending=true;
 try{await request.call(root,{navigationUI:'hide'});removePhoneFullscreenListeners()}catch{}
 phoneFullscreenPending=false;schedule();
}
if(phoneMode&&(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen)){
 for(const type of phoneFullscreenEvents)window.addEventListener(type,requestPhoneFullscreen,{capture:true,passive:true});
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement)removePhoneFullscreenListeners()});
 requestPhoneFullscreen();
}
schedule();
})();
