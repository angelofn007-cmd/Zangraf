import 'server-only';
import {randomBytes, randomUUID} from 'node:crypto';
import {del, get, put} from '@vercel/blob';
import sharp from 'sharp';
import {getDatabase} from './db';
import {AdminError} from './admin-access';
import {APPROVAL_BUDGET_BYTES, APPROVAL_DAYS, MAX_COMMENTS, MAX_COMMENT_LENGTH, MAX_NAME_LENGTH, MAX_PREVIEW_BYTES, MAX_PREVIEW_SIDE, cleanText, encodePin, encodePhoto, statusAfterComment, validatePages, type ApprovalComment, type ApprovalStatus, type PhotoBox, type OwnerApproval, type PublicApproval} from '@/lib/approval';

type StoredPage={index:number;label:string;pathname:string|null;width:number;height:number;size:number;photos?:PhotoBox[]};
type ShareRow={id:string;token:string;user_id:string;project_id:string;album_name:string;version:number;pages:StoredPage[];bytes:string;status:ApprovalStatus;approved_by:string|null;approved_at:Date|null;expires_at:Date;updated_at:Date};

const expiresAt=()=>new Date(Date.now()+APPROVAL_DAYS*24*60*60*1000);
const blobPaths=(pages:StoredPage[])=>pages.map(p=>p.pathname).filter((p):p is string=>!!p);
async function removeBlobs(paths:string[]){if(paths.length)await del(paths).catch(()=>undefined);}

function toPublic(row:ShareRow,comments:ApprovalComment[]):PublicApproval{
 return {albumName:row.album_name,version:row.version,status:row.status,approvedBy:row.approved_by,approvedAt:row.approved_at?.toISOString()??null,expiresAt:row.expires_at.toISOString(),
  pages:row.pages.map(({index,label,width,height,photos})=>({index,label,width,height,photos:photos||[]})),comments};
}
async function commentsOf(shareId:string):Promise<ApprovalComment[]>{
 const result=await getDatabase().query('SELECT id,version,page,author,body,created_at FROM zangraf_album_comments WHERE share_id=$1 ORDER BY created_at',[shareId]);
 return result.rows.map(r=>({id:r.id,version:r.version,page:r.page,author:r.author,body:r.body,createdAt:r.created_at.toISOString()}));
}

/** Apaga links vencidos e as prévias deles. Chamado de vez em quando, ao criar versões. */
export async function purgeExpiredApprovals(){
 const expired=await getDatabase().query<ShareRow>('DELETE FROM zangraf_album_shares WHERE id IN (SELECT id FROM zangraf_album_shares WHERE expires_at<now() LIMIT 20) RETURNING pages');
 await removeBlobs(expired.rows.flatMap(row=>blobPaths(row.pages)));
}

export async function ownerApproval(userId:string,projectId:string):Promise<OwnerApproval|null>{
 const found=await getDatabase().query<ShareRow>('SELECT * FROM zangraf_album_shares WHERE user_id=$1 AND project_id=$2 AND expires_at>now()',[userId,projectId]);
 const row=found.rows[0];if(!row)return null;
 return {...toPublic(row,await commentsOf(row.id)),id:row.id,token:row.token,updatedAt:row.updated_at.toISOString()};
}

/**
 * Começa uma versão nova. O link continua o mesmo; as prévias da versão anterior são apagadas
 * e os comentários antigos ficam guardados com o número da versão.
 */
