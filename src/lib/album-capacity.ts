export const MAX_ALBUM_PHOTOS = 1000;
export const MAX_PHOTO_BYTES = 50 * 1024 * 1024;
export const MAX_PROJECT_PHOTO_BYTES = 2 * 1024 * 1024 * 1024;
export function checkAlbumCapacity(existing:{size:number}[],incoming:{size:number}[]) {
 if(existing.length+incoming.length>MAX_ALBUM_PHOTOS)throw new Error('O álbum aceita até 1.000 fotos. Selecione um lote menor.');
 if([...existing,...incoming].reduce((sum,file)=>sum+file.size,0)>MAX_PROJECT_PHOTO_BYTES)throw new Error('O álbum aceita até 2 GB de fotos originais. Remova fotos não utilizadas ou selecione um lote menor.');
}
