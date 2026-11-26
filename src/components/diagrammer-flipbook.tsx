'use client';
import React,{useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {PreviewIntro} from './diagrammer-intro';
import {ChevronLeft,ChevronRight,Rotate3d,Box} from 'lucide-react';
import {projectSpec,defaultCover,defaultBackCover,type LayoutProject} from '@/lib/layout-projects';
import {coverSpineMm} from '@/lib/album-layouts';
import {coverPageIndices} from '@/lib/cover-production';
import {AlbumCover,AlbumSpread} from './diagrammer-preview';

const isWrap=(project:LayoutProject)=>project.productionModel?.coverMode==='wrap';
/** Ordem do folheamento: capa fechada (só a frente) → lâminas → verso com o dorso no final. */
function bookIndices(project:LayoutProject){const covers=coverPageIndices(project.productionModel?.coverMode);const spreads=project.spreads.map((_,i)=>i);return covers.length?[-1,...spreads,-2]:spreads;}

function Artwork({project,index,urls}:{project:LayoutProject;index:number;urls:Record<string,string>}){
 const spec=projectSpec(project,index);
 return index<0?<AlbumCover cover={index===-2?(project.backCover||defaultBackCover()):(project.cover||defaultCover())} urls={urls} spec={spec} ratio={spec.widthMm/spec.heightMm} back={index===-2}/>:<AlbumSpread spread={project.spreads[index]} urls={urls} spec={spec} ratio={spec.widthMm*2/spec.heightMm}/>;
}
/** Só a frente (-1) ou só o verso com o dorso (-2) de uma capa. Na capa inteira, recorta a arte única. */
function CoverPart({project,index,urls}:{project:LayoutProject;index:number;urls:Record<string,string>}){
 if(!isWrap(project))return <div className="dm-cover-part"><div style={{width:'100%',left:0}}><Artwork project={project} index={index} urls={urls}/></div></div>;
 const total=projectSpec(project,-1).widthMm,spine=coverSpineMm(project),face=(total-spine)/2,part=index===-1?face:face+spine;
 return <div className="dm-cover-part"><div style={{width:`${total/part*100}%`,...(index===-1?{right:0}:{left:0})}}><Artwork project={project} index={-1} urls={urls}/></div></div>;
}
/**
 * Medidas do dorso: na capa inteira (wrap) ele tem arte própria, no meio da capa; nas capas separadas,
 * é só a encadernação (cor da capa), com espessura estimada pelo número de lâminas.
 */
function spineInfo(project:LayoutProject){
 const spec=projectSpec(project,-1),art=coverSpineMm(project),wrap=isWrap(project)&&art>0;
 const face=wrap?(spec.widthMm-art)/2:spec.widthMm;
 const sheets=project.productionModel?.sheets||project.spreads.length;
 return {wrap,spine:art||Math.max(8,Math.min(face*.12,4+sheets*.7)),face,height:spec.heightMm,total:spec.widthMm};
}
/** A arte do dorso (recortada do meio da capa inteira) ou a cor da capa. */
function SpineArt({project,urls}:{project:LayoutProject;urls:Record<string,string>}){
 const info=spineInfo(project);
 const color=(project.cover||defaultCover()).color;
 if(!info.wrap)return <div className="dm-spine-art is-plain" style={{background:color}}/>;
 return <div className="dm-cover-part dm-spine-art"><div style={{width:`${info.total/info.spine*100}%`,left:`${-info.face/info.spine*100}%`}}><Artwork project={project} index={-1} urls={urls}/></div></div>;
}
/** Só a face da capa (-1) ou da contracapa (-2), sem o dorso, para as laterais da vista do dorso. */
function FaceArt({project,index,urls}:{project:LayoutProject;index:number;urls:Record<string,string>}){
 const info=spineInfo(project);
 if(!info.wrap)return <CoverPart project={project} index={index} urls={urls}/>;
 return <div className="dm-cover-part"><div style={{width:`${info.total/info.face*100}%`,...(index===-1?{right:0}:{left:0})}}><Artwork project={project} index={-1} urls={urls}/></div></div>;
}
/** Lombada curva: a arte do dorso em fatias dispostas num arco (como a lombada arredondada de verdade). */
const SPINE_SLICES=14,SPINE_ARC=74*Math.PI/180;
function CurvedSpine({project,urls}:{project:LayoutProject;urls:Record<string,string>}){
 const step=SPINE_ARC/SPINE_SLICES,w=2*Math.sin(step/2),total=w*SPINE_SLICES,lift=1-Math.cos(SPINE_ARC/2),r=2*Math.sin(SPINE_ARC/2);
 return <>{Array.from({length:SPINE_SLICES},(_,i)=>{
  const a=-SPINE_ARC/2+(i+.5)*step,width=w/r,x=.5+Math.sin(a)/r,z=(Math.cos(a)-Math.cos(SPINE_ARC/2))/r;
  return <div key={i} className="dm-4d-slice" style={{'--x':x-width/2,'--z':z,'--w':width,'--a':`${a}rad`} as React.CSSProperties}>
   <div style={{width:`${total/w*100}%`,left:`${-i*100}%`}}><SpineArt project={project} urls={urls}/></div>
  </div>;})}
  <i className="dm-4d-cap top" style={{'--lift':lift/r} as React.CSSProperties}/>
  <i className="dm-4d-cap bottom" style={{'--lift':lift/r} as React.CSSProperties}/>
 </>;
}
/**
 * Vista 4D: o álbum fechado, completo (capa, lombada curva, verso, placas com espessura e miolo recuado),
 * com a arte do diagramador. Arrastar gira em qualquer direção, direto no transform (sem redesenhar a página);
 * o ângulo também vai para --ry, para a luz de cada lado acompanhar o giro.
 */
function FourDView({project,urls}:{project:LayoutProject;urls:Record<string,string>}){
 const info=spineInfo(project);
 const box=useRef<HTMLDivElement>(null),view=useRef<HTMLDivElement>(null),pose=useRef({y:-90,x:-6}),drag=useRef<{px:number;py:number;y:number;x:number}|null>(null);
 const place=(y:number,x:number,smooth:boolean)=>{pose.current={y,x};const el=box.current;if(!el)return;el.classList.toggle('is-dragging',!smooth);el.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;el.style.setProperty('--ry',`${y}deg`);};
 // Entrada: o álbum surge de baixo girando quase uma volta, passa um pouco do ponto e assenta de frente (capa para a tela);
 // depois fica flutuando de leve. Tudo no próprio álbum 3D, sem opacidade nele (opacidade achata o 3D),
 // com a luz acompanhando o giro; quem aparece aos poucos é a área em volta.
 useEffect(()=>{
  const el=box.current,stage=view.current;if(!el||!stage)return;
  const done=()=>stage.classList.add('is-landed');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
  const frame=(y:number,ry:number,rx:number,scale:number)=>({transform:`translateY(${y}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${scale})`,'--ry':`${ry}deg`});
  el.classList.add('is-dragging');
  // Cada trecho com a sua curva: sobe girando, passa um pouco do ponto e assenta.
  const anim=el.animate([
   {...frame(130,-422,-60,.42),easing:'cubic-bezier(.25,.55,.35,1)'},
   {...frame(-28,-124,-14,1.06),offset:.6,easing:'cubic-bezier(.4,0,.4,1)'},
   {...frame(6,-78,-4,.985),offset:.82,easing:'cubic-bezier(.3,0,.3,1)'},
   {...frame(0,-90,-6,1)},
  ],{duration:1700,easing:'linear',fill:'backwards'});
  anim.onfinish=()=>{el.classList.remove('is-dragging');done();};
  return()=>anim.cancel();
 },[]);
 const color=(project.cover||defaultCover()).color;
 const end=()=>{drag.current=null;box.current?.classList.remove('is-dragging');view.current?.classList.remove('is-holding');};
 return <div className="dm-4d">
  <div ref={view} className="dm-spine-view" onPointerDown={e=>{drag.current={px:e.clientX,py:e.clientY,...pose.current};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.classList.add('is-holding');}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;place(d.y+(e.clientX-d.px)*.5,Math.max(-45,Math.min(30,d.x-(e.clientY-d.py)*.35)),false);}}
   onPointerUp={end} onPointerCancel={end}>
   <div className="dm-4d-float">
   <div ref={box} className="dm-spine-box" style={{'--s':info.spine/info.height,'--f':info.face/info.height,'--board':color,'--ry':'-90deg',transform:'rotateX(-6deg) rotateY(-90deg)'} as React.CSSProperties}>
    <CurvedSpine project={project} urls={urls}/>
    <div className="dm-spine-face front"><FaceArt project={project} index={-1} urls={urls}/></div>
    <div className="dm-spine-face back"><FaceArt project={project} index={-2} urls={urls}/></div>
    {/* Placas da capa com espessura: face de dentro e as bordas (em cima, embaixo e na frente) */}
    {['back','front'].map(side=><React.Fragment key={side}>
     <i className={`dm-4d-el board-in ${side}`}/><i className={`dm-4d-el board-top ${side}`}/><i className={`dm-4d-el board-bottom ${side}`}/><i className={`dm-4d-el board-fore ${side}`}/>
    </React.Fragment>)}
    {/* Miolo: bloco de páginas recuado entre as placas (as "sobras" da capa aparecem em volta) */}
    <i className="dm-4d-el pages-top"/><i className="dm-4d-el pages-bottom"/><i className="dm-4d-el pages-fore"/>
   </div>
   </div>
   <span className="dm-4d-floor" aria-hidden="true"/>
   <span className="dm-4d-ring" aria-hidden="true"/>
  </div>
 </div>;
}
function coverRatio(project:LayoutProject,index:number){const spec=projectSpec(project,-1);if(!isWrap(project)){const s=projectSpec(project,index);return s.widthMm/s.heightMm;}const spine=coverSpineMm(project),face=(spec.widthMm-spine)/2;return (index===-1?face:face+spine)/spec.heightMm;}
const shortLabel=(index:number)=>index===-1?'Capa':index===-2?'Verso':String(index+1);

