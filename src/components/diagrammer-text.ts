import type {Cover,AlbumText} from '@/lib/layout-projects';

function linesFor(ctx:CanvasRenderingContext2D,text:string,maxWidth:number){
 const lines:string[]=[];
 for(const paragraph of text.split('\n')){
  let line='';
  for(const word of paragraph.split(/\s+/).filter(Boolean)){
   if(line&&ctx.measureText(line+' '+word).width>maxWidth){lines.push(line);line=''}
   if(ctx.measureText(word).width>maxWidth){
    if(line){lines.push(line);line=''}
    for(const char of word){if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line=''}line+=char}
   }else line+=(line?' ':'')+word;
  }
  lines.push(line);
 }
 return lines;
}

/** Text uses the same 1000-unit coordinate space in previews and print files. */
export function drawCoverText(ctx:CanvasRenderingContext2D,cover:Cover,width:number,height:number,back=false){
 if(cover.customText)return;
 ctx.save();ctx.scale(width/1000,width/1000);
 const h=height/width*1000;
 ctx.fillStyle=cover.textColor;ctx.textAlign='center';ctx.textBaseline='alphabetic';
 ctx.font='18px Arial';ctx.fillText('Z A N G R A F',500,h*.15);
 const title=cover.title||(back?'':'Sua história');
 let size=58;let lines:string[]=[];
 do{ctx.font=`${size}px Georgia`;lines=linesFor(ctx,title,780);if(lines.length*size*1.24<=h*.25)break;size-=1}while(size>12);
 lines.forEach((line,index)=>ctx.fillText(line,500,h*.42+index*size*1.24));
 ctx.fillRect(470,h*.65,60,2);
 size=24;
 do{ctx.font=`${size}px Arial`;lines=linesFor(ctx,cover.subtitle,760);if(lines.length*size*1.5<=h*.18)break;size-=1}while(size>10);
 lines.forEach((line,index)=>ctx.fillText(line,500,h*.72+index*size*1.5));
 ctx.restore();
}

export function albumTextLines(ctx:CanvasRenderingContext2D,text:AlbumText,width:number){
 const size=text.fontSize*25.4/72;
 ctx.font=`${text.italic?'italic ':''}${text.bold?'bold ':''}${size}px "${text.fontFamily}"`;
 return {lines:linesFor(ctx,text.text,width*text.width/100),size,lineHeight:size*1.25};
}
/** Shared canvas drawing keeps wrapping, font metrics and alignment identical in print and preview. */
export function drawAlbumTexts(ctx:CanvasRenderingContext2D,texts:AlbumText[],width:number,height:number){
 for(const text of texts){
  ctx.save();const {lines,lineHeight}=albumTextLines(ctx,text,width);
  const left=width*text.x/100,top=height*text.y/100,boxWidth=width*text.width/100;
  ctx.fillStyle=text.color;ctx.textAlign=text.align;ctx.textBaseline='top';
  const localX=text.align==='center'?boxWidth/2:text.align==='right'?boxWidth:0;
  if(text.rotation===90){ctx.translate(left+lines.length*lineHeight,top);ctx.rotate(Math.PI/2);lines.forEach((line,i)=>ctx.fillText(line,localX,i*lineHeight));}
  else lines.forEach((line,i)=>ctx.fillText(line,left+localX,top+i*lineHeight));
  ctx.restore();
 }
}
