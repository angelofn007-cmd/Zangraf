import {coverPageIndices} from './cover-production';
import {cropRectangle,effectiveDpi,frameGeometry,projectSpec,resolutionLevel,spreadRectangles,type AlbumText,type LayoutProject,type Photo,type Slot} from './layout-projects';

/** Distância mínima entre o texto e a borda de corte (a mesma da guia de área segura). */
export const SAFE_MARGIN_MM=5;
/** Faixa em volta da dobra central em que um rosto fica "dentro" da dobra. */
export const FOLD_BAND_MM=12;

export type IssueKind='low-dpi'|'fold-face'|'text-edge'|'empty-frame'|'duplicate'|'limit-dpi'|'fold-photo'|'text-fold'|'empty-spread';
export type AlbumIssue={kind:IssueKind;level:'error'|'warning';page:number;frame?:number;textId?:string;detail:string};

/** Títulos, explicações e ordem de exibição de cada tipo de problema. */
export const ISSUE_INFO:Record<IssueKind,{title:string;hint:string}>={
 'low-dpi':{title:'Fotos que podem sair borradas',hint:'A foto está grande demais para a resolução dela. Diminua o zoom, use um quadro menor ou envie o arquivo original.'},
 'fold-face':{title:'Rosto na dobra do meio',hint:'Um rosto ficou bem em cima da dobra central do álbum. Arraste a foto para o lado ou troque o layout.'},
 'text-edge':{title:'Texto perto do corte',hint:`Textos a menos de ${SAFE_MARGIN_MM} mm da borda podem ser cortados no acabamento. Afaste-os da beirada.`},
 'empty-frame':{title:'Quadros vazios',hint:'Esses quadros serão impressos sem foto. Coloque uma foto ou exclua o quadro.'},
 'duplicate':{title:'Fotos repetidas',hint:'A mesma foto aparece mais de uma vez no álbum. Confira se foi de propósito.'},
 'limit-dpi':{title:'Qualidade no limite',hint:'Vão imprimir, mas um pouco menos nítidas que o ideal.'},
 'fold-photo':{title:'Fotos passando pela dobra',hint:'Estas fotos atravessam a dobra central. Confira se nenhum rosto ou detalhe importante ficou no meio.'},
 'text-fold':{title:'Texto na dobra',hint:'Parte do texto cai na dobra central e pode ficar difícil de ler.'},
 'empty-spread':{title:'Lâminas em branco',hint:'Lâminas sem fotos nem textos serão impressas em branco.'},
};
export const ISSUE_ORDER:IssueKind[]=['low-dpi','fold-face','text-edge','empty-frame','duplicate','limit-dpi','fold-photo','text-fold','empty-spread'];

/** Ponto importante da foto (0–1), por exemplo o centro de um rosto, quando conhecido. */
export type FaceLookup=(photoId:string)=>{x:number;y:number}[]|undefined;

export function pageLabel(project:LayoutProject,page:number){
 if(page>=0)return `Lâmina ${page+1}`;
 if(page===-1)return project.productionModel?.coverMode==='wrap'?'Capa':'Capa (frente)';
 return 'Capa (verso)';
}

/** Caixa aproximada ocupada pelo texto, em mm. Estima a quebra de linha pelo tamanho médio das letras. */
export function textBox(text:AlbumText,widthMm:number,heightMm:number){
 const font=text.fontSize*25.4/72,line=font*1.25,char=font*.52;
 const boxWidth=widthMm*text.width/100;
 const perLine=Math.max(1,Math.floor(boxWidth/char));
 const paragraphs=text.text.split('\n');
 const lines=paragraphs.reduce((sum,p)=>sum+Math.max(1,Math.ceil(p.length/perLine)),0);
 const used=Math.min(boxWidth,Math.max(...paragraphs.map(p=>p.length))*char);
 const boxLeft=widthMm*text.x/100,top=heightMm*text.y/100;
 const left=text.align==='center'?boxLeft+(boxWidth-used)/2:text.align==='right'?boxLeft+boxWidth-used:boxLeft;
 return {left,right:left+used,top,bottom:top+lines*line};
}

/**
 * Tudo que pode dar problema na impressão, com a lâmina (e o quadro ou texto) onde está.
 * `faces` é opcional: sem ele, fotos que atravessam a dobra viram um aviso para conferir.
 */
