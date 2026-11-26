'use client';
import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import type {ApprovalPage, PhotoBox} from '@/lib/approval';
import './approval-book.css';

/**
 * Livro do cliente: folheia as lâminas (imagens já prontas) com a folha virando em 3D, como o álbum de verdade.
 * Entre lâminas a folha vira; entre a capa e uma lâmina (proporções diferentes) a página desliza.
 * Só transform/opacity: leve até no celular. As imagens vizinhas ficam pré-carregadas.
 */
export function ApprovalBook({pages, position, image, onTurned, overlay}: {
  pages: ApprovalPage[];
  position: number;
  image: (position: number) => string;
  /** A virada terminou nesta posição. */
  onTurned?: () => void;
  /** O que vai por cima da lâmina parada (números das fotos). */
  overlay?: ReactNode;
}) {
  const [shown, setShown] = useState(position);
  const [turn, setTurn] = useState<{from: number; to: number; dir: 1 | -1; flip: boolean} | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const isSpread = (i: number) => (pages[i]?.index ?? -1) >= 0;
  const ratio = (i: number) => `${pages[i]?.width || 2} / ${pages[i]?.height || 1}`;

  // Pré-carrega as vizinhas: a virada nunca espera a imagem chegar.
  useEffect(() => {
    for (const i of [position - 1, position + 1, position + 2]) if (pages[i]) { const img = new Image(); img.src = image(i); void img.decode?.().catch(() => undefined); }
  }, [position, pages, image]);

  useEffect(() => {
    if (position === shown || turn) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setShown(position); onTurned?.(); return; }
    const dir: 1 | -1 = position > shown ? 1 : -1;
    const flip = isSpread(shown) && isSpread(position) && Math.abs(position - shown) === 1;
    setTurn({from: shown, to: position, dir, flip});
    timer.current = window.setTimeout(() => { setShown(position); setTurn(null); onTurned?.(); }, flip ? 720 : 460);
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const half = (i: number, side: 'left' | 'right', extra = '') =>
    <div className={`ab-half ${side} ${extra}`} style={{backgroundImage: `url("${image(i)}")`}}/>;

  // Lâmina parada (ou o destino de uma troca sem virada).
  if (!turn) return <div className="ab-book" style={{aspectRatio: ratio(shown)}}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="ab-page" src={image(shown)} alt={pages[shown]?.label || ''} draggable={false}/>
    {overlay}
  </div>;

  if (!turn.flip) return <div className={`ab-book ab-slide ${turn.dir === 1 ? 'next' : 'prev'}`} style={{aspectRatio: ratio(turn.to)}} key={`s${turn.to}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="ab-page" src={image(turn.to)} alt="" draggable={false}/>
  </div>;

  const {from, to, dir} = turn;
  return <div className="ab-book is-turning" style={{aspectRatio: ratio(from)} as CSSProperties}>
    {half(dir === 1 ? from : to, 'left')}
    {half(dir === 1 ? to : from, 'right')}
    <div className={`ab-sheet ${dir === 1 ? 'forward' : 'backward'}`}>
      <i className="ab-sheet-shadow" aria-hidden="true"/>
      {half(from, dir === 1 ? 'right' : 'left', 'ab-face front')}
      {half(to, dir === 1 ? 'left' : 'right', 'ab-face back')}
    </div>
  </div>;
}

/** Números das fotos (1 a 10) por cima da lâmina. No modo de escolha, cada foto vira um botão. */
export function PhotoNumbers({photos, marked, selected, picking, onPick, flash}: {
  photos: PhotoBox[];
  /** Fotos que já têm pedido. */
  marked?: Set<number>;
  selected?: number | null;
  picking?: boolean;
  onPick?: (n: number) => void;
  /** Foto que pisca (pedido clicado na lista do fotógrafo); a chave reinicia a piscada. */
  flash?: {n: number; key: number} | null;
}) {
  if (!photos.length) return null;
  return <div className={'ab-numbers' + (picking ? ' is-picking' : '')}>
    {photos.map(box => {
      const style = {left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, '--i': box.n} as CSSProperties;
      const flashing = flash?.n === box.n;
      const state = (selected === box.n ? ' is-selected' : '') + (marked?.has(box.n) ? ' is-marked' : '') + (flashing ? ' is-flash' : '');
      return picking
        ? <button type="button" key={box.n} className={'ab-photo' + state} style={style} aria-label={`Foto ${box.n}`} onClick={() => onPick?.(box.n)}><b>{box.n}</b></button>
        : <span key={flashing ? `${box.n}-${flash!.key}` : box.n} className={'ab-photo' + state} style={style} aria-hidden="true"><b>{box.n}</b></span>;
    })}
  </div>;
}
