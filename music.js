/* Boucles MP3 locales et arrivée du boss. Aucun service distant. */
(()=>{
'use strict';
const paths={menu:'audio/nuitsorc-loop.mp3',forest:'audio/forest.mp3',cemetery:'audio/cemetery.mp3',castle:'audio/castle.mp3',marsh:'audio/marsh.mp3',lanterns:'audio/lanterns.mp3'};
const bossArrivalPaths={forest:'audio/boss-forest.mp3',cemetery:'audio/boss-cemetery.mp3',castle:'audio/boss-castle.mp3',marsh:'audio/boss-marsh.mp3',lanterns:'audio/boss-lanterns.mp3'};
// Longueurs de composition avant encodage. LAME ajoute 1105 échantillons de
// délai et un bourrage final : ils sont exclus de la lecture et du raccord.
const samples={menu:4197935,forest:2638999,cemetery:2757879,castle:2791095,marsh:2566203,lanterns:2664286};
const baseRates={menu:1,forest:1,cemetery:.88,castle:1.02,marsh:.94,lanterns:1.08};
const encoderDelay=1105/44100;
class MinuitMusicPlayer{
 constructor(context,destination,effectsDestination=destination){
  this.context=context;this.destination=destination;this.effectsDestination=effectsDestination;
  this.sources={...paths,...Object.fromEntries(Object.entries(bossArrivalPaths).map(([id,url])=>['boss-'+id,url])),...(window.MinuitMusicData||{})};
  this.buffers=new Map();this.pending=new Map();this.failed=new Set();
  this.arrivalBuffers=new Map();this.arrivalPending=new Map();this.arrivalFailed=new Set();this.arrivalVoices=new Set();
  this.source=null;this.gain=null;this.buffer=null;this.current='';this.key='';this.loading='';this.version=0;this.boss=false;this.rate=1;
 }
 // Pendant le chargement, le lecteur garde la main afin que la synthèse de
 // secours ne se superpose pas au MP3. Elle ne reprend qu'après un vrai échec.
 claims(id){return this.key===id&&!this.failed.has(id)}
 sync(id,enabled,boss=false){
  const key=enabled?id:'';this.boss=!!boss;
  if(key!==this.key){
   this.key=key;const version=++this.version;
   if(!key){this.loading='';this.stop()}else this.prepare(id,version);
  }
  this.updateRate();
 }
 async prepare(id,version){
  this.loading=id;
  try{
   const buffer=await this.load(id);
   if(version!==this.version||this.key!==id)return;
   this.loading='';this.play(id,buffer);
  }catch{
   if(version!==this.version||this.key!==id)return;
   this.loading='';this.failed.add(id);this.stop();
  }
 }
 async load(id){
  if(this.buffers.has(id)){
   const buffer=this.buffers.get(id);this.buffers.delete(id);this.buffers.set(id,buffer);return buffer;
  }
  if(this.pending.has(id))return this.pending.get(id);
  const promise=(async()=>{
   const url=this.sources[id];if(!url)throw Error('Morceau inconnu : '+id);
   const response=await fetch(url);if(!response.ok)throw Error('MP3 indisponible : '+id);
   const bytes=await response.arrayBuffer(),buffer=await this.decode(bytes);
   if(buffer.numberOfChannels<2||!Number.isFinite(buffer.duration)||buffer.duration<10)throw Error('MP3 stéréo invalide : '+id);
   this.buffers.set(id,buffer);
   // Deux tampons stéréo au maximum : le morceau courant et le suivant.
   while(this.buffers.size>2){
    const oldest=[...this.buffers.keys()].find(key=>key!==id&&key!==this.current);
    if(oldest===undefined)break;this.buffers.delete(oldest);
   }
   return buffer;
  })();
  this.pending.set(id,promise);
  try{return await promise}finally{this.pending.delete(id)}
 }
 async loadArrival(id){
  const key='boss-'+id;
  if(this.arrivalBuffers.has(key))return this.arrivalBuffers.get(key);
  if(this.arrivalPending.has(key))return this.arrivalPending.get(key);
  const promise=(async()=>{
   const url=this.sources[key];if(!url)throw Error('Arrivée inconnue : '+id);
   const response=await fetch(url);if(!response.ok)throw Error('Son d’arrivée indisponible : '+id);
   const buffer=await this.decode(await response.arrayBuffer());
   if(buffer.numberOfChannels<2||buffer.duration<.2||buffer.duration>13)throw Error('Son d’arrivée invalide : '+id);
   this.arrivalBuffers.set(key,buffer);return buffer;
  })();
  this.arrivalPending.set(key,promise);
  try{return await promise}finally{this.arrivalPending.delete(key)}
 }
 playArrival(buffer,volume=.85){
  if(this.context.state!=='running')return;
  if(this.arrivalVoices.size>=4){const oldest=this.arrivalVoices.values().next().value;try{oldest?.stop()}catch{}}
  const source=this.context.createBufferSource(),gain=this.context.createGain(),start=this.context.currentTime;
  source.buffer=buffer;gain.gain.setValueAtTime(volume,start);source.connect(gain);gain.connect(this.effectsDestination);
  this.arrivalVoices.add(source);source.onended=()=>{this.arrivalVoices.delete(source);try{source.disconnect();gain.disconnect()}catch{}};
  source.start(start,Math.min(encoderDelay,Math.max(0,buffer.duration-.05)));
 }
 async bossArrival(id){
  const key=id||'forest';
  if(this.arrivalFailed.has(key)||this.context.state!=='running')return;
  try{
   const buffer=await this.loadArrival(key);if(this.context.state!=='running')return;
   if(this.gain){
    const param=this.gain.gain,now=this.context.currentTime;param.cancelScheduledValues(now);
    param.setValueAtTime(param.value,now);param.linearRampToValueAtTime(.45,now+.08);
    param.setValueAtTime(.45,now+1.9);param.linearRampToValueAtTime(1,now+2.45);
   }
   this.playArrival(buffer,key==='lanterns'?.72:.9);
  }catch{this.arrivalFailed.add(key)}
 }
 decode(bytes){
  return new Promise((resolve,reject)=>{
   let settled=false;
   const ok=value=>{if(!settled){settled=true;resolve(value)}},fail=error=>{if(!settled){settled=true;reject(error)}};
   try{const result=this.context.decodeAudioData(bytes,ok,fail);if(result?.then)result.then(ok,fail)}catch(error){fail(error)}
  });
 }
 play(id,buffer){
  const now=this.context.currentTime,old=this.source,oldGain=this.gain;
  const source=this.context.createBufferSource(),gain=this.context.createGain();
  const loopStart=encoderDelay,loopEnd=Math.min(buffer.duration,loopStart+samples[id]/44100);
  source.buffer=buffer;source.loop=true;source.loopStart=loopStart;source.loopEnd=loopEnd;
  gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.4);
  source.connect(gain);gain.connect(this.destination);source.start(now,loopStart);
  this.source=source;this.gain=gain;this.buffer=buffer;this.current=id;this.rate=0;this.updateRate();
  if(old)this.retire(old,oldGain,.4);
 }
 updateRate(){
  if(!this.source)return;
  const target=(baseRates[this.current]||1)*(this.boss?1.08:1);if(target===this.rate)return;this.rate=target;
  const param=this.source.playbackRate,now=this.context.currentTime;
  param.cancelScheduledValues(now);param.setTargetAtTime(target,now,.18);
 }
 retire(source,gain,fade=0){
  if(!source)return;
  const now=this.context.currentTime;
  try{
   gain?.gain.cancelScheduledValues(now);
   if(fade>0&&gain){gain.gain.setValueAtTime(gain.gain.value,now);gain.gain.linearRampToValueAtTime(0,now+fade)}
   source.onended=()=>{try{source.disconnect();gain?.disconnect()}catch{}};
   source.stop(now+fade+.01);
  }catch{try{source.disconnect();gain?.disconnect()}catch{}}
 }
 stop(){const source=this.source,gain=this.gain;this.source=null;this.gain=null;this.buffer=null;this.current='';this.rate=1;this.retire(source,gain)}
}
window.MinuitMusicPlayer=MinuitMusicPlayer;
window.MinuitMusicSources=paths;
window.MinuitBossArrivalSources=bossArrivalPaths;
})();
