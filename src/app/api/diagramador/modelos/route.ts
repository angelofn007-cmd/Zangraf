import {usesAlbumLayout} from '@/lib/products';
import {getPrintModels} from '@/lib/server/diagrammer-models';
import {getDatabase,databaseConfigured} from '@/lib/server/db';
import {getSession,isAdmin} from '@/lib/server/auth';
import {getProducts,getProduct} from '@/lib/server/catalog';
import {AdminError,adminError,adminResponse,readAdminBody,requireAdmin} from '@/lib/server/admin-access';
import {parsePrintModel,type PrintModel} from '@/lib/diagrammer-models';
import {productSheetOptions} from '@/lib/album-options';

export async function GET(){
 try{
  const [models,products,session]=await Promise.all([getPrintModels(),getProducts(),getSession()]);
  const canManage=!!session&&await isAdmin(session.user.id);
  return adminResponse({models,products:products.filter(p=>usesAlbumLayout(p)),canManage,connected:databaseConfigured()});
 }catch(error){return adminError(error);}
}
export async function PUT(request:Request){
 try{
  const session=await requireAdmin(request);const body=await readAdminBody(request);
  let model:PrintModel;try{model=parsePrintModel(body);}catch(error){throw new AdminError((error as Error).message,400);}
  const product=await getProduct(model.productId);
  const size=product?.printSizes?.find(s=>s.label===model.sizeLabel);
  if(!product||!usesAlbumLayout(product)||!size)throw new AdminError('Escolha um álbum e um formato cadastrado no produto.',400);
  const quantities=productSheetOptions(product).map(label=>Number.parseInt(label,10));
  if(model.variants.some(variant=>!quantities.includes(variant.sheets)))throw new AdminError('As quantidades do modelo devem estar entre as opções permitidas no produto. Capas de 1500 gramas aceitam no máximo 40 lâminas.',400);
  // The inside trim must still match the product purchased in the catalog.
  if(model.variants.some(v=>v.page.widthMm!==size.widthMm||v.page.heightMm!==size.heightMm))throw new AdminError('As páginas do miolo devem corresponder ao tamanho final do produto. A largura da lâmina aberta é o dobro da largura da página.',400);
  const client=await getDatabase().connect();
  try{
   await client.query('BEGIN');await client.query("SELECT pg_advisory_xact_lock(hashtext('zangraf-diagrammer-models'))");
   const rows=await client.query("SELECT data FROM zangraf_settings WHERE key LIKE 'diagrammer-model:%'");const existing=rows.rows.map(row=>parsePrintModel(row.data));
   const previous=existing.find(m=>m.id===model.id);
   if((!previous&&model.version)||(previous&&previous.version!==model.version))throw new AdminError('Este modelo foi atualizado em outra aba. Reabra-o antes de salvar.',409);
   if(existing.some(m=>m.id!==model.id&&m.productId===model.productId&&m.sizeLabel===model.sizeLabel))throw new AdminError('Já existe um modelo para esse produto e formato. Edite o modelo existente.',409);
   model={...model,version:new Date().toISOString()};
   await client.query("INSERT INTO zangraf_settings(key,data,updated_by) VALUES($1,$2::jsonb,$3) ON CONFLICT(key) DO UPDATE SET data=EXCLUDED.data,updated_by=EXCLUDED.updated_by,updated_at=now()",['diagrammer-model:'+model.id,JSON.stringify(model),session.user.id]);
   await client.query("INSERT INTO zangraf_admin_audit(user_id,action,target_id) VALUES($1,'diagrammer-model-save',$2)",[session.user.id,model.id]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  return adminResponse({model});
 }catch(error){return adminError(error);}
}
export async function DELETE(request:Request){
 try{const session=await requireAdmin(request);const body=await readAdminBody(request);if(typeof body.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(body.id))throw new AdminError('Modelo inválido.',400);if(typeof body.version!=='string')throw new AdminError('Atualize a lista de modelos antes de remover.',409);const result=await getDatabase().query("DELETE FROM zangraf_settings WHERE key=$1 AND data->>'version'=$2 RETURNING key",['diagrammer-model:'+body.id,body.version]);if(!result.rowCount)throw new AdminError('O modelo mudou ou já foi removido. Atualize a lista.',409);return adminResponse({ok:true});}catch(error){return adminError(error);}
}
