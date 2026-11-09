'use client';
import {usesAlbumLayout} from '@/lib/products';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {Minus, Plus, Trash2, ArrowRight, ArrowUpRight, ShoppingBag} from 'lucide-react';
import {productPrice} from '@/lib/pricing';
import {products} from '@/lib/products';
import {readCart, writeCart, type CartItem} from '@/lib/cart';
import {ProductVisual} from './product-card';

const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});

export function Cart() {
 const [items, setItems] = useState<CartItem[]>([]);
 const [ready, setReady] = useState(false);
 const [error, setError] = useState('');
 useEffect(() => {
  try {setItems(readCart());} catch {setError('Não foi possível carregar o carrinho nesta sessão.');}
  setReady(true);
 }, []);
 function update(next: CartItem[]) {
  try {writeCart(next); setItems(next); setError('');}
  catch {setError('Não foi possível atualizar o carrinho. Tente novamente.');}
 }
 if (!ready) return <p role="status">Carregando suas escolhas…</p>;
 const entries = items.map(item => ({item, product: item.product || products.find(product => product.id === item.productId)}));
 const quoted = entries.filter(entry => !entry.product || productPrice(entry.product,entry.item.configuration)===null);
 const subtotal = entries.reduce((sum, {item, product}) => sum + (product && !product.isDemo ? (productPrice(product,item.configuration)??0)*item.quantity : 0), 0);
 const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
 return <>{error && <p role="alert" className="zg-config-error">{error}</p>}{items.length ? <div className="zg-cart-layout"><div className="zg-cart-items">{entries.map(({item, product}) => {
  if (!product) return <article className="zg-cart-item" key={item.id}><div><h2>Produto indisponível</h2><p>Remova este item para continuar.</p><button type="button" className="back" onClick={() => update(items.filter(entry => entry.id !== item.id))}><Trash2 size={14}/> Remover</button></div></article>;
  const isAlbum = usesAlbumLayout(product);
  const unitPrice=productPrice(product,item.configuration);const hasPrice=unitPrice!==null;
  return <article className="zg-cart-item" key={item.id}><Link href={((!product.kind||product.kind==='album') ? '/albuns/' : '/produtos/') + product.id} className="zg-cart-picture" aria-label={'Ver ' + product.name}><ProductVisual product={product}/></Link><div className="zg-cart-item-copy"><span className="zg-eyebrow">{product.kind==='kit' ? 'KIT LAYFLAT' : isAlbum ? 'ÁLBUM' : product.kind === 'case' ? 'ESTOJO' : 'ACESSÓRIO'}</span><h2>{product.name}</h2><p>{Object.values(item.configuration).filter(Boolean).join(' · ') || 'Sem opções adicionais'}</p>{product.isDemo && <span className="zg-cart-demo">Modelo conceitual · disponibilidade a confirmar</span>}{isAlbum && <Link className="zg-cart-diagram" href={'/diagramador?item=' + encodeURIComponent(item.id) + (item.layoutProjectId ? '&projeto=' + encodeURIComponent(item.layoutProjectId) : '')}>{item.layoutProjectId ? 'Continuar meu álbum' : 'Personalizar no diagramador'}<ArrowUpRight size={14}/></Link>}<div className="zg-cart-item-actions"><div className="zg-cart-quantity" aria-label={'Quantidade de ' + product.name}><button type="button" aria-label={'Diminuir quantidade de ' + product.name} disabled={item.quantity === 1} onClick={() => update(items.map(entry => entry.id === item.id ? {...entry, quantity: entry.quantity - 1} : entry))}><Minus size={13}/></button><span aria-live="polite">{item.quantity}</span><button type="button" aria-label={'Aumentar quantidade de ' + product.name} disabled={item.quantity === 99} onClick={() => update(items.map(entry => entry.id === item.id ? {...entry, quantity: entry.quantity + 1} : entry))}><Plus size={13}/></button></div><button type="button" className="zg-cart-remove" aria-label={'Remover ' + product.name + ' do carrinho'} onClick={() => update(items.filter(entry => entry.id !== item.id))}><Trash2 size={13}/><span>Remover</span></button><span className="zg-cart-line-price">{hasPrice ? money.format(unitPrice! * item.quantity / 100) : 'Sob consulta'}</span></div></div></article>;
 })}</div><aside className="zg-order-summary"><span className="zg-eyebrow">O PRÓXIMO CAPÍTULO</span><h2>Suas escolhas.</h2><dl><div><dt>Produtos</dt><dd>{quantity} {quantity === 1 ? 'unidade' : 'unidades'}</dd></div><div><dt>{quoted.length ? 'Subtotal com preço definido' : 'Subtotal'}</dt><dd>{subtotal ? money.format(subtotal / 100) : 'Sob consulta'}</dd></div>{quoted.length > 0 && <div><dt>Itens sob consulta</dt><dd>{quoted.length}</dd></div>}<div><dt>Frete</dt><dd>A confirmar</dd></div></dl><div className="zg-cart-total"><span>Total estimado</span><strong>{quoted.length ? 'Sob consulta' : money.format(subtotal / 100)}</strong></div><p>Os valores serão conferidos na revisão. O frete será confirmado antes do pagamento.</p><Link className="button zg-button" href="/revisar-pedido">Revisar pedido <ArrowRight size={16}/></Link><Link className="zg-quiet-link" href="/albuns">Continuar explorando <ArrowUpRight size={14}/></Link></aside></div> : <div className="zg-empty-collection zg-cart-empty"><ShoppingBag size={34} strokeWidth={1}/><h2>Seu carrinho está esperando uma história.</h2><p>Explore a coleção e encontre os detalhes que combinam com você.</p><Link className="button zg-button" href="/albuns">Explorar álbuns <ArrowRight size={16}/></Link></div>}</>;
}

export function OrderReview() {
 const [items, setItems] = useState<CartItem[]>([]); const [ready, setReady] = useState(false); const [error,setError]=useState('');
 useEffect(() => { try { setItems(readCart()); } catch { setError('Não foi possível ler o carrinho.'); } setReady(true); }, []);
 if (!ready) return <p role="status">Carregando revisão…</p>;
 return <div className="form-panel"><h2>{items.length ? 'Tudo pronto para a próxima etapa.' : 'Escolha um álbum para começar.'}</h2>{error && <p role="alert">{error}</p>}{items.map(i => <p key={i.id}><strong>{(i.product || products.find(p => p.id === i.productId))?.name} × {i.quantity}</strong><br/>{Object.values(i.configuration).join(' · ')}</p>)}<p>Esta é uma revisão demonstrativa. Nenhum pedido foi enviado. Finalização, frete e pagamento estarão disponíveis em uma etapa futura.</p><Link className="button" href={items.length ? '/carrinho' : '/albuns'}>{items.length ? 'Voltar ao carrinho' : 'Explorar álbuns'}</Link></div>;
}
