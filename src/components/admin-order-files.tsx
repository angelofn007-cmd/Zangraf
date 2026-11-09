'use client';
import {useState} from 'react';

type ProductionFile={id:string;itemKey:string;productName:string;filename:string;verified:boolean;widthCm:number;heightCm:number};
export function AdminOrderFiles({orderId}:{orderId:string}){
  const [files,setFiles]=useState<ProductionFile[]|null>(null);
  const [canDownload,setCanDownload]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  async function load(){
    setLoading(true);setError('');
    try{
      const response=await fetch(`/api/admin/pedidos/${encodeURIComponent(orderId)}/arquivos`,{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||'Não foi possível abrir os arquivos.');
      setFiles(data.files);setCanDownload(data.canDownload===true);
    }catch(error){setError(error instanceof Error?error.message:'Não foi possível abrir os arquivos.');}
    finally{setLoading(false);}
  }
  return <section className="aw-production-files" aria-label="Arquivos de impressão">
    <button className="aw-button aw-secondary" disabled={loading} onClick={load}>{loading?'Carregando arquivos…':files?'Atualizar arquivos':'Ver arquivos de impressão'}</button>
    {error&&<p role="alert">{error}</p>}
    {files&&<>
      <p>{files.length?`${files.filter(file=>file.verified).length} de ${files.length} arquivos recebidos e conferidos.`:'Este pedido não possui arquivos de álbum.'}</p>
      {files.length>0&&<><p className="aw-chart-note">JPGs com 0,3 cm de sobra em cada lado. Confira as prévias antes de aprovar a produção. Os JPGs completos são liberados após pagamento e aprovação. O envio automático por e-mail ainda não está conectado.</p>
      <ul className="aw-file-list">{files.map(file=><li key={file.id}>
        <div><strong>{file.productName} · item {file.itemKey.slice(0,6)}</strong><small>{file.filename} · {file.widthCm.toLocaleString('pt-BR')} × {file.heightCm.toLocaleString('pt-BR')} cm</small></div>
        {file.verified?<div style={{display:"flex",gap:8}}><a className="aw-button aw-secondary" href={`/api/arquivos/${file.id}?previa=1`} target="_blank" rel="noopener noreferrer">Ver prévia</a>{canDownload&&<a className="aw-button aw-secondary" href={`/api/arquivos/${file.id}`} download>Baixar JPG</a>}</div>:<span className="aw-badge muted">Aguardando envio</span>}
      </li>)}</ul></>}
    </>}
  </section>;
}
