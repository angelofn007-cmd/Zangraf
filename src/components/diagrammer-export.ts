import {ensureProjectFonts} from '@/lib/album-fonts';
import {drawIcons,drawTexture,surfaceFit,surfaceUrl} from '@/lib/album-decorations';
import {coverPageIndices} from '@/lib/cover-production';
import { cropRectangle, defaultCover, defaultBackCover, spreadRectangles, projectSpec, frameGeometry, printDimensions, validateProjectForPrint, type LayoutProject, type Slot, loadProject, projectPageIndices } from '@/lib/layout-projects';
import {drawCoverText,drawAlbumTexts} from './diagrammer-text';
import {applyPhotoAdjust,isNeutralAdjust,photoWarmthLayer} from '@/lib/photo-adjust';

export function downloadBlob(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
/** Recorte da foto já com a tonalidade aplicada, no tamanho em pixels em que ele será impresso. */
function adjustedPhoto(ctx:CanvasRenderingContext2D,bitmap:ImageBitmap,crop:{x:number;y:number;width:number;height:number},width:number,height:number,slot:Slot):HTMLCanvasElement|undefined{
 const t=ctx.getTransform(),scale=Math.hypot(t.a,t.b)||1;
 let w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
 const limit=Math.sqrt(60000000/(w*h));if(limit<1){w=Math.max(1,Math.floor(w*limit));h=Math.max(1,Math.floor(h*limit));}
 const piece=document.createElement('canvas');piece.width=w;piece.height=h;
 const p=piece.getContext('2d');if(!p)return undefined;
 p.drawImage(bitmap,crop.x,crop.y,crop.width,crop.height,0,0,w,h);
 const pixels=p.getImageData(0,0,w,h);applyPhotoAdjust(pixels.data,slot.adjust);p.putImageData(pixels,0,0);
 const warmth=photoWarmthLayer(slot.adjust);
 if(warmth){p.globalCompositeOperation='soft-light';p.globalAlpha=warmth.opacity;p.fillStyle=warmth.color;p.fillRect(0,0,w,h);}

 return piece;
}
/** Abre a foto original; se o navegador perdeu o arquivo (Safari), lê de novo do armazenamento. */
async function openPhoto(project:LayoutProject,photo:LayoutProject['photos'][number]):Promise<ImageBitmap>{
 try{return await createImageBitmap(photo.blob);}catch(first){
  const stored=(await loadProject(project.id).catch(()=>undefined))?.photos.find(p=>p.id===photo.id);
  if(stored){try{return await createImageBitmap(new Blob([await stored.blob.arrayBuffer()],{type:stored.blob.type||'image/jpeg'}));}catch{/* segue para o erro */}}
  // Nunca troca pela prévia: a impressão sairia em baixa resolução.
  throw new Error(`Não foi possível abrir a foto “${photo.name}”. Recarregue a página e tente de novo; se continuar, envie essa foto outra vez.`,{cause:first});
 }
}
async function drawPhoto(ctx:CanvasRenderingContext2D,project:LayoutProject,slot:Slot,x:number,y:number,width:number,height:number){
 const photo=project.photos.find(p=>p.id===slot.photoId);if(!photo)return;
 const bitmap=await openPhoto(project,photo);
 try{const crop=cropRectangle(bitmap.width,bitmap.height,width,height,slot);ctx.save();ctx.translate(x+(slot.flipX?width:0),y+(slot.flipY?height:0));ctx.scale(slot.flipX?-1:1,slot.flipY?-1:1);const piece=isNeutralAdjust(slot.adjust)?undefined:adjustedPhoto(ctx,bitmap,crop,width,height,slot);if(piece){ctx.drawImage(piece,0,0,width,height);piece.width=1;piece.height=1;}else ctx.drawImage(bitmap,crop.x,crop.y,crop.width,crop.height,0,0,width,height);ctx.restore();}finally{bitmap.close();}
}
const surfaces=new Map<string,Promise<ImageBitmap>>();
/** Carrega a textura fotográfica em resolução de impressão (uma vez por sessão). */
function loadSurface(id:string){
 let task=surfaces.get(id);
 if(!task){
  task=fetch(surfaceUrl(id)).then(response=>{if(!response.ok)throw new Error('Não foi possível carregar a textura de fundo. Confira a conexão e tente de novo.');return response.blob();}).then(blob=>createImageBitmap(blob));
  surfaces.set(id,task);task.catch(()=>surfaces.delete(id));
 }
 return task;
}
/** Desenha a textura cobrindo a área com sangria, centralizada, igual à pré-visualização. */
async function drawSurface(ctx:CanvasRenderingContext2D,id:string|undefined,width:number,height:number,bleed:number){
 if(!id)return;
 const image=await loadSurface(id);const fit=surfaceFit(id,width,height,bleed);
 ctx.drawImage(image,(width-fit.w)/2,(height-fit.h)/2,fit.w,fit.h);
}
async function drawComposition(ctx:CanvasRenderingContext2D,project:LayoutProject,index:number){
 await ensureProjectFonts(project);
 const spec=projectSpec(project,index);
 if(index<0){
  const cover=index===-2?(project.backCover||defaultBackCover()):(project.cover||defaultCover());
  const bleed=spec.bleedMm;
  ctx.fillStyle=cover.color;ctx.fillRect(-bleed,-bleed,spec.widthMm+bleed*2,spec.heightMm+bleed*2);
  await drawSurface(ctx,cover.surface,spec.widthMm,spec.heightMm,bleed);
  if(cover.backgroundPhotoId)await drawPhoto(ctx,project,{photoId:cover.backgroundPhotoId,x:50,y:50,zoom:1},-bleed,-bleed,spec.widthMm+bleed*2,spec.heightMm+bleed*2);
  drawTexture(ctx,cover.texture,spec.widthMm,spec.heightMm,bleed);
  await drawPhoto(ctx,project,cover.photo,-bleed,-bleed,spec.widthMm+bleed*2,spec.heightMm+bleed*2);
  if(cover.photo.photoId&&!cover.customText){ctx.fillStyle='rgba(0,0,0,.16)';ctx.fillRect(-bleed,-bleed,spec.widthMm+bleed*2,spec.heightMm+bleed*2)}
  if(cover.composition){
   const composition=cover.composition;const physical={...spec,widthMm:spec.widthMm/2};
   for(const [i,rect] of spreadRectangles(composition).entries()){const image=frameGeometry(rect,physical,false,composition.spacing).image;await drawPhoto(ctx,project,composition.slots[i],image.x,image.y,image.w,image.h);}
  }
  drawCoverText(ctx,cover,spec.widthMm,spec.heightMm,index===-2);
  drawAlbumTexts(ctx,cover.texts||[],spec.widthMm,spec.heightMm);
  drawIcons(ctx,cover.icons||[],spec.widthMm,spec.heightMm);
 }else{
  const spread=project.spreads[index];if(!spread)throw new Error('A lâmina solicitada não existe.');
  ctx.fillStyle=spread.background||'#ffffff';ctx.fillRect(-spec.bleedMm,-spec.bleedMm,spec.widthMm*2+spec.bleedMm*2,spec.heightMm+spec.bleedMm*2);
  await drawSurface(ctx,spread.surface,spec.widthMm*2,spec.heightMm,spec.bleedMm);
  if(spread.backgroundPhotoId)await drawPhoto(ctx,project,{photoId:spread.backgroundPhotoId,x:50,y:50,zoom:1},-spec.bleedMm,-spec.bleedMm,spec.widthMm*2+spec.bleedMm*2,spec.heightMm+spec.bleedMm*2);
  if(spread.rightBackground){ctx.fillStyle=spread.rightBackground;ctx.fillRect(spec.widthMm,-spec.bleedMm,spec.widthMm+spec.bleedMm,spec.heightMm+spec.bleedMm*2);}
  drawTexture(ctx,spread.texture,spec.widthMm*2,spec.heightMm,spec.bleedMm);
  for(const [frameIndex,rect] of spreadRectangles(spread).entries()){
   const image=frameGeometry(rect,spec,true,spread.spacing).image;
   await drawPhoto(ctx,project,spread.slots[frameIndex],image.x,image.y,image.w,image.h);
  }
  drawAlbumTexts(ctx,spread.texts||[],spec.widthMm*2,spec.heightMm);
  drawIcons(ctx,spread.icons||[],spec.widthMm*2,spec.heightMm);
 }
}
export async function renderPage(project:LayoutProject,index:number):Promise<HTMLCanvasElement>{
 const spec=projectSpec(project,index);
 const canvas=document.createElement('canvas');canvas.width=index<0?1000:1600;
 const physicalWidth=spec.widthMm*(index<0?1:2),scale=canvas.width/physicalWidth;
 canvas.height=Math.round(spec.heightMm*scale);
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Este navegador não permite exportar a prévia.');
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.save();ctx.scale(scale,scale);await drawComposition(ctx,project,index);ctx.restore();
 return canvas;
}
export async function exportAlbumPreview(project:LayoutProject,onProgress:(text:string)=>void){
 const pages:string[]=[];
 for(const index of projectPageIndices(project)){
  onProgress(`Preparando ${index<0?(index===-2?'verso da capa':'capa'):`lâmina ${index+1} de ${project.spreads.length}`}…`);
  const canvas=await renderPage(project,index);
  pages.push(`<figure class="${index<0?'cover':''}"><img src="${canvas.toDataURL('image/jpeg',.88)}" alt="${index<0?(index===-2?'Verso da capa':'Capa'):`Lâmina ${index+1}`}"/><figcaption>${index<0?(index===-2?'Verso da capa':'Capa'):`Lâmina ${index+1} · páginas ${index*2+1} e ${index*2+2}`}</figcaption></figure>`);
 }
 const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(project.name)} — prévia Zangraf</title><style>*{box-sizing:border-box}body{margin:0;padding:40px 20px;background:#eee8dc;color:#292823;font:16px system-ui}header,main,footer{max-width:1100px;margin:auto}h1{font:42px Georgia}p{line-height:1.6}figure{margin:40px 0}figure.cover{max-width:550px;margin:40px auto}img{display:block;width:100%;box-shadow:0 14px 40px #29282320}figcaption{text-align:center;font-size:13px;margin-top:14px}footer{border-top:1px solid #ccc4b7;padding-top:20px}@media print{body{background:white}figure{break-inside:avoid;page-break-after:always}img{box-shadow:none}}</style><header><p>ZANGRAF · PRÉVIA DO ÁLBUM</p><h1>${escapeHtml(project.name)}</h1><p>Uma prévia para revisar as fotos, a capa e a sequência. As proporções são ilustrativas. Este arquivo não contém as especificações técnicas para impressão.</p></header><main>${pages.join('')}</main><footer>Exportado em ${new Date().toLocaleString('pt-BR')}. Contém as fotografias deste projeto; compartilhe apenas com quem você deseja que as veja.</footer></html>`;
 downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),'zangraf-previa-do-album.html');
}
export async function exportCurrentPage(project:LayoutProject,index:number){
 const canvas=await renderPage(project,index);const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='rgba(255,255,255,.9)';ctx.fillRect(0,canvas.height-34,canvas.width,34);ctx.fillStyle='#292823';ctx.font='13px Arial';ctx.textAlign='left';ctx.fillText('ZANGRAF · PRÉVIA PARA REVISÃO · NÃO UTILIZAR PARA IMPRESSÃO',14,canvas.height-12);
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('Não foi possível gerar o arquivo.')),'image/png'));
 downloadBlob(blob,`zangraf-${index<0?(index===-2?'verso da capa':'capa'):`lamina-${index+1}`}.png`);
}

