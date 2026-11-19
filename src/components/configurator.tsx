'use client';
import {usesAlbumLayout} from '@/lib/products';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, Layers, Ruler} from 'lucide-react';
import type {Product, Configuration} from '@/lib/products';
import {addToCart} from '@/lib/cart';
import {productPrice,minimumProductPrice,albumPriceBreakdown} from '@/lib/pricing';
import {ProductGallery} from './product-gallery';
import {CameraArt} from './camera-art';
import {productSheetOptions, ALBUM_STOCK_OPTIONS} from '@/lib/album-options';
import {coverLabel,coverMarginDescription} from '@/lib/cover-production';
import {specLabel, type PrintModel} from '@/lib/diagrammer-models';

const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
type ConfigStep = {key: keyof Configuration; label: string; title: string; options: string[]};

export function Configurator({product, models = []}: {product: Product; models?: PrintModel[]}) {
 const router = useRouter();
 const isAlbum = usesAlbumLayout(product);
 const categoryHref = product.kind==='kit' ? '/kits-layflat' : isAlbum ? '/albuns' : product.kind === 'case' ? '/estojos' : '/acessorios';
 const categoryName = product.kind==='kit' ? 'Kits Layflat' : isAlbum ? 'Álbuns' : product.kind === 'case' ? 'Estojos' : 'Acessórios';
 const physicalSizes = product.printSizes ?? [];
 const fields: ConfigStep[] = [
  {key: 'size', label: 'Formato', title: 'Qual formato combina com sua história?', options: physicalSizes.length ? physicalSizes.map(size => size.label) : product.options.sizes},
  {key: 'stock', label: 'Gramatura', title: 'Escolha a espessura das suas lâminas.', options: isAlbum ? ALBUM_STOCK_OPTIONS : []},
  {key: 'sheets', label: 'Lâminas', title: 'Dê espaço para suas fotografias.', options: isAlbum ? productSheetOptions(product) : product.options.sheets},
  {key: 'cover', label: isAlbum ? 'Capa' : 'Material', title: isAlbum ? 'A primeira impressão é sua.' : 'Escolha o material.', options: product.options.covers},
  {key: 'finish', label: 'Acabamento', title: 'Um último toque de personalidade.', options: product.options.finishes},
 ].filter(item => item.options.length) as ConfigStep[];
 const steps=fields.filter(item=>item.options.length>1);
 const [step, setStep] = useState(0);
 const [values, setValues] = useState<Configuration>(()=>Object.fromEntries((isAlbum ? ['size','stock','sheets','cover','finish'] : ['size','sheets','cover','finish']).map(key=>{const field=fields.find(field=>field.key===key);return[key,field?.options.length===1?field.options[0]:'']})) as Configuration);
 const [savedItemId, setSavedItemId] = useState('');
 const [error, setError] = useState('');
 const heading = useRef<HTMLHeadingElement>(null);
 useEffect(() => {if (step > 0) heading.current?.focus();}, [step]);
 const current = steps[step];
 const review = step === steps.length;
 const selectedPrice=productPrice(product,values);
 const completeSelection=fields.every(field=>!!values[field.key]);
 const displayedPrice=selectedPrice??(completeSelection?null:minimumProductPrice(product,values));
 const hasPrice=displayedPrice!==null;
 const priceBreakdown=albumPriceBreakdown(product,values);
 const chosenSize = physicalSizes.find(size => size.label === values.size);
 const chosenModel = models.find(model => model.sizeLabel === values.size);
 const chosenVariant = chosenModel?.variants.find(variant => variant.sheets === Number.parseInt(values.sheets, 10) && variant.stock === values.stock);
 const canDiagram = isAlbum && !!chosenSize && !!chosenVariant;
 function save(openEditor: boolean) {
  if (!completeSelection || (isAlbum && !canDiagram)) {
   setError('Esta combinação ainda não tem as medidas de impressão cadastradas. Escolha outro modelo ou entre em contato com a Zangraf.');
   return;
  }
  try {
   const itemId = addToCart(product, values, {separate: isAlbum});
   setSavedItemId(itemId);
   setError('');
   if (openEditor) router.push('/diagramador?item=' + encodeURIComponent(itemId));
  } catch (failure) {
   setError(failure instanceof Error ? failure.message : 'Não foi possível guardar a configuração. Tente novamente.');
  }
 }
 return <section className="zg-section zg-detail">
  <nav className="zg-breadcrumbs" aria-label="Caminho da página"><Link href="/">Início</Link><span>/</span><Link href={categoryHref}>{categoryName}</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
  <div className="zg-detail-grid">
   <div className="zg-detail-visual"><ProductGallery key={product.id} product={product}/>{!product.imageUrl&&<p>Ilustração conceitual. A imagem real do produto será disponibilizada no catálogo.</p>}<div className="zg-detail-story"><span className="zg-eyebrow">FEITO PARA A SUA HISTÓRIA</span><h2>{isAlbum ? 'O seu olhar começa aqui.' : 'Cada detalhe tem seu lugar.'}</h2><p>{isAlbum ? 'Crie seu álbum no diagramador, com fotos, textos e layouts para cada lâmina. As áreas personalizáveis da capa seguem o material escolhido.' : 'Conheça os detalhes e escolha as opções disponíveis para esta peça.'}</p><CameraArt/></div></div>
   <div className="zg-configurator">
    <span className="zg-eyebrow">{product.category}{product.isDemo ? ' / MODELO CONCEITUAL' : ''}</span><h1>{product.name}</h1><p className="zg-detail-description">{product.description}</p><p className="zg-detail-price" key={String(displayedPrice)}>{hasPrice ? (selectedPrice===null&&hasPrice?'A partir de ':'')+money.format(displayedPrice! / 100) : 'Sob consulta'}{hasPrice && <span>por unidade</span>}</p>
    {product.isDemo && <p className="zg-product-notice">Explore este modelo conceitual. Opções e disponibilidade comercial serão confirmadas pela Zangraf.</p>}
    {savedItemId ? <div className="zg-config-saved" role="status"><CheckCircle2 size={30} strokeWidth={1.4}/><h2>{isAlbum ? 'Sua próxima história começou.' : 'Tudo certo com sua escolha.'}</h2><p>A configuração foi guardada no carrinho.</p>{canDiagram && <Link className="button zg-button" href={'/diagramador?item=' + encodeURIComponent(savedItemId)}>Personalizar meu álbum <ArrowUpRight size={17}/></Link>}<Link className={canDiagram ? 'zg-quiet-link' : 'button zg-button'} href="/carrinho">Ver carrinho <ArrowRight size={17}/></Link></div> : <>
     <div className="zg-config-progress"><span>{String(step + 1).padStart(2, '0')} / {String(steps.length + 1).padStart(2, '0')}</span><ol aria-label="Etapas de personalização">{[...steps.map(item => item.label), 'Revisar'].map((label, index) => <li key={label} className={index <= step ? 'active' : ''} aria-current={index === step ? 'step' : undefined}><span className="sr-only">{label}</span></li>)}</ol><span>{review ? 'Revisar' : current.label}</span></div>
     <div className="zg-config-step" key={review ? 'review' : current.key}><h2 ref={heading} tabIndex={-1}>{review ? 'Tudo do seu jeito?' : current.title}</h2>
      {review ? <dl className="zg-config-review">{fields.map(item => <div key={item.key}><dt>{item.label}</dt><dd>{values[item.key]}{item.options.length>1&&<button type="button" onClick={() => setStep(steps.findIndex(step=>step.key===item.key))} aria-label={'Alterar ' + item.label}>Alterar</button>}</dd></div>)}</dl> : <div className={'zg-config-options ' + (current.key === 'size' ? 'formats' : '')}>{current.options.map((option, optionIndex) => {
       const size = current.key === 'size' ? physicalSizes.find(item => item.label === option) : null;
       return <button type="button" key={option} style={{'--i': Math.min(optionIndex, 14)} as CSSProperties} className={values[current.key] === option ? 'selected' : ''} aria-pressed={values[current.key] === option} onClick={() => setValues(previous => ({...previous, [current.key]: option}))}>{size && <span className="zg-format-outline" style={{aspectRatio: size.widthMm / size.heightMm}} aria-hidden="true"/>}<span>{option}</span>{values[current.key] === option && <Check size={15}/>}</button>;
      })}</div>}
      {current?.key === 'sheets' && <p className="zg-config-help"><Layers size={14}/> De 10 a {Number.parseInt(productSheetOptions(product).at(-1)||'60',10)} lâminas, de 5 em 5. Cada lâmina corresponde a duas páginas.</p>}
      {current?.key === 'stock' && <p className="zg-config-help"><Layers size={14}/> 500 g: 0,6 mm por lâmina · 800 g: 1 mm por lâmina. As medidas da capa já estão definidas para a combinação escolhida.</p>}
      {current?.key === 'size' && physicalSizes.length > 0 && <p className="zg-config-help"><Ruler size={14}/> Medidas do álbum fechado, em centímetros.</p>}
     </div>
     <div className="zg-selection-summary"><span>SUA ESCOLHA ATÉ AQUI</span><p key={Object.values(values).join('|')}>{Object.values(values).filter(Boolean).join(' · ') || 'Escolha as opções para personalizar seu produto.'}</p><strong>{hasPrice ? (selectedPrice===null&&hasPrice?'A partir de ':'')+money.format(displayedPrice! / 100) : 'Valor sob consulta'}</strong></div>
     {priceBreakdown&&<dl className="zg-price-breakdown"><div><dt>Encadernado</dt><dd>{money.format(priceBreakdown.bindingCents/100)}</dd></div><div><dt>{priceBreakdown.sheets} lâminas × {money.format(priceBreakdown.sheetCents/100)}</dt><dd>{money.format(priceBreakdown.sheets*priceBreakdown.sheetCents/100)}</dd></div><div><dt>Seu álbum</dt><dd>{money.format(priceBreakdown.totalCents/100)}</dd></div></dl>}
     {review && chosenVariant && <div className="zg-print-summary"><strong>Seu álbum já abre no tamanho certo</strong><p>{chosenVariant.sheets} lâminas · {chosenVariant.sheets * 2} páginas · {chosenVariant.stock}</p><dl><div><dt>{coverLabel(chosenModel?.coverMode)}</dt><dd>{chosenModel?.coverMode==='none'?'Personalização somente do miolo':specLabel(chosenVariant.front,true)}</dd></div><div><dt>{chosenModel?.insideMode === 'spread' ? 'Cada lâmina aberta' : 'Cada página'}</dt><dd>{specLabel(chosenVariant.page, true, chosenModel?.insideMode === 'spread')}</dd></div></dl>{chosenModel?.coverMode!=='none'&&<p>{coverMarginDescription(chosenModel?.coverMargins)}</p>}<small>Medidas dos JPGs, com as sobras de corte incluídas. Você não precisará escolher medidas no editor.</small></div>}
     {error && <p role="alert" className="zg-config-error">{error}</p>}
     <div className="zg-config-actions">{step > 0 ? <button type="button" className="back" onClick={() => setStep(value => value - 1)}><ArrowLeft size={15}/> Voltar</button> : <Link className="back" href={categoryHref}><ArrowLeft size={15}/> Coleção</Link>}<button type="button" className="button zg-button" disabled={review ? (isAlbum && !canDiagram) : !values[current.key]} onClick={() => review ? save(canDiagram) : setStep(value => value + 1)}>{review ? (isAlbum ? (canDiagram ? 'Começar diagramação' : 'Diagramação indisponível') : 'Adicionar ao carrinho') : 'Continuar'}<ArrowRight size={16}/></button></div>
     {review && canDiagram && <button type="button" className="zg-save-for-later" onClick={() => save(false)}>Guardar no carrinho para criar depois</button>}
     {review && isAlbum && !canDiagram && <p className="zg-config-help">As medidas de impressão desta combinação ainda precisam ser cadastradas pela Zangraf. Escolha outro modelo ou fale com a equipe para confirmar as medidas. Este álbum não será enviado ao carrinho sem a opção de diagramação.</p>}
    </>}
   </div>
  </div>
 </section>;
}
