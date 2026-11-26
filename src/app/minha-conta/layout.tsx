import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authenticationConfigured, getSession } from '@/lib/server/auth';
import { AccountNavigation } from '@/components/account-navigation';
import './customer.css';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await connection();
  const enabled = authenticationConfigured();
  const session = enabled ? await getSession() : null;
  if (enabled && !session) redirect('/entrar');
  const firstName = session?.user.name?.trim().split(/\s+/)[0];
  return <section className="section customer-area">
    <header className="ca-hero">
      <span className="ca-camera" aria-hidden="true">
        <svg viewBox="0 0 64 48" width="64" height="48">
          <rect x="2" y="10" width="60" height="36" rx="8" className="ca-camera-body" />
          <path d="M20 10l5-7h14l5 7" className="ca-camera-top" />
          <circle cx="32" cy="28" r="12" className="ca-camera-ring" />
          <circle cx="32" cy="28" r="6.5" className="ca-camera-lens" />
          <circle cx="51" cy="18" r="2.5" className="ca-camera-dot" />
        </svg>
        <i className="ca-flash" />
      </span>
      <div>
        <h1>{firstName ? <>Olá, <em>{firstName}</em></> : <>Minha <em>conta</em></>}</h1>
        <span className="ca-rays" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      </div>
      {!enabled && <span className="ca-demo">Demonstração</span>}
    </header>
    <AccountNavigation />
    <div className="ca-content">{children}</div>
  </section>;
}
