/* Direction artistique animée de La Sixième Heure (monde 3).
   Même architecture que sequel-art.js : une silhouette SVG par forme, chargée
   dans window.MinuitArt, puis deux couches Canvas (derrière / devant) qui
   traduisent l'état réel du combat. Aucun asset distant, aucune hitbox touchée.
   Palette propre au monde 3 : cire, bronze patiné, sel, prune et obsidienne.
   Toutes les créatures sont vues STRICTEMENT DE DESSUS, comme la sorcière : tête
   au sud (elle descend vers le joueur), ailes, pattes et bras rayonnants. */
(()=>{
'use strict';
const foes=['wickWarden','waxCourier','bronzeCrow','crackedBell','saltWalker','printThief','wickPicker','hollowFlame','unnamedDigit','facelessEcho','shutterImp','waxMimic','snufferHand'];
const bosses=['veilleuse','sonneur','passeur','cueilleuse','chasseur'];
const kinds=new Set([...foes,...bosses]),bossKinds=new Set(bosses);
const reduceMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TAU=Math.PI*2;
window.MinuitArt=window.MinuitArt||{};

const defs=`<defs>
<linearGradient id="cloak3" x2=".75" y2="1"><stop stop-color="#8073a0"/><stop offset=".34" stop-color="#4a4068"/><stop offset=".72" stop-color="#372c55"/><stop offset="1" stop-color="#241d3a"/></linearGradient>
<linearGradient id="wax3" x2=".8" y2="1"><stop stop-color="#fff8e8"/><stop offset=".36" stop-color="#f0dcb6"/><stop offset=".72" stop-color="#b39a8c"/><stop offset="1" stop-color="#7a6a80"/></linearGradient>
<linearGradient id="bronze3" x2=".85" y2="1"><stop stop-color="#ffe9b8"/><stop offset=".26" stop-color="#cf9f5f"/><stop offset=".58" stop-color="#a87a52"/><stop offset=".82" stop-color="#d7ab72"/><stop offset="1" stop-color="#6a4f45"/></linearGradient>
<linearGradient id="patina3" x2=".8" y2="1"><stop stop-color="#e4f6ea"/><stop offset=".3" stop-color="#93c3ae"/><stop offset=".66" stop-color="#66a094"/><stop offset="1" stop-color="#3a645d"/></linearGradient>
<linearGradient id="salt3" x2=".8" y2="1"><stop stop-color="#ffffff"/><stop offset=".34" stop-color="#ece5d2"/><stop offset=".7" stop-color="#bdbcae"/><stop offset="1" stop-color="#767b83"/></linearGradient>
<linearGradient id="steel3" x2=".8" y2="1"><stop stop-color="#d8e8f1"/><stop offset=".3" stop-color="#8399a9"/><stop offset=".66" stop-color="#5d7183"/><stop offset="1" stop-color="#33414f"/></linearGradient>
<linearGradient id="night3" x2=".8" y2="1"><stop stop-color="#6b6099"/><stop offset=".42" stop-color="#3b3360"/><stop offset="1" stop-color="#1e1936"/></linearGradient>
<linearGradient id="gold3" x2=".85" y2="1"><stop stop-color="#fff5cc"/><stop offset=".28" stop-color="#dcbc7c"/><stop offset=".62" stop-color="#a9855a"/><stop offset="1" stop-color="#5e4c52"/></linearGradient>
<linearGradient id="glass3" x2=".8" y2="1"><stop stop-color="#fff6dd" stop-opacity=".82"/><stop offset=".34" stop-color="#d9c9a8" stop-opacity=".42"/><stop offset=".7" stop-color="#7a6b8c" stop-opacity=".38"/><stop offset="1" stop-color="#ffe9bd" stop-opacity=".6"/></linearGradient>
<linearGradient id="wood3" x2=".8" y2="1"><stop stop-color="#c79b6d"/><stop offset=".34" stop-color="#8a6f57"/><stop offset=".7" stop-color="#5a4636"/><stop offset="1" stop-color="#3a2c20"/></linearGradient>
<radialGradient id="ember3"><stop stop-color="#fffdf2"/><stop offset=".3" stop-color="#ffdc9a"/><stop offset=".66" stop-color="#e5854e"/><stop offset="1" stop-color="#8a3f55"/></radialGradient>
<radialGradient id="cold3"><stop stop-color="#f4fffa"/><stop offset=".34" stop-color="#cfeadb"/><stop offset=".7" stop-color="#6fa698"/><stop offset="1" stop-color="#2b4a4f"/></radialGradient>
<radialGradient id="L0 3"><stop stop-color="#312a4c"/><stop offset=".55" stop-color="#191434"/><stop offset="1" stop-color="#161230"/></radialGradient>
<pattern id="hatch3" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 0 L0 6" stroke="#fff4dc" stroke-opacity=".12" stroke-width="1"/></pattern>
<filter id="softglow3" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="2.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

function asset(id,body,boss=false){
 const image=new Image(),view=boss?'-70 -65 140 130':'-56 -48 112 96';
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" fill="none" stroke-linecap="round" stroke-linejoin="round">${defs}${body}</svg>`);
 window.MinuitArt[id]=image;
}

/* FORMES — toutes vues STRICTEMENT DE DESSUS, comme la sorcière sur son balai.
   Convention : la créature descend vers le joueur, donc sa tête est au SUD
   (+y) et ce qui traîne au NORD (-y). Les ailes, pattes et bras rayonnent.
   Chaque silhouette est différente : radiale, ailée, rampant ou insectoïde. */

/* Garde-mèche : candélabre vivant. Corps de cire vu du dessus, six bras
   rayonnants terminés par une flamme, dôme de verre au centre. */
asset('wickWarden',`
<ellipse cx="0" cy="4" rx="34" ry="30" fill="#0d0b18" opacity=".35"/>
<path d="M-28-12Q-40-18-44-8Q-46-2-40-2M28-12Q40-18 44-8Q46-2 40-2M-30 12Q-42 16-44 26Q-45 32-39 31M30 12Q42 16 44 26Q45 32 39 31" stroke="#4a4054" stroke-width="3.6"/>
<path d="M-28-12Q-40-18-44-8M28-12Q40-18 44-8M-30 12Q-42 16-44 26M30 12Q42 16 44 26" stroke="#8d8496" stroke-width="1.4" stroke-opacity=".7"/>
<path d="M-47 -12 L-40 -12 L-40 -2 L-47 -2 Z M40 -12 L47 -12 L47 -2 L40 -2 Z M-47 21 L-40 21 L-40 31 L-47 31 Z M40 21 L47 21 L47 31 L40 31 Z" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<path d="M-43.5 -12 L-43.5 -16 M43.5 -12 L43.5 -16 M-43.5 21 L-43.5 17 M43.5 21 L43.5 17" stroke="#4a3b46" stroke-width="1.4"/>
<path d="M-13 34Q-17 44-11 47M13 34Q17 44 11 47" stroke="#4a4054" stroke-width="3.2"/>
<path d="M-15 40 L-7 40 L-7 49 L-15 49 Z M7 40 L15 40 L15 49 L7 49 Z" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<circle cx="0" cy="0" r="31" fill="#3a3244" stroke="#241d33" stroke-width="2"/>
<path d="M0-31A31 31 0 0 1 31 0A31 31 0 0 1 0 31A31 31 0 0 1-31 0A31 31 0 0 1 0-31Z" fill="url(#wax3)" fill-opacity=".22"/>
<path d="M-31 0Q-26-8-21 0Q-16-8-11 0M11 0Q16-8 21 0Q26-8 31 0" stroke="#6d5a63" stroke-opacity=".5" stroke-width="1.2"/>
<circle cx="0" cy="0" r="24" fill="url(#glass3)" stroke="#e8d6b0" stroke-width="1.8"/>
<circle cx="0" cy="0" r="24" fill="url(#void3)" opacity=".45"/>
<path d="M-24 0 L24 0 M0 -24 L0 24 M-17 -17 L17 17 M17 -17 L-17 17" stroke="#4a4054" stroke-width="1.6" stroke-opacity=".85"/>
<path d="M-16-13Q-20-4-16 5" stroke="#fff8e8" stroke-opacity=".5" stroke-width="2.2"/>
<circle cx="0" cy="0" r="11" fill="#241d33" stroke="#8d8496" stroke-width="1.4"/>
<path d="M-5 3Q0-9 5 3 3 9 0 9-3 9-5 3Z" fill="#f4c98f" fill-opacity=".9"/>
<path d="M-22 22Q-24 32-20 36M22 22Q24 32 20 36M0 30Q-2 38 2 42" stroke="#f0dcb6" stroke-opacity=".8" stroke-width="2.4"/>
<path d="M-9 20Q0 15 9 20 8 31 0 34-8 31-9 20Z" fill="url(#cloak3)" stroke="#a99cc4" stroke-width="1.4"/>
<ellipse cx="-3.4" cy="26" rx="1.8" ry="2.2" fill="#ffd9a0"/><ellipse cx="3.4" cy="26" rx="1.8" ry="2.2" fill="#ffd9a0"/>
<path d="M-26 30Q-34 34-33 41" stroke="#4a4054" stroke-width="2.6"/>
<path d="M-38 38 -28 38 -33 47Z" fill="#5d5468" stroke="#241d33" stroke-width="1.3"/>
<circle cx="-24" cy="-20" r="2" fill="#cf9f5f"/><circle cx="24" cy="-20" r="2" fill="#cf9f5f"/>
<circle cx="0" cy="0" r="31" fill="url(#hatch3)"/>`);

/* Facteur de cire : courrier-papillon. Ailes de papier ciré déployées, tête
   bougie au sud, sacoche sur le dos, rubans de cire qui traînent au nord. */
