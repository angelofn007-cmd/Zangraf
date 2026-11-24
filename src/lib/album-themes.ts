import {newAlbumText,type AlbumText,type Cover,type LayoutProject} from './layout-projects';
import type {AlbumIcon} from './album-decorations';
import type {AlbumFont} from './album-fonts';
import type {SurfaceName,TextureName} from './album-decorations';

/** Uma capa pronta de um tema: só muda fundo, textos e enfeite da capa — as fotos da capa continuam. */
export type ThemeCover={name:string;color:string;ink:string;surface?:SurfaceName;texture?:TextureName;title:string;subtitle:string;font:AlbumFont;subFont:AlbumFont;icon?:string};
export type AlbumTheme={id:string;name:string;subtitle:string;
 /** Fundo das lâminas. */ page:{color:string;surface?:SurfaceName;texture?:TextureName};
 ink:string;font:AlbumFont;icon:string;covers:ThemeCover[]};

export const ALBUM_THEMES:AlbumTheme[]=[
 {id:'wedding',name:'Casamento',subtitle:'Romântico e atemporal',page:{color:'#fbf8f3',texture:'linen'},ink:'#6b5a40',font:'Great Vibes',icon:'rings',covers:[
  {name:'Clássica',color:'#f6f0e6',ink:'#6b5a40',surface:'linho-areia',title:'Ana & Pedro',subtitle:'12 · 10 · 2026',font:'Great Vibes',subFont:'Cinzel',icon:'rings'},
  {name:'Mármore',color:'#ffffff',ink:'#5b5146',surface:'marmore-branco',title:'Nosso Casamento',subtitle:'Para sempre começa hoje',font:'Pinyon Script',subFont:'Marcellus',icon:'heart'},
  {name:'Dourada',color:'#2c2a26',ink:'#e2c48a',surface:'metal-dourado',title:'Sim, para sempre',subtitle:'A & P',font:'Allura',subFont:'Cinzel Decorative',icon:'gem'},
 ]},
 {id:'birthday',name:'Aniversário',subtitle:'Leve, alegre e cheio de vida',page:{color:'#fffaf2',texture:'dots'},ink:'#b4523a',font:'Poppins',icon:'cake',covers:[
  {name:'Festa',color:'#fff1e3',ink:'#b4523a',texture:'dots',title:'Parabéns!',subtitle:'Um ano incrível',font:'Kaushan Script',subFont:'Poppins',icon:'party-popper'},
  {name:'Balões',color:'#eaf4fb',ink:'#2b6f9e',texture:'waves',title:'Vamos celebrar',subtitle:'Aniversário de 1 ano',font:'Dancing Script',subFont:'Quicksand',icon:'balloon'},
  {name:'Moderna',color:'#1f2124',ink:'#fdf153',title:'30',subtitle:'ANOS DE HISTÓRIA',font:'Abril Fatface',subFont:'Montserrat',icon:'sparkles'},
 ]},
 {id:'graduation',name:'Formatura',subtitle:'Uma conquista para guardar',page:{color:'#f8f6f1',texture:'paper'},ink:'#2f2b24',font:'Cinzel',icon:'graduation-cap',covers:[
  {name:'Solene',color:'#1d2633',ink:'#e2c48a',surface:'linho-azul',title:'Formatura',subtitle:'TURMA 2026',font:'Cinzel Decorative',subFont:'Cinzel',icon:'graduation-cap'},
  {name:'Clássica',color:'#f3eee4',ink:'#3c342a',surface:'papel-algodao',title:'Conquista',subtitle:'O início de uma nova história',font:'Playfair Display',subFont:'Lora',icon:'award'},
  {name:'Grafite',color:'#2b2b2b',ink:'#ffffff',surface:'metal-grafite',title:'Missão cumprida',subtitle:'Turma de 2026',font:'Bebas Neue',subFont:'Raleway',icon:'medal'},
 ]},
 {id:'newborn',name:'Newborn',subtitle:'Delicadeza em cada detalhe',page:{color:'#fbf9f5',texture:'paper'},ink:'#7d8a76',font:'Lora',icon:'moon',covers:[
  {name:'Nuvem',color:'#eef3f6',ink:'#6a8597',title:'Bem-vindo, Theo',subtitle:'Nosso pequeno milagre',font:'Sacramento',subFont:'Quicksand',icon:'cloud'},
  {name:'Rosinha',color:'#f8ecec',ink:'#a8707a',surface:'marmore-rosa',title:'Olá, mundo',subtitle:'Chegou a Alice',font:'Parisienne',subFont:'Nunito',icon:'baby'},
  {name:'Algodão',color:'#f7f4ee',ink:'#7d8a76',surface:'papel-algodao',title:'Primeiros dias',subtitle:'Pezinhos que mudaram tudo',font:'Allura',subFont:'Lato',icon:'footprints'},
 ]},
 {id:'christmas',name:'Natal',subtitle:'Aconchego e tradição',page:{color:'#fbf7f1',texture:'linen'},ink:'#8b1e24',font:'Cormorant Garamond',icon:'tree-pine',covers:[
  {name:'Tradicional',color:'#7d1b20',ink:'#f3dfb0',surface:'linho-natural',title:'Feliz Natal',subtitle:'Em família, 2026',font:'Great Vibes',subFont:'Cinzel',icon:'tree-pine'},
  {name:'Pinheiro',color:'#1f3b2c',ink:'#f1e7cf',surface:'marmore-verde',title:'Noite Feliz',subtitle:'Natal em família',font:'Pinyon Script',subFont:'Marcellus',icon:'star'},
  {name:'Neve',color:'#f4f6f8',ink:'#8b1e24',title:'Natal',subtitle:'Memórias que aquecem',font:'Playfair Display',subFont:'Raleway',icon:'snowflake'},
 ]},
 {id:'fifteen',name:'15 anos',subtitle:'Uma noite de princesa',page:{color:'#fdf9fa',texture:'none'},ink:'#9a5a78',font:'Parisienne',icon:'crown',covers:[
  {name:'Rosé',color:'#f6e6ea',ink:'#9a5a78',surface:'metal-rose',title:'Meus 15 anos',subtitle:'Isabela',font:'Parisienne',subFont:'Cinzel',icon:'crown'},
  {name:'Mármore',color:'#ffffff',ink:'#6d5a64',surface:'marmore-branco',title:'Isabela',subtitle:'XV',font:'Pinyon Script',subFont:'Cinzel Decorative',icon:'sparkle'},
  {name:'Noite',color:'#1e1b2e',ink:'#e9c8d6',title:'Quinze',subtitle:'Uma noite inesquecível',font:'Allura',subFont:'Marcellus',icon:'gem'},
 ]},
 {id:'baptism',name:'Batizado',subtitle:'Paz, luz e bênção',page:{color:'#fcfbf8',texture:'paper'},ink:'#7a8aa0',font:'Cormorant Garamond',icon:'feather',covers:[
  {name:'Luz',color:'#f5f3ee',ink:'#7a8aa0',surface:'papel-algodao',title:'Meu Batizado',subtitle:'Miguel',font:'Italianno',subFont:'Cinzel',icon:'bird'},
  {name:'Céu',color:'#e9f0f6',ink:'#5d7690',surface:'linho-azul',title:'Bênção',subtitle:'Com amor, sua família',font:'Petit Formal Script',subFont:'Lora',icon:'cloud'},
  {name:'Branca',color:'#ffffff',ink:'#8a7a5a',surface:'marmore-branco',title:'Batizado',subtitle:'Um dia de fé',font:'Cinzel',subFont:'Cormorant Garamond',icon:'feather'},
 ]},
 {id:'pregnancy',name:'Gestante',subtitle:'A espera mais doce',page:{color:'#fbf8f4',texture:'grain'},ink:'#9c7a62',font:'Allura',icon:'heart',covers:[
  {name:'Doce espera',color:'#f3e9df',ink:'#9c7a62',surface:'linho-areia',title:'Doce espera',subtitle:'Esperando você',font:'Allura',subFont:'Quicksand',icon:'heart'},
  {name:'Natural',color:'#ece8df',ink:'#6f7a5c',surface:'papel-kraft',title:'Nove meses',subtitle:'De puro amor',font:'Caveat',subFont:'Lato',icon:'sprout'},
  {name:'Mármore',color:'#ffffff',ink:'#8c6f74',surface:'marmore-rosa',title:'Gestação',subtitle:'Nossa maior alegria',font:'Sacramento',subFont:'Marcellus',icon:'moon'},
 ]},
 {id:'travel',name:'Viagem',subtitle:'Lugares que viraram memória',page:{color:'#fbfaf6',texture:'none'},ink:'#2e5b6e',font:'Montserrat',icon:'plane',covers:[
  {name:'Diário',color:'#e9e1d0',ink:'#3c3a32',surface:'papel-kraft',title:'Diário de viagem',subtitle:'Lisboa · 2026',font:'Caveat',subFont:'Montserrat',icon:'map'},
  {name:'Mar',color:'#e6f0f3',ink:'#2e5b6e',surface:'linho-azul',title:'Férias',subtitle:'Sol, mar e nós',font:'Kaushan Script',subFont:'Raleway',icon:'sailboat'},
  {name:'Aventura',color:'#2b2f2c',ink:'#f2e3c2',surface:'concreto',title:'AVENTURA',subtitle:'Pelo mundo',font:'Bebas Neue',subFont:'Montserrat',icon:'compass'},
 ]},
 {id:'family',name:'Família',subtitle:'Afeto que atravessa o tempo',page:{color:'#fafaf6',texture:'grain'},ink:'#536452',font:'Cormorant Garamond',icon:'house',covers:[
  {name:'Lar',color:'#e8ede5',ink:'#536452',surface:'linho-natural',title:'Nossa Família',subtitle:'Onde mora o amor',font:'Dancing Script',subFont:'Lora',icon:'house'},
  {name:'Clássica',color:'#f4efe6',ink:'#4a3f33',surface:'papel-algodao',title:'Família Silva',subtitle:'Desde 1998',font:'Playfair Display',subFont:'Cinzel',icon:'heart'},
  {name:'Moderna',color:'#ffffff',ink:'#2a2a26',title:'nós',subtitle:'momentos em família',font:'Raleway',subFont:'Raleway',icon:'sun'},
 ]},
];

