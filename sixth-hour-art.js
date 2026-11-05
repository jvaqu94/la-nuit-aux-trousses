/* Direction artistique animée de La Sixième Heure (monde 3).
   Même architecture que sequel-art.js : une silhouette SVG par forme, chargée
   dans window.MinuitArt, puis deux couches Canvas (derrière / devant) qui
   traduisent l'état réel du combat. Aucun asset distant, aucune hitbox touchée.
   Palette propre au monde 3 : cire, bronze patiné, sel, prune et obsidienne. */
(()=>{
'use strict';
const foes=['wickWarden','waxCourier','bronzeCrow','crackedBell','saltWalker','printThief','wickPicker','hollowFlame','unnamedDigit','facelessEcho'];
const bosses=['veilleuse','sonneur','passeur','cueilleuse','chasseur'];
const kinds=new Set([...foes,...bosses]),bossKinds=new Set(bosses);
const reduceMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TAU=Math.PI*2;
window.MinuitArt=window.MinuitArt||{};

const defs=`<defs>
<linearGradient id="cloak3" x2=".75" y2="1"><stop stop-color="#8073a0"/><stop offset=".34" stop-color="#4a4068"/><stop offset=".72" stop-color="#272140"/><stop offset="1" stop-color="#141120"/></linearGradient>
<linearGradient id="wax3" x2=".8" y2="1"><stop stop-color="#fff8e8"/><stop offset=".36" stop-color="#f0dcb6"/><stop offset=".72" stop-color="#b39a8c"/><stop offset="1" stop-color="#55475e"/></linearGradient>
<linearGradient id="bronze3" x2=".85" y2="1"><stop stop-color="#ffe9b8"/><stop offset=".26" stop-color="#cf9f5f"/><stop offset=".58" stop-color="#8a6248"/><stop offset=".82" stop-color="#d7ab72"/><stop offset="1" stop-color="#40303c"/></linearGradient>
<linearGradient id="patina3" x2=".8" y2="1"><stop stop-color="#e4f6ea"/><stop offset=".3" stop-color="#93c3ae"/><stop offset=".66" stop-color="#4d8079"/><stop offset="1" stop-color="#22403f"/></linearGradient>
<linearGradient id="salt3" x2=".8" y2="1"><stop stop-color="#ffffff"/><stop offset=".34" stop-color="#ece5d2"/><stop offset=".7" stop-color="#a9a89b"/><stop offset="1" stop-color="#4e545c"/></linearGradient>
<linearGradient id="steel3" x2=".8" y2="1"><stop stop-color="#d8e8f1"/><stop offset=".3" stop-color="#8399a9"/><stop offset=".66" stop-color="#445563"/><stop offset="1" stop-color="#1b2530"/></linearGradient>
<linearGradient id="night3" x2=".8" y2="1"><stop stop-color="#544c7c"/><stop offset=".42" stop-color="#2a2447"/><stop offset="1" stop-color="#100e1e"/></linearGradient>
<linearGradient id="gold3" x2=".85" y2="1"><stop stop-color="#fff5cc"/><stop offset=".28" stop-color="#dcbc7c"/><stop offset=".62" stop-color="#8d6d49"/><stop offset="1" stop-color="#3b3040"/></linearGradient>
<linearGradient id="glass3" x2=".8" y2="1"><stop stop-color="#fff6dd" stop-opacity=".82"/><stop offset=".34" stop-color="#d9c9a8" stop-opacity=".42"/><stop offset=".7" stop-color="#7a6b8c" stop-opacity=".38"/><stop offset="1" stop-color="#ffe9bd" stop-opacity=".6"/></linearGradient>
<radialGradient id="ember3"><stop stop-color="#fffdf2"/><stop offset=".3" stop-color="#ffdc9a"/><stop offset=".66" stop-color="#e5854e"/><stop offset="1" stop-color="#8a3f55"/></radialGradient>
<radialGradient id="cold3"><stop stop-color="#f4fffa"/><stop offset=".34" stop-color="#cfeadb"/><stop offset=".7" stop-color="#6fa698"/><stop offset="1" stop-color="#2b4a4f"/></radialGradient>
<radialGradient id="void3"><stop stop-color="#312a4c"/><stop offset=".55" stop-color="#191434"/><stop offset="1" stop-color="#0b0916"/></radialGradient>
<pattern id="hatch3" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 0V6" stroke="#fff4dc" stroke-opacity=".12" stroke-width="1"/></pattern>
<filter id="softglow3" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="2.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

function asset(id,body,boss=false){
 const image=new Image(),view=boss?'-70 -65 140 130':'-56 -48 112 96';
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" fill="none" stroke-linecap="round" stroke-linejoin="round">${defs}${body}</svg>`);
 window.MinuitArt[id]=image;
}

/* Garde-mèche : chandelier voûté, manteau figé dans la cire, cloche de verre
   portée à deux mains. C'est lui qui prête son halo — donc il est lisible. */
asset('wickWarden',`
<ellipse cx="0" cy="40" rx="22" ry="5" fill="#0d0b18" opacity=".45"/>
<path d="M -20 -14 Q -30 8 -26 34 L -14 30 L -6 38 L 2 30 L 12 37 L 22 31 Q 27 6 18 -14 Z" fill="url(#cloak3)" stroke="#9184b0" stroke-width="1.5"/>
<path d="M -22 22 Q -20 32 -16 24 M -8 26 Q -6 36 -3 27 M 8 25 Q 10 35 13 26 M 19 20 Q 21 30 24 22" stroke="url(#wax3)" stroke-width="3"/>
<path d="M -16 -16 Q -18 -36 0 -40 Q 18 -36 16 -16 Q 8 -22 0 -21 Q -8 -22 -16 -16 Z" fill="url(#night3)" stroke="#ab9ec6" stroke-width="1.6"/>
<path d="M -10 -20 Q 0 -26 10 -20 Q 8 -10 0 -9 Q -8 -10 -10 -20 Z" fill="#100d1c"/>
<circle cx="-4" cy="-17" r="1.9" fill="url(#ember3)"/><circle cx="4" cy="-17" r="1.9" fill="url(#ember3)"/>
<path d="M 0 -40 L 0 -43" stroke="#f0dcb6" stroke-width="2.4"/>
<path d="M 0 -47 Q 4.4 -42 0 -39 Q -4.4 -42 0 -47 Z" fill="url(#ember3)" filter="url(#softglow3)"/>
<path d="M -18 -6 Q -30 2 -25 12 M 18 -6 Q 30 2 25 12" stroke="url(#cloak3)" stroke-width="4.5"/>
<path d="M -12 12 Q -12 -6 0 -8 Q 12 -6 12 12 Z" fill="url(#glass3)" stroke="#f2e4c4" stroke-width="1.3"/>
<ellipse cx="0" cy="12" rx="13" ry="3.4" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1"/>
<path d="M 0 8 Q 5 1 0 -5 Q -5 1 0 8 Z" fill="url(#ember3)" filter="url(#softglow3)"/>
<path d="M -9 -4 Q -6 -6 -4 -4" stroke="#fff8e0" stroke-opacity=".6" stroke-width="1.2"/>
<path d="M -20 -14 Q -30 8 -26 34 L 22 31 Q 27 6 18 -14 Z" fill="url(#hatch3)"/>`);

