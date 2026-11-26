'use client';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {introVolume,playIntroSounds,resumeAudio,type IntroSounds} from '@/lib/sounds';

/** Duração total da abertura (todas as animações usam o mesmo relógio de 8 s; os % das keyframes são ms/80). */
export const INTRO_MS=8000;

/** O álbum fechado em miniatura, com a capa de verdade. */
function MiniAlbum({cover}:{cover:ReactNode}){
 return <span className="dm-in-album-body"><span className="dm-in-album-cover">{cover}</span><i className="dm-in-album-pages"/><i className="dm-in-album-spine"/></span>;
}

/** Caixa de papelão da Zangraf (abas, fita e etiqueta). */
function Box({big=false}:{big?:boolean}){
 return <span className={'dm-in-box'+(big?' is-big':'')}>
  <i className="dm-in-flap left"/><i className="dm-in-flap right"/>
  <span className="dm-in-box-front">
   <i className="dm-in-tape"/>
   <span className="dm-in-label">
    <img src="/brand/zangraf.png" alt="" draggable={false}/>
    <b>CORREIOS · SEDEX</b>
    <i className="dm-in-barcode"/>
   </span>
   <i className="dm-in-fragile">FRÁGIL · ÁLBUM</i>
  </span>
 </span>;
}

/**
 * Dentro da fábrica da Zangraf (1600×900 = a cena inteira, sempre 16:9): galpão com janelões e raios de sol,
 * treliça de aço, luminárias industriais acesas, faixa com a logo, relógio correndo, prateleira de tintas,
 * palete de papel, mesa de expedição e piso de concreto com a faixa de segurança.
 */
