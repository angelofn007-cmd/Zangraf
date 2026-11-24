/** Regras da aprovação pelo cliente final, compartilhadas entre o navegador e o servidor. */

export type ApprovalStatus='uploading'|'waiting'|'changes'|'approved';
export type ApprovalPage={index:number;label:string;width:number;height:number};
export type ApprovalComment={id:string;version:number;page:number;author:string;body:string;createdAt:string};
/** O que o cliente final vê pelo link. */
export type PublicApproval={albumName:string;version:number;status:ApprovalStatus;approvedBy:string|null;approvedAt:string|null;expiresAt:string;pages:ApprovalPage[];comments:ApprovalComment[]};
/** O que o fotógrafo vê no Diagramador. */
export type OwnerApproval=PublicApproval&{id:string;token:string;updatedAt:string};

export const APPROVAL_DAYS=30;
export const APPROVAL_BUDGET_BYTES=150*1024*1024;
export const MAX_APPROVAL_PAGES=120;
export const MAX_PREVIEW_BYTES=1536*1024;
export const MAX_PREVIEW_SIDE=2400;
export const MAX_COMMENTS=400;
export const MAX_COMMENT_LENGTH=1000;
export const MAX_NAME_LENGTH=60;

export const STATUS_LABEL:Record<ApprovalStatus,string>={
 uploading:'Enviando prévias',
 waiting:'Aguardando o cliente',
 changes:'Cliente pediu ajustes',
 approved:'Aprovado pelo cliente',
};

/** Tira espaços extras e caracteres de controle; devolve vazio se não sobrar texto. */
export function cleanText(value:unknown,max:number):string{
 if(typeof value!=='string')return '';
 return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,max);
}

/** Valida as páginas enviadas pelo Diagramador ao criar uma versão. */
export function validatePages(value:unknown):{index:number;label:string}[]{
 if(!Array.isArray(value)||!value.length||value.length>MAX_APPROVAL_PAGES)throw new Error('Lista de lâminas inválida.');
 const seen=new Set<number>();
 return value.map(item=>{
  const page=item as {index?:unknown;label?:unknown};
  if(!Number.isInteger(page.index)||Number(page.index)<-2||Number(page.index)>=MAX_APPROVAL_PAGES||seen.has(Number(page.index)))throw new Error('Lista de lâminas inválida.');
  seen.add(Number(page.index));
  const label=cleanText(page.label,40);if(!label)throw new Error('Lista de lâminas inválida.');
  return {index:Number(page.index),label};
 });
}

/** Status depois de um comentário: um pedido de ajuste reabre um álbum que ainda não foi aprovado. */
export function statusAfterComment(status:ApprovalStatus):ApprovalStatus{
 return status==='waiting'?'changes':status;
}

/** Link de WhatsApp com a mensagem pronta para o cliente. */
export function whatsappShareUrl(link:string,albumName:string){
 const text=`Oi! Seu álbum "${albumName}" está pronto para você ver. Folheie, deixe comentários nas lâminas e aprove por aqui: ${link}`;
 return 'https://wa.me/?text='+encodeURIComponent(text);
}

/**
 * Comentários guardam marcações simples no começo do texto, sem mudar o banco:
 * "@like" = o cliente gostou da lâmina; "@pin:x,y " = ponto marcado na lâmina (0–1).
 */
export type ParsedComment={like:boolean;pin:{x:number;y:number}|null;text:string};
export function parseComment(body:string):ParsedComment{
 if(body.startsWith('@like'))return {like:true,pin:null,text:body.slice(5).trim()};
 const match=/^@pin:(0(?:\.\d+)?|1(?:\.0+)?),(0(?:\.\d+)?|1(?:\.0+)?) ?/.exec(body);
 if(match)return {like:false,pin:{x:Number(match[1]),y:Number(match[2])},text:body.slice(match[0].length)};
 return {like:false,pin:null,text:body};
}
export function encodePin(pin:unknown):string{
 const p=pin as {x?:unknown;y?:unknown}|null;
 if(!p||typeof p.x!=='number'||typeof p.y!=='number'||!(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))return '';
 return `@pin:${p.x.toFixed(3)},${p.y.toFixed(3)} `;
}

/** Link de e-mail com a mensagem pronta para o cliente. */
export function emailShareUrl(link:string,albumName:string,to=''){
 const subject=`Seu álbum "${albumName}" está pronto para aprovação`;
 const body=`Olá!\n\nSeu álbum "${albumName}" está pronto para você ver.\n\nAbra o link, folheie as lâminas, toque no que quiser mudar e deixe sua observação. Quando estiver tudo certo, é só aprovar:\n\n${link}\n\nNão precisa criar conta.`;
 return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
