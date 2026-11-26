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
 // Mantém a ordem da história (só a foto que abre cada momento pode ter sido adiantada).
 const moments=[...new Set(photos.map(p=>momentOf(p.id)))];
 assert.deepEqual(moments,[...new Set(all.map(momentOf))]);
 for(const m of moments){
  const used=all.filter(id=>momentOf(id)===m),original=photos.map(p=>p.id).filter(id=>momentOf(id)===m);
  assert.deepEqual(used.slice(1),original.filter(id=>id!==used[0]));
 }
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

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {pickLayout} = load('src/lib/auto-album.ts');
  test('Montagem automática: 1 foto na lâmina inteira, 2 meio a meio, 3+ cobrindo a lâmina', () => {
    assert.equal(pickLayout([.75], 2.8).layout.id, 'full-1');
    assert.equal(pickLayout([.75, 1.5], 2.8).layout.id, 'pages-2');
    const three = pickLayout([.75, 1.5, 1], 2.8).layout;
    assert.ok(Math.abs(three.frames.reduce((s, f) => s + f.w * f.h, 0) - 1) < 1e-6);
  });
}

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {trimBursts, planAlbum, pickLayout} = load('src/lib/auto-album.ts');
  const T = Date.UTC(2026, 4, 10, 15, 0, 0), SEC = 1000, MIN = 60 * SEC;

  test('Fotos demais: descarta primeiro as repetidas de rajada, ficando a melhor de cada uma', () => {
    const photos = [
      {id: 'a1', aspect: 1.5, takenAt: T, pixels: 1e6},
      {id: 'a2', aspect: 1.5, takenAt: T + SEC, pixels: 12e6},
      {id: 'a3', aspect: 1.5, takenAt: T + 2 * SEC, pixels: 1e6},
      {id: 'b', aspect: 1.5, takenAt: T + 5 * MIN, pixels: 1e6},
      {id: 'c', aspect: 1.5, takenAt: T + 10 * MIN, pixels: 1e6},
    ];
    assert.deepEqual(trimBursts(photos, 3).map(p => p.id), ['a2', 'b', 'c']);
    assert.deepEqual(trimBursts(photos, 4).map(p => p.id).length, 4);
    assert.equal(trimBursts(photos, 10).length, 5, 'cabendo, não descarta nada');
  });

  test('A foto que abre o momento sozinha é a de formato mais próximo da lâmina', () => {
    const photos = Array.from({length: 30}, (_, i) => ({id: 'p' + i, aspect: i === 2 ? 1.5 : 2 / 3, takenAt: T + i * MIN}));
    const plan = planAlbum(photos, 6);
    assert.deepEqual(plan.groups[0], ['p2']);
    assert.equal(new Set(plan.groups.flat()).size, 30);
  });

  test('Uma foto sozinha ocupa sempre a lâmina inteira, mesmo com pouca resolução', () => {
    const area = {width: 600, height: 300};
    for (const [aspect, px] of [[1.5, 9000], [1.5, 4500], [2/3, 4000], [2/3, 1200], [1, 2000]]) {
      const fit = pickLayout([aspect], 2, undefined, {sizes: [{width: px, height: Math.round(px / aspect)}], areaMm: area, dpi: 300});
      assert.equal(fit.layout.id, 'full-1', `${aspect} ${px}px`);
    }
  });

  test('Montagem automática prioriza a nitidez: foto única vai para quem aguenta a lâmina inteira', () => {
    const {autoLayoutProject, keepQuality} = load('src/lib/auto-album.ts');
    const {createProject, defaultPrintSpec, spreadRectangles} = load('src/lib/layout-projects.ts');
    // Troca simples: a vertical sozinha (sem nitidez) troca de lugar com a horizontal da dupla vizinha.
    const low = ids => ids.length === 1 && ids[0].startsWith('V');
    assert.deepEqual(keepQuality([['V1'], ['V2', 'H1']], low, ['V1', 'V2', 'H1']), [['H1'], ['V1', 'V2']]);
    // Álbum de 55 lâminas, páginas 24,3 × 34,6 cm, 80 fotos de câmera (2 verticais para cada horizontal).
    const spec = {...defaultPrintSpec(), widthMm: 243, heightMm: 346, dpi: 300};
    const p = createProject();
    p.spreads = Array.from({length: 55}, (_, i) => ({...p.spreads[0], id: 's' + i}));
    p.photos = Array.from({length: 80}, (_, i) => { const v = i % 3 !== 2; return {id: 'f' + i, name: `DSC_${1000 + i}.jpg`, blob: null, width: v ? 4000 : 6000, height: v ? 6000 : 4000}; });
    const taken = {}; p.photos.forEach((f, i) => { taken[f.id] = Date.UTC(2026, 0, 1, 10) + i * 90000 * (i % 7 === 0 ? 40 : 1); });
    const result = autoLayoutProject(p, taken, spec);
    const size = new Map(p.photos.map(f => [f.id, f]));
    let blurry = 0;
    for (const spread of result.project.spreads) {
      const rects = spreadRectangles(spread);
      spread.slots.forEach((slot, k) => { if (!slot.photoId) return; const f = size.get(slot.photoId), r = rects[k];
        if (25.4 * Math.min(f.width / (r.w * 486), f.height / (r.h * 346)) < 225) blurry++; });
    }
    assert.ok(blurry <= 5, `${blurry} fotos abaixo de 225 dpi (antes eram 19)`);
  });

  test('Layouts de uma página só ficam no fim da lista de uma foto', () => {
    const {photoLayouts, fillsBothPages} = load('src/lib/album-layouts.ts');
    const list = photoLayouts(1, 1.4);
    assert.equal(list[0].id, 'full-1');
    const firstSingle = list.findIndex(l => !fillsBothPages(l));
    assert.ok(list.slice(firstSingle).every(l => !fillsBothPages(l)), list.map(l => l.id).join(','));
  });

  test('Duas fotos ficam sempre uma em cada página inteira, mesmo com pouca resolução', () => {
    const area = {width: 600, height: 300};
    for (const px of [9000, 3000, 1800]) for (const aspect of [1.5, 2/3]) {
      const fit = pickLayout([aspect, aspect], 2, undefined, {sizes: [{width: px, height: Math.round(px / aspect)}, {width: px, height: Math.round(px / aspect)}], areaMm: area, dpi: 300});
      assert.equal(fit.layout.id, 'pages-2', `${aspect} ${px}px`);
    }
  });

  test('Montagem automática nunca deixa uma página da lâmina em branco', () => {
    const {fillsBothPages} = load('src/lib/auto-album.ts');
    const area = {width: 600, height: 300};
    // Fotos com pouca resolução para ocupar uma página inteira: antes caíam em "Dupla na direita"/"Página direita".
    for (const count of [1, 2, 3, 4, 5, 6]) for (const aspect of [1.5, 2/3, 1]) for (const px of [9000, 3000, 1800, 1200]) {
      const fit = pickLayout(Array(count).fill(aspect), 2, undefined, {sizes: Array(count).fill({width: px, height: Math.round(px / aspect)}), areaMm: area, dpi: 300});
      assert.ok(fit && fillsBothPages(fit.layout), `${count} foto(s) ${aspect} ${px}px → ${fit && fit.layout.id}`);
    }
  });
}

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {dateFromName, orderPhotos} = load('src/lib/auto-album.ts');
  const {groupFocus} = load('src/lib/photo-focus.ts');
  const T = Date.UTC(2026, 4, 10, 15, 30, 0), MIN = 60 * 1000;

  test('Lê data e hora do nome do arquivo só quando estão completas', () => {
    for (const name of ['IMG_20260510_153000.jpg', 'PXL_20260510_153000123.jpg', 'Screenshot_2026-05-10-15-30-00.png', '20260510_153000.jpg', 'Screenshot 2026-05-10 at 15.30.00.png'])
      assert.equal(dateFromName(name), T, name);
    for (const name of ['IMG-20260510-WA0001.jpg', 'IMG_1234.jpg', 'foto.jpg', 'IMG_20261310_153000.jpg', undefined])
      assert.equal(dateFromName(name), undefined, String(name));
  });

  test('Foto sem data entra ao lado da vizinha de numeração da mesma câmera', () => {
    const ordered = orderPhotos([
      {id: 'semData', aspect: 1, name: 'IMG_1002.JPG'},
      {id: 'a', aspect: 1, name: 'IMG_1001.JPG', takenAt: T},
      {id: 'b', aspect: 1, name: 'IMG_1003.JPG', takenAt: T + MIN},
      {id: 'antes', aspect: 1, name: 'IMG_0999.JPG'},
      {id: 'outra', aspect: 1, name: 'DSC_0001.JPG'},
    ]);
    assert.deepEqual(ordered.map(p => p.id), ['antes', 'a', 'semData', 'b', 'outra']);
    assert.equal(ordered.find(p => p.id === 'semData').takenAt, undefined, 'não inventa data');
  });

  test('Numeração que não acompanha as datas (duas câmeras): fotos sem data ficam no fim', () => {
    const ordered = orderPhotos([
      {id: 'x', aspect: 1, name: 'IMG_0500.JPG'},
      {id: 'a', aspect: 1, name: 'IMG_0900.JPG', takenAt: T},
      {id: 'b', aspect: 1, name: 'IMG_0100.JPG', takenAt: T + MIN},
    ]);
    assert.deepEqual(ordered.map(p => p.id), ['a', 'b', 'x']);
  });

  test('Recorte centraliza o casal, sem ser puxado por rostos pequenos ao fundo', () => {
    assert.deepEqual(groupFocus([{x: .3, y: .4, size: .02}, {x: .5, y: .5, size: .018}, {x: .9, y: .2, size: .002}]), {x: .4, y: .45});
    assert.deepEqual(groupFocus([{x: .2, y: .3}]), {x: .2, y: .3});
    assert.equal(groupFocus([]), undefined);
  });
}

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {interestMap, bestCropPosition} = load('src/lib/photo-saliency.ts');
  /** Foto vertical 30×60 de fundo branco com um "rosto" (bloco cor de pele) na altura `faceY`. */
  function portrait(faceY, background = [245, 245, 245]) {
    const w = 30, h = 60, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, skin = Math.abs(x - 15) < 5 && Math.abs(y - faceY) < 6;
      const [r, g, b] = skin ? [224, 172, 140] : background;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
    return interestMap(data, w, h);
  }

  test('Recorte sem detector de rostos: encontra o rosto e o põe no meio do quadro', () => {
    // Quadro horizontal: só 40% da altura da foto aparece.
    const top = bestCropPosition(portrait(8), 1, .4);
    assert.ok(top.y < 10, `rosto no alto: y=${top.y}`);
    const bottom = bestCropPosition(portrait(50), 1, .4);
    assert.ok(bottom.y > 80, `rosto embaixo: y=${bottom.y}`);
    const middle = bestCropPosition(portrait(30), 1, .4);
    assert.ok(Math.abs(middle.y - 50) < 10, `rosto no meio: y=${middle.y}`);
    // O rosto fica dentro do recorte, perto do centro dele.
    const visible = 24, start = top.y / 100 * (60 - visible);
    assert.ok(8 > start && 8 < start + visible);
  });

  test('Foto sem nada de interesse continua centralizada; foto que cabe inteira não mexe', () => {
    assert.deepEqual(bestCropPosition(portrait(-100), 1, .4), {x: 50, y: 50});
    assert.deepEqual(bestCropPosition(portrait(8), 1, 1), {x: 50, y: 50});
  });

  test('Pele escura e clara são reconhecidas; parede branca e amarela não', () => {
    // Um pixel da cor testada numa foto cinza (a cor ocupa pouco da foto, como um rosto).
    const one = rgb => {const data = new Uint8ClampedArray(100 * 4).fill(128); data.set([...rgb, 255], 0); for (let i = 3; i < data.length; i += 4) data[i] = 255; return interestMap(data, 10, 10).values[0];};
    const white = one([245, 245, 245]), yellow = one([230, 190, 50]);
    for (const [name, skin] of [['pele clara', [224, 172, 140]], ['pele escura', [120, 80, 60]]]) {
      assert.ok(one(skin) > white + 1, `${name} vale mais que branco`);
      assert.ok(one(skin) > yellow + 1, `${name} vale mais que amarelo`);
    }
  });
}

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {interestMap, autoFrame} = load('src/lib/photo-saliency.ts');
  const {emptySlot} = load('src/lib/layout-projects.ts');
  function portrait(faceY) {
    const w = 30, h = 60, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, skin = Math.abs(x - 15) < 5 && Math.abs(y - faceY) < 6;
      const [r, g, b] = skin ? [224, 172, 140] : [245, 245, 245];
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
    return interestMap(data, w, h);
  }
  test('Enquadramento automático: foto vertical em quadro horizontal mostra o rosto, sem ampliar', () => {
    const slot = {...emptySlot(), photoId: 'p'};
    const framed = autoFrame(slot, 3000, 6000, 300, 200, {map: portrait(8)});
    assert.equal(framed.auto, true); assert.equal(framed.zoom, 1); assert.equal(framed.x, 50);
    assert.ok(framed.y < 10, `y=${framed.y}`);
    // Rosto detectado pelo navegador tem prioridade e fica no centro.
    const face = autoFrame(slot, 3000, 6000, 300, 200, {face: {x: .5, y: .25}, map: portrait(50)});
    assert.ok(face.y < 25, `y=${face.y}`);
    // Foto que cabe inteira no quadro: fica como está (centro).
    assert.equal(autoFrame(slot, 3000, 2000, 300, 200, {map: portrait(8)}).y, 50);
  });
}

