'use client';
import {usesAlbumLayout} from '@/lib/products';

import {useEffect, useRef, useState} from 'react';
import {ArrowDownLeft, ArrowUpRight, Check, ChevronRight, CreditCard, FileText, LayoutDashboard, Package, Plus, Search, Settings2, ShieldCheck, Trash2, Users, X} from 'lucide-react';
import {defaultPrintSizes, type Product, type ProductKind} from '@/lib/products';
import {type AdminSiteContent} from '@/lib/site-content';
import {AlbumPriceEditor} from './album-price-editor';
import {minimumProductPrice} from '@/lib/pricing';
import {SignOut} from './login';
import {AdminOrderFiles} from './admin-order-files';
import './admin-workspace.css';
import {ProductPhotoEditor} from './product-photo-editor';

type AdminProduct = Product & {active: boolean};
type User = {id: string; name: string; email: string; admin: boolean; created_at: string};
type Order = {id: string; status: string; total_cents: string | null; received_cents: string; customer_name: string; customer_email: string; created_at: string; contact?:{phone?:string;notes?:string;delivery?:string}; items: {productId?:string; product?:{name?:string}; name?:string; quantity?:number; configuration?:Record<string,string>}[]};
type Overview = {
  totals: {products:number;active_products:number;customers:number;orders:number;awaiting_approval:number;received_cents:string};
  orders:Order[]; customers:{id:string;name:string;email:string}[];
  revenue:{month:string;amount_cents:string}[];
  receipts:{id:string;order_id:string;amount_cents:string;method:string;reference:string;paid_at:string}[];
};
const money = (cents: string | number | null) => cents === null ? 'A definir' : (Number(cents) / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
const kindNames: Record<ProductKind,string> = {album:'Álbuns',accessory:'Acessórios',case:'Estojos',kit:'Kits Layflat'};
const statuses:Record<string,string> = {draft:'Rascunho',awaiting_payment:'Aguardando pagamento',paid:'Aguardando aprovação',production:'Em produção',shipped:'Enviado',cancelled:'Cancelado'};
const paymentNames:Record<string,string> = {pix:'Pix',transfer:'Transferência',card:'Cartão',cash:'Dinheiro',other:'Outro'};
const tabs = [{name:'Visão geral',icon:LayoutDashboard},{name:'Produtos',icon:Package},{name:'Pedidos',icon:FileText},{name:'Financeiro',icon:CreditCard},{name:'Clientes',icon:Users},{name:'Conteúdo',icon:Settings2},{name:'Equipe',icon:ShieldCheck}];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api/admin/'+path,{cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir. Tente novamente.');
  return result as T;
}