export type PrintFileKind = 'cover-front' | 'cover-back' | 'page' | 'spread';
export type PrintProgress = (message:string)=>void;

/** Canvas JPEGs are frequently tagged as 96 DPI. Set an explicit JFIF density. */
export async function jpegWithDpi(blob:Blob,dpi:number):Promise<Blob>{
 const bytes=new Uint8Array(await blob.arrayBuffer());
 if(bytes[0]!==255||bytes[1]!==216)throw new Error('O navegador não gerou um JPG válido.');
 let offset=2;
 while(offset+17<bytes.length&&bytes[offset]===255){
  const marker=bytes[offset+1];if(marker===218||marker===217)break;
  const length=bytes[offset+2]*256+bytes[offset+3];
  if(marker===224&&String.fromCharCode(...bytes.slice(offset+4,offset+9))==='JFIF\0'){
   bytes[offset+11]=1;bytes[offset+12]=dpi>>8;bytes[offset+13]=dpi&255;bytes[offset+14]=dpi>>8;bytes[offset+15]=dpi&255;
   return new Blob([bytes],{type:'image/jpeg'});
  }
  if(length<2)break;offset+=2+length;
 }
 const jfif=new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,dpi>>8,dpi&255,dpi>>8,dpi&255,0,0]);
 return new Blob([bytes.slice(0,2),jfif,bytes.slice(2)],{type:'image/jpeg'});
}

