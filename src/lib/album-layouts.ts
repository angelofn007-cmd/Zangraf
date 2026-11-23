import type {FrameRect,LayoutProject} from './layout-projects';
export type PhotoLayout={id:string;name:string;frames:FrameRect[];marginRatio?:number};
/** Respiro padrão dos layouts: 0,25 cm de margem externa e 0,2 cm entre as fotos. */
export const DEFAULT_SPACING={marginMm:2.5,gapMm:2} as const;
/** Centered spine dimensions from the manufacturer's 500 g / 800 g table. */
export function coverSpineMm(project:LayoutProject):number {
 if(project.productionModel?.coverMode!=='wrap')return 0;
 const stock=project.productionModel.stock||project.configuration?.stock;
 const count=project.productionModel.sheets;
 return stock==='500 g'?Math.round((5+count*.6)*10)/10:stock==='800 g'?5+count:0;
}
export function coverRegions(widthMm:number,spineMm:number):FrameRect[]{
 const spine=spineMm/widthMm,side=(1-spine)/2;
 return [{x:0,y:0,w:side,h:1},{x:side,y:0,w:spine,h:1},{x:side+spine,y:0,w:side,h:1}];
}

/* ---------- Peças para montar os mosaicos (coordenadas 0–1 da lâmina aberta) ---------- */
const r=(x:number,y:number,w:number,h:number):FrameRect=>({x,y,w,h});
function rows(count:number,rowCount:number):FrameRect[]{
 const result:FrameRect[]=[];
 for(let row=0;row<rowCount;row++){
  const columns=Math.floor(count/rowCount)+(row<count%rowCount?1:0);
  for(let col=0;col<columns;col++)result.push({x:col/columns,y:row/rowCount,w:1/columns,h:1/rowCount});
 }
 return result;
}
const grid=(cols:number,rowCount:number)=>rows(cols*rowCount,rowCount);
const stack=(count:number)=>rows(count,count);
function within(frames:FrameRect[],x:number,y:number,w:number,h:number):FrameRect[]{return frames.map(f=>({x:x+f.x*w,y:y+f.y*h,w:f.w*w,h:f.h*h}));}
const left=(frames:FrameRect[])=>within(frames,0,0,.5,1);
const right=(frames:FrameRect[])=>within(frames,.5,0,.5,1);
const FULL=[r(0,0,1,1)];
/** Uma foto larga em cima e duas embaixo, dentro de uma página. */
const wideOverTwo=[r(0,0,1,.5),r(0,.5,.5,.5),r(.5,.5,.5,.5)];
const mirrorFrames=(frames:FrameRect[])=>frames.map(f=>({...f,x:1-f.x-f.w}));

type Entry={id:string;name:string;frames:FrameRect[];marginRatio?:number;mirror?:boolean};
/**
 * Catálogo por quantidade de fotos, do mais usado para o menos usado.
 * Os quadros cobrem a lâmina inteira: margem e espaço entre fotos vêm do "Respiro", em milímetros.
 * `mirror` gera também a versão espelhada, logo depois dos originais.
 */
