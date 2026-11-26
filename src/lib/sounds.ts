/**
 * Efeitos sonoros do estúdio com gravações reais (CC0, do Freesound; créditos em public/sounds/CREDITOS.txt).
 * - `playDoneSound`: tela "PRONTO!" da montagem automática.
 * - `playIntroSounds`: abertura da prévia (impressora, caixa, fita, caminhão, buzina, freio, campainha e surpresa),
 *   sincronizada com a animação de 8 s de `diagrammer-intro`.
 */
const SOUND_NAMES = ['impressora', 'whoosh', 'aba', 'caixa', 'fita', 'caminhao', 'freio', 'buzina', 'campainha', 'confete', 'tcharam', 'oba', 'pronto'] as const;
type SoundName = typeof SOUND_NAMES[number];

let context: AudioContext | undefined;
const buffers = new Map<SoundName, Promise<AudioBuffer | null>>();

function createContext(): AudioContext | undefined {
 if (typeof window === 'undefined') return undefined;
 const Ctor = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
 if (!Ctor) return undefined;
 try {
  // No iPhone/iPad, "playback" faz o som tocar mesmo com a chave de silencioso (Safari 17+).
  const session = (navigator as unknown as {audioSession?: {type: string}}).audioSession;
  if (session) session.type = 'playback';
  context ||= new Ctor();
  return context;
 } catch {
  return undefined;
 }
}

function audio(): AudioContext | undefined {
 const ctx = createContext();
 if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
 return ctx;
}

/** Baixa e decodifica um arquivo; `null` se não existir ou se o navegador não souber decodificar. */
function decode(ctx: AudioContext, url: string) {
 return fetch(url)
  .then(r => r.ok ? r.arrayBuffer() : null)
  .then(data => data ? new Promise<AudioBuffer | null>(resolve => ctx.decodeAudioData(data, resolve, () => resolve(null))) : null)
  .catch(() => null);
}

/**
 * Baixa e decodifica um som (uma vez só). Tenta o AAC (.m4a, leve); se o navegador não decodificar
 * — o navegador embutido do VS Code (Electron) vem sem AAC/MP3 —, usa o WAV, que todo navegador toca.
 */
function load(ctx: AudioContext, name: SoundName) {
 let buffer = buffers.get(name);
 if (!buffer) {
  buffer = decode(ctx, `/sounds/${name}.m4a`).then(b => b ?? decode(ctx, `/sounds/${name}.wav`));
  buffers.set(name, buffer);
 }
 return buffer;
}

/** Deixa todos os sons prontos (chamado no primeiro toque, bem antes de precisar deles). */
function preload(ctx: AudioContext) {
 for (const name of SOUND_NAMES) void load(ctx, name);
}

/**
 * Destrava o áudio no primeiro toque, clique ou tecla da pessoa.
 * Os navegadores (o Safari principalmente) só deixam o som sair se o áudio for ligado dentro de uma
 * interação; a abertura e o "PRONTO!" começam depois, fora do clique, e sem isso ficariam mudos.
 */
function unlockAudio() {
 const ctx = createContext();
 if (!ctx) return;
 if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
 // Um instante de silêncio tocado dentro do gesto termina de liberar o áudio no Safari.
 try {
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
  source.connect(ctx.destination);
  source.start(0);
 } catch {}
 preload(ctx);
}
if (typeof window !== 'undefined') {
 for (const type of ['pointerdown', 'touchend', 'keydown', 'click'] as const)
  window.addEventListener(type, unlockAudio, {capture: true, passive: true});
}

type ClipOptions = {
 /** Volume (1 = como está no arquivo, já normalizado). */
 volume?: number;
 /** Quanto tempo tocar (s); sem isso, até o fim do arquivo. */
 duration?: number;
 /** Fade no fim (s). */
 fadeOut?: number;
 /** Velocidade/altura (1 = normal). */
 rate?: number;
 /** Curva de velocidade [segundos depois do início, velocidade], para acelerar ou frear (motor). */
 rateCurve?: [number, number][];
};

