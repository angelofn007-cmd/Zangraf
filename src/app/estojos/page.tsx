import Link from 'next/link';
import {connection} from 'next/server';
import {getProducts} from '@/lib/server/catalog';
import {Catalog} from '@/components/catalog';

export const metadata = {title: 'Estojos para álbuns'};

export default async function Cases() {
  await connection();
  const products = (await getProducts()).filter(product => product.kind === 'case');
  return <section className="zg-section zg-catalog"><div className="zg-catalog-intro"><span className="zg-eyebrow">A COLEÇÃO ZANGRAF</span><h1>A história começa<br/><em>antes de abrir.</em></h1><div><p>Conheça as possibilidades de estojos para apresentar, acompanhar e guardar o seu álbum.</p></div></div><nav className="zg-catalog-nav" aria-label="Categorias de produtos"><Link href="/albuns">Álbuns</Link><Link href="/acessorios">Acessórios</Link><Link href="/estojos" aria-current="page">Estojos</Link><Link href="/kits-layflat">Kits Layflat</Link></nav><Catalog products={products}/></section>;
}
