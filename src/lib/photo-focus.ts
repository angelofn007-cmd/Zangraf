import {cropRectangle,type Slot} from './layout-projects';
/** Rosto encontrado na foto: centro (0–1) e, quando conhecidas, a área relativa à foto e a caixa do rosto. */
export type FacePoint={x:number;y:number;size?:number;box?:{x:number;y:number;w:number;h:number}};
type Box={x:number;y:number;w:number;h:number};

/** Rostos principais: o maior e os de tamanho parecido (gente ao fundo, bem menor, fica de fora). */
function mainFaces(faces:FacePoint[]){
 const largest=faces[0];if(!largest)return [];
 return largest.size?faces.filter(face=>(face.size??0)>=largest.size!*.4):[largest];
}

/**
 * Caixa das cabeças principais (casal, família): a caixa do detector vai das sobrancelhas ao queixo,
 * então ela é aumentada para incluir testa, cabelo e um pouco dos lados.
 */
/** Caixa só dos rostos principais (sem ampliar): onde o quadrado de foco aparece. */
export function facesBox(faces:FacePoint[]):Box|undefined{
 const boxes=mainFaces(faces).map(face=>face.box).filter((box):box is Box=>!!box);
 if(!boxes.length)return undefined;
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
export function headsBox(faces:FacePoint[]):Box|undefined{
 const boxes=mainFaces(faces).map(face=>face.box).filter((box):box is Box=>!!box);
 if(!boxes.length)return undefined;
 const heads=boxes.map(b=>({x:b.x-b.w*.3,y:b.y-b.h*.6,w:b.w*1.6,h:b.h*1.85}));
 const x=Math.max(0,Math.min(...heads.map(b=>b.x))),y=Math.max(0,Math.min(...heads.map(b=>b.y)));
 const right=Math.min(1,Math.max(...heads.map(b=>b.x+b.w))),bottom=Math.min(1,Math.max(...heads.map(b=>b.y+b.h)));
 return {x,y,w:right-x,h:bottom-y};
}
/**
 * Ponto para centralizar o recorte: o meio do grupo de rostos principais (casal, família),
 * e não só o maior. Rostos bem menores que o maior (gente ao fundo) não puxam o recorte.
 * `faces` vem do maior para o menor.
 */
export function groupFocus(faces:FacePoint[]):FacePoint|undefined{
 const main=mainFaces(faces);if(!main.length)return undefined;
 const xs=main.map(f=>f.x),ys=main.map(f=>f.y);
 return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
}
/** Move the crop, rather than stretch the image, to center a chosen subject. */
export function slotForFocus(slot:Slot,imageWidth:number,imageHeight:number,frameWidth:number,frameHeight:number,focus:{x:number;y:number}):Slot{
 const crop=cropRectangle(imageWidth,imageHeight,frameWidth,frameHeight,slot);
 const position=(length:number,visible:number,point:number)=>length-visible<.001?50:Math.max(0,Math.min(100,(point*length-visible/2)/(length-visible)*100));
 return {...slot,x:position(imageWidth,crop.width,focus.x),y:position(imageHeight,crop.height,focus.y)};
}