asset('waxCourier',`
<ellipse cx="0" cy="6" rx="30" ry="24" fill="#0d0b18" opacity=".32"/>
<path d="M-7-8Q-30-30-44-16Q-52 0-40 12Q-30 20-20 16Q-12 12-7 6Z" fill="url(#wax3)" stroke="#8d7a80" stroke-width="1.5"/>
<path d="M7-8Q30-30 44-16Q52 0 40 12Q30 20 20 16Q12 12 7 6Z" fill="url(#wax3)" stroke="#8d7a80" stroke-width="1.5"/>
<path d="M-40 12Q-36 18-31 15Q-28 21-23 17M40 12Q36 18 31 15Q28 21 23 17" fill="url(#wax3)" stroke="#8d7a80" stroke-width="1.2"/>
<path d="M-12-6Q-28-16-38-10M-12 2Q-26 2-34 8M12-6Q28-16 38-10M12 2Q26 2 34 8" stroke="#a1898f" stroke-opacity=".65" stroke-width="1.2"/>
<path d="M-30-9Q-27-3-31 2M30-9Q27-3 31 2" stroke="#b06a72" stroke-opacity=".7" stroke-width="1.4"/>
<path d="M-6-22Q-14-30-19-27M-16-28-19-32M-13-26-16-31M6-22Q14-30 19-27M16-28 19-32M13-26 16-31" stroke="#8d7a80" stroke-width="1.3"/>
<path d="M-9-22Q-13 0-9 18 0 28 9 18 13 0 9-22Z" fill="url(#cloak3)" stroke="#9a8ab4" stroke-width="1.6"/>
<path d="M-7 -30 L7 -30 L7 -14 L-7 -14 Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.4"/>
<path d="M-7-30Q-9-24-6-20M7-30Q9-24 6-20" stroke="#fff8e8" stroke-opacity=".7" stroke-width="1.6"/>
<path d="M0 -30 L0 -35" stroke="#4a3b46" stroke-width="1.6"/>
<path d="M-12-8 12-8 10 6-10 6Z" fill="#5a4636" stroke="#cf9f5f" stroke-width="1.4"/>
<path d="M-12-8 12-8 11-2-11-2Z" fill="#6d5540" stroke="#cf9f5f" stroke-width="1.1"/>
<path d="M4 0 12-2 13 5 5 6Z" fill="#f0dcb6" stroke="#8d7a80" stroke-width=".9"/>
<circle cx="0" cy="0" r="3.6" fill="#b06a72" stroke="#6d3f4e" stroke-width="1"/>
<path d="M-1.6-1 1.6 1M1.6-1-1.6 1" stroke="#f0dcb6" stroke-width=".8"/>
<path d="M-9 16Q0 11 9 16 8 28 0 31-8 28-9 16Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.4"/>
<circle cx="-3.4" cy="22" r="1.6" fill="#4b3a4a"/><circle cx="3.4" cy="22" r="1.6" fill="#4b3a4a"/>
<path d="M0 31 L0 36" stroke="#4a3b46" stroke-width="1.5"/>
<path d="M-9-22Q-13 0-9 18 0 28 9 18 13 0 9-22Z" fill="url(#hatch3)"/>`);

/* Corbeau de bronze : oiseau riveté vu du dessus, ailes déployées à plat,
   bec pointé vers le joueur, queue de tôles à l'arrière. */
asset('bronzeCrow',`
<ellipse cx="0" cy="2" rx="32" ry="22" fill="#0d0b18" opacity=".32"/>
<path d="M-8-8Q-32-22-48-6-42 8-24 12-12 12-8 4Z" fill="url(#patina3)" stroke="#22403f" stroke-width="1.6"/>
<path d="M8-8Q32-22 48-6 42 8 24 12 12 12 8 4Z" fill="url(#patina3)" stroke="#22403f" stroke-width="1.6"/>
<path d="M-40-6-26 0M-38 2-24 6M-32-12-22-4M40-6 26 0M38 2 24 6M32-12 22-4" stroke="#dff3e6" stroke-opacity=".45" stroke-width="1.2"/>
<path d="M-10-14-16-30 -6-26 0-34 6-26 16-30 10-14Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.4"/>
<path d="M-9-16Q-13 4-8 18 0 26 8 18 13 4 9-16Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.8"/>
<path d="M-6-10Q-9 4-5 14M6-10Q9 4 5 14" stroke="#fff0c4" stroke-opacity=".4" stroke-width="1.3"/>
<circle cx="-4" cy="-2" r="1.3" fill="#f6e2b0"/><circle cx="4" cy="6" r="1.3" fill="#f6e2b0"/><circle cx="0" cy="-10" r="1.3" fill="#f6e2b0"/>
<path d="M-7 16Q0 12 7 16 6 26 0 29 -6 26 -7 16Z" fill="url(#patina3)" stroke="#22403f" stroke-width="1.5"/>
<path d="M-4 27 0 38 4 27Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.2"/>
<circle cx="-4.5" cy="20" r="3.2" fill="#1d2b2e" stroke="url(#gold3)" stroke-width="1.2"/>
<circle cx="4.5" cy="20" r="3.2" fill="#1d2b2e" stroke="url(#gold3)" stroke-width="1.2"/>
<circle cx="-4.5" cy="20" r="1.2" fill="url(#cold3)"/><circle cx="4.5" cy="20" r="1.2" fill="url(#cold3)"/>
<path d="M-11 12-18 20M11 12 18 20" stroke="url(#bronze3)" stroke-width="2.2"/>
<path d="M-9-16Q-13 4-8 18 0 26 8 18 13 4 9-16Z" fill="url(#hatch3)"/>`);

/* Cloche fêlée : la cloche vue du dessus, cercles concentriques, fêlure
   traversante et quatre pattes-battants qui la font marcher. */
asset('crackedBell',`
<ellipse cx="0" cy="2" rx="32" ry="30" fill="#0d0b18" opacity=".35"/>
<path d="M-22-22Q-36-32-42-24M22-22Q36-32 42-24M-24 20Q-38 28-42 20M24 20Q38 28 42 20" stroke="url(#bronze3)" stroke-width="3.6"/>
<circle cx="-43" cy="-24" r="3.4" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1"/>
<circle cx="43" cy="-24" r="3.4" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1"/>
<circle cx="-43" cy="20" r="3.4" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1"/>
<circle cx="43" cy="20" r="3.4" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1"/>
<circle cx="0" cy="0" r="30" fill="url(#patina3)" stroke="#26403f" stroke-width="2"/>
<circle cx="0" cy="0" r="23" fill="none" stroke="#1f3a3a" stroke-opacity=".7" stroke-width="1.6"/>
<circle cx="0" cy="0" r="16" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.5"/>
<circle cx="0" cy="0" r="9" fill="#12262a" stroke="url(#gold3)" stroke-width="1.3"/>
<path d="M-2-30 3-16 -3-4 4 10 0 30" stroke="#16292b" stroke-width="3"/>
<path d="M-2-30 3-16 -3-4 4 10 0 30" stroke="url(#cold3)" stroke-width="1.1" stroke-opacity=".85"/>
<path d="M-20-16Q-10-24 2-26" stroke="#e6f7ec" stroke-opacity=".5" stroke-width="1.8"/>
<circle cx="-18" cy="10" r="1.5" fill="#f0e4bb"/><circle cx="17" cy="-8" r="1.5" fill="#f0e4bb"/><circle cx="10" cy="20" r="1.5" fill="#f0e4bb"/>
<circle cx="0" cy="0" r="4" fill="url(#cold3)" filter="url(#softglow3)"/>
<path d="M0-30 0-23M21-21 16-16M30 0 23 0M21 21 16 16M0 30 0 23M-21 21-16 16M-30 0-23 0M-21-21-16-16" stroke="#1f3a3a" stroke-opacity=".55" stroke-width="1.6"/>
<path d="M-30 0A30 30 0 0 1 30 0" fill="none" stroke="#e6f7ec" stroke-opacity=".22" stroke-width="2"/>
<circle cx="-27" cy="-13" r="1.8" fill="#cf9f5f"/><circle cx="27" cy="-13" r="1.8" fill="#cf9f5f"/><circle cx="-13" cy="27" r="1.8" fill="#cf9f5f"/><circle cx="13" cy="27" r="1.8" fill="#cf9f5f"/>
<circle cx="0" cy="0" r="30" fill="url(#hatch3)"/>`);

/* Marcheuse de sel : squelette de sel vu du dessus, crâne au sud, cage
   thoracique à plat, quatre pattes de cristal qui rayonnent. */
asset('saltWalker',`
<ellipse cx="0" cy="2" rx="28" ry="26" fill="#0d0b18" opacity=".3"/>
<path d="M-10-12Q-28-24-38-16M10-12Q28-24 38-16M-12 8Q-30 14-36 26M12 8Q30 14 36 26" stroke="url(#steel3)" stroke-width="3.6"/>
<path d="M-38-16-44-22M38-16 44-22M-36 26-42 32M36 26 42 32" stroke="url(#salt3)" stroke-width="2.6"/>
<path d="M0-30 8-18 6 6 0 16 -6 6 -8-18Z" fill="url(#salt3)" stroke="#6f757c" stroke-width="1.6"/>
<path d="M-6-14 6-14M-7-8 7-8M-6-2 6-2M-5 4 5 4" stroke="#7d838a" stroke-width="1.4"/>
<path d="M0-30 0 14" stroke="#9aa0a6" stroke-width="1.6"/>
<path d="M-14-20-20-28 -10-26ZM14-20 20-28 10-26Z" fill="#ffffff" fill-opacity=".8"/>
<path d="M-9 14Q0 10 9 14 10 28 0 33 -10 28 -9 14Z" fill="url(#salt3)" stroke="#6f757c" stroke-width="1.6"/>
<path d="M-6 20Q-3 17-1 20M6 20Q3 17 1 20" fill="#2b3138"/>
<ellipse cx="-4" cy="21" rx="2.6" ry="3" fill="#22282f"/><ellipse cx="4" cy="21" rx="2.6" ry="3" fill="#22282f"/>
<path d="M-3 28 3 28M-2 30 2 30" stroke="#5b6068" stroke-width="1.2"/>
<path d="M-16 2-20 8 -14 10ZM16 2 20 8 14 10Z" fill="#ffffff" fill-opacity=".7"/>
<path d="M0-30 8-18 6 6 0 16 -6 6 -8-18Z" fill="url(#hatch3)"/>
<path d="M-12-16-18-20-13-24ZM12-16 18-20 13-24Z" fill="#ffffff" fill-opacity=".75" stroke="#9aa0a6" stroke-width=".8"/>
<circle cx="-11" cy="-12" r="2.4" fill="#ece5d2" stroke="#6f757c" stroke-width="1"/><circle cx="11" cy="-12" r="2.4" fill="#ece5d2" stroke="#6f757c" stroke-width="1"/>
<circle cx="-3" cy="-20" r="1.4" fill="#ffffff" fill-opacity=".85"/><circle cx="3" cy="-6" r="1.4" fill="#ffffff" fill-opacity=".8"/><circle cx="-2" cy="6" r="1.2" fill="#ffffff" fill-opacity=".75"/>`);

/* Voleuse d’empreintes : gobeline accroupie vue du dessus, dos voûté, deux
   bras griffus vers l'avant, pieds nus derrière, sacoche de pas volés. */
