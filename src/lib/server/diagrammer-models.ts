import 'server-only';
import initialModels from '@/lib/diagrammer-models-initial.json';
import {databaseConfigured,getDatabase} from './db';
import {parsePrintModel,type PrintModel} from '@/lib/diagrammer-models';
export async function getPrintModels():Promise<PrintModel[]>{
 if(!databaseConfigured())return initialModels.map(parsePrintModel);
 const result=await getDatabase().query("SELECT data FROM zangraf_settings WHERE key LIKE 'diagrammer-model:%' ORDER BY updated_at DESC");
 return result.rows.map(row=>parsePrintModel(row.data));
}