export function Admin({catalog,content,user}:{catalog:AdminProduct[];content:AdminSiteContent;user:{id:string;name:string;email:string}}) {
  const [tab,setTab] = useState('Visão geral');
  const [products,setProducts] = useState(catalog);
  const [overview,setOverview] = useState<Overview|null>(null);
  const [users,setUsers] = useState<User[]>([]);
  const [siteContent,setSiteContent] = useState(content);
  const [draft,setDraft] = useState<AdminProduct|null>(null);
  const [search,setSearch] = useState('');
  const [teamSearch,setTeamSearch] = useState('');
  const [teamSearching,setTeamSearching] = useState(false);
  const [teamResults,setTeamResults] = useState<User[]|null>(null);
  useEffect(()=>{
    if(tab!=='Equipe')return;
    if(!teamSearch.trim()){setTeamResults(null);setTeamSearching(false);return;}
    let current=true;setTeamSearching(true);
    const timer=setTimeout(()=>{api<{users:User[]}>('equipe?q='+encodeURIComponent(teamSearch.trim())).then(data=>{if(current)setTeamResults(data.users)}).catch(error=>{if(current){setTeamResults([]);setError(error.message)}}).finally(()=>{if(current)setTeamSearching(false)});},250);
    return()=>{current=false;clearTimeout(timer)};
  },[teamSearch,tab,users]);
  const [kind,setKind] = useState('all');
  const [pending,setPending] = useState(false);
  const [loading,setLoading] = useState(true);
  const [notice,setNotice] = useState('');
  const [error,setError] = useState('');

  async function reload() {
    const [newOverview,newUsers] = await Promise.all([api<Overview>('visao'),api<{users:User[]}>('equipe')]);
    setOverview(newOverview);setUsers(newUsers.users);
  }
  useEffect(()=>{
    let current=true;
    Promise.all([api<Overview>('visao'),api<{users:User[]}>('equipe')]).then(([data,team])=>{if(current){setOverview(data);setUsers(team.users)}}).catch(error=>{if(current)setError(error.message)}).finally(()=>{if(current)setLoading(false)});
    return()=>{current=false};
  },[]);
  async function run(action:()=>Promise<void>,message:string) {
    if(pending)return;
    setPending(true);setError('');setNotice('');
    try {await action();setNotice(message)}catch(error){setError((error as Error).message)}finally{setPending(false)}
  }
  async function saveProduct(product:AdminProduct) {
    await run(async()=>{
      const result = await api<{product:AdminProduct}>('produtos',{method:'POST',body:JSON.stringify(product)});
      setProducts(current=>current.some(p=>p.id===product.id)?current.map(p=>p.id===product.id?result.product:p):[result.product,...current]);
      setDraft(null);await reload();
    },'Produto salvo. O catálogo público já está atualizado.');
  }
  const filtered = products.filter(p=>(kind==='all'||(p.kind??'album')===kind)&&`${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="admin-workspace">
    <aside className="aw-sidebar">
      <a className="aw-brand" href="/"><img className="zg-logo-day" src="/brand/zangraf.png" alt="Zangraf"/><img className="zg-logo-night" src="/brand/zangraf-noturno.png" alt="Zangraf"/><span>ADMINISTRAÇÃO</span></a>
      <nav aria-label="Seções administrativas">{tabs.map(({name,icon:Icon})=><button type="button" key={name} aria-current={tab===name?'page':undefined} className={tab===name?'active':''} onClick={()=>{setTab(name);setError('');setNotice('');setSearch('')}}><Icon size={18}/>{name}{name==='Pedidos'&&!!overview?.totals.awaiting_approval&&<small>{overview.totals.awaiting_approval}</small>}</button>)}</nav>
      <div className="aw-profile"><span className="aw-avatar">{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Administrador autorizado</small></div><SignOut/></div>
    </aside>
    <main className="aw-main">
      <header className="aw-header"><div><span className="aw-eyebrow">SEU NEGÓCIO, EM UM SÓ LUGAR</span><h1>{tab}</h1></div><a href="/" className="aw-button aw-secondary" target="_blank" rel="noreferrer">Ver site <ArrowUpRight size={16}/></a></header>
      {error&&<div className="aw-message aw-error" role="alert">{error}<button type="button" aria-label="Fechar aviso" onClick={()=>setError('')}><X size={17}/></button></div>}
      {notice&&<div className="aw-message" role="status"><Check size={17}/>{notice}</div>}
      {loading&&<p role="status" className="aw-loading">Carregando informações da loja…</p>}
      {!loading&&!overview&&<div className="aw-panel aw-empty"><h2>Não foi possível carregar os dados.</h2><p>Confira a conexão e tente novamente.</p><button className="aw-button" disabled={pending} onClick={()=>run(reload,'Informações atualizadas.')}>Tentar novamente</button></div>}
      {tab==='Visão geral'&&overview&&<>
        <p className="aw-intro">Olá, {user.name.split(' ')[0]}. Acompanhe os produtos, os pedidos e os recebimentos da Zangraf.</p>
        <div className="aw-stats">
          <Stat label="Recebido até agora" value={money(overview.totals.received_cents)} detail="Somente recebimentos confirmados" icon={<ArrowDownLeft size={20}/>}/>
          <Stat label="Pedidos" value={String(overview.totals.orders)} detail={`${overview.totals.awaiting_approval} aguardando aprovação`} icon={<FileText size={20}/>}/>
          <Stat label="Produtos no catálogo" value={String(overview.totals.active_products)} detail={`${overview.totals.products} produtos cadastrados`} icon={<Package size={20}/>}/>
          <Stat label="Clientes" value={String(overview.totals.customers)} detail="Contas cadastradas na loja" icon={<Users size={20}/>}/>
        </div>
        <RevenueChart data={overview.revenue}/>
        <div className="aw-panel"><div className="aw-panel-heading"><h2>Últimos pedidos</h2><button onClick={()=>setTab('Pedidos')}>Ver todos <ChevronRight size={16}/></button></div><Orders orders={overview.orders.slice(0,5)} pending={pending} action={async()=>{setTab('Pedidos')}} compact/></div>
      </>}
      {tab==='Produtos'&&<>
        <div className="aw-toolbar"><div className="aw-search"><Search size={17}/><input aria-label="Buscar produtos" placeholder="Buscar no catálogo" value={search} onChange={e=>setSearch(e.target.value)}/></div><select aria-label="Filtrar tipo de produto" value={kind} onChange={e=>setKind(e.target.value)}><option value="all">Todos os produtos</option>{Object.entries(kindNames).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select><button className="aw-button" onClick={()=>setDraft({id:crypto.randomUUID(),name:'',description:'',kind:'album',category:'Álbuns',color:'#c7b79b',isDemo:false,active:true,options:{sizes:[],sheets:['15 lâminas'],covers:[],finishes:[]},printSizes:defaultPrintSizes.map(size=>({...size}))})}><Plus size={17}/>Novo produto</button></div>
        <div className="aw-panel aw-product-table"><div className="aw-table-heading"><span>Produto</span><span>Categoria</span><span>Preço por unidade</span><span>Status</span><span>Ações</span></div>{filtered.length?filtered.map(product=><div className="aw-product-row" key={product.id}><div className="aw-product-name"><div className="aw-swatch" style={{background:product.color}}>{product.imageUrl?<img src={product.imageUrl} alt=""/>:<Package size={24}/>}</div><div><strong>{product.name}</strong><small>{product.category}{product.isDemo?' · Ilustrativo':''}</small></div></div><span>{kindNames[product.kind??'album']}</span><span>{minimumProductPrice(product)!==null?(product.albumPricing?.length?'A partir de ':'')+money(minimumProductPrice(product)):'Sob consulta'}</span><span className={`aw-badge ${product.active?'positive':'muted'}`}>{product.active?'Ativo':'Inativo'}</span><div className="aw-row-actions"><button onClick={()=>setDraft({...product,options:{...product.options},printSizes:product.printSizes?.map(size=>({...size}))})}>Editar</button><button disabled={pending} title={product.active?'Desativar produto':'Ativar produto'} onClick={()=>saveProduct({...product,active:!product.active})}>{product.active?'Desativar':'Ativar'}</button><button className="aw-icon-button aw-danger" disabled={pending} aria-label={`Excluir ${product.name}`} onClick={()=>{if(window.confirm(`Excluir “${product.name}”? Produtos associados a pedidos ou projetos serão preservados.`))run(async()=>{await api('produtos',{method:'DELETE',body:JSON.stringify({id:product.id})});setProducts(current=>current.filter(p=>p.id!==product.id));await reload()},'Produto excluído.')}}><Trash2 size={16}/></button></div></div>):<div className="aw-empty"><Package size={32}/><h2>{products.length?'Nenhum produto encontrado.':'Seu catálogo começa aqui.'}</h2><p>{products.length?'Tente outro termo ou categoria.':'Cadastre os álbuns, acessórios e estojos da Zangraf.'}</p></div>}</div>
      </>}
      {tab==='Pedidos'&&overview&&<div className="aw-panel"><div className="aw-panel-heading"><div><h2>Pedidos recebidos</h2><p>Confira o álbum e confirme o pagamento antes de liberar a produção.</p></div><button disabled={pending} onClick={()=>run(reload,'Pedidos atualizados.')}>Atualizar</button></div><Orders orders={overview.orders} pending={pending} action={async(order,status)=>{if(window.confirm(status==='production'?'O álbum foi revisado e está aprovado para produção?':status==='shipped'?'Confirmar que este pedido foi enviado?':'Cancelar este pedido?'))await run(async()=>{await api('pedidos',{method:'PATCH',body:JSON.stringify({id:order.id,status})});await reload()},'Pedido atualizado.')}}/></div>}
      {tab==='Financeiro'&&overview&&<>
        <div className="aw-stats aw-finance-stat"><Stat label="Recebido até agora" value={money(overview.totals.received_cents)} detail="Pagamentos registrados e confirmados" icon={<ArrowDownLeft size={20}/>}/></div>
        <RevenueChart data={overview.revenue}/>
        <div className="aw-panel"><div className="aw-panel-heading"><div><h2>Registrar recebimento</h2><p>Registre somente valores que já foram recebidos. Use a referência do comprovante para evitar duplicação.</p></div></div><ReceiptForm orders={overview.orders} pending={pending} save={body=>run(async()=>{await api('recebimentos',{method:'POST',body:JSON.stringify(body)});await reload()},'Recebimento registrado. O saldo do pedido foi atualizado.')}/></div>
        <div className="aw-panel"><div className="aw-panel-heading"><h2>Recebimentos confirmados</h2></div>{overview.receipts.length?overview.receipts.map(receipt=><div className="aw-simple-row" key={receipt.id}><div><strong>{money(receipt.amount_cents)}</strong><small>Pedido {receipt.order_id.slice(0,8)} · {paymentNames[receipt.method]}</small></div><span>{receipt.reference}</span><span>{new Date(receipt.paid_at).toLocaleDateString('pt-BR')}</span></div>):<div className="aw-empty"><p>Nenhum recebimento registrado.</p></div>}</div>
      </>}
      {tab==='Clientes'&&overview&&<div className="aw-panel"><div className="aw-panel-heading"><h2>Clientes cadastrados</h2><span>{overview.totals.customers} no total</span></div>{overview.customers.length?overview.customers.map(customer=><div className="aw-simple-row" key={customer.id}><span className="aw-avatar">{customer.name.slice(0,1).toUpperCase()}</span><div><strong>{customer.name}</strong><small>{customer.email}</small></div></div>):<div className="aw-empty"><Users size={32}/><h2>Aguardando o primeiro cadastro.</h2><p>As contas criadas no site aparecerão aqui.</p></div>}</div>}
      {tab==='Conteúdo'&&<ContentForm content={siteContent} pending={pending} save={data=>run(async()=>{const result=await api<{content:AdminSiteContent}>('conteudo',{method:'PUT',body:JSON.stringify(data)});setSiteContent(result.content)},'Conteúdo publicado no site.')}/>}
      {tab==='Equipe'&&<div className="aw-panel"><div className="aw-panel-heading"><div><h2>Quem pode administrar</h2><p>Novas contas começam como clientes. Confirme a identidade da pessoa antes de autorizar o acesso administrativo.</p></div></div><div className="aw-toolbar" style={{padding:'20px 25px 0'}}><div className="aw-search"><Search size={17}/><input type="search" aria-label="Buscar usuários por nome ou e-mail" placeholder="Buscar por nome ou e-mail" value={teamSearch} onChange={e=>setTeamSearch(e.target.value)}/></div>{teamSearch&&<button className="aw-button aw-secondary" onClick={()=>setTeamSearch('')}>Limpar</button>}</div><p className="aw-chart-note" role="status">{teamSearching?'Buscando usuários…':`${(teamResults??users).length} usuários encontrados${(teamResults??users).length===500?' · refine a busca para encontrar outros usuários':''}`}</p>{!teamSearching&&(teamResults??users).length===0&&<div className="aw-empty">Nenhum usuário encontrado. Tente outro nome ou e-mail.</div>}{!teamSearching&&(teamResults??users).map(person=><div className="aw-simple-row aw-team-row" key={person.id}><span className="aw-avatar">{person.name.slice(0,1).toUpperCase()}</span><div><strong>{person.name}{person.id===user.id?' (você)':''}</strong><small>{person.email}</small><small className="aw-user-id">ID: {person.id}</small></div><span className={`aw-badge ${person.admin?'positive':'muted'}`}>{person.admin?'Administrador':'Cliente'}</span><button disabled={pending||person.id===user.id} className="aw-button aw-secondary" onClick={()=>{if(window.confirm(person.admin?`Remover o acesso administrativo de ${person.name}?`:`Confirma que a conta ${person.email}, ID ${person.id}, pertence à pessoa que deseja autorizar? Ela poderá gerenciar produtos, pedidos, valores e outros administradores.`))run(async()=>{await api('equipe',{method:'PATCH',body:JSON.stringify({userId:person.id,admin:!person.admin})});await reload()},'Permissões atualizadas.')}}>{person.admin?'Remover acesso':'Autorizar administrador'}</button></div>)}</div>}
      <footer className="aw-footer"><ShieldCheck size={14}/> Acesso protegido · {user.email}</footer>
    </main>
    {draft&&<ProductEditor product={draft} error={error} pending={pending} onClose={()=>setDraft(null)} onSave={saveProduct}/>}
  </div>;
}
function Stat({label,value,detail,icon}:{label:string;value:string;detail:string;icon:React.ReactNode}){return <article className="aw-stat"><div><span>{label}</span>{icon}</div><strong>{value}</strong><small>{detail}</small></article>}
function RevenueChart({data}:{data:Overview['revenue']}) {
  const max=Math.max(...data.map(point=>Number(point.amount_cents)),1);
  return <div className="aw-panel"><div className="aw-panel-heading"><div><h2>Recebimentos</h2><p>Valores confirmados nos últimos seis meses</p></div><span className="aw-chart-legend">Recebido</span></div><div className="aw-chart" aria-label="Gráfico dos recebimentos mensais">{data.map(point=><div className="aw-chart-column" key={point.month}><span>{money(point.amount_cents)}</span><div className="aw-chart-track"><div style={{height:`${Number(point.amount_cents)/max*100}%`}}/></div><strong>{new Date(point.month+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'short'})}</strong></div>)}</div><p className="aw-chart-note">{data.every(point=>Number(point.amount_cents)===0)?'Nenhum recebimento neste período. Os valores serão exibidos quando houver pagamentos confirmados.':'Pedidos em aberto não fazem parte deste gráfico.'}</p></div>;
}
function Orders({orders,pending,action,compact=false}:{orders:Order[];pending:boolean;action:(order:Order,status:string)=>Promise<void>;compact?:boolean}) {
  if(!orders.length)return <div className="aw-empty"><FileText size={32}/><h2>Os próximos capítulos chegam por aqui.</h2><p>Os pedidos enviados pelo site aparecerão nesta lista.</p></div>;
  return <div>{orders.map(order=><details className="aw-order" key={order.id}><summary><div><strong>#{order.id.slice(0,8)}</strong><small>{order.customer_name} · {new Date(order.created_at).toLocaleDateString('pt-BR')}</small></div><span className={`aw-badge ${['paid','production','shipped'].includes(order.status)?'positive':'muted'}`}>{statuses[order.status]??order.status}</span><strong>{money(order.total_cents)}</strong><ChevronRight size={16}/></summary><div className="aw-order-details"><p>{order.customer_email}</p>{order.contact?.phone&&<p>Telefone: <a href={'tel:'+order.contact.phone.replace(/[^+0-9]/g,'')}>{order.contact.phone}</a></p>}{order.contact?.notes&&<p><strong>Observações do cliente:</strong> {order.contact.notes}</p>}{order.contact?.delivery&&<p>{order.contact.delivery}</p>}{Array.isArray(order.items)&&order.items.map((item,i)=><div key={i}><strong>{item.quantity??1} × {item.product?.name??item.name??item.productId??'Produto'}</strong>{item.configuration&&<p>{Object.values(item.configuration).filter(v=>typeof v==='string').join(' · ')}</p>}</div>)}<AdminOrderFiles orderId={order.id}/><p>Recebido: {money(order.received_cents)} · Saldo: {order.total_cents===null?'A definir':money(Math.max(0,Number(order.total_cents)-Number(order.received_cents)))}</p><div className="aw-actions">{compact?<button className="aw-button aw-secondary" onClick={()=>action(order,'')}>Gerenciar pedido</button>:<>{order.status==='paid'&&<button disabled={pending} className="aw-button" onClick={()=>action(order,'production')}>Aprovar para produção</button>}{order.status==='production'&&<button disabled={pending} className="aw-button" onClick={()=>action(order,'shipped')}>Marcar como enviado</button>}{['draft','awaiting_payment'].includes(order.status)&&Number(order.received_cents)===0&&<button disabled={pending} className="aw-button aw-secondary aw-danger" onClick={()=>action(order,'cancelled')}>Cancelar pedido</button>}</>}</div></div></details>)}<p className="aw-chart-note">Exibindo os {orders.length} pedidos mais recentes.</p></div>;
}
function ReceiptForm({orders,pending,save}:{orders:Order[];pending:boolean;save:(body:unknown)=>Promise<void>}){
  const payable=orders.filter(order=>order.status==='awaiting_payment'&&order.total_cents!==null&&Number(order.total_cents)>Number(order.received_cents));
  if(!payable.length)return <div className="aw-empty"><p>Nenhum pedido com saldo pendente para registrar.</p></div>;
  return <form className="aw-form aw-receipt-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const data=new FormData(form);await save({orderId:data.get('orderId'),amountCents:Math.round(Number(data.get('amount'))*100),method:data.get('method'),reference:data.get('reference'),paidAt:new Date(String(data.get('paidAt'))+'T00:00:00').toISOString()})}}><label>Pedido<select name="orderId" required>{payable.map(order=><option value={order.id} key={order.id}>#{order.id.slice(0,8)} · {order.customer_name} · Saldo {money(Number(order.total_cents)-Number(order.received_cents))}</option>)}</select></label><label>Valor recebido (R$)<input type="number" name="amount" min="0.01" step="0.01" required/></label><label>Forma de recebimento<select name="method">{Object.entries(paymentNames).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select></label><label>Data do recebimento<input type="date" name="paidAt" required max={new Date().toLocaleDateString('en-CA')}/></label><label>Referência única do comprovante<input name="reference" minLength={3} maxLength={160} required placeholder="Identificador da transação"/></label><button className="aw-button" disabled={pending}>{pending?'Registrando…':'Confirmar recebimento'}</button></form>;
}
function ContentForm({content,pending,save}:{content:AdminSiteContent;pending:boolean;save:(data:AdminSiteContent)=>Promise<void>}) {
  const [draft,setDraft]=useState(content);
  const fields: [keyof AdminSiteContent,string][]=[['heroEyebrow','Chamada acima do título'],['heroTitle','Título principal'],['heroDescription','Texto de apresentação'],['aboutTitle','Título da seção sobre a marca'],['aboutDescription','Texto sobre a marca'],['contactEmail','E-mail público para contato'],['whatsapp','WhatsApp (país + DDD + número)'],['instagramUrl','Link do Instagram'],['productionEmail','E-mail interno de produção']];
  return <div className="aw-panel"><div className="aw-panel-heading"><div><h2>A voz da Zangraf</h2><p>Edite os textos e contatos da loja. O e-mail de produção é reservado à equipe.</p></div></div><form className="aw-form aw-content-form" onSubmit={e=>{e.preventDefault();save(draft)}}>{fields.map(([key,label])=><label key={key}>{label}{key.endsWith('Description')?<textarea rows={3} maxLength={1000} required value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>:<input maxLength={key==='productionEmail'?254:200} type={key.endsWith('Email')?'email':key==='instagramUrl'?'url':'text'} required={['heroTitle','aboutTitle'].includes(key)} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>}</label>)}<div><button className="aw-button" disabled={pending}>{pending?'Salvando…':'Salvar conteúdo'}</button></div></form></div>;
}
function ProductEditor({product,error,pending,onClose,onSave}:{product:AdminProduct;error:string;pending:boolean;onClose:()=>void;onSave:(product:AdminProduct)=>Promise<void>}) {
  const ref=useRef<HTMLDialogElement>(null);
  const [draft,setDraft]=useState(product);
  const [formula,setFormula]=useState(!!product.albumPricing?.length);
  const [price,setPrice]=useState(product.priceCents?String(product.priceCents/100):'');
  const [photos,setPhotos]=useState<string[]>(()=>[...new Set([product.imageUrl,...(product.imageUrls??[])].filter((url):url is string=>!!url))]);
  const [uploading,setUploading]=useState(false);
  const [options,setOptions]=useState(Object.fromEntries(Object.entries(product.options).map(([key,values])=>[key,values.join(', ')])) as Record<keyof Product['options'],string>);
  useEffect(()=>{ref.current?.showModal()},[]);
  return <dialog ref={ref} className="aw-dialog" onCancel={e=>{if(pending||uploading)e.preventDefault();else onClose()}}><div className="aw-dialog-heading"><div><span className="aw-eyebrow">CATÁLOGO ZANGRAF</span><h2>{product.name?'Editar produto':'Novo produto'}</h2></div><button className="aw-icon-button" disabled={pending||uploading} onClick={onClose} aria-label="Fechar editor"><X size={22}/></button></div>{error&&<p className="aw-message aw-error" role="alert">{error}</p>}<form className="aw-form" onSubmit={e=>{e.preventDefault();if(uploading)return;const normalized=Object.fromEntries(Object.entries(options).map(([key,text])=>[key,text.split(',').map(item=>item.trim()).filter(Boolean)])) as Product['options'];if(usesAlbumLayout(draft)&&draft.printSizes?.length)normalized.sizes=draft.printSizes.map(size=>size.label);onSave({...draft,options:normalized,imageUrl:photos[0]??'',imageUrls:photos,priceCents:!formula&&price?Math.round(Number(price)*100):undefined,albumPricing:formula?draft.albumPricing:undefined})}}>
    <div className="aw-two-columns"><label>Nome<input required maxLength={100} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Tipo<select value={draft.kind??'album'} onChange={e=>setDraft({...draft,kind:e.target.value as ProductKind})}>{Object.entries(kindNames).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label></div>
    <label>Descrição<textarea required maxLength={1000} rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <div className="aw-two-columns"><label>Coleção ou categoria<input required maxLength={100} value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})}/></label><label>Preço fixo por unidade (R$)<input disabled={formula} type="number" min="0.01" max="1000000" step="0.01" placeholder="Em branco = sob consulta" value={price} onChange={e=>setPrice(e.target.value)}/></label></div>
    {usesAlbumLayout(draft)&&<><label className="aw-pricing-toggle"><input type="checkbox" checked={formula} onChange={e=>{setFormula(e.target.checked);if(e.target.checked&&!options.finishes.trim())setOptions({...options,finishes:'Brilho, Fosco'});if(e.target.checked&&!draft.albumPricing?.length)setDraft({...draft,albumPricing:[{size:draft.printSizes?.[0]?.label||draft.options.sizes[0]||'',stock:'500 g',finish:draft.options.finishes[0]||'Brilho',bindingCents:0,sheetCents:0}]})}}/>Calcular por encadernado + quantidade de lâminas</label>{formula&&<AlbumPriceEditor rows={draft.albumPricing||[]} sizes={draft.printSizes?.map(size=>size.label)||draft.options.sizes} finishes={options.finishes.split(',').map(value=>value.trim()).filter(Boolean)} onChange={rows=>setDraft({...draft,albumPricing:rows})}/>}</>}
    <ProductPhotoEditor photos={photos} disabled={pending||uploading} onChange={setPhotos} onBusy={setUploading}/>
    <label>Cor de apresentação<input type="color" value={draft.color} onChange={e=>setDraft({...draft,color:e.target.value})}/></label>
    <fieldset><legend>Opções disponíveis</legend><p>Separe cada opção com vírgula. Formatos, lâminas e capas são obrigatórios para álbuns. Acabamentos podem ficar em branco.</p><div className="aw-two-columns">{([['sizes','Formatos'],['sheets','Lâminas'],['covers','Capas / materiais'],['finishes','Acabamentos']] as const).map(([key,label])=><label key={key}>{label}<input required={usesAlbumLayout(draft)&&key!=='finishes'} disabled={key==='sizes'&&!!draft.printSizes?.length} maxLength={2000} value={key==='sizes'&&draft.printSizes?.length?draft.printSizes.map(size=>size.label).join(', '):options[key]} onChange={e=>setOptions({...options,[key]:e.target.value})}/></label>)}</div></fieldset>
    {usesAlbumLayout(draft)&&<fieldset><legend>Medidas para impressão</legend><p>Medida final da página. A sangria é acrescentada em cada lado: 3 mm resultam em mais 6 mm na largura e na altura.</p><div className="aw-print-size-head"><span>Largura (cm)</span><span>Altura (cm)</span><span>Sangria (mm)</span><span>DPI</span></div>{(draft.printSizes??[]).map((size,index)=><div className="aw-print-size" key={index}>{(['widthMm','heightMm','bleedMm','dpi'] as const).map(key=><input aria-label={`${key==='widthMm'?'Largura em centímetros':key==='heightMm'?'Altura em centímetros':key==='bleedMm'?'Sangria em milímetros':'DPI'} do formato ${index+1}`} key={key} type="number" required readOnly={key==='dpi'||key==='bleedMm'} min={key==='dpi'?300:key==='bleedMm'?3:10} max={key==='dpi'?300:key==='bleedMm'?3:60} step={key==='dpi'?1:0.1} value={key==='widthMm'||key==='heightMm'?size[key]/10:size[key]} onChange={e=>{const next={...size,[key]:Number(e.target.value)*(key==='widthMm'||key==='heightMm'?10:1)};next.label=`${next.widthMm/10} × ${next.heightMm/10} cm`;setDraft({...draft,printSizes:draft.printSizes?.map((value,i)=>i===index?next:value)})}}/>)}<button type="button" className="aw-icon-button" aria-label={`Remover formato ${size.label}`} onClick={()=>setDraft({...draft,printSizes:draft.printSizes?.filter((_,i)=>i!==index)})}><X size={15}/></button></div>)}<button type="button" className="aw-link" onClick={()=>setDraft({...draft,printSizes:[...(draft.printSizes??[]),{label:'20 × 20 cm',widthMm:200,heightMm:200,bleedMm:3,dpi:300}]})}><Plus size={16}/>Adicionar formato</button></fieldset>}
    <div className="aw-checkboxes"><label><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/>Exibir no catálogo</label><label><input type="checkbox" checked={draft.isDemo===true} onChange={e=>setDraft({...draft,isDemo:e.target.checked})}/>Produto ilustrativo (sem venda)</label></div>
    <div className="aw-dialog-actions"><button type="button" className="aw-button aw-secondary" disabled={pending||uploading} onClick={onClose}>Cancelar</button><button className="aw-button" disabled={pending||uploading}>{pending?'Salvando…':'Salvar produto'}</button></div>
  </form></dialog>;
}
