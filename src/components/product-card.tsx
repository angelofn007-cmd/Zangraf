import Link from 'next/link';
import Image from 'next/image';
import {ArrowUpRight, Package, Sparkles} from 'lucide-react';
import type {CSSProperties} from 'react';
import type {Product} from '@/lib/products';
import {minimumProductPrice} from '@/lib/pricing';
import {AlbumArt} from './album-art';

const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});

export function ProductVisual({product}: {product: Product}) {
 const kind = product.kind ?? 'album';
 if (product.imageUrl) return <Image className="zg-product-photo" src={product.imageUrl} alt={product.name} fill sizes="(max-width:760px) 45vw, 30vw" unoptimized={!product.imageUrl.startsWith('/')} style={{objectFit:'cover'}}/>;
 if (kind === 'album') return <AlbumArt color={product.color}/>;
 return <div className={'zg-product-placeholder zg-product-placeholder-' + kind} style={{'--product-color': product.color} as CSSProperties}>
  {kind === 'case' ? <div className="zg-case-object"><div className="zg-case-lid"/><div className="zg-case-base"/><Package className="zg-case-symbol" size={28} strokeWidth={1}/></div> : <div className="zg-accessory-placeholder"><Sparkles size={35} strokeWidth={1}/><span>Espaço para a<br/>fotografia do produto</span></div>}
  <span className="zg-art-label">{kind === 'case' ? 'ILUSTRAÇÃO CONCEITUAL' : 'FOTOGRAFIA EM BREVE'}</span>
 </div>;
}

export function ProductCard({product}: {product: Product}) {
 const kind = product.kind ?? 'album';
 const href = (kind === 'album' ? '/albuns/' : '/produtos/') + product.id;
 const price=minimumProductPrice(product);const hasPrice=price!==null;
 return <article className="zg-product-card">
  <Link href={href} className="zg-product-picture" aria-label={'Conhecer ' + product.name}><ProductVisual product={product}/><span className="zg-product-arrow"><ArrowUpRight size={19}/></span></Link>
  <div className="zg-product-info"><div className="zg-product-kicker"><span>{product.category}</span>{product.isDemo && <span>Modelo conceitual</span>}</div><h3><Link href={href}>{product.name}</Link></h3><p>{product.description}</p><div className="zg-product-bottom"><span>{hasPrice ? (product.albumPricing?.length?'A partir de ':'')+money.format(price! / 100) : 'Sob consulta'}</span><Link href={href}>Conhecer <ArrowUpRight size={15} strokeWidth={1.5}/></Link></div></div>
 </article>;
}
