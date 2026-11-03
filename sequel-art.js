/* Direction artistique animée des Cinq Heures Perdues. Aucun asset distant. */
(()=>{
'use strict';
const foes=['lampWisp','shadePostman','glassMite','glassShard','sunMirror','rootClock','timeLarva','railImp','sunLuggage','needleWraith','hourHollow','mirrorClone','riftAnchor','captiveSoul'];
const bosses=['lanternier','glassqueen','clockstag','conductor','clockmaker'];
const kinds=new Set([...foes,...bosses]),bossKinds=new Set(bosses);
const reduceMotion=!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TAU=Math.PI*2;

const defs=`<defs>
<linearGradient id="ink" x2=".8" y2="1"><stop stop-color="#536078"/><stop offset=".38" stop-color="#293148"/><stop offset="1" stop-color="#101625"/></linearGradient>
<linearGradient id="cloth" x2=".75" y2="1"><stop stop-color="#9b8ead"/><stop offset=".35" stop-color="#554b70"/><stop offset=".72" stop-color="#2b2d49"/><stop offset="1" stop-color="#171b30"/></linearGradient>
<linearGradient id="ivory" x2=".8" y2="1"><stop stop-color="#fff3cf"/><stop offset=".38" stop-color="#d6c7ad"/><stop offset=".72" stop-color="#887f83"/><stop offset="1" stop-color="#43465c"/></linearGradient>
<linearGradient id="brass" x2=".85" y2="1"><stop stop-color="#fff0b0"/><stop offset=".25" stop-color="#d9af68"/><stop offset=".55" stop-color="#8a5e4c"/><stop offset=".78" stop-color="#e0b978"/><stop offset="1" stop-color="#513b48"/></linearGradient>
<linearGradient id="silver" x2=".85" y2="1"><stop stop-color="#f2ffff"/><stop offset=".25" stop-color="#afd5da"/><stop offset=".55" stop-color="#657c99"/><stop offset=".8" stop-color="#d1e6df"/><stop offset="1" stop-color="#3b435f"/></linearGradient>
<linearGradient id="glass" x2=".8" y2="1"><stop stop-color="#efffff" stop-opacity=".88"/><stop offset=".28" stop-color="#9de0e4" stop-opacity=".55"/><stop offset=".62" stop-color="#776c9c" stop-opacity=".48"/><stop offset="1" stop-color="#c0eff0" stop-opacity=".7"/></linearGradient>
<linearGradient id="wood" x2=".8" y2="1"><stop stop-color="#b4976c"/><stop offset=".32" stop-color="#6c664e"/><stop offset=".68" stop-color="#344a42"/><stop offset="1" stop-color="#182e31"/></linearGradient>
<linearGradient id="leather" x2=".8" y2="1"><stop stop-color="#c1826e"/><stop offset=".4" stop-color="#794e5c"/><stop offset="1" stop-color="#342c43"/></linearGradient>
<radialGradient id="light"><stop stop-color="#fffef0"/><stop offset=".28" stop-color="#ffe8a2"/><stop offset=".62" stop-color="#e8a366"/><stop offset="1" stop-color="#9a5061"/></radialGradient>
<radialGradient id="mint"><stop stop-color="#f2ffe4"/><stop offset=".32" stop-color="#b9edce"/><stop offset=".7" stop-color="#5b9f94"/><stop offset="1" stop-color="#254c57"/></radialGradient>
<radialGradient id="ruby"><stop stop-color="#ffe4b5"/><stop offset=".25" stop-color="#f69b78"/><stop offset=".65" stop-color="#a94462"/><stop offset="1" stop-color="#39253f"/></radialGradient>
<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path d="M0 0V6" stroke="#fff4dc" stroke-opacity=".13" stroke-width="1"/></pattern>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
function asset(id,body,boss=false){
 const image=new Image(),view=boss?'-70 -65 140 130':'-56 -48 112 96';
 image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" fill="none" stroke-linecap="round" stroke-linejoin="round">${defs}${body}</svg>`);
 window.MinuitArt[id]=image;
}

/* Lueur : un réverbère-habitant, avec verre, cuivre et traîne de fumée. */
asset('lampWisp',`
<path d="M-17 14Q-29 25-20 39L-8 34 0 43 9 34 21 39Q28 25 16 14Z" fill="url(#ink)" stroke="#8394a7" stroke-width="1.4"/>
<path d="M-13 23Q-4 33 0 38M13 23Q5 31 2 37" stroke="#b5c4c3" stroke-opacity=".35"/>
<path d="M-27-14-19-28 0-36 20-28 28-14 20 19 0 29-21 18Z" fill="url(#brass)" stroke="#382f40" stroke-width="2"/>
<path d="M-18-13-12-23 0-27 12-23 19-13 14 13 0 21-14 13Z" fill="#152b3b" stroke="#fff0b7" stroke-width="1.3"/>
<path d="M-14-12-8-20-2-22-2 17-11 11ZM3-22 10-20 15-12 11 11 3 17Z" fill="url(#glass)" opacity=".7"/>
<path d="M0-27V22M-20-13H20M-16 15H16" stroke="url(#brass)" stroke-width="2.4"/>
<path d="M-30-16-18-30 0-39 19-30 31-16 19-18 0-31-19-18Z" fill="url(#ink)" stroke="#e5c384" stroke-width="1.7"/>
<path d="M-10-38Q-13-49 0-47 13-49 10-38" stroke="url(#brass)" stroke-width="3"/>
<path d="M-25-6Q-40-2-34 12L-23 17M25-6Q40-2 34 12L23 17" stroke="url(#brass)" stroke-width="3"/>
<path d="M0-11Q11 0 5 12L0 18-7 10Q-11 0 0-11Z" fill="url(#light)" filter="url(#glow)"/>
<path d="M-5 1-1-1M4-1 7 1" stroke="#593647" stroke-width="1.8"/>
<path d="M-26-11-20-23M20-24 26-12M-19 20-9 24" stroke="#fff0bd" stroke-opacity=".55" stroke-width="1.4"/>
<path d="M-27-14-19-28 0-36 20-28 28-14 20 19 0 29-21 18Z" fill="url(#hatch)"/>`);

