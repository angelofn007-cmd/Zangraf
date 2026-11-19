const test=require('node:test'),assert=require('node:assert/strict'),load=require('./load-ts.cjs');
const {isOwnerEmail,OWNER_EMAIL}=load('src/lib/admin-owner.ts');
test('Só o administrador principal é reconhecido como dono',()=>{
 assert.equal(OWNER_EMAIL,'angelofn007@gmail.com');
 assert.equal(isOwnerEmail('angelofn007@gmail.com'),true);
 assert.equal(isOwnerEmail('  Angelofn007@Gmail.com '),true); // ignora espaços e maiúsculas
 assert.equal(isOwnerEmail('outro@gmail.com'),false);
 assert.equal(isOwnerEmail(''),false);
 assert.equal(isOwnerEmail(undefined),false);
});
