import {productSheetOptions} from './album-options';
import type {Product,Configuration} from './products';
export type AlbumPriceRule={size:string;stock:'500 g'|'800 g';finish:string;bindingCents:number;sheetCents:number;maxSheets?:number};
export function albumPriceBreakdown(product:Product,configuration:Configuration){
 if(product.isDemo||!productSheetOptions(product).includes(configuration.sheets))return null;
 if(product.albumPricing?.length){
  const sheets=Number.parseInt(configuration.sheets,10);
  const rule=product.albumPricing.find(row=>row.size===configuration.size&&row.stock===configuration.stock&&row.finish===configuration.finish&&sheets<=(row.maxSheets??60));
  if(!rule||!Number.isInteger(sheets)||sheets<10||sheets>60||sheets%5!==0)return null;
  return {bindingCents:rule.bindingCents,sheetCents:rule.sheetCents,sheets,totalCents:rule.bindingCents+sheets*rule.sheetCents};
 }
 return null;
}
export function productPrice(product:Product,configuration:Configuration):number|null {
 if(product.isDemo)return null;
 if(product.albumPricing?.length)return albumPriceBreakdown(product,configuration)?.totalCents??null;
 return product.priceCents??null;
}
export function minimumProductPrice(product:Product,configuration?:Partial<Configuration>):number|null {
 if(product.isDemo)return null;
 if(product.albumPricing?.length){
  const count=configuration?.sheets?Number.parseInt(configuration.sheets,10):10;
  const rows=product.albumPricing.filter(row=>(!configuration?.size||row.size===configuration.size)&&(!configuration?.stock||row.stock===configuration.stock)&&(!configuration?.finish||row.finish===configuration.finish)&&count<=(row.maxSheets??60));
  return rows.length?Math.min(...rows.map(row=>row.bindingCents+count*row.sheetCents)):null;
 }
 return product.priceCents??null;
}