/* Facteur de cire : cape de courrier, tête-bougie, sacoche de plis scellés.
   Une de ses deux marques est un leurre : le sceau reste volontairement ambigu. */
asset('waxCourier',`
<ellipse cx="0" cy="40" rx="20" ry="4.6" fill="#0d0b18" opacity=".45"/>
<path d="M -19 -12 Q -31 10 -24 35 L -10 31 L 0 38 L 11 31 L 24 35 Q 30 9 18 -12 Z" fill="url(#cloak3)" stroke="#9a8ab4" stroke-width="1.5"/>
<path d="M -19 -12 Q 0 -4 18 -12 L 14 -20 L -14 -20 Z" fill="url(#night3)" stroke="#b3a4c8" stroke-width="1.3"/>
<path d="M -24 30 Q -21 38 -17 30 M 17 30 Q 21 38 24 30" stroke="url(#wax3)" stroke-width="2.8"/>
<path d="M -8 -22 L -8 -34 Q 0 -38 8 -34 L 8 -22 Q 0 -18 -8 -22 Z" fill="url(#wax3)" stroke="#7d6a72" stroke-width="1.3"/>
<path d="M -8 -30 Q -11 -24 -9 -20 M 8 -31 Q 11 -25 9 -21" stroke="#fff8e8" stroke-opacity=".75" stroke-width="1.6"/>
<path d="M 0 -38 L 0 -41" stroke="#4a3b46" stroke-width="1.6"/>
<path d="M 0 -47 Q 4.4 -42 0 -38 Q -4.4 -42 0 -47 Z" fill="url(#ember3)" filter="url(#softglow3)"/>
<circle cx="-3.4" cy="-28" r="1.5" fill="#4b3a4a"/><circle cx="3.4" cy="-28" r="1.5" fill="#4b3a4a"/>
<path d="M -16 -8 L 16 12" stroke="url(#bronze3)" stroke-width="3"/>
<path d="M 10 8 L 30 14 L 26 30 L 6 24 Z" fill="#463a55" stroke="url(#bronze3)" stroke-width="1.6"/>
<path d="M 12 12 L 26 16 M 11 17 L 25 21" stroke="#c8b799" stroke-opacity=".5" stroke-width="1.2"/>
<circle cx="18" cy="20" r="3.4" fill="url(#ember3)" stroke="#6d3f4e" stroke-width="1"/>
<path d="M -22 0 L -34 6 L -30 16 L -19 11 Z" fill="url(#wax3)" stroke="#8d7a80" stroke-width="1.2"/>
<circle cx="-27" cy="8" r="2.2" fill="#b06a72"/>
<path d="M -19 -12 Q -31 10 -24 35 L 24 35 Q 30 9 18 -12 Z" fill="url(#hatch3)"/>`);

/* Corbeau de bronze : oiseau riveté, ailes de tôle patinée, œil-engrenage.
   Jumelé à la cloche fêlée : briser l'un fige les tirs de l'autre. */
asset('bronzeCrow',`
<ellipse cx="0" cy="34" rx="18" ry="4.4" fill="#0d0b18" opacity=".4"/>
<path d="M -14 6 Q -22 22 -10 30 L 0 26 L 11 30 Q 22 21 14 6 Z" fill="url(#patina3)" stroke="#2b4245" stroke-width="1.5"/>
<path d="M -16 -8 Q -10 -24 4 -24 Q 18 -22 20 -6 Q 18 10 2 12 Q -14 10 -16 -8 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.8"/>
<path d="M -12 -6 Q -4 -16 6 -16 Q 15 -14 16 -4" stroke="#fff0c4" stroke-opacity=".45" stroke-width="1.4"/>
<path d="M 16 -14 Q 30 -12 34 -6 Q 28 -2 18 -4 Z" fill="url(#patina3)" stroke="#2b4245" stroke-width="1.4"/>
<path d="M 20 -10 L 32 -8" stroke="#1f3336" stroke-width="1.2"/>
<circle cx="8" cy="-12" r="4.6" fill="#1d2b2e" stroke="url(#gold3)" stroke-width="1.4"/>
<circle cx="8" cy="-12" r="1.7" fill="url(#cold3)"/>
<path d="M 8 -18 L 8 -16 M 14 -12 L 12 -12 M 8 -6 L 8 -8 M 2 -12 L 4 -12" stroke="url(#gold3)" stroke-width="1.2"/>
<path d="M -14 -4 Q -34 2 -40 16 Q -26 14 -14 8 Z" fill="url(#patina3)" stroke="#2b4245" stroke-width="1.5"/>
<path d="M -30 6 L -20 4 M -33 11 L -22 8" stroke="#dff3e6" stroke-opacity=".4" stroke-width="1.1"/>
<path d="M -10 30 L -13 38 M 10 30 L 13 38" stroke="url(#bronze3)" stroke-width="2.4"/>
<path d="M -17 38 L -9 38 M 9 38 L 17 38" stroke="#cf9f5f" stroke-width="2"/>
<circle cx="-6" cy="-2" r="1.3" fill="#f6e2b0"/><circle cx="2" cy="4" r="1.3" fill="#f6e2b0"/><circle cx="-2" cy="-12" r="1.3" fill="#f6e2b0"/>
<path d="M -16 -8 Q -10 -24 4 -24 Q 18 -22 20 -6 Q 18 10 2 12 Q -14 10 -16 -8 Z" fill="url(#hatch3)"/>`);

/* Cloche fêlée : la cloche marche sur son battant. La fêlure s'éclaire quand
   sa jumelle tombe — le lien est la mécanique, il doit se voir. */
