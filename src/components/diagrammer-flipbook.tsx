'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,BookOpen} from 'lucide-react';
import {projectPageIndices,projectSpec,defaultCover,defaultBackCover,type LayoutProject} from '@/lib/layout-projects';
import {AlbumCover,AlbumSpread} from './diagrammer-preview';

function Artwork({project,index,urls}:{project:LayoutProject;index:number;urls:Record<string,string>}){
 const spec=projectSpec(project,index);
 return index<0?<AlbumCover cover={index===-2?(project.backCover||defaultBackCover()):(project.cover||defaultCover())} urls={urls} spec={spec} ratio={spec.widthMm/spec.heightMm} back={index===-2}/>:<AlbumSpread spread={project.spreads[index]} urls={urls} spec={spec} ratio={spec.widthMm*2/spec.heightMm}/>;
}
export function AlbumFlipbook({project,urls,index,onChange}:{project:LayoutProject;urls:Record<string,string>;index:number;onChange:(index:number)=>void}){
 const indices=projectPageIndices(project),position=indices.indexOf(index);
 const [turn,setTurn]=useState<{to:number;direction:1|-1}|null>(null),[flat,setFlat]=useState(false);
 const swipe=useRef<number|null>(null),turning=useRef(false);
 const spec=projectSpec(project,index),ratio=spec.widthMm*(index<0?1:2)/spec.heightMm;
 function move(direction:1|-1){if(turning.current)return;const to=indices[position+direction];if(to===undefined)return;if(flat||window.matchMedia('(prefers-reduced-motion: reduce)').matches){onChange(to);return;}turning.current=true;setTurn({to,direction});}
 useEffect(()=>{if(!turn)return;const timer=setTimeout(()=>{onChange(turn.to);setTurn(null);turning.current=false;},760);return()=>clearTimeout(timer);},[turn,onChange]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 const label=index===-1?(project.productionModel?.coverMode==='wrap'?'Capa · verso, dorso e frente':'Capa'):index===-2?'Verso':`Lâmina ${String(index+1).padStart(2,'0')} de ${project.spreads.length}`;
 const split=(page:number,side:'left'|'right')=><div className={`dm-book-half ${side}`}><div><Artwork project={project} index={page} urls={urls}/></div></div>;
 return <section className="dm-flipbook" aria-label="Folheamento do álbum"><div className="dm-book-hint"><span><BookOpen size={15}/>{flat?'Prévia plana':'Folheamento 3D'}</span><button className="dm-link" disabled={!!turn} onClick={()=>setFlat(v=>!v)}>{flat?'Ativar 3D':'Ver sem perspectiva'}</button></div><div className={'dm-book-stage '+(flat?'flat':'')} onPointerDown={e=>{swipe.current=e.clientX}} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(start!==null&&Math.abs(e.clientX-start)>45)move(e.clientX<start?1:-1)}}><div className="dm-book" style={{aspectRatio:ratio,width:`min(100%, calc((100dvh - 370px) * ${ratio}))`}} aria-busy={!!turn}>
  {!turn?<Artwork project={project} index={index} urls={urls}/>:<>
   {split(turn.direction===1?index:turn.to,'left')}{split(turn.direction===1?turn.to:index,'right')}
   <div className={`dm-turning-sheet ${turn.direction===1?'forward':'backward'}`} key={`${index}-${turn.to}`}><div className="dm-sheet-face front">{split(index,turn.direction===1?'right':'left')}</div><div className="dm-sheet-face back">{split(turn.to,turn.direction===1?'left':'right')}</div></div>
  </>}
  {index>=0&&<span className="dm-book-gutter" aria-hidden="true"/>}
 </div></div><footer className="dm-book-controls"><button className="dm-button" disabled={position===0||!!turn} onClick={()=>move(-1)}><ChevronLeft size={17}/>Anterior</button><div aria-live="polite"><strong>{label}</strong><span>Deslize ou use as setas para folhear</span></div><button className="dm-button" disabled={position===indices.length-1||!!turn} onClick={()=>move(1)}>Próxima<ChevronRight size={17}/></button></footer></section>;
}
