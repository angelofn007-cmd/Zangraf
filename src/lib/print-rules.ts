export const MAX_ALBUM_SHEETS = 60;
export type PhysicalPrintSpec = {widthMm:number;heightMm:number;bleedMm:number;dpi:number};
export function configuredSheetCount(value:string){
 const match=/^(\d+)\s*l[âa]minas?$/i.exec(value.trim());
 const count=match?Number(match[1]):0;
 if(!Number.isInteger(count)||count<1||count>MAX_ALBUM_SHEETS)throw new Error(`Escolha uma quantidade entre 1 e ${MAX_ALBUM_SHEETS} lâminas.`);
 return count;
}
export function validatePhysicalPrintSpec<T extends PhysicalPrintSpec>(spec:T):T{
 if(![spec.widthMm,spec.heightMm].every(value=>Number.isFinite(value)&&value>=100&&value<=1000)||![0,3].includes(spec.bleedMm)||spec.dpi!==300)throw new Error('Use medidas entre 10 e 100 cm e resolução de 300 DPI. Capas podem usar o tamanho total do arquivo; o miolo usa 0,3 cm de sangria por lado.');
 return spec;
}
export function physicalPrintDimensions(spec:PhysicalPrintSpec,spread=false){
 validatePhysicalPrintSpec(spec);
 return {width:Math.round(((spread?spec.widthMm*2:spec.widthMm)+spec.bleedMm*2)/25.4*spec.dpi),height:Math.round((spec.heightMm+spec.bleedMm*2)/25.4*spec.dpi)};
}
