'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BookOpen, Plus, ArrowUpRight, Pencil, Search, HardDrive, Trash2, Clock, Check, X} from 'lucide-react';
import {listProjects,saveProject,deleteProject,purgeExpiredProjects,projectDaysLeft,PROJECT_LIFETIME_DAYS,type LayoutProject} from '@/lib/layout-projects';
import {unlinkProjects} from '@/lib/cart';
export function ProjectList(){
 const [projects,setProjects]=useState<LayoutProject[]>([]);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [search,setSearch]=useState('');
 useEffect(()=>{purgeExpiredProjects().then(unlinkProjects).catch(()=>undefined).then(listProjects).then(setProjects).catch(()=>setError('Não foi possível carregar os projetos deste navegador.')).finally(()=>setReady(true))},[]);
 const [renaming,setRenaming]=useState<{id:string;value:string}|null>(null);
 async function rename(p:LayoutProject,value:string){
  const name=value.trim().slice(0,100);
  setRenaming(null);if(!name||name===p.name)return;
  setBusy(true);setError('');
  try{await saveProject({...p,name,updatedAt:new Date().toISOString()});setProjects(await listProjects())}catch{setError('Não foi possível renomear o projeto.')}finally{setBusy(false)}
 }
 async function remove(p:LayoutProject){
  if(!window.confirm(`Excluir "${p.name||'Meu álbum'}"? O álbum e as fotos dele serão apagados deste navegador e não dá para desfazer.`))return;
  setBusy(true);setError('');
  try{await deleteProject(p.id);unlinkProjects([p.id]);setProjects(await listProjects())}catch{setError('Não foi possível excluir o projeto.')}finally{setBusy(false)}
 }
 const filtered=projects.filter(p=>(p.name||'Meu álbum').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
 return <>{error&&<p role="alert">{error}</p>}
 <div className="customer-toolbar"><label className="customer-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar meus projetos" placeholder="Buscar um projeto" value={search} onChange={e=>setSearch(e.target.value)}/></label><Link className="button" href="/albuns"><Plus size={17}/>Novo álbum</Link></div>
 <p className="customer-storage"><HardDrive size={16} aria-hidden="true"/>Seus projetos ficam salvos neste navegador por {PROJECT_LIFETIME_DAYS} dias depois de criados e então são excluídos automaticamente. Use este dispositivo para continuar a edição.</p>
 {!ready?<p role="status">Carregando projetos…</p>:filtered.length?<><p className="customer-count" role="status">{filtered.length} {filtered.length===1?'projeto':'projetos'}</p><div className="dashboard-grid project-grid">{filtered.map(p=><article key={p.id} className="dashboard-card"><div className="customer-project-top"><span className="customer-nav-icon"><BookOpen size={23}/></span><span className="customer-status">Em edição</span></div>{renaming?.id===p.id?<form className="customer-rename" onSubmit={e=>{e.preventDefault();void rename(p,renaming.value)}}><input autoFocus aria-label="Novo nome do projeto" maxLength={100} value={renaming.value} onChange={e=>setRenaming({id:p.id,value:e.target.value})} onKeyDown={e=>{if(e.key==='Escape')setRenaming(null)}}/><button type="submit" aria-label="Salvar nome" title="Salvar nome"><Check size={16}/></button><button type="button" aria-label="Cancelar" title="Cancelar" onClick={()=>setRenaming(null)}><X size={16}/></button></form>:<h3>{p.name||'Meu álbum'}</h3>}<p>{p.spreads.length} lâminas · {p.photos.length} fotos</p><p className="small">Última edição: {new Date(p.updatedAt).toLocaleDateString('pt-BR')}</p>{(()=>{const days=projectDaysLeft(p);return <p className={'customer-expiry'+(days<=1?' soon':'')}><Clock size={14} aria-hidden="true"/>{days===0?'Será excluído hoje':days===1?'Será excluído amanhã':`Será excluído em ${days} dias`}</p>;})()}<div className="customer-project-actions"><Link className="button" href={'/diagramador?projeto='+encodeURIComponent(p.id)}>Continuar edição<ArrowUpRight size={16}/></Link><button className="customer-copy" title="Renomear projeto" aria-label={`Renomear ${p.name||'Meu álbum'}`} disabled={busy} onClick={()=>setRenaming({id:p.id,value:p.name||'Meu álbum'})}><Pencil size={18}/></button><button className="customer-copy customer-delete" title="Excluir projeto" aria-label={`Excluir ${p.name||'Meu álbum'}`} disabled={busy} onClick={()=>void remove(p)}><Trash2 size={18}/></button></div></article>)}</div></>:<div className="empty"><BookOpen size={34} aria-hidden="true"/><h3>{search?'Nenhum projeto encontrado':'Seu próximo álbum começa aqui'}</h3><p>{search?'Tente buscar por outro nome.':'Escolha um produto e personalize suas primeiras lâminas.'}</p></div>}
 </>;
}
