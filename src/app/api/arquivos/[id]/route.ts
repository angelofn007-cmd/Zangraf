import {get} from '@vercel/blob';
import sharp from 'sharp';
import {getDatabase} from '@/lib/server/db';
import {requireAdmin,AdminError,adminError} from '@/lib/server/admin-access';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 try{
  await requireAdmin();
  const {id}=await context.params;
  if(!/^[a-f0-9-]{36}$/i.test(id))throw new AdminError('Arquivo não encontrado.',404);
  const preview=new URL(request.url).searchParams.get('previa')==='1';
  const result=await getDatabase().query(`SELECT f.pathname,f.filename,o.status,o.total_cents,
   COALESCE((SELECT SUM(amount_cents) FROM zangraf_receipts WHERE order_id=o.id),0)::text AS received
   FROM zangraf_order_files f JOIN zangraf_orders o ON o.id=f.order_id WHERE f.id=$1 AND f.verified`,[id]);
  const file=result.rows[0];
  if(!file)throw new AdminError('Arquivo não encontrado.',404);
  if(!preview&&(!['production','shipped'].includes(file.status)||file.total_cents===null||Number(file.received)<Number(file.total_cents)))throw new AdminError('O JPG de produção é liberado após pagamento integral e aprovação administrativa. Use a prévia para conferir.',409);
  const object=await get(file.pathname,{access:'private'});
  if(!object||object.statusCode!==200)throw new AdminError('Arquivo indisponível.',404);
  const headers={'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
  if(preview){
   const bytes=await new Response(object.stream).arrayBuffer();
   const thumbnail=await sharp(Buffer.from(bytes),{limitInputPixels:100_000_000}).resize({width:1400,height:1000,fit:'inside',withoutEnlargement:true}).jpeg({quality:70}).toBuffer();
   return new Response(new Uint8Array(thumbnail),{headers:{...headers,'Content-Disposition':'inline; filename="previa.jpg"'}});
  }
  return new Response(object.stream,{headers:{...headers,'Content-Disposition':`attachment; filename="${file.filename.split('/').at(-1)}"`}});
 }catch(error){return adminError(error)}
}
