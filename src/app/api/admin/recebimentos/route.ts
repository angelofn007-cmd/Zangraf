import {getDatabase} from '@/lib/server/db';
import {AdminError, adminError, adminResponse, readAdminBody, requireAdmin} from '@/lib/server/admin-access';
export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readAdminBody(request);
    if (typeof body.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.orderId)) throw new AdminError('Selecione um pedido válido.',400);
    if (typeof body.amountCents !== 'number' || !Number.isSafeInteger(body.amountCents) || body.amountCents <= 0 || body.amountCents > 100_000_000) throw new AdminError('Valor inválido.',400);
    if (typeof body.method !== 'string' || !['pix','transfer','card','cash','other'].includes(body.method)) throw new AdminError('Forma de recebimento inválida.',400);
    if (typeof body.reference !== 'string' || body.reference.trim().length < 3 || body.reference.length > 160) throw new AdminError('Informe uma referência única do comprovante.',400);
    const paidAt = typeof body.paidAt === 'string' ? new Date(body.paidAt) : new Date(NaN);
    if (!Number.isFinite(paidAt.getTime()) || paidAt.getTime() > Date.now() || paidAt.getUTCFullYear() < 2000) throw new AdminError('Informe a data em que o valor foi recebido.',400);
    const client = await getDatabase().connect();
    try {
      await client.query('BEGIN');
      const order = await client.query('SELECT total_cents,status FROM zangraf_orders WHERE id=$1 FOR UPDATE',[body.orderId]);
      if (!order.rowCount) throw new AdminError('Pedido não encontrado.',404);
      if (!['awaiting_payment','paid','production','shipped'].includes(order.rows[0].status) || order.rows[0].total_cents === null) throw new AdminError('Este pedido não pode receber um pagamento.',409);
      const amount = await client.query('SELECT COALESCE(SUM(amount_cents),0)::text AS total FROM zangraf_receipts WHERE order_id=$1',[body.orderId]);
      const received = Number(amount.rows[0].total);
      const total = Number(order.rows[0].total_cents);
      if (received + body.amountCents > total) throw new AdminError('O valor supera o saldo do pedido. Confira os recebimentos já registrados.',409);
      const duplicate = await client.query('SELECT id FROM zangraf_receipts WHERE reference=$1',[body.reference.trim()]);
      if (duplicate.rowCount) throw new AdminError('Este comprovante já foi registrado.',409);
      await client.query('INSERT INTO zangraf_receipts(id,order_id,amount_cents,method,reference,paid_at,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),body.orderId,body.amountCents,body.method,body.reference.trim(),paidAt.toISOString(),session.user.id]);
      if (received + body.amountCents === total && order.rows[0].status === 'awaiting_payment') await client.query("UPDATE zangraf_orders SET status='paid',updated_at=now() WHERE id=$1",[body.orderId]);
      await client.query("INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,'record-receipt',$2)",[session.user.id,body.orderId]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); if ((error as {code?:string}).code === '23505') throw new AdminError('Este comprovante já foi registrado.',409); throw error; } finally { client.release(); }
    return adminResponse({saved:true},201);
  } catch (error) { return adminError(error); }
}
