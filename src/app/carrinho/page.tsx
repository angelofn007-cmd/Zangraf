import {Cart} from '@/components/cart';
export const metadata = {title: 'Carrinho'};
export default function Page() {
 return <section className="zg-section zg-cart-page"><span className="zg-eyebrow">SUAS ESCOLHAS, EM UM SÓ LUGAR</span><h1>Uma história em construção.</h1><p>Confira seus produtos e continue de onde parou.</p><Cart/></section>;
}
