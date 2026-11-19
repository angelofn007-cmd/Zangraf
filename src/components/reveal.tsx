'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';

/** Mostra a seção com uma animação suave quando ela entra na tela (uma vez só). */
export function Reveal({children, className = '', id, label}: {children: ReactNode; className?: string; id?: string; label?: string}) {
  const ref = useRef<HTMLElement>(null);
  // Sem JavaScript a seção aparece normalmente; a animação só é armada depois de carregar.
  const [armed, setArmed] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') return;
    setArmed(true);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); observer.disconnect(); }
    }, {threshold: 0.12, rootMargin: '0px 0px -8% 0px'});
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <section ref={ref} id={id} aria-label={label} className={`${className}${armed ? ' zg-reveal' : ''}${seen ? ' is-in' : ''}`}>{children}</section>;
}