asset('printThief',`
<ellipse cx="0" cy="2" rx="26" ry="24" fill="#0d0b18" opacity=".32"/>
<path d="M-12-14Q-22-26-16-34-8-32-8-22ZM12-14Q22-26 16-34 8-32 8-22Z" fill="url(#salt3)" stroke="#7d838a" stroke-width="1.3"/>
<path d="M-15-18-19-26M15-18 19-26" stroke="#e8dcc0" stroke-width="1.6"/>
<path d="M-16-16Q-22 4-14 20 0 28 14 20 22 4 16-16Q0-24-16-16Z" fill="url(#cloak3)" stroke="#9a8ab4" stroke-width="1.6"/>
<path d="M0-20Q-6 0 0 24" stroke="#b9a7c9" stroke-opacity=".45" stroke-width="1.4"/>
<path d="M-14-6Q-26 2-28 14M14-6Q26 2 28 14" stroke="url(#cloak3)" stroke-width="4"/>
<path d="M-28 14-34 20M-28 14-26 22M-28 14-20 20M28 14 34 20M28 14 26 22M28 14 20 20" stroke="url(#salt3)" stroke-width="2"/>
<path d="M14-14 26-18 30-6 18-2Z" fill="#3d3450" stroke="url(#salt3)" stroke-width="1.4"/>
<ellipse cx="23" cy="-10" rx="2.4" ry="3.2" fill="#e8dcc0" fill-opacity=".85"/>
<path d="M-10 16Q0 10 10 16 9 28 0 31 -9 28 -10 16Z" fill="url(#night3)" stroke="#a99cc4" stroke-width="1.5"/>
<path d="M-10 18-16 14 -12 22ZM10 18 16 14 12 22Z" fill="url(#night3)" stroke="#a99cc4" stroke-width="1.2"/>
<ellipse cx="-4" cy="22" rx="2.4" ry="2.8" fill="url(#cold3)"/><ellipse cx="4" cy="22" rx="2.4" ry="2.8" fill="url(#cold3)"/>
<path d="M-3 28-1 30 1 28 3 30" stroke="#e8dcc0" stroke-width="1.2"/>
<path d="M-16-16Q-22 4-14 20 0 28 14 20 22 4 16-16Q0-24-16-16Z" fill="url(#hatch3)"/>
<path d="M18-14Q22-10 19-6M22-15Q27-10 23-4" stroke="#e8dcc0" stroke-opacity=".7" stroke-width="1"/>
<path d="M-13 6 13 6 12 11 -12 11Z" fill="#463a55" stroke="#cf9f5f" stroke-width="1.2"/>
<circle cx="-7" cy="8.5" r="1.8" fill="#e8dcc0" fill-opacity=".8"/><circle cx="0" cy="8.5" r="1.8" fill="#e8dcc0" fill-opacity=".8"/><circle cx="7" cy="8.5" r="1.8" fill="#e8dcc0" fill-opacity=".8"/>`);

/* Cueilleuse de mèches : araignée-moissonneuse. Abdomen-panier au nord,
   céphalothorax au sud, six pattes et deux bras-éteignoirs vers l'avant. */
asset('wickPicker',`
<ellipse cx="0" cy="0" rx="30" ry="26" fill="#0d0b18" opacity=".32"/>
<path d="M-8-4Q-26-14-38-8M-9 2Q-28 2-40 10M-8 8Q-24 16-32 26M8-4Q26-14 38-8M9 2Q28 2 40 10M8 8Q24 16 32 26" stroke="url(#cloak3)" stroke-width="3"/>
<path d="M-38-8-44-12M-40 10-47 12M-32 26-36 33M38-8 44-12M40 10 47 12M32 26 36 33" stroke="#8d7a80" stroke-width="2"/>
<ellipse cx="0" cy="-14" rx="17" ry="15" fill="#4a3d55" stroke="url(#wax3)" stroke-width="1.7"/>
<path d="M-12-20 -12-28M-4-22 -4-31M4-22 4-31M12-20 12-28" stroke="url(#wax3)" stroke-width="2"/>
<circle cx="-12" cy="-29" r="2.2" fill="url(#ember3)"/><circle cx="-4" cy="-32" r="2.2" fill="url(#ember3)"/>
<circle cx="4" cy="-32" r="2.2" fill="url(#ember3)"/><circle cx="12" cy="-29" r="2.2" fill="url(#ember3)"/>
<path d="M-13-14Q0-8 13-14" stroke="url(#wax3)" stroke-opacity=".6" stroke-width="1.3"/>
<path d="M-10 2Q0-4 10 2 11 16 0 21 -11 16 -10 2Z" fill="url(#night3)" stroke="#ab9ec6" stroke-width="1.6"/>
<path d="M-9 12Q-20 22-22 32M9 12Q20 22 22 32" stroke="url(#bronze3)" stroke-width="2.8"/>
<path d="M-26 32Q-18 28-16 36-24 40-26 32ZM26 32Q18 28 16 36 24 40 26 32Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.2"/>
<ellipse cx="-4" cy="10" rx="2.2" ry="2.6" fill="url(#ember3)"/><ellipse cx="4" cy="10" rx="2.2" ry="2.6" fill="url(#ember3)"/>
<ellipse cx="-7" cy="5" rx="1.4" ry="1.6" fill="url(#ember3)"/><ellipse cx="7" cy="5" rx="1.4" ry="1.6" fill="url(#ember3)"/>
<path d="M-3 18-5 23M3 18 5 23" stroke="#f0dcb6" stroke-width="1.6"/>
<ellipse cx="0" cy="-14" rx="17" ry="15" fill="url(#hatch3)"/>`);

/* Flamme creuse : lanterne hexagonale vue du dessus, armature de fer
   rayonnante, verre vide et flamme au centre, anneau et chaîne au nord. */
asset('hollowFlame',`
<ellipse cx="0" cy="0" rx="31" ry="31" fill="#0d0b18" opacity=".32"/>
<g transform="scale(1.2)">
<path d="M0-26 0-32" stroke="#cf9f5f" stroke-width="2.4"/>
<circle cx="0" cy="-36" r="4" fill="none" stroke="url(#bronze3)" stroke-width="2"/>
<path d="M0-24 21-12 21 12 0 24 -21 12 -21-12Z" fill="url(#glass3)" stroke="#e8d6b0" stroke-width="1.8"/>
<path d="M0-24 21-12 21 12 0 24 -21 12 -21-12Z" fill="url(#void3)" opacity=".55"/>
<path d="M0-24 0 24M-21-12 21 12M21-12-21 12" stroke="url(#bronze3)" stroke-width="1.8" stroke-opacity=".85"/>
<path d="M0-18 16-9 16 9 0 18 -16 9 -16-9Z" fill="none" stroke="#fff6dd" stroke-opacity=".35" stroke-width="1.2"/>
<path d="M-14-8Q-17 0-14 8" stroke="#fff6dd" stroke-opacity=".45" stroke-width="1.6"/>
<circle cx="0" cy="0" r="10" fill="url(#void3)" stroke="#6d5a7d" stroke-width="1.2"/>
<path d="M-5 2Q0-7 5 2 3 8 0 8 -3 8 -5 2Z" fill="none" stroke="#f4c98f" stroke-opacity=".75" stroke-width="1.5"/>
<circle cx="0" cy="2" r="1.8" fill="#f4c98f" fill-opacity=".55"/>
<circle cx="-21" cy="-12" r="2.4" fill="url(#bronze3)"/><circle cx="21" cy="-12" r="2.4" fill="url(#bronze3)"/>
<circle cx="-21" cy="12" r="2.4" fill="url(#bronze3)"/><circle cx="21" cy="12" r="2.4" fill="url(#bronze3)"/>
<circle cx="0" cy="-24" r="2.4" fill="url(#bronze3)"/><circle cx="0" cy="24" r="2.4" fill="url(#bronze3)"/>
<path d="M0-24 21-12 21 12 0 24 -21 12 -21-12Z" fill="url(#hatch3)"/>
</g>
`);

/* Chiffre sans nom : anneau-cadran flottant vu du dessus, zéro évidé, deux
   bras d'os et des lambeaux qui traînent. Le chiffre est écrit par le jeu. */
asset('unnamedDigit',`
<ellipse cx="0" cy="0" rx="30" ry="28" fill="#0d0b18" opacity=".32"/>
<path d="M-10-24Q-14-36-8-42M10-24Q14-36 8-42M0-26 0-44" stroke="url(#gold3)" stroke-width="1.8" stroke-opacity=".6"/>
<path d="M-24-8Q-38-4-42 8M24-8Q38-4 42 8" stroke="url(#night3)" stroke-width="4"/>
<path d="M-42 8-48 4M-42 8-48 12M-42 8-44 16M42 8 48 4M42 8 48 12M42 8 44 16" stroke="url(#gold3)" stroke-width="1.8"/>
<ellipse cx="0" cy="0" rx="26" ry="28" fill="url(#night3)" stroke="url(#gold3)" stroke-width="2.2"/>
<ellipse cx="0" cy="0" rx="15" ry="17" fill="url(#void3)" stroke="#6d5f84" stroke-width="1.5"/>
<path d="M0-28 0-22M26 0 20 0M0 28 0 22M-26 0-20 0" stroke="url(#gold3)" stroke-width="1.8"/>
<path d="M18-20 15-16M18 20 15 16M-18 20-15 16M-18-20-15-16" stroke="url(#gold3)" stroke-opacity=".7" stroke-width="1.4"/>
<path d="M0-17 0 17" stroke="#dcbc7c" stroke-opacity=".25" stroke-width="1"/>
<circle cx="0" cy="0" r="4" fill="url(#gold3)"/>
<path d="M0 0 8-8" stroke="#fff5cc" stroke-width="1.4"/>
<path d="M-12 22Q0 30 12 22" stroke="url(#gold3)" stroke-opacity=".5" stroke-width="1.3"/>
<ellipse cx="0" cy="0" rx="26" ry="28" fill="url(#hatch3)"/>
<path d="M-13-24-11-20M13-24 11-20M-24 10-20 8M24 10 20 8M-13 24-11 20M13 24 11 20" stroke="#dcbc7c" stroke-opacity=".8" stroke-width="1.3"/>
<path d="M-8 12 8 12 8 22 -8 22Z" fill="#161230" fill-opacity=".6" stroke="#6d5f84" stroke-width="1.1"/>
<path d="M-5 17 5 17" stroke="#dcbc7c" stroke-opacity=".5" stroke-width="1.2"/>
<circle cx="0" cy="-24" r="2" fill="#dcbc7c"/><circle cx="-22" cy="0" r="1.8" fill="#dcbc7c" fill-opacity=".8"/><circle cx="22" cy="0" r="1.8" fill="#dcbc7c" fill-opacity=".8"/>
<path d="M0 0-6 10" stroke="#fff5cc" stroke-opacity=".8" stroke-width="1.1"/>`);

/* Écho sans visage : ton propre double vu du dessus — même balai, même
   chapeau, mais sans traits et cerclé de pointillé. Lecture immédiate. */
