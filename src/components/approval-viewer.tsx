'use client';
import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, CircleCheck, Heart, MapPin, PencilLine, Send, X} from 'lucide-react';
import {MAX_COMMENT_LENGTH, MAX_NAME_LENGTH, parseComment, type PublicApproval} from '@/lib/approval';

const NAME_KEY = 'zangraf-aprovacao-nome';
const dateFormat = new Intl.DateTimeFormat('pt-BR', {day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
const QUICK = ['Trocar esta foto', 'Aumentar esta foto', 'Tirar esta lâmina', 'Mudar a ordem'];

export function ApprovalViewer({token, initial}: {token: string; initial: PublicApproval}) {
  const [approval, setApproval] = useState(initial);
  const [position, setPosition] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [name, setName] = useState('');
  const [nameReady, setNameReady] = useState(true);
  const [askName, setAskName] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState<{x: number; y: number} | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [burst, setBurst] = useState(0);
  const [approveOpen, setApproveOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameDialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<null | (() => void)>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const page = approval.pages[position];
  const updating = approval.status === 'uploading';
  const approved = approval.status === 'approved';
  const parsed = (body: string) => parseComment(body);
  const pageComments = approval.comments.filter(c => c.page === page?.index).sort((a, b) => b.version - a.version || a.createdAt.localeCompare(b.createdAt));
  const currentOf = (index: number) => approval.comments.filter(c => c.page === index && c.version === approval.version);
  const changesOf = (index: number) => currentOf(index).filter(c => !parsed(c.body).like);
  const likedOf = (index: number) => currentOf(index).some(c => parsed(c.body).like);
  const pins = changesOf(page?.index ?? -99).map(c => parsed(c.body).pin).filter(Boolean) as {x: number; y: number}[];

  useEffect(() => { try { const saved = localStorage.getItem(NAME_KEY) || ''; setName(saved); setNameReady(!!saved); } catch { setNameReady(false); } }, []);
  function go(next: number) {
    if (next < 0 || next >= approval.pages.length || next === position) return;
    setDirection(next > position ? 1 : -1); setPosition(next); setEditing(false); setPin(null); setText(''); setMessage('');
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,dialog')) return;
      if (event.key === 'ArrowRight') go(position + 1);
      if (event.key === 'ArrowLeft') go(position - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  useEffect(() => { const el = dialog.current; if (!el) return; if (approveOpen && !el.open) el.showModal(); else if (!approveOpen && el.open) el.close(); }, [approveOpen]);
  useEffect(() => { const el = nameDialog.current; if (!el) return; if (askName && !el.open) el.showModal(); else if (!askName && el.open) el.close(); }, [askName]);
  useEffect(() => { document.querySelector(`[data-thumb="${position}"]`)?.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'}); }, [position]);
  useEffect(() => { if (editing) textArea.current?.focus(); }, [editing]);

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
  function comment(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || !page) return;
    withName(async () => { if (await send({action: 'comment', page: page.index, body: text, pin})) { setText(''); setPin(null); setEditing(false); setMessage('Anotado! O fotógrafo vai ver.'); } });
  }
  function placePin(event: React.MouseEvent<HTMLDivElement>) {
    if (approved || updating) return;
    const box = event.currentTarget.getBoundingClientRect();
    setPin({x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height))});
    setEditing(true);
  }
  async function approve() { if (await send({action: 'approve', version: approval.version})) { setApproveOpen(false); setMessage(''); } }

  const image = (i: number) => `/api/aprovar/${token}/pagina/${i}?v=${approval.version}`;
  const liked = page ? likedOf(page.index) : false;
  const totalChanges = approval.pages.reduce((sum, p) => sum + changesOf(p.index).length, 0);

  return <section className="ap-page" aria-label="Aprovação do álbum">
    <header className="ap-header">
      <h1>{approval.albumName}</h1>
      <div className="ap-header-actions">
        {approved ? <span className="ap-status approved"><CircleCheck size={15}/>Aprovado</span> : !updating && <button type="button" className="ap-button primary ap-approve" onClick={() => withName(() => { setConfirmed(false); setApproveOpen(true); })}><CircleCheck size={18}/>Aprovar álbum</button>}
      </div>
    </header>

    {approved && <p className="ap-banner ok"><CircleCheck size={18}/>Aprovado por <strong>{approval.approvedBy}</strong>{approval.approvedAt && <> em {dateFormat.format(new Date(approval.approvedAt))}</>}. Obrigado!</p>}
    {updating && <p className="ap-banner">Uma versão nova está chegando. Atualize a página em alguns minutos.</p>}

    {!updating && page && <div className="ap-layout">
      <div className="ap-stage">
        <div className="ap-viewer">
          <button type="button" className="ap-arrow prev" aria-label="Lâmina anterior" disabled={position === 0} onClick={() => go(position - 1)}><ChevronLeft size={24}/></button>
          <div className={'ap-frame' + (direction === 1 ? ' from-right' : ' from-left') + (editing ? ' is-pinning' : '')} key={position} style={{aspectRatio: `${page.width || 2} / ${page.height || 1}`}} onClick={placePin} title={approved ? undefined : 'Toque no que quer mudar'}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image(position)} alt={page.label} draggable={false}/>
            <span className="ap-shine" aria-hidden="true"/>
            {pins.map((p, i) => <i key={i} className="ap-pin saved" style={{left: `${p.x * 100}%`, top: `${p.y * 100}%`}} aria-hidden="true"/>)}
            {pin && <i className="ap-pin" style={{left: `${pin.x * 100}%`, top: `${pin.y * 100}%`}} aria-hidden="true"/>}
            {burst > 0 && liked && <span className="ap-burst" key={burst} aria-hidden="true"><Heart size={70} fill="currentColor"/></span>}
          </div>
          <button type="button" className="ap-arrow next" aria-label="Próxima lâmina" disabled={position === approval.pages.length - 1} onClick={() => go(position + 1)}><ChevronRight size={24}/></button>
        </div>

        <div className="ap-bar">
          <span className="ap-count"><strong key={position}>{page.label}</strong><small>{position + 1}/{approval.pages.length}</small></span>
          {!approved && <div className="ap-react">
            <button type="button" className={'ap-react-btn like' + (liked ? ' on' : '')} aria-pressed={liked} disabled={sending} onClick={like}><Heart size={18} fill={liked ? 'currentColor' : 'none'}/>Gostei</button>
            <button type="button" className={'ap-react-btn change' + (editing ? ' on' : '')} aria-expanded={editing} onClick={() => setEditing(v => !v)}><PencilLine size={18}/>Quero mudar</button>
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

      <aside className={'ap-comments' + (editing ? ' is-open' : '')} aria-label="Observações desta lâmina">
        {editing && !approved ? <form onSubmit={comment} className="ap-form">
          <div className="ap-form-head"><strong>O que você quer mudar?</strong><button type="button" className="ap-icon small" aria-label="Fechar" onClick={() => { setEditing(false); setPin(null); }}><X size={15}/></button></div>
          <p className={'ap-pin-hint' + (pin ? ' done' : '')}><MapPin size={15}/>{pin ? 'Ponto marcado na lâmina' : 'Toque na foto que quer mudar'}</p>
          <div className="ap-chips">{QUICK.map(q => <button type="button" key={q} onClick={() => setText(t => t.trim() ? `${t.trim()} ${q.toLowerCase()}` : q)}>{q}</button>)}</div>
          <textarea ref={textArea} value={text} maxLength={MAX_COMMENT_LENGTH} rows={3} onChange={e => setText(e.target.value)} placeholder="Ex.: Trocar por uma foto com a vovó"/>
          <button type="submit" className="ap-button primary" disabled={sending || !text.trim()}><Send size={15}/>{sending ? 'Enviando…' : 'Enviar'}</button>
        </form> : <>
          <h2>{page.label}</h2>
          {pageComments.filter(c => !parsed(c.body).like).length ? <ul>{pageComments.filter(c => !parsed(c.body).like).map(c => { const info = parsed(c.body); return <li key={c.id} className={c.version !== approval.version ? 'old' : ''}>
            <div><strong>{info.pin && <MapPin size={12}/>}{c.author}</strong><time dateTime={c.createdAt}>{dateFormat.format(new Date(c.createdAt))}</time></div>
            <p>{info.text}</p>
          </li>; })}</ul> : <p className="ap-muted">{liked ? 'Você gostou desta lâmina ♥' : approved ? 'Sem observações.' : 'Gostou? Toque no ♥. Quer mudar algo? Toque na foto.'}</p>}
        </>}
        {message && <p className="ap-message" role="status">{message}</p>}
        {totalChanges > 0 && !approved && <p className="ap-total"><MapPin size={13}/>{totalChanges} {totalChanges === 1 ? 'ajuste pedido' : 'ajustes pedidos'} no álbum</p>}
        {nameReady && name && <button type="button" className="ap-name" onClick={() => { setNameReady(false); setAskName(true); }}>Você é <strong>{name}</strong> · trocar</button>}
      </aside>
    </div>}

    <footer className="ap-footer">Prévia em baixa resolução · Zangraf</footer>

    <dialog ref={nameDialog} className="ap-dialog" onClose={() => setAskName(false)} aria-label="Seu nome">
      <form onSubmit={saveName} className="ap-dialog-form">
        <h2>Qual é o seu nome?</h2>
        <p>Assim o fotógrafo sabe quem respondeu.</p>
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
