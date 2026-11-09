import type {FrameRect,LayoutProject} from './layout-projects';
export type PhotoLayout={id:string;name:string;frames:FrameRect[];marginRatio?:number};
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
function rows(count:number,rowCount:number):FrameRect[]{
 const result:FrameRect[]=[];
 for(let row=0;row<rowCount;row++){
  const columns=Math.floor(count/rowCount)+(row<count%rowCount?1:0);
  for(let col=0;col<columns;col++)result.push({x:col/columns,y:row/rowCount,w:1/columns,h:1/rowCount});
 }
 return result;
}
function within(frames:FrameRect[],x:number,y:number,w:number,h:number):FrameRect[]{return frames.map(r=>({x:x+r.x*w,y:y+r.y*h,w:r.w*w,h:r.h*h}));}
function halfGrid(n:number):FrameRect[]{return rows(n,n<=2?1:n<=4?2:3);}
/** Album compositions keep a deliberate hierarchy and respect the center fold. */
export function photoLayouts(count:number):PhotoLayout[]{
 const n=Math.max(1,Math.min(10,Math.round(count)));
 const full=[{x:0,y:0,w:1,h:1}];
 if(n===1)return [
  {id:'full-1',name:'Panorâmica',frames:full},
  {id:'space-1',name:'Galeria',frames:within(full,.08,.12,.84,.76)},
  {id:'right-1',name:'Retrato à direita',frames:within(full,.55,.08,.38,.84)},
  {id:'left-1',name:'Retrato à esquerda',frames:within(full,.07,.08,.38,.84)},
  {id:'cinema-1',name:'Cinema',frames:within(full,0,.22,1,.56)},
  {id:'intimate-1',name:'Intimista',frames:within(full,.32,.16,.36,.68)},
  {id:'signature-1',name:'Assinatura',frames:within(full,.08,.08,.84,.65)},
  {id:'horizon-1',name:'Horizonte',frames:within(full,.05,.35,.9,.58)},
 ];
 const left=Math.ceil(n/2),right=n-left;
 const balance=[...within(halfGrid(left),0,0,.5,1),...within(halfGrid(right),.5,0,.5,1)];
 const hero=[...within(full,.02,.03,.46,.94),...within(halfGrid(n-1),.55,.15,.4,.7)];
 const mirror=hero.map(r=>({...r,x:1-r.x-r.w}));
 const band=[...within(rows(left,1),.03,.18,.44,.64),...within(rows(right,1),.53,.18,.44,.64)];
 return [
  ...referenceLayouts(n),
  {id:`balanced-${n}`,name:'Equilíbrio',frames:balance},
  {id:`hero-${n}`,name:'Foto em destaque',frames:hero},
  {id:`hero-right-${n}`,name:'Destaque à direita',frames:mirror},
  {id:`gallery-${n}`,name:'Galeria',frames:within(balance,.05,.09,.9,.82)},
  {id:`cinema-${n}`,name:'Sequência',frames:band},
  {id:`editorial-${n}`,name:'Editorial',frames:[...within(halfGrid(left),.04,.06,.42,.74),...within(halfGrid(right),.54,.2,.42,.74)]},
  {id:`airy-${n}`,name:'Respiro',frames:[...within(halfGrid(left),.09,.17,.32,.66),...within(halfGrid(right),.59,.17,.32,.66)]},
  {id:`story-${n}`,name:'Narrativa',frames:[...within(halfGrid(left),0,.08,.5,.84),...within(halfGrid(right),.55,.2,.4,.6)]},
 ];
}

/** Tiled compositions inspired by the supplied photographic spreads. Spacing is physical, not baked into frames. */
export function referenceLayouts(n:number):PhotoLayout[]{
 const r=(x:number,y:number,w:number,h:number)=>({x,y,w,h});
 const presets:Record<number,FrameRect[][]>={
  2:[[r(0,0,.5,1),r(.5,0,.5,1)]],
  3:[[r(0,0,.5,1),r(.5,0,.5,.5),r(.5,.5,.5,.5)]],
  4:[rows(4,2)],
  5:[[r(0,0,1/3,1),r(1/3,0,1/3,.5),r(2/3,0,1/3,.5),r(1/3,.5,1/3,.5),r(2/3,.5,1/3,.5)],
     [r(0,0,.36,.5),r(.36,0,.28,.5),r(.64,0,.36,.5),r(0,.5,.5,.5),r(.5,.5,.5,.5)]],
  6:[rows(6,3)],
  7:[[r(0,0,.25,.25),r(0,.25,.25,.25),r(0,.5,.25,.25),r(0,.75,.25,.25),r(.25,0,.25,.5),r(.25,.5,.25,.5),r(.5,0,.5,1)]],
  8:[[r(0,0,.25,.3),r(.25,0,.25,.3),r(0,.3,.25,.7),r(.25,.3,.25,.7),r(.5,0,.25,.7),r(.75,0,.25,.7),r(.5,.7,.25,.3),r(.75,.7,.25,.3)]],
  9:[rows(9,3)],10:[rows(10,2)]
 };
 return (presets[n]||[]).flatMap((frames,i)=>[
  {id:`reference-${n}-${i}`,name:n===7?'Mosaico com destaque':n===5&&i===1?'Três acima, duas abaixo':n===8?'Retratos alternados':'Coleção fotográfica',frames,marginRatio:.08},
  {id:`reference-mirror-${n}-${i}`,name:'Coleção espelhada',frames:frames.map(f=>({...f,x:1-f.x-f.w})),marginRatio:.08},
 ]);
}