asset('facelessEcho',`
<ellipse cx="0" cy="6" rx="22" ry="30" fill="#0d0b18" opacity=".3"/>
<path d="M-2.6 -42 L2.6 -42 L2.6 34 L-2.6 34 Z" fill="#6d5a63"/>
<path d="M-1.2 -42 L1.2 -42 L1.2 34 L-1.2 34 Z" fill="#a1898f" fill-opacity=".8"/>
<path d="M-9 26Q-15 34-11 43L-5 39 0 44 5 39 11 43Q15 34 9 26Z" fill="url(#wax3)" fill-opacity=".7" stroke="#8d7a80" stroke-width="1.2"/>
<path d="M-7 28-10 41M-2 28-3 42M2 28 3 42M7 28 10 41" stroke="#8d7a80" stroke-width="1.2"/>
<path d="M-15-6Q-23 12-17 27L-11 22-6 28 0 22 6 28 11 22 17 27Q23 12 15-6Z" fill="url(#cloak3)" fill-opacity=".92" stroke="#b9a7c9" stroke-width="1.5"/>
<path d="M-10 0Q-14 13-10 23M10 0Q14 13 10 23M0-2 L0 22" stroke="#b9a7c9" stroke-opacity=".45" stroke-width="1.3"/>
<path d="M-14 2-23 9M14 2 23 9" stroke="url(#cloak3)" stroke-width="3.4"/>
<path d="M-23 9-27 13M23 9 27 13" stroke="#b9a7c9" stroke-width="1.6"/>
<ellipse cx="0" cy="-11" rx="21" ry="14" fill="url(#night3)" stroke="#c0aed0" stroke-width="1.6"/>
<ellipse cx="0" cy="-12" rx="13" ry="8.5" fill="#2a2447" stroke="#a99cc4" stroke-width="1.2"/>
<path d="M-19-13Q0-20 19-13" stroke="url(#gold3)" stroke-width="2.2" stroke-opacity=".75"/>
<path d="M0-25Q-6-32-1-39 5-32 0-25Z" fill="url(#night3)" stroke="#b9a7c9" stroke-width="1.3"/>
<ellipse cx="0" cy="-11" rx="8.5" ry="6" fill="url(#salt3)" fill-opacity=".3"/>
<path d="M-4-13Q0-15 4-13" stroke="#d8c9e4" stroke-opacity=".5" stroke-width="1.1"/>
<circle cx="-19" cy="-19" r="1.6" fill="#b9a7c9" fill-opacity=".55"/><circle cx="19" cy="-17" r="1.4" fill="#b9a7c9" fill-opacity=".5"/>
<path d="M-15-6Q-23 12-17 27L-11 22-6 28 0 22 6 28 11 22 17 27Q23 12 15-6Z" fill="url(#hatch3)"/>`);

/* ---------------- GARDIENS : vues du dessus, silhouettes larges ---------- */

/* La Veilleuse : lustre-cathédrale vu du dessus. Cinq bras longs portent des
   coupelles, jupe de cire en disque dentelé, dôme central et chaînes. */
asset('veilleuse',`
<ellipse cx="0" cy="2" rx="52" ry="48" fill="#0d0b18" opacity=".38"/>
<path d="M0-52 0-62M-36-36-46-46M36-36 46-46" stroke="url(#bronze3)" stroke-width="2" stroke-opacity=".7"/>
<path d="M0-46 30-36 46-10 40 22 18 44 0 50 -18 44 -40 22 -46-10 -30-36Z" fill="url(#glass3)" stroke="#f0e2c0" stroke-width="1.8"/>
<path d="M0-46 30-36 46-10 40 22 18 44 0 50 -18 44 -40 22 -46-10 -30-36Z" fill="url(#void3)" opacity=".4"/>
<path d="M0-38 24-30 37-8 32 18 14 36 0 41 -14 36 -32 18 -37-8 -24-30Z" fill="none" stroke="#fff6dd" stroke-opacity=".3" stroke-width="1.4"/>
<path d="M-40 22Q-34 34-26 26Q-20 40-12 30Q-6 44 0 32Q6 44 12 30Q20 40 26 26Q34 34 40 22" stroke="url(#wax3)" stroke-width="3.4"/>
<path d="M0-6 0-44M0-6 42-18M0-6 26 40M0-6-26 40M0-6-42-18" stroke="url(#bronze3)" stroke-width="4"/>
<path d="M-8-48 8-48 6-38-6-38ZM36-24 50-20 46-10 34-14ZM20 36 32 42 26 50 16 44ZM-20 36-32 42-26 50-16 44ZM-36-24-50-20-46-10-34-14Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.4"/>
<circle cx="0" cy="-6" r="20" fill="url(#cloak3)" stroke="#a99cc4" stroke-width="1.8"/>
<circle cx="0" cy="-6" r="13" fill="url(#glass3)" stroke="#f2e4c4" stroke-width="1.5"/>
<circle cx="0" cy="-6" r="8" fill="url(#ember3)" opacity=".6" filter="url(#softglow3)"/>
<path d="M-9 12Q0 6 9 12 8 26 0 30 -8 26 -9 12Z" fill="url(#night3)" stroke="#b9accf" stroke-width="1.5"/>
<ellipse cx="-4" cy="19" rx="2.4" ry="3" fill="url(#ember3)"/><ellipse cx="4" cy="19" rx="2.4" ry="3" fill="url(#ember3)"/>
<path d="M-12 10Q0 2 12 10" stroke="url(#wax3)" stroke-width="2"/>
<path d="M0-46 30-36 46-10 40 22 18 44 0 50 -18 44 -40 22 -46-10 -30-36Z" fill="url(#hatch3)"/>
<circle cx="0" cy="-56" r="3" fill="none" stroke="#cf9f5f" stroke-width="1.6"/><circle cx="0" cy="-62" r="3" fill="none" stroke="#cf9f5f" stroke-width="1.4"/>
<ellipse cx="0" cy="-44" rx="7" ry="5" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<ellipse cx="42" cy="-16" rx="7" ry="5" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<ellipse cx="24" cy="43" rx="7" ry="5" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<ellipse cx="-24" cy="43" rx="7" ry="5" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<ellipse cx="-42" cy="-16" rx="7" ry="5" fill="url(#wax3)" stroke="#6d5a63" stroke-width="1.2"/>
<path d="M-30 30Q-32 40-28 44M30 30Q32 40 28 44" stroke="#f0dcb6" stroke-opacity=".8" stroke-width="2"/>
<path d="M-14-30Q0-24 14-30M-16 20Q0 26 16 20" stroke="#fff6dd" stroke-opacity=".35" stroke-width="1.2"/>`,true);

/* Le Sonneur sans battant : titan-cloche vu du dessus. Disque de bronze
   fêlé, deux bras musclés, marteau à droite, harnais de cordes rayonnant. */
asset('sonneur',`
<ellipse cx="0" cy="0" rx="50" ry="48" fill="#0d0b18" opacity=".38"/>
<path d="M-30-30-48-44M30-30 48-44M-40 10-58 14M40 10 58 14M0-42 0-60" stroke="url(#wax3)" stroke-width="2.2" stroke-opacity=".65"/>
<circle cx="0" cy="0" r="42" fill="url(#patina3)" stroke="#26403f" stroke-width="2.2"/>
<circle cx="0" cy="0" r="33" fill="none" stroke="#1f3a3a" stroke-opacity=".65" stroke-width="2"/>
<circle cx="0" cy="0" r="24" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.8"/>
<path d="M-4-42 4-24 -4-8 6 12 0 42" stroke="#16292b" stroke-width="3.6"/>
<path d="M-4-42 4-24 -4-8 6 12 0 42" stroke="url(#cold3)" stroke-width="1.2" stroke-opacity=".8"/>
<path d="M-28-24Q-14-36 4-38" stroke="#e6f7ec" stroke-opacity=".45" stroke-width="2.2"/>
<circle cx="-30" cy="14" r="2" fill="#f0e4bb"/><circle cx="28" cy="-14" r="2" fill="#f0e4bb"/><circle cx="14" cy="30" r="2" fill="#f0e4bb"/>
<path d="M-34 16Q-52 24-54 40M34 16Q52 20 56 4" stroke="url(#patina3)" stroke-width="6"/>
<path d="M-58 38Q-48 34-46 46-56 50-58 38Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.4"/>
<path d="M48-8 66-8 66 10 48 10Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.8"/>
<path d="M52-4 62-4M52 2 62 2M52 6 62 6" stroke="#3a2f3c" stroke-opacity=".55" stroke-width="1.2"/>
<circle cx="0" cy="0" r="14" fill="#12262a" stroke="url(#gold3)" stroke-width="1.6"/>
<ellipse cx="-5" cy="-2" rx="3" ry="3.6" fill="url(#cold3)"/><ellipse cx="5" cy="-2" rx="3" ry="3.6" fill="url(#cold3)"/>
<path d="M-5 7-2 10 1 7 4 10" stroke="#cfe6d8" stroke-width="1.4"/>
<path d="M0 14 0 22" stroke="#cf9f5f" stroke-width="2.4"/>
<circle cx="0" cy="26" r="5" fill="none" stroke="#8fa39b" stroke-opacity=".8" stroke-width="1.6"/>
<circle cx="0" cy="0" r="42" fill="url(#hatch3)"/>
<circle cx="-36" cy="-20" r="2.4" fill="#cf9f5f"/><circle cx="36" cy="-20" r="2.4" fill="#cf9f5f"/>
<circle cx="-24" cy="34" r="2.4" fill="#cf9f5f"/><circle cx="24" cy="34" r="2.4" fill="#cf9f5f"/>
<path d="M-16-40 16-40 12-32 -12-32Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.3"/>
<path d="M50-6 64-6" stroke="#f0dcb6" stroke-opacity=".6" stroke-width="1.4"/>`,true);

/* Le Passeur sans ombre : nocher squelette vu du dessus. Cape en ailes
   déchirées, crâne au sud, longue perche en travers, sablier sur le dos. */
