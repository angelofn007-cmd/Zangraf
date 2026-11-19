'use client';

import {useEffect, useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {ArrowUpRight, Plus, RotateCcw} from 'lucide-react';
import {listProjects, purgeExpiredProjects, type LayoutProject} from '@/lib/layout-projects';
import {unlinkProjects} from '@/lib/cart';
import './studio-start.css';

const delay = (index: number) => ({'--d': index} as CSSProperties);

/** Página inicial do diagramador: começar um álbum novo ou continuar um projeto salvo neste navegador. */
export function StudioStart() {
  const [projects, setProjects] = useState<LayoutProject[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    purgeExpiredProjects().then(unlinkProjects).catch(() => undefined)
      .then(listProjects).then(setProjects).catch(() => setProjects([])).finally(() => setReady(true));
  }, []);
  const latest = projects[0];

  return <section className="ss ss-simple ss-v2" aria-labelledby="ss-title">
    <div className="ss-head">
      <span className="ss-eyebrow ss-in" style={delay(0)}><i aria-hidden="true"/>Estúdio Zangraf</span>
      <h1 id="ss-title" className="ss-in" style={delay(1)}>O que vamos <em>criar hoje?</em></h1>
    </div>
    <div className="ss-choices">
      <Link href="/albuns" className="ss-card is-primary ss-in" style={delay(2)}>
        <span className="ss-rays-burst" aria-hidden="true"><i/><i/><i/><i/><i/></span>
        <span className="ss-card-icon"><Plus size={24} aria-hidden="true"/></span>
        <span className="ss-card-body">
          <strong>Começar um álbum novo</strong>
          <span>Escolha o modelo, o tamanho e a capa. Depois você entra direto no diagramador.</span>
        </span>
        <span className="ss-card-cta">Escolher meu álbum<ArrowUpRight size={18} aria-hidden="true"/></span>
        <span className="ss-closed-book" aria-hidden="true"><b>Nosso<br/>álbum</b></span>
      </Link>

      {latest
        ? <Link href="/minha-conta/projetos" className="ss-card ss-in" style={delay(3)}>
            <span className="ss-card-icon"><RotateCcw size={22} aria-hidden="true"/></span>
            <span className="ss-card-body">
              <strong>Continuar de onde parei</strong>
              <span className="ss-project-name">{latest.name || 'Meu álbum'}</span>
              <span className="ss-tags"><em>{latest.spreads.length} lâminas</em><em>{latest.photos.length} fotos</em><em>{new Date(latest.updatedAt).toLocaleDateString('pt-BR')}</em></span>
            </span>
            <span className="ss-card-cta">Ver meus projetos<ArrowUpRight size={18} aria-hidden="true"/></span>
            <span className="ss-open-book" aria-hidden="true"><span><i/><i/><i/></span><span><i/><i/></span></span>
          </Link>
        : <div className="ss-card is-empty ss-in" style={delay(3)} aria-busy={!ready}>
            <span className="ss-card-icon"><RotateCcw size={22} aria-hidden="true"/></span>
            <span className="ss-card-body">
              <strong>Continuar um projeto</strong>
              <span>{ready ? 'Você ainda não tem projetos neste navegador. Comece um álbum novo ao lado.' : 'Procurando seus projetos…'}</span>
            </span>
          </div>}
    </div>
  </section>;
}