function FactoryInside(){
 const font="'Montserrat','Arial',sans-serif";
 const inks=['#00aeef','#ec008c','#f5c400','#231f20','#f47b20','#7b3fa0','#19b33a','#00aeef','#ec008c'];
 return <svg className="dm-in-inside" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true">
  <defs>
   <linearGradient id="fiWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9d4ca"/><stop offset="1" stopColor="#ece7dd"/></linearGradient>
   <linearGradient id="fiSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd0f2"/><stop offset="1" stopColor="#d9f0fb"/></linearGradient>
   <linearGradient id="fiFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9a7a1"/><stop offset="1" stopColor="#c4c1b9"/></linearGradient>
   <linearGradient id="fiRay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff8d6" stopOpacity=".55"/><stop offset="1" stopColor="#fff8d6" stopOpacity="0"/></linearGradient>
   <linearGradient id="fiCone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff3b8" stopOpacity=".55"/><stop offset="1" stopColor="#fff3b8" stopOpacity="0"/></linearGradient>
   <radialGradient id="fiPool" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#fff6cf" stopOpacity=".5"/><stop offset="1" stopColor="#fff6cf" stopOpacity="0"/></radialGradient>
   <linearGradient id="fiSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#1f4f7a"/><stop offset=".5" stopColor="#2f6da3"/><stop offset="1" stopColor="#1f4f7a"/></linearGradient>
   <linearGradient id="fiWrap" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" stopOpacity=".55"/><stop offset=".5" stopColor="#ffffff" stopOpacity=".1"/><stop offset="1" stopColor="#ffffff" stopOpacity=".45"/></linearGradient>
  </defs>
  {/* parede de galpão com painéis */}
  <rect width="1600" height="680" fill="url(#fiWall)"/>
  {Array.from({length:40},(_,i)=><rect key={'p'+i} x={i*40} y="210" width="3" height="470" fill="#00000010"/>)}
  <rect y="560" width="1600" height="120" fill="#5c6670"/>
  <rect y="556" width="1600" height="6" fill="#f2c200"/>
  {/* janelões no alto e raios de sol */}
  {[60,380,700,1020,1340].map(x=><g key={'w'+x}><rect x={x} y="78" width="230" height="104" rx="4" fill="url(#fiSky)" stroke="#8b939b" strokeWidth="6"/>{[1,2,3].map(k=><rect key={k} x={x+k*57.5-2} y="78" width="4" height="104" fill="#8b939b"/>)}<rect x={x} y="128" width="230" height="4" fill="#8b939b"/><path d={`M${x+8} 86 L${x+60} 86 L${x+8} 140Z`} fill="#ffffff60"/></g>)}
  <g className="dm-in-rays">{[60,380,700,1020,1340].map(x=><path key={'r'+x} d={`M${x+20} 182 L${x+210} 182 L${x+330} 680 L${x+90} 680Z`} fill="url(#fiRay)"/>)}</g>
  {/* treliça de aço do telhado */}
  <rect y="30" width="1600" height="22" fill="#3b4048"/><rect y="196" width="1600" height="16" fill="#3b4048"/>
  <path d={Array.from({length:21},(_,i)=>`M${i*80} 52 L${i*80+40} 196 L${i*80+80} 52`).join(' ')} stroke="#4b525c" strokeWidth="7" fill="none"/>
  <rect x="0" y="0" width="1600" height="30" fill="#2a2e34"/>
  {/* colunas azuis */}
  {[14,1556].map(x=><g key={'c'+x}><rect x={x} y="40" width="30" height="640" fill="url(#fiSteel)"/><rect x={x-6} y="40" width="42" height="10" fill="#1a3d5e"/><rect x={x-6} y="670" width="42" height="10" fill="#1a3d5e"/></g>)}
  {/* faixa da Zangraf pendurada na treliça */}
  <path d="M1262 212 L1290 248 M1518 212 L1490 248" stroke="#3b4048" strokeWidth="3"/>
  <g className="dm-in-banner"><rect x="1250" y="246" width="300" height="150" rx="6" fill="#fff" stroke="#d6d0c4" strokeWidth="2"/>
   <image href="/brand/zangraf.png" x="1268" y="258" width="264" height="112" preserveAspectRatio="xMidYMid meet"/>
   {['#e8221e','#19b33a','#f5e21a','#1aa8e8','#e81aa5'].map((c,i)=><rect key={c} x={1250+i*60} y="382" width="60" height="14" fill={c}/>)}</g>
  {/* relógio de parede (o tempo voa) */}
  <g transform="translate(748 338)"><circle r="40" fill="#fff" stroke="#3b4048" strokeWidth="7"/>{Array.from({length:12},(_,i)=><rect key={i} x="-1.5" y="-36" width="3" height={i%3?6:10} fill="#3b4048" transform={`rotate(${i*30})`}/>)}
   <rect className="dm-in-hour" x="-2.5" y="-20" width="5" height="22" rx="2" fill="#3b4048"/><rect className="dm-in-minute" x="-1.5" y="-32" width="3" height="34" rx="1.5" fill="#e8221e"/><circle r="4" fill="#3b4048"/></g>
  {/* prateleira de tintas */}
  <rect x="40" y="320" width="420" height="10" fill="#5c6670"/><rect x="48" y="330" width="8" height="40" fill="#5c6670"/><rect x="444" y="330" width="8" height="40" fill="#5c6670"/>
  {inks.map((c,i)=><g key={'k'+i}><rect x={58+i*44} y="266" width="34" height="54" rx="4" fill={c}/><rect x={58+i*44} y="266" width="34" height="9" rx="3" fill="#ffffff70"/><rect x={64+i*44} y="286" width="22" height="18" rx="2" fill="#fff"/><rect x={68+i*44} y="291" width="14" height="2.5" fill="#bbb"/><rect x={68+i*44} y="296" width="10" height="2.5" fill="#bbb"/></g>)}
  {/* placa de segurança */}
  <g transform="translate(700 226)"><rect width="96" height="58" rx="5" fill="#19b33a"/><text x="48" y="24" textAnchor="middle" fill="#fff" fontFamily={font} fontSize="13" fontWeight="800">FEITO COM</text><text x="48" y="44" textAnchor="middle" fill="#fff" fontFamily={font} fontSize="15" fontWeight="800">CARINHO ♥</text></g>
  {/* luminárias industriais com cone de luz */}
  {([[250,16],[560,54],[870,54]] as const).map(([x,drop],i)=>{const y=212+drop+22;return <g key={'l'+x}><rect x={x-1.5} y="212" width="3" height={drop} fill="#2a2e34"/>
   <g className={i===2?'dm-in-flicker':undefined}><path d={`M${x-90} 680 L${x-26} ${y} L${x+26} ${y} L${x+90} 680Z`} fill="url(#fiCone)"/><ellipse cx={x} cy="700" rx="150" ry="26" fill="url(#fiPool)"/></g>
   <path d={`M${x-34} ${y} L${x-16} ${y-24} L${x+16} ${y-24} L${x+34} ${y}Z`} fill="#2f6da3"/><ellipse cx={x} cy={y} rx="20" ry="5" fill="#fff7cc"/></g>;})}
  {/* piso de concreto com faixa de segurança */}
  <rect y="680" width="1600" height="220" fill="url(#fiFloor)"/>
  <rect y="680" width="1600" height="6" fill="#8d8a83"/>
  {Array.from({length:9},(_,i)=><rect key={'f'+i} x={i*200} y="686" width="2" height="214" fill="#00000012"/>)}
  <rect y="842" width="1600" height="14" fill="#f2c200"/>
  {Array.from({length:40},(_,i)=><path key={'s'+i} d={`M${i*40} 856 L${i*40+14} 842 L${i*40+28} 842 L${i*40+14} 856Z`} fill="#25261f"/>)}
  {/* palete com resmas de papel embaladas */}
  <g transform="translate(1440 560)"><rect x="0" y="108" width="140" height="14" fill="#a87442"/><rect x="8" y="122" width="16" height="10" fill="#8a5d33"/><rect x="62" y="122" width="16" height="10" fill="#8a5d33"/><rect x="116" y="122" width="16" height="10" fill="#8a5d33"/>
   {[0,1,2,3].map(r=><rect key={r} x="6" y={84-r*26} width="128" height="24" fill={r%2?'#f6f4ef':'#fff'} stroke="#d4d0c6"/>)}<rect x="6" y="6" width="128" height="102" fill="url(#fiWrap)"/><rect x="40" y="56" width="60" height="18" fill="#2f6da3"/><text x="70" y="69" textAnchor="middle" fill="#fff" fontFamily={font} fontSize="11" fontWeight="700">PAPEL</text></g>
 </svg>;
}