asset('passeur',`
<path d="M-14-16Q-46-24-58 4-46 20-28 22-16 18-12 6Z" fill="url(#steel3)" stroke="#93a9b8" stroke-width="1.8"/>
<path d="M14-16Q46-24 58 4 46 20 28 22 16 18 12 6Z" fill="url(#steel3)" stroke="#93a9b8" stroke-width="1.8"/>
<path d="M-52 0-34 6M-48 10-32 12M-44-8-30-2M52 0 34 6M48 10 32 12M44-8 30-2" stroke="#cfe0ea" stroke-opacity=".35" stroke-width="1.3"/>
<path d="M-58 4-52 12-46 6-40 16-34 8M58 4 52 12 46 6 40 16 34 8" fill="none" stroke="#93a9b8" stroke-width="1.4"/>
<path d="M-40-46 44 40" stroke="url(#bronze3)" stroke-width="4"/>
<path d="M-46-52Q-36-60-30-50-40-42-46-52Z" fill="url(#salt3)" stroke="#6f757c" stroke-width="1.4"/>
<path d="M-13-30Q-18 0-12 22 0 32 12 22 18 0 13-30Q0-38-13-30Z" fill="url(#night3)" stroke="#a3b7c4" stroke-width="1.8"/>
<path d="M-11-24 11-24 4-6 11 12 -11 12 -4-6Z" fill="url(#glass3)" stroke="url(#salt3)" stroke-width="1.6"/>
<path d="M-8-22 8-22 2-8Z" fill="url(#salt3)" fill-opacity=".85"/>
<path d="M-7 10 7 10 0 0Z" fill="url(#salt3)" fill-opacity=".5"/>
<path d="M-13-26 13-26M-13 14 13 14" stroke="url(#bronze3)" stroke-width="2.2"/>
<path d="M-14 18Q-26 26-28 38M14 18Q26 26 28 38" stroke="url(#steel3)" stroke-width="4"/>
<path d="M-28 38-34 42M-28 38-26 46M28 38 34 42M28 38 26 46" stroke="url(#salt3)" stroke-width="2"/>
<path d="M-11 22Q0 16 11 22 12 40 0 45 -12 40 -11 22Z" fill="url(#salt3)" stroke="#6f757c" stroke-width="1.7"/>
<ellipse cx="-5" cy="31" rx="3.2" ry="4" fill="#1b2530"/><ellipse cx="5" cy="31" rx="3.2" ry="4" fill="#1b2530"/>
<path d="M0 36 0 39M-4 41 4 41M-3 43 3 43" stroke="#5b6068" stroke-width="1.3"/>
<path d="M-13-30Q-18 0-12 22 0 32 12 22 18 0 13-30Q0-38-13-30Z" fill="url(#hatch3)"/>
<ellipse cx="0" cy="8" rx="46" ry="30" fill="none" stroke="#cfe0ea" stroke-opacity=".16" stroke-width="1.4"/>
<circle cx="-5" cy="31" r="1.4" fill="#cfe6d8"/><circle cx="5" cy="31" r="1.4" fill="#cfe6d8"/>
<path d="M-44-50Q-38-54-34-49" stroke="#ffffff" stroke-opacity=".5" stroke-width="1.2"/>
<path d="M0-8 0 2" stroke="#f0dcb6" stroke-width="1.4"/>
<path d="M-13-16Q-20 4-14 20M13-16Q20 4 14 20" stroke="#a3b7c4" stroke-opacity=".4" stroke-width="1.3"/>
<circle cx="-13" cy="-24" r="2.6" fill="url(#bronze3)"/><circle cx="13" cy="-24" r="2.6" fill="url(#bronze3)"/>`,true);

/* La Cueilleuse de flammes : reine-araignée vue du dessus. Abdomen à trois
   lanternes, huit pattes, deux longs éteignoirs et mandibules. */
asset('cueilleuse',`
<ellipse cx="0" cy="-2" rx="52" ry="46" fill="#0d0b18" opacity=".38"/>
<path d="M-14-10Q-36-26-52-20M-16 0Q-40-4-56 6M-15 10Q-36 20-46 34M-12 18Q-26 32-30 46M14-10Q36-26 52-20M16 0Q40-4 56 6M15 10Q36 20 46 34M12 18Q26 32 30 46" stroke="url(#cloak3)" stroke-width="3.6"/>
<path d="M-52-20-60-26M-56 6-64 8M-46 34-52 42M-30 46-34 54M52-20 60-26M56 6 64 8M46 34 52 42M30 46 34 54" stroke="#8d7a80" stroke-width="2.4"/>
<ellipse cx="0" cy="-20" rx="28" ry="24" fill="#4a3d55" stroke="url(#wax3)" stroke-width="2"/>
<path d="M-20-26Q0-16 20-26M-22-16Q0-6 22-16" stroke="url(#wax3)" stroke-opacity=".5" stroke-width="1.4"/>
<circle cx="-15" cy="-26" r="7" fill="url(#glass3)" stroke="url(#bronze3)" stroke-width="1.5"/>
<circle cx="0" cy="-32" r="7" fill="url(#glass3)" stroke="url(#bronze3)" stroke-width="1.5"/>
<circle cx="15" cy="-26" r="7" fill="url(#glass3)" stroke="url(#bronze3)" stroke-width="1.5"/>
<path d="M-14 2Q0-6 14 2 16 22 0 28 -16 22 -14 2Z" fill="url(#night3)" stroke="#b9accf" stroke-width="1.8"/>
<path d="M-12 16Q-30 28-34 46M12 16Q30 28 34 46" stroke="url(#bronze3)" stroke-width="3.4"/>
<path d="M-40 46Q-28 40-26 52-38 58-40 46ZM40 46Q28 40 26 52 38 58 40 46Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.5"/>
<ellipse cx="-6" cy="12" rx="3" ry="3.6" fill="url(#ember3)"/><ellipse cx="6" cy="12" rx="3" ry="3.6" fill="url(#ember3)"/>
<ellipse cx="-10" cy="5" rx="2" ry="2.4" fill="url(#ember3)"/><ellipse cx="10" cy="5" rx="2" ry="2.4" fill="url(#ember3)"/>
<path d="M-5 25-9 33M5 25 9 33" stroke="#f0dcb6" stroke-width="2"/>
<ellipse cx="0" cy="-20" rx="28" ry="24" fill="url(#hatch3)"/>
<circle cx="-36" cy="-18" r="2.6" fill="#8d7a80"/><circle cx="36" cy="-18" r="2.6" fill="#8d7a80"/>
<circle cx="-40" cy="4" r="2.6" fill="#8d7a80"/><circle cx="40" cy="4" r="2.6" fill="#8d7a80"/>
<circle cx="-15" cy="-26" r="3.2" fill="url(#ember3)" fill-opacity=".85"/><circle cx="0" cy="-32" r="3.2" fill="url(#ember3)" fill-opacity=".85"/><circle cx="15" cy="-26" r="3.2" fill="url(#ember3)" fill-opacity=".85"/>
<path d="M-18-30Q0-22 18-30M-16-10Q0-2 16-10" stroke="#f0dcb6" stroke-opacity=".35" stroke-width="1.2"/>
<path d="M-20-4Q-30 10-26 26M20-4Q30 10 26 26" stroke="#f0dcb6" stroke-opacity=".25" stroke-width="1"/>
<path d="M-8 24Q-12 30-8 34M8 24Q12 30 8 34" stroke="#f0dcb6" stroke-width="1.6"/>`,true);

/* Le Chasseur sans visage : veneur vu du dessus. Large ramure, manteau
   étalé en cape, masque de porcelaine au sud, lanterne du Veilleur en main. */
asset('chasseur',`
<ellipse cx="0" cy="2" rx="48" ry="46" fill="#0d0b18" opacity=".35"/>
<path d="M-12-20Q-26-40-44-44M-24-34-38-32M-30-40-34-52M12-20Q26-40 44-44M24-34 38-32M30-40 34-52" stroke="url(#gold3)" stroke-width="3.2"/>
<path d="M-18-14Q-48-6-56 22-40 34-22 30-12 22-12 8Z" fill="url(#night3)" stroke="url(#gold3)" stroke-width="1.8"/>
<path d="M18-14Q48-6 56 22 40 34 22 30 12 22 12 8Z" fill="url(#night3)" stroke="url(#gold3)" stroke-width="1.8"/>
<path d="M-50 14-32 18M-46 24-30 26M50 14 32 18M46 24 30 26" stroke="url(#gold3)" stroke-opacity=".35" stroke-width="1.4"/>
<path d="M-15-26Q-22 4-15 28 0 38 15 28 22 4 15-26Q0-34-15-26Z" fill="url(#cloak3)" stroke="url(#gold3)" stroke-width="2"/>
<path d="M0-28 0 34" stroke="#dcbc7c" stroke-opacity=".5" stroke-width="1.6"/>
<path d="M-12-10-4-10M4-10 12-10M-13 4-4 4M4 4 13 4M-12 18-4 18M4 18 12 18" stroke="url(#gold3)" stroke-opacity=".35" stroke-width="1.3"/>
<path d="M-16 20Q-34 28-38 42M16 20Q34 26 40 38" stroke="url(#night3)" stroke-width="4.6"/>
<path d="M-44 40-32 40-34 56-42 56Z" fill="url(#glass3)" stroke="url(#gold3)" stroke-width="1.6"/>
<path d="M-42 38Q-38 30-34 38" stroke="url(#gold3)" stroke-width="1.6"/>
<path d="M36 36 46 32 48 42 38 46Z" fill="url(#gold3)" stroke="#3b3040" stroke-width="1.4"/>
<ellipse cx="0" cy="-14" rx="22" ry="15" fill="url(#night3)" stroke="url(#gold3)" stroke-width="1.8"/>
<path d="M-20-16Q0-24 20-16" stroke="url(#gold3)" stroke-width="2.4"/>
<ellipse cx="0" cy="24" rx="13" ry="15" fill="url(#salt3)" stroke="#8d8a80" stroke-width="1.7"/>
<path d="M-7 19Q0 15 7 19" stroke="#b6b1a2" stroke-width="1.2"/>
<path d="M-5 31Q0 34 5 31" stroke="#b6b1a2" stroke-width="1.2"/>
<path d="M0 39 0 44" stroke="#8d8a80" stroke-width="1.2"/>
<path d="M-15-26Q-22 4-15 28 0 38 15 28 22 4 15-26Q0-34-15-26Z" fill="url(#hatch3)"/>
<path d="M-20-30-26-40M20-30 26-40M-36-42-40-52M36-42 40-52" stroke="#dcbc7c" stroke-width="2.2"/>
<ellipse cx="-5" cy="21" rx="2.8" ry="1.9" fill="#2b2b33"/><ellipse cx="5" cy="21" rx="2.8" ry="1.9" fill="#2b2b33"/>
<path d="M2 10 5 18 1 24 6 32" stroke="#a9a49a" stroke-width="1.1"/>
<circle cx="0" cy="26" r="1.4" fill="#8d8a80"/>
<circle cx="-38" cy="48" r="3.4" fill="url(#ember3)" filter="url(#softglow3)"/>
<circle cx="0" cy="-2" r="3.4" fill="url(#gold3)" stroke="#5e4c52" stroke-width="1"/>`,true);
/* ------------------------------ couches Canvas ---------------------------
   Les ancres suivent l'anatomie vue de dessus : bout des bras, coupelles,
   lanternes de l'abdomen. Elles sont écrites en unités du viewBox. */
