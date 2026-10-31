/* La Nuit aux Trousses — tableau de highscores arcade local, plein écran sur téléphone. */
(function(){
'use strict';
const categories=[['normal','Nuit noire'],['easy','Clair de lune'],['hard','Cauchemar'],['ranked','Partie classée'],['daily','Défi du jour']];
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let selected='normal';
const css=document.createElement('style');
css.textContent=`
.arcade-score-screen{width:min(850px,100%);max-height:calc(100svh - 34px);overflow-y:auto;padding:18px;border:1px solid #c3935266;border-radius:14px;background:radial-gradient(circle at 50% 0,#542d4766,transparent 48%),linear-gradient(160deg,#171123f5,#0d0c18fa);box-shadow:0 20px 70px #0009,inset 0 0 40px #d8892110;scrollbar-width:thin;scrollbar-color:#8c6549 #171123}
.arcade-marquee{position:relative;padding:12px 14px 15px;border:1px solid #b7874555;border-radius:9px;background:#120e1dcc;overflow:hidden}
.arcade-marquee:after{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0 3px,#ffffff06 4px);opacity:.45}
.arcade-marquee>span{color:#d5a960;font-size:9px;letter-spacing:3px}
.arcade-marquee h2{margin:7px 0 4px;color:#ffd477;font:900 clamp(32px,6vw,54px)/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:7px;text-shadow:0 0 16px #ff9c4666,3px 3px 0 #6c342f}
.arcade-marquee p{margin:0;color:#bca9c5;font-size:11px;letter-spacing:.5px}
.arcade-tabs{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:14px 0 10px}
.arcade-tabs button{border:1px solid #72576d;border-radius:6px;background:#251b31;color:#c6b6ce;padding:8px 12px;font-size:10px;font-weight:700}
.arcade-tabs button.active{border-color:#e0ad62;background:#61402f;color:#ffe1a3;box-shadow:inset 0 0 12px #ffb65718}
.arcade-board-summary{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:8px 2px;color:#ae9abb;font-size:10px;text-align:left}
.arcade-board-summary b{color:#eac488;font-size:11px;letter-spacing:.5px}
.arcade-score-table{width:100%;--arcade-row-height:44px}
.arcade-score-columns,.arcade-score-row{display:grid;grid-template-columns:58px minmax(0,1fr) 90px 112px;align-items:center;column-gap:8px}
.arcade-score-columns{height:27px;padding:0 12px;border:1px solid #7f5c4744;border-bottom:0;border-radius:7px 7px 0 0;background:#2c1d2c;color:#b89469;font-size:8px;font-weight:800;letter-spacing:1.3px;text-align:left}
.arcade-score-columns span:last-child{text-align:right}
.arcade-score-viewport{position:relative;height:calc(var(--arcade-row-height) * var(--arcade-visible));overflow:hidden;border:1px solid #8d684b66;border-radius:0 0 7px 7px;background:linear-gradient(90deg,#100d1ddd,#191122dd);outline:none;scrollbar-width:thin;scrollbar-color:#b17c4e #191122;overscroll-behavior:contain}
.arcade-score-viewport:focus-visible{border-color:#f0bd70;box-shadow:0 0 0 2px #f0bd7033}
.arcade-score-track{will-change:transform}
.arcade-score-row{height:var(--arcade-row-height);padding:0 12px;border-bottom:1px solid #ffffff0a;color:#d7c8df;font:11px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;text-align:left}
.arcade-score-row:nth-child(odd){background:#ffffff03}
.arcade-score-row:nth-child(1){color:#ffe0a0;background:linear-gradient(90deg,#9f66262b,transparent)}
.arcade-score-row.is-last{color:#fff0c0;background:linear-gradient(90deg,#c17b365c,#7a452c22);box-shadow:inset 3px 0 #ffd276}
.arcade-rank{color:#a98b70;font-weight:800}
.arcade-score-row:nth-child(1) .arcade-rank{color:#ffd276}
.arcade-player{min-width:0;display:flex;align-items:center;gap:8px}
.arcade-player b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 11px/1.2 Arial,sans-serif}
.arcade-player small{flex:none;color:#ffd276;font:700 7px/1 Arial,sans-serif;letter-spacing:.8px}
.arcade-stage{color:#a994b8;text-align:center;font-size:10px}
.arcade-points{color:#ffd08a;text-align:right;font-weight:800;letter-spacing:1px;font-variant-numeric:tabular-nums}
.arcade-score-table.is-auto .arcade-score-track{animation:arcade-score-scroll var(--arcade-duration) linear infinite}
.arcade-score-table.is-auto:hover .arcade-score-track,.arcade-score-table.is-auto:focus-within .arcade-score-track{animation-play-state:paused}
.arcade-score-table.is-manual .arcade-score-viewport{overflow-y:auto}
.arcade-score-table.is-manual .arcade-score-track{animation:none;transform:none;will-change:auto}
.arcade-score-table.is-manual .arcade-score-duplicate{display:none}
.arcade-score-table.is-static .arcade-score-viewport{overflow-y:auto}
.arcade-scroll-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;color:#8f7c9e;font-size:9px;text-align:left}
.arcade-scroll-toggle{flex:none;border:1px solid #7c5d53;border-radius:5px;background:#2a1d30;color:#e5bd81;padding:6px 9px;font-size:9px}
.arcade-scroll-toggle:hover{border-color:#d8a967;color:#ffe2aa}
.arcade-score-empty{height:100%;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8e7b9e;text-align:center}
.arcade-score-empty>span{font-size:30px;color:#c49360}.arcade-score-empty>b{color:#d5b98e;font-size:12px}.arcade-score-empty>small{max-width:290px;font-size:10px;line-height:1.5}
.arcade-outside{margin-top:8px;padding-top:7px;border-top:1px dashed #b48b5555}
.arcade-outside>span{display:block;margin:0 0 5px;color:#d2a96e;font-size:8px;letter-spacing:1px;text-align:left}
.arcade-outside .arcade-score-row{border:1px solid #b48b5555;border-radius:5px}
.arcade-local-note{margin:11px 0 0;color:#81738f;font-size:9px;line-height:1.6}
.arcade-board-actions{margin-top:12px;justify-content:center}
.scoreboard-window .arcade-score-table{margin-top:9px}
.scoreboard-window .arcade-score-columns,.scoreboard-window .arcade-score-row{grid-template-columns:40px minmax(0,1fr) 55px 82px;padding-left:8px;padding-right:8px;column-gap:5px}
.scoreboard-window .arcade-score-columns{font-size:7px;letter-spacing:.5px}
.scoreboard-window .arcade-player{display:block}.scoreboard-window .arcade-player b{display:block;font-size:10px}.scoreboard-window .arcade-player small{display:block;margin-top:2px;font-size:6px}
.scoreboard-window .arcade-points{font-size:10px;letter-spacing:0}
.scoreboard-window .arcade-scroll-controls{align-items:flex-start;font-size:8px}.scoreboard-window .arcade-scroll-toggle{font-size:8px;padding:5px 7px}
.arcade-result-caption{margin-top:7px;color:#a892b4;font-size:8px;line-height:1.5;text-align:center}
@keyframes arcade-score-scroll{0%,10%{transform:translateY(0)}90%,100%{transform:translateY(-50%)}}
@media(max-width:850px){
.overlay:has(.arcade-score-screen){justify-content:flex-start;padding:10px}
.arcade-score-screen{width:100%;min-height:100%;max-height:none;margin:0;display:flex;flex-direction:column}
.arcade-board-actions{z-index:2;position:sticky;bottom:0;margin-top:auto;padding:12px 0 2px;background:linear-gradient(0deg,#110d22f5,#110d22d9);backdrop-filter:blur(8px)}
}
@media(max-width:560px){
.arcade-score-table{--arcade-visible:3!important}
.arcade-score-screen{padding:10px;max-height:none;border-radius:10px}.arcade-marquee{padding:10px 8px 12px}.arcade-marquee h2{font-size:31px;letter-spacing:4px}.arcade-marquee>span{font-size:7px;letter-spacing:2px}.arcade-marquee p{font-size:9px}
.arcade-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:10px 0 8px}.arcade-tabs button{padding:7px 5px;font-size:9px}
.arcade-board-summary{display:block;margin:7px 2px;font-size:8px}.arcade-board-summary b{display:block;margin-bottom:3px;font-size:9px}
.arcade-score-columns,.arcade-score-row{grid-template-columns:35px minmax(0,1fr) 45px 75px;column-gap:4px;padding-left:7px;padding-right:7px}
.arcade-score-columns{font-size:6px;letter-spacing:.5px}.arcade-score-row{font-size:9px}.arcade-player{display:block}.arcade-player b{display:block;font-size:10px}.arcade-player small{display:block;margin-top:2px;font-size:6px}.arcade-stage{font-size:8px}.arcade-points{font-size:9px;letter-spacing:0}
.arcade-scroll-controls{font-size:8px}.arcade-scroll-controls>span{max-width:150px}.arcade-local-note{font-size:8px}.arcade-board-actions{margin-top:auto}.arcade-board-actions button{padding:11px 20px}
}
@media(max-width:560px) and (min-height:760px){.arcade-score-screen .arcade-score-table{--arcade-visible:6!important}}
@media(max-width:560px) and (min-height:600px) and (max-height:759px){.arcade-score-screen .arcade-score-table{--arcade-visible:4!important}}
@media(prefers-reduced-motion:reduce){.arcade-score-viewport{scroll-behavior:auto}}
`;
document.head.appendChild(css);
const esc=value=>typeof safeText==='function'?safeText(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validCategory=category=>categories.some(([id])=>id===category);
const label=category=>categories.find(([id])=>id===category)?.[1]||'Nuit noire';
const points=value=>String(Math.max(0,Math.floor(Number(value)||0))).padStart(6,'0');
function ranked(category,day){
  const today=day||dateKey();
  return records.map((record,index)=>({record,index})).filter(({record})=>record&&record.category===category&&(category!=='daily'||record.date===today)).sort((a,b)=>(Number(b.record.score)||0)-(Number(a.record.score)||0)||a.index-b.index).map(({record})=>record);
}
function row(record,rank,isLast){
  const stage=Math.max(1,Math.min(5,Math.floor(Number(record.stage)||1)));
  const destination=record.win?'AUBE':'M'+stage;
  const name=record.name||'Sorcière';
  return `<div class="arcade-score-row${isLast?' is-last':''}" role="row"${isLast?' data-last-score="true"':''}><span class="arcade-rank" role="cell">${String(rank).padStart(2,'0')}</span><span class="arcade-player" role="cell" title="${esc(name)}"><b>${esc(name)}</b>${isLast?'<small>DERNIER VOL</small>':''}</span><span class="arcade-stage" role="cell" title="${record.win?'Les cinq gardiens sont tombés':'Monde '+stage+' · '+Math.max(0,Number(record.clears)||0)+' gardiens vaincus'}">${destination}</span><span class="arcade-points" role="cell">${points(record.score)}</span></div>`;
}
function table(category,options={}){
  const list=ranked(category,options.day);
  const top=list.slice(0,10);
  const latest=options.highlight?window.MinuitLastScore:null;
  const visible=window.matchMedia?.('(max-width:560px)').matches?3:(options.compact?4:5);
  const scrolling=top.length>visible;
  const automatic=scrolling&&!reduced?.matches;
  const rows=top.map((record,index)=>row(record,index+1,record===latest)).join('');
  const latestRank=latest?list.indexOf(latest):-1;
  const outside=latest&&latestRank>=10?`<div class="arcade-outside"><span>TON VOL · RANG ${latestRank+1}</span>${row(latest,latestRank+1,true)}</div>`:'';
  const empty='<div class="arcade-score-empty"><span>☾</span><b>Le tableau attend sa première légende.</b><small>Termine un vol dans ce mode pour inscrire ton nom.</small></div>';
  const duration=Math.max(18,top.length*2.4);
  return `<div class="arcade-score-table${options.compact?' is-compact':''}${scrolling?(automatic?' is-auto':' is-manual'):' is-static'}" data-category="${category}" style="--arcade-visible:${visible};--arcade-duration:${duration}s" role="table" aria-label="Top 10 · ${esc(label(category))}"><div class="arcade-score-columns" role="row"><span role="columnheader">RANG</span><span role="columnheader">SORCIÈRE</span><span role="columnheader">MONDE</span><span role="columnheader">SCORE</span></div><div class="arcade-score-viewport" tabindex="0" aria-label="Liste des scores. Utilise le bouton de défilement ou les touches fléchées pour la parcourir."><div class="arcade-score-track">${top.length?`<div class="arcade-score-group" role="rowgroup">${rows}</div>${scrolling?`<div class="arcade-score-group arcade-score-duplicate" role="rowgroup" aria-hidden="true">${rows}</div>`:''}`:empty}</div></div>${outside}${scrolling?`<div class="arcade-scroll-controls"><button type="button" class="arcade-scroll-toggle" aria-pressed="${automatic}">${automatic?'Ⅱ Pause du défilement':'▶ Défilement automatique'}</button><span>${automatic?'Survole le tableau pour une pause temporaire.':'Molette, toucher ou flèches pour consulter.'}</span></div>`:''}</div>`;
}
function setScrollMode(tableElement,automatic){
  if(!tableElement||!tableElement.querySelector('.arcade-scroll-toggle'))return;
  const viewport=tableElement.querySelector('.arcade-score-viewport');
  const button=tableElement.querySelector('.arcade-scroll-toggle');
  viewport.scrollTop=0;
  tableElement.classList.toggle('is-auto',automatic);
  tableElement.classList.toggle('is-manual',!automatic);
  button.setAttribute('aria-pressed',String(automatic));
  button.textContent=automatic?'Ⅱ Pause du défilement':'▶ Défilement automatique';
  const note=tableElement.querySelector('.arcade-scroll-controls span');
  if(note)note.textContent=automatic?'Survole le tableau pour une pause temporaire.':'Molette, toucher ou flèches pour consulter.';
}
function wire(root){
  root.querySelectorAll('.arcade-score-table:not([data-wired])').forEach(tableElement=>{
    tableElement.dataset.wired='true';
    tableElement.querySelector('.arcade-scroll-toggle')?.addEventListener('click',()=>setScrollMode(tableElement,!tableElement.classList.contains('is-auto')));
    const viewport=tableElement.querySelector('.arcade-score-viewport');
    const takeControl=()=>{if(tableElement.classList.contains('is-auto'))setScrollMode(tableElement,false)};
    viewport?.addEventListener('wheel',takeControl,{passive:true});
    viewport?.addEventListener('touchstart',takeControl,{passive:true});
    viewport?.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(event.key))takeControl()});
  });
}
function defaultCategory(){
  if(state==='end'&&validCategory(runId))return runId;
  return validCategory(prefs.difficulty)?prefs.difficulty:'normal';
}
function summary(category,day){
  const list=ranked(category,day);
  const dayLabel=category==='daily'?' · '+(day||dateKey()):'';
  return `<b>${esc(label(category))}${esc(dayLabel)}</b><span>${list.length?`${Math.min(10,list.length)} score${Math.min(10,list.length)>1?'s':''} affiché${Math.min(10,list.length)>1?'s':''} · record ${points(list[0].score)}`:'Aucun score dans cette catégorie'}</span>`;
}
function open(category=defaultCategory()){
  selected=validCategory(category)?category:'normal';
  state='arcade-scores';
  overlay(`<section class="arcade-score-screen"><div class="arcade-marquee"><span>✦ LA NUIT AUX TROUSSES ✦</span><h2>HI-SCORES</h2><p>Les dix plus grands vols de ce navigateur.</p></div><div class="arcade-tabs" role="tablist" aria-label="Catégorie de highscores">${categories.map(([id,name])=>`<button type="button" role="tab" id="arcadeTab-${id}" data-category="${id}" aria-selected="${id===selected}" class="${id===selected?'active':''}">${name}</button>`).join('')}</div><div class="arcade-board-summary" id="arcadeBoardSummary" aria-live="polite">${summary(selected)}</div><div id="arcadeBoardTable" role="tabpanel" aria-labelledby="arcadeTab-${selected}">${table(selected)}</div><div class="arcade-local-note">Records conservés sur cet appareil · difficultés, partie classée et défi du jour restent séparés.</div><div class="menu-actions arcade-board-actions"><button class="primary" id="arcadeScoresBack">Retour au menu</button></div></section>`);
  document.body.classList.add('menu-open');
  const paint=()=>{
    document.querySelectorAll('.arcade-tabs [role="tab"]').forEach(button=>{const active=button.dataset.category===selected;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
    $('arcadeBoardSummary').innerHTML=summary(selected);
    $('arcadeBoardTable').setAttribute('aria-labelledby','arcadeTab-'+selected);
    $('arcadeBoardTable').innerHTML=table(selected);
    wire($('arcadeBoardTable'));
  };
  document.querySelectorAll('.arcade-tabs [role="tab"]').forEach(button=>button.onclick=()=>{selected=button.dataset.category;paint()});
  $('arcadeScoresBack').onclick=()=>window.LocalLeague?.menu?.();
  wire($('arcadeBoardTable'));
}
function installMenuButton(){
  if(state!=='league-menu'||document.querySelector('#overlay .training-mode'))return;
  const bottom=document.querySelector('#overlay .menu-bottom');
  if(!bottom||$('arcadeScores'))return;
  const button=document.createElement('button');
  button.type='button';button.id='arcadeScores';button.className='secondary';button.textContent='★ Highscores';
  button.onclick=()=>open();
  bottom.insertBefore(button,bottom.firstChild);
}
function enhanceResult(){
  const board=document.querySelector('#overlay .scoreboard-window');
  if(!board||board.dataset.arcadeReady||state!=='end')return;
  board.dataset.arcadeReady='true';
  const title=board.querySelector(':scope > .scoreboard-title');
  const teamNodes=[...board.children].filter(child=>child.id==='teamResultStatus'||child.id==='teamEndPanel');
  [...board.children].forEach(child=>{if(child!==title&&!teamNodes.includes(child))child.remove()});
  const category=validCategory(runId)?runId:'normal';
  board.insertAdjacentHTML('beforeend',table(category,{compact:true,highlight:true,day:dailyDate}));
  board.insertAdjacentHTML('beforeend',`<div class="arcade-result-caption">TOP 10 · ${esc(label(category))}${category==='daily'?' · '+esc(dailyDate):''} · la ligne dorée est ton dernier vol.</div>`);
  teamNodes.forEach(node=>board.appendChild(node));
  const deathNote=document.querySelector('#overlay .journey-result-screen .death-note');
  const grid=document.querySelector('#overlay .journey-result-screen .journey-result-grid, #overlay > .journey-result-grid');
  const anchor=deathNote||grid;
  if(anchor)anchor.insertAdjacentElement('afterend',board);
  document.querySelector('#overlay > .rankline')?.remove();
  wire(board);
}
if(window.Journey?.menu){
  const baseMenu=window.Journey.menu;
  window.Journey.menu=function(...args){const result=baseMenu.apply(this,args);installMenuButton();return result};
}
const overlayElement=$('overlay');
if(overlayElement)new MutationObserver(enhanceResult).observe(overlayElement,{childList:true});
reduced?.addEventListener?.('change',event=>{if(event.matches)document.querySelectorAll('.arcade-score-table.is-auto').forEach(element=>setScrollMode(element,false))});
installMenuButton();
enhanceResult();
window.ArcadeScores={open,ranked,table};
})();
