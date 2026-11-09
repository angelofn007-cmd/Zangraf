import {normalizeProduct} from '@/lib/products';
import {getDatabase} from '@/lib/server/db';
import {parseProduct} from '@/lib/product-validation';
import {AdminError, adminError, adminResponse, readAdminBody, requireAdmin} from '@/lib/server/admin-access';

export async function GET() {
  try {
    await requireAdmin();
    const result = await getDatabase().query('SELECT data,active,updated_at FROM zangraf_products ORDER BY created_at DESC');
    return adminResponse({products: result.rows.map(row => ({...normalizeProduct(row.data), active: row.active, updatedAt: row.updated_at}))});
  } catch (error) { return adminError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readAdminBody(request);
    let product;
    try { product = parseProduct(body); } catch (error) { throw new AdminError((error as Error).message, 400); }
    if (typeof body.active !== 'boolean') throw new AdminError('Informe se o produto está ativo.', 400);
    const client = await getDatabase().connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO zangraf_products(id,data,active,demonstrative) VALUES($1,$2::jsonb,$3,$4) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,active=EXCLUDED.active,demonstrative=EXCLUDED.demonstrative,updated_at=now()', [product.id, JSON.stringify(product), body.active, product.isDemo === true]);
      await client.query("INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,'save-product',$2)", [session.user.id, product.id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return adminResponse({product: {...product, active: body.active}});
  } catch (error) { return adminError(error); }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAdmin(request);
    const {id} = await readAdminBody(request);
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new AdminError('Produto inválido.', 400);
    const client = await getDatabase().connect();
    try {
      await client.query('BEGIN');
      const product = await client.query('SELECT id FROM zangraf_products WHERE id=$1 FOR UPDATE', [id]);
      if (!product.rowCount) throw new AdminError('Produto não encontrado.', 404);
      const references = await client.query('SELECT 1 FROM zangraf_projects WHERE product_id=$1 UNION ALL SELECT 1 FROM zangraf_orders WHERE items @> $2::jsonb OR items @> $3::jsonb LIMIT 1', [id, JSON.stringify([{productId:id}]), JSON.stringify([{product:{id}}])]);
      if (references.rowCount) throw new AdminError('Este produto está vinculado a um projeto ou pedido. Desative-o para preservar o histórico.', 409);
      await client.query('DELETE FROM zangraf_products WHERE id=$1', [id]);
      await client.query("INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,'delete-product',$2)", [session.user.id, id]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return adminResponse({deleted: true});
  } catch (error) { return adminError(error); }
}
