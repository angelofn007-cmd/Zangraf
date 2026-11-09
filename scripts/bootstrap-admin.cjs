const fs = require('node:fs');
const {Pool} = require('pg');
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const email = process.env.ZANGRAF_ADMIN_EMAIL?.trim().toLowerCase();
const expectedId = process.env.ZANGRAF_ADMIN_USER_ID?.trim();
if (!process.env.DATABASE_URL || !email || !expectedId) throw new Error('Defina DATABASE_URL, ZANGRAF_ADMIN_EMAIL e ZANGRAF_ADMIN_USER_ID para uma conta já criada e identificada.');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
(async () => {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('zangraf-admin-membership'))");
  const count = await client.query('SELECT COUNT(*)::int AS count FROM zangraf_admins');
  if (count.rows[0].count !== 0) throw new Error('Já existe um administrador. Novas autorizações devem ser realizadas no painel.');
  const user = await client.query('SELECT id FROM "user" WHERE lower(email)=$1 AND id=$2', [email, expectedId]);
  if (user.rowCount !== 1) throw new Error('A conta não corresponde ao e-mail e identificador informados.');
  await client.query('INSERT INTO zangraf_admins(user_id) VALUES($1)', [expectedId]);
  await client.query("INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,'bootstrap-admin',$1)", [expectedId]);
  await client.query('COMMIT');
  console.log('Primeiro administrador autorizado. Entre no site para acessar /admin.');
 } catch (error) {
  await client.query('ROLLBACK');
  console.error(error.message);
  process.exitCode = 1;
 } finally { client.release(); await pool.end(); }
})();
