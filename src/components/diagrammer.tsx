'use client';
import {MAX_PHOTO_BYTES,checkAlbumCapacity} from '@/lib/album-capacity';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {coverSpineMm,coverRegions,photoLayouts,rankLayoutsForPhotos,type PhotoLayout} from '@/lib/album-layouts';
import { Sparkles, Focus, ShoppingBag, ArrowLeft, ArrowRight, Plus, Save, ImagePlus, Undo2, Redo2, Copy, Trash2, WandSparkles, Eye, X, Check, BookOpen, RotateCcw, Upload, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Type, Palette, LayoutTemplate, Settings2, Minus, Maximize, Search, Info, SunMoon, RotateCw, Images, MousePointer2, Crop, AlignLeft, AlignCenter, AlignRight, Bold, Italic, FlipHorizontal2, FlipVertical2, Layers3, CircleCheck, CircleAlert, Ellipsis, ImageOff, ZoomIn } from 'lucide-react';
import {checkAlbum,ISSUE_INFO,ISSUE_ORDER,pageLabel,type AlbumIssue} from '@/lib/album-check';
import {ALBUM_FONTS,FONT_GROUPS,MAIN_FONT_COUNT,ensureFont,fontsInGroup,type AlbumFont} from '@/lib/album-fonts';
import {ALBUM_ICONS,TEXTURES,SURFACES,SURFACE_GROUPS,surfaceUrl,type AlbumIcon,type TextureName,type SurfaceName} from '@/lib/album-decorations';
import {ALBUM_THEMES,applyAlbumTheme} from '@/lib/album-themes';
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
async function makePhotoPreview(bitmap:ImageBitmap,maxEdge:number):Promise<Blob>{
 const ratio=Math.min(1,maxEdge/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
 const context=canvas.getContext('2d');if(!context)throw new Error('Não foi possível preparar a prévia.');
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);
 try{return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Falha ao preparar prévia.')),'image/jpeg',.82));}
 finally{canvas.width=1;canvas.height=1;}
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
 const [filterUnused, setFilterUnused] = useState(false);
 const [photoSearch, setPhotoSearch] = useState('');
 const [showPreview, setShowPreview] = useState(false);
 const [previewPage, setPreviewPage] = useState(-1);
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
 const [photoMode,setPhotoMode]=useState<'crop'|'position'>('position');
 const [positionOpen,setPositionOpen]=useState(false);
 const [printOpen,setPrintOpen]=useState(false);
 // Avisos somem sozinhos depois de um tempo proporcional ao tamanho do texto (só com o álbum aberto).
 useEffect(()=>{
  if(!notice||!projectRef.current)return;
  const timer=window.setTimeout(()=>setNotice(''),Math.min(12000,Math.max(4500,notice.length*65)));
  return()=>window.clearTimeout(timer);
 },[notice]);
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
 const [dropAdds,setDropAdds]=useState(true);
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
 const [savedLayouts,setSavedLayouts]=useState<{id:string;name:string;spread:Spread}[]>([]);
 const fileInput = useRef<HTMLInputElement>(null);
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
  setNotice('Álbum salvo.');
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
  return () => {Object.values(next).forEach(URL.revokeObjectURL);Object.values(thumbs).forEach(URL.revokeObjectURL);};
 }, [project?.photos]);

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
  setBusy(true); setNotice('Abrindo suas fotos…');
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
    setNotice(`Importando foto ${index + 1} de ${incoming.length}…`);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > PHOTO_LIMIT) { rejected.push(file.name); continue; }
    try {
     const bitmap = await createImageBitmap(file);
     if (bitmap.width * bitmap.height > 40000000 || !bitmap.width || !bitmap.height) { bitmap.close(); rejected.push(file.name); continue; }
     try{
      const preview=await makePhotoPreview(bitmap,1600);
      const thumbnail=await makePhotoPreview(bitmap,240);
      const takenAt=await photoTakenAt(file);
      photos.push({id:crypto.randomUUID(),name:file.name,blob:file,preview,thumbnail,width:bitmap.width,height:bitmap.height,...(takenAt!==undefined?{takenAt}:{})});
     }finally{bitmap.close();}
     await new Promise<void>(resolve=>window.setTimeout(resolve,0));
    } catch { rejected.push(file.name); }
   }
   if (photos.length) {
    setPast(items => [...items.slice(-39), current]); setFuture([]);
    apply({ ...current, photos: [...current.photos, ...photos] });
   }
   setNotice(`${photos.length} foto(s) adicionada(s).${rejected.length ? ` ${rejected.length} arquivo(s) não foram importados: ${rejected.slice(0, 3).join(', ')}${rejected.length > 3 ? '…' : ''}. Use JPG, PNG ou WebP de até 50 MB e 40 megapixels.` : ' Arraste uma foto para o álbum ou selecione um quadro e clique na foto.'}`);
  } catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível importar as fotos.'); }
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
 const visiblePhotos = project.photos.filter(photo => (!filterUnused || !usedIds.has(photo.id)) && photo.name.toLocaleLowerCase('pt-BR').includes(photoSearch.toLocaleLowerCase('pt-BR')));
 const emptyCount = project.spreads.reduce((total, item) => total + item.slots.filter(frame => !frame.photoId).length, 0);
 const unusedCount = project.photos.filter(photo => !usedIds.has(photo.id)).length;
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
 function selectPage(index: number) { setActivePage(pageIndices.includes(index)?index:pageIndices[0]); if(index>=0&&project?.spreads[index])setLayoutCount(Math.min(10,Math.max(1,project.spreads[index].slots.filter(s=>s.photoId).length||project.spreads[index].slots.length))); setSlotIndex(0); setTextId(undefined);setIconId(undefined);setFocusOpen(false); setPositionOpen(false); }
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
  replaceSpread({...spread,id:spread?.id||crypto.randomUUID(),layout:'livre',frames:layout.frames,spacing:spread?.spacing||{marginMm:Math.round(Math.min(currentSpec.widthMm*2,currentSpec.heightMm)*(layout.marginRatio??.05)),gapMm:2},slots});
  setPickedPhotos([]);setSelectPhotos(false);setSlotIndex(0);setPhotoMode('crop');setTextId(undefined);
  setNotice('');
 }
 function appendPhoto(id:string){
  if(busy||activePage<0||!spread||!project!.photos.some(p=>p.id===id))return;
  const occupied=spread.slots.filter(s=>s.photoId);
  if(occupied.length>=10){setNotice('Esta composição já tem 10 fotos. Troque uma foto ou escolha outra lâmina.');return;}
  const added=[...occupied,{...emptySlot(),photoId:id}];
  // Layout inteligente: escolhe a composição cujos quadros combinam com fotos em pé e deitadas.
  const best=rankLayoutsForPhotos(photoLayouts(added.length,currentRatio),added.map(s=>aspectOf(s.photoId)),currentRatio,rankOptions(added.map(s=>s.photoId)))[0];
  const layout=best?.layout||photoLayouts(added.length,currentRatio)[0];
  const slots=best?best.order.map(i=>added[i]):added;
  replaceSpread({...spread,layout:'livre',frames:layout.frames,slots,spacing:spread.spacing||{marginMm:Math.round(currentSpec.heightMm*.08),gapMm:2}});
  setLayoutCount(slots.length);setSlotIndex(Math.max(0,slots.findIndex(s=>s.photoId===id)));setPhotoMode('crop');setTextId(undefined);setIconId(undefined);
  setNotice(`${slots.length} foto(s) na lâmina, no layout ${layout.name}, escolhido pelo formato das fotos. Veja outras composições em Layouts.`);
 }
 /** Troca duas fotos de lugar na mesma área, levando junto o enquadramento de cada uma. */
 function swapSlots(from:number,to:number){
  if(!spread||from===to||!spread.slots[from]||!spread.slots[to])return;
  const slots=[...spread.slots];[slots[from],slots[to]]=[slots[to],slots[from]];
  replaceSpread({...spread,slots});setSlotIndex(to);setTextId(undefined);setIconId(undefined);
  setNotice('Fotos trocadas de lugar. Use Desfazer para voltar.');
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
   setSlotIndex(2);setNotice('Capa separada em verso, dorso e frente. A foto ficou na frente.');
  }else{
   replaceSpread({id:spread?.id||crypto.randomUUID(),layout:'livre',frames:[{x:0,y:0,w:1,h:1}],slots:[{...photo}]});
   setSlotIndex(0);setNotice('A capa agora é uma foto só, do verso até a frente. Desfazer volta como estava.');
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
  setNotice(`${result.placed} foto(s) distribuída(s) nos quadros vazios. Suas escolhas anteriores foram preservadas.${result.remaining ? ` Restam ${result.remaining} foto(s) na biblioteca.` : ''}`);
  if (activePage < 0) selectPage(0);
 }
 /** "Montar o álbum para mim": ordena por data, separa em momentos, escolhe layouts e centraliza rostos. */
 async function autoBuildAlbum(){
  const current=projectRef.current;
  if(!current||busy||!current.photos.length||!current.spreads.length)return;
  if(current.spreads.some(s=>s.slots.some(slot=>slot.photoId))&&!window.confirm('Montar o álbum inteiro automaticamente? As fotos das lâminas serão reorganizadas (textos e capas continuam). Você pode desfazer depois.'))return;
  setBusy(true);
  try{
   const takenAt:Record<string,number|undefined>={};let found=0;
   for(const [i,photo] of current.photos.entries()){
    if(i%10===0)setNotice(`Lendo as datas das fotos… ${i} de ${current.photos.length}`);
    takenAt[photo.id]=photo.takenAt??await photoTakenAt(photo.blob);
    if(takenAt[photo.id]!==undefined)found++;
   }
   const faces=new Map<string,{x:number;y:number}>();
   if('FaceDetector' in window){
    for(const [i,photo] of current.photos.entries()){
     if(i%5===0)setNotice(`Procurando rostos para centralizar… ${i} de ${current.photos.length}`);
     const face=await largestFace(photo.preview||photo.blob);if(face)faces.set(photo.id,face);
    }
   }
   const sizes=new Map(current.photos.map(p=>[p.id,p]));
   const result=autoLayoutProject(current,takenAt,projectSpec(current,0),(id,slot,w,h)=>{
    const face=faces.get(id),photo=sizes.get(id);
    return face&&photo?.width&&photo.height?slotForFocus(slot,photo.width,photo.height,w,h,face):slot;
   });
   // Guarda as datas lidas para não precisar ler de novo.
   const photos=current.photos.map(p=>p.takenAt===undefined&&takenAt[p.id]!==undefined?{...p,takenAt:takenAt[p.id]}:p);
   setPast(items=>[...items.slice(-39),current]);setFuture([]);
   apply({...result.project,photos});
   setActivePage(0);setSlotIndex(0);setTextId(undefined);setIconId(undefined);
   const order=found===current.photos.length?'em ordem cronológica':found?`em ordem cronológica (${current.photos.length-found} sem data ficaram no fim)`:'na ordem em que foram importadas (as fotos não têm data)';
   setNotice(`Álbum montado: ${result.placed} fotos ${order}${result.moments>1?`, em ${result.moments} momentos`:''}.${result.leftover?` ${result.leftover} foto(s) não couberam e continuam na biblioteca.`:''} Ajuste o que quiser — Desfazer volta tudo.`);
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
  if(event.key==='Escape'){setIconId(undefined);setTextId(undefined);setPositionOpen(false);setPhotoMode('position');return;}
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();if(selectedIcon){updateIcons(icons.filter(i=>i.id!==selectedIcon.id));setIconId(undefined)}else if(selectedText){updateTexts(texts.filter(t=>t.id!==selectedText.id));setTextId(undefined)}else if(spread&&spread.slots.length>1)removeFrame();else if(slot?.photoId)updateSlot(emptySlot());return;}
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0;const amount=event.shiftKey?1:.2;
  if(selectedIcon){updateIcon(selectedIcon.id,{x:Math.max(0,Math.min(90,selectedIcon.x+dx*amount)),y:Math.max(0,Math.min(90,selectedIcon.y+dy*amount))})}
  else if(selectedText){updateText(selectedText.id,{x:Math.max(0,Math.min(100-selectedText.width,selectedText.x+dx*amount)),y:Math.max(0,Math.min(95,selectedText.y+dy*amount))})}
  else if(spread){const r=spreadRectangles(spread)[slotIndex];if(r)updateFrame(slotIndex,{...r,x:Math.max(0,Math.min(1-r.w,r.x+dx*amount/100)),y:Math.max(0,Math.min(1-r.h,r.y+dy*amount/100))});}
 }
 function setBackground(color:string,side:'all'|'right'='all'){
  // Escolher uma cor tira a textura de superfície, para a cor aparecer.
  if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,color,surface:undefined}});
  else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?(side==='right'?{...s,rightBackground:color}:{...s,background:color,rightBackground:undefined,surface:undefined}):s)});
 }
 /** Coloca uma textura fotográfica (mármore, linho, metal, papel) no fundo da área atual. */
 function setSurface(surface?:SurfaceName){
  if(activePage<0)edit({...project!,[backMode?'backCover':'cover']:{...cover,surface}});
  else edit({...project!,spreads:project!.spreads.map((s,i)=>i===activePage?{...s,surface,rightBackground:surface?undefined:s.rightBackground}:s)});
 }
 function surfaceForAll(surface?:SurfaceName){
  if(!window.confirm(surface?'Usar esta textura no fundo de todas as lâminas? Fotos e textos continuam. Você pode desfazer.':'Tirar a textura de todas as lâminas?'))return;
  edit({...project!,spreads:project!.spreads.map(s=>({...s,surface,rightBackground:surface?undefined:s.rightBackground}))});
  setNotice(surface?`Textura aplicada às ${project!.spreads.length} lâminas.`:'Texturas removidas das lâminas.');
 }
 function saveLayout(){if(!spread)return;const name=window.prompt('Nome deste layout:','Meu layout');if(!name?.trim())return;const next=[{id:crypto.randomUUID(),name:name.trim().slice(0,60),spread:{...spread,texts:activePage<0?cover.texts:spread.texts,background:activePage<0?cover.color:spread.background,slots:spread.slots.map(emptySlot)}},...savedLayouts].slice(0,20);try{localStorage.setItem('zangraf-personal-layouts-v1',JSON.stringify(next));setSavedLayouts(next);setNotice('Layout salvo neste navegador, sem as fotografias.')}catch{setNotice('Não foi possível salvar o layout neste navegador.')}}
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
 function applyTheme(id:string){const theme=ALBUM_THEMES.find(t=>t.id===id);if(!theme)return;if(!window.confirm(`Aplicar o tema ${theme.name} ao álbum inteiro? Os layouts e fundos serão atualizados. As fotos e textos existentes serão mantidos. Você pode desfazer.`))return;edit(applyAlbumTheme(project!,id));setSlotIndex(0);setTextId(undefined);setIconId(undefined);setNotice(`Tema ${theme.name} aplicado às ${project!.spreads.length} lâminas. Personalize os textos e distribua suas fotos.`);}
 function setSpacing(kind:'marginMm'|'gapMm',value:number){if(!spread)return;replaceSpread({...spread,spacing:{marginMm:spread.spacing?.marginMm??0,gapMm:spread.spacing?.gapMm??2,[kind]:value}});}
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
  setNotice(value?`Mesma tonalidade aplicada às ${count} fotos do álbum. Use Desfazer para voltar.`:`As ${count} fotos do álbum voltaram ao original.`);
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
  <header className="dm-topbar"><a href="/" className="dm-brand" aria-label="Voltar ao site Zangraf" onClick={async e=>{e.preventDefault();if(await persist())window.location.assign('/')}}><img className="zg-logo-day" src="/brand/zangraf.png" alt="Zangraf" width={112} height={60}/><span>GRÁFICA</span></a><div className="dm-top-divider"/><div className="dm-name"><input aria-label="Nome do álbum" value={project.name} maxLength={100} disabled={busy} onChange={e=>edit({...project,name:e.target.value})}/><span className={'dm-save '+saveState}><span/>{saveState==='saved'?'Salvo neste navegador':saveState==='saving'?'Salvando…':saveState==='error'?'Falha ao salvar':'Salvamento automático'}</span></div><div className="dm-top-actions"><div className="dm-top-tools"><button className="dm-icon" title="Salvar e voltar ao carrinho" aria-label="Salvar e voltar ao carrinho" onClick={async()=>{if(await persist())window.location.assign('/carrinho')}}><ShoppingBag size={18}/></button><button className="dm-icon" aria-label="Desfazer" title="Desfazer · Ctrl/⌘ Z" disabled={!past.length||busy} onClick={undo}><Undo2 size={19}/></button><button className="dm-icon" aria-label="Refazer" title="Refazer · Ctrl/⌘ Shift Z" disabled={!future.length||busy} onClick={redo}><Redo2 size={19}/></button></div><button className="dm-button dm-save-button" onClick={()=>void saveAlbum()} disabled={busy}><Save size={16}/><span>Salvar</span></button><button className="dm-button" disabled={busy} onClick={()=>{setPreviewPage(activePage);setShowPreview(true)}}><Eye size={17}/><span>Prévia 3D</span></button><button className="dm-button primary" disabled={busy} onClick={()=>setPrintOpen(v=>!v)}><ArrowRight size={17}/><span>Finalizar álbum</span>{!!issueErrors&&<b className="dm-check-badge" aria-label={`${issueErrors} pontos para corrigir`}>{issueErrors}</b>}</button></div></header>
  {saveError&&<div className="dm-error" role="alert">{saveError}<button onClick={()=>void persist()}>Tentar novamente</button></div>}
  <div className={`dm-body ${panelOpen?'':'panel-collapsed'}`}>
   <nav className="dm-rail" aria-label="Ferramentas do diagramador">{tabs.map(tab=><button key={tab.id} data-tab={tab.id} aria-pressed={panel===tab.id&&panelOpen} className={panel===tab.id&&panelOpen?'active':''} onClick={()=>{setPanelOpen(panel===tab.id?!panelOpen:true);setPanel(tab.id)}}><tab.icon size={23}/><span>{tab.label}</span></button>)}</nav>
   <aside className="dm-panel-slot" id="dm-tool-panel" aria-label={tabs.find(t=>t.id===panel)?.label} aria-hidden={!panelOpen} inert={!panelOpen}><div className="dm-panel" data-tab={panel} key={panel}>
    {panel==='photos'&&<><div className="dm-panel-title"><h2>Suas fotografias</h2><span>{project.photos.length}</span></div>
     {activePage>=0&&!!project.photos.length&&<div className="dm-segment" role="group" aria-label="Ao clicar numa foto"><span>Ao clicar numa foto</span><div><button type="button" aria-pressed={dropAdds} onClick={()=>setDropAdds(true)} title="A foto entra na lâmina e o layout se reorganiza">Acrescentar</button><button type="button" aria-pressed={!dropAdds} onClick={()=>setDropAdds(false)} title="A foto substitui a do quadro selecionado">Trocar no quadro</button></div></div>}
     
     <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Importar fotos" onChange={e=>void addPhotos(e.target.files)}/>
     <div className={project.photos.length>1&&albumFilled?'dm-upload-row':undefined}><button className={'dm-upload'+(project.photos.length?' compact':'')} title="JPG, PNG ou WebP · até 50 MB por foto · até 1.000 fotos por álbum" disabled={busy} onClick={()=>fileInput.current?.click()} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{e.preventDefault();void addPhotos(e.dataTransfer.files)}}><Upload size={project.photos.length?14:19}/><span>{project.photos.length?(albumFilled&&project.photos.length>1?'Mais fotos':'Adicionar mais fotos'):'Adicionar fotos'}{!project.photos.length&&<small>ou arraste os arquivos para cá</small>}</span></button>{project.photos.length>1&&albumFilled&&<button type="button" className="dm-rebuild" disabled={busy} title="Organiza de novo todas as fotos por data e escolhe novos layouts. Dá para desfazer." onClick={()=>void autoBuildAlbum()}><WandSparkles size={14}/>{busy?'Montando…':'Montar automático'}</button>}</div>
     {!project.photos.length&&<p className="dm-muted dm-small">JPG, PNG ou WebP · até 50 MB por foto</p>}
     {storageMb>1024&&<p className="dm-muted dm-small">{storageMb.toLocaleString('pt-BR',{maximumFractionDigits:0})} MB de 2.048 MB usados neste navegador</p>}
     {project.photos.length>1&&!albumFilled&&<div className="dm-autobuild"><div><strong><Sparkles size={15} aria-hidden="true"/>Montar o álbum para mim</strong><p>Organizamos suas {project.photos.length} fotos por data, separamos os momentos e escolhemos o layout de cada lâmina.</p></div><button className="dm-button primary full" disabled={busy} onClick={()=>void autoBuildAlbum()}><WandSparkles size={16}/>{busy?'Montando…':'Montar automaticamente'}</button></div>}
     {!!project.photos.length&&<div className="dm-photo-tools"><div className="dm-search"><Search size={15}/><input aria-label="Buscar fotos" placeholder="Buscar pelo nome" value={photoSearch} onChange={e=>setPhotoSearch(e.target.value)}/></div><button type="button" className="dm-chip" aria-pressed={filterUnused} title="Mostrar só as fotos que ainda não estão no álbum" onClick={()=>setFilterUnused(v=>!v)}>Não usadas<span>{unusedCount}</span></button><button type="button" className="dm-chip" aria-pressed={selectPhotos} title="Escolher várias fotos para montar uma lâmina" onClick={()=>{setSelectPhotos(v=>!v);setPickedPhotos([])}}>{selectPhotos?'Concluir seleção':'Selecionar várias'}</button></div>}{selectPhotos&&<div className="dm-multi-actions"><span>{pickedPhotos.length} de 10 selecionadas</span><button className="dm-button primary full" disabled={!pickedPhotos.length} onClick={()=>{setLayoutCount(pickedPhotos.length);setPanel('layouts')}}><LayoutTemplate size={16}/>Escolher layout para estas fotos</button></div>}<div className="dm-photos">{visiblePhotos.map(photo=><div className={'dm-photo'+(!selectPhotos&&usedIds.has(photo.id)?' is-used':'')} key={photo.id}><button aria-label={`Usar ${photo.name}`} title={photo.name} draggable={!busy} disabled={busy} onDragStart={e=>{e.dataTransfer.setData('application/x-zangraf-photo',photo.id);e.dataTransfer.effectAllowed='copy'}} aria-pressed={selectPhotos?pickedPhotos.includes(photo.id):undefined} onClick={()=>{if(selectPhotos){setPickedPhotos(ids=>ids.includes(photo.id)?ids.filter(id=>id!==photo.id):ids.length<10?[...ids,photo.id]:ids)}else{if(dropAdds&&activePage>=0)appendPhoto(photo.id);else assignPhoto(photo.id);setTextId(undefined)}}}><img src={thumbUrls[photo.id]} alt={photo.name} draggable={false} loading="lazy" decoding="async"/>{(selectPhotos?pickedPhotos.includes(photo.id):usedIds.has(photo.id))&&<span className="dm-used"><Check size={11}/></span>}</button><button className="dm-delete-photo" aria-label={`Remover ${photo.name}`} onClick={()=>{if(!usedIds.has(photo.id)||window.confirm('Remover esta foto também dos quadros onde ela aparece?'))edit(removePhoto(project,photo.id))}}><X size={12}/></button></div>)}</div>{!!project.photos.length&&!visiblePhotos.length&&<p className="dm-muted dm-small">Nenhuma foto encontrada com esse filtro.</p>}{!project.photos.length&&<div className="dm-empty"><ImagePlus size={40}/><h3>Sua história começa aqui</h3><p>Seu álbum fica pronto em três passos.</p><ol className="dm-steps"><li><span><strong>Adicione suas fotos</strong>Arraste os arquivos para o botão acima, de preferência os originais da câmera ou do celular.</span></li><li><span><strong>Monte o álbum para você</strong>Organizamos por data, separamos os momentos e escolhemos os layouts.</span></li><li><span><strong>Ajuste e finalize</strong>Troque fotos, escreva textos e confira tudo antes de imprimir.</span></li></ol></div>}{!!project.photos.length&&<div className="dm-photo-footer">{!!unusedCount&&!!emptyCount&&<button className="dm-button full" disabled={busy} onClick={autoFill}><WandSparkles size={16}/>Preencher quadros vazios</button>}</div>}</>}
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
     const effectiveSpacing=(layout:PhotoLayout)=>spread?.spacing||{marginMm:Math.round(Math.min(currentSpec.widthMm*2,currentSpec.heightMm)*(layout.marginRatio??.05)),gapMm:2};
     const thumbSpec={...currentSpec,widthMm:currentSpec.widthMm*(activePage<0?.5:1)};
     const thumbFrames=(layout:PhotoLayout)=>layout.frames.map(rect=>{const t=frameGeometry(rect,thumbSpec,activePage>=0,effectiveSpacing(layout)).trim;return {x:t.x/(thumbSpec.widthMm*2),y:t.y/thumbSpec.heightMm,w:t.w/(thumbSpec.widthMm*2),h:t.h/thumbSpec.heightMm};});
     const sameFrames=(layout:PhotoLayout)=>!!spread&&JSON.stringify(spreadRectangles(spread))===JSON.stringify(layout.frames);
     const list=rankedLayouts||layoutOptions.map(layout=>({layout,lowResolution:false}));
     const recommended=rankedLayouts?list.slice(0,2):[];
     const others=rankedLayouts?list.slice(2):list;
     const photosHere=(spread?.slots||[cover.photo]).filter(s=>s.photoId).length;
     const spacingPresets=[{label:'Sem borda',margin:0,gap:0},{label:'Fino',margin:5,gap:2},{label:'Médio',margin:12,gap:4},{label:'Amplo',margin:20,gap:8}];
     const card=({layout,lowResolution}:{layout:PhotoLayout;lowResolution:boolean},best=false)=><button key={layout.id} type="button" className={'dm-layout-card'+(best?' is-best':'')} aria-pressed={sameFrames(layout)} disabled={busy} title={lowResolution?'Alguma foto ficaria ampliada além da resolução dela':undefined} onClick={()=>applyPhotoLayout(layout)}>
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
    {panel==='icons'&&<><div className="dm-panel-title"><h2>Pequenos detalhes</h2><span>{ALBUM_ICONS.length}</span></div>{(()=>{const categories=['Todos','Casamento','Festa','Bebê e família','Momentos'];const colors=['var(--zg-red)','var(--zg-green)','var(--zg-yellow)','var(--zg-blue)','var(--zg-magenta)'];const active=Math.max(0,categories.indexOf(iconCategory));
      return <div className="dm-icon-tabs" role="tablist" aria-label="Categorias de ícones" style={{'--active':active,'--active-color':colors[active]} as CSSProperties}>{categories.map((category,i)=><button key={category} type="button" role="tab" data-color={i} aria-selected={category===iconCategory} onClick={()=>setIconCategory(category)}><i aria-hidden="true"/><span>{category}</span></button>)}</div>;})()}<div className="dm-search dm-icon-search"><Search size={15}/><input aria-label="Buscar ícones" placeholder="Buscar ícone (ex.: coração, bolo)" value={iconSearch} onChange={e=>setIconSearch(e.target.value)}/></div><div className="dm-icon-grid" key={iconCategory}>{ALBUM_ICONS.filter(i=>(iconCategory==='Todos'||i.category===iconCategory)&&i.label.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(iconSearch.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim())).map((icon,order)=><button key={icon.id} style={{'--i':Math.min(order,24)} as CSSProperties} title={icon.label} aria-label={`Adicionar ícone ${icon.label}`} disabled={icons.length>=30} onClick={()=>addIcon(icon.id)}><DecorativeIcon kind={icon.id}/><small>{icon.label}</small></button>)}</div></>}
    {panel==='background'&&<><div className="dm-panel-title"><h2>O cenário da sua história</h2></div><div className="dm-category-tabs"><button aria-pressed={backgroundTab==='colors'} onClick={()=>setBackgroundTab('colors')}>Cores e texturas</button><button aria-pressed={backgroundTab==='themes'} onClick={()=>setBackgroundTab('themes')}>Temas de álbum</button></div>{backgroundTab==='themes'?<><div className="dm-theme-grid">{ALBUM_THEMES.map(theme=><button key={theme.id} onClick={()=>applyTheme(theme.id)}><div style={{background:theme.color,color:theme.ink}}><DecorativeIcon kind={theme.icon}/><span style={{fontFamily:`"${theme.font}"`}}>{theme.name}</span></div><strong>{theme.name}</strong><small>{theme.subtitle}</small></button>)}</div></>:<><div className="dm-color-grid">{palette.map(color=><button key={color} style={{background:color}} aria-label={`Fundo ${color}`} aria-pressed={(activePage<0?cover.color:spread?.background||'#fffdf8')===color} onClick={()=>setBackground(color)}/>)}</div><label className="dm-color-input">Escolher outra cor<input type="color" value={activePage<0?cover.color:spread?.background||'#fffdf8'} onChange={e=>setBackground(e.target.value)}/></label>{activePage>=0&&<label className="dm-color-input">Somente o lado direito<input type="color" value={spread?.rightBackground||spread?.background||'#fffdf8'} onChange={e=>setBackground(e.target.value,'right')}/></label>}{(()=>{const current=activePage<0?cover.surface:spread?.surface;return <>
      <button type="button" role="switch" className={'dm-surface-none'+(current?'':' is-active')} aria-checked={!current} onClick={()=>setSurface(undefined)}><span className="dm-switch" aria-hidden="true"><i/></span><span>Sem superfície</span><em key={current?'off':'on'}>{current?'Desligado':'Ligado'}</em></button>
      {SURFACE_GROUPS.map(group=><div key={group} className="dm-surface-group"><span>{group}</span><div className="dm-surface-grid">{SURFACES.filter(s=>s.group===group).map(s=><button key={s.id} type="button" aria-pressed={current===s.id} title={s.name} onClick={()=>setSurface(s.id)}><span style={{backgroundImage:`url(${surfaceUrl(s.id,true)})`}}/><small>{s.name}</small></button>)}</div></div>)}
      {activePage>=0&&<button type="button" className="dm-button full" onClick={()=>surfaceForAll(current)}>{current?'Usar esta superfície em todas as lâminas':'Tirar a superfície de todas as lâminas'}</button>}</>;})()}
      <h3>Texturas</h3><div className="dm-texture-grid">{TEXTURES.map(t=><button key={t.id} aria-pressed={texture===t.id} onClick={()=>changeTexture(t.id)}><span className={'texture-swatch '+t.id} style={{backgroundColor:activePage<0?cover.color:spread?.background||'#fffdf8'}}/><small>{t.name}</small></button>)}</div></>}</>}
   </div></aside>
   <section className="dm-workbench" aria-label="Área de edição">
    <button type="button" className="dm-panel-handle" aria-controls="dm-tool-panel" aria-expanded={panelOpen} aria-label={panelOpen?'Recolher painel':'Abrir painel'} title={panelOpen?'Clique ou arraste para a esquerda para recolher':'Clique ou arraste para a direita para abrir'} style={handleDx?{transform:`translate(${handleDx}px,-50%)`}:undefined}
     onPointerDown={e=>{if(e.button!==0)return;handleStart.current=e.clientX;handleDragged.current=false;e.currentTarget.setPointerCapture(e.pointerId)}}
     onPointerMove={e=>{if(handleStart.current===null)return;const dx=e.clientX-handleStart.current;if(Math.abs(dx)>5)handleDragged.current=true;setHandleDx(panelOpen?Math.max(-80,Math.min(0,dx)):Math.max(0,Math.min(80,dx)))}}
     onPointerUp={e=>{const start=handleStart.current;handleStart.current=null;setHandleDx(0);if(start===null||!handleDragged.current)return;const dx=e.clientX-start;if(panelOpen?dx<-30:dx>30)setPanelOpen(v=>!v)}}
     onPointerCancel={()=>{handleStart.current=null;setHandleDx(0)}}
     onClick={()=>{if(handleDragged.current){handleDragged.current=false;return}setPanelOpen(v=>!v)}}>{panelOpen?<ChevronLeft size={16}/>:<ChevronRight size={16}/>}</button>
    {activePage<0&&showMarginNotice&&<aside className={'dm-side-notice'+(noticeLeaving?' is-leaving':'')} role="note" aria-label="Aviso de margem"><Info size={16} aria-hidden="true"/><p>{coverMarginDescription(coverMargins)}</p><span className="dm-notice-timer" aria-hidden="true" onAnimationEnd={e=>{if(e.animationName==='dm-notice-countdown')closeMarginNotice()}}/><button type="button" className="dm-icon" aria-label="Fechar aviso de margem" onClick={closeMarginNotice}><X size={14}/></button></aside>}
    <div className="dm-contextbar"><div><strong>{selectedIcon?'Editar ícone':selectedText?'Editar texto':title}</strong></div><div className="dm-context-actions">{selectedIcon?<>
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
      <button className="dm-button small" onClick={()=>{setTextId(undefined);setPanel('photos')}}>Concluir<Check size={14}/></button></>:<>{spread&&<div className="dm-segment-inline" role="group" aria-label="Modo de edição"><button type="button" className="dm-tool-mode" aria-label="Enquadrar foto" title="Arraste a foto dentro do quadro para enquadrar" aria-pressed={photoMode==='crop'} onClick={()=>setPhotoMode('crop')}><Crop size={15}/>Enquadrar</button><button type="button" className="dm-tool-mode" aria-label="Mover e redimensionar quadro" title="Mover e redimensionar o quadro" aria-pressed={photoMode==='position'} onClick={()=>setPhotoMode('position')}><MousePointer2 size={15}/>Mover quadro</button></div>}
     {selectedPhoto&&<><label className="dm-inline-range" title="Zoom da foto"><ZoomIn size={15} aria-hidden="true"/><input aria-label="Zoom da foto" type="range" min="1" max="3" step=".02" value={slot.zoom||1} onChange={e=>updateSlot({zoom:Number(e.target.value)})}/></label><button className="dm-button small" title="Escolher o ponto principal da foto, como um rosto" onClick={()=>setFocusOpen(true)}><Focus size={15}/>Foco</button></>}
     <div className="dm-position-control"><button className="dm-icon" aria-label="Mais opções" title="Mais opções" aria-haspopup="menu" aria-expanded={positionOpen} onClick={()=>setPositionOpen(v=>!v)}><Ellipsis size={19}/></button>{positionOpen&&<div className="dm-position-menu dm-more-menu" role="menu">
      {selectedPhoto&&<><strong>Foto</strong><button role="menuitemcheckbox" aria-checked={!!slot.flipX} onClick={()=>updateSlot({flipX:!slot.flipX})}><FlipHorizontal2 size={15}/>Espelhar na horizontal{slot.flipX&&<Check size={14}/>}</button><button role="menuitemcheckbox" aria-checked={!!slot.flipY} onClick={()=>updateSlot({flipY:!slot.flipY})}><FlipVertical2 size={15}/>Espelhar na vertical{slot.flipY&&<Check size={14}/>}</button><button role="menuitem" onClick={()=>{updateSlot({x:50,y:50,zoom:1});setPositionOpen(false)}}><RotateCcw size={15}/>Centralizar e tirar o zoom</button><button role="menuitem" className="danger" onClick={()=>{updateSlot(emptySlot());setPositionOpen(false)}}><ImageOff size={15}/>Tirar a foto do quadro</button></>}
      {spread&&<><strong>Quadro</strong><button role="menuitem" disabled={spread.slots.length>=12} onClick={()=>{duplicateSelected();setPositionOpen(false)}}><Copy size={15}/>Duplicar quadro<kbd>Ctrl D</kbd></button><button role="menuitem" onClick={()=>{reorderFrame(true);setPositionOpen(false)}}><Layers3 size={15}/>Trazer para frente</button><button role="menuitem" onClick={()=>{reorderFrame(false);setPositionOpen(false)}}><Layers3 size={15}/>Enviar para trás</button><button role="menuitem" className="danger" disabled={spread.slots.length<=1} onClick={()=>{removeFrame();setPositionOpen(false)}}><Trash2 size={15}/>Excluir quadro</button>
       <strong>Alinhar à lâmina</strong><div className="dm-align-grid">{(['left','center','right','top','middle','bottom'] as const).map((alignment,i)=><button key={alignment} role="menuitem" onClick={()=>alignFrame(alignment)}>{['Esquerda','Centro','Direita','Topo','Meio','Base'][i]}</button>)}</div></>}
      <hr/><button role="menuitem" onClick={()=>{addText();setPositionOpen(false)}}><Type size={15}/>Adicionar texto</button>
     </div>}</div></>}</div></div>
    {activePage<0&&!spread&&selectedPhoto&&!selectedText&&<div className="dm-cover-crop"><label>Horizontal<input type="range" min="0" max="100" value={slot.x} onChange={e=>updateSlot({x:Number(e.target.value)})}/></label><label>Vertical<input type="range" min="0" max="100" value={slot.y} onChange={e=>updateSlot({y:Number(e.target.value)})}/></label></div>}
    {activePage===-1&&wrapMode&&spineMm>0&&<div className="dm-cover-region-tools"><span>Dorso central: <strong>{formatCm(spineMm)} cm</strong></span><button type="button" role="switch" aria-checked={coverIsSingle} className={'dm-cover-single'+(coverIsSingle?' is-active':'')} onClick={toggleSingleCover}><span className="dm-switch" aria-hidden="true"><i/></span>Capa inteira</button><button onClick={addSpineText}><Type size={14}/>Texto no dorso</button></div>}
    <div className="dm-canvas-area">
    <div className="dm-canvas-scroll" ref={canvasViewport} onDragOver={e=>{if(activePage>=0&&e.dataTransfer.types.includes('application/x-zangraf-photo'))e.preventDefault()}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/x-zangraf-photo');if(id)appendPhoto(id)}}><div className="dm-canvas-center"><div className="dm-paper-wrap" style={{width:Math.max(140,Math.min(workspaceSize.width-56,(workspaceSize.height-84)*currentRatio,2000))*zoom/100}}><div className="dm-page-caption"><span>{title}</span><span>{activePage<0?specLabel(currentSpec,true):specLabel(currentSpec,true,true)}</span></div>{activePage<0?<div className="dm-cover-stage"><AlbumCover cover={cover} urls={urls} spec={currentSpec} ratio={currentRatio} back={backMode} guides={false} selected={textId||iconId?undefined:slotIndex} onSelect={i=>{setSlotIndex(i);setTextId(undefined);setIconId(undefined)}} mode={photoMode} onPhotoDrop={(id,i)=>dropPhoto(i??slotIndex,id,false)} onSlotChange={(i,patch)=>updateSlot(patch,i)} onFrameChange={updateFrame} onSlotSwap={swapSlots} photoSizes={photoSizes} onCropRequest={()=>setPhotoMode('crop')} {...textProps}/>{guides&&<CoverFinishingGuides spec={currentSpec} margins={coverMargins}/>}
{wrapMode&&spineMm>0&&guides&&<div className="dm-spine-guide" aria-label={`Dorso de ${formatCm(spineMm)} cm`} style={{left:(50-spineMm/currentSpec.widthMm*50)+'%',width:(spineMm/currentSpec.widthMm*100)+'%'}}><span>DORSO</span></div>}</div>:<AlbumSpread spread={spread!} urls={urls} spec={currentSpec} ratio={currentRatio} guides={guides} mode={photoMode} selected={textId||iconId?undefined:slotIndex} onSelect={index=>{setSlotIndex(index);setTextId(undefined);setIconId(undefined)}} onPhotoDrop={(index,id)=>dropPhoto(index,id,dropAdds)} onSlotChange={(index,patch)=>updateSlot(patch,index)} onFrameChange={updateFrame} onSlotSwap={swapSlots} photoSizes={photoSizes} onCropRequest={()=>setPhotoMode('crop')} {...textProps}/>}{activePage<0&&wrapMode&&<div className="dm-cover-labels"><span>VERSO</span><span>DORSO · CENTRO</span><span>FRENTE</span></div>}<p className="dm-paper-help">{selectedIcon?'Arraste o ícone para posicionar. Cor, tamanho e giro ficam na barra acima.':selectedText?'Arraste o texto para mover. Puxe as alças nas laterais para mudar a largura.':activePage<0?'Arraste uma foto para a capa ou adicione seu texto.':photoMode==='position'?'Arraste o quadro para mover. Use o ponto no canto para redimensionar.':dropAdds?'Arraste dentro da foto para enquadrar. Arraste da biblioteca para acrescentar uma foto. Use ⇄ no canto da foto para trocá-la de lugar.':'Arraste dentro da foto para enquadrar. Solte outra foto sobre o quadro para trocar. Use ⇄ no canto da foto para trocá-la de lugar.'}</p></div></div></div>
    </div>
    <div className="dm-pages-toolbar"><div><button className="dm-icon" title="Lâmina anterior" aria-label="Lâmina anterior" disabled={activePage===pageIndices[0]} onClick={previousPage}><ChevronLeft size={17}/></button><strong>{title}</strong><button className="dm-icon" title="Lâmina seguinte" aria-label="Próxima lâmina" disabled={activePage===pageIndices.at(-1)} onClick={nextPage}><ChevronRight size={17}/></button></div><button type="button" className={'dm-strip-toggle'+(stripCollapsed?' is-collapsed':'')} aria-expanded={!stripCollapsed} aria-label={stripCollapsed?'Mostrar as lâminas maiores':'Mostrar as lâminas menores'} title={stripCollapsed?'Mostrar as lâminas maiores':'Mostrar as lâminas menores'} onClick={()=>setStripCollapsed(v=>!v)}><ChevronUp size={15}/><span>Lâminas</span></button></div>
    <div className={'dm-strip-wrap'+(stripCollapsed?' is-collapsed':'')}>