/* Facteur : silhouette de cape, sacoche et courrier vivant. */
asset('shadePostman',`
<path d="M-18-12-34-2-45 24-30 20-38 38-16 31 0 42 15 31 38 38 30 19 45 24 34-3 18-12Z" fill="url(#cloth)" stroke="#9ca4b8" stroke-width="1.5"/>
<path d="M-30 2-22 23-30 31M30 2 22 23 30 31M-13 8-17 31M13 8 17 31" stroke="#d2c3c2" stroke-opacity=".32" stroke-width="1.2"/>
<path d="M-21-15Q-20-39 0-42 22-38 22-14L13 4 0 11-14 3Z" fill="url(#ink)" stroke="#c4b99e" stroke-width="1.8"/>
<path d="M-14-16Q0-30 15-16L10-2 0 4-10-3Z" fill="#0b1526"/>
<path d="M-9-11-3-9M4-9 10-12" stroke="#ffe9ac" stroke-width="2.6" filter="url(#glow)"/>
<path d="M-22-16 0-37 23-15M-18-22 0-28 18-22" stroke="#738097" stroke-width="1.4"/>
<path d="M-14 2 0 15 15 1M0 15V32" stroke="#c6b58f" stroke-width="1.5"/>
<path d="M-18-2-31 18-21 24-7 9M18-2 31 12 23 20 8 9" fill="url(#cloth)" stroke="#8792a9" stroke-width="1.4"/>
<path d="M-26 13-7 17-10 35-34 29Z" fill="url(#leather)" stroke="#e0bb83" stroke-width="1.5"/>
<path d="M-27 15-18 24-9 18" stroke="#f0d39b" stroke-width="1.3"/>
<rect x="13" y="8" width="27" height="18" rx="1.5" fill="#e9ddb9" stroke="#554458" stroke-width="1.4" transform="rotate(9 13 8)"/>
<path d="M15 10 27 21 39 12M21 12 30 18" stroke="#9a6c70" stroke-width="1.1"/>
<path d="M-34 27-24 30M24 31 31 34" stroke="#f1d69b" stroke-opacity=".5"/>`);

/* Mite : le corps est taillé comme un prisme ; les quatre ailes sont animées en Canvas. */
asset('glassMite',`
<path d="M0-35 11-19 9 10 0 36-10 10-11-19Z" fill="url(#glass)" stroke="#e8ffff" stroke-width="1.6"/>
<path d="M0-31V31M-9-16 8 7M9-16-8 7M-8 13 0 20 8 13" stroke="#fff0cf" stroke-opacity=".75" stroke-width="1"/>
<path d="M-9-20-20-28M9-20 20-28M-10-6-25-11M10-6 25-11M-8 10-23 22M8 10 23 22M-5 23-14 36M5 23 14 36" stroke="#c9edf0" stroke-width="1.6"/>
<path d="M-6-29-15-41M6-29 16-41" stroke="#e5d6b5" stroke-width="1.4"/>
<circle cx="-16" cy="-41" r="2" fill="#ffe3a2"/><circle cx="16" cy="-41" r="2" fill="#ffe3a2"/>
<path d="M-8-18Q0-25 8-18L6-8 0-4-6-8Z" fill="#26394e" stroke="#d9f7f3"/>
<ellipse cx="-3.5" cy="-15" rx="1.8" ry="2.7" fill="#fff2b9"/><ellipse cx="3.5" cy="-15" rx="1.8" ry="2.7" fill="#fff2b9"/>
<path d="M-5 4 0-2 5 4 0 12Z" fill="url(#light)" opacity=".8"/>
<path d="M-4-27 1-31M-7 1-4-7" stroke="white" stroke-opacity=".8" stroke-width="1.4"/>`);
asset('glassShard',`
<path d="M-7-40 17-11 8 35-4 43-15 6Z" fill="url(#glass)" stroke="#efffff" stroke-width="1.8"/>
<path d="M-5-31 7 24M-10 4 11-10M-2 22 7 14" stroke="#fff3d0" stroke-width="1.2"/>
<path d="M-4-28 2-20M9-5 12-10" stroke="white" stroke-width="2" opacity=".8"/>
<path d="M-4 43-13 34-8 22" fill="#6f81a0" stroke="#c9e5e7"/>`);

/* Miroir : cadre solaire, reflet fissuré et petit visage dans le verre. */
asset('sunMirror',`
<path d="M0-43 5-35 15-40 17-30 29-32 28-21 40-18 34-9 44 0 35 8 40 20 28 21 27 33 16 30 12 41 3 34-6 43-12 33-24 37-25 26-38 25-34 13-45 7-37-2-43-12-32-17-33-29-21-28-17-40-7-35Z" fill="url(#brass)" stroke="#4d3c4d" stroke-width="1.5"/>
<ellipse cy="-1" rx="27" ry="35" fill="url(#silver)" stroke="#fff0c0" stroke-width="1.7"/>
<ellipse cy="-1" rx="21" ry="29" fill="url(#glass)" stroke="#34485e" stroke-width="1.3"/>
<path d="M-15-19 13 18M-19-5 2 23M7-25-4-5 8 3 1 18" stroke="#f5ffff" stroke-opacity=".7" stroke-width="1.5"/>
<path d="M-9-7-3-5M5-5 11-8" stroke="#26334b" stroke-width="2.4"/>
<path d="M-5 7Q0 11 6 6" stroke="#655068" stroke-width="1.2"/>
<path d="M-18 28-12 39-3 34M18 28 13 39 4 34" stroke="url(#brass)" stroke-width="3"/>
<path d="M-19-23-12-28M19 15 23 7" stroke="white" stroke-opacity=".75" stroke-width="2"/>
<circle cx="34" cy="-27" r="5" fill="url(#light)" filter="url(#glow)"/>`);

/* Racine : un cadran vivant pris dans un tronc, avec branches et racines asymétriques. */
asset('rootClock',`
<path d="M-23 27-29 8-23-20-11-34 4-39 20-27 27-7 24 23 14 20 10 42 1 31-8 44-12 25-25 38Z" fill="url(#wood)" stroke="#b5b784" stroke-width="1.7"/>
<path d="M-20-24-34-35-39-27M-27-31-31-43M18-25 34-37 39-29M29-32 33-44M-25 3-43 12-39 23M25 2 43 11 39 23" stroke="url(#wood)" stroke-width="5"/>
<path d="M-37-35-44-39-40-29ZM34-36 43-40 40-29ZM-42 11-48 7-45 18Z" fill="#8fa66f" stroke="#cad29a"/>
<path d="M-15-29-10-15M17-24 11-11M-21 8-11 18M19 13 11 28M-5 27-7 38" stroke="#d1b47c" stroke-opacity=".45" stroke-width="1.5"/>
<circle cy="-4" r="21" fill="#172c32" stroke="url(#brass)" stroke-width="3"/>
<circle cy="-4" r="16.5" fill="#d7d0a9" fill-opacity=".16" stroke="#98b396" stroke-width="1"/>
<path d="M0-19V-16M0 8V11M-15-4H-12M12-4H15M-11-15-9-12M11-15 9-12M-11 7-9 4M11 7 9 4" stroke="#f3d99b" stroke-width="1.5"/>
<path d="M0-4-7-13M0-4 11-8" stroke="#ffe9ac" stroke-width="2"/>
<circle cy="-4" r="2.8" fill="#fff0b2"/>
<path d="M-19 25-29 42M16 24 28 40M-3 29 0 45" stroke="#897453" stroke-width="3.5"/>`);

