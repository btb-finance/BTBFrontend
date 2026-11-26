'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useConnection, useDisconnect } from 'wagmi';
import { Providers } from '../Providers';
import { useChainTheme } from '@/lib/ChainThemeContext';
import { renderReply } from './Markdown';
import { AskFrame, Icon } from './AskFrame';
import { TxPlan, type StepState } from './TxPlan';
import type { TxStep } from '@/lib/ask/agent';

const ConnectScreen = dynamic(() => import('../screens/ConnectScreen').then((m) => m.ConnectScreen), { ssr: false });

/**
 * The agent-first BTB interface at /ask: one box where people say what they want in plain English. Answers come from
 * /api/ask (the BTB tools behind a language model) with buttons that open the classic app's screens to confirm.
 * The classic app is untouched and one click away.
 */

type Turn = { role: 'user' | 'assistant'; content: string; steps?: string[]; error?: boolean; txs?: TxStep[]; txState?: StepState[] };
type Chat = { id: string; title: string; at: number; turns: Turn[] };

const STORE = 'btb-ask-chats-v1';
const MAX_CHATS = 30;

export const SUGGESTIONS = [
  'Best stable pools on Base for $1,000',
  'Swap 0.1 ETH to USDC on Base',
  'Show my LP positions and if they are in range',
  'Compare the top ETH and USDC pools',
  'Is this token safe? (paste its address)',
  'How do I earn the Friday BTB rewards?',
];

function loadChats(): Chat[] {
  try { return (JSON.parse(localStorage.getItem(STORE) ?? '[]') as Chat[]).filter((c) => Array.isArray(c.turns)); } catch { return []; }
}
function saveChats(chats: Chat[]) {
  try { localStorage.setItem(STORE, JSON.stringify(chats.slice(0, MAX_CHATS))); } catch { /* private mode: this visit only */ }
}

export function AskApp() {
  return <Providers fallback={<AskFrame/>}><AskInner/></Providers>;
}

