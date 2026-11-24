const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {photoLayouts,referenceLayouts}=load('src/lib/album-layouts.ts');
const p=load('src/lib/layout-projects.ts');const {applyThemeBackground,applyThemeCover,ALBUM_THEMES}=load('src/lib/album-themes.ts');const {slotForFocus}=load('src/lib/photo-focus.ts');
test('Album layouts: exact photo counts, valid bounds, no overlapping frames',()=>{let total=0;for(let n=1;n<=10;n++){const variants=photoLayouts(n);assert.ok(variants.length>=5);for(const layout of variants){total++;assert.equal(layout.frames.length,n);for(const [i,r] of layout.frames.entries()){assert.ok(r.w>0&&r.h>0&&r.x>=-.0001&&r.y>=-.0001&&r.x+r.w<=1.0001&&r.y+r.h<=1.0001,layout.id);for(const q of layout.frames.slice(i+1)){const intersection=Math.max(0,Math.min(r.x+r.w,q.x+q.w)-Math.max(r.x,q.x))*Math.max(0,Math.min(r.y+r.h,q.y+q.h)-Math.max(r.y,q.y));assert.ok(intersection<.000001,layout.id);}}}}assert.ok(total>=50,`catálogo com ${total} layouts`);});
test('Physical margins and gaps remain exact in millimeters for square and portrait albums',()=>{for(const widthMm of [240,300]){const spec={widthMm,heightMm:340,bleedMm:3,dpi:300,exportMode:'page'};const left=p.frameGeometry({x:0,y:0,w:.5,h:1},spec,true,{marginMm:10,gapMm:4}).trim;const right=p.frameGeometry({x:.5,y:0,w:.5,h:1},spec,true,{marginMm:10,gapMm:4}).trim;assert.equal(left.x,10);assert.equal(left.y,10);assert.ok(Math.abs(right.x-left.x-left.w-4)<.00001);assert.ok(Math.abs(widthMm*2-right.x-right.w-10)<.00001);}});
test('Themes only change backgrounds and the cover: never layouts, product choices, print sizes, sheet count or photographs',()=>{const original=p.createProject();original.configuration={size:'24 × 34 cm',sheets:'15 lâminas',stock:'800 g',cover:'Anti-Risco',finish:'Fosco'};original.spreads[0].slots[0].photoId='my-photo';original.spreads[0].slots[0].x=34;original.spreads[0].texts=[p.newAlbumText()];const before=structuredClone(original);for(const theme of ALBUM_THEMES){const next=applyThemeCover(applyThemeBackground(original,theme.id),theme.id,0);assert.equal(next.spreads.length,15);assert.equal(next.spreads[0].layout,original.spreads[0].layout);assert.deepEqual(next.spreads[0].frames,original.spreads[0].frames);assert.equal(next.spreads[0].background,theme.page.color);assert.deepEqual(next.printSpec,original.printSpec);assert.deepEqual(next.configuration,original.configuration);assert.equal(next.spreads[0].slots[0].photoId,'my-photo');assert.equal(next.spreads[0].slots[0].x,34);assert.deepEqual(next.spreads[0].texts,original.spreads[0].texts);}assert.deepEqual(original,before);});
test('Subject focus centers an off-center face and clamps against photograph edges',()=>{const slot=p.emptySlot();const centered=slotForFocus(slot,4000,2000,200,200,{x:.7,y:.5});const crop=p.cropRectangle(4000,2000,200,200,centered);assert.equal(crop.x+crop.width/2,2800);const edge=slotForFocus(slot,4000,2000,200,200,{x:1,y:0});assert.equal(edge.x,100);assert.equal(edge.y,50);});
test('Spacing preserves full bleed at zero margin and stays positive for very narrow frames',()=>{const spec=p.defaultPrintSpec();const full=p.frameGeometry({x:0,y:0,w:1,h:1},spec,true,{marginMm:0,gapMm:0});assert.equal(full.image.x,-3);assert.equal(full.image.w,606);const small=p.frameGeometry({x:.1,y:.2,w:.005,h:.005},spec,true,{marginMm:20,gapMm:20});assert.ok(small.trim.w>0&&small.trim.h>0);});
test('Grain stays anchored to the same physical points when print bleed is added',()=>{const {drawTexture}=load('src/lib/album-decorations.ts');function points(bleed){const dots=[];const ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(x,y,w,h){if(x>=0&&x<480&&y>=0&&y<340)dots.push([x,y,w,h]);}};drawTexture(ctx,'grain',480,340,bleed);return dots;}assert.deepEqual(points(0),points(3));});
test('Saved layouts reject invalid texture, gap and icon values',()=>{const base=p.createSpread();assert.equal(p.isReusableSpread(base),true);assert.equal(p.isReusableSpread({...base,spacing:{marginMm:-1,gapMm:3}}),false);assert.equal(p.isReusableSpread({...base,texture:'invalid'}),false);assert.equal(p.isReusableSpread({...base,icons:[{id:'a',kind:'heart',x:10,y:10,sizeMm:20,rotation:Infinity,color:'#000000'}]}),false);});
test('Acrylic catalog uses one cover type and the corrected 22x30 print area',()=>{const {products,canonicalProductId}=load('src/lib/products.ts');const {parsePrintModel}=load('src/lib/diagrammer-models.ts');const models=require('../src/lib/diagrammer-models-initial.json');const acrylic=products.filter(p=>p.id.endsWith('-acrilico'));assert.equal(acrylic.length,8);assert.ok(!products.some(p=>p.id.endsWith('-sobreposto')));for(const item of acrylic){assert.equal(item.category,'Acrílico');assert.deepEqual(item.options.covers,['Acrílico']);const model=parsePrintModel(models.find(m=>m.productId===item.id));assert.equal(model.coverMargins.leftMm,15);if(item.id==='album-22x30-acrilico')for(const v of model.variants){assert.equal(v.front.widthMm,203);assert.equal(v.front.heightMm,305);assert.equal(v.page.widthMm,220);assert.equal(v.page.heightMm,300);}}assert.equal(canonicalProductId('album-22x30-acrilico-sobreposto'),'album-22x30-acrilico');});
test('Kits enforce album choices and require the same production file dimensions',()=>{const {products}=load('src/lib/products.ts');const {parseProduct}=load('src/lib/product-validation.ts');const {canonicalSelection,expectedPrintFiles}=load('src/lib/order-rules.ts');const {parsePrintModel,snapshotModel}=load('src/lib/diagrammer-models.ts');const source=products.find(p=>p.id==='album-24x34-antirrisco');const kit=parseProduct({...source,id:'kit-test',kind:'kit'});const model=parsePrintModel(require('../src/lib/diagrammer-models-initial.json').find(m=>m.productId===source.id));const variant=model.variants.find(v=>v.sheets===15&&v.stock==='800 g');const config={size:model.sizeLabel,sheets:'15 lâminas',stock:'800 g',cover:'Anti-Risco',finish:source.options.finishes[0]};assert.deepEqual(canonicalSelection(kit,config),config);assert.throws(()=>canonicalSelection(kit,{...config,sheets:'17 lâminas'}));const files=expectedPrintFiles(kit,config,snapshotModel(model,variant));assert.equal(files.length,16);assert.equal(files[0].filename,'Capa/capa-inteira.jpg');assert.equal(files[15].filename,'Lâminas/015.jpg');});