asset('crackedBell',`
<ellipse cx="0" cy="38" rx="22" ry="4.8" fill="#0d0b18" opacity=".45"/>
<path d="M -6 -30 Q 0 -36 6 -30 Q 6 -24 0 -24 Q -6 -24 -6 -30 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.4"/>
<path d="M -24 22 Q -22 -18 0 -26 Q 22 -18 24 22 Z" fill="url(#patina3)" stroke="#26403f" stroke-width="1.9"/>
<path d="M -26 22 L 26 22 L 24 29 L -24 29 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.5"/>
<path d="M -16 -8 Q -8 -18 0 -20" stroke="#e6f7ec" stroke-opacity=".5" stroke-width="1.6"/>
<path d="M -4 -22 L 2 -8 L -3 2 L 5 14 L 1 22" stroke="#1b2f31" stroke-width="2.6"/>
<path d="M -4 -22 L 2 -8 L -3 2 L 5 14 L 1 22" stroke="url(#cold3)" stroke-width="1" stroke-opacity=".8"/>
<path d="M -18 8 Q 0 12 18 8" stroke="#1f3a3a" stroke-opacity=".6" stroke-width="1.3"/>
<path d="M -13 -2 Q -10 6 -12 14 M 14 -2 Q 17 6 15 14" stroke="#dff3e6" stroke-opacity=".28" stroke-width="1.2"/>
<path d="M 0 29 L 0 34" stroke="#cf9f5f" stroke-width="2.6"/>
<circle cx="0" cy="38" r="5" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.3"/>
<path d="M -22 12 Q -32 16 -30 24 M 22 12 Q 32 16 30 24" stroke="url(#patina3)" stroke-width="3"/>
<circle cx="-10" cy="-4" r="1.4" fill="#f0e4bb"/><circle cx="11" cy="0" r="1.4" fill="#f0e4bb"/>
<path d="M -24 22 Q -22 -18 0 -26 Q 22 -18 24 22 Z" fill="url(#hatch3)"/>`);

/* Marcheuse de sel : longues jambes, croûte de cristaux, voile sans traits.
   Elle dépose du sel sur tes positions passées : sa traîne est le tell. */
asset('saltWalker',`
<ellipse cx="0" cy="42" rx="20" ry="4.4" fill="#0d0b18" opacity=".4"/>
<path d="M -9 12 L -12 40 M 9 12 L 12 40" stroke="url(#steel3)" stroke-width="4.2"/>
<path d="M -17 41 L -7 41 M 7 41 L 17 41" stroke="#ece5d2" stroke-width="3"/>
<path d="M -14 -14 Q -24 6 -20 20 Q 0 26 20 20 Q 24 6 14 -14 Z" fill="url(#salt3)" stroke="#6f757c" stroke-width="1.6"/>
<path d="M -20 18 Q -14 28 -8 19 Q -2 29 4 19 Q 10 28 16 18" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.6"/>
<path d="M -12 -16 Q -14 -34 0 -36 Q 14 -34 12 -16 Q 0 -12 -12 -16 Z" fill="url(#steel3)" stroke="#8fa3b1" stroke-width="1.5"/>
<path d="M -8 -26 Q 0 -30 8 -26 L 7 -18 Q 0 -15 -7 -18 Z" fill="#1a2430"/>
<path d="M -6 -23 L 6 -23" stroke="#cfe0ea" stroke-opacity=".55" stroke-width="1.2"/>
<path d="M -16 -12 L -24 -20 L -19 -6 Z M 16 -12 L 24 -20 L 19 -6 Z" fill="url(#salt3)" stroke="#7d838a" stroke-width="1.1"/>
<path d="M -6 -2 L -2 -8 L 2 -2 L -2 4 Z M 8 6 L 12 1 L 15 7 L 11 12 Z" fill="#ffffff" fill-opacity=".8"/>
<path d="M -14 -14 Q -24 6 -20 20 Q 0 26 20 20 Q 24 6 14 -14 Z" fill="url(#hatch3)"/>`);

/* Voleuse d’empreintes : accroupie, pieds nus, sacoche de pas volés.
   Trois dashes dans la même direction déclenchent l'onde : elle compte. */
asset('printThief',`
<ellipse cx="0" cy="36" rx="19" ry="4.4" fill="#0d0b18" opacity=".4"/>
<path d="M -16 4 Q -24 20 -14 30 L 14 30 Q 24 19 16 4 Q 0 -2 -16 4 Z" fill="url(#cloak3)" stroke="#9a8ab4" stroke-width="1.5"/>
<path d="M -13 30 L -16 38 L -6 38 M 13 30 L 16 38 L 6 38" stroke="url(#salt3)" stroke-width="2.6"/>
<path d="M -14 -6 Q -14 -24 0 -26 Q 14 -24 14 -6 Q 0 0 -14 -6 Z" fill="url(#night3)" stroke="#a99cc4" stroke-width="1.5"/>
<path d="M -11 -14 Q 0 -19 11 -14 L 10 -8 Q 0 -4 -10 -8 Z" fill="#0f0c1a"/>
<circle cx="-4.5" cy="-12" r="1.7" fill="url(#cold3)"/><circle cx="4.5" cy="-12" r="1.7" fill="url(#cold3)"/>
<path d="M -14 -18 Q 0 -30 14 -18" stroke="url(#salt3)" stroke-width="1.8"/>
<path d="M 14 2 Q 28 6 26 18 L 14 16 Z" fill="#3d3450" stroke="url(#salt3)" stroke-width="1.4"/>
<ellipse cx="21" cy="10" rx="2.6" ry="3.6" fill="#e8dcc0" fill-opacity=".85"/>
<circle cx="18.4" cy="6" r="1" fill="#e8dcc0"/><circle cx="23.6" cy="6.4" r="1" fill="#e8dcc0"/>
<path d="M -16 6 Q -28 10 -26 20" stroke="url(#cloak3)" stroke-width="3.6"/>
<ellipse cx="-24" cy="24" rx="3" ry="4.2" fill="#e8dcc0" fill-opacity=".55"/>
<ellipse cx="-14" cy="32" rx="2.6" ry="3.6" fill="#e8dcc0" fill-opacity=".35"/>
<path d="M -16 4 Q -24 20 -14 30 L 14 30 Q 24 19 16 4 Z" fill="url(#hatch3)"/>`);

/* Cueilleuse de mèches : tablier, éteignoir au bout du bras, panier de mèches.
   Elle prélève ta flamme : le panier se remplit visuellement. */