/**
 * HP Indigo 12000 (impressora digital da Zangraf): alimentador com a pilha de papel à esquerda,
 * corpo principal com a janela dos cilindros girando, latas de tinta, monitor no braço
 * e o empilhador à direita, onde as lâminas impressas vão se acumulando.
 */
function Printer(){
 const font="'Montserrat','Arial',sans-serif",inks=['#00aeef','#ec008c','#f5c400','#231f20','#f47b20','#7b3fa0','#19b33a'];
 return <svg className="dm-in-printer" viewBox="0 0 480 190" aria-hidden="true">
  <defs>
   <linearGradient id="inBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="#dfe2e6"/></linearGradient>
   <linearGradient id="inBase" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3f47"/><stop offset="1" stopColor="#23272d"/></linearGradient>
   <linearGradient id="inWin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1d2a36"/><stop offset="1" stopColor="#0d141b"/></linearGradient>
   <linearGradient id="inScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f5f8c"/><stop offset="1" stopColor="#08324d"/></linearGradient>
   <clipPath id="inOut"><rect x="352" y="0" width="128" height="104"/></clipPath>
   <clipPath id="inWinClip"><rect x="160" y="40" width="150" height="62" rx="8"/></clipPath>
  </defs>
  {/* chão / sombra */}
  <ellipse cx="240" cy="182" rx="236" ry="7" fill="#00000026"/>
  {/* alimentador: corpo e bandeja com a pilha de papel */}
  <rect x="8" y="70" width="86" height="104" rx="6" fill="url(#inBody)" stroke="#c9ced5"/>
  <rect x="8" y="140" width="86" height="34" rx="4" fill="url(#inBase)"/>
  {[0,1,2].map(n=><rect key={'lift'+n} className={'dm-in-lift l'+n} x="2" y="110" width="60" height="2.5" fill="#fff" stroke="#d4d4cc" strokeWidth=".4"/>)}
  <g className="dm-in-pile"><rect x="0" y="112" width="62" height="20" rx="1.5" fill="#fff" stroke="#d4d4cc"/>{[116,120,124,128].map(y=><rect key={y} x="1" y={y} width="60" height=".8" fill="#e2dfd6"/>)}</g>
  <rect x="0" y="132" width="66" height="5" rx="2" fill="#8d949e"/>
  {/* corpo principal */}
  <path d="M86 174 V44 Q86 20 112 20 H330 Q352 20 352 44 V174 Z" fill="url(#inBody)" stroke="#c9ced5"/>
  <rect x="86" y="124" width="266" height="50" fill="url(#inBase)"/>
  <rect x="86" y="118" width="266" height="4" fill="#00a3e0" className="dm-in-glow"/>
  {/* janela com o cilindro de imagem (PIP) e a blanqueta girando */}
  <rect x="160" y="40" width="150" height="62" rx="8" fill="url(#inWin)" stroke="#9aa3ad"/>
  <g clipPath="url(#inWinClip)">
   <g className="dm-in-drum" style={{transformOrigin:'205px 71px'}}><circle cx="205" cy="71" r="26" fill="#2c3540"/>{inks.slice(0,4).map((c,i)=><path key={c} d={`M205 71 L${205+26*Math.cos(i*Math.PI/2)} ${71+26*Math.sin(i*Math.PI/2)} A26 26 0 0 1 ${205+26*Math.cos((i+1)*Math.PI/2)} ${71+26*Math.sin((i+1)*Math.PI/2)}Z`} fill={c} opacity=".85"/>)}<circle cx="205" cy="71" r="7" fill="#9aa3ad"/></g>
   <g className="dm-in-drum rev" style={{transformOrigin:'262px 71px'}}><circle cx="262" cy="71" r="22" fill="#3d4652"/><rect x="240" y="69" width="44" height="4" fill="#5d6874"/><rect x="260" y="49" width="4" height="44" fill="#5d6874"/><circle cx="262" cy="71" r="6" fill="#9aa3ad"/></g>
   <rect className="dm-in-laser" x="232" y="40" width="3" height="62" fill="#7fd6ff" opacity=".8"/>
   <rect x="160" y="40" width="150" height="20" fill="#ffffff12"/>
  </g>
  {/* marca e modelo */}
  <image href="/brand/hp-logo.png" x="98" y="30" width="22" height="22"/>
  <text x="98" y="68" fill="#4b525c" fontFamily={font} fontSize="10" fontWeight="700">Indigo</text>
  <text x="98" y="81" fill="#4b525c" fontFamily={font} fontSize="10" fontWeight="700">12000</text>
  <text x="98" y="92" fill="#8d949e" fontFamily={font} fontSize="5" letterSpacing=".5">DIGITAL PRESS</text>
  {/* latas de tinta na frente */}
  {inks.map((c,i)=><g key={c}><rect x={104+i*14} y="132" width="10" height="16" rx="2" fill={c} stroke="#ffffff55"/><rect x={104+i*14} y="132" width="10" height="3" rx="1" fill="#ffffff66"/></g>)}
  <rect x="210" y="134" width="130" height="30" rx="3" fill="#2d3239"/>
  {Array.from({length:12},(_,i)=><rect key={i} x={214+i*10.5} y="137" width="6" height="24" rx="1" fill="#383e46"/>)}
  {/* monitor no braço, com a lâmina sendo impressa */}
  <rect x="322" y="10" width="3" height="40" fill="#8d949e"/>
  <rect x="300" y="0" width="54" height="34" rx="3" fill="#2d3239"/>
  <rect x="303" y="3" width="48" height="25" rx="1.5" fill="url(#inScreen)"/>
  <rect x="307" y="7" width="18" height="12" fill="#fff"/><rect x="326" y="7" width="18" height="12" fill="#fff"/>
  <rect x="308" y="8" width="9" height="10" fill="#00aeef"/><rect x="318" y="8" width="6" height="5" fill="#ec008c"/><rect x="327" y="8" width="16" height="6" fill="#f5c400"/>
  <rect x="307" y="22" width="40" height="2.5" rx="1" fill="#ffffff30"/><rect x="307" y="22" width="40" height="2.5" rx="1" fill="#19b33a" className="dm-in-bar"/>
  {/* empilhador de saída */}
  <rect x="352" y="96" width="118" height="78" rx="5" fill="url(#inBody)" stroke="#c9ced5"/>
  <rect x="352" y="140" width="118" height="34" rx="4" fill="url(#inBase)"/>
  <rect x="358" y="88" width="104" height="8" rx="2" fill="#8d949e"/>
  <g className="dm-in-stack">{[0,1,2,3].map(i=><rect key={i} x="362" y={84-i*2.2} width="96" height="2" fill={i%2?'#f1efe9':'#fff'} stroke="#d4d4cc" strokeWidth=".4"/>)}</g>
  <rect x="344" y="104" width="12" height="6" rx="1" fill="#1b1f24"/>
  {/* lâminas impressas saindo para o empilhador */}
  <g clipPath="url(#inOut)">{[1,2,3].map(n=><g key={n} className={'dm-in-sheet s'+n}><rect x="300" y="96" width="70" height="6" fill="#fff" stroke="#d4d4cc" strokeWidth=".5"/><rect x="304" y="97" width="18" height="4" fill="#00aeef"/><rect x="324" y="97" width="12" height="4" fill="#ec008c"/><rect x="338" y="97" width="16" height="4" fill="#f5c400"/><rect x="356" y="97" width="10" height="4" fill="#19b33a"/></g>)}</g>
  <circle cx="460" cy="106" r="3" fill="#19b33a" className="dm-in-led"/>
  {/* torre de sinalização: verde imprimindo */}
  <rect x="451" y="52" width="3" height="44" fill="#8d949e"/>
  <rect x="446" y="26" width="13" height="10" rx="2" fill="#7a1d1b"/><rect x="446" y="36" width="13" height="10" rx="2" fill="#806a10"/><rect x="446" y="46" width="13" height="10" rx="2" fill="#19b33a" className="dm-in-andon"/>
  <rect x="445" y="24" width="15" height="3" rx="1" fill="#3a3f47"/>
 </svg>;
}