test('Reference mosaics maintain exact 2 mm gaps and shared outer margins across every neighboring frame',()=>{
 const near=(a,b)=>Math.abs(a-b)<1e-7;
 for(const widthMm of [150,240,300])for(let n=2;n<=10;n++)for(const layout of referenceLayouts(n))for(const marginMm of [0,12,30])for(const gapMm of [0,2,10]){
  const spec={widthMm,heightMm:300,bleedMm:3,dpi:300,exportMode:'spread'};
  const frames=layout.frames.map(r=>p.frameGeometry(r,spec,true,{marginMm,gapMm}).trim);
  assert.ok(near(Math.min(...frames.map(r=>r.x)),marginMm));
  assert.ok(near(Math.max(...frames.map(r=>r.x+r.w)),2*widthMm-marginMm));
  assert.ok(near(Math.min(...frames.map(r=>r.y)),marginMm));
  assert.ok(near(Math.max(...frames.map(r=>r.y+r.h)),300-marginMm));
  layout.frames.forEach((r,i)=>layout.frames.forEach((q,j)=>{
   if(near(r.x+r.w,q.x)&&Math.min(r.y+r.h,q.y+q.h)>Math.max(r.y,q.y)+1e-7)assert.ok(near(frames[j].x-frames[i].x-frames[i].w,gapMm),layout.id);
   if(near(r.y+r.h,q.y)&&Math.min(r.x+r.w,q.x+q.w)>Math.max(r.x,q.x)+1e-7)assert.ok(near(frames[j].y-frames[i].y-frames[i].h,gapMm),layout.id);
  }));
 }
});

test('Superfícies cobrem a área com sangria e são aceitas em layouts salvos',()=>{
 const {surfaceFit,SURFACES}=load('src/lib/album-decorations.ts');
 for(const s of SURFACES)for(const [w,h] of [[480,340],[600,300],[240,340],[900,300]]){
  const fit=surfaceFit(s.id,w,h,3);
  assert.ok(fit.w>=w+6-1e-9&&fit.h>=h+6-1e-9,`${s.id} cobre ${w}×${h}`);
  assert.ok(Math.abs(fit.w/fit.h-s.aspect)<1e-9,'mantém a proporção da imagem');
 }
 const spread=p.createSpread();
 assert.equal(p.isReusableSpread({...spread,surface:'marmore-negro'}),true);
 assert.equal(p.isReusableSpread({...spread,surface:'inexistente'}),false);
});

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {photoLayouts, rankLayoutsForPhotos} = load('src/lib/album-layouts.ts');
  test('Foto nova bem larga ganha um quadro largo, sem baixar a qualidade das outras', () => {
    const aspects = [.75, .75, 3];
    const sizes = [{width: 3000, height: 4000}, {width: 3000, height: 4000}, {width: 6000, height: 2000}];
    const best = rankLayoutsForPhotos(photoLayouts(3, 2), aspects, 2, {sizes, areaMm: {width: 600, height: 300}, dpi: 300, focus: 2})[0];
    const frame = best.layout.frames[best.order.indexOf(2)];
    assert.ok((frame.w * 2) / frame.h > 1.6, 'o quadro da foto larga precisa ser deitado');
    assert.equal(best.lowResolution, false);
  });
}
