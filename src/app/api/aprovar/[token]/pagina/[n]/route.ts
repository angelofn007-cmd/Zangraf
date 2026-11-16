import {publicApprovalImage} from '@/lib/server/approvals';
import {databaseConfigured} from '@/lib/server/db';

export const runtime = 'nodejs';

/** Cliente final: imagem de prévia de uma lâmina. */
export async function GET(_request: Request, context: {params: Promise<{token: string; n: string}>}) {
  const {token, n} = await context.params;
  const stream = databaseConfigured() && /^\d{1,3}$/.test(n) ? await publicApprovalImage(token, Number(n)).catch(() => null) : null;
  if (!stream) return new Response('Prévia indisponível.', {status: 404, headers: {'Cache-Control': 'no-store'}});
  return new Response(stream, {headers: {'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex'}});
}
