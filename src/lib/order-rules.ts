import {usesAlbumLayout} from './products';
import {coverPageIndices} from './cover-production';
import type {LayoutProject} from './layout-projects';
import {displayProductText,type Configuration,type Product} from './products';
import {configuredSheetCount,physicalPrintDimensions} from './print-rules';
import {productSheetOptions, ALBUM_STOCK_OPTIONS} from './album-options';
export function sheetCount(configuration:Configuration){
 return configuredSheetCount(configuration.sheets);
}
export function canonicalSelection(product:Product,value:unknown):Configuration {
 if(!value||typeof value!=='object')throw new Error('Confira as opções do produto.');
 const raw=value as Record<string,unknown>;const output={} as Configuration;
 for(const [key,optionKey] of [['size','sizes'],['sheets','sheets'],['cover','covers'],['finish','finishes']] as const){
  const options=key==='size'&&product.printSizes?.length?product.printSizes.map(p=>p.label):key==='sheets'&&usesAlbumLayout(product)?productSheetOptions(product):product.options[optionKey];
  const selected=key==='cover'&&typeof raw[key]==='string'?displayProductText(raw[key] as string):raw[key];
  if(typeof selected!=='string'||(options.length?!options.map(displayProductText).includes(selected):selected!==''))throw new Error('Uma opção do produto mudou. Configure o produto novamente.');
  output[key]=selected as string;
 }
 if(raw.stock !== undefined){if(!usesAlbumLayout(product)||typeof raw.stock!=='string'||!ALBUM_STOCK_OPTIONS.includes(raw.stock))throw new Error('Escolha a gramatura no produto.');output.stock=raw.stock;}
 return output;
}
export function expectedPrintFiles(product:Product,configuration:Configuration,model?:LayoutProject['productionModel']){
 if(!usesAlbumLayout(product))return [];
 const spec=product.printSizes?.find(s=>s.label===configuration.size);
 if(!spec)throw new Error('Este modelo ainda não tem medidas de impressão cadastradas.');
 const count=sheetCount(configuration),wrap=model?.coverMode==='wrap',spread=model?.insideMode==='spread';
 if(model&&(model.sheets!==count||(configuration.stock&&model.stock!==configuration.stock)||(['widthMm','heightMm','bleedMm','dpi'] as const).some(k=>model.page[k]!==spec[k])))throw new Error('O modelo de impressão não corresponde ao produto, gramatura ou quantidade.');
 const entries=[...coverPageIndices(model?.coverMode).map(index=>({filename:index===-2?'Capa/capa-verso.jpg':wrap?'Capa/capa-inteira.jpg':'Capa/capa-frente.jpg',spec:(index===-2?model?.back:model?.front)||spec,spread:false})),...Array.from({length:count*(spread?1:2)},(_,i)=>({filename:`${spread?'Lâminas':'Páginas'}/${String(i+1).padStart(3,'0')}.jpg`,spec,spread}))];
 return entries.map(entry=>{const {width,height}=physicalPrintDimensions(entry.spec,entry.spread);if(width*height>100_000_000)throw new Error('O formato ultrapassa o limite de exportação. Entre em contato com a equipe.');return {filename:entry.filename,width,height,dpi:entry.spec.dpi};});
}
