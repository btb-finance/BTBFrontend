'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useAction } from 'convex/react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits } from 'viem';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { btb } from '../design-tokens';
import { useTokenStore } from '../../lib/TokenStore';
import { fetchOwnedNftTokenIds } from '../../lib/blockscout';
import { api } from '../../../convex/_generated/api';
import {
  fetchV3Positions, fetchV4Positions, UNISWAP_V3_DEPLOYMENT,
} from '@/protocols/dexs/uniswap';
import { UNISWAP_V4 } from '@/protocols/dexs/uniswap/v4/addresses';
import { useWalletSession } from '../../lib/session';
import { useAlertCredit, AGENT_FREE_PER_DAY, AGENT_MESSAGE_BTB } from '../../lib/alerts';
import { BtbTopUp, fmtBtb } from '../FastAlerts';
import { fetchPancakePositions, PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';


const SUGGESTIONS = [
  'Where should I LP based on my holdings?',
  'Analyze my portfolio risk',
  'Best low risk stable yield for me?',
];

const CAPABILITIES = [
  { icon: 'pie',    color: 'var(--btb-text)', bg: 'rgba(var(--fg-rgb), 0.08)',  title: 'Reads your portfolio',     desc: 'Sees every balance, position, and price across all your tokens.' },
  { icon: 'chart',  color: 'var(--btb-green)', bg: 'rgba(var(--green-rgb), 0.12)',   title: 'Knows the market',         desc: 'Has live TVL, volume, and APR for every pool on Discover and Earn.' },
  { icon: 'shield', color: 'var(--btb-amber)', bg: 'rgba(var(--amber-rgb), 0.15)',  title: 'Talks risk honestly',      desc: 'Flags impermanent loss, thin pools, and out of range positions.' },
  { icon: 'send',   color: '#94A3B8', bg: 'rgba(148,163,184,0.15)',  title: 'Suggests next moves',      desc: 'Recommends LPs and vaults sized to what you actually hold.' },
];

export function StakeScreen({ onGetBtb }: { onGetBtb?: () => void } = {}) {
  const { walletAddress } = useTokenStore();

  if (walletAddress) {
    return <AgentChat walletAddress={walletAddress} onGetBtb={onGetBtb}/>;
  }

  return (
    <Screen gap={18} style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Badge color="var(--btb-green)" bg="rgba(var(--green-rgb), 0.15)" border="1px solid rgba(var(--green-rgb), 0.35)"
          style={{ gap: 6, padding: '6px 12px', fontSize: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--btb-green)', boxShadow: '0 0 8px #52E3A4' }}/>
          <span style={{ color: 'var(--btb-green)', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>LIVE</span>
        </Badge>
      </div>

      {/* connect prompt: free messages every day, then 1 BTB each */}
      <Glass padding={18} radius={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'rgba(var(--green-rgb), 0.12)', border: '1px solid rgba(var(--green-rgb), 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="bolt" size={20} color="var(--btb-green)"/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.text, fontSize: 15, fontWeight: 800 }}>Connect a wallet to start chatting</div>
            <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 2 }}>
              Everyone gets {AGENT_FREE_PER_DAY} free messages a day, then {AGENT_MESSAGE_BTB} BTB per message.
            </div>
          </div>
        </div>
      </Glass>

      {/* hero */}
      <Glass padding={28} radius={28} strong style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 0%, rgba(var(--fg-rgb), 0.18), transparent 55%), radial-gradient(circle at 80% 100%, rgba(var(--amber-rgb), 0.18), transparent 55%)',
          pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 76, height: 76, borderRadius: 24, margin: '0 auto 18px',
            background: 'linear-gradient(135deg, rgba(var(--fg-rgb), 0.22), rgba(var(--amber-rgb), 0.18))',
            border: '1px solid rgba(var(--fg-rgb), 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(var(--amber-rgb), 0.25), inset 0 1px 0 rgba(var(--fg-rgb), 0.3)',
          }}>
            <Icon name="bolt" size={36} color="var(--btb-text)"/>
          </div>
          <div style={{ color: btb.text, fontSize: 24, fontWeight: 800, letterSpacing: -0.5, marginBottom: 8 }}>
            Your personal AI agent
          </div>
          <div style={{ color: btb.textMuted, fontSize: 14, lineHeight: 1.55, maxWidth: 340, margin: '0 auto' }}>
            An AI that reads your portfolio, flags risks, and surfaces opportunities without ever holding your keys.
          </div>
        </div>
      </Glass>

      {/* what it does */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ color: btb.text, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, padding: '0 4px' }}>
          What it does
        </div>
        {CAPABILITIES.map(c => (
          <Glass key={c.title} padding={14} radius={18}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, background: c.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name={c.icon} size={20} color={c.color}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{c.title}</div>
                <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5 }}>{c.desc}</div>
              </div>
            </div>
          </Glass>
        ))}
      </div>
    </Screen>
  );
}