const CATALOG:Record<number,Entry[]>={
 1:[
  {id:'full',name:'Panorâmica',frames:FULL,marginRatio:0},
  {id:'page-right',name:'Página direita',frames:right(FULL),marginRatio:0},
  {id:'page-left',name:'Página esquerda',frames:left(FULL),marginRatio:0},
  {id:'framed',name:'Moldura',frames:within(FULL,.07,.09,.86,.82)},
  {id:'portrait',name:'Retrato central',frames:within(FULL,.3,.06,.4,.88)},
  {id:'right-framed',name:'Destaque à direita',frames:within(FULL,.56,.1,.36,.8)},
 ],
 2:[
  {id:'pages',name:'Uma por página',frames:[...left(FULL),...right(FULL)],marginRatio:0},
  {id:'pages-framed',name:'Duas com borda',frames:[...left(FULL),...right(FULL)],marginRatio:.07},
  {id:'hero-detail',name:'Página e detalhe',frames:[...left(FULL),...within(FULL,.6,.16,.3,.68)],mirror:true},
  {id:'right-pair',name:'Dupla na direita',frames:right(stack(2)),mirror:true},
  {id:'bands',name:'Duas faixas',frames:stack(2)},
 ],
 3:[
  {id:'page-pair',name:'Página e dupla',frames:[...left(FULL),...right(stack(2))],mirror:true},
  {id:'trio',name:'Trio',frames:grid(3,1)},
  {id:'two-portraits-page',name:'Dois retratos e página',frames:[...left(grid(2,1)),...right(FULL)],mirror:true},
  {id:'wide-two',name:'Larga e duas',frames:[r(0,0,1,.55),r(0,.55,.5,.45),r(.5,.55,.5,.45)]},
 ],
 4:[
  {id:'page-wide-two',name:'Página e três',frames:[...left(FULL),...right(wideOverTwo)],mirror:true},
  {id:'grid',name:'Grade 2×2',frames:grid(2,2)},
  {id:'portraits-pair',name:'Dois retratos e dupla',frames:[r(0,0,1/3,1),r(1/3,0,1/3,1),r(2/3,0,1/3,.5),r(2/3,.5,1/3,.5)],mirror:true},
  {id:'columns',name:'Quatro retratos',frames:grid(4,1)},
  {id:'page-trio',name:'Página e trio',frames:[...left(FULL),...right(stack(3))],mirror:true},
 ],
 5:[
  {id:'page-grid',name:'Página e quatro',frames:[...left(FULL),...right(grid(2,2))],mirror:true},
  {id:'portrait-grid',name:'Retrato e grade',frames:[r(0,0,1/3,1),...within(grid(2,2),1/3,0,2/3,1)],mirror:true},
  {id:'two-three',name:'Duas acima, três abaixo',frames:[r(0,0,.5,.5),r(.5,0,.5,.5),r(0,.5,.37,.5),r(.37,.5,.26,.5),r(.63,.5,.37,.5)]},
  {id:'three-two',name:'Três acima, duas abaixo',frames:[r(0,0,.36,.5),r(.36,0,.28,.5),r(.64,0,.36,.5),r(0,.5,.5,.5),r(.5,.5,.5,.5)]},
  {id:'pair-trio',name:'Dupla e trio',frames:[...left(stack(2)),...right(wideOverTwo)],mirror:true},
 ],
 6:[
  {id:'three-per-page',name:'Três por página',frames:[...left(wideOverTwo),...right(wideOverTwo)]},
  {id:'grid',name:'Grade 3×2',frames:grid(3,2)},
  {id:'mixed-rows',name:'Linhas alternadas',frames:[r(0,0,.38,.5),r(.38,0,.24,.5),r(.62,0,.38,.5),...within(grid(3,1),0,.5,1,.5)]},
  {id:'page-five',name:'Página e cinco',frames:[...left(FULL),...within(grid(2,1),.5,0,.5,.5),...within(grid(3,1),.5,.5,.5,.5)],mirror:true},
  {id:'pair-grid',name:'Dupla e grade',frames:[...left(stack(2)),...right(grid(2,2))],mirror:true},
  {id:'portraits-hero',name:'Retratos e destaque',frames:[r(0,0,.25,.6),r(.25,0,.25,.6),r(0,.6,.5,.4),r(.5,0,.25,.25),r(.75,0,.25,.25),r(.5,.25,.5,.75)],mirror:true},
 ],
 7:[
  {id:'page-six',name:'Página e seis',frames:[...left(FULL),...within(stack(4),.5,0,.25,1),r(.75,0,.25,.5),r(.75,.5,.25,.5)],mirror:true},
  {id:'wide-mosaic',name:'Mosaico com faixas',frames:[r(0,0,.5,.5),r(0,.5,.23,.25),r(0,.75,.23,.25),r(.23,.5,.27,.5),r(.5,0,.5,.5),r(.5,.5,.25,.5),r(.75,.5,.25,.5)],mirror:true},
  {id:'tall-columns',name:'Colunas com destaque',frames:[r(0,0,.17,.5),r(0,.5,.17,.5),r(.17,0,.33,1),r(.5,0,.23,1/3),r(.5,1/3,.23,1/3),r(.5,2/3,.23,1/3),r(.73,0,.27,1)],mirror:true},
  {id:'mosaic',name:'Mosaico com destaque',frames:[r(0,0,.25,.25),r(0,.25,.25,.25),r(0,.5,.25,.25),r(0,.75,.25,.25),r(.25,0,.25,.5),r(.25,.5,.25,.5),r(.5,0,.5,1)],mirror:true},
 ],
 8:[
  {id:'grid',name:'Quatro por página',frames:grid(4,2)},
  {id:'alternating',name:'Retratos alternados',frames:[r(0,0,.25,.3),r(.25,0,.25,.3),r(0,.3,.25,.7),r(.25,.3,.25,.7),r(.5,0,.25,.7),r(.75,0,.25,.7),r(.5,.7,.25,.3),r(.75,.7,.25,.3)]},
  {id:'grid-hero',name:'Grade e destaque',frames:[...left(grid(2,2)),r(.5,0,.5,.6),...within(grid(3,1),.5,.6,.5,.4)],mirror:true},
  {id:'framed-grid',name:'Retratos nas pontas',frames:[r(0,0,.25,1),...within(grid(3,2),.25,0,.5,1),r(.75,0,.25,1)]},
 ],
 9:[
  {id:'grid',name:'Grade 3×3',frames:grid(3,3)},
  {id:'double-mosaic',name:'Mosaico duplo',frames:[...left(grid(2,2)),r(.5,0,.5,.5),...within(grid(2,2),.5,.5,.5,.5)],mirror:true},
  {id:'four-five',name:'Quatro e cinco',frames:rows(9,2)},
  {id:'page-eight',name:'Página e oito',frames:[...left(FULL),...right(grid(2,4))],mirror:true},
 ],
 10:[
  {id:'grid',name:'Cinco e cinco',frames:rows(10,2)},
  {id:'five-per-page',name:'Cinco por página',frames:[...left([r(0,0,1,.5),...within(grid(2,2),0,.5,1,.5)]),...right([...within(grid(2,2),0,0,1,.5),r(0,.5,1,.5)])]},
  {id:'page-grid',name:'Página e nove',frames:[...left(FULL),...right(grid(3,3))],mirror:true},
  {id:'hero-sequence',name:'Destaque e sequência',frames:[r(0,0,.4,.5),...within(grid(3,1),.4,0,.6,.5),...within(grid(6,1),0,.5,1,.5)]},
 ],
};

