'use client';
import type {AlbumPriceRule} from '@/lib/pricing';

export function AlbumPriceEditor({rows,sizes,finishes,onChange}:{rows:AlbumPriceRule[];sizes:string[];finishes:string[];onChange:(rows:AlbumPriceRule[])=>void}){
 function update(index:number,patch:Partial<AlbumPriceRule>){onChange(rows.map((row,i)=>i===index?{...row,...patch}:row));}
 return <fieldset className="aw-album-pricing"><legend>Preço do encadernado + lâminas</legend>
  <p>Valor do álbum = encadernado + quantidade × valor da lâmina. Cadastre cada formato, gramatura e acabamento. Combinações sem preço ficam sob consulta.</p>
  {!finishes.length&&<p role="status">Preencha os acabamentos do produto abaixo (por exemplo: Brilho, Fosco).</p>}
  {rows.map((row,index)=><div key={index} className="aw-price-rule">
   <div className="aw-two-columns"><label>Formato<select required value={row.size} onChange={e=>update(index,{size:e.target.value})}><option value="">Selecione</option>{sizes.map(size=><option key={size}>{size}</option>)}</select></label><label>Gramatura<select value={row.stock} onChange={e=>update(index,{stock:e.target.value as AlbumPriceRule['stock']})}><option>500 g</option><option>800 g</option></select></label></div>
   <div className="aw-two-columns"><label>Acabamento<select required value={row.finish} onChange={e=>update(index,{finish:e.target.value})}><option value="">Selecione</option>{finishes.map(finish=><option key={finish}>{finish}</option>)}</select></label><label>Válido até<select value={row.maxSheets??60} onChange={e=>update(index,{maxSheets:Number(e.target.value)})}>{Array.from({length:11},(_,i)=>10+5*i).map(count=><option key={count} value={count}>{count} lâminas</option>)}</select></label></div>
   <div className="aw-two-columns">{(['bindingCents','sheetCents'] as const).map(key=><label key={key}>{key==='bindingCents'?'Encadernado (R$)':'Cada lâmina (R$)'}<input required type="number" min="0.01" max="10000" step="0.01" value={row[key]?row[key]/100:''} onChange={e=>update(index,{[key]:Math.round(Number(e.target.value)*100)})}/></label>)}</div>
   <div className="aw-price-rule-footer"><small>10 lâminas: {((row.bindingCents+10*row.sheetCents)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</small><button type="button" className="aw-link" onClick={()=>onChange(rows.filter((_,i)=>i!==index))}>Remover linha</button></div>
  </div>)}
  <button className="aw-button aw-secondary" type="button" disabled={rows.length>=80||!finishes.length} onClick={()=>onChange([...rows,{size:sizes[0]||'',stock:rows.at(-1)?.stock==='500 g'?'800 g':'500 g',finish:finishes[0]||'',bindingCents:0,sheetCents:0}])}>Adicionar combinação</button>
 </fieldset>;
}
