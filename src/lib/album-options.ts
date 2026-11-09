/** Customer choices are made on the product, before opening the editor. */
export const ALBUM_SHEET_OPTIONS = Array.from({length: 11}, (_, index) => `${10 + index * 5} lâminas`);
export const ALBUM_STOCK_OPTIONS = ['500 g', '800 g'];

export function productSheetOptions(product:{options:{sheets:string[];covers:string[]}}):string[]{
 const max=product.options.covers.some(cover=>/^1500\s*(g|gramas)$/i.test(cover))?40:60;
 const configured=product.options.sheets.length?product.options.sheets:ALBUM_SHEET_OPTIONS;
 return configured.filter(label=>ALBUM_SHEET_OPTIONS.includes(label)&&Number.parseInt(label,10)<=max);
}
