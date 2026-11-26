'use client';
import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';
import {X,Check,ScanFace,ZoomIn,ZoomOut} from 'lucide-react';
import {ensureFont} from '@/lib/album-fonts';
import {slotForFocus} from '@/lib/photo-focus';
import {autoFrame,subjectPoint,type PhotoSubject} from '@/lib/photo-saliency';
import {cropRectangle,type Photo,type Slot} from '@/lib/layout-projects';

type Point={x:number;y:number};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const MIN_ZOOM=1,MAX_ZOOM=3;

/**
 * Foco da foto: a foto inteira com a janela clara mostrando o que aparece no álbum.
 * Tocar (ou arrastar) leva o foco para aquele ponto; "Automático" encontra o rosto sozinho.
 * Abre com a foto sendo "impressa" (faixa CMYK) e o foco da câmera procurando e travando no assunto.
 */
export function PhotoFocus({photo,url,slot,width,height,findSubject,onApply,onClose}:{photo:Photo;url:string;slot:Slot;width:number;height:number;findSubject?:(fresh?:boolean)=>Promise<PhotoSubject|null>;onApply:(slot:Slot)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),picture=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null);
 const imageW=photo.width||1,imageH=photo.height||1;
 const centerOf=(framed:Slot):Point=>{const c=cropRectangle(imageW,imageH,width,height,framed);return {x:(c.x+c.width/2)/imageW,y:(c.y+c.height/2)/imageH};};
 const [zoom,setZoom]=useState(clamp(slot.zoom||1,MIN_ZOOM,MAX_ZOOM));
 const [point,setPoint]=useState<Point>(()=>centerOf(slot));
 const [auto,setAuto]=useState(slot.auto!==false);
 const [phase,setPhase]=useState<'print'|'hunt'|'ready'>('print');
 const [lock,setLock]=useState(0);
 const [dragging,setDragging]=useState(false);
 const [searching,setSearching]=useState(false);
 const [closing,setClosing]=useState(false);
 /** O que o Automático achou (rostos ou mapa de interesse). */
 const [found,setFound]=useState<PhotoSubject|null>(null);
 const [missed,setMissed]=useState(0);

 /** Automático: procura o rosto principal (de novo, quando clicado) e centraliza exatamente nele. */
 async function findAuto(fresh=false){
  if(searching)return;
  setSearching(true);
  try{
   const subject=findSubject?await findSubject(fresh).catch(()=>null):null;
   setFound(subject);setAuto(true);setLock(n=>n+1);
   if(fresh&&!subject?.face)setMissed(n=>n+1);
  }finally{setSearching(false);}
 }
 useEffect(()=>{
  void ensureFont('Bebas Neue').catch(()=>{});
  dialog.current?.showModal();
  // Foco do teclado na foto (e não no X, que ganharia um anel em volta).
  stage.current?.focus({preventScroll:true});
  // Foto entrando como se fosse impressa; depois o foco "procura" e trava no assunto.
  const hunt=window.setTimeout(()=>setPhase('hunt'),720);
  const ready=window.setTimeout(()=>{setPhase('ready');setLock(n=>n+1);},1300);
  if(slot.auto!==false)void findAuto();
  return()=>{window.clearTimeout(hunt);window.clearTimeout(ready);};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);

 // No automático o ponto vem do que foi achado (e acompanha o zoom); à mão, de onde a pessoa tocou.
 const autoPoint=auto&&found?(found.face?subjectPoint(found,imageW,imageH,width,height,zoom):centerOf(autoFrame({...slot,zoom},imageW,imageH,width,height,found))):undefined;
 const current=autoPoint??point;
 const shown=phase==='print'?{x:.5,y:.5}:current;
 // Quadrado de foco: em volta do rosto quando ele foi achado; senão, no ponto escolhido.
 const faceBox=auto&&found?.faces&&phase!=='print'?found.faces:undefined;
 /** Janela (o que aparece no álbum) para um ponto: posição e tamanho em % da foto. */
 const windowAt=(at:Point)=>{const c=cropRectangle(imageW,imageH,width,height,slotForFocus({...slot,zoom},imageW,imageH,width,height,at));return {x:c.x/imageW*100,y:c.y/imageH*100,w:c.width/imageW*100,h:c.height/imageH*100};};
 const view=windowAt(shown);
 const result=slotForFocus({...slot,zoom},imageW,imageH,width,height,current);

 // Arrastar: mexe direto nos elementos (transform, sem redesenhar a tela) para acompanhar o mouse sem atraso.
 const pan=useRef<HTMLDivElement>(null),lit=useRef<HTMLImageElement>(null),aim=useRef<HTMLDivElement>(null);
 const live=useRef<Point|null>(null),rect=useRef<DOMRect|null>(null);
 function moveTo(at:Point){
  live.current=at;
  const v=windowAt(at);
  if(pan.current)pan.current.style.transform=`translate3d(${v.x}%,${v.y}%,0)`;
  if(lit.current)lit.current.style.transform=`translate3d(${-v.x}%,${-v.y}%,0)`;
  if(aim.current)aim.current.style.transform=`translate3d(${at.x*100}%,${at.y*100}%,0)`;
 }
 function pointFrom(event:PointerEvent<HTMLDivElement>):Point{
  const r=rect.current||picture.current!.getBoundingClientRect();
  return {x:clamp((event.clientX-r.left)/r.width,0,1),y:clamp((event.clientY-r.top)/r.height,0,1)};
 }
 function startDrag(event:PointerEvent<HTMLDivElement>){
  if(event.button!==0)return;
  event.currentTarget.setPointerCapture(event.pointerId);
  rect.current=picture.current!.getBoundingClientRect();
  const at=pointFrom(event);
  // O estado já recebe o ponto: o React redesenha no mesmo lugar e não puxa a mira de volta.
  setPoint(at);setDragging(true);setAuto(false);if(phase!=='ready')setPhase('ready');
  moveTo(at);
 }
 function endDrag(){
  if(!dragging)return;
  setDragging(false);rect.current=null;
  if(live.current)setPoint(live.current);live.current=null;
  setLock(n=>n+1);
 }
 function zoomBy(delta:number){setZoom(z=>Math.round(clamp(z+delta,MIN_ZOOM,MAX_ZOOM)*100)/100);}
 function apply(){
  if(closing)return;setClosing(true);
  window.setTimeout(()=>{onApply({...result,auto});onClose();},300);
 }
 function onKey(event:KeyboardEvent<HTMLDivElement>){
  const step=event.shiftKey?.08:.02;
  if(auto)setPoint(current);
  const moves:Record<string,Point>={ArrowLeft:{x:-step,y:0},ArrowRight:{x:step,y:0},ArrowUp:{x:0,y:-step},ArrowDown:{x:0,y:step}};
  const move=moves[event.key];
  if(move){event.preventDefault();setPoint(p=>({x:clamp(p.x+move.x,0,1),y:clamp(p.y+move.y,0,1)}));setAuto(false);return;}
  if(event.key==='+'||event.key==='='){event.preventDefault();zoomBy(.1);}
  else if(event.key==='-'){event.preventDefault();zoomBy(-.1);}
  else if(event.key==='Enter'){event.preventDefault();apply();}
 }

 return <dialog ref={dialog} className="dm-fx" data-phase={phase} data-busy={searching||undefined} data-closing={closing||undefined} onCancel={onClose} onClose={onClose} aria-label="Foco da foto">
  <header className="dm-fx-top"><h2 className="dm-fx-title" aria-label="Foco">
   {/* Reconhecimento facial na palavra: cantos procuram e travam, feixe escaneia, letras saem do desfocado para o nítido */}
   <span className="dm-fx-word" aria-hidden="true">
    {[...'FOCO'].map((letter,k)=><b key={k} data-text={letter} style={{'--k':k} as CSSProperties}>{letter}</b>)}
    <i className="dm-fx-corner"/><i className="dm-fx-corner"/><i className="dm-fx-corner"/><i className="dm-fx-corner"/>
    <span className="dm-fx-scanline"/>
    <span className="dm-fx-lock"/>
   </span>
  </h2><button type="button" className="dm-fx-close" aria-label="Fechar" onClick={onClose}><X size={22} strokeWidth={2.2}/></button></header>
  <div ref={stage} className="dm-fx-stage" tabIndex={0} role="application" aria-label="Toque no que deve ficar no centro. Setas movem, + e − ampliam, Enter aplica." onKeyDown={onKey}
   onPointerDown={startDrag} onPointerMove={e=>{if(dragging)moveTo(pointFrom(e));}} onPointerUp={endDrag} onPointerCancel={endDrag}
   onWheel={e=>zoomBy(e.deltaY>0?-.08:.08)}>
   <div ref={picture} className="dm-fx-photo" data-moving={dragging||undefined} style={{'--ar':imageW/imageH} as CSSProperties}>
    <img className="dm-fx-base" src={url} alt={photo.name} draggable={false}/>
    <span className="dm-fx-print" aria-hidden="true"/>
    <span className="dm-fx-dim" aria-hidden="true"/>
    {/* Janela clara: uma cópia da foto que anda junto, recortada no tamanho do quadro do álbum */}
    <div ref={pan} className="dm-fx-pan" aria-hidden="true" style={{transform:`translate3d(${view.x}%,${view.y}%,0)`}}>
     <div className="dm-fx-window" style={{width:view.w+'%',height:view.h+'%'}}>
      <img ref={lit} src={url} alt="" draggable={false} style={{width:10000/view.w+'%',height:10000/view.h+'%',transform:`translate3d(${-view.x}%,${-view.y}%,0)`}}/>
      <i/><b/><b/><b/><b/>
     </div>
    </div>
    <div ref={aim} className="dm-fx-aim" aria-hidden="true" style={{transform:faceBox?`translate3d(${(faceBox.x+faceBox.w/2)*100}%,${(faceBox.y+faceBox.h/2)*100}%,0)`:`translate3d(${shown.x*100}%,${shown.y*100}%,0)`}}>
     <span key={lock} className="dm-fx-reticle" data-face={faceBox?true:undefined} style={faceBox?{width:`max(44px,${faceBox.w*100*1.15}%)`,height:`max(44px,${faceBox.h*100*1.15}%)`}:undefined}><i/><i/><i/><i/><em/></span>
    </div>
    <span className="dm-fx-flash" aria-hidden="true"/>
   </div>
  </div>
  <footer className="dm-fx-bar">
   <div className="dm-fx-zoom">
    <button type="button" aria-label="Diminuir" disabled={zoom<=MIN_ZOOM} onClick={()=>zoomBy(-.1)}><ZoomOut size={17}/></button>
    <input aria-label="Ampliação" type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={.01} value={zoom} style={{'--p':`${(zoom-MIN_ZOOM)/(MAX_ZOOM-MIN_ZOOM)*100}%`} as CSSProperties} onChange={e=>setZoom(Number(e.target.value))}/>
    <button type="button" aria-label="Aumentar" disabled={zoom>=MAX_ZOOM} onClick={()=>zoomBy(.1)}><ZoomIn size={17}/></button>
   </div>
   <div className="dm-fx-actions">
    <button type="button" className="dm-fx-auto" data-on={auto||undefined} data-busy={searching||undefined} aria-pressed={auto} key={'auto-'+missed} data-missed={missed||undefined} onClick={()=>void findAuto(true)}><ScanFace size={18}/>Automático</button>
    <button type="button" className="dm-fx-apply" onClick={apply}><Check size={18}/>Aplicar</button>
   </div>
  </footer>
 </dialog>;
}
