import {Cart} from '@/components/cart';
export const metadata = {title: 'Carrinho'};
export default function Page() {
 return <section className="zg-section zg-cart-page">
  <header className="zg-cart-head">
   <span className="zg-eyebrow"><i aria-hidden="true"/>Suas escolhas, em um só lugar</span>
   <h1>Quase lá.<br/><em>Vamos revisar?</em></h1>
   <p>Confira seus produtos, ajuste o que quiser e siga para o pedido.</p>
  </header>
  <Cart/>
 </section>;
}
