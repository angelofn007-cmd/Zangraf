import {getPrintModels} from '@/lib/server/diagrammer-models';
import {canonicalProductId} from '@/lib/products';
import {connection} from 'next/server';
import {notFound, redirect} from 'next/navigation';
import {getProduct} from '@/lib/server/catalog';
import {Configurator} from '@/components/configurator';

export async function generateMetadata({params}: {params: Promise<{id: string}>}) {
 await connection();
 const {id} = await params;
 return {title: (await getProduct(id))?.name || 'Produto não encontrado'};
}

export default async function ProductPage({params}: {params: Promise<{id: string}>}) {
 await connection();
 const {id} = await params;
 if(canonicalProductId(id)!==id)redirect('/albuns/'+canonicalProductId(id));
 const product = await getProduct(id);
 if (!product) notFound();
 if (!product.kind || product.kind === 'album') redirect('/albuns/' + product.id);
 const models=(await getPrintModels()).filter(model=>model.productId===product.id);
 return <Configurator key={id} product={product} models={models}/>;
}
