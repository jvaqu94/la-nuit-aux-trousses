/* Supabase optionnel : client REST léger, aucune dépendance ni clé secrète.
 * Le jeu local reste autonome si la configuration est vide ou hors ligne. */
(()=>{
'use strict';

const raw=window.MINUIT_SUPABASE_CONFIG||{};
let url='';
try{
 const value=new URL(raw.url||'');
 if(value.protocol==='https:'||(value.protocol==='http:'&&['localhost','127.0.0.1'].includes(value.hostname)))url=value.origin;
}catch{}
const key=String(raw.publishableKey||raw.anonKey||'').trim();
const enabled=!!(url&&key);
const confirmationUrl=enabled?url+'/functions/v1/email-confirmation':'';
const SESSION_KEY='minuit-supabase-session-v1';
const AUTO_KEY='minuit-supabase-auto-v1';
const GAME_VERSION='2026.10.25-9';
const EMPTY_TEAM=()=>({team:null,scores:[]});

let session=null;
let auto=false;
let mount=null;
let timer=null;
let syncing=false;
let bundling=false;
let pending=false;
let lastSync=0;
let refreshing=null;
let busy=false;
let teamData=EMPTY_TEAM();
let teamLoaded=false;
let teamLoading=null;
let teamLoadError='';
let teamBusy=false;
let teamEpoch=0;
let pendingTeamCode='';
let teamInviteRecipient='';
try{
 const value=normalizeTeamCode(new URLSearchParams(location.search).get('team'));
 if(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(value)){pendingTeamCode=value;cleanInvitationUrl()}
}catch{}

try{
 const value=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
 if(value&&typeof value.access_token==='string'&&typeof value.refresh_token==='string'&&value.user?.id)session=value;
}catch{}
try{auto=!!session&&localStorage.getItem(AUTO_KEY)===session.user.id}catch{}

function storeSession(){
 try{
  if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
 }catch{}
}
function setAuto(value){
 auto=!!value;
 try{
  if(auto&&session)localStorage.setItem(AUTO_KEY,session.user.id);
  else localStorage.removeItem(AUTO_KEY);
 }catch{}
}
function status(text,error=false){
 const element=document.getElementById('cloudStatus');
 if(element){element.textContent=text;element.classList.toggle('cloud-error',error)}
}
function teamStatus(text,error=false){
 const element=document.getElementById('teamStatus');
 if(element){element.textContent=text;element.classList.toggle('cloud-error',error)}
}
function errorMessage(data,fallback){return data?.msg||data?.error_description||data?.message||data?.error||fallback}

async function refresh(){
 if(!session?.refresh_token)throw Error('Session en ligne expirée. Reconnecte-toi.');
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:session.refresh_token}},false);
  if(!data?.access_token)throw Error('Impossible de renouveler la session en ligne.');
  session={...session,...data,user:data.user||session.user,refresh_token:data.refresh_token||session.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
  storeSession();
 })();
 try{return await refreshing}finally{refreshing=null}
}
async function ensureSession(){
 if(!session)throw Error('Connecte-toi à ton compte en ligne.');
 if(Number.isFinite(session.expires_at)&&session.expires_at<Date.now()/1000+60)await refresh();
}
async function request(path,options={},canRetry=true){
 const {method='GET',body,auth=true,headers={}}=options;
 if(auth&&session)await ensureSession();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url+path,{
   method,
   headers:{
    apikey:key,
    Accept:'application/json',
    Authorization:'Bearer '+(auth&&session?session.access_token:key),
    ...(body!==undefined?{'Content-Type':'application/json'}:{}),
    ...headers
   },
   body:body===undefined?undefined:JSON.stringify(body),
   credentials:'omit',
   signal:controller.signal
  });
  const text=await response.text();
  let data=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(response.status===401&&auth&&session?.refresh_token&&canRetry){
   await refresh();
   return request(path,options,false);
  }
  if(!response.ok)throw Error(errorMessage(data,'Le service en ligne a refusé la requête ('+response.status+').'));
  return data;
 }catch(error){
  if(error?.name==='AbortError')throw Error('Le service en ligne ne répond pas. Vérifie ta connexion.');
  throw error;
 }finally{clearTimeout(timeout)}
}
function resetTeam(){
 teamEpoch++;
 teamData=EMPTY_TEAM();
 teamLoaded=false;
 teamLoading=null;
 teamLoadError='';
 teamBusy=false;
 teamInviteRecipient='';
}
function setSession(data){
 if(!data?.access_token||!data?.user?.id)return false;
 if(session?.user.id!==data.user.id)resetTeam();
 session={
  access_token:data.access_token,
  refresh_token:data.refresh_token||'',
  expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600),
  user:{id:data.user.id,email:data.user.email||''}
 };
 if(!session.refresh_token)throw Error('Session en ligne incomplète.');
 storeSession();
 try{auto=localStorage.getItem(AUTO_KEY)===session.user.id}catch{}
 return true;
}
function credentials(){
 const email=String(document.getElementById('cloudEmail')?.value||'').trim();
 const password=String(document.getElementById('cloudPassword')?.value||'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180)throw Error('Saisis une adresse e-mail valide.');
 if(password.length<8||password.length>128)throw Error('Le mot de passe doit contenir 8 à 128 caractères.');
 return{email,password};
}
async function authenticate(signup){
 if(busy)return;
 busy=true;
 status(signup?'Création du compte…':'Connexion…');
 try{
  const body=credentials();
  const redirect=signup?'?redirect_to='+encodeURIComponent(confirmationUrl):'';
  const data=await request(signup?'/auth/v1/signup'+redirect:'/auth/v1/token?grant_type=password',{method:'POST',auth:false,body});
  if(setSession(data)){
   renderPanel();
   status('Compte connecté. La première synchronisation se fait manuellement.');
  }else status('Compte créé. Ouvre le lien reçu, puis reviens ici te connecter.');
 }catch(error){
  const message=/email.*not.*confirmed/i.test(error.message)?'Adresse pas encore confirmée. Ouvre le lien reçu ou choisis « Renvoyer la confirmation ».':error.message;
  status(message,true);
 }finally{busy=false}
}
async function resendConfirmation(){
 if(busy)return;
 const email=String(document.getElementById('cloudEmail')?.value||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>180){status('Saisis d’abord l’adresse e-mail du compte.',true);return}
 busy=true;status('Renvoi de la confirmation…');
 try{
  await request('/auth/v1/resend?redirect_to='+encodeURIComponent(confirmationUrl),{method:'POST',auth:false,body:{type:'signup',email}});
  status('Nouvel e-mail demandé. Vérifie ta boîte et les courriers indésirables, puis ouvre le nouveau lien.');
 }catch(error){status(error.message,true)}finally{busy=false}
}
async function logout(){
 if(busy)return;
 busy=true;
 status('Déconnexion…');
 try{if(session)await request('/auth/v1/logout',{method:'POST',body:{}})}catch{}
 finally{
  if(timer){clearTimeout(timer);timer=null}
  session=null;
  storeSession();
  setAuto(false);
  resetTeam();
  busy=false;
  renderPanel();
 }
}

async function syncNow(automatic=false){
 if(!enabled||!session||syncing||(automatic&&!auto)){if(syncing)pending=true;return false}
 syncing=true;
 pending=false;
 status('Envoi de la sauvegarde…');
 try{
  await ensureSession();
  bundling=true;
  let payload;
  try{payload=Journey.bundle()}finally{bundling=false}
  await request('/rest/v1/game_saves?on_conflict=user_id',{
   method:'POST',
   body:{user_id:session.user.id,payload,client_updated_at:new Date().toISOString()},
   headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
  });
  lastSync=Date.now();
  setAuto(true);
  status('Sauvegarde cloud envoyée · '+new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  return true;
 }catch(error){
  status('Cloud indisponible : '+error.message+' La copie locale est conservée.',true);
  return false;
 }finally{
  syncing=false;
  if(pending){pending=false;schedule()}
 }
}
function schedule(){
 if(!enabled||!session||!auto||bundling)return;
 if(syncing){pending=true;return}
 if(timer)return;
 const delay=Math.max(5000,30000-(Date.now()-lastSync));
 timer=setTimeout(()=>{timer=null;syncNow(true)},delay);
}
async function restore(){
 if(!session||busy)return;
 busy=true;
 if(timer){clearTimeout(timer);timer=null}
 setAuto(false);
 status('Lecture de la sauvegarde cloud…');
 try{
  const rows=await request('/rest/v1/game_saves?select=payload,updated_at&limit=1');
  if(!Array.isArray(rows)||!rows[0]?.payload)throw Error('Aucune sauvegarde cloud pour ce compte.');
  Journey.validate(rows[0].payload);
  status('Sauvegarde vérifiée. Confirmation de la restauration…');
  const file=new File([JSON.stringify(rows[0].payload)],'sauvegarde-en-ligne.json',{type:'application/json'});
  const statusNode={textContent:''};
  const restored=await Journey.importSave(file,statusNode);
  if(!restored&&document.getElementById('cloudStatus'))status(statusNode.textContent||'Restauration annulée : ta progression locale est inchangée.',!!statusNode.textContent);
 }catch(error){status('Restauration impossible : '+error.message,true)}finally{busy=false}
}
async function submitFeedback(value){
 if(!enabled)throw Error('La sauvegarde en ligne n’est pas encore configurée.');
 const rating=['hard','fair','easy'].includes(value.rating)?value.rating:null;
 if(!rating)throw Error('Choisis d’abord une appréciation.');
 if(session)await ensureSession();
 const text=(name,fallback='',limit=80)=>String(value[name]??fallback).slice(0,limit);
 const body={
  run_id:text('id','vol-inconnu'),
  rating,
  comment:text('comment','',1000).trim(),
  world:text('world','Inconnu'),
  stage:Math.max(1,Math.min(5,Math.floor(value.stage)||1)),
  wave:Math.max(1,Math.min(5,Math.floor(value.wave)||1)),
  score:Math.max(0,Math.min(100000000,Math.floor(value.score)||0)),
  mode:['free','ranked','daily'].includes(value.mode)?value.mode:'free',
  difficulty:['easy','normal','hard'].includes(value.difficulty)?value.difficulty:'normal',
  game_version:GAME_VERSION
 };
 await request('/rest/v1/game_feedback',{method:'POST',auth:!!session,body,headers:{Prefer:'return=minimal'}});
 return true;
}

const TEAM_ERRORS={
 AUTH_REQUIRED:'Connecte-toi pour gérer ta team.',
 TEAM_NAME_INVALID:'Le nom de la team doit contenir 2 à 40 caractères.',
 DISPLAY_NAME_INVALID:'Le pseudo doit contenir 2 à 24 caractères.',
 ALREADY_IN_TEAM:'Tu appartiens déjà à une team. Quitte-la avant d’en rejoindre une autre.',
 TEAM_CODE_UNAVAILABLE:'Impossible de générer un code pour le moment. Réessaie.',
 TEAM_NOT_FOUND:'Aucune team ne correspond à ce code.',
 NOT_IN_TEAM:'Tu ne fais plus partie de cette team. Actualise le classement.',
 SCORE_INVALID:'Le score transmis n’est pas valide.',
 MODE_INVALID:'Le mode de jeu transmis n’est pas valide.',
 DIFFICULTY_INVALID:'La difficulté transmise n’est pas valide.',
 PROGRESS_INVALID:'La progression transmise n’est pas valide.',
 DAILY_LIMIT_INVALID:'Choisis entre 1 et 100 parties par jour, ou illimité.',
 PERIOD_INVALID:'La fin de la période doit être postérieure au début.',
 TEAM_ADMIN_REQUIRED:'Seul l’administrateur de la team peut modifier ces règles.',
 TEAM_RULES_REQUIRED:'L’administrateur doit configurer les règles avant que les scores comptent.',
 TEAM_PERIOD_NOT_STARTED:'La période de la team n’a pas encore commencé. Ce vol ne compte pas pour la team.',
 TEAM_PERIOD_ENDED:'La période de la team est terminée. Ce vol ne compte pas pour la team.',
 TEAM_DAILY_LIMIT:'Ta limite de parties comptabilisées est atteinte pour aujourd’hui. Tu peux continuer à jouer localement, mais ce vol ne compte pas pour la team.',
 RUN_ID_INVALID:'Identifiant de vol invalide.'
};
function teamErrorMessage(error){
 const message=String(error?.message||error||'Team indisponible.');
 for(const [code,text] of Object.entries(TEAM_ERRORS))if(message.includes(code))return text;
 return message;
}
function normalizeTeamCode(value){return String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function formatTeamCode(value){
 const code=normalizeTeamCode(value);
 return code.length===10?code.slice(0,5)+'-'+code.slice(5):code;
}
function teamJoinLink(code){
 if(!/^https?:$/.test(location.protocol))return '';
 const target=new URL(location.href);
 for(const key of ['access_token','refresh_token','traffic_access_token'])target.searchParams.delete(key);
 target.hash='';target.searchParams.set('team',normalizeTeamCode(code));
 return target.toString();
}
function teamShareLinks(info,recipient=''){
 const link=teamJoinLink(info.code),message='Rejoins ma team « '+(info.name||'La Nuit')+' » dans La Nuit aux Trousses ! Code : '+formatTeamCode(info.code)+(link?'\n'+link:'');
 const subject='Invitation à la team « '+(info.name||'La Nuit')+' » · La Nuit aux Trousses';
 const body='Bonjour,\n\n'+message+'\n\nOuvre le lien ou saisis ce code dans « Sauvegarde & partage », section « Rejoindre avec un code ». Tu pourras choisir ton pseudo avant de nous rejoindre.\n\nÀ bientôt dans la nuit !';
 return{link,whatsapp:'https://wa.me/?text='+encodeURIComponent(message),messenger:'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link),email:'mailto:'+encodeURIComponent(String(recipient).trim())+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)};
}
function validTeamEmail(value){const email=String(value||'').trim();return email.length<=180&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
function cleanInvitationUrl(){
 try{
  const target=new URL(location.href);
  for(const key of ['team','access_token','refresh_token','traffic_access_token'])target.searchParams.delete(key);
  target.hash='';
  history.replaceState(null,'',target.pathname+(target.searchParams.size?'?'+target.searchParams:''));
 }catch{}
}
function clearPendingTeamCode(){pendingTeamCode='';cleanInvitationUrl()}
function teamNumber(value){return Math.max(0,Number(value)||0).toLocaleString('fr-FR')}
function validTeamState(value){
 if(!value||typeof value!=='object')throw Error('Réponse de team invalide.');
 return{team:value.team&&typeof value.team==='object'?value.team:null,scores:Array.isArray(value.scores)?value.scores:[]};
}
function setTeamBusy(value){
 teamBusy=value;
 for(const id of ['teamCreate','teamJoin','teamRefresh','teamLeave','teamSaveRules','teamDelete']){
  const button=document.getElementById(id);
  if(button)button.disabled=value;
 }
}
async function loadTeam(showError=false){
 if(!enabled||!session)return null;
 if(teamLoading)return teamLoading;
 const epoch=teamEpoch;
 const userId=session.user.id;
 if(showError)teamStatus('Actualisation du classement…');
 teamLoading=(async()=>{
  try{
   const data=await request('/rest/v1/rpc/minuit_team_state',{method:'POST',body:{}});
   if(epoch!==teamEpoch||session?.user.id!==userId)return null;
   teamData=validTeamState(data);
   teamLoaded=true;
   teamLoadError='';
   renderTeam();
   if(showError)teamStatus('Classement actualisé.');
   return teamData;
  }catch(error){
   if(epoch===teamEpoch){
    const message=teamErrorMessage(error);
    if(!teamData.team){teamLoadError=message;teamLoaded=false;renderTeam()}
    if(showError)teamStatus(message,true);
   }
   return null;
  }finally{if(epoch===teamEpoch)teamLoading=null}
 })();
 return teamLoading;
}
function teamInputs(){
 const displayName=String(document.getElementById('teamDisplayName')?.value||'').trim();
 if(displayName.length<2||displayName.length>24)throw Error(TEAM_ERRORS.DISPLAY_NAME_INVALID);
 return{displayName};
}
function toDateTimeInput(value){
 if(!value)return '';
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return '';
 return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function teamRuleFields(prefix,info=null){
 const limit=!info||info.rulesConfigured===false?3:info.dailyGameLimit;
 const selected=value=>String(limit??'0')===value?' selected':'';
 return `<label>Parties par jour<select id="${prefix}DailyLimit"><option value="1"${selected('1')}>1 partie / jour</option><option value="2"${selected('2')}>2 parties / jour</option><option value="3"${selected('3')}>3 parties / jour</option><option value="5"${selected('5')}>5 parties / jour</option><option value="10"${selected('10')}>10 parties / jour</option><option value="20"${selected('20')}>20 parties / jour</option><option value="50"${selected('50')}>50 parties / jour</option><option value="100"${selected('100')}>100 parties / jour</option><option value="0"${selected('0')}>Illimité</option></select></label><label>Début (optionnel)<input id="${prefix}StartsAt" type="datetime-local" value="${toDateTimeInput(info?.startsAt)}"></label><label>Fin (optionnelle)<input id="${prefix}EndsAt" type="datetime-local" value="${toDateTimeInput(info?.endsAt)}"></label><div class="team-rule-note">Les vols hors période ou au-delà de la limite restent jouables localement, mais ne comptent pas pour la team.</div>`;
}
function readTeamRules(prefix){
 const raw=document.getElementById(prefix+'DailyLimit')?.value||'3';
 const daily=raw==='0'?null:Number(raw);
 if(daily!==null&&(!Number.isInteger(daily)||daily<1||daily>100))throw Error(TEAM_ERRORS.DAILY_LIMIT_INVALID);
 const readDate=suffix=>{
  const value=String(document.getElementById(prefix+suffix)?.value||'');
  if(!value)return null;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))throw Error(TEAM_ERRORS.PERIOD_INVALID);
  return date.toISOString();
 };
 const startsAt=readDate('StartsAt');
 const endsAt=readDate('EndsAt');
 if(startsAt&&endsAt&&new Date(endsAt)<=new Date(startsAt))throw Error(TEAM_ERRORS.PERIOD_INVALID);
 return{p_daily_game_limit:daily,p_starts_at:startsAt,p_ends_at:endsAt};
}
function teamDate(value){
 if(!value)return '';
 const date=new Date(value);
 return Number.isFinite(date.getTime())?date.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'';
}
function teamRulesSummary(info){
 if(!info.rulesConfigured)return '<b>Règles à configurer par l’administrateur avant de compter les scores.</b>';
 const today=Math.max(0,Number(info.gamesToday)||0);
 const lines=[];
 if(info.dailyGameLimit==null)lines.push(today+' partie'+(today>1?'s':'')+' aujourd’hui · limite illimitée');
 else{
  const remaining=Math.max(0,Number(info.gamesRemaining)||0);
  lines.push(today+'/'+Number(info.dailyGameLimit)+' parties aujourd’hui · '+remaining+' restante'+(remaining>1?'s':''));
 }
 const start=teamDate(info.startsAt),end=teamDate(info.endsAt);
 if(start&&end)lines.push('Période : du '+start+' au '+end);
 else if(start)lines.push('Période : à partir du '+start);
 else if(end)lines.push('Période : jusqu’au '+end);
 else lines.push('Période libre, sans date limite');
 return lines.map(safeText).join('<br>');
}
async function updateTeamRules(){
 if(teamBusy||!session)return;
 try{
  const body=readTeamRules('teamEdit');
  setTeamBusy(true);
  teamStatus('Enregistrement des règles…');
  const data=await request('/rest/v1/rpc/minuit_update_team_rules',{method:'POST',body});
  teamData=validTeamState(data);
  teamLoaded=true;
  teamLoadError='';
  setTeamBusy(false);
  renderTeam();
  teamStatus('Règles de la team enregistrées.');
 }catch(error){
  setTeamBusy(false);
  teamStatus(teamErrorMessage(error),true);
 }
}
async function createTeam(){
 if(teamBusy||!session)return;
 try{
  const {displayName}=teamInputs();
  const name=String(document.getElementById('teamName')?.value||'').trim();
  if(name.length<2||name.length>40)throw Error(TEAM_ERRORS.TEAM_NAME_INVALID);
  setTeamBusy(true);
  teamStatus('Création de la team…');
  const rules=readTeamRules('teamRules');
  const data=await request('/rest/v1/rpc/minuit_create_team',{method:'POST',body:{p_name:name,p_display_name:displayName,...rules}});
  teamData=validTeamState(data);
  teamLoaded=true;
  teamLoadError='';
  setTeamBusy(false);
  renderTeam();
  teamStatus('Team créée ! Partage le code pour réunir les joueurs.');
 }catch(error){
  setTeamBusy(false);
  teamStatus(teamErrorMessage(error),true);
 }
}
async function joinTeam(){
 if(teamBusy||!session)return;
 try{
  const {displayName}=teamInputs();
  const code=normalizeTeamCode(document.getElementById('teamCode')?.value);
  if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code))throw Error('Saisis le code de 10 caractères, avec ou sans tiret.');
  setTeamBusy(true);
  teamStatus('Recherche de la team…');
  const data=await request('/rest/v1/rpc/minuit_join_team',{method:'POST',body:{p_code:code,p_display_name:displayName}});
  teamData=validTeamState(data);
  teamLoaded=true;
  teamLoadError='';
  clearPendingTeamCode();
  setTeamBusy(false);
  renderTeam();
  teamStatus('Tu as rejoint la team ! Ton prochain meilleur score sera ajouté.');
 }catch(error){
  setTeamBusy(false);
  teamStatus(teamErrorMessage(error),true);
 }
}
async function leaveTeam(){
 if(teamBusy||!session)return;
 const wasLast=Number(teamData.team?.memberCount)===1;
 if(!confirm(wasLast?'Tu es le dernier membre : quitter supprimera définitivement la team et ses scores. Continuer ?':'Quitter cette team ? Ton score sera retiré de son classement.'))return;
 setTeamBusy(true);
 teamStatus('Départ de la team…');
 try{
  await request('/rest/v1/rpc/minuit_leave_team',{method:'POST',body:{}});
  teamData=EMPTY_TEAM();
  teamLoaded=true;
  teamLoadError='';
  setTeamBusy(false);
  renderTeam();
  teamStatus(wasLast?'Tu as quitté la team. La team vide et ses scores ont été supprimés.':'Tu as quitté la team.');
 }catch(error){
  setTeamBusy(false);
  teamStatus(teamErrorMessage(error),true);
 }
}
async function deleteTeam(){
 if(teamBusy||!session||!teamData.team?.isAdmin)return;
 if(!confirm('Supprimer définitivement cette team pour tous ses membres ? Le classement, les scores et les règles seront effacés. Cette action est irréversible.'))return;
 setTeamBusy(true);
 teamStatus('Suppression de la team…');
 try{
  await request('/rest/v1/rpc/minuit_delete_team',{method:'POST',body:{}});
  teamData=EMPTY_TEAM();
  teamLoaded=true;
  teamLoadError='';
  setTeamBusy(false);
  renderTeam();
  teamStatus('Team supprimée. Tu peux maintenant en créer ou en rejoindre une autre.');
 }catch(error){
  setTeamBusy(false);
  teamStatus(teamErrorMessage(error),true);
 }
}
async function copyTeamCode(){
 const code=teamData.team?.code;
 if(!code)return;
 try{
  if(!navigator.clipboard?.writeText)throw Error('copie indisponible');
  await navigator.clipboard.writeText(formatTeamCode(code));
  teamStatus('Code copié. Envoie-le aux autres joueurs !');
 }catch{teamStatus('Code à partager : '+formatTeamCode(code))}
}
function renderTeam(){
 const card=document.getElementById('teamCard');
 if(!card||!session)return;
 if(!teamLoaded&&!teamData.team){
  if(teamLoadError){
   card.innerHTML=`<h3>🏆 TEAM & HIGHSCORE</h3><p>${safeText(teamLoadError)}</p><div class="cloud-actions"><button class="secondary" id="teamRetry">Réessayer</button></div>`;
   document.getElementById('teamRetry').onclick=()=>{teamLoadError='';renderTeam();loadTeam(true)};
  }else card.innerHTML='<h3>🏆 TEAM & HIGHSCORE</h3><p>Chargement de la team…</p>';
  return;
 }
 if(teamData.team){
  const info=teamData.team;
  const rows=teamData.scores.map(row=>`<div class="team-row${row.isYou?' team-you':''}"><b class="team-rank">#${Number(row.rank)||0}</b><span class="team-player">${safeText(row.displayName||'Sorcière')}${row.isAdmin?'<small class="team-role">ADMIN</small>':''}${row.isYou?'<small>TOI</small>':''}</span><span class="team-run">${row.mode?'V'+Number(row.wave)+' · M'+Number(row.stage):'Aucun vol'}</span><b class="team-score">${teamNumber(row.score)}</b></div>`).join('');
  const adminRules=info.isAdmin?`<details class="team-admin-panel"${info.rulesConfigured?'':' open'}><summary>⚙ Règles administrateur</summary>${teamRuleFields('teamEdit',info)}<div class="cloud-actions"><button class="secondary" id="teamSaveRules">Enregistrer les règles</button></div></details>`:'';
  const share=teamShareLinks(info),mobileShare=share.link?`<div class="team-mobile-share"><span>PARTAGER L’INVITATION</span><div class="cloud-actions"><a class="secondary" id="teamWhatsApp" href="${share.whatsapp}" target="_blank" rel="noopener">WhatsApp</a><a class="secondary" id="teamMessenger" href="${share.messenger}" target="_blank" rel="noopener">Messenger</a></div></div>`:'';
  const emailShare=`<div class="team-email-share"><span>INVITATION PAR E-MAIL</span><label for="teamInviteEmail">Adresse du destinataire</label><div class="team-email-row"><input id="teamInviteEmail" type="email" inputmode="email" autocomplete="off" spellcheck="false" maxlength="180" placeholder="joueur@example.com" value="${safeText(teamInviteRecipient)}"><a class="secondary" id="teamEmailInvite" href="${safeText(share.email)}">Inviter par e-mail</a></div><small>Le destinataire, le code et le lien sont préremplis. Tu confirmes ensuite l’envoi dans ta messagerie.</small></div>`;
  card.innerHTML=`<h3>🏆 TEAM · ${safeText(info.name||'Sans nom')}${info.isAdmin?'<small class="team-role">ADMIN</small>':''}</h3><div class="team-code-line"><span>CODE À PARTAGER</span><button class="team-code" id="teamCopyCode" title="Copier le code">${safeText(formatTeamCode(info.code))}</button></div>${mobileShare}${emailShare}<div class="team-summary"><span><b>${teamNumber(info.memberCount)}</b> membre${Number(info.memberCount)>1?'s':''}</span><span>Total des highscores <b>${teamNumber(info.totalScore)}</b></span></div><div class="team-rules-summary">${teamRulesSummary(info)}</div><div class="team-leaderboard" aria-label="Highscores des membres">${rows||'<p>Aucun membre pour le moment.</p>'}</div>${adminRules}<div class="cloud-actions"><button class="secondary" id="teamRefresh">Actualiser</button><button class="secondary" id="teamLeave">Quitter la team</button>${info.isAdmin?'<button class="secondary team-danger" id="teamDelete">Supprimer la team</button>':''}</div><div class="cloud-status" id="teamStatus" role="status">${info.rulesConfigured?'Le meilleur score est conservé ; chaque vol comptabilisé utilise une partie du jour.':'Les scores restent suspendus jusqu’à la configuration des règles par l’administrateur.'}</div>`;
  document.getElementById('teamRefresh').onclick=()=>loadTeam(true);
  document.getElementById('teamLeave').onclick=leaveTeam;
  document.getElementById('teamCopyCode').onclick=copyTeamCode;
  const inviteInput=document.getElementById('teamInviteEmail'),inviteLink=document.getElementById('teamEmailInvite');
  const updateEmailInvitation=()=>{
   teamInviteRecipient=String(inviteInput.value||'').trim();
   inviteLink.href=teamShareLinks(info,validTeamEmail(teamInviteRecipient)?teamInviteRecipient:'').email;
  };
  inviteInput.addEventListener('input',updateEmailInvitation);
  inviteLink.addEventListener('click',event=>{
   updateEmailInvitation();
   if(!validTeamEmail(teamInviteRecipient)){
    event.preventDefault();
    teamStatus('Saisis une adresse e-mail valide pour préparer l’invitation.',true);
    inviteInput.focus();
    return;
   }
   teamStatus('Invitation préparée pour '+teamInviteRecipient+'. Confirme l’envoi dans ta messagerie.');
  });
  updateEmailInvitation();
  if(info.isAdmin){
   document.getElementById('teamSaveRules').onclick=updateTeamRules;
   document.getElementById('teamDelete').onclick=deleteTeam;
  }
  return;
 }
 card.innerHTML=`<h3>🏆 TEAM & HIGHSCORE</h3><p>Crée une team ou rejoins-la avec son code. Le classement réunit le meilleur score de chaque membre et leur total, sans afficher les e-mails.</p><label>Pseudo dans la team<input id="teamDisplayName" type="text" autocomplete="nickname" minlength="2" maxlength="24" placeholder="Ex. : Sorcière agile"></label><label>Nom de la team<input id="teamName" type="text" maxlength="40" placeholder="Ex. : Les Balais de minuit"></label><div class="team-separator"><span>TES RÈGLES D’ADMINISTRATEUR</span></div>${teamRuleFields('teamRules')}<div class="cloud-actions"><button class="secondary" id="teamCreate">Créer et configurer la team</button></div><div class="team-separator"><span>OU REJOINDRE AVEC UN CODE</span></div><label>Code de la team<input id="teamCode" type="text" maxlength="11" autocapitalize="characters" spellcheck="false" placeholder="ABCDE-FGHIJ"></label><div class="cloud-actions"><button class="secondary" id="teamJoin">Rejoindre la team</button></div><div class="cloud-status" id="teamStatus" role="status">Le créateur devient administrateur. Un compte e-mail est nécessaire pour retrouver ta team et compter chaque joueur une seule fois.</div>`;
 document.getElementById('teamCreate').onclick=createTeam;
 document.getElementById('teamJoin').onclick=joinTeam;
 if(pendingTeamCode){
  document.getElementById('teamCode').value=formatTeamCode(pendingTeamCode);
  teamStatus('Lien d’invitation détecté : le code est prérempli. Choisis ton pseudo puis rejoins la team.');
 }
}
async function submitTeamScore(value){
 if(!enabled||!session)return{skipped:true};
 if(!teamLoaded)await loadTeam(false);
 if(!teamData.team)return{skipped:true};
 const body={
  p_score:Math.max(0,Math.min(100000000,Math.floor(value.score)||0)),
  p_mode:['free','ranked','daily'].includes(value.mode)?value.mode:'free',
  p_difficulty:['easy','normal','hard'].includes(value.difficulty)?value.difficulty:'normal',
  p_stage:Math.max(1,Math.min(5,Math.floor(value.stage)||1)),
  p_wave:Math.max(1,Math.min(5,Math.floor(value.wave)||1)),
  p_run_id:String(value.id||'').trim().slice(0,80)
 };
 let result;
 try{result=await request('/rest/v1/rpc/minuit_submit_team_score',{method:'POST',body})}
 catch(error){
  if(String(error?.message||'').includes('NOT_IN_TEAM')){teamData=EMPTY_TEAM();teamLoaded=false}
  throw Error(teamErrorMessage(error));
 }
 teamLoaded=false;
 return result||{bestScore:body.p_score,improved:false};
}

function renderPanel(target=mount){
 if(target)mount=target;
 if(!mount||!mount.isConnected)return;
 if(!enabled){
  mount.innerHTML='<section class="cloud-card"><h3>☁ SAUVEGARDE EN LIGNE</h3><p>Cloud non configuré. La sauvegarde locale et l’export JSON restent pleinement disponibles.</p></section>';
  return;
 }
 if(!session){
  mount.innerHTML=`<section class="cloud-card"><h3>☁ SAUVEGARDE EN LIGNE</h3><p>Compte e-mail optionnel, pour retrouver ta progression sur un autre appareil ou rejoindre une team. Le jeu local reste disponible sans compte.</p><label>E-mail<input id="cloudEmail" type="email" autocomplete="email" maxlength="180"></label><label>Mot de passe<input id="cloudPassword" type="password" autocomplete="current-password" maxlength="128"></label><div class="cloud-actions"><button class="secondary" id="cloudLogin">Se connecter</button><button class="secondary" id="cloudRegister">Créer un compte</button><button class="secondary" id="cloudResend">Renvoyer la confirmation</button></div><div class="cloud-status" id="cloudStatus" role="status">Le mot de passe part uniquement vers le service de connexion et n’est jamais enregistré par le jeu.</div></section>`;
  document.getElementById('cloudLogin').onclick=()=>authenticate(false);
  document.getElementById('cloudRegister').onclick=()=>authenticate(true);
  document.getElementById('cloudResend').onclick=resendConfirmation;
  return;
 }
 mount.innerHTML=`<section class="cloud-card"><h3>☁ SAUVEGARDE EN LIGNE</h3><p>Compte : <b>${safeText(session.user.email||'compte en ligne')}</b><br>Un emplacement cloud par compte ; le dernier envoi remplace le précédent.</p><div class="cloud-actions"><button class="secondary" id="cloudSync">Envoyer ma progression</button><button class="secondary" id="cloudRestore">Récupérer le cloud</button><button class="secondary" id="cloudLogout">Déconnecter</button></div><div class="cloud-status" id="cloudStatus" role="status">${auto?'Synchronisation automatique activée après chaque changement.':'Premier envoi manuel, puis synchronisation automatique.'}</div></section><section class="cloud-card team-card" id="teamCard"></section>`;
 document.getElementById('cloudSync').onclick=()=>syncNow();
 document.getElementById('cloudRestore').onclick=restore;
 document.getElementById('cloudLogout').onclick=logout;
 renderTeam();
 if(!teamLoaded&&!teamLoading)loadTeam(false);
}

const css=document.createElement('style');
css.textContent=`
.cloud-card{width:100%;max-width:620px;margin:14px 0;padding:14px;border:1px solid #6f8aa755;border-radius:10px;background:#17243688;text-align:left}
.cloud-card h3{margin:0 0 8px;font-size:11px;color:#b7dff1;letter-spacing:1px}
.cloud-card p{font-size:10px;line-height:1.7;color:#c3c8dc}
.cloud-card label{display:grid;grid-template-columns:110px 1fr;align-items:center;gap:10px;margin:8px 0;font-size:11px;color:#d3c8e2}
.cloud-card input,.cloud-card select{min-width:0;width:100%;padding:9px;background:#251f36;color:#f2eaff;border:1px solid #65577c;border-radius:6px}
.cloud-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.team-mobile-share{display:none;margin:10px 0;padding:10px;border:1px solid #79b99a44;border-radius:8px;background:#18302755}
.team-mobile-share>span{color:#a9d8c5;font-size:9px;letter-spacing:1px}
.team-mobile-share a{text-decoration:none;text-align:center}
.team-email-share{margin:10px 0;padding:10px;border:1px solid #8ca8d855;border-radius:8px;background:#1b294455}
.team-email-share>span{color:#b7dff1;font-size:9px;letter-spacing:1px}
.team-email-share>label{display:block;margin:8px 0 5px;font-size:10px;color:#d3c8e2}
.team-email-row{display:flex;align-items:stretch;gap:7px}
.team-email-row input{flex:1;min-width:0}
.team-email-row a{display:flex;align-items:center;justify-content:center;text-align:center;text-decoration:none;white-space:nowrap}
.team-email-share small{display:block;margin-top:7px;color:#aeb8cc;font-size:9px;line-height:1.55}
.team-danger{color:#f0afa8!important;border-color:#a65e5e88!important}
.cloud-status{min-height:18px;margin-top:9px;font-size:10px;line-height:1.6;color:#a9d8c5}
.cloud-status.cloud-error{color:#f0afa8}
.team-card{background:linear-gradient(145deg,#17243699,#291d3488);border-color:#b8996655}
.team-code-line{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;color:#bdb1cf;font-size:9px;letter-spacing:1px}
.team-code{padding:8px 12px;border:1px dashed #d9b77399;border-radius:7px;background:#332840;color:#ffe0a0;font:700 14px ui-monospace,monospace;letter-spacing:2px}
.team-summary{display:flex;justify-content:space-between;gap:10px;margin:10px 0;color:#bcb0ce;font-size:10px}
.team-summary b{color:#ffd08e}
.team-rules-summary{margin:10px 0;padding:9px 10px;border:1px solid #b8996644;border-radius:7px;background:#2b213788;color:#d4c4df;font-size:10px;line-height:1.7}
.team-rule-note{margin:8px 0;color:#a99ab7;font-size:9px;line-height:1.6}
.team-admin-panel{margin:10px 0;padding:10px;border:1px solid #b8996655;border-radius:8px;background:#251d3388}
.team-admin-panel summary{cursor:pointer;color:#ffd08e;font-size:10px;letter-spacing:.5px}
.team-admin-panel[open] summary{margin-bottom:10px}
.team-role{margin-left:7px;color:#ffd08e!important;font-size:7px!important;letter-spacing:1px}
.team-leaderboard{max-height:280px;overflow:auto;border:1px solid #6d5a7c55;border-radius:8px;background:#110e1c88}
.team-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto minmax(74px,auto);align-items:center;gap:8px;padding:9px 8px;border-bottom:1px solid #ffffff09;font-size:11px}
.team-row:last-child{border-bottom:0}
.team-row.team-you{background:#7c583b22}
.team-rank{color:#b9a3ca;font-size:10px}
.team-player{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e8d9ef}
.team-player small{margin-left:6px;color:#ffc57e;font-size:7px;letter-spacing:1px}
.team-run{color:#9d8eae;font-size:9px;white-space:nowrap}
.team-score{color:#ffd08e;text-align:right;white-space:nowrap}
.team-separator{display:flex;align-items:center;gap:8px;margin:16px 0 8px;color:#8e7c9e;font-size:8px;letter-spacing:1px}
.team-separator:before,.team-separator:after{content:"";height:1px;flex:1;background:#65556f66}
.feedback-comment{width:100%;max-width:620px;margin:8px 0 12px;padding:12px;border:1px solid #715c8055;border-radius:10px;background:#241b3299}
.feedback-comment label{display:block;text-align:left;font-size:10px;color:#cdb9d9}
.feedback-comment textarea{box-sizing:border-box;width:100%;min-height:68px;margin-top:7px;resize:vertical;padding:9px;background:#21182e;color:#f3e7fa;border:1px solid #6c577a;border-radius:7px;font:11px Arial;line-height:1.5}
.feedback-comment .tiny{margin-top:7px}
.journey-feedback button.selected{border-color:#efbe80;background:#51344f;color:#ffe1b0}
@media(max-width:850px),(pointer:coarse){.team-mobile-share{display:block}}
@media(max-width:850px){
 .cloud-card label{grid-template-columns:1fr;gap:4px}
 .cloud-actions button{flex:1 1 45%}
 .team-email-row{flex-direction:column}
 .team-email-row a{padding:10px 12px}
 .team-row{grid-template-columns:28px minmax(0,1fr) minmax(68px,auto)}
 .team-run{display:none}
 .team-summary{flex-direction:column;gap:4px}
}`;
document.head.appendChild(css);

window.MinuitCloud={
 schedule,
 sync:()=>syncNow(),
 restore,
 submitFeedback,
 submitTeamScore,
 renderPanel,
 refreshTeam:()=>loadTeam(true),
 get configured(){return enabled},
 get connected(){return!!session},
 get inTeam(){return!!session&&!!teamData.team},
 get user(){return session?.user||null}
};
if(enabled&&session&&auto)schedule();
if(enabled&&pendingTeamCode)setTimeout(()=>{if(typeof archives==='function')archives()},0);
})();