/**
 * Sede da Zangraf (1 unidade = 0,1cqw): galpão, bloco de vidro com a bandeira do Brasil e, à direita,
 * a garagem aberta de onde o caminhão sai (o caminhão fica dentro dela, por cima do fundo escuro).
 */
function Factory(){
 const font="'Bebas Neue','Arial Narrow',Arial,sans-serif",rays=['#e8221e','#19b33a','#f5e21a','#1aa8e8','#e81aa5'];
 return <svg className="dm-in-factory" viewBox="0 0 820 420" aria-hidden="true">
  <defs>
   <linearGradient id="inGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bfe0f0"/><stop offset=".55" stopColor="#7fb0c9"/><stop offset="1" stopColor="#4f7f98"/></linearGradient>
   <linearGradient id="inBay" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24251f"/><stop offset="1" stopColor="#45463d"/></linearGradient>
   <radialGradient id="inLamp" cx=".5" cy="0" r="1"><stop offset="0" stopColor="#fff3b0" stopOpacity=".55"/><stop offset=".6" stopColor="#fff3b0" stopOpacity="0"/></radialGradient>
  </defs>
  {/* galpão comprido */}
  <rect x="0" y="200" width="260" height="220" fill="#cfc6b6"/>
  {Array.from({length:6},(_,i)=><rect key={i} x={14+i*42} y="200" width="4" height="220" fill="#b9b09f"/>)}
  <rect x="0" y="192" width="260" height="12" fill="#bfb6a5"/>
  {/* bloco alto de vidro com a bandeira */}
  <rect x="220" y="90" width="270" height="330" fill="#e7ded0"/>
  <rect x="214" y="80" width="282" height="14" fill="#d9cfbf"/>
  <rect x="240" y="130" width="110" height="150" fill="url(#inGlass)"/>
  {[1,2,3].map(i=><rect key={'v'+i} x={240+i*27.5} y="130" width="3" height="150" fill="#f4f1ea"/>)}
  {[1,2].map(i=><rect key={'h'+i} x="240" y={130+i*50} width="110" height="3" fill="#f4f1ea"/>)}
  <path d="M240 130 L290 130 L240 200Z" fill="#ffffff40"/>
  <rect x="370" y="130" width="96" height="96" fill="url(#inGlass)"/>
  <rect x="417" y="130" width="3" height="96" fill="#f4f1ea"/><rect x="370" y="177" width="96" height="3" fill="#f4f1ea"/>
  <rect x="262" y="330" width="66" height="90" fill="#5f7d8e"/><rect x="294" y="330" width="3" height="90" fill="#e7ded0"/>
  <rect x="352" y="272" width="126" height="60" rx="5" fill="#fff" stroke="#d9cfbf"/>
  <image href="/brand/zangraf.png" x="361" y="276" width="108" height="52" preserveAspectRatio="xMidYMid meet"/>
  {rays.map((c,i)=><rect key={c} x={352+i*25.2} y="332" width="25.2" height="4" fill={c}/>)}
  <rect x="404" y="0" width="4" height="82" fill="#3b3c35"/>
  <g className="dm-in-flag"><rect x="408" y="4" width="76" height="52" fill="#009b3a"/><path d="M446 9 L479 30 L446 51 L413 30Z" fill="#fedf00"/><circle cx="446" cy="30" r="12" fill="#002776"/><path d="M434 28 Q446 23 458 31" stroke="#fff" strokeWidth="2.4" fill="none"/></g>
  {/* garagem: bloco com a porta de enrolar recolhida e o vão aberto até a borda */}
  <rect x="480" y="150" width="340" height="270" fill="#d9cfbf"/>
  <rect x="474" y="142" width="346" height="12" fill="#c9bfae"/>
  <rect x="500" y="166" width="300" height="38" rx="6" fill="#fff" stroke="#d9cfbf"/>
  <text x="520" y="195" fill="#25261f" fontFamily={font} fontSize="24" letterSpacing="2">EXPEDIÇÃO</text>
  <image href="/brand/zangraf.png" x="676" y="168" width="110" height="34" preserveAspectRatio="xMidYMid meet"/>
  {rays.map((c,i)=><rect key={'e'+c} x={500+i*60} y="204" width="60" height="4" fill={c}/>)}
  <rect x="498" y="218" width="322" height="202" fill="url(#inBay)"/>
  <rect x="498" y="218" width="322" height="202" fill="url(#inLamp)"/>
  {Array.from({length:4},(_,i)=><rect key={'p'+i} x="498" y={218+i*6} width="322" height="4" fill={i%2?'#9a9384':'#b3ab9a'}/>)}
  <rect x="640" y="244" width="40" height="5" rx="2" fill="#fff6c2"/>
  {/* caixas esperando no fundo */}
  <rect x="510" y="356" width="44" height="34" rx="3" fill="#b98448"/><rect x="514" y="322" width="36" height="34" rx="3" fill="#c99558"/><rect x="510" y="390" width="44" height="30" rx="3" fill="#a87442"/>
  {/* faixa de atenção no batente */}
  <rect x="486" y="218" width="12" height="202" fill="#f2c200"/>
  {Array.from({length:10},(_,i)=><path key={'z'+i} d={`M486 ${226+i*20} L498 ${218+i*20} L498 ${228+i*20} L486 ${236+i*20}Z`} fill="#25261f"/>)}
 </svg>;
}

