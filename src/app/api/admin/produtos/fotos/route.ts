import {put} from '@vercel/blob';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {requireAdmin, AdminError, adminError, adminResponse} from '@/lib/server/admin-access';

export const runtime = 'nodejs';
const LIMIT = 3 * 1024 * 1024;
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new AdminError('Conecte o armazenamento de imagens para enviar fotos. Você ainda pode usar os links existentes.', 503);
    if (!request.body) throw new AdminError('Selecione uma foto.', 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > LIMIT) { await reader.cancel(); throw new AdminError('A foto preparada deve ter até 3 MB.', 413); }
      chunks.push(value);
    }
    let image: Buffer;
    try {
      image = await sharp(Buffer.concat(chunks), {limitInputPixels: 40_000_000}).rotate().resize({width:2000,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
    } catch { throw new AdminError('Imagem inválida. Selecione uma foto JPG, PNG ou WebP.', 400); }
    const id = randomUUID();
    await put(`catalogo-publico/${id}.webp`, image, {access:'private',addRandomSuffix:false,contentType:'image/webp'});
    return adminResponse({url:`/api/catalogo/fotos/${id}`});
  } catch (error) { return adminError(error); }
}
