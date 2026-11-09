import {readdir, readFile} from 'node:fs/promises';
import {betterAuth} from 'better-auth';
import {getMigrations} from 'better-auth/db/migration';
import {Pool} from 'pg';

// Executado somente pelo processo de implantação, nunca em uma rota pública.
async function prepare() {
  if (!process.env.DATABASE_URL) {
    console.log('Banco não configurado; preparação ignorada.');
    return;
  }
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32 || !process.env.BETTER_AUTH_URL) throw new Error('Configuração de autenticação incompleta.');
  const connectionString=process.env.DATABASE_URL_UNPOOLED||process.env.POSTGRES_URL_NON_POOLING||process.env.DATABASE_URL;
  const pool = new Pool({connectionString,max:4,connectionTimeoutMillis:15_000});
  const client = await pool.connect();
  let locked = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('zangraf-schema-preparation'))");
    locked = true;
    const options = {
      appName:'Zangraf', database:pool, secret:process.env.BETTER_AUTH_SECRET, baseURL:process.env.BETTER_AUTH_URL,
      emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128},
      rateLimit:{enabled:true,storage:'database'}, logger:{disabled:true},
    };
    const migration = await getMigrations(options);
    if (migration.schemaProblems.length) throw new Error('Há conflitos na estrutura da autenticação. Revise as migrações antes de continuar.');
    await migration.runMigrations();
    for (const filename of (await readdir(new URL('../database/',import.meta.url))).filter(name=>/^\d+.*\.sql$/.test(name)).sort()) {
      await client.query(await readFile(new URL('../database/'+filename,import.meta.url),'utf8'));
    }
    // A marcação impede que produtos excluídos voltem em futuras publicações.
    await client.query('BEGIN');
    try {
      const seed=await client.query("SELECT key FROM zangraf_settings WHERE key='catalog-real-photos-v1'");
      if(!seed.rowCount){
        const products=JSON.parse(await readFile(new URL('../src/lib/catalogo-real.json',import.meta.url),'utf8'));
        for(const product of products){
          await client.query('INSERT INTO zangraf_products(id,data,demonstrative) VALUES($1,$2,false) ON CONFLICT(id) DO NOTHING',[product.id,JSON.stringify(product)]);
        }
        await client.query("UPDATE zangraf_products SET active=false,updated_at=now() WHERE id=ANY($1::text[]) AND data->>'isDemo'='true' AND data->>'name'=ANY($2::text[])",[['essencial','memoria','atemporal','estojo-linho','estojo-memoria','luvas-algodao','mini-album'],['Essencial','Memória','Atemporal','Estojo em linho','Caixa de memórias','Luvas de cuidado','Mini álbum']]);
        await client.query("INSERT INTO zangraf_settings(key,data) VALUES('catalog-real-photos-v1','{}') ON CONFLICT DO NOTHING");
        console.log('Catálogo real importado com as opções de lâminas de cada produto.');
      }
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    console.log('Estrutura de autenticação e administração preparada.');
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (Boolean(email) !== Boolean(password)) throw new Error('Forneça as duas variáveis transitórias do primeiro administrador.');
    if (!email || !password) return;
    if (password.length < 12 || password.length > 128 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Dados iniciais de administração inválidos.');
    await client.query('BEGIN');
    try {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('zangraf-admin-membership'))");
      const count = await client.query('SELECT COUNT(*)::int AS count FROM zangraf_admins');
      if (count.rows[0].count > 0) {
        await client.query('COMMIT');
        console.log('Administração já possui um responsável. Inicialização ignorada.');
        return;
      }
      const existing = await client.query('SELECT id FROM "user" WHERE lower(email)=$1',[email]);
      if (existing.rowCount) throw new Error('A conta inicial já existe. Nenhum acesso foi concedido automaticamente; use o procedimento de bootstrap com identificação da conta.');
      const auth = betterAuth(options);
      const result = await auth.api.signUpEmail({body:{name:'Administração Zangraf',email,password}});
      const created = await client.query('SELECT id FROM "user" WHERE id=$1 AND lower(email)=$2',[result.user.id,email]);
      if (created.rowCount !== 1) throw new Error('A conta inicial não pôde ser confirmada.');
      await client.query('UPDATE "user" SET "emailVerified"=true,"updatedAt"=now() WHERE id=$1',[result.user.id]);
      await client.query('INSERT INTO zangraf_admins(user_id) VALUES($1)',[result.user.id]);
      await client.query("INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,'bootstrap-admin',$1)",[result.user.id]);
      await client.query('DELETE FROM session WHERE "userId"=$1',[result.user.id]);
      await client.query('COMMIT');
      console.log('Primeiro administrador criado e autorizado. Remova as variáveis transitórias de inicialização.');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally {
    try {
      await client.query('ROLLBACK');
      if (locked) await client.query("SELECT pg_advisory_unlock(hashtext('zangraf-schema-preparation'))");
    }finally{client.release();await pool.end();}
  }
}
try { await prepare(); } catch (error) {
  // O erro do driver pode conter dados de conexão. Não o envie aos logs de implantação.
  const safe = [
    'Configuração de autenticação incompleta.',
    'Há conflitos na estrutura da autenticação. Revise as migrações antes de continuar.',
    'Forneça as duas variáveis transitórias do primeiro administrador.',
    'Dados iniciais de administração inválidos.',
    'A conta inicial já existe. Nenhum acesso foi concedido automaticamente; use o procedimento de bootstrap com identificação da conta.',
    'A conta inicial não pôde ser confirmada.',
  ];
  console.error(safe.includes(error?.message)?error.message:'Falha ao preparar o banco. Confira a conexão e as migrações.');
  process.exitCode=1;
}
