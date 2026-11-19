import Link from 'next/link';
import {connection} from 'next/server';
import {getProducts} from '@/lib/server/catalog';
import {Catalog} from '@/components/catalog';

export const metadata={title:'Kits Layflat'};
export default async function Kits(){
 await connection();
 const products=(await getProducts()).filter(product=>product.kind==='kit');
 return <section className="zg-section zg-catalog">
  <div className="zg-catalog-intro"><span className="zg-eyebrow">A COLEÇÃO ZANGRAF</span><h1>Uma história.<br/><em>Todos os detalhes.</em></h1><div><p>Álbum e apresentação reunidos. Escolha as opções do kit e personalize o álbum antes de finalizar seu pedido.</p></div></div>
  <nav className="zg-catalog-nav" aria-label="Categorias de produtos"><Link href="/albuns">Álbuns</Link><Link href="/acessorios">Acessórios</Link><Link href="/estojos">Estojos</Link><Link href="/kits-layflat" aria-current="page">Kits Layflat</Link></nav>
  <Catalog products={products}/>
 </section>;
}
