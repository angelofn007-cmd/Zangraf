'use client';
import {usesAlbumLayout, products} from '@/lib/products';
import {upload} from '@vercel/blob/client';
import {readCart, writeCart, type CartItem} from '@/lib/cart';
import {productPrice} from '@/lib/pricing';
import {loadProject, type LayoutProject} from '@/lib/layout-projects';
import {coverPageIndices} from '@/lib/cover-production';
import {expectedPrintFiles} from '@/lib/order-rules';
import {printWarnings, renderPrintJpeg} from './diagrammer-export';

export type PaymentMethod = 'pix' | 'card' | 'boleto';
export type OrderDelivery = {name: string; cep: string; address: string; number: string; city: string; notes: string};
type OrderFile = {id: string; item_key: string; filename: string; pathname: string; verified: boolean};
type PreparedOrder = {orderId: string; status: string; files: OrderFile[]};

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Não foi possível concluir o envio. Tente novamente.');
  return result;
}

export type SubmitResult = {status: 'warnings'; warnings: string[]} | {status: 'sent'; orderId: string};

/**
 * Envia o pedido: confere os álbuns, cria o pedido, gera e envia os JPGs de impressão
 * e confirma o envio. Pode ser chamado de novo para retomar um envio interrompido.
 * Devolve os avisos de impressão encontrados se ainda não tiverem sido aprovados.
 */
export async function submitOrder({items, phone, notes, delivery, paymentMethod, approvedWarnings, onProgress, onOrderId}: {
  items: CartItem[]; phone: string; notes: string; delivery: OrderDelivery; paymentMethod: PaymentMethod;
  /** Avisos que a pessoa já viu e aprovou. */ approvedWarnings: string[];
  onProgress: (text: string) => void; onOrderId?: (id: string) => void;
}): Promise<SubmitResult> {
  onProgress('Preparando seu pedido…');
  const snapshots = new Map<string, LayoutProject>(); const warnings: string[] = []; const requestItems = [];
  for (const item of items) {
    const product = item.product || products.find(p => p.id === item.productId);
    if (!product || productPrice(product, item.configuration) === null) throw new Error('Há produtos ilustrativos ou sem preço. A equipe precisa liberar esses modelos antes da venda.');
    const album = usesAlbumLayout(product);
    let project: LayoutProject | undefined;
    if (album) {
      if (!item.layoutProjectId) throw new Error(`Personalize ${product.name} no diagramador antes de finalizar.`);
      project = await loadProject(item.layoutProjectId);
      if (!project || project.cartItemId !== item.id || project.productId !== item.productId) throw new Error(`Reabra ${product.name} pelo carrinho para confirmar a personalização.`);
      if (JSON.stringify(project.configuration) !== JSON.stringify(item.configuration)) throw new Error(`A configuração de ${product.name} mudou. Reabra o diagramador pelo carrinho.`);
      const expected = expectedPrintFiles(product, item.configuration, project.productionModel);
      if (expected.length !== project.spreads.length * (project.productionModel?.insideMode === 'spread' ? 1 : 2) + coverPageIndices(project.productionModel?.coverMode).length) throw new Error(`Confira a quantidade de páginas de ${product.name}.`);
      const spec = product.printSizes?.find(size => size.label === item.configuration.size);
      if (!spec || !project.printSpec || (['widthMm', 'heightMm', 'bleedMm', 'dpi'] as const).some(key => spec[key] !== project!.printSpec![key])) throw new Error(`Confira o formato de ${product.name} no diagramador.`);
      warnings.push(...printWarnings(project).map(warning => `${product.name}: ${warning}`));
      snapshots.set(item.id, project);
    }
    requestItems.push({id: item.id, productId: item.productId, configuration: item.configuration, quantity: item.quantity, priceCents: productPrice(product, item.configuration), ...(project ? {layoutProjectId: project.id, layoutUpdatedAt: project.updatedAt, ...(project.productionModel ? {printModel: {id: project.productionModel.id, variantId: project.productionModel.variantId, version: project.productionModel.version}} : {})} : {})});
  }
  if (warnings.length && JSON.stringify(warnings) !== JSON.stringify(approvedWarnings)) return {status: 'warnings', warnings};

  const payload = {items: requestItems, phone, notes, delivery, paymentMethod};
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = 'zangraf-order-' + signature;
  let requestKey = sessionStorage.getItem(key);
  if (!requestKey) { requestKey = crypto.randomUUID(); sessionStorage.setItem(key, requestKey); }
  const order = await post<PreparedOrder>('/api/checkout', {...payload, requestKey});
  onOrderId?.(order.orderId);
  if (order.status === 'cancelled') throw new Error('Esse pedido foi cancelado. Entre em contato com a equipe.');
  if (order.status === 'draft') {
    for (let index = 0; index < order.files.length; index++) {
      const file = order.files[index]; if (file.verified) continue;
      const project = snapshots.get(file.item_key); if (!project) throw new Error('O projeto deste arquivo não está disponível neste navegador.');
      onProgress(`Preparando e enviando o arquivo ${index + 1} de ${order.files.length}…`);
      // Um envio anterior pode ter terminado antes de a conexão cair.
      let existing = false;
      try { await post('/api/arquivos/verificar', {fileId: file.id}); existing = true; } catch { /* segue com o envio */ }
      if (existing) continue;
      const filename = file.filename.replace(/^Capa\//, '');
      const page = /^(pagina|lamina)-(\d+)\.jpg$/.exec(filename);
      const numbered = /^(Lâminas|Páginas)\/(\d+)\.jpg$/.exec(filename);
      if (!page && !numbered && !['capa-inteira.jpg', 'capa-frente.jpg', 'capa-verso.jpg'].includes(filename)) throw new Error('A lista de arquivos do pedido está inválida.');
      const kind = ['capa-inteira.jpg', 'capa-frente.jpg'].includes(filename) ? 'cover-front' : filename === 'capa-verso.jpg' ? 'cover-back' : page?.[1] === 'lamina' || numbered?.[1] === 'Lâminas' ? 'spread' : 'page';
      const blob = await renderPrintJpeg(project, kind, page ? Number(page[2]) - 1 : numbered ? Number(numbered[2]) - 1 : 0);
      if (blob.size > 12 * 1024 * 1024) throw new Error(`${file.filename} ultrapassa 12 MB. Seu projeto está salvo. Fale com a equipe para combinar o envio deste álbum.`);
      try { await upload(file.pathname, blob, {access: 'private', handleUploadUrl: '/api/arquivos/upload', contentType: 'image/jpeg', clientPayload: JSON.stringify({fileId: file.id, size: blob.size})}); }
      catch { await post('/api/arquivos/verificar', {fileId: file.id}); continue; }
      await post('/api/arquivos/verificar', {fileId: file.id});
    }
  }
  onProgress('Confirmando o pedido…');
  await post('/api/pedidos/enviar', {orderId: order.orderId});
  try { const sent = new Set(items.map(item => item.id)); writeCart(readCart().filter(item => !sent.has(item.id))); } catch { /* o pedido recebido continua válido */ }
  return {status: 'sent', orderId: order.orderId};
}
