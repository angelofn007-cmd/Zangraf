import {Checkout} from '@/components/checkout';
export const metadata = {title: 'Pagamento', robots: {index: false, follow: false}};
export default function Page() {
 return <section className="zg-section zg-cart-page zg-pay-page">
  <header className="zg-cart-head">
   <span className="zg-eyebrow"><i aria-hidden="true"/>Falta pouco para a sua história ganhar forma</span>
   <h1>Finalizar <em>pedido.</em></h1>
   <p>Informe a entrega, escolha como pagar e pronto.</p>
  </header>
  <Checkout/>
 </section>;
}
