const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {photoLayouts,rankLayoutsForPhotos}=load('src/lib/album-layouts.ts');
const {effectiveDpi,resolutionLevel,emptySlot}=load('src/lib/layout-projects.ts');

const SPREAD=2; // lâmina aberta 2:1
const PORTRAIT=2/3,LANDSCAPE=3/2;
const aspect=(rect)=>rect.w*SPREAD/rect.h;

test('Uma foto em pé recebe um quadro em pé',()=>{
 const [best]=rankLayoutsForPhotos(photoLayouts(1),[PORTRAIT],SPREAD);
 assert.ok(aspect(best.layout.frames[0])<1,`esperava quadro em pé, veio ${best.layout.name}`);
});

test('Uma foto deitada recebe um quadro deitado',()=>{
 const [best]=rankLayoutsForPhotos(photoLayouts(1),[LANDSCAPE],SPREAD);
 assert.ok(aspect(best.layout.frames[0])>1,`esperava quadro deitado, veio ${best.layout.name}`);
});

test('Cada foto vai para o quadro de formato mais parecido',()=>{
 const photos=[LANDSCAPE,PORTRAIT,LANDSCAPE];
 for(const fit of rankLayoutsForPhotos(photoLayouts(3),photos,SPREAD)){
  assert.deepEqual([...fit.order].sort(),[0,1,2],'cada foto aparece exatamente uma vez');
  const frames=fit.layout.frames.map(aspect);
  // O quadro mais "em pé" do layout fica com a única foto em pé.
  const tallest=frames.indexOf(Math.min(...frames));
  assert.equal(fit.order[tallest],1,`layout ${fit.layout.name}`);
 }
});

test('A lista fica ordenada do layout que mais combina para o que menos combina',()=>{
 const ranked=rankLayoutsForPhotos(photoLayouts(4),[PORTRAIT,PORTRAIT,PORTRAIT,PORTRAIT],SPREAD);
 assert.equal(ranked.length,photoLayouts(4).length);
 for(let i=1;i<ranked.length;i++)assert.ok(ranked[i-1].score<=ranked[i].score);
});

test('Fotos sem medidas conhecidas não quebram a escolha',()=>{
 const ranked=rankLayoutsForPhotos(photoLayouts(2),[NaN,0],SPREAD);
 assert.ok(ranked.length>0);
});

test('Resolução efetiva considera o tamanho impresso e o zoom',()=>{
 // 3000 px em 254 mm (10 pol) = 300 DPI
 const photo={width:3000,height:2000};
 assert.equal(Math.round(effectiveDpi(photo,254,254*2/3,emptySlot())),300);
 // Zoom 2× usa metade dos pixels: 150 DPI
 assert.equal(Math.round(effectiveDpi(photo,254,254*2/3,{...emptySlot(),zoom:2})),150);
 assert.equal(effectiveDpi({},254,100,emptySlot()),undefined);
});

test('Níveis de alerta de resolução',()=>{
 assert.equal(resolutionLevel(300,300),'ok');
 assert.equal(resolutionLevel(226,300),'ok');
 assert.equal(resolutionLevel(200,300),'limit');
 assert.equal(resolutionLevel(149,300),'low');
 assert.equal(resolutionLevel(undefined,300),'ok');
});

test('Álbum vertical não recebe layouts com tiras estreitas demais',()=>{
 const vertical=2*24/34;
 for(let n=2;n<=10;n++)for(const layout of photoLayouts(n,vertical))for(const f of layout.frames){
  const a=f.w*vertical/f.h;assert.ok(a>=.33&&a<=3.1,`${layout.id}: quadro ${a.toFixed(2)}`);
 }
});

test('Foto pequena não é recomendada para o quadro grande',()=>{
 // Uma foto grande (6000 px) e uma pequena (800 px): a pequena deve ir para o quadro menor.
 const layouts=photoLayouts(2,2).filter(l=>l.id.startsWith('hero-detail'));
 const [best]=rankLayoutsForPhotos(layouts,[1.5,1.5],2,{sizes:[{width:6000,height:4000},{width:800,height:533}],areaMm:{width:600,height:300},dpi:300});
 const big=best.layout.frames[0].w*best.layout.frames[0].h>=best.layout.frames[1].w*best.layout.frames[1].h?0:1;
 assert.equal(best.order[big],0,'a foto grande fica no quadro grande');
});