async function canvasJpeg(canvas:HTMLCanvasElement,dpi:number){
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Não foi possível gerar a imagem JPG.')),'image/jpeg',.97));
 return jpegWithDpi(blob,dpi);
}

/** Individual file renderer, also used by order upload. index is zero based. */
export async function renderPrintJpeg(project:LayoutProject,kind:PrintFileKind,index=0):Promise<Blob>{
 validateProjectForPrint(project);
 const spec=projectSpec(project,kind==='cover-front'?-1:kind==='cover-back'?-2:0);
 const isCover=kind==='cover-front'||kind==='cover-back';
 if(isCover&&!coverPageIndices(project.productionModel?.coverMode).includes(kind==='cover-back'?-2:-1))throw new Error('Este produto não possui essa parte de capa personalizável.');
 if(!Number.isInteger(index)||index<0)throw new Error('Página inválida.');
 const dimensions=printDimensions(spec,kind==='spread');
 if(dimensions.width*dimensions.height>100000000)throw new Error('Este formato excede o limite de exportação deste navegador.');
 const canvas=document.createElement('canvas');canvas.width=dimensions.width;canvas.height=dimensions.height;
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar o arquivo de produção.');
 const scale=spec.dpi/25.4;
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.save();ctx.scale(scale,scale);
 ctx.translate(spec.bleedMm-(kind==='page'&&index%2?spec.widthMm:0),spec.bleedMm);
 await drawComposition(ctx,project,isCover?(kind==='cover-back'?-2:-1):kind==='page'?Math.floor(index/2):index);
 ctx.restore();
 const blob=await canvasJpeg(canvas,spec.dpi);canvas.width=1;canvas.height=1;return blob;
}

