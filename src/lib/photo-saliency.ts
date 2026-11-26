/**
 * Onde está o que importa numa foto, sem depender de detecção de rostos do navegador.
 * Trabalha numa miniatura (≈48 px): tons de pele (rostos, pessoas) pesam muito, detalhes e cores
 * pesam pouco. Serve para posicionar o recorte quando a foto não cabe inteira no quadro.
 */
import {slotForFocus,headsBox,facesBox,groupFocus,type FacePoint} from './photo-focus';
import {cropRectangle,type Slot} from './layout-projects';

export type InterestMap={width:number;height:number;values:Float32Array};
/**
 * O que se sabe sobre o assunto da foto: os rostos (quando detectados) ou o mapa de interesse.
 * `face` é o centro dos rostos principais; `heads`, a caixa com as cabeças inteiras (0–1 da foto).
 */
export type PhotoSubject={face?:{x:number;y:number};heads?:{x:number;y:number;w:number;h:number};/** Caixa dos rostos principais (para o quadrado de foco). */faces?:{x:number;y:number;w:number;h:number};map?:InterestMap};

/** Monta o assunto a partir dos rostos encontrados (do maior para o menor). */
export function subjectFromFaces(faces:FacePoint[]):PhotoSubject|undefined{
 const face=groupFocus(faces);if(!face)return undefined;
 return {face:{x:face.x,y:face.y},heads:headsBox(faces),faces:facesBox(faces)};
}

/** Direção de cor típica da pele (RGB normalizado). Funciona para tons claros e escuros. */
const SKIN=(()=>{const c=[.78,.57,.44],m=Math.hypot(...c);return c.map(v=>v/m);})();
const SKIN_WEIGHT=4,DETAIL_WEIGHT=.6,COLOR_WEIGHT=.2,RARITY_WEIGHT=.8;

/**
 * Mapa de interesse a partir dos pixels RGBA de uma miniatura.
 * `skin:false` quando um detector de rostos já olhou e não achou ninguém (aí cor de pele não indica pessoa).
 */
export function interestMap(rgba:ArrayLike<number>,width:number,height:number,{skin:useSkin=true}:{skin?:boolean}={}):InterestMap{
 const skinOf=new Float32Array(width*height);
 const lum=new Float32Array(width*height),values=new Float32Array(width*height);
 for(let i=0;i<width*height;i++){
  const r=rgba[i*4]/255,g=rgba[i*4+1]/255,b=rgba[i*4+2]/255;
  const light=.2126*r+.7152*g+.0722*b;lum[i]=light;
  const size=Math.hypot(r,g,b);
  let skin=0;
  if(size>0&&light>.12&&light<.95){
   const d=Math.hypot(r/size-SKIN[0],g/size-SKIN[1],b/size-SKIN[2]);
   skin=Math.max(0,(1-d-.8)/.2);
  }
  const max=Math.max(r,g,b),min=Math.min(r,g,b);
  const saturation=max>0?(max-min)/max:0;
  skinOf[i]=skin;
  values[i]=COLOR_WEIGHT*saturation*(light>.1&&light<.9?1:0);
 }
 // Cor de pele cobrindo boa parte da foto é fundo (parede bege, madeira, areia), não rosto: perde o peso.
 const skinShare=skinOf.reduce((sum,v)=>sum+(v>.3?1:0),0)/Math.max(1,width*height);
 const skinWeight=useSkin?SKIN_WEIGHT*Math.min(1,(.2/Math.max(.2,skinShare))**2):0;
 for(let i=0;i<width*height;i++)values[i]+=skinWeight*skinOf[i];
 // Cor rara chama atenção: a cor que domina a foto é fundo; a pessoa ou o objeto têm cores diferentes dele.
 const bins=new Map<number,number>(),binOf=new Int32Array(width*height);
 for(let i=0;i<width*height;i++){
  const bin=(rgba[i*4]>>5)<<6|(rgba[i*4+1]>>5)<<3|(rgba[i*4+2]>>5);
  binOf[i]=bin;bins.set(bin,(bins.get(bin)||0)+1);
 }
 for(let i=0;i<width*height;i++){const rare=1-bins.get(binOf[i])!/(width*height);values[i]+=RARITY_WEIGHT*rare*rare;}
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x;
  const edge=Math.abs(4*lum[i]-lum[i-1]-lum[i+1]-lum[i-width]-lum[i+width]);
  values[i]+=DETAIL_WEIGHT*Math.min(1,edge*2);
 }
 return {width,height,values};
}

