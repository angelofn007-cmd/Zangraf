'use client';
import {MAX_PHOTO_BYTES,checkAlbumCapacity} from '@/lib/album-capacity';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {coverSpineMm,coverRegions,photoLayouts,rankLayoutsForPhotos,DEFAULT_SPACING,type PhotoLayout} from '@/lib/album-layouts';
import { Sparkles, Focus, ShoppingBag, ArrowLeft, ArrowRight, Plus, Save, ImagePlus, Undo2, Redo2, Copy, Trash2, WandSparkles, Eye, X, Check, BookOpen, RotateCcw, Upload, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Send, Type, Palette, LayoutTemplate, Settings2, Minus, Maximize, Search, Info, SunMoon, RotateCw, Replace, RefreshCw, Images, MousePointer2, Crop, AlignLeft, AlignCenter, AlignRight, Bold, Italic, FlipHorizontal2, FlipVertical2, Layers3, CircleCheck, CircleAlert, Ellipsis, ImageOff, CheckCheck, ZoomIn } from 'lucide-react';
import {checkAlbum,ISSUE_INFO,ISSUE_ORDER,pageLabel,type AlbumIssue} from '@/lib/album-check';
import {ALBUM_FONTS,FONT_GROUPS,MAIN_FONT_COUNT,ensureFont,fontsInGroup,type AlbumFont} from '@/lib/album-fonts';
import {ALBUM_ICONS,TEXTURES,SURFACES,SURFACE_GROUPS,surfaceUrl,type AlbumIcon,type TextureName,type SurfaceName} from '@/lib/album-decorations';
import {ALBUM_THEMES,applyThemeBackground,applyThemeCover} from '@/lib/album-themes';
import {DecorativeIcon} from './diagrammer-decoration';
import {AlbumFlipbook} from './diagrammer-flipbook';
import {PhotoFocus} from './diagrammer-focus';
import {CoverFinishingGuides} from './cover-finishing-guides';
import {PHOTO_EFFECTS,isNeutralAdjust,photoFilterCss,photoWarmthLayer,type PhotoAdjust} from '@/lib/photo-adjust';
import {coverLabel,coverMarginDescription} from '@/lib/cover-production';
import { frameGeometry, changeLayout, createProject, createSpread, defaultCover, defaultBackCover, defaultPrintSpec, emptySlot, fillEmptyFrames, moveSpread, removePhoto, duplicateSpread, removeSpread, rectangles, loadProject, saveProjectRevision, validateProjectForPrint, LAYOUTS, MAX_PHOTOS, MAX_SPREADS, type LayoutProject, type LayoutName, type Photo, type Slot, type AlbumText, type FrameRect, type Spread, spreadRectangles, newAlbumText, projectSpec, projectPageIndices, combinedCover, copyProject, isReusableSpread, purgeExpiredProjects, PROJECT_LIFETIME_DAYS } from '@/lib/layout-projects';
import {configuredSheetCount} from '@/lib/print-rules';
import {autoLayoutProject,readExifDate} from '@/lib/auto-album';
import {slotForFocus} from '@/lib/photo-focus';

/** Data em que a foto foi tirada; o EXIF fica no começo do arquivo, então basta ler os primeiros 256 KB. */
async function photoTakenAt(blob:Blob):Promise<number|undefined>{
 try{return readExifDate(await blob.slice(0,256*1024).arrayBuffer());}catch{return undefined;}
}
type FaceBox={boundingBox:{x:number;y:number;width:number;height:number}};
/** Centros dos rostos da foto (0–1), do maior para o menor, quando o navegador oferece detecção de rostos. */
async function findFaces(blob:Blob):Promise<{x:number;y:number}[]>{
 const Detector=(window as unknown as {FaceDetector?:new(options:{fastMode:boolean;maxDetectedFaces:number})=>{detect:(source:ImageBitmap)=>Promise<FaceBox[]>}}).FaceDetector;
 if(!Detector)return [];
 const bitmap=await createImageBitmap(blob).catch(()=>null);if(!bitmap)return [];
 try{
  const faces=await new Detector({fastMode:true,maxDetectedFaces:10}).detect(bitmap);
  return faces.sort((a,b)=>b.boundingBox.width*b.boundingBox.height-a.boundingBox.width*a.boundingBox.height)
   .map(face=>({x:(face.boundingBox.x+face.boundingBox.width/2)/bitmap.width,y:(face.boundingBox.y+face.boundingBox.height/2)/bitmap.height}));
 }catch{return [];}finally{bitmap.close();}
}
async function largestFace(blob:Blob){return (await findFaces(blob))[0];}
import { readCart, writeCart, unlinkProjects } from '@/lib/cart';
import { products } from '@/lib/products';
import { AlbumCover, AlbumSpread, type PhotoSizes } from './diagrammer-preview';
import {ApprovalPanel} from './diagrammer-approval';
import {specLabel,formatCm,snapshotModel,type PrintModel,type PrintVariant} from '@/lib/diagrammer-models';
import './diagrammer.css';

type SaveState = 'pending' | 'saving' | 'saved' | 'error';
const PHOTO_LIMIT = MAX_PHOTO_BYTES;

/** Número entre 0 e 1 fixo para cada foto (embaralha o painel sem mudar a cada clique). */
function photoSeed(id: string) { let h = 2166136261; for (let k = 0; k < id.length; k++) { h ^= id.charCodeAt(k); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; }

type PhotoTile<T> = {item: T; ratio: number};
type PhotoBlock<T> = {kind: 'pair'; columns: PhotoTile<T>[][]; widths: number[]} | {kind: 'trio'; items: PhotoTile<T>[]};
/**
 * Painel de fotos sem cortar nenhuma foto: blocos de 2 colunas (cada foto no formato real).
 * As colunas têm larguras um pouco diferentes em cada bloco, o que desencontra as fotos sem recorte.
 * Antes de uma faixa de 3, a divisão das colunas é calculada para as duas terminarem na mesma altura.
 */
function photoBlocks<T>(items: T[], ratioOf: (item: T) => number, width: number, gap: number, seedOf: (item: T) => number = () => .5): PhotoBlock<T>[] {
  if (!items.length || width <= 0) return [];
  const inner = width - gap, blocks: PhotoBlock<T>[] = [];
  const newSplit = (item: T) => .43 + seedOf(item) * .14;
  let columns: PhotoTile<T>[][] = [[], []], split = newSplit(items[0]), sinceTrio = 0, i = 0, nextTrio = 4 + Math.floor(seedOf(items[0]) * 5);
  const widths = () => [inner * split, inner * (1 - split)];
  const heightOf = (c: number, w: number) => columns[c].reduce((sum, tile) => sum + w / tile.ratio + gap, 0);
  const flush = () => {
    if (columns[0].length || columns[1].length) blocks.push({kind: 'pair', columns, widths: widths()});
    const next = items[Math.min(i, items.length - 1)];
    columns = [[], []]; sinceTrio = 0; split = newSplit(next); nextTrio = 4 + Math.floor(seedOf(next) * 6);
  };
  /** Acha a divisão das colunas que faz as duas terminarem juntas, sem cortar foto. */
  const level = () => {
    if (!columns[0].length || !columns[1].length) return false;
    const s0 = columns[0].reduce((sum, t) => sum + 1 / t.ratio, 0), s1 = columns[1].reduce((sum, t) => sum + 1 / t.ratio, 0);
    const w0 = (inner * s1 + (columns[1].length - columns[0].length) * gap) / (s0 + s1);
    if (w0 < inner * .34 || w0 > inner * .66) return false;
    split = w0 / inner; return true;
  };
  while (i < items.length) {
    const left = items.length - i, trio = items.slice(i, i + 3);
    // Faixa de 3 (opcional): só com fotos deitadas ou às vezes, numa altura boa, e se as colunas fecharem juntas.
    const rowHeight = trio.length === 3 ? (width - gap * 2) / trio.reduce((sum, item) => sum + ratioOf(item), 0) : 0;
    const wantsTrio = sinceTrio >= nextTrio && left >= 3 && left !== 4 && rowHeight >= width * .2 && rowHeight <= width * .42
      && (trio.filter(item => ratioOf(item) >= 1.05).length >= 2 || seedOf(items[i]) < .3);
    if (sinceTrio >= nextTrio && !wantsTrio) nextTrio = sinceTrio + 3 + Math.floor(seedOf(items[i]) * 5);
    if (wantsTrio && level()) { flush(); blocks.push({kind: 'trio', items: trio.map(item => ({item, ratio: ratioOf(item)}))}); i += 3; continue; }
    const [w0, w1] = widths(), c = heightOf(0, w0) <= heightOf(1, w1) ? 0 : 1;
    columns[c].push({item: items[i], ratio: ratioOf(items[i])}); sinceTrio++; i++;
  }
  flush();
  return blocks;
}


async function makePhotoPreview(bitmap:ImageBitmap,maxEdge:number):Promise<Blob>{
 const ratio=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
 const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível preparar a prévia.');
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);
 try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao preparar prévia.')),'image/jpeg',.82));}
 finally{canvas.width=1;canvas.height=1;}
}

/** Copia um arquivo para a memória (deixa de depender do armazenamento do navegador). */
async function copyBlob(blob:Blob){return new Blob([await blob.arrayBuffer()],{type:blob.type||'image/jpeg'});}
/**
 * No Safari, as fotos lidas do armazenamento (IndexedDB) podem deixar de abrir depois de um
 * salvamento automático. As prévias usadas na tela passam a ficar na memória logo ao abrir o projeto.
 */
async function keepPreviewsInMemory(project:LayoutProject):Promise<LayoutProject>{
 const photos=await Promise.all(project.photos.map(async photo=>{
  try{
   let preview=photo.preview?await copyBlob(photo.preview):undefined,thumbnail=photo.thumbnail?await copyBlob(photo.thumbnail):undefined;
   if(!preview||!thumbnail){const bitmap=await createImageBitmap(photo.blob);try{preview??=await makePhotoPreview(bitmap,1600);thumbnail??=await makePhotoPreview(bitmap,240);}finally{bitmap.close();}}
   return {...photo,preview,thumbnail};
  }catch{return photo;}
 }));
 return {...project,photos};
}

