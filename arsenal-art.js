/* Tableaux des capacités : personnages peints et effets lisibles, sans ressources externes. */
(()=>{
'use strict';
const meta={
 pulse:{tags:['◎ Autour de toi','18 s'],alt:'La sorcière au centre d’une large onde circulaire qui atteint les créatures proches.'},
 tidewave:{tags:['≈ Devant toi','14 s'],alt:'Une vague large part devant la sorcière et repousse les créatures.'},
 sunray:{tags:['│ Ligne étroite','18 s'],alt:'Un rayon vertical étroit frappe les créatures alignées devant la sorcière.'},
 bruyere:{tags:['◇ Équilibré','↻ 4 s'],alt:'Un balai stable entouré d’un anneau de protection.'},
 'comet-flight':{tags:['Clavier +12 %','↻ 5 s'],alt:'Un balai comète fonce avec un long sillage de vitesse.'},
 'aurora-flight':{tags:['↻ 3,2 s','Clavier −10 %'],alt:'Un balai aurore laisse plusieurs silhouettes pendant une esquive rapide.'},
 solo:{tags:['○ Vol libre'],alt:'La sorcière vole seule, sans compagnon de combat.'},
 'scout-owl':{tags:['Aimant 155','Recharge +15 %'],alt:'Une chouette attire les objets vers la sorcière dans un grand cercle.'},
 'hunter-bat':{tags:['Tir 2,5 s','Recharge +25 %'],alt:'Une chauve-souris compagnon tire un projectile vers une créature.'}
};
let serial=0;
function painting(name,x,y,w,h,transform='',opacity=1){
 const src=window.MinuitArt?.[name]?.src;
 return src?`<g transform="translate(${x} ${y}) ${transform}" opacity="${opacity}"><image href="${src}" x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></g>`:'';
}
function witch(x,y,w=90,transform='',opacity=1){return painting('witch',x,y,w,w*.923,transform,opacity)}
function ghost(x,y,w=32,transform='',opacity=1){return painting('ghost',x,y,w,w*1.043,transform,opacity)}
function bat(x,y,w=70,transform='',opacity=1){return painting('bat',x,y,w,w*.726,transform,opacity)}
function collectible(name,x,y,w=29,transform='',opacity=1){
 const src=window.CollectibleArt?.art?.[name]?.src;
 return src?`<g transform="translate(${x} ${y}) ${transform}" opacity="${opacity}"><image href="${src}" x="${-w/2}" y="${-w*.445}" width="${w}" height="${w*.89}" preserveAspectRatio="xMidYMid meet"/></g>`:'';
}
function spark(x,y,color,size=1,opacity=.9){return `<path d="M${x} ${y-4*size}L${x+1.2*size} ${y-1.2*size}L${x+4*size} ${y}L${x+1.2*size} ${y+1.2*size}L${x} ${y+4*size}L${x-1.2*size} ${y+1.2*size}L${x-4*size} ${y}L${x-1.2*size} ${y-1.2*size}Z" fill="${color}" opacity="${opacity}"/>`}
function owl(x,y,color,u){
 return `<g transform="translate(${x} ${y})">
  <ellipse cy="30" rx="28" ry="6" fill="#090a16" opacity=".38"/>
  <path d="M-11-15-20-34-3-25M11-15 20-34 3-25" fill="url(#feather-${u})" stroke="#d9c6b0" stroke-width="1.2"/>
  <path d="M-15-8Q-37-5-32 19L-17 12-11 28M15-8Q37-5 32 19L17 12 11 28" fill="url(#feather-${u})" stroke="#514255" stroke-width="1.5"/>
  <path d="M-28 3-17 8M-29 12-18 14M28 3 17 8M29 12 18 14" stroke="#ead9bd" stroke-opacity=".48" stroke-width="1.4"/>
  <ellipse cy="3" rx="20" ry="29" fill="url(#feather-${u})" stroke="#514255" stroke-width="1.5"/>
  <path d="M-13 9Q0 20 13 9L10 27 0 34-10 27Z" fill="#d9c5ab" opacity=".72"/>
  <path d="M-8 15 0 20 8 15M-7 23 0 28 7 23" fill="none" stroke="#7b6870" stroke-width="1.2"/>
  <path d="M-19-10Q-10-23 0-12 10-23 19-10L16 5 0 12-16 5Z" fill="#e7d7bd" stroke="#6c5764" stroke-width="1.2"/>
  <circle cx="-9" cy="-5" r="8" fill="#3a3047" stroke="${color}" stroke-width="1.5"/><circle cx="9" cy="-5" r="8" fill="#3a3047" stroke="${color}" stroke-width="1.5"/>
  <circle cx="-9" cy="-5" r="4.2" fill="url(#eye-${u})"/><circle cx="9" cy="-5" r="4.2" fill="url(#eye-${u})"/>
  <ellipse cx="-9" cy="-5" rx="1.8" ry="3.4" fill="#171526"/><ellipse cx="9" cy="-5" rx="1.8" ry="3.4" fill="#171526"/>
  <circle cx="-10" cy="-7" r="1.2" fill="#fff9dc"/><circle cx="8" cy="-7" r="1.2" fill="#fff9dc"/>
  <path d="M-4 4 0 11 4 4 0 1Z" fill="url(#gold-${u})" stroke="#795049" stroke-width=".7"/>
  <path d="M-8 31-11 35M-4 32-5 36M8 31 11 35M4 32 5 36" stroke="#d9b878" stroke-width="1.5"/>
 </g>`;
}
function variantOverlay(id,u,color){
 if(id==='ripple')return `<g fill="none" stroke="#efd8ff"><ellipse cx="120" cy="63" rx="103" ry="49" stroke-width="1.4" stroke-dasharray="3 6" opacity=".65"/><path d="M23 75Q120 123 217 75" stroke-width="2" opacity=".42"/></g>${spark(27,56,'#f2dcff',.8)}${spark(213,55,'#f2dcff',.8)}`;
 if(id==='shatter')return `<g fill="none" stroke="#ffe3a3" stroke-linecap="round"><path d="M120 84 84 2M120 84 120-2M120 84 156 2" stroke-width="2.2" opacity=".78"/><path d="M120 84 98 3M120 84 142 3" stroke-width="5" opacity=".12" filter="url(#glow-${u})"/></g>${spark(84,15,'#fff0bd',.9)}${spark(156,15,'#fff0bd',.9)}`;
 if(id==='surge')return `<g fill="none" stroke="#b9fff0" stroke-linecap="round" stroke-linejoin="round"><path d="M213 84Q177 108 136 88" stroke-width="3" opacity=".8"/><path d="M143 80 134 88 145 94" stroke-width="3"/></g>`;
 if(id==='rhythm')return `<g transform="translate(199 80)" fill="none" stroke="#f3d7a2" stroke-linecap="round"><circle r="15" fill="#191425" fill-opacity=".82" stroke-width="1.5"/><path d="M0-11V-15M11 0H15M0 11V15M-11 0H-15" stroke-width="1.5"/><path d="M0 0V-8M0 0 7 4" stroke-width="2.2"/><circle r="2" fill="#f3d7a2" stroke="none"/></g>`;
 return '';
}
function frame(item,content,variant=null){
 const u=(item.id||'art').replace(/[^a-z0-9-]/gi,'')+'-'+(++serial),color=item.color||'#d5b2ff';
 const baseLabel=meta[item.id]?.alt||item.name||'Illustration de la capacité',label=baseLabel+(variant?.name?' Variante '+variant.name+' : '+variant.desc:'');
 return `<svg class="arsenal-illustration" viewBox="0 0 240 112" role="img" aria-label="${safeText(label)}"${variant?.id?` data-art-variant="${safeText(variant.id)}"`:''}>
 <defs>
  <linearGradient id="night-${u}" x2=".85" y2="1"><stop stop-color="#0d1020"/><stop offset=".52" stop-color="#21182e"/><stop offset="1" stop-color="#342039"/></linearGradient>
  <radialGradient id="aura-${u}" cx=".52" cy=".48" r=".62"><stop stop-color="${color}" stop-opacity=".24"/><stop offset=".55" stop-color="${color}" stop-opacity=".06"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
  <linearGradient id="mist-${u}" x2="0" y2="1"><stop stop-color="#33243e" stop-opacity=".15"/><stop offset="1" stop-color="#100f20" stop-opacity=".94"/></linearGradient>
  <linearGradient id="beam-${u}" x2="0" y2="1"><stop stop-color="#fff8d5"/><stop offset=".36" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".08"/></linearGradient>
  <linearGradient id="trail-${u}"><stop stop-color="${color}" stop-opacity="0"/><stop offset=".65" stop-color="${color}" stop-opacity=".65"/><stop offset="1" stop-color="#f4ecff" stop-opacity=".9"/></linearGradient>
  <linearGradient id="feather-${u}" x2=".8" y2="1"><stop stop-color="#f0dfc5"/><stop offset=".42" stop-color="#aa9389"/><stop offset="1" stop-color="#4b4055"/></linearGradient>
  <linearGradient id="gold-${u}" x2=".7" y2="1"><stop stop-color="#fff0b5"/><stop offset=".5" stop-color="#d5a15c"/><stop offset="1" stop-color="#7b4b42"/></linearGradient>
  <radialGradient id="eye-${u}" cx=".35" cy=".25"><stop stop-color="#fffbd0"/><stop offset=".45" stop-color="#e9bc67"/><stop offset="1" stop-color="#9b5b45"/></radialGradient>
  <filter id="glow-${u}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="soft-${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <clipPath id="clip-${u}"><rect width="240" height="112" rx="11"/></clipPath>
 </defs>
 <g clip-path="url(#clip-${u})">
  <rect width="240" height="112" fill="url(#night-${u})"/><rect width="240" height="112" fill="url(#aura-${u})"/>
  <circle cx="202" cy="11" r="44" fill="${color}" opacity=".055"/><circle cx="202" cy="11" r="30" fill="none" stroke="${color}" stroke-opacity=".08"/>
  <g fill="#f8e7c0"><circle cx="18" cy="19" r="1" opacity=".65"/><circle cx="43" cy="10" r=".7" opacity=".5"/><circle cx="218" cy="54" r=".9" opacity=".5"/><circle cx="153" cy="12" r=".65" opacity=".55"/></g>
  <path d="M0 75 24 62 41 69 67 48 89 69 112 57 138 72 165 50 192 68 218 48 240 61V112H0Z" fill="#111322" opacity=".68"/>
  <path d="M0 91Q55 77 112 90T240 84V112H0Z" fill="url(#mist-${u})"/>
  ${content(u,color)}
  ${variantOverlay(variant?.id,u,color)}
  <path d="M0 105Q62 96 118 105T240 99V112H0Z" fill="#0d0e1b" opacity=".28"/>
 </g>
 <rect x=".5" y=".5" width="239" height="111" rx="10.5" fill="none" stroke="${color}" stroke-opacity=".15"/>
 </svg>`;
}
function illustration(item,variant=null){
 switch(item.id){
  case'pulse':return frame(item,(u,c)=>`
   <ellipse cx="120" cy="62" rx="84" ry="47" fill="${c}" opacity=".1" filter="url(#soft-${u})"/>
   ${ghost(68,33,30,'rotate(-8)',.82)}${ghost(172,33,30,'rotate(8)',.82)}${ghost(120,15,24,'',.68)}
   <ellipse cx="120" cy="63" rx="76" ry="43" fill="none" stroke="${c}" stroke-width="7" opacity=".13" filter="url(#glow-${u})"/>
   <ellipse cx="120" cy="63" rx="76" ry="43" fill="none" stroke="${c}" stroke-width="2" opacity=".82"/>
   <ellipse cx="120" cy="63" rx="59" ry="33" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 5" opacity=".4"/>
   <g stroke="${c}" stroke-width="1.3" opacity=".68"><path d="M44 63h10M186 63h10M120 20v8M120 98v7M66 32l7 5M167 89l7 5M66 94l7-5M167 37l7-5"/></g>
   ${witch(120,70,88)}
   <path d="M46 69Q120 113 194 69" fill="none" stroke="#eedbff" stroke-width="1.7" opacity=".68"/>
   ${spark(44,48,c,.75)}${spark(196,48,c,.75)}${spark(153,91,'#f4e6ff',.55)}
  `,variant);
  case'tidewave':return frame(item,(u,c)=>`
   <path d="M57 91Q118 9 219 39Q170 35 137 96Z" fill="${c}" opacity=".15"/>
   ${ghost(150,27,30,'rotate(12)',.78)}${ghost(198,41,26,'rotate(18)',.62)}
   ${witch(66,75,78,'rotate(-4)')}
   <path d="M49 85Q117 2 222 43" fill="none" stroke="${c}" stroke-width="12" opacity=".12" filter="url(#glow-${u})"/>
   <path d="M49 85Q117 2 222 43" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".85"/>
   <path d="M68 91Q126 27 207 57" fill="none" stroke="#d6fff4" stroke-width="1.8" stroke-linecap="round" opacity=".66"/>
   <path d="M92 91Q139 48 192 66" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 5" opacity=".55"/>
   <g fill="#d9fff5" opacity=".72"><circle cx="116" cy="37" r="2"/><circle cx="134" cy="26" r="1.4"/><circle cx="178" cy="31" r="1.7"/><circle cx="202" cy="43" r="1.2"/></g>
   ${spark(213,29,c,.65)}${spark(91,69,'#e6fff8',.55)}
  `,variant);
  case'sunray':return frame(item,(u,c)=>`
   <path d="M103-8H137L148 91H92Z" fill="${c}" opacity=".15" filter="url(#soft-${u})"/>
   <path d="M110-5H130L136 83H104Z" fill="url(#beam-${u})" opacity=".64"/>
   <rect x="116" y="-4" width="8" height="84" rx="4" fill="#fff4c4" opacity=".82" filter="url(#glow-${u})"/>
   <path d="M105 0 99 78M135 0 141 78" stroke="${c}" stroke-width="1.4" opacity=".55"/>
   ${ghost(120,20,32,'',.86)}
   <ellipse cx="120" cy="82" rx="41" ry="15" fill="none" stroke="${c}" stroke-width="1.5" stroke-dasharray="3 4" opacity=".55"/>
   ${witch(120,79,82)}
   <path d="M84 87Q120 105 156 87" fill="none" stroke="#ffe7ad" stroke-width="1.4" opacity=".55"/>
   ${spark(96,28,c,.8)}${spark(145,48,c,.65)}${spark(105,9,'#fff8d7',.65)}
  `,variant);
  case'bruyere':return frame(item,(u,c)=>`
   <circle cx="120" cy="59" r="48" fill="${c}" opacity=".08" filter="url(#soft-${u})"/>
   <circle cx="120" cy="59" r="45" fill="none" stroke="${c}" stroke-width="1.7" stroke-dasharray="4 5" opacity=".68"/>
   <circle cx="120" cy="59" r="37" fill="none" stroke="#f2dbac" stroke-width=".8" opacity=".25"/>
   <g stroke="${c}" stroke-width="1.5" opacity=".75"><path d="M120 10v8M120 100v7M71 59h9M160 59h9M85 24l6 6M149 88l6 6M85 94l6-6M149 30l6-6"/></g>
   <path d="M28 57H65M175 57H212M52 50l13 7-13 7M188 50l-13 7 13 7" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".65"/>
   ${witch(120,67,90)}
   <path d="M80 80Q120 111 160 80" fill="none" stroke="#f0d6a4" stroke-width="1.5" opacity=".5"/>
   ${spark(74,18,c,.65)}${spark(174,83,c,.55)}
  `,variant);
  case'comet-flight':return frame(item,(u,c)=>`
   <g fill="none" stroke="url(#trail-${u})" stroke-linecap="round"><path d="M-12 25Q48 12 111 36" stroke-width="5"/><path d="M-8 48Q50 34 105 50" stroke-width="3.5"/><path d="M-15 76Q48 63 105 65" stroke-width="4"/><path d="M7 94Q56 80 105 78" stroke-width="2"/></g>
   <g fill="${c}" opacity=".45"><circle cx="29" cy="36" r="2"/><circle cx="57" cy="64" r="1.5"/><circle cx="78" cy="24" r="1.3"/><circle cx="35" cy="87" r="1.2"/></g>
   <path d="M18 15 69 20M4 57 64 55M22 102 78 89" stroke="#e7faff" stroke-width="1" opacity=".4"/>
   ${witch(143,61,96,'rotate(-11)')}
   <path d="M192 24 214 15M197 35 224 32" stroke="${c}" stroke-width="2" stroke-linecap="round" opacity=".68"/>
   ${spark(198,23,'#ecfeff',1.15)}${spark(219,54,c,.55)}${spark(105,19,c,.55)}
  `,variant);
  case'aurora-flight':return frame(item,(u,c)=>`
   <path d="M-8 31Q47-4 105 20T248 8" fill="none" stroke="${c}" stroke-width="10" opacity=".09" filter="url(#soft-${u})"/>
   <path d="M-8 29Q47-4 105 20T248 8M-5 40Q52 8 109 30T245 20" fill="none" stroke="${c}" stroke-width="2" opacity=".32"/>
   ${witch(65,72,70,'rotate(-13)',.12)}${witch(103,65,80,'rotate(-9)',.25)}
   <ellipse cx="150" cy="60" rx="47" ry="43" fill="none" stroke="${c}" stroke-width="6" opacity=".1" filter="url(#glow-${u})"/>
   <path d="M177 92A45 40 0 1 1 190 35" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity=".78"/>
   <path d="M184 27 193 34 181 39" fill="none" stroke="#eadbff" stroke-width="2" stroke-linejoin="round"/>
   ${witch(150,63,88,'rotate(-5)')}
   ${spark(192,18,c,.75)}${spark(112,93,'#f0e3ff',.55)}
  `,variant);
  case'solo':return frame(item,(u,c)=>`
   <circle cx="120" cy="51" r="41" fill="${c}" opacity=".08"/><circle cx="120" cy="51" r="32" fill="none" stroke="${c}" stroke-opacity=".15"/>
   <g fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 5" opacity=".28"><circle cx="42" cy="57" r="18"/><circle cx="198" cy="57" r="18"/></g>
   <path d="M31 69 51 45M187 69 207 45" stroke="${c}" stroke-width="1" opacity=".15"/>
   ${witch(120,67,96)}
   <path d="M15 94Q54 82 88 94M152 94Q188 82 226 93" fill="none" stroke="#b9a7cc" stroke-width="2" opacity=".15"/>
   ${spark(42,25,c,.55)}${spark(200,28,c,.55)}${spark(179,15,'#f5e7ff',.45)}
  `,variant);
  case'scout-owl':return frame(item,(u,c)=>`
   <ellipse cx="116" cy="59" rx="96" ry="46" fill="${c}" opacity=".045"/>
   <ellipse cx="116" cy="59" rx="96" ry="46" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="4 5" opacity=".42"/>
   <path d="M203 30Q183 32 165 43M204 78Q183 72 165 63" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="3 4" opacity=".55"/>
   ${collectible('bonus-points',208,23,28,'rotate(8)',.9)}${collectible('bonus-pickup-shield',209,84,28,'rotate(-8)',.85)}
   ${witch(65,75,78,'rotate(-3)')}${owl(150,51,c,u)}
   ${spark(180,19,c,.55)}${spark(116,24,'#efffe9',.55)}${spark(192,61,c,.45)}
  `,variant);
  case'hunter-bat':return frame(item,(u,c)=>`
   ${ghost(207,23,30,'rotate(7)',.78)}
   <path d="M157 52Q179 36 199 28" fill="none" stroke="#ffd79a" stroke-width="7" opacity=".12" filter="url(#glow-${u})"/>
   <path d="M157 52Q179 36 199 28" fill="none" stroke="#ffe3aa" stroke-width="1.8" stroke-dasharray="4 3" opacity=".85"/>
   ${witch(64,76,78,'rotate(-3)')}${bat(145,54,70,'rotate(-5)')}
   <circle cx="184" cy="35" r="4" fill="#fff1bd" filter="url(#glow-${u})"/><circle cx="184" cy="35" r="1.7" fill="#fffbe4"/>
   ${spark(199,28,'#ffe5a5',.75)}${spark(113,24,c,.55)}${spark(211,65,c,.45)}
  `,variant);
  default:return frame(item,(u,c)=>`${witch(120,66,92)}${spark(181,28,c,.8)}`,variant);
 }
}
window.LoadoutArt={illustration,tags:id=>meta[id]?.tags||[],alt:id=>meta[id]?.alt||''};
})();
