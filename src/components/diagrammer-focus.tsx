'use client';
import {useEffect,useRef,useState} from 'react';
import {X,Focus,ScanFace} from 'lucide-react';
import {slotForFocus} from '@/lib/photo-focus';
import type {Photo,Slot} from '@/lib/layout-projects';

export function PhotoFocus({photo,url,slot,width,height,onApply,onClose}:{photo:Photo;url:string;slot:Slot;width:number;height:number;onApply:(slot:Slot)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),img=useRef<HTMLImageElement>(null);
 const [point,setPoint]=useState({x:.5,y:.5}),[message,setMessage]=useState('Clique no rosto ou no detalhe que deve ficar no centro.'),[detecting,setDetecting]=useState(false),[available,setAvailable]=useState(false);
 useEffect(()=>{dialog.current?.showModal();setAvailable('FaceDetector' in window);},[]);
 const [zoom,setZoom]=useState(slot.zoom||1);
 const next=slotForFocus({...slot,zoom},photo.width||1,photo.height||1,width,height,point);
 async function findFace(){
  type Detector={detect:(source:HTMLImageElement)=>Promise<{boundingBox:{x:number;y:number;width:number;height:number}}[]>};
  const Constructor=(window as unknown as {FaceDetector?:new(options:{fastMode:boolean;maxDetectedFaces:number})=>Detector}).FaceDetector;
  if(!Constructor||!img.current)return;setDetecting(true);
  try{const faces=await new Constructor({fastMode:false,maxDetectedFaces:10}).detect(img.current);const largest=faces.sort((a,b)=>b.boundingBox.width*b.boundingBox.height-a.boundingBox.width*a.boundingBox.height)[0];if(largest){const b=largest.boundingBox;setPoint({x:(b.x+b.width/2)/img.current.naturalWidth,y:(b.y+b.height/2)/img.current.naturalHeight});setMessage('Rosto em destaque localizado. Confira o recorte ou clique em outra pessoa.');}else setMessage('Nenhum rosto encontrado. Clique no ponto importante para ajustar.');}
  catch{setMessage('A detecção não está disponível nesta foto. Marque o ponto com um clique.');}finally{setDetecting(false);}
 }
 return <dialog ref={dialog} className="dm-focus-dialog" onCancel={onClose} onClose={onClose} aria-label="Definir foco da foto"><header><div><h2>O que importa nesta foto?</h2><p>{message}</p></div><button className="dm-icon" aria-label="Fechar enquadramento" onClick={onClose}><X size={20}/></button></header><div className="dm-focus-columns"><div><button className="dm-focus-source" aria-label="Marcar ponto importante na foto" onClick={e=>{if(e.detail===0)return;const r=e.currentTarget.getBoundingClientRect();setPoint({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height})}} onKeyDown={e=>{const key=e.key;if(!key.startsWith('Arrow'))return;e.preventDefault();setPoint(p=>({x:Math.max(0,Math.min(1,p.x+(key==='ArrowLeft'?-.02:key==='ArrowRight'?.02:0))),y:Math.max(0,Math.min(1,p.y+(key==='ArrowUp'?-.02:key==='ArrowDown'?.02:0)))}));}}><img ref={img} src={url} alt={photo.name}/><span style={{left:point.x*100+'%',top:point.y*100+'%'}}><Focus size={28}/></span></button><p>Você também pode usar as setas do teclado.</p></div><div><div className="dm-focus-result" style={{aspectRatio:width/height}}><div style={{position:'absolute',inset:0,transform:`scale(${slot.flipX?-1:1},${slot.flipY?-1:1})`}}><img src={url} alt="Prévia do enquadramento" style={{objectPosition:`${next.x}% ${next.y}%`,transform:`scale(${zoom})`,transformOrigin:`${next.x}% ${next.y}%`}}/></div></div><small>Como ficará no quadro</small><label>Ampliação da foto<input aria-label="Ampliação no enquadramento" type="range" min={1} max={3} step={.05} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label></div></div><footer>{available&&<button className="dm-button" disabled={detecting} onClick={()=>void findFace()}><ScanFace size={17}/>{detecting?'Localizando…':'Encontrar rosto'}</button>}<button className="dm-button primary" onClick={()=>{onApply(next);onClose()}}>Aplicar enquadramento</button></footer></dialog>;
}
