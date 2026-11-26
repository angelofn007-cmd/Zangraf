import {defaultBackCover, defaultCover, frameGeometry, projectSpec, spreadRectangles, type LayoutProject} from './layout-projects';
import {MAX_NUMBERED_PHOTOS, type PhotoBox} from './approval';

/**
 * Fotos de uma página do álbum numeradas de 1 a 10, na ordem de leitura (de cima para baixo, da esquerda
 * para a direita), com a posição em fração da página (0–1). É a mesma geometria do arquivo de impressão,
 * então o número cai exatamente sobre a foto na prévia, no link do cliente e no editor.
 */
export function photoBoxes(project: LayoutProject, index: number): PhotoBox[] {
  const spec = projectSpec(project, index);
  const boxes: Omit<PhotoBox, 'n'>[] = [];
  const add = (rect: {x: number; y: number; w: number; h: number}, width: number, height: number) => {
    const x = Math.max(0, rect.x / width), y = Math.max(0, rect.y / height);
    boxes.push({x, y, w: Math.min(1 - x, rect.w / width), h: Math.min(1 - y, rect.h / height)});
  };
  if (index >= 0) {
    const spread = project.spreads[index];
    if (!spread) return [];
    spreadRectangles(spread).forEach((rect, i) => {
      if (!spread.slots[i]?.photoId) return;
      add(frameGeometry(rect, spec, true, spread.spacing).trim, spec.widthMm * 2, spec.heightMm);
    });
  } else {
    const cover = index === -2 ? project.backCover || defaultBackCover() : project.cover || defaultCover();
    if (cover.composition) {
      const physical = {...spec, widthMm: spec.widthMm / 2};
      spreadRectangles(cover.composition).forEach((rect, i) => {
        if (!cover.composition!.slots[i]?.photoId) return;
        add(frameGeometry(rect, physical, false, cover.composition!.spacing).trim, spec.widthMm, spec.heightMm);
      });
    } else if (cover.photo.photoId) boxes.push({x: 0, y: 0, w: 1, h: 1});
  }
  // Ordem de leitura: linhas de cima para baixo (com tolerância), e da esquerda para a direita em cada linha.
  boxes.sort((a, b) => Math.abs(a.y - b.y) > .08 ? a.y - b.y : a.x - b.x);
  return boxes.slice(0, MAX_NUMBERED_PHOTOS).map((box, i) => ({...box, n: i + 1}));
}