function AskInner() {
  const { address } = useConnection();
  const { disconnect } = useDisconnect();
  const { mode, toggleMode } = useChainTheme();
  const [watchAddress, setWatchAddress] = useState<string | undefined>();
  const wallet = address ?? watchAddress;

  const [chats, setChats] = useState<Chat[]>(loadChats);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const turns = active?.turns ?? [];

  useEffect(() => { saveChats(chats); }, [chats]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, busy]);

  // Cmd+K or Ctrl+K: jump to the box from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === 'Escape') { setSideOpen(false); setWalletMenu(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The box grows with what is typed, up to its max height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(180, el.scrollHeight)}px`;
  }, [input]);

  const update = useCallback((id: string, fn: (c: Chat) => Chat) => {
    setChats((cs) => {
      const c = cs.find((x) => x.id === id);
      if (!c) return cs;
      const next = fn(c);
      return [next, ...cs.filter((x) => x.id !== id)];
    });
  }, []);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setInput('');
    let id = activeId;
    const history = turns.filter((t) => !t.error).map(({ role, content }) => ({ role, content }));
    if (!id || !active) {
      id = Math.random().toString(36).slice(2, 10);
      const chat: Chat = { id, title: message.slice(0, 60), at: Date.now(), turns: [{ role: 'user', content: message }] };
      setChats((cs) => [chat, ...cs]);
      setActiveId(id);
    } else {
      update(id, (c) => ({ ...c, at: Date.now(), turns: [...c.turns, { role: 'user', content: message }] }));
    }
    setBusy(true);
    const chatId = id;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, history, wallet }),
      });
      const body = await res.json().catch(() => ({})) as { reply?: string; steps?: string[]; txs?: TxStep[]; error?: string };
      const turn: Turn = body.reply
        ? { role: 'assistant', content: body.reply, steps: body.steps ?? [], ...(body.txs?.length ? { txs: body.txs } : {}) }
        : { role: 'assistant', content: body.error ?? 'Something went wrong. Try again.', error: true };
      update(chatId, (c) => ({ ...c, turns: [...c.turns, turn] }));
    } catch {
      update(chatId, (c) => ({ ...c, turns: [...c.turns, { role: 'assistant', content: 'No connection. Check your internet and try again.', error: true }] }));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const newChat = () => { setActiveId(null); setSideOpen(false); setInput(''); inputRef.current?.focus(); };
  const pickSuggestion = (s: string) => {
    if (s.includes('(paste')) { setInput('Is this token safe? '); inputRef.current?.focus(); return; }
    void send(s);
  };

  const short = wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : '';

  const composer: ReactNode = (
    <form className="ag-box" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
      <textarea
        ref={inputRef} rows={1} value={input} maxLength={1500}
        placeholder={turns.length ? 'Ask a follow up' : 'Tell BTB what you want to do'}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(input); } }}
        aria-label="Ask BTB"
      />
      <button type="submit" className="ag-send" disabled={busy || !input.trim()} aria-label="Send"><Icon name="up"/></button>
    </form>
  );

  return (
    <AskFrame
      sideOpen={sideOpen}
      onCloseSide={() => setSideOpen(false)}
      onOpenSide={() => setSideOpen(true)}
      onNewChat={newChat}
      chatList={chats.map((c) => (
        <button key={c.id} type="button" className="ag-item" aria-current={c.id === activeId} onClick={() => { setActiveId(c.id); setSideOpen(false); }} title={c.title}>
          <span>{c.title}</span>
        </button>
      ))}
      footer={
        <>
          {walletMenu && wallet && (
            <div className="ag-menu">
              <button type="button" className="ag-item" onClick={() => { navigator.clipboard?.writeText(wallet).catch(() => {}); setWalletMenu(false); }}><span>Copy address</span></button>
              <a className="ag-item" href="/portfolio"><span>Open portfolio</span></a>
              <button type="button" className="ag-item" onClick={() => { if (address) disconnect(); setWatchAddress(undefined); setWalletMenu(false); }}>
                <span>{address ? 'Disconnect' : 'Stop watching'}</span>
              </button>
            </div>
          )}
          <div className="ag-row">
            {wallet ? (
              <button type="button" className="ag-wallet" onClick={() => setWalletMenu((o) => !o)}><span className="ag-dot"/>{short}</button>
            ) : (
              <button type="button" className="ag-wallet primary" onClick={() => setShowConnect(true)}>Connect wallet</button>
            )}
            <button type="button" className="ag-icon-btn" onClick={toggleMode} aria-label={mode === 'dark' ? 'Switch to day' : 'Switch to night'} title={mode === 'dark' ? 'Day' : 'Night'}>
              <Icon name={mode === 'dark' ? 'sun' : 'moon'}/>
            </button>
          </div>
        </>
      }
    >
      {turns.length === 0 ? (
        <div className="ag-hero">
          <h2>What do you want to do?</h2>
          <p>Ask in plain English. BTB finds pools, checks tokens, reads your positions and sets up swaps. You confirm everything in your own wallet.</p>
          {composer}
          <div className="ag-chips">
            {SUGGESTIONS.map((s) => <button key={s} type="button" className="ag-chip" onClick={() => pickSuggestion(s)}>{s}</button>)}
          </div>
        </div>
      ) : (
        <>
          <div className="ag-thread" aria-live="polite">
            {turns.map((t, i) => t.role === 'user'
              ? <div key={i} className="ag-user">{t.content}</div>
              : <BotTurn key={i} turn={t}
                  onStep={(n, st) => active && update(active.id, (c) => ({
                    ...c, turns: c.turns.map((x, j) => j === i ? { ...x, txState: Object.assign([...(x.txState ?? [])], { [n]: st }) } : x),
                  }))}
                  onRebuilt={(n, step) => active && update(active.id, (c) => ({
                    ...c, turns: c.turns.map((x, j) => j === i && x.txs ? { ...x, txs: x.txs.map((y, k) => k === n ? step : y) } : x),
                  }))}/>)}
            {busy && <div className="ag-thinking"><span className="ag-pulse"/>Working on it</div>}
            <div ref={endRef}/>
          </div>
          <div className="ag-dock">
            {composer}
            <div className="ag-hint">Answers use live data but can be wrong. Not financial advice. Nothing is sent without your wallet.</div>
          </div>
        </>
      )}
      {showConnect && (
        <ConnectScreen
          onConnect={() => setShowConnect(false)}
          onImport={(a) => { setWatchAddress(a); setShowConnect(false); }}
          onClose={() => setShowConnect(false)}
        />
      )}
    </AskFrame>
  );
}

function BotTurn({ turn, onStep, onRebuilt }: { turn: Turn; onStep: (n: number, s: StepState) => void; onRebuilt: (n: number, step: TxStep) => void }) {
  if (turn.error) return <div className="ag-bot"><div className="ag-error">{turn.content}</div></div>;
  const { body, actions } = renderReply(turn.content);
  return (
    <div className="ag-bot">
      {!!turn.steps?.length && (
        <div className="ag-steps">{turn.steps.map((s) => <span key={s} className="ag-step"><Icon name="check" size={12}/>{s}</span>)}</div>
      )}
      <div className="ag-text">{body}</div>
      {turn.txs && turn.txs.length > 0 && <TxPlan txs={turn.txs} state={turn.txState ?? []} onState={onStep} onRebuilt={onRebuilt}/>}
      {actions.length > 0 && (
        <div className="ag-actions">
          {/* With steps to sign, those are the main action; links stay secondary. */}
          {actions.map((a, i) => <a key={a.href} href={a.href} className={`ag-action${i === 0 && !turn.txs?.length ? ' primary' : ''}`}>{a.label}<Icon name="arrow" size={13}/></a>)}
        </div>
      )}
    </div>
  );
}