/* Larve : chaque segment porte un petit cadran, avec une tête et des pattes lisibles. */
asset('timeLarva',`
<path d="M-40 19Q-50 2-37-13-23-30-5-24L15-29Q39-30 44-9 49 13 28 24L5 32-20 34Z" fill="url(#wood)" stroke="#c6d39f" stroke-width="1.7"/>
<path d="M-35-13-23 27M-17-23-7 32M3-26 12 28M21-25 30 20" stroke="#233d3b" stroke-width="3"/>
<path d="M-34-9-27-15M-14-17-7-22M7-19 14-23M-29 17-20 22M-7 20 1 25M14 16 21 20" stroke="#e2d6a5" stroke-opacity=".5" stroke-width="1.4"/>
<path d="M-33 25-40 39M-14 31-18 44M6 29 9 42M25 22 32 34" stroke="#a9bd8f" stroke-width="3"/>
<path d="M19-23Q40-28 44-7L39 10 26 16 15 5Z" fill="url(#ink)" stroke="url(#brass)" stroke-width="2"/>
<circle cx="30" cy="-7" r="10" fill="#d8d0a8" fill-opacity=".18" stroke="#e7cd8e"/>
<path d="M30-7 30-13M30-7 36-4" stroke="#fff0b0" stroke-width="1.6"/>
<circle cx="40" cy="-16" r="2.3" fill="#fff1ad" filter="url(#glow)"/>
<path d="M36-23 42-35M27-25 28-38" stroke="#b8c99b" stroke-width="1.7"/>
<circle cx="42" cy="-36" r="2" fill="#d7e4b0"/><circle cx="28" cy="-39" r="2" fill="#d7e4b0"/>`);

/* Lutin : petit contrôleur express, casquette démesurée et poinçon en main. */
asset('railImp',`
<path d="M-18 21-24 38-11 40-2 28M15 21 22 38 9 40 1 28" fill="url(#ink)" stroke="#c09275" stroke-width="1.5"/>
<path d="M-23 34-29 42-10 43-7 38M20 34 28 42 9 43 7 38" fill="#20283a" stroke="#d0a074"/>
<path d="M-22 25-20-10 0-22 21-9 24 26 7 22 0 31-8 22Z" fill="url(#leather)" stroke="#e0b17e" stroke-width="1.6"/>
<path d="M-14-4 0 7 15-5M0 7V25M-12 12H12" stroke="#f0cd91" stroke-width="1.5"/>
<path d="M-18-17-32-24-28-8-17-3M17-17 31-25 29-8 18-3" fill="#a97772" stroke="#e0b68b"/>
<path d="M-17-19Q0-35 18-19L13-2 0 5-14-3Z" fill="#a97870" stroke="#49364b" stroke-width="1.5"/>
<path d="M-9-11-3-9M5-9 11-12" stroke="#fff0ad" stroke-width="2.4"/>
<path d="M-4-2 1 1 6-2" stroke="#593748" stroke-width="1.3"/>
<path d="M-27-23-18-39 12-42 30-25 15-19-14-18Z" fill="url(#ink)" stroke="#e5ba7f" stroke-width="1.7"/>
<path d="M-18-39-2-48 15-41M-21-28 22-30" stroke="#788399" stroke-width="1.4"/>
<circle cx="3" cy="-33" r="5" fill="url(#light)"/>
<path d="M-20 0-37 15M20 0 36-10" stroke="#9e6c68" stroke-width="6"/>
<rect x="27" y="-16" width="24" height="17" rx="1.5" fill="#eddbaf" stroke="#4c3a4c" stroke-width="1.4" transform="rotate(-8 27 -16)"/>
<path d="M31-10H45M31-5H40" stroke="#97636a" stroke-width="1.3"/>
<path d="M-39 11-46 20-37 24-31 17Z" fill="url(#brass)" stroke="#4b3849"/>`);

/* Valise : cuir, coins laiton, souvenirs de voyage et serrure qui regarde le joueur. */
asset('sunLuggage',`
<path d="M-15-25-14-40Q0-47 14-40L15-25" stroke="url(#brass)" stroke-width="5"/>
<rect x="-39" y="-27" width="78" height="59" rx="10" fill="url(#leather)" stroke="#f0c187" stroke-width="2"/>
<rect x="-34" y="-22" width="68" height="49" rx="7" fill="url(#hatch)" stroke="#51384a"/>
<path d="M-39-6H39M-20-26V31M20-26V31" stroke="url(#brass)" stroke-width="3"/>
<path d="M-38-17-28-27H-15M38-17 28-27H15M-38 21-28 31H-15M38 21 28 31H15" stroke="#ffe0a0" stroke-width="2.5"/>
<path d="M-30 32-34 42-23 40M29 32 34 42 23 40" stroke="url(#brass)" stroke-width="4"/>
<rect x="-10" y="-14" width="20" height="20" rx="5" fill="#1b2839" stroke="#ffe0a0" stroke-width="1.8"/>
<path d="M-5-6-1-4M4-4 7-6" stroke="#fff1b0" stroke-width="2"/>
<path d="M0 0V4" stroke="#d5ae76" stroke-width="2"/>
<path d="M-31-18-20-20-17-11-29-8Z" fill="#7eb2ac" stroke="#e7d6a7" transform="rotate(-8 -31 -18)"/>
<path d="M22 11 31 7 34 17 25 21Z" fill="#d7b072" stroke="#ffe0a5"/>
<path d="M-27-15-22-13M26 14 30 13" stroke="#fff1c4"/>
<circle cx="29" cy="-16" r="5" fill="url(#light)"/>`);

/* Spectre : une aiguille habillée de haillons, avec un cadran à la place du visage. */
asset('needleWraith',`
<path d="M0-45 13-23 11-5 30 27 17 25 20 39 3 30-5 42-12 29-29 35-23 19-32 24-12-6-14-24Z" fill="url(#cloth)" stroke="#b9b4c6" stroke-width="1.5"/>
<path d="M0-39V34" stroke="url(#ivory)" stroke-width="3"/>
<path d="M-4-32 0-44 5-32M-19 15 0 24 20 14M-12 29-4 22M11 29 5 22" stroke="#e6cf9c" stroke-width="1.4"/>
<path d="M-13-23 0-33 14-22 10-5 0 3-11-5Z" fill="url(#ink)" stroke="url(#brass)" stroke-width="1.7"/>
<circle cy="-13" r="8.5" fill="#d9d4b3" fill-opacity=".16" stroke="#f0d49a"/>
<path d="M0-13V-19M0-13 5-10" stroke="#fff0b3" stroke-width="1.5"/>
<path d="M-12-1-31 9-42 3M12-1 31 9 42 3" stroke="url(#silver)" stroke-width="3"/>
<path d="M-42 3-35 0M42 3 35 0" stroke="#fff4cf" stroke-width="2"/>
<path d="M-20 19-26 31M19 18 25 30" stroke="#8f8da8" stroke-width="1.3"/>`);