/** Caminhão dos Correios (baú amarelo com faixa azul). */
function Truck(){
 const font="'Bebas Neue','Arial Narrow',Arial,sans-serif";
 return <svg className="dm-in-truck-svg" viewBox="0 0 270 160" aria-hidden="true">
  <defs><linearGradient id="inBau" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd83a"/><stop offset="1" stopColor="#efbf00"/></linearGradient></defs>
  <g className="dm-in-truck-body">
   <rect x="4" y="16" width="176" height="104" rx="7" fill="url(#inBau)"/>
   <rect x="4" y="16" width="176" height="6" rx="3" fill="#ffffff55"/>
   {/* símbolo: envelope branco num quadrado azul */}
   <rect x="16" y="34" width="42" height="42" rx="7" fill="#1d4f9c"/>
   <path d="M23 46 L51 46 L51 66 L23 66Z" fill="#fff"/><path d="M23 46 L37 58 L51 46" stroke="#1d4f9c" strokeWidth="3" fill="none" strokeLinejoin="round"/>
   <text x="66" y="66" fill="#1d4f9c" fontFamily={font} fontSize="32" fontWeight="700" textLength="106" lengthAdjust="spacingAndGlyphs">CORREIOS</text>
   <rect x="4" y="84" width="176" height="16" fill="#1d4f9c"/>
   <text x="92" y="96" textAnchor="middle" fill="#fff" fontFamily={font} fontSize="11" textLength="160" lengthAdjust="spacingAndGlyphs">ÁLBUM ZANGRAF A CAMINHO</text>
   <path d="M184 46 L222 46 Q236 46 244 62 L256 86 Q260 92 260 100 L260 118 L184 118 Z" fill="#f2c200"/>
   <path d="M192 54 L220 54 Q230 54 236 66 L244 84 L192 84Z" fill="#bfe3f5"/>
   <path d="M196 58 L212 58 L198 80 L192 80Z" fill="#ffffff70"/>
   <rect x="184" y="92" width="76" height="8" fill="#1d4f9c"/>
   <rect x="250" y="102" width="12" height="8" rx="2" fill="#fff6c2"/>
   <rect x="0" y="116" width="266" height="12" rx="4" fill="#2f2f2a"/>
  </g>
  <g className="dm-in-wheel" style={{transformOrigin:'58px 130px'}}><circle cx="58" cy="130" r="20" fill="#1c1c19"/><circle cx="58" cy="130" r="9" fill="#bdbdb4"/><rect x="56" y="114" width="4" height="32" fill="#8a8a82"/></g>
  <g className="dm-in-wheel" style={{transformOrigin:'214px 130px'}}><circle cx="214" cy="130" r="20" fill="#1c1c19"/><circle cx="214" cy="130" r="9" fill="#bdbdb4"/><rect x="212" y="114" width="4" height="32" fill="#8a8a82"/></g>
 </svg>;
}

