import {photoLayouts,rankLayoutsForPhotos,DEFAULT_SPACING,type PhotoLayout} from './album-layouts';
import {emptySlot,type LayoutProject,type PrintSpec,type Slot,type Spread} from './layout-projects';

/** Uma foto como o "Montar o álbum para mim" enxerga: formato (largura ÷ altura) e quando foi tirada. */
export type AlbumPhoto={id:string;aspect:number;takenAt?:number};

/** Intervalo sem fotos que separa um momento do outro (ex.: cerimônia → festa). */
export const MOMENT_GAP_MS=30*60*1000;
export const MAX_PHOTOS_PER_SPREAD=10;

/**
 * Lê a data em que a foto foi tirada do EXIF de um JPEG (DateTimeOriginal; na falta, DateTime).
 * Recebe só o começo do arquivo (os primeiros ~256 KB bastam). Devolve milissegundos
 * contados como se o horário da câmera fosse UTC — serve para ordenar e medir intervalos.
 */
export function readExifDate(buffer:ArrayBuffer):number|undefined{
 const view=new DataView(buffer);
 if(view.byteLength<4||view.getUint16(0)!==0xFFD8)return undefined;
 let offset=2;
 while(offset+4<=view.byteLength){
  if(view.getUint8(offset)!==0xFF)return undefined;
  const marker=view.getUint8(offset+1);
  if(marker===0xDA||marker===0xD9)return undefined;
  const length=view.getUint16(offset+2);
  if(marker===0xE1&&offset+10<=view.byteLength&&view.getUint32(offset+4)===0x45786966)
   return readTiffDate(view,offset+10,Math.min(view.byteLength,offset+2+length));
  offset+=2+length;
 }
 return undefined;
}

function readTiffDate(view:DataView,start:number,end:number):number|undefined{
 if(start+8>end)return undefined;
 const order=view.getUint16(start);if(order!==0x4949&&order!==0x4D4D)return undefined;
 const little=order===0x4949;
 const fits=(position:number,size:number)=>position>=start&&position+size<=end;
 const u16=(position:number)=>view.getUint16(position,little),u32=(position:number)=>view.getUint32(position,little);
 const entries=(ifdOffset:number)=>{
  const position=start+ifdOffset;if(!fits(position,2))return [];
  const list:{tag:number;type:number;count:number;at:number}[]=[];
  for(let i=0;i<u16(position);i++){
   const at=position+2+i*12;if(!fits(at,12))break;
   list.push({tag:u16(at),type:u16(at+2),count:u32(at+4),at});
  }
  return list;
 };
 const text=(entry:{type:number;count:number;at:number}|undefined)=>{
  if(!entry||entry.type!==2||entry.count<19)return undefined;
  const position=entry.count<=4?entry.at+8:start+u32(entry.at+8);
  if(!fits(position,19))return undefined;
  let value='';for(let i=0;i<19;i++)value+=String.fromCharCode(view.getUint8(position+i));
  return parseExifDate(value);
 };
 const main=entries(u32(start+4));
 const pointer=main.find(entry=>entry.tag===0x8769);
 const exif=pointer?entries(u32(pointer.at+8)):[];
 return text(exif.find(entry=>entry.tag===0x9003))??text(exif.find(entry=>entry.tag===0x9004))??text(main.find(entry=>entry.tag===0x0132));
}

function parseExifDate(value:string):number|undefined{
 const match=/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);if(!match)return undefined;
 const [year,month,day,hour,minute,second]=match.slice(1).map(Number);
 if(year<1990||month<1||month>12||day<1||day>31)return undefined;
 return Date.UTC(year,month-1,day,hour,minute,second);
}

/** Fotos com data em ordem cronológica; as sem data vêm depois, na ordem em que foram importadas. */
export function orderPhotos(photos:AlbumPhoto[]):AlbumPhoto[]{
 const dated=photos.filter(photo=>photo.takenAt!==undefined).sort((a,b)=>a.takenAt!-b.takenAt!);
 return [...dated,...photos.filter(photo=>photo.takenAt===undefined)];
}

