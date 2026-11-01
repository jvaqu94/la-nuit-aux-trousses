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
const INVITE_KEY='minuit-team-invite-v1';
const GAME_VERSION='2026.10.26-10';
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
let teamStatsDays=30;
let teamStatsEpoch=0;
let pendingTeamCode='';
let teamInviteRecipient='';
try{
 const fromUrl=normalizeTeamCode(new URLSearchParams(location.search).get('team'));
 let value=fromUrl;
 if(!value)try{value=normalizeTeamCode(sessionStorage.getItem(INVITE_KEY))}catch{}
 if(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(value)){
  pendingTeamCode=value;
  if(fromUrl){
   try{sessionStorage.setItem(INVITE_KEY,value)}catch{}
   cleanInvitationUrl();
  }
 }
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
function sessionUser(user,fallback={}){
 const source=user||fallback,metadata=source?.user_metadata||{};
 return{
  id:source?.id||fallback?.id,
  email:source?.email||fallback?.email||'',
  displayName:metadata.display_name||source?.displayName||fallback?.displayName||'',
  authProvider:metadata.auth_provider||source?.authProvider||fallback?.authProvider||(source?.email?'email':'')
 };
}

async function refresh(){
 if(!session?.refresh_token)throw Error('Session en ligne expirée. Reconnecte-toi.');
 if(refreshing)return refreshing;
 refreshing=(async()=>{
  const data=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:session.refresh_token}},false);
  if(!data?.access_token)throw Error('Impossible de renouveler la session en ligne.');
  session={...session,...data,user:sessionUser(data.user,session.user),refresh_token:data.refresh_token||session.refresh_token,expires_at:Math.floor(Date.now()/1000)+(data.expires_in||3600)};
  storeSession();
  window.useAccountPseudo?.();
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
 teamStatsEpoch++;
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
  user:sessionUser(data.user)
 };
 if(!session.refresh_token)throw Error('Session en ligne incomplète.');
 storeSession();
 window.useAccountPseudo?.();
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
function pseudoCredentials(){
 const username=String(document.getElementById('cloudPseudo')?.value||'').normalize('NFKC').trim();
 const password=String(document.getElementById('cloudPseudoPassword')?.value||'');
 const length=Array.from(username).length,passwordLength=Array.from(password).length;
 if(length<2||length>24||!/^[\p{L}\p{N}\p{M} ._'-]+$/u.test(username))throw Error('Le pseudo doit contenir 2 à 24 caractères, sans symboles spéciaux.');
 if(passwordLength<8||passwordLength>128)throw Error('Le mot de passe doit contenir 8 à 128 caractères.');
 return{username,password};
}
const PSEUDO_ERRORS={
 PSEUDO_INVALID:'Le pseudo doit contenir 2 à 24 caractères, sans symboles spéciaux.',
 PASSWORD_INVALID:'Le mot de passe doit contenir 8 à 128 caractères.',
 PSEUDO_UNAVAILABLE:'Ce pseudo est déjà utilisé. Connecte-toi ou choisis un autre pseudo.',
 AUTH_INVALID:'Pseudo ou mot de passe incorrect.',
 AUTH_UNAVAILABLE:'Le service de connexion est indisponible. Réessaie dans un moment.'
};
function pseudoErrorMessage(error){
 const message=String(error?.message||error||'Connexion impossible.');
 for(const [code,text] of Object.entries(PSEUDO_ERRORS))if(message.includes(code))return text;
 if(/invalid.*(credentials|grant)/i.test(message))return PSEUDO_ERRORS.AUTH_INVALID;
 return message;
}
function returnHomeAfterInvite(signup){
 if(window.LocalLeague?.menu)window.LocalLeague.menu();else window.Journey?.menu?.();
 const account=document.getElementById('archives');
 if(account){
  account.classList.add('home-account-welcome');
  const title=account.querySelector('b'),detail=account.querySelector('small');
  if(title)title.textContent=signup?'✓ Compte créé · Tu es dans la team':'✓ Connexion réussie · Tu es dans la team';
  if(detail)detail.textContent='Ta prochaine partie classée comptera pour la team.';
 }
 const overlayNode=document.getElementById('overlay');
 if(overlayNode)overlayNode.scrollTop=0;
}
async function authenticatePseudo(signup){
 if(busy)return;
 busy=true;
 const invited=!!pendingTeamCode;
 status(signup?'Création de ton accès…':'Connexion…');
 try{
  const body=pseudoCredentials();
  const data=await request('/functions/v1/pseudo-auth',{method:'POST',auth:false,body:{action:signup?'register':'login',...body}});
  if(!setSession(data))throw Error('AUTH_INVALID');
  renderPanel();
  status(signup?'Accès créé, sans e-mail ni confirmation.':'Connexion réussie.');
  if(invited){
   const joined=await joinPendingTeam(body.username);
   if(joined)returnHomeAfterInvite(signup);
  }
 }catch(error){status(pseudoErrorMessage(error),true)}
 finally{busy=false}
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
 RUN_ID_INVALID:'Identifiant de vol invalide.',
 STATS_PERIOD_INVALID:'La période de statistiques demandée n’est pas valide.'
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
function clearPendingTeamCode(){
 pendingTeamCode='';
 try{sessionStorage.removeItem(INVITE_KEY)}catch{}
 cleanInvitationUrl();
}
function teamNumber(value){return Math.max(0,Number(value)||0).toLocaleString('fr-FR')}
function validTeamState(value){
 if(!value||typeof value!=='object')throw Error('Réponse de team invalide.');
 return{team:value.team&&typeof value.team==='object'?value.team:null,scores:Array.isArray(value.scores)?value.scores:[]};
}
function setTeamBusy(value){
 teamBusy=value;
 for(const id of ['teamCreate','teamJoin','teamRefresh','teamLeave','teamSaveRules','teamResetCampaign','teamDelete','teamStatsOpen']){
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
   window.useAccountPseudo?.(teamData.scores.find(row=>row.isYou)?.displayName||'');
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
 const accountName=String(session?.user?.displayName||'').trim();
 const displayName=(accountName||String(document.getElementById('teamDisplayName')?.value||'').trim()).trim();
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
  window.useAccountPseudo?.(displayName);
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
 if(teamBusy||!session)return false;
 try{
  const {displayName}=teamInputs();
  const code=normalizeTeamCode(document.getElementById('teamCode')?.value);
  if(!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/.test(code))throw Error('Saisis le code de 10 caractères, avec ou sans tiret.');
  setTeamBusy(true);
  teamStatus('Recherche de la team…');
  const data=await request('/rest/v1/rpc/minuit_join_team',{method:'POST',body:{p_code:code,p_display_name:displayName}});
  teamData=validTeamState(data);
  window.useAccountPseudo?.(displayName);
  teamLoaded=true;
  teamLoadError='';
  clearPendingTeamCode();
  setTeamBusy(false);
  renderTeam();
  teamStatus('Tu as rejoint la team ! Ton prochain highscore de partie classée sera ajouté.');
  return true;
 }catch(error){
  setTeamBusy(false);
  teamStatus(teamErrorMessage(error),true);
  return false;
 }
}
async function joinPendingTeam(displayName){
 const code=pendingTeamCode;
 if(!code||!session)return false;
 const data=await loadTeam(false);
 if(!data||code!==pendingTeamCode)return false;
 if(teamData.team){
  if(teamData.team.code===code){
   clearPendingTeamCode();
   teamStatus('Tu es déjà membre de cette team.');
   return true;
  }
  teamStatus('Tu appartiens déjà à « '+(teamData.team.name||'une autre team')+' ». Quitte-la avant de répondre à cette invitation.',true);
  return false;
 }
 const name=document.getElementById('teamDisplayName'),codeInput=document.getElementById('teamCode');
 if(!name||!codeInput)return false;
 name.value=String(displayName||'').slice(0,24);
 codeInput.value=formatTeamCode(code);
 return joinTeam();
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
async function resetTeamCampaign(){
 if(teamBusy||!session||!teamData.team?.isAdmin)return;
 if(!confirm('Réinitialiser la campagne pour TOUS les membres ? Tous les scores, highscores et parties comptabilisées seront définitivement effacés. Les membres et les règles seront conservés.'))return;
 const showResetStatus=(message,error=false)=>{const node=document.getElementById('teamResetStatus');if(node){node.textContent=message;node.classList.toggle('cloud-error',error)}};
 setTeamBusy(true);
 teamStatus('Réinitialisation de la campagne…');
 showResetStatus('Réinitialisation de la campagne…');
 try{
  const data=await request('/rest/v1/rpc/minuit_reset_team_campaign',{method:'POST',body:{}});
  teamData=validTeamState(data);
  teamLoaded=true;
  teamLoadError='';
  setTeamBusy(false);
  renderTeam();
  teamStatus('Campagne réinitialisée : scores, highscores et parties sont à zéro.');
  showResetStatus('✓ Campagne réinitialisée : tous les scores et toutes les parties sont à zéro.');
 }catch(error){
  setTeamBusy(false);
  const message=teamErrorMessage(error);
  teamStatus(message,true);
  showResetStatus(message,true);
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
  const campaignReset=info.isAdmin?`<section class="team-campaign-reset" aria-label="Administration de la campagne"><b>ADMINISTRATION · CAMPAGNE</b><p>Efface tous les scores, highscores et parties comptabilisées des membres. La team, son code et ses règles sont conservés.</p><div class="cloud-actions"><button class="secondary team-danger" id="teamResetCampaign">Remettre les scores et les parties à zéro</button></div><div class="cloud-status" id="teamResetStatus" role="status"></div></section>`:'';
  const statsAccess=info.isAdmin?'<div class="cloud-actions team-stats-access"><button class="secondary" id="teamStatsOpen">Statistiques de la team</button></div>':'';
  const adminRules=info.isAdmin?`<details class="team-admin-panel"${info.rulesConfigured?'':' open'}><summary>⚙ Règles administrateur</summary>${teamRuleFields('teamEdit',info)}<div class="cloud-actions"><button class="secondary" id="teamSaveRules">Enregistrer les règles</button></div></details>`:'';
  const share=teamShareLinks(info),mobileShare=share.link?`<div class="team-mobile-share"><span>PARTAGER L’INVITATION</span><div class="cloud-actions"><a class="secondary" id="teamWhatsApp" href="${share.whatsapp}" target="_blank" rel="noopener">WhatsApp</a><a class="secondary" id="teamMessenger" href="${share.messenger}" target="_blank" rel="noopener">Messenger</a></div></div>`:'';
  const emailShare=`<div class="team-email-share"><span>INVITATION PAR E-MAIL</span><label for="teamInviteEmail">Adresse du destinataire</label><div class="team-email-row"><input id="teamInviteEmail" type="email" inputmode="email" autocomplete="off" spellcheck="false" maxlength="180" placeholder="joueur@example.com" value="${safeText(teamInviteRecipient)}"><a class="secondary" id="teamEmailInvite" href="${safeText(share.email)}">Inviter par e-mail</a></div><small>Le destinataire, le code et le lien sont préremplis. Tu confirmes ensuite l’envoi dans ta messagerie.</small></div>`;
  card.innerHTML=`<h3>🏆 TEAM · ${safeText(info.name||'Sans nom')}${info.isAdmin?'<small class="team-role">ADMIN</small>':''}</h3><div class="team-code-line"><span>CODE À PARTAGER</span><button class="team-code" id="teamCopyCode" title="Copier le code">${safeText(formatTeamCode(info.code))}</button></div>${statsAccess}${campaignReset}${mobileShare}${emailShare}<div class="team-summary"><span><b>${teamNumber(info.memberCount)}</b> membre${Number(info.memberCount)>1?'s':''}</span><span>Total des highscores <b>${teamNumber(info.totalScore)}</b></span></div><div class="team-rules-summary">${teamRulesSummary(info)}</div><div class="team-leaderboard" aria-label="Highscores des membres">${rows||'<p>Aucun membre pour le moment.</p>'}</div>${adminRules}<div class="cloud-actions"><button class="secondary" id="teamRefresh">Actualiser</button><button class="secondary" id="teamLeave">Quitter la team</button>${info.isAdmin?'<button class="secondary team-danger" id="teamDelete">Supprimer la team</button>':''}</div><div class="cloud-actions"><button class="secondary board-global-btn" id="teamBoardOpen">Voir le classement de la team</button></div><div class="cloud-status" id="teamStatus" role="status">${info.rulesConfigured?'Le meilleur score est conservé ; chaque partie classée comptabilisée utilise une partie du jour.':'Les scores restent suspendus jusqu’à la configuration des règles par l’administrateur.'}</div>`;
  document.getElementById('teamRefresh').onclick=()=>loadTeam(true);document.getElementById('teamBoardOpen').onclick=openTeamBoard;
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
   document.getElementById('teamStatsOpen').onclick=openTeamStats;
   document.getElementById('teamSaveRules').onclick=updateTeamRules;
   document.getElementById('teamResetCampaign').onclick=resetTeamCampaign;
   document.getElementById('teamDelete').onclick=deleteTeam;
  }
  return;
 }
 const accountPseudo=String(session.user.displayName||'');
 const displayField=`<label>${accountPseudo?'Pseudo du compte utilisé dans la team':'Pseudo dans la team'}<input id="teamDisplayName" type="text" autocomplete="nickname" minlength="2" maxlength="24" placeholder="Ex. : Sorcière agile" value="${safeText(accountPseudo)}"${accountPseudo?' readonly':''}></label>`;
 const createFields=`<label>Nom de la team<input id="teamName" type="text" maxlength="40" placeholder="Ex. : Les Balais de minuit"></label><div class="team-separator"><span>TES RÈGLES D’ADMINISTRATEUR</span></div>${teamRuleFields('teamRules')}<div class="cloud-actions"><button class="secondary" id="teamCreate">Créer et configurer la team</button></div>`;
 const joinFields=`<label>Code de la team<input id="teamCode" type="text" maxlength="11" autocapitalize="characters" spellcheck="false" placeholder="ABCDE-FGHIJ"></label><div class="cloud-actions"><button class="${pendingTeamCode?'primary':'secondary'}" id="teamJoin">Rejoindre la team</button></div>`;
 if(pendingTeamCode){
  card.innerHTML=`<h3>🏆 INVITATION À UNE TEAM</h3><div class="team-invite-callout"><span>CODE DE L’INVITATION</span><b>${safeText(formatTeamCode(pendingTeamCode))}</b></div><p>Choisis ton pseudo dans la team, puis rejoins les autres joueurs. Aucune adresse e-mail n’est demandée.</p>${displayField}${joinFields}<details class="team-create-alternative"><summary>Créer plutôt une nouvelle team</summary>${createFields}</details><div class="cloud-status" id="teamStatus" role="status">L’invitation est prête : le code est déjà rempli.</div>`;
 }else{
  card.innerHTML=`<h3>🏆 TEAM & HIGHSCORE</h3><p>Crée une team ou rejoins-la avec son code. Le classement réunit le meilleur score de chaque membre et leur total, sans afficher les identifiants de connexion.</p>${displayField}${createFields}<div class="team-separator"><span>OU REJOINDRE AVEC UN CODE</span></div>${joinFields}<div class="cloud-status" id="teamStatus" role="status">Le créateur devient administrateur. Ton accès par pseudo ou e-mail permet de retrouver ta team et de compter chaque joueur une seule fois.</div>`;
 }
 document.getElementById('teamCreate').onclick=createTeam;
 document.getElementById('teamJoin').onclick=joinTeam;
 if(pendingTeamCode)document.getElementById('teamCode').value=formatTeamCode(pendingTeamCode);
}
function openTeamBoard(){
 if(!teamData.team)return;
 const info=teamData.team,rows=teamData.scores.map(row=>`<div class="team-row${row.isYou?' team-you':''}"><b class="team-rank">#${Number(row.rank)||0}</b><span class="team-player">${safeText(row.displayName||'Sorcière')}${row.isYou?'<small>TOI</small>':''}</span><span class="team-run">${row.mode?'V'+Number(row.wave)+' · M'+Number(row.stage):'Aucun vol'}</span><b class="team-score">${teamNumber(row.score)}</b></div>`).join('');
 overlay(`<section class="account-team-board"><div class="eyebrow">TABLEAU DE BORD · TEAM</div><h2 class="league-overlay-title">${safeText(info.name||'Ma team')}</h2><div class="cumulative-badge">${teamNumber(info.memberCount)} membre${Number(info.memberCount)>1?'s':''} · ${teamNumber(info.totalScore)} points cumulés</div><div class="team-leaderboard" aria-label="Classement de la team">${rows||'<p>Aucun score de team pour le moment.</p>'}</div><div class="tiny">Ton meilleur score est comparé à celui de chaque membre. La ligne surlignée indique ta position.</div><div class="menu-actions"><button class="primary" id="teamBoardBack">Retour au tableau de bord</button><button class="secondary" id="teamBoardRefresh">Actualiser</button></div></section>`);
 $('teamBoardBack').onclick=()=>window.Journey?.archives?.();$('teamBoardRefresh').onclick=async()=>{await loadTeam(true);openTeamBoard()};
}
function validTeamStats(value){
 if(!value||typeof value!=='object'||!value.summary||typeof value.summary!=='object'||!Array.isArray(value.daily)||!Array.isArray(value.members)||!Array.isArray(value.runs))throw Error('Réponse de statistiques invalide.');
 if(value.highscores!==undefined&&!Array.isArray(value.highscores))throw Error('Réponse de highscores invalide.');
 return value;
}
function teamStatsDay(value){
 const raw=String(value||'').slice(0,10),date=new Date(raw+'T12:00:00');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||!Number.isFinite(date.getTime()))return 'Date inconnue';
 return date.toLocaleDateString('fr-FR',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
}
function teamStatsProgress(value){
 const progress=Math.max(0,Math.floor(Number(value)||0));
 if(!progress)return '—';
 const stage=Math.max(1,Math.min(5,Math.floor(progress/10)));
 const wave=Math.max(1,Math.min(5,progress-stage*10));
 const worldName=typeof worlds!=='undefined'&&worlds[stage-1]?.name?worlds[stage-1].name:'';
 return 'M'+stage+' · V'+wave+(worldName?' — '+worldName:'');
}
function teamStatsRunProgress(row){
 const stage=Math.max(1,Math.min(5,Math.floor(Number(row?.stage)||1)));
 const wave=Math.max(1,Math.min(5,Math.floor(Number(row?.wave)||1)));
 return teamStatsProgress(stage*10+wave);
}
function teamStatsMode(row){
 const mode=({free:'Aventure libre',ranked:'Partie classée',daily:'Défi du jour'})[row?.mode]||'Vol';
 const difficulty=({easy:'facile',normal:'normal',hard:'difficile'})[row?.difficulty];
 return mode+(difficulty?' · '+difficulty:'');
}
function teamStatsError(error){
 const message=String(error?.message||error||'Statistiques indisponibles.');
 if(message.includes('TEAM_ADMIN_REQUIRED'))return 'Seul le créateur de la team peut consulter ces statistiques.';
 return teamErrorMessage(error);
}
function teamStatsTable(kind,headers,rows,empty){
 if(!rows)return '<div class="team-stats-empty" data-stats-empty="'+kind+'">'+safeText(empty)+'</div>';
 return '<div class="team-stats-table-wrap" tabindex="0" role="region" aria-label="'+safeText(headers.join(' · '))+'"><table class="team-stats-table team-stats-'+kind+'"><thead><tr>'+headers.map(label=>'<th scope="col">'+safeText(label)+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function renderTeamStats(data){
 const allModes=data.activityScope==='classic-and-ranked';
 const card=(key,label,value,note,extra='')=>'<div class="team-stats-card'+extra+'"><span>'+safeText(label)+'</span><b data-stat="'+key+'">'+safeText(value)+'</b><small>'+safeText(note)+'</small></div>';
 const summaryHTML=()=>{
  const summary=data.summary,members=Array.isArray(data.members)?data.members:[];
  return `<div class="team-stats-summary" aria-label="Synthèse de la période">${card('games','Parties',teamNumber(summary.games),allModes?'tous les vols transmis':'vols comptabilisés')}${card('points','Points gagnés',teamNumber(summary.points),allModes?'classique + classée':'somme de tous les vols',' team-stats-points-card')}${card('bestScore','Meilleur score',teamNumber(summary.bestScore),'record d’un vol')}${card('bestProgress','Monde maximum',teamStatsProgress(summary.bestProgress),'monde et vague atteints',' team-stats-progress-card')}${card('activePlayers','Joueurs actifs',teamNumber(summary.activePlayers),'sur '+teamNumber(members.length)+' membre'+(members.length>1?'s':''))}</div>`;
 };
 const gameSplit=row=>allModes?`<small class="team-stats-mode-split">Classées ${teamNumber(row.rankedGames)} · Classiques ${teamNumber(row.freeGames)}</small>`:'';
 const pointSplit=row=>allModes?`<small class="team-stats-mode-split">Classés ${teamNumber(row.rankedPoints)} · Classiques ${teamNumber(row.freePoints)}</small>`:'';
 const tablesHTML=()=>{
  const dailyRows=data.daily.map(row=>`<tr class="team-stats-day"><td data-label="Date">${safeText(teamStatsDay(row.playedOn))}</td><td data-label="Parties">${teamNumber(row.games)}${gameSplit(row)}</td><td data-label="Monde atteint">${safeText(teamStatsProgress(row.bestProgress))}</td><td data-label="Points gagnés" class="team-stats-points">${teamNumber(row.points)}${pointSplit(row)}</td><td data-label="Record">${teamNumber(row.bestScore)}</td></tr>`).join('');
  const memberRows=data.members.map(row=>`<tr class="team-stats-member${row.isYou?' team-stats-you':''}"><td data-label="Membre"><b>${safeText(row.displayName||'Sorcière')}</b>${row.isAdmin?'<small class="team-role">ADMIN</small>':''}</td><td data-label="Parties">${teamNumber(row.games)}${gameSplit(row)}</td><td data-label="Monde atteint">${safeText(teamStatsProgress(row.bestProgress))}</td><td data-label="Points gagnés" class="team-stats-points">${teamNumber(row.points)}${pointSplit(row)}</td><td data-label="Record">${teamNumber(row.bestScore)}</td><td data-label="Dernier vol">${safeText(row.lastPlayedAt?teamDate(row.lastPlayedAt):'Aucun vol')}</td></tr>`).join('');
  const runRows=data.runs.map(row=>`<tr class="team-stats-run${row.isYou?' team-stats-you':''}"><td data-label="Date">${safeText(teamDate(row.playedAt)||teamStatsDay(row.playedOn))}</td><td data-label="Membre">${safeText(row.displayName||'Sorcière')}</td><td data-label="Monde atteint et mode">${safeText(teamStatsRunProgress(row))}<small>${safeText(teamStatsMode(row))}</small></td><td data-label="Points gagnés" class="team-stats-points">${teamNumber(row.score)}</td></tr>`).join('');
  return `<section class="team-stats-section"><h3>PARTIES ET POINTS PAR JOUR</h3>${teamStatsTable('daily',['Date','Parties','Monde atteint','Points gagnés','Record'],dailyRows,'Aucun vol comptabilisé sur cette période.')}</section><section class="team-stats-section"><h3>ACTIVITÉ PAR MEMBRE</h3>${teamStatsTable('members',['Membre','Parties','Monde atteint','Points gagnés','Record','Dernier vol'],memberRows,'Aucun membre dans la team.')}</section><section class="team-stats-section"><h3>DERNIERS VOLS COMPTABILISÉS</h3>${teamStatsTable('runs',['Date','Membre','Monde atteint et mode','Points gagnés'],runRows,'Aucun vol à afficher sur cette période.')}<p class="team-stats-limit">Les 50 vols les plus récents de la période sont affichés.</p></section>`;
 };
 const highscores=(Array.isArray(data.highscores)?data.highscores:(teamData.scores||[]).filter(row=>row.mode==='ranked')).slice(0,50);
 const highscoresHTML=highscores.length?`<section class="team-stats-section team-highscores-section"><h3>HIGHSCORES ACTUELS DE LA TEAM</h3><p class="team-stats-history-note">Highscores classés uniquement. Ils ne reconstituent ni le nombre de parties ni les points cumulés.</p><div class="team-highscore-list">${highscores.map(row=>`<div class="team-highscore-row${row.isYou?' team-stats-you':''}"><span><b>${safeText(row.displayName||'Sorcière')}</b><small>${safeText(teamStatsRunProgress(row))} · ${safeText(teamDate(row.updatedAt)||'Date non enregistrée')}</small></span><strong>${teamNumber(row.score)}</strong></div>`).join('')}</div></section>`:'';
 const summary=data.summary;
 const modeSection=allModes?`<section class="team-stats-section team-mode-activity"><h3>CLASSÉE OU CLASSIQUE ?</h3><p class="team-stats-history-note">Repère qui joue et qui pense à lancer une classée. Seules les classées alimentent le classement, le score total et les quotas de la team.</p>${teamStatsTable('modes',['Mode','Parties','Points','Record'],`<tr data-mode="ranked"><td data-label="Mode"><b>Classée</b></td><td data-label="Parties"><b data-mode-stat="ranked-games">${teamNumber(summary.rankedGames)}</b></td><td data-label="Points"><b data-mode-stat="ranked-points">${teamNumber(summary.rankedPoints)}</b></td><td data-label="Record">${teamNumber(summary.rankedBestScore)}</td></tr><tr data-mode="free"><td data-label="Mode"><b>Classique</b></td><td data-label="Parties"><b data-mode-stat="free-games">${teamNumber(summary.freeGames)}</b></td><td data-label="Points"><b data-mode-stat="free-points">${teamNumber(summary.freePoints)}</b></td><td data-label="Record">${teamNumber(summary.freeBestScore)}</td></tr>`,'Aucun vol sur cette période.')}</section>`:'';
 const heading=allModes?'ACTIVITÉ · CLASSIQUE + CLASSÉE':'STATISTIQUES DES PARTIES CLASSÉES';
 const explanation=allModes?'<b>Tous les vols transmis sont inclus.</b> Les points gagnés additionnent les parties classiques et classées pour mesurer l’activité ; les points classiques ne sont jamais ajoutés au score de la team.':'<b>Points gagnés</b> = somme des scores de tous les vols comptabilisés, pas seulement des highscores. Les vols refusés par les règles, les parties classiques et les données locales non transmises sont exclus.';
 const mainBlock=`<div class="team-stats-mode-label">${heading}</div>${summaryHTML()}<p class="team-stats-explanation">${explanation}</p>${modeSection}`;
 const emptyNote=allModes&&!Number(summary.games)&&highscores.length?'<p class="team-stats-history-note team-stats-zero-note">Aucun vol transmis sur cette période. Les highscores actuels restent visibles.</p>':'';
 return emptyNote+(Number(summary.games)>0?mainBlock+highscoresHTML+tablesHTML():highscoresHTML+mainBlock+tablesHTML());
}

async function openTeamStats(){
 if(!enabled||!session||!teamData.team?.isAdmin)return;
 if(![7,30,90,365].includes(teamStatsDays))teamStatsDays=30;
 const info=teamData.team,epoch=++teamStatsEpoch;
 const option=days=>`<option value="${days}"${teamStatsDays===days?' selected':''}>${days} jours</option>`;
 overlay(`<section class="account-team-stats" aria-label="Statistiques privées de la team"><button class="secondary team-stats-back" id="teamStatsBack">← Compte & team</button><header class="team-stats-header"><div class="eyebrow">STATISTIQUES · CRÉATEUR DE LA TEAM</div><h2 class="league-overlay-title">${safeText(info.name||'Ma team')}</h2><p>Suivi de l’activité des joueurs, réservé au créateur. Aucun identifiant de connexion n’est affiché.</p></header><div class="team-stats-toolbar"><label for="teamStatsDays">Période analysée<select id="teamStatsDays">${option(7)}${option(30)}${option(90)}${option(365)}</select></label><button class="secondary" id="teamStatsRefresh">Actualiser</button></div><div id="teamStatsContent"><div class="team-stats-loading" role="status">Chargement des statistiques de la team…</div></div></section>`);
 $('teamStatsBack').onclick=()=>{teamStatsEpoch++;window.Journey?.archives?.()};
 $('teamStatsDays').onchange=event=>{teamStatsDays=Number(event.target.value);openTeamStats()};
 $('teamStatsRefresh').onclick=openTeamStats;
 $('teamStatsRefresh').disabled=true;
 try{
  const data=validTeamStats(await request('/rest/v1/rpc/minuit_team_stats',{method:'POST',body:{p_days:teamStatsDays}}));
  if(epoch!==teamStatsEpoch||!$('teamStatsContent'))return;
  $('teamStatsContent').innerHTML=renderTeamStats(data);
 }catch(error){
  if(epoch!==teamStatsEpoch||!$('teamStatsContent'))return;
  $('teamStatsContent').innerHTML='<div class="team-stats-error" role="alert">'+safeText(teamStatsError(error))+'</div><div class="cloud-actions"><button class="secondary" id="teamStatsRetry">Réessayer</button></div>';
  $('teamStatsRetry').onclick=openTeamStats;
 }finally{
  if(epoch===teamStatsEpoch&&$('teamStatsRefresh'))$('teamStatsRefresh').disabled=false;
 }
}
async function finishTeamScore(value){if(!['ranked','free'].includes(value?.mode))return{skipped:true,reason:'untracked'};if(!enabled||!session)return{skipped:true};const result=await submitTeamScore(value);await loadTeam(true);return{team:teamData.team,scores:teamData.scores,result,skipped:!!result?.skipped}}
async function submitTeamScore(value){
 if(!['ranked','free'].includes(value?.mode))return{skipped:true,reason:'untracked'};
 if(!enabled||!session)return{skipped:true};
 if(!teamLoaded)await loadTeam(false);
 if(!teamData.team)return{skipped:true};
 const body={
  p_score:Math.max(0,Math.min(100000000,Math.floor(value.score)||0)),
  p_mode:['free','ranked'].includes(value.mode)?value.mode:'free',
  p_difficulty:['easy','normal','hard'].includes(value.difficulty)?value.difficulty:'normal',
  p_stage:Math.max(1,Math.min(5,Math.floor(value.stage)||1)),
  p_wave:Math.max(1,Math.min(5,Math.floor(value.wave)||1)),
  p_run_id:String(value.id||'').trim().slice(0,80)
 };
 let result;
 try{result=await request('/rest/v1/rpc/minuit_submit_team_score',{method:'POST',body})}
 catch(error){
  if(value.mode==='free'&&String(error?.message||'').includes('MODE_INVALID'))return{skipped:true,reason:'activity-unavailable'};
  if(String(error?.message||'').includes('NOT_IN_TEAM')){teamData=EMPTY_TEAM();teamLoaded=false}
  throw Error(teamErrorMessage(error));
 }
 teamLoaded=false;
 return result||{bestScore:body.p_score,improved:false,mode:body.p_mode,activityOnly:body.p_mode==='free'};
}
function validWeeklySprintState(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.scores))throw Error('Réponse du Sprint hebdomadaire invalide.');
 return{team:value.team&&typeof value.team==='object'?value.team:null,scores:value.scores,result:value.result&&typeof value.result==='object'?value.result:null,skipped:!!value.skipped};
}
async function weeklySprintBoard(week){
 if(!enabled||!session)return{skipped:true,team:null,scores:[]};
 try{return validWeeklySprintState(await request('/rest/v1/rpc/minuit_weekly_sprint_board',{method:'POST',body:{p_week:String(week)}}))}
 catch(error){if(String(error?.message||'').includes('NOT_IN_TEAM'))return{skipped:true,team:null,scores:[]};throw Error(teamErrorMessage(error))}
}
async function submitWeeklySprint(value){
 if(!enabled||!session)return{skipped:true,team:null,scores:[]};
 const body={
  p_week:String(value.week||''),
  p_run_id:String(value.runId||'').trim().slice(0,80),
  p_score:Math.max(0,Math.min(100000000,Math.floor(value.score)||0)),
  p_time_seconds:Math.max(0,Math.min(7200,Math.floor(value.time)||0)),
  p_wave:Math.max(1,Math.min(3,Math.floor(value.wave)||1)),
  p_won:!!value.won
 };
 try{return validWeeklySprintState(await request('/rest/v1/rpc/minuit_submit_weekly_sprint',{method:'POST',body}))}
 catch(error){if(String(error?.message||'').includes('NOT_IN_TEAM'))return{skipped:true,team:null,scores:[]};throw Error(teamErrorMessage(error))}
}

function renderPanel(target=mount){
 if(target)mount=target;
 if(!mount||!mount.isConnected)return;
 if(!enabled){
  mount.innerHTML='<section class="cloud-card"><h3>☁ SAUVEGARDE EN LIGNE</h3><p>Cloud non configuré. La sauvegarde locale et l’export JSON restent pleinement disponibles.</p></section>';
  return;
 }
 if(!session){
  const invited=!!pendingTeamCode;
  mount.innerHTML=`<section class="cloud-card${invited?' team-invite-access':''}"${invited?' id="teamInviteCard"':''}>${invited?`<div class="team-invite-badge">INVITATION À REJOINDRE UNE TEAM</div><div class="team-invite-callout"><span>CODE DE L’INVITATION</span><b>${safeText(formatTeamCode(pendingTeamCode))}</b></div>`:''}<h3>${invited?'PSEUDO + MOT DE PASSE, PUIS TU JOUES AVEC EUX':'ACCÈS EN LIGNE'}</h3><p>${invited?'Crée simplement ton accès avec un pseudo et un mot de passe : tu rejoindras la team juste après, sans adresse e-mail.':'Un pseudo et un mot de passe suffisent pour la sauvegarde et les teams. Le jeu local reste disponible sans accès.'}</p><label>Pseudo<input id="cloudPseudo" type="text" autocomplete="username" minlength="2" maxlength="24" placeholder="Ex. : Sorcière agile"></label><label>Mot de passe<input id="cloudPseudoPassword" type="password" autocomplete="current-password" maxlength="128"></label><div class="cloud-actions"><button class="secondary" id="cloudPseudoLogin">${invited?'Me connecter et rejoindre':'Se connecter'}</button><button class="${invited?'primary':'secondary'}" id="cloudPseudoRegister">${invited?'Créer mon accès et rejoindre':'Créer mon accès'}</button></div><details class="cloud-email-access"><summary>Utiliser une adresse e-mail (optionnel)</summary><label>E-mail<input id="cloudEmail" type="email" autocomplete="email" maxlength="180"></label><label>Mot de passe<input id="cloudPassword" type="password" autocomplete="current-password" maxlength="128"></label><div class="cloud-actions"><button class="secondary" id="cloudLogin">Se connecter avec e-mail</button><button class="secondary" id="cloudRegister">Créer un compte e-mail</button><button class="secondary" id="cloudResend">Renvoyer la confirmation</button></div></details><div class="cloud-status" id="cloudStatus" role="status">Le mot de passe n’est jamais enregistré par le jeu. Sans e-mail, conserve-le soigneusement : aucune récupération par message.</div>${invited?'<div class="cloud-actions"><button class="team-invite-dismiss" id="teamInviteDismiss" type="button">Ignorer cette invitation</button></div>':''}</section>`;
  document.getElementById('cloudPseudoLogin').onclick=()=>authenticatePseudo(false);
  document.getElementById('cloudPseudoRegister').onclick=()=>authenticatePseudo(true);
  document.getElementById('cloudPseudoPassword').addEventListener('keydown',event=>{if(event.key==='Enter')authenticatePseudo(false)});
  document.getElementById('cloudLogin').onclick=()=>authenticate(false);
  document.getElementById('cloudRegister').onclick=()=>authenticate(true);
  document.getElementById('cloudResend').onclick=resendConfirmation;
  if(invited){
   document.getElementById('teamInviteDismiss').onclick=()=>{clearPendingTeamCode();renderPanel()};
   requestAnimationFrame(()=>document.getElementById('teamInviteCard')?.scrollIntoView({block:'nearest'}));
  }
  return;
 }
 const identity=session.user.displayName||session.user.email||'accès en ligne',identityLabel=session.user.displayName?'Pseudo':'Compte';
 mount.innerHTML=`<section class="cloud-card"><h3>☁ SAUVEGARDE EN LIGNE</h3><p>${identityLabel} : <b>${safeText(identity)}</b><br>Un emplacement cloud par accès ; le dernier envoi remplace le précédent.</p><div class="cloud-actions"><button class="secondary" id="cloudSync">Envoyer ma progression</button><button class="secondary" id="cloudRestore">Récupérer le cloud</button><button class="secondary" id="cloudLogout">Déconnecter</button></div><div class="cloud-status" id="cloudStatus" role="status">${auto?'Synchronisation automatique activée après chaque changement.':'Premier envoi manuel, puis synchronisation automatique.'}</div></section><section class="cloud-card team-card" id="teamCard"></section>`;
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
.cloud-card .cloud-actions .primary{padding:11px 14px;font-size:11px}
.team-invite-access{border-color:#d6ae6d99;background:linear-gradient(145deg,#2d2438,#172436);box-shadow:0 12px 35px #09061255}
.team-invite-badge{margin-bottom:10px;color:#ffd18e;font-size:9px;font-weight:700;letter-spacing:1.2px}
.team-invite-callout{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0;padding:10px 12px;border:1px dashed #d9b77399;border-radius:8px;background:#33284088}
.team-invite-callout span{color:#c6b6d2;font-size:8px;letter-spacing:1px}
.team-invite-callout b{color:#ffe0a0;font:700 15px ui-monospace,monospace;letter-spacing:2px;white-space:nowrap}
.cloud-email-access{margin-top:13px;padding-top:10px;border-top:1px solid #ffffff12}
.cloud-email-access summary{cursor:pointer;color:#aebdD2;font-size:10px;line-height:1.6}
.cloud-email-access[open] summary{margin-bottom:10px}
.team-create-alternative{margin-top:12px;padding-top:9px;border-top:1px solid #ffffff12}
.team-create-alternative summary{cursor:pointer;color:#b7a8c5;font-size:10px}
.team-create-alternative[open] summary{margin-bottom:10px}
.team-invite-dismiss{padding:6px 0;border:0;background:transparent;color:#aa9bb8;font-size:9px;text-decoration:underline}
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
.home-account-access.home-account-welcome{border-color:#79b99a99;background:linear-gradient(110deg,#263d37,#211a31)}
.home-account-access.home-account-welcome b{color:#b9edcf}.home-account-access.home-account-welcome small{color:#c4d8ca}
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
.team-campaign-reset{margin:12px 0;padding:12px;border:1px solid #a65e5e66;border-radius:8px;background:#351d2a88}.team-campaign-reset>b{display:block;color:#f0afa8;font-size:10px;letter-spacing:.8px}.team-campaign-reset>p{margin:7px 0;color:#d5c3d5;font-size:10px;line-height:1.6}.team-campaign-reset .cloud-actions button{flex:1 1 100%;min-height:44px;line-height:1.4}.team-campaign-reset .cloud-status:empty{display:none}
.team-role{margin-left:7px;color:#ffd08e!important;font-size:7px!important;letter-spacing:1px}
.account-team-board{width:min(720px,100%);margin:0 auto;text-align:center}.account-team-board .team-leaderboard{width:100%;margin:14px 0;max-height:min(420px,50vh)}.account-team-board .tiny{display:block;margin:8px 0}.account-team-board .menu-actions{margin-top:auto;padding-top:12px}
@media(max-width:850px){.account-team-board{display:flex;flex-direction:column}.account-team-board .menu-actions button{min-height:42px}}
.team-stats-access button{flex:1 1 100%;border-color:#b8996688;color:#ffe0ae}
.overlay:has(.account-team-stats){justify-content:flex-start}
.account-team-stats{width:min(1080px,100%);min-width:0;margin:0 auto;text-align:left}
.team-stats-back{margin-bottom:12px;padding:10px 14px}
.team-stats-header{display:block;height:auto;min-height:0;padding:0;border:0;background:none;box-shadow:none}
.account-team-stats .team-stats-header h2{margin:6px 0!important;font-size:clamp(26px,4vw,44px)!important}
.account-team-stats .team-stats-header p{max-width:720px;margin:0;font-size:11px;line-height:1.6;color:#b9a8c8}
.team-stats-toolbar{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:16px 0 12px;padding:11px 12px;border:1px solid #6e587755;border-radius:10px;background:#1b1527cc}
.team-stats-toolbar label{display:flex;flex-direction:column;gap:5px;color:#cbb8d7;font-size:10px}
.team-stats-toolbar select{min-width:150px;padding:9px 30px 9px 10px;border:1px solid #80678d;border-radius:7px;background:#251c32;color:#f1e5f7;font:11px Arial}
.team-stats-toolbar button{padding:10px 15px}
#teamStatsContent{width:100%;min-width:0}
.team-stats-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;width:100%}
.team-stats-card{min-width:0;padding:13px 11px;border:1px solid #80658755;border-radius:10px;background:linear-gradient(145deg,#2b2039dd,#1a1527dd)}
.team-stats-card>span{display:block;color:#bca9ca;font-size:8px;letter-spacing:1px;text-transform:uppercase}
.team-stats-card>b{display:block;margin:7px 0 4px;color:#ffd08e;font-size:24px;line-height:1.15;overflow-wrap:anywhere}
.team-stats-card>small{display:block;margin:0;color:#a99ab7;font-size:8px;line-height:1.45;letter-spacing:0}
.team-stats-card.team-stats-progress-card>b{font-size:13px;line-height:1.5}
.account-team-stats .team-stats-explanation{max-width:none;margin:10px 0 14px;padding:10px 12px;border-left:2px solid #bd925c;background:#2a203733;color:#bcaac8;font-size:10px;line-height:1.6}
.team-stats-explanation b{color:#ead1ad}
.team-stats-section{margin:12px 0;padding:12px;border:1px solid #6e587744;border-radius:10px;background:#17122099}
.team-stats-section h3{margin:0 0 10px;color:#d9bb92;font-size:10px;letter-spacing:1px}
.team-stats-table-wrap{width:100%;max-width:100%;overflow-x:auto;border:1px solid #6d5a7c44;border-radius:8px}
.team-stats-table{width:100%;min-width:660px;border-collapse:collapse;font-size:10px;line-height:1.5}
.team-stats-table th{padding:9px 10px;background:#291f36;color:#bba7c8;font-size:8px;letter-spacing:.7px;text-align:left;white-space:nowrap}
.team-stats-table td{padding:10px;border-top:1px solid #ffffff0b;color:#d8c8df;vertical-align:top}
.team-stats-table td.team-stats-points{color:#ffd08e;font-weight:700;white-space:nowrap}
.team-stats-table td>small{display:block;margin:4px 0 0;color:#9f8ead;font-size:8px;letter-spacing:0}
.team-stats-table tr.team-stats-you{background:#7c583b18}
.team-stats-empty,.team-stats-loading,.team-stats-error{padding:22px 14px;border:1px dashed #79638466;border-radius:8px;color:#b9a8c5;font-size:11px;line-height:1.6;text-align:center}
.team-stats-error{border-color:#b56e6e88;color:#efb4b4}
.account-team-stats .team-stats-limit{max-width:none;margin:8px 0 0;color:#94849f;font-size:9px;line-height:1.5}
.team-stats-mode-label{margin:16px 0 8px;color:#d9bb92;font-size:10px;font-weight:700;letter-spacing:1.1px}
.team-stats-history-note{max-width:none;margin:8px 0 12px;padding:10px 12px;border-left:2px solid #a98bc1;background:#2a203733;color:#c8b7d3;font-size:10px;line-height:1.6}
.team-stats-zero-note{border-left-color:#d3a86c;color:#ead1ad}
.team-highscore-list{display:grid;gap:6px}
.team-highscore-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid #6d5a7c44;border-radius:8px;background:#1c1629}
.team-highscore-row>span{min-width:0;text-align:left}
.team-highscore-row b{display:block;color:#e2d1e8;font-size:11px;overflow-wrap:anywhere}
.team-highscore-row small{display:block;margin-top:4px;color:#a99ab7;font-size:9px;line-height:1.45}
.team-highscore-row strong{flex-shrink:0;color:#ffd08e;font-size:19px}
.team-mode-activity{border-color:#9b7bb066;background:linear-gradient(145deg,#261d3399,#17122099)}
.team-stats-modes{min-width:0;font-size:9px}
.team-stats-modes th,.team-stats-modes td{padding:8px 6px}
.team-stats-table td>small.team-stats-mode-split{margin-top:5px;color:#b8a4c7;font-size:8px;line-height:1.5;white-space:nowrap}
.team-stats-points .team-stats-mode-split{color:#b7a4c1;font-weight:400}
@media(max-width:850px){
 .account-team-stats{width:100%;min-height:100%}
 .team-stats-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 .team-stats-card{padding:11px 9px}
 .team-stats-card>b{font-size:21px}
 .team-stats-card.team-stats-progress-card>b{font-size:12px}
 .team-stats-section{padding:10px}
 .team-stats-toolbar{flex-wrap:wrap}
 .team-stats-toolbar label{flex:1 1 160px}
 .team-stats-toolbar select{width:100%}
}
@media(max-width:480px){.team-stats-toolbar button{width:100%}.team-stats-back{min-height:42px}}
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
css.textContent+=`
/* Sur téléphone, chaque ligne de statistiques devient une carte complète :
   toutes les valeurs restent visibles sans balayage horizontal du tableau. */
@media(max-width:600px){
 .team-stats-table-wrap{overflow:visible;border:0}
 .team-stats-table{display:block;min-width:0;font-size:11px}
 .team-stats-table thead{display:none}
 .team-stats-table tbody{display:grid;gap:8px}
 .team-stats-table tr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px;padding:11px;border:1px solid #6d5a7c44;border-radius:8px;background:#1c1629}
 .team-stats-table td{display:flex;min-width:0;flex-direction:column;gap:4px;padding:0;border:0;overflow-wrap:anywhere;font-size:11px;line-height:1.45}
 .team-stats-table td::before{content:attr(data-label);color:#a996ba;font-size:8px;letter-spacing:.7px;text-transform:uppercase}
 .team-stats-table td:first-child{grid-column:1/-1}
 .team-stats-members td:last-child,.team-stats-runs td:nth-child(2){grid-column:1/-1}
 .team-stats-table td>small{margin:0;font-size:9px}
}
`;
document.head.appendChild(css);

window.MinuitCloud={
 schedule,
 sync:()=>syncNow(),
 restore,
 submitFeedback,
 submitTeamScore,
 finishTeamScore,
 weeklySprintBoard,
 submitWeeklySprint,
 openTeamBoard,
 openTeamStats,
 renderPanel,
 refreshTeam:()=>loadTeam(true),
 get configured(){return enabled},
 get connected(){return!!session},
 get teamLoaded(){return teamLoaded},
 get inTeam(){return!!session&&!!teamData.team},
 get user(){return session?.user||null}
};
if(enabled&&session)window.useAccountPseudo?.();
if(enabled&&session&&auto)schedule();
if(enabled&&pendingTeamCode)setTimeout(()=>{document.getElementById('archives')?.click()},0);
})();