/* Chiffre creux : une armure en forme de zéro, ouverte sur un petit ciel intérieur. */
asset('hourHollow',`
<path d="M-25-35 0-45 27-34 38-8 32 20 14 39 0 45-17 37-34 18-39-8Z M0-25C-17-24-20-8-16 8-13 24-5 29 1 28 13 26 18 11 16-5 14-20 8-26 0-25Z" fill="url(#ink)" fill-rule="evenodd" stroke="url(#brass)" stroke-width="2.4"/>
<path d="M-23-29 0-38 23-29M-31-9-24-11M31-9 24-11M-24 25-16 19M24 25 16 19" stroke="#e6cb96" stroke-width="1.5"/>
<path d="M0-19 9-7 6 13-3 21-11 5-8-11Z" fill="#101b30" stroke="#738ba2"/>
<path d="M-5-2H5M0-9V11" stroke="#ffe5a4" stroke-width="2.3" filter="url(#glow)"/>
<path d="M-32-17-47-27M32-17 47-27M-29 24-42 37M29 24 42 37" stroke="url(#brass)" stroke-width="4"/>
<path d="M-47-27-43-18M47-27 43-18M-42 37-32 36M42 37 32 36" stroke="#e8cb94" stroke-width="2"/>
<path d="M-7-37 0-40 7-37M-33 4-29 5M33 4 29 5" stroke="#fff0b8" stroke-width="2"/>`);

asset('mirrorClone',`
<path d="M0-44 30-30 40-5 32 27 0 43-33 27-40-5-30-30Z" fill="url(#silver)" stroke="#f4e6c5" stroke-width="1.8"/>
<path d="M0-36 24-25 31-4 25 21 0 34-25 21-31-4-24-25Z" fill="url(#glass)" stroke="#40536c" stroke-width="1.3"/>
<path d="M0-29V28M-24-18 22 18M23-19-21 19M-8-33 4-9-5 4 9 25" stroke="#f2ffff" stroke-opacity=".7" stroke-width="1.3"/>
<path d="M-10-9Q0-20 11-9L8 8 0 15-9 7Z" fill="#4c4c6a" fill-opacity=".65"/>
<path d="M-13-13-8-25 0-17 8-28 13-12" fill="url(#brass)" stroke="#fff0c4"/>
<path d="M-6-4-2-3M4-3 8-5" stroke="#fff3c4" stroke-width="1.6"/>
<path d="M-34 12-47 25M34 12 47 25" stroke="url(#silver)" stroke-width="3"/>`);
asset('riftAnchor',`
<circle cy="-13" r="29" fill="url(#ink)" stroke="url(#brass)" stroke-width="3"/>
<circle cy="-13" r="21" stroke="#9aabc0" stroke-width="1.5" stroke-dasharray="3 4"/>
<path d="M0-13V-29M0-13 13-5" stroke="#ffe3a1" stroke-width="2"/>
<path d="M0-38V32M-8-29H8" stroke="url(#brass)" stroke-width="5"/>
<path d="M-34 10Q-35 35 0 42 35 35 34 10L45 19Q43 45 0 47-43 45-45 19Z" fill="url(#brass)" stroke="#4d3c4c" stroke-width="1.5"/>
<path d="M-28 22Q-17 34 0 36M28 22Q17 34 0 36" stroke="#fff0b4" stroke-opacity=".5"/>
<path d="M-12-42Q-18-52-7-53M12-42Q18-52 7-53" stroke="#c9ab7c" stroke-width="3"/>
<circle cy="-13" r="4" fill="url(#light)" filter="url(#glow)"/>`);
asset('captiveSoul',`
<circle cy="-4" r="31" fill="#bce7df" fill-opacity=".1" stroke="#ffe4a4" stroke-width="1.8" stroke-dasharray="4 5"/>
<path d="M0-36 15-15 11 14 0 36-12 14-15-15Z" fill="url(#glass)" stroke="#fff1c1" stroke-width="1.6"/>
<path d="M0-27V26M-10-12 9 9M10-12-9 9" stroke="#fff" stroke-opacity=".45"/>
<path d="M0-15Q9-5 5 6L0 13-6 5Q-9-5 0-15Z" fill="url(#light)" filter="url(#glow)"/>
<path d="M-29 18-42 33M29 18 42 33" stroke="url(#brass)" stroke-width="3"/>
<circle cx="-42" cy="33" r="4" fill="#d8bc86"/><circle cx="42" cy="33" r="4" fill="#d8bc86"/>`);

/* GARDIENS — silhouettes plus larges, sans modification des hitboxes. */
asset('lanternier',`
<path d="M-24-9-44 4-51 32-36 28-42 55-19 48 0 61 19 48 42 55 36 28 51 32 43 3 24-9Z" fill="url(#cloth)" stroke="#c9b995" stroke-width="1.6"/>
<path d="M-33 3-25 35-35 48M33 3 25 35 35 48M-16 4-20 44M16 4 20 44" stroke="#ede0bc" stroke-opacity=".35" stroke-width="1.3"/>
<path d="M-24-8 0 8 25-9 18 19 0 31-19 18Z" fill="url(#ivory)" stroke="#51475a" stroke-width="1.5"/>
<path d="M-14 1 0 12 14 0M0 12V48M-12 28H12" stroke="#8a6c64" stroke-width="1.5"/>
<path d="M-18-24Q0-43 19-24L14-4 0 5-15-5Z" fill="url(#silver)" stroke="#41394e" stroke-width="1.7"/>
<path d="M-12-20 0-29 12-20 9-8 0-3-9-8Z" fill="#142a3a"/>
<path d="M-7-15 7-15" stroke="#fff4c2" stroke-width="3" filter="url(#glow)"/>
<path d="M-36-29 0-46 37-29 23-22-22-22Z" fill="url(#ink)" stroke="#f0d49a" stroke-width="1.8"/>
<path d="M-12-45 0-61 13-45 0-37Z" fill="url(#light)" stroke="#ffe5a4"/>
<path d="M-41-1-56 28M38-4 53 22" stroke="url(#silver)" stroke-width="7"/>
<path d="M-58 25-62 45M52 19 58 38" stroke="url(#brass)" stroke-width="3"/>
<path d="M42 22Q56 6 65 23L61 48 45 48Z" fill="url(#brass)" stroke="#fff0b6" stroke-width="1.6"/>
<path d="M47 25 53 17 60 25 57 42 49 42Z" fill="#193143"/>
<ellipse cx="53" cy="33" rx="7" ry="10" fill="url(#light)" filter="url(#glow)"/>
<path d="M-45 42-52 58M45 49 51 58" stroke="#e3c58e" stroke-width="2"/>
<path d="M-24-9-44 4-51 32-36 28-42 55-19 48 0 61 19 48 42 55 36 28 51 32 43 3 24-9Z" fill="url(#hatch)"/>`,true);

