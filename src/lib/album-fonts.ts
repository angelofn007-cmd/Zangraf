import files from './album-font-files.json';
import type {AlbumText,LayoutProject} from './layout-projects';

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
] as const;
export type AlbumFont=typeof ALBUM_FONTS[number]['family'];
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