asset('wickPicker',`
<ellipse cx="0" cy="40" rx="20" ry="4.6" fill="#0d0b18" opacity=".42"/>
<path d="M -17 -12 Q -26 10 -21 34 L 21 34 Q 26 10 17 -12 Z" fill="url(#cloak3)" stroke="#9a8ab4" stroke-width="1.5"/>
<path d="M -11 -6 L 11 -6 L 14 30 L -14 30 Z" fill="url(#wax3)" stroke="#8d7a80" stroke-width="1.3" opacity=".92"/>
<path d="M -8 4 L 8 4 M -9 14 L 9 14" stroke="#a1898f" stroke-opacity=".6" stroke-width="1.2"/>
<path d="M -13 -14 Q -15 -32 0 -34 Q 15 -32 13 -14 Q 0 -10 -13 -14 Z" fill="url(#night3)" stroke="#ab9ec6" stroke-width="1.5"/>
<path d="M -8 -24 Q 0 -28 8 -24 Q 6 -15 0 -14 Q -6 -15 -8 -24 Z" fill="#100d1c"/>
<circle cx="-3.6" cy="-21" r="1.6" fill="url(#ember3)"/><circle cx="3.6" cy="-21" r="1.6" fill="url(#ember3)"/>
<path d="M 17 -8 Q 32 -14 38 -26" stroke="url(#bronze3)" stroke-width="3"/>
<path d="M 33 -30 Q 42 -34 44 -25 Q 38 -20 33 -24 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.3"/>
<path d="M -17 -6 Q -30 0 -28 12" stroke="url(#cloak3)" stroke-width="3.6"/>
<path d="M -38 12 L -18 12 L -21 28 L -35 28 Z" fill="#4a3d55" stroke="url(#wax3)" stroke-width="1.5"/>
<path d="M -34 12 Q -28 4 -22 12" stroke="url(#wax3)" stroke-width="1.6"/>
<path d="M -32 10 L -32 4 M -28 9 L -28 2 M -24 10 L -24 5" stroke="url(#wax3)" stroke-width="1.6"/>
<circle cx="-28" cy="1" r="2" fill="url(#ember3)" filter="url(#softglow3)"/>
<path d="M -17 -12 Q -26 10 -21 34 L 21 34 Q 26 10 17 -12 Z" fill="url(#hatch3)"/>`);

/* Flamme creuse : bocal-lanterne vide. Allumée, elle tire ; éteinte, elle est
   un sceau. L'intérieur creux doit rester lisible dans les deux états. */
asset('hollowFlame',`
<ellipse cx="0" cy="36" rx="17" ry="4.2" fill="#0d0b18" opacity=".4"/>
<path d="M -6 -34 Q 0 -40 6 -34 Q 6 -29 0 -29 Q -6 -29 -6 -34 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.3"/>
<path d="M -14 -26 L 14 -26 L 12 -20 L -12 -20 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.4"/>
<path d="M -16 -20 Q -20 8 -14 28 L 14 28 Q 20 8 16 -20 Z" fill="url(#glass3)" stroke="#e8d6b0" stroke-width="1.6"/>
<path d="M -16 -20 Q -20 8 -14 28 L 14 28 Q 20 8 16 -20 Z" fill="url(#void3)" opacity=".55"/>
<path d="M -11 -14 Q -14 6 -10 22" stroke="#fff6dd" stroke-opacity=".45" stroke-width="1.6"/>
<path d="M 11 -12 Q 14 8 10 22" stroke="#fff6dd" stroke-opacity=".22" stroke-width="1.2"/>
<path d="M -17 28 L 17 28 L 15 34 L -15 34 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.4"/>
<path d="M 0 22 L 0 12" stroke="#f0dcb6" stroke-width="2.2"/>
<path d="M -6 4 Q 0 -6 6 4 Q 3 12 0 12 Q -3 12 -6 4 Z" stroke="#f4c98f" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="3 3"/>
<circle cx="0" cy="4" r="1.6" fill="#f4c98f" fill-opacity=".5"/>
<path d="M -16 -20 Q -20 8 -14 28 L 14 28 Q 20 8 16 -20 Z" fill="url(#hatch3)"/>`);

/* Chiffre sans nom : armure creuse en forme de zéro, cadran muet à la place du
   chiffre. Immunisé tant que son chiffre n'est pas celui de la mission. */
asset('unnamedDigit',`
<ellipse cx="0" cy="40" rx="20" ry="4.6" fill="#0d0b18" opacity=".45"/>
<path d="M 0 -34 Q 22 -34 22 -2 Q 22 32 0 32 Q -22 32 -22 -2 Q -22 -34 0 -34 Z" fill="url(#night3)" stroke="url(#gold3)" stroke-width="2.2"/>
<path d="M 0 -24 Q 13 -24 13 -2 Q 13 22 0 22 Q -13 22 -13 -2 Q -13 -24 0 -24 Z" fill="url(#void3)" stroke="#6d5f84" stroke-width="1.4"/>
<path d="M 0 -18 L 0 -14 M 10 -2 L 6 -2 M 0 14 L 0 10 M -10 -2 L -6 -2" stroke="url(#gold3)" stroke-width="1.4"/>
<path d="M 7 -12 L 5 -9 M 7 8 L 5 5 M -7 8 L -5 5 M -7 -12 L -5 -9" stroke="url(#gold3)" stroke-opacity=".6" stroke-width="1.1"/>
<circle cx="0" cy="-2" r="3" fill="url(#gold3)"/>
<path d="M 0 -2 L 5 -8" stroke="#fff5cc" stroke-width="1.3"/>
<path d="M -22 -14 L -32 -20 L -30 -6 Z M 22 -14 L 32 -20 L 30 -6 Z" fill="url(#night3)" stroke="url(#gold3)" stroke-width="1.3"/>
<path d="M -14 30 L -17 40 L -7 40 M 14 30 L 17 40 L 7 40" stroke="url(#gold3)" stroke-width="2.4"/>
<path d="M -18 -26 Q 0 -32 18 -26" stroke="#fff5cc" stroke-opacity=".35" stroke-width="1.3"/>
<path d="M 0 -34 Q 22 -34 22 -2 Q 22 32 0 32 Q -22 32 -22 -2 Q -22 -34 0 -34 Z" fill="url(#hatch3)"/>`);

/* Écho sans visage : ta propre silhouette, sans traits. Elle copie l'habitude
   dominante : le contour pointillé dit « ce n'est pas toi ». */
