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
 if(margins.leftMm&&!margins.topMm&&!margins.rightMm&&!margins.bottomMm)return `Dobra de ${cm(margins.leftMm)} cm à esquerda. Essa faixa ficará escondida.`;
 if(new Set(Object.values(margins)).size===1)return `Margem de ${cm(margins.topMm)} cm em todos os lados. Mantenha rostos e textos dentro do pontilhado.`;
 return 'As áreas sombreadas indicam as margens de acabamento. Mantenha rostos e textos dentro do pontilhado.';
}
