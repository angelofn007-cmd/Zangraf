import Link from 'next/link';
import {connection} from 'next/server';
import {getProducts} from '@/lib/server/catalog';
import {Catalog} from '@/components/catalog';

export const metadata = {title: 'Acessórios'};

export default async function Accessories() {
  await connection();
  const products = (await getProducts()).filter(product => product.kind === 'accessory');
  return <section className="zg-section zg-catalog"><div className="zg-catalog-intro"><span className="zg-eyebrow">A COLEÇÃO ZANGRAF</span><h1>Pequenos detalhes.<br/><em>Novas possibilidades.</em></h1><div><p>Complementos para acompanhar suas fotografias e tornar cada entrega ainda mais sua.</p></div></div><nav className="zg-catalog-nav" aria-label="Categorias de produtos"><Link href="/albuns">Álbuns</Link><Link href="/acessorios" aria-current="page">Acessórios</Link><Link href="/estojos">Estojos</Link><Link href="/kits-layflat">Kits Layflat</Link></nav><Catalog products={products}/></section>;
}