export function checkAlbum(project:LayoutProject,faces?:FaceLookup):AlbumIssue[]{
 const issues:AlbumIssue[]=[];
 const photos=new Map<string,Photo>(project.photos.map(p=>[p.id,p]));
 const uses=new Map<string,{page:number;frame:number}[]>();
 const usePhoto=(slot:Slot|undefined,page:number,frame:number)=>{if(slot?.photoId)uses.set(slot.photoId,[...(uses.get(slot.photoId)||[]),{page,frame}]);};
 const checkResolution=(slot:Slot,page:number,frame:number,w:number,h:number,target:number)=>{
  const photo=photos.get(slot.photoId||'');if(!photo)return;
  const dpi=effectiveDpi(photo,w,h,slot);const level=resolutionLevel(dpi,target);
  if(level!=='ok'&&dpi!==undefined)issues.push({kind:level==='low'?'low-dpi':'limit-dpi',level:level==='low'?'error':'warning',page,frame,detail:`${photo.name} · ${Math.round(dpi)} DPI de ${target}`});
 };

 project.spreads.forEach((spread,page)=>{
  const spec=projectSpec(project,page);const W=spec.widthMm*2,H=spec.heightMm,fold=spec.widthMm;
  let photosHere=0;
  spreadRectangles(spread).forEach((rect,frame)=>{
   const slot=spread.slots[frame];
   if(!slot?.photoId||!photos.has(slot.photoId)){issues.push({kind:'empty-frame',level:'error',page,frame,detail:`Quadro ${frame+1}`});return;}
   photosHere++;usePhoto(slot,page,frame);
   const photo=photos.get(slot.photoId)!;
   const {trim,image}=frameGeometry(rect,spec,true,spread.spacing);
   checkResolution(slot,page,frame,image.w,image.h,spec.dpi);
   // A foto atravessa a dobra com uma parte relevante dos dois lados?
   const side=Math.min(fold-trim.x,trim.x+trim.w-fold);
   if(side<Math.min(15,trim.w*.1))return;
   const known=photo.width&&photo.height?faces?.(photo.id):undefined;
   if(known&&photo.width&&photo.height){
    const crop=cropRectangle(photo.width,photo.height,image.w,image.h,slot);
    const toPhotoX=(mm:number)=>{let u=(mm-image.x)/image.w;if(slot.flipX)u=1-u;return (crop.x+u*crop.width)/photo.width!;};
    const band=[toPhotoX(fold-FOLD_BAND_MM/2),toPhotoX(fold+FOLD_BAND_MM/2)].sort((a,b)=>a-b);
    const yTop=crop.y/photo.height,yBottom=(crop.y+crop.height)/photo.height;
    if(known.some(face=>face.x>=band[0]&&face.x<=band[1]&&face.y>=yTop&&face.y<=yBottom))
     issues.push({kind:'fold-face',level:'error',page,frame,detail:photo.name});
   }else issues.push({kind:'fold-photo',level:'warning',page,frame,detail:photo.name});
  });
  for(const text of spread.texts||[]){
   if(!text.text.trim()||text.rotation===90)continue;
   const box=textBox(text,W,H);const short=text.text.trim().slice(0,30)+(text.text.trim().length>30?'…':'');
   if(box.left<SAFE_MARGIN_MM||box.top<SAFE_MARGIN_MM||box.right>W-SAFE_MARGIN_MM||box.bottom>H-SAFE_MARGIN_MM)
    issues.push({kind:'text-edge',level:'error',page,textId:text.id,detail:`“${short}”`});
   else if(box.left<fold-3&&box.right>fold+3)
    issues.push({kind:'text-fold',level:'warning',page,textId:text.id,detail:`“${short}”`});
  }
  if(!photosHere&&!spread.texts?.some(t=>t.text.trim())&&!spread.icons?.length)
   issues.push({kind:'empty-spread',level:'warning',page,detail:'Sem fotos nem textos'});
 });

 // Capas: resolução, quadros vazios e repetições.
 const covers=coverPageIndices(project.productionModel?.coverMode);
 for(const [cover,page] of [[project.cover,-1],[project.backCover,-2]] as const){
  if(!cover||!covers.includes(page))continue;
  const spec=projectSpec(project,page);
  if(cover.composition){
   spreadRectangles(cover.composition).forEach((rect,frame)=>{
    const slot=cover.composition!.slots[frame];
    const spine=Math.abs(rect.x+rect.w/2-.5)<.001&&rect.w<.15;
    if(!slot?.photoId||!photos.has(slot.photoId)){if(!spine)issues.push({kind:'empty-frame',level:'error',page,frame,detail:`Quadro ${frame+1}`});return;}
    usePhoto(slot,page,frame);
    const {image}=frameGeometry(rect,{...spec,widthMm:spec.widthMm/2},false,cover.composition!.spacing);
    checkResolution(slot,page,frame,image.w,image.h,spec.dpi);
   });
  }else if(cover.photo.photoId&&photos.has(cover.photo.photoId)){
   usePhoto(cover.photo,page,0);
   checkResolution(cover.photo,page,0,spec.widthMm+spec.bleedMm*2,spec.heightMm+spec.bleedMm*2,spec.dpi);
  }
 }

 // A mesma foto em mais de um lugar, ou o mesmo arquivo importado duas vezes.
 const sameFile=new Map<string,string>();
 for(const id of uses.keys()){
  const p=photos.get(id)!;const key=`${p.name}|${p.blob?.size}|${p.width}x${p.height}`;
  const first=sameFile.get(key);
  if(first)uses.set(first,[...uses.get(first)!,...uses.get(id)!]),uses.delete(id);else sameFile.set(key,id);
 }
 for(const [id,places] of uses){
  if(places.length<2)continue;
  const sorted=[...places].sort((a,b)=>(a.page<0?1e6-a.page:a.page)-(b.page<0?1e6-b.page:b.page));
  for(const place of sorted.slice(1))
   issues.push({kind:'duplicate',level:'warning',page:place.page,frame:place.frame,detail:`${photos.get(id)?.name||'Foto'} · também em ${pageLabel(project,sorted[0].page)}`});
 }
 return issues;
}
