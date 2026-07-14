'use client';
import { useEffect, useRef, useState } from 'react';
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
import { CONTRACTS } from '../../lib/wagmi';
import { useYearnVaults, useYearnPositions } from '../../lib/yearn';
import { fetchOwnedNftTokenIds } from '../../lib/alchemy';
import { api } from '../../../convex/_generated/api';
import {
  fetchV3Positions, fetchV4Positions, UNISWAP_V3_DEPLOYMENT,
} from '@/protocols/dexs/uniswap';
import { UNISWAP_V4 } from '@/protocols/dexs/uniswap/v4/addresses';
import { fetchPancakePositions, PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';

/** Agent access is gated to committed holders: 10M BTB in the wallet.
 * Mirrored server-side in convex/agentChat.ts — the UI gate is cosmetic. */
const AGENT_REQUIRED_BTB = 10_000_000;

const SUGGESTIONS = [
  'Where should I LP based on my holdings?',
  'Analyze my portfolio risk',
  'Best low risk stable yield for me?',
];

const CAPABILITIES = [
  { icon: 'pie',    color: '#FFFFFF', bg: 'rgba(255,255,255,0.08)',  title: 'Reads your portfolio',     desc: 'Sees every balance, position, and price across all your tokens.' },
  { icon: 'chart',  color: '#52E3A4', bg: 'rgba(82,227,164,0.12)',   title: 'Knows the market',         desc: 'Has live TVL, volume, and APR for every pool on Discover and Earn.' },
  { icon: 'shield', color: '#FFB36B', bg: 'rgba(255,179,107,0.15)',  title: 'Talks risk honestly',      desc: 'Flags impermanent loss, thin pools, and out of range positions.' },
  { icon: 'send',   color: '#94A3B8', bg: 'rgba(148,163,184,0.15)',  title: 'Suggests next moves',      desc: 'Recommends LPs and vaults sized to what you actually hold.' },
];

export function StakeScreen({ onGetBtb }: { onGetBtb?: () => void } = {}) {
  const { tokens, walletAddress } = useTokenStore();
  const btbToken = tokens.find(t => t.address.toLowerCase() === CONTRACTS.BTB.toLowerCase());
  const balance = parseFloat(btbToken?.balance ?? '0');
  const hasAccess = balance >= AGENT_REQUIRED_BTB;
  const progress = Math.min(balance / AGENT_REQUIRED_BTB, 1);
  const fmtM = (n: number) => n >= 1e6 ? `${(n / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M` : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

  if (hasAccess && walletAddress) {
    return <AgentChat walletAddress={walletAddress} btbBalance={fmtM(balance)}/>;
  }

  return (
    <Screen gap={18} style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Badge color="#FFB36B" bg="rgba(255,179,107,0.15)" border="1px solid rgba(255,179,107,0.35)"
          style={{ gap: 6, padding: '6px 12px', fontSize: 12 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFB36B', boxShadow: '0 0 8px #FFB36B' }}/>
          <span style={{ color: '#FFB36B', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>HOLDERS ONLY</span>
        </Badge>
      </div>

      {/* holder gate: 10M BTB unlocks the Agent */}
      <Glass padding={18} radius={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'rgba(255,179,107,0.12)', border: '1px solid rgba(255,179,107,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="lock" size={20} color="#FFB36B"/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: btb.text, fontSize: 15, fontWeight: 800 }}>Hold 10M BTB to unlock the Agent</div>
            <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 2 }}>
              {!walletAddress
                ? 'Connect a wallet to check your balance.'
                : `You hold ${fmtM(balance)} of ${fmtM(AGENT_REQUIRED_BTB)} BTB needed.`}
            </div>
          </div>
        </div>
        {walletAddress && (
          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${progress * 100}%`, height: '100%', background: btb.gradGreen, borderRadius: 999 }}/>
          </div>
        )}
        {onGetBtb && (
          <Button variant="success" size="sm" fullWidth icon="swap" onClick={onGetBtb} style={{ height: 42 }}>
            Get BTB
          </Button>
        )}
      </Glass>

      {/* hero */}
      <Glass padding={28} radius={28} strong style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 0%, rgba(255,255,255,0.18), transparent 55%), radial-gradient(circle at 80% 100%, rgba(255,179,107,0.18), transparent 55%)',
          pointerEvents: 'none',
        }}/>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 76, height: 76, borderRadius: 24, margin: '0 auto 18px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,179,107,0.18))',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(255,179,107,0.25), inset 0 1px 0 rgba(255,255,255,0.3)',
          }}>
            <Icon name="bolt" size={36} color="#fff"/>
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

function InlineMd({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} style={{ color: btb.text, fontWeight: 800 }}>{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith('`') && p.endsWith('`')) {
          return <code key={i} style={{ background: 'rgba(255,255,255,0.09)', padding: '1px 5px', borderRadius: 5, fontSize: 12 }}>{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

function AgentMessage({ content }: { content: string }) {
  return (
    <div>
      {content.split('\n').map((line, i) => {
        const heading = line.match(/^#{1,4}\s+(.*)/);
        if (heading) {
          return <div key={i} style={{ fontWeight: 800, fontSize: 14.5, color: btb.text, margin: '8px 0 4px' }}><InlineMd text={heading[1]}/></div>;
        }
        const bullet = line.match(/^\s*[-*•]\s+(.*)/);
        if (bullet) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
              <span style={{ color: '#52E3A4', flexShrink: 0 }}>•</span>
              <span style={{ flex: 1, minWidth: 0 }}><InlineMd text={bullet[1]}/></span>
            </div>
          );
        }
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)/);
        if (numbered) {
          return (
            <div key={i} style={{ display: 'flex', gap: 8, margin: '3px 0' }}>
              <span style={{ color: '#52E3A4', fontWeight: 700, flexShrink: 0 }}>{numbered[1]}.</span>
              <span style={{ flex: 1, minWidth: 0 }}><InlineMd text={numbered[2]}/></span>
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: 7 }}/>;
        return <div key={i} style={{ margin: '2px 0' }}><InlineMd text={line}/></div>;
      })}
    </div>
  );
}

// ─── Live chat (unlocked) ────────────────────────────────────────────────────

type LpSummary = { pair: string; protocol: string; amount0: string; amount1: string; inRange: boolean };

function AgentChat({ walletAddress, btbBalance }: { walletAddress: string; btbBalance: string }) {
  const config = useConfig();
  const history = useQuery(api.agent.history, { walletAddress });
  const sendChat = useAction(api.agentChat.chat);
  const { vaults } = useYearnVaults();
  const { positions: yearnPositions } = useYearnPositions(walletAddress, vaults);

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
        const ids = await fetchOwnedNftTokenIds(addr, [
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
      const extras = JSON.stringify({
        lps: (lps ?? []).slice(0, 20),
        yearn: yearnPositions.slice(0, 20).map(p => ({
          vault: p.vault.name, token: p.vault.token.symbol,
          amount: p.underlying.toPrecision(5), usd: Math.round(p.usd),
        })),
      });
      await sendChat({ walletAddress, message: msg, extras });
    } catch (e) {
      // Convex wraps action errors in "[CONVEX …] [Request ID: …] Server Error
      // Uncaught Error: <message>\n at …" — show only <message>.
      const raw = (e as Error)?.message ?? 'Something went wrong';
      const m = raw.match(/Uncaught Error:\s*([^\n]+)/);
      setErr((m ? m[1] : raw).trim());
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const empty = (history?.length ?? 0) === 0 && !pending;

  return (
    <Screen gap={14} style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,179,107,0.18))',
          border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="bolt" size={20} color="#fff"/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}>BTB Agent</div>
          <div style={{ color: btb.textMuted, fontSize: 12 }}>Sees your balances, LPs, Earn positions, and live pool data</div>
        </div>
        <Badge color="#52E3A4" bg="rgba(82,227,164,0.15)" border="1px solid rgba(82,227,164,0.35)" style={{ gap: 6, flexShrink: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#52E3A4', boxShadow: '0 0 8px #52E3A4' }}/>
          <span style={{ color: '#52E3A4', fontSize: 11, fontWeight: 700 }}>{btbBalance} BTB</span>
        </Badge>
      </div>

      {/* thread */}
      <Glass padding={0} radius={22} style={{ display: 'flex', flexDirection: 'column', minHeight: 380 }}>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 460, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                    background: 'rgba(255,255,255,0.05)', border: btb.borderSoft, color: btb.textMuted,
                  }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {(history ?? []).map(m => (
            <div key={m._id} style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
              background: m.role === 'user' ? 'rgba(82,227,164,0.12)' : 'rgba(255,255,255,0.06)',
              border: m.role === 'user' ? '1px solid rgba(82,227,164,0.25)' : btb.borderSoft,
              color: btb.text, fontSize: 13.5, lineHeight: 1.55, wordBreak: 'break-word',
              ...(m.role === 'user' ? { whiteSpace: 'pre-wrap' as const } : {}),
            }}>
              {m.role === 'assistant' ? <AgentMessage content={m.content}/> : m.content}
            </div>
          ))}
          {pending && (
            <div style={{
              alignSelf: 'flex-end', maxWidth: '85%', padding: '10px 14px', borderRadius: 16,
              background: 'rgba(82,227,164,0.12)', border: '1px solid rgba(82,227,164,0.25)',
              color: btb.text, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>{pending}</div>
          )}
          {busy && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
              <Spinner size={14} color="#fff" track="rgba(255,255,255,0.18)"/>
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
              flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.06)', border: btb.borderSoft,
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
        The agent gives information, not financial advice. It never holds your keys and cannot move funds. 50 messages per day.
      </div>
    </Screen>
  );
}