asset('glassqueen',`
<path d="M0 57-18 49-39 61-34 35-51 40-37 8-24-8 24-8 38 8 51 40 34 35 40 61 18 49Z" fill="url(#glass)" stroke="#e9ffff" stroke-width="1.6"/>
<path d="M0 54V13M-24-3 0 20 25-4M-35 14-15 33-20 51M35 14 15 33 20 51M-14 34 0 46 14 34" stroke="#fff1d0" stroke-opacity=".7" stroke-width="1.2"/>
<path d="M-25-5-43-17-53 4-45 25-32 18M25-5 43-17 53 4 45 25 32 18" fill="url(#glass)" stroke="#e7ffff" stroke-width="1.5"/>
<path d="M-47-7-39 13M47-7 39 13" stroke="white" stroke-opacity=".7" stroke-width="1.6"/>
<path d="M-18-28Q0-44 19-27L14-7 0 3-15-8Z" fill="url(#ivory)" stroke="#67536c" stroke-width="1.5"/>
<path d="M-17-28-22-44-11-39 0-52 11-39 23-45 18-26" fill="url(#silver)" stroke="#fff0cb" stroke-width="1.5"/>
<path d="M-26-34-21-58-8-43 1-64 12-43 28-59 23-31 10-36 0-45-11-35Z" fill="url(#glass)" stroke="#f4e5c6" stroke-width="1.6"/>
<path d="M-10-20-3-18M6-18 12-21" stroke="#55405e" stroke-width="2"/>
<path d="M-4-10Q0-7 5-11" stroke="#a76776" stroke-width="1.1"/>
<path d="M-10-4 0 5 11-5 7 9 0 15-8 8Z" fill="url(#silver)" stroke="#efffff"/>
<path d="M0 18 9 27 0 39-9 27Z" fill="url(#ruby)" stroke="#ffe5bd" stroke-width="1.2"/>
<path d="M-29 33-21 39M27 34 21 41M-9 49 0 54" stroke="white" stroke-opacity=".65" stroke-width="1.5"/>`,true);

asset('clockstag',`
<path d="M-26-3-41 14-45 46-29 39-33 59-12 48 0 61 13 48 34 59 29 39 45 46 41 13 25-4Z" fill="url(#wood)" stroke="#b8c798" stroke-width="1.6"/>
<path d="M-32 12-24 42M32 12 24 42M-14 6-18 45M14 6 18 45" stroke="#d0bd87" stroke-opacity=".45" stroke-width="1.4"/>
<path d="M-20-26-32-35-28-16M20-26 33-35 29-15" fill="url(#wood)" stroke="#d9c395" stroke-width="1.5"/>
<path d="M-18-29Q0-43 19-28L15-4 0 14-16-4Z" fill="url(#wood)" stroke="#e0c99b" stroke-width="1.7"/>
<path d="M-12-17-4-14M6-14 13-18" stroke="#fff0ac" stroke-width="2.5" filter="url(#glow)"/>
<path d="M0-8-5 1 0 6 6 1Z" fill="#172c34" stroke="#b9aa80"/>
<path d="M-12-31-29-47-35-62M-24-43-45-47-52-58M-18-37-17-57-24-64M-34-51-34-63M12-31 30-47 36-62M25-43 46-47 53-58M19-37 18-57 25-64M35-51 35-63" stroke="url(#brass)" stroke-width="4"/>
<path d="M-45-47-49-37M46-47 50-37M-18-54-9-58M18-54 9-58" stroke="#d8c58f" stroke-width="2"/>
<circle cx="-49" cy="-34" r="6" fill="#19333a" stroke="#e5ca8f"/><circle cx="50" cy="-34" r="6" fill="#19333a" stroke="#e5ca8f"/>
<path d="M-49-34V-38M-49-34-45-32M50-34V-38M50-34 54-32" stroke="#fff0b0"/>
<path d="M-25 3 0 17 26 2M0 17V48" stroke="#a9c59b" stroke-width="1.5"/>
<circle cy="31" r="16" fill="#142c35" stroke="url(#brass)" stroke-width="2.5"/>
<circle cy="31" r="11.5" stroke="#89aa96" stroke-dasharray="2 3"/>
<path d="M0 31V20M0 31 10 35" stroke="#ffe6a5" stroke-width="2"/>
<circle cy="31" r="3" fill="#fff0b0"/>
<path d="M-38 21-49 27-42 35M38 21 49 27 42 35" fill="#799673" stroke="#c8d69f"/>`,true);

asset('conductor',`
<path d="M-27-7-44 6-48 35-35 30-39 56-17 48 0 60 18 48 40 56 35 30 49 35 43 5 26-8Z" fill="url(#cloth)" stroke="#d3aa7e" stroke-width="1.6"/>
<path d="M-35 6-28 38M35 6 28 38M-17 4-20 44M17 4 20 44" stroke="#bda5b5" stroke-opacity=".4"/>
<path d="M-21-5 0 11 22-6 16 23 0 34-17 22Z" fill="url(#leather)" stroke="#e5bc84" stroke-width="1.4"/>
<path d="M-13 0 0 11 14 0M0 11V47M-14 26H14" stroke="#f0cc8f" stroke-width="1.7"/>
<path d="M-22-4-34-11M22-4 34-11" stroke="url(#brass)" stroke-width="6"/>
<path d="M-34-14-38-5M-29-14-33-5M34-14 38-5M29-14 33-5" stroke="#fff0b4" stroke-width="1.4"/>
<path d="M-17-31Q0-45 18-30L13-9 0 0-14-10Z" fill="#b68173" stroke="#4c3a4f" stroke-width="1.5"/>
<path d="M-10-22-3-20M5-20 12-23" stroke="#fff0b0" stroke-width="2.4"/>
<path d="M-4-11 1-8 6-12" stroke="#5a3549" stroke-width="1.3"/>
<path d="M-32-34-20-51 18-51 34-34 16-28-17-28Z" fill="url(#ink)" stroke="#e5ba80" stroke-width="1.8"/>
<path d="M-20-51 0-63 20-51M-27-39 27-39" stroke="#7f8299" stroke-width="1.5"/>
<path d="M-8-48H8V-36H-8Z" fill="url(#brass)" stroke="#ffe3a2"/>
<path d="M-4-45H4M0-45V-39" stroke="#3b3548" stroke-width="1.5"/>
<path d="M-41 2-55 29M38 1 53-18" stroke="#63506a" stroke-width="8"/>
<path d="M-57 27-62 45  -52 47-48 31Z" fill="url(#brass)" stroke="#f0d6a2"/>
<circle cx="54" cy="-22" r="13" fill="url(#silver)" stroke="#fff0bd" stroke-width="1.6"/>
<circle cx="54" cy="-22" r="9" fill="#253248"/>
<path d="M54-22V-29M54-22 61-19" stroke="#ffe4a4" stroke-width="1.7"/>
<path d="M-12 15 12 15M-9 19H9" stroke="#342d43" stroke-width="2"/>
<circle cy="35" r="5" fill="url(#light)"/>`,true);

