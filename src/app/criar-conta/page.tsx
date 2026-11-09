import {connection} from 'next/server';
import {loginDestination} from '@/lib/login-destination';
import {Login} from '@/components/login';
import {authenticationConfigured,googleAuthenticationConfigured} from '@/lib/server/auth';
export const metadata={title:'Criar conta'};
export default async function Page({searchParams}:{searchParams:Promise<{destino?:string;erro?:string}>}){await connection();const {destino,erro}=await searchParams;return <section className="section"><Login register enabled={authenticationConfigured()} googleEnabled={googleAuthenticationConfigured()} googleError={erro==='google'} destination={loginDestination(destino)}/></section>}
