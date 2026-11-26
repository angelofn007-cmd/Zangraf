import {photoLayouts,rankLayoutsForPhotos,DEFAULT_SPACING,type PhotoLayout,type LayoutFit} from './album-layouts';
import {emptySlot,type LayoutProject,type PrintSpec,type Slot,type Spread} from './layout-projects';

/**
 * Uma foto como o "Montar o álbum para mim" enxerga: formato (largura ÷ altura), quando foi tirada,
 * quantos pixels tem e se aparece um rosto (os dois últimos ajudam a escolher destaques e descartes).
 */
export type AlbumPhoto={id:string;aspect:number;takenAt?:number;pixels?:number;face?:boolean;/** Nome do arquivo (IMG_1234.jpg): ajuda a encaixar fotos sem data. */name?:string};

/** Intervalo sem fotos que separa um momento do outro (ex.: cerimônia → festa). */
export const MOMENT_GAP_MS=30*60*1000;
export const MAX_PHOTOS_PER_SPREAD=10;
/** Fotos tiradas com menos que isso de diferença são da mesma rajada (quase iguais). */
export const BURST_MS=3*1000;
/** Proporção típica de uma lâmina aberta (usada quando a medida real não é informada). */
const DEFAULT_SPREAD_ASPECT=2.8;

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

/**
 * Data e hora no nome do arquivo, como os celulares gravam (IMG_20260510_153000.jpg, PXL_20260510_153000123.jpg,
 * Screenshot_2026-05-10-15-30-00.png, Captura de Tela 2026-05-10 at 15.30.00.png). Só aceita nomes com data E hora completas; no mesmo padrão do EXIF.
 */
export function dateFromName(name:string|undefined):number|undefined{
 const match=/(?:^|\D)(20\d{2})[-_.]?(\d{2})[-_.]?(\d{2})(?: at |[-_ T.]{0,3})(\d{2})[-_.:h]?(\d{2})[-_.:m]?(\d{2})/.exec(name||'');
 if(!match)return undefined;
 const [year,month,day,hour,minute,second]=match.slice(1).map(Number);
 if(month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)return undefined;
 return Date.UTC(year,month-1,day,hour,minute,second);
}

/** Prefixo e número sequencial do nome (IMG_1234.jpg → IMG_ e 1234). */
function sequenceOf(name:string|undefined){
 const match=/^(.*?)(\d{3,})(?:\.\w+)?$/.exec(name||'');
 return match?{prefix:match[1].toLowerCase(),number:Number(match[2])}:undefined;
}

/**
 * Posição estimada de uma foto sem data: logo depois da foto com data da mesma câmera (mesmo prefixo)
 * que tem o número anterior a ela. Só vale quando a numeração dessa câmera acompanha as datas
 * (duas câmeras com o mesmo prefixo misturam os números e aí nada é estimado).
 */
function estimatedTimes(photos:AlbumPhoto[]):Map<string,{time:number;offset:number}>{
 const groups=new Map<string,{number:number;takenAt:number}[]>();
 for(const photo of photos){
  const seq=sequenceOf(photo.name);
  if(seq&&photo.takenAt!==undefined){const list=groups.get(seq.prefix)||[];list.push({number:seq.number,takenAt:photo.takenAt});groups.set(seq.prefix,list);}
 }
 for(const [prefix,list] of groups){
  list.sort((a,b)=>a.takenAt-b.takenAt||a.number-b.number);
  if(list.some((item,i)=>i>0&&item.number<=list[i-1].number))groups.delete(prefix);
 }
 const result=new Map<string,{time:number;offset:number}>();
 for(const photo of photos){
  if(photo.takenAt!==undefined)continue;
  const seq=sequenceOf(photo.name);const list=seq&&groups.get(seq.prefix);if(!seq||!list)continue;
  const before=[...list].reverse().find(item=>item.number<seq.number);
  // Mesmo horário da vizinha, com desempate pela numeração: fica colada nela.
  if(before)result.set(photo.id,{time:before.takenAt,offset:seq.number-before.number});
  else if(list[0].number>seq.number)result.set(photo.id,{time:list[0].takenAt,offset:seq.number-list[0].number});
 }
 return result;
}

/**
 * Fotos com data em ordem cronológica. As sem data entram ao lado das vizinhas de numeração da mesma câmera;
 * as que nem isso permite vêm depois, na ordem em que foram importadas.
 */
