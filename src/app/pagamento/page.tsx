import {connection} from 'next/server';
import {redirect} from 'next/navigation';
import {Checkout} from '@/components/checkout';
import {authenticationConfigured, getSession} from '@/lib/server/auth';
export const metadata = {title: 'Finalizar pedido', robots: {index: false, follow: false}};
export default async function Page() {
 await connection();
 const enabled = authenticationConfigured();
 // Para finalizar é preciso entrar na conta; depois do login a pessoa volta direto para cá.
 if (enabled && !await getSession().catch(() => null)) redirect('/entrar?destino=pagamento');
 return <section className="zg-section zg-cart-page zg-pay-page">
  <header className="zg-cart-head">
   <span className="zg-eyebrow"><i aria-hidden="true"/>Falta pouco para a sua história ganhar forma</span>
   <h1>Finalizar <em>pedido.</em></h1>
   <p>Informe a entrega, escolha como pagar e pronto.</p>
  </header>
  <Checkout enabled={enabled}/>
 </section>;
}
