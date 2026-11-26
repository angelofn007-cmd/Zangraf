const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {pushHistory,restoreAlbum}=load('src/lib/album-history.ts');
const {createProject,emptySlot}=load('src/lib/layout-projects.ts');
const photo=id=>({id,name:id+'.jpg',blob:null,width:100,height:100});

test('Desfazer volta o álbum, mas não tira as fotos enviadas depois daquele passo', () => {
  const start=createProject(); // álbum vazio, sem fotos
  const now={...start,photos:[photo('a'),photo('b')],spreads:start.spreads.map((s,i)=>i?s:{...s,slots:[{...emptySlot(),photoId:'a'},emptySlot()]})};
  const back=restoreAlbum(start,now);
  assert.deepEqual(back.photos.map(p=>p.id),['a','b'],'fotos continuam na biblioteca');
  assert.equal(back.spreads[0].slots[0].photoId,null,'a foto sai do quadro (passo do álbum desfeito)');
});

test('Desfazer uma exclusão traz a foto de volta no lugar; refazer não apaga foto', () => {
  const before={...createProject(),photos:[photo('a'),photo('b'),photo('c')]};
  const after={...before,photos:[photo('a'),photo('c')]};
  assert.deepEqual(restoreAlbum(before,after).photos.map(p=>p.id),['a','b','c']);
  assert.deepEqual(restoreAlbum(after,before).photos.map(p=>p.id),['a','c','b']);
});

test('Histórico longo: o ponto de partida nunca é descartado', () => {
  let items=[];for(let i=0;i<200;i++)items=pushHistory(items,i,80);
  assert.equal(items.length,80);assert.equal(items[0],0,'primeiro passo fica');assert.equal(items[79],199);assert.equal(items[1],121);
});
