import 'server-only';
import {authenticationConfigured, getSession} from './auth';
import {AdminError, adminError, adminResponse, readAdminBody} from './admin-access';
export {AdminError as RequestError, adminError as requestError, adminResponse as jsonPrivate, readAdminBody as readBody};
export async function requireCustomer(request?:Request) {
 if(!authenticationConfigured())throw new AdminError('O acesso à sua conta está sendo preparado. Tente novamente em instantes.',503);
 if(request&&!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==new URL(process.env.BETTER_AUTH_URL!).origin)throw new AdminError('Origem não autorizada.',403);
 const session=await getSession();
 if(!session)throw new AdminError('Entre na sua conta para enviar o pedido.',401);
 return session;
}