/** Formatos de quadro aceitos: fora disso a foto fica uma tira estreita demais e perde muito no recorte. */
const MIN_FRAME_ASPECT=.33,MAX_FRAME_ASPECT=3.1;
const frameAspect=(rect:FrameRect,spreadAspect:number)=>rect.w*spreadAspect/rect.h;
/** O layout combina com o formato do álbum quando nenhum quadro vira uma tira estreita. */
export function layoutSuits(layout:PhotoLayout,spreadAspect:number){
 if(layout.frames.length===1)return true;
 return layout.frames.every(f=>{const a=frameAspect(f,spreadAspect);return a>=MIN_FRAME_ASPECT&&a<=MAX_FRAME_ASPECT;});
}

/**
 * Layouts para a quantidade de fotos, do mais usado para o menos usado.
 * `spreadAspect` (largura ÷ altura da área inteira) esconde os que ficam estranhos
 * no formato do álbum: os verticais, quadrados e horizontais recebem listas diferentes.
 */
export function photoLayouts(count:number,spreadAspect=2):PhotoLayout[]{
 const n=Math.max(1,Math.min(10,Math.round(count)));
 const entries=CATALOG[n]||[{id:'grid',name:'Grade',frames:rows(n,n<=4?1:2)}];
 const all:PhotoLayout[]=[];
 for(const e of entries)all.push({id:`${e.id}-${n}`,name:e.name,frames:e.frames,marginRatio:e.marginRatio??.05});
 for(const e of entries)if(e.mirror)all.push({id:`${e.id}-mirror-${n}`,name:`${e.name} (espelhado)`,frames:mirrorFrames(e.frames),marginRatio:e.marginRatio??.05});
 const fitting=all.filter(layout=>layoutSuits(layout,spreadAspect));
 return fitting.length?fitting:all;
}