asset('facelessEcho',`
<ellipse cx="0" cy="40" rx="20" ry="4.4" fill="#0d0b18" opacity=".38"/>
<path d="M -18 -10 Q -30 12 -23 36 L -9 31 L 0 38 L 10 31 L 23 36 Q 30 12 18 -10 Z" fill="url(#cloak3)" fill-opacity=".9" stroke="#b9a7c9" stroke-width="1.5" stroke-dasharray="6 4"/>
<path d="M -13 -14 Q -15 -34 0 -36 Q 15 -34 13 -14 Q 0 -9 -13 -14 Z" fill="url(#night3)" stroke="#c0aed0" stroke-width="1.4"/>
<ellipse cx="0" cy="-22" rx="8" ry="10" fill="url(#salt3)" fill-opacity=".28" stroke="#d8c9e4" stroke-width="1.2"/>
<path d="M -14 -30 L 16 -30 L 6 -36 L -1 -46 L -7 -36 Z" fill="url(#night3)" stroke="#b9a7c9" stroke-width="1.4"/>
<path d="M -12 -31 L 13 -31" stroke="#dcbc7c" stroke-width="2.4"/>
<path d="M -18 -4 Q -32 4 -34 16" stroke="url(#cloak3)" stroke-width="3.4" stroke-opacity=".8"/>
<path d="M -38 20 L -20 14" stroke="url(#bronze3)" stroke-width="2.6"/>
<path d="M -40 12 L -44 22 L -36 22 Z" fill="url(#wax3)" fill-opacity=".6"/>
<path d="M 6 6 Q 14 16 10 28" stroke="#b9a7c9" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="4 4"/>
<path d="M -18 -10 Q -30 12 -23 36 L 23 36 Q 30 12 18 -10 Z" fill="url(#hatch3)"/>`);

/* ---------------- GARDIENS : silhouettes larges, hitboxes inchangées ------- */

/* La Veilleuse : veilleuse à cinq bras, jupe de verre, couronne de mèches. */
asset('veilleuse',`
<ellipse cx="0" cy="56" rx="34" ry="7" fill="#0d0b18" opacity=".45"/>
<path d="M -30 20 Q -40 46 -32 54 L 32 54 Q 40 46 30 20 Z" fill="url(#glass3)" stroke="#f0e2c0" stroke-width="1.7"/>
<path d="M -30 20 Q -40 46 -32 54 L 32 54 Q 40 46 30 20 Z" fill="url(#void3)" opacity=".4"/>
<path d="M -22 24 Q -28 44 -24 52 M 22 24 Q 28 44 24 52 M 0 22 L 0 52" stroke="#fff6dd" stroke-opacity=".3" stroke-width="1.4"/>
<path d="M -22 -14 Q -32 8 -26 22 Q 0 30 26 22 Q 32 8 22 -14 Z" fill="url(#cloak3)" stroke="#a99cc4" stroke-width="1.8"/>
<path d="M -26 18 Q -22 28 -17 19 Q -11 29 -6 19 Q 0 29 6 19 Q 12 29 17 19 Q 23 28 26 18" stroke="url(#wax3)" stroke-width="3"/>
<path d="M -16 -18 Q -18 -44 0 -48 Q 18 -44 16 -18 Q 0 -12 -16 -18 Z" fill="url(#night3)" stroke="#b9accf" stroke-width="1.7"/>
<path d="M -10 -30 Q 0 -36 10 -30 Q 8 -18 0 -17 Q -8 -18 -10 -30 Z" fill="#100d1c"/>
<circle cx="-4.6" cy="-27" r="2.2" fill="url(#ember3)"/><circle cx="4.6" cy="-27" r="2.2" fill="url(#ember3)"/>
<path d="M -22 -40 Q 0 -52 22 -40" stroke="url(#bronze3)" stroke-width="2.6"/>
<path d="M -20 -42 L -20 -50 M -10 -47 L -10 -55 M 0 -49 L 0 -58 M 10 -47 L 10 -55 M 20 -42 L 20 -50" stroke="url(#wax3)" stroke-width="2.6"/>
<path d="M -22 -8 Q -44 -14 -50 -30 M 22 -8 Q 44 -14 50 -30" stroke="url(#bronze3)" stroke-width="3.2"/>
<path d="M -56 -32 L -44 -32 L -46 -24 L -54 -24 Z M 44 -32 L 56 -32 L 54 -24 L 46 -24 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.3"/>
<path d="M -22 -14 Q -32 8 -26 22 Q 0 30 26 22 Q 32 8 22 -14 Z" fill="url(#hatch3)"/>`,true);

/* Le Sonneur sans battant : corps-cloche, bras-marteau, harnais de cordes.
   Il n'a plus de battant : celui de l'arène est l'objectif. */
asset('sonneur',`
<ellipse cx="0" cy="56" rx="34" ry="7" fill="#0d0b18" opacity=".45"/>
<path d="M -34 34 Q -32 -26 0 -40 Q 32 -26 34 34 Z" fill="url(#patina3)" stroke="#26403f" stroke-width="2.1"/>
<path d="M -36 34 L 36 34 L 33 44 L -33 44 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.8"/>
<path d="M -22 -14 Q -10 -30 0 -32" stroke="#e6f7ec" stroke-opacity=".45" stroke-width="2"/>
<path d="M -26 12 Q 0 18 26 12 M -30 24 Q 0 30 30 24" stroke="#1f3a3a" stroke-opacity=".55" stroke-width="1.6"/>
<path d="M -8 -40 Q 0 -50 8 -40 Q 8 -32 0 -32 Q -8 -32 -8 -40 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.5"/>
<path d="M -14 -8 Q 0 -14 14 -8 L 12 6 Q 0 12 -12 6 Z" fill="#12262a"/>
<circle cx="-6" cy="-2" r="2.4" fill="url(#cold3)"/><circle cx="6" cy="-2" r="2.4" fill="url(#cold3)"/>
<path d="M -34 -4 Q -52 6 -50 24" stroke="url(#patina3)" stroke-width="4"/>
<path d="M 34 -4 Q 54 2 56 -16" stroke="url(#patina3)" stroke-width="4"/>
<path d="M 48 -26 L 64 -26 L 64 -12 L 48 -12 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.6"/>
<path d="M 52 -22 L 60 -22 M 52 -16 L 60 -16" stroke="#3a2f3c" stroke-opacity=".6" stroke-width="1.2"/>
<path d="M -20 -30 Q -30 -46 -14 -54 M 20 -30 Q 30 -46 14 -54" stroke="url(#wax3)" stroke-width="2" stroke-opacity=".7"/>
<path d="M 0 44 L 0 50" stroke="#cf9f5f" stroke-width="3"/>
<path d="M -6 52 Q 0 46 6 52 Q 0 58 -6 52 Z" stroke="#8fa39b" stroke-width="1.4" stroke-dasharray="3 3"/>
<path d="M -34 34 Q -32 -26 0 -40 Q 32 -26 34 34 Z" fill="url(#hatch3)"/>`,true);