/** Toca um som no instante `at` (tempo do áudio). Se esse instante já passou, começa do ponto certo; se já acabou, não toca. */
function playClip(ctx: AudioContext, out: AudioNode, buffer: AudioBuffer | null, at: number, opts: ClipOptions = {}) {
 if (!buffer) return;
 const rate = opts.rate ?? 1;
 const length = Math.min(opts.duration ?? buffer.duration / rate, buffer.duration / rate);
 const now = ctx.currentTime, late = Math.max(0, now - at);
 if (late >= length - .02) return;
 const start = at + late;
 const src = ctx.createBufferSource(), gain = ctx.createGain();
 src.buffer = buffer;
 src.playbackRate.setValueAtTime(rate, start);
 for (const [t, value] of opts.rateCurve || []) if (at + t > start) src.playbackRate.linearRampToValueAtTime(value, at + t);
 const volume = opts.volume ?? 1, fade = Math.min(opts.fadeOut ?? .04, length / 2), end = at + length;
 gain.gain.setValueAtTime(late > 0 ? 0 : volume, start);
 if (late > 0) gain.gain.linearRampToValueAtTime(volume, start + .03);
 gain.gain.setValueAtTime(volume, Math.max(start + .03, end - fade));
 gain.gain.linearRampToValueAtTime(0, end);
 src.connect(gain).connect(out);
 src.start(start, late * rate);
 src.stop(end + .02);
}

/** Som da tela "PRONTO!" da montagem automática. */
export function playDoneSound() {
 const ctx = audio();
 if (!ctx) return;
 void load(ctx, 'pronto').then(buffer => playClip(ctx, ctx.destination, buffer, ctx.currentTime + .02, {volume: .7}));
}

/** Controle dos sons da abertura. */
export type IntroSounds = {
 /** Silencia tudo e libera (botão "Pular" ou abertura sumindo). */
 stop: () => void;
 /** Liga/desliga o som sem parar a trilha. */
 setMuted: (muted: boolean) => void;
 /** O navegador está deixando o som sair? (false = bloqueado até a pessoa tocar na tela) */
 playing: () => boolean;
 /** Volume da abertura, de 0 a 1 (o controle deslizante). */
 setVolume: (volume: number) => void;
};

const VOLUME_KEY = 'zangraf-intro-volume-v2';
/** Volume máximo da trilha; o controle vai de 0 até aqui. */
const MAX_LEVEL = .3;
/** Volume escolhido pela pessoa (fica salvo neste navegador). Começa no máximo, que já é um volume baixo e agradável. */
export function introVolume() {
 try {
  const saved = Number.parseFloat(localStorage.getItem(VOLUME_KEY) || '');
  if (Number.isFinite(saved)) return Math.min(1, Math.max(0, saved));
 } catch {}
 return 1;
}
function saveIntroVolume(volume: number) {
 try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch {}
}

/** Religa o áudio dentro de um clique (para o botão "Ativar som"). */
export function resumeAudio() {
 unlockAudio();
 return context ? context.resume().then(() => context!.state === 'running').catch(() => false) : Promise.resolve(false);
}

