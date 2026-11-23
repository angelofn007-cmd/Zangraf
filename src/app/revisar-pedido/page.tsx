import {redirect} from 'next/navigation';
// A revisão e o envio do pedido agora acontecem na página de pagamento.
export default function Page() { redirect('/pagamento'); }