/* Le Passeur sans ombre : long manteau de rivage, perche, sablier dans la
   poitrine. Aucune ombre au sol — c'est son nom et sa mécanique. */
asset('passeur',`
<path d="M -26 -18 Q -40 14 -32 52 L -14 46 L 0 54 L 15 46 L 32 52 Q 40 14 26 -18 Z" fill="url(#steel3)" stroke="#93a9b8" stroke-width="1.9"/>
<path d="M -26 -18 Q 0 -8 26 -18 L 20 -30 L -20 -30 Z" fill="url(#night3)" stroke="#a3b7c4" stroke-width="1.5"/>
<path d="M -32 44 Q -26 54 -20 45 Q -12 55 -6 45 Q 2 55 8 45 Q 16 55 22 45 Q 28 54 32 44" stroke="url(#salt3)" stroke-width="2.6"/>
<path d="M -16 -30 Q -18 -54 0 -56 Q 18 -54 16 -30 Q 0 -24 -16 -30 Z" fill="url(#night3)" stroke="#a3b7c4" stroke-width="1.7"/>
<path d="M -10 -42 Q 0 -48 10 -42 Q 8 -30 0 -29 Q -8 -30 -10 -42 Z" fill="#0e1620"/>
<circle cx="-4.4" cy="-39" r="2" fill="url(#salt3)"/><circle cx="4.4" cy="-39" r="2" fill="url(#salt3)"/>
<path d="M -13 0 L 13 0 L 3 16 L 13 32 L -13 32 L -3 16 Z" fill="url(#glass3)" stroke="url(#salt3)" stroke-width="1.6"/>
<path d="M -10 2 L 10 2 L 2 14 Z" fill="url(#salt3)" fill-opacity=".85"/>
<path d="M -8 30 L 8 30 L 0 20 Z" fill="url(#salt3)" fill-opacity=".5"/>
<path d="M -15 -2 L 15 -2 M -15 34 L 15 34" stroke="url(#bronze3)" stroke-width="2.4"/>
<path d="M 30 -46 L 34 52" stroke="url(#bronze3)" stroke-width="3.4"/>
<path d="M 26 -50 Q 34 -58 40 -50 Q 34 -44 26 -50 Z" fill="url(#salt3)" stroke="#6f757c" stroke-width="1.3"/>
<path d="M -26 -6 Q -42 4 -40 20" stroke="url(#steel3)" stroke-width="4"/>
<path d="M -26 -18 Q -40 14 -32 52 L 32 52 Q 40 14 26 -18 Z" fill="url(#hatch3)"/>`,true);

/* La Cueilleuse de flammes : joug à trois lanternes, éteignoir démesuré,
   panier de mèches rendues. Elle prend ta flamme, pas ta vie. */
asset('cueilleuse',`
<ellipse cx="0" cy="56" rx="32" ry="7" fill="#0d0b18" opacity=".45"/>
<path d="M -26 -16 Q -38 14 -30 52 L 30 52 Q 38 14 26 -16 Z" fill="url(#cloak3)" stroke="#a99cc4" stroke-width="1.9"/>
<path d="M -16 -8 L 16 -8 L 21 46 L -21 46 Z" fill="url(#wax3)" stroke="#8d7a80" stroke-width="1.4" opacity=".9"/>
<path d="M -12 6 L 12 6 M -14 20 L 14 20 M -16 34 L 16 34" stroke="#a1898f" stroke-opacity=".55" stroke-width="1.3"/>
<path d="M -16 -20 Q -18 -46 0 -48 Q 18 -46 16 -20 Q 0 -14 -16 -20 Z" fill="url(#night3)" stroke="#b9accf" stroke-width="1.7"/>
<path d="M -10 -32 Q 0 -38 10 -32 Q 8 -20 0 -19 Q -8 -20 -10 -32 Z" fill="#100d1c"/>
<circle cx="-4.6" cy="-29" r="2.2" fill="url(#ember3)"/><circle cx="4.6" cy="-29" r="2.2" fill="url(#ember3)"/>
<path d="M -46 -34 L 46 -34" stroke="#cf9f5f" stroke-width="3"/>
<path d="M -34 -34 L -34 -24 M 0 -34 L 0 -26 M 34 -34 L 34 -24" stroke="url(#bronze3)" stroke-width="1.8"/>
<path d="M -42 -24 L -26 -24 L -28 -8 L -40 -8 Z M 26 -24 L 42 -24 L 40 -8 L 28 -8 Z" fill="url(#glass3)" stroke="url(#bronze3)" stroke-width="1.5"/>
<path d="M -26 -14 Q -44 -6 -46 10" stroke="url(#cloak3)" stroke-width="4"/>
<path d="M 26 -14 Q 48 -22 54 -40" stroke="url(#cloak3)" stroke-width="4"/>
<path d="M 48 -46 Q 62 -52 64 -40 Q 56 -32 48 -38 Z" fill="url(#bronze3)" stroke="#3a2f3c" stroke-width="1.5"/>
<path d="M -56 12 L -34 12 L -38 34 L -52 34 Z" fill="#4a3d55" stroke="url(#wax3)" stroke-width="1.6"/>
<path d="M -50 10 L -50 2 M -45 9 L -45 0 M -40 10 L -40 3" stroke="url(#wax3)" stroke-width="1.8"/>
<path d="M -26 -16 Q -38 14 -30 52 L 30 52 Q 38 14 26 -16 Z" fill="url(#hatch3)"/>`,true);

/* Le Chasseur sans visage : masque de porcelaine blanc, long manteau, lanterne
   du Veilleur. Il emprunte tes gestes : le halo tournant est son tell. */
