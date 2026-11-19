import files from './album-font-files.json';
import type {AlbumText,LayoutProject} from './layout-projects';

/** As 11 primeiras são as principais; as demais são as mais usadas em álbuns no Brasil, por estilo. */
export const ALBUM_FONTS=[
 {family:'Playfair Display',label:'Adicionar título',style:'Título'},
 {family:'Montserrat',label:'ADICIONAR SUBTÍTULO',style:'Subtítulo'},
 {family:'Lora',label:'Um parágrafo de texto',style:'Texto corrido'},
 {family:'Cinzel',label:'Baile de Gala',style:'Romana'},
 {family:'Great Vibes',label:'Nossa história',style:'Manuscrito'},
 {family:'Bebas Neue',label:'FORMATURA',style:'Impacto'},
 {family:'Cormorant Garamond',label:'Colação de Grau',style:'Editorial'},
 {family:'Josefin Sans',label:'TURMA 2026',style:'Contemporânea'},
 {family:'Georgia',label:'Clássica',style:'Sistema'},
 {family:'Arial',label:'Moderna',style:'Sistema'},
 {family:'Courier New',label:'Memórias',style:'Máquina de escrever'},
 {family:'Alex Brush',label:'Para sempre nós',style:'Manuscrita elegante',group:'Manuscritas'},
 {family:'Allura',label:'Com todo amor',style:'Manuscrita delicada',group:'Manuscritas'},
 {family:'Parisienne',label:'Nosso casamento',style:'Manuscrita clássica',group:'Manuscritas'},
 {family:'Pinyon Script',label:'Meus 15 anos',style:'Caligrafia formal',group:'Manuscritas'},
 {family:'Dancing Script',label:'Momentos felizes',style:'Manuscrita leve',group:'Manuscritas'},
 {family:'Sacramento',label:'Bem-vindo ao mundo',style:'Monolinha fina',group:'Manuscritas'},
 {family:'Tangerine',label:'Eternamente',style:'Caligrafia estreita',group:'Manuscritas'},
 {family:'Italianno',label:'Lua de mel',style:'Caligrafia italiana',group:'Manuscritas'},
 {family:'Mrs Saint Delafield',label:'Assinatura',style:'Assinatura',group:'Manuscritas'},
 {family:'Petit Formal Script',label:'Convite especial',style:'Formal',group:'Manuscritas'},
 {family:'Libre Baskerville',label:'Uma história de amor',style:'Serifada clássica',group:'Clássicas'},
 {family:'EB Garamond',label:'Capítulo um',style:'Livro antigo',group:'Clássicas'},
 {family:'Bodoni Moda',label:'Editorial',style:'Revista',group:'Clássicas'},
 {family:'DM Serif Display',label:'Grande dia',style:'Título serifado',group:'Clássicas'},
 {family:'Marcellus',label:'CERIMÔNIA',style:'Romana suave',group:'Clássicas'},
 {family:'Cinzel Decorative',label:'Baile de Debutante',style:'Romana decorada',group:'Clássicas'},
 {family:'Prata',label:'Bodas de prata',style:'Serifada delicada',group:'Clássicas'},
 {family:'Abril Fatface',label:'Formatura',style:'Título forte',group:'Clássicas'},
 {family:'Poppins',label:'Nossa viagem',style:'Geométrica',group:'Modernas'},
 {family:'Raleway',label:'FAMÍLIA',style:'Moderna fina',group:'Modernas'},
 {family:'Lato',label:'Texto do álbum',style:'Texto limpo',group:'Modernas'},
 {family:'Open Sans',label:'Legenda das fotos',style:'Legível',group:'Modernas'},
 {family:'Quicksand',label:'Primeiro aninho',style:'Arredondada',group:'Modernas'},
 {family:'Nunito',label:'Chá de bebê',style:'Suave',group:'Modernas'},
 {family:'Kaushan Script',label:'Partiu praia!',style:'Pincel',group:'Divertidas'},
 {family:'Caveat',label:'Anotações do dia',style:'Escrita à mão',group:'Divertidas'},
 {family:'Amatic SC',label:'FESTA JUNINA',style:'Desenhada',group:'Divertidas'},
] as const;
export type AlbumFont=typeof ALBUM_FONTS[number]['family'];
export const MAIN_FONT_COUNT=11;
export const FONT_GROUPS=['Manuscritas','Clássicas','Modernas','Divertidas'] as const;
export const fontsInGroup=(group:typeof FONT_GROUPS[number])=>ALBUM_FONTS.filter(f=>'group' in f&&f.group===group);
const loads=new Map<string,Promise<void>>();
export function ensureFont(family:string):Promise<void>{
 const file=files.find(f=>f.family===family);
 if(!file||typeof document==='undefined')return Promise.resolve();
 const cached=loads.get(family);if(cached)return cached;
 const task=new FontFace(family,`url("${file.url}")`).load().then(face=>{document.fonts.add(face);}).catch(error=>{loads.delete(family);throw error;});
 loads.set(family,task);return task;
}
export async function ensureTextFonts(texts:AlbumText[]){await Promise.all([...new Set(texts.map(t=>t.fontFamily))].map(ensureFont));}
export async function ensureProjectFonts(project:LayoutProject){await ensureTextFonts([...(project.cover?.texts||[]),...(project.backCover?.texts||[]),...project.spreads.flatMap(s=>s.texts||[])]);}
