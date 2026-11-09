import Link from 'next/link';
import {Package} from 'lucide-react';
import {authenticationConfigured,getSession} from '@/lib/server/auth';
import {getDatabase} from '@/lib/server/db';
export const metadata={title:'Meus pedidos'};
const labels:Record<string,string>={draft:'Rascunho',awaiting_payment:'Aguardando pagamento',paid:'Pago',production:'Em produção',shipped:'Enviado',cancelled:'Cancelado'};
export default async function Page(){
 const session=authenticationConfigured()?await getSession():null;
 const orders=session?(await getDatabase().query('SELECT id,status,total_cents,created_at FROM zangraf_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[session.user.id])).rows:[];
 return <><div className="customer-section-heading"><h2>Meus pedidos</h2><p>Acompanhe o andamento das suas compras.</p></div>{orders.length?<div className="customer-orders">{orders.map(order=><article className="customer-order" key={order.id}><div className="customer-order-main"><span className="customer-nav-icon"><Package size={23}/></span><div><h3>Pedido #{String(order.id).slice(0,8)}</h3><p>Realizado em {new Date(order.created_at).toLocaleDateString('pt-BR')}</p></div></div><div className="customer-order-total"><span className="customer-status" data-status={order.status}>{labels[order.status]||'Em análise'}</span><strong>{order.total_cents===null?'Valor a confirmar':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(order.total_cents)/100)}</strong></div></article>)}</div>:<div className="empty"><Package size={34}/><h3>Você ainda não tem pedidos</h3><p>Quando fizer sua primeira compra, ela aparecerá aqui.</p><Link className="button" href="/albuns">Conhecer os álbuns</Link></div>}</>;
}
