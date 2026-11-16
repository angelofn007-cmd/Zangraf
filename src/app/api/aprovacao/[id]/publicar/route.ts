import {requireCustomer, RequestError, requestError, jsonPrivate} from '@/lib/server/customer-access';
import {publishApproval} from '@/lib/server/approvals';

export const runtime = 'nodejs';

/** Fotógrafo: libera a versão enviada para o cliente ver. */
export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    const session = await requireCustomer(request);
    const {id} = await context.params;
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new RequestError('Aprovação inválida.', 400);
    await publishApproval(session.user.id, id);
    return jsonPrivate({published: true});
  } catch (error) { return requestError(error); }
}
