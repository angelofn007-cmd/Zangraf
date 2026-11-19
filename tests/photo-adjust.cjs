const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {applyPhotoAdjust,photoFilterCss,photoWarmthLayer,isNeutralAdjust}=load('src/lib/photo-adjust.ts');

const pixel=(r,g,b)=>new Uint8ClampedArray([r,g,b,255]);

test('sem ajuste, a foto não muda e não gera filtro',()=>{
 const data=pixel(10,120,240);applyPhotoAdjust(data,undefined);
 assert.deepEqual([...data],[10,120,240,255]);
 assert.equal(photoFilterCss({effect:'original',brightness:0}),undefined);
 assert.ok(isNeutralAdjust({effect:'original'}));
});
test('preto e branco deixa os três canais iguais',()=>{
 const data=pixel(200,80,30);applyPhotoAdjust(data,{effect:'pb'});
 assert.equal(data[0],data[1]);assert.equal(data[1],data[2]);
 assert.match(photoFilterCss({effect:'pb'}),/grayscale\(1\)/);
});
test('brilho clareia e escurece, sem passar de 0–255',()=>{
 const light=pixel(100,100,100),dark=pixel(100,100,100),max=pixel(250,250,250);
 applyPhotoAdjust(light,{brightness:50});applyPhotoAdjust(dark,{brightness:-50});applyPhotoAdjust(max,{brightness:100});
 assert.ok(light[0]>100);assert.ok(dark[0]<100);assert.equal(max[0],255);
});
test('temperatura vira camada quente ou fria',()=>{
 assert.equal(photoWarmthLayer({warmth:60}).color,'#ff8a1f');
 assert.equal(photoWarmthLayer({warmth:-60}).color,'#1f7bff');
 assert.equal(photoWarmthLayer({warmth:0}),undefined);
});
