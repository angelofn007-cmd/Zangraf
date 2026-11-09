'use client';
import {usesAlbumLayout} from '@/lib/products';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {upload} from '@vercel/blob/client';
import {ArrowLeft,ArrowRight,CheckCircle2,LockKeyhole} from 'lucide-react';
import {readCart,writeCart,type CartItem} from '@/lib/cart';
import {productPrice} from '@/lib/pricing';
import {products} from '@/lib/products';
import {loadProject,type LayoutProject} from '@/lib/layout-projects';
import {coverPageIndices} from '@/lib/cover-production';
import {expectedPrintFiles} from '@/lib/order-rules';
import {printWarnings,renderPrintJpeg} from './diagrammer-export';

type OrderFile={id:string;item_key:string;filename:string;pathname:string;verified:boolean};
type PreparedOrder={orderId:string;status:string;files:OrderFile[]};
const money=(value:number)=>(value/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
async function post<T>(path:string,body:unknown):Promise<T>{
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw new Error(result.message||'Não foi possível concluir o envio. Tente novamente.');
 return result;
}

export function CheckoutReview(){
 const [items,setItems]=useState<CartItem[]>([]);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const busyRef=useRef(false);
 const [error,setError]=useState('');
 const [progress,setProgress]=useState('');
 const [warnings,setWarnings]=useState<string[]>([]);
 const [orderId,setOrderId]=useState('');
 const [phone,setPhone]=useState('');
 const [notes,setNotes]=useState('');
 const [approved,setApproved]=useState(false);
 const [completed,setCompleted]=useState(false);
 useEffect(()=>{try{setItems(readCart())}catch{setError('Não foi possível ler o carrinho neste navegador.')}setReady(true)},[]);
 useEffect(()=>{if(!busy)return;const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent)},[busy]);
 const entries=items.map(item=>({item,product:item.product||products.find(product=>product.id===item.productId)}));
 const unavailable=entries.some(({item,product})=>!product||productPrice(product,item.configuration)===null);
 const total=entries.reduce((sum,{item,product})=>sum+(product?productPrice(product,item.configuration)??0:0)*item.quantity,0);

 async function send(event:React.FormEvent){
  event.preventDefault();if(busyRef.current)return;
  busyRef.current=true;setBusy(true);setError('');setProgress('Preparando seu pedido…');
  try{
   const snapshots=new Map<string,LayoutProject>();const foundWarnings:string[]=[];
   const requestItems=[];
   for(const {item,product} of entries){
    if(!product||productPrice(product,item.configuration)===null)throw new Error('Há produtos ilustrativos ou sem preço. A equipe precisa liberar esses modelos antes da venda.');
    const album=usesAlbumLayout(product);
    let project:LayoutProject|undefined;
    if(album){
     if(!item.layoutProjectId)throw new Error(`Personalize ${product.name} no diagramador antes de enviar.`);
     project=await loadProject(item.layoutProjectId);
     if(!project||project.cartItemId!==item.id||project.productId!==item.productId)throw new Error(`Reabra ${product.name} pelo carrinho para confirmar a personalização.`);
     if(JSON.stringify(project.configuration)!==JSON.stringify(item.configuration))throw new Error(`A configuração de ${product.name} mudou. Reabra o diagramador pelo carrinho.`);
     const expected=expectedPrintFiles(product,item.configuration,project.productionModel);
     if(expected.length!==project.spreads.length*(project.productionModel?.insideMode==='spread'?1:2)+coverPageIndices(project.productionModel?.coverMode).length)throw new Error(`Confira a quantidade de páginas de ${product.name}.`);
     const spec=product.printSizes?.find(size=>size.label===item.configuration.size);
     if(!spec||!project.printSpec||(['widthMm','heightMm','bleedMm','dpi'] as const).some(key=>spec[key]!==project!.printSpec![key]))throw new Error(`Confira o formato de ${product.name} no diagramador.`);
     foundWarnings.push(...printWarnings(project).map(warning=>`${product.name}: ${warning}`));
     snapshots.set(item.id,project);
    }
    requestItems.push({id:item.id,productId:item.productId,configuration:item.configuration,quantity:item.quantity,priceCents:productPrice(product,item.configuration),...(project?{layoutProjectId:project.id,layoutUpdatedAt:project.updatedAt,...(project.productionModel?{printModel:{id:project.productionModel.id,variantId:project.productionModel.variantId,version:project.productionModel.version}}:{})}:{})});
   }
   if(foundWarnings.length&&JSON.stringify(foundWarnings)!==JSON.stringify(warnings)){
    setWarnings(foundWarnings);setApproved(false);throw new Error('Confira os avisos dos álbuns abaixo e confirme a revisão para continuar.');
   }
   if(!approved)throw new Error('Confirme que revisou os álbuns e os dados do pedido.');
   const payload={items:requestItems,phone,notes};
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
   const signature=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
   const key='zangraf-order-'+signature;
   let requestKey=sessionStorage.getItem(key);
   if(!requestKey){requestKey=crypto.randomUUID();sessionStorage.setItem(key,requestKey)}
   const order=await post<PreparedOrder>('/api/checkout',{...payload,requestKey});
   setOrderId(order.orderId);
   if(order.status==='cancelled')throw new Error('Esse pedido foi cancelado. Entre em contato com a equipe.');
   if(order.status==='draft'){
    for(let index=0;index<order.files.length;index++){
     const file=order.files[index];if(file.verified)continue;
     const project=snapshots.get(file.item_key);if(!project)throw new Error('O projeto deste arquivo não está disponível neste navegador.');
     setProgress(`Preparando e enviando arquivo ${index+1} de ${order.files.length}: ${file.filename}`);
     // A previous upload may have completed before a connection interruption.
     let existing=false;
     try{await post('/api/arquivos/verificar',{fileId:file.id});existing=true}catch{/* Continue with the original upload. */}
     if(existing)continue;
     const filename=file.filename.replace(/^Capa\//,'');
     const page=/^(pagina|lamina)-(\d+)\.jpg$/.exec(filename);
     const numbered=/^(Lâminas|Páginas)\/(\d+)\.jpg$/.exec(filename);
     if(!page&&!numbered&&!['capa-inteira.jpg','capa-frente.jpg','capa-verso.jpg'].includes(filename))throw new Error('A lista de arquivos do pedido está inválida.');
     const kind=['capa-inteira.jpg','capa-frente.jpg'].includes(filename)?'cover-front':filename==='capa-verso.jpg'?'cover-back':page?.[1]==='lamina'||numbered?.[1]==='Lâminas'?'spread':'page';
     const blob=await renderPrintJpeg(project,kind,page?Number(page[2])-1:numbered?Number(numbered[2])-1:0);
     if(blob.size>12*1024*1024)throw new Error(`${file.filename} ultrapassa 12 MB. Seu projeto está salvo. Entre em contato com a equipe para combinar o envio deste álbum.`);
     try{await upload(file.pathname,blob,{access:'private',handleUploadUrl:'/api/arquivos/upload',contentType:'image/jpeg',clientPayload:JSON.stringify({fileId:file.id,size:blob.size})})}
     catch{await post('/api/arquivos/verificar',{fileId:file.id});continue}
     await post('/api/arquivos/verificar',{fileId:file.id});
    }
   }
   await post('/api/pedidos/enviar',{orderId:order.orderId});
   setCompleted(true);setProgress('Pedido recebido pela Zangraf.');
   try{const sent=new Set(items.map(item=>item.id));writeCart(readCart().filter(item=>!sent.has(item.id)))}catch{/* The received order remains valid even if local storage is unavailable. */}
  }catch(error){setError(error instanceof Error?error.message:'Não foi possível enviar. Seus álbuns continuam salvos neste navegador.');setProgress('')}
  finally{busyRef.current=false;setBusy(false)}
 }
 if(!ready)return <p role="status">Carregando sua seleção…</p>;
 if(completed)return <div className="form-panel"><CheckCircle2 size={36}/><h2>Pedido recebido.</h2><p>Referência: <strong>{orderId.slice(0,8)}</strong></p><p>A equipe combinará o pagamento e a entrega com você. Os arquivos ficam privados. A produção será liberada após pagamento confirmado e aprovação administrativa.</p><Link className="button" href="/minha-conta/pedidos">Acompanhar pedido <ArrowRight size={16}/></Link></div>;
 if(!items.length)return <div className="form-panel"><h2>Seu carrinho está vazio.</h2><Link className="button" href="/albuns">Explorar álbuns</Link></div>;
 return <div className="zg-cart-layout"><form className="form-panel" onSubmit={send}>
  <h2>Uma última olhada na sua história.</h2>
  {entries.map(({item,product})=><article key={item.id} style={{borderBottom:'1px solid #ded8cb',padding:'16px 0'}}><strong>{product?.name||'Produto indisponível'} × {item.quantity}</strong><p>{Object.values(item.configuration).filter(Boolean).join(' · ')}</p>{product&&usesAlbumLayout(product)&&<Link href={'/diagramador?item='+encodeURIComponent(item.id)} aria-disabled={busy} onClick={event=>{if(busy)event.preventDefault()}}>Revisar personalização</Link>}</article>)}
  {unavailable&&<p role="alert">Sua seleção inclui modelos ilustrativos ou sem preço publicado. A equipe precisa liberar esses produtos para receber o pedido.</p>}
  <fieldset disabled={busy||unavailable} style={{border:0,padding:0,display:'grid',gap:16,marginTop:24}}>
   <label>Telefone para contato<input required type="tel" minLength={10} maxLength={22} autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="(11) 99999-9999"/></label>
   <label>Observações para a equipe<textarea maxLength={1000} rows={3} value={notes} onChange={event=>setNotes(event.target.value)}/></label>
   {!!warnings.length&&<div role="alert"><h3>Confira antes de enviar</h3><ul>{warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></div>}
   <label style={{display:'flex',gap:10,alignItems:'start'}}><input type="checkbox" checked={approved} onChange={event=>setApproved(event.target.checked)} required style={{width:'auto',marginTop:4}}/><span>Revisei capas, páginas, enquadramentos e avisos. Autorizo o envio desta versão à Zangraf para conferência.</span></label>
   <button className="button" type="submit">{busy?'Enviando…':orderId?'Retomar envio':'Enviar pedido'} <ArrowRight size={16}/></button>
  </fieldset>
  {progress&&<p role="status" aria-live="polite">{progress}</p>}{error&&<p role="alert" className="zg-config-error">{error}</p>}
  {orderId&&!completed&&<p>Rascunho #{orderId.slice(0,8)}. Em caso de interrupção, mantenha os mesmos dados e clique em retomar envio.</p>}
 </form><aside className="zg-order-summary"><span className="zg-eyebrow">RESUMO DO PEDIDO</span><h2>Pronto para ganhar forma.</h2><dl><div><dt>Produtos</dt><dd>{unavailable?'Sob consulta':money(total)}</dd></div><div><dt>Frete</dt><dd>A combinar</dd></div></dl><p>O envio registra seu pedido. Pagamento e entrega serão combinados com a equipe; a produção começa após a aprovação administrativa.</p><p><LockKeyhole size={16}/> Os JPGs são armazenados com acesso privado.</p><Link href="/carrinho" aria-disabled={busy} onClick={event=>{if(busy)event.preventDefault()}}><ArrowLeft size={14}/> Voltar ao carrinho</Link></aside></div>;
}
