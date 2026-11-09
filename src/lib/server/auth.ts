import 'server-only';
import {betterAuth} from 'better-auth';
import {nextCookies} from 'better-auth/next-js';
import {headers} from 'next/headers';
import {getDatabase, databaseConfigured} from './db';

export function authenticationConfigured() {
  if (!databaseConfigured() || !process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32 || !process.env.BETTER_AUTH_URL) return false;
  try { return ['http:', 'https:'].includes(new URL(process.env.BETTER_AUTH_URL).protocol); } catch { return false; }
}
function createAuth() {
  if (!authenticationConfigured()) throw new Error('Autenticação não configurada');
  return betterAuth({
    appName: 'Zangraf', database: getDatabase(), secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {enabled: true, minPasswordLength: 12, maxPasswordLength: 128},
    socialProviders: googleAuthenticationConfigured() ? {google: {
      clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: 'select_account',
    }} : {},
    rateLimit: {enabled: true, storage: 'database'},
    plugins: [nextCookies()],
  });
}
export function googleAuthenticationConfigured() {
  return authenticationConfigured() && Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
export async function getSession() { return authenticationConfigured() ? getAuth().api.getSession({headers: await headers()}) : null; }
export async function isAdmin(userId: string) {
  const result = await getDatabase().query('SELECT user_id FROM zangraf_admins WHERE user_id=$1', [userId]);
  return result.rowCount === 1;
}
