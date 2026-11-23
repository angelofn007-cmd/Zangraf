import {Diagrammer} from '@/components/diagrammer';
import {StudioStart} from '@/components/studio-start';
import {authenticationConfigured, getSession} from '@/lib/server/auth';
export const metadata={title:'Estúdio de álbuns'};
export default async function Page({searchParams}:{searchParams:Promise<{projeto?:string;item?:string}>}){
 const params=await searchParams;
 const query=new URLSearchParams();
 for(const key of ['item','projeto'] as const)if(typeof params[key]==='string'&&/^[a-f0-9-]{36}$/i.test(params[key]!))query.set(key,params[key]!);
 if(!query.size)return <StudioStart/>;
 // O diagramador abre para todos. O login só é pedido quando a pessoa clica em Salvar.
 const session=authenticationConfigured()?await getSession().catch(()=>null):null;
 const requireLoginToSave=authenticationConfigured()&&!session;
 return <section className="diagrammer-page" aria-label="Estúdio Zangraf"><Diagrammer projectId={query.get('projeto')||undefined} cartItemId={query.get('item')||undefined} requireLoginToSave={requireLoginToSave}/></section>;
}
