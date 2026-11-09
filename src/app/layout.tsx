import type {Metadata} from 'next';
import {getSession, isAdmin} from '@/lib/server/auth';
import {connection} from 'next/server';
import {Header, Footer} from '@/components/shell';
import {getSiteContent} from '@/lib/server/content';
import {ThemeProvider} from '@/components/theme';
import {themeBootScript} from '@/lib/theme-initialization';
import './globals.css';
import './brand.css';
import './modern.css';
import './theme.css';

export const metadata: Metadata = {
  title: {default: 'Zangraf — Histórias para guardar', template: '%s | Zangraf'},
  description: 'Álbuns fotográficos, estojos e acessórios. Conheça a Zangraf e dê forma às suas histórias com nosso diagramador de álbuns.',
};

export default async function Layout({children}: {children: React.ReactNode}) {
  await connection();
  const content = await getSiteContent();
  let adminAuthorized = false;
  try { const session = await getSession(); adminAuthorized = Boolean(session && await isAdmin(session.user.id)); } catch { /* Hide privileged navigation when authentication is unavailable. */ }
  return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html: themeBootScript}}/></head><body><ThemeProvider><a href="#conteudo" className="skip-link">Pular para conteúdo</a><Header adminAuthorized={adminAuthorized}/><main id="conteudo">{children}</main><Footer content={content}/></ThemeProvider></body></html>;
}
