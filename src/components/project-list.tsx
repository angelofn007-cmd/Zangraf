'use client';
import {useEffect,useMemo,useState,type CSSProperties} from 'react';
import Link from 'next/link';
import {Plus, ArrowRight, Pencil, Search, Trash2, Clock, Check, X, Images} from 'lucide-react';
import {listProjects,saveProject,deleteProject,purgeExpiredProjects,projectDaysLeft,PROJECT_LIFETIME_DAYS,type LayoutProject} from '@/lib/layout-projects';
import {unlinkProjects} from '@/lib/cart';

const order=(i:number)=>({'--i':i} as CSSProperties);

/** Foto da capa (ou a primeira foto do álbum), em miniatura, para o cartão parecer um fotolivro. */
function coverBlob(p:LayoutProject){
 const id=p.cover?.photo.photoId||p.cover?.composition?.slots.find(s=>s.photoId)?.photoId||p.spreads.flatMap(s=>s.slots).find(s=>s.photoId)?.photoId;
 const photo=p.photos.find(ph=>ph.id===id)||p.photos.find(ph=>!ph.background);
 return photo?(photo.thumbnail||photo.preview||photo.blob):undefined;
}

export function ProjectList(){
 const [projects,setProjects]=useState<LayoutProject[]>([]);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [search,setSearch]=useState('');
 const [renaming,setRenaming]=useState<{id:string;value:string}|null>(null);
 useEffect(()=>{purgeExpiredProjects().then(unlinkProjects).catch(()=>undefined).then(listProjects).then(setProjects).catch(()=>setError('Não foi possível carregar os álbuns deste navegador.')).finally(()=>setReady(true))},[]);

 // Miniaturas das capas: criadas a partir das fotos salvas e liberadas quando a lista muda.
 const covers=useMemo(()=>new Map(projects.map(p=>{const blob=coverBlob(p);return [p.id,blob?URL.createObjectURL(blob):undefined] as const;})),[projects]);
 useEffect(()=>()=>{for(const url of covers.values())if(url)URL.revokeObjectURL(url);},[covers]);

 async function rename(p:LayoutProject,value:string){
  const name=value.trim().slice(0,100);
  setRenaming(null);if(!name||name===p.name)return;
  setBusy(true);setError('');
  try{await saveProject({...p,name,updatedAt:new Date().toISOString()});setProjects(await listProjects())}catch{setError('Não foi possível renomear o álbum.')}finally{setBusy(false)}
 }
 async function remove(p:LayoutProject){
  if(!window.confirm(`Excluir "${p.name||'Meu álbum'}"? O álbum e as fotos dele serão apagados deste navegador e não dá para desfazer.`))return;
  setBusy(true);setError('');
  try{await deleteProject(p.id);unlinkProjects([p.id]);setProjects(await listProjects())}catch{setError('Não foi possível excluir o álbum.')}finally{setBusy(false)}
 }
 const term=search.trim().toLocaleLowerCase('pt-BR');
 const filtered=projects.filter(p=>(p.name||'Meu álbum').toLocaleLowerCase('pt-BR').includes(term));

 if(!ready)return <div className="ca-albums" aria-busy="true" role="status" aria-label="Carregando seus álbuns">{[0,1,2].map(i=><div key={i} className="ca-skeleton" style={order(i)}/>)}</div>;

 if(!projects.length)return <div className="ca-empty">
  <span className="ca-photos" aria-hidden="true"><i/><i/><i/></span>
  <h2>Seu primeiro álbum começa aqui</h2>
  <p>Escolha um modelo e monte com suas fotos.</p>
  <Link className="ca-button" href="/albuns"><Plus size={18} aria-hidden="true"/>Criar álbum</Link>
 </div>;

 return <>
  {error&&<p className="ca-error" role="alert">{error}</p>}
  {projects.length>3&&<label className="ca-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar meus álbuns" placeholder="Buscar álbum" value={search} onChange={e=>setSearch(e.target.value)}/></label>}
  <div className="ca-albums">
   {!term&&<Link href="/albuns" className="ca-album ca-new" style={order(0)}>
    <span className="ca-new-icon"><Plus size={28} aria-hidden="true"/></span><strong>Novo álbum</strong>
   </Link>}
   {filtered.map((p,index)=>{
    const days=projectDaysLeft(p);const name=p.name||'Meu álbum';const cover=covers.get(p.id);
    const photos=p.photos.filter(ph=>!ph.background).length;
    return <article key={p.id} className="ca-album" style={order(index+1)}>
     <Link href={'/diagramador?projeto='+encodeURIComponent(p.id)} className="ca-book" aria-label={`Continuar ${name}`} style={{['--cover' as string]:p.cover?.color||'#e9e4d8'}}>
      <span className="ca-book-cover">
       {cover?<img src={cover} alt="" draggable={false}/>:<Images size={34} strokeWidth={1.4} aria-hidden="true"/>}
      </span>
      <span className="ca-book-open"><ArrowRight size={18} aria-hidden="true"/>Continuar</span>
     </Link>
     <div className="ca-album-info">
      {renaming?.id===p.id?<form className="ca-rename" onSubmit={e=>{e.preventDefault();void rename(p,renaming.value)}}>
       <input autoFocus aria-label="Novo nome do álbum" maxLength={100} value={renaming.value} onChange={e=>setRenaming({id:p.id,value:e.target.value})} onKeyDown={e=>{if(e.key==='Escape')setRenaming(null)}}/>
       <button type="submit" aria-label="Salvar nome" title="Salvar"><Check size={16}/></button>
       <button type="button" aria-label="Cancelar" title="Cancelar" onClick={()=>setRenaming(null)}><X size={16}/></button>
      </form>:<h3>{name}</h3>}
      <p>{p.spreads.length} {p.spreads.length===1?'lâmina':'lâminas'} · {photos} {photos===1?'foto':'fotos'}</p>
      <div className="ca-album-foot">
       <span className={'ca-expiry'+(days<=1?' soon':'')} title={`Os álbuns ficam salvos neste navegador por ${PROJECT_LIFETIME_DAYS} dias.`}><Clock size={13} aria-hidden="true"/>{days===0?'Expira hoje':days===1?'Expira amanhã':`Expira em ${days} dias`}</span>
       <span className="ca-tools">
        <button title="Renomear" aria-label={`Renomear ${name}`} disabled={busy} onClick={()=>setRenaming({id:p.id,value:name})}><Pencil size={16}/></button>
        <button className="danger" title="Excluir" aria-label={`Excluir ${name}`} disabled={busy} onClick={()=>void remove(p)}><Trash2 size={16}/></button>
       </span>
      </div>
     </div>
    </article>;
   })}
  </div>
  {term&&!filtered.length&&<p className="ca-note">Nenhum álbum com esse nome.</p>}
  <p className="ca-note">Seus álbuns ficam salvos neste navegador por {PROJECT_LIFETIME_DAYS} dias.</p>
 </>;
}
