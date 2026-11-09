import {getDatabase} from '@/lib/server/db';
import {AdminError, adminError, adminResponse, requireAdmin} from '@/lib/server/admin-access';

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    await requireAdmin(request);
    const {id} = await context.params;
    if(!/^[0-9a-f-]{36}$/i.test(id))throw new AdminError('Pedido inválido.',400);
    const order=await getDatabase().query('SELECT items,status FROM zangraf_orders WHERE id=$1',[id]);
    if(!order.rowCount)throw new AdminError('Pedido não encontrado.',404);
    const files=await getDatabase().query('SELECT id,item_key,filename,verified,width_px,height_px,dpi FROM zangraf_order_files WHERE order_id=$1 ORDER BY item_key,filename',[id]);
    const items=Array.isArray(order.rows[0].items)?order.rows[0].items:[];
    return adminResponse({canDownload:['production','shipped'].includes(order.rows[0].status),files:files.rows.map(file=>{
      const item=items.find((entry: {id?: string})=>entry.id===file.item_key);
      return {id:file.id,itemKey:file.item_key,productName:item?.product?.name??'Álbum',filename:file.filename,verified:file.verified,
        widthCm:Number((file.width_px/file.dpi*2.54).toFixed(2)),heightCm:Number((file.height_px/file.dpi*2.54).toFixed(2))};
    })});
  }catch(error){return adminError(error);}
}
