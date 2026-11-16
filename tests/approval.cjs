const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {cleanText,validatePages,statusAfterComment,whatsappShareUrl,MAX_APPROVAL_PAGES}=load('src/lib/approval.ts');

test('Limpa textos do cliente: espaços, caracteres de controle e tamanho',()=>{
 assert.equal(cleanText('  Ana \u0007 e   Pedro  ',60),'Ana e Pedro');
 assert.equal(cleanText('a\n\n\n\nb',60),'a\n\nb');
 assert.equal(cleanText('x'.repeat(100),10).length,10);
 assert.equal(cleanText(42,10),'');
});

test('Aceita a lista de lâminas do projeto e recusa listas inválidas',()=>{
 assert.deepEqual(validatePages([{index:-1,label:'Capa'},{index:0,label:'Lâmina 1'},{index:-2,label:'Verso'}]).map(p=>p.index),[-1,0,-2]);
 for(const bad of [[],null,[{index:0,label:''}],[{index:0,label:'a'},{index:0,label:'b'}],[{index:-3,label:'x'}],[{index:1.5,label:'x'}],Array.from({length:MAX_APPROVAL_PAGES+1},(_,i)=>({index:i,label:'x'}))])
  assert.throws(()=>validatePages(bad));
});

test('Comentário muda "aguardando" para "pediu ajustes", sem desfazer uma aprovação',()=>{
 assert.equal(statusAfterComment('waiting'),'changes');
 assert.equal(statusAfterComment('changes'),'changes');
 assert.equal(statusAfterComment('approved'),'approved');
});

test('Mensagem pronta para o WhatsApp leva o link',()=>{
 const url=whatsappShareUrl('https://zangraf.com/aprovar/abc','Casamento');
 assert.ok(url.startsWith('https://wa.me/?text='));
 assert.match(decodeURIComponent(url),/Casamento.*https:\/\/zangraf\.com\/aprovar\/abc/);
});
