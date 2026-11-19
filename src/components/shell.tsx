'use client';

import Image from 'next/image';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Instagram, Menu, Settings, Sparkles, UserRound, X} from 'lucide-react';
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
  const headerRef = useRef<HTMLElement>(null);
  // Quando o rodapé chega ao topo da tela, ele empurra o cabeçalho para cima em vez de passar por baixo dele.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = headerRef.current, footer = document.querySelector('.zg-foot');
      if (!header) return;
      // Rodapé escondido (ex.: login) não empurra o cabeçalho.
      const push = footer && (footer as HTMLElement).offsetParent !== null ? Math.max(0, header.offsetHeight - footer.getBoundingClientRect().top) : 0;
      header.style.transform = push ? `translateY(${-Math.min(push, header.offsetHeight)}px)` : '';
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); };
  }, [pathname]);
  return <header className="zg-header" ref={headerRef}>
    <Link href="/" className="zg-logo" aria-label="Zangraf, página inicial" onClick={() => setMenuOpen(false)}>
      <Image className="zg-logo-day" src="/brand/zangraf.png" alt="Zangraf" width={140} height={76} loading="eager"/><Image className="zg-logo-night" src="/brand/zangraf-noturno.png" alt="Zangraf" width={140} height={76} loading="eager"/>
    </Link>
    <nav id="zg-navigation" className={menuOpen ? 'zg-navigation is-open' : 'zg-navigation'} aria-label="Menu principal">
      {navigation.map(item => <Link key={item.href} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
    </nav>
    <div className="zg-header-actions">
      <Link href="/diagramador" className="zg-studio-link" aria-current={pathname.startsWith('/diagramador') ? 'page' : undefined} title="Abrir o diagramador" onClick={() => setMenuOpen(false)}><Sparkles size={17} strokeWidth={1.8} aria-hidden="true"/><span>Diagramador</span></Link>
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
  return <footer className="zg-foot" id="contato">
    <div className="zg-foot-rays" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <div className="zg-foot-inner">
      <div className="zg-foot-hero">
        <div>
          <Link href="/" className="zg-logo zg-foot-logo" aria-label="Zangraf, página inicial"><Image src="/brand/zangraf-noturno.png" alt="Zangraf" width={150} height={81}/></Link>
          <p className="zg-foot-tagline">Histórias para sentir,<br/><em>folhear e guardar.</em></p>
        </div>
        <Link href="/diagramador" className="zg-foot-cta"><Sparkles size={18} strokeWidth={1.8} aria-hidden="true"/>Criar meu álbum<ArrowUpRight size={18} aria-hidden="true"/></Link>
      </div>
      <div className="zg-foot-columns">
        <nav aria-label="Produtos"><h2>Explore a Zangraf</h2><Link href="/albuns">Álbuns</Link><Link href="/acessorios">Acessórios</Link><Link href="/estojos">Estojos</Link><Link href="/kits-layflat">Kits Layflat</Link><Link href="/#sobre">Sobre a Zangraf</Link></nav>
        <nav aria-label="Seu espaço de criação"><h2>Seu espaço de criação</h2><Link href="/diagramador">Diagramador</Link><Link href="/minha-conta/projetos">Meus projetos</Link><Link href="/minha-conta/pedidos">Meus pedidos</Link><Link href="/minha-conta">Minha conta</Link></nav>
        <div><h2>Vamos conversar</h2>{content.contactEmail && <a href={'mailto:' + content.contactEmail}>{content.contactEmail}</a>}{content.whatsapp && <a href={'https://wa.me/' + content.whatsapp} target="_blank" rel="noopener noreferrer">Fale pelo WhatsApp <ArrowUpRight size={14}/></a>}{content.instagramUrl && <a href={content.instagramUrl} target="_blank" rel="noopener noreferrer"><Instagram size={15}/> Instagram</a>}{!hasContact && <p>Em breve, mais formas<br/>de falar com a Zangraf.</p>}</div>
        <Image className="zg-foot-hp" src="/brand/hp-logo.png" alt="Impresso em equipamentos HP" title="Impresso em equipamentos HP" width={88} height={88}/>
      </div>
      <div className="zg-foot-bottom"><span>© {new Date().getFullYear()} Zangraf · Histórias para guardar</span><Link href="/privacidade">Política de privacidade</Link></div>
    </div>
  </footer>;
}
