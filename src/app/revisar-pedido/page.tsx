import Link from 'next/link';
import {connection} from 'next/server';
import {CheckoutReview} from '@/components/checkout-review';
import {authenticationConfigured,getSession} from '@/lib/server/auth';
export const metadata={title:'Revisar pedido',robots:{index:false,follow:false}};
export default async function Page(){
 await connection();
 const enabled=authenticationConfigured();
 const session=enabled?await getSession():null;
 return <section className="section"><span className="eyebrow">SUA HISTÓRIA, EM CADA DETALHE</span><h1>Revise seu pedido.</h1>{!enabled?<div className="form-panel"><h2>Estamos preparando o recebimento de pedidos.</h2><p>Seu carrinho e seus projetos continuam disponíveis neste navegador.</p><Link href="/carrinho" className="button">Voltar ao carrinho</Link></div>:!session?<div className="form-panel"><h2>Entre na sua conta para enviar.</h2><p>Assim você poderá acompanhar o pedido e salvar suas escolhas com segurança.</p><Link href="/entrar?destino=pedido" className="button">Entrar ou criar conta</Link></div>:<CheckoutReview/>}</section>;
}
