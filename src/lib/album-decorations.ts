import data from './album-icon-data.json';

export type AlbumIcon={id:string;kind:string;x:number;y:number;sizeMm:number;rotation:number;color:string};
export type TextureName='none'|'linen'|'paper'|'dots'|'diagonal'|'grain'|'waves';
export const TEXTURES:{id:TextureName;name:string}[]=[{id:'none',name:'Liso'},{id:'linen',name:'Linho'},{id:'paper',name:'Papel artesanal'},{id:'dots',name:'Poá delicado'},{id:'diagonal',name:'Traços'},{id:'grain',name:'Granulado'},{id:'waves',name:'Ondas'}];
export type IconNode=[string,Record<string,string|number>];
export const ALBUM_ICONS=data as {id:string;label:string;category:string;nodes:IconNode[]}[];
export function drawIcons(ctx:CanvasRenderingContext2D,icons:AlbumIcon[],width:number,height:number){
 for(const icon of icons){const definition=ALBUM_ICONS.find(i=>i.id===icon.kind);if(!definition)continue;
  ctx.save();ctx.translate(width*icon.x/100+icon.sizeMm/2,height*icon.y/100+icon.sizeMm/2);ctx.rotate(icon.rotation*Math.PI/180);ctx.scale(icon.sizeMm/24,icon.sizeMm/24);ctx.translate(-12,-12);ctx.strokeStyle=icon.color;ctx.lineWidth=1.5;ctx.lineCap='round';ctx.lineJoin='round';
  for(const [tag,a] of definition.nodes){const n=(key:string)=>Number(a[key]||0);ctx.beginPath();
   if(tag==='path'){ctx.stroke(new Path2D(String(a.d)));continue;}
   if(tag==='circle')ctx.arc(n('cx'),n('cy'),n('r'),0,Math.PI*2);
   else if(tag==='ellipse')ctx.ellipse(n('cx'),n('cy'),n('rx'),n('ry'),0,0,Math.PI*2);
   else if(tag==='line'){ctx.moveTo(n('x1'),n('y1'));ctx.lineTo(n('x2'),n('y2'));}
   else if(tag==='rect')ctx.roundRect(n('x'),n('y'),n('width'),n('height'),n('rx'));
   else if(tag==='polyline'||tag==='polygon'){const points=String(a.points).split(/[ ,]+/).map(Number);for(let i=0;i<points.length;i+=2)i?ctx.lineTo(points[i],points[i+1]):ctx.moveTo(points[i],points[i+1]);if(tag==='polygon')ctx.closePath();}
   ctx.stroke();
  }ctx.restore();
 }
}
/** Physical millimeter coordinates and a fixed seed keep textures identical in JPG and preview. */
export function drawTexture(ctx:CanvasRenderingContext2D,texture:TextureName|undefined,width:number,height:number,bleed=0){
 if(!texture||texture==='none')return;
 ctx.save();ctx.beginPath();ctx.rect(-bleed,-bleed,width+bleed*2,height+bleed*2);ctx.clip();ctx.strokeStyle='rgba(67,53,38,.085)';ctx.fillStyle='rgba(67,53,38,.10)';ctx.lineWidth=.12;
 if(texture==='linen'){for(let y=Math.floor(-bleed/.85)*.85;y<height+bleed;y+=.85){ctx.beginPath();ctx.moveTo(-bleed,y);ctx.lineTo(width+bleed,y);ctx.stroke();}ctx.strokeStyle='rgba(255,255,255,.3)';for(let x=Math.floor(-bleed/.85)*.85;x<width+bleed;x+=.85){ctx.beginPath();ctx.moveTo(x,-bleed);ctx.lineTo(x,height+bleed);ctx.stroke();}}
 else if(texture==='dots'){for(let y=Math.floor(-bleed/6)*6;y<height+bleed;y+=6)for(let x=Math.floor(-bleed/6)*6;x<width+bleed;x+=6){ctx.beginPath();ctx.arc(x,y,.3,0,Math.PI*2);ctx.fill();}}
 else if(texture==='diagonal'){for(let x=Math.floor((-height-2*bleed)/4)*4;x<width+2*bleed;x+=4){ctx.beginPath();ctx.moveTo(x-bleed,-bleed);ctx.lineTo(x+height+bleed,height+bleed);ctx.stroke();}}
 else if(texture==='waves'){for(let y=Math.floor((-bleed-6)/5)*5;y<height+bleed;y+=5){const start=Math.floor(-bleed/8)*8;ctx.beginPath();ctx.moveTo(start,y);for(let x=start;x<width+bleed;x+=8)ctx.bezierCurveTo(x+2,y-1.5,x+6,y+1.5,x+8,y);ctx.stroke();}}
 else {const step=texture==='grain'?2:3;
  // Each physical cell has its own seed; adding bleed never shifts the artwork.
  for(let row=Math.floor(-bleed/step);row<(height+bleed)/step;row++)for(let col=Math.floor(-bleed/step);col<(width+bleed)/step;col++){
   let seed=(Math.imul(row+1000,73856093)^Math.imul(col+1000,19349663))>>>0;
   const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
   ctx.fillRect(col*step+random()*step,row*step+random()*step,texture==='grain'?.18:.55,.12);
  }
 }
 ctx.restore();
}
