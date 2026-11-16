import {Diagrammer} from '@/components/diagrammer';
import {StudioStart} from '@/components/studio-start';
import {authenticationConfigured, getSession} from '@/lib/server/auth';
import {redirect} from 'next/navigation';
export const metadata={title:'Estúdio de álbuns'};
export default async function Page({searchParams}:{searchParams:Promise<{projeto?:string;item?:string}>}){
 const params=await searchParams;
 const query=new URLSearchParams();
 for(const key of ['item','projeto'] as const)if(typeof params[key]==='string'&&/^[a-f0-9-]{36}$/i.test(params[key]!))query.set(key,params[key]!);
 if(!query.size)return <StudioStart/>;
 // Só no computador de desenvolvimento, sem banco/login configurados, o editor abre sem conta.
 // Em produção (Vercel) o login continua obrigatório.
 const localPreview=process.env.NODE_ENV==='development'&&!authenticationConfigured();
 if(!localPreview&&!await getSession())redirect('/entrar?destino='+encodeURIComponent('/diagramador?'+query.toString()));
 return <section className="diagrammer-page" aria-label="Estúdio Zangraf"><Diagrammer projectId={query.get('projeto')||undefined} cartItemId={query.get('item')||undefined}/></section>;
}
