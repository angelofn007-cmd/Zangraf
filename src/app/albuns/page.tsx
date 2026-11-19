import Link from 'next/link';
import {connection} from 'next/server';

import {getProducts} from '@/lib/server/catalog';
import {Catalog} from '@/components/catalog';

export const metadata = {title: 'Álbuns fotográficos'};

export default async function Albums() {
  await connection();
  const products = (await getProducts()).filter(product => !product.kind || product.kind === 'album');
  return <section className="zg-section zg-catalog"><div className="zg-catalog-intro"><span className="zg-eyebrow">A COLEÇÃO ZANGRAF</span><h1>Fotografias que pedem<br/><em>para ser folheadas.</em></h1><div><p>Encontre seu modelo por tamanho e tipo de capa. Escolha a capa, a gramatura e de 10 a 60 lâminas. Depois, personalize seu álbum no tamanho certo.</p></div></div><nav className="zg-catalog-nav" aria-label="Categorias de produtos"><Link href="/albuns" aria-current="page">Álbuns</Link><Link href="/acessorios">Acessórios</Link><Link href="/estojos">Estojos</Link><Link href="/kits-layflat">Kits Layflat</Link></nav><Catalog products={products}/></section>;
}
