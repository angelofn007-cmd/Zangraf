'use client';
import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, CircleCheck, MessageSquare, Send, X} from 'lucide-react';
import {MAX_COMMENT_LENGTH, MAX_NAME_LENGTH, STATUS_LABEL, type PublicApproval} from '@/lib/approval';

const NAME_KEY = 'zangraf-aprovacao-nome';
const dateFormat = new Intl.DateTimeFormat('pt-BR', {day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit'});

export function ApprovalViewer({token, initial}: {token: string; initial: PublicApproval}) {
  const [approval, setApproval] = useState(initial);
  const [position, setPosition] = useState(0);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const page = approval.pages[position];
  const updating = approval.status === 'uploading';
  const approved = approval.status === 'approved';
  const pageComments = approval.comments.filter(c => c.page === page?.index).sort((a, b) => b.version - a.version || a.createdAt.localeCompare(b.createdAt));
  const countFor = (index: number) => approval.comments.filter(c => c.page === index && c.version === approval.version).length;

  useEffect(() => { try { setName(localStorage.getItem(NAME_KEY) || ''); } catch { /* sem armazenamento: o nome é pedido de novo */ } }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,dialog')) return;
      if (event.key === 'ArrowRight') setPosition(p => Math.min(approval.pages.length - 1, p + 1));
      if (event.key === 'ArrowLeft') setPosition(p => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [approval.pages.length]);
  useEffect(() => {
    const element = dialog.current; if (!element) return;
    if (approveOpen && !element.open) element.showModal(); else if (!approveOpen && element.open) element.close();
  }, [approveOpen]);
  useEffect(() => { document.querySelector(`[data-thumb="${position}"]`)?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'}); }, [position]);

  async function send(payload: Record<string, unknown>) {
    const author = name.trim();
    if (!author) { setMessage('Escreva seu nome para continuar.'); return false; }
    setSending(true); setMessage('');
    try {
      try { localStorage.setItem(NAME_KEY, author); } catch { /* opcional */ }
      const response = await fetch(`/api/aprovar/${token}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...payload, name: author})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(data.message || 'Não foi possível enviar. Tente novamente.'); return false; }
      setApproval(data.approval); return true;
    } catch { setMessage('Sem conexão. Confira sua internet e tente novamente.'); return false; }
    finally { setSending(false); }
  }
  async function comment(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !page) return;
    if (await send({action: 'comment', page: page.index, body: text})) { setText(''); setMessage('Comentário enviado ao fotógrafo.'); }
  }
  async function approve() {
    if (await send({action: 'approve', version: approval.version})) { setApproveOpen(false); setMessage(''); }
  }

  const image = (i: number) => `/api/aprovar/${token}/pagina/${i}?v=${approval.version}`;

  return <section className="ap-page" aria-label="Aprovação do álbum">
    <header className="ap-header">
      <div>
        <small>ÁLBUM PARA APROVAÇÃO · VERSÃO {approval.version}</small>
        <h1>{approval.albumName}</h1>
      </div>
      <div className="ap-header-actions">
        <span className={`ap-status ${approval.status}`}>{STATUS_LABEL[approval.status]}</span>
        {!approved && !updating && <button type="button" className="ap-button primary" onClick={() => { setConfirmed(false); setApproveOpen(true); }}><CircleCheck size={17}/>Aprovar álbum</button>}
      </div>
    </header>

    {approved && <p className="ap-banner ok"><CircleCheck size={18}/>Versão {approval.version} aprovada por <strong>{approval.approvedBy}</strong>{approval.approvedAt && <> em {dateFormat.format(new Date(approval.approvedAt))}</>}. Obrigado!</p>}
    {updating && <p className="ap-banner">O fotógrafo está enviando uma versão nova deste álbum. Atualize a página em alguns minutos.</p>}
    {!approved && !updating && <p className="ap-intro">Folheie as lâminas com calma. Se quiser mudar algo, deixe um comentário na lâmina. Quando estiver tudo certo, clique em <strong>Aprovar álbum</strong>.</p>}

    {!updating && page && <div className="ap-layout">
      <div className="ap-stage">
        <div className="ap-frame" style={{aspectRatio: `${page.width || 2} / ${page.height || 1}`}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image(position)} alt={page.label} key={position}/>
        </div>
        <div className="ap-nav">
          <button type="button" className="ap-icon" aria-label="Lâmina anterior" disabled={position === 0} onClick={() => setPosition(p => p - 1)}><ChevronLeft size={22}/></button>
          <span><strong>{page.label}</strong> · {position + 1} de {approval.pages.length}</span>
          <button type="button" className="ap-icon" aria-label="Próxima lâmina" disabled={position === approval.pages.length - 1} onClick={() => setPosition(p => p + 1)}><ChevronRight size={22}/></button>
        </div>
        <div className="ap-thumbs" aria-label="Todas as lâminas">
          {approval.pages.map((p, i) => <button type="button" key={p.index} data-thumb={i} aria-label={p.label} aria-current={i === position} onClick={() => setPosition(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image(i)} alt="" loading="lazy"/>
            {countFor(p.index) > 0 && <b aria-label={`${countFor(p.index)} comentário(s)`}>{countFor(p.index)}</b>}
          </button>)}
        </div>
      </div>

      <aside className="ap-comments" aria-label="Comentários desta lâmina">
        <h2><MessageSquare size={17}/>Comentários · {page.label}</h2>
        {pageComments.length ? <ul>{pageComments.map(c => <li key={c.id} className={c.version !== approval.version ? 'old' : ''}>
          <div><strong>{c.author}</strong><time dateTime={c.createdAt}>{dateFormat.format(new Date(c.createdAt))}</time></div>
          <p>{c.body}</p>
          {c.version !== approval.version && <small>Versão {c.version}</small>}
        </li>)}</ul> : <p className="ap-muted">Nenhum comentário nesta lâmina.</p>}
        <form onSubmit={comment}>
          <label>Seu nome<input value={name} maxLength={MAX_NAME_LENGTH} onChange={e => setName(e.target.value)} placeholder="Ex.: Ana e Pedro" autoComplete="name"/></label>
          <label>O que você gostaria de mudar?<textarea value={text} maxLength={MAX_COMMENT_LENGTH} rows={4} onChange={e => setText(e.target.value)} placeholder="Ex.: Trocar a foto da direita por uma com a vovó."/></label>
          <button type="submit" className="ap-button" disabled={sending || !text.trim()}><Send size={15}/>{sending ? 'Enviando…' : 'Enviar comentário'}</button>
          {message && !approveOpen && <p className="ap-message" role="status">{message}</p>}
        </form>
      </aside>
    </div>}

    <footer className="ap-footer">Prévia em baixa resolução, só para conferência · Zangraf</footer>

    <dialog ref={dialog} className="ap-dialog" onClose={() => setApproveOpen(false)} aria-label="Aprovar álbum">
      <button type="button" className="ap-icon ap-close" aria-label="Fechar" onClick={() => setApproveOpen(false)}><X size={18}/></button>
      <h2>Aprovar o álbum</h2>
      <p>Depois da aprovação, o fotógrafo pode mandar o álbum para impressão. Se tiver dúvidas, deixe um comentário antes.</p>
      <label>Seu nome<input value={name} maxLength={MAX_NAME_LENGTH} onChange={e => setName(e.target.value)} autoComplete="name"/></label>
      <label className="ap-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Conferi todas as {approval.pages.length} lâminas e aprovo a versão {approval.version}.</label>
      {message && approveOpen && <p className="ap-message" role="alert">{message}</p>}
      <button type="button" className="ap-button primary" disabled={!confirmed || !name.trim() || sending} onClick={() => void approve()}><CircleCheck size={17}/>{sending ? 'Aprovando…' : 'Aprovar álbum'}</button>
    </dialog>
  </section>;
}