<nav className="dm-filmstrip" aria-label="Lâminas do álbum">{pageIndices.map(index=>{const s=projectSpec(project,index);return <button key={index} aria-current={activePage===index?'page':undefined} className={activePage===index?'active':''} onClick={()=>selectPage(index)}><span className={'dm-thumb '+(index<0?'cover':'')}>{index<0?<AlbumCover compact cover={index===-1?frontCover:backCover} urls={urls} spec={s} ratio={s.widthMm/s.heightMm} back={index===-2}/>:<AlbumSpread compact spread={project.spreads[index]} urls={urls} spec={s} ratio={s.widthMm*2/s.heightMm}/>}</span><small>{index===-1?'Capa':index===-2?'Verso':`Lâmina ${String(index+1).padStart(2,'0')}`}</small>{pageFlags.has(index)&&<i className={'dm-thumb-flag '+pageFlags.get(index)} title={pageFlags.get(index)==='error'?'Há pontos para corrigir nesta lâmina':'Há pontos para conferir nesta lâmina'}/>}</button>})}</nav></div>
    <footer className="dm-bottom"><label className="dm-checkbox"><input type="checkbox" checked={guides} onChange={e=>setGuides(e.target.checked)}/>Guias de segurança</label><span>{project.spreads.length} lâminas</span><div className="dm-zoom"><button className="dm-icon" aria-label="Diminuir zoom da lâmina" onClick={()=>setZoom(v=>Math.max(40,v-10))}><Minus size={15}/></button><input aria-label="Zoom da lâmina" type="range" min="40" max="180" step="10" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button className="dm-icon" aria-label="Aumentar zoom da lâmina" onClick={()=>setZoom(v=>Math.min(180,v+10))}><Plus size={15}/></button><span>{zoom}%</span><button className="dm-icon" aria-label="Ajustar lâmina à tela" onClick={()=>setZoom(100)}><Maximize size={16}/></button></div></footer>
   </section>
  </div>
  <div className="sr-only" role="status" aria-live="polite">{notice}</div>
  {notice&&<div className="dm-toast" aria-hidden="true" key={notice}><span>{notice}</span><button type="button" tabIndex={-1} onClick={()=>setNotice('')}><X size={14}/></button></div>}
  {printOpen&&<section className="dm-export-popover" aria-label="Revisar álbum"><div className="dm-panel-title dm-review-title"><h2>Revisar</h2><button className="dm-icon" aria-label="Fechar revisão" onClick={()=>setPrintOpen(false)}><X size={20}/></button></div>{projectPrintError&&<p className="dm-error">{projectPrintError}</p>}<div className="dm-check" aria-label="Checagem antes da impressão">
   <div className={`dm-check-summary ${issueErrors?'error':issueWarnings?'warning':'ok'}`}>{issueErrors||issueWarnings?<CircleAlert size={20} aria-hidden="true"/>:<CircleCheck size={20} aria-hidden="true"/>}<div><strong>{issueErrors?`${issueErrors} ${issueErrors===1?'ponto para corrigir':'pontos para corrigir'}`:issueWarnings?'Nada grave, só alguns pontos para conferir':'Tudo certo para imprimir'}</strong><span>{issueErrors&&issueWarnings?`e ${issueWarnings} para conferir · `:''}{issues.length?'Clique num item para ir direto até ele.':'Conferimos resolução, dobra, margens, quadros e repetições.'}</span></div></div>
   {ISSUE_ORDER.map(kind=>{const list=issues.filter(i=>i.kind===kind);if(!list.length)return null;
    return <details key={kind} className={`dm-check-group ${list[0].level}`} open={list[0].level==='error'}>
     <summary><i aria-hidden="true"/>{ISSUE_INFO[kind].title}<em>{list.length}</em></summary>
     <ul>{list.slice(0,40).map((issue,i)=><li key={i}><button type="button" onClick={()=>goToIssue(issue)}><strong>{pageLabel(project,issue.page)}</strong><span>{issue.detail}</span><ArrowRight size={13} aria-hidden="true"/></button></li>)}</ul>
     {list.length>40&&<p>E mais {list.length-40}.</p>}
    </details>;})}
  </div><button className="dm-button primary full" disabled={busy||!!projectPrintError||!!formatError||!project.cartItemId} onClick={async()=>{if(await persist())window.location.assign('/carrinho')}}>Ir para o carrinho <ArrowRight size={16}/></button><button className="dm-link dm-preview-link" onClick={()=>{setPreviewPage(pageIndices[0]);setShowPreview(true);setPrintOpen(false)}}><Eye size={16}/>Ver prévia completa do álbum</button><ApprovalPanel project={project} busy={busy} onGoToPage={index=>{selectPage(index);setPrintOpen(false);setNotice(`Comentário do cliente na ${pageLabel(project,index).toLowerCase()}.`);}}/></section>}
  <dialog ref={previewDialog} className="dm-preview-dialog" onCancel={()=>setShowPreview(false)} onClose={()=>setShowPreview(false)} aria-label="Prévia do álbum"><header><div><small>SEU ÁLBUM, FOLHA A FOLHA</small><h2>{project.name}</h2></div><button className="dm-icon" aria-label="Fechar prévia" onClick={()=>setShowPreview(false)}><X size={22}/></button></header>{showPreview&&<AlbumFlipbook project={project} urls={urls} index={previewPage} onChange={setPreviewPage}/>}<div className="dm-preview-checkout"><p>Prévia para conferência. Os arquivos de impressão seguem para a produção após pagamento e aprovação.</p><button className="dm-button primary" disabled={busy||!!projectPrintError||!project.cartItemId} onClick={()=>void continueOrder()}>Continuar para o pedido <ArrowRight size={16}/></button></div></dialog>
  {focusOpen&&selectedPhoto&&urls[selectedPhoto.id]&&<PhotoFocus key={selectedPhoto.id+'-'+activePage+'-'+slotIndex} photo={selectedPhoto} url={urls[selectedPhoto.id]} slot={slot} width={spread?frameGeometry(spreadRectangles(spread)[slotIndex]||spreadRectangles(spread)[0],{...currentSpec,widthMm:currentSpec.widthMm*(activePage<0?.5:1)},activePage>=0,spread.spacing).image.w:currentSpec.widthMm} height={spread?frameGeometry(spreadRectangles(spread)[slotIndex]||spreadRectangles(spread)[0],{...currentSpec,widthMm:currentSpec.widthMm*(activePage<0?.5:1)},activePage>=0,spread.spacing).image.h:currentSpec.heightMm} onApply={updateSlot} onClose={()=>setFocusOpen(false)}/>}
 </div>;
}
