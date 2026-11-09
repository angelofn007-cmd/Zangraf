'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {BookOpen, Plus, ArrowUpRight, Copy, Search, HardDrive} from 'lucide-react';
import {listProjects,copyProject,saveProject,type LayoutProject} from '@/lib/layout-projects';
export function ProjectList(){
 const [projects,setProjects]=useState<LayoutProject[]>([]);
 const [ready,setReady]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [search,setSearch]=useState('');
 useEffect(()=>{listProjects().then(setProjects).catch(()=>setError('Não foi possível carregar os projetos deste navegador.')).finally(()=>setReady(true))},[]);
 const filtered=projects.filter(p=>(p.name||'Meu álbum').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')));
 return <>{error&&<p role="alert">{error}</p>}
 <div className="customer-toolbar"><label className="customer-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar meus projetos" placeholder="Buscar um projeto" value={search} onChange={e=>setSearch(e.target.value)}/></label><Link className="button" href="/albuns"><Plus size={17}/>Novo álbum</Link></div>
 <p className="customer-storage"><HardDrive size={16} aria-hidden="true"/>Seus projetos ficam salvos neste navegador. Use este dispositivo para continuar a edição.</p>
 {!ready?<p role="status">Carregando projetos…</p>:filtered.length?<><p className="customer-count" role="status">{filtered.length} {filtered.length===1?'projeto':'projetos'}</p><div className="dashboard-grid project-grid">{filtered.map(p=><article key={p.id} className="dashboard-card"><div className="customer-project-top"><span className="customer-nav-icon"><BookOpen size={23}/></span><span className="customer-status">Em edição</span></div><h3>{p.name||'Meu álbum'}</h3><p>{p.spreads.length} lâminas · {p.photos.length} fotos</p><p className="small">Última edição: {new Date(p.updatedAt).toLocaleDateString('pt-BR')}</p><div className="customer-project-actions"><Link className="button" href={'/diagramador?projeto='+encodeURIComponent(p.id)}>Continuar edição<ArrowUpRight size={16}/></Link><button className="customer-copy" title="Duplicar projeto" aria-label={`Duplicar ${p.name||'Meu álbum'}`} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await saveProject(copyProject(p));setProjects(await listProjects())}catch{setError('Não foi possível duplicar o projeto.')}finally{setBusy(false)}}}><Copy size={18}/></button></div></article>)}</div></>:<div className="empty"><BookOpen size={34} aria-hidden="true"/><h3>{search?'Nenhum projeto encontrado':'Seu próximo álbum começa aqui'}</h3><p>{search?'Tente buscar por outro nome.':'Escolha um produto e personalize suas primeiras lâminas.'}</p></div>}
 </>;
}
