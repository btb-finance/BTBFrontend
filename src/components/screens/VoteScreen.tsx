'use client';
/**
 * Vote with sAERO on Aero: pick the pools your staked AERO points at, from a list ranked by yearly fees per vote,
 * see what the split should earn, and allocate in one confirmation. Root-chain (Base) gauges only, which need no
 * bridge fee. The ranking comes from convex/aeroVote.ts; the calls from src/lib/aero.ts. Route: /vote.
 */
import { useEffect, useMemo, useState } from 'react';
import { useConnection, useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { useQuery } from 'convex/react';
import { formatUnits, type PublicClient } from 'viem';
import { api } from '../../../convex/_generated/api';
import { Glass } from '../Glass';
import { Button } from '../Button';
import { btb } from '../design-tokens';
import { useTx } from '../../lib/TxTracker';
import { runCalls } from '../../lib/txRunner';
import { readableError } from '../../lib/errorText';
import { useSidebar } from '../../lib/SidebarContext';
import { AERO, AERO_ROOT_CHAIN, buildAllocate, readStakes, yearlyFromVote, type AeroStake, type AeroVotePool } from '../../lib/aero';

const CHAIN = AERO_ROOT_CHAIN;
const tokens = (wei: bigint) => Number(formatUnits(wei, 18));
const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });
const usd = (n: number) => `$${n < 100 ? fmt(n, 2) : fmt(n)}`;