asset('clockmaker',`
<circle cy="-17" r="57" fill="#182235" fill-opacity=".45" stroke="url(#brass)" stroke-width="3"/>
<circle cy="-17" r="48" stroke="#8d94aa" stroke-width="1.5" stroke-dasharray="3 5"/>
<path d="M0-17V-57M0-17 36-2M0-17-32-42" stroke="#d7bd88" stroke-width="2.5"/>
<path d="M-25-4-43 8-49 37-36 31-40 58-18 49 0 62 19 49 41 58 36 31 50 37 43 7 25-5Z" fill="url(#cloth)" stroke="#d0b182" stroke-width="1.6"/>
<path d="M-34 8-27 42M34 8 27 42M-16 3-20 45M16 3 20 45" stroke="#dcc393" stroke-opacity=".35"/>
<path d="M-22-4 0 13 23-5 17 22 0 34-17 22Z" fill="url(#ink)" stroke="url(#brass)" stroke-width="1.5"/>
<path d="M-14 2 0 13 14 1M0 13V50M-13 29H13" stroke="#d9ba83" stroke-width="1.5"/>
<path d="M-17-31Q0-45 18-30L13-8 0 2-14-9Z" fill="url(#ivory)" stroke="#4c3d50" stroke-width="1.5"/>
<path d="M-10-22-3-20M5-20 12-23" stroke="#fff0b0" stroke-width="2.3"/>
<circle cx="8" cy="-21" r="7" stroke="url(#brass)" stroke-width="1.8"/>
<path d="M14-17 23-9" stroke="#d7b77f" stroke-width="1.5"/>
<path d="M-7-10Q0-5 8-11M-6-7 0-12 7-7" stroke="#6e4655" stroke-width="1.2"/>
<path d="M-30-35 0-57 31-34 18-27-18-27Z" fill="url(#ink)" stroke="#e7c58a" stroke-width="1.7"/>
<path d="M-13-47 0-61 14-46" stroke="#8d8da0" stroke-width="1.4"/>
<path d="M-40 3-56 29M39 3 56 29M-29 17-48 42M29 17 48 42" stroke="#62566b" stroke-width="7"/>
<circle cx="-56" cy="32" r="10" fill="url(#brass)" stroke="#fff0b5"/><circle cx="56" cy="32" r="10" fill="url(#brass)" stroke="#fff0b5"/>
<circle cx="-48" cy="44" r="6" fill="url(#silver)"/><circle cx="48" cy="44" r="6" fill="url(#silver)"/>
<path d="M-56 32V26M-56 32-50 35M56 32V25M56 32 61 37" stroke="#263248" stroke-width="1.6"/>
<circle cy="34" r="12" fill="#17283a" stroke="url(#brass)" stroke-width="2"/>
<path d="M0 34V25M0 34 8 39M-7 34H7" stroke="#ffe5a4" stroke-width="1.7"/>
<path d="M-24-4-43 8-49 37-36 31-40 58-18 49 0 62 19 49 41 58 36 31 50 37 43 7 25-5Z" fill="url(#hatch)"/>`,true);

function circle(g,x,y,r,fill,stroke='',width=1){g.beginPath();g.arc(x,y,r,0,TAU);if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}}
function line(g,x1,y1,x2,y2,color,width=1){g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
function polygon(g,points,fill,stroke='',width=1){g.beginPath();g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.closePath();if(fill){g.fillStyle=fill;g.fill()}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke()}}
function arc(g,x,y,r,start,end,color,width=1){g.beginPath();g.arc(x,y,r,start,end);g.strokeStyle=color;g.lineWidth=width;g.stroke()}
function spark(g,x,y,r,color){polygon(g,[[x,y-r],[x+r*.3,y-r*.3],[x+r,y],[x+r*.3,y+r*.3],[x,y+r],[x-r*.3,y+r*.3],[x-r,y],[x-r*.3,y-r*.3]],color)}
function clockRing(g,x,y,r,angle,color,count=12){g.save();g.translate(x,y);g.rotate(angle);circle(g,0,0,r,'',color,1.1);for(let i=0;i<count;i++){const a=i*TAU/count;line(g,Math.cos(a)*(r-3),Math.sin(a)*(r-3),Math.cos(a)*r,Math.sin(a)*r,color,i%3?1:1.7)}g.restore()}
function glow(g,x,y,r,color){g.save();g.shadowColor=color;g.shadowBlur=7;circle(g,x,y,r,color);g.restore()}

