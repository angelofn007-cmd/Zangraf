import {usesAlbumLayout} from './products';
import {normalizeProduct,type Product,type ProductKind} from './products';
import {productSheetOptions} from './album-options';
import {validatePhysicalPrintSpec,configuredSheetCount} from './print-rules';

export function parseProduct(value: unknown): Product {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Produto inválido.');
  const p = value as Record<string, unknown>;
  const text = (key: string, max: number) => {
    const v = p[key];
    if (typeof v !== 'string' || !v.trim() || v.length > max) throw new Error('Confira o campo ' + key + '.');
    return v.trim();
  };
  const id = text('id', 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Identificador inválido.');
  const color = text('color', 7);
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Cor inválida.');
  const kind = (p.kind ?? 'album') as ProductKind;
  if (!['album', 'accessory', 'case', 'kit'].includes(kind)) throw new Error('Tipo de produto inválido.');
  const raw = p.options;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Opções ausentes.');
  const options = {} as Product['options'];
  for (const key of ['sizes', 'sheets', 'covers', 'finishes'] as const) {
    const list = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(list) || (usesAlbumLayout({kind}) && key !== 'finishes' && !list.length) || list.length > 30 || list.some(v => typeof v !== 'string' || !v.trim() || v.length > 100)) throw new Error('Opções inválidas: ' + key + '.');
    options[key] = [...new Set(list.map(v => (v as string).trim()))];
  }
  if(usesAlbumLayout({kind})){options.sheets.forEach(configuredSheetCount);options.sheets=productSheetOptions({options});if(!options.sheets.length)throw new Error('Cadastre ao menos uma quantidade válida de lâminas.');}
  const product: Product = {id, name: text('name', 100), category: text('category', 100), description: text('description', 1000), color, kind, options};
  if (p.priceCents != null) {
    if (typeof p.priceCents !== 'number' || !Number.isSafeInteger(p.priceCents) || p.priceCents <= 0 || p.priceCents > 100_000_000) throw new Error('Preço inválido.');
    product.priceCents = p.priceCents;
  }
  if (p.isDemo !== undefined && typeof p.isDemo !== 'boolean') throw new Error('Identificação de demonstração inválida.');
  product.isDemo = p.isDemo === true;
  if (p.imageUrl != null && p.imageUrl !== '') {
    if (typeof p.imageUrl !== 'string' || p.imageUrl.length > 2000) throw new Error('Imagem inválida.');
    const url = p.imageUrl.trim();
    if (!(url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) && !/^https:\/\/[^\s]+$/i.test(url)) throw new Error('Use uma URL HTTPS ou um caminho local para a imagem.');
    product.imageUrl = url;
  }
  if(p.imageUrls !== undefined){
    if(!Array.isArray(p.imageUrls)||p.imageUrls.length>12)throw new Error('A galeria aceita até 12 fotos.');
    product.imageUrls=[...new Set(p.imageUrls.map(value=>{
      if(typeof value!=='string'||value.length>2000)throw new Error('Imagem da galeria inválida.');
      const url=value.trim();
      if(!(url.startsWith('/')&&!url.startsWith('//')&&!url.includes('\\'))&&!/^https:\/\/[^\s]+$/i.test(url))throw new Error('Use uma URL HTTPS ou um caminho local para as fotos.');
      return url;
    }))];
    if(!product.imageUrl&&product.imageUrls.length)product.imageUrl=product.imageUrls[0];
  }
  if (p.printSizes !== undefined) {
    if (!Array.isArray(p.printSizes) || p.printSizes.length > 40) throw new Error('Formatos de impressão inválidos.');
    product.printSizes = p.printSizes.map(rawSize => {
      if (!rawSize || typeof rawSize !== 'object') throw new Error('Formato de impressão inválido.');
      const size = rawSize as Record<string, unknown>;
      if (typeof size.label !== 'string' || !size.label.trim() || size.label.length > 80) throw new Error('Nome do formato inválido.');
      for (const key of ['widthMm', 'heightMm'] as const) {
        if (typeof size[key] !== 'number' || !Number.isFinite(size[key]) || size[key] < 50 || size[key] > 1000) throw new Error('Medidas devem estar entre 50 e 1000 mm.');
      }
      if (typeof size.bleedMm !== 'number' || !Number.isFinite(size.bleedMm) || size.bleedMm < 0 || size.bleedMm > 20) throw new Error('Sangria inválida.');
      if (typeof size.dpi !== 'number' || !Number.isInteger(size.dpi) || size.dpi < 72 || size.dpi > 1200) throw new Error('Resolução inválida.');
      if(size.bleedMm!==3)throw new Error('O miolo exige 0,3 cm de sangria por lado.');
      return validatePhysicalPrintSpec({label:size.label.trim(),widthMm:size.widthMm as number,heightMm:size.heightMm as number,bleedMm:size.bleedMm,dpi:size.dpi});
    });
    if (new Set(product.printSizes.map(size => size.label)).size !== product.printSizes.length) throw new Error('Os nomes dos formatos não podem se repetir.');
  }
  if(p.albumPricing!==undefined){
    if(!usesAlbumLayout({kind})||!Array.isArray(p.albumPricing)||p.albumPricing.length>80)throw new Error('Tabela de preços por lâmina inválida.');
    const sizes=product.printSizes?.map(size=>size.label)||options.sizes;const seen=new Set<string>();
    product.albumPricing=p.albumPricing.map(row=>{
      if(!row||typeof row!=='object')throw new Error('Linha de preço inválida.');
      const v=row as Record<string,unknown>;
      if(typeof v.size!=='string'||!sizes.includes(v.size)||!['500 g','800 g'].includes(String(v.stock)))throw new Error('Confira o formato e a gramatura da tabela.');
      for(const key of ['bindingCents','sheetCents'])if(typeof v[key]!=='number'||!Number.isSafeInteger(v[key])||Number(v[key])<=0||Number(v[key])>1_000_000)throw new Error('Informe valores positivos para o encadernado e a lâmina.');
      if(typeof v.finish!=='string'||!options.finishes.includes(v.finish))throw new Error('Confira o acabamento da tabela de preços.');
      if(v.maxSheets!==undefined&&(!Number.isInteger(v.maxSheets)||Number(v.maxSheets)<10||Number(v.maxSheets)>60||Number(v.maxSheets)%5!==0))throw new Error('O limite de lâminas deve estar entre 10 e 60, de 5 em 5.');
      const key=v.size+':'+v.stock+':'+v.finish;if(seen.has(key))throw new Error('Há preços duplicados para o mesmo formato, gramatura e acabamento.');seen.add(key);
      return {size:v.size,stock:v.stock as '500 g'|'800 g',finish:v.finish,bindingCents:v.bindingCents as number,sheetCents:v.sheetCents as number,...(v.maxSheets!==undefined?{maxSheets:Number(v.maxSheets)}:{})};
    });
  }
  return normalizeProduct(product);
}