/** Separa a sequência em momentos sempre que passa mais de `gapMs` entre duas fotos seguidas. */
export function splitMoments(ordered:AlbumPhoto[],gapMs=MOMENT_GAP_MS):AlbumPhoto[][]{
 const moments:AlbumPhoto[][]=[];let previous:number|undefined;
 for(const photo of ordered){
  const jump=previous!==undefined&&photo.takenAt!==undefined&&photo.takenAt-previous>gapMs;
  if(!moments.length||jump)moments.push([]);
  moments[moments.length-1].push(photo);
  if(photo.takenAt!==undefined)previous=photo.takenAt;
 }
 return moments;
}

/** Quantas lâminas cada momento recebe: todos ganham ao menos uma, e o resto vai para quem está mais cheio. */
function allocate(sizes:number[],spreads:number):number[]{
 const result=sizes.map(()=>1);
 for(let left=spreads-sizes.length;left>0;left--){
  let best=-1;
  sizes.forEach((size,i)=>{if(result[i]<size&&(best<0||size/result[i]>sizes[best]/result[best]))best=i;});
  if(best<0)break;result[best]++;
 }
 return result;
}

/** Divide `count` fotos em `parts` lâminas; um momento longo abre com uma foto sozinha, em destaque. */
function chunkSizes(count:number,parts:number):number[]{
 const even=(total:number,n:number)=>Array.from({length:n},(_,i)=>Math.floor((i+1)*total/n)-Math.floor(i*total/n));
 if(parts>=3&&count/parts>=2.5&&Math.ceil((count-1)/(parts-1))<=MAX_PHOTOS_PER_SPREAD)return [1,...even(count-1,parts-1)];
 return even(count,parts);
}

export type AlbumPlan={groups:string[][];moments:number;leftover:number};

/**
 * Planeja o álbum: ordena por data, separa em momentos e reparte as fotos pelas `spreadCount` lâminas,
 * sem misturar momentos na mesma lâmina. Se houver mais fotos do que cabem (10 por lâmina),
 * escolhe fotos espaçadas ao longo da história em vez de cortar o final.
 */
export function planAlbum(photos:AlbumPhoto[],spreadCount:number):AlbumPlan{
 let ordered=orderPhotos(photos);
 const capacity=spreadCount*MAX_PHOTOS_PER_SPREAD;const leftover=Math.max(0,ordered.length-capacity);
 if(leftover)ordered=Array.from({length:capacity},(_,i)=>ordered[Math.floor(i*ordered.length/capacity)]);
 const usable=Math.min(spreadCount,ordered.length);
 if(!usable)return {groups:Array.from({length:spreadCount},()=>[]),moments:0,leftover};
 let moments=splitMoments(ordered);
 // Mais momentos do que lâminas: junta o menor par de momentos vizinhos até caber.
 while(moments.length>usable){
  let pair=0;
  for(let i=1;i<moments.length-1;i++)if(moments[i].length+moments[i+1].length<moments[pair].length+moments[pair+1].length)pair=i;
  moments.splice(pair,2,[...moments[pair],...moments[pair+1]]);
 }
 let counts=allocate(moments.map(m=>m.length),usable);
 // Um momento grande demais para as lâminas que sobraram: monta como uma história só.
 if(moments.some((moment,i)=>Math.ceil(moment.length/counts[i])>MAX_PHOTOS_PER_SPREAD)){moments=[ordered];counts=[usable];}
 const groups:string[][]=[];
 moments.forEach((moment,i)=>{
  let next=0;
  for(const size of chunkSizes(moment.length,counts[i])){groups.push(moment.slice(next,next+size).map(photo=>photo.id));next+=size;}
 });
 while(groups.length<spreadCount)groups.push([]);
 return {groups,moments:moments.length,leftover};
}

