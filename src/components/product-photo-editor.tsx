'use client';
import {useRef, useState} from 'react';
import {Upload, ArrowLeft, ArrowRight, Star, Trash2} from 'lucide-react';

async function preparePhoto(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error(`${file.name}: use JPG, PNG ou WebP.`);
  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: o limite é 25 MB por foto.`);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale)); canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Não foi possível preparar a foto.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível preparar a foto.')),'image/webp',0.88));
    if(blob.size>3*1024*1024) throw new Error(`${file.name}: escolha uma foto menor.`);
    return blob;
  } finally { bitmap.close(); }
}

export function ProductPhotoEditor({photos,disabled,onChange,onBusy}:{photos:string[];disabled:boolean;onChange:(photos:string[])=>void;onBusy:(busy:boolean)=>void}) {
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [progress,setProgress] = useState('');
  const [error,setError] = useState('');
  const [dragging,setDragging] = useState(false);
  const [url,setUrl] = useState('');
  const busy = !!progress;
  async function addFiles(files: File[]) {
    if(disabled||lock.current||!files.length)return;
    if(files.length+photos.length>12){setError('A galeria aceita até 12 fotos. Remova uma foto ou selecione menos arquivos.');return;}
    lock.current=true;onBusy(true);setError('');
    const next=[...photos];const failures:string[]=[];
    try {
      for(let i=0;i<files.length;i++){
        setProgress(`Enviando foto ${i+1} de ${files.length}…`);
        try {
          const body=await preparePhoto(files[i]);
          const response=await fetch('/api/admin/produtos/fotos',{method:'POST',headers:{'Content-Type':'image/webp'},body});
          const data=await response.json();
          if(!response.ok)throw new Error(data.message||'Não foi possível enviar a foto.');
          next.push(data.url);onChange([...next]);
        }catch(e){failures.push(e instanceof Error?e.message:`Não foi possível enviar ${files[i].name}.`);}
      }
      setError(failures.join(' '));
    }finally{lock.current=false;setProgress('');onBusy(false);}
  }
  function move(index:number,target:number){const next=[...photos];const [photo]=next.splice(index,1);next.splice(target,0,photo);onChange(next);}
  return <fieldset className="aw-photos" disabled={disabled||busy}>
    <legend>Fotos do produto</legend>
    <p>Selecione até 12 fotos. A primeira será a foto principal na loja. Salve o produto para aplicar as alterações.</p>
    <div className={`aw-photo-drop ${dragging?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);void addFiles(Array.from(e.dataTransfer.files))}}>
      <Upload size={26}/><strong>Arraste suas fotos para cá</strong>
      <button type="button" className="aw-button" onClick={()=>input.current?.click()}>Selecionar fotos</button>
      <small>JPG, PNG ou WebP · até 25 MB por foto · otimização automática</small>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e=>{void addFiles(Array.from(e.target.files??[]));e.target.value=''}}/>
    </div>
    <p role="status" aria-live="polite">{progress||`${photos.length} de 12 fotos`}</p>
    {error&&<p role="alert" className="aw-message aw-error">{error}</p>}
    <div className="aw-photo-grid">{photos.map((photo,index)=><div className="aw-photo-card" key={photo}>
      <img src={photo} alt={`Foto ${index+1} do produto`} />
      <strong>{index===0?'Foto principal':`Foto ${index+1}`}</strong>
      <div className="aw-photo-actions">
        <button type="button" title="Definir como principal" aria-label={`Usar foto ${index+1} como principal`} disabled={disabled||busy||index===0} onClick={()=>move(index,0)}><Star size={16}/></button>
        <button type="button" title="Mover para antes" aria-label={`Mover foto ${index+1} para antes`} disabled={disabled||busy||index===0} onClick={()=>move(index,index-1)}><ArrowLeft size={16}/></button>
        <button type="button" title="Mover para depois" aria-label={`Mover foto ${index+1} para depois`} disabled={disabled||busy||index===photos.length-1} onClick={()=>move(index,index+1)}><ArrowRight size={16}/></button>
        <button type="button" title="Remover foto" aria-label={`Remover foto ${index+1}`} onClick={()=>onChange(photos.filter((_,i)=>i!==index))}><Trash2 size={16}/></button>
      </div>
    </div>)}</div>
    <details><summary>Adicionar por link</summary><label>Link da imagem<input value={url} maxLength={2000} placeholder="https://… ou /catalogo/foto.jpg" onChange={e=>setUrl(e.target.value)}/></label><button type="button" className="aw-button aw-secondary" onClick={()=>{const value=url.trim();if(!/^(https:\/\/|\/(?!\/))/.test(value)){setError('Informe um link HTTPS ou um caminho de imagem do site.');return;}if(photos.length>=12){setError('A galeria aceita até 12 fotos.');return;}onChange([...new Set([...photos,value])]);setUrl('');setError('')}}>Adicionar imagem</button></details>
  </fieldset>;
}
