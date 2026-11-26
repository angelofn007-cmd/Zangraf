import type {CSSProperties} from 'react';
import Link from 'next/link';
import {Ban, Check, CreditCard, Package, Printer, Truck, type LucideIcon} from 'lucide-react';
import {authenticationConfigured,getSession} from '@/lib/server/auth';
import {getDatabase} from '@/lib/server/db';
export const metadata={title:'Meus pedidos'};

const labels:Record<string,string>={draft:'Enviando arquivos',awaiting_payment:'Aguardando pagamento',paid:'Pagamento confirmado',production:'Imprimindo',shipped:'Enviado',cancelled:'Cancelado'};
/** As etapas do pedido, com as cores da faixa HP. */
const steps:{label:string;icon:LucideIcon;color:string}[]=[
 {label:'Pedido',icon:Package,color:'var(--zg-blue)'},
 {label:'Pagamento',icon:CreditCard,color:'var(--zg-magenta)'},
 {label:'Impressão',icon:Printer,color:'var(--zg-yellow)'},
 {label:'Envio',icon:Truck,color:'var(--zg-green)'},
];
/** Quantas etapas já terminaram em cada situação. */
const reached:Record<string,number>={draft:0,awaiting_payment:1,paid:2,production:2,shipped:4};
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});

export default async function Page(){
 const session=authenticationConfigured()?await getSession():null;
 const orders=session?(await getDatabase().query('SELECT id,status,total_cents,created_at FROM zangraf_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[session.user.id])).rows:[];
 if(!orders.length)return <div className="ca-empty">
  <span className="ca-printer" aria-hidden="true"><Printer size={56} strokeWidth={1.3}/><i/></span>
  <h2>Nenhum pedido ainda</h2>
  <p>Quando seu álbum for para a impressão, você acompanha tudo por aqui.</p>
  <Link className="ca-button" href="/albuns">Ver álbuns</Link>
 </div>;
 return <div className="ca-orders">{orders.map((order,index)=>{
  const cancelled=order.status==='cancelled';const done=reached[order.status]??0;
  return <article className={'ca-order'+(cancelled?' is-cancelled':'')} key={order.id} style={{'--i':index} as CSSProperties}>
   <header>
    <div><h3>Pedido #{String(order.id).slice(0,8).toUpperCase()}</h3><p>{new Date(order.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</p></div>
    <div className="ca-order-total"><strong>{order.total_cents===null?'A confirmar':money.format(Number(order.total_cents)/100)}</strong><span className="ca-badge" data-status={order.status}>{cancelled&&<Ban size={13} aria-hidden="true"/>}{labels[order.status]||'Em análise'}</span></div>
   </header>
   {!cancelled&&<ol className="ca-steps" aria-label={`Andamento: ${labels[order.status]||'em análise'}`} style={{'--done':done} as CSSProperties}>
    {steps.map(({label,icon:Icon,color},i)=>{const state=i<done?'done':i===done?'current':'next';
     return <li key={label} data-state={state} style={{'--c':color,'--s':i} as CSSProperties}>
      <span className="ca-step-dot">{state==='done'?<Check size={16} strokeWidth={2.6} aria-hidden="true"/>:<Icon size={16} aria-hidden="true"/>}</span>
      <small>{label}</small>
     </li>;})}
   </ol>}
  </article>;
 })}</div>;
}