/**
 * Escolhe o layout que mais combina com o formato das fotos. Para o álbum não ficar repetitivo,
 * evita repetir a composição da lâmina anterior quando há outra quase tão boa.
 */
export function pickLayout(aspects:number[],spreadAspect:number,previousName?:string){
 const all=photoLayouts(aspects.length,spreadAspect);
 // 1 foto = lâmina inteira; 2 fotos = meio a meio (uma por página).
 const fixed=aspects.length===1?all.find(l=>l.id==='full-1'):aspects.length===2?all.find(l=>l.id==='pages-2'):undefined;
 if(fixed)return rankLayoutsForPhotos([fixed],aspects,spreadAspect)[0];
 // Da 3ª em diante: mosaicos que cobrem a lâmina toda (sem área vazia), escolhidos pelo formato das fotos.
 const covering=all.filter(l=>Math.abs(l.frames.reduce((sum,f)=>sum+f.w*f.h,0)-1)<1e-6);
 const ranked=rankLayoutsForPhotos(covering.length?covering:all,aspects,spreadAspect);
 const best=ranked[0];if(!best)return undefined;
 if(best.layout.name!==previousName)return best;
 return ranked.find(fit=>fit.layout.name!==previousName&&fit.score<=best.score+.08)||best;
}

export function layoutSpacing(layout:PhotoLayout,spec:PrintSpec){
 return {...DEFAULT_SPACING};
}

export type AutoAlbumResult={project:LayoutProject;placed:number;moments:number;leftover:number};

/**
 * Monta todas as lâminas internas de uma vez. Mantém textos, ícones, texturas e fundos de cada lâmina,
 * não mexe nas capas e não usa no miolo as fotos que já estão na capa.
 * `focusOf` (opcional) devolve o ponto importante da foto (ex.: um rosto) para centralizar o recorte.
 */
export function autoLayoutProject(project:LayoutProject,takenAt:Record<string,number|undefined>,spec:PrintSpec,focusOf?:(photoId:string,slot:Slot,frameW:number,frameH:number)=>Slot):AutoAlbumResult{
 const onCover=new Set<string>();
 for(const cover of [project.cover,project.backCover]){
  if(cover?.photo.photoId)onCover.add(cover.photo.photoId);
  for(const slot of cover?.composition?.slots||[])if(slot.photoId)onCover.add(slot.photoId);
 }
 const aspectOf=new Map<string,number>();
 const photos:AlbumPhoto[]=project.photos.filter(photo=>!onCover.has(photo.id)).map(photo=>{
  const aspect=photo.width&&photo.height?photo.width/photo.height:1.5;aspectOf.set(photo.id,aspect);
  return {id:photo.id,aspect,takenAt:takenAt[photo.id]};
 });
 const plan=planAlbum(photos,project.spreads.length);
 const spreadAspect=spec.widthMm/spec.heightMm*2;
 let previousName:string|undefined;let placed=0;
 const spreads=project.spreads.map((spread,i):Spread=>{
  const ids=plan.groups[i]||[];
  const base={...spread,frames:undefined,spacing:undefined};
  if(!ids.length){previousName=undefined;return {...base,layout:'dupla',slots:[emptySlot(),emptySlot()]};}
  const fit=pickLayout(ids.map(id=>aspectOf.get(id)??1.5),spreadAspect,previousName)!;
  previousName=fit.layout.name;placed+=ids.length;
  const slots=fit.order.map((photoIndex,frameIndex)=>{
   const slot={...emptySlot(),photoId:ids[photoIndex]};
   const rect=fit.layout.frames[frameIndex];
   return focusOf?focusOf(slot.photoId,slot,rect.w*spec.widthMm*2,rect.h*spec.heightMm):slot;
  });
  return {...base,layout:'livre',frames:fit.layout.frames,spacing:layoutSpacing(fit.layout,spec),slots};
 });
 return {project:{...project,spreads},placed,moments:plan.moments,leftover:plan.leftover};
}
