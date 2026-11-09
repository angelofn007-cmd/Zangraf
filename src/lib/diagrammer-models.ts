import {type CoverMode,type CoverMargins} from './cover-production';
import {validatePhysicalPrintSpec} from './print-rules';
import type {PrintSpec,LayoutProject} from './layout-projects';

export type PrintVariant={id:string;sheets:number;stock?:string;page:PrintSpec;front:PrintSpec;back:PrintSpec};
export type StockRule={id:string;label:string;thicknessMm:number;baseSheets:number;maxSheets:number;step:number;page:PrintSpec;front:PrintSpec;back:PrintSpec};
export type PrintModel={id:string;name:string;productId:string;sizeLabel:string;version:string;coverMode?:CoverMode;coverMargins?:CoverMargins;insideMode?:'page'|'spread';rules?:StockRule[];variants:PrintVariant[]};
function checkedSpec(raw:unknown):PrintSpec{
 if(!raw||typeof raw!=='object')throw new Error('Preencha todas as medidas.');
 const value=raw as PrintSpec;
 return validatePhysicalPrintSpec({widthMm:value.widthMm,heightMm:value.heightMm,bleedMm:value.bleedMm,dpi:value.dpi,exportMode:'page' as const});
}
export function variantsForRules(rules:StockRule[]):PrintVariant[]{
 return rules.flatMap(rule=>{
  if(!Number.isInteger(rule.baseSheets)||!Number.isInteger(rule.maxSheets)||rule.baseSheets<10||rule.baseSheets%5!==0||rule.maxSheets>60||rule.maxSheets<rule.baseSheets||rule.maxSheets%5!==0||rule.step!==5||!Number.isFinite(rule.thicknessMm)||rule.thicknessMm<=0||rule.thicknessMm>5)throw new Error('Confira a quantidade de lâminas, o intervalo e a espessura.');
  return Array.from({length:Math.floor((rule.maxSheets-10)/rule.step)+1},(_,i)=>{
   const sheets=10+i*rule.step;const extra=(sheets-rule.baseSheets)*rule.thicknessMm;
   return {id:`${rule.id}-${sheets}`,stock:rule.label,sheets,page:checkedSpec(rule.page),front:checkedSpec({...rule.front,widthMm:Math.round((rule.front.widthMm+extra)*100)/100}),back:checkedSpec(rule.back)};
  });
 });
}
export function parsePrintModel(raw:unknown):PrintModel{
 if(!raw||typeof raw!=='object')throw new Error('Modelo inválido.');
 const data=raw as Record<string,unknown>;
 const text=(key:string,max:number)=>{const value=data[key];if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(`Confira o campo ${key}.`);return value.trim();};
 const id=text('id',80);if(!/^[a-zA-Z0-9-]+$/.test(id))throw new Error('Identificador inválido.');
 const coverMode:CoverMode=data.coverMode===undefined?'separate':data.coverMode as CoverMode;
 if(!['separate','wrap','front','none'].includes(coverMode))throw new Error('Escolha o tipo de arquivo da capa.');
 const insideMode=data.insideMode==='spread'?'spread':'page';
 let coverMargins:CoverMargins|undefined;
 if(data.coverMargins!==undefined){
  const raw=data.coverMargins as CoverMargins;
  if(!raw||['topMm','rightMm','bottomMm','leftMm'].some(key=>!Number.isFinite(raw[key as keyof CoverMargins])||raw[key as keyof CoverMargins]<0||raw[key as keyof CoverMargins]>100))throw new Error('Use margens de acabamento entre 0 e 10 cm.');
  coverMargins={topMm:raw.topMm,rightMm:raw.rightMm,bottomMm:raw.bottomMm,leftMm:raw.leftMm};
 }
 let rules:StockRule[]|undefined;
 if(data.rules!==undefined){
  if(!Array.isArray(data.rules)||!data.rules.length||data.rules.length>4||coverMode!=='wrap')throw new Error('As regras de espessura usam uma capa inteira e até quatro materiais.');
  rules=data.rules.map((rawRule):StockRule=>{const r=rawRule as StockRule;if(!r||typeof r.id!=='string'||!/^[-a-zA-Z0-9]{1,60}$/.test(r.id)||typeof r.label!=='string'||!r.label.trim()||r.label.length>40)throw new Error('Nome do material inválido.');return {id:r.id,label:r.label.trim(),baseSheets:r.baseSheets,maxSheets:r.maxSheets,step:r.step,thicknessMm:r.thicknessMm,page:checkedSpec(r.page),front:checkedSpec(r.front),back:checkedSpec(r.back)};});
  if(new Set(rules.map(r=>r.id)).size!==rules.length||new Set(rules.map(r=>r.label)).size!==rules.length)throw new Error('Use nomes diferentes para cada material.');
 }
 const rawVariants=rules?variantsForRules(rules):data.variants;
 if(!Array.isArray(rawVariants)||!rawVariants.length||rawVariants.length>100)throw new Error('Cadastre de 1 a 100 combinações de material e lâminas.');
 const seen=new Set<string>();const ids=new Set<string>();
 const variants=rawVariants.map((rawVariant):PrintVariant=>{
  if(!rawVariant||typeof rawVariant!=='object')throw new Error('Medidas inválidas.');const v=rawVariant as PrintVariant;
  const stock=typeof v.stock==='string'?v.stock.trim().slice(0,40):'';const key=stock+':'+v.sheets;
  if(typeof v.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(v.id)||ids.has(v.id)||!Number.isInteger(v.sheets)||v.sheets<10||v.sheets>60||v.sheets%5!==0||seen.has(key))throw new Error('Use combinações únicas de material e quantidade, entre 10 e 60 lâminas, de 5 em 5.');
  if(checkedSpec(v.page).bleedMm!==3)throw new Error('O miolo exige 0,3 cm de sangria por lado.');
  if(coverMargins&&coverMode!=='none'&&(coverMargins.leftMm+coverMargins.rightMm>=v.front.widthMm+v.front.bleedMm*2||coverMargins.topMm+coverMargins.bottomMm>=v.front.heightMm+v.front.bleedMm*2))throw new Error('As margens devem deixar uma área visível na capa.');
  seen.add(key);ids.add(v.id);return {id:v.id,sheets:v.sheets,stock,page:checkedSpec(v.page),front:checkedSpec(v.front),back:checkedSpec(v.back)};
 });
 return {id,name:text('name',100).replace(/anti[ -]?r{1,2}isco/gi,'Anti-Risco'),productId:text('productId',100),sizeLabel:text('sizeLabel',80),version:typeof data.version==='string'?data.version:'',coverMode,...(coverMargins?{coverMargins}:{}),insideMode,...(rules?{rules}:{}),variants};
}
export function snapshotModel(model:PrintModel,variant:PrintVariant):NonNullable<LayoutProject['productionModel']>{return {id:model.id,name:model.name,version:model.version,variantId:variant.id,sheets:variant.sheets,stock:variant.stock,coverMode:model.coverMode||'separate',...(model.coverMargins?{coverMargins:model.coverMargins}:{}),insideMode:model.insideMode||'page',page:variant.page,front:variant.front,back:variant.back};}
export const formatCm=(value:number)=>(value/10).toLocaleString('pt-BR',{maximumFractionDigits:2});
export const specLabel=(spec:PrintSpec,bleed=false,spread=false)=>`${formatCm(spec.widthMm*(spread?2:1)+(bleed?spec.bleedMm*2:0))} × ${formatCm(spec.heightMm+(bleed?spec.bleedMm*2:0))} cm`;
