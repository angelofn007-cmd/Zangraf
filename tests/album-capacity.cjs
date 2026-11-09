const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {checkAlbumCapacity,MAX_PROJECT_PHOTO_BYTES}=load('src/lib/album-capacity.ts');
test('Accepts 1000 photos and the exact 2 GiB boundary',()=>{
 assert.doesNotThrow(()=>checkAlbumCapacity([],Array.from({length:1000},()=>({size:1024*1024}))));
 assert.doesNotThrow(()=>checkAlbumCapacity([{size:MAX_PROJECT_PHOTO_BYTES-1}],[{size:1}]));
 assert.throws(()=>checkAlbumCapacity([{size:MAX_PROJECT_PHOTO_BYTES}],[{size:1}]),/2 GB/);
 assert.throws(()=>checkAlbumCapacity(Array.from({length:1000},()=>({size:1})),[{size:1}]),/1.000/);
});
test('Original and lightweight previews survive saving and reopening',async()=>{
 global.indexedDB=require('fake-indexeddb').indexedDB;
 const p=load('src/lib/layout-projects.ts');const project=p.createProject();
 project.photos=[{id:'photo',name:'original.jpg',blob:new Blob(['original']),preview:new Blob(['preview']),thumbnail:new Blob(['thumb'])}];
 await p.saveProject(project);const saved=await p.loadProject(project.id);
 assert.equal(await saved.photos[0].blob.text(),'original');
 assert.equal(await saved.photos[0].preview.text(),'preview');
 assert.equal(await saved.photos[0].thumbnail.text(),'thumb');
});