asset('chasseur',`
<ellipse cx="0" cy="56" rx="32" ry="7" fill="#0d0b18" opacity=".4"/>
<path d="M -28 -18 Q -42 16 -34 54 L -16 47 L 0 55 L 17 47 L 34 54 Q 42 16 28 -18 Z" fill="url(#night3)" stroke="url(#gold3)" stroke-width="2"/>
<path d="M -28 -18 Q 0 -6 28 -18 L 22 -32 L -22 -32 Z" fill="url(#cloak3)" stroke="url(#gold3)" stroke-width="1.5"/>
<path d="M 0 -8 L 0 50" stroke="#dcbc7c" stroke-opacity=".55" stroke-width="1.6"/>
<path d="M -20 8 L -8 8 M 8 8 L 20 8 M -22 26 L -8 26 M 8 26 L 22 26" stroke="url(#gold3)" stroke-opacity=".35" stroke-width="1.3"/>
<path d="M -17 -32 Q -19 -56 0 -58 Q 19 -56 17 -32 Q 0 -26 -17 -32 Z" fill="url(#cloak3)" stroke="url(#gold3)" stroke-width="1.7"/>
<ellipse cx="0" cy="-42" rx="11" ry="13" fill="url(#salt3)" stroke="#8d8a80" stroke-width="1.5"/>
<path d="M -6 -46 Q 0 -49 6 -46" stroke="#b6b1a2" stroke-width="1.1"/>
<path d="M -4 -36 Q 0 -34 4 -36" stroke="#b6b1a2" stroke-width="1.1"/>
<path d="M -20 -52 L 20 -52 L 8 -57 L 0 -63 L -8 -57 Z" fill="url(#night3)" stroke="url(#gold3)" stroke-width="1.6"/>
<path d="M -17 -53 L 17 -53" stroke="#dcbc7c" stroke-width="2.6"/>
<path d="M -28 -8 Q -46 0 -48 18" stroke="url(#night3)" stroke-width="4.4"/>
<path d="M -56 20 L -40 20 L -42 38 L -54 38 Z" fill="url(#glass3)" stroke="url(#gold3)" stroke-width="1.6"/>
<path d="M -52 18 Q -48 10 -44 18" stroke="url(#gold3)" stroke-width="1.6"/>
<path d="M -48 34 Q -43 26 -48 20 Q -53 26 -48 34 Z" fill="url(#ember3)" filter="url(#softglow3)"/>
<path d="M 28 -8 Q 46 -2 48 14" stroke="url(#night3)" stroke-width="4.4"/>
<path d="M 44 16 L 52 12 L 54 22 L 46 24 Z" fill="url(#gold3)" stroke="#3b3040" stroke-width="1.3"/>
<path d="M -28 -18 Q -42 16 -34 54 L 34 54 Q 42 16 28 -18 Z" fill="url(#hatch3)"/>`,true);

/* ------------------------------ couches Canvas --------------------------- */
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

/* Derrière la silhouette : lumières portées et matières. Le halo de jeu du
   garde-mèche est dessiné par sixth-hour.js ; ici seulement son tapis de cire. */
function drawBehind(g,e,t){
 const k=e.kind;
 if(k==='wickWarden'){
  const halo=g.createRadialGradient(0,6,2,0,6,34);halo.addColorStop(0,'#ffd9a033');halo.addColorStop(1,'#ffd9a000');
  g.fillStyle=halo;g.fillRect(-34,-28,68,68);
 }else if(k==='waxCourier'){
  for(let i=0;i<3;i++){const a=t*.8+i*2.1,x=Math.cos(a)*26,y=-6+Math.sin(a*1.3)*10;
   g.save();g.globalAlpha=.32;g.translate(x,y);g.rotate(a*.4);polygon(g,[[-4,-3],[4,-3],[4,3],[-4,3]],'#f0dcb6');g.restore()}
 }else if(k==='bronzeCrow'){
  const flap=reduceMotion?.3:Math.sin(t*5.4)*.5;
  g.save();g.globalAlpha=.85;g.translate(12,-6);g.rotate(-flap*.5);
  polygon(g,[[0,0],[26,-6],[32,8],[6,10]],'#4d8079','#22403f',1.4);g.restore();
 }else if(k==='crackedBell'){
  if(e.twin&&!e.twin.dead){g.save();g.globalAlpha=.3;arc(g,0,0,32+Math.sin(t*3)*2,-.7,.7,'#cfe6d8',1.6);arc(g,0,0,32+Math.sin(t*3)*2,Math.PI-.7,Math.PI+.7,'#cfe6d8',1.6);g.restore()}
 }else if(k==='saltWalker'){
  g.save();g.globalAlpha=.3;for(let i=0;i<4;i++){const x=-18+i*12,y=40+Math.sin(t*2+i)*2;polygon(g,[[x,y-4],[x+3,y],[x,y+4],[x-3,y]],'#ece5d2')}g.restore();
 }else if(k==='printThief'){
  g.save();g.globalAlpha=.22;for(let i=0;i<3;i++){const y=30+i*9;g.beginPath();g.ellipse(-6+i*7,y,3,4.4,0,0,TAU);g.fillStyle='#e8dcc0';g.fill()}g.restore();
 }else if(k==='hollowFlame'&&e.lit){
  const halo=g.createRadialGradient(0,2,2,0,2,32);halo.addColorStop(0,'#f4c98f44');halo.addColorStop(1,'#f4c98f00');
  g.fillStyle=halo;g.fillRect(-32,-30,64,64);
 }else if(k==='unnamedDigit'){
  g.save();g.globalAlpha=.35;ticks(g,0,-2,28,t*.35,'#dcbc7c',16);g.restore();
 }else if(k==='facelessEcho'){
  g.save();g.globalAlpha=.18;g.setLineDash([5,5]);circle(g,Math.sin(t)*4,0,30,'','#b9a7c9',1.4);g.setLineDash([]);g.restore();
 }else if(k==='veilleuse'){
  const halo=g.createRadialGradient(0,-10,4,0,-10,62);halo.addColorStop(0,'#ffd9a02e');halo.addColorStop(1,'#ffd9a000');
  g.fillStyle=halo;g.fillRect(-62,-72,124,124);
 }else if(k==='sonneur'){
  if(e.ring>0){g.save();g.globalAlpha=.22;for(let i=1;i<4;i++)arc(g,0,0,34+i*12+Math.sin(t*4)*2,0,TAU,'#cfe6d8',1.4);g.restore()}
 }else if(k==='passeur'){
  g.save();g.globalAlpha=.22;for(let i=0;i<5;i++){const a=t*.5+i*1.26;circle(g,Math.cos(a)*40,20+Math.sin(a)*16,2.4,'#ece5d2')}g.restore();
 }else if(k==='cueilleuse'){
  const halo=g.createRadialGradient(0,-24,4,0,-24,56);halo.addColorStop(0,'#f4c98f26');halo.addColorStop(1,'#f4c98f00');
  g.fillStyle=halo;g.fillRect(-56,-80,112,112);
 }else if(k==='chasseur'&&e.halo){
  g.save();g.globalAlpha=.3;circle(g,0,0,44+Math.sin(t*2)*3,'','#fff0bd',1.8);g.restore();
 }
}

