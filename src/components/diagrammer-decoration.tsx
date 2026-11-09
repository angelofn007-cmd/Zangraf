'use client';
import {useEffect,useRef,useState,createElement} from 'react';
import {ALBUM_ICONS,drawTexture,type AlbumIcon,type TextureName} from '@/lib/album-decorations';

export function DecorativeIcon({kind,color='currentColor'}:{kind:string;color?:string}){
 const item=ALBUM_ICONS.find(i=>i.id===kind);
 return <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{item?.nodes.map(([tag,attrs],i)=>createElement(tag,{...attrs,key:i}))}</svg>;
}
export function TextureLayer({texture,width,height,compact=false}:{texture?:TextureName;width:number;height:number;compact?:boolean}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const canvas=ref.current;if(!canvas)return;canvas.width=compact?240:1200;canvas.height=Math.round(canvas.width*height/width);const ctx=canvas.getContext('2d');if(!ctx)return;ctx.scale(canvas.width/width,canvas.width/width);drawTexture(ctx,texture,width,height);},[texture,width,height,compact]);
 return texture&&texture!=='none'?<canvas ref={ref} className="dm-texture-layer" aria-hidden="true"/>:null;
}
export type IconInteractions={selectedIcon?:string;onIconSelect?:(id:string)=>void;onIconChange?:(id:string,patch:Partial<AlbumIcon>)=>void};
export function IconLayer({icons,width,height,selectedIcon,onIconSelect,onIconChange}:{icons:AlbumIcon[];width:number;height:number}&IconInteractions){
 const stage=useRef<HTMLDivElement>(null),drag=useRef<{id:string;px:number;py:number;x:number;y:number;w:number;h:number;next:AlbumIcon}|null>(null);
 const [draft,setDraft]=useState<AlbumIcon|null>(null);
 return <div ref={stage} className="dm-decoration-layer">{icons.map(original=>{const icon=draft?.id===original.id?draft:original;const style={left:icon.x+'%',top:icon.y+'%',width:icon.sizeMm/width*100+'%',height:icon.sizeMm/height*100+'%',transform:`rotate(${icon.rotation}deg)`};const content=<DecorativeIcon kind={icon.kind} color={icon.color}/>;
  if(!onIconSelect)return <span key={icon.id} style={style}>{content}</span>;
  return <button type="button" key={icon.id} className={selectedIcon===icon.id?'selected':''} style={style} aria-label={`Ícone: ${ALBUM_ICONS.find(i=>i.id===icon.kind)?.label||icon.kind}`} onClick={()=>onIconSelect(icon.id)} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();onIconSelect(icon.id);const rect=stage.current!.getBoundingClientRect();drag.current={id:icon.id,px:e.clientX,py:e.clientY,x:icon.x,y:icon.y,w:rect.width,h:rect.height,next:icon};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=drag.current;if(!d)return;d.next={...icon,x:Math.max(0,Math.min(100-icon.sizeMm/width*100,d.x+(e.clientX-d.px)/d.w*100)),y:Math.max(0,Math.min(100-icon.sizeMm/height*100,d.y+(e.clientY-d.py)/d.h*100))};setDraft(d.next)}} onPointerUp={()=>{const d=drag.current;drag.current=null;setDraft(null);if(d)onIconChange?.(icon.id,{x:d.next.x,y:d.next.y})}} onPointerCancel={()=>{drag.current=null;setDraft(null)}}>{content}</button>;
 })}</div>;
}
