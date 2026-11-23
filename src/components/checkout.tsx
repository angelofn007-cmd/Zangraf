'use client';
import {useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2, CreditCard, QrCode, Barcode, Truck, ShieldCheck, Package, CircleAlert, LoaderCircle} from 'lucide-react';
import {readCart, type CartItem} from '@/lib/cart';
import {productPrice} from '@/lib/pricing';
import {products} from '@/lib/products';
import {ProductVisual} from './product-card';
import {CameraArt} from './camera-art';
import {submitOrder, type PaymentMethod} from './order-submit';

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
const onlyDigits = (value: string) => value.replace(/\D/g, '');
const formatCep = (value: string) => onlyDigits(value).slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2');
const formatPhone = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const METHODS: {id: PaymentMethod; label: string; icon: typeof QrCode; hint: string}[] = [
  {id: 'pix', label: 'Pix', icon: QrCode, hint: 'Enviamos a chave Pix assim que o pedido for conferido.'},
  {id: 'card', label: 'Cartão de crédito', icon: CreditCard, hint: 'Enviamos o link de pagamento seguro, em até 12×.'},
  {id: 'boleto', label: 'Boleto', icon: Barcode, hint: 'Enviamos o boleto. Compensa em até 2 dias úteis.'},
];

export function Checkout({enabled}: {enabled: boolean}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<'entrega' | 'pagamento'>('entrega');
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [form, setForm] = useState({name: '', phone: '', cep: '', address: '', number: '', city: '', notes: ''});
  const [approved, setApproved] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [done, setDone] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm(f => ({...f, [key]: value}));

  useEffect(() => { try { setItems(readCart()); } catch { setError('Não foi possível ler o carrinho neste navegador.'); } setReady(true); }, []);
  // Não deixa fechar a aba no meio do envio dos arquivos.
  useEffect(() => {
    if (!busy) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [busy]);

  const entries = useMemo(() => items.map(item => ({item, product: item.product || products.find(p => p.id === item.productId)})), [items]);
  const unavailable = entries.some(({item, product}) => !product || product.isDemo || productPrice(product, item.configuration) === null);
  const subtotal = entries.reduce((sum, {item, product}) => sum + (product ? productPrice(product, item.configuration) ?? 0 : 0) * item.quantity, 0);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryReady = form.name.trim().length > 2 && onlyDigits(form.phone).length >= 10 && form.address.trim().length > 3 && form.city.trim().length > 1 && onlyDigits(form.cep).length === 8;

  async function finish() {
    if (busyRef.current) return;
    if (!approved) { setError('Confirme que revisou os álbuns e os dados do pedido.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const result = await submitOrder({
        items, phone: form.phone, notes: form.notes.trim(), paymentMethod: method,
        delivery: {name: form.name.trim(), cep: onlyDigits(form.cep), address: form.address.trim(), number: form.number.trim(), city: form.city.trim(), notes: form.notes.trim()},
        approvedWarnings: warnings, onProgress: setProgress, onOrderId: setOrderId,
      });
      if (result.status === 'warnings') {
        setWarnings(result.warnings); setApproved(false); setProgress('');
        setError('Encontramos alguns pontos nos álbuns. Confira abaixo e confirme de novo para enviar.');
        return;
      }
      setOrderId(result.orderId); setDone(true); setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar. Seus álbuns continuam salvos neste navegador.');
      setProgress('');
    } finally { busyRef.current = false; setBusy(false); }
  }

  if (!ready) return <p role="status">Carregando…</p>;

  if (done) return <div className="zg-pay-done">
    <span className="zg-pay-done-icon"><CheckCircle2 size={40} strokeWidth={1.5}/></span>
    <h2>Pedido recebido!</h2>
    <p>Referência <strong>#{orderId.slice(0, 8)}</strong>. Vamos conferir os álbuns, confirmar o frete e enviar as instruções de pagamento por <strong>{METHODS.find(m => m.id === method)?.label}</strong> no WhatsApp {form.phone}.</p>
    <div className="zg-pay-done-total"><span>Total dos produtos</span><strong>{money(subtotal)}</strong></div>
    <Link className="button zg-button" href="/minha-conta/pedidos">Acompanhar meus pedidos <ArrowUpRight size={16}/></Link>
    <Link className="zg-quiet-link" href="/albuns">Voltar à loja <ArrowUpRight size={14}/></Link>
  </div>;

  if (!items.length) return <div className="zg-empty-collection zg-cart-empty"><Package size={34} strokeWidth={1}/><h2>Seu carrinho está vazio.</h2><p>Escolha um produto para seguir com o pedido.</p><Link className="button zg-button" href="/albuns">Explorar álbuns <ArrowRight size={16}/></Link></div>;

  return <div className="zg-pay-layout">
    <div className="zg-pay-main">
      <ol className="zg-pay-steps" aria-label="Etapas do pedido">
        {['Entrega', 'Pagamento'].map((label, i) => <li key={label} className={(step === 'entrega' ? 0 : 1) >= i ? 'is-done' : ''} aria-current={(step === 'entrega' ? 0 : 1) === i ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}
      </ol>

      {!enabled && <p className="zg-pay-alert" role="status"><CircleAlert size={16} aria-hidden="true"/>Os pedidos pelo site estarão disponíveis em breve. Seu carrinho e seus álbuns continuam salvos neste navegador.</p>}
      {unavailable && <p className="zg-pay-alert" role="alert"><CircleAlert size={16} aria-hidden="true"/>Seu carrinho tem um modelo ilustrativo ou sem preço publicado. Remova esse item no carrinho para finalizar.</p>}

      {step === 'entrega' && <section className="zg-pay-card" key="entrega">
        <h2><Truck size={19} aria-hidden="true"/>Para onde enviamos?</h2>
        <div className="zg-pay-fields">
          <label className="wide">Nome completo<input value={form.name} onChange={e => set('name')(e.target.value)} placeholder="Quem vai receber" autoComplete="name" maxLength={100}/></label>
          <label>Telefone / WhatsApp<input value={form.phone} inputMode="tel" onChange={e => set('phone')(formatPhone(e.target.value))} placeholder="(00) 00000-0000" autoComplete="tel"/></label>
          <label>CEP<input value={form.cep} inputMode="numeric" onChange={e => set('cep')(formatCep(e.target.value))} placeholder="00000-000" autoComplete="postal-code"/></label>
          <label className="wide">Endereço<input value={form.address} onChange={e => set('address')(e.target.value)} placeholder="Rua, avenida…" autoComplete="address-line1" maxLength={160}/></label>
          <label>Número<input value={form.number} onChange={e => set('number')(e.target.value)} placeholder="Nº e complemento" autoComplete="address-line2" maxLength={20}/></label>
          <label>Cidade<input value={form.city} onChange={e => set('city')(e.target.value)} placeholder="Cidade / UF" autoComplete="address-level2" maxLength={80}/></label>
          <label className="wide">Observações <small>(opcional)</small><textarea rows={2} value={form.notes} maxLength={300} onChange={e => set('notes')(e.target.value)} placeholder="Ponto de referência, horário para entrega…"/></label>
        </div>
        <div className="zg-pay-actions">
          <Link className="back" href="/carrinho"><ArrowLeft size={15}/> Voltar ao carrinho</Link>
          <button type="button" className="button zg-button" disabled={!deliveryReady} onClick={() => { setError(''); setStep('pagamento'); }}>Ir para o pagamento <ArrowRight size={16}/></button>
        </div>
      </section>}

      {step === 'pagamento' && <section className="zg-pay-card" key="pagamento">
        <h2><ShieldCheck size={19} aria-hidden="true"/>Como você prefere pagar?</h2>
        <fieldset className="zg-pay-methods" disabled={busy} role="radiogroup" aria-label="Forma de pagamento">
          {METHODS.map((m, i) => <button key={m.id} type="button" role="radio" aria-checked={method === m.id} style={{['--i' as string]: String(i)}} className={'zg-pay-method' + (method === m.id ? ' is-active' : '')} onClick={() => setMethod(m.id)}>
            <span className="zg-pay-method-icon"><m.icon size={20} aria-hidden="true"/></span>
            <span className="zg-pay-method-copy"><strong>{m.label}</strong><small>{m.hint}</small></span>
            <span className="zg-pay-radio" aria-hidden="true"/>
          </button>)}
        </fieldset>
        <p className="zg-pay-note"><ShieldCheck size={14} aria-hidden="true"/>Nada é cobrado agora. A equipe confere os álbuns, confirma o frete e envia o pagamento no seu WhatsApp. A produção começa depois do pagamento confirmado.</p>
        {!!warnings.length && <div className="zg-pay-warnings" role="alert"><strong><CircleAlert size={16} aria-hidden="true"/>Confira antes de enviar</strong><ul>{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
        <label className="zg-pay-approve"><input type="checkbox" checked={approved} disabled={busy} onChange={e => setApproved(e.target.checked)}/><span>Revisei capas, páginas e enquadramentos e autorizo o envio desta versão para a Zangraf.</span></label>
        {progress && <p className="zg-pay-progress" role="status" aria-live="polite"><LoaderCircle size={16} aria-hidden="true"/>{progress}</p>}
        {error && <p className="zg-config-error" role="alert">{error}</p>}
        {orderId && !done && !busy && <p className="zg-pay-note">Pedido #{orderId.slice(0, 8)} em andamento. Se o envio foi interrompido, clique em Finalizar pedido de novo para retomar.</p>}
        <div className="zg-pay-actions">
          <button type="button" className="back" disabled={busy} onClick={() => setStep('entrega')}><ArrowLeft size={15}/> Voltar</button>
          <button type="button" className="button zg-button" disabled={busy || !enabled || unavailable || !approved} onClick={() => void finish()}>{busy ? 'Enviando…' : 'Finalizar pedido'} <ArrowRight size={16}/></button>
        </div>
      </section>}
    </div>

    <aside className="zg-order-summary zg-pay-summary">
      <span className="zg-eyebrow">O PRÓXIMO CAPÍTULO</span>
      <h2>Seu pedido.</h2>
      <ul className="zg-pay-items">
        {entries.map(({item, product}, i) => {
          const unit = product ? productPrice(product, item.configuration) : null;
          return <li key={item.id} style={{['--i' as string]: String(i)}}><span className="zg-pay-thumb">{product && <ProductVisual product={product}/>}</span><span className="zg-pay-item-copy"><strong>{product?.name || 'Produto indisponível'}</strong><small>{item.quantity} un · {unit !== null ? money(unit * item.quantity) : 'Sob consulta'}</small></span></li>;
        })}
      </ul>
      <dl>
        <div><dt>Produtos</dt><dd>{quantity} {quantity === 1 ? 'unidade' : 'unidades'}</dd></div>
        <div><dt>Subtotal</dt><dd>{unavailable ? 'Sob consulta' : money(subtotal)}</dd></div>
        <div><dt>Frete</dt><dd>A confirmar</dd></div>
      </dl>
      <div className="zg-cart-total"><span>Total estimado</span><strong>{unavailable ? 'Sob consulta' : money(subtotal)}</strong></div>
      <CameraArt/>
    </aside>
  </div>;
}
