'use client';
import {useCallback, useEffect, useState} from 'react';
import {Check, Copy, Heart, Mail, MapPin, MessageCircle, RefreshCw, Send, Trash2} from 'lucide-react';
import {projectPageIndices, type LayoutProject} from '@/lib/layout-projects';
import {pageLabel} from '@/lib/album-check';
import {MAX_PREVIEW_BYTES, STATUS_LABEL, emailShareUrl, parseComment, whatsappShareUrl, type OwnerApproval} from '@/lib/approval';
import {renderPage} from './diagrammer-export';

const dateFormat = new Intl.DateTimeFormat('pt-BR', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});

async function previewJpeg(canvas: HTMLCanvasElement) {
  for (const quality of [.84, .7, .55]) {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_PREVIEW_BYTES) return blob;
  }
  throw new Error('Não foi possível gerar uma prévia leve desta lâmina.');
}
async function call(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Não foi possível falar com o servidor. Tente novamente.');
  return data;
}

/** Envio do álbum para o cliente final aprovar, e acompanhamento dos comentários. */
export function ApprovalPanel({project, busy, onGoToPage}: {project: LayoutProject; busy: boolean; onGoToPage: (index: number) => void}) {
  const [approval, setApproval] = useState<OwnerApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setApproval((await call(`/api/aprovacao?projeto=${encodeURIComponent(project.id)}`)).approval); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [project.id]);
  useEffect(() => { void load(); }, [load]);

  async function sendVersion() {
    if (approval && !window.confirm('Enviar uma versão nova para o cliente? O link continua o mesmo e os comentários anteriores ficam guardados.')) return;
    setError(''); setCopied(false);
    try {
      const indices = projectPageIndices(project);
      setProgress('Preparando o envio…');
      const created = await call('/api/aprovacao', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({projectId: project.id, albumName: project.name, pages: indices.map(index => ({index, label: pageLabel(project, index)}))})});
      for (const [position, index] of indices.entries()) {
        setProgress(`Enviando ${pageLabel(project, index).toLowerCase()} (${position + 1} de ${indices.length})…`);
        const canvas = await renderPage(project, index);
        const blob = await previewJpeg(canvas); canvas.width = 1; canvas.height = 1;
        await call(`/api/aprovacao/${created.id}/paginas/${position}`, {method: 'PUT', headers: {'Content-Type': 'image/jpeg'}, body: blob});
      }
      setProgress('Liberando o link…');
      await call(`/api/aprovacao/${created.id}/publicar`, {method: 'POST'});
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setProgress(''); }
  }
  async function remove() {
    if (!approval || !window.confirm('Encerrar este link? O cliente não vai mais conseguir abrir, e os comentários serão apagados.')) return;
    try { await call(`/api/aprovacao?id=${approval.id}`, {method: 'DELETE'}); setApproval(null); }
    catch (e) { setError((e as Error).message); }
  }

  const link = approval ? `${window.location.origin}/aprovar/${approval.token}` : '';
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt('Copie o link:', link); }
  }
  const current = approval?.comments.filter(c => c.version === approval.version) || [];
  const older = (approval?.comments.length || 0) - current.length;
  const working = !!progress;

  const likes = current.filter(c => parseComment(c.body).like).length;
  const changes = current.filter(c => !parseComment(c.body).like);

  return <div className="dm-approval">
    <div className="dm-approval-head">
      <h3>Aprovação do cliente</h3>
      {approval && <button type="button" className="dm-icon" aria-label="Atualizar comentários" title="Atualizar" disabled={loading || working} onClick={() => void load()}><RefreshCw size={15}/></button>}
    </div>
    {loading && !approval ? <p className="dm-muted">Carregando…</p> : approval ? <>
      <p className={`dm-approval-status ${approval.status}`}><i aria-hidden="true"/>{STATUS_LABEL[approval.status]}{approval.status === 'approved' && approval.approvedBy && <> por {approval.approvedBy}</>}</p>
      <form className="dm-approval-email" onSubmit={e => { e.preventDefault(); window.location.href = emailShareUrl(link, approval.albumName, email); }}>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail do cliente" aria-label="E-mail do cliente" autoComplete="off"/>
        <button type="submit" className="dm-button primary"><Mail size={15}/>Enviar</button>
      </form>
      <div className="dm-two">
        <a className="dm-button" href={whatsappShareUrl(link, approval.albumName)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/>WhatsApp</a>
        <button type="button" className="dm-button" onClick={() => void copy()}>{copied ? <Check size={15}/> : <Copy size={15}/>}{copied ? 'Copiado' : 'Copiar link'}</button>
      </div>
      {!!current.length && <div className="dm-approval-summary">{likes > 0 && <span className="like"><Heart size={13}/>{likes}</span>}{changes.length > 0 && <span className="change"><MapPin size={13}/>{changes.length} {changes.length === 1 ? 'ajuste' : 'ajustes'}</span>}</div>}
      {changes.length ? <ul className="dm-approval-comments">{changes.map(c => { const parsed = parseComment(c.body); return <li key={c.id}><button type="button" onClick={() => onGoToPage(c.page)}><strong>{pageLabel(project, c.page)}{parsed.pin && <MapPin size={11}/>}</strong><span>{parsed.text}</span><small>{c.author} · {dateFormat.format(new Date(c.createdAt))}</small></button></li>; })}</ul>
        : !current.length && <p className="dm-muted dm-small">Nenhuma resposta ainda.</p>}
      {older > 0 && <p className="dm-muted dm-small">{older} comentário(s) de versões anteriores.</p>}
      <button type="button" className="dm-button full" disabled={busy || working} onClick={() => void sendVersion()}><Send size={15}/>{working ? progress : 'Enviar versão atualizada'}</button>
      <button type="button" className="dm-approval-remove" disabled={working} onClick={() => void remove()}><Trash2 size={13}/>Encerrar link</button>
    </> : <>
      <p className="dm-muted">O cliente folheia, toca no que quer mudar e aprova. Sem precisar de conta.</p>
      <button type="button" className="dm-button primary full" disabled={busy || working} onClick={() => void sendVersion()}><Send size={15}/>{working ? progress : 'Criar link de aprovação'}</button>
    </>}
    {error && <p className="dm-error" role="alert">{error}</p>}
  </div>;
}
