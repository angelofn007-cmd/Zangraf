import {get} from '@vercel/blob';
import sharp from 'sharp';
import {getDatabase} from '@/lib/server/db';
import {requireCustomer, RequestError, requestError, jsonPrivate, readBody} from '@/lib/server/customer-access';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const session = await requireCustomer(request);
    const body = await readBody(request);
    if (typeof body.fileId !== 'string') throw new RequestError('Arquivo inválido.', 400);
    const found = await getDatabase().query('SELECT f.*,o.status FROM zangraf_order_files f JOIN zangraf_orders o ON o.id=f.order_id WHERE f.id::text=$1 AND o.user_id=$2', [body.fileId, session.user.id]);
    const file = found.rows[0];
    if (!file) throw new RequestError('Arquivo não encontrado.', 404);
    if (file.verified) return jsonPrivate({verified: true});
    if (file.status !== 'draft') throw new RequestError('O pedido já foi fechado.', 409);
    const object = await get(file.pathname, {access: 'private', useCache: false});
    if (!object || object.statusCode !== 200) throw new RequestError('O JPG ainda não chegou. Tente retomar o envio.', 409);
    if (object.blob.size > Number(file.max_bytes) || object.blob.size > 12 * 1024 * 1024 || object.blob.contentType !== 'image/jpeg') {
      await object.stream.cancel();
      throw new RequestError('O arquivo não corresponde ao JPG autorizado.', 400);
    }
    const reader = object.stream.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.length;
        if (length > Number(file.max_bytes) || length > 12 * 1024 * 1024) throw new RequestError('O JPG ultrapassa o limite de tamanho.', 400);
        chunks.push(part.value);
      }
    } finally { await reader.cancel(); }
    let metadata;
    try { metadata = await sharp(Buffer.concat(chunks), {limitInputPixels: 100_000_000}).metadata(); }
    catch { throw new RequestError('Não foi possível ler este JPG. Exporte o álbum novamente.', 400); }
    if (metadata.format !== 'jpeg' || metadata.width !== file.width_px || metadata.height !== file.height_px || metadata.density !== file.dpi || (metadata.orientation && metadata.orientation !== 1)) throw new RequestError('As medidas ou a resolução do JPG não correspondem ao modelo contratado. Reabra o diagramador e confira o formato.', 400);
    const updated = await getDatabase().query("UPDATE zangraf_order_files f SET verified=true,uploaded=true,size_bytes=$1 FROM zangraf_orders o WHERE f.id=$2 AND o.id=f.order_id AND o.user_id=$3 AND o.status='draft' RETURNING f.id", [length, file.id, session.user.id]);
    if (!updated.rowCount) throw new RequestError('O pedido foi alterado durante o envio. Consulte seus pedidos.', 409);
    return jsonPrivate({verified: true});
  } catch (error) { return requestError(error); }
}
