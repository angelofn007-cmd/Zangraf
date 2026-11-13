'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight, BookOpen, Plus, RotateCcw} from 'lucide-react';
import {listProjects, type LayoutProject} from '@/lib/layout-projects';

const RECENT_LIMIT = 6;

/** Página inicial do diagramador: começar um álbum novo ou continuar um projeto salvo neste navegador. */
export function StudioStart() {
  const [projects, setProjects] = useState<LayoutProject[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([])).finally(() => setReady(true));
  }, []);
  const latest = projects[0];
  const recent = projects.slice(0, RECENT_LIMIT);

  return <section className="zg-section zg-studio-start">
    <div className="zg-studio-intro">
      <span className="zg-eyebrow">ESTÚDIO ZANGRAF</span>
      <h1>Monte seu álbum,<br/><em>lâmina por lâmina.</em></h1>
      <p>Escolha um álbum para começar do zero ou continue um projeto que você já iniciou.</p>
    </div>

    <div className="zg-studio-choices">
      <Link href="/albuns" className="zg-studio-choice is-primary">
        <span className="zg-studio-choice-icon"><Plus size={24} aria-hidden="true"/></span>
        <strong>Começar um álbum novo</strong>
        <span>Escolha o modelo, o tamanho e a capa. Depois você entra direto no diagramador.</span>
        <ArrowUpRight className="zg-studio-choice-arrow" size={20} aria-hidden="true"/>
      </Link>
      {latest
        ? <Link href={'/diagramador?projeto=' + encodeURIComponent(latest.id)} className="zg-studio-choice">
            <span className="zg-studio-choice-icon"><RotateCcw size={22} aria-hidden="true"/></span>
            <strong>Continuar de onde parei</strong>
            <span>{latest.name || 'Meu álbum'} · editado em {new Date(latest.updatedAt).toLocaleDateString('pt-BR')}</span>
            <ArrowUpRight className="zg-studio-choice-arrow" size={20} aria-hidden="true"/>
          </Link>
        : <div className="zg-studio-choice is-empty" aria-busy={!ready}>
            <span className="zg-studio-choice-icon"><RotateCcw size={22} aria-hidden="true"/></span>
            <strong>Continuar um projeto</strong>
            <span>{ready ? 'Você ainda não tem projetos neste navegador. Comece um álbum novo ao lado.' : 'Procurando seus projetos…'}</span>
          </div>}
    </div>

    {recent.length > 1 && <div className="zg-studio-recent">
      <div className="zg-studio-recent-heading"><h2>Seus projetos</h2>{projects.length > RECENT_LIMIT && <Link href="/minha-conta/projetos">Ver todos</Link>}</div>
      <div className="zg-studio-recent-grid">
        {recent.map(project => <Link key={project.id} href={'/diagramador?projeto=' + encodeURIComponent(project.id)} className="zg-studio-project">
          <BookOpen size={20} aria-hidden="true"/>
          <strong>{project.name || 'Meu álbum'}</strong>
          <span>{project.spreads.length} lâminas · {project.photos.length} fotos</span>
        </Link>)}
      </div>
    </div>}

    <p className="zg-studio-note">Seus projetos ficam salvos neste navegador. Use o mesmo dispositivo para continuar a edição.</p>
  </section>;
}
