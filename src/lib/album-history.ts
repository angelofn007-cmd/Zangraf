import type {LayoutProject} from './layout-projects';

/**
 * Guarda um passo no desfazer. Com mais passos que `limit`, descarta os mais antigos,
 * menos o primeiro: o ponto de partida (álbum ao abrir ou ao salvar) sempre fica.
 */
export function pushHistory<T>(items:T[],state:T,limit:number):T[]{
 const next=[...items,state];
 if(next.length>limit)next.splice(1,next.length-limit);
 return next;
}

/**
 * Estado a mostrar ao desfazer/refazer: o álbum do passo restaurado, mas com todas as fotos enviadas.
 * A biblioteca é a atual mais as fotos que o passo ainda tinha (desfazer uma exclusão traz a foto
 * de volta, no lugar onde estava); nenhuma foto enviada some.
 */
export function restoreAlbum(target:LayoutProject,current:LayoutProject|null|undefined):LayoutProject{
 const latest=new Map((current?.photos||[]).map(photo=>[photo.id,photo]));
 const inTarget=new Set(target.photos.map(photo=>photo.id));
 const photos=[...target.photos.map(photo=>latest.get(photo.id)??photo),...(current?.photos||[]).filter(photo=>!inTarget.has(photo.id))];
 return {...target,photos};
}
