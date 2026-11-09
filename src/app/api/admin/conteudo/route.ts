import {getAdminSiteContent} from '@/lib/server/content';
import {getDatabase} from '@/lib/server/db';
import {parseAdminSiteContent} from '@/lib/site-content';
import {AdminError, adminError, adminResponse, readAdminBody, requireAdmin} from '@/lib/server/admin-access';
export async function GET() {
  try { await requireAdmin(); return adminResponse({content: await getAdminSiteContent()}); }
  catch (error) { return adminError(error); }
}
export async function PUT(request: Request) {
  try {
    const session = await requireAdmin(request);
    const body = await readAdminBody(request);
    let content;
    try { content = parseAdminSiteContent(body); } catch (error) { throw new AdminError((error as Error).message, 400); }
    await getDatabase().query("INSERT INTO zangraf_settings(key,data,updated_by) VALUES('site',$1::jsonb,$2) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=now()", [JSON.stringify(content),session.user.id]);
    return adminResponse({content});
  } catch (error) { return adminError(error); }
}