/**
 * Melhor posição do recorte (em %, como `Slot.x`/`Slot.y`) para uma janela com `cropW`×`cropH`
 * da foto (frações 0–1). O que tem mais interesse fica dentro e perto do centro do quadro.
 * Sem nada de interesse, fica no centro (como antes).
 */
export function bestCropPosition(map:InterestMap,cropW:number,cropH:number):{x:number;y:number}{
 const {width,height,values}=map;
 const w=Math.max(1,Math.min(width,Math.round(cropW*width))),h=Math.max(1,Math.min(height,Math.round(cropH*height)));
 const spanX=width-w,spanY=height-h;
 if(spanX<=0&&spanY<=0)return {x:50,y:50};
 // Peso dentro da janela: o centro vale mais que as bordas (o assunto não fica encostado no corte).
 const weight=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const dx=(x+.5)/w*2-1,dy=(y+.5)/h*2-1;weight[y*w+x]=1-.5*(dx*dx+dy*dy)/2;
 }
 let best={x:50,y:50},bestScore=0;
 const centerX=spanX/2,centerY=spanY/2;
 const scoreAt=(ox:number,oy:number)=>{let score=0;for(let y=0;y<h;y++){const row=(oy+y)*width+ox,wrow=y*w;for(let x=0;x<w;x++)score+=values[row+x]*weight[wrow+x];}return score;};
 const centerScore=scoreAt(Math.round(centerX),Math.round(centerY));
 for(let oy=0;oy<=spanY;oy++)for(let ox=0;ox<=spanX;ox++){
  let score=scoreAt(ox,oy);
  // Empate (ou quase): fica a posição mais perto do centro.
  const distance=Math.hypot(ox-centerX,oy-centerY)/Math.max(1,Math.hypot(centerX,centerY));
  score*=1-.02*distance;
  if(score>bestScore+1e-9){bestScore=score;best={x:spanX>0?ox/spanX*100:50,y:spanY>0?oy/spanY*100:50};}
 }
 // Sair do centro só quando a outra posição é claramente melhor: na dúvida, o centro corta menos.
 return bestScore>centerScore*1.12?best:{x:50,y:50};
}

/**
 * Enquadramento automático: com rosto, ele fica no centro do quadro; sem rosto, a parte com pele,
 * detalhes e cores. Só desloca a foto (não amplia), então a resolução não muda.
 * `frameW`/`frameH` são as medidas do quadro (qualquer unidade, só a proporção importa).
 */
export function autoFrame(slot:Slot,imageW:number,imageH:number,frameW:number,frameH:number,subject:PhotoSubject):Slot{
 if(subject.face)return {...slotForFocus(slot,imageW,imageH,frameW,frameH,subjectPoint(subject,imageW,imageH,frameW,frameH,slot.zoom)),auto:true};
 if(!subject.map)return {...slot,x:50,y:50,auto:true};
 const crop=cropRectangle(imageW,imageH,frameW,frameH,slot);
 return {...slot,...bestCropPosition(subject.map,crop.width/imageW,crop.height/imageH),auto:true};
}

/**
 * Ponto que vai para o centro do quadro: o rosto. Só se afasta dele o mínimo necessário para a cabeça
 * inteira (testa e cabelo) caber no recorte; se nem assim cabe, fica exatamente no rosto.
 */
export function subjectPoint(subject:PhotoSubject,imageW:number,imageH:number,frameW:number,frameH:number,zoom=1):{x:number;y:number}{
 const face=subject.face||{x:.5,y:.5},heads=subject.heads;
 if(!heads)return face;
 const crop=cropRectangle(imageW,imageH,frameW,frameH,{photoId:null,x:50,y:50,zoom});
 const axis=(center:number,visible:number,start:number,size:number)=>{
  if(size>visible)return center;
  const from=Math.max(start+size-visible,Math.min(start,center-visible/2));
  return from+visible/2;
 };
 return {x:axis(face.x,crop.width/imageW,heads.x,heads.w),y:axis(face.y,crop.height/imageH,heads.y,heads.h)};
}