export function orderPhotos(photos:AlbumPhoto[]):AlbumPhoto[]{
 const estimated=estimatedTimes(photos);
 const key=(photo:AlbumPhoto)=>photo.takenAt!==undefined?{time:photo.takenAt,offset:0}:estimated.get(photo.id);
 const placed=photos.filter(photo=>key(photo)).sort((a,b)=>{const x=key(a)!,y=key(b)!;return x.time-y.time||x.offset-y.offset;});
 return [...placed,...photos.filter(photo=>!key(photo))];
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

/** Qualidade relativa (0–2): resolução comparada às outras fotos e presença de rosto. */
function quality(photo:AlbumPhoto,maxPixels:number){return (photo.pixels||0)/Math.max(1,maxPixels)+(photo.face?1:0);}

/**
 * Com fotos demais, descarta primeiro as repetidas de uma rajada (fica a melhor de cada rajada),
 * só até caber. O que ainda sobrar é resolvido depois espaçando as fotos pela história.
 */
export function trimBursts(ordered:AlbumPhoto[],capacity:number,burstMs=BURST_MS):AlbumPhoto[]{
 const excess=ordered.length-capacity;if(excess<=0)return ordered;
 const maxPixels=Math.max(0,...ordered.map(p=>p.pixels||0));
 const bursts:AlbumPhoto[][]=[];
 ordered.forEach((photo,i)=>{
  const previous=ordered[i-1];
  const together=previous?.takenAt!==undefined&&photo.takenAt!==undefined&&photo.takenAt-previous.takenAt<burstMs;
  if(together)bursts[bursts.length-1].push(photo);else bursts.push([photo]);
 });
 // Em cada rajada, todas menos a melhor podem sair; saem primeiro as de menor qualidade.
 const removable=bursts.flatMap(burst=>burst.length<2?[]:[...burst].sort((a,b)=>quality(b,maxPixels)-quality(a,maxPixels)).slice(1));
 removable.sort((a,b)=>quality(a,maxPixels)-quality(b,maxPixels));
 const drop=new Set(removable.slice(0,excess).map(photo=>photo.id));
 return ordered.filter(photo=>!drop.has(photo.id));
}

/**
 * Foto que abre um momento sozinha na lâmina inteira: escolhe, entre as primeiras do momento,
 * a de formato mais próximo da lâmina (menos corte), com rosto e boa resolução.
 */
function heroIndex(candidates:AlbumPhoto[],spreadAspect:number,maxPixels:number){
 let best=0,bestScore=-Infinity;
 candidates.forEach((photo,i)=>{
  const score=-Math.abs(Math.log(photo.aspect/spreadAspect))+.3*quality(photo,maxPixels)-i*.02;
  if(score>bestScore){best=i;bestScore=score;}
 });
 return best;
}

export type AlbumPlan={groups:string[][];moments:number;leftover:number};

/**
 * Planeja o álbum: ordena por data, separa em momentos e reparte as fotos pelas `spreadCount` lâminas,
 * sem misturar momentos na mesma lâmina. Se houver mais fotos do que cabem (10 por lâmina),
 * escolhe fotos espaçadas ao longo da história em vez de cortar o final.
 */
export function planAlbum(photos:AlbumPhoto[],spreadCount:number,spreadAspect=DEFAULT_SPREAD_ASPECT):AlbumPlan{
 const capacity=spreadCount*MAX_PHOTOS_PER_SPREAD;const leftover=Math.max(0,photos.length-capacity);
 let ordered=trimBursts(orderPhotos(photos),capacity);
 const maxPixels=Math.max(0,...photos.map(p=>p.pixels||0));
 if(ordered.length>capacity)ordered=Array.from({length:capacity},(_,i)=>ordered[Math.floor(i*ordered.length/capacity)]);
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
  const sizes=chunkSizes(moment.length,counts[i]);
  // Momento que abre com uma foto sozinha: traz para a frente a melhor das primeiras fotos.
  if(sizes.length>1&&sizes[0]===1){
   const best=heroIndex(moment.slice(0,1+sizes[1]),spreadAspect,maxPixels);
   if(best)moment=[moment[best],...moment.slice(0,best),...moment.slice(best+1)];
  }
  let next=0;
  for(const size of sizes){groups.push(moment.slice(next,next+size).map(photo=>photo.id));next+=size;}
 });
 while(groups.length<spreadCount)groups.push([]);
 return {groups,moments:moments.length,leftover};
}

/**
 * Escolhe o layout que mais combina com o formato das fotos. Para o álbum não ficar repetitivo,
 * evita repetir a composição da lâmina anterior quando há outra quase tão boa.
 */
export type PickOptions=Parameters<typeof rankLayoutsForPhotos>[3];
/** O layout tem foto nas duas páginas? (Na montagem automática nenhuma página fica em branco.) */
export function fillsBothPages(layout:PhotoLayout){
 const eps=1e-6;
 return layout.frames.some(f=>f.x<.5-eps)&&layout.frames.some(f=>f.x+f.w>.5+eps);
}
/**
 * Escolhe o layout que mais combina com o formato das fotos. Para o álbum não ficar repetitivo,
 * evita repetir a composição da lâmina anterior quando há outra quase tão boa.
 * Com `options.sizes`/`areaMm`/`dpi`, evita quadros grandes demais para a resolução das fotos.
 */
