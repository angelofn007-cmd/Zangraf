import {getDatabase} from '@/lib/server/db';
import {AdminError, adminError, adminResponse, readAdminBody, requireAdmin} from '@/lib/server/admin-access';
import type {LayoutProject} from '@/lib/layout-projects';
import {expectedPrintFiles} from '@/lib/order-rules';
import type {Configuration,Product} from '@/lib/products';
export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readAdminBody(request);
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.status !== 'string' || !['production','shipped','cancelled'].includes(body.status)) throw new AdminError('Alteração de pedido inválida.',400);
    const client = await getDatabase().connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT status,total_cents,items FROM zangraf_orders WHERE id=$1 FOR UPDATE',[body.id]);
      if (!result.rowCount) throw new AdminError('Pedido não encontrado.',404);
      const order = result.rows[0];
      if (body.status === 'production') {
        const receipts = await client.query('SELECT COALESCE(SUM(amount_cents),0)::text AS total FROM zangraf_receipts WHERE order_id=$1',[body.id]);
        if (order.status !== 'paid' || order.total_cents === null || Number(receipts.rows[0].total) < Number(order.total_cents)) throw new AdminError('A produção só pode ser aprovada após a confirmação do recebimento integral.',409);
        const expected=order.items.reduce((total:number,item:{product:Product;configuration:Configuration;productionModel?:LayoutProject['productionModel']})=>total+expectedPrintFiles(item.product,item.configuration,item.productionModel).length,0);
        const files=await client.query('SELECT count(*)::int AS count, bool_and(verified) AS complete FROM zangraf_order_files WHERE order_id=$1',[body.id]);
        if(files.rows[0].count!==expected||(expected>0&&!files.rows[0].complete))throw new AdminError('Receba todos os arquivos do álbum antes de aprovar a produção.',409);
      }
      if (body.status === 'shipped' && order.status !== 'production') throw new AdminError('Somente pedidos em produção podem ser marcados como enviados.',409);
      if (body.status === 'cancelled') {
        if (!['draft','awaiting_payment'].includes(order.status)) throw new AdminError('Este pedido já avançou. Entre em contato com o cliente antes de ajustar a operação.',409);
        const receipts = await client.query('SELECT id FROM zangraf_receipts WHERE order_id=$1 LIMIT 1',[body.id]);
        if (receipts.rowCount) throw new AdminError('Há recebimentos vinculados. O estorno precisa ser tratado antes de cancelar.',409);
      }
      await client.query('UPDATE zangraf_orders SET status=$1,updated_at=now() WHERE id=$2',[body.status,body.id]);
      await client.query('INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,$2,$3)',[session.user.id,'order-'+body.status,body.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return adminResponse({saved:true});
  } catch (error) { return adminError(error); }
}
