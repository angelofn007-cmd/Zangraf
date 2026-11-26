'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookImage, Package, UserRound } from 'lucide-react';

/** Cada aba tem uma cor da faixa HP. */
const sections = [
  { href: '/minha-conta/projetos', label: 'Meus álbuns', icon: BookImage, color: 'var(--zg-blue)' },
  { href: '/minha-conta/pedidos', label: 'Pedidos', icon: Package, color: 'var(--zg-magenta)' },
  { href: '/minha-conta/dados', label: 'Meus dados', icon: UserRound, color: 'var(--zg-green)' },
];

export function AccountNavigation() {
  const pathname = usePathname();
  const active = Math.max(0, sections.findIndex(section => pathname === section.href));
  return <nav className="ca-tabs" aria-label="Área do cliente" style={{ ['--active' as string]: active, ['--tab-color' as string]: sections[active].color }}>
    <span className="ca-tabs-pill" aria-hidden="true" />
    {sections.map(({ href, label, icon: Icon }, index) => <Link key={href} href={href} aria-current={index === active && pathname === href ? 'page' : undefined}>
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
