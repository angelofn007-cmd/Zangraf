/**
 * Detecção de rostos que funciona em qualquer navegador: MediaPipe Face Detector (BlazeFace),
 * servido pelo próprio site em /vendor/mediapipe e carregado só quando é preciso.
 * Se ele não carregar, usa o FaceDetector nativo do navegador (quando existe).
 */
export type FaceBox={x:number;y:number;w:number;h:number};
/** Rosto encontrado: centro e caixa (0–1 da foto) e área relativa à foto. */
export type DetectedFace={x:number;y:number;size:number;box:FaceBox};

const BASE='/vendor/mediapipe';
type Detection={categories?:{score:number}[];boundingBox?:{originX:number;originY:number;width:number;height:number}};
type MediaPipeDetector={detect(image:HTMLCanvasElement):{detections:Detection[]}};
/** Dois modelos: "short range" acerta melhor rostos grandes (retratos); "full range" acha rostos pequenos (de longe, grupos). */
type Detectors={near:MediaPipeDetector;far:MediaPipeDetector|null};
let loading:Promise<Detectors|null>|null=null;

function mediaPipe():Promise<Detectors|null>{
 loading??=(async()=>{
  try{
   const url=`${BASE}/vision_bundle.mjs`;
   const vision=await import(/* webpackIgnore: true */ url);
   const files=await vision.FilesetResolver.forVisionTasks(`${BASE}/wasm`);
   const create=(model:string)=>vision.FaceDetector.createFromOptions(files,{
    baseOptions:{modelAssetPath:`${BASE}/${model}.tflite`,delegate:'CPU'},
    runningMode:'IMAGE',minDetectionConfidence:.5,
   }) as Promise<MediaPipeDetector>;
   const near=await create('blaze_face_short_range');
   const far=await create('blaze_face_full_range').catch(()=>null);
   return {near,far};
  }catch{loading=null;return null;}
 })();
 return loading;
}

/** Junta rostos repetidos (achados na foto inteira e num pedaço dela). */
function overlap(a:FaceBox,b:FaceBox){
 const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 return w*h/Math.min(a.w*a.h,b.w*b.h);
}

/**
 * Rostos da foto, do maior para o menor. `undefined` quando não há detector disponível
 * (aí quem chama usa outro jeito de achar o assunto); `[]` quando o detector olhou e não achou rosto.
 */
export async function detectFaces(blob:Blob):Promise<DetectedFace[]|undefined>{
 const bitmap=await createImageBitmap(blob).catch(()=>null);if(!bitmap)return undefined;
 try{
  const detectors=await mediaPipe();
  if(detectors){
   const canvas=document.createElement('canvas');const context=canvas.getContext('2d');
   if(!context)return undefined;
   const found:{box:FaceBox;score:number;near:boolean}[]=[];
   const look=(detector:MediaPipeDetector,region:FaceBox,near:boolean)=>{
    const sw=region.w*bitmap.width,sh=region.h*bitmap.height,scale=Math.min(1,1280/Math.max(sw,sh));
    canvas.width=Math.max(1,Math.round(sw*scale));canvas.height=Math.max(1,Math.round(sh*scale));
    context.drawImage(bitmap,region.x*bitmap.width,region.y*bitmap.height,sw,sh,0,0,canvas.width,canvas.height);
    for(const detection of detector.detect(canvas).detections){
     const b=detection.boundingBox;if(!b||b.width<=0||b.height<=0)continue;
     const box={x:region.x+b.originX/canvas.width*region.w,y:region.y+b.originY/canvas.height*region.h,w:b.width/canvas.width*region.w,h:b.height/canvas.height*region.h};
     const score=detection.categories?.[0]?.score??0;
     const same=found.find(item=>overlap(item.box,box)>.4);
     // Mesmo rosto achado duas vezes: fica a caixa do modelo de perto (mais justa), senão a de maior confiança.
     if(!same)found.push({box,score,near});
     else if((near&&!same.near)||(near===same.near&&score>same.score)){same.box=box;same.score=Math.max(score,same.score);same.near=near;}
    }
   };
   const whole={x:0,y:0,w:1,h:1};
   look(detectors.near,whole,true);
   if(detectors.far)look(detectors.far,whole,false);
   // Nada na foto inteira: procura em pedaços quadrados (o modelo enxerga melhor rostos que ocupam boa parte da imagem).
   if(!found.length){
    const side=.5*Math.min(bitmap.width,bitmap.height),tw=side/bitmap.width,th=side/bitmap.height;
    for(let y=0;y<=1-th+1e-6;y+=th/2)for(let x=0;x<=1-tw+1e-6;x+=tw/2)look(detectors.near,{x,y,w:tw,h:th},true);
   }
   canvas.width=canvas.height=1;
   return found.map(({box})=>({x:box.x+box.w/2,y:box.y+box.h/2,size:box.w*box.h,box})).sort((a,b)=>b.size-a.size);
  }
  // Sem MediaPipe: detector nativo do navegador, quando existe.
  const Native=(window as unknown as {FaceDetector?:new(options:{fastMode:boolean;maxDetectedFaces:number})=>{detect:(source:ImageBitmap)=>Promise<{boundingBox:{x:number;y:number;width:number;height:number}}[]>}}).FaceDetector;
  if(!Native)return undefined;
  const faces=await new Native({fastMode:false,maxDetectedFaces:10}).detect(bitmap);
  return faces.map(({boundingBox:b})=>{const box={x:b.x/bitmap.width,y:b.y/bitmap.height,w:b.width/bitmap.width,h:b.height/bitmap.height};return {x:box.x+box.w/2,y:box.y+box.h/2,size:box.w*box.h,box};}).sort((a,b)=>b.size-a.size);
 }catch{return undefined;}finally{bitmap.close();}
}