export function VoteScreen({ onConnect }: { onConnect: () => void }) {
  const { address } = useConnection();
  const config = useConfig();
  const { track } = useTx();
  const { isMobile } = useSidebar();
  const live = !!AERO[CHAIN];
  const ranked = useQuery(api.aeroVote.list, live ? { chainId: CHAIN } : 'skip');
  const [stakes, setStakes] = useState<AeroStake[] | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  /** The split being edited: gauge -> weight (relative, shown as %). */
  const [split, setSplit] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; good: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!live || !address) return;
    const client = getPublicClient(config, { chainId: CHAIN as never }) as PublicClient | undefined;
    if (!client) return;
    let off = false;
    readStakes(client, CHAIN, address).then((s) => {
      if (off) return;
      setStakes(s);
      const first = s.find((x) => x.idle + x.onChain > 0n) ?? s[0];
      if (first) {
        setPick((p) => p ?? first.tokenId.toString());
        // Start from the stake's current split.
        setSplit((cur) => Object.keys(cur).length ? cur : Object.fromEntries(first.gauges.map((g) => [g.gauge.toLowerCase(), tokens(g.allocated)])));
      }
    }).catch((e) => !off && setNote({ text: readableError(e, 'Could not read your sAERO.'), good: false }));
    return () => { off = true; };
  }, [live, address, config, nonce]);

  const stake = stakes?.find((s) => s.tokenId.toString() === pick) ?? null;
  const power = stake ? tokens(stake.idle + stake.onChain) : 0;
  const pools = useMemo(() => ranked?.pools ?? [], [ranked]);
  const byGauge = useMemo(() => new Map(pools.map((p) => [p.gauge.toLowerCase(), p])), [pools]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (q ? pools.filter((p) => p.pair.toLowerCase().includes(q) || p.pool.toLowerCase() === q) : pools).slice(0, 60);
  }, [pools, search]);
  const totalWeight = Object.values(split).reduce((a, w) => a + (w > 0 ? w : 0), 0);
  const rows = Object.entries(split).filter(([, w]) => w > 0).map(([gauge, w]) => {
    const p = byGauge.get(gauge);
    const myVotes = totalWeight > 0 ? power * (w / totalWeight) : 0;
    return { gauge, weight: w, pct: totalWeight > 0 ? (w / totalWeight) * 100 : 0, pool: p, yearly: p ? yearlyFromVote(p, myVotes) : 0 };
  });
  const yearly = rows.reduce((a, r) => a + r.yearly, 0);
  const powerUsd = power * (ranked?.aeroUsd ?? 0);

  function choose(s: AeroStake) {
    setPick(s.tokenId.toString());
    setSplit(Object.fromEntries(s.gauges.map((g) => [g.gauge.toLowerCase(), tokens(g.allocated)])));
    setNote(null);
  }
  async function allocate() {
    if (!stake || !address) return;
    setBusy(true); setNote(null);
    try {
      const call = buildAllocate(CHAIN, stake, rows.map((r) => ({ gauge: r.gauge as `0x${string}`, weight: r.weight })), address);
      await runCalls(config, { account: address, calls: [call], label: 'Allocate sAERO', track, chainId: CHAIN });
      setNote({ text: 'Allocated. Your votes now earn from these pools; you can change them again after the cooldown (about 47 hours).', good: true });
      setNonce((n) => n + 1);
    } catch (e) {
      setNote({ text: readableError(e, 'The allocation did not go through.'), good: false });
    } finally { setBusy(false); }
  }

  const th: React.CSSProperties = { color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3, padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '8px 10px', fontSize: 12.5, color: btb.textMuted, whiteSpace: 'nowrap', borderTop: '1px solid rgba(var(--fg-rgb), 0.05)' };
  const input: React.CSSProperties = { height: 34, borderRadius: 10, border: btb.borderSoft, background: 'transparent', color: btb.text, padding: '0 10px', fontFamily: 'inherit', fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1000, margin: '0 auto' }}>
      <div>
        <div style={{ color: btb.text, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Vote with your sAERO</div>
        <div style={{ color: btb.textMuted, fontSize: 13, marginTop: 4, lineHeight: 1.5, maxWidth: 720 }}>
          On Aero, staked AERO (sAERO) earns the trading fees of the pools you point it at. Pools with high fees and few votes pay the most per vote. Pick your pools, see what the split should earn, and allocate in one step. You can change it again after about 47 hours; power you leave unallocated earns nothing.
        </div>
      </div>

      {!live ? (
        <Glass padding={16} radius={16} soft>
          <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>Opens with Aero</div>
          <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>Aero voting starts once its Base contracts are published (first allocation round Oct 23, 00:00 UTC). This page goes live then.</div>
        </Glass>
      ) : !address ? (
        <Glass padding={16} radius={16} soft>
          <div style={{ color: btb.textMuted, fontSize: 13, marginBottom: 10 }}>Connect the wallet that holds your sAERO.</div>
          <Button size="md" onClick={onConnect}>Connect wallet</Button>
        </Glass>
      ) : (
        <>
          <Glass padding={14} radius={16} soft>
            <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .3, marginBottom: 8 }}>Your sAERO</div>
            {stakes == null ? <div style={{ color: btb.textDim, fontSize: 12.5 }}>Reading your stakes…</div>
              : stakes.length === 0 ? <div style={{ color: btb.textMuted, fontSize: 12.5 }}>This wallet holds no sAERO on Base.</div>
              : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stakes.map((s) => {
                    const on = s.tokenId.toString() === pick;
                    return (
                      <button key={s.tokenId.toString()} type="button" onClick={() => choose(s)} style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', border: on ? '1px solid rgba(var(--green-rgb), 0.45)' : btb.borderSoft, background: on ? 'rgba(var(--green-rgb), 0.08)' : 'transparent' }}>
                        <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 800 }}>#{s.tokenId.toString()} · {fmt(tokens(s.idle + s.onChain))} AERO</div>
                        <div style={{ color: s.idle > 0n ? btb.amber : btb.textDim, fontSize: 11.5, marginTop: 2 }}>
                          {s.idle > 0n ? `${fmt(tokens(s.idle))} not allocated, earning nothing` : `${s.gauges.length} pool${s.gauges.length === 1 ? '' : 's'}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
          </Glass>

          {stake && (
            <Glass padding={14} radius={16} soft>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ color: btb.text, fontSize: 15, fontWeight: 800 }}>Your split</div>
                <div style={{ color: btb.textMuted, fontSize: 12.5 }}>
                  Estimated <b style={{ color: btb.green }}>{usd(yearly)} a year</b>{powerUsd > 0 && yearly > 0 ? ` (${fmt((yearly / powerUsd) * 100, 1)}% on ${usd(powerUsd)} of AERO)` : ''}
                </div>
              </div>
              {rows.length === 0 ? (
                <div style={{ color: btb.textDim, fontSize: 12.5, marginTop: 8 }}>Add pools from the list below.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {rows.map((r) => (
                    <div key={r.gauge} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '1.4fr 120px 110px 140px auto', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: 'rgba(var(--fg-rgb), 0.035)' }}>
                      <span style={{ color: btb.text, fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pool?.pair ?? `${r.gauge.slice(0, 8)}…`}</span>
                      <input type="number" min={0} value={Math.round(r.pct * 10) / 10} onChange={(e) => {
                        const pct = Math.max(0, Number(e.target.value) || 0);
                        // Edit in percent: scale this pool's weight so it takes `pct` of the total.
                        const others = totalWeight - r.weight;
                        setSplit((s) => ({ ...s, [r.gauge]: pct >= 100 || others <= 0 ? (others > 0 ? others * 99 : 1) : (pct / (100 - pct)) * others }));
                      }} style={{ ...input, width: '100%' }} aria-label="Share in percent"/>
                      {!isMobile && <span style={{ fontSize: 12.5, color: btb.textMuted }}>{fmt(r.pct, 1)}% · {fmt(power * r.pct / 100)}</span>}
                      {!isMobile && <span style={{ fontSize: 12.5, color: btb.green, fontWeight: 700 }}>{usd(r.yearly)} / yr</span>}
                      <span onClick={() => setSplit((s) => { const n = { ...s }; delete n[r.gauge]; return n; })} style={{ color: btb.textDim, fontSize: 12, cursor: 'pointer', textAlign: 'right' }}>remove</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                <Button size="md" variant="success" onClick={allocate} loading={busy} disabled={busy || rows.length === 0 || power === 0}>Allocate {fmt(power)} AERO</Button>
                <span style={{ color: btb.textDim, fontSize: 11.5 }}>Pools left out are cleared. One confirmation, no bridge fee.</span>
              </div>
              {note && <div style={{ color: note.good ? btb.green : btb.amber, fontSize: 12, marginTop: 8, lineHeight: 1.5 }}>{note.text}</div>}
            </Glass>
          )}

          <Glass padding={0} radius={16} soft>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 14px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: btb.text, fontSize: 15, fontWeight: 800 }}>Pools, best return per vote first</div>
                <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 2 }}>Yearly fees per AERO of votes, from 24h volume and the votes already there.{ranked?.updatedAt ? ` Updated ${Math.max(1, Math.round((Date.now() - ranked.updatedAt) / 60_000))} min ago.` : ''}</div>
              </div>
              <input placeholder="Search pair" value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...input, width: isMobile ? '100%' : 200 }}/>
            </div>
            {ranked === undefined ? <div style={{ padding: 14, color: btb.textDim, fontSize: 12.5 }}>Loading pools…</div>
              : !ranked || pools.length === 0 ? <div style={{ padding: 14, color: btb.textMuted, fontSize: 12.5 }}>No pools ranked yet; the list refreshes every hour.</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
                    <thead><tr>{['Pool', 'Fee', 'Fees 24h', 'Votes', 'Per vote', ''].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {shown.map((p: AeroVotePool) => {
                        const added = (split[p.gauge.toLowerCase()] ?? 0) > 0;
                        return (
                          <tr key={p.gauge}>
                            <td style={{ ...td, color: btb.text, fontWeight: 700 }}>{p.pair}<span style={{ color: btb.textDim, fontWeight: 500, marginLeft: 6 }}>{p.kind === 'cl' ? 'CL' : p.kind}</span></td>
                            <td style={td}>{fmt(p.fee * 100, 3)}%</td>
                            <td style={td}>{usd(p.fees24hUsd)}</td>
                            <td style={td}>{fmt(p.votes)}</td>
                            <td style={{ ...td, color: btb.green, fontWeight: 800 }}>{p.aprPerVote == null ? (p.fees24hUsd > 0 ? 'no votes yet' : '-') : `${fmt(p.aprPerVote, 1)}%`}</td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              <button type="button" disabled={!stake} onClick={() => setSplit((s) => ({ ...s, [p.gauge.toLowerCase()]: added ? 0 : (totalWeight > 0 ? totalWeight / Math.max(1, rows.length) : 1) }))}
                                style={{ height: 28, padding: '0 12px', borderRadius: 999, cursor: stake ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, border: added ? btb.borderSoft : '1px solid rgba(var(--green-rgb), 0.4)', background: added ? 'transparent' : 'rgba(var(--green-rgb), 0.1)', color: added ? btb.textMuted : btb.green }}>
                                {added ? 'Remove' : 'Add'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </Glass>
        </>
      )}
    </div>
  );
}
