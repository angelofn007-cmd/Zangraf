import {cropRectangle,type Slot} from './layout-projects';
/** Move the crop, rather than stretch the image, to center a chosen subject. */
export function slotForFocus(slot:Slot,imageWidth:number,imageHeight:number,frameWidth:number,frameHeight:number,focus:{x:number;y:number}):Slot{
 const crop=cropRectangle(imageWidth,imageHeight,frameWidth,frameHeight,slot);
 const position=(length:number,visible:number,point:number)=>length-visible<.001?50:Math.max(0,Math.min(100,(point*length-visible/2)/(length-visible)*100));
 return {...slot,x:position(imageWidth,crop.width,focus.x),y:position(imageHeight,crop.height,focus.y)};
}