export async function startApprovalVersion(userId:string,body:Record<string,unknown>){
 const projectId=cleanText(body.projectId,80);const albumName=cleanText(body.albumName,100)||'Meu álbum';
 if(!projectId)throw new AdminError('Projeto inválido.',400);
 let pages;try{pages=validatePages(body.pages);}catch(error){throw new AdminError((error as Error).message,400);}
 await purgeExpiredApprovals().catch(()=>undefined);
 const stored:StoredPage[]=pages.map(p=>({...p,pathname:null,width:0,height:0,size:0}));
 const client=await getDatabase().connect();let old:StoredPage[]=[];let row:ShareRow;
 try{
  await client.query('BEGIN');
  const existing=await client.query<ShareRow>('SELECT * FROM zangraf_album_shares WHERE user_id=$1 AND project_id=$2 FOR UPDATE',[userId,projectId]);
  if(existing.rows[0]&&existing.rows[0].expires_at>new Date()){
   old=existing.rows[0].pages;
   row=(await client.query<ShareRow>(`UPDATE zangraf_album_shares SET album_name=$2,version=version+1,pages=$3,bytes=0,status='uploading',approved_by=NULL,approved_at=NULL,expires_at=$4,updated_at=now() WHERE id=$1 RETURNING *`,[existing.rows[0].id,albumName,JSON.stringify(stored),expiresAt()])).rows[0];
  }else{
   if(existing.rows[0]){old=existing.rows[0].pages;await client.query('DELETE FROM zangraf_album_shares WHERE id=$1',[existing.rows[0].id]);}
   row=(await client.query<ShareRow>('INSERT INTO zangraf_album_shares(id,token,user_id,project_id,album_name,pages,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[randomUUID(),randomBytes(24).toString('base64url'),userId,projectId,albumName,JSON.stringify(stored),expiresAt()])).rows[0];
  }
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 await removeBlobs(blobPaths(old));
 return {id:row.id,token:row.token,version:row.version};
}

/** Recebe a prévia JPG de uma lâmina da versão que está sendo enviada. */
export async function uploadApprovalPage(userId:string,shareId:string,position:number,bytes:Buffer){
 if(bytes.length<100||bytes.length>MAX_PREVIEW_BYTES)throw new AdminError('Prévia muito grande.',413);
 let meta;try{meta=await sharp(bytes,{limitInputPixels:20_000_000}).metadata();}catch{throw new AdminError('Prévia inválida.',400);}
 if(meta.format!=='jpeg'||!meta.width||!meta.height||meta.width>MAX_PREVIEW_SIDE||meta.height>MAX_PREVIEW_SIDE)throw new AdminError('Prévia inválida.',400);
 const client=await getDatabase().connect();let replaced:string|null=null;let pathname='';
 try{
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('zangraf-approval-budget'))");
  const found=await client.query<ShareRow>("SELECT * FROM zangraf_album_shares WHERE id::text=$1 AND user_id=$2 AND status='uploading' FOR UPDATE",[shareId,userId]);
  const row=found.rows[0];
  if(!row||!Number.isInteger(position)||position<0||position>=row.pages.length)throw new AdminError('Envio de prévia não autorizado.',404);
  const used=await client.query("SELECT COALESCE(sum(bytes),0)::text AS bytes FROM zangraf_album_shares");
  const previous=row.pages[position].size;
  if(Number(used.rows[0].bytes)-previous+bytes.length>APPROVAL_BUDGET_BYTES)throw new AdminError('O espaço para aprovações está cheio no momento. Tente mais tarde ou fale com a Zangraf.',507);
  pathname=`aprovacoes/${row.id}/v${row.version}/${position}-${randomUUID().slice(0,8)}.jpg`;
  await put(pathname,bytes,{access:'private',addRandomSuffix:false,contentType:'image/jpeg'});
  replaced=row.pages[position].pathname;
  const pages=row.pages.map((p,i)=>i===position?{...p,pathname,width:meta.width!,height:meta.height!,size:bytes.length}:p);
  await client.query('UPDATE zangraf_album_shares SET pages=$2,bytes=$3,updated_at=now() WHERE id=$1',[row.id,JSON.stringify(pages),Number(row.bytes)-previous+bytes.length]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');if(pathname)await removeBlobs([pathname]);throw error;}finally{client.release();}
 if(replaced)await removeBlobs([replaced]);
}

export async function publishApproval(userId:string,shareId:string){
 const found=await getDatabase().query<ShareRow>("SELECT * FROM zangraf_album_shares WHERE id::text=$1 AND user_id=$2",[shareId,userId]);
 const row=found.rows[0];if(!row)throw new AdminError('Aprovação não encontrada.',404);
 if(row.pages.some(p=>!p.pathname))throw new AdminError('Ainda faltam prévias de algumas lâminas. Envie novamente.',409);
 await getDatabase().query("UPDATE zangraf_album_shares SET status='waiting',updated_at=now() WHERE id=$1 AND status='uploading'",[row.id]);
}

async function publicRow(token:string){
 if(!/^[A-Za-z0-9_-]{20,64}$/.test(token))return null;
 const found=await getDatabase().query<ShareRow>("SELECT * FROM zangraf_album_shares WHERE token=$1 AND expires_at>now()",[token]);
 return found.rows[0]||null;
}

/** Álbum como o cliente vê. Enquanto uma versão nova está subindo, mostra o aviso de atualização. */
export async function publicApproval(token:string):Promise<PublicApproval|null>{
 const row=await publicRow(token);if(!row)return null;
 return toPublic(row,await commentsOf(row.id));
}

export async function publicApprovalImage(token:string,position:number){
 const row=await publicRow(token);
 if(!row||row.status==='uploading'||!Number.isInteger(position)||!row.pages[position]?.pathname)return null;
 const object=await get(row.pages[position].pathname!,{access:'private'});
 return object&&object.statusCode===200?object.stream:null;
}

/** Comentário ou aprovação do cliente final. */
export async function clientAction(token:string,body:Record<string,unknown>):Promise<PublicApproval>{
 const author=cleanText(body.name,MAX_NAME_LENGTH);
 if(!author)throw new AdminError('Escreva seu nome para continuar.',400);
 const client=await getDatabase().connect();
 try{
  await client.query('BEGIN');
  const found=await client.query<ShareRow>("SELECT * FROM zangraf_album_shares WHERE token=$1 AND expires_at>now() FOR UPDATE",[token]);
  const row=found.rows[0];
  if(!row)throw new AdminError('Este link não está mais disponível.',404);
  if(row.status==='uploading')throw new AdminError('O fotógrafo está enviando uma versão nova. Atualize a página em alguns minutos.',409);
  if(body.action==='approve'){
   if(Number(body.version)!==row.version)throw new AdminError('Há uma versão mais nova deste álbum. Atualize a página antes de aprovar.',409);
   if(row.status!=='approved')await client.query("UPDATE zangraf_album_shares SET status='approved',approved_by=$2,approved_at=now(),updated_at=now() WHERE id=$1",[row.id,author]);
  }else if(body.action==='comment'){
   const like=body.like===true;
   const note=cleanText(body.body,MAX_COMMENT_LENGTH).replace(/^@(like|pin:)/,'');
   if(!like&&!note)throw new AdminError('Escreva o comentário antes de enviar.',400);
   if(!Number.isInteger(body.page)||!row.pages.some(p=>p.index===body.page))throw new AdminError('Lâmina inválida.',400);
   // Pedido sobre uma foto numerada da lâmina (1 a 10): o número precisa existir nessa lâmina.
   const photos=row.pages.find(p=>p.index===body.page)?.photos?.length||0;
   const photo=Number.isInteger(body.photo)&&Number(body.photo)>=1&&Number(body.photo)<=photos?encodePhoto(body.photo):'';
   const text=like?('@like '+note).trim():(photo||encodePin(body.pin))+note;
   const count=await client.query('SELECT count(*)::int AS n FROM zangraf_album_comments WHERE share_id=$1',[row.id]);
   if(count.rows[0].n>=MAX_COMMENTS)throw new AdminError('Este álbum já recebeu o máximo de comentários. Fale direto com o fotógrafo.',429);
   await client.query('INSERT INTO zangraf_album_comments(id,share_id,version,page,author,body) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),row.id,row.version,body.page,author,text]);
   const next=like?row.status:statusAfterComment(row.status);
   if(next!==row.status)await client.query('UPDATE zangraf_album_shares SET status=$2,updated_at=now() WHERE id=$1',[row.id,next]);
  }else throw new AdminError('Ação inválida.',400);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 return (await publicApproval(token))!;
}

/** O fotógrafo encerra o link antes do prazo. */
export async function deleteApproval(userId:string,shareId:string){
 const removed=await getDatabase().query<ShareRow>('DELETE FROM zangraf_album_shares WHERE id::text=$1 AND user_id=$2 RETURNING pages',[shareId,userId]);
 await removeBlobs(removed.rows.flatMap(row=>blobPaths(row.pages)));
}