// ─── Markdown-lite for agent replies ─────────────────────────────────────────
// GLM answers in markdown (bold, lists, headings). Render the common subset
// instead of showing literal ** markers — no dependency needed for chat text.

/** Links the agent hands out: btb.finance paths open inside the app (same tab), anything else opens in a new tab. */
function AgentLink({ href }: { href: string }) {
  const clean = href.replace(/[.,;:)\]]+$/, '');
  const trail = href.slice(clean.length);
  let label = clean, inApp = false;
  try {
    const u = new URL(clean);
    inApp = /(^|\.)btb\.finance$/i.test(u.hostname) || u.hostname === 'localhost';
    label = u.hostname + u.pathname;
    if (u.pathname.startsWith('/swap')) label = 'Open swap';
    else if (u.pathname.startsWith('/discover/')) { const [chain, pair] = u.pathname.split('/').slice(2); label = pair ? `Open ${pair.replace(/-/g, '/').toUpperCase()} on ${chain}` : `Open ${chain}`; }
    else if (inApp) label = u.pathname;
  } catch { /* leave as text */ }
  const target = inApp ? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? clean.replace(/^https?:\/\/(www\.)?btb\.finance/, '') : clean) : clean;
  return (
    <>
      <a href={target} target={inApp ? undefined : '_blank'} rel={inApp ? undefined : 'noopener noreferrer'} style={{ color: btb.green, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3, wordBreak: 'break-all' }}>{label}</a>
      {trail}
    </>
  );
}