function drawBehind(g,e,t){
 const k=e.kind,phase=e.phase||1,seed=e.seqSeed||0;
 if(k==='lampWisp'){
  circle(g,0,1,26,'#ffd8890b');for(let i=0;i<3;i++){const a=t*1.8+i*TAU/3+seed;spark(g,Math.cos(a)*29,Math.sin(a)*17,2.2,'#ffe7a6aa')}
 }else if(k==='shadePostman'){
  g.save();g.globalAlpha=.18;g.translate(-Math.sin(t*2+seed)*5,4);polygon(g,[[-18,-13],[-35,24],[-12,20],[0,35],[15,20],[34,25],[18,-13]],'#9ca8c0');g.restore();
  const a=t*.9+seed;g.save();g.translate(Math.cos(a)*31,18+Math.sin(a)*8);g.rotate(a);g.fillStyle='#e9dbb788';g.fillRect(-6,-4,12,8);line(g,-6,-4,0,1,'#8c6877',.8);line(g,6,-4,0,1,'#8c6877',.8);g.restore();
 }else if(k==='glassMite'){
  const flap=reduceMotion?0:Math.sin(t*17+seed)*.22,span=1+flap;
  g.save();g.scale(1,span);for(const side of [-1,1]){
   polygon(g,[[side*7,-15],[side*38,-31],[side*31,-3],[side*10,5]],'#91dfe34a','#dffcff',1.1);
   polygon(g,[[side*8,1],[side*33,9],[side*25,30],[side*7,17]],'#779fd34a','#c9f4f2',1);
   line(g,side*10,-11,side*31,-24,'#fff4d488',.8);line(g,side*10,5,side*26,19,'#fff4d466',.8);
  }g.restore();
 }else if(k==='glassShard'){
  line(g,-8,20,-16,36,'#bcecf088',2);line(g,5,19,1,39,'#fff0c066',1);
 }else if(k==='sunMirror'){
  g.save();g.rotate(t*.16+seed);for(let i=0;i<8;i++){const a=i*TAU/8;spark(g,Math.cos(a)*38,Math.sin(a)*35,2.2,i%2?'#ffe2a088':'#d8ffff77')}g.restore();
 }else if(k==='rootClock'){
  for(let i=0;i<3;i++){const a=t*.45+i*2.1+seed,x=Math.cos(a)*34,y=Math.sin(a)*21;g.save();g.translate(x,y);g.rotate(a);polygon(g,[[0,-4],[3,0],[0,5],[-3,0]],'#a9c68c88');g.restore()}
 }else if(k==='timeLarva'){
  g.save();g.globalAlpha=.16;for(let i=1;i<4;i++)circle(g,-i*8,Math.sin(t*3-i)*3,17-i*2,'#b9d7a5');g.restore();
 }else if(k==='railImp'){
  const wave=Math.sin(t*6+seed)*4;g.beginPath();g.moveTo(-13,-8);g.bezierCurveTo(-30,-12,-29+wave,4,-44,1+wave);g.bezierCurveTo(-31,11,-28,1,-12,2);g.fillStyle='#b56d7188';g.fill();line(g,-40,2+wave,-30,5,'#efbd8a88',1);
 }else if(k==='sunLuggage'&&e.seqOpened){
  for(let i=0;i<7;i++){const a=i*TAU/7+t*.3;line(g,Math.cos(a)*31,Math.sin(a)*24,Math.cos(a)*43,Math.sin(a)*34,'#ffd79488',1.5)}
 }else if(k==='needleWraith'){
  g.save();g.rotate(Math.sin(t*1.7+seed)*.22);line(g,-37,17,37,-17,'#b6dfe555',5);line(g,-37,17,37,-17,'#fff0c088',1);g.restore();
 }else if(k==='hourHollow'){
  clockRing(g,0,0,39,-t*.3+seed,'#d9c08a77',12);for(let i=0;i<3;i++){const a=t*.45+i*TAU/3;g.fillStyle='#d9e4df88';g.font='bold 7px Georgia';g.textAlign='center';g.fillText(['XII','III','VI'][i],Math.cos(a)*43,Math.sin(a)*35+2)}
 }else if(k==='mirrorClone'){
  g.save();g.globalAlpha=.18;g.translate(Math.sin(t+seed)*5,0);polygon(g,[[0,-37],[29,-20],[25,22],[0,37],[-25,22],[-29,-20]],'#c8f6f1','#efffff',1);g.restore();
 }else if(k==='riftAnchor'){
  g.save();g.rotate(t*.22);for(let i=0;i<5;i++){const a=i*TAU/5;g.save();g.translate(Math.cos(a)*38,Math.sin(a)*31);g.rotate(a);g.strokeStyle='#e2c28a77';g.lineWidth=1.5;g.strokeRect(-4,-7,8,14);g.restore()}g.restore();
 }else if(k==='lanternier'){
  const color=phase===3?'#dd9c78':phase===2?'#ffe1a0':'#b7d9d5';circle(g,26,16,22+phase*2,color+'12');
  for(let i=0;i<phase+1;i++){const a=t*(phase===3?-1:1)*.7+i*TAU/(phase+1);spark(g,26+Math.cos(a)*28,16+Math.sin(a)*22,2.5,color+'bb')}
  if(phase===3){circle(g,0,-14,27,'#080e1dbb','#f0c58a99',1.5);arc(g,0,-14,31,t*.2,t*.2+Math.PI*1.4,'#ffe0a088',2)}
 }else if(k==='glassqueen'){
  const count=2+phase*2;for(let i=0;i<count;i++){const a=t*(phase===3?-.35:.35)+i*TAU/count,r=42+phase*2,x=Math.cos(a)*r,y=Math.sin(a)*31;g.save();g.translate(x,y);g.rotate(a+Math.PI/2);polygon(g,[[0,-7],[4,0],[0,9],[-4,0]],phase===3?'#f5c4ce88':'#b8edf088','#efffff',.8);g.restore()}
  if(phase===3)for(let i=0;i<3;i++)arc(g,0,0,47+i*3,i*2.1+t*.1,i*2.1+t*.1+1.1,'#d6f6f088',1);
 }else if(k==='clockstag'){
  if(phase>=2){g.save();g.globalAlpha=.12;g.translate(-Math.sin(t*2)*9,2);for(const side of [-1,1]){line(g,side*8,-16,side*28,-36,'#b8efd4',3);line(g,side*25,-33,side*39,-39,'#b8efd4',2)}g.restore()}
  for(let i=0;i<phase;i++){const a=t*.55+i*TAU/phase;clockRing(g,Math.cos(a)*43,Math.sin(a)*27,5,-t,'#d7e7b088',6)}
  if(phase===3)for(const side of [-1,1]){line(g,side*20,26,side*34,45,'#d8f0c088',3);line(g,side*27,24,side*43,38,'#d8f0c055',2)}
 }else if(k==='conductor'){
  if(phase>=2)for(let i=0;i<phase+1;i++){const a=t*.5+i*TAU/(phase+1),x=Math.cos(a)*45,y=Math.sin(a)*30;g.save();g.translate(x,y);g.rotate(a);g.fillStyle='#ead8ac99';g.fillRect(-7,-4,14,8);line(g,-4,-1,4,-1,'#8f5f6b',1);g.restore()}
  if(phase===3){for(let i=0;i<3;i++)circle(g,-25+i*25,38+Math.sin(t*3+i)*3,8+i*2,'#d6b08a18');line(g,-43,39,43,39,'#e5bb8066',2)}
 }else if(k==='clockmaker'){
  const reverse=window.SequelBestiary?.timeReversing?-1:1;
  clockRing(g,0,-8,40,reverse*t*(phase===2?-.35:.25),'#ecd39a88',12);
  if(phase>=2)clockRing(g,0,-8,46,-reverse*t*.42,'#a9c9d088',8);
  if(phase===3){clockRing(g,0,-8,52,t*.55,'#efc79366',16);for(const side of [-1,1])clockRing(g,side*42,20,9,side*t,'#d5c18a99',8)}
 }
 if(e.boss&&e.phaseFlash>0){const alpha=Math.min(1,e.phaseFlash)*.55;circle(g,0,0,42+(1.45-e.phaseFlash)*20,'',`rgba(255,232,177,${alpha})`,2)}
}

