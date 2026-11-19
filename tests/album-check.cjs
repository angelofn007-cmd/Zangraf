const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {checkAlbum,textBox}=load('src/lib/album-check.ts');
const {createProject,createSpread,emptySlot}=load('src/lib/layout-projects.ts');

const photo=(id,width=6000,height=4000,name=id+'.jpg')=>({id,name,blob:{size:width},width,height});
const slot=(photoId,extra={})=>({...emptySlot(),photoId,...extra});
const kinds=issues=>issues.map(i=>i.kind).sort();

/** Álbum de 1 lâmina 30×30 cm com duas fotos boas, uma em cada página. */
function album(){
 const project=createProject();
 project.photos=[photo('a'),photo('b')];
 project.spreads=[{...createSpread('dupla'),slots:[slot('a'),slot('b')]}];
 return project;
}

test('Álbum correto não tem problemas',()=>{
 assert.deepEqual(checkAlbum(album()),[]);
});

test('Foto pequena demais: borrada (erro) ou no limite (aviso), apontando lâmina e quadro',()=>{
 const project=album();
 project.photos=[photo('a',1200,1800),photo('b',2600,3900)];
 const issues=checkAlbum(project);
 const low=issues.find(i=>i.kind==='low-dpi'),limit=issues.find(i=>i.kind==='limit-dpi');
 assert.equal(low.level,'error');assert.equal(low.page,0);assert.equal(low.frame,0);
 assert.equal(limit.level,'warning');assert.equal(limit.frame,1);
});

test('Quadro vazio e lâmina em branco',()=>{
 const project=album();
 project.spreads[0].slots[1]=emptySlot();
 project.spreads.push(createSpread('dupla'));
 const issues=checkAlbum(project);
 assert.equal(issues.filter(i=>i.kind==='empty-frame').length,3);
 assert.ok(issues.some(i=>i.kind==='empty-spread'&&i.page===1));
});

test('Mesma foto usada duas vezes (ou o mesmo arquivo importado de novo) é apontada em cada repetição',()=>{
 const project=album();
 project.photos.push(photo('a2',6000,4000,'a.jpg'));
 project.spreads.push({...createSpread('dupla'),slots:[slot('a'),slot('a2')]});
 const dup=checkAlbum(project).filter(i=>i.kind==='duplicate');
 assert.equal(dup.length,2);
 assert.ok(dup.every(i=>i.page===1));
 assert.match(dup[0].detail,/Lâmina 1/);
});

test('Foto atravessando a dobra: aviso para conferir quando não se sabe dos rostos',()=>{
 const project=album();
 project.spreads=[{...createSpread('inteira'),slots:[slot('a')]}];
 assert.deepEqual(kinds(checkAlbum(project)),['fold-photo']);
});

test('Rosto no meio da foto que atravessa a dobra é erro; rosto do lado não é',()=>{
 const project=album();
 project.photos=[photo('a',8000,4000)]; // 2:1, ocupa a lâmina inteira sem recorte
 project.spreads=[{...createSpread('inteira'),slots:[slot('a')]}];
 assert.deepEqual(kinds(checkAlbum(project,()=>[{x:.5,y:.4}])),['fold-face']);
 assert.deepEqual(kinds(checkAlbum(project,()=>[{x:.2,y:.4}])),[]);
 // Espelhada, o rosto da direita continua fora da dobra.
 project.spreads[0].slots[0].flipX=true;
 assert.deepEqual(kinds(checkAlbum(project,()=>[{x:.8,y:.4}])),[]);
});

test('Texto encostado na borda é erro; texto atravessando a dobra é aviso',()=>{
 const base={id:'t',text:'Nossa história',width:30,fontSize:28,fontFamily:'Montserrat',color:'#000',bold:false,italic:false,align:'left'};
 const project=album();
 project.spreads[0].texts=[{...base,x:.5,y:40}];
 assert.deepEqual(kinds(checkAlbum(project)),['text-edge']);
 project.spreads[0].texts=[{...base,x:45,y:40,width:10,align:'left',text:'Para sempre nós dois juntos'}];
 assert.deepEqual(kinds(checkAlbum(project)),['text-fold']);
 project.spreads[0].texts=[{...base,x:10,y:40}];
 assert.deepEqual(kinds(checkAlbum(project)),[]);
});

test('Texto centralizado numa caixa larga é medido pelo que ocupa de verdade',()=>{
 const box=textBox({text:'Oi',x:0,y:0,width:100,fontSize:20,align:'center'},600,300);
 assert.ok(box.left>280&&box.right<320);
});

test('Caixa de texto mais alta centraliza o texto na vertical',()=>{
 const base={id:'t',text:'Oi',x:10,y:10,width:50,fontSize:20,fontFamily:'Arial',color:'#000',bold:false,italic:false,align:'left'};
 const short=textBox(base,300,300),tall=textBox({...base,height:40},300,300);
 assert.ok(tall.top>short.top,'o texto desce para o meio da caixa');
 assert.ok(Math.abs((tall.top-30)-(30+120-tall.bottom))<1e-6,'mesma folga em cima e embaixo');
});
