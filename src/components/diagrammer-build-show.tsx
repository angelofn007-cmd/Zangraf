'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {Check,Images,LayoutGrid,Printer,ScanEye,ScanFace,Scissors} from 'lucide-react';
import {ensureFont} from '@/lib/album-fonts';
import {playDoneSound} from '@/lib/sounds';

export type BuildStage='read'|'faces'|'layout'|'print'|'done';
type Box={x:number;y:number;w:number;h:number};
export type BuildSpread={frames:Box[];ids:(string|null)[]};
/** O que a montagem automática está fazendo agora (vem do próprio processo, não é fingido). */
export type BuildShowState={stage:BuildStage;/** Fotos na ordem em que a montagem passa por elas. */ids:string[];index:number;total:number;photoId?:string;aspect?:number;faces?:Box;spreads?:BuildSpread[];moments?:number;/** Quantas fotos tiveram rosto reconhecido até agora. */facesFound?:number};

/** Etapas nas cinco cores do logo. "Reconhecimento facial" acontece junto com "Rostos". */
const STEPS:{id:string;stage:BuildStage;label:string;icon:typeof Images;color:string;on?:string}[]=[
 {id:'read',stage:'read',label:'Fotos',icon:Images,color:'var(--zg-red)'},
 {id:'faces',stage:'faces',label:'Rostos',icon:ScanFace,color:'var(--zg-green)'},
 {id:'recognition',stage:'faces',label:'Reconhecimento facial',icon:ScanEye,color:'var(--zg-yellow)',on:'#2f2d12'},
 {id:'layout',stage:'layout',label:'Layouts',icon:LayoutGrid,color:'var(--zg-blue)'},
 {id:'print',stage:'print',label:'Impressão',icon:Printer,color:'var(--zg-magenta)'},
];
const FRAME_COLORS=['var(--zg-red)','var(--zg-green)','var(--zg-yellow)','var(--zg-blue)','var(--zg-magenta)','var(--zg-purple)'];
const ORDER:BuildStage[]=['read','faces','layout','print','done'];

/** Número fixo entre 0 e 1 para cada foto (posição e giro na mesa não mudam a cada quadro). */
function seed(id:string,salt=0){let h=2166136261^salt;for(let k=0;k<id.length;k++){h^=id.charCodeAt(k);h=Math.imul(h,16777619);}return ((h>>>0)%10007)/10007;}

function progressOf(state:BuildShowState){
 const part=state.total?Math.min(1,state.index/state.total):1;
 switch(state.stage){
  case 'read':return 2+part*10;
  case 'faces':return 12+part*62;
  case 'layout':return 80;
  case 'print':return 92;
  default:return 100;
 }
}

/** Lâmina aberta em miniatura, com os quadros do layout e as fotos encaixando. */
function MiniSpread({spread,urls,animate,className}:{spread:BuildSpread;urls:Record<string,string>;animate:boolean;className?:string}){
 return <div className={'dm-bs-spread '+(className||'')} data-animate={animate||undefined}>
  {spread.frames.map((f,i)=>{const id=spread.ids[i];return <span key={i} className="dm-bs-frame" style={{left:f.x*100+'%',top:f.y*100+'%',width:f.w*100+'%',height:f.h*100+'%','--c':FRAME_COLORS[i%FRAME_COLORS.length],'--d':`${i*90}ms`} as CSSProperties}>
   {id&&urls[id]&&<img src={urls[id]} alt="" draggable={false}/>}
  </span>;})}
  <i className="dm-bs-fold"/>
 </div>;
}

/**
 * Show da montagem automática: as fotos da pessoa caem na mesa, passam pelo reconhecimento de rostos,
 * viram layouts recortados e saem impressas numa impressora de quatro tintas.
 */
