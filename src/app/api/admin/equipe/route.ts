import {getDatabase} from '@/lib/server/db';
import {AdminError, adminError, adminResponse, readAdminBody, requireAdmin} from '@/lib/server/admin-access';
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0,200);
    const result = await getDatabase().query('SELECT u.id,u.name,u.email,u."createdAt" AS created_at,(a.user_id IS NOT NULL) AS admin FROM "user" u LEFT JOIN zangraf_admins a ON a.user_id=u.id WHERE ($1 = \'\' OR strpos(lower(u.name),lower($1)) > 0 OR strpos(lower(u.email),lower($1)) > 0) ORDER BY (a.user_id IS NOT NULL) DESC,u."createdAt" DESC LIMIT 500', [query]);
    return adminResponse({users:result.rows});
  } catch (error) { return adminError(error); }
}
export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readAdminBody(request);
    if (typeof body.userId !== 'string' || body.userId.length > 128 || typeof body.admin !== 'boolean') throw new AdminError('Autorização inválida.', 400);
    if (body.userId === session.user.id && !body.admin) throw new AdminError('Você não pode remover seu próprio acesso. Outro administrador pode fazer isso.', 409);
    const client = await getDatabase().connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('zangraf-admin-membership'))");
      // Recheck after the membership lock, so a revoked session cannot race a grant.
      const acting = await client.query('SELECT user_id FROM zangraf_admins WHERE user_id=$1', [session.user.id]);
      if (!acting.rowCount) throw new AdminError('Seu acesso administrativo foi removido.',403);
      const user = await client.query('SELECT id FROM "user" WHERE id=$1', [body.userId]);
      if (!user.rowCount) throw new AdminError('Conta não encontrada. O novo perfil precisa se cadastrar primeiro.',404);
      if (body.admin) await client.query('INSERT INTO zangraf_admins(user_id,granted_by) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',[body.userId,session.user.id]);
      else await client.query('DELETE FROM zangraf_admins WHERE user_id=$1',[body.userId]);
      await client.query('INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,$2,$3)',[session.user.id,body.admin?'grant-admin':'revoke-admin',body.userId]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    return adminResponse({saved:true});
  } catch (error) { return adminError(error); }
}
