import Link from 'next/link';
import { Mail, ShieldCheck, UserRound } from 'lucide-react';
import { authenticationConfigured, getSession } from '@/lib/server/auth';
import { SignOut } from '@/components/login';

export const metadata = { title: 'Meus dados' };
export default async function Page() {
  const session = authenticationConfigured() ? await getSession() : null;
  if (!session) return <div className="ca-empty">
    <span className="ca-avatar is-empty" aria-hidden="true"><UserRound size={34} strokeWidth={1.5} /></span>
    <h2>Nenhuma conta conectada</h2>
    <p>Entre para ver seus dados.</p>
    <Link className="ca-button" href="/entrar">Entrar</Link>
  </div>;
  const initials = session.user.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  return <div className="ca-profile">
    <span className="ca-avatar" aria-hidden="true">{initials}</span>
    <div className="ca-profile-main">
      <h2>{session.user.name}</h2>
      <p><Mail size={15} aria-hidden="true" />{session.user.email}</p>
    </div>
    <div className="ca-profile-actions">
      <Link href="/privacidade" className="ca-link"><ShieldCheck size={16} aria-hidden="true" />Privacidade</Link>
      <span className="ca-signout"><SignOut /></span>
    </div>
  </div>;
}
