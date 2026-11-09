'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {ArrowUpRight, Instagram, Menu, Settings, UserRound, X} from 'lucide-react';
import type {SiteContent} from '@/lib/site-content';
import {CartLink} from './cart-link';
import {ThemeToggle} from './theme';

const navigation = [
  {href: '/albuns', label: 'Álbuns'},
  {href: '/acessorios', label: 'Acessórios'},
  {href: '/estojos', label: 'Estojos'},
  {href: '/kits-layflat', label: 'Kits Layflat'},
];

export function Header({adminAuthorized = false}: {adminAuthorized?: boolean}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  return <header className="zg-header">
    <Link href="/" className="zg-logo" aria-label="Zangraf, página inicial" onClick={() => setMenuOpen(false)}>
      <Image className="zg-logo-day" src="/brand/zangraf.png" alt="Zangraf" width={140} height={76} loading="eager"/><Image className="zg-logo-night" src="/brand/zangraf-noturno.png" alt="Zangraf" width={140} height={76} loading="eager"/>
    </Link>
    <nav id="zg-navigation" className={menuOpen ? 'zg-navigation is-open' : 'zg-navigation'} aria-label="Menu principal">
      {navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
    </nav>
    <div className="zg-header-actions">
      <ThemeToggle/>
      <Link href="/minha-conta" className="zg-account-link" aria-label="Entrar na minha conta" title="Minha conta" onClick={() => setMenuOpen(false)}><UserRound size={19} strokeWidth={1.5}/></Link>
      {adminAuthorized && <Link href="/admin" className="zg-admin-link" aria-label="Área administrativa" title="Área administrativa" onClick={() => setMenuOpen(false)}><Settings size={19} strokeWidth={1.5} aria-hidden="true"/></Link>}
      <CartLink/>
      <button className="zg-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="zg-navigation" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22}/> : <Menu size={22}/>}</button>
    </div>
  </header>;
}

export function Footer({content}: {content: SiteContent}) {
  const hasContact = content.contactEmail || content.whatsapp || content.instagramUrl;
  return <footer className="zg-footer" id="contato">
    <div className="zg-footer-top">
      <div className="zg-footer-brand"><Link href="/" className="zg-logo" aria-label="Zangraf, página inicial"><Image className="zg-logo-day" src="/brand/zangraf.png" alt="Zangraf" width={150} height={81}/><Image className="zg-logo-night" src="/brand/zangraf-noturno.png" alt="Zangraf" width={150} height={81}/></Link><p>Histórias para sentir,<br/>folhear e guardar.</p></div>
      <div><h2>Explore a Zangraf</h2><Link href="/albuns">Álbuns</Link><Link href="/acessorios">Acessórios</Link><Link href="/estojos">Estojos</Link><Link href="/#sobre">Sobre a Zangraf</Link></div>
      <div><h2>Seu espaço de criação</h2><Link href="/albuns">Escolher meu produto <ArrowUpRight size={13}/></Link><Link href="/minha-conta/projetos">Meus projetos</Link><Link href="/minha-conta/pedidos">Meus pedidos</Link><Link href="/entrar">Minha conta</Link></div>
      <div><h2>Vamos conversar</h2>{content.contactEmail && <a href={'mailto:' + content.contactEmail}>{content.contactEmail}</a>}{content.whatsapp && <a href={'https://wa.me/' + content.whatsapp} target="_blank" rel="noopener noreferrer">Fale pelo WhatsApp <ArrowUpRight size={13}/></a>}{content.instagramUrl && <a href={content.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram size={15}/> Instagram</a>}{!hasContact && <p>Em breve, mais formas<br/>de falar com a Zangraf.</p>}</div>
    </div>
    <div className="zg-footer-bottom"><span>© {new Date().getFullYear()} Zangraf</span><Link href="/privacidade">Privacidade</Link></div>
  </footer>;
}