export function Diagrammer({ projectId, cartItemId, requireLoginToSave = false }: { projectId?: string; cartItemId?: string; requireLoginToSave?: boolean }) {
 const [project, setProject] = useState<LayoutProject | null>(null);
 const [activePage, setActivePage] = useState(-1);
 const [slotIndex, setSlotIndex] = useState(0);
 const [urls, setUrls] = useState<Record<string, string>>({});
 const [thumbUrls,setThumbUrls]=useState<Record<string,string>>({});
 const [notice, setNotice] = useState('');
 const [busy, setBusy] = useState(false);
 const [saveState, setSaveState] = useState<SaveState>('pending');
 const [saveError, setSaveError] = useState('');
 const [past, setPast] = useState<LayoutProject[]>([]);
 const [future, setFuture] = useState<LayoutProject[]>([]);
 const [filterUnused, setFilterUnusedState] = useState(false);
 const [tabSlide, setTabSlide] = useState<''|'from-left'|'from-right'>('');
 const setFilterUnused = (value: boolean) => { if (value === filterUnused) return; setTabSlide(value ? 'from-right' : 'from-left'); setFilterUnusedState(value); };
 const [photoGridWidth, setPhotoGridWidth] = useState(0);
 const [revealKey, setRevealKey] = useState(0);
 const [snapKey, setSnapKey] = useState(0);
 /** Há uma foto/quadro selecionado no álbum? Clicar fora do álbum tira a seleção. */
 const [frameFocus, setFrameFocus] = useState(false);
 const [importing, setImporting] = useState<{done:number;total:number;thumbs:string[];finished?:boolean}|null>(null);
 const photoTabs = useRef<HTMLDivElement>(null);
 const [tabInk, setTabInk] = useState<{left:number;width:number}|null>(null);
 const photoGridObserver = useRef<ResizeObserver|null>(null);
 const photoGridRef = useCallback((node: HTMLDivElement|null) => { photoGridObserver.current?.disconnect(); photoGridObserver.current = null; if (!node) return; setPhotoGridWidth(node.clientWidth); const observer = new ResizeObserver(([entry]) => setPhotoGridWidth(Math.floor(entry.contentRect.width))); observer.observe(node); photoGridObserver.current = observer; }, []);
 const [showPreview, setShowPreview] = useState(false);
 const [previewPage, setPreviewPage] = useState(-1);
 const [shareOpen, setShareOpen] = useState(false);
 const [formatLocked, setFormatLocked] = useState(false);
 const [formatError, setFormatError] = useState('');
 const [panel,setPanel]=useState<'photos'|'tone'|'layouts'|'text'|'background'|'icons'>('photos');
 // O painel de ferramentas começa fechado ao abrir o diagramador; abre pela barra lateral ou pela aba ›.
 const [panelOpen,setPanelOpen]=useState(false);
 // Aba lateral do painel: clicar alterna; arrastar para a esquerda recolhe e para a direita abre.
 const handleStart=useRef<number|null>(null);
 const handleDragged=useRef(false);
 const [handleDx,setHandleDx]=useState(0);
 const [iconId,setIconId]=useState<string>();
 const [focusOpen,setFocusOpen]=useState(false);
 const [backgroundTab,setBackgroundTab]=useState<'colors'|'themes'>('colors');
 const [iconCategory,setIconCategory]=useState('Todos');
 const [iconSearch,setIconSearch]=useState('');
 useEffect(()=>{void Promise.all(ALBUM_FONTS.slice(0,MAIN_FONT_COUNT).map(f=>ensureFont(f.family))).catch(()=>setNotice('Uma fonte não carregou. Confira a conexão e recarregue antes de finalizar o álbum.'));},[]);


 const [textId,setTextId]=useState<string>();
 // O catálogo completo de fontes só carrega quando a ferramenta de texto é aberta.
 useEffect(()=>{if(panel==='text'&&panelOpen)void Promise.all(ALBUM_FONTS.map(f=>ensureFont(f.family))).catch(()=>undefined);},[panel,panelOpen]);
 const [zoom,setZoom]=useState(100);
 const [workspaceSize,setWorkspaceSize]=useState({width:800,height:500});
 const canvasViewport=useRef<HTMLDivElement>(null);
 const [guides,setGuides]=useState(true);
 const [photoMode,setPhotoMode]=useState<'crop'|'position'>('crop');
 const [positionOpen,setPositionOpen]=useState(false);
 const [printOpen,setPrintOpen]=useState(false);
 // Avisos: cartão no canto direito que fecha sozinho quando a faixa colorida termina
 // (o tempo acompanha o tamanho do texto: de 4,5 a 12 segundos).
 const [toastLeaving,setToastLeaving]=useState(false);
 useEffect(()=>{setToastLeaving(false);},[notice]);
 function closeToast(){
  if(toastLeaving)return;setToastLeaving(true);
  window.setTimeout(()=>{setNotice('');setToastLeaving(false);},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:300);
 }
 // No celular o painel cobre a lâmina: se o álbum já tem fotos, ele abre fechado.
 const openedProject=project?.id;
 useEffect(()=>{
  if(openedProject&&window.matchMedia('(max-width:600px)').matches&&projectRef.current?.photos.length)setPanelOpen(false);
 },[openedProject]);
 // O menu "Mais opções" fecha ao clicar fora dele ou apertar Esc.
 useEffect(()=>{
  if(!positionOpen)return;
  const outside=(event:PointerEvent)=>{if(!(event.target as HTMLElement).closest?.('.dm-position-control'))setPositionOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setPositionOpen(false);};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[positionOpen]);
 // Rostos encontrados por foto (0–1), usados na checagem da dobra quando o navegador detecta rostos.
 const [faceMap,setFaceMap]=useState<Map<string,{x:number;y:number}[]>>(()=>new Map());
 useEffect(()=>{
  const current=projectRef.current;
  if(!printOpen||!current||!('FaceDetector' in window))return;
  const used=new Set(current.spreads.flatMap(s=>s.slots.map(slot=>slot.photoId)).filter((id):id is string=>!!id));
  const pending=current.photos.filter(p=>used.has(p.id)&&!faceMap.has(p.id));
  if(!pending.length)return;
  let active=true;
  void (async()=>{
   const found=new Map(faceMap);
   for(const photo of pending){if(!active)return;found.set(photo.id,await findFaces(photo.preview||photo.blob));}
   if(active)setFaceMap(found);
  })();
  return()=>{active=false;};
 },[printOpen,faceMap]);
 const [layoutCount,setLayoutCount]=useState(2);
 const [showMarginNotice,setShowMarginNotice]=useState(true);
 const [noticeLeaving,setNoticeLeaving]=useState(false);
 // Faixa de lâminas: na capa fica recolhida (só a pontinha das miniaturas); nas lâminas sobe sozinha.
 const [stripCollapsed,setStripCollapsed]=useState(true);
 useEffect(()=>{setStripCollapsed(activePage<0);},[activePage]);
 // O aviso de margem aparece uma vez só: na primeira entrada na capa. Ao sair da capa, ele não volta.
 const marginNoticeSeen=useRef(false);
 useEffect(()=>{
  if(activePage<0&&showMarginNotice)marginNoticeSeen.current=true;
  else if(activePage>=0&&marginNoticeSeen.current&&showMarginNotice){setShowMarginNotice(false);setNoticeLeaving(false);}
 },[activePage,showMarginNotice]);
 /** Fecha o aviso de margem com a animação de saída (pelo X ou quando a faixa colorida termina). */
 function closeMarginNotice(){
  if(noticeLeaving)return;setNoticeLeaving(true);
  window.setTimeout(()=>{setShowMarginNotice(false);setNoticeLeaving(false)},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:320);
 }
 const [selectPhotos,setSelectPhotos]=useState(false);
 const [pickedPhotos,setPickedPhotos]=useState<string[]>([]);
 // Quadro esperando uma foto nova (botão "Substituir foto" na lâmina).
 const [replaceTarget,setReplaceTarget]=useState<number|null>(null);
 // Ao abrir qualquer lâmina, começa sempre em Enquadrar; Mover só com o clique em "Mover".
 useEffect(()=>{setPhotoMode('crop');setFrameFocus(false);},[activePage]);
 // Sublinhado das abas desliza até a aba escolhida
 useEffect(()=>{const tabs=photoTabs.current;if(!tabs){setTabInk(null);return}const measure=()=>{const active=tabs.querySelector<HTMLElement>('[role=tab][aria-selected=true]');if(active)setTabInk({left:active.offsetLeft,width:active.offsetWidth})};measure();const observer=new ResizeObserver(measure);observer.observe(tabs);return()=>observer.disconnect();},[filterUnused,panel,!!project?.photos.length]);
 // Fotos excluídas saem da seleção (a contagem fica sempre certa).
 const photoIdsKey=project?.photos.map(p=>p.id).join('|');
 useEffect(()=>{setPickedPhotos(ids=>{const alive=new Set(photoIdsKey?.split('|')||[]);const next=ids.filter(id=>alive.has(id));return next.length===ids.length?ids:next;});},[photoIdsKey]);
 const [savedLayouts,setSavedLayouts]=useState<{id:string;name:string;spread:Spread}[]>([]);
 const fileInput = useRef<HTMLInputElement>(null);
 const bgInput = useRef<HTMLInputElement>(null);
 const [themeOpen, setThemeOpen] = useState<string|null>(null);
 // Carrega as fontes dos temas para as capas prontas aparecerem certas.
 useEffect(()=>{if(panel!=='background'||backgroundTab!=='themes')return;for(const t of ALBUM_THEMES)for(const c of t.covers){void ensureFont(c.font);void ensureFont(c.subFont);}},[panel,backgroundTab]);
 const previewDialog = useRef<HTMLDialogElement>(null);
 const projectRef = useRef<LayoutProject | null>(null);
 const dirtyRef = useRef(false);
 const alive = useRef(true);
 const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

 const persist = useCallback(async () => {
  const task = saveQueue.current.catch(() => undefined).then(async () => {
   const snapshot = projectRef.current;
   if (!snapshot || !dirtyRef.current) return true;
   if (alive.current) { setSaveState('saving'); setSaveError(''); }
   try {
    const result = await saveProjectRevision(snapshot);
    const saved = result.project;
    const current = projectRef.current;
    if (current?.id === snapshot.id) {
     const unchanged = current === snapshot;
     const next = unchanged ? saved : {...current,id:saved.id,revision:saved.revision,cartItemId:saved.cartItemId,recoveryOf:saved.recoveryOf};
     projectRef.current = next;
     dirtyRef.current = !unchanged;
     if (alive.current) {
      setProject(next);
      setSaveState(unchanged?'saved':'pending');
      if(result.conflict){setPast([]);setFuture([]);setFormatLocked(false);setFormatError('');setNotice('Este álbum foi alterado em outra aba. Suas alterações foram preservadas em uma cópia de recuperação; o projeto original e seu vínculo com o carrinho foram mantidos.')}
     }
    }
    if (saved.cartItemId && !result.conflict) {
     try {
      validateProjectForPrint(saved);
      const cart=readCart();const item=cart.find(item=>item.id===saved.cartItemId);
      if(item&&(!item.layoutProjectId||item.layoutProjectId===saved.id)&&item.productId===saved.productId&&JSON.stringify(item.configuration)===JSON.stringify(saved.configuration))writeCart(cart.map(entry=>entry.id===saved.cartItemId?{...entry,layoutProjectId:saved.id}:entry));
     } catch { if(alive.current)setNotice('Projeto salvo neste navegador. Confira a configuração e a quantidade de lâminas antes de enviar o pedido.'); }
    }
    if(alive.current&&projectRef.current?.id===saved.id){
     const url=new URL(window.location.href);
     if(url.pathname==='/diagramador'){
      url.searchParams.set('projeto',saved.id);
      if(result.conflict)url.searchParams.delete('item');
      window.history.replaceState(window.history.state,'',url);
     }
    }
    return true;
   } catch {
    if(alive.current){setSaveState('error');setSaveError('Não foi possível salvar. O armazenamento do navegador pode estar cheio ou bloqueado. Mantenha esta aba aberta e tente novamente.')}
    return false;
   }
  });
  saveQueue.current=task;
  return task;
 }, []);

 /** Salvar: guarda no navegador e, se a pessoa ainda não entrou, leva ao login e volta para este álbum. */
 async function saveAlbum(){
  if(!await persist())return;
  if(requireLoginToSave){
   setNotice('Entre na sua conta para salvar o álbum. Você volta para cá em seguida.');
   const destination=window.location.pathname+window.location.search;
   window.setTimeout(()=>window.location.assign('/entrar?destino='+encodeURIComponent(destination)),900);
   return;
  }
  
 }
 useEffect(() => {
  alive.current = true;
  return () => { alive.current = false; if (dirtyRef.current) void persist(); };
 }, [persist]);

 useEffect(() => {
  let active = true;
  (async () => {
   try {
    let official:PrintModel[]=[];
    // Projetos com mais de 5 dias são excluídos antes de abrir qualquer um.
    const expired=await purgeExpiredProjects().catch(()=>[] as string[]);unlinkProjects(expired);
    if(projectId&&expired.includes(projectId))throw new Error(`Este projeto foi excluído automaticamente ${PROJECT_LIFETIME_DAYS} dias depois de criado. Comece um novo álbum pelo carrinho.`);
    try{const response=await fetch('/api/diagramador/modelos');if(response.ok){const data=await response.json();official=data.models;}}catch{/* Local catalog remains available offline. */}
    const cart=readCart();
    const requestedItem=cartItemId?cart.find(item=>item.id===cartItemId):undefined;
    if(cartItemId&&!requestedItem)throw new Error('Este item não está mais no carrinho. Abra seu álbum pelo carrinho.');
    if(projectId&&requestedItem?.layoutProjectId&&requestedItem.layoutProjectId!==projectId)throw new Error('Este item está ligado a outro projeto. Abra a personalização diretamente pelo carrinho.');
    const resolvedId=projectId||requestedItem?.layoutProjectId;
    let loaded=resolvedId?await loadProject(resolvedId):undefined;
    if(!resolvedId&&!requestedItem)throw new Error('Escolha e configure um produto antes de começar a personalização.');
    if(resolvedId&&!loaded)throw new Error('Este projeto não está salvo neste navegador. Abra no mesmo dispositivo em que você o criou.');
    if(loaded&&!requestedItem&&!cart.some(item=>item.id===loaded!.cartItemId)){throw new Error('Este álbum está salvo, mas não está no carrinho. Abra o carrinho para escolher um produto. O projeto anterior continua preservado em sua conta.');}
    const isNew=!loaded;
    if(!loaded)loaded=createProject();
    if(requestedItem&&loaded.cartItemId&&loaded.cartItemId!==requestedItem.id)throw new Error('Este projeto já pertence a outro item do carrinho.');
    loaded={...loaded,cover:loaded.cover||defaultCover(),backCover:loaded.backCover||defaultBackCover(),printSpec:loaded.printSpec?{...loaded.printSpec,exportMode:'page'}:defaultPrintSpec()};
    const linkedItemId=cartItemId||loaded.cartItemId;
    if(linkedItemId){
     const item=requestedItem||cart.find(entry=>entry.id===linkedItemId);
     if(item){
      const product=item.product||products.find(product=>product.id===item.productId);
      const size=product?.printSizes?.find(size=>size.label===item.configuration.size);
      if(!size)throw new Error('Este produto ainda não tem um tamanho físico definido. Configure-o novamente no catálogo.');
      const count=configuredSheetCount(item.configuration.sheets);
      if(!isNew&&(loaded.productId!==item.productId||JSON.stringify(loaded.configuration)!==JSON.stringify(item.configuration)))throw new Error('A configuração do item mudou. Seu álbum foi preservado em Meus projetos; confira o produto antes de associá-lo novamente.');
      if(!isNew&&loaded.printSpec&&(['widthMm','heightMm','bleedMm','dpi'] as const).some(key=>loaded!.printSpec![key]!==size[key]))throw new Error('As medidas deste produto mudaram. Seu projeto original foi preservado; revise-o em Meus projetos.');
      loaded={...loaded,cartItemId:linkedItemId,productId:item.productId,configuration:item.configuration,printSpec:{...size,exportMode:'page'}};
      if(isNew){loaded.spreads=Array.from({length:count},()=>createSpread());const model=official.find(m=>m.productId===item.productId&&m.sizeLabel===item.configuration.size);const variants=model?.variants.filter(v=>v.sheets===count&&v.stock===item.configuration.stock)||[];const variant=variants.length===1?variants[0]:undefined;if(model&&variant){loaded.productionModel=snapshotModel(model,variant);if(model.coverMode==='wrap')loaded.cover=combinedCover(loaded.cover!,loaded.backCover!,coverSpineMm(loaded),loaded.productionModel.front.widthMm);}else{throw new Error('Escolha a gramatura e a quantidade na página do produto. As medidas oficiais dessa combinação precisam estar cadastradas antes de diagramar.');}}
     }
     if(active)setFormatLocked(true);
    }else if(active)setFormatLocked(false);
    if (active&&!isNew) loaded = await keepPreviewsInMemory(loaded);
    if (active) {
     projectRef.current = loaded; dirtyRef.current = isNew; setProject(loaded);
     setActivePage(projectPageIndices(loaded)[0]);setPreviewPage(projectPageIndices(loaded)[0]);
     setSaveState(isNew?'pending':'saved');
    }
   } catch (error) { if (active) setNotice(error instanceof Error ? error.message : 'Não foi possível abrir o projeto.'); }
  })();
  return () => { active = false; };
 }, [projectId, cartItemId]);

 useEffect(()=>{
  function key(event:KeyboardEvent){const target=event.target as HTMLElement;if(target.closest('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo()}if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void saveAlbum();}if(project&&!busy)handleElementKey(event);}
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 });
 useEffect(()=>{try{const raw=JSON.parse(localStorage.getItem('zangraf-personal-layouts-v1')||'[]');if(Array.isArray(raw))setSavedLayouts(raw.filter(v=>v&&typeof v.id==='string'&&typeof v.name==='string'&&isReusableSpread(v.spread)).slice(0,20))}catch{/* Invalid local layouts are ignored. */}},[]);
 useEffect(() => {
  if (!project) return;
  const next = Object.fromEntries(project.photos.map(photo => [photo.id, URL.createObjectURL(photo.preview??photo.blob)]));
  const thumbs=Object.fromEntries(project.photos.map(photo=>[photo.id,URL.createObjectURL(photo.thumbnail??photo.preview??photo.blob)]));
  setUrls(next);setThumbUrls(thumbs);
  // Libera os endereços antigos só depois que a tela já trocou para os novos (evita imagem quebrada no meio da troca).
  return () => {const old=[...Object.values(next),...Object.values(thumbs)];window.setTimeout(()=>old.forEach(URL.revokeObjectURL),5000);};
 }, [project?.photos]);
 // Se o navegador não conseguir mostrar uma foto (ex.: Safari ao ler do armazenamento), recria a imagem a partir dos bytes.
 useEffect(()=>{
  const tried=new Set<string>();
  const repair=async(event:Event)=>{
   const id=(event as CustomEvent<string>).detail;const photo=projectRef.current?.photos.find(p=>p.id===id);
   if(!photo||tried.has(id))return;tried.add(id);
   for(const source of [photo.preview,photo.blob,photo.thumbnail]){
    if(!source)continue;
    try{const copy=new Blob([await source.arrayBuffer()],{type:source.type||'image/jpeg'});const url=URL.createObjectURL(copy);setUrls(u=>({...u,[id]:url}));setThumbUrls(u=>({...u,[id]:url}));return;}catch{/* tenta a próxima versão da foto */}
   }
   // Último recurso: lê de novo do armazenamento do navegador (arquivos novos e válidos).
   try{const stored=await loadProject(projectRef.current!.id);const fresh=stored?.photos.find(p=>p.id===id);const source=fresh?.preview??fresh?.blob;
    if(source){const url=URL.createObjectURL(await copyBlob(source));setUrls(u=>({...u,[id]:url}));setThumbUrls(u=>({...u,[id]:url}));return;}}catch{/* segue para o aviso */}
   setNotice(`Não foi possível abrir “${photo.name}”. Exclua e envie essa foto de novo.`);
  };
  window.addEventListener('zangraf-photo-error',repair);return()=>window.removeEventListener('zangraf-photo-error',repair);
 },[]);

 useEffect(() => {
  if (!project || !dirtyRef.current) return;
  const timer = window.setTimeout(() => void persist(), 800);
  return () => window.clearTimeout(timer);
 }, [project, persist]);

 useEffect(()=>{
  const viewport=canvasViewport.current;if(!viewport)return;
  const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;setWorkspaceSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});});
  observer.observe(viewport);return()=>observer.disconnect();
 },[project?.id]);

 useEffect(() => {
  function warn(event: BeforeUnloadEvent) { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } }
  window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
 }, []);

 useEffect(() => {
  const dialog = previewDialog.current;
  if (!dialog) return;
  if (showPreview && !dialog.open) dialog.showModal();
  else if (!showPreview && dialog.open) dialog.close();
 }, [showPreview]);

 function apply(next: LayoutProject) {
  const current=projectRef.current;
  if(current&&next.spreads.length!==current.spreads.length){setNotice('A quantidade de lâminas é definida no produto. Escolha outro álbum no carrinho para alterar.');return;}
  const changed = { ...next, ...(current?{productId:current.productId,configuration:current.configuration,productionModel:current.productionModel,printSpec:current.printSpec,id:current.id,revision:current.revision,cartItemId:current.cartItemId,recoveryOf:current.recoveryOf}:{}), updatedAt: new Date().toISOString() };
  projectRef.current = changed;
  dirtyRef.current = true;
  setProject(changed); setSaveState('pending'); setSaveError('');
 }
 function edit(next: LayoutProject) {
  if (busy || !project) return;
  setPast(items => [...items.slice(-39), project]); setFuture([]); apply(next); setNotice('');
 }
 function restore(next: LayoutProject) {
  apply(next); setActivePage(index => projectPageIndices(next).includes(index)?index:projectPageIndices(next)[0]); setSlotIndex(0); setNotice('');
 }
 function undo() { if (!project || !past.length || busy) return; setFuture(items => [project, ...items]); restore(past[past.length - 1]); setPast(items => items.slice(0, -1)); }
 function redo() { if (!project || !future.length || busy) return; setPast(items => [...items, project]); restore(future[0]); setFuture(items => items.slice(1)); }

 async function addPhotos(files: FileList | File[] | null) {
  const current = projectRef.current;
  if (!current || !files?.length || busy) return;
  setBusy(true); setNotice('');
  const shown:string[]=[];
  setImporting({done:0,total:files.length,thumbs:[]});
  try {
   const incoming = Array.from(files);
   checkAlbumCapacity(current.photos.map(photo=>photo.blob),incoming);
   const incomingBytes=incoming.reduce((sum,file)=>sum+file.size,0);
   if(navigator.storage?.estimate){
    const estimate=await navigator.storage.estimate().catch(()=>null);
    if(estimate?.quota&&estimate.quota-(estimate.usage??0)<incomingBytes*1.15+20*1024*1024)throw new Error('O navegador não tem espaço disponível para este lote. Libere espaço no dispositivo ou selecione menos fotos.');
   }
   if(navigator.storage?.persist)void navigator.storage.persist().catch(()=>false);
   const photos: Photo[] = []; const rejected: string[] = [];
   for (const [index, file] of incoming.entries()) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > PHOTO_LIMIT) { rejected.push(file.name); continue; }
    try {
     const bitmap = await createImageBitmap(file);
     if (bitmap.width * bitmap.height > 40000000 || !bitmap.width || !bitmap.height) { bitmap.close(); rejected.push(file.name); continue; }
     try{
      const preview=await makePhotoPreview(bitmap,1600);
      const thumbnail=await makePhotoPreview(bitmap,240);
      const takenAt=await photoTakenAt(file);
      photos.push({id:crypto.randomUUID(),name:file.name,blob:file,preview,thumbnail,width:bitmap.width,height:bitmap.height,...(takenAt!==undefined?{takenAt}:{})});
      const thumbUrl=URL.createObjectURL(thumbnail);shown.push(thumbUrl);setImporting(state=>state&&{...state,done:index+1,thumbs:[...state.thumbs.slice(-3),thumbUrl]});
     }finally{bitmap.close();}
     // Deixa a tela desenhar a cada foto (a barra anda junto com o contador).
     await new Promise<void>(resolve=>requestAnimationFrame(()=>window.setTimeout(resolve,0)));
    } catch { rejected.push(file.name); }
    setImporting(state=>state&&state.done<index+1?{...state,done:index+1}:state);
   }
   if (photos.length) {
    setPast(items => [...items.slice(-39), current]); setFuture([]);
    apply({ ...current, photos: [...current.photos, ...photos] });
   }
   // Fim: a animação comemora; só aparece aviso se algum arquivo ficou de fora.
   setImporting(state=>state&&{...state,done:state.total,total:photos.length,finished:true});
   window.setTimeout(()=>{setImporting(null);setRevealKey(k=>k+1);shown.forEach(URL.revokeObjectURL);},2300);
   if(rejected.length)setNotice(`${rejected.length} arquivo(s) não foram importados: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}. Use JPG, PNG ou WebP de até 50 MB e 40 megapixels.`);
  } catch (error) { setImporting(null); shown.forEach(URL.revokeObjectURL); setNotice(error instanceof Error ? error.message : 'Não foi possível importar as fotos.'); }
  finally { setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
 }


 if (!project) return <section className="dm-start"><span className="zg-eyebrow">ESTÚDIO ZANGRAF</span><h1>{notice?'Não foi possível abrir este álbum.':'Preparando sua personalização.'}</h1><p role="status">{notice || 'Carregando o produto e as medidas escolhidas…'}</p>{notice&&<Link className="button" href="/carrinho">Voltar ao carrinho <ArrowRight size={16}/></Link>}</section>;
 const pageIndices=projectPageIndices(project);
 const wrapMode=project.productionModel?.coverMode==='wrap';
 const noCover=project.productionModel?.coverMode==='none';
 const legacyMargin=/anti[ -]?r{1,2}isco/i.test(project.productionModel?.name||'')?25:/1500/.test(project.productionModel?.name||'')?3:0;
 const coverMargins=project.productionModel?.coverMargins||(legacyMargin?{topMm:legacyMargin,rightMm:legacyMargin,bottomMm:legacyMargin,leftMm:legacyMargin}:undefined);
 const spreadExport=project.productionModel?.insideMode==='spread';
 const spineMm=coverSpineMm(project);
 const backMode = activePage === -2;
 const frontCover = project.cover || defaultCover();
 const backCover = project.backCover || defaultBackCover();
 const cover = backMode ? backCover : frontCover;
 /** A capa já tem alguma foto? Antes disso, as barras de edição da capa ficam escondidas. */
 const coverHasPhoto=activePage<0&&(!!cover.photo.photoId||!!cover.composition?.slots.some(s=>s.photoId));
 const spec = project.printSpec;
 const currentSpec=projectSpec(project,activePage);
 const currentRatio=currentSpec.widthMm/currentSpec.heightMm*(activePage<0?1:2);
 const texts=activePage<0?(cover.texts||[]):(project.spreads[activePage]?.texts||[]);
 const selectedText=texts.find(t=>t.id===textId);
 const icons=(activePage<0?cover.icons:project.spreads[activePage]?.icons)||[];
 const selectedIcon=icons.find(i=>i.id===iconId);
 const texture=(activePage<0?cover.texture:project.spreads[activePage]?.texture)||'none';
 const pageRatio = spec ? spec.widthMm / spec.heightMm : 1;
 const spread = activePage >= 0 ? project.spreads[activePage] : cover.composition||null;
 const slot = spread ? spread.slots[slotIndex] || spread.slots[0] : cover.photo;
 const usedIds = new Set(project.spreads.flatMap(item => item.slots.map(frame => frame.photoId)).filter(Boolean));
 for(const c of [frontCover,backCover])for(const f of c.composition?.slots||[])if(f.photoId)usedIds.add(f.photoId);
 if (frontCover.photo.photoId) usedIds.add(frontCover.photo.photoId);
 if (backCover.photo.photoId) usedIds.add(backCover.photo.photoId);
 /** Fotos do álbum (as imagens importadas só para fundo ficam de fora). */
 const library = project.photos.filter(photo => !photo.background);
 const visiblePhotos = library.filter(photo => !filterUnused || !usedIds.has(photo.id));
 const emptyCount = project.spreads.reduce((total, item) => total + item.slots.filter(frame => !frame.photoId).length, 0);
 const unusedCount = library.filter(photo => !usedIds.has(photo.id)).length;
 const albumFilled = project.spreads.some(item => item.slots.some(frame => frame.photoId));
 const storageMb = project.photos.reduce((sum,photo)=>sum+photo.blob.size,0)/1024/1024;
 const selectedPhoto = project.photos.find(photo => photo.id === slot?.photoId);
 const photoSizes:PhotoSizes=Object.fromEntries(project.photos.map(photo=>[photo.id,photo]));
 /** Largura ÷ altura da foto; sem medidas conhecidas, assume o formato comum de câmera (3:2). */
 const aspectOf=(id:string|null)=>{const photo=id?photoSizes[id]:undefined;return photo?.width&&photo.height?photo.width/photo.height:1.5;};
 const areaPhotoIds=(pickedPhotos.length?pickedPhotos:(spread?.slots||[cover.photo]).map(s=>s.photoId)).filter((id):id is string=>!!id);
 const layoutOptions=photoLayouts(layoutCount,currentRatio);
 /** Medidas da área (lâmina aberta ou capa) para a recomendação não ampliar fotos além da resolução delas. */
 const rankOptions=(ids:(string|null)[])=>({sizes:ids.map(id=>id?photoSizes[id]||{}:{}),areaMm:{width:currentSpec.widthMm*(activePage<0?1:2),height:currentSpec.heightMm},dpi:currentSpec.dpi});
 const rankedLayouts=areaPhotoIds.length===layoutCount?rankLayoutsForPhotos(layoutOptions,areaPhotoIds.map(aspectOf),currentRatio,rankOptions(areaPhotoIds)):null;
 const recommendedLayoutId=rankedLayouts?.[0]?.layout.id;
 const configuredCount = project.productionModel?.sheets||(project.cartItemId ? Number.parseInt(project.configuration?.sheets || '', 10) : 0);
 const countLocked = Number.isFinite(configuredCount) && configuredCount > 0;
 const canAddSpread = countLocked ? project.spreads.length < configuredCount : project.spreads.length < MAX_SPREADS;
 let projectPrintError='';
 try{validateProjectForPrint(project);if(!project.productionModel)throw new Error('Este projeto ainda não tem medidas oficiais de capa. Escolha a configuração no produto antes de preparar a impressão.');}catch(error){projectPrintError=(error as Error).message}
 const canRemoveSpread = project.spreads.length > (countLocked ? configuredCount : 1);

 function updateSlot(patch: Partial<Slot>, frame = slotIndex) {
  if(activePage<0&&spread)replaceSpread({...spread,slots:spread.slots.map((s,i)=>i===frame?{...s,...patch}:s)});
  else if (activePage < 0) edit({ ...project!, [backMode ? 'backCover' : 'cover']: { ...cover, photo: { ...cover.photo, ...patch } } });
  else edit({ ...project!, spreads: project!.spreads.map((item, i) => i === activePage ? { ...item, slots: item.slots.map((value, j) => j === frame ? { ...value, ...patch } : value) } : item) });
 }
 function assignPhoto(id: string, frame = slotIndex) {
  if (!project!.photos.some(photo => photo.id === id)) return;
  updateSlot({ ...emptySlot(), photoId: id }, frame); setSlotIndex(frame);
 }
 function requestReplace(index:number){setSlotIndex(index);setTextId(undefined);setIconId(undefined);setSelectPhotos(false);setReplaceTarget(index);}
 function replaceWith(id:string){if(replaceTarget===null)return;assignPhoto(id,replaceTarget);setReplaceTarget(null);}
 function selectPage(index: number) {setReplaceTarget(null);setPhotoMode('crop'); setActivePage(pageIndices.includes(index)?index:pageIndices[0]); if(index>=0&&project?.spreads[index])setLayoutCount(Math.min(10,Math.max(1,project.spreads[index].slots.filter(s=>s.photoId).length||project.spreads[index].slots.length))); setSlotIndex(0); setTextId(undefined);setIconId(undefined);setFocusOpen(false); setPositionOpen(false); }
 function replaceSpread(next:Spread){if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,composition:next,photo:emptySlot(),...(next.texts?{texts:next.texts}:{}),...(next.background?{color:next.background}:{})}});else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?next:s)});}
 function changeTemplate(layout: LayoutName) {
  if(!spread){const next=createSpread(layout);next.slots[0]={...cover.photo};replaceSpread(next);setSlotIndex(0);return;}
  const removed = spread.slots.slice(rectangles(layout).length).filter(frame => frame.photoId).length;
  if (removed && !window.confirm(`Este modelo tem menos quadros. ${removed} foto(s) sairão desta lâmina e continuarão na sua biblioteca. Trocar o modelo?`)) return;
  replaceSpread(changeLayout(spread,layout)); setSlotIndex(0);
 }
 function applyPhotoLayout(layout:PhotoLayout){
  const source=pickedPhotos.filter(id=>project!.photos.some(p=>p.id===id));
  const old=spread?.slots||[{...cover.photo}];
  const filled=source.length?source.map(id=>({...emptySlot(),photoId:id} as Slot)):old.filter(s=>s.photoId);
  const fit=filled.length===layout.frames.length?rankLayoutsForPhotos([layout],filled.map(s=>aspectOf(s.photoId)),currentRatio,rankOptions(filled.map(s=>s.photoId)))[0]:undefined;
  // Com a mesma quantidade de fotos e quadros, cada foto vai para o quadro de formato mais parecido.
  const slots=fit?fit.order.map(i=>filled[i]):layout.frames.map((_,i)=>source.length?{...emptySlot(),photoId:source[i]||null}:old[i]||emptySlot());
  replaceSpread({...spread,id:spread?.id||crypto.randomUUID(),layout:'livre',frames:layout.frames,spacing:spread?.spacing||{...DEFAULT_SPACING},slots});
  setPickedPhotos([]);setSelectPhotos(false);setSlotIndex(0);setPhotoMode('crop');setTextId(undefined);
  setNotice('');
 }
 /** Acrescenta a foto numa lâmina (a aberta, por padrão) e troca o layout para caber todas, até 10. */
 function appendPhoto(id:string,index=activePage){
  const target=index>=0?project!.spreads[index]:undefined;
  if(busy||!target||!project!.photos.some(p=>p.id===id))return false;
  const occupied=target.slots.filter(s=>s.photoId);
  if(occupied.length>=10){setNotice('Esta lâmina já tem 10 fotos. Troque uma foto ou escolha outra lâmina.');return false;}
  const added=[...occupied,{...emptySlot(),photoId:id}];
  // Layout inteligente: escolhe a composição cujos quadros combinam com fotos em pé e deitadas.
  // A foto nova (última) tem prioridade no formato; as outras não podem perder qualidade.
  const best=rankLayoutsForPhotos(photoLayouts(added.length,currentRatio),added.map(s=>aspectOf(s.photoId)),currentRatio,{...rankOptions(added.map(s=>s.photoId)),focus:added.length-1})[0];
  // A primeira foto da lâmina ocupa a lâmina inteira; só a partir da segunda o layout divide.
  const full=added.length===1?photoLayouts(1,currentRatio).find(l=>l.id==='full-1'):added.length===2?photoLayouts(2,currentRatio).find(l=>l.id==='pages-2'):undefined;
  const layout=full||best?.layout||photoLayouts(added.length,currentRatio)[0];
  const slots=full?added:best?best.order.map(i=>added[i]):added;
  const next={...target,layout:'livre' as LayoutName,frames:layout.frames,slots,spacing:target.spacing||{...DEFAULT_SPACING}};
  edit({...project!,spreads:project!.spreads.map((s,i)=>i===index?next:s)});
  if(index!==activePage)setActivePage(index);
  setLayoutCount(slots.length);setSlotIndex(Math.max(0,slots.findIndex(s=>s.photoId===id)));setPhotoMode('crop');setTextId(undefined);setIconId(undefined);
  return true;
 }
 /** Coloca várias fotos de uma vez na área aberta: primeiro nos quadros vazios, o resto ganha um layout que caiba tudo. */
 function addPhotosToAlbum(ids:string[]){
  const list=ids.filter(id=>project!.photos.some(p=>p.id===id));if(!list.length)return;
  if(!spread){assignPhoto(list[0]);return;}
  if(activePage>=0&&list.length===1&&!spread.slots.some(s=>s.photoId)){appendPhoto(list[0]);setPickedPhotos([]);setSelectPhotos(false);return;}
  const slots=[...spread.slots];const queue=[...list];
  for(let i=0;i<slots.length&&queue.length;i++)if(!slots[i].photoId)slots[i]={...emptySlot(),photoId:queue.shift()!};
  let next:Spread={...spread,slots};let left=0;
  if(queue.length){
   const all=[...slots.filter(s=>s.photoId),...queue.map(id=>({...emptySlot(),photoId:id} as Slot))];
   const fit=all.slice(0,10);left=all.length-fit.length;
   const best=rankLayoutsForPhotos(photoLayouts(fit.length,currentRatio),fit.map(s=>aspectOf(s.photoId)),currentRatio,rankOptions(fit.map(s=>s.photoId)))[0];
   if(best)next={...spread,layout:'livre',frames:best.layout.frames,slots:best.order.map(i=>fit[i]),spacing:spread.spacing||{...DEFAULT_SPACING}};
  }
  replaceSpread(next);setPickedPhotos([]);setSelectPhotos(false);setPhotoMode('crop');
  if(left)setNotice(`${left} ${left===1?'foto não coube':'fotos não couberam'} (até 10 por lâmina) e continuam nas suas fotos.`);
 }
 /** Tira a foto de todos os quadros do álbum; ela continua na biblioteca para usar depois. */
 function unusePhoto(id:string){
  const clear=(slot:Slot)=>slot.photoId===id?{...emptySlot()}:slot;
  const cover=<T extends {photo:Slot;composition?:Spread}>(c?:T)=>c&&{...c,photo:clear(c.photo),composition:c.composition&&{...c.composition,slots:c.composition.slots.map(clear)}};
  edit({...project!,spreads:project!.spreads.map(sp=>({...sp,slots:sp.slots.map(clear)})),cover:cover(project!.cover),backCover:cover(project!.backCover)});
  
 }
 /** Clique numa foto: ocupa o quadro selecionado (ou o primeiro vazio); se não houver vazio, entra na lâmina. */
 function placePhoto(id:string){
  if(replaceTarget!==null){assignPhoto(id,replaceTarget);setReplaceTarget(null);return;}
  // 1) Um quadro vazio na página aberta (o selecionado primeiro).
  // Na capa inteira, o quadro do meio é o dorso: não recebe foto automaticamente.
  const isSpine=(i:number)=>activePage<0&&spineMm>0&&spread?.slots.length===3&&i===1;
  // Lâmina sem nenhuma foto: a primeira ocupa a lâmina inteira.
  if(activePage>=0&&spread&&!spread.slots.some(s=>s.photoId)){appendPhoto(id);return;}
  if(spread){const target=spread.slots[slotIndex]&&!spread.slots[slotIndex].photoId&&!isSpine(slotIndex)?slotIndex:spread.slots.findIndex((s,i)=>!s.photoId&&!isSpine(i));if(target>=0){assignPhoto(id,target);return;}}
  else if(activePage<0&&!cover.photo.photoId){assignPhoto(id);return;}
  // 2) Lâmina aberta com menos de 10 fotos: a foto entra nela e o layout muda para caber todas.
  if(activePage>=0&&spread&&spread.slots.filter(s=>s.photoId).length<10){appendPhoto(id);return;}
  // 3) Lâmina cheia (10) ou capa completa: vai para a próxima lâmina — quadro vazio ou acrescentando até 10.
  const total=project!.spreads.length,start=activePage>=0?activePage+1:0;
  for(let step=0;step<total;step++){
   const k=(start+step)%total;if(k===activePage)continue;
   const slots=project!.spreads[k].slots,slot=slots.findIndex(s=>!s.photoId);
   if(!slots.some(s=>s.photoId)){if(appendPhoto(id,k))return;continue;}
   if(slot>=0){
    edit({...project!,spreads:project!.spreads.map((s,i)=>i===k?{...s,slots:s.slots.map((v,j)=>j===slot?{...emptySlot(),photoId:id}:v)}:s)});
    setActivePage(k);setSlotIndex(slot);setTextId(undefined);setIconId(undefined);return;
   }
   if(slots.filter(s=>s.photoId).length<10&&appendPhoto(id,k))return;
  }
  setNotice('Todas as lâminas já têm 10 fotos. Acrescente uma lâmina para continuar.');
 }
 /** Troca duas fotos de lugar na mesma área, levando junto o enquadramento de cada uma. */
 function swapSlots(from:number,to:number){
  if(!spread||from===to||!spread.slots[from]||!spread.slots[to])return;
  const slots=[...spread.slots];[slots[from],slots[to]]=[slots[to],slots[from]];
  replaceSpread({...spread,slots});setSlotIndex(to);setTextId(undefined);setIconId(undefined);
  
 }
 /** Soltar uma foto que já está nesta área em outro quadro troca as duas de lugar, em vez de duplicar. */
 function dropPhoto(index:number,id:string,add:boolean){
  const existing=spread?spread.slots.findIndex(s=>s.photoId===id):-1;
  if(existing>=0&&existing!==index){swapSlots(existing,index);return;}
  if(existing===index)return;
  if(add)appendPhoto(id);else assignPhoto(id,index);
  setTextId(undefined);
 }
 function splitCover(){
  if(!spineMm||!wrapMode)return;
  if(spread?.slots.some(s=>s.photoId)&&!window.confirm('Organizar a capa em verso, dorso e frente? Você pode desfazer e as fotos continuam na biblioteca.'))return;
  const slots=spread?.slots||[];
  replaceSpread({id:spread?.id||crypto.randomUUID(),layout:'livre',frames:coverRegions(currentSpec.widthMm,spineMm),slots:[slots[0]||emptySlot(),slots.length===3?slots[1]:emptySlot(),slots.at(-1)||emptySlot()]});
  setSlotIndex(1);setPhotoMode('crop');setTextId(undefined);
 }
 /** A capa inteira (verso + dorso + frente) vira um quadro único para uma foto só; desligar separa de novo em três. */
 const coverIsSingle=!!spread&&activePage===-1&&spread.slots.length===1&&(()=>{const r=spreadRectangles(spread)[0];return !!r&&r.x<=.001&&r.y<=.001&&r.w>=.999&&r.h>=.999;})();
 function toggleSingleCover(){
  if(!wrapMode||activePage!==-1)return;
  const slots=spread?.slots||[];
  const photo=[...slots].reverse().find(s=>s.photoId)||emptySlot();
  if(coverIsSingle){
   if(!spineMm)return;
   replaceSpread({id:spread?.id||crypto.randomUUID(),layout:'livre',frames:coverRegions(currentSpec.widthMm,spineMm),slots:[emptySlot(),emptySlot(),{...photo}]});
   setSlotIndex(2);
  }else{
   replaceSpread({id:spread?.id||crypto.randomUUID(),layout:'livre',frames:[{x:0,y:0,w:1,h:1}],slots:[{...photo}]});
   setSlotIndex(0);
  }
  setPhotoMode('crop');setTextId(undefined);
 }
 function addSpineText(){
  if(!spineMm||texts.length>=20)return;
  const size=14,lineMm=size*25.4/72*1.25;
  const t:AlbumText={...newAlbumText(),text:'Nossa história',rotation:90,fontSize:size,align:'center',width:currentSpec.heightMm*.8/currentSpec.widthMm*100,x:50-lineMm/currentSpec.widthMm*50,y:10};
  updateTexts([...texts,t]);setTextId(t.id);setPanel('text');setPanelOpen(true);
 }
 async function continueOrder(){
  if(!project!.cartItemId){setNotice('Este projeto não está vinculado ao carrinho. Configure seu álbum na loja para fazer o pedido.');return;}
  if(projectPrintError||formatError){setNotice(projectPrintError||formatError);return;}
  if(await persist())window.location.assign('/pagamento');
 }
 function autoFill() {
  const result = fillEmptyFrames(project!);
  if (!result.placed) { setNotice('Não há quadros vazios e fotos inéditas disponíveis. Adicione uma lâmina ou mais fotos.'); return; }
  edit(result.project);
  
  if (activePage < 0) selectPage(0);
 }
 /** "Montar o álbum para mim": ordena por data, separa em momentos, escolhe layouts e centraliza rostos. */
 async function autoBuildAlbum(onlyIds?:string[]){
  const full=projectRef.current;
  if(!full||busy||!full.photos.length||!full.spreads.length)return;
  // Com fotos selecionadas, monta só com elas (as outras continuam na biblioteca).
  const chosen=onlyIds?.length?new Set(onlyIds):null;
  const current=chosen?{...full,photos:full.photos.filter(p=>chosen.has(p.id))}:{...full,photos:full.photos.filter(p=>!p.background)};
  // Precisa de pelo menos uma foto por lâmina (as fotos da capa não entram no miolo).
  const onCover=new Set([current.cover,current.backCover].flatMap(c=>c?[c.photo.photoId,...(c.composition?.slots.map(s=>s.photoId)||[])]:[]).filter(Boolean));
  const available=current.photos.filter(p=>!onCover.has(p.id)).length;
  if(available<current.spreads.length){
   const missing=current.spreads.length-available;
   setNotice(`Para montar o álbum, adicione mais ${missing} ${missing===1?'foto':'fotos'}: é preciso pelo menos uma por lâmina (${current.spreads.length} lâminas).`);
   fileInput.current?.click();
   return;
  }
  if(current.spreads.some(s=>s.slots.some(slot=>slot.photoId))&&!window.confirm('Montar o álbum inteiro automaticamente? As fotos das lâminas serão reorganizadas (textos e capas continuam). Você pode desfazer depois.'))return;
  setBusy(true);
  try{
   const takenAt:Record<string,number|undefined>={};let found=0;
   for(const photo of current.photos){
    takenAt[photo.id]=photo.takenAt??await photoTakenAt(photo.blob);
    if(takenAt[photo.id]!==undefined)found++;
   }
   const faces=new Map<string,{x:number;y:number}>();
   if('FaceDetector' in window){
    for(const photo of current.photos){
     const face=await largestFace(photo.preview||photo.blob);if(face)faces.set(photo.id,face);
    }
   }
   const sizes=new Map(current.photos.map(p=>[p.id,p]));
   const result=autoLayoutProject(current,takenAt,projectSpec(current,0),(id,slot,w,h)=>{
    const face=faces.get(id),photo=sizes.get(id);
    return face&&photo?.width&&photo.height?slotForFocus(slot,photo.width,photo.height,w,h,face):slot;
   });
   // Guarda as datas lidas para não precisar ler de novo.
   const photos=full.photos.map(p=>p.takenAt===undefined&&takenAt[p.id]!==undefined?{...p,takenAt:takenAt[p.id]}:p);
   setPast(items=>[...items.slice(-39),full]);setFuture([]);setSelectPhotos(false);setPickedPhotos([]);
   apply({...result.project,photos});
   setActivePage(0);setSlotIndex(0);setTextId(undefined);setIconId(undefined);
   if(result.leftover)setNotice(`${result.leftover} ${result.leftover===1?'foto não coube':'fotos não couberam'} no álbum e continuam nas suas fotos.`);
  }catch{setNotice('Não foi possível montar o álbum automaticamente. Tente novamente.');}
  finally{setBusy(false);}
 }
 function previousPage() { selectPage(pageIndices[Math.max(0,pageIndices.indexOf(activePage)-1)]); }
 function nextPage() { selectPage(pageIndices[Math.min(pageIndices.length-1,pageIndices.indexOf(activePage)+1)]); }
 function addSpread() { if (!canAddSpread) return; edit({ ...project!, spreads: [...project!.spreads, createSpread()] }); selectPage(project!.spreads.length); }
 function moveCurrent(direction: -1 | 1) { edit(moveSpread(project!, activePage, activePage + direction)); selectPage(activePage + direction); }

 function updateTexts(next:AlbumText[]){
  if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,texts:next,composition:cover.composition?{...cover.composition,texts:undefined}:undefined}});
  else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?{...s,texts:next}:s)});
 }
 function updateText(id:string,patch:Partial<AlbumText>){updateTexts(texts.map(t=>t.id===id?{...t,...patch}:t));}
 function addText(preset:'title'|'subtitle'|'body'='title',font?:AlbumFont){if(texts.length>=20)return;const t={...newAlbumText(),fontFamily:font||(preset==='title'?'Playfair Display':preset==='subtitle'?'Montserrat':'Lora'),text:preset==='title'?'Nossa história':preset==='subtitle'?'Momentos para guardar':'Escreva aqui a sua mensagem.',fontSize:preset==='title'?36:preset==='subtitle'?22:14};updateTexts([...texts,t]);setTextId(t.id);setIconId(undefined);setPanel('text');setPanelOpen(true);}
 function updateFrame(index:number,rect:FrameRect){if(spread)replaceSpread({...spread,layout:'livre',frames:spreadRectangles(spread).map((r,i)=>i===index?rect:r)});}
 function addFrame(){const base=spread||{...createSpread('respiro'),slots:[{...cover.photo}]};if(base.slots.length>=12)return;replaceSpread({...base,layout:'livre',frames:[...spreadRectangles(base),{x:.28,y:.2,w:.35,h:.55}],slots:[...base.slots,emptySlot()]});setSlotIndex(base.slots.length);setPhotoMode('position');setTextId(undefined);}
 function removeFrame(){if(!spread||spread.slots.length<=1)return;replaceSpread({...spread,layout:'livre',frames:spreadRectangles(spread).filter((_,i)=>i!==slotIndex),slots:spread.slots.filter((_,i)=>i!==slotIndex)});setSlotIndex(0);}
 function duplicateSelected(){
  if(selectedIcon){if(icons.length>=30)return;const copy={...selectedIcon,id:crypto.randomUUID(),x:Math.min(75,selectedIcon.x+3),y:Math.min(75,selectedIcon.y+3)};updateIcons([...icons,copy]);setIconId(copy.id);return;}
  if(selectedText){if(texts.length>=20)return;const t={...selectedText,id:crypto.randomUUID(),x:Math.min(100-selectedText.width,selectedText.x+2),y:Math.min(85,selectedText.y+3)};updateTexts([...texts,t]);setTextId(t.id);return;}
  if(!spread||spread.slots.length>=12)return;const r=spreadRectangles(spread)[slotIndex];if(!r)return;
  replaceSpread({...spread,layout:'livre',frames:[...spreadRectangles(spread),{...r,x:Math.min(1-r.w,r.x+.025),y:Math.min(1-r.h,r.y+.025)}],slots:[...spread.slots,{...slot}]});setSlotIndex(spread.slots.length);setPhotoMode('position');
 }
 function reorderFrame(front:boolean){if(!spread)return;const frames=[...spreadRectangles(spread)],slots=[...spread.slots];const [r]=frames.splice(slotIndex,1),[v]=slots.splice(slotIndex,1);if(front){frames.push(r);slots.push(v)}else{frames.unshift(r);slots.unshift(v)}replaceSpread({...spread,layout:'livre',frames,slots});setSlotIndex(front?slots.length-1:0);}
 function alignFrame(to:'left'|'center'|'right'|'top'|'middle'|'bottom'){
  if(selectedText){const x=to==='left'?0:to==='center'?(100-selectedText.width)/2:to==='right'?100-selectedText.width:selectedText.x;updateText(selectedText.id,{x});return;}
  if(!spread)return;const r=spreadRectangles(spread)[slotIndex];if(!r)return;updateFrame(slotIndex,{...r,x:to==='left'?0:to==='center'?(1-r.w)/2:to==='right'?1-r.w:r.x,y:to==='top'?0:to==='middle'?(1-r.h)/2:to==='bottom'?1-r.h:r.y});
 }
 function handleElementKey(event:KeyboardEvent){
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='d'){event.preventDefault();duplicateSelected();return;}
  if(event.key==='Escape'){setReplaceTarget(null);setIconId(undefined);setTextId(undefined);setPositionOpen(false);setPhotoMode('crop');return;}
  if((event.key==='Delete'||event.key==='Backspace')&&!frameFocus&&!selectedIcon&&!selectedText)return;
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();if(selectedIcon){updateIcons(icons.filter(i=>i.id!==selectedIcon.id));setIconId(undefined)}else if(selectedText){updateTexts(texts.filter(t=>t.id!==selectedText.id));setTextId(undefined)}else if(spread&&spread.slots.length>1)removeFrame();else if(slot?.photoId)updateSlot(emptySlot());return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  // Fora do modo Mover (e sem texto/ícone selecionado), as setas ← → trocam de lâmina.
  if(!selectedIcon&&!selectedText&&(photoMode!=='position'||!frameFocus)){
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();if(event.key==='ArrowLeft')previousPage();else nextPage();}
   return;
  }
  event.preventDefault();const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;const amount=event.shiftKey?1:.2;
  if(selectedIcon){updateIcon(selectedIcon.id,{x:Math.max(0,Math.min(90,selectedIcon.x+dx*amount)),y:Math.max(0,Math.min(90,selectedIcon.y+dy*amount))})}
  else if(selectedText){updateText(selectedText.id,{x:Math.max(0,Math.min(100-selectedText.width,selectedText.x+dx*amount)),y:Math.max(0,Math.min(95,selectedText.y+dy*amount))})}
  else if(spread){const r=spreadRectangles(spread)[slotIndex];if(r)updateFrame(slotIndex,{...r,x:Math.max(0,Math.min(1-r.w,r.x+dx*amount/100)),y:Math.max(0,Math.min(1-r.h,r.y+dy*amount/100))});}
 }
 function setBackground(color:string,side:'all'|'right'='all'){
  // Escolher uma cor tira a textura de superfície, para a cor aparecer.
  if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,color,surface:undefined,backgroundPhotoId:undefined}});
  else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?(side==='right'?{...s,rightBackground:color}:{...s,background:color,rightBackground:undefined,surface:undefined,backgroundPhotoId:undefined}):s)});
 }
 /** Coloca uma textura fotográfica (mármore, linho, metal, papel) no fundo da área atual. */
 function setSurface(surface?:SurfaceName){
  if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,surface,backgroundPhotoId:surface?undefined:cover.backgroundPhotoId}});
  else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?{...s,surface,rightBackground:surface?undefined:s.rightBackground,backgroundPhotoId:surface?undefined:s.backgroundPhotoId}:s)});
 }
 function surfaceForAll(surface?:SurfaceName){
  if(!window.confirm(surface?'Usar esta textura no fundo de todas as lâminas? Fotos e textos continuam. Você pode desfazer.':'Tirar a textura de todas as lâminas?'))return;
  edit({...project!,spreads:project!.spreads.map(s=>({...s,surface,rightBackground:surface?undefined:s.rightBackground}))});
  
 }
 function saveLayout(){if(!spread)return;const name=window.prompt('Nome deste layout:','Meu layout');if(!name?.trim())return;const next=[{id:crypto.randomUUID(),name:name.trim().slice(0,60),spread:{...spread,texts:activePage<0?cover.texts:spread.texts,background:activePage<0?cover.color:spread.background,slots:spread.slots.map(emptySlot)}},...savedLayouts].slice(0,20);try{localStorage.setItem('zangraf-personal-layouts-v1',JSON.stringify(next));setSavedLayouts(next)}catch{setNotice('Não foi possível salvar o layout neste navegador.')}}
 function useSavedLayout(source:Spread){if(!window.confirm('Aplicar este layout à área atual? Você pode desfazer.'))return;replaceSpread({...source,id:spread?.id||crypto.randomUUID(),texts:source.texts?.map(t=>({...t,id:crypto.randomUUID()})),slots:source.slots.map((_,j)=>spread?.slots[j]||emptySlot())});setSlotIndex(0);setTextId(undefined);}
 function updateIcons(next:AlbumIcon[]){
  if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,icons:next}});
  else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?{...s,icons:next}:s)});
 }
 function updateIcon(id:string,patch:Partial<AlbumIcon>){updateIcons(icons.map(i=>i.id===id?{...i,...patch}:i));}
 function setIconSize(value:number){
  if(!selectedIcon)return;const size=Math.max(5,Math.min(80,Math.round(value)));
  updateIcon(selectedIcon.id,{sizeMm:size,x:Math.min(selectedIcon.x,100-size/(currentSpec.widthMm*(activePage<0?1:2))*100),y:Math.min(selectedIcon.y,100-size/currentSpec.heightMm*100)});
 }
 function addIcon(kind:string){if(icons.length>=30)return;const icon={id:crypto.randomUUID(),kind,x:wrapMode&&activePage<0?70:45,y:40,sizeMm:20,rotation:0,color:'#68563e'};updateIcons([...icons,icon]);setIconId(icon.id);setTextId(undefined);}
 function changeTexture(value:TextureName){if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,texture:value}});else if(spread)replaceSpread({...spread,texture:value});}
 function applyThemePages(id:string){edit(applyThemeBackground(project!,id));}
 function applyThemeCoverOption(id:string,index:number){edit(applyThemeCover(project!,id,index));if(activePage>=0)setActivePage(projectPageIndices(project!)[0]);}
 /** Importa uma imagem só para o fundo da página aberta (não entra nas fotos do álbum). */
 async function importBackground(file?:File|null){
  if(!file||!project)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>PHOTO_LIMIT){setNotice('Use uma imagem JPG, PNG ou WebP de até 50 MB.');return;}
  setBusy(true);
  try{
   const bitmap=await createImageBitmap(file);
   try{
    const preview=await makePhotoPreview(bitmap,2000),thumbnail=await makePhotoPreview(bitmap,240);
    const photo:Photo={id:crypto.randomUUID(),name:file.name,blob:file,preview,thumbnail,width:bitmap.width,height:bitmap.height,background:true};
    const base=projectRef.current!;const withPhoto={...base,photos:[...base.photos,photo]};
    if(activePage<0)edit({...withPhoto,[backMode?'backCover':'cover']:{...cover,backgroundPhotoId:photo.id,surface:undefined}});
    else edit({...withPhoto,spreads:withPhoto.spreads.map((s,i)=>i===activePage?{...s,backgroundPhotoId:photo.id,surface:undefined,rightBackground:undefined}:s)});
   }finally{bitmap.close();}
  }catch{setNotice('Não foi possível abrir essa imagem.');}
  finally{setBusy(false);if(bgInput.current)bgInput.current.value='';}
 }
 function setBackgroundImage(id?:string,all=false){
  if(activePage<0&&!all){edit({...project!,[backMode?'backCover':'cover']:{...cover,backgroundPhotoId:id}});return;}
  edit({...project!,spreads:project!.spreads.map((s,i)=>all||i===activePage?{...s,backgroundPhotoId:id,surface:id?undefined:s.surface}:s)});
 }
 function setSpacing(kind:'marginMm'|'gapMm',value:number){if(!spread)return;replaceSpread({...spread,spacing:{marginMm:spread.spacing?.marginMm??0,gapMm:spread.spacing?.gapMm??2,[kind]:value}});}
 /** Exclui de uma vez as fotos marcadas em "Selecionar várias" (e tira dos quadros onde estavam). */
 function removePickedPhotos(){
  const ids=pickedPhotos.filter(id=>project!.photos.some(p=>p.id===id));if(!ids.length)return;
  const used=ids.filter(id=>usedIds.has(id)).length;
  if(!window.confirm(`Excluir ${ids.length===1?'esta foto':`estas ${ids.length} fotos`}?${used?` ${used===1?'Uma delas está':`${used} delas estão`} no álbum e sairá dos quadros.`:''} Você pode desfazer.`))return;
  void flyToTrash(ids).then(()=>{
   const base=projectRef.current;if(!base)return;
   let next=base;for(const id of ids)next=removePhoto(next,id);
   const before=tilePositions();
   edit(next);setPickedPhotos([]);setSelectPhotos(false);
   settleTiles(before);
  });
 }
 /** Animação de exclusão: as fotos voam para a lixeira (ou somem num "puf", se a lixeira não estiver à vista). */
 /** Guarda onde cada foto está no painel (para as que ficam deslizarem até o novo lugar). */
 function tilePositions(){const map=new Map<string,DOMRect>();document.querySelectorAll<HTMLElement>('.dm-photo[data-photo]').forEach(el=>map.set(el.dataset.photo!,el.getBoundingClientRect()));return map;}
 /** Depois de excluir, as fotos que ficaram deslizam suavemente para o novo lugar, em vez de pular. */
 function settleTiles(before:Map<string,DOMRect>){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
   document.querySelectorAll<HTMLElement>('.dm-photo[data-photo]').forEach((el,i)=>{
    const old=before.get(el.dataset.photo!);if(!old)return;const now=el.getBoundingClientRect();
    const dx=old.left-now.left,dy=old.top-now.top,sx=old.width/Math.max(1,now.width),sy=old.height/Math.max(1,now.height);
    if(Math.abs(dx)<1&&Math.abs(dy)<1&&Math.abs(sx-1)<.01)return;
    el.animate([{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`,transformOrigin:'top left'},{transform:'none',transformOrigin:'top left'}],{duration:520,delay:Math.min(i,12)*18,easing:'cubic-bezier(.34,1.25,.64,1)'});
   });
  }));
 }
 async function flyToTrash(ids:string[]){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const trash=document.querySelector<HTMLElement>('.dm-upload-trash');
  trash?.scrollIntoView({block:'nearest'});
  const target=trash?.getBoundingClientRect();
  const tiles=ids.map(id=>document.querySelector<HTMLElement>(`.dm-photo[data-photo="${CSS.escape(id)}"]`)).filter((el):el is HTMLElement=>!!el);
  // As fotos voam numa camada por cima da tela (o painel corta o que sai dele).
  const layer=document.createElement('div');layer.className='dm-fly-layer';document.body.appendChild(layer);
  const visible=tiles.filter(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<window.innerHeight;}).slice(0,24);
  const runs=visible.map((el,i)=>{
   const box=el.getBoundingClientRect(),img=el.querySelector('img');
   const ghost=document.createElement('div');ghost.className='dm-fly-ghost';
   Object.assign(ghost.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});
   if(img){const copy=document.createElement('img');copy.src=img.src;ghost.appendChild(copy);}
   layer.appendChild(ghost);el.style.visibility='hidden';
   const delay=i*35;
   if(!target)return ghost.animate([{transform:'none',opacity:1},{transform:'scale(1.06)',offset:.3},{transform:'scale(.2) rotate(-8deg)',opacity:0}],{duration:420,delay,easing:'cubic-bezier(.5,0,.75,0)',fill:'forwards'}).finished;
   const dx=target.left+target.width/2-(box.left+box.width/2),dy=target.top+target.height/2-(box.top+box.height/2);
   const shrink=Math.max(.06,Math.min(.3,24/box.width));
   return ghost.animate([
    {transform:'translate(0,0) scale(1) rotate(0)',opacity:1},
    {transform:`translate(${dx*.35}px,${dy*.35-60}px) scale(.6) rotate(-10deg)`,opacity:1,offset:.45},
    {transform:`translate(${dx}px,${dy}px) scale(${shrink}) rotate(20deg)`,opacity:.15}
   ],{duration:700,delay,easing:'cubic-bezier(.4,0,.6,1)',fill:'forwards'}).finished;
  });
  tiles.filter(el=>!visible.includes(el)).forEach(el=>{el.style.visibility='hidden';});
  await Promise.all(runs).catch(()=>undefined);
  layer.remove();
  trash?.animate([{transform:'scale(1)'},{transform:'scale(1.22) rotate(-9deg)'},{transform:'scale(.92) rotate(6deg)'},{transform:'scale(1)'}],{duration:450,easing:'cubic-bezier(.34,1.6,.64,1)'});
  await new Promise(resolve=>window.setTimeout(resolve,200));
 }

 /** Muda a tonalidade da foto selecionada; `null` volta ao original. */
 function setAdjust(patch:Partial<PhotoAdjust>|null){
  if(!slot?.photoId)return;
  const next=patch===null?undefined:{...slot.adjust,...patch};
  updateSlot({adjust:isNeutralAdjust(next)?undefined:next});
 }
 /** Leva a mesma tonalidade para todas as fotos do álbum (lâminas, capa e verso). */
 function applyAdjustToAll(adjust?:PhotoAdjust){
  const value=isNeutralAdjust(adjust)?undefined:{...adjust};let count=0;
  const fix=(s:Slot):Slot=>{if(!s.photoId)return s;count++;return {...s,adjust:value};};
  const fixCover=<T extends {photo:Slot;composition?:Spread}>(c?:T)=>c&&{...c,photo:fix(c.photo),composition:c.composition&&{...c.composition,slots:c.composition.slots.map(fix)}};
  const next={...project!,spreads:project!.spreads.map(sp=>({...sp,slots:sp.slots.map(fix)})),cover:fixCover(project!.cover),backCover:fixCover(project!.backCover)};
  if(!count){setNotice('Ainda não há fotos nas lâminas para ajustar.');return;}
  edit(next);
  
 }
 const palette=['#fffdf8','#ffffff','#f1e8dc','#e1d5c4','#fdf153','#c8d1c1','#9ba9a0','#dfb4a3','#393e3b','#1e2023'];
 const tabs=[{id:'photos',label:'Fotos',icon:ImagePlus},{id:'layouts',label:'Layouts',icon:LayoutTemplate},{id:'background',label:'Fundo',icon:Palette},{id:'text',label:'Texto',icon:Type},{id:'icons',label:'Ícones',icon:Sparkles},{id:'tone',label:'Tonalidade',icon:SunMoon}] as const;
 const title=activePage===-1?(wrapMode?'Capa inteira':'Capa frente'):backMode?'Capa verso':`Lâmina ${activePage+1}`;
 const textProps={selectedText:textId,onTextSelect:(id:string)=>{setIconId(undefined);setTextId(id);setPanel('text');setPanelOpen(true)},onTextChange:updateText,selectedIcon:iconId,onIconSelect:(id:string)=>{setIconId(id);setTextId(undefined);setPanel('icons');setPanelOpen(true)},onIconChange:updateIcon};
 // Sem detecção de rostos no navegador, a checagem da dobra vira um aviso para conferir.
 const issues=checkAlbum(project,'FaceDetector' in globalThis?id=>faceMap.get(id):undefined);
 const issueErrors=issues.filter(i=>i.level==='error').length,issueWarnings=issues.length-issueErrors;
 // Pontinho nas miniaturas: vermelho para corrigir, amarelo para conferir (fotos na dobra são comuns e não marcam).
 const pageFlags=new Map<number,'error'|'warning'>();
 for(const issue of issues){if(issue.level==='error')pageFlags.set(issue.page,'error');else if(issue.kind!=='fold-photo'&&!pageFlags.has(issue.page))pageFlags.set(issue.page,'warning');}
 function goToIssue(issue:AlbumIssue){
  selectPage(issue.page);setPrintOpen(false);
  if(issue.textId){setTextId(issue.textId);setIconId(undefined);setPanel('text');setPanelOpen(true);}
  else if(issue.frame!==undefined)setSlotIndex(issue.frame);
  setNotice(`${ISSUE_INFO[issue.kind].title} · ${pageLabel(project!,issue.page)}: ${ISSUE_INFO[issue.kind].hint}`);
 }
 return <div className="zg-studio dm-studio">
  <header className="dm-topbar"><a href="/" className="dm-brand" aria-label="Voltar ao site Zangraf" onClick={async e=>{e.preventDefault();if(await persist())window.location.assign('/')}}><img className="zg-logo-day" src="/brand/zangraf.png" alt="Zangraf" width={112} height={60}/><span>ESTÚDIO</span></a><div className="dm-top-divider"/><div className="dm-name"><input aria-label="Nome do álbum" value={project.name} maxLength={100} disabled={busy} onChange={e=>edit({...project,name:e.target.value})}/><span className={'dm-save '+saveState}><span/>{saveState==='saved'?'Salvo neste navegador':saveState==='saving'?'Salvando…':saveState==='error'?'Falha ao salvar':'Salvamento automático'}</span></div><div className="dm-top-actions"><div className="dm-top-tools"><button className="dm-icon" title="Salvar e voltar ao carrinho" aria-label="Salvar e voltar ao carrinho" onClick={async()=>{if(await persist())window.location.assign('/carrinho')}}><ShoppingBag size={18}/></button><button className="dm-icon" aria-label="Desfazer" title="Desfazer · Ctrl/⌘ Z" disabled={!past.length||busy} onClick={undo}><Undo2 size={19}/></button><button className="dm-icon" aria-label="Refazer" title="Refazer · Ctrl/⌘ Shift Z" disabled={!future.length||busy} onClick={redo}><Redo2 size={19}/></button></div><button className="dm-button dm-save-button" onClick={()=>void saveAlbum()} disabled={busy}><Save size={16}/><span>Salvar</span></button><button className="dm-button" disabled={busy} onClick={()=>{setPreviewPage(activePage);setShowPreview(true)}}><Eye size={17}/><span>Prévia 3D</span></button><button className="dm-button primary" disabled={busy} onClick={()=>setPrintOpen(v=>!v)}><ArrowRight size={17}/><span>Finalizar álbum</span></button></div></header>
  {saveError&&<div className="dm-error" role="alert">{saveError}<button onClick={()=>void persist()}>Tentar novamente</button></div>}
  <div className={`dm-body ${panelOpen?'':'panel-collapsed'}`}>
   <nav className="dm-rail" aria-label="Ferramentas do diagramador">{tabs.map(tab=><button key={tab.id} data-tab={tab.id} aria-pressed={panel===tab.id&&panelOpen} className={panel===tab.id&&panelOpen?'active':''} onClick={()=>{setPanelOpen(panel===tab.id?!panelOpen:true);setPanel(tab.id)}}><tab.icon size={23}/><span>{tab.label}</span></button>)}</nav>
   <aside className="dm-panel-slot" id="dm-tool-panel" aria-label={tabs.find(t=>t.id===panel)?.label} aria-hidden={!panelOpen} inert={!panelOpen}><div className="dm-panel" data-tab={panel} key={panel}>
    {panel==='photos'&&<>
     <div className="dm-upload-bar">
      <button type="button" className="dm-upload-main" disabled={busy} onClick={()=>fileInput.current?.click()} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();void addPhotos(e.dataTransfer.files)}}><Upload size={18}/>{busy?'Carregando…':'Adicionar fotos'}</button>
      {!!library.length&&<button type="button" className={'dm-upload-more dm-select-all'+(selectPhotos?' is-on':'')} aria-pressed={selectPhotos&&visiblePhotos.length>0&&visiblePhotos.every(p=>pickedPhotos.includes(p.id))} aria-label={selectPhotos&&visiblePhotos.length>0&&visiblePhotos.every(p=>pickedPhotos.includes(p.id))?'Desmarcar todas':'Selecionar todas as fotos'} title={selectPhotos&&visiblePhotos.length>0&&visiblePhotos.every(p=>pickedPhotos.includes(p.id))?'Desmarcar todas':'Selecionar todas'} disabled={busy} onClick={()=>{if(selectPhotos&&visiblePhotos.length>0&&visiblePhotos.every(p=>pickedPhotos.includes(p.id))){setSelectPhotos(false);setPickedPhotos([])}else{setSelectPhotos(true);setPickedPhotos(visiblePhotos.map(p=>p.id));setSnapKey(k=>k+1)}}}><CheckCheck size={21}/></button>}
      {selectPhotos&&pickedPhotos.length>0&&<button type="button" className="dm-upload-trash" disabled={busy} aria-label={`Excluir ${pickedPhotos.length===1?'a foto selecionada':`as ${pickedPhotos.length} fotos selecionadas`}`} title={`Excluir ${pickedPhotos.length} ${pickedPhotos.length===1?'foto':'fotos'}`} onClick={()=>removePickedPhotos()}><Trash2 size={19}/><b>{pickedPhotos.length}</b></button>}
     </div>
     {importing&&!importing.finished&&(()=>{const pct=importing.total?Math.min(1,importing.done/importing.total):0;
      return <div className="dm-import" role="status" aria-live="polite" aria-label={`Carregando ${importing.done} de ${importing.total} fotos`}>
      {/* Mini impressora da Zangraf: cada foto carregada sai impressa pela frente, com a faixa das cinco cores. */}
      <div className="dm-printer" aria-hidden="true">
       <span className="dm-printer-paper">{importing.thumbs.slice(-1).map(url=><img key={url} src={url} alt=""/>)}</span>
       <span className="dm-printer-body"><span className="dm-printer-stripe"><i/><i/><i/><i/><i/></span><span className="dm-printer-led" key={importing.done}/></span>
       <span className="dm-printer-tray">{importing.thumbs.slice(0,-1).map((url,k)=><img key={url} src={url} alt="" style={{['--r' as string]:`${[-7,5,-3][k%3]}deg`}}/>)}</span>
      </div>
      <div className="dm-import-copy"><div className="dm-import-line"><strong>Imprimindo <b key={importing.done}>{importing.done}</b> de {importing.total}</strong></div>
       {/* Barra movida só com transform: anda mesmo com o navegador ocupado lendo as fotos. */}
       <span className="dm-import-track"><span className="dm-import-mask" style={{transform:`translateX(${(pct-1)*100}%)`}}><span className="dm-import-fill" style={{transform:`translateX(${(1-pct)*100}%)`}}/></span><span className="dm-import-runner" style={{transform:`translateX(${pct*100}%)`}}><i/></span></span></div>
     </div>})()}
     {importing?.finished&&<div className="dm-import-finale" role="status" aria-live="polite">
      <div className="dm-finale-burst" aria-hidden="true">{Array.from({length:14},(_,k)=><i key={k} style={{['--a' as string]:`${k*360/14}deg`,['--c' as string]:['#e8221e','#19b33a','#f5e21a','#1aa8e8','#e81aa5'][k%5],['--d' as string]:`${(k%3)*40}ms`}}/>)}<span className="dm-finale-check"><Check size={34} strokeWidth={3}/></span></div>
      <strong>{importing.total} {importing.total===1?'foto revelada':'fotos reveladas'}</strong>
      <div className="dm-finale-thumbs" aria-hidden="true">{importing.thumbs.map((url,k)=><img key={url} src={url} alt="" style={{['--k' as string]:k}}/>)}</div>
     </div>}
     {library.length>1&&<button type="button" className={'dm-build-button'+(selectPhotos&&pickedPhotos.length>0?' is-ready':'')} disabled={busy} title={selectPhotos&&pickedPhotos.length?`Montar com as ${pickedPhotos.length} fotos selecionadas`:undefined} onClick={()=>void autoBuildAlbum(selectPhotos&&pickedPhotos.length?pickedPhotos:undefined)}><WandSparkles size={17}/>{busy?<><span className="dm-printing" aria-hidden="true"><i/></span>Montando…</>:'Montar álbum automático'}</button>}
     
      
     {!library.length?(importing?null:<button type="button" className="dm-dropzone" disabled={busy} onClick={()=>fileInput.current?.click()} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();void addPhotos(e.dataTransfer.files)}}><ImagePlus size={34} strokeWidth={1.4}/><strong>Arraste suas fotos aqui</strong></button>):<>
      <div className="dm-photo-tabs" role="tablist" ref={photoTabs}>{tabInk&&<i className="dm-tab-ink" aria-hidden="true" style={{transform:`translateX(${tabInk.left}px)`,width:tabInk.width}}/>}
       <button type="button" role="tab" aria-selected={!filterUnused} onClick={()=>setFilterUnused(false)}>Todas</button>
       <button type="button" role="tab" aria-selected={filterUnused} onClick={()=>setFilterUnused(true)}>Não usadas{!!unusedCount&&<span>{unusedCount}</span>}</button>
       {selectPhotos&&<button type="button" className="dm-photo-tabs-done" onClick={()=>{setSelectPhotos(false);setPickedPhotos([])}}><Check size={14}/>Pronto</button>}
      </div>
      <div ref={photoGridRef} className={'dm-photo-viewport'+(revealKey?' is-revealing':'')}>{snapKey>0&&<span className="dm-shutter" key={snapKey} aria-hidden="true"/>}<div key={(filterUnused?'unused':'all')+'-'+revealKey} className={'dm-photos dm-photos-rows dm-photos-columns'+(tabSlide?' is-'+tabSlide:'')}>{photoGridWidth>0&&(()=>{let order=0;const ratioOf=(photo:Photo)=>photo.width&&photo.height?photo.width/photo.height:1.33;
       // Duas colunas (larguras variadas, fotos inteiras, sem corte); às vezes uma faixa com 3 fotos menores.
       const tile=({item:photo,ratio}:{item:Photo;ratio:number})=>{order++;
       const used=usedIds.has(photo.id);const picked=pickedPhotos.includes(photo.id);
       const checked=selectPhotos?picked:used;
       return <div className={'dm-photo'+(checked?' is-checked':'')} key={photo.id} data-photo={photo.id} style={{aspectRatio:ratio,flexGrow:ratio,['--d' as string]:`${Math.min(order,14)*35}ms`}}>
        <button className="dm-photo-image" aria-label={`Usar ${photo.name}`} title={photo.name} draggable={!busy} disabled={busy} onDragStart={e=>{e.dataTransfer.setData('application/x-zangraf-photo',photo.id);e.dataTransfer.effectAllowed='copy'}} onClick={()=>{if(selectPhotos){setPickedPhotos(ids=>ids.includes(photo.id)?ids.filter(id=>id!==photo.id):[...ids,photo.id])}else{placePhoto(photo.id);setTextId(undefined)}}}><img src={thumbUrls[photo.id]} alt={photo.name} draggable={false} loading="lazy" decoding="async" onError={()=>window.dispatchEvent(new CustomEvent('zangraf-photo-error',{detail:photo.id}))}/></button>
        <button type="button" className="dm-photo-check" aria-pressed={checked} disabled={busy} aria-label={selectPhotos?(picked?'Desmarcar foto':'Marcar foto'):used?'Tirar do álbum':'Colocar no álbum'} title={selectPhotos?(picked?'Desmarcar':'Marcar'):used?'Tirar do álbum':'Colocar no álbum'} onClick={()=>{if(selectPhotos){setPickedPhotos(ids=>ids.includes(photo.id)?ids.filter(id=>id!==photo.id):[...ids,photo.id])}else if(used)unusePhoto(photo.id);else{placePhoto(photo.id);setTextId(undefined)}}}>{checked&&<Check size={13} strokeWidth={3}/>}</button>
        {!selectPhotos&&<button className="dm-delete-photo" aria-label={`Excluir ${photo.name}`} title="Excluir foto" onClick={()=>{if(!used||window.confirm('Excluir esta foto? Ela também sai dos quadros onde aparece.'))void flyToTrash([photo.id]).then(()=>{const base=projectRef.current;if(!base)return;const before=tilePositions();edit(removePhoto(base,photo.id));settleTiles(before)})}}><X size={12}/></button>}
       </div>;};
       return photoBlocks(visiblePhotos,ratioOf,photoGridWidth,6,photo=>photoSeed(photo.id+'*')).map((block,b)=>block.kind==='trio'?<div className="dm-photo-trio" key={b}>{block.items.map(tile)}</div>:<div className="dm-photo-pair" key={b}>{block.columns.map((column,c)=><div className="dm-photo-col" key={c} style={{flex:`0 0 ${block.widths[c]}px`}}>{column.map(tile)}</div>)}</div>)})()}</div></div>
      {!visiblePhotos.length&&<p className="dm-photos-empty">{filterUnused?'Todas já estão no álbum ✓':''}</p>}
     </>}</>}
    {panel==='tone'&&(()=>{const adjust=slot?.adjust||{};const thumb=selectedPhoto?thumbUrls[selectedPhoto.id]:undefined;
     const sliders=[{key:'brightness',label:'Brilho',low:'Mais escuro',high:'Mais claro'},{key:'contrast',label:'Contraste',low:'Suave',high:'Marcado'},{key:'saturation',label:'Cores',low:'Apagadas',high:'Intensas'},{key:'warmth',label:'Temperatura',low:'Fria',high:'Quente'}] as const;
     return <><div className="dm-panel-title"><h2>Tonalidade das fotos</h2><SunMoon size={18}/></div>
     {!selectedPhoto?<div className="dm-empty"><SunMoon size={32}/><p>Clique numa foto da lâmina<br/>para ajustar brilho, cores e efeitos.</p></div>:<>
      
      <h3 className="dm-tone-heading">Efeitos</h3>
      <div className="dm-effect-grid">{PHOTO_EFFECTS.map(effect=>{const preview={...adjust,effect:effect.id};const layer=photoWarmthLayer(preview);const active=(adjust.effect||'original')===effect.id;
       return <button key={effect.id} type="button" aria-pressed={active} disabled={busy} onClick={()=>setAdjust({effect:effect.id})}><span className="dm-effect-thumb"><span style={{filter:photoFilterCss(preview)}}>{thumb?<img src={thumb} alt="" draggable={false}/>:<i/>}</span>{layer&&<b style={{background:layer.color,opacity:layer.opacity}}/>}</span><small>{effect.name}</small></button>;})}</div>
      <h3 className="dm-tone-heading">Ajustes</h3>
      <div className="dm-tone-sliders">{sliders.map(s=>{const value=adjust[s.key]||0;return <label key={s.key}><span>{s.label}<output>{value>0?'+':''}{value}</output></span><input type="range" min={-100} max={100} step={1} value={value} disabled={busy} aria-label={`${s.label}: ${s.low} a ${s.high}`} onChange={e=>setAdjust({[s.key]:Number(e.target.value)})} onDoubleClick={()=>setAdjust({[s.key]:0})} className={s.key==='warmth'?'dm-range-warmth':s.key==='brightness'?'dm-range-light':undefined}/><small><span>{s.low}</span><span>{s.high}</span></small></label>;})}</div>
      <button className="dm-button primary full" disabled={busy} onClick={()=>applyAdjustToAll(slot?.adjust)}><Images size={16}/>Aplicar a todas as fotos</button>
      <div className="dm-two"><button className="dm-button" disabled={busy||isNeutralAdjust(slot?.adjust)} onClick={()=>setAdjust(null)}><RotateCcw size={15}/>Original</button><button className="dm-button" disabled={busy} title="Tira os ajustes de todas as fotos do álbum" onClick={()=>{if(window.confirm('Voltar todas as fotos do álbum ao original?'))applyAdjustToAll(undefined)}}><RotateCcw size={15}/>Todas ao original</button></div>
      
     </>}</>;})()}
    {panel==='layouts'&&(()=>{
     const pageRatio=currentSpec.widthMm/currentSpec.heightMm;
     const shape=pageRatio<.9?'vertical':pageRatio>1.1?'horizontal':'quadrado';
     const effectiveSpacing=(_layout:PhotoLayout)=>DEFAULT_SPACING;
     const thumbSpec={...currentSpec,widthMm:currentSpec.widthMm*(activePage<0?.5:1)};
     const thumbFrames=(layout:PhotoLayout)=>layout.frames.map(rect=>{const t=frameGeometry(rect,thumbSpec,activePage>=0,effectiveSpacing(layout)).trim;return {x:t.x/(thumbSpec.widthMm*2),y:t.y/thumbSpec.heightMm,w:t.w/(thumbSpec.widthMm*2),h:t.h/thumbSpec.heightMm};});
     const sameFrames=(layout:PhotoLayout)=>!!spread&&JSON.stringify(spreadRectangles(spread))===JSON.stringify(layout.frames);
     const list=rankedLayouts||layoutOptions.map(layout=>({layout,lowResolution:false}));
     const recommended=rankedLayouts?list.slice(0,2):[];
     const others=rankedLayouts?list.slice(2):list;
     const photosHere=(spread?.slots||[cover.photo]).filter(s=>s.photoId).length;
     const spacingPresets=[{label:'Sem borda',margin:0,gap:0},{label:'Fino',margin:4,gap:2},{label:'Médio',margin:12,gap:4},{label:'Amplo',margin:20,gap:8}];
     const card=({layout,lowResolution}:{layout:PhotoLayout;lowResolution:boolean},best=false)=><button key={layout.id} type="button" className={'dm-layout-card'+(best?' is-best':'')} aria-pressed={sameFrames(layout)} disabled={busy} title={(layout.description||layout.name)+(lowResolution?' · alguma foto ficaria ampliada além da resolução dela':'')} onClick={()=>applyPhotoLayout(layout)}>
      <span className="dm-layout-thumb" style={{aspectRatio:currentRatio}}>{activePage>=0&&<em className="dm-layout-fold"/>}{thumbFrames(layout).map((f,i)=><i key={i} style={{left:f.x*100+'%',top:f.y*100+'%',width:f.w*100+'%',height:f.h*100+'%'}}/>)}</span>
      <strong>{layout.name}</strong>
      {best?<small className="dm-layout-flag best"><Sparkles size={11} aria-hidden="true"/>Melhor para suas fotos</small>:sameFrames(layout)?<small className="dm-layout-flag"><Check size={11} aria-hidden="true"/>Em uso</small>:lowResolution?<small className="dm-layout-flag warn"><CircleAlert size={11} aria-hidden="true"/>Pode perder nitidez</small>:null}
     </button>;
     return <><div className="dm-panel-title"><h2>Layouts</h2><span>Álbum {shape}</span></div>
      
      <h3 className="dm-tone-heading">Quantas fotos</h3>
      <div className="dm-count-chips" role="group" aria-label="Fotos nesta lâmina">{Array.from({length:10},(_,i)=>i+1).map(n=><button key={n} type="button" aria-pressed={layoutCount===n} onClick={()=>{setLayoutCount(n);if(pickedPhotos.length&&n<pickedPhotos.length)setPickedPhotos([])}}>{n}</button>)}</div>
      {!!pickedPhotos.length?<p className="dm-callout">As {pickedPhotos.length} fotos selecionadas serão colocadas no layout escolhido.</p>:photosHere>0&&photosHere!==layoutCount&&<p className="dm-muted dm-small">Esta {activePage<0?'capa':'lâmina'} tem {photosHere} {photosHere===1?'foto':'fotos'}. <button type="button" className="dm-link" onClick={()=>setLayoutCount(Math.min(10,photosHere))}>Ver layouts para {Math.min(10,photosHere)}</button></p>}
      {!!recommended.length&&<><h3 className="dm-tone-heading">Recomendados para suas fotos</h3><div className="dm-layout-grid">{recommended.map((item,i)=>card(item,i===0))}</div></>}
      <h3 className="dm-tone-heading">{rankedLayouts?'Outras opções':'Mais usados'}</h3>
      <div className="dm-layout-grid">{others.map(item=>card(item))}</div>
      <div className="dm-spacing"><h3>Respiro entre as fotos</h3>
       <div className="dm-spacing-presets" role="group" aria-label="Respiro pronto">{spacingPresets.map(p=><button key={p.label} type="button" disabled={!spread} aria-pressed={!!spread&&(spread.spacing?.marginMm??0)===p.margin&&(spread.spacing?.gapMm??2)===p.gap} onClick={()=>{if(spread)replaceSpread({...spread,spacing:{marginMm:p.margin,gapMm:p.gap}})}}>{p.label}</button>)}</div>
       <label>Margem externa <output>{((spread?.spacing?.marginMm||0)/10).toLocaleString('pt-BR')} cm</output><input aria-label="Margem externa em centímetros" type="range" min={0} max={Math.min(5,Math.min(currentSpec.widthMm*2,currentSpec.heightMm)*.02)} step={.05} disabled={!spread} value={(spread?.spacing?.marginMm||0)/10} onChange={e=>setSpacing('marginMm',Number(e.target.value)*10)}/></label>
       <label>Entre fotos <output>{((spread?.spacing?.gapMm??2)/10).toLocaleString('pt-BR')} cm</output><input aria-label="Espaço entre fotos em centímetros" type="range" min={0} max={Math.min(5,Math.min(currentSpec.widthMm*2,currentSpec.heightMm)*.01)} step={.05} disabled={!spread} value={(spread?.spacing?.gapMm??2)/10} onChange={e=>setSpacing('gapMm',Number(e.target.value)*10)}/></label>
      </div>
      <div className="dm-two"><button className="dm-button" onClick={addFrame} disabled={busy||(spread?.slots.length||0)>=12}><Plus size={15}/>Quadro</button><button className="dm-button" onClick={saveLayout} disabled={busy||!spread}><Save size={15}/>Salvar layout</button></div>
      {!!savedLayouts.length&&<><h3>Meus layouts</h3>{savedLayouts.map(l=><div className="dm-saved-layout" key={l.id}><button disabled={busy} onClick={()=>useSavedLayout(l.spread)}>{l.name}<span>{l.spread.slots.length} fotos</span></button><button className="dm-icon" aria-label={`Excluir layout ${l.name}`} onClick={()=>{try{const next=savedLayouts.filter(v=>v.id!==l.id);localStorage.setItem('zangraf-personal-layouts-v1',JSON.stringify(next));setSavedLayouts(next)}catch{setNotice('Não foi possível remover o layout.')}}}><Trash2 size={14}/></button></div>)}</>}</>;})()}
    {panel==='text'&&(()=>{
     const pickFont=(family:AlbumFont)=>{if(selectedText)updateText(selectedText.id,{fontFamily:family});else addText('title',family);};
     const fontButton=(font:typeof ALBUM_FONTS[number])=><button key={font.family} type="button" aria-pressed={selectedText?.fontFamily===font.family} disabled={busy||(!selectedText&&texts.length>=20)} title={selectedText?`Usar ${font.family} no texto selecionado`:`Adicionar texto em ${font.family}`} onClick={()=>pickFont(font.family)}><span style={{fontFamily:`"${font.family}"`}}>{font.label}</span><small>{font.style} · {font.family}</small></button>;
     return <><div className="dm-panel-title"><h2>Palavras que ficam</h2><Type size={18}/></div>
      <button className="dm-button primary full" disabled={busy||texts.length>=20} onClick={()=>addText()}><Plus size={18}/>Adicionar texto</button>
      {selectedText?<label>Seu texto<textarea autoFocus rows={3} maxLength={600} value={selectedText.text} onChange={e=>updateText(selectedText.id,{text:e.target.value})}/></label>:null}
      {texts.length>1&&<><h3 className="dm-tone-heading">Textos nesta {activePage<0?'capa':'lâmina'}</h3>{texts.map(t=><button className={'dm-text-list '+(textId===t.id?'active':'')} key={t.id} onClick={()=>setTextId(t.id)}><Type size={14}/>{t.text||'Texto vazio'}</button>)}</>}
      <h3 className="dm-tone-heading">{selectedText?'Trocar a fonte':'Fontes principais'}</h3>
      <div className="dm-font-presets">{ALBUM_FONTS.slice(0,8).map(fontButton)}</div>
      {FONT_GROUPS.map(group=><details key={group} className="dm-font-group"><summary>{group}<span>{fontsInGroup(group).length}</span></summary><div className="dm-font-presets">{fontsInGroup(group).map(fontButton)}</div></details>)}
      {activePage<0&&!cover.customText&&<details><summary>Texto da capa anterior</summary><label>Título<input value={cover.title} onChange={e=>edit({...project,[backMode?'backCover':'cover']:{...cover,title:e.target.value}})}/></label><label>Subtítulo<input value={cover.subtitle} onChange={e=>edit({...project,[backMode?'backCover':'cover']:{...cover,subtitle:e.target.value}})}/></label><button className="dm-button" onClick={()=>edit({...project,[backMode?'backCover':'cover']:{...cover,customText:true}})}>Usar somente os novos textos</button></details>}</>;})()}
    {panel==='icons'&&<>{(()=>{const categories=['Todos','Casamento','Festa','Bebê e família','Momentos'];const short=['Todos','Casamento','Festa','Família','Momentos'];const colors=['var(--zg-red)','var(--zg-green)','var(--zg-yellow)','var(--zg-blue)','var(--zg-magenta)'];const active=Math.max(0,categories.indexOf(iconCategory));
      return <div className="dm-icon-tabs" role="tablist" aria-label="Categorias de ícones" style={{'--active':active,'--active-color':colors[active]} as CSSProperties}>{categories.map((category,i)=><button key={category} type="button" role="tab" data-color={i} title={category} aria-selected={category===iconCategory} onClick={()=>setIconCategory(category)}><i aria-hidden="true"/><span className="dm-tab-word" key={category===iconCategory?'on':'off'} aria-label={short[i]}>{Array.from(short[i]).map((ch,k)=><b key={k} aria-hidden="true" style={{['--k' as string]:k}}>{ch}</b>)}</span></button>)}</div>;})()}<div className="dm-search dm-icon-search"><Search size={15}/><input aria-label="Buscar ícones" placeholder="Buscar ícone (ex.: coração, bolo)" value={iconSearch} onChange={e=>setIconSearch(e.target.value)}/></div><div className="dm-icon-grid" key={iconCategory}>{ALBUM_ICONS.filter(i=>(iconCategory==='Todos'||i.category===iconCategory)&&i.label.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(iconSearch.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim())).map((icon,order)=><button key={icon.id} style={{'--i':Math.min(order,24)} as CSSProperties} title={icon.label} aria-label={`Adicionar ícone ${icon.label}`} disabled={icons.length>=30} onClick={()=>addIcon(icon.id)}><DecorativeIcon kind={icon.id}/><small>{icon.label}</small></button>)}</div></>}
    {panel==='background'&&<><div className="dm-category-tabs dm-bg-tabs"><button aria-pressed={backgroundTab==='colors'} onClick={()=>setBackgroundTab('colors')}>Cores e texturas</button><button aria-pressed={backgroundTab==='themes'} onClick={()=>{setBackgroundTab('themes');setThemeOpen(null)}}>Temas de álbum</button></div>
     {backgroundTab==='themes'?(()=>{const theme=ALBUM_THEMES.find(t=>t.id===themeOpen);
      if(!theme)return <div className="dm-theme-list">{ALBUM_THEMES.map((t,i)=>{const c=t.covers[0];return <button key={t.id} type="button" className="dm-theme-card" style={{['--i' as string]:i}} onClick={()=>setThemeOpen(t.id)}><span className="dm-theme-cover" style={{background:c.color,color:c.ink,...(c.surface?{backgroundImage:`url(${surfaceUrl(c.surface,true)})`}:{})}}><b style={{fontFamily:`"${c.font}"`}}>{c.title}</b><small style={{fontFamily:`"${c.subFont}"`}}>{c.subtitle}</small></span><strong>{t.name}</strong><small>{t.subtitle}</small></button>})}</div>;
      return <div className="dm-theme-detail" key={theme.id}>
       <button type="button" className="dm-theme-back" onClick={()=>setThemeOpen(null)}><ChevronLeft size={16}/>Temas</button>
       <h3>{theme.name}</h3><p className="dm-muted">Só o fundo e a capa mudam. Suas fotos e a montagem continuam.</p>
       <span className="dm-theme-label">Capas prontas</span>
       <div className="dm-theme-covers">{theme.covers.map((c,i)=><button key={c.name} type="button" style={{['--i' as string]:i}} onClick={()=>applyThemeCoverOption(theme.id,i)}><span className="dm-theme-cover" style={{background:c.color,color:c.ink,...(c.surface?{backgroundImage:`url(${surfaceUrl(c.surface,true)})`}:{})}}><b style={{fontFamily:`"${c.font}"`}}>{c.title}</b><small style={{fontFamily:`"${c.subFont}"`}}>{c.subtitle}</small></span><strong>{c.name}</strong></button>)}</div>
       <span className="dm-theme-label">Fundo das lâminas</span>
       <button type="button" className="dm-theme-pages" onClick={()=>applyThemePages(theme.id)}><span style={{background:theme.page.color,...(theme.page.surface?{backgroundImage:`url(${surfaceUrl(theme.page.surface,true)})`}:{})}} className={'texture-swatch '+(theme.page.texture||'none')}/><span><strong>Aplicar em todas as lâminas</strong><small>As fotos não mudam de lugar</small></span></button>
      </div>;})():<>
     <div className="dm-color-grid dm-ink-swatches">{palette.map((color,i)=><button key={color} style={{background:color,['--i' as string]:i}} aria-label={`Fundo ${color}`} aria-pressed={(activePage<0?cover.color:spread?.background||'#ffffff')===color&&!(activePage<0?cover.backgroundPhotoId:spread?.backgroundPhotoId)} onClick={()=>setBackground(color)}/>)}</div>
     <label className="dm-color-input">Escolher outra cor<input type="color" value={activePage<0?cover.color:spread?.background||'#ffffff'} onChange={e=>setBackground(e.target.value)}/></label>
     {(()=>{const bgId=activePage<0?cover.backgroundPhotoId:spread?.backgroundPhotoId;const thumb=bgId?thumbUrls[bgId]:undefined;
      return <div className={'dm-bg-image'+(thumb?' has-image':'')}>
       <input ref={bgInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e=>void importBackground(e.target.files?.[0])}/>
       {thumb?<><span className="dm-bg-thumb" style={{backgroundImage:`url(${thumb})`}}/><span className="dm-bg-actions"><strong>Imagem de fundo</strong>{activePage>=0&&<button type="button" className="dm-link" onClick={()=>setBackgroundImage(bgId,true)}>Usar em todas as lâminas</button>}<button type="button" className="dm-link" onClick={()=>bgInput.current?.click()}>Trocar imagem</button></span><button type="button" className="dm-icon" aria-label="Tirar imagem de fundo" onClick={()=>setBackgroundImage(undefined)}><X size={15}/></button></>
       :<button type="button" className="dm-bg-import" disabled={busy} onClick={()=>bgInput.current?.click()}><ImagePlus size={20}/><span><strong>Importar imagem de fundo</strong><small>JPG, PNG ou WebP</small></span></button>}
      </div>;})()}
     {(()=>{const current=activePage<0?cover.surface:spread?.surface;return <>
      <button type="button" role="switch" className={'dm-surface-none'+(current?'':' is-active')} aria-checked={!current} onClick={()=>setSurface(undefined)}><span className="dm-switch" aria-hidden="true"><i/></span><span>Sem superfície</span><em key={current?'off':'on'}>{current?'Desligado':'Ligado'}</em></button>
      {SURFACE_GROUPS.map(group=><div key={group} className="dm-surface-group"><span>{group}</span><div className="dm-surface-grid">{SURFACES.filter(s=>s.group===group).map((s,i)=><button key={s.id} type="button" aria-pressed={current===s.id} title={s.name} style={{['--i' as string]:i}} onClick={()=>setSurface(s.id)}><span style={{backgroundImage:`url(${surfaceUrl(s.id,true)})`}}/><small>{s.name}</small></button>)}</div></div>)}
      {activePage>=0&&<button type="button" className="dm-button full" onClick={()=>surfaceForAll(current)}>{current?'Usar esta superfície em todas as lâminas':'Tirar a superfície de todas as lâminas'}</button>}</>;})()}
      <h3>Texturas</h3><div className="dm-texture-grid">{TEXTURES.map(t=><button key={t.id} aria-pressed={texture===t.id} onClick={()=>changeTexture(t.id)}><span className={'texture-swatch '+t.id} style={{backgroundColor:activePage<0?cover.color:spread?.background||'#ffffff'}}/><small>{t.name}</small></button>)}</div></>}</>}
   </div></aside>
   <section className="dm-workbench" aria-label="Área de edição">
    <button type="button" className="dm-panel-handle" aria-controls="dm-tool-panel" aria-expanded={panelOpen} aria-label={panelOpen?'Recolher painel':'Abrir painel'} title={panelOpen?'Clique ou arraste para a esquerda para recolher':'Clique ou arraste para a direita para abrir'} style={handleDx?{transform:`translate(${handleDx}px,-50%)`}:undefined}
     onPointerDown={e=>{if(e.button!==0)return;handleStart.current=e.clientX;handleDragged.current=false;e.currentTarget.setPointerCapture(e.pointerId)}}
     onPointerMove={e=>{if(handleStart.current===null)return;const dx=e.clientX-handleStart.current;if(Math.abs(dx)>5)handleDragged.current=true;setHandleDx(panelOpen?Math.max(-80,Math.min(0,dx)):Math.max(0,Math.min(80,dx)))}}
     onPointerUp={e=>{const start=handleStart.current;handleStart.current=null;setHandleDx(0);if(start===null||!handleDragged.current)return;const dx=e.clientX-start;if(panelOpen?dx<-30:dx>30)setPanelOpen(v=>!v)}}
     onPointerCancel={()=>{handleStart.current=null;setHandleDx(0)}}
     onClick={()=>{if(handleDragged.current){handleDragged.current=false;return}setPanelOpen(v=>!v)}}>{panelOpen?<ChevronLeft size={16}/>:<ChevronRight size={16}/>}</button>
    {activePage<0&&showMarginNotice&&<aside className={'dm-side-notice'+(noticeLeaving?' is-leaving':'')} role="note" aria-label="Aviso de margem"><Info size={16} aria-hidden="true"/><p>{coverMarginDescription(coverMargins)}</p><span className="dm-notice-timer" aria-hidden="true" onAnimationEnd={e=>{if(e.animationName==='dm-notice-countdown')closeMarginNotice()}}/><button type="button" className="dm-icon" aria-label="Fechar aviso de margem" onClick={closeMarginNotice}><X size={14}/></button></aside>}
    <div className={'dm-contextbar'+((frameFocus&&(activePage>=0||coverHasPhoto))||selectedText||selectedIcon?' is-open':' is-hidden')} aria-hidden={!((frameFocus&&(activePage>=0||coverHasPhoto))||selectedText||selectedIcon)}><div><strong>{selectedIcon?'Editar ícone':selectedText?'Editar texto':title}</strong></div><div className="dm-context-actions">{selectedIcon?<>
      <label className="dm-color-swatch" title="Cor do ícone"><span style={{background:selectedIcon.color}}/><input type="color" aria-label="Cor do ícone" value={selectedIcon.color} onChange={e=>updateIcon(selectedIcon.id,{color:e.target.value})}/></label>
      <span className="dm-bar-divider"/>
      <div className="dm-size-control" title="Tamanho do ícone"><button type="button" className="dm-icon" aria-label="Diminuir ícone" onClick={()=>setIconSize(selectedIcon.sizeMm-2)}><Minus size={14}/></button><span className="dm-size-value">{(selectedIcon.sizeMm/10).toLocaleString('pt-BR',{maximumFractionDigits:1})} cm</span><button type="button" className="dm-icon" aria-label="Aumentar ícone" onClick={()=>setIconSize(selectedIcon.sizeMm+2)}><Plus size={14}/></button></div>
      <div className="dm-size-control" title="Girar ícone"><button type="button" className="dm-icon" aria-label="Girar para a esquerda" onClick={()=>updateIcon(selectedIcon.id,{rotation:Math.max(-180,selectedIcon.rotation-15)})}><RotateCcw size={14}/></button><span className="dm-size-value">{selectedIcon.rotation}°</span><button type="button" className="dm-icon" aria-label="Girar para a direita" onClick={()=>updateIcon(selectedIcon.id,{rotation:Math.min(180,selectedIcon.rotation+15)})}><RotateCw size={14}/></button></div>
      <span className="dm-bar-divider"/>
      <button type="button" className="dm-icon" aria-label="Duplicar ícone" title="Duplicar · Ctrl/⌘ D" disabled={icons.length>=30} onClick={duplicateSelected}><Copy size={16}/></button>
      <button type="button" className="dm-icon" aria-label="Excluir ícone" title="Excluir · Delete" onClick={()=>{updateIcons(icons.filter(i=>i.id!==selectedIcon.id));setIconId(undefined)}}><Trash2 size={16}/></button>
      <button className="dm-button small" onClick={()=>setIconId(undefined)}>Concluir<Check size={14}/></button></>:selectedText?<><select aria-label="Fonte do texto" className="dm-toolbar-font" value={selectedText.fontFamily} style={{fontFamily:`"${selectedText.fontFamily}"`}} onFocus={()=>void Promise.all(ALBUM_FONTS.map(f=>ensureFont(f.family))).catch(()=>undefined)} onChange={e=>updateText(selectedText.id,{fontFamily:e.target.value as AlbumText['fontFamily']})}><optgroup label="Principais">{ALBUM_FONTS.slice(0,MAIN_FONT_COUNT).map(f=><option key={f.family} value={f.family}>{f.family}</option>)}</optgroup>{FONT_GROUPS.map(group=><optgroup key={group} label={group}>{fontsInGroup(group).map(f=><option key={f.family} value={f.family}>{f.family}</option>)}</optgroup>)}</select>
      <div className="dm-size-control"><button type="button" className="dm-icon" aria-label="Diminuir tamanho" onClick={()=>updateText(selectedText.id,{fontSize:Math.max(8,selectedText.fontSize-2)})}><Minus size={14}/></button><input className="dm-toolbar-size" aria-label="Tamanho do texto em pontos" type="number" min={8} max={144} value={selectedText.fontSize} onChange={e=>updateText(selectedText.id,{fontSize:Math.max(8,Math.min(144,Number(e.target.value)||8))})}/><button type="button" className="dm-icon" aria-label="Aumentar tamanho" onClick={()=>updateText(selectedText.id,{fontSize:Math.min(144,selectedText.fontSize+2)})}><Plus size={14}/></button></div>
      <span className="dm-bar-divider"/>
      <button type="button" className="dm-icon" aria-label="Negrito" title="Negrito" aria-pressed={selectedText.bold} onClick={()=>updateText(selectedText.id,{bold:!selectedText.bold})}><Bold size={16}/></button>
      <button type="button" className="dm-icon" aria-label="Itálico" title="Itálico" aria-pressed={selectedText.italic} onClick={()=>updateText(selectedText.id,{italic:!selectedText.italic})}><Italic size={16}/></button>
      <button type="button" className="dm-icon" aria-label={`Alinhamento: ${selectedText.align==='left'?'à esquerda':selectedText.align==='right'?'à direita':'centro'}. Clique para trocar`} title="Alinhamento" onClick={()=>updateText(selectedText.id,{align:selectedText.align==='left'?'center':selectedText.align==='center'?'right':'left'})}>{selectedText.align==='left'?<AlignLeft size={16}/>:selectedText.align==='right'?<AlignRight size={16}/>:<AlignCenter size={16}/>}</button>
      <button type="button" className="dm-icon" aria-label={selectedText.rotation===90?'Deixar o texto na horizontal':'Deixar o texto na vertical (dorso)'} title="Texto na vertical (dorso)" aria-pressed={selectedText.rotation===90} onClick={()=>updateText(selectedText.id,{rotation:selectedText.rotation===90?0:90})}><RotateCw size={16}/></button>
      <label className="dm-color-swatch" title="Cor do texto"><span style={{background:selectedText.color}}/><input type="color" aria-label="Cor do texto" value={selectedText.color} onChange={e=>updateText(selectedText.id,{color:e.target.value})}/></label>
      <span className="dm-bar-divider"/>
      <button type="button" className="dm-icon" aria-label="Duplicar texto" title="Duplicar · Ctrl/⌘ D" onClick={duplicateSelected}><Copy size={16}/></button>
      <button type="button" className="dm-icon" aria-label="Excluir texto" title="Excluir · Delete" onClick={()=>{updateTexts(texts.filter(t=>t.id!==selectedText.id));setTextId(undefined)}}><Trash2 size={16}/></button>
      <button className="dm-button small" onClick={()=>{setTextId(undefined);setPanel('photos')}}>Concluir<Check size={14}/></button></>:<>{spread&&<div className="dm-segment-inline" role="group" aria-label="Modo de edição"><button type="button" className="dm-tool-mode" aria-label="Enquadrar foto" title="Arraste a foto dentro do quadro para enquadrar" aria-pressed={photoMode==='crop'} onClick={()=>setPhotoMode('crop')}><Crop size={15}/>Enquadrar</button><button type="button" className="dm-tool-mode" aria-label="Mover" title="Mover a foto pela lâmina e mudar o tamanho" aria-pressed={photoMode==='position'} onClick={()=>setPhotoMode('position')}><MousePointer2 size={15}/>Mover</button></div>}
     {selectedPhoto&&<><label className="dm-inline-range" title="Zoom da foto"><ZoomIn size={15} aria-hidden="true"/><input aria-label="Zoom da foto" type="range" min="1" max="3" step=".02" value={slot.zoom||1} onChange={e=>updateSlot({zoom:Number(e.target.value)})}/></label><button className="dm-button small" title="Escolher o ponto principal da foto, como um rosto" onClick={()=>setFocusOpen(true)}><Focus size={15}/>Foco</button><button type="button" className="dm-icon dm-frame-remove" aria-label="Tirar a foto deste quadro" title="Tirar a foto deste quadro (ela continua na biblioteca)" onClick={()=>{updateSlot(emptySlot())}}><Trash2 size={17}/></button></>}
     <div className="dm-position-control"><button className="dm-icon" aria-label="Mais opções" title="Mais opções" aria-haspopup="menu" aria-expanded={positionOpen} onClick={()=>setPositionOpen(v=>!v)}><Ellipsis size={19}/></button>{positionOpen&&<div className="dm-position-menu dm-more-menu" role="menu">
      {selectedPhoto&&<><strong>Foto</strong><button role="menuitemcheckbox" aria-checked={!!slot.flipX} onClick={()=>updateSlot({flipX:!slot.flipX})}><FlipHorizontal2 size={15}/>Espelhar na horizontal{slot.flipX&&<Check size={14}/>}</button><button role="menuitemcheckbox" aria-checked={!!slot.flipY} onClick={()=>updateSlot({flipY:!slot.flipY})}><FlipVertical2 size={15}/>Espelhar na vertical{slot.flipY&&<Check size={14}/>}</button><button role="menuitem" onClick={()=>{updateSlot({x:50,y:50,zoom:1});setPositionOpen(false)}}><RotateCcw size={15}/>Centralizar e tirar o zoom</button><button role="menuitem" className="danger" onClick={()=>{updateSlot(emptySlot());setPositionOpen(false)}}><ImageOff size={15}/>Tirar a foto do quadro</button></>}
      {spread&&<><strong>Quadro</strong><button role="menuitem" disabled={spread.slots.length>=12} onClick={()=>{duplicateSelected();setPositionOpen(false)}}><Copy size={15}/>Duplicar quadro<kbd>Ctrl D</kbd></button><button role="menuitem" onClick={()=>{reorderFrame(true);setPositionOpen(false)}}><Layers3 size={15}/>Trazer para frente</button><button role="menuitem" onClick={()=>{reorderFrame(false);setPositionOpen(false)}}><Layers3 size={15}/>Enviar para trás</button><button role="menuitem" className="danger" disabled={spread.slots.length<=1} onClick={()=>{removeFrame();setPositionOpen(false)}}><Trash2 size={15}/>Excluir quadro</button>
       <strong>Alinhar à lâmina</strong><div className="dm-align-grid">{(['left','center','right','top','middle','bottom'] as const).map((alignment,i)=><button key={alignment} role="menuitem" onClick={()=>alignFrame(alignment)}>{['Esquerda','Centro','Direita','Topo','Meio','Base'][i]}</button>)}</div></>}
      <hr/><button role="menuitem" onClick={()=>{addText();setPositionOpen(false)}}><Type size={15}/>Adicionar texto</button>
     </div>}</div></>}</div></div>
    {activePage<0&&!spread&&selectedPhoto&&!selectedText&&<div className="dm-cover-crop"><label>Horizontal<input type="range" min="0" max="100" value={slot.x} onChange={e=>updateSlot({x:Number(e.target.value)})}/></label><label>Vertical<input type="range" min="0" max="100" value={slot.y} onChange={e=>updateSlot({y:Number(e.target.value)})}/></label></div>}
    {activePage===-1&&wrapMode&&spineMm>0&&coverHasPhoto&&<div className="dm-cover-region-tools"><span>Dorso central: <strong>{formatCm(spineMm)} cm</strong></span><button type="button" role="switch" aria-checked={coverIsSingle} className={'dm-cover-single'+(coverIsSingle?' is-active':'')} onClick={toggleSingleCover}><span className="dm-switch" aria-hidden="true"><i/></span>Capa inteira</button><button onClick={addSpineText}><Type size={14}/>Texto no dorso</button></div>}
    <div className="dm-canvas-area">
    {replaceTarget!==null&&(()=>{const current=spread?.slots[replaceTarget]?.photoId||(activePage<0&&!spread?cover.photo.photoId:null);const list=[...library].sort((a,b)=>Number(usedIds.has(a.id))-Number(usedIds.has(b.id)));
     return <div className="dm-replace-layer" onPointerDown={e=>{if(e.target===e.currentTarget)setReplaceTarget(null)}}><section className="dm-replace-picker" role="dialog" aria-label="Trocar foto">
      <header><RefreshCw size={18} aria-hidden="true"/><h3>Trocar foto</h3><button type="button" className="dm-icon" aria-label="Fechar" onClick={()=>setReplaceTarget(null)}><X size={16}/></button></header>
      <div className="dm-replace-grid">{list.map(photo=><button type="button" key={photo.id} className={(photo.id===current?'is-current ':'')+(usedIds.has(photo.id)?'is-used':'')} disabled={photo.id===current} title={photo.name} onClick={()=>replaceWith(photo.id)}><img src={thumbUrls[photo.id]} alt={photo.name} draggable={false}/>{photo.id===current&&<span>Atual</span>}</button>)}</div>
      <button type="button" className="dm-replace-upload" disabled={busy} onClick={()=>fileInput.current?.click()}><Upload size={16}/>{busy?'Carregando…':'Enviar nova foto'}</button>
     </section></div>;})()}
    <div className="dm-canvas-scroll" ref={canvasViewport} onPointerDownCapture={e=>{const t=e.target as HTMLElement;if(t.closest('.zg-frame,.zg-cover-photo'))setFrameFocus(true);else if(!t.closest('.dm-paper-wrap .zg-spread,.dm-paper-wrap .zg-cover,.dm-contextbar,.zg-text-hit,.zg-icon-hit,button,input')){setFrameFocus(false);setTextId(undefined);setIconId(undefined);setPositionOpen(false)}}} onDragOver={e=>{if(activePage>=0&&e.dataTransfer.types.includes('application/x-zangraf-photo'))e.preventDefault()}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/x-zangraf-photo');if(id)appendPhoto(id)}}><div className="dm-canvas-center"><div className="dm-paper-wrap" style={{width:Math.max(140,Math.min(workspaceSize.width-56,(workspaceSize.height-60)*currentRatio,2000))*zoom/100}}><div className="dm-page-caption"><span>{title}</span><span>{activePage<0?specLabel(currentSpec,true):specLabel(currentSpec,true,true)}</span></div>{activePage<0?<div className="dm-cover-stage"><AlbumCover cover={cover} urls={urls} spec={currentSpec} ratio={currentRatio} back={backMode} guides={false} selected={textId||iconId||!frameFocus?undefined:slotIndex} onSelect={i=>{setSlotIndex(i);setTextId(undefined);setIconId(undefined)}} mode={photoMode} onPhotoDrop={(id,i)=>dropPhoto(i??slotIndex,id,false)} onSlotChange={(i,patch)=>updateSlot(patch,i)} onFrameChange={updateFrame} onSlotSwap={swapSlots} onReplaceRequest={requestReplace} photoSizes={photoSizes} onCropRequest={()=>setPhotoMode('crop')} {...textProps}/>{guides&&<CoverFinishingGuides spec={currentSpec} margins={coverMargins}/>}
{wrapMode&&spineMm>0&&guides&&<div className="dm-spine-guide" aria-label={`Dorso de ${formatCm(spineMm)} cm`} style={{left:(50-spineMm/currentSpec.widthMm*50)+'%',width:(spineMm/currentSpec.widthMm*100)+'%'}}><span>DORSO</span></div>}</div>:<AlbumSpread spread={spread!} urls={urls} spec={currentSpec} ratio={currentRatio} guides={guides} mode={photoMode} selected={textId||iconId||!frameFocus?undefined:slotIndex} onSelect={index=>{setSlotIndex(index);setTextId(undefined);setIconId(undefined)}} onPhotoDrop={(index,id)=>dropPhoto(index,id,false)} onSlotChange={(index,patch)=>updateSlot(patch,index)} onFrameChange={updateFrame} onSlotSwap={swapSlots} onReplaceRequest={requestReplace} photoSizes={photoSizes} onCropRequest={()=>setPhotoMode('crop')} {...textProps}/>}{activePage<0&&wrapMode&&<div className="dm-cover-labels"><span>VERSO</span><span>DORSO · CENTRO</span><span>FRENTE</span></div>}</div></div></div>
    </div>
    <div className="dm-pages-toolbar"><div><button className="dm-icon" title="Lâmina anterior" aria-label="Lâmina anterior" disabled={activePage===pageIndices[0]} onClick={previousPage}><ChevronLeft size={17}/></button><strong>{title}</strong><button className="dm-icon" title="Lâmina seguinte" aria-label="Próxima lâmina" disabled={activePage===pageIndices.at(-1)} onClick={nextPage}><ChevronRight size={17}/></button></div><button type="button" className={'dm-strip-toggle'+(stripCollapsed?' is-collapsed':'')} aria-expanded={!stripCollapsed} aria-label={stripCollapsed?'Mostrar as lâminas maiores':'Mostrar as lâminas menores'} title={stripCollapsed?'Mostrar as lâminas maiores':'Mostrar as lâminas menores'} onClick={()=>setStripCollapsed(v=>!v)}><ChevronUp size={15}/><span>Lâminas</span></button></div>
    <div className={'dm-strip-wrap'+(stripCollapsed?' is-collapsed':'')}>
<nav className="dm-filmstrip" aria-label="Lâminas do álbum">{pageIndices.map(index=>{const s=projectSpec(project,index);return <button key={index} aria-current={activePage===index?'page':undefined} className={activePage===index?'active':''} onClick={()=>selectPage(index)}><span className={'dm-thumb '+(index<0?'cover':'')}>{index<0?<AlbumCover compact cover={index===-1?frontCover:backCover} urls={urls} spec={s} ratio={s.widthMm/s.heightMm} back={index===-2}/>:<AlbumSpread compact spread={project.spreads[index]} urls={urls} spec={s} ratio={s.widthMm*2/s.heightMm}/>}</span><small>{index===-1?'Capa':index===-2?'Verso':`Lâmina ${String(index+1).padStart(2,'0')}`}</small>{pageFlags.has(index)&&<i className={'dm-thumb-flag '+pageFlags.get(index)} title={pageFlags.get(index)==='error'?'Há pontos para corrigir nesta lâmina':'Há pontos para conferir nesta lâmina'}/>}</button>})}</nav></div>
    <footer className="dm-bottom"><label className="dm-checkbox"><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/>Guias de segurança</label><span>{project.spreads.length} lâminas</span><div className="dm-zoom"><button className="dm-icon" aria-label="Diminuir zoom da lâmina" onClick={()=>setZoom(v=>Math.max(40,v-10))}><Minus size={15}/></button><input aria-label="Zoom da lâmina" type="range" min="40" max="180" step="10" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button className="dm-icon" aria-label="Aumentar zoom da lâmina" onClick={()=>setZoom(v=>Math.min(180,v+10))}><Plus size={15}/></button><span>{zoom}%</span><button className="dm-icon" aria-label="Ajustar lâmina à tela" onClick={()=>setZoom(100)}><Maximize size={16}/></button></div></footer>
   </section>
  </div>
  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Importar fotos" onChange={e=>void addPhotos(e.target.files)}/>
  <div className="sr-only" role="status" aria-live="polite">{notice}</div>
  {notice&&project&&<div className={'dm-toast'+(toastLeaving?' is-leaving':'')} aria-hidden="true" key={notice}><Info size={16} aria-hidden="true"/><p>{notice}</p><button type="button" tabIndex={-1} className="dm-icon" aria-label="Fechar aviso" onClick={closeToast}><X size={14}/></button><span className="dm-toast-timer" style={{['--toast-time' as string]:`${Math.min(12000,Math.max(4500,notice.length*65))/1000}s`}} onAnimationEnd={e=>{if(e.animationName==='dm-notice-countdown')closeToast()}}/></div>}
  {printOpen&&<section className="dm-export-popover" aria-label="Revisar álbum"><div className="dm-panel-title dm-review-title"><h2>Revisar</h2><button className="dm-icon" aria-label="Fechar revisão" onClick={()=>setPrintOpen(false)}><X size={20}/></button></div>{projectPrintError&&<p className="dm-error">{projectPrintError}</p>}<div className="dm-check" aria-label="Checagem antes da impressão">
   <div className={`dm-check-summary ${issueErrors?'error':issueWarnings?'warning':'ok'}`}>{issueErrors||issueWarnings?<CircleAlert size={20} aria-hidden="true"/>:<CircleCheck size={20} aria-hidden="true"/>}<div><strong>{issueErrors?`${issueErrors} ${issueErrors===1?'ponto para corrigir':'pontos para corrigir'}`:issueWarnings?'Nada grave, só alguns pontos para conferir':'Tudo certo para imprimir'}</strong><span>{issueErrors&&issueWarnings?`e ${issueWarnings} para conferir · `:''}{issues.length?'Clique num item para ir direto até ele.':'Conferimos resolução, dobra, margens, quadros e repetições.'}</span></div></div>
   {ISSUE_ORDER.map(kind=>{const list=issues.filter(i=>i.kind===kind);if(!list.length)return null;
    return <details key={kind} className={`dm-check-group ${list[0].level}`} open={list[0].level==='error'}>
     <summary><i aria-hidden="true"/>{ISSUE_INFO[kind].title}<em>{list.length}</em></summary>
     <ul>{list.slice(0,40).map((issue,i)=><li key={i}><button type="button" onClick={()=>goToIssue(issue)}><strong>{pageLabel(project,issue.page)}</strong><span>{issue.detail}</span><ArrowRight size={13} aria-hidden="true"/></button></li>)}</ul>
     {list.length>40&&<p>E mais {list.length-40}.</p>}
    </details>;})}
  </div><button className="dm-button primary full" disabled={busy||!!projectPrintError||!!formatError||!project.cartItemId} onClick={async()=>{if(await persist())window.location.assign('/carrinho')}}>Ir para o carrinho <ArrowRight size={16}/></button><button className="dm-link dm-preview-link" onClick={()=>{setPreviewPage(pageIndices[0]);setShowPreview(true);setPrintOpen(false)}}><Eye size={16}/>Ver prévia completa do álbum</button><ApprovalPanel project={project} busy={busy} onGoToPage={index=>{selectPage(index);setPrintOpen(false);}}/></section>}
  <dialog ref={previewDialog} className={'dm-preview-dialog'+(shareOpen?' is-sharing':'')} onCancel={()=>setShowPreview(false)} onClose={()=>{setShowPreview(false);setShareOpen(false)}} aria-label="Prévia do álbum"><header><h2>{project.name}</h2><button className="dm-icon dm-preview-close" aria-label="Fechar prévia" onClick={()=>setShowPreview(false)}><X size={20}/></button></header>
   <div className="dm-preview-body">{showPreview&&<AlbumFlipbook project={project} urls={urls} index={previewPage} onChange={setPreviewPage}/>}
    {shareOpen&&<aside className="dm-share-sheet" aria-label="Enviar para o cliente aprovar"><button type="button" className="dm-icon dm-share-close" aria-label="Fechar" onClick={()=>setShareOpen(false)}><X size={16}/></button><ApprovalPanel project={project} busy={busy} onGoToPage={page=>setPreviewPage(page)}/></aside>}
   </div>
   <div className="dm-preview-checkout"><button type="button" className={'dm-button dm-share-toggle'+(shareOpen?' active':'')} aria-expanded={shareOpen} onClick={()=>setShareOpen(v=>!v)}><Send size={16}/>Enviar para o cliente aprovar</button><button className="dm-button primary dm-preview-order" disabled={busy||!!projectPrintError||!project.cartItemId} onClick={()=>void continueOrder()}>Continuar para o pedido <ArrowRight size={16}/></button></div></dialog>
  {focusOpen&&selectedPhoto&&urls[selectedPhoto.id]&&<PhotoFocus key={selectedPhoto.id+'-'+activePage+'-'+slotIndex} photo={selectedPhoto} url={urls[selectedPhoto.id]} slot={slot} width={spread?frameGeometry(spreadRectangles(spread)[slotIndex]||spreadRectangles(spread)[0],{...currentSpec,widthMm:currentSpec.widthMm*(activePage<0?.5:1)},activePage>=0,spread.spacing).image.w:currentSpec.widthMm} height={spread?frameGeometry(spreadRectangles(spread)[slotIndex]||spreadRectangles(spread)[0],{...currentSpec,widthMm:currentSpec.widthMm*(activePage<0?.5:1)},activePage>=0,spread.spacing).image.h:currentSpec.heightMm} onApply={updateSlot} onClose={()=>setFocusOpen(false)}/>}
 </div>;
}
