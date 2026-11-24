import type {PhotoAdjust} from './photo-adjust';
import {MAX_ALBUM_PHOTOS} from './album-capacity';
import {ALBUM_FONTS,type AlbumFont} from './album-fonts';
import {ALBUM_ICONS,TEXTURES,type AlbumIcon,type TextureName,isSurface,type SurfaceName} from './album-decorations';
import {coverRegions} from './album-layouts';
import {coverPageIndices,type CoverMode,type CoverMargins} from './cover-production';
import type { Configuration } from './products';
import {configuredSheetCount,physicalPrintDimensions,validatePhysicalPrintSpec,MAX_ALBUM_SHEETS} from './print-rules';

export type LayoutName = 'inteira' | 'dupla' | 'quatro' | 'editorial' | 'seis' | 'respiro' | 'livre';
/** `takenAt`: quando a foto foi tirada (EXIF), em ms; ausente se o arquivo não tiver essa informação. */
export type Photo = { id: string; name: string; blob: Blob; preview?: Blob; thumbnail?: Blob; width?: number; height?: number; takenAt?: number };
export type Slot = { photoId: string | null; x: number; y: number; zoom?: number; flipX?: boolean; flipY?: boolean; adjust?: PhotoAdjust };
export type FrameRect = {x:number;y:number;w:number;h:number};
export type AlbumText = {id:string;text:string;x:number;y:number;width:number;fontSize:number;fontFamily:AlbumFont;color:string;bold:boolean;italic:boolean;align:'left'|'center'|'right';rotation?:0|90;/** Altura mínima da caixa, em % da altura da área; o texto fica centralizado nela. */height?:number};
export type LayoutSpacing={marginMm:number;gapMm:number};
export type Spread = { id: string; layout: LayoutName; slots: Slot[]; frames?:FrameRect[]; spacing?:LayoutSpacing; texture?:TextureName; /** Textura fotográfica de fundo (mármore, linho…). */ surface?:SurfaceName; icons?:AlbumIcon[]; background?:string; rightBackground?:string; texts?:AlbumText[] };
export type Cover = { title: string; subtitle: string; color: string; textColor: string; photo: Slot; texts?:AlbumText[]; customText?:boolean; texture?:TextureName; surface?:SurfaceName; icons?:AlbumIcon[]; composition?:Spread };
export type PrintSpec = { widthMm: number; heightMm: number; bleedMm: number; dpi: number; exportMode: 'page' };
export type LayoutProject = {
 id: string; name: string; updatedAt: string; /** Quando o projeto foi criado; ele é excluído automaticamente PROJECT_LIFETIME_DAYS depois. */ createdAt?: string; photos: Photo[]; spreads: Spread[];
 cover?: Cover; backCover?: Cover; printSpec?: PrintSpec; productId?: string; configuration?: Configuration; cartItemId?: string;
 revision?: number; recoveryOf?: string;
 productionModel?: {id:string;variantId:string;version:string;name:string;sheets:number;stock?:string;coverMode?:CoverMode;coverMargins?:CoverMargins;insideMode?:'page'|'spread';front:PrintSpec;back:PrintSpec;page:PrintSpec};
};
export const MAX_SPREADS = MAX_ALBUM_SHEETS;
export const MAX_PHOTOS = MAX_ALBUM_PHOTOS;
export const LAYOUTS: { id: LayoutName; name: string; description: string }[] = [
 { id: 'dupla', name: 'Duas histórias', description: 'Uma foto em cada página' },
 { id: 'inteira', name: 'Panorâmica', description: 'Uma foto ocupa a lâmina inteira' },
 { id: 'editorial', name: 'Editorial', description: 'Uma imagem em destaque e duas de apoio' },
 { id: 'quatro', name: 'Quatro momentos', description: 'Quatro fotos com o mesmo destaque' },
 { id: 'respiro', name: 'Com respiro', description: 'Uma foto cercada por espaço em branco' },
 { id: 'seis', name: 'Sequência', description: 'Seis imagens para contar uma história' },
];
export const emptySlot = (): Slot => ({ photoId: null, x: 50, y: 50, zoom: 1 });
export const defaultPrintSpec = (): PrintSpec => ({ widthMm: 300, heightMm: 300, bleedMm: 3, dpi: 300, exportMode: 'page' });
export const defaultBackCover = (): Cover => ({ title: '', subtitle: 'Memórias que ficam.', color: '#ffffff', textColor: '#292823', photo: emptySlot() });
export const defaultCover = (): Cover => ({ title: 'Uma história para guardar', subtitle: 'Nosso álbum de memórias', color: '#ffffff', textColor: '#292823', photo: emptySlot() });
export function rectangles(layout: LayoutName) {
 if (layout === 'inteira') return [{x:0,y:0,w:1,h:1}];
 if (layout === 'respiro') return [{x:.12,y:.15,w:.76,h:.7}];
 if (layout === 'dupla') return [{x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}];
 if (layout === 'editorial') return [{x:0,y:0,w:.6,h:1},{x:.6,y:0,w:.4,h:.5},{x:.6,y:.5,w:.4,h:.5}];
 if (layout === 'seis') return Array.from({length:6},(_,i)=>({x:(i%3)/3,y:Math.floor(i/3)/2,w:1/3,h:1/2}));
 return [{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}];
}
export function createSpread(layout: LayoutName = 'dupla'): Spread {
 return { id: crypto.randomUUID(), layout, slots: rectangles(layout).map(emptySlot) };
}
export function createProject(): LayoutProject {
 const now=new Date().toISOString();
 return {id:crypto.randomUUID(),name:'Meu primeiro álbum',createdAt:now,updatedAt:now,photos:[],cover:{...defaultCover(),customText:true,texts:[]},backCover:{...defaultBackCover(),customText:true,texts:[]},printSpec:defaultPrintSpec(),spreads:Array.from({length:15},()=>createSpread())};
}
export function changeLayout(spread: Spread, layout: LayoutName): Spread {
 return {...spread,layout,frames:undefined,spacing:undefined,slots:rectangles(layout).map((_,i)=>spread.slots[i] ? {...spread.slots[i]} : emptySlot())};
}
export function spreadRectangles(spread:Spread):FrameRect[]{return spread.layout==='livre'&&spread.frames?spread.frames:rectangles(spread.layout);}
export function isReusableSpread(value:unknown):value is Spread {
 if(!value||typeof value!=='object')return false;const s=value as Spread;
 if(![...LAYOUTS.map(l=>l.id),'livre'].includes(s.layout)||!Array.isArray(s.slots)||s.slots.length<1||s.slots.length>12)return false;
 const frames=spreadRectangles(s);if(frames.length!==s.slots.length||!frames.every(r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.x>=0&&r.y>=0&&r.w>=.005&&r.h>=.005&&r.x+r.w<=1.001&&r.y+r.h<=1.001))return false;
 if([s.background,s.rightBackground].some(c=>c!==undefined&&!/^#[0-9a-f]{6}$/i.test(c)))return false;
 if(s.spacing&&[s.spacing.marginMm,s.spacing.gapMm].some(n=>!Number.isFinite(n)||n<0||n>50))return false;
 if(s.texture!==undefined&&!TEXTURES.some(t=>t.id===s.texture))return false;
 if(s.surface!==undefined&&!isSurface(s.surface))return false;
 if(s.icons!==undefined&&(!Array.isArray(s.icons)||s.icons.length>30||!s.icons.every(i=>i&&typeof i.id==='string'&&ALBUM_ICONS.some(d=>d.id===i.kind)&&[i.x,i.y,i.sizeMm,i.rotation].every(Number.isFinite)&&i.x>=0&&i.x<=100&&i.y>=0&&i.y<=100&&i.sizeMm>=1&&i.sizeMm<=200&&Math.abs(i.rotation)<=360&&/^#[0-9a-f]{6}$/i.test(i.color))))return false;
 if(s.texts!==undefined&&(!Array.isArray(s.texts)||s.texts.length>20||!s.texts.every(t=>t&&typeof t.id==='string'&&typeof t.text==='string'&&t.text.length<=600&&[t.x,t.y,t.width,t.fontSize].every(Number.isFinite)&&(t.height===undefined||(Number.isFinite(t.height)&&t.height>=0&&t.height<=100))&&t.x>=0&&t.x<=100&&t.y>=0&&t.y<=100&&t.width>=1&&t.width<=100&&t.fontSize>=8&&t.fontSize<=144&&ALBUM_FONTS.some(f=>f.family===t.fontFamily)&&['left','center','right'].includes(t.align)&&/^#[0-9a-f]{6}$/i.test(t.color))))return false;
 return true;
}
export function projectPageIndices(project:LayoutProject){const covers=coverPageIndices(project.productionModel?.coverMode);return [...covers.filter(i=>i===-1),...project.spreads.map((_,i)=>i),...covers.filter(i=>i===-2)];}
export function projectSpec(project:LayoutProject,index:number):PrintSpec{return index===-1?(project.productionModel?.front||project.printSpec||defaultPrintSpec()):index===-2?(project.productionModel?.back||project.printSpec||defaultPrintSpec()):(project.productionModel?.page||project.printSpec||defaultPrintSpec());}
export function combinedCover(front:Cover,back:Cover,spineMm=0,widthMm=0):Cover {
 const composition=createSpread('dupla');composition.slots=[{...back.photo},{...front.photo}];
 if(spineMm>0&&widthMm>spineMm){composition.layout='livre';composition.frames=coverRegions(widthMm,spineMm);composition.slots=[{...back.photo},emptySlot(),{...front.photo}];}
 const coverTexts=(cover:Cover,right:boolean):AlbumText[]=>{
  const texts=cover.texts?.length?cover.texts:!cover.customText&&cover.title?[{...newAlbumText(),text:cover.title,x:12,y:40,width:76,color:cover.textColor}]:[];
  return texts.map(t=>({...t,id:crypto.randomUUID(),x:(right?50:0)+t.x/2,width:t.width/2}));
 };
 return {...front,photo:emptySlot(),customText:true,composition,texts:[...coverTexts(back,false),...coverTexts(front,true)]};
}
export function newAlbumText():AlbumText{return {id:crypto.randomUUID(),text:'Escreva sua história',x:12,y:15,width:40,fontSize:28,fontFamily:'Montserrat',color:'#292823',bold:false,italic:false,align:'left'};}
function database(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB === 'undefined'){reject(new Error('Este navegador não oferece armazenamento de projetos.'));return;}
  const request=indexedDB.open('zangraf-projects-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('projects',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error('Não foi possível abrir os projetos locais.'));
  request.onblocked=()=>reject(new Error('Feche outras abas do editor para abrir este projeto.'));
 });
}
async function operation<T>(mode: IDBTransactionMode, action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects',mode);const request=action(tx.objectStore('projects'));let result:T;
  request.onsuccess=()=>{result=request.result};
  tx.oncomplete=()=>{db.close();resolve(result)};
  tx.onerror=()=>{db.close();reject(new Error('Não foi possível salvar ou carregar o projeto. Verifique o espaço disponível.'))};
  tx.onabort=()=>{db.close();reject(new Error('Operação cancelada pelo navegador.'))};
 });
}
export async function saveProjectRevision(project:LayoutProject):Promise<{project:LayoutProject;conflict:boolean}>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');
  const read=store.get(project.id);let result:{project:LayoutProject;conflict:boolean};
  read.onsuccess=()=>{
   const stored=read.result as LayoutProject|undefined;
   const conflict=(stored?.revision??0)!==(project.revision??0);
   const saved:LayoutProject=conflict?{...project,id:crypto.randomUUID(),name:project.name+' — recuperação',cartItemId:undefined,recoveryOf:project.id,revision:1}:{...project,revision:(stored?.revision??0)+1};
   store.put(saved);result={project:saved,conflict};
  };
  tx.oncomplete=()=>{db.close();resolve(result)};
  tx.onabort=tx.onerror=()=>{db.close();reject(new Error('Não foi possível salvar o projeto. Verifique o espaço disponível neste navegador.'))};
 });
}
export async function saveProject(project:LayoutProject){const result=await saveProjectRevision(project);return result.project.id;}
export function loadProject(id:string){return operation<LayoutProject|undefined>('readonly',store=>store.get(id));}
/** Projetos ficam no navegador por este número de dias, contados da criação. */
export const PROJECT_LIFETIME_DAYS=5;
const DAY_MS=24*60*60*1000;
/** Momento em que o projeto será excluído automaticamente (ms), ou undefined sem data de criação. */
export function projectExpiresAt(project:Pick<LayoutProject,'createdAt'>){const created=Date.parse(project.createdAt||'');return Number.isFinite(created)?created+PROJECT_LIFETIME_DAYS*DAY_MS:undefined;}
/** Dias inteiros que ainda faltam (0 = é excluído hoje). */
export function projectDaysLeft(project:Pick<LayoutProject,'createdAt'>,now=Date.now()){const expires=projectExpiresAt(project);return expires===undefined?PROJECT_LIFETIME_DAYS:Math.max(0,Math.ceil((expires-now)/DAY_MS)-1);}
export async function deleteProject(id:string){await operation('readwrite',store=>store.delete(id));}
/**
 * Exclui os projetos criados há mais de PROJECT_LIFETIME_DAYS dias e devolve os ids removidos.
 * Projetos antigos, salvos antes de existir a data de criação, recebem a data de hoje:
 * assim ninguém perde um álbum sem antes ver o aviso de exclusão.
 */
export async function purgeExpiredProjects(now=Date.now()):Promise<string[]>{
 const projects=await operation<LayoutProject[]>('readonly',store=>store.getAll());
 const removed:string[]=[];
 for(const project of projects){
  const expires=projectExpiresAt(project);
  if(expires===undefined)await operation('readwrite',store=>store.put({...project,createdAt:new Date(now).toISOString()}));
  else if(expires<=now){await deleteProject(project.id);removed.push(project.id);}
 }
 return removed;
}
export async function listProjects(){const projects=await operation<LayoutProject[]>('readonly',store=>store.getAll());return projects.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}

export function removePhoto(project: LayoutProject, photoId: string): LayoutProject {
 return {...project, photos:project.photos.filter(p=>p.id!==photoId),
  cover:project.cover?{...project.cover,composition:project.cover.composition?{...project.cover.composition,slots:project.cover.composition.slots.map(s=>s.photoId===photoId?emptySlot():s)}:undefined,photo:project.cover.photo.photoId===photoId?emptySlot():project.cover.photo}:undefined,
  backCover:project.backCover?{...project.backCover,composition:project.backCover.composition?{...project.backCover.composition,slots:project.backCover.composition.slots.map(s=>s.photoId===photoId?emptySlot():s)}:undefined,photo:project.backCover.photo.photoId===photoId?emptySlot():project.backCover.photo}:undefined,
  spreads:project.spreads.map(s=>({...s,slots:s.slots.map(slot=>slot.photoId===photoId?emptySlot():slot)}))};
}
export function duplicateSpread(project: LayoutProject, index: number): LayoutProject {
 if(!project.spreads[index]||project.spreads.length>=MAX_SPREADS)throw new Error(`O álbum pode ter até ${MAX_SPREADS} lâminas nesta versão.`);
 const spreads=[...project.spreads];const source=spreads[index];
 spreads.splice(index+1,0,{...source,id:crypto.randomUUID(),slots:source.slots.map(slot=>({...slot}))});return {...project,spreads};
}
export function removeSpread(project: LayoutProject,index:number):LayoutProject {
 if(project.spreads.length<=1||!project.spreads[index])throw new Error('O projeto precisa de pelo menos uma lâmina.');
 return {...project,spreads:project.spreads.filter((_,i)=>i!==index)};
}
export function moveSpread(project:LayoutProject,from:number,to:number):LayoutProject {
 if(!project.spreads[from]||to<0||to>=project.spreads.length)return project;
 const spreads=[...project.spreads];const [spread]=spreads.splice(from,1);spreads.splice(to,0,spread);return {...project,spreads};
}
/** Fill only empty frames with photos not yet used. Existing work is never replaced. */
/** Resolução efetiva (DPI) da foto no tamanho em que será impressa, considerando recorte e zoom. */
export function effectiveDpi(photo:{width?:number;height?:number}|undefined,imageWidthMm:number,imageHeightMm:number,slot:Slot):number|undefined{
 if(!photo?.width||!photo.height||imageWidthMm<=0||imageHeightMm<=0)return undefined;
 const crop=cropRectangle(photo.width,photo.height,imageWidthMm,imageHeightMm,slot);
 return Math.min(crop.width/(imageWidthMm/25.4),crop.height/(imageHeightMm/25.4));
}
export type ResolutionLevel='ok'|'limit'|'low';
/** Abaixo de 50% da resolução de impressão a foto fica visivelmente borrada; abaixo de 75% perde nitidez. */
export function resolutionLevel(dpi:number|undefined,targetDpi:number):ResolutionLevel{
 if(dpi===undefined)return 'ok';
 return dpi<targetDpi*.5?'low':dpi<targetDpi*.75?'limit':'ok';
}
export function fillEmptyFrames(project: LayoutProject): {project:LayoutProject; placed:number; remaining:number} {
 const used=new Set(project.spreads.flatMap(s=>s.slots.map(slot=>slot.photoId)).filter(Boolean));
 if(project.cover?.photo.photoId)used.add(project.cover.photo.photoId);
 if(project.backCover?.photo.photoId)used.add(project.backCover.photo.photoId);
 for(const c of [project.cover,project.backCover])for(const slot of c?.composition?.slots||[])if(slot.photoId)used.add(slot.photoId);
 const available=project.photos.filter(p=>!used.has(p.id));let next=0;
 const spreads=project.spreads.map(spread=>({...spread,slots:spread.slots.map(slot=>{
  if(slot.photoId||!available[next])return slot;
  return {...emptySlot(),photoId:available[next++].id};
 })}));
 return {project:{...project,spreads},placed:next,remaining:available.length-next};
}
export function copyProject(project:LayoutProject):LayoutProject {
 const {cartItemId: _cart, ...original}=project;
 return {...original,id:crypto.randomUUID(),revision:0,recoveryOf:undefined,name:(project.name||'Meu álbum')+' — cópia',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
  cover:project.cover?{...project.cover,photo:{...project.cover.photo}}:undefined,
  backCover:project.backCover?{...project.backCover,photo:{...project.backCover.photo}}:undefined,
  printSpec:project.printSpec?{...project.printSpec}:undefined,
  spreads:project.spreads.map(s=>({...s,id:crypto.randomUUID(),slots:s.slots.map(slot=>({...slot}))}))};
}
/** Shared by canvas export and the interactive preview, preventing crop discrepancies. */
export function cropRectangle(imageWidth:number,imageHeight:number,frameWidth:number,frameHeight:number,slot:Slot){
 const zoom=Math.min(3,Math.max(1,slot.zoom||1));
 const ratio=Math.max(frameWidth/imageWidth,frameHeight/imageHeight)*zoom;
 const width=frameWidth/ratio,height=frameHeight/ratio;
 return {x:(imageWidth-width)*Math.min(100,Math.max(0,slot.x))/100,y:(imageHeight-height)*Math.min(100,Math.max(0,slot.y))/100,width,height};
}

export function validatePrintSpec(spec:PrintSpec):PrintSpec {
 if(spec.exportMode!=='page')throw new Error('A produção exige um JPG por página.');
 return validatePhysicalPrintSpec(spec);
}
export function printDimensions(spec:PrintSpec,spread=false){
 validatePrintSpec(spec);
 return physicalPrintDimensions(spec,spread);
}
export function validateProjectForPrint(project:LayoutProject){
 if(!project.printSpec)throw new Error('Escolha o tamanho do álbum.');
 validatePrintSpec(project.printSpec);
 if(project.printSpec.bleedMm!==3)throw new Error('O miolo exige 0,3 cm de sangria por lado.');
 if(project.productionModel){
  if((['widthMm','heightMm','bleedMm','dpi','exportMode'] as const).some(key=>project.printSpec![key]!==project.productionModel!.page[key]))throw new Error('As medidas do projeto devem corresponder ao modelo aplicado.');
  for(const spec of [project.productionModel.page,project.productionModel.front,project.productionModel.back])validatePrintSpec(spec);
  if(project.productionModel.sheets!==project.spreads.length)throw new Error('A quantidade de lâminas deve corresponder ao modelo de impressão aplicado.');
  if(project.configuration?.stock && project.configuration.stock !== project.productionModel.stock)throw new Error('A gramatura deve corresponder à escolha feita no produto.');
 }
 if(project.cartItemId){
  if(!project.configuration)throw new Error('Reabra o projeto pelo carrinho para conferir a configuração.');
  const count=configuredSheetCount(project.configuration.sheets);
  if(project.spreads.length!==count)throw new Error(`O produto possui ${count} lâminas, mas o projeto contém ${project.spreads.length}. Ajuste a quantidade antes de enviar ou exportar.`);
 }
 if(!project.spreads.length||project.spreads.length>MAX_SPREADS)throw new Error(`O álbum deve ter entre 1 e ${MAX_SPREADS} lâminas.`);
 return project.printSpec;
}
/** Frames touching an outside edge are full bleed; internal edges retain a small gutter. */
export function frameBounds(rect:{x:number;y:number;w:number;h:number},spreadRatio=2){
 const gapX=.005,gapY=gapX*spreadRatio;
 const left=rect.x>0?gapX:0,right=rect.x+rect.w<.999?gapX:0;
 const top=rect.y>0?gapY:0,bottom=rect.y+rect.h<.999?gapY:0;
 return {x:rect.x+left,y:rect.y+top,w:rect.w-left-right,h:rect.h-top-bottom};
}
export function frameGeometry(rect:{x:number;y:number;w:number;h:number},spec:PrintSpec,gutter=true,spacing?:LayoutSpacing){
 let bounds=gutter?frameBounds(rect,2*spec.widthMm/spec.heightMm):rect;
 if(spacing){
  const width=spec.widthMm*2,height=spec.heightMm;
  const margin=Math.min(Math.max(0,spacing.marginMm),Math.min(width,height)*.2);
  const gap=Math.min(Math.max(0,spacing.gapMm),Math.min(width,height)*.1);
  const innerW=width-margin*2,innerH=height-margin*2;
  const left=rect.x>.001?gap/2:0,right=rect.x+rect.w<.999?gap/2:0;
  const top=rect.y>.001?gap/2:0,bottom=rect.y+rect.h<.999?gap/2:0;
  // Clamp each inset for narrow custom frames, so geometry never inverts.
  const sx=Math.min(1,rect.w*innerW*.8/(left+right||1)),sy=Math.min(1,rect.h*innerH*.8/(top+bottom||1));
  bounds={x:(margin+rect.x*innerW+left*sx)/width,y:(margin+rect.y*innerH+top*sy)/height,w:(rect.w*innerW-(left+right)*sx)/width,h:(rect.h*innerH-(top+bottom)*sy)/height};
 }

 const trim={x:bounds.x*spec.widthMm*2,y:bounds.y*spec.heightMm,w:bounds.w*spec.widthMm*2,h:bounds.h*spec.heightMm};
 const left=bounds.x===0?spec.bleedMm:0,right=bounds.x+bounds.w>.999?spec.bleedMm:0;
 const top=bounds.y===0?spec.bleedMm:0,bottom=bounds.y+bounds.h>.999?spec.bleedMm:0;
 return {trim,image:{x:trim.x-left,y:trim.y-top,w:trim.w+left+right,h:trim.h+top+bottom}};
}
