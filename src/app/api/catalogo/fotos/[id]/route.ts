import {get} from '@vercel/blob';
// Only catalog photos are public; production files use a separate, protected route.
export async function GET(_request: Request, context: {params: Promise<{id:string}>}) {
  const {id} = await context.params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)) return new Response(null,{status:404});
  try {
    const file = await get(`catalogo-publico/${id}.webp`,{access:'private'});
    if (!file || file.statusCode !== 200) return new Response(null,{status:404});
    return new Response(file.stream,{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
  } catch { return new Response(null,{status:503}); }
}