export function AlbumFlipbook({project,urls,index,onChange}:{project:LayoutProject;urls:Record<string,string>;index:number;onChange:(index:number)=>void}){
 const indices=bookIndices(project),position=Math.max(0,indices.indexOf(index));
 const [turn,setTurn]=useState<{to:number;direction:1|-1}|null>(null),[flat]=useState(false),[shine,setShine]=useState(0),[spineOpen,setSpineOpen]=useState(()=>indices.includes(-1));
 // Ao abrir a prévia: abertura animada (impressora → caixa → caminhão → casa) e depois o álbum no 4D.
 const [intro,setIntro]=useState(()=>indices.includes(-1)&&!(typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches));
 const [introShown,setIntroShown]=useState(intro);
 const endIntro=useCallback(()=>setIntro(false),[]),hideIntro=useCallback(()=>setIntroShown(false),[]);
 const hasCovers=indices.includes(-1);
 const swipe=useRef<number|null>(null),turning=useRef(false),thumbs=useRef<HTMLDivElement>(null);
 const pageSpec=projectSpec(project,0),ratio=project.spreads.length?pageSpec.widthMm*2/pageSpec.heightMm:coverRatio(project,-1)*2;
 const shift=(page:number)=>page===-1?-25:page===-2?25:0;
 const shown=turn?turn.to:index;
 function go(to:number,direction:1|-1){if(turning.current||to===index)return;if(flat||window.matchMedia('(prefers-reduced-motion: reduce)').matches){onChange(to);setShine(v=>v+1);return;}turning.current=true;setTurn({to,direction});}
 function move(direction:1|-1){const to=indices[position+direction];if(to!==undefined)go(to,direction);}
 // Virada da capa um pouco mais lenta que a das lâminas (a capa é mais pesada).
 const coverTurn=!!turn&&(index<0||turn.to<0),turnMs=coverTurn?1000:760;
 useEffect(()=>{if(!turn)return;const timer=setTimeout(()=>{onChange(turn.to);setTurn(null);setShine(v=>v+1);turning.current=false;},turnMs);return()=>clearTimeout(timer);},[turn,onChange,turnMs]);
 // Lado do álbum fechado em cena (parado, abrindo ou fechando): o miolo e o canto da lombada acompanham.
 const closedSide=index===-1||turn?.to===-1?'front':index===-2||turn?.to===-2?'back':undefined;
 const closedAnim=!turn?undefined:index<0?'out':'in';
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 useEffect(()=>{if(!indices.includes(index)&&indices.length)onChange(indices[0]);},[index,indices,onChange]);
 useEffect(()=>{thumbs.current?.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});},[index]);
 const label=spineOpen?'Álbum em 4D':index===-1?'Capa':index===-2?(isWrap(project)?'Verso e dorso':'Verso'):`Lâmina ${index+1}`;
 const split=(page:number,side:'left'|'right'):ReactNode=>{
  if(page===-1)return side==='right'?<div className="dm-book-half right is-cover"><CoverPart project={project} index={-1} urls={urls}/></div>:<div className="dm-book-half left is-empty"/>;
  if(page===-2)return side==='left'?<div className="dm-book-half left is-cover"><FaceArt project={project} index={-2} urls={urls}/></div>:<div className="dm-book-half right is-empty"/>;
  return <div className={`dm-book-half ${side}`}><div><Artwork project={project} index={page} urls={urls}/></div></div>;
 };
 return <section className="dm-flipbook" aria-label="Folheamento do álbum">
  {/* A abertura ocupa a tela inteira por cima da prévia; no fim o 4D já está montado embaixo e ela some aos poucos */}
  {introShown&&<PreviewIntro cover={<FaceArt project={project} index={-1} urls={urls}/>} onReveal={endIntro} onGone={hideIntro}/>}
  {intro?<div className="dm-intro-spacer"/>:spineOpen?<div className="dm-book-stage dm-book-stage-spine"><FourDView project={project} urls={urls}/></div>:
  <div className={'dm-book-stage '+(flat?'flat':'')} onPointerDown={e=>{swipe.current=e.clientX;window.getSelection()?.removeAllRanges()}} onDragStart={e=>e.preventDefault()} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(start!==null&&Math.abs(e.clientX-start)>45)move(e.clientX<start?1:-1)}}>
   <button type="button" className="dm-book-arrow prev" aria-label="Voltar" disabled={position===0||!!turn} onClick={()=>move(-1)}><ChevronLeft size={24}/></button>
   <div data-side={closedSide} data-turn={coverTurn?(index<0?'open':'close'):undefined} className={'dm-book'+(index<0&&!turn?' is-closed':'')+(coverTurn?' is-cover-turn':'')} style={{['--turn-ms' as string]:`${turnMs}ms`,aspectRatio:ratio,width:`min(100%, calc((100dvh - 395px) * ${ratio}))`,['--shift' as string]:`${shift(shown)}%`,['--hinge' as string]:`${Math.min(12,15/spineInfo(project).face*100)}%`}} aria-busy={!!turn}>
    {closedSide&&hasCovers&&<span className="dm-book-block" data-anim={closedAnim} aria-hidden="true"/>}
    {!turn?(index<0?<>{split(index,'left')}{split(index,'right')}</>:<Artwork project={project} index={index} urls={urls}/>):<>
     {split(turn.direction===1?index:turn.to,'left')}{split(turn.direction===1?turn.to:index,'right')}
     <div className={`dm-turning-sheet ${turn.direction===1?'forward':'backward'}`} key={`${index}-${turn.to}`}><div className="dm-sheet-face front">{split(index,turn.direction===1?'right':'left')}</div><div className="dm-sheet-face back">{split(turn.to,turn.direction===1?'left':'right')}</div></div>
    </>}
    {/* Álbum fechado: no canto de baixo junto da lombada, a continuação preta da lombada, sem faixa lateral */}
    {closedSide&&hasCovers&&<span className="dm-book-spine-foot" data-anim={closedAnim} aria-hidden="true"/>}
    {/* Sombra que a folha/capa projeta na página de baixo enquanto vira */}
    {turn&&<><span className={`dm-turn-shade from ${turn.direction===1?'right':'left'}`} aria-hidden="true"/><span className={`dm-turn-shade to ${turn.direction===1?'left':'right'}`} aria-hidden="true"/></>}
    {index>=0&&<span className="dm-book-gutter" aria-hidden="true"/>}
    {!turn&&<span className="dm-book-shine" key={shine} aria-hidden="true"/>}
   </div>
   <button type="button" className="dm-book-arrow next" aria-label="Avançar" disabled={position===indices.length-1||!!turn} onClick={()=>move(1)}><ChevronRight size={24}/></button>
  </div>}
  {!intro&&<div className={'dm-book-bar'+(spineOpen?' is-4d':'')}>
   {/* No 4D só o álbum aparece: a contagem e as miniaturas descem e somem; o botão fica no mesmo lugar */}
   <div className="dm-book-extras" aria-hidden={spineOpen||undefined} inert={spineOpen||undefined}>
   <span className="dm-book-count" aria-live="polite"><strong key={index}>{label}</strong><small>{position+1}/{indices.length}</small></span>
   <div className="dm-book-thumbs" ref={thumbs} aria-label="Todas as lâminas">{indices.map((page,i)=>{const s=projectSpec(project,page);return <button type="button" key={page} aria-current={page===index} aria-label={page===-1?'Capa':page===-2?'Verso':`Lâmina ${page+1}`} disabled={!!turn} onClick={()=>go(page,i>position?1:-1)}><span style={{aspectRatio:page<0?coverRatio(project,page):s.widthMm*2/s.heightMm}}>{page<0?<CoverPart project={project} index={page} urls={urls}/>:<Artwork project={project} index={page} urls={urls}/>}</span><small>{shortLabel(page)}</small></button>})}</div>

   </div>
   {/* 3D (folhear) e 4D (fechado, girando): chave com a bolinha amarela que desliza até o modo escolhido */}
   {hasCovers&&<div className="dm-mode-toggle" data-mode={spineOpen?'4d':'3d'} role="group" aria-label="Modo de visualização">
    <i className="dm-mode-knob" aria-hidden="true"/>
    <button type="button" aria-pressed={!spineOpen} aria-label="3D: folhear o álbum" title="3D" disabled={!!turn} onClick={()=>setSpineOpen(false)}><span key={spineOpen?'a':'b'} className="dm-mode-ico is-3d"><Box size={18}/></span><span>3D</span></button>
    <button type="button" aria-pressed={spineOpen} aria-label="4D: álbum fechado girando" title="4D" disabled={!!turn} onClick={()=>setSpineOpen(true)}><span key={spineOpen?'c':'d'} className="dm-mode-ico is-4d"><Rotate3d size={18}/></span><span>4D</span></button>
   </div>}
  </div>}
 </section>;
}
