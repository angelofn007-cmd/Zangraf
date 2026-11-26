'use client';
import {useEffect, type ComponentProps} from 'react';
import dynamic from 'next/dynamic';

/**
 * O editor é pesado e depende dos projetos salvos no navegador. Ele é carregado à parte (a tela inicial do
 * estúdio não baixa o editor) e desenhado só no navegador: no servidor não há o que mostrar dele, e desenhar
 * lá gerava diferenças na hidratação.
 */
const Diagrammer = dynamic(() => import('./diagrammer').then(module => module.Diagrammer), {ssr: false});

/**
 * Só no servidor local (desenvolvimento): quando uma alteração no código troca o CSS do editor, às vezes a
 * folha nova não chega e o editor fica escondido esperando. Detecta isso e recarrega a página sozinho.
 */
function useReloadWhenEditorStyleIsLost() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let misses = 0;
    const timer = window.setInterval(() => {
      const studio = document.querySelector('.dm-studio');
      misses = studio && getComputedStyle(studio).visibility === 'hidden' ? misses + 1 : 0;
      if (misses >= 2) window.location.reload();
    }, 700);
    return () => window.clearInterval(timer);
  }, []);
}

export function DiagrammerLoader(props: ComponentProps<typeof Diagrammer>) {
  useReloadWhenEditorStyleIsLost();
  return <Diagrammer {...props}/>;
}
