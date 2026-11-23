import {photoLayouts,DEFAULT_SPACING} from './album-layouts';
import {newAlbumText,emptySlot,type LayoutProject,type Spread} from './layout-projects';
import type {AlbumFont} from './album-fonts';
import type {TextureName} from './album-decorations';

export const ALBUM_THEMES:{id:string;name:string;subtitle:string;color:string;ink:string;texture:TextureName;font:AlbumFont;icon:string;title:string}[]=[
 {id:'wedding',name:'Casamento',subtitle:'Romântico e atemporal',color:'#f4eee5',ink:'#68563e',texture:'linen',font:'Great Vibes',icon:'heart',title:'Nossa história'},
 {id:'birthday',name:'Aniversário',subtitle:'Leve, alegre e cheio de vida',color:'#f6e7da',ink:'#9b5a42',texture:'dots',font:'Josefin Sans',icon:'party-popper',title:'Vamos celebrar'},
 {id:'events',name:'Eventos',subtitle:'Um olhar editorial',color:'#f4f2ee',ink:'#252923',texture:'none',font:'Montserrat',icon:'sparkles',title:'Momentos extraordinários'},
 {id:'newborn',name:'Newborn',subtitle:'Delicadeza em cada detalhe',color:'#eee9dc',ink:'#7a8269',texture:'paper',font:'Lora',icon:'moon',title:'Bem-vindo ao mundo'},
 {id:'family',name:'Família',subtitle:'Afeto que atravessa o tempo',color:'#e8ede5',ink:'#536452',texture:'grain',font:'Cormorant Garamond',icon:'leaf',title:'Onde mora o amor'},
 {id:'graduation',name:'Formatura',subtitle:'Uma conquista para guardar',color:'#f1e9d9',ink:'#423b2f',texture:'diagonal',font:'Cinzel',icon:'graduation-cap',title:'O início de uma nova história'},
];
/** Only the artwork changes. Product configuration, physical specifications and sheet count are immutable. */
export function applyAlbumTheme(project:LayoutProject,id:string):LayoutProject{
 const theme=ALBUM_THEMES.find(t=>t.id===id);if(!theme)return project;
 const spreads=project.spreads.map((spread,index):Spread=>{
  const occupied=spread.slots.filter(s=>s.photoId);const count=Math.max(1,Math.min(10,occupied.length||[2,3,1,4][index%4]));
  if(occupied.length>10)return {...spread,background:theme.color,rightBackground:undefined,texture:theme.texture};
  const options=photoLayouts(count);const layout=options[[3,5,1,6][index%4]%options.length];
  return {...spread,layout:'livre',frames:layout.frames,slots:layout.frames.map((_,i)=>occupied[i]||emptySlot()),spacing:{...DEFAULT_SPACING},background:theme.color,rightBackground:undefined,texture:theme.texture};
 });
 const cover=project.cover;
 if(!cover||project.productionModel?.coverMode==='none')return {...project,spreads};
 const wrap=project.productionModel?.coverMode==='wrap',width=project.productionModel?.front.widthMm||project.printSpec!.widthMm,height=project.productionModel?.front.heightMm||project.printSpec!.heightMm;
 const margins=project.productionModel?.coverMargins;const start=wrap?55:Math.max(8,(margins?.leftMm||0)/width*100+5),end=100-Math.max(8,(margins?.rightMm||0)/width*100+5);
 const hasPhoto=!!cover.photo.photoId||cover.composition?.slots.some(s=>s.photoId);
 const t={...newAlbumText(),text:theme.title,fontFamily:theme.font,fontSize:wrap?36:30,x:start,y:hasPhoto?15:40,width:end-start,color:theme.ink,align:'center' as const};
 const size=Math.min(22,width*.07,height*.08);
 return {...project,spreads,cover:{...cover,color:theme.color,texture:theme.texture,customText:true,texts:cover.texts?.length?cover.texts:[t],icons:cover.icons?.length?cover.icons:[{id:crypto.randomUUID(),kind:theme.icon,x:(start+end)/2-size/width*50,y:65,sizeMm:size,rotation:0,color:theme.ink}]}};
}