export type LayoutFit={layout:PhotoLayout;order:number[];score:number;lowResolution:boolean};
type PhotoSize={width?:number;height?:number};
type RankOptions={sizes?:PhotoSize[];areaMm?:{width:number;height:number};dpi?:number};
/**
 * Ordena layouts pelo quanto os formatos dos quadros combinam com os formatos das fotos
 * (largura ÷ altura). `order[quadro]` diz qual foto vai em cada quadro.
 * `spreadAspect` é a proporção da área inteira (lâmina aberta ou capa).
 * Com `sizes` e `areaMm`, também evita quadros grandes demais para a resolução da foto:
 * a foto continua nítida porque o layout recomendado não a amplia além do que ela aguenta.
 * Layouts mais usados (no começo da lista) ganham um pequeno desempate.
 */
export function rankLayoutsForPhotos(layouts:PhotoLayout[],photoAspects:number[],spreadAspect:number,options:RankOptions={}):LayoutFit[]{
 const photos=photoAspects.map((aspect,index)=>({index,log:Math.log(aspect>0&&Number.isFinite(aspect)?aspect:1.5)}));
 const sortedPhotos=[...photos].sort((a,b)=>a.log-b.log);
 const target=(options.dpi||300)*.75;
 const fits=layouts.filter(layout=>layout.frames.length===photos.length).map((layout,position)=>{
  const frames=layout.frames.map((rect,index)=>({index,log:Math.log(frameAspect(rect,spreadAspect))}));
  /** Custo de colocar a foto `photo` no quadro `frame`: diferença de formato + perda de resolução. */
  const resolution=(frame:number,photo:number)=>{
   if(!options.sizes||!options.areaMm)return 0;
   const size=options.sizes[photo];if(!size?.width||!size.height)return 0;
   const rect=layout.frames[frame],wMm=rect.w*options.areaMm.width,hMm=rect.h*options.areaMm.height;
   const dpi=25.4*Math.min(size.width/wMm,size.height/hMm);
   return dpi<target?(1-dpi/target)*2:0;
  };
  const pair=(frame:number,photo:number)=>Math.abs(frames[frame].log-photos[photo].log)+resolution(frame,photo);
  // Começa pareando os formatos ordenados e melhora trocando fotos de lugar enquanto o custo cair.
  const sortedFrames=[...frames].sort((a,b)=>a.log-b.log);
  const order=new Array<number>(frames.length);
  sortedFrames.forEach((frame,i)=>{order[frame.index]=sortedPhotos[i].index;});
  for(let improved=true,guard=0;improved&&guard<50;guard++){
   improved=false;
   for(let a=0;a<order.length;a++)for(let b=a+1;b<order.length;b++){
    const before=pair(a,order[a])+pair(b,order[b]),after=pair(a,order[b])+pair(b,order[a]);
    if(after<before-1e-9){[order[a],order[b]]=[order[b],order[a]];improved=true;}
   }
  }
  let cost=0,resolutionPenalty=0;
  order.forEach((photo,frame)=>{cost+=Math.abs(frames[frame].log-photos[photo].log);resolutionPenalty+=resolution(frame,photo);});
  return {layout,order,score:cost/Math.max(1,frames.length)+resolutionPenalty+position*.012,lowResolution:resolutionPenalty>0,position};
 });
 // Empates mantêm a ordem original da lista de layouts.
 return fits.sort((a,b)=>a.score-b.score||a.position-b.position).map(({layout,order,score,lowResolution})=>({layout,order,score,lowResolution}));
}

/** Mosaicos de referência (todas as composições sem área em branco embutida), usados nos testes de espaçamento. */
export function referenceLayouts(n:number):PhotoLayout[]{
 return photoLayouts(n,2).filter(layout=>{
  const area=layout.frames.reduce((sum,f)=>sum+f.w*f.h,0);
  return Math.abs(area-1)<1e-6;
 });
}
