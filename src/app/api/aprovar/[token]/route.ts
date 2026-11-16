import {RequestError, requestError, jsonPrivate, readBody} from '@/lib/server/customer-access';
import {clientAction} from '@/lib/server/approvals';
import {databaseConfigured} from '@/lib/server/db';

export const runtime = 'nodejs';

/** Cliente final (sem conta): comenta uma lâmina ou aprova o álbum. Quem tem o link pode agir. */
export async function POST(request: Request, context: {params: Promise<{token: string}>}) {
  try {
    if (!databaseConfigured() || !process.env.BETTER_AUTH_URL) throw new RequestError('A aprovação online está indisponível no momento.', 503);
    if (request.headers.get('origin') !== new URL(process.env.BETTER_AUTH_URL).origin) throw new RequestError('Origem não autorizada.', 403);
    const {token} = await context.params;
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new RequestError('Este link não está mais disponível.', 404);
    return jsonPrivate({approval: await clientAction(token, await readBody(request))});
  } catch (error) { return requestError(error); }
}
