'use client';
import {useCallback, useEffect, useRef, useState} from 'react';

const DURATION = 2400;
const SEEN_KEY = 'zg-intro-seen';
const SOFT_DURATION = 1300;

/**
 * Abertura animada: logo, faixa com as cinco cores e uma cortina que sobe revelando o site.
 * A abertura completa toca só na primeira visita da sessão (marcada pelo script do <head>).
 * Ao clicar no Home, toca uma transição mais tranquila.
 * Um clique pula. Quem prefere menos movimento não vê a abertura.
 */
export function SiteIntro() {
  const [run, setRun] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  const finish = useCallback(() => {
    window.clearTimeout(timer.current);
    document.documentElement.classList.remove('zg-intro-play');
    try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* sem armazenamento, só não lembra */ }
  }, []);

  /** Volta ao Home: transição tranquila (faixa colorida no topo + página surgindo suave). */
  const softTimer = useRef<number | undefined>(undefined);
  const playSoft = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.documentElement.classList.contains('zg-intro-play')) return;
    window.clearTimeout(softTimer.current);
    const root = document.documentElement;
    root.classList.remove('zg-home-soft');
    void root.offsetWidth; // reinicia a animação
    setRun(value => value + 1);
    root.classList.add('zg-home-soft');
    softTimer.current = window.setTimeout(() => root.classList.remove('zg-home-soft'), SOFT_DURATION);
  }, []);

  useEffect(() => {
    // Primeira visita: o script do <head> já ligou a abertura; aqui só agenda o fim.
    if (document.documentElement.classList.contains('zg-intro-play')) timer.current = window.setTimeout(finish, DURATION);
    // Clique no Home (logo ou link "/"), na mesma aba, toca de novo.
    function onClick(event: MouseEvent) {
      // Ouvido na fase de captura: o Link do Next marca o clique como tratado antes de chegar aqui.
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement).closest?.('a[href="/"]');
      if (link && !link.closest('.dm-studio')) playSoft();
    }
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('click', onClick, true); window.clearTimeout(timer.current); window.clearTimeout(softTimer.current); };
  }, [finish, playSoft]);

  return <><span className="zg-home-sweep" key={'s' + run} aria-hidden="true"/><div className="zg-intro" key={run} aria-hidden="true" onClick={finish}>
    <div className="zg-intro-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="zg-intro-logo zg-logo-day" src="/brand/zangraf.png" alt="" width={220} height={119}/>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="zg-intro-logo zg-logo-night" src="/brand/zangraf-noturno.png" alt="" width={220} height={119}/>
      <span className="zg-intro-rays"><i/><i/><i/><i/><i/></span>
      <span className="zg-intro-tagline">Histórias para guardar</span>
    </div>
    <span className="zg-intro-edge"><i/><i/><i/><i/><i/></span>
  </div></>;
}

/** Roda no <head>, antes da pintura: liga a abertura só na primeira visita da sessão. */
export const introBootScript = `try{var p=location.pathname;if(!sessionStorage.getItem('${SEEN_KEY}')&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!/^\\/(diagramador|admin|aprovar|api)/.test(p))document.documentElement.classList.add('zg-intro-play')}catch(e){}`;
