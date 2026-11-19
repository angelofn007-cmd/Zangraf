'use client';
import {useEffect, useMemo, useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CreditCard, QrCode, Barcode, Truck, ShieldCheck, Package} from 'lucide-react';
import {readCart, type CartItem} from '@/lib/cart';
import {productPrice} from '@/lib/pricing';
import {products} from '@/lib/products';
import {ProductVisual} from './product-card';
import {CameraArt} from './camera-art';

const money = (value: number) => (value / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const onlyDigits = (value: string) => value.replace(/\D/g, '');

const METHODS = [
  {id: 'pix', label: 'Pix', icon: QrCode, hint: 'Aprovação na hora. Chave enviada para o pagamento.'},
  {id: 'card', label: 'Cartão de crédito', icon: CreditCard, hint: 'Em até 12× no ambiente seguro do pagamento.'},
  {id: 'boleto', label: 'Boleto', icon: Barcode, hint: 'Compensa em até 2 dias úteis.'},
] as const;

export function Checkout() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<'entrega' | 'pagamento' | 'pronto'>('entrega');
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('pix');
  const [form, setForm] = useState({name: '', phone: '', cep: '', address: '', number: '', city: '', notes: ''});
  const set = (key: keyof typeof form) => (value: string) => setForm(f => ({...f, [key]: value}));

  useEffect(() => { try { setItems(readCart()); } catch {} setReady(true); }, []);

  const entries = useMemo(() => items.map(item => ({item, product: item.product || products.find(p => p.id === item.productId)})), [items]);
  const subtotal = entries.reduce((sum, {item, product}) => sum + (product && !product.isDemo ? (productPrice(product, item.configuration) ?? 0) * item.quantity : 0), 0);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const quoted = entries.filter(e => !e.product || productPrice(e.product, e.item.configuration) === null).length;

  const deliveryReady = form.name.trim().length > 2 && onlyDigits(form.phone).length >= 10 && form.address.trim().length > 3 && form.city.trim().length > 1 && onlyDigits(form.cep).length === 8;

  if (!ready) return <p role="status">Carregando…</p>;
  if (!items.length) return <div className="zg-empty-collection zg-cart-empty"><Package size={34} strokeWidth={1}/><h2>Seu carrinho está vazio.</h2><p>Escolha um produto para seguir com o pedido.</p><Link className="button zg-button" href="/albuns">Explorar álbuns <ArrowRight size={16}/></Link></div>;

  if (step === 'pronto') return <div className="zg-pay-done">
    <span className="zg-pay-done-icon"><CheckCircle2 size={40} strokeWidth={1.5}/></span>
    <h2>Pedido registrado!</h2>
    <p>Recebemos suas escolhas. Vamos confirmar o frete e enviar as instruções de pagamento por <strong>{method === 'pix' ? 'Pix' : method === 'card' ? 'cartão' : 'boleto'}</strong> no contato informado.</p>
    <div className="zg-pay-done-total"><span>Total do pedido</span><strong>{quoted ? 'Sob consulta' : money(subtotal )}</strong></div>
    <Link className="button zg-button" href="/minha-conta/pedidos">Acompanhar meus pedidos <ArrowUpRight size={16}/></Link>
    <Link className="zg-quiet-link" href="/albuns">Voltar à loja <ArrowUpRight size={14}/></Link>
  </div>;

  return <div className="zg-pay-layout">
    <div className="zg-pay-main">
      <ol className="zg-pay-steps" aria-label="Etapas do pedido">
        {['Entrega', 'Pagamento'].map((label, i) => <li key={label} className={(step === 'entrega' ? 0 : 1) >= i ? 'is-done' : ''} aria-current={(step === 'entrega' ? 0 : 1) === i ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}
      </ol>

      {step === 'entrega' && <section className="zg-pay-card" key="entrega">
        <h2><Truck size={19} aria-hidden="true"/>Para onde enviamos?</h2>
        <div className="zg-pay-fields">
          <label className="wide">Nome completo<input value={form.name} onChange={e => set('name')(e.target.value)} placeholder="Seu nome" autoComplete="name"/></label>
          <label>Telefone / WhatsApp<input value={form.phone} inputMode="tel" onChange={e => set('phone')(e.target.value)} placeholder="(00) 00000-0000" autoComplete="tel"/></label>
          <label>CEP<input value={form.cep} inputMode="numeric" maxLength={9} onChange={e => set('cep')(e.target.value)} placeholder="00000-000" autoComplete="postal-code"/></label>
          <label className="wide">Endereço<input value={form.address} onChange={e => set('address')(e.target.value)} placeholder="Rua, avenida…" autoComplete="address-line1"/></label>
          <label>Número<input value={form.number} onChange={e => set('number')(e.target.value)} placeholder="Nº" autoComplete="address-line2"/></label>
          <label>Cidade<input value={form.city} onChange={e => set('city')(e.target.value)} placeholder="Cidade" autoComplete="address-level2"/></label>
          <label className="wide">Observações para a entrega <small>(opcional)</small><textarea rows={2} value={form.notes} maxLength={300} onChange={e => set('notes')(e.target.value)} placeholder="Ponto de referência, horário…"/></label>
        </div>
        <div className="zg-pay-actions">
          <Link className="back" href="/carrinho"><ArrowLeft size={15}/> Voltar ao carrinho</Link>
          <button type="button" className="button zg-button" disabled={!deliveryReady} onClick={() => setStep('pagamento')}>Ir para o pagamento <ArrowRight size={16}/></button>
        </div>
      </section>}

      {step === 'pagamento' && <section className="zg-pay-card" key="pagamento">
        <h2><ShieldCheck size={19} aria-hidden="true"/>Como você prefere pagar?</h2>
        <div className="zg-pay-methods" role="radiogroup" aria-label="Forma de pagamento">
          {METHODS.map((m, i) => <button key={m.id} type="button" role="radio" aria-checked={method === m.id} style={{['--i' as string]: String(i)}} className={'zg-pay-method' + (method === m.id ? ' is-active' : '')} onClick={() => setMethod(m.id)}>
            <span className="zg-pay-method-icon"><m.icon size={20} aria-hidden="true"/></span>
            <span className="zg-pay-method-copy"><strong>{m.label}</strong><small>{m.hint}</small></span>
            <span className="zg-pay-radio" aria-hidden="true"/>
          </button>)}
        </div>
        <p className="zg-pay-note"><ShieldCheck size={14} aria-hidden="true"/>O pagamento é feito em ambiente seguro. Enviamos as instruções no seu contato e nada é cobrado antes da sua confirmação.</p>
        <div className="zg-pay-actions">
          <button type="button" className="back" onClick={() => setStep('entrega')}><ArrowLeft size={15}/> Voltar</button>
          <button type="button" className="button zg-button" onClick={() => setStep('pronto')}>Finalizar pedido <ArrowRight size={16}/></button>
        </div>
      </section>}
    </div>

    <aside className="zg-order-summary zg-pay-summary">
      <span className="zg-eyebrow">O PRÓXIMO CAPÍTULO</span>
      <h2>Seu pedido.</h2>
      <ul className="zg-pay-items">
        {entries.map(({item, product}, i) => <li key={item.id} style={{['--i' as string]: String(i)}}><span className="zg-pay-thumb">{product && <ProductVisual product={product}/>}</span><span className="zg-pay-item-copy"><strong>{product?.name || 'Produto'}</strong><small>{item.quantity} un · {product ? (productPrice(product, item.configuration) !== null ? money(productPrice(product, item.configuration)! * item.quantity ) : 'Sob consulta') : ''}</small></span></li>)}
      </ul>
      <dl>
        <div><dt>Produtos</dt><dd>{quantity} {quantity === 1 ? 'unidade' : 'unidades'}</dd></div>
        <div><dt>Subtotal</dt><dd>{subtotal ? money(subtotal ) : 'Sob consulta'}</dd></div>
        <div><dt>Frete</dt><dd>A confirmar</dd></div>
      </dl>
      <div className="zg-cart-total"><span>Total estimado</span><strong>{quoted ? 'Sob consulta' : money(subtotal )}</strong></div>
      <CameraArt/>
    </aside>
  </div>;
}