export function BuildShow({state,urls}:{state:BuildShowState;urls:Record<string,string>}){
 const [tick,setTick]=useState(0);
 useEffect(()=>{void ensureFont('Bebas Neue').catch(()=>{});},[]);
 useEffect(()=>{
  if(state.stage!=='layout'&&state.stage!=='print')return;
  const timer=window.setInterval(()=>setTick(t=>t+1),state.stage==='layout'?560:650);
  return()=>window.clearInterval(timer);
 },[state.stage]);
 // Som de "pronto" uma vez, quando a animação final começa.
 useEffect(()=>{if(state.stage==='done')playDoneSound();},[state.stage]);
 const stageIndex=ORDER.indexOf(state.stage);
 const progress=progressOf(state);
 const spreads=(state.spreads||[]).filter(s=>s.ids.some(Boolean));
 const text=state.stage==='read'?`Lendo datas e separando momentos · ${state.index} de ${state.total}`
  :state.stage==='faces'?`Reconhecendo rostos · ${state.index} de ${state.total}`
  :state.stage==='layout'?`Recortando e montando ${spreads.length} ${spreads.length===1?'lâmina':'lâminas'}${state.moments?` · ${state.moments} ${state.moments===1?'momento':'momentos'}`:''}`
  :state.stage==='print'?'Imprimindo em quatro cores'
  :'Seu álbum está pronto!';
 // Fotos que a montagem já processou (com prévia disponível).
 const seen=state.ids.slice(0,state.index).filter(id=>urls[id]);

 return <div className="dm-bs" role="status" aria-live="polite" aria-label={text} data-stage={state.stage}>
  <div className="dm-bs-card">
   <header className="dm-bs-head">
    <h2 aria-hidden="true">{[...'MONTANDO SEU ÁLBUM'].map((ch,k)=><b key={k} style={{'--k':k} as CSSProperties}>{ch===' '?' ':ch}</b>)}</h2>
    <ol className="dm-bs-steps">
     {STEPS.map(step=>{const Icon=step.icon,at=ORDER.indexOf(step.stage);const done=stageIndex>at,active=stageIndex===at;
      const recognition=step.id==='recognition';
      return <li key={step.id} data-step={step.id} data-done={done||undefined} data-active={active||undefined} style={{'--c':step.color,'--on':step.on||'#fff'} as CSSProperties}>
       <span>{done?<Check size={14} strokeWidth={3}/>:<Icon size={14}/>}</span>{step.label}
       {/* Cada rosto achado: o chip pisca junto com o foco travando na foto */}
       {recognition&&active&&state.faces&&<i key={state.photoId} className="dm-bs-ping" aria-hidden="true"/>}
      </li>;})}
    </ol>
   </header>

   <div className="dm-bs-scene">
    {state.stage==='read'&&<div className="dm-bs-table">
     {seen.slice(-16).map(id=><img key={id} className="dm-bs-toss" src={urls[id]} alt="" draggable={false}
      style={{'--x':`${8+seed(id,1)*72}%`,'--y':`${6+seed(id,2)*56}%`,'--r':`${(seed(id,3)-.5)*36}deg`,'--from':`${(seed(id,4)-.5)*240}px`} as CSSProperties}/>)}
     <span className="dm-bs-calendar"><b>{state.index}</b><small>fotos</small></span>
    </div>}

    {state.stage==='faces'&&<div className="dm-bs-faces">
     <div className="dm-bs-scan" style={{'--ar':state.aspect||1.5} as CSSProperties}>
      {state.photoId&&urls[state.photoId]&&<img key={state.photoId} src={urls[state.photoId]} alt="" draggable={false}/>}
      <span className="dm-bs-grid"/>
      <span className="dm-bs-beam"/>
      {state.faces&&<span key={'f'+state.photoId} className="dm-bs-face" style={{left:state.faces.x*100+'%',top:state.faces.y*100+'%',width:state.faces.w*100+'%',height:state.faces.h*100+'%'}}><i/><i/><i/><i/><em>ROSTO</em></span>}
     </div>
     <div className="dm-bs-film"><div style={{transform:`translateX(${-Math.max(0,state.index-7)*58}px)`}}>
      {seen.map(id=><img key={id} src={urls[id]} alt="" draggable={false} data-now={id===state.photoId||undefined}/>)}
     </div></div>
    </div>}

    {state.stage==='layout'&&spreads.length>0&&<div className="dm-bs-layout">
     <MiniSpread key={tick} spread={spreads[tick%spreads.length]} urls={urls} animate/>
     <span key={'cut'+tick} className="dm-bs-cut"><Scissors size={20}/></span>
     <div className="dm-bs-thumbs">{spreads.slice(0,8).map((s,i)=><MiniSpread key={i} spread={s} urls={urls} animate={false} className={i===tick%Math.min(8,spreads.length)?'is-now':''}/>)}</div>
    </div>}

    {state.stage==='print'&&<div className="dm-bs-print">
     <div className="dm-bs-printer">
      <span className="dm-bs-feed"/>
      <div className="dm-bs-body">
       <span className="dm-bs-carriage"><i/><i/><i/><i/></span>
       <span className="dm-bs-slot"/>
       <span className="dm-bs-led"/>
       <span className="dm-bs-inks"><i/><i/><i/><i/></span>
      </div>
      <div className="dm-bs-out">
       {spreads.length>0&&[0,1,2].map(back=>{const n=tick-back;if(n<0)return null;const spread=spreads[n%spreads.length];
        return <div key={n} className="dm-bs-sheet" data-back={back} style={{'--rot':`${(seed(String(n),5)-.5)*6}deg`} as CSSProperties}><MiniSpread spread={spread} urls={urls} animate={false}/></div>;})}
       <span key={'drops'+tick} className="dm-bs-drops"><i/><i/><i/><i/></span>
      </div>
     </div>
    </div>}

    {state.stage==='done'&&<div className="dm-bs-done">
     <span className="dm-bs-ring" style={{'--c':'#00aeef'} as CSSProperties}/><span className="dm-bs-ring" style={{'--c':'#ec008c','--d':'.12s'} as CSSProperties}/><span className="dm-bs-ring" style={{'--c':'#f5c400','--d':'.24s'} as CSSProperties}/>
     <span className="dm-bs-check"><Check size={46} strokeWidth={3}/></span>
     <strong>PRONTO!</strong>
    </div>}
   </div>

   <footer className="dm-bs-foot">
    <p key={state.stage}>{text}</p>
    <div className="dm-bs-bar"><i style={{width:progress+'%'}}/></div>
   </footer>
  </div>
 </div>;
}

