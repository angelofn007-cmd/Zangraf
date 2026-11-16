import {connection} from 'next/server';
import type {Metadata} from 'next';
import {databaseConfigured} from '@/lib/server/db';
import {publicApproval} from '@/lib/server/approvals';
import {ApprovalViewer} from '@/components/approval-viewer';
import '@/components/approval.css';

export const metadata: Metadata = {title: 'Aprovação do álbum', robots: {index: false, follow: false}};

export default async function Page({params}: {params: Promise<{token: string}>}) {
  await connection();
  const {token} = await params;
  const approval = databaseConfigured() ? await publicApproval(token).catch(() => null) : null;
  if (!approval) return <section className="ap-page ap-missing">
    <h1>Este link não está mais disponível</h1>
    <p>Os links de aprovação ficam no ar por 30 dias. Peça ao seu fotógrafo para enviar um link novo.</p>
  </section>;
  return <ApprovalViewer token={token} initial={approval}/>;
}
