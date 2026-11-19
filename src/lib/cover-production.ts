export type CoverMode = 'separate' | 'wrap' | 'front' | 'none';
export type CoverMargins = {topMm:number;rightMm:number;bottomMm:number;leftMm:number};
export const NO_COVER_MARGINS:CoverMargins={topMm:0,rightMm:0,bottomMm:0,leftMm:0};

export function coverPageIndices(mode:CoverMode = 'separate'):number[]{
 if(mode==='none')return [];
 return mode==='separate'?[-1,-2]:[-1];
}
export function coverLabel(mode:CoverMode = 'separate'){
 return mode==='none'?'Sem capa personalizável':mode==='wrap'?'Capa inteira, com verso e dorso':'Capa frente';
}
export function coverMarginDescription(margins?:CoverMargins){
 if(!margins||!Object.values(margins).some(Boolean))return 'Imagem inteira, sem margem de dobra.';
 const cm=(mm:number)=>(mm/10).toLocaleString('pt-BR',{maximumFractionDigits:2});
 if(margins.leftMm&&!margins.topMm&&!margins.rightMm&&!margins.bottomMm)return `A dobra de ${cm(margins.leftMm)} cm à esquerda fica escondida na impressão. Mantenha rostos e elementos importantes fora dela.`;
 if(new Set(Object.values(margins)).size===1)return `Essa margem de ${cm(margins.topMm)} cm nas bordas não aparece na impressão. Mantenha rostos e elementos importantes fora dela.`;
 return 'As áreas sombreadas nas bordas não aparecem na impressão. Mantenha rostos e elementos importantes fora delas.';
}
