import {getDatabase} from '@/lib/server/db';
import {requireCustomer,RequestError,requestError,jsonPrivate,readBody} from '@/lib/server/customer-access';
export async function POST(request:Request){
 try{const session=await requireCustomer(request);const body=await readBody(request);if(typeof body.orderId!=='string'||!/^[-0-9a-f]{36}$/i.test(body.orderId))throw new RequestError('Pedido inválido.',400);
 const client=await getDatabase().connect();try{await client.query('BEGIN');const result=await client.query('SELECT status FROM zangraf_orders WHERE id=$1 AND user_id=$2 FOR UPDATE',[body.orderId,session.user.id]);if(!result.rowCount)throw new RequestError('Pedido não encontrado.',404);
 if(result.rows[0].status==='cancelled')throw new RequestError('Este pedido foi cancelado. Inicie um novo pedido.',409);
 if(result.rows[0].status!=='draft'){await client.query('COMMIT');return jsonPrivate({received:true,orderId:body.orderId});}
 const pending=await client.query('SELECT count(*)::int AS count FROM zangraf_order_files WHERE order_id=$1 AND NOT verified',[body.orderId]);if(pending.rows[0].count)throw new RequestError('Aguarde a conclusão de todos os arquivos antes de enviar.',409);
 await client.query("UPDATE zangraf_orders SET status='awaiting_payment',updated_at=now() WHERE id=$1",[body.orderId]);await client.query('COMMIT');return jsonPrivate({received:true,orderId:body.orderId});
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }catch(error){return requestError(error);}
}
