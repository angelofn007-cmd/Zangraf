'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {ArrowUpRight, Eye, EyeOff} from 'lucide-react';
import {authClient} from '@/lib/auth-client';
import './login.css';
export function Login({register=false,enabled=true,googleEnabled=false,googleError=false,destination='/minha-conta'}:{register?:boolean;enabled?:boolean;googleEnabled?:boolean;googleError?:boolean;destination?:string}) {
  const router=useRouter();
  const [pending,setPending]=useState(false);
  const [error,setError]=useState(googleError?'Não foi possível entrar com o Google. Tente novamente ou entre com e-mail e senha.':'');
  const [googlePending,setGooglePending]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const admin=destination==='/admin';
  async function signInWithGoogle(){
    if(!googleEnabled||pending)return;
    setPending(true);setGooglePending(true);setError('');
    try{
      const result=await authClient.signIn.social({provider:'google',callbackURL:destination,errorCallbackURL:'/entrar?erro=google&destino='+encodeURIComponent(destination)});
      if(result.error)throw new Error();
    }catch{setError('Não foi possível conectar ao Google. Tente novamente ou entre com e-mail e senha.');setPending(false);setGooglePending(false);}
  }
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const data=new FormData(e.currentTarget);
    setPending(true);setError('');
    try{
      const email=String(data.get('email')).trim();
      const password=String(data.get('password'));
      const result=register?await authClient.signUp.email({name:String(data.get('name')).trim(),email,password}):await authClient.signIn.email({email,password});
      if(result.error){
        setError(result.error.status===503?'O serviço está indisponível. Tente novamente em instantes.':result.error.status===429?'Muitas tentativas. Aguarde um momento antes de tentar novamente.':register?'Não foi possível criar a conta. Confira os dados ou tente entrar.':'Não foi possível entrar. Confira e-mail e senha.');
        return;
      }
      router.push(destination);router.refresh();
    }catch{setError('Não foi possível conectar. Confira sua conexão e tente novamente.')}finally{setPending(false)}
  }
  return <div className="auth-shell">
    <aside className="auth-visual">
      <Image src="/images/zangraf-editorial.png" alt="" fill sizes="(max-width:860px) 100vw, 50vw" preload/>
      <span className="auth-visual-tag"><span/> DO PRIMEIRO CLIQUE À ÚLTIMA PÁGINA</span>
      <div className="auth-visual-copy">
        <p>Suas fotos têm histórias.</p>
        <p><em>Vamos dar forma a elas?</em></p>
      </div>
    </aside>
    <div className="form-panel auth-panel">
      <span className="eyebrow">{admin?'ADMINISTRAÇÃO ZANGRAF':'SEU ESPAÇO ZANGRAF'}</span>
      <h1>{register?<>Comece uma <em>nova história.</em></>:<>Bom ter você <em>por aqui.</em></>}</h1>
      <p className="auth-lead">{register?'Crie sua conta para acompanhar seus pedidos e organizar seus álbuns.':admin?'Entre com uma conta autorizada pela equipe Zangraf.':'Entre para continuar de onde parou.'}</p>
      <button type="button" className="google-sign-in" disabled={!enabled||!googleEnabled||pending} aria-describedby={!googleEnabled?'google-availability':undefined} onClick={()=>void signInWithGoogle()}><GoogleMark/>{googlePending?'Conectando ao Google…':'Entrar com Google'}</button>
      {!googleEnabled&&<p id="google-availability" className="google-unavailable">Disponível em breve. Você pode continuar com seu e-mail.</p>}
      {error&&<p role="alert" className="auth-error">{error}</p>}
      {!enabled?<div role="status" className="auth-status"><p>Estamos preparando o acesso às contas. O cadastro e o login estarão disponíveis em breve.</p><Link className="button zg-button" href="/albuns">Conhecer os álbuns <ArrowUpRight size={18}/></Link></div>:<>
        <div className="login-divider">ou continue com e-mail</div>
        <form onSubmit={submit}>
          {register&&<label>Seu nome<input name="name" autoComplete="name" required maxLength={100}/></label>}
          <label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
          <div className="auth-field">
            <label htmlFor="auth-password">Senha</label>
            <div className="auth-password">
              <input id="auth-password" name="password" type={showPassword?'text':'password'} autoComplete={register?'new-password':'current-password'} required minLength={register?12:1} maxLength={128}/>
              <button type="button" aria-label={showPassword?'Ocultar senha':'Mostrar senha'} aria-pressed={showPassword} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
            </div>
          </div>
          {register&&<p className="small">Use uma senha com pelo menos 12 caracteres. Novas contas têm acesso de cliente.</p>}
          <button className="button zg-button auth-submit" disabled={pending}>{pending?'Aguarde…':<>{register?'Criar minha conta':'Entrar'} <ArrowUpRight size={18}/></>}</button>
        </form>
        <p className="form-switch">{register?'Já tem uma conta?':'Primeira vez aqui?'} <Link className="text-link" href={(register?'/entrar':'/criar-conta')+'?destino='+encodeURIComponent(destination)}>{register?'Entrar':'Criar uma conta'}</Link></p>
      </>}
    </div>
  </div>;
}
export function SignOut(){const router=useRouter();const [pending,setPending]=useState(false);const [error,setError]=useState('');return <><button className="back" disabled={pending} onClick={async()=>{setPending(true);try{const result=await authClient.signOut();if(result.error)throw new Error();router.push('/entrar');router.refresh()}catch{setError('Não foi possível sair. Tente novamente.')}finally{setPending(false)}}}>{pending?'Saindo…':'Sair da conta'}</button>{error&&<p role="alert">{error}</p>}</>}

function GoogleMark(){return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.31 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.23-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"/></svg>}
