import Link from 'next/link';
import { authenticationConfigured, getSession } from '@/lib/server/auth';
import { UserRound } from 'lucide-react';

export const metadata = { title: 'Meus dados' };
export default async function Page() {
  const session = authenticationConfigured() ? await getSession() : null;
  return <>
    <div className="customer-section-heading"><h2>Meus dados</h2><p>Informações do seu cadastro na Zangraf.</p></div>
    {session ? <div className="customer-profile">
      <div className="customer-profile-title"><span className="customer-nav-icon"><UserRound size={23} aria-hidden="true" /></span><h3>Dados da conta</h3></div>
      <dl><div><dt>Nome</dt><dd>{session.user.name}</dd></div><div><dt>E-mail</dt><dd>{session.user.email}</dd></div></dl>
    </div> : <div className="empty"><h3>Nenhuma conta conectada</h3><p>Entre na sua conta para consultar seus dados.</p><Link className="button" href="/entrar">Entrar na minha conta</Link></div>}
  </>;
}
