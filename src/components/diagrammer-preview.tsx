'use client';
import {useEffect,useRef,useState,type CSSProperties,type DragEvent,type PointerEvent} from 'react';
import {ensureTextFonts} from '@/lib/album-fonts';
import {TextureLayer,IconLayer,type IconInteractions} from './diagrammer-decoration';
import {ImagePlus,TriangleAlert, RefreshCw} from 'lucide-react';
import {spreadRectangles,frameGeometry,defaultPrintSpec,effectiveDpi,resolutionLevel,type Cover,type Slot,type Spread,type PrintSpec,type AlbumText,type FrameRect} from '@/lib/layout-projects';

/** Tipo de arraste usado para trocar fotos entre quadros da mesma área. */
export const SLOT_DRAG_TYPE='application/x-zangraf-slot';
export type PhotoSizes=Record<string,{width?:number;height?:number}>;
import {drawCoverText,drawAlbumTexts,albumTextLines} from './diagrammer-text';
import {surfaceFit,surfaceUrl} from '@/lib/album-decorations';
import {photoFilterCss,photoWarmthLayer} from '@/lib/photo-adjust';

type Images=Record<string,string>;
type Box={x:number;y:number;w:number;h:number};
/** Camada da textura fotográfica de fundo, na mesma posição usada no arquivo de impressão. */
function SurfaceLayer({surface,width,height,bleed,compact}:{surface?:string;width:number;height:number;bleed:number;compact:boolean}){
 if(!surface)return null;
 const fit=surfaceFit(surface,width,height,bleed);
 return <div aria-hidden="true" style={{position:'absolute',inset:0,pointerEvents:'none',backgroundImage:`url(${surfaceUrl(surface,compact)})`,backgroundRepeat:'no-repeat',backgroundPosition:'center',backgroundSize:`${fit.w/width*100}% ${fit.h/height*100}%`}}/>;
}
/** Imagem própria no fundo da página, cobrindo tudo (por baixo das fotos e textos). */
function BackgroundImage({id,urls}:{id?:string;urls:Images}){
 if(!id||!urls[id])return null;
 // eslint-disable-next-line @next/next/no-img-element
 return <img className="zg-bg-image" src={urls[id]} alt="" aria-hidden="true" draggable={false} onError={()=>window.dispatchEvent(new CustomEvent('zangraf-photo-error',{detail:id}))} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',pointerEvents:'none'}}/>;
}
export function PhotoFrame({slot,urls,alt,geometry}:{slot:Slot;urls:Images;alt:string;geometry?:{trim:Box;image:Box}}){
 if(!slot?.photoId||!urls[slot.photoId])return <span className="zg-empty-frame"><ImagePlus size={24}/><span>Arraste uma foto</span></span>;
 const {trim,image}=geometry||{trim:{x:0,y:0,w:1,h:1},image:{x:0,y:0,w:1,h:1}};
 const warmth=photoWarmthLayer(slot.adjust);
 return <span style={{position:'absolute',display:'block',left:`${(image.x-trim.x)/trim.w*100}%`,top:`${(image.y-trim.y)/trim.h*100}%`,width:`${image.w/trim.w*100}%`,height:`${image.h/trim.h*100}%`,overflow:'hidden'}}><span style={{display:'block',position:'absolute',inset:0,transform:`scale(${slot.flipX?-1:1},${slot.flipY?-1:1})`,filter:photoFilterCss(slot.adjust)}}><img src={urls[slot.photoId]} alt={alt} draggable={false} onError={()=>window.dispatchEvent(new CustomEvent('zangraf-photo-error',{detail:slot.photoId}))} style={{objectPosition:`${slot.x}% ${slot.y}%`,transform:`scale(${slot.zoom||1})`,transformOrigin:`${slot.x}% ${slot.y}%`}}/></span>{warmth&&<span aria-hidden="true" style={{position:'absolute',inset:0,background:warmth.color,opacity:warmth.opacity,mixBlendMode:'soft-light',pointerEvents:'none'}}/>}</span>;
}
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
type TextProps={selectedText?:string;onTextSelect?:(id:string)=>void;onTextChange?:(id:string,patch:Partial<AlbumText>)=>void};
type Handle='n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
export function TextLayer({texts,width,height,selectedText,onTextSelect,onTextChange,compact=false}:{texts:AlbumText[];width:number;height:number;compact?:boolean}&TextProps&IconInteractions){
 const canvas=useRef<HTMLCanvasElement>(null);const stage=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:string;px:number;py:number;x:number;y:number;width:number;boxH:number;textH:number;fontSize:number;w:number;h:number;mode:Handle|'move';next:AlbumText}|null>(null);
 const [draft,setDraft]=useState<AlbumText|null>(null);const [boxes,setBoxes]=useState<Record<string,number>>({});
 useEffect(()=>{
  const c=canvas.current;if(!c)return;c.width=compact?240:1600;c.height=Math.round(c.width*height/width);const ctx=c.getContext('2d');if(!ctx)return;
  ctx.scale(c.width/width,c.width/width);const displayed=texts.map(t=>draft?.id===t.id?draft:t);let active=true;void ensureTextFonts(displayed).then(()=>{if(!active)return;drawAlbumTexts(ctx,displayed,width,height);
  const heights:Record<string,number>={};for(const t of displayed){const {lines,lineHeight}=albumTextLines(ctx,t,width);heights[t.id]=lines.length*lineHeight/height*100;}setBoxes(heights);}).catch(()=>{});return()=>{active=false;};
 },[texts,width,height,draft,compact]);
 return <div className="zg-text-layer" ref={stage}><canvas ref={canvas} aria-hidden="true"/>{texts.map(text=>{const t=draft?.id===text.id?draft:text;const hitWidth=t.rotation===90?(boxes[t.id]||8)*height/width:t.width;const textH=boxes[t.id]||8;const hitHeight=t.rotation===90?t.width*width/height:Math.max(textH,t.height||0);const begin=(e:React.PointerEvent<HTMLElement>,mode:Handle|'move',target:HTMLElement)=>{const r=stage.current!.getBoundingClientRect();drag.current={id:t.id,px:e.clientX,py:e.clientY,x:t.x,y:t.y,width:t.width,boxH:hitHeight,textH,fontSize:t.fontSize,w:r.width,h:r.height,mode,next:t};target.setPointerCapture(e.pointerId);};
  const handles:Handle[]=t.rotation===90?['nw','ne','sw','se','s']:['nw','n','ne','e','se','s','sw','w'];
  return onTextSelect?<button key={t.id} className={`zg-text-hit ${selectedText===t.id?'selected':''}`} aria-label={`Texto: ${t.text}`} style={{left:t.x+'%',top:t.y+'%',width:hitWidth+'%',height:hitHeight+'%'}} onClick={e=>{e.stopPropagation();onTextSelect(t.id)}}
   onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();onTextSelect(t.id);begin(e,'move',e.currentTarget)}}
   onPointerMove={e=>{const d=drag.current;if(!d||d.id!==t.id)return;const dx=(e.clientX-d.px)/d.w*100,dy=(e.clientY-d.py)/d.h*100;const m=d.mode;
    if(m==='move'){d.next={...t,x:clamp(d.x+dx,0,100-hitWidth),y:clamp(d.y+dy,0,Math.max(0,100-hitHeight))};setDraft(d.next);return;}
    if(t.rotation===90&&m==='s'){d.next={...t,width:clamp(d.width+dy*height/width,5,100)};setDraft(d.next);return;}
    if(m.length===2){
     // Canto: aumenta ou diminui o texto inteiro, na proporção, preso ao canto oposto.
     const grow=m.includes('e')?dx:-dx;let factor=Math.max(.2,(d.width+grow)/d.width);
     factor=clamp(factor,8/d.fontSize,Math.min(144/d.fontSize,(m.includes('e')?100-d.x:d.x+d.width)/d.width));
     const nextWidth=d.width*factor,nextBox=d.boxH*factor;
     d.next={...t,fontSize:Math.round(d.fontSize*factor*10)/10,width:nextWidth,height:t.height?nextBox:t.height,x:m.includes('w')?d.x+d.width-nextWidth:d.x,y:m.includes('n')?clamp(d.y+d.boxH-nextBox,0,100):d.y};
    }
    else if(m==='e')d.next={...t,width:clamp(d.width+dx,5,100-d.x)};
    else if(m==='w'){const x=clamp(d.x+dx,0,d.x+d.width-5);d.next={...t,x,width:d.width-(x-d.x)};}
    else if(m==='s')d.next={...t,height:clamp(d.boxH+dy,d.textH,100-d.y)};
    else {const y=clamp(d.y+dy,0,d.y+d.boxH-d.textH);d.next={...t,y,height:d.boxH-(y-d.y)};}
    setDraft(d.next)}}
   onPointerUp={e=>{const d=drag.current;if(!d)return;drag.current=null;setDraft(null);const n=d.next;onTextChange?.(t.id,d.mode==='move'?{x:n.x,y:n.y}:{x:n.x,y:n.y,width:Math.round(n.width*10)/10,fontSize:Math.max(8,Math.min(144,Math.round(n.fontSize))),...(n.height!==undefined?{height:Math.round(n.height*10)/10}:{})});if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
   onPointerCancel={()=>{drag.current=null;setDraft(null)}}><span className="sr-only">{t.text}</span>
   {selectedText===t.id&&handles.map(side=><span key={side} className={`zg-text-resize ${side}`} aria-hidden="true" title={side.length===2?'Arraste para aumentar ou diminuir o texto':side==='n'||side==='s'?'Arraste para mudar a altura':'Arraste para mudar a largura'} onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();begin(e,side,e.currentTarget.parentElement as HTMLElement)}}/>)}
  </button>:<span className="sr-only" key={t.id}>{t.text}</span>})}</div>;
}
type Interaction={mode?:'crop'|'position';onCropRequest?:()=>void;onSlotChange?:(index:number,patch:Partial<Slot>)=>void;onFrameChange?:(index:number,rect:FrameRect)=>void;onSlotSwap?:(from:number,to:number)=>void;onReplaceRequest?:(index:number)=>void;photoSizes?:PhotoSizes;guides?:boolean;hideFold?:boolean;compact?:boolean}&TextProps&IconInteractions;
export function AlbumSpread({spread,urls,selected,onSelect,onPhotoDrop,ratio=2,spec,mode='crop',onCropRequest,onSlotChange,onFrameChange,onSlotSwap,onReplaceRequest,photoSizes,guides=false,hideFold=false,compact=false,selectedIcon,onIconSelect,onIconChange,...textProps}:{spread:Spread;urls:Images;selected?:number;ratio?:number;spec?:PrintSpec;onSelect?:(index:number)=>void;onPhotoDrop?:(index:number,id:string)=>void}&Interaction){
 const [swapTarget,setSwapTarget]=useState<number|null>(null);
 const physical=spec||{...defaultPrintSpec(),widthMm:150*ratio};const stage=useRef<HTMLDivElement>(null);
 const drag=useRef<{index:number;px:number;py:number;w:number;h:number;slot:Slot;rect:FrameRect;resize:boolean;overflowX:number;overflowY:number;nextSlot?:Slot;nextRect?:FrameRect}|null>(null);
 const [draft,setDraft]=useState<{index:number;slot?:Slot;rect?:FrameRect}|null>(null);
 function start(event:PointerEvent,index:number,resize=false){if(event.button!==0)return;onSelect?.(index);if(!onSlotChange&&!onFrameChange)return;event.preventDefault();event.stopPropagation();const r=stage.current!.getBoundingClientRect();drag.current={index,px:event.clientX,py:event.clientY,w:r.width,h:r.height,slot:spread.slots[index],rect:spreadRectangles(spread)[index],resize,overflowX:0,overflowY:0};const img=event.currentTarget.querySelector('img');if(img){const scale=Math.max(img.clientWidth/img.naturalWidth,img.clientHeight/img.naturalHeight)*(spread.slots[index].zoom||1);drag.current.overflowX=img.naturalWidth*scale-img.clientWidth;drag.current.overflowY=img.naturalHeight*scale-img.clientHeight;}event.currentTarget.setPointerCapture(event.pointerId);}
 function move(event:PointerEvent){const d=drag.current;if(!d)return;const dx=(event.clientX-d.px)/d.w,dy=(event.clientY-d.py)/d.h;
  if(mode==='position'||d.resize){const r=d.rect;d.nextRect=d.resize?{...r,w:clamp(r.w+dx,.08,1-r.x),h:clamp(r.h+dy,.08,1-r.y)}:{...r,x:clamp(r.x+dx,0,1-r.w),y:clamp(r.y+dy,0,1-r.h)};setDraft({index:d.index,rect:d.nextRect});}
  else if(d.slot.photoId){d.nextSlot={...d.slot,auto:false,x:d.overflowX>1?clamp(d.slot.x-(event.clientX-d.px)/d.overflowX*100*(d.slot.flipX?-1:1),0,100):d.slot.x,y:d.overflowY>1?clamp(d.slot.y-(event.clientY-d.py)/d.overflowY*100*(d.slot.flipY?-1:1),0,100):d.slot.y};setDraft({index:d.index,slot:d.nextSlot});}
 }
 function end(){const d=drag.current;drag.current=null;setDraft(null);if(d?.nextRect)onFrameChange?.(d.index,d.nextRect);else if(d?.nextSlot)onSlotChange?.(d.index,d.nextSlot);}
 return <div ref={stage} className="zg-spread" aria-label="Lâmina do álbum" style={{aspectRatio:ratio,background:spread.background||'#ffffff'}}>
  <SurfaceLayer surface={spread.surface} width={physical.widthMm*2} height={physical.heightMm} bleed={physical.bleedMm} compact={compact}/>
  <BackgroundImage id={spread.backgroundPhotoId} urls={urls}/>
  {spread.rightBackground&&<div className="zg-right-background" style={{background:spread.rightBackground}}/>}
  <TextureLayer texture={spread.texture} width={physical.widthMm*2} height={physical.heightMm} compact={compact}/>
  {spreadRectangles(spread).map((original,index)=>{
   const rect=draft?.index===index&&draft.rect?draft.rect:original;const geometry=frameGeometry(rect,physical,!hideFold,spread.spacing);const frame=geometry.trim;
   const style:CSSProperties={left:`${frame.x/(physical.widthMm*2)*100}%`,top:`${frame.y/physical.heightMm*100}%`,width:`${frame.w/(physical.widthMm*2)*100}%`,height:`${frame.h/physical.heightMm*100}%`};
   const slot=draft?.index===index&&draft.slot?draft.slot:spread.slots[index];
   const content=<div><PhotoFrame slot={slot} urls={urls} geometry={geometry} alt={`Foto ${index+1}`}/></div>;
   if(!onSelect)return <div className={`zg-frame ${slot?.photoId?'':'empty'} ${frame.w<frame.h*.3?'is-narrow':''}`} key={index} style={style}>{content}</div>;
   function drop(event:DragEvent){event.preventDefault();event.stopPropagation();setSwapTarget(null);
    const from=event.dataTransfer.getData(SLOT_DRAG_TYPE);
    if(from!==''){const source=Number(from);if(Number.isInteger(source)&&source!==index)onSlotSwap?.(source,index);return;}
    const id=event.dataTransfer.getData('application/x-zangraf-photo');if(id)onPhotoDrop?.(index,id)}
   const photo=slot?.photoId?photoSizes?.[slot.photoId]:undefined;
   const dpi=photo?effectiveDpi(photo,geometry.image.w,geometry.image.h,slot):undefined;
   const quality=resolutionLevel(dpi,physical.dpi);
   const accepts=(event:DragEvent)=>event.dataTransfer.types.includes('application/x-zangraf-photo')||(!!onSlotSwap&&event.dataTransfer.types.includes(SLOT_DRAG_TYPE));
   return <div key={index} className={`zg-frame ${slot?.photoId?'':'empty'} ${frame.w<frame.h*.3?'is-narrow':''} ${selected===index?'is-selected':''} ${mode==='position'?'move-frame':''} ${swapTarget===index?'is-swap-target':''}`} style={style}>
    <button type="button" className="zg-frame-hit" aria-label={`Selecionar quadro ${index+1}${slot?.photoId?' com foto':', vazio'}${quality==='low'?', resolução baixa':quality==='limit'?', resolução no limite':''}`} aria-pressed={selected===index} onClick={()=>onSelect(index)} onDoubleClick={()=>onCropRequest?.()} onPointerDown={e=>start(e,index)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;setDraft(null)}} onDragOver={event=>{if(accepts(event)){event.preventDefault();if(swapTarget!==index)setSwapTarget(index)}}} onDragLeave={()=>setSwapTarget(current=>current===index?null:current)} onDrop={drop}>{content}</button>
    {!compact&&quality!=='ok'&&dpi!==undefined&&<span className={`zg-dpi-badge ${quality}`} tabIndex={0} aria-describedby={`zg-dpi-tip-${index}`}><TriangleAlert size={12} aria-hidden="true"/>{Math.round(dpi)} DPI
     <span role="tooltip" id={`zg-dpi-tip-${index}`} className={`zg-dpi-tip ${frame.y/physical.heightMm>.45?'up':''}`}>
      <strong>{quality==='low'?'Esta foto pode sair borrada':'Qualidade no limite'}</strong>
      <span className="zg-dpi-meter" aria-hidden="true"><i style={{width:`${Math.min(100,dpi/physical.dpi*100)}%`}}/></span>
      <span>{quality==='low'?`Neste tamanho ela fica com ${Math.round(dpi)} DPI. Para uma impressão nítida nas máquinas HP da Zangraf, o ideal é ${physical.dpi}.`:`Neste tamanho ela fica com ${Math.round(dpi)} DPI. Vai imprimir bem, só um pouco menos nítida que o ideal (${physical.dpi}).`}</span>
      <em>Como melhorar</em>
      <ul><li>Diminua o zoom da foto</li><li>Use um quadro menor</li><li>Envie o arquivo original — fotos do WhatsApp perdem qualidade</li></ul>
     </span>
    </span>}
    {slot?.photoId&&(onReplaceRequest||(onSlotSwap&&spread.slots.length>1))&&<button type="button" className="zg-swap-handle" draggable={!!onSlotSwap&&spread.slots.length>1} aria-label={`Trocar a foto do quadro ${index+1}`} title="Trocar foto" onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();if(onReplaceRequest)onReplaceRequest(index);else onSlotSwap?.(index,(index+1)%spread.slots.length)}} onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData(SLOT_DRAG_TYPE,String(index));e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setSwapTarget(null)}><RefreshCw size={15} strokeWidth={2.2} aria-hidden="true"/></button>}
    {selected===index&&mode==='position'&&<button className="zg-resize-handle" aria-label="Redimensionar quadro" onPointerDown={e=>start(e,index,true)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null;setDraft(null)}}/>}
   </div>;
  })}
  {!!spread.texts?.length&&<TextLayer texts={spread.texts} width={physical.widthMm*2} height={physical.heightMm} compact={compact} {...textProps}/>}
  {!!spread.icons?.length&&<IconLayer icons={spread.icons} width={physical.widthMm*2} height={physical.heightMm} selectedIcon={selectedIcon} onIconSelect={onIconSelect} onIconChange={onIconChange}/>}
  {!hideFold&&<span className="zg-fold" aria-hidden="true"/>}{guides&&<div className="zg-safe-guide" aria-hidden="true" style={{inset:`${5/physical.heightMm*100}% ${5/(physical.widthMm*2)*100}%`}}/>}
 </div>;
}
export function AlbumCover({cover,urls,onPhotoDrop,ratio=1,back=false,spec,guides=false,mode,onCropRequest,onSlotChange,onFrameChange,onSlotSwap,onReplaceRequest,photoSizes,selected,onSelect,compact=false,selectedIcon,onIconSelect,onIconChange,...textProps}:{cover:Cover;urls:Images;ratio?:number;back?:boolean;spec?:PrintSpec;guides?:boolean;onPhotoDrop?:(id:string,index?:number)=>void;selected?:number;onSelect?:(index:number)=>void}&Interaction){
 const textCanvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=textCanvas.current;if(!canvas)return;canvas.width=1000;canvas.height=Math.round(1000/ratio);const ctx=canvas.getContext('2d');if(ctx)drawCoverText(ctx,cover,1000,1000/ratio,back)},[cover,ratio,back]);
 const physical=spec||{...defaultPrintSpec(),widthMm:300*ratio};const bleed=physical.bleedMm;
 if(cover.composition)return <AlbumSpread spread={{...cover.composition,background:cover.color,texts:cover.texts,texture:cover.texture,surface:cover.surface,backgroundPhotoId:cover.backgroundPhotoId,icons:cover.icons}} urls={urls} ratio={ratio} spec={{...physical,widthMm:physical.widthMm/2}} selected={selected} onSelect={onSelect} onPhotoDrop={onPhotoDrop?(index,id)=>onPhotoDrop(id,index):undefined} mode={mode} onCropRequest={onCropRequest} onSlotChange={onSlotChange} onFrameChange={onFrameChange} onSlotSwap={onSlotSwap} onReplaceRequest={onReplaceRequest} photoSizes={photoSizes} guides={guides} hideFold compact={compact} selectedIcon={selectedIcon} onIconSelect={onIconSelect} onIconChange={onIconChange} {...textProps}/>;
 const geometry={trim:{x:0,y:0,w:physical.widthMm,h:physical.heightMm},image:{x:-bleed,y:-bleed,w:physical.widthMm+bleed*2,h:physical.heightMm+bleed*2}};
 return <div className={`zg-cover ${cover.photo.photoId&&!cover.customText?'legacy-photo':''}`} style={{background:cover.color,color:cover.textColor,aspectRatio:ratio}} onDragOver={event=>{if(onPhotoDrop&&event.dataTransfer.types.includes('application/x-zangraf-photo'))event.preventDefault()}} onDrop={event=>{event.preventDefault();const id=event.dataTransfer.getData('application/x-zangraf-photo');if(id)onPhotoDrop?.(id)}}>
  <SurfaceLayer surface={cover.surface} width={physical.widthMm} height={physical.heightMm} bleed={bleed} compact={compact}/>
  <BackgroundImage id={cover.backgroundPhotoId} urls={urls}/>
  <TextureLayer texture={cover.texture} width={physical.widthMm} height={physical.heightMm} compact={compact}/>
  {cover.photo.photoId&&<div className="zg-cover-photo"><PhotoFrame slot={cover.photo} urls={urls} geometry={geometry} alt="Fotografia da capa"/></div>}
  <canvas ref={textCanvas} className="zg-cover-text-canvas" aria-label={cover.customText?undefined:`${back?'Verso':'Capa'}: ${cover.title}. ${cover.subtitle}`}/>
  {!!cover.texts?.length&&<TextLayer texts={cover.texts} width={physical.widthMm} height={physical.heightMm} compact={compact} {...textProps}/>}
  {!!cover.icons?.length&&<IconLayer icons={cover.icons} width={physical.widthMm} height={physical.heightMm} selectedIcon={selectedIcon} onIconSelect={onIconSelect} onIconChange={onIconChange}/>}
  {guides&&<div className="zg-safe-guide" aria-hidden="true" style={{inset:`${5/physical.heightMm*100}% ${5/physical.widthMm*100}%`}}/>}
 </div>;
}
