/**
 * Tonalidade das fotos: brilho, contraste, saturação, temperatura e efeitos prontos.
 *
 * A mesma descrição vira um `filter` de CSS na tela e um cálculo pixel a pixel na
 * exportação, seguindo as fórmulas da especificação de filtros do CSS. Assim, o que
 * aparece no diagramador é o que sai no JPG de impressão.
 */
export const PHOTO_EFFECTS = [
 {id: 'original', name: 'Original'},
 {id: 'pb', name: 'Preto e branco'},
 {id: 'pb-suave', name: 'P&B suave'},
 {id: 'sepia', name: 'Sépia'},
 {id: 'vintage', name: 'Vintage'},
 {id: 'quente', name: 'Quente'},
 {id: 'frio', name: 'Frio'},
 {id: 'vivo', name: 'Vivo'},
 {id: 'suave', name: 'Suave'},
 {id: 'dramatico', name: 'Dramático'},
] as const;
export type PhotoEffect = typeof PHOTO_EFFECTS[number]['id'];

/** Ajustes guardados no quadro. Os controles deslizantes vão de -100 a 100 (0 = sem mudança). */
export type PhotoAdjust = {effect?: PhotoEffect; brightness?: number; contrast?: number; saturation?: number; warmth?: number};

type Ops = {brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number; warmth: number};
const IDENTITY: Ops = {brightness: 1, contrast: 1, saturate: 1, grayscale: 0, sepia: 0, warmth: 0};
const EFFECTS: Record<PhotoEffect, Partial<Ops>> = {
 original: {},
 pb: {grayscale: 1, contrast: 1.1},
 'pb-suave': {grayscale: 1, contrast: .9, brightness: 1.05},
 sepia: {sepia: .8, contrast: 1.02},
 vintage: {sepia: .35, contrast: .9, saturate: .85, brightness: 1.05, warmth: .2},
 quente: {saturate: 1.08, warmth: .5},
 frio: {saturate: .95, warmth: -.5},
 vivo: {saturate: 1.35, contrast: 1.1},
 suave: {contrast: .88, saturate: .9, brightness: 1.06},
 dramatico: {contrast: 1.3, saturate: .9, brightness: .95},
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const slider = (value: number | undefined) => clamp(Number.isFinite(value) ? value! : 0, -100, 100) / 100;

export function isPhotoEffect(value: unknown): value is PhotoEffect {
 return PHOTO_EFFECTS.some(effect => effect.id === value);
}
/** Verdadeiro quando o ajuste não muda nada na foto. */
export function isNeutralAdjust(adjust?: PhotoAdjust) {
 return !adjust || ((!adjust.effect || adjust.effect === 'original') && !adjust.brightness && !adjust.contrast && !adjust.saturation && !adjust.warmth);
}

function resolve(adjust?: PhotoAdjust): Ops {
 if (isNeutralAdjust(adjust)) return IDENTITY;
 const base = {...IDENTITY, ...EFFECTS[isPhotoEffect(adjust!.effect) ? adjust!.effect : 'original']};
 return {
  brightness: clamp(base.brightness + slider(adjust!.brightness) * .4, 0, 2),
  contrast: clamp(base.contrast + slider(adjust!.contrast) * .4, 0, 2),
  saturate: clamp(base.saturate * (1 + slider(adjust!.saturation)), 0, 3),
  grayscale: base.grayscale,
  sepia: base.sepia,
  warmth: clamp(base.warmth + slider(adjust!.warmth), -1, 1),
 };
}

/** `filter` de CSS equivalente (sem a temperatura, que é uma camada por cima). */
export function photoFilterCss(adjust?: PhotoAdjust) {
 const ops = resolve(adjust);
 const parts: string[] = [];
 if (ops.brightness !== 1) parts.push(`brightness(${ops.brightness.toFixed(3)})`);
 if (ops.contrast !== 1) parts.push(`contrast(${ops.contrast.toFixed(3)})`);
 if (ops.saturate !== 1) parts.push(`saturate(${ops.saturate.toFixed(3)})`);
 if (ops.grayscale) parts.push(`grayscale(${ops.grayscale})`);
 if (ops.sepia) parts.push(`sepia(${ops.sepia})`);
 return parts.join(' ') || undefined;
}

/** Camada de temperatura: laranja (quente) ou azul (frio), misturada em "luz suave". */
export function photoWarmthLayer(adjust?: PhotoAdjust): {color: string; opacity: number} | undefined {
 const warmth = resolve(adjust).warmth;
 if (!warmth) return undefined;
 return {color: warmth > 0 ? '#ff8a1f' : '#1f7bff', opacity: Math.abs(warmth) * .35};
}

type Matrix = [number, number, number, number, number, number, number, number, number];
function saturateMatrix(s: number): Matrix {
 return [.213 + .787 * s, .715 - .715 * s, .072 - .072 * s, .213 - .213 * s, .715 + .285 * s, .072 - .072 * s, .213 - .213 * s, .715 - .715 * s, .072 + .928 * s];
}
function grayscaleMatrix(g: number): Matrix {
 const k = 1 - g;
 return [.2126 + .7874 * k, .7152 - .7152 * k, .0722 - .0722 * k, .2126 - .2126 * k, .7152 + .2848 * k, .0722 - .0722 * k, .2126 - .2126 * k, .7152 - .7152 * k, .0722 + .9278 * k];
}
function sepiaMatrix(p: number): Matrix {
 const k = 1 - p;
 return [.393 + .607 * k, .769 - .769 * k, .189 - .189 * k, .349 - .349 * k, .686 + .314 * k, .168 - .168 * k, .272 - .272 * k, .534 - .534 * k, .131 + .869 * k];
}

/**
 * Aplica o ajuste aos pixels RGBA (0–255), na mesma ordem do `filter` de CSS e
 * limitando a 0–255 depois de cada etapa, como os navegadores fazem.
 */
export function applyPhotoAdjust(data: Uint8ClampedArray, adjust?: PhotoAdjust) {
 const ops = resolve(adjust);
 const steps: ((r: number, g: number, b: number) => [number, number, number])[] = [];
 if (ops.brightness !== 1) steps.push((r, g, b) => [r * ops.brightness, g * ops.brightness, b * ops.brightness]);
 if (ops.contrast !== 1) {const offset = 127.5 * (1 - ops.contrast); steps.push((r, g, b) => [r * ops.contrast + offset, g * ops.contrast + offset, b * ops.contrast + offset]);}
 const matrices = [ops.saturate !== 1 ? saturateMatrix(ops.saturate) : null, ops.grayscale ? grayscaleMatrix(ops.grayscale) : null, ops.sepia ? sepiaMatrix(ops.sepia) : null];
 for (const m of matrices) if (m) steps.push((r, g, b) => [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b]);
 if (!steps.length) return;
 for (let i = 0; i < data.length; i += 4) {
  let r = data[i], g = data[i + 1], b = data[i + 2];
  for (const step of steps) {[r, g, b] = step(r, g, b); r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);}
  data[i] = r; data[i + 1] = g; data[i + 2] = b;
 }
}
