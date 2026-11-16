const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {readExifDate,orderPhotos,splitMoments,planAlbum,autoLayoutProject}=load('src/lib/auto-album.ts');
const {createProject,defaultPrintSpec}=load('src/lib/layout-projects.ts');

const MIN=60*1000;
const T0=Date.UTC(2026,4,10,15,0,0);

/** JPEG mínimo com um bloco EXIF contendo DateTimeOriginal. */
function jpegWithDate(date,little=true){
 const text=Buffer.from(date+'\0','ascii'); // 20 bytes
 const tiff=Buffer.alloc(8+2+12+4+2+12+4+text.length);
 const w16=(v,o)=>little?tiff.writeUInt16LE(v,o):tiff.writeUInt16BE(v,o);
 const w32=(v,o)=>little?tiff.writeUInt32LE(v,o):tiff.writeUInt32BE(v,o);
 tiff.write(little?'II':'MM',0,'ascii');w16(42,2);w32(8,4);
 // IFD0: só o ponteiro para o IFD EXIF
 w16(1,8);w16(0x8769,10);w16(4,12);w32(1,14);w32(26,18);w32(0,22);
 // IFD EXIF: DateTimeOriginal
 w16(1,26);w16(0x9003,28);w16(2,30);w32(text.length,32);w32(44,36);w32(0,40);
 text.copy(tiff,44);
 const app1=Buffer.concat([Buffer.from('Exif\0\0','ascii'),tiff]);
 const head=Buffer.from([0xFF,0xD8,0xFF,0xE1,(app1.length+2)>>8,(app1.length+2)&255]);
 const bytes=Buffer.concat([head,app1,Buffer.from([0xFF,0xD9])]);
 return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
}

test('Lê a data em que a foto foi tirada (EXIF, nos dois formatos de bytes)',()=>{
 assert.equal(readExifDate(jpegWithDate('2026:05:10 15:00:00')),T0);
 assert.equal(readExifDate(jpegWithDate('2026:05:10 15:00:00',false)),T0);
});

test('Arquivos sem EXIF ou que não são JPEG não quebram',()=>{
 assert.equal(readExifDate(new Uint8Array([0x89,0x50,0x4E,0x47]).buffer),undefined);
 assert.equal(readExifDate(new Uint8Array([0xFF,0xD8,0xFF,0xD9]).buffer),undefined);
 assert.equal(readExifDate(jpegWithDate('0000:00:00 00:00:00')),undefined);
 assert.equal(readExifDate(new ArrayBuffer(0)),undefined);
});

test('Ordena pela data e deixa as fotos sem data no fim, na ordem de importação',()=>{
 const ordered=orderPhotos([{id:'c',aspect:1,takenAt:T0+2*MIN},{id:'x',aspect:1},{id:'a',aspect:1,takenAt:T0},{id:'y',aspect:1},{id:'b',aspect:1,takenAt:T0+MIN}]);
 assert.deepEqual(ordered.map(p=>p.id),['a','b','c','x','y']);
});

test('Separa momentos quando passa mais de meia hora entre fotos',()=>{
 const at=minutes=>({id:String(minutes),aspect:1,takenAt:T0+minutes*MIN});
 const moments=splitMoments([at(0),at(5),at(10),at(90),at(95),at(300)]);
 assert.deepEqual(moments.map(m=>m.map(p=>p.id)),[['0','5','10'],['90','95'],['300']]);
});

function story(sizes){
 // Momentos com fotos a cada 2 minutos, separados por 2 horas.
 const photos=[];let clock=T0;
 sizes.forEach((size,m)=>{for(let i=0;i<size;i++){photos.push({id:`m${m}-${i}`,aspect:i%3?1.5:2/3,takenAt:clock});clock+=2*MIN;}clock+=2*60*MIN;});
 return photos;
}
const momentOf=id=>id.split('-')[0];

test('Usa todas as fotos uma vez, todas as lâminas, e não mistura momentos na mesma lâmina',()=>{
 const photos=story([30,10,40]);
 const plan=planAlbum(photos,20);
 assert.equal(plan.groups.length,20);assert.equal(plan.moments,3);assert.equal(plan.leftover,0);
 const all=plan.groups.flat();
 assert.equal(all.length,80);assert.equal(new Set(all).size,80);
 for(const group of plan.groups){
  assert.ok(group.length>=1&&group.length<=10,`lâmina com ${group.length} fotos`);
  assert.equal(new Set(group.map(momentOf)).size,1,'momentos misturados');
 }
 // Mantém a ordem da história.
 assert.deepEqual(all,photos.map(p=>p.id));
});

test('Poucas fotos: uma por lâmina e o resto fica vazio',()=>{
 const plan=planAlbum(story([3,2]),10);
 assert.deepEqual(plan.groups.map(g=>g.length),[1,1,1,1,1,0,0,0,0,0]);
});

test('Mais momentos que lâminas: junta os momentos menores',()=>{
 const plan=planAlbum(story([5,1,1,5,2]),3);
 assert.equal(plan.moments,3);
 assert.equal(plan.groups.flat().length,14);
});

test('Fotos demais: escolhe fotos espalhadas pela história toda, sem passar de 10 por lâmina',()=>{
 const photos=story([60,60]);
 const plan=planAlbum(photos,5);
 assert.equal(plan.leftover,70);
 assert.ok(plan.groups.every(g=>g.length<=10));
 const used=plan.groups.flat();
 assert.ok(used.some(id=>id.startsWith('m1-')),'o segundo momento também aparece');
});

test('Monta o projeto: cada lâmina com layout próprio, fotos da capa ficam fora do miolo',()=>{
 const project=createProject();
 project.photos=Array.from({length:40},(_,i)=>({id:'p'+i,name:`IMG_${i}.jpg`,blob:null,width:i%2?4000:3000,height:i%2?3000:4000}));
 project.cover.photo={...project.cover.photo,photoId:'p0'};
 project.spreads[0].texts=[{id:'t'}];
 const takenAt=Object.fromEntries(project.photos.map((p,i)=>[p.id,T0+i*MIN]));
 const {project:result,placed}=autoLayoutProject(project,takenAt,defaultPrintSpec());
 assert.equal(result.spreads.length,project.spreads.length);
 assert.equal(placed,39);
 const ids=result.spreads.flatMap(s=>s.slots.map(slot=>slot.photoId)).filter(Boolean);
 assert.ok(!ids.includes('p0'));assert.equal(new Set(ids).size,39);
 for(const spread of result.spreads){
  assert.equal(spread.layout,'livre');assert.equal(spread.frames.length,spread.slots.length);
 }
 assert.deepEqual(result.spreads[0].texts,[{id:'t'}],'textos da lâmina são mantidos');
});