function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|https?:\/\/[^\s<>"']+|\[[^\]]+\]\(https?:\/\/[^)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        const md = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(p);
        if (md) return <a key={i} href={md[2]} target={/btb\.finance/i.test(md[2]) ? undefined : '_blank'} rel="noopener noreferrer" style={{ color: btb.green, fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>{md[1]}</a>;
        if (/^https?:\/\//.test(p)) return <AgentLink key={i} href={p}/>;
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} style={{ color: btb.text, fontWeight: 800 }}>{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={i} style={{ background: 'rgba(var(--fg-rgb), 0.09)', padding: '1px 5px', borderRadius: 5, fontSize: 12 }}>{p.slice(1, -1)}</code>;
        }
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
          return <em key={i} style={{ color: btb.textMuted }}>{p.slice(1, -1)}</em>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const splitCells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const isSeparatorRow = (cells: string[]) => cells.every(c => /^:?-{2,}:?$/.test(c));

function AgentMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // markdown table: consecutive |…| rows, separator row dropped
    if (isTableRow(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        const cells = splitCells(lines[i]);
        if (!isSeparatorRow(cells)) rows.push(cells);
        i++;
      }
      i--;
      if (rows.length > 0) {
        out.push(
          <div key={`t${i}`} style={{ overflowX: 'auto', margin: '8px 0' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: '100%' }}>
              <tbody>
                {rows.map((cells, r) => (
                  <tr key={r}>
                    {cells.map((c, ci) => r === 0 ? (
                      <th key={ci} style={{ textAlign: 'left', padding: '5px 10px 5px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.16)', color: btb.textMuted, fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                        <InlineMd text={c}/>
                      </th>
                    ) : (
                      <td key={ci} style={{ padding: '5px 10px 5px 0', borderBottom: '1px solid rgba(var(--fg-rgb), 0.06)', whiteSpace: 'nowrap' }}>
                        <InlineMd text={c}/>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (heading) {
      out.push(<div key={i} style={{ fontWeight: 800, fontSize: 14.5, color: btb.text, margin: '8px 0 4px' }}><InlineMd text={heading[1]}/></div>);
      continue;
    }
    const bullet = line.match(/^\s*[-•]\s+(.*)/) ?? line.match(/^\s*\*\s+(.*)/);
    if (bullet) {
      out.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
          <span style={{ color: 'var(--btb-green)', flexShrink: 0 }}>•</span>
          <span style={{ flex: 1, minWidth: 0 }}><InlineMd text={bullet[1]}/></span>
        </div>
      );
      continue;
    }
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);
    if (numbered) {
      out.push(
        <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
          <span style={{ color: 'var(--btb-green)', fontWeight: 700, flexShrink: 0 }}>{numbered[1]}.</span>
          <span style={{ flex: 1, minWidth: 0 }}><InlineMd text={numbered[2]}/></span>
        </div>
      );
      continue;
    }
    if (!line.trim()) { out.push(<div key={i} style={{ height: 7 }}/>); continue; }
    out.push(<div key={i} style={{ margin: '2px 0' }}><InlineMd text={line}/></div>);
  }
  return <div>{out}</div>;
}

// ─── Live chat (unlocked) ────────────────────────────────────────────────────

type LpSummary = { pair: string; protocol: string; amount0: string; amount1: string; inRange: boolean };

export function AgentChat({ walletAddress, onGetBtb, compact = false }: {
  walletAddress: string; onGetBtb?: () => void; compact?: boolean;
}) {
  const config = useConfig();
  const { positions } = useTokenStore();
  // The chat is private to the wallet: history loads only with a signed
  // session, and the session is asked for on the first send, not on open.
  const session = useWalletSession(walletAddress);
  const history = useQuery(api.agent.history, session.token ? { sessionToken: session.token } : 'skip');
  const sendChat = useAction(api.agentChat.chat);
  const [showTopUp, setShowTopUp] = useState(false);
  const credit = useAlertCredit(walletAddress, { withTreasury: showTopUp });

  const [lps, setLps] = useState<LpSummary[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The agent reads the user's LPs too — same fast path the LP tab uses.
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const client = getPublicClient(config);
        const addr = walletAddress as `0x${string}`;
        if (!client) { setLps([]); return; }
        const ids = await fetchOwnedNftTokenIds(1, addr, [
          UNISWAP_V3_DEPLOYMENT.positionManager, UNISWAP_V4.positionManager, PANCAKE_V3_DEPLOYMENT.positionManager,
        ]).catch(() => null);
        const idsFor = (c: string) => ids?.get(c.toLowerCase());
        const [v3, v4, pk] = await Promise.all([
          fetchV3Positions(client, addr, undefined, idsFor(UNISWAP_V3_DEPLOYMENT.positionManager)).catch(() => []),
          fetchV4Positions(client, addr, idsFor(UNISWAP_V4.positionManager)).catch(() => []),
          fetchPancakePositions(client, addr, idsFor(PANCAKE_V3_DEPLOYMENT.positionManager)).catch(() => []),
        ]);
        if (!on) return;
        setLps([...v3, ...v4, ...pk].map(p => ({
          pair: `${p.symbol0}/${p.symbol1}`,
          protocol: p.protocol,
          amount0: `${parseFloat(formatUnits(p.amount0, p.decimals0)).toPrecision(4)} ${p.symbol0}`,
          amount1: `${parseFloat(formatUnits(p.amount1, p.decimals1)).toPrecision(4)} ${p.symbol1}`,
          inRange: p.inRange,
        })));
      } catch { if (on) setLps([]); }
    })();
    return () => { on = false; };
  }, [walletAddress, config]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history?.length, pending, busy]);

  async function submit(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || busy) return;
    setInput('');
    setErr(null);
    setBusy(true);
    setPending(msg);
    try {
      // What Portfolio shows: every chain's holdings with USD values, so the
      // agent sees the same wallet the user sees, not only the mainnet snapshot.
      const holdings = positions
        .filter((t) => (t.usdValue ?? 0) >= 0.5)
        .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0))
        .slice(0, 60)
        .map((t) => ({ symbol: t.symbol, chainId: t.chainId ?? 1, address: t.address, balance: Number(parseFloat(t.balance ?? '0').toPrecision(6)), usd: Math.round((t.usdValue ?? 0) * 100) / 100 }));
      const extras = JSON.stringify({
        tokens: holdings,
        lps: (lps ?? []).slice(0, 20),
      });
      const sessionToken = await session.ensure();
      await sendChat({ sessionToken, message: msg, extras });
    } catch (e) {
      // Convex wraps action errors in "[CONVEX …] [Request ID: …] Server Error
      // Uncaught Error: <message>\n at …" — show only <message>.
      const raw = (e as Error)?.message ?? 'Something went wrong';
      const m = raw.match(/Uncaught Error:\s*([^\n]+)/);
      const text = /rejected|denied/i.test(raw) ? 'Signature cancelled. The agent needs one signature to keep your chat private.' : (m ? m[1] : raw).trim();
      if (/Sign in again/.test(text)) session.forget();
      if (/free messages/.test(text)) setShowTopUp(true);
      setErr(text);
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const empty = (history?.length ?? 0) === 0 && !pending;

  return (
    <Screen gap={14} style={compact ? { height: '100%', minHeight: 0 } : { maxWidth: 720, margin: '0 auto' }}>
      {/* header */}
      {!compact && <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(var(--fg-rgb), 0.22), rgba(var(--amber-rgb), 0.18))',
          border: '1px solid rgba(var(--fg-rgb), 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="bolt" size={20} color="var(--btb-text)"/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>BTB Agent</div>
          <div style={{ color: btb.textMuted, fontSize: 12 }}>Sees your balances, LPs, Earn positions, and live pool data</div>
        </div>
        <Badge color="var(--btb-green)" bg="rgba(var(--green-rgb), 0.15)" border="1px solid rgba(var(--green-rgb), 0.35)" style={{ flexShrink: 0 }}>
          <span style={{ color: 'var(--btb-green)', fontSize: 11, fontWeight: 700 }}>{fmtBtb(credit.total)} BTB</span>
        </Badge>
      </div>}

      {/* pricing and balance: free messages first, then 1 BTB each */}
      <Glass padding={12} radius={16} soft>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 180, color: btb.textMuted, fontSize: 12.5, lineHeight: 1.45 }}>
            {AGENT_FREE_PER_DAY} free messages a day, then {AGENT_MESSAGE_BTB} BTB each from your BTB balance ({fmtBtb(credit.total)} BTB{credit.rewards > 0 ? ', weekly rewards included' : ''}).
          </span>
          <button type="button" onClick={() => setShowTopUp((o) => !o)} style={{ height: 30, padding: '0 12px', borderRadius: 999, border: '1px solid rgba(var(--green-rgb), 0.4)', background: 'rgba(var(--green-rgb), 0.12)', color: btb.green, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            {showTopUp ? 'Close' : 'Top up'}
          </button>
        </div>
        {showTopUp && (
          <div style={{ marginTop: 10 }}>
            <BtbTopUp credit={credit}/>
            {onGetBtb && <button type="button" onClick={onGetBtb} style={{ marginTop: 8, border: 'none', background: 'transparent', padding: 0, color: btb.green, fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>Need BTB? Swap for some</button>}
          </div>
        )}
        {!session.token && (
          <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 8 }}>Your wallet asks for one signature on your first message. It keeps your chat private and lasts 30 days on this device. No transaction, no gas.</div>
        )}
      </Glass>

      {/* thread */}
      <Glass padding={0} radius={22} style={{ display: 'flex', flexDirection: 'column', minHeight: compact ? 0 : 380, flex: compact ? 1 : undefined }}>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: compact ? undefined : 460, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {empty && (
            <div style={{ margin: 'auto', textAlign: 'center', padding: '30px 16px' }}>
              <div style={{ color: btb.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Ask me anything about your portfolio</div>
              <div style={{ color: btb.textMuted, fontSize: 12.5, marginBottom: 16 }}>
                I can see your tokens, LP positions, Earn deposits, and every pool the app tracks.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340, margin: '0 auto' }}>
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => submit(s)} disabled={busy} style={{
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12.5, fontWeight: 600, textAlign: 'left',
                    background: 'rgba(var(--fg-rgb), 0.05)', border: btb.borderSoft, color: btb.textMuted,
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {(history ?? []).map(m => (
            <div key={m._id} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
              background: m.role === 'user' ? 'rgba(var(--green-rgb), 0.12)' : 'rgba(var(--fg-rgb), 0.06)',
              border: m.role === 'user' ? '1px solid rgba(var(--green-rgb), 0.25)' : btb.borderSoft,
              color: btb.text, fontSize: 13.5, lineHeight: 1.55, wordBreak: 'break-word',
              ...(m.role === 'user' ? { whiteSpace: 'pre-wrap' as const } : {}),
            }}>
              {m.role === 'assistant' ? <AgentMessage content={m.content}/> : m.content}
            </div>
          ))}
          {pending && (
            <div style={{
              alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
              background: 'rgba(var(--green-rgb), 0.12)', border: '1px solid rgba(var(--green-rgb), 0.25)',
              color: btb.text, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>{pending}</div>
          )}
          {busy && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
              <Spinner size={14} color="var(--btb-text)" track="rgba(var(--fg-rgb), 0.18)"/>
              <span style={{ color: btb.textMuted, fontSize: 12.5 }}>Thinking…</span>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {err && (
          <div style={{ padding: '8px 16px', color: btb.loss, fontSize: 12.5, borderTop: btb.borderSoft }}>{err}</div>
        )}

        {/* composer */}
        <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: btb.borderSoft }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask about pools, risk, or your positions…"
            disabled={busy}
            style={{
              flex: 1, minWidth: 0, background: 'rgba(var(--fg-rgb), 0.06)', border: btb.borderSoft,
              borderRadius: 14, padding: '0 14px', height: 44, outline: 'none',
              color: btb.text, fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <Button variant="success" size="sm" onClick={() => submit()} disabled={busy || !input.trim()} style={{ height: 44, width: 76 }}>
            Send
          </Button>
        </div>
      </Glass>

      <div style={{ color: btb.textDim, fontSize: 11, textAlign: 'center', lineHeight: 1.5 }}>
        The agent gives information, not financial advice. It never holds your keys and cannot move funds. {AGENT_FREE_PER_DAY} free messages a day, then {AGENT_MESSAGE_BTB} BTB each.
      </div>
    </Screen>
  );
}