function drawFront(g,e,t){
 const k=e.kind,phase=e.phase||1,pulse=.72+.28*Math.sin(t*5+(e.seqSeed||0));
 if(k==='lampWisp'){
  g.save();g.globalAlpha=pulse;glow(g,0,3,3.2,'#fff4c2');g.restore();
 }else if(k==='shadePostman'){
  line(g,-6,-7,-2,-6,'#fff0b8',1.5);line(g,3,-6,7,-8,'#fff0b8',1.5);
 }else if(k==='glassMite'){
  spark(g,0,3,3.5,'#fff0bbaa');if(e.fire<.7)circle(g,0,-12,12,'','#fff0b088',1);
 }else if(k==='glassShard'){
  spark(g,2,-15,3,'#ffffffaa');
 }else if(k==='sunMirror'){
  g.save();g.globalAlpha=.55+.3*Math.sin(t*2);line(g,-12,-17,9,12,'#ffffff',1.5);spark(g,19,-23,3,'#fff0b5');g.restore();
  if(e.hp/e.max<.6){line(g,-3,-22,4,-7,'#f5ffff',1);line(g,4,-7,-5,4,'#f5ffff',1);line(g,4,-7,12,2,'#f5ffff',1)}
 }else if(k==='rootClock'){
  const a=t*.3;line(g,0,-2,Math.cos(a)*8,Math.sin(a)*8-2,'#fff0b2',1.4);circle(g,0,-2,1.8,'#fff2bd');
 }else if(k==='timeLarva'){
  glow(g,18,-5,1.8,'#fff0af');for(let i=0;i<3;i++)arc(g,-19+i*13,2,5,t+i,t+i+2.7,'#d8e4b088',.8);
 }else if(k==='railImp'){
  if(e.fire<.7){spark(g,19,-7,4,'#fff0b5');line(g,15,-13,23,-2,'#ffe2a088',1)}
 }else if(k==='sunLuggage'&&e.seqOpened){
  circle(g,0,-4,20,'#ffcb7718');g.save();g.translate(0,-14);g.rotate(-.48);g.beginPath();g.rect(-30,-15,60,19);g.fillStyle='#6e4557';g.fill();g.strokeStyle='#f1c28a';g.lineWidth=1.6;g.stroke();line(g,-19,-14,-19,3,'#d4a56f',2);line(g,19,-14,19,3,'#d4a56f',2);g.restore();
  polygon(g,[[-27,-12],[0,-22],[27,-12],[21,1],[-21,1]],'#172438','#ffc98c',1);glow(g,0,-7,3,'#ffe5a4');
 }else if(k==='needleWraith'){
  spark(g,0,-24,3.2,'#fff0bd');if(e.fire<.7)arc(g,0,0,31,-1.2,.2,'#ffe2a0',2);
 }else if(k==='hourHollow'){
  spark(g,0,1,4.5,'#fff0b8');g.save();g.globalAlpha=.5;circle(g,0,1,12,'','#b7d9df',1);g.restore();
 }else if(k==='mirrorClone'){
  line(g,-7,-20,2,-4,'#ffffffbb',1.2);line(g,2,-4,-5,12,'#ffffff88',1.2);spark(g,13,-18,2.5,'#fff0c2');
 }else if(k==='riftAnchor'){
  circle(g,0,-7,5,'#fff0b51a','#ffe2a0',1);spark(g,0,-7,3,'#fff2bd');
 }else if(k==='lanternier'){
  const c=phase===3?'#f0a078':phase===2?'#ffe1a0':'#fff3c2';glow(g,26,17,3.5,c);
  if(phase>=2){arc(g,26,17,12,t,t+Math.PI*1.5,c,1.3);line(g,20,10,31,24,'#fff0bb66',1)}
  if(phase===3){circle(g,0,-8,7,'#11182a','#f2c58b',1);arc(g,0,-8,10,t,-t+2.4,'#ffe0a0',1.5)}
 }else if(k==='glassqueen'){
  spark(g,0,12,4+phase,'#ffe0c2');if(phase>=2){line(g,-8,-18,-2,-7,'#efffff',1);line(g,-2,-7,-8,3,'#efffff',1);line(g,14,4,6,14,'#efffff',1)}if(phase===3){line(g,6,14,14,23,'#ffe2d0',1);line(g,-18,14,-9,27,'#ffe2d0',1)}
 }else if(k==='clockstag'){
  const a=t*(phase===3?-1.4:.5);line(g,0,15,Math.cos(a)*7,15+Math.sin(a)*7,'#fff0b0',1.3);circle(g,0,15,1.8,'#fff2bc');
  if(phase>=2){glow(g,-5,-7,1.5,'#d7ffd5');glow(g,5,-7,1.5,'#d7ffd5')}if(phase===3)for(const side of [-1,1])spark(g,side*24,-24,3,'#e5efaf');
 }else if(k==='conductor'){
  glow(g,1,-17,2.2,'#ffe5a4');if(phase>=2){g.fillStyle='#f1ddba';g.fillRect(-12,7,24,3);for(let x=-9;x<10;x+=6)line(g,x,7,x,10,'#8f5e68',.8)}if(phase===3){circle(g,0,17,6,'#d85f50','#ffd395',1);glow(g,0,17,2.5,'#fff0b0')}
 }else if(k==='clockmaker'){
  const dir=window.SequelBestiary?.timeReversing?-1:(phase===2?-1:1),a=t*dir;
  line(g,0,-8,Math.cos(a)*17,-8+Math.sin(a)*17,'#fff0b0',1.4);line(g,0,-8,Math.cos(-a*.6+1)*12,-8+Math.sin(-a*.6+1)*12,'#c5e1dd',1.1);circle(g,0,-8,2,'#fff0b2');
  if(phase>=2){line(g,-12,7,-4,16,'#e5c28b',1);line(g,-4,16,-10,25,'#e5c28b',1)}if(phase===3){glow(g,-25,16,2,'#ffe2a0');glow(g,25,16,2,'#ffe2a0')}
 }
 // Les dégâts laissent des marques persistantes, sans changer la silhouette de collision.
 if(e.boss&&Number.isFinite(e.hp)&&Number.isFinite(e.max)&&e.max>0){
  const damage=1-e.hp/e.max;if(damage>.32){g.save();g.globalAlpha=.65;line(g,-19,4,-12,12,k==='glassqueen'?'#efffff':'#e3b68b',1);line(g,-12,12,-18,20,k==='glassqueen'?'#efffff':'#e3b68b',1);g.restore()}
  if(damage>.65){g.save();g.globalAlpha=.75;line(g,18,-1,11,8,'#f0c69a',1.2);line(g,11,8,17,17,'#f0c69a',1.2);spark(g,-23,25,2.2,'#e8c296');g.restore()}
 }
 if(e.seqLink&&!e.seqLink.dead&&e.fire>0&&e.fire<.7)arc(g,0,0,35,-Math.PI/2,-Math.PI/2+TAU*(1-e.fire/.7),'#ffe2a0',1.5);
}

function drawActor(g,e,x,y,scale=1,time=0,hit=0){
 if(window.Campaign?.activeWorld!==2||!e||!kinds.has(e.kind))return false;
 const image=window.MinuitArt?.[e.kind];if(!image?.complete||!image.naturalWidth)return false;
 const boss=bossKinds.has(e.kind),t=reduceMotion?0:time,bw=boss?78:({glassShard:58,captiveSoul:68}[e.kind]||78),bh=bw*image.naturalHeight/image.naturalWidth;
 const bob=reduceMotion?0:Math.sin(t*(e.kind==='glassMite'?4:2)+(e.seqSeed||0))*(boss?1.2:1.5);
 g.save();g.translate(x,y);g.scale(scale,scale);g.lineCap='round';g.lineJoin='round';
 g.save();g.translate(0,bob);drawBehind(g,e,t);g.restore();
 g.save();g.translate(0,bob);g.rotate(reduceMotion?0:Math.sin(t*2+(e.seqSeed||0))*(boss?.018:.035));if(hit)g.filter='brightness(1.65) saturate(.7)';
 g.drawImage(image,-bw/2,-bh*.52,bw,bh);g.filter='none';drawFront(g,e,t);g.restore();g.restore();return true;
}

window.SequelArt={drawActor,isSequelKind:k=>kinds.has(k),isBossKind:k=>bossKinds.has(k),get kinds(){return[...kinds]}};
})();
