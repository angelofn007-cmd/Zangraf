'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Package, UserRound, ChevronRight } from 'lucide-react';

const sections = [
  { href: '/minha-conta/projetos', label: 'Meus projetos', description: 'Crie e continue seus álbuns', icon: BookOpen },
  { href: '/minha-conta/pedidos', label: 'Meus pedidos', description: 'Acompanhe suas compras', icon: Package },
  { href: '/minha-conta/dados', label: 'Meus dados', description: 'Consulte sua conta', icon: UserRound },
];

export function AccountNavigation() {
  const pathname = usePathname();
  return <nav className="customer-nav" aria-label="Área do cliente">
    {sections.map(({ href, label, description, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
      <span className="customer-nav-icon"><Icon size={23} aria-hidden="true" /></span>
      <span><strong>{label}</strong><small>{description}</small></span>
      <ChevronRight className="customer-nav-arrow" size={18} aria-hidden="true" />
    </Link>)}
  </nav>;
}
