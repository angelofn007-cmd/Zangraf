export function loginDestination(value:unknown):string {
 if(value==='admin')return '/admin';
 if(value==='pedido')return '/revisar-pedido';
 if(typeof value!=='string')return '/minha-conta';
 if(['/minha-conta','/revisar-pedido','/admin','/diagramador'].includes(value))return value;
 if(/^\/diagramador\?(?:(?:item|projeto)=[a-f0-9-]{36})(?:&(?:item|projeto)=[a-f0-9-]{36})?$/i.test(value))return value;
 return '/minha-conta';
}