/** A trilha da abertura: [segundo da animação, som, opções]. Os tempos seguem as keyframes de 8 s. */
const INTRO_TRACK: [number, SoundName, ClipOptions][] = [
 // Indigo imprimindo (0–1,4 s): "Impressora HP.wav", com duas batidas de folha.
 [0, 'impressora', {volume: 1, duration: 1.4, fadeOut: .2}],
 // O álbum sai voando e cai na caixa; as abas fecham e a fita passa.
 [1.1, 'whoosh', {volume: .9}],
 [1.98, 'aba', {volume: .45, rate: 1.3}],
 [2.1, 'aba', {volume: .55}],
 [2.22, 'aba', {volume: .55, rate: 1.12}],
 [2.28, 'fita', {volume: .5, duration: .5, fadeOut: .08}],
 // A caixa é jogada no baú do caminhão.
 [2.62, 'whoosh', {volume: .9, rate: .8}],
 [3.36, 'caixa', {volume: .6}],
 // Caminhão: dá a partida, o diesel pega (~3,75 s), acelera na estrada, freia na casa e acelera para ir embora.
 [3.3, 'caminhao', {volume: .75, duration: 3.5, fadeOut: .4, rateCurve: [[.9, 1], [1.6, 1.25], [2.2, 1.2], [2.5, .85], [2.75, .85], [3.4, 1.35]]}],
 // Na frente da casa: buzina "bi-bi" e o freio a ar.
 [5.25, 'buzina', {volume: .75}],
 [5.72, 'freio', {volume: .45, duration: 1, fadeOut: .3}],
 // A caixa fica na porta e a campainha toca.
 [6.04, 'aba', {volume: .45, rate: .85}],
 [6.1, 'campainha', {volume: .8, duration: 1, fadeOut: .25}],
 // A caixa grande cai, abre com estouro de confete, "tcharam!" e a criançada comemorando.
 [6.47, 'caixa', {volume: .7}],
 [6.86, 'aba', {volume: .65, rate: .9}],
 [6.9, 'confete', {volume: .75}],
 [7.0, 'tcharam', {volume: .75}],
 [7.2, 'oba', {volume: .5, duration: .95, fadeOut: .35}],
];

/**
 * Sons da abertura da prévia, nos mesmos tempos da animação (8 s).
 * `elapsed` (segundos) começa a trilha do meio, para religar o som em sincronia com a animação.
 */
export function playIntroSounds(elapsed = 0): IntroSounds {
 const ctx = audio();
 if (!ctx) return {stop: () => undefined, setMuted: () => undefined, playing: () => false, setVolume: saveIntroVolume};
 console.info('[Zangraf] sons da abertura · áudio:', ctx.state);
 const t0 = ctx.currentTime + .03 - elapsed;
 // Compressor na saída: quando vários sons coincidem (caixa + campainha + confete), nada estoura.
 const out = ctx.createGain(), compressor = ctx.createDynamicsCompressor(), level = ctx.createGain();
 compressor.threshold.value = -14; compressor.knee.value = 8; compressor.ratio.value = 6;
 compressor.attack.value = .004; compressor.release.value = .2;
 level.gain.value = MAX_LEVEL * introVolume();
 out.connect(compressor).connect(level).connect(ctx.destination);
 let stopped = false;
 // Cada som entra assim que o arquivo estiver pronto (normalmente já foi baixado no primeiro clique).
 for (const [time, name, opts] of INTRO_TRACK)
  void load(ctx, name).then(buffer => {if (!stopped) playClip(ctx, out, buffer, t0 + time, opts);});
 return {
  stop: () => {
   stopped = true;
   const now = ctx.currentTime;
   out.gain.cancelScheduledValues(now);
   out.gain.setValueAtTime(out.gain.value, now);
   out.gain.linearRampToValueAtTime(0, now + .15);
   window.setTimeout(() => level.disconnect(), 300);
  },
  setMuted: muted => {
   const now = ctx.currentTime;
   out.gain.cancelScheduledValues(now);
   out.gain.setValueAtTime(out.gain.value, now);
   out.gain.linearRampToValueAtTime(muted ? 0 : 1, now + .08);
  },
  playing: () => ctx.state === 'running',
  setVolume: volume => {
   const value = Math.min(1, Math.max(0, volume));
   saveIntroVolume(value);
   const now = ctx.currentTime;
   level.gain.cancelScheduledValues(now);
   level.gain.setValueAtTime(level.gain.value, now);
   level.gain.linearRampToValueAtTime(MAX_LEVEL * value, now + .05);
  },
 };
}
