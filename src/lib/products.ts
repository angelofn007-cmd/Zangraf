import type {AlbumPriceRule} from './pricing';
import realCatalog from './catalogo-real.json';
export type PrintSize = {label: string; widthMm: number; heightMm: number; bleedMm: number; dpi: number};
export const defaultPrintSizes: PrintSize[] = [[20,20],[24,24],[24,30],[24,34],[22,30],[20,30],[30,20],[30,22],[30,24],[30,30],[30,40],[34,24]].map(([w,h]) => ({label: `${w} × ${h} cm`, widthMm:w*10, heightMm:h*10, bleedMm:3, dpi:300}));
export type ProductKind = 'album' | 'accessory' | 'case' | 'kit';
export type Product = { id: string; name: string; category: string; color: string; description: string; kind?: ProductKind; priceCents?: number; albumPricing?:AlbumPriceRule[]; imageUrl?: string; imageUrls?: string[]; isDemo?: boolean; printSizes?: PrintSize[]; options: { sizes: string[]; sheets: string[]; covers: string[]; finishes: string[] } };
export function usesAlbumLayout(product:Pick<Product,'kind'>){return !product.kind || product.kind==='album' || product.kind==='kit';}
export function canonicalProductId(id:string){return /^album-(22x30|24x34|30x30|34x24)-acrilico-sobreposto$/.test(id)?id.replace(/-sobreposto$/,''):id;}
export const displayProductText = (value:string) => value.replace(/anti[ -]?r{1,2}isco/gi,'Anti-Risco').replace(/Acrílico transparente/gi,'Acrílico');
export function normalizeProduct(product:Product):Product {return {...product,name:displayProductText(product.name),category:displayProductText(product.category),description:displayProductText(product.description),options:{...product.options,covers:product.options.covers.map(displayProductText)}};}
export const products = (realCatalog as Product[]).map(normalizeProduct);
export const legacyDemoProducts: Product[] = [
{id:'essencial',kind:'album',isDemo:true,printSizes:defaultPrintSizes,name:'Essencial',category:'Clássicos',color:'#c7b79b',description:'Uma composição leve, com a beleza das formas simples.',options:{sizes:['Quadrado','Horizontal'],sheets:['15 lâminas','20 lâminas'],covers:['Linho','Capa fotográfica'],finishes:['Fosco','Acetinado']}},
{id:'memoria',kind:'album',isDemo:true,printSizes:defaultPrintSizes,name:'Memória',category:'Contemporâneos',color:'#52614f',description:'Textura e personalidade para histórias que ficam.',options:{sizes:['Quadrado','Vertical'],sheets:['20 lâminas','25 lâminas'],covers:['Linho'],finishes:['Fosco']}},
{id:'atemporal',kind:'album',isDemo:true,printSizes:defaultPrintSizes,name:'Atemporal',category:'Clássicos',color:'#a37661',description:'Uma presença marcante, em uma proposta elegante.',options:{sizes:['Horizontal','Quadrado'],sheets:['15 lâminas','25 lâminas'],covers:['Tecido','Capa fotográfica'],finishes:['Fosco','Brilhante']}},
{id:'estojo-linho',name:'Estojo em linho',kind:'case',isDemo:true,category:'Estojos',color:'#bcae95',description:'Uma proposta de apresentação para acompanhar o álbum. Modelo ilustrativo; materiais e medidas serão confirmados pela Zangraf.',options:{sizes:['A definir'],sheets:[],covers:['Linho'],finishes:['A definir']}},
{id:'estojo-memoria',name:'Caixa de memórias',kind:'case',isDemo:true,category:'Estojos',color:'#6c755f',description:'Álbum e lembranças reunidos em uma apresentação especial. Modelo ilustrativo, sujeito à confirmação do catálogo.',options:{sizes:['A definir'],sheets:[],covers:['A definir'],finishes:['A definir']}},
{id:'luvas-algodao',name:'Luvas de cuidado',kind:'accessory',isDemo:true,category:'Acessórios',color:'#e6decf',description:'Proposta de acessório para manusear seu álbum. Produto ilustrativo, sem disponibilidade comercial confirmada.',options:{sizes:['A definir'],sheets:[],covers:[],finishes:[]}},
{id:'mini-album',name:'Mini álbum',kind:'accessory',isDemo:true,category:'Acessórios',color:'#aa8068',description:'Uma pequena lembrança para compartilhar histórias. Produto ilustrativo; formatos e disponibilidade a confirmar.',options:{sizes:['A definir'],sheets:[],covers:['A definir'],finishes:[]}}
];
export type Configuration = { size: string; sheets: string; cover: string; finish: string; stock?: string };
export type AlbumProject = { id: string; productId: string; configuration: Configuration; layoutProjectId?: string; orderId?: string };
// Valores e regras comerciais serão fornecidos pela Zangraf.
export function getQuote(_product: Product, _configuration: Configuration): null { return null; }
