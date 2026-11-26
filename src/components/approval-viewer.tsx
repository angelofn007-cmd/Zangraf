'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, CircleCheck, Heart, LayoutGrid, PencilLine, Send, X} from 'lucide-react';
import {MAX_COMMENT_LENGTH, MAX_NAME_LENGTH, PAGE_REQUEST_ACTIONS, REQUEST_ACTIONS, parseComment, requestTitle, type PublicApproval} from '@/lib/approval';
import {ApprovalBook, PhotoNumbers} from './approval-book';

const NAME_KEY = 'zangraf-aprovacao-nome';
const dateFormat = new Intl.DateTimeFormat('pt-BR', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});

/** Pedido em andamento: qual foto (0 = a lâmina toda), o que fazer e um detalhe opcional. */
type Draft = {photo: number | null; action: string; detail: string};

export function ApprovalViewer({token, initial}: {token: string; initial: PublicApproval}) {
  const [approval, setApproval] = useState(initial);
  const [position, setPosition] = useState(0);
  const [name, setName] = useState('');
  const [nameReady, setNameReady] = useState(true);
  const [askName, setAskName] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [burst, setBurst] = useState(0);
  const [approveOpen, setApproveOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameDialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<null | (() => void)>(null);
  const detail = useRef<HTMLTextAreaElement>(null);
  const page = approval.pages[position];
  const updating = approval.status === 'uploading';
  const approved = approval.status === 'approved';
  const currentOf = (index: number) => approval.comments.filter(c => c.page === index && c.version === approval.version);
  const changesOf = (index: number) => currentOf(index).filter(c => !parseComment(c.body).like);
  const likedOf = (index: number) => currentOf(index).some(c => parseComment(c.body).like);
  const requests = page ? changesOf(page.index) : [];
  const older = page ? approval.comments.filter(c => c.page === page.index && c.version !== approval.version && !parseComment(c.body).like) : [];
  const marked = new Set(requests.map(c => parseComment(c.body).photo).filter((n): n is number => !!n));
  const photos = page?.photos || [];

  useEffect(() => { try { const saved = localStorage.getItem(NAME_KEY) || ''; setName(saved); setNameReady(!!saved); } catch { setNameReady(false); } }, []);
  const go = useCallback((next: number) => {
    setPosition(current => next < 0 || next >= approval.pages.length ? current : next);
    setDraft(null); setMessage('');
  }, [approval.pages.length]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,dialog')) return;
      if (event.key === 'ArrowRight') go(position + 1);
      if (event.key === 'ArrowLeft') go(position - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, position]);
  useEffect(() => { const el = dialog.current; if (!el) return; if (approveOpen && !el.open) el.showModal(); else if (!approveOpen && el.open) el.close(); }, [approveOpen]);
  useEffect(() => { const el = nameDialog.current; if (!el) return; if (askName && !el.open) el.showModal(); else if (!askName && el.open) el.close(); }, [askName]);
  useEffect(() => { document.querySelector(`[data-thumb="${position}"]`)?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'}); }, [position]);
  useEffect(() => { if (draft?.action === 'Outro') detail.current?.focus(); }, [draft?.action]);

  /** Pede o nome uma vez só, na primeira ação. */
  function withName(action: () => void) {
    if (name.trim() && nameReady) { action(); return; }
    pending.current = action; setAskName(true);
  }
  function saveName(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* opcional */ }
    setNameReady(true); setAskName(false);
    const action = pending.current; pending.current = null; action?.();
  }
  async function send(payload: Record<string, unknown>) {
    setSending(true); setMessage('');
    try {
      const response = await fetch(`/api/aprovar/${token}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...payload, name: name.trim()})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(data.message || 'Não foi possível enviar. Tente novamente.'); return false; }
      setApproval(data.approval); return true;
    } catch { setMessage('Sem conexão. Confira sua internet e tente novamente.'); return false; }
    finally { setSending(false); }
  }
  function like() {
    if (!page || likedOf(page.index)) return;
    withName(async () => { if (await send({action: 'comment', page: page.index, like: true, body: ''})) setBurst(b => b + 1); });
  }
  function startRequest() {
    // Lâmina sem fotos numeradas: o pedido já é sobre a lâmina toda.
    setDraft({photo: photos.length ? null : 0, action: '', detail: ''}); setMessage('');
  }
  function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    if (!page || !draft || draft.photo === null || !draft.action) return;
    const extra = draft.detail.trim();
    if (draft.action === 'Outro' && !extra) { detail.current?.focus(); return; }
    const body = draft.action === 'Outro' ? extra : extra ? `${draft.action}: ${extra}` : draft.action;
    withName(async () => {
      if (await send({action: 'comment', page: page.index, photo: draft.photo || undefined, body})) {
        setDraft(null); setMessage(draft.photo ? `Pedido da foto ${draft.photo} enviado!` : 'Pedido enviado!');
      }
    });
  }
  async function approve() { if (await send({action: 'approve', version: approval.version})) { setApproveOpen(false); setMessage(''); } }

  const image = useCallback((i: number) => `/api/aprovar/${token}/pagina/${i}?v=${approval.version}`, [token, approval.version]);
  const liked = page ? likedOf(page.index) : false;
  const totalChanges = approval.pages.reduce((sum, p) => sum + changesOf(p.index).length, 0);
  const picking = !!draft && draft.photo === null;
  const actions = draft?.photo ? REQUEST_ACTIONS : PAGE_REQUEST_ACTIONS;

  return <section className="ap-page" aria-label="Aprovação do álbum">
    <header className="ap-header">
      <h1>{approval.albumName}</h1>
      <div className="ap-header-actions">
        {approved ? <span className="ap-status approved"><CircleCheck size={15}/>Aprovado</span> : !updating && <button type="button" className="ap-button primary ap-approve" onClick={() => withName(() => { setConfirmed(false); setApproveOpen(true); })}><CircleCheck size={18}/>Aprovar álbum</button>}
      </div>
    </header>

    {approved && <p className="ap-banner ok"><CircleCheck size={18}/>Aprovado por <strong>{approval.approvedBy}</strong>{approval.approvedAt && <> em {dateFormat.format(new Date(approval.approvedAt))}</>}. Obrigado!</p>}
    {updating && <p className="ap-banner">Uma versão nova está chegando. Atualize a página em alguns minutos.</p>}
    {!updating && !approved && <ol className="ap-steps" aria-label="Como funciona">
      <li>Folheie o álbum</li><li>Quer mudar algo? <strong>Pedir ajuste</strong> e toque no número da foto</li><li>Tudo certo? <strong>Aprovar álbum</strong></li>
    </ol>}

    {!updating && page && <div className="ap-layout">
      <div className="ap-stage">
        <div className="ap-viewer">
          <button type="button" className="ap-arrow prev" aria-label="Lâmina anterior" disabled={position === 0} onClick={() => go(position - 1)}><ChevronLeft size={24}/></button>
          <div className={'ap-book-wrap' + (picking ? ' is-picking' : '')}>
            <ApprovalBook pages={approval.pages} position={position} image={image} overlay={<>
              <PhotoNumbers photos={photos} marked={marked} selected={draft?.photo || null} picking={picking}
                onPick={n => setDraft(d => d && {...d, photo: n, action: ''})}/>
              {burst > 0 && liked && <span className="ap-burst" key={burst} aria-hidden="true"><Heart size={70} fill="currentColor"/></span>}
            </>}/>
          </div>
          <button type="button" className="ap-arrow next" aria-label="Próxima lâmina" disabled={position === approval.pages.length - 1} onClick={() => go(position + 1)}><ChevronRight size={24}/></button>
        </div>

        <div className="ap-bar">
          <span className="ap-count"><strong key={position}>{page.label}</strong><small>{position + 1}/{approval.pages.length}</small></span>
          {!approved && <div className="ap-react">
            <button type="button" className={'ap-react-btn like' + (liked ? ' on' : '')} aria-pressed={liked} disabled={sending} onClick={like}><Heart size={18} fill={liked ? 'currentColor' : 'none'}/>Gostei</button>
            <button type="button" className={'ap-react-btn change' + (draft ? ' on' : '')} aria-expanded={!!draft} onClick={() => draft ? setDraft(null) : startRequest()}><PencilLine size={18}/>Pedir ajuste</button>
          </div>}
        </div>

        <div className="ap-thumbs" aria-label="Todas as lâminas">
          {approval.pages.map((p, i) => <button type="button" key={p.index} data-thumb={i} aria-label={p.label} aria-current={i === position} onClick={() => go(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image(i)} alt="" loading="lazy"/>
            {changesOf(p.index).length > 0 ? <b className="change">{changesOf(p.index).length}</b> : likedOf(p.index) && <b className="like"><Heart size={10} fill="currentColor"/></b>}
          </button>)}
        </div>
      </div>

      <aside className={'ap-comments' + (draft ? ' is-open' : '')} aria-label="Pedidos desta lâmina">
        {draft && !approved ? <form onSubmit={submitRequest} className="ap-form ap-request">
          <div className="ap-form-head"><strong>Pedir ajuste · {page.label}</strong><button type="button" className="ap-icon small" aria-label="Cancelar" onClick={() => setDraft(null)}><X size={15}/></button></div>
          {draft.photo === null ? <>
            <p className="ap-step-title"><span>1</span>Toque no <strong>número da foto</strong> que quer mudar</p>
            <div className="ap-photo-chips">{photos.map(b => <button type="button" key={b.n} onClick={() => setDraft({...draft, photo: b.n, action: ''})}>{b.n}</button>)}</div>
            <button type="button" className="ap-whole" onClick={() => setDraft({...draft, photo: 0, action: ''})}><LayoutGrid size={15}/>A lâmina toda</button>
          </> : <>
            <p className="ap-picked">{draft.photo ? <><b>{draft.photo}</b>Foto {draft.photo}</> : <><LayoutGrid size={15}/>A lâmina toda</>}
              {photos.length > 0 && <button type="button" onClick={() => setDraft({...draft, photo: null, action: ''})}>trocar</button>}</p>
            <p className="ap-step-title"><span>2</span>O que você quer?</p>
            <div className="ap-chips">{actions.map(a => <button type="button" key={a} aria-pressed={draft.action === a} onClick={() => setDraft({...draft, action: a})}>{a}</button>)}</div>
            {draft.action && <>
              <textarea ref={detail} value={draft.detail} maxLength={MAX_COMMENT_LENGTH} rows={3} onChange={e => setDraft({...draft, detail: e.target.value})}
                placeholder={draft.action === 'Outro' ? 'Conte o que você quer mudar' : 'Algum detalhe? (opcional) Ex.: trocar por uma com a vovó'}/>
              <button type="submit" className="ap-button primary" disabled={sending || (draft.action === 'Outro' && !draft.detail.trim())}><Send size={15}/>{sending ? 'Enviando…' : 'Enviar pedido'}</button>
            </>}
          </>}
        </form> : <>
          <h2>{page.label}</h2>
          {requests.length ? <ul>{requests.map(c => { const info = parseComment(c.body); return <li key={c.id}>
            <div><strong className="ap-req-title">{info.photo ? <b>{info.photo}</b> : null}{requestTitle(info)}</strong><time dateTime={c.createdAt}>{dateFormat.format(new Date(c.createdAt))}</time></div>
            <p>{info.text}</p><small>{c.author}</small>
          </li>; })}</ul> : <p className="ap-muted">{liked ? 'Você gostou desta lâmina ♥' : approved ? 'Sem pedidos.' : 'Gostou? Toque em Gostei. Quer mudar algo? Toque em Pedir ajuste.'}</p>}
          {older.length > 0 && <p className="ap-muted ap-older">{older.length} pedido(s) de versões anteriores desta lâmina.</p>}
        </>}
        {message && <p className="ap-message" role="status">{message}</p>}
        {totalChanges > 0 && !approved && <p className="ap-total"><PencilLine size={13}/>{totalChanges} {totalChanges === 1 ? 'ajuste pedido' : 'ajustes pedidos'} no álbum</p>}
        {nameReady && name && <button type="button" className="ap-name" onClick={() => { setNameReady(false); setAskName(true); }}>Você é <strong>{name}</strong> · trocar</button>}
      </aside>
    </div>}

    <footer className="ap-footer">Prévia em baixa resolução · Zangraf</footer>

    <dialog ref={nameDialog} className="ap-dialog" onClose={() => setAskName(false)} aria-label="Seu nome">
      <form onSubmit={saveName} className="ap-dialog-form">
        <h2>Qual é o seu nome?</h2>
        <p>Assim o fotógrafo sabe quem pediu.</p>
        <input value={name} maxLength={MAX_NAME_LENGTH} onChange={e => setName(e.target.value)} placeholder="Ex.: Ana e Pedro" autoComplete="name" autoFocus/>
        <button type="submit" className="ap-button primary" disabled={!name.trim()}>Continuar</button>
      </form>
    </dialog>

    <dialog ref={dialog} className="ap-dialog" onClose={() => setApproveOpen(false)} aria-label="Aprovar álbum">
      <button type="button" className="ap-icon ap-close" aria-label="Fechar" onClick={() => setApproveOpen(false)}><X size={18}/></button>
      <h2>Aprovar o álbum?</h2>
      <p>{totalChanges ? `Você pediu ${totalChanges} ${totalChanges === 1 ? 'ajuste' : 'ajustes'}. Se aprovar agora, o álbum segue como está.` : 'Depois da aprovação, o álbum pode ir para impressão.'}</p>
      <label className="ap-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>Vi todas as {approval.pages.length} lâminas e está tudo certo.</label>
      {message && approveOpen && <p className="ap-message" role="alert">{message}</p>}
      <button type="button" className="ap-button primary" disabled={!confirmed || sending} onClick={() => void approve()}><CircleCheck size={17}/>{sending ? 'Aprovando…' : 'Aprovar'}</button>
    </dialog>
  </section>;
}
