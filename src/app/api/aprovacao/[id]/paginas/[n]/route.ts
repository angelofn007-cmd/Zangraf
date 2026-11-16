import {requireCustomer, RequestError, requestError, jsonPrivate} from '@/lib/server/customer-access';
import {uploadApprovalPage} from '@/lib/server/approvals';
import {MAX_PREVIEW_BYTES} from '@/lib/approval';

export const runtime = 'nodejs';

/** Fotógrafo: envia a prévia JPG de uma lâmina (corpo da requisição = bytes do JPG). */
export async function PUT(request: Request, context: {params: Promise<{id: string; n: string}>}) {
  try {
    const session = await requireCustomer(request);
    const {id, n} = await context.params;
    if (!/^[a-f0-9-]{36}$/i.test(id) || !/^\d{1,3}$/.test(n)) throw new RequestError('Envio inválido.', 400);
    if (request.headers.get('content-type') !== 'image/jpeg') throw new RequestError('Envie a prévia em JPG.', 415);
    if (Number(request.headers.get('content-length') || 0) > MAX_PREVIEW_BYTES) throw new RequestError('Prévia muito grande.', 413);
    const bytes = Buffer.from(await request.arrayBuffer());
    await uploadApprovalPage(session.user.id, id, Number(n), bytes);
    return jsonPrivate({uploaded: true});
  } catch (error) { return requestError(error); }
}
