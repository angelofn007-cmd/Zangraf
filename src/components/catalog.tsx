'use client';

import {useState} from 'react';
import {ArrowDownUp, Search} from 'lucide-react';
import type {Product} from '@/lib/products';
import {minimumProductPrice} from '@/lib/pricing';
import {ProductCard} from './product-card';

export function Catalog({products}: {products: Product[]}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [size,setSize]=useState('Todos');
  const [sort, setSort] = useState('collection');
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/(\d)\s*[x×]\s*(?=\d)/g,'$1x');
  const categories = ['Todos', ...new Set(products.map(product => product.category))];
  const sizes=[...new Set(products.flatMap(product=>product.printSizes?.map(size=>size.label)??product.options.sizes))].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));
  const filtered = products.filter(product => (category === 'Todos' || product.category === category) && (size==='Todos'||(product.printSizes?.map(size=>size.label)??product.options.sizes).includes(size)) && normalize(product.name + ' ' + product.description).includes(normalize(query.trim())));
  if (sort === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  if (sort === 'price') filtered.sort((a, b) => (minimumProductPrice(a)??Number.MAX_SAFE_INTEGER)-(minimumProductPrice(b)??Number.MAX_SAFE_INTEGER));
  return <div className="zg-catalog-results">
    <div className="zg-catalog-toolbar"><div className="zg-catalog-tools"><label className="zg-search"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar produto" placeholder="Encontre o seu produto" value={query} onChange={event => setQuery(event.target.value)}/></label></div>
    {(categories.length>2||sizes.length>1)&&<div className="zg-size-filter">
      {categories.length>2&&<div className="zg-filter-field"><label htmlFor="catalog-category">Tipo de álbum</label><select id="catalog-category" value={category} onChange={event=>setCategory(event.target.value)}><option value="Todos">Todos os tipos</option>{categories.filter(value=>value!=='Todos').map(value=><option key={value}>{value}</option>)}</select></div>}
      {sizes.length>1&&<div className="zg-filter-field"><label htmlFor="catalog-size">Tamanho do álbum</label><select id="catalog-size" value={size} onChange={event=>setSize(event.target.value)}><option value="Todos">Todos os tamanhos</option>{sizes.map(size=><option key={size}>{size}</option>)}</select></div>}
      {(size!=='Todos'||category!=='Todos'||query)&&<button onClick={()=>{setSize('Todos');setCategory('Todos');setQuery('')}}>Limpar filtros</button>}
    </div>}
    </div>
    <div className="zg-results-meta"><span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'produto para descobrir' : 'produtos para descobrir'}</span><label><ArrowDownUp size={13}/><span className="sr-only">Ordenar produtos</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="collection">Ordem da coleção</option><option value="name">Nome: A a Z</option><option value="price">Menor preço</option></select></label></div>
    <div className="zg-product-grid" key={category+size+sort}>{filtered.map((product, index) => <ProductCard key={product.id} product={product} index={index}/>)}</div>
    {!filtered.length && <div className="zg-empty-collection"><Search size={28}/><h2>{products.length ? 'Vamos tentar outro olhar?' : 'Novidades estão a caminho.'}</h2><p>{products.length ? 'Nenhum produto corresponde à busca. Experimente outro tamanho ou tipo de capa.' : 'A coleção desta categoria estará disponível em breve.'}</p>{products.length > 0 && <button className="button zg-button" onClick={() => {setQuery(''); setCategory('Todos');setSize('Todos');}}>Limpar busca</button>}</div>}
  </div>;
}
