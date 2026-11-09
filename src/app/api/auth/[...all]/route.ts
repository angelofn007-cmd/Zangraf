import {toNextJsHandler} from 'better-auth/next-js';
import {getAuth,authenticationConfigured} from '@/lib/server/auth';
async function handle(request:Request){
  if(!authenticationConfigured())return Response.json({message:'O acesso às contas ainda está sendo preparado.'},{status:503});
  try {
    const handlers=toNextJsHandler(getAuth());
    return await (request.method==='GET'?handlers.GET(request):handlers.POST(request));
  } catch {return Response.json({message:'Não foi possível acessar as contas. Tente novamente em instantes.'},{status:503})}
}
export const GET=handle;export const POST=handle;
