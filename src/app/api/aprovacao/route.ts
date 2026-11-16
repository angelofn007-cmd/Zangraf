import {requireCustomer, RequestError, requestError, jsonPrivate, readBody} from '@/lib/server/customer-access';
import {deleteApproval, ownerApproval, startApprovalVersion} from '@/lib/server/approvals';

export const runtime = 'nodejs';

/** Fotógrafo: status, link e comentários da aprovação de um projeto. */
export async function GET(request: Request) {
  try {
    const session = await requireCustomer(request);
    const projectId = new URL(request.url).searchParams.get('projeto') || '';
    if (!projectId || projectId.length > 80) throw new RequestError('Projeto inválido.', 400);
    return jsonPrivate({approval: await ownerApproval(session.user.id, projectId)});
  } catch (error) { return requestError(error); }
}

/** Fotógrafo: começa uma versão nova (cria o link na primeira vez). */
export async function POST(request: Request) {
  try {
    const session = await requireCustomer(request);
    return jsonPrivate(await startApprovalVersion(session.user.id, await readBody(request)));
  } catch (error) { return requestError(error); }
}

/** Fotógrafo: encerra o link e apaga as prévias. */
export async function DELETE(request: Request) {
  try {
    const session = await requireCustomer(request);
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new RequestError('Aprovação inválida.', 400);
    await deleteApproval(session.user.id, id);
    return jsonPrivate({deleted: true});
  } catch (error) { return requestError(error); }
}
