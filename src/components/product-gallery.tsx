'use client';
import Image from 'next/image';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,Expand,X} from 'lucide-react';
import type {Product} from '@/lib/products';
import {ProductVisual} from './product-card';

export function ProductGallery({product}:{product:Product}){
  const photos=[...new Set([product.imageUrl,...product.imageUrls??[]].filter((url):url is string=>!!url))];
  const [index,setIndex]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const selected=photos[index]??photos[0];
  useEffect(()=>{if(expanded&&!dialog.current?.open)dialog.current?.showModal();else if(!expanded&&dialog.current?.open)dialog.current?.close()},[expanded]);
  const move=(direction:number)=>setIndex(current=>(current+direction+photos.length)%photos.length);
  if(!photos.length)return <div className="zg-detail-art"><ProductVisual product={product}/></div>;
  return <div className="zg-gallery">
    <button className="zg-gallery-main zg-detail-art" onClick={()=>setExpanded(true)} aria-label={`Ampliar foto ${index+1} de ${product.name}`}>
      <Image src={selected} alt={`${product.name}, foto ${index+1}`} fill sizes="(max-width:760px) 90vw, 48vw" unoptimized={!selected.startsWith('/')} preload style={{objectFit:'contain'}}/>
      <span className="zg-gallery-expand"><Expand size={16}/> Ampliar</span>
    </button>
    {photos.length>1&&<div className="zg-gallery-thumbnails" aria-label="Fotos do produto">{photos.map((src,i)=><button key={src} className={i===index?'selected':''} aria-label={`Ver foto ${i+1} de ${photos.length}`} aria-pressed={i===index} onClick={()=>setIndex(i)}><Image src={src} alt="" fill sizes="80px" unoptimized={!src.startsWith('/')} style={{objectFit:'cover'}}/></button>)}</div>}
    <p className="zg-gallery-count" aria-live="polite">Foto {index+1} de {photos.length} · Produto Zangraf</p>
    <dialog ref={dialog} className="zg-gallery-dialog" onCancel={()=>setExpanded(false)} onClose={()=>setExpanded(false)} aria-label={`Galeria de ${product.name}`}>
      <div className="zg-gallery-dialog-header"><span>{product.name}</span><button onClick={()=>setExpanded(false)} aria-label="Fechar galeria"><X size={24}/></button></div>
      <div className="zg-gallery-large"><Image src={selected} alt={`${product.name}, foto ${index+1}`} fill sizes="(max-width:760px) 96vw, 850px" unoptimized={!selected.startsWith('/')} style={{objectFit:'contain'}}/></div>
      <div className="zg-gallery-controls"><button aria-label="Foto anterior" disabled={photos.length<2} onClick={()=>move(-1)}><ChevronLeft size={22}/></button><span aria-live="polite">{index+1} / {photos.length}</span><button aria-label="Próxima foto" disabled={photos.length<2} onClick={()=>move(1)}><ChevronRight size={22}/></button></div>
    </dialog>
  </div>;
}
