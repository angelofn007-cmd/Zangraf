import Link from 'next/link';
import {connection} from 'next/server';
import {redirect} from 'next/navigation';
import {Admin} from '@/components/admin';
import {authenticationConfigured,getSession,isAdmin} from '@/lib/server/auth';
import {getDatabase} from '@/lib/server/db';
import {getAdminSiteContent} from '@/lib/server/content';
export const metadata={title:'Administração',robots:{index:false,follow:false}};
function Unavailable(){return <section className="section empty"><span className="eyebrow">ADMINISTRAÇÃO ZANGRAF</span><h1>Estamos preparando seu acesso.</h1><p>A área administrativa precisa de uma conexão segura para funcionar. Nenhum dado da loja está disponível nesta tela.</p><Link href="/" className="button">Voltar para o site</Link></section>}
export default async function Page(){
  await connection();
  if(!authenticationConfigured())return <Unavailable/>;
  let session;
  try {session=await getSession()} catch {return <Unavailable/>}
  if(!session)redirect('/entrar?destino=admin');
  try {
    if(!await isAdmin(session.user.id))return <section className="section empty"><span className="eyebrow">ADMINISTRAÇÃO ZANGRAF</span><h1>Acesso reservado à equipe.</h1><p>Sua conta precisa ser autorizada por um administrador da Zangraf.</p><Link href="/minha-conta" className="button">Ir para minha conta</Link></section>;
    const [catalog,content]=await Promise.all([getDatabase().query('SELECT data,active FROM zangraf_products ORDER BY created_at DESC'),getAdminSiteContent()]);
    return <Admin catalog={catalog.rows.map(row=>({...row.data,active:row.active}))} content={content} user={{id:session.user.id,name:session.user.name,email:session.user.email}}/>;
  } catch {return <Unavailable/>}
}