/** Fundo das lâminas no tema. Fotos, layouts, textos e ícones das lâminas não mudam. */
export function applyThemeBackground(project:LayoutProject,id:string):LayoutProject{
 const theme=ALBUM_THEMES.find(t=>t.id===id);if(!theme)return project;
 return {...project,spreads:project.spreads.map(spread=>({...spread,background:theme.page.color,rightBackground:undefined,texture:theme.page.texture,surface:theme.page.surface,backgroundPhotoId:undefined}))};
}

/** Troca a capa por uma capa pronta do tema: fundo, textos e enfeite. As fotos da capa continuam. */
export function applyThemeCover(project:LayoutProject,id:string,index:number):LayoutProject{
 const theme=ALBUM_THEMES.find(t=>t.id===id);const option=theme?.covers[index];
 const cover=project.cover;if(!theme||!option||!cover||project.productionModel?.coverMode==='none')return project;
 const wrap=project.productionModel?.coverMode==='wrap';
 const width=project.productionModel?.front.widthMm||project.printSpec!.widthMm,height=project.productionModel?.front.heightMm||project.printSpec!.heightMm;
 const margins=project.productionModel?.coverMargins;
 // Na capa inteira, o texto vai na frente (metade direita).
 const start=wrap?56:Math.max(8,(margins?.leftMm||0)/width*100+6),end=wrap?94:100-Math.max(8,(margins?.rightMm||0)/width*100+6);
 const hasPhoto=!!cover.photo.photoId||!!cover.composition?.slots.some(s=>s.photoId);
 const top=hasPhoto?8:24;
 // Tamanho proporcional à altura da capa (pt): título grande e subtítulo discreto.
 const titlePt=Math.round(Math.max(40,Math.min(110,height*.2))),subPt=Math.round(Math.max(13,Math.min(30,height*.055)));
 const titleH=titlePt*25.4/72/height*100*(option.title.length>14?2.2:1.25);
 const title:AlbumText={...newAlbumText(),text:option.title,fontFamily:option.font,fontSize:titlePt,x:start,y:top,width:end-start,color:option.ink,align:'center'};
 const subtitle:AlbumText={...newAlbumText(),text:option.subtitle,fontFamily:option.subFont,fontSize:subPt,x:start,y:top+titleH+3,width:end-start,color:option.ink,align:'center'};
 const size=Math.min(18,width*.06,height*.07);
 const icons:AlbumIcon[]=option.icon&&!hasPhoto?[{id:crypto.randomUUID(),kind:option.icon,x:(start+end)/2-size/width*(wrap?25:50),y:top+titleH+14,sizeMm:size,rotation:0,color:option.ink}]:[];
 const look:Partial<Cover>={color:option.color,textColor:option.ink,surface:option.surface,texture:option.texture,backgroundPhotoId:undefined};
 const next:Cover={...cover,...look,customText:true,texts:[title,subtitle],icons};
 const back=project.backCover?{...project.backCover,...look}:project.backCover;
 return {...project,cover:next,backCover:back};
}