function House(){
 return <svg className="dm-in-house" viewBox="0 0 220 200" aria-hidden="true">
  <rect x="150" y="18" width="18" height="40" fill="#8f4a3a"/>
  <path d="M10 92 L110 20 L210 92Z" fill="#c7372f"/><path d="M10 92 L110 20 L114 24 L18 92Z" fill="#e0544a"/>
  <rect x="24" y="90" width="172" height="104" fill="#f6ead2"/>
  <rect x="24" y="90" width="172" height="6" fill="#e2d2b2"/>
  <rect x="44" y="112" width="44" height="40" rx="3" fill="#ffe7a3"/><rect x="64" y="112" width="3" height="40" fill="#c9a56a"/><rect x="44" y="130" width="44" height="3" fill="#c9a56a"/>
  <rect x="124" y="118" width="48" height="76" rx="3" fill="#7a4a2a"/><circle cx="164" cy="158" r="3" fill="#f5c400"/>
  <rect x="116" y="192" width="64" height="8" rx="2" fill="#bfb3a0"/>
  <circle cx="22" cy="190" r="16" fill="#2f8f46"/><circle cx="40" cy="194" r="12" fill="#3aa356"/><circle cx="200" cy="192" r="14" fill="#2f8f46"/>
 </svg>;
}