{
  const test = require('node:test'), assert = require('node:assert/strict'), load = require('./load-ts.cjs');
  const {interestMap, autoFrame, subjectFromFaces, subjectPoint} = load('src/lib/photo-saliency.ts');
  const {emptySlot} = load('src/lib/layout-projects.ts');

  test('Parede cor de pele não puxa o recorte (só um rosto pequeno conta como pele)', () => {
    // Foto horizontal toda bege com uma pessoa escura no meio: o recorte não deve fugir para a parede.
    const w = 60, h = 40, data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, person = Math.abs(x - 30) < 8;
      const [r, g, b] = person ? [40, 30, 60] : [205, 175, 140];
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
    const framed = autoFrame({...emptySlot(), photoId: 'p'}, 6000, 4000, 200, 300, {map: interestMap(data, w, h)});
    assert.ok(Math.abs(framed.x - 50) < 15, `x=${framed.x}`);
  });

  test('Com rosto detectado, a cabeça inteira (testa e cabelo) fica dentro e no centro do quadro', () => {
    // Foto 3:2, rosto no meio um pouco acima; quadro vertical (só ~44% da largura aparece).
    const faces = [{x: .5, y: .45, size: .02, box: {x: .45, y: .38, w: .1, h: .14}}, {x: .9, y: .2, size: .001, box: {x: .89, y: .19, w: .02, h: .02}}];
    const subject = subjectFromFaces(faces);
    assert.ok(subject.heads.y < .38 && subject.heads.h > .14, 'caixa inclui a testa e o cabelo');
    assert.ok(subject.heads.x + subject.heads.w < .7, 'rosto pequeno ao fundo não entra');
    const framed = autoFrame({...emptySlot(), photoId: 'p'}, 6000, 4000, 200, 300, subject);
    const visible = (4000 * 200 / 300) / 6000, left = framed.x / 100 * (1 - visible);
    assert.ok(left < subject.heads.x && left + visible > subject.heads.x + subject.heads.w, 'cabeça inteira no recorte');
    assert.ok(Math.abs(left + visible / 2 - .5) < .02, 'rosto no centro');
    assert.equal(framed.zoom, 1, 'sem ampliar (sem perder qualidade)');
  });

  test('Cabeças que não cabem no recorte: centraliza pelo menos o rosto', () => {
    const subject = {face: {x: .3, y: .5}, heads: {x: .1, y: .2, w: .8, h: .5}};
    const point = subjectPoint(subject, 6000, 4000, 200, 300);
    assert.equal(point.x, .3, 'largura: cabeças não cabem, fica no rosto');
    assert.equal(point.y, .5, 'altura: cabeça cabe e o rosto já fica no centro');
  });

  test('Centraliza exatamente no rosto, afastando só o mínimo para não cortar a cabeça', () => {
    // Quadro horizontal numa foto vertical: aparece 40% da altura. Rosto bem no alto da foto.
    const subject = {face: {x: .5, y: .2}, heads: {x: .4, y: .02, w: .2, h: .3}};
    const point = subjectPoint(subject, 4000, 6000, 300, 180);
    assert.equal(point.x, .5);
    // Centrado no rosto (y .2) o recorte ia de 0 a .4: a cabeça (0,02–0,32) já cabe, então fica no rosto.
    assert.ok(Math.abs(point.y - .2) < .01, `y=${point.y}`);
    const low = subjectPoint({face: {x: .5, y: .5}, heads: {x: .4, y: .2, w: .2, h: .35}}, 4000, 6000, 300, 200);
    const visible = (4000 * 200 / 300) / 6000;
    assert.ok(low.y - visible / 2 <= .2 + 1e-9, 'topo do cabelo dentro');
  });
}
