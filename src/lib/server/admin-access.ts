import 'server-only';
import {authenticationConfigured, getSession, isAdmin} from './auth';

export class AdminError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function requireAdmin(request?: Request) {
  if (!authenticationConfigured()) throw new AdminError('Administração indisponível. A conexão segura ainda está sendo preparada.', 503);
  if (request && !['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(process.env.BETTER_AUTH_URL!).origin) throw new AdminError('Origem não autorizada.', 403);
  }
  const session = await getSession();
  if (!session) throw new AdminError('Entre na sua conta para continuar.', 401);
  if (!await isAdmin(session.user.id)) throw new AdminError('Acesso reservado à equipe autorizada.', 403);
  return session;
}

export function adminResponse(data: unknown, status = 200) {
  return Response.json(data, {status, headers: {'Cache-Control': 'private, no-store'}});
}

export function adminError(error: unknown) {
  return adminResponse({message: error instanceof AdminError ? error.message : 'Não foi possível acessar a administração. Tente novamente em instantes.'}, error instanceof AdminError ? error.status : 503);
}

export async function readAdminBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 32_000) throw new AdminError('Conteúdo muito grande.', 413);
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new AdminError('Conteúdo inválido. Confira os campos.', 400); }
}
