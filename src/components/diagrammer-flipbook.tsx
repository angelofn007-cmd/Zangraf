'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Box,Square} from 'lucide-react';
import {projectPageIndices,projectSpec,defaultCover,defaultBackCover,type LayoutProject} from '@/lib/layout-projects';
import {AlbumCover,AlbumSpread} from './diagrammer-preview';

function Artwork({project,index,urls}:{project:LayoutProject;index:number;urls:Record<string,string>}){
 const spec=projectSpec(project,index);
 return index<0?<AlbumCover cover={index===-2?(project.backCover||defaultBackCover()):(project.cover||defaultCover())} urls={urls} spec={spec} ratio={spec.widthMm/spec.heightMm} back={index===-2}/>:<AlbumSpread spread={project.spreads[index]} urls={urls} spec={spec} ratio={spec.widthMm*2/spec.heightMm}/>;
}
const shortLabel=(index:number)=>index===-1?'Capa':index===-2?'Verso':String(index+1);

export function AlbumFlipbook({project,urls,index,onChange}:{project:LayoutProject;urls:Record<string,string>;index:number;onChange:(index:number)=>void}){
 const indices=projectPageIndices(project),position=indices.indexOf(index);
 const [turn,setTurn]=useState<{to:number;direction:1|-1}|null>(null),[flat,setFlat]=useState(false),[shine,setShine]=useState(0);
 const swipe=useRef<number|null>(null),turning=useRef(false),thumbs=useRef<HTMLDivElement>(null);
 const spec=projectSpec(project,index),ratio=spec.widthMm*(index<0?1:2)/spec.heightMm;
 function go(to:number,direction:1|-1){if(turning.current||to===index)return;if(flat||window.matchMedia('(prefers-reduced-motion: reduce)').matches){onChange(to);setShine(v=>v+1);return;}turning.current=true;setTurn({to,direction});}
 function move(direction:1|-1){const to=indices[position+direction];if(to!==undefined)go(to,direction);}
 useEffect(()=>{if(!turn)return;const timer=setTimeout(()=>{onChange(turn.to);setTurn(null);setShine(v=>v+1);turning.current=false;},760);return()=>clearTimeout(timer);},[turn,onChange]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 useEffect(()=>{thumbs.current?.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'});},[index]);
 const label=index===-1?'Capa':index===-2?'Verso':`Lâmina ${index+1}`;
 const split=(page:number,side:'left'|'right')=><div className={`dm-book-half ${side}`}><div><Artwork project={project} index={page} urls={urls}/></div></div>;
 return <section className="dm-flipbook" aria-label="Folheamento do álbum">
  <div className={'dm-book-stage '+(flat?'flat':'')} onPointerDown={e=>{swipe.current=e.clientX}} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(start!==null&&Math.abs(e.clientX-start)>45)move(e.clientX<start?1:-1)}}>
   <button type="button" className="dm-book-arrow prev" aria-label="Voltar" disabled={position===0||!!turn} onClick={()=>move(-1)}><ChevronLeft size={24}/></button>
   <div className="dm-book" style={{aspectRatio:ratio,width:`min(100%, calc((100dvh - 360px) * ${ratio}))`}} aria-busy={!!turn}>
    {!turn?<Artwork project={project} index={index} urls={urls}/>:<>
     {split(turn.direction===1?index:turn.to,'left')}{split(turn.direction===1?turn.to:index,'right')}
     <div className={`dm-turning-sheet ${turn.direction===1?'forward':'backward'}`} key={`${index}-${turn.to}`}><div className="dm-sheet-face front">{split(index,turn.direction===1?'right':'left')}</div><div className="dm-sheet-face back">{split(turn.to,turn.direction===1?'left':'right')}</div></div>
    </>}
    {index>=0&&<span className="dm-book-gutter" aria-hidden="true"/>}
    {!turn&&<span className="dm-book-shine" key={shine} aria-hidden="true"/>}
   </div>
   <button type="button" className="dm-book-arrow next" aria-label="Avançar" disabled={position===indices.length-1||!!turn} onClick={()=>move(1)}><ChevronRight size={24}/></button>
  </div>
  <div className="dm-book-bar">
   <span className="dm-book-count" aria-live="polite"><strong key={index}>{label}</strong><small>{position+1}/{indices.length}</small></span>
   <div className="dm-book-thumbs" ref={thumbs} aria-label="Todas as lâminas">{indices.map((page,i)=>{const s=projectSpec(project,page);return <button type="button" key={page} aria-current={page===index} aria-label={page===-1?'Capa':page===-2?'Verso':`Lâmina ${page+1}`} disabled={!!turn} onClick={()=>go(page,i>position?1:-1)}><span style={{aspectRatio:s.widthMm*(page<0?1:2)/s.heightMm}}><Artwork project={project} index={page} urls={urls}/></span><small>{shortLabel(page)}</small></button>})}</div>
   <button type="button" className="dm-book-mode" aria-pressed={!flat} title={flat?'Ver em 3D':'Ver plano'} aria-label={flat?'Ver em 3D':'Ver plano'} disabled={!!turn} onClick={()=>setFlat(v=>!v)}>{flat?<Square size={16}/>:<Box size={16}/>}<span>{flat?'2D':'3D'}</span></button>
  </div>
 </section>;
}