export function pickLayout(aspects:number[],spreadAspect:number,previousName?:string,options:PickOptions={}):LayoutFit|undefined{
 // Layouts que deixam uma página vazia (ex.: "Dupla na direita") ficam só para quem monta à mão.
 const every=photoLayouts(aspects.length,spreadAspect),both=every.filter(fillsBothPages);
 const all=both.length?both:every;
 const rank=(layouts:PhotoLayout[])=>rankLayoutsForPhotos(layouts,aspects,spreadAspect,options);
 // 1 foto = lâmina inteira, sempre (a checagem do editor avisa se a foto ficar com pouca nitidez).
 if(aspects.length===1){const full=every.find(l=>l.id==='full-1');if(full)return rank([full])[0];}
 // 2 fotos = meio a meio (uma por página)…
 const fixed=aspects.length===2?all.find(l=>l.id==='pages-2'):undefined;
 if(fixed){
  const fit=rank([fixed])[0];
  if(!fit.lowResolution)return fit;
  // …a não ser que a foto fique sem nitidez nesse tamanho: aí vai para um quadro menor que ela aguente.
  return rank(all).find(other=>!other.lowResolution)||fit;
 }
 // Da 3ª em diante: mosaicos que cobrem a lâmina toda (sem área vazia), escolhidos pelo formato das fotos.
 const covering=all.filter(l=>Math.abs(l.frames.reduce((sum,f)=>sum+f.w*f.h,0)-1)<1e-6);
 let ranked=rank(covering.length?covering:all);
 // Se todo mosaico deixa alguma foto sem nitidez, aceita layouts com respiro (quadros menores).
 if(ranked.length&&ranked[0].lowResolution){const sharp=rank(all).filter(fit=>!fit.lowResolution);if(sharp.length)ranked=sharp;}
 const best=ranked[0];if(!best)return undefined;
 if(best.layout.name!==previousName)return best;
 return ranked.find(fit=>fit.layout.name!==previousName&&fit.score<=best.score+.08)||best;
}

export function layoutSpacing(_layout:PhotoLayout,_spec:PrintSpec){
 return {...DEFAULT_SPACING};
}

export type AutoAlbumResult={project:LayoutProject;placed:number;moments:number;leftover:number};

/**
 * Monta todas as lâminas internas de uma vez. Mantém textos, ícones, texturas e fundos de cada lâmina,
 * não mexe nas capas e não usa no miolo as fotos que já estão na capa.
 * `focusOf` (opcional) devolve o ponto importante da foto (ex.: um rosto) para centralizar o recorte.
 */
export function autoLayoutProject(project:LayoutProject,takenAt:Record<string,number|undefined>,spec:PrintSpec,focusOf?:(photoId:string,slot:Slot,frameW:number,frameH:number)=>Slot,faces?:ReadonlySet<string>):AutoAlbumResult{
 const onCover=new Set<string>();
 for(const cover of [project.cover,project.backCover]){
  if(cover?.photo.photoId)onCover.add(cover.photo.photoId);
  for(const slot of cover?.composition?.slots||[])if(slot.photoId)onCover.add(slot.photoId);
 }
 const aspectOf=new Map<string,number>();
 const photos:AlbumPhoto[]=project.photos.filter(photo=>!photo.background&&!onCover.has(photo.id)).map(photo=>{
  const aspect=photo.width&&photo.height?photo.width/photo.height:1.5;aspectOf.set(photo.id,aspect);
  return {id:photo.id,aspect,takenAt:takenAt[photo.id],pixels:(photo.width||0)*(photo.height||0),face:faces?.has(photo.id),name:photo.name};
 });
 const spreadAspect=spec.widthMm/spec.heightMm*2;
 const plan=planAlbum(photos,project.spreads.length,spreadAspect);
 const sizeOf=new Map(project.photos.map(photo=>[photo.id,{width:photo.width,height:photo.height}]));
 const areaMm={width:spec.widthMm*2,height:spec.heightMm};
 let previousName:string|undefined;let placed=0;
 const spreads=project.spreads.map((spread,i):Spread=>{
  const ids=plan.groups[i]||[];
  const base={...spread,frames:undefined,spacing:undefined};
  if(!ids.length){previousName=undefined;return {...base,layout:'dupla',slots:[emptySlot(),emptySlot()]};}
  const fit=pickLayout(ids.map(id=>aspectOf.get(id)??1.5),spreadAspect,previousName,{sizes:ids.map(id=>sizeOf.get(id)||{}),areaMm,dpi:spec.dpi})!;
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
