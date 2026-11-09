import {usesAlbumLayout} from './products';
import {parseProduct} from './product-validation';
import {products, displayProductText, type Configuration, type Product} from './products';
import {ALBUM_SHEET_OPTIONS, ALBUM_STOCK_OPTIONS} from './album-options';

export type CartItem = {id: string; productId: string; configuration: Configuration; quantity: number; product?: Product; layoutProjectId?: string};
export const CART_KEY = 'zangraf-cart-v1';

export function validConfiguration(productId: string, value: Configuration, snapshot?: Product) {
 const product = snapshot || products.find(item => item.id === productId);
 if (!product || !value || typeof value !== 'object') return false;
 const sizes = product.printSizes?.length ? product.printSizes.map(size => size.label) : product.options.sizes;
 const album = usesAlbumLayout(product);
 if(value.stock !== undefined && (!album || !ALBUM_STOCK_OPTIONS.includes(value.stock))) return false;
 const lists = {size: sizes, sheets: album ? [...ALBUM_SHEET_OPTIONS, ...product.options.sheets] : product.options.sheets, cover: product.options.covers, finish: product.options.finishes};
 return (['size', 'sheets', 'cover', 'finish'] as const).every(key => typeof value[key] === 'string' && (lists[key].length ? lists[key].map(displayProductText).includes(displayProductText(value[key])) : value[key] === ''));
}

export function readCart(): CartItem[] {
 const stored = sessionStorage.getItem(CART_KEY);
 let raw: unknown;
 try {raw = JSON.parse(stored || '[]');} catch {return [];}
 if (!Array.isArray(raw)) return [];
 return raw.filter((item): item is CartItem => !!item && typeof item.id === 'string' && validSnapshot(item) && validConfiguration(item.productId, item.configuration, item.product) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 99);
}

export function writeCart(items: CartItem[]) {
 sessionStorage.setItem(CART_KEY, JSON.stringify(items));
 if (typeof window !== 'undefined') window.dispatchEvent(new Event('zangraf-cart-change'));
}

function validSnapshot(item: CartItem) {
 if (!item.product) return true;
 try {return parseProduct(item.product).id === item.productId;} catch {return false;}
}

export function addToCart(productOrId: string | Product, configuration: Configuration, options: {separate?: boolean} = {}): string {
 const product = typeof productOrId === 'string' ? products.find(item => item.id === productOrId) : parseProduct(productOrId);
 const productId = typeof productOrId === 'string' ? productOrId : productOrId.id;
 if (!product || !validConfiguration(productId, configuration, product)) throw new Error('Confira as opções escolhidas antes de continuar.');
 const cart = readCart();
 const match = !options.separate && cart.find(item => item.productId === productId && !item.layoutProjectId && (['size', 'sheets', 'cover', 'finish', 'stock'] as const).every(key => item.configuration[key] === configuration[key]));
 let id: string;
 if (match) {
  if (match.quantity >= 99) throw new Error('Você chegou ao limite de 99 unidades deste item.');
  match.quantity += 1;
  id = match.id;
 } else {
  id = crypto.randomUUID();
  cart.push({id, productId, product, configuration, quantity: 1});
 }
 writeCart(cart);
 return id;
}
