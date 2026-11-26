import type {Metadata} from 'next';
import {getSession, isAdmin} from '@/lib/server/auth';
import {connection} from 'next/server';
import {Header, Footer} from '@/components/shell';
import {getSiteContent} from '@/lib/server/content';
import {ThemeProvider} from '@/components/theme';
import {themeBootScript} from '@/lib/theme-initialization';
import {SiteIntro, introBootScript} from '@/components/site-intro';
import './globals.css';
import './brand.css';
import './modern.css';
import './theme.css';

export const metadata: Metadata = {
  title: {default: 'Zangraf — Histórias para guardar', template: '%s | Zangraf'},
  description: 'Álbuns fotográficos, estojos e acessórios. Conheça a Zangraf e dê forma às suas histórias com nosso diagramador de álbuns.',
};

/**
 * O estúdio só aparece com o próprio estilo aplicado. Se o CSS do diagramador ainda não chegou
 * (conexão lenta ou recarga do CSS durante o desenvolvimento), ele fica invisível por um instante
 * em vez de mostrar as fotos no tamanho original cobrindo a tela. O diagrammer.css libera de volta.
 */
const studioGuardCss = '.dm-studio,.dm-fly-layer{visibility:hidden}';

export default async function Layout({children}: {children: React.ReactNode}) {
  await connection();
  const content = await getSiteContent();
  let adminAuthorized = false;
  try { const session = await getSession(); adminAuthorized = Boolean(session && await isAdmin(session.user.id)); } catch { /* Hide privileged navigation when authentication is unavailable. */ }
  return <html lang="pt-BR" suppressHydrationWarning><head><style dangerouslySetInnerHTML={{__html: studioGuardCss}}/><script dangerouslySetInnerHTML={{__html: themeBootScript}}/><script dangerouslySetInnerHTML={{__html: introBootScript}}/></head><body><ThemeProvider><SiteIntro/><a href="#conteudo" className="skip-link">Pular para conteúdo</a><Header adminAuthorized={adminAuthorized}/><main id="conteudo">{children}</main><Footer content={content}/></ThemeProvider></body></html>;
}
