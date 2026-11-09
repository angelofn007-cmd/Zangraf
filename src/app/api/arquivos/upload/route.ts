import {handleUpload, type HandleUploadBody} from '@vercel/blob/client';
import {getDatabase} from '@/lib/server/db';
import {requireCustomer, RequestError, requestError, jsonPrivate, readBody} from '@/lib/server/customer-access';

export const runtime = 'nodejs';
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const STORE_BUDGET_BYTES = 700 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const body = await readBody(request);
    if (!['blob.generate-client-token', 'blob.upload-completed'].includes(String(body.type))) throw new RequestError('Solicitação de arquivo inválida.', 400);
    const result = await handleUpload({
      request,
      body: body as unknown as HandleUploadBody,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await requireCustomer(request);
        let payload: {fileId?: unknown; size?: unknown};
        try { payload = JSON.parse(clientPayload || '{}'); } catch { throw new RequestError('Arquivo inválido.', 400); }
        if (!payload || typeof payload.fileId !== 'string' || !Number.isInteger(payload.size) || Number(payload.size) < 1 || Number(payload.size) > MAX_FILE_BYTES) throw new RequestError('Cada JPG pode ter até 12 MB.', 400);
        const client = await getDatabase().connect();
        try {
          await client.query('BEGIN');
          await client.query("SELECT pg_advisory_xact_lock(hashtext('zangraf-file-budget'))");
          const found = await client.query('SELECT f.*,o.status FROM zangraf_order_files f JOIN zangraf_orders o ON o.id=f.order_id WHERE f.id::text=$1 AND o.user_id=$2 FOR UPDATE OF f,o', [payload.fileId, session.user.id]);
          const file = found.rows[0];
          if (!file || file.pathname !== pathname) throw new RequestError('Arquivo não autorizado.', 404);
          if (file.status !== 'draft' || file.verified) throw new RequestError('Este arquivo já foi enviado ou o pedido está fechado.', 409);
          const reservation = Math.max(Number(file.max_bytes), Number(payload.size));
          const used = await client.query('SELECT COALESCE(sum(max_bytes),0)::text AS bytes FROM zangraf_order_files');
          if (Number(used.rows[0].bytes) - Number(file.max_bytes) + reservation > STORE_BUDGET_BYTES) throw new RequestError('O espaço inicial para arquivos foi preenchido. Entre em contato com a Zangraf; seu álbum continua salvo neste navegador.', 507);
          const validUntil = Date.now() + 10 * 60_000;
          await client.query('UPDATE zangraf_order_files SET max_bytes=$1,token_expires_at=$2 WHERE id=$3', [reservation, new Date(validUntil), file.id]);
          await client.query('COMMIT');
          return {allowedContentTypes: ['image/jpeg'], maximumSizeInBytes: Number(payload.size), validUntil, addRandomSuffix: false, allowOverwrite: false, tokenPayload: file.id};
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      // The SDK authenticates this callback before invoking it.
      onUploadCompleted: async ({blob, tokenPayload}) => {
        if (!tokenPayload) return;
        await getDatabase().query('UPDATE zangraf_order_files SET uploaded=true WHERE id::text=$1 AND pathname=$2', [tokenPayload, blob.pathname]);
      },
    });
    return jsonPrivate(result);
  } catch (error) { return requestError(error); }
}
