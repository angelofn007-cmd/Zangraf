import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { authenticationConfigured, getSession } from '@/lib/server/auth';
import { SignOut } from '@/components/login';
import { AccountNavigation } from '@/components/account-navigation';
import './customer.css';

export default async function Layout({ children }: { children: React.ReactNode }) {
  await connection();
  const enabled = authenticationConfigured();
  const session = enabled ? await getSession() : null;
  if (enabled && !session) redirect('/entrar');
  return <section className="section customer-area">
    <header className="customer-header">
      <div><span className="eyebrow">ÁREA DO CLIENTE{!enabled ? ' · DEMONSTRAÇÃO' : ''}</span>
        <h1>{session ? `Olá, ${session.user.name}.` : 'Seu espaço de histórias.'}</h1>
        <p>Seus projetos, pedidos e dados. Tudo em um só lugar.</p>
      </div>
      {session && <div className="customer-signout"><SignOut /></div>}
    </header>
    {!enabled && <p className="demo-notice">Prévia visual. Você não está conectado a uma conta real.</p>}
    <AccountNavigation />
    <div className="customer-content">{children}</div>
  </section>;
}
