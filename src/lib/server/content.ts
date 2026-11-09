import 'server-only';
import {defaultSiteContent, parseSiteContent, parseAdminSiteContent, type SiteContent, type AdminSiteContent} from '@/lib/site-content';
import {databaseConfigured, getDatabase} from './db';

async function readStoredContent() {
  if (!databaseConfigured()) return {};
  const result = await getDatabase().query("SELECT data FROM zangraf_settings WHERE key='site'");
  return result.rows[0]?.data ?? {};
}
export async function getSiteContent(): Promise<SiteContent> {
  return parseSiteContent({...defaultSiteContent, ...await readStoredContent()});
}
export async function getAdminSiteContent(): Promise<AdminSiteContent> {
  return parseAdminSiteContent({...defaultSiteContent, productionEmail:'', ...await readStoredContent()});
}
