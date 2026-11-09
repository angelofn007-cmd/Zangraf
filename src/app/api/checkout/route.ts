import {usesAlbumLayout} from '@/lib/products';
import {productPrice} from '@/lib/pricing';
import {parsePrintModel,snapshotModel} from '@/lib/diagrammer-models';
import type {LayoutProject} from '@/lib/layout-projects';
import {randomUUID,createHash} from 'node:crypto';
import {getDatabase} from '@/lib/server/db';
import {requireCustomer,RequestError,requestError,jsonPrivate,readBody} from '@/lib/server/customer-access';
import {parseProduct} from '@/lib/product-validation';
import {canonicalSelection,expectedPrintFiles} from '@/lib/order-rules';
export async function POST(request:Request){
 try{
  const session=await requireCustomer(request);const body=await readBody(request);
  if(typeof body.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(body.requestKey)||!Array.isArray(body.items)||!body.items.length||body.items.length>10)throw new RequestError('Confira os itens do pedido.',400);
  if(typeof body.phone!=='string'||!/^\+?[\d ()-]{10,22}$/.test(body.phone))throw new RequestError('Informe um telefone válido para combinar a entrega.',400);
  if(typeof body.notes!=='string'||body.notes.length>1000)throw new RequestError('Observações inválidas.',400);
  const fingerprint=createHash('sha256').update(JSON.stringify({items:body.items,phone:body.phone,notes:body.notes})).digest('hex');
  const client=await getDatabase().connect();
  try{
   await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[session.user.id]);
   const existing=await client.query('SELECT id,status,shipping_address FROM zangraf_orders WHERE user_id=$1 AND request_key=$2',[session.user.id,body.requestKey]);
   if(existing.rowCount){if(existing.rows[0].shipping_address?.requestFingerprint!==fingerprint)throw new RequestError('Este pedido foi alterado. Volte à revisão para iniciar um novo envio.',409);const files=await client.query('SELECT id,item_key,filename,pathname,verified,width_px,height_px,dpi FROM zangraf_order_files WHERE order_id=$1 ORDER BY item_key,filename',[existing.rows[0].id]);await client.query('COMMIT');return jsonPrivate({orderId:existing.rows[0].id,status:existing.rows[0].status,files:files.rows});}
   const recent=await client.query("SELECT count(*)::int AS count FROM zangraf_orders WHERE user_id=$1 AND created_at>now()-interval '1 hour'",[session.user.id]);
   if(recent.rows[0].count>=6)throw new RequestError('Você já enviou vários pedidos. Aguarde um pouco para enviar outro.',429);
   const items=[];const files=[];let subtotal=0;const itemKeys=new Set();
   for(const raw of body.items){
    if(!raw||typeof raw!=='object')throw new RequestError('Item inválido.',400);const item=raw as Record<string,unknown>;
    if(typeof item.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.id)||itemKeys.has(item.id)||typeof item.productId!=='string'||!Number.isInteger(item.quantity)||Number(item.quantity)<1||Number(item.quantity)>99)throw new RequestError('Quantidade ou identificação de item inválida.',400);
    itemKeys.add(item.id);const found=await client.query('SELECT data FROM zangraf_products WHERE id=$1 AND active=true',[item.productId]);
    if(!found.rowCount)throw new RequestError('Um produto não está mais disponível.',409);const product=parseProduct(found.rows[0].data);

    const album=usesAlbumLayout(product);
    if(album&&(typeof item.layoutProjectId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.layoutProjectId)||typeof item.layoutUpdatedAt!=='string'||!Number.isFinite(Date.parse(String(item.layoutUpdatedAt)))))throw new RequestError('Salve a personalização do álbum antes de enviar.',400);
    let configuration;try{configuration=canonicalSelection(product,item.configuration);}catch(error){throw new RequestError((error as Error).message,400);}
    const unitPrice=productPrice(product,configuration);
    if(unitPrice===null)throw new RequestError('A equipe precisa publicar o preço desta combinação para liberar a venda.',409);
    if(item.priceCents!==unitPrice)throw new RequestError('O preço foi atualizado. Configure novamente o produto para conferir o valor.',409);
    let productionModel:LayoutProject['productionModel'];
    if(album&&item.printModel){
     const ref=item.printModel as Record<string,unknown>;
     if(typeof ref.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(ref.id)||typeof ref.variantId!=='string'||typeof ref.version!=='string')throw new RequestError('Modelo de impressão inválido.',400);
     const saved=await client.query('SELECT data FROM zangraf_settings WHERE key=$1',['diagrammer-model:'+ref.id]);
     if(!saved.rowCount)throw new RequestError('O modelo de impressão foi removido. Configure novamente o álbum no produto para usar as medidas atuais.',409);
     const model=parsePrintModel(saved.rows[0].data),variant=model.variants.find(v=>v.id===ref.variantId);
     if(!variant||model.productId!==product.id||model.sizeLabel!==configuration.size||model.version!==ref.version||variant.sheets!==Number.parseInt(configuration.sheets,10)||(configuration.stock&&variant.stock!==configuration.stock))throw new RequestError('As medidas oficiais mudaram. Reaplique o modelo no diagramador e revise a arte.',409);
     productionModel=snapshotModel(model,variant);
    }
    if(album&&!productionModel){const official=await client.query("SELECT key FROM zangraf_settings WHERE key LIKE 'diagrammer-model:%' AND data->>'productId'=$1 AND data->>'sizeLabel'=$2 LIMIT 1",[product.id,configuration.size]);if(official.rowCount||configuration.stock)throw new RequestError('Escolha a gramatura e a quantidade na página do produto antes de diagramar e enviar.',400);}
    let expected;try{expected=expectedPrintFiles(product,configuration,productionModel);}catch(error){throw new RequestError((error as Error).message,400);}
    files.push(...expected.map(f=>({...f,itemKey:item.id as string})));subtotal+=unitPrice*Number(item.quantity);
    items.push({id:item.id,productId:product.id,product,configuration,quantity:item.quantity,amountCents:unitPrice,...(album?{layoutProjectId:item.layoutProjectId,layoutUpdatedAt:item.layoutUpdatedAt,productionModel}:{})});
   }
   if(!Number.isSafeInteger(subtotal))throw new RequestError('O valor do pedido excede o limite.',400);
   if(files.length>150)throw new RequestError('Envie os álbuns em pedidos separados. Limite de 150 arquivos por pedido.',400);
   if(files.length&&!process.env.BLOB_READ_WRITE_TOKEN&&!process.env.BLOB_STORE_ID)throw new RequestError('O recebimento de arquivos está sendo preparado. Seu álbum continua salvo no navegador.',503);
   const id=randomUUID();await client.query("INSERT INTO zangraf_orders(id,user_id,request_key,status,items,shipping_address,subtotal_cents,total_cents) VALUES($1,$2,$3,'draft',$4,$5,$6,$6)",[id,session.user.id,body.requestKey,JSON.stringify(items),JSON.stringify({phone:body.phone,notes:body.notes,requestFingerprint:fingerprint,delivery:'Entrega e eventual frete a combinar com a equipe'}),subtotal]);
   for(const file of files){const fileId=randomUUID();await client.query('INSERT INTO zangraf_order_files(id,order_id,item_key,filename,pathname,width_px,height_px,dpi) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[fileId,id,file.itemKey,file.filename,`orders/${id}/${fileId}.jpg`,file.width,file.height,file.dpi]);}
   const savedFiles=await client.query('SELECT id,item_key,filename,pathname,verified,width_px,height_px,dpi FROM zangraf_order_files WHERE order_id=$1 ORDER BY item_key,filename',[id]);
   await client.query('COMMIT');return jsonPrivate({orderId:id,status:'draft',files:savedFiles.rows},201);
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){return requestError(error);}
}