function circle(g,x,y,r,fill,stroke='',width=1){g.beginPath();g.arc(x,y,r,0,TAU);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}}
function line(g,x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
function polygon(g,points,fill,stroke='',width=1){g.beginPath();g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.closePath();if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}}
function arc(g,x,y,r,start,end,color,width=1){g.beginPath();g.arc(x,y,r,start,end);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
function glow(g,x,y,r,color){g.save();g.shadowColor=color;g.shadowBlur=8;circle(g,x,y,r,color);g.restore()}
function flame(g,x,y,h,wide,color='#ffd489'){
 const flick=reduceMotion?0:Math.sin(h*3+x)*.12;
 g.save();g.translate(x,y);g.scale(1+flick,1-flick*.5);
 polygon(g,[[0,-h],[wide,-h*.35],[wide*.55,h*.35],[0,h*.6],[-wide*.55,h*.35],[-wide,-h*.35]],color);
 polygon(g,[[0,-h*.6],[wide*.42,-h*.1],[0,h*.4],[-wide*.42,-h*.1]],'#fff8e0');
 g.restore();
}
function ticks(g,x,y,r,angle,color,count=12){
 g.save();g.translate(x,y);g.rotate(angle);
 for(let i=0;i<count;i++){const a=i*TAU/count;line(g,Math.cos(a)*r*.82,Math.sin(a)*r*.82,Math.cos(a)*r,Math.sin(a)*r,color,1)}
 g.restore();
}
/* Bout des six bras du garde-mèche, coupelles de la veilleuse, lanternes de
   l'abdomen : les flammes sont posées exactement sur le dessin. */
asset('shutterImp',`
<ellipse cx="0" cy="4" rx="30" ry="27" fill="#0d0b18" opacity=".34"/>
<path d="M-22-16Q-38-24-46-14M22-16Q38-24 46-14M-24 14Q-40 20-44 32M24 14Q40 20 44 32" stroke="#4a4054" stroke-width="3.4"/>
<path d="M-46-14-52-18M-46-14-50-8M46-14 52-18M46-14 50-8M-44 32-50 36M-44 32-42 40M44 32 50 36M44 32 42 40" stroke="#8d8496" stroke-width="1.8"/>
<path d="M-26 -26 L-1 -26 L-1 26 L-26 26 Z" fill="url(#wood3)" stroke="#2f2419" stroke-width="1.8"/>
<path d="M1 -26 L26 -26 L26 26 L1 26 Z" fill="url(#wood3)" stroke="#2f2419" stroke-width="1.8"/>
<path d="M-20 -24 L-20 24 M-13 -24 L-13 24 M-6 -24 L-6 24 M7 -24 L7 24 M14 -24 L14 24 M21 -24 L21 24" stroke="#5a4636" stroke-opacity=".8" stroke-width="1.2"/>
<path d="M-26 -14 L-1 -14 M-26 12 L-1 12 M1 -14 L26 -14 M1 12 L26 12" stroke="#3a2f3c" stroke-width="2.6"/>
<path d="M-26 -14 L-16 -14 M1 12 L11 12" stroke="#8d8496" stroke-width="1.4"/>
<circle cx="-22" cy="-14" r="1.8" fill="#8d8496"/><circle cx="-22" cy="12" r="1.8" fill="#8d8496"/>
<circle cx="22" cy="-14" r="1.8" fill="#8d8496"/><circle cx="22" cy="12" r="1.8" fill="#8d8496"/>
<path d="M-4 -4 L4 -4 L4 6 L-4 6 Z" fill="#3a2f3c" stroke="#cf9f5f" stroke-width="1.2"/>
<circle cx="0" cy="0" r="2.2" fill="#cf9f5f"/>
<path d="M-9 26Q0 21 9 26 8 37 0 40-8 37-9 26Z" fill="url(#wood3)" stroke="#2f2419" stroke-width="1.5"/>
<circle cx="0" cy="30" r="3.4" fill="#1d160f" stroke="#cf9f5f" stroke-width="1.1"/>
<path d="M0 33 L0 37" stroke="#cf9f5f" stroke-width="1.6"/>
<path d="M-26 -26 L-1 -26 L-1 26 L-26 26 Z" fill="url(#hatch3)"/>`);
asset('waxMimic',`
<ellipse cx="0" cy="6" rx="26" ry="22" fill="#0d0b18" opacity=".32"/>
<path d="M-16-4Q-30 0-32 12M16-4Q30 0 32 12" stroke="url(#wax3)" stroke-width="4"/>
<path d="M-32 12-38 16M-32 12-30 20M32 12 38 16M32 12 30 20" stroke="#f0dcb6" stroke-width="2"/>
<path d="M-18 -22 L18 -22 L18 18 L-18 18 Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.8"/>
<path d="M-18-22Q-22-12-18-4M18-22Q22-12 18-4M-8-22Q-11-14-8-8M8-22Q11-14 8-8" stroke="#fff8e8" stroke-opacity=".65" stroke-width="2"/>
<ellipse cx="0" cy="-22" rx="18" ry="6" fill="#f0dcb6" stroke="#7d6a72" stroke-width="1.4"/>
<ellipse cx="0" cy="-23" rx="11" ry="3.4" fill="#b39a8c"/>
<path d="M0 -23 L0 -31" stroke="#4a3b46" stroke-width="1.8"/>
<path d="M-14 2Q0-4 14 2 12 14 0 16-12 14-14 2Z" fill="#4a3b46"/>
<path d="M-11 3-8 9-5 3-2 9 1 3 4 9 7 3 10 9" stroke="#f0dcb6" stroke-width="1.8"/>
<ellipse cx="-7" cy="-9" rx="3" ry="3.6" fill="#4b3a4a"/><ellipse cx="7" cy="-9" rx="3" ry="3.6" fill="#4b3a4a"/>
<circle cx="-6.2" cy="-10" r="1.1" fill="#ffd9a0"/><circle cx="7.8" cy="-10" r="1.1" fill="#ffd9a0"/>
<circle cx="0" cy="24" r="7" fill="#b06a72" stroke="#6d3f4e" stroke-width="1.4"/>
<path d="M-3 21 3 27M3 21-3 27" stroke="#f0dcb6" stroke-width="1.3"/>
<path d="M-18 -22 L18 -22 L18 18 L-18 18 Z" fill="url(#hatch3)"/>`);
asset('snufferHand',`
<ellipse cx="0" cy="4" rx="28" ry="28" fill="#0d0b18" opacity=".34"/>
<path d="M0-40Q-8-30 0-20Q8-10 0 0" stroke="#445563" stroke-width="5"/>
<path d="M0-40Q-8-30 0-20Q8-10 0 0" stroke="#8399a9" stroke-width="2" stroke-opacity=".8"/>
<circle cx="0" cy="-40" r="4" fill="#5d7183" stroke="#33414f" stroke-width="1.3"/>
<circle cx="-4" cy="-25" r="3.2" fill="#5d7183" stroke="#33414f" stroke-width="1.2"/>
<circle cx="4" cy="-11" r="3.2" fill="#5d7183" stroke="#33414f" stroke-width="1.2"/>
<path d="M-20-14Q-34-8-36 4M20-14Q34-8 36 4" stroke="#445563" stroke-width="3.2"/>
<path d="M-36 4-42 8M-36 4-34 12M36 4 42 8M36 4 34 12" stroke="#8399a9" stroke-width="1.8"/>
<circle cx="0" cy="8" r="24" fill="url(#steel3)" stroke="#33414f" stroke-width="2"/>
<circle cx="0" cy="8" r="17" fill="#33414f" stroke="#8399a9" stroke-width="1.5"/>
<circle cx="0" cy="8" r="10" fill="#1b2530"/>
<path d="M-17-4Q-8-12 4-13" stroke="#d8e8f1" stroke-opacity=".5" stroke-width="2.2"/>
<path d="M-24 8 L-28 8 M24 8 L28 8 M0 -16 L0 -20 M0 32 L0 36" stroke="#8399a9" stroke-width="1.6"/>
<circle cx="-17" cy="-9" r="1.8" fill="#cf9f5f"/><circle cx="17" cy="-9" r="1.8" fill="#cf9f5f"/>
<circle cx="-17" cy="25" r="1.8" fill="#cf9f5f"/><circle cx="17" cy="25" r="1.8" fill="#cf9f5f"/>
<path d="M-11 26Q0 21 11 26 10 38 0 41-10 38-11 26Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.5"/>
<path d="M-7 30-9 36M-2 30-2 37M3 30 4 37M8 30 10 35" stroke="#b39a8c" stroke-width="1.3"/>
<ellipse cx="-4" cy="28" rx="1.8" ry="2.2" fill="#4b3a4a"/><ellipse cx="4" cy="28" rx="1.8" ry="2.2" fill="#4b3a4a"/>
<circle cx="0" cy="8" r="24" fill="url(#hatch3)"/>`);
asset('minuteToken',`
<circle cx="0" cy="5" r="30" fill="#0d0b18" opacity=".3"/>
<path d="M-5-38 L5-38 L5-30 L-5-30 Z" fill="url(#gold3)" stroke="#5e4c52" stroke-width="1.3"/>
<circle cx="0" cy="-42" r="5" fill="none" stroke="#dcbc7c" stroke-width="2.6"/>
<circle cx="0" cy="0" r="31" fill="url(#gold3)" stroke="#5e4c52" stroke-width="2"/>
<circle cx="0" cy="0" r="27" fill="#8d6d49" stroke="#fff5cc" stroke-width="1.2"/>
<circle cx="0" cy="0" r="24" fill="#f4ead2" stroke="#a9855a" stroke-width="1.4"/>
<path d="M0-24 L0-18" stroke="#3a2f2a" stroke-width="2.6"/>
<path d="M24 0 L18 0" stroke="#3a2f2a" stroke-width="2.6"/>
<path d="M0 24 L0 18" stroke="#3a2f2a" stroke-width="2.6"/>
<path d="M-24 0 L-18 0" stroke="#3a2f2a" stroke-width="2.6"/>
<path d="M12-20.8 L9.5-16.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M20.8-12 L16.5-9.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M20.8 12 L16.5 9.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M12 20.8 L9.5 16.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M-12 20.8 L-9.5 16.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M-20.8 12 L-16.5 9.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M-20.8-12 L-16.5-9.5" stroke="#5a4636" stroke-width="1.8"/>
<path d="M-12-20.8 L-9.5-16.5" stroke="#5a4636" stroke-width="1.8"/>
<circle cx="0" cy="10" r="6" fill="none" stroke="#a9855a" stroke-width="1.1"/>
<path d="M0 10 L0 6" stroke="#5a4636" stroke-width="1.2"/>
<path d="M0 2 L0-16" stroke="#2b2320" stroke-width="3"/>
<circle cx="0" cy="0" r="3.2" fill="#8d6d49" stroke="#3a2f2a" stroke-width="1"/>
<path d="M-17-14 Q-8-21 3-20" stroke="#ffffff" stroke-opacity=".55" stroke-width="3"/>
<path d="M14 16 Q19 11 20 5" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/>`);
asset('waxCierge',`
<ellipse cx="0" cy="8" rx="20" ry="18" fill="#0d0b18" opacity=".3"/>
<path d="M-13 -20 L13 -20 L13 20 L-13 20 Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.6"/>
<path d="M-13-20Q-17-10-13 0M13-20Q17-10 13 0" stroke="#fff8e8" stroke-opacity=".7" stroke-width="2"/>
<ellipse cx="0" cy="-20" rx="13" ry="4.6" fill="#f0dcb6" stroke="#7d6a72" stroke-width="1.3"/>
<ellipse cx="0" cy="-21" rx="8" ry="2.6" fill="#b39a8c"/>
<path d="M0 -21 L0 -28" stroke="#4a3b46" stroke-width="1.7"/>
<path d="M-5-30Q0-42 5-30 3-24 0-24-3-24-5-30Z" fill="#f4c98f" fill-opacity=".95"/>
<path d="M-2.4-31Q0-37 2.4-31 1.4-27 0-27-1.4-27-2.4-31Z" fill="#fff8e8"/>
<path d="M-13 20Q-18 26-12 30M13 20Q18 26 12 30" stroke="#f0dcb6" stroke-width="2.4"/>
<circle cx="0" cy="8" r="7.5" fill="#b06a72" stroke="#6d3f4e" stroke-width="1.5"/>
<path d="M-3.4 4.6 3.4 11.4M3.4 4.6-3.4 11.4" stroke="#f0dcb6" stroke-width="1.4"/>
<path d="M-13-6 Q-17 2-13 10 M13-6 Q17 2 13 10" stroke="#fff8e8" stroke-opacity=".55" stroke-width="1.6"/>
<path d="M-8-20 L-8-13 M8-20 L8-13" stroke="#b39a8c" stroke-width="1.2"/>
<circle cx="-9" cy="16" r="1.6" fill="#b39a8c"/><circle cx="9" cy="16" r="1.6" fill="#b39a8c"/>
<path d="M-13 20 L13 20" stroke="#7d6a72" stroke-width="1.6"/>
<circle cx="0" cy="8" r="10" fill="none" stroke="#6d3f4e" stroke-opacity=".5" stroke-width="1.2"/>
<path d="M-13 -20 L13 -20 L13 20 L-13 20 Z" fill="url(#hatch3)"/>`);

asset('mecheToken',`
<ellipse cx="0" cy="8" rx="20" ry="18" fill="#0d0b18" opacity=".3"/>
<path d="M-13 -20 L13 -20 L13 20 L-13 20 Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.6"/>
<path d="M-13-20Q-17-10-13 0M13-20Q17-10 13 0" stroke="#fff8e8" stroke-opacity=".7" stroke-width="2"/>
<ellipse cx="0" cy="-20" rx="13" ry="4.6" fill="#f0dcb6" stroke="#7d6a72" stroke-width="1.3"/>
<ellipse cx="0" cy="-21" rx="8" ry="2.6" fill="#b39a8c"/>
<path d="M0 -21 L0 -28" stroke="#4a3b46" stroke-width="1.7"/>
<path d="M-5-30Q0-42 5-30 3-24 0-24-3-24-5-30Z" fill="#f4c98f" fill-opacity=".95"/>
<path d="M-2.4-31Q0-37 2.4-31 1.4-27 0-27-1.4-27-2.4-31Z" fill="#fff8e8"/>
<path d="M-13 20Q-18 26-12 30M13 20Q18 26 12 30" stroke="#f0dcb6" stroke-width="2.4"/>
<path d="M-13 4 L13 4 L13 12 L-13 12Z" fill="url(#gold3)" stroke="#5e4c52" stroke-width="1.2"/>
<path d="M-6 8 L6 8" stroke="#fff5cc" stroke-width="1.6"/>
<path d="M-13-6 Q-17 2-13 10 M13-6 Q17 2 13 10" stroke="#fff8e8" stroke-opacity=".55" stroke-width="1.6"/>
<path d="M-8-20 L-8-13 M8-20 L8-13" stroke="#b39a8c" stroke-width="1.2"/>
<circle cx="-9" cy="16" r="1.6" fill="#b39a8c"/><circle cx="9" cy="16" r="1.6" fill="#b39a8c"/>
<path d="M-13 20 L13 20" stroke="#7d6a72" stroke-width="1.6"/>
<circle cx="0" cy="-21" r="12" fill="none" stroke="#fff5cc" stroke-opacity=".35" stroke-width="1.2"/>
<path d="M-13 -20 L13 -20 L13 20 L-13 20 Z" fill="url(#hatch3)"/>`);

/* Mèches de la Veilleuse : lanterne de fer forgé et flamme, plus un point. */

asset('bossWick',`
<ellipse cx="0" cy="34" rx="24" ry="7" fill="#0d0b18" opacity=".35"/>
<path d="M0-44 L0-36" stroke="#cf9f5f" stroke-width="2.4"/>
<circle cx="0" cy="-46" r="4" fill="none" stroke="#dcbc7c" stroke-width="2"/>
<path d="M-22-30 Q0-42 22-30 L22 26 L-22 26 Z" fill="#3a3244" stroke="#241d33" stroke-width="2"/>
<path d="M-17-26 Q0-36 17-26 L17 21 L-17 21 Z" fill="url(#glass3)" stroke="#e8d6b0" stroke-width="1.4"/>
<path d="M-17-26 Q0-36 17-26 L17 21 L-17 21 Z" fill="url(#void3)" opacity=".5"/>
<path d="M0-33 L0 21" stroke="#4a4054" stroke-width="1.8"/>
<path d="M-17-4 L17-4" stroke="#4a4054" stroke-width="1.8"/>
<path d="M-13-22 Q-16-12-13-6" stroke="#fff8e8" stroke-opacity=".45" stroke-width="2"/>
<path d="M-26 26 L26 26 L22 34 L-22 34 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.6"/>
<path d="M-9 6 L9 6 L9 22 L-9 22 Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.4"/>
<ellipse cx="0" cy="6" rx="9" ry="3" fill="#f0dcb6" stroke="#7d6a72" stroke-width="1.1"/>
<path d="M-9 8 Q-12 14-9 20 M9 8 Q12 14 9 20" stroke="#fff8e8" stroke-opacity=".6" stroke-width="1.5"/>
<path d="M0 6 L0 0" stroke="#4a3b46" stroke-width="1.8"/>
<circle cx="-19" cy="-28" r="1.8" fill="#cf9f5f"/><circle cx="19" cy="-28" r="1.8" fill="#cf9f5f"/>
<circle cx="-19" cy="23" r="1.8" fill="#cf9f5f"/><circle cx="19" cy="23" r="1.8" fill="#cf9f5f"/>
<path d="M-22-30 Q0-42 22-30 L22 26 L-22 26 Z" fill="url(#hatch3)"/>`);

asset('bossFlame',`
<path d="M0-44 Q14-26 12-12 Q10 4 0 10 Q-10 4 -12-12 Q-14-26 0-44 Z" fill="#e5854e" fill-opacity=".55"/>
<path d="M0-38 Q11-23 9-11 Q7 2 0 7 Q-7 2 -9-11 Q-11-23 0-38 Z" fill="#f4a05a"/>
<path d="M0-32 Q8-20 7-10 Q5 0 0 4 Q-5 0 -7-10 Q-8-20 0-32 Z" fill="#ffd9a0"/>
<path d="M0-24 Q5-15 4-8 Q3-1 0 1 Q-3-1 -4-8 Q-5-15 0-24 Z" fill="#fff8e8"/>
<path d="M0-16 Q2.4-11 2-7 Q1.4-3 0-2 Q-1.4-3 -2-7 Q-2.4-11 0-16 Z" fill="#ffffff"/>
<path d="M-10-14 Q-14-6-11 2" stroke="#ffb064" stroke-opacity=".6" stroke-width="1.6"/>
<path d="M10-14 Q14-6 11 2" stroke="#ffb064" stroke-opacity=".6" stroke-width="1.6"/>
<ellipse cx="0" cy="8" rx="10" ry="4" fill="#e5854e" fill-opacity=".45"/>
<ellipse cx="0" cy="7" rx="5" ry="2.4" fill="#ffd9a0" fill-opacity=".7"/>
<circle cx="-13" cy="-30" r="1.6" fill="#ffd9a0" fill-opacity=".6"/>
<circle cx="13" cy="-24" r="1.4" fill="#ffd9a0" fill-opacity=".5"/>
<circle cx="9" cy="-40" r="1.2" fill="#fff8e8" fill-opacity=".5"/>
<circle cx="-8" cy="-42" r="1.1" fill="#fff8e8" fill-opacity=".45"/>
<path d="M-6-40 Q0-48 6-40" stroke="#ffb064" stroke-opacity=".35" stroke-width="1.4"/>`);

const WARDEN_ARMS=[[-43.5,-16],[43.5,-16],[-43.5,17],[43.5,17],[-11,36],[11,36]];
const VEILLEUSE_CUPS=[[0,-44],[42,-16],[24,43],[-24,43],[-42,-16]];
const PICKER_WICKS=[[-12,-30],[-4,-33],[4,-33],[12,-30]];
const QUEEN_CELLS=[[-15,-26],[0,-32],[15,-26]];

function drawBehind(g,e,t){
 const k=e.kind;
 if(k==='wickWarden'){
  const halo=g.createRadialGradient(0,2,4,0,2,44);halo.addColorStop(0,'#ffd9a030');halo.addColorStop(1,'#ffd9a000');
  g.fillStyle=halo;g.fillRect(-44,-42,88,88);
 }else if(k==='waxCourier'){
  for(let i=0;i<3;i++){const a=t*.8+i*2.1;g.save();g.globalAlpha=.3;g.translate(Math.cos(a)*30,-18+Math.sin(a*1.3)*8);g.rotate(a*.4);polygon(g,[[-4,-3],[4,-3],[4,3],[-4,3]],'#f0dcb6');g.restore()}
 }else if(k==='bronzeCrow'){
  g.save();g.globalAlpha=.22;arc(g,0,4,40,-.5,.5,'#cfe6d8',1.4);arc(g,0,4,40,Math.PI-.5,Math.PI+.5,'#cfe6d8',1.4);g.restore();
 }else if(k==='crackedBell'&&e.twin&&!e.twin.dead){
  g.save();g.globalAlpha=.3;const r=34+Math.sin(t*3)*2;arc(g,0,0,r,-.7,.7,'#cfe6d8',1.6);arc(g,0,0,r,Math.PI-.7,Math.PI+.7,'#cfe6d8',1.6);g.restore();
 }else if(k==='saltWalker'){
  g.save();g.globalAlpha=.3;for(let i=0;i<4;i++){const x=-18+i*12,y=-34+Math.sin(t*2+i)*2;polygon(g,[[x,y-4],[x+3,y],[x,y+4],[x-3,y]],'#ece5d2')}g.restore();
 }else if(k==='printThief'){
  g.save();g.globalAlpha=.22;for(let i=0;i<3;i++){g.beginPath();g.ellipse(-6+i*7,-34-i*7,3,4.4,0,0,TAU);g.fillStyle='#e8dcc0';g.fill()}g.restore();
 }else if(k==='hollowFlame'&&e.lit){
  const halo=g.createRadialGradient(0,2,2,0,2,34);halo.addColorStop(0,'#f4c98f44');halo.addColorStop(1,'#f4c98f00');
  g.fillStyle=halo;g.fillRect(-34,-32,68,68);
 }else if(k==='unnamedDigit'){
  g.save();g.globalAlpha=.32;ticks(g,0,0,32,t*.35,'#dcbc7c',16);g.restore();
 }else if(k==='facelessEcho'){
  const halo=g.createRadialGradient(0,0,4,0,0,36);halo.addColorStop(0,'#b9a7c922');halo.addColorStop(1,'#b9a7c900');
  g.fillStyle=halo;g.fillRect(-36,-36,72,72);
 }else if(k==='snufferHand'&&e.stolen>0){
  const halo=g.createRadialGradient(0,8,4,0,8,40);halo.addColorStop(0,'#f4c98f3a');halo.addColorStop(1,'#f4c98f00');
  g.fillStyle=halo;g.fillRect(-40,-32,80,80);
 }else if(k==='shutterImp'){
  g.save();g.globalAlpha=.2;for(let i=0;i<3;i++){const a=t*.9+i*2.1;circle(g,Math.cos(a)*32,-20+Math.sin(a*1.2)*7,1.8,'#c79b6d')}g.restore();
 }else if(k==='veilleuse'){
  const halo=g.createRadialGradient(0,-6,6,0,-6,66);halo.addColorStop(0,'#ffd9a02e');halo.addColorStop(1,'#ffd9a000');
  g.fillStyle=halo;g.fillRect(-66,-72,132,132);
 }else if(k==='sonneur'&&e.ring>0){
  g.save();g.globalAlpha=.22;for(let i=1;i<4;i++)arc(g,0,0,44+i*10+Math.sin(t*4)*2,0,TAU,'#cfe6d8',1.4);g.restore();
 }else if(k==='passeur'){
  g.save();g.globalAlpha=.2;for(let i=0;i<5;i++){const a=t*.5+i*1.26;circle(g,Math.cos(a)*46,Math.sin(a)*28,2.4,'#ece5d2')}g.restore();
 }else if(k==='cueilleuse'){
  const halo=g.createRadialGradient(0,-24,4,0,-24,52);halo.addColorStop(0,'#f4c98f26');halo.addColorStop(1,'#f4c98f00');
  g.fillStyle=halo;g.fillRect(-52,-76,104,104);
 }else if(k==='chasseur'&&e.halo){
  g.save();g.globalAlpha=.3;circle(g,0,0,54+Math.sin(t*2)*3,'','#fff0bd',1.8);g.restore();
 }
}

function drawFront(g,e,t){
 const k=e.kind;
 if(k==='wickWarden'){
  flame(g,0,2,7,4);
  for(const [x,y] of WARDEN_ARMS)flame(g,x,y-4,4.4,2.4);
 }else if(k==='waxCourier'){
  flame(g,0,-36,5.4,3);glow(g,0,0,1.6+Math.sin(t*3)*.4,'#b06a72');
 }else if(k==='waxMimic'){
  if(e.disguise)flame(g,0,-31,6,3.2);else flame(g,0,-32,4.4,2.4);
 }else if(k==='snufferHand'){
  if(e.stolen>0)for(let i=0;i<e.stolen;i++)flame(g,-6+i*6,8,5,2.8);
  else glow(g,0,8,2,'#33414f');
 }else if(k==='shutterImp'){
  glow(g,0,30,2.2+Math.sin(t*2.4)*.5,'#cf9f5f');
 }else if(k==='bronzeCrow'){
  glow(g,-4.5,20,1.4,'#f4fffa');glow(g,4.5,20,1.4,'#f4fffa');
  if(!reduceMotion){g.save();g.globalAlpha=.35;const f=Math.sin(t*5.4)*3;line(g,-40,-6+f,-26,0,'#dff3e6',1.2);line(g,40,-6+f,26,0,'#dff3e6',1.2);g.restore()}
 }else if(k==='crackedBell'){
  if(!reduceMotion)ticks(g,0,0,12,t*1.2,'#cfe6d8',6);
  glow(g,0,0,2.4,'#f4fffa');
  if(e.twin?.dead)glow(g,2,4,3,'#cfeadb');
 }else if(k==='saltWalker'){
  if(!reduceMotion)for(let i=0;i<3;i++){const p=(t*.7+i*.33)%1;g.save();g.globalAlpha=(1-p)*.7;glow(g,-10+i*10,-24+p*40,1.3,'#ffffff');g.restore()}
 }else if(k==='printThief'){
  const run=Math.min(3,e.dashRun||0);
  for(let i=0;i<run;i++)polygon(g,[[-10+i*10,-30],[-6+i*10,-26],[-10+i*10,-22],[-14+i*10,-26]],'#e8dcc0');
 }else if(k==='wickPicker'){
  for(const [x,y] of PICKER_WICKS)flame(g,x,y-2,4,2.2);
 }else if(k==='hollowFlame'){
  if(e.lit){flame(g,0,2,9,5,'#f4c98f');glow(g,0,0,2,'#fff8e0')}
  else{g.save();g.globalAlpha=.5;g.setLineDash([3,3]);circle(g,0,2,7,'','#f4c98f',1.2);g.setLineDash([]);g.restore()}
  if(e.seal){g.save();g.globalAlpha=.8;ticks(g,0,0,26,t*.2,'#f4c98f',8);g.restore()}
 }else if(k==='unnamedDigit'){
  const weak=window.SixthHour?.mission?.digit===e.digit;
  g.save();g.globalAlpha=weak?.9:.4;circle(g,0,0,19,'',weak?'#fff5cc':'#7c6a8f',1.4);g.restore();
  if(weak)glow(g,0,0,2.4,'#fff5cc');
 }else if(k==='facelessEcho'){
  g.save();g.globalAlpha=.5;g.setLineDash([4,4]);circle(g,0,-10,15,'','#d8c9e4',1.2);g.setLineDash([]);g.restore();
 }else if(k==='veilleuse'){
  const lit=(e.windows||[]).filter(w=>w.lit).length;
  VEILLEUSE_CUPS.forEach(([x,y],i)=>{if(i<lit)flame(g,x,y-4,6,3.2);else{g.save();g.globalAlpha=.4;line(g,x,y-5,x,y+1,'#6b5a7d',1.8);g.restore()}});
  flame(g,0,-6,6,3.4);
 }else if(k==='sonneur'){
  if(!reduceMotion){g.save();g.globalAlpha=.5;const s=Math.sin(t*1.6)*3;line(g,40,10,56+s,4,'#93c3ae',2.4);g.restore()}
  if(e.strikes>0)for(let i=0;i<e.strikes;i++)glow(g,-8+i*8,34,2.2,'#cfeadb');
 }else if(k==='passeur'){
  if(!reduceMotion){g.save();g.globalAlpha=.75;for(let i=0;i<4;i++){const p=(t*.9+i*.25)%1;circle(g,0,-22+p*30,.9,'#ece5d2')}g.restore()}
  if(e.open>0){g.save();g.globalAlpha=.5;circle(g,0,-6,26,'','#ece5d2',1.6);g.restore()}
  for(let i=0;i<(e.breaks||0);i++)glow(g,-8+i*8,-40,2,'#ffffff');
 }else if(k==='cueilleuse'){
  const lamps=e.lanterns||[];
  QUEEN_CELLS.forEach(([x,y],i)=>{if(lamps[i]?.lit)flame(g,x,y,5,2.8)});
  if(e.vulnerable>0){g.save();g.globalAlpha=.55;circle(g,0,4,38,'','#f4c98f',1.8);g.restore()}
  for(let i=0;i<(e.collected||0);i++)glow(g,-10+i*10,34,2.2,'#ffdc9a');
 }else if(k==='chasseur'){
  if(e.naming){g.save();g.globalAlpha=.6;circle(g,0,24,19,'','#fff0bd',1.6);g.restore()}
  for(let i=0;i<(e.borrowed||0);i++)glow(g,-8+i*8,-16,2.2,'#fff0bd');
  flame(g,-38,48,5,2.8);
 }
}

function drawActor(g,e,x,y,scale=1,time=0,hit=0){
 if(window.Campaign?.activeWorld!==3||!e||!kinds.has(e.kind))return false;
 const shown=(e.kind==='waxMimic'&&e.disguise)?'waxCierge':e.kind;
 const image=window.MinuitArt?.[shown];if(!image?.complete||!image.naturalWidth)return false;
 const boss=bossKinds.has(e.kind),t=reduceMotion?0:time,seed=e.seed||e.seqSeed||0;
 const bw=boss?86:({bronzeCrow:80,hollowFlame:72,crackedBell:78,wickWarden:82}[e.kind]||78),bh=bw*image.naturalHeight/image.naturalWidth;
 const bob=reduceMotion?0:Math.sin(t*(e.kind==='bronzeCrow'?4:2)+seed)*(boss?1.2:1.6);
 // Les couches sont dessinées en unités du viewBox : même échelle que l'image,
 // et même origine (le viewBox est verticalement symétrique, d'où le -bh*.02).
 const unit=bw/(boss?140:112),origin=-bh*.02;
 g.save();g.translate(x,y);g.scale(scale,scale);g.lineCap='round';g.lineJoin='round';
 g.save();g.translate(0,bob+origin);g.scale(unit,unit);drawBehind(g,e,t);g.restore();
 g.save();g.translate(0,bob);g.rotate(reduceMotion?0:Math.sin(t*2+seed)*(boss?.016:.03));
 if(hit)g.filter='brightness(1.65) saturate(.7)';
 else if(e.blockHit>0)g.filter='brightness(1.35) hue-rotate(-20deg)';
 g.drawImage(image,-bw/2,-bh*.52,bw,bh);g.filter='none';
 g.save();g.translate(0,origin);g.scale(unit,unit);drawFront(g,e,t);g.restore();
 g.restore();g.restore();return true;
}

window.SixthHourArt={drawActor,isSixthKind:k=>kinds.has(k),isBossKind:k=>bossKinds.has(k),get kinds(){return[...kinds]}};
})();