function Tree({x,s=1}:{x:string;s?:number}){
 return <span className="dm-in-tree" style={{left:x,transform:`scale(${s})`}}><i/><i/><b/></span>;
}

/**
 * Abertura da prévia: o álbum sai da impressora, vai para a caixa, sai da Zangraf num caminhão,
 * chega na casa do cliente e a caixa se abre jogando o álbum na tela (que segue no modo 4D).
 */
export function PreviewIntro({cover,onReveal,onGone}:{cover:ReactNode;/** O álbum chegou: hora de montar o 4D embaixo. */onReveal:()=>void;/** A abertura terminou de sumir. */onGone:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [leaving,setLeaving]=useState(false);
 const sounds=useRef<IntroSounds>(undefined);
 const startedAt=useRef(0);
 // "blocked": o navegador segurou o áudio (falta um toque da pessoa); "on"/"off": som ligado ou desligado.
 const [sound,setSound]=useState<'on'|'off'|'blocked'>('on');
 const [volume,setVolume]=useState(introVolume);
 /** Controle deslizante: muda o volume na hora; subir o volume com o som desligado liga o som. */
 const changeVolume=(value:number)=>{
  setVolume(value);sounds.current?.setVolume(value);
  if(sound==='off'&&value>0){sounds.current?.setMuted(false);setSound('on');}
 };
 /** "Pular" (ou Esc): a abertura some e os sons param junto. */
 const skip=()=>{sounds.current?.stop();setLeaving(true);};
 /** Botão de som: libera o áudio bloqueado (religando a trilha no ponto certo) ou liga/desliga. */
 const toggleSound=()=>{
  if(sound==='blocked'||!sounds.current?.playing()){
   void resumeAudio().then(ok=>{
    if(!ok)return;
    sounds.current?.stop();
    sounds.current=playIntroSounds((performance.now()-startedAt.current)/1000);
    setSound('on');
   });
   return;
  }
  const next=sound==='on'?'off':'on';sounds.current.setMuted(next==='off');setSound(next);
 };
 // Tela inteira: um <dialog> modal próprio, acima da prévia.
 // A prévia abre o próprio <dialog> logo depois deste efeito (o efeito do pai roda depois do filho);
 // por isso abre no quadro seguinte, e reabre se algo já tiver passado na frente.
 useEffect(()=>{
  const bringToFront=()=>{const el=dialog.current;if(!el)return;if(el.open)el.close();el.showModal();
   // Sons sincronizados com a animação, que só começa quando o <dialog> aparece.
   if(!sounds.current){startedAt.current=performance.now();sounds.current=playIntroSounds();}
   // Se o navegador segurou o áudio, mostra o botão "Ativar som".
   window.setTimeout(()=>{if(sounds.current&&!sounds.current.playing())setSound('blocked');},350);};
  const frame=requestAnimationFrame(()=>requestAnimationFrame(bringToFront));
  return()=>{cancelAnimationFrame(frame);sounds.current?.stop();sounds.current=undefined;};
 },[]);
 useEffect(()=>{const t=window.setTimeout(()=>setLeaving(true),INTRO_MS);return()=>window.clearTimeout(t);},[]);
 useEffect(()=>{if(!leaving)return;onReveal();const t=window.setTimeout(onGone,520);return()=>window.clearTimeout(t);},[leaving,onReveal,onGone]);
 const captions:[string,string][]=[['IMPRIMINDO SEU ÁLBUM','var(--zg-blue)'],['EMBALANDO COM CARINHO','var(--zg-magenta)'],['SAINDO DA ZANGRAF','var(--zg-green)'],['A CAMINHO DA SUA CASA','var(--zg-yellow)'],['CHEGOU!','var(--zg-red)'],['SURPRESA!','var(--zg-purple)']];
 return <dialog ref={dialog} className="dm-intro-dialog" data-leaving={leaving||undefined} onCancel={e=>{e.preventDefault();skip();}} aria-label="Abertura da prévia">
 <div className="dm-intro" role="img" aria-label="Seu álbum sendo impresso na Zangraf, embalado, levado pelos Correios e entregue na sua casa">
  <div className="dm-in-stage">
  <div className="dm-in-sky"><i className="dm-in-sun"/></div>
  <div className="dm-in-clouds" aria-hidden="true">{[8,22,41,57,70,86].map((x,i)=><i key={i} style={{left:x+'%',top:(8+(i%3)*7)+'%',transform:`scale(${.7+(i%2)*.4})`}}/>)}</div>
  <div className="dm-in-hills" aria-hidden="true"/>
  <div className="dm-in-world" aria-hidden="true">
   {/* A: dentro da Zangraf — impressora e mesa de embalagem */}
   <section className="dm-in-sec a">
    <FactoryInside/>
    <span className="dm-in-printer-wrap">
     <Printer/>
    </span>
    <span className="dm-in-table"><i className="dm-in-tape-gun"/><i className="dm-in-flat"/></span>
   </section>
   {/* B: a sede da Zangraf com a bandeira do Brasil */}
   <section className="dm-in-sec b"><Factory/></section>
   {/* C: estrada */}
   <section className="dm-in-sec c"><Tree x="12%"/><Tree x="38%" s={1.25}/><Tree x="64%" s={.9}/><Tree x="86%" s={1.1}/><span className="dm-in-sign">ZANGRAF → VOCÊ</span></section>
   {/* D: a casa do cliente */}
   <section className="dm-in-sec d"><Tree x="8%" s={1.2}/><House/></section>
   <i className="dm-in-road"/>
   <span className="dm-in-truck"><Truck/><i className="dm-in-puff p1"/><i className="dm-in-puff p2"/><i className="dm-in-puff p3"/></span>
   <span className="dm-in-album-trip"><MiniAlbum cover={cover}/></span>
   <span className="dm-in-box-trip"><Box/></span>
   <span className="dm-in-box-drop"><Box/></span>
  </div>
  {/* Close: a caixa na porta, abre e joga o álbum na tela */}
  <div className="dm-in-close" aria-hidden="true">
   <span className="dm-in-close-box"><Box big/></span>
   <span className="dm-in-burst">{['#e8221e','#19b33a','#f5e21a','#1aa8e8','#e81aa5','#8e2a8f','#00aeef','#ec008c'].map((c,i)=><i key={i} style={{'--c':c,'--a':`${i*45-90}deg`} as CSSProperties}/>)}</span>
   <span className="dm-in-confetti">{Array.from({length:22},(_,i)=><i key={i} style={{'--x':`${(i*37%100)-50}vw`,'--r':`${i*67%360}deg`,'--d':`${(i%5)*40}ms`,background:['#e8221e','#19b33a','#f5e21a','#1aa8e8','#e81aa5'][i%5]} as CSSProperties}/>)}</span>
   <span className="dm-in-fly"><MiniAlbum cover={cover}/></span>
  </div>
  </div>
  <i className="dm-in-flash" aria-hidden="true"/>
  <div className="dm-in-captions" aria-hidden="true">{captions.map(([t,c],i)=><span key={t} className={'c'+i} style={{'--c':c} as CSSProperties}><i/>{t}</span>)}</div>
  <div className="dm-in-progress" aria-hidden="true"><i/></div>
  {sound!=='blocked'&&<label className="dm-in-volume" title="Volume">
   <input type="range" min={0} max={1} step={.05} value={sound==='off'?0:volume} aria-label="Volume da abertura" aria-valuetext={`${Math.round((sound==='off'?0:volume)*100)}%`} onChange={e=>changeVolume(Number(e.target.value))} style={{'--v':`${(sound==='off'?0:volume)*100}%`} as CSSProperties}/>
  </label>}
  <button type="button" className={'dm-in-sound'+(sound==='blocked'?' is-blocked':'')} onClick={toggleSound} aria-label={sound==='on'?'Desligar o som':'Ligar o som'} title={sound==='on'?'Desligar o som':'Ligar o som'}>
   {sound==='on'?<Volume2 size={16}/>:<VolumeX size={16}/>}{sound==='blocked'&&<span>Ativar som</span>}
  </button>
  <button type="button" className="dm-in-skip" onClick={skip}>Pular</button>
 </div>
 </dialog>;
}