/* Devant : l'état de combat devient lisible sans toucher aux anneaux de jeu. */
function drawFront(g,e,t){
 const k=e.kind;
 if(k==='wickWarden'){flame(g,0,1,6,3.4);glow(g,0,-43,2.2,'#ffe6bd')}
 else if(k==='waxCourier'){glow(g,0,-43,2.4,'#ffe6bd');if(!reduceMotion)glow(g,18,20,1.6+Math.sin(t*3)*.5,'#e5854e')}
 else if(k==='bronzeCrow'){
  const flap=reduceMotion?.2:Math.sin(t*5.4)*.55;
  g.save();g.translate(-14,-4);g.rotate(flap);
  polygon(g,[[0,0],[-24,-8],[-30,6],[-4,8]],'#93c3ae','#22403f',1.4);
  line(g,-22,-4,-6,2,'#dff3e6',1);g.restore();
  glow(g,8,-12,1.5,'#f4fffa');
 }else if(k==='crackedBell'){
  const swing=reduceMotion?0:Math.sin(t*2.6)*.22;
  g.save();g.translate(0,29);g.rotate(swing);line(g,0,0,0,7,'#cf9f5f',2.4);circle(g,0,9,4.2,'#cf9f5f','#3a2f3c',1.2);g.restore();
  if(e.twin?.dead)glow(g,1,4,2.6,'#cfeadb');
 }else if(k==='saltWalker'){
  if(!reduceMotion)for(let i=0;i<3;i++){const p=(t*.7+i*.33)%1;g.save();g.globalAlpha=(1-p)*.7;glow(g,-10+i*10,-6+p*22,1.3,'#ffffff');g.restore()}
 }else if(k==='printThief'){
  const run=Math.min(3,e.dashRun||0);
  for(let i=0;i<run;i++)polygon(g,[[-10+i*10,18],[-6+i*10,22],[-10+i*10,26],[-14+i*10,22]],'#e8dcc0');
 }else if(k==='wickPicker'){
  glow(g,-28,1,2+Math.sin(t*3)*.5,'#ffdc9a');
  const sway=reduceMotion?0:Math.sin(t*1.8)*2;line(g,38,-26,40+sway,-32,'#cf9f5f',2);
 }else if(k==='hollowFlame'){
  if(e.lit){flame(g,0,3,9,5,'#f4c98f');glow(g,0,-2,2,'#fff8e0')}
  else{g.save();g.globalAlpha=.5;g.setLineDash([3,3]);circle(g,0,4,6,'','#f4c98f',1.2);g.setLineDash([]);g.restore()}
  if(e.seal){g.save();g.globalAlpha=.8;ticks(g,0,4,20,t*.2,'#f4c98f',8);g.restore()}
 }else if(k==='unnamedDigit'){
  const active=window.SixthHour?.mission?.digit===e.digit;
  g.save();g.globalAlpha=active?.9:.4;circle(g,0,-2,15,'',active?'#fff5cc':'#7c6a8f',1.4);g.restore();
  if(active)glow(g,0,-2,2.2,'#fff5cc');
 }else if(k==='facelessEcho'){
  g.save();g.globalAlpha=.5;g.setLineDash([4,4]);circle(g,0,-22,12,'','#d8c9e4',1.2);g.setLineDash([]);g.restore();
 }else if(k==='veilleuse'){
  const lit=(e.windows||[]).filter(w=>w.lit).length;
  for(let i=0;i<5;i++){const x=-20+i*10,y=i===2?-58:(i%2?-55:-50);
   if(i<lit)flame(g,x,y-3,5,2.6);else{g.save();g.globalAlpha=.4;line(g,x,y-4,x,y+1,'#6b5a7d',1.6);g.restore()}}
  flame(g,-50,-28,5,2.6);flame(g,50,-28,5,2.6);
 }else if(k==='sonneur'){
  const swing=reduceMotion?0:Math.sin(t*1.6)*.3;
  g.save();g.translate(34,-4);g.rotate(swing);line(g,0,0,20,-14,'#4d8079',3.6);g.restore();
  if(e.strikes>0)for(let i=0;i<e.strikes;i++)glow(g,-8+i*8,20,2,'#cfeadb');
 }else if(k==='passeur'){
  if(!reduceMotion){g.save();g.globalAlpha=.75;for(let i=0;i<4;i++){const p=(t*.9+i*.25)%1;circle(g,0,2+p*14,.9,'#ece5d2')}g.restore()}
  if(e.open>0){g.save();g.globalAlpha=.5;circle(g,0,16,22,'','#ece5d2',1.6);g.restore()}
  for(let i=0;i<(e.breaks||0);i++)glow(g,-8+i*8,40,2,'#ffffff');
 }else if(k==='cueilleuse'){
  const lamps=e.lanterns||[];
  if(lamps[0]?.lit)flame(g,-34,-16,5,2.8);
  if(lamps[2]?.lit)flame(g,34,-16,5,2.8);
  if(e.vulnerable>0){g.save();g.globalAlpha=.55;circle(g,0,4,34,'','#f4c98f',1.8);g.restore()}
  for(let i=0;i<(e.collected||0);i++)glow(g,-48+i*7,24,2,'#ffdc9a');
 }else if(k==='chasseur'){
  if(e.naming){g.save();g.globalAlpha=.6;circle(g,0,-42,16,'','#fff0bd',1.6);g.restore()}
  for(let i=0;i<(e.borrowed||0);i++)glow(g,-8+i*8,-14,2.2,'#fff0bd');
  flame(g,-48,26,5,2.8);
 }
}

function drawActor(g,e,x,y,scale=1,time=0,hit=0){
 if(window.Campaign?.activeWorld!==3||!e||!kinds.has(e.kind))return false;
 const image=window.MinuitArt?.[e.kind];if(!image?.complete||!image.naturalWidth)return false;
 const boss=bossKinds.has(e.kind),t=reduceMotion?0:time,seed=e.seed||e.seqSeed||0;
 const bw=boss?82:({bronzeCrow:74,hollowFlame:70,crackedBell:76}[e.kind]||78),bh=bw*image.naturalHeight/image.naturalWidth;
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