const crcTable=Array.from({length:256},(_,value)=>{let crc=value;for(let i=0;i<8;i++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export async function zipFiles(files:{name:string;blob:Blob}[]):Promise<Blob>{
 const encoder=new TextEncoder();const chunks:BlobPart[]=[];const directory:Uint8Array<ArrayBuffer>[]=[];let offset=0;
 for(const file of files){
  const filename=encoder.encode(file.name);const data=new Uint8Array(await file.blob.arrayBuffer());const checksum=crc32(data);
  const header=new Uint8Array(30+filename.length);const local=new DataView(header.buffer);
  local.setUint32(0,0x04034b50,true);local.setUint16(4,20,true);local.setUint16(6,0x800,true);local.setUint32(14,checksum,true);local.setUint32(18,data.length,true);local.setUint32(22,data.length,true);local.setUint16(26,filename.length,true);header.set(filename,30);
  const central=new Uint8Array(46+filename.length);const entry=new DataView(central.buffer);
  entry.setUint32(0,0x02014b50,true);entry.setUint16(4,20,true);entry.setUint16(6,20,true);entry.setUint16(8,0x800,true);entry.setUint32(16,checksum,true);entry.setUint32(20,data.length,true);entry.setUint32(24,data.length,true);entry.setUint16(28,filename.length,true);entry.setUint32(42,offset,true);central.set(filename,46);
  chunks.push(header,file.blob);directory.push(central);offset+=header.length+data.length;
 }
 const directorySize=directory.reduce((size,entry)=>size+entry.length,0);const end=new Uint8Array(22);const view=new DataView(end.buffer);
 view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,directorySize,true);view.setUint32(16,offset,true);
 return new Blob([...chunks,...directory,end],{type:'application/zip'});
}

export function printWarnings(project:LayoutProject):string[]{
 const spec=project.printSpec;if(!spec)return ['O tamanho do álbum ainda não foi escolhido.'];
 const warnings:string[]=[];let lowResolution=0,emptyFrames=0;
 const check=(slot:Slot,widthMm:number,heightMm:number)=>{
  const photo=project.photos.find(item=>item.id===slot.photoId);if(!photo){emptyFrames++;return;}
  if(!photo.width||!photo.height){lowResolution++;return;}
  const crop=cropRectangle(photo.width,photo.height,widthMm,heightMm,slot);
  if(Math.min(crop.width/(widthMm/25.4),crop.height/(heightMm/25.4))<spec.dpi)lowResolution++;
 };
 for(const spread of project.spreads)spreadRectangles(spread).forEach((rect,index)=>{const {image}=frameGeometry(rect,spec,true,spread.spacing);check(spread.slots[index],image.w,image.h)});
 if(coverPageIndices(project.productionModel?.coverMode).includes(-1)&&project.cover?.photo.photoId){const s=projectSpec(project,-1);check(project.cover.photo,s.widthMm+s.bleedMm*2,s.heightMm+s.bleedMm*2);}
 for(const [cover,index] of [[project.cover,-1],[project.backCover,-2]] as const){if(!coverPageIndices(project.productionModel?.coverMode).includes(index))continue;if(cover?.composition){const s=projectSpec(project,index);for(const [i,r] of spreadRectangles(cover.composition).entries()){if(!cover.composition.slots[i]?.photoId&&Math.abs(r.x+r.w/2-.5)<.001&&r.w<.15)continue;const {image}=frameGeometry(r,{...s,widthMm:s.widthMm/2},false,cover.composition.spacing);check(cover.composition.slots[i],image.w,image.h);}}}
 if(project.backCover?.photo.photoId&&coverPageIndices(project.productionModel?.coverMode).includes(-2)){const s=projectSpec(project,-2);check(project.backCover.photo,s.widthMm+s.bleedMm*2,s.heightMm+s.bleedMm*2);}
 if(emptyFrames)warnings.push(`${emptyFrames} quadro(s) vazio(s) serão exportados sem fotografia.`);
 if(lowResolution)warnings.push(`${lowResolution} aplicação(ões) de foto têm resolução inferior a ${spec.dpi} DPI ou dimensões ainda desconhecidas. A ampliação não acrescenta detalhes à imagem.`);
 return warnings;
}

/** Returns a ZIP blob without triggering download, suitable for checkout uploads. */
export async function exportPrintPackage(project:LayoutProject,onProgress:PrintProgress=()=>{}):Promise<Blob>{
 validateProjectForPrint(project);const files:{name:string;blob:Blob}[]=[];
 const wrap=project.productionModel?.coverMode==='wrap',spread=project.productionModel?.insideMode==='spread';
 const covers:[PrintFileKind,string][]=coverPageIndices(project.productionModel?.coverMode).map(index=>index===-2?['cover-back','capa-verso.jpg']:['cover-front',wrap?'capa-inteira.jpg':'capa-frente.jpg']);
 for(const [kind,name] of covers){onProgress(`Preparando ${name}…`);files.push({name:'Capa/'+name,blob:await renderPrintJpeg(project,kind)});}
 const count=project.spreads.length*(spread?1:2);
 for(let index=0;index<count;index++){
  const name=`${spread?'Lâminas':'Páginas'}/${String(index+1).padStart(3,'0')}.jpg`;
  onProgress(`Preparando ${spread?'lâmina':'página'} ${index+1} de ${count}…`);files.push({name,blob:await renderPrintJpeg(project,spread?'spread':'page',index)});
 }
 onProgress('Organizando os JPGs no arquivo ZIP…');return zipFiles(files);
}
