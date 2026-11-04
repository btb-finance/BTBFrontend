'use client';
/**
 * Token Scan: grade any token on safety, liquidity, holder spread and flow,
 * plus the LP range it calls for. One wallet pays SCAN_BTB to run a scan;
 * everyone then reads that scan free for 24 hours. Route: /scan?chain=base&token=0x…
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAction, useQuery } from 'convex/react';
import { useConnection } from 'wagmi';
import { api } from '../../../convex/_generated/api';
import { RESCAN_BTB, RESCAN_MIN_AGE_MS, SCAN_BTB, SCAN_CHAINS, SCAN_TTL_MS, chainBySlug, letterFor, lpBacktest, lpEarnings, withPool, type ScanPool, type ScanResult, type Tone } from '../../../convex/tokenScanConfig';
import { CreatePosition } from '../CreatePosition';
import type { LpChainId, LpDex } from '@/protocols/lpChains';
import { Glass } from '../Glass';
import { Button } from '../Button';
import { TokenIcon } from '../TokenIcon';
import { ChainLogo } from '../ChainLogo';
import { btb } from '../design-tokens';
import { useSidebar } from '../../lib/SidebarContext';
import { useAlertCredit, useSignedCall } from '../../lib/alerts';
import { TopUpModal, fmtBtb } from '../FastAlerts';

// ── Formatting ──────────────────────────────────────────────────────────────

const TONE: Record<Tone, string> = { good: btb.green, warn: btb.amber, bad: btb.loss };
const tint = (c: string, pct = 14) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
const STANCE = {
  good: { label: 'Good for LP', tone: 'good' as Tone },
  careful: { label: 'LP with care', tone: 'warn' as Tone },
  avoid: { label: 'Avoid LP for now', tone: 'bad' as Tone },
};

function usd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}
const num = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString('en-US'));
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const ordinal = (n: number) => {
  const r = Math.round(n), t = r % 100;
  return `${r}${t >= 11 && t <= 13 ? 'th' : r % 10 === 1 ? 'st' : r % 10 === 2 ? 'nd' : r % 10 === 3 ? 'rd' : 'th'}`;
};
function ago(t: number): string {
  const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)} days ago`;
}
const dayLabel = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
/** Share of fleet values below `v` (ties count half), 0..100. */
function rankOf(sorted: number[], v: number): number {
  if (!sorted.length) return 0;
  let below = 0, equal = 0;
  for (const x of sorted) { if (x < v) below++; else if (x === v) equal++; }
  return ((below + equal / 2) / sorted.length) * 100;
}

// ── Add LP handoff ──────────────────────────────────────────────────────────

type Range = { lowerPct: number; upperPct: number };
type OnLp = (t: LpTarget, simulate: boolean) => void;

type LpTarget = { pool: ScanPool; chainId: LpChainId; dex: LpDex; tokenA?: `0x${string}`; tokenB?: `0x${string}`; v4PoolId?: `0x${string}`; initialPool?: string };

/** The scan's pool as Add LP props, or null when the app cannot add liquidity there (V2 pools, other DEXes and chains). */
function lpTargetFor(chainId: number, token: string, p: ScanPool): LpTarget | null {
  if (chainId !== 1 && chainId !== 8453 && chainId !== 56 && chainId !== 4663) return null;
  if (!/^0x[0-9a-f]{40}$/i.test(p.quoteAddress ?? '')) return null;
  const v = (p.version ?? '').toLowerCase();
  const pair = { tokenA: token as `0x${string}`, tokenB: p.quoteAddress as `0x${string}` };
  if (p.dex === 'uniswap' && v === 'v4' && /^0x[0-9a-fA-F]{64}$/.test(p.pair)) return { pool: p, chainId, dex: 'uniswap', v4PoolId: p.pair as `0x${string}` };
  if (p.dex === 'uniswap' && v === 'v3') return { pool: p, chainId, dex: 'uniswap', ...pair, initialPool: p.pair };
  if (p.dex === 'pancakeswap' && chainId !== 4663 && (v === '' || v === 'v3')) return { pool: p, chainId, dex: 'pancakeswap', ...pair, initialPool: p.pair };
  // Aero (the new deployment, after Aerodrome) on Base and Robinhood Chain; old Aerodrome pools only on Base.
  if (p.dex === 'aero' && (chainId === 8453 || chainId === 4663)) return { pool: p, chainId, dex: 'aero', ...pair, initialPool: p.pair };
  if (p.dex === 'aerodrome' && chainId === 8453) return { pool: p, chainId, dex: 'aerodrome', ...pair, initialPool: p.pair };
  if (p.dex === 'sushiswap' && (chainId === 1 || chainId === 4663) && v === 'v3') return { pool: p, chainId, dex: 'sushiswap', ...pair, initialPool: p.pair };
  return null;
}

/** DexScreener's exchange ids as people know them. Aerodrome is the old deployment that Aero replaced. */
const DEX_NAMES: Record<string, string> = {
  uniswap: 'Uniswap', pancakeswap: 'PancakeSwap', sushiswap: 'SushiSwap', aero: 'Aero', aerodrome: 'Aerodrome (old)',
  metric: 'Metric', balancer: 'Balancer', curve: 'Curve', velodrome: 'Velodrome (old)', camelot: 'Camelot',
};
const dexName = (id: string) => DEX_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

function readUrl(): { chainId: number; token: string } | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const chainId = chainBySlug(q.get('chain') ?? '');
  const token = (q.get('token') ?? '').trim();
  return chainId && /^0x[0-9a-fA-F]{40}$/.test(token) ? { chainId, token: token.toLowerCase() } : null;
}

// ── Filling gaps in older scans ─────────────────────────────────────────────

type Fill = { key: string; fees: Record<string, number>; history: [number, number][]; volumes: [number, number][] };

/**
 * Scans saved before fee rates and price history were added, or whose GeckoTerminal calls were refused, are missing
 * them. While the page is open those are fetched live (free, from the reader's browser) and merged in, so Steps 2
 * and 3 and the backtest work without a rescan. `filling` is true until the fetch settles.
 */
function useFilledScan(d: ScanResult | null): { data: ScanResult | null; filling: boolean } {
  const pools = useMemo(() => (d ? d.lp.pools ?? (d.lp.pool ? [d.lp.pool] : []) : []), [d]);
  const key = d ? `${d.chainId}:${d.token}` : '';
  // Fees are fetched only when the scan has no fee for its own pool; history only when it has none at all.
  const needFees = !!d && d.lp.feePct == null && pools.some((p) => p.feePct == null);
  const needHistory = !!d && !(d.history?.length) && pools.length > 0;
  const [fill, setFill] = useState<Fill | null>(null);
  useEffect(() => {
    if (!d || (!needFees && !needHistory)) return;
    const net = SCAN_CHAINS[d.chainId]?.gecko;
    if (!net) return;
    let live = true;
    const base = `https://api.geckoterminal.com/api/v2/networks/${net}/pools`;
    const get = (u: string) => fetch(u, { signal: AbortSignal.timeout(12_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    void Promise.all([
      needFees ? get(`${base}/multi/${pools.slice(0, 10).map((p) => p.pair).join(',')}`) : Promise.resolve(null),
      needHistory ? get(`${base}/${pools[0].pair}/ohlcv/day?limit=30&currency=usd&token=${d.token}`) : Promise.resolve(null),
    ]).then(([multi, ohlcv]) => {
      if (!live) return;
      const fees: Record<string, number> = {};
      for (const x of (multi?.data ?? []) as { attributes: { address: string; pool_fee_percentage?: string | null } }[]) {
        const f = Number(x.attributes.pool_fee_percentage);
        if (Number.isFinite(f) && f > 0) fees[x.attributes.address.toLowerCase()] = f;
      }
      const rows = ((ohlcv?.data?.attributes?.ohlcv_list ?? []) as number[][]).filter((r) => r[4] > 0).sort((a, b) => a[0] - b[0]);
      setFill({ key, fees, history: rows.map((r) => [r[0], r[4]]), volumes: rows.map((r) => [r[0], r[5] || 0]) });
    });
    return () => { live = false; };
  }, [d, key, needFees, needHistory, pools]);

  const data = useMemo<ScanResult | null>(() => {
    if (!d || !fill || fill.key !== key) return d;
    const withFees = pools.map((p) => {
      const f = p.feePct ?? fill.fees[p.pair.toLowerCase()] ?? null;
      return { ...p, feePct: f, feeApr: p.feeApr ?? (f != null && p.liquidityUsd > 0 ? (p.volume24hUsd * (f / 100) / p.liquidityUsd) * 365 : null) };
    });
    const floor = Math.max(25_000, (withFees[0]?.liquidityUsd ?? 0) * 0.1);
    const best = withFees.filter((p) => p.feeApr != null && p.liquidityUsd >= floor && p.dex !== 'aerodrome' && p.dex !== 'velodrome')
      .sort((a, b) => (b.feeApr ?? 0) - (a.feeApr ?? 0))[0];
    const current = withFees.find((p) => p.pair === d.lp.pool?.pair);
    const pool = current?.feePct != null ? current : best ?? current ?? d.lp.pool;
    const history = d.history?.length ? d.history : fill.history.length ? fill.history : undefined;
    const volumeHistory = d.volumeHistory?.length ? d.volumeHistory : fill.volumes.length ? fill.volumes : undefined;
    const merged: ScanResult = {
      ...d, history, volumeHistory,
      lp: { ...d.lp, pools: withFees, pool: pool ?? null, feePct: d.lp.feePct ?? pool?.feePct ?? null, bestPair: d.lp.bestPair ?? best?.pair ?? null },
    };
    return withPool({ ...merged, lp: { ...merged.lp, pool: withFees[0] ?? merged.lp.pool, volumeScale: 1 } }, pool?.pair ?? null);
  }, [d, fill, key, pools]);

  return { data, filling: !!d && (needFees || needHistory) && fill?.key !== key };
}

// ── Screen ──────────────────────────────────────────────────────────────────

export function ScanScreen({ onConnect }: { onConnect: () => void }) {
  const { address } = useConnection();
  const initial = useMemo(() => readUrl(), []);
  const [chainId, setChainId] = useState<number>(initial?.chainId ?? 8453);
  const [input, setInput] = useState(initial?.token ?? '');
  const [target, setTarget] = useState<{ chainId: number; token: string } | null>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTopUp, setShowTopUp] = useState(false);
  const [lpSheet, setLpSheet] = useState<{ target: LpTarget; simulate: boolean; range: Range } | null>(null);

  const scanRow = useQuery(api.tokenScan.forToken, target ?? 'skip');
  const recent = useQuery(api.tokenScan.recent, {});
  const runScan = useAction(api.tokenScanActions.scan);
  const signed = useSignedCall(address);
  const credit = useAlertCredit(address, { withTreasury: showTopUp });

  // Re-render once a minute so "scanned 3h ago" and the expiry stay right; an expired scan flips to the paid state.
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);

  function open(next: { chainId: number; token: string }) {
    setErr(null);
    setTarget(next);
    setChainId(next.chainId);
    setInput(next.token);
    const slug = SCAN_CHAINS[next.chainId]?.slug ?? String(next.chainId);
    window.history.replaceState(null, '', `/scan?chain=${slug}&token=${next.token}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submit() {
    const token = input.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(token)) { setErr('Paste a token contract address (0x followed by 40 characters).'); return; }
    open({ chainId, token: token.toLowerCase() });
  }

  /** Fresh data for a token whose scan is still open. Pays RESCAN_BTB; free if someone else just refreshed it. */
  async function rescan() {
    if (!target || !scanRow) return;
    if (!address) { onConnect(); return; }
    if (credit.total < RESCAN_BTB) { setShowTopUp(true); return; }
    setBusy(true); setErr(null);
    try {
      const res = await signed.run((sessionToken) => runScan({ sessionToken, ...target, rescan: true, seenAt: scanRow.createdAt }));
      if (res && !res.ok) setErr(res.reason ?? 'Rescan failed. Nothing was charged.');
    } catch (e) {
      setErr((e as Error).message || 'Rescan failed. Nothing was charged.');
    } finally { setBusy(false); }
  }

  async function pay() {
    if (!target) return;
    if (!address) { onConnect(); return; }
    if (credit.total < SCAN_BTB) { setShowTopUp(true); return; }
    setBusy(true); setErr(null);
    try {
      const res = await signed.run((sessionToken) => runScan({ sessionToken, ...target }));
      if (res && !res.ok) setErr(res.reason ?? 'Scan failed. Nothing was charged.');
    } catch (e) {
      setErr((e as Error).message || 'Scan failed. Nothing was charged.');
    } finally { setBusy(false); }
  }

  const stored = useMemo<ScanResult | null>(() => {
    if (!scanRow?.fresh || !scanRow.data) return null;
    try { return JSON.parse(scanRow.data) as ScanResult; } catch { return null; }
  }, [scanRow]);
  const { data, filling } = useFilledScan(stored);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1180, margin: '0 auto', width: '100%' }}>
      {!target ? (
        <Landing search={<SearchBar bare chainId={chainId} setChainId={setChainId} input={input} setInput={setInput} onSubmit={submit} err={err}/>}/>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button onClick={() => { setTarget(null); setInput(''); window.history.replaceState(null, '', '/scan'); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px 0 10px', borderRadius: 999, border: btb.borderSoft, background: btb.surface, color: btb.text, fontFamily: 'inherit', fontSize: 13, fontWeight: 750, cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
              Token Scan
            </button>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip>{SCAN_BTB} BTB a scan</Chip>
              <Chip>{RESCAN_BTB} BTB to rescan</Chip>
              <Chip>Free to read for 24h after</Chip>
            </div>
          </div>
          <SearchBar chainId={chainId} setChainId={setChainId} input={input} setInput={setInput} onSubmit={submit} err={err}/>
        </>
      )}

      {target && scanRow === undefined && <Glass padding={22} radius={24}><div style={{ color: btb.textMuted, fontSize: 14 }}>Looking for a recent scan…</div></Glass>}

      {target && scanRow !== undefined && !data && (
        <PaywallCard
          target={target} last={scanRow ? { at: scanRow.createdAt, symbol: scanRow.symbol, score: scanRow.score } : null}
          address={address} balance={credit.total} busy={busy} onPay={pay}/>
      )}

      {data && scanRow && <ScanView key={`${data.chainId}:${data.token}:${scanRow.createdAt}`} d={data} createdAt={scanRow.createdAt} onLp={(t, simulate, range) => setLpSheet({ target: t, simulate, range })}
        refresh={{ onClick: rescan, busy, err, canPay: !address || credit.total >= RESCAN_BTB }} filling={filling}/>}

      {recent && recent.length > 0 && (
        <div>
          <SectionTitle title="Open now, free to read" sub="Someone paid for these in the last 24 hours. Tap one to read it."
            right={<span style={{ color: btb.textDim, fontSize: 12.5, fontWeight: 700 }}>{recent.length} open</span>}/>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {recent.map((r) => {
              const active = target?.chainId === r.chainId && target.token === r.token;
              const stance = STANCE[r.stance as keyof typeof STANCE] ?? STANCE.careful;
              return (
                <button aria-label={`Open the ${r.symbol} scan`} key={`${r.chainId}:${r.token}`} onClick={() => open({ chainId: r.chainId, token: r.token })} className="btb-glass"
                  style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 22, border: active ? btb.border : btb.borderSoft, background: active ? btb.surfaceStrong : btb.glass, color: btb.text, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                      <TokenIcon symbol={r.symbol} size={42} logoUrl={r.logo ?? undefined}/>
                      <span style={{ position: 'absolute', right: -3, bottom: -3, borderRadius: 999, border: `2px solid ${btb.bg}`, display: 'flex' }}><ChainLogo chainId={r.chainId} size={16}/></span>
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 16, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.symbol}</span>
                      <span style={{ display: 'block', color: btb.textMuted, fontSize: 12, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{r.score}</span>
                      <GradeTile score={r.score} size={38}/>
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: btb.text, fontSize: 13, fontWeight: 650, minHeight: 18 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: TONE[(r.tone as Tone) ?? 'good'] ?? btb.green, flexShrink: 0 }}/>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.headline || 'Open to read'}</span>
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, width: '100%' }}>
                    <Chip tone={stance.tone}>{stance.label}</Chip>
                    <span style={{ color: btb.textDim, fontSize: 12, fontWeight: 650 }}>{ago(r.createdAt)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {lpSheet && data && (
        <CreatePosition
          key={`${lpSheet.target.pool.pair}:${lpSheet.simulate}`}
          chainId={lpSheet.target.chainId}
          dex={lpSheet.target.dex}
          tokenA={lpSheet.target.tokenA}
          tokenB={lpSheet.target.tokenB}
          v4PoolId={lpSheet.target.v4PoolId}
          initialPool={lpSheet.target.initialPool}
          initialRangePct={{ token: data.token, lowerPct: lpSheet.range.lowerPct, upperPct: lpSheet.range.upperPct }}
          noHooks
          simulate={lpSheet.simulate}
          onClose={() => setLpSheet(null)}
          onDone={() => setLpSheet(null)}
        />
      )}
      {showTopUp && <TopUpModal credit={credit} onClose={() => setShowTopUp(false)}/>}
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────

function Chip({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const c = tone ? TONE[tone] : btb.textMuted;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', borderRadius: 999, background: tone ? tint(c) : btb.surface, border: tone ? 'none' : btb.borderSoft, color: tone ? c : btb.textMuted, fontSize: 12, fontWeight: 750, whiteSpace: 'nowrap' }}>
      {tone && <span style={{ width: 6, height: 6, borderRadius: 3, background: c }}/>}
      {children}
    </span>
  );
}

function Delta({ value, suffix = '%', invert = false }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.05) return null;
  const up = value > 0;
  const good = invert ? !up : up;
  const c = good ? btb.green : btb.loss;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 7, background: tint(c, 16), color: c, fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><path d={up ? 'M4 1L7.5 7H0.5Z' : 'M4 7L0.5 1H7.5Z'} fill={c}/></svg>
      {up ? '+' : ''}{value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}{suffix}
    </span>
  );
}

function SectionTitle({ title, sub, right, step }: { title: string; sub?: string; right?: ReactNode; step?: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, margin: '4px 2px 10px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: btb.text, fontSize: 16.5, fontWeight: 800, letterSpacing: -0.3 }}>
          {step != null && <span style={{ height: 24, padding: '0 9px', borderRadius: 8, background: tint(btb.green, 18), color: btb.green, fontSize: 11.5, fontWeight: 900, display: 'inline-flex', alignItems: 'center', letterSpacing: 0.2 }}>STEP {step}</span>}
          {title}
        </div>
        {sub && <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 3 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function GradeTile({ score, size = 88 }: { score: number; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.26, background: btb.text, color: btb.bg, display: 'grid', placeItems: 'center', fontSize: size * 0.5, fontWeight: 900, letterSpacing: -1, flexShrink: 0 }}>
      {letterFor(score)}
    </div>
  );
}

function Card({ children, style, padding = 18 }: { children: ReactNode; style?: CSSProperties; padding?: number }) {
  return <Glass padding={padding} radius={24} style={{ minWidth: 0, ...style }}>{children}</Glass>;
}

/** Blocks of color generated from the token address: the same token always gets the same picture. */
function Pattern({ seed }: { seed: string }) {
  const { isMobile } = useSidebar();
  const cells = useMemo(() => {
    const hex = seed.replace(/^0x/, '').padEnd(40, '0');
    const out: { x: number; y: number; shape: number; color: number; rot: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const a = parseInt(hex[i % 40], 16), b = parseInt(hex[(i * 7 + 3) % 40], 16);
      if (a < 6) continue;
      out.push({ x: i % 10, y: Math.floor(i / 10), shape: a % 4, color: b % 3, rot: (b >> 2) * 90 });
    }
    return out;
  }, [seed]);
  const colors = [btb.green, btb.reward, btb.text];
  const S = 48;
  return (
    <svg viewBox={`0 0 ${10 * S} ${4 * S}`} preserveAspectRatio="xMaxYMid slice" aria-hidden="true"
      style={{ position: 'absolute', top: 0, right: 0, bottom: isMobile ? 'auto' : 0, width: isMobile ? '58%' : '62%', height: isMobile ? 120 : '100%', opacity: isMobile ? 0.28 : 0.5,
        maskImage: 'linear-gradient(90deg, transparent 0%, black 55%)', WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 55%)' }}>
      {cells.map((c, i) => {
        const x = c.x * S, y = c.y * S, fill = colors[c.color], op = c.color === 2 ? 0.14 : 0.85;
        const t = `rotate(${c.rot} ${x + S / 2} ${y + S / 2})`;
        if (c.shape === 0) return <rect key={i} x={x + 3} y={y + 3} width={S - 6} height={S - 6} rx={12} fill={fill} opacity={op}/>;
        if (c.shape === 1) return <circle key={i} cx={x + S / 2} cy={y + S / 2} r={S / 2 - 3} fill={fill} opacity={op}/>;
        if (c.shape === 2) return <path key={i} transform={t} d={`M${x + 3} ${y + 3}H${x + S - 3}A${S - 6} ${S - 6} 0 0 1 ${x + 3} ${y + S - 3}Z`} fill={fill} opacity={op}/>;
        return <path key={i} transform={t} d={`M${x + 3} ${y + S - 3}A${S / 2 - 3} ${S / 2 - 3} 0 0 1 ${x + S - 3} ${y + S - 3}Z`} fill={fill} opacity={op}/>;
      })}
    </svg>
  );
}

function ChainPicker({ chainId, setChainId, height }: { chainId: number; setChainId: (n: number) => void; height: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{ height, width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px 0 10px', borderRadius: 16, border: btb.borderSoft, background: btb.surface, color: btb.text, fontFamily: 'inherit', fontSize: 14, fontWeight: 750, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <ChainLogo chainId={chainId} size={24}/>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>{SCAN_CHAINS[chainId]?.name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ color: btb.textDim, transform: open ? 'rotate(180deg)' : undefined }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      {open && (
        <div role="listbox" style={{ position: 'absolute', top: height + 6, left: 0, zIndex: 200, minWidth: 220, padding: 6, borderRadius: 16, background: btb.bg, border: btb.border, boxShadow: '0 18px 48px rgba(0,0,0,0.55)' }}>
          {Object.entries(SCAN_CHAINS).map(([id, c]) => {
            const active = Number(id) === chainId;
            return (
              <button key={id} type="button" role="option" aria-selected={active} onClick={() => { setChainId(Number(id)); setOpen(false); }}
                style={{ width: '100%', height: 42, display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', border: 'none', borderRadius: 11, background: active ? btb.surfaceStrong : 'transparent', color: btb.text, fontFamily: 'inherit', fontSize: 13.5, fontWeight: active ? 800 : 600, cursor: 'pointer' }}>
                <ChainLogo chainId={Number(id)} size={22}/>{c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SearchBar({ chainId, setChainId, input, setInput, onSubmit, err, bare = false }: {
  chainId: number; setChainId: (n: number) => void; input: string; setInput: (s: string) => void; onSubmit: () => void; err: string | null; bare?: boolean;
}) {
  const { isMobile } = useSidebar();
  const H = bare ? 54 : 48;
  const field: CSSProperties = { height: H, borderRadius: 16, border: btb.borderSoft, background: btb.surface, color: btb.text, fontFamily: 'inherit', fontSize: 14.5 };
  const body = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr) auto' : 'minmax(170px, auto) minmax(0, 1fr) auto', gap: 8 }}>
        <ChainPicker chainId={chainId} setChainId={setChainId} height={H}/>
        <div style={{ minWidth: 0, position: 'relative', gridColumn: isMobile ? '1 / -1' : undefined, gridRow: isMobile ? 1 : undefined }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ position: 'absolute', left: 14, top: H / 2 - 8, color: btb.textDim }}>
            <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
          </svg>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
            placeholder="Paste a token address, 0x…" spellCheck={false} autoComplete="off"
            style={{ ...field, width: '100%', padding: '0 14px 0 38px', boxSizing: 'border-box' }}/>
        </div>
        <Button fullWidth={false} size="sm" onClick={onSubmit} style={{ height: H, padding: '0 22px' }}>Open</Button>
      </div>
      {err && <div style={{ color: btb.loss, fontSize: 13, margin: '10px 6px 2px' }}>{err}</div>}
    </>
  );
  return bare ? body : <Card padding={10}>{body}</Card>;
}

/** The page before a token is picked: what a scan is, and the search, in one hero. */
function Landing({ search }: { search: ReactNode }) {
  const { isMobile } = useSidebar();
  const points = [
    { title: 'One grade, A to F', text: 'Safety, liquidity, holder spread and flow, weighted into one score.' },
    { title: 'An LP range that fits', text: 'Sized from 30 days of price, shifted toward where trading is heading.' },
    { title: 'Pay once, shared for 24h', text: `${SCAN_BTB} BTB runs a scan, ${RESCAN_BTB} BTB refreshes one. Everyone reads it free for a day after.` },
  ];
  return (
    <Glass padding={0} radius={30} style={{ overflow: 'visible' }}>
      <div style={{ position: 'relative', padding: isMobile ? '24px 16px 18px' : '40px 36px 30px', borderRadius: 30, overflow: 'hidden' }}>
        <Pattern seed="0x88888888c90cd71b35830dabfd24743dbc135b51"/>
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <Chip tone="good">Token Scan</Chip>
          <div style={{ color: btb.text, fontSize: isMobile ? 32 : 46, fontWeight: 900, letterSpacing: isMobile ? -1 : -1.6, lineHeight: 1.05, marginTop: 16 }}>
            Know a token<br/>before you LP it
          </div>
          <div style={{ color: btb.textMuted, fontSize: isMobile ? 14 : 16, lineHeight: 1.55, marginTop: 12, maxWidth: 520 }}>
            Paste any token address. Get its grade, the red flags, and the range to provide liquidity in.
          </div>
        </div>
      </div>
      <div style={{ position: 'relative', zIndex: 2, padding: isMobile ? '0 12px 12px' : '0 24px 24px', marginTop: isMobile ? -4 : -8 }}>
        <div style={{ padding: 10, borderRadius: 22, background: btb.bg, border: btb.border, boxShadow: btb.shadow }}>{search}</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: isMobile ? 12 : 20, marginTop: 20, padding: isMobile ? '0 4px' : '0 8px' }}>
          {points.map((p, i) => (
            <div key={p.title} style={{ display: 'flex', gap: 12 }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, background: tint(btb.green, 18), color: btb.green, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>{i + 1}</span>
              <div>
                <div style={{ color: btb.text, fontSize: 14, fontWeight: 800 }}>{p.title}</div>
                <div style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.5, marginTop: 3 }}>{p.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Glass>
  );
}

function PaywallCard({ target, last, address, balance, busy, onPay }: {
  target: { chainId: number; token: string }; last: { at: number; symbol: string; score: number } | null;
  address?: string; balance: number; busy: boolean; onPay: () => void;
}) {
  return (
    <Glass padding={0} radius={28} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'relative', padding: '28px 26px', minHeight: 200 }}>
        <Pattern seed={target.token}/>
        <div style={{ position: 'relative', maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip>{SCAN_CHAINS[target.chainId]?.name}</Chip>
            <Chip>{short(target.token)}</Chip>
          </div>
          <div style={{ color: btb.text, fontSize: 28, fontWeight: 850, letterSpacing: -0.6, marginTop: 14, lineHeight: 1.15 }}>
            {last ? `${last.symbol} was last scanned ${ago(last.at)}` : 'No one has scanned this token today'}
          </div>
          <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            {last ? `It graded ${letterFor(last.score)} ${last.score}/100 then. ` : ''}
            Run a fresh scan and everyone can read it free for the next 24 hours.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20, flexWrap: 'wrap' }}>
            <Button fullWidth={false} size="md" variant="success" loading={busy} onClick={onPay}>
              {!address ? 'Connect to scan' : balance < SCAN_BTB ? 'Top up BTB to scan' : `Scan for ${SCAN_BTB} BTB`}
            </Button>
            {address && <span style={{ color: btb.textMuted, fontSize: 13 }}>Your balance: {fmtBtb(balance)} BTB</span>}
          </div>
          <div style={{ color: btb.textDim, fontSize: 12, marginTop: 12 }}>Only charged when the scan succeeds.</div>
        </div>
      </div>
    </Glass>
  );
}

// ── The readout ─────────────────────────────────────────────────────────────

function ScanView({ d, createdAt, onLp: openLp, refresh, filling }: {
  d: ScanResult; createdAt: number; onLp: (t: LpTarget, simulate: boolean, range: Range) => void;
  refresh: { onClick: () => void; busy: boolean; err: string | null; canPay: boolean };
  /** Older scans: fee rates or price history are being fetched live. */
  filling: boolean;
}) {
  const { isMobile } = useSidebar();
  // The range the reader is looking at: the suggested one until they drag the chart lines or pick a row in Step 2.
  // Every LP section reads `view`, so earnings, the backtest and Add LP all follow it.
  const suggested = useMemo<Range>(() => ({ lowerPct: d.lp.lowerPct, upperPct: d.lp.upperPct }), [d]);
  // ScanView is keyed by token and scan time, so a new scan starts again from its own suggested range.
  const [range, setRange] = useState<Range>(suggested);
  // The pool picked in Step 1 (the best one to start). `base` is the scan seen through that pool; `view` adds the range.
  // Null until the reader taps a pool, so the default follows the data (it can change once missing fees arrive).
  const [picked, setPair] = useState<string | null>(null);
  const pair = picked ?? d.lp.pool?.pair ?? null;
  const base = useMemo(() => withPool(d, pair), [d, pair]);
  const view = useMemo<ScanResult>(() => ({ ...base, lp: { ...base.lp, lowerPct: range.lowerPct, upperPct: range.upperPct } }), [base, range]);
  const custom = range.lowerPct !== suggested.lowerPct || range.upperPct !== suggested.upperPct;
  const onLp: OnLp = (t, simulate) => openLp(t, simulate, range);
  const fleet = useQuery(api.tokenScan.fleet, {});
  const [copied, setCopied] = useState(false);
  const chain = SCAN_CHAINS[d.chainId];
  const stance = STANCE[d.lp.stance];
  // Add LP opens the picked pool; if the app cannot add there, it says so rather than opening a different one.
  const lpTarget = useMemo(() => (base.lp.pool ? lpTargetFor(d.chainId, d.token, base.lp.pool) : null), [base, d]);
  const prev = d.previous;
  const change = (now: number | null | undefined, before: number | null | undefined) =>
    now != null && before != null && before > 0 ? ((now - before) / before) * 100 : null;
  const flowTotal = d.txns24h.buys + d.txns24h.sells;
  const buyShare = flowTotal ? d.txns24h.buys / flowTotal : null;
  const median = fleet && fleet.n >= 5 ? fleet.scoreBand.median : null;

  return (
    <>
      {/* Hero */}
      <Glass padding={0} radius={28} style={{ overflow: 'hidden' }}>
        <div style={{ position: 'relative', padding: isMobile ? '22px 18px' : '28px 28px' }}>
          <Pattern seed={d.token}/>
          <div style={{ position: 'relative', display: 'flex', gap: 20, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 320px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ padding: 6, borderRadius: 20, background: btb.surfaceStrong, border: btb.borderSoft, flexShrink: 0 }}>
                  <TokenIcon symbol={d.symbol} size={isMobile ? 46 : 58} logoUrl={d.logo ?? undefined}/>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: btb.text, fontSize: isMobile ? 30 : 40, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1 }}>{d.symbol}</div>
                  <div style={{ color: btb.textMuted, fontSize: 14, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Chip>{chain?.name}</Chip>
                <button onClick={() => { void navigator.clipboard?.writeText(d.token); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  style={{ height: 28, padding: '0 11px', borderRadius: 999, border: btb.borderSoft, background: btb.surface, color: btb.textMuted, fontSize: 12, fontWeight: 750, fontFamily: 'inherit', cursor: 'pointer' }}>
                  {copied ? 'Copied' : short(d.token)}
                </button>
                {d.priceUsd != null && <Chip>{usd(d.priceUsd)}</Chip>}
                {d.meta?.createdAt != null && <Chip>{ageLabel(d.meta.createdAt)}</Chip>}
                {d.meta?.websites[0] && <LinkChip href={d.meta.websites[0]} label="Website"/>}
                {d.meta?.socials.filter((x, i, all) => all.findIndex((y) => y.type === x.type) === i).map((x) => <LinkChip key={x.url} href={x.url} label={x.type === 'twitter' ? 'X' : x.type.charAt(0).toUpperCase() + x.type.slice(1)}/>)}
              </div>
              <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Chip tone={stance.tone}>{stance.label}</Chip>
                <span style={{ color: btb.text, fontSize: 15.5, fontWeight: 700 }}>{d.headline.text}</span>
              </div>
              <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 8 }}>
                {d.signals.length} signal{d.signals.length === 1 ? '' : 's'} · scanned {ago(createdAt)} · free to read until {new Date(createdAt + SCAN_TTL_MS).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <RescanButton createdAt={createdAt} {...refresh}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px 16px 16px', borderRadius: 24, background: btb.bg, border: btb.border, boxShadow: btb.shadow }}>
              <GradeTile score={d.grade.score} size={isMobile ? 64 : 84}/>
              <div>
                <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>BTB grade</div>
                <div style={{ color: btb.text, fontSize: 30, fontWeight: 900, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>{d.grade.score}<span style={{ color: btb.textDim, fontSize: 15, fontWeight: 700 }}> / 100</span></div>
                {median != null && <div style={{ color: d.grade.score >= median ? btb.green : btb.loss, fontSize: 12, fontWeight: 750 }}>{Math.abs(d.grade.score - median)} {d.grade.score >= median ? 'above' : 'below'} the median scan</div>}
                {d.grade.capped && <div style={{ color: btb.amber, fontSize: 12, fontWeight: 650, maxWidth: 190, marginTop: 2 }}>Capped: {d.grade.capped}</div>}
              </div>
            </div>
          </div>
        </div>
      </Glass>

      {/* LP plan */}
      <LpPlan d={view} lpTarget={lpTarget} onLp={onLp} custom={custom} onReset={() => setRange(suggested)}/>
      <Card><PoolsTable d={d} onLp={onLp} picked={base.lp.pool?.pair ?? null} onPick={setPair}/></Card>
      <Card><RangeCompare d={base} range={range} setRange={setRange} filling={filling}/></Card>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.25fr) minmax(0, 1fr)', gap: 14, alignItems: 'stretch' }}>
        <Card padding={20}><Earnings d={view} filling={filling}/></Card>
        <Card><Backtest d={view} filling={filling}/></Card>
      </div>

      {/* Key numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <StatCard label="Price" value={usd(d.priceUsd)} delta={<Delta value={d.change.h24}/>} caption="24 hours"/>
        <StatCard label="Market cap" value={usd(d.marketCapUsd)} delta={<Delta value={change(d.marketCapUsd, prev?.marketCapUsd)}/>} caption={d.fdvUsd ? `FDV ${usd(d.fdvUsd)}` : 'Since last scan'}/>
        <StatCard label="Liquidity" value={usd(d.liquidityUsd)} delta={<Delta value={change(d.liquidityUsd, prev?.liquidityUsd)}/>} caption={`${d.poolCount} pool${d.poolCount === 1 ? '' : 's'}`}/>
        <StatCard label="Volume, 24h" value={usd(d.volume24hUsd)} delta={buyShare != null ? <Delta value={(buyShare - 0.5) * 200} suffix=" pts buys"/> : null} caption={flowTotal ? `${d.txns24h.buys} buys · ${d.txns24h.sells} sells` : 'No swaps today'}/>
        <StatCard label="Holders" value={d.holders != null ? num(d.holders) : 'n/a'} delta={<Delta value={change(d.holders, prev?.holders)}/>} caption={prev ? 'Since last scan' : 'Wallets holding it'}/>
        <StatCard label="Top 10 share" value={d.top10Share != null ? `${(d.top10Share * 100).toFixed(1)}%` : 'n/a'}
          delta={<Delta value={d.top10Share != null && prev?.top10Share != null ? (d.top10Share - prev.top10Share) * 100 : null} suffix=" pts" invert/>}
          caption="Pools and lockers left out"/>
      </div>

      {/* What changed + scan history */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: 14, alignItems: 'stretch' }}>
        <Card><WhatChanged d={d}/></Card>
        <Card><ScanHistory d={d}/></Card>
      </div>

      {/* Chart + grade */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1.55fr) minmax(0, 1fr)', gap: 14, alignItems: 'stretch' }}>
        <Card>
          <PriceChart d={view} setRange={setRange} custom={custom} onReset={() => setRange(suggested)}/>
        </Card>
        <Card>
          <GradeCard d={d} fleet={fleet ?? null}/>
        </Card>
      </div>

      {/* Ranks */}
      <Card>
        <Ranks d={d} fleet={fleet ?? null}/>
      </Card>

      {/* Flow + concentration. Without a holder list the empty card is left out and flow takes the row. */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile || !d.concentration ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'stretch' }}>
        <Card><FlowChart d={d}/></Card>
        {d.concentration && <Card><Concentration d={d}/></Card>}
      </div>

      {/* Biggest trades + top wallets */}
      {(d.flow?.big?.length || d.topHolders?.length) ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile || !d.flow?.big?.length || !d.topHolders?.length ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'stretch' }}>
          {!!d.flow?.big?.length && <Card><BigTrades d={d}/></Card>}
          {!!d.topHolders?.length && <Card><TopHolders d={d}/></Card>}
        </div>
      ) : null}

      {/* Signals + contract */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14, alignItems: 'stretch' }}>
        <Card>
          <SectionTitle title="Signals" sub="Worst first"/>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {d.signals.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 12px', borderRadius: 14, background: tint(TONE[s.tone], 9) }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: TONE[s.tone], flexShrink: 0 }}/>
                <span style={{ color: btb.text, fontSize: 13.5, lineHeight: 1.4, fontWeight: 600 }}>{s.text}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card><ContractCheck d={d}/></Card>
      </div>

      <div style={{ color: btb.textDim, fontSize: 11.5, lineHeight: 1.5, padding: '0 4px' }}>
        Data from DexScreener, GeckoTerminal, {chain?.blockscout ? 'Blockscout, ' : ''}and GoPlus at the time of the scan. Not financial advice.
      </div>
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 16, background: btb.surfaceSoft, border: btb.borderSoft }}>
      <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>{label}</div>
      <div style={{ color: tone ? TONE[tone] : btb.text, fontSize: 19, fontWeight: 850, marginTop: 4, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, delta, caption }: { label: string; value: string; delta?: ReactNode; caption?: string }) {
  return (
    <Card padding={16}>
      <div style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 700 }}>{label}</div>
      <div style={{ color: btb.text, fontSize: 26, fontWeight: 850, letterSpacing: -0.6, marginTop: 6, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, minHeight: 22, flexWrap: 'wrap' }}>
        {delta}
        {caption && <span style={{ color: btb.textDim, fontSize: 12, fontWeight: 600 }}>{caption}</span>}
      </div>
    </Card>
  );
}

function LpPlan({ d, lpTarget, onLp, custom, onReset }: { d: ScanResult; lpTarget: LpTarget | null; onLp: OnLp; custom: boolean; onReset: () => void }) {
  const { isMobile } = useSidebar();
  const stance = STANCE[d.lp.stance];
  const lo = d.priceUsd != null ? d.priceUsd * (1 + d.lp.lowerPct / 100) : null;
  const hi = d.priceUsd != null ? d.priceUsd * (1 + d.lp.upperPct / 100) : null;
  const span = d.lp.upperPct - d.lp.lowerPct;
  const at = span > 0 ? (-d.lp.lowerPct / span) * 100 : 50;
  return (
    <Card padding={20}>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ color: btb.text, fontSize: 16.5, fontWeight: 800 }}>LP plan</span>
            <Chip tone={stance.tone}>{stance.label}</Chip>
          </div>
          <div style={{ color: btb.textMuted, fontSize: 13.5, lineHeight: 1.55, marginTop: 8 }}>{d.lp.notes[0]}</div>
          {d.lp.notes.slice(1).map((n, i) => <div key={i} style={{ color: btb.textMuted, fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{n}</div>)}
        </div>
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: btb.textMuted, fontSize: 12, fontWeight: 700, gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {custom ? 'Your range' : 'Suggested range'}
              {custom && <button type="button" onClick={onReset} style={{ border: 'none', background: 'none', padding: 0, color: btb.green, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Back to suggested</button>}
            </span>
            {d.lp.turnover != null && !isMobile && <span>Pool trades {d.lp.turnover.toFixed(2)}x its size a day</span>}
          </div>
          <div style={{ position: 'relative', height: 40, marginTop: 10 }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 8, borderRadius: 4, background: `linear-gradient(90deg, ${tint(btb.green, 45)}, ${btb.green} 50%, ${tint(btb.green, 45)})` }}/>
            <div style={{ position: 'absolute', left: `${at}%`, top: 6, width: 2, height: 28, borderRadius: 1, background: btb.text, transform: 'translateX(-1px)' }}/>
            <div style={{ position: 'absolute', left: `${at}%`, top: -12, transform: 'translateX(-50%)', color: btb.text, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>Now</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <div style={{ color: btb.text, fontSize: 18, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>{d.lp.lowerPct}%</div>
              <div style={{ color: btb.textDim, fontSize: 12 }}>{usd(lo)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: btb.text, fontSize: 18, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>+{d.lp.upperPct}%</div>
              <div style={{ color: btb.textDim, fontSize: 12 }}>{usd(hi)}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: btb.borderSoft }}>
        {lpTarget && d.lp.stance !== 'avoid' && <Button fullWidth={false} size="sm" variant="success" onClick={() => onLp(lpTarget, false)}>{custom ? 'Add LP with your range' : 'Add LP with this range'}</Button>}
        {lpTarget && <Button fullWidth={false} size="sm" variant="ghost" onClick={() => onLp(lpTarget, true)}>Simulate</Button>}
        {!lpTarget && <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 650 }}>The app cannot add liquidity to this pool yet. Pick another one in Step 1.</span>}
      </div>
    </Card>
  );
}

// ── Chart kit ───────────────────────────────────────────────────────────────
// Charts draw at the container's real pixel width, so lines, dots and labels never stretch.

/** A ref callback and the element's live width. A callback, so a chart that mounts after its data loads is measured too. */
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    setW(Math.round(el.getBoundingClientRect().width));
    ro.current = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.current.observe(el);
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return [ref, w];
}

/** Monotone cubic curve through the points: smooth, and never overshoots past a real value. */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const dx: number[] = [], dk: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dk.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1)); }
  const m: number[] = [dk[0]];
  for (let i = 1; i < n - 1; i++) m.push(dk[i - 1] * dk[i] <= 0 ? 0 : (dk[i - 1] + dk[i]) / 2);
  m.push(dk[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (dk[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / dk[i], b = m[i + 1] / dk[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * dk[i]; m[i + 1] = t * b * dk[i]; }
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], c = dx[i] / 3;
    d += `C${(x0 + c).toFixed(1)} ${(y0 + m[i] * c).toFixed(1)} ${(x1 - c).toFixed(1)} ${(y1 - m[i + 1] * c).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

/** A bar with rounded ends on the side away from the baseline. */
function barPath(x: number, w: number, base: number, top: number, r = 4): string {
  const up = top < base, h = Math.abs(base - top);
  if (h < 0.5) return '';
  const rr = Math.min(r, w / 2, h);
  if (up) return `M${x} ${base}V${top + rr}Q${x} ${top} ${x + rr} ${top}H${x + w - rr}Q${x + w} ${top} ${x + w} ${top + rr}V${base}Z`;
  return `M${x} ${base}V${top - rr}Q${x} ${top} ${x + rr} ${top}H${x + w - rr}Q${x + w} ${top} ${x + w} ${top - rr}V${base}Z`;
}

/** Four evenly spaced values across [min, max] for grid lines. */
const ticks = (min: number, max: number, n = 4) => Array.from({ length: n }, (_, i) => min + ((max - min) * i) / (n - 1));

const PULSE_CSS = '@keyframes scanPulse{0%{transform:translate(-50%,-50%) scale(1);opacity:.55}100%{transform:translate(-50%,-50%) scale(3);opacity:0}}';

/** The live end of a line: a solid dot with a ring that keeps pulsing outward. */
function LiveDot({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <>
      <style>{PULSE_CSS}</style>
      <span style={{ position: 'absolute', left: x, top: y, width: 10, height: 10, borderRadius: 5, background: color, animation: 'scanPulse 1.8s ease-out infinite', pointerEvents: 'none' }}/>
      <span style={{ position: 'absolute', left: x, top: y, width: 10, height: 10, borderRadius: 5, background: color, border: `2px solid ${btb.bg}`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}/>
    </>
  );
}

function Tooltip({ x, width, children }: { x: number; width: number; children: ReactNode }) {
  const right = x > width / 2;
  return (
    <div style={{ position: 'absolute', top: 6, left: x, transform: right ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)', padding: '9px 11px', borderRadius: 12, background: btb.bg, border: btb.border, boxShadow: btb.shadow, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 3 }}>
      {children}
    </div>
  );
}

const axisText: CSSProperties = { position: 'absolute', color: btb.textDim, fontSize: 11, fontWeight: 600, fontVariantNumeric: 'tabular-nums', pointerEvents: 'none', whiteSpace: 'nowrap' };

/** Closes with the suggested LP range drawn over them, daily volume underneath, and how many days the range held. */
function PriceChart({ d, setRange, custom, onReset }: { d: ScanResult; setRange: (r: Range) => void; custom: boolean; onReset: () => void }) {
  const { isMobile } = useSidebar();
  const all = d.history ?? [];
  const [days, setDays] = useState(30);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<'lo' | 'hi' | null>(null);
  // While an edge is dragged the scale stays put, so the line does not slide away under the pointer.
  const [frozen, setFrozen] = useState<{ yMin: number; yMax: number } | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  const pts = all.slice(-days);
  if (all.length < 3 || d.priceUsd == null) {
    return (
      <>
        <SectionTitle title="Price and your range" sub="30 days"/>
        <div style={{ color: btb.textMuted, fontSize: 13.5, padding: '40px 0', textAlign: 'center' }}>No price history for this pool yet. The next scan will have it.</div>
      </>
    );
  }
  const AXIS = 58, PAD_T = 14, H = isMobile ? 230 : 318, VH = isMobile ? 48 : 64, GAP = 14;
  const W = Math.max(0, width - AXIS);
  const volBy = new Map((d.volumeHistory ?? []).map(([ts, v]) => [ts, v]));
  const vols = pts.map((p) => volBy.get(p[0]) ?? 0);
  const vMax = Math.max(...vols, 1);
  const bandLo = d.priceUsd * (1 + d.lp.lowerPct / 100), bandHi = d.priceUsd * (1 + d.lp.upperPct / 100);
  const ys = pts.map((p) => p[1]);
  // Room past each edge, so there is somewhere to drag it to.
  const roomLo = d.priceUsd * (1 + (d.lp.lowerPct * 1.4) / 100), roomHi = d.priceUsd * (1 + (d.lp.upperPct * 1.4) / 100);
  const lo = Math.min(...ys, bandLo, roomLo), hi = Math.max(...ys, bandHi, roomHi);
  const pad = (hi - lo) * 0.04 || hi * 0.05;
  const yMin = frozen?.yMin ?? lo - pad, yMax = frozen?.yMax ?? hi + pad;
  const X = (i: number) => (pts.length < 2 ? W / 2 : (i / (pts.length - 1)) * W);
  const Y = (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_T);
  const priceAt = (y: number) => yMin + (1 - (y - PAD_T) / (H - PAD_T)) * (yMax - yMin);
  const price = d.priceUsd;
  function dragTo(e: React.PointerEvent<HTMLDivElement>, which: 'lo' | 'hi') {
    const top = e.currentTarget.parentElement?.getBoundingClientRect().top ?? 0;
    const pctAt = Math.round((priceAt(Math.max(PAD_T, Math.min(H, e.clientY - top))) / price - 1) * 100);
    if (which === 'lo') setRange({ lowerPct: Math.max(-95, Math.min(-1, pctAt)), upperPct: d.lp.upperPct });
    else setRange({ lowerPct: d.lp.lowerPct, upperPct: Math.max(1, Math.min(400, pctAt)) });
  }
  const handle = (which: 'lo' | 'hi', y: number, pctNow: number, value: number) => (
    <div key={which}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFrozen({ yMin, yMax }); setDrag(which); setHover(null); }}
      onPointerMove={(e) => { if (drag === which) dragTo(e, which); }}
      onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); setFrozen(null); setDrag(null); }}
      style={{ position: 'absolute', left: 0, width: W, top: y - 12, height: 24, cursor: 'ns-resize', touchAction: 'none', zIndex: 4 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 11, height: 2, background: drag === which ? btb.green : 'transparent' }}/>
      <div style={{ position: 'absolute', left: 8, top: 0, height: 24, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 10px 0 8px', borderRadius: 999, background: btb.green, color: btb.bg, fontSize: 11.5, fontWeight: 850, boxShadow: drag === which ? `0 0 0 4px ${tint(btb.green, 30)}` : btb.shadow, whiteSpace: 'nowrap' }}>
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0L9 4H1Z M5 12L1 8H9Z" fill="currentColor"/></svg>
        {which === 'hi' ? 'Top' : 'Bottom'} {pctNow > 0 ? '+' : ''}{pctNow}% · {usd(value)}
      </div>
    </div>
  );
  const xy = pts.map((p, i) => [X(i), Y(p[1])] as [number, number]);
  const line = smoothPath(xy);
  const area = `${line}L${W} ${H}L0 ${H}Z`;
  const inRange = ys.filter((v) => v >= bandLo && v <= bandHi).length;
  const share = inRange / pts.length;
  const step = W / pts.length, bw = Math.max(2, Math.min(18, step * 0.62));
  const h = hover != null ? pts[hover] : null;
  const dateIdx = [0, Math.round((pts.length - 1) / 3), Math.round(((pts.length - 1) * 2) / 3), pts.length - 1];

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / Math.max(1, W)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  }

  return (
    <>
      <SectionTitle title="Price and your range" sub={`Drag the green tabs to move your range. It held on ${inRange} of ${pts.length} days.`}
        right={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {custom && <button type="button" onClick={onReset} style={{ height: 30, padding: '0 12px', borderRadius: 999, border: btb.borderSoft, background: btb.surface, color: btb.text, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Reset</button>}
          <Chip tone={share >= 0.7 ? 'good' : share >= 0.4 ? 'warn' : 'bad'}>{Math.round(share * 100)}% in range</Chip>
          <Toggle options={[7, 14, 30].filter((n) => n <= Math.max(7, all.length)).map((n) => ({ value: n, label: `${n}D` }))} value={days} onChange={(v) => { setDays(v); setHover(null); }}/>
        </div>}/>
      <div ref={ref} style={{ position: 'relative', height: H + GAP + VH + 22 }}>
        {width > 0 && (
          <>
            <svg width={W} height={H + GAP + VH} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <title>{`${d.symbol} price over ${pts.length} days with the suggested range and daily volume`}</title>
              <defs>
                <linearGradient id={`a${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={btb.text} stopOpacity={0.22}/>
                  <stop offset="100%" stopColor={btb.text} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id={`b${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={btb.green} stopOpacity={0.26}/>
                  <stop offset="50%" stopColor={btb.green} stopOpacity={0.14}/>
                  <stop offset="100%" stopColor={btb.green} stopOpacity={0.26}/>
                </linearGradient>
              </defs>
              {ticks(yMin + pad, yMax - pad).map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke={btb.text} strokeOpacity={0.07} strokeDasharray="2 5"/>)}
              <rect x={0} y={Y(bandHi)} width={W} height={Math.max(1, Y(bandLo) - Y(bandHi))} fill={`url(#b${gid})`}/>
              <line x1={0} x2={W} y1={Y(bandHi)} y2={Y(bandHi)} stroke={btb.green} strokeWidth={2} strokeDasharray="7 5"/>
              <line x1={0} x2={W} y1={Y(bandLo)} y2={Y(bandLo)} stroke={btb.green} strokeWidth={2} strokeDasharray="7 5"/>
              <path d={area} fill={`url(#a${gid})`}/>
              <path d={line} fill="none" stroke={btb.text} strokeOpacity={0.14} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"/>
              <path d={line} fill="none" stroke={btb.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
              {vols.map((v, i) => {
                const up = i === 0 || pts[i][1] >= pts[i - 1][1];
                const top = H + GAP + VH - Math.max(v > 0 ? 3 : 0, (v / vMax) * VH);
                return <path key={i} d={barPath(X(i) - bw / 2, bw, H + GAP + VH, top, 3)} fill={up ? btb.green : btb.loss} fillOpacity={hover == null || hover === i ? 0.75 : 0.3}/>;
              })}
              {h && hover != null && <line x1={X(hover)} x2={X(hover)} y1={0} y2={H + GAP + VH} stroke={btb.text} strokeOpacity={0.3} strokeDasharray="3 4"/>}
            </svg>
            {ticks(yMin + pad, yMax - pad).filter((v) => Math.abs(Y(v) - Y(bandHi)) > 16 && Math.abs(Y(v) - Y(bandLo)) > 16).map((v) => <span key={v} style={{ ...axisText, left: W + 10, top: Y(v) - 7 }}>{usd(v)}</span>)}
            {handle('hi', Y(bandHi), d.lp.upperPct, bandHi)}
            {handle('lo', Y(bandLo), d.lp.lowerPct, bandLo)}
            <span style={{ ...axisText, left: W + 10, top: H + GAP }}>Volume</span>
            {[...new Set(dateIdx)].map((i, k) => (
              <span key={i} style={{ ...axisText, top: H + GAP + VH + 6, left: X(i), transform: k === 0 ? 'none' : i === pts.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{dayLabel(pts[i][0])}</span>
            ))}
            {hover == null && <LiveDot x={X(pts.length - 1)} y={Y(pts[pts.length - 1][1])} color={btb.text}/>}
            {h && hover != null && (
              <>
                <span style={{ position: 'absolute', left: X(hover), top: Y(h[1]), width: 12, height: 12, borderRadius: 6, background: btb.text, border: `3px solid ${btb.bg}`, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}/>
                <Tooltip x={X(hover)} width={W}>
                  <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700 }}>{dayLabel(h[0])}</div>
                  <div style={{ color: btb.text, fontSize: 15, fontWeight: 850, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{usd(h[1])}</div>
                  <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 650, marginTop: 2 }}>Volume {usd(vols[hover])}</div>
                  <div style={{ color: h[1] >= bandLo && h[1] <= bandHi ? btb.green : btb.loss, fontSize: 11.5, fontWeight: 750, marginTop: 2 }}>{h[1] >= bandLo && h[1] <= bandHi ? 'In your range' : 'Outside your range'}</div>
                </Tooltip>
              </>
            )}
            <div onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H + GAP + VH, cursor: 'crosshair' }}/>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 16, color: btb.textDim, fontSize: 11.5, marginTop: 6, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: btb.text, borderRadius: 2 }}/>Price</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 9, background: tint(btb.green, 40), borderRadius: 3, border: `1px dashed ${btb.green}` }}/>Suggested range</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 10, background: btb.green, opacity: 0.75, borderRadius: 2 }}/>Volume, up day</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 10, background: btb.loss, opacity: 0.75, borderRadius: 2 }}/>Volume, down day</span>
      </div>
    </>
  );
}

function Toggle<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: btb.surface, border: btb.borderSoft }}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
          style={{ height: 26, padding: '0 10px', borderRadius: 999, border: 'none', background: o.value === value ? btb.text : 'transparent', color: o.value === value ? btb.bg : btb.textMuted, fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Fleet = {
  n: number; score: number[]; marketCap: number[]; liquidity: number[]; volume: number[]; holders: number[]; top10: number[];
  scoreBand: { p25: number; median: number; p75: number };
  pillars: Record<string, { p25: number; median: number; p75: number }>;
};

/** Each pillar on a 0 to 100 track: this token's dot, and the middle half of all scans with its median. */
function GradeCard({ d, fleet }: { d: ScanResult; fleet: Fleet | null }) {
  const showFleet = !!fleet && fleet.n >= 5;
  return (
    <>
      <SectionTitle title="What makes the grade" sub={showFleet ? `Against ${fleet!.n} scanned tokens` : 'Five parts, weighted'}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {d.pillars.map((p) => {
          const band = showFleet ? fleet!.pillars[p.key] : undefined;
          const c = p.score == null ? btb.textDim : p.score >= 70 ? btb.green : p.score >= 40 ? btb.amber : btb.loss;
          return (
            <div key={p.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 750 }}>{p.label} <span style={{ color: btb.textDim, fontSize: 11.5, fontWeight: 650 }}>{Math.round(p.weight * 100)}%</span></span>
                <span style={{ color: btb.text, fontSize: 15, fontWeight: 850, fontVariantNumeric: 'tabular-nums' }}>{p.score ?? 'n/a'}</span>
              </div>
              <div style={{ position: 'relative', height: 14, marginTop: 6 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 5, height: 4, borderRadius: 2, background: btb.surfaceStrong }}/>
                {band && <div style={{ position: 'absolute', top: 3, height: 8, borderRadius: 4, left: `${band.p25}%`, width: `${Math.max(1, band.p75 - band.p25)}%`, background: tint(btb.text, 16) }}/>}
                {band && <div style={{ position: 'absolute', top: 1, height: 12, width: 2, borderRadius: 1, left: `${band.median}%`, background: btb.textMuted }}/>}
                {p.score != null && <div style={{ position: 'absolute', top: 0, width: 14, height: 14, borderRadius: 7, left: `${p.score}%`, transform: 'translateX(-50%)', background: c, border: `2px solid ${btb.bg}` }}/>}
              </div>
              <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 5 }}>{p.note}</div>
            </div>
          );
        })}
      </div>
      {showFleet && (
        <div style={{ display: 'flex', gap: 14, color: btb.textDim, fontSize: 11.5, marginTop: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: btb.green }}/>{d.symbol}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 10, background: btb.textMuted }}/>Median</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 4, background: tint(btb.text, 16) }}/>Middle half</span>
        </div>
      )}
    </>
  );
}

function Ranks({ d, fleet }: { d: ScanResult; fleet: Fleet | null }) {
  if (!fleet || fleet.n < 5) {
    return (
      <>
        <SectionTitle title="Against other tokens" sub="How this token ranks among everything scanned"/>
        <div style={{ color: btb.textMuted, fontSize: 13.5, padding: '6px 2px 4px' }}>
          Ranks appear once 5 tokens have been scanned. {fleet ? `${fleet.n} so far.` : ''}
        </div>
      </>
    );
  }
  const rows: { label: string; value: string; rank: number | null; lowerIsBetter?: boolean }[] = [
    { label: 'Grade', value: `${d.grade.score}`, rank: rankOf(fleet.score, d.grade.score) },
    { label: 'Market cap', value: usd(d.marketCapUsd), rank: d.marketCapUsd != null ? rankOf(fleet.marketCap, d.marketCapUsd) : null },
    { label: 'Liquidity', value: usd(d.liquidityUsd), rank: rankOf(fleet.liquidity, d.liquidityUsd) },
    { label: 'Volume, 24h', value: usd(d.volume24hUsd), rank: rankOf(fleet.volume, d.volume24hUsd) },
    { label: 'Holders', value: d.holders != null ? num(d.holders) : 'n/a', rank: d.holders != null ? rankOf(fleet.holders, d.holders) : null },
    { label: 'Top 10 share', value: d.top10Share != null ? `${(d.top10Share * 100).toFixed(0)}%` : 'n/a', rank: d.top10Share != null ? rankOf(fleet.top10, d.top10Share) : null, lowerIsBetter: true },
  ];
  return (
    <>
      <SectionTitle title={`Against ${fleet.n} scanned tokens`} sub="Where this token sits among everything scanned in the last 90 days"/>
      <div className="scan-ranks" style={{ display: 'grid', gap: 10 }}>
        <style>{'.scan-ranks{grid-template-columns:repeat(3,minmax(0,1fr))}@media (max-width:720px){.scan-ranks{grid-template-columns:repeat(2,minmax(0,1fr))}}'}</style>
        {rows.map((r) => {
          const good = r.rank == null ? null : r.lowerIsBetter ? 100 - r.rank : r.rank;
          const c = good == null ? btb.textDim : good >= 60 ? btb.green : good >= 30 ? btb.amber : btb.loss;
          return (
            <div key={r.label} style={{ padding: 14, borderRadius: 18, background: btb.surfaceSoft, border: btb.borderSoft }}>
              <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>{r.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ color: btb.text, fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }}>{r.rank != null ? ordinal(r.rank) : 'n/a'}</span>
                <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 700 }}>{r.value}</span>
              </div>
              <div style={{ position: 'relative', height: 6, borderRadius: 3, background: btb.surfaceStrong, marginTop: 10 }}>
                {r.rank != null && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(3, r.rank)}%`, borderRadius: 3, background: c }}/>}
              </div>
              <div style={{ color: btb.textDim, fontSize: 11.5, marginTop: 6 }}>
                {r.rank == null ? 'No data' : `${r.rank >= 50 ? 'Above' : 'Below'} ${Math.round(r.rank >= 50 ? r.rank : 100 - r.rank)}% of tokens`}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── More sections ───────────────────────────────────────────────────────────

/** Compares this scan with the one before it: grade, verdict, holders, liquidity, and which signals came or went. */
function WhatChanged({ d }: { d: ScanResult }) {
  const p = d.previous;
  if (!p) {
    return (
      <>
        <SectionTitle title="What changed" sub="Since the last scan"/>
        <div style={{ color: btb.textMuted, fontSize: 13.5 }}>This is the first scan of {d.symbol}. The next one will show what moved since today.</div>
      </>
    );
  }
  const now = d.signals.map((s) => s.text);
  const before = p.signals ?? [];
  const added = d.signals.filter((s) => !before.includes(s.text));
  const cleared = before.filter((t) => !now.includes(t));
  const rows: { label: string; from: string; to: string; delta: ReactNode }[] = [
    { label: 'Grade', from: `${letterFor(p.score)} ${p.score}`, to: `${d.grade.letter} ${d.grade.score}`, delta: <Delta value={d.grade.score - p.score} suffix=" pts"/> },
    ...(p.holders != null && d.holders != null ? [{ label: 'Holders', from: num(p.holders), to: num(d.holders), delta: <Delta value={p.holders > 0 ? ((d.holders - p.holders) / p.holders) * 100 : null}/> }] : []),
    { label: 'Liquidity', from: usd(p.liquidityUsd), to: usd(d.liquidityUsd), delta: <Delta value={p.liquidityUsd > 0 ? ((d.liquidityUsd - p.liquidityUsd) / p.liquidityUsd) * 100 : null}/> },
    ...(p.top10Share != null && d.top10Share != null ? [{ label: 'Top 10 share', from: `${(p.top10Share * 100).toFixed(1)}%`, to: `${(d.top10Share * 100).toFixed(1)}%`, delta: <Delta value={(d.top10Share - p.top10Share) * 100} suffix=" pts" invert/> }] : []),
  ];
  return (
    <>
      <SectionTitle title="What changed" sub={`Since the scan ${ago(p.at)}`}
        right={p.stance && p.stance !== d.lp.stance ? <Chip tone={STANCE[d.lp.stance].tone}>Now: {STANCE[d.lp.stance].label}</Chip> : undefined}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ padding: '12px 14px', borderRadius: 16, background: btb.surfaceSoft, border: btb.borderSoft }}>
            <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>{r.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {r.from !== r.to && <span style={{ color: btb.textDim, fontSize: 13, fontWeight: 700, textDecoration: 'line-through' }}>{r.from}</span>}
              <span style={{ color: btb.text, fontSize: 18, fontWeight: 850 }}>{r.to}</span>
            </div>
            <div style={{ marginTop: 6, minHeight: 22, display: 'flex', alignItems: 'center' }}>{r.from === r.to ? <span style={{ color: btb.textDim, fontSize: 12, fontWeight: 650 }}>No change</span> : r.delta}</div>
          </div>
        ))}
      </div>
      {(added.length > 0 || cleared.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {added.map((s) => (
            <div key={s.text} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: btb.text, fontWeight: 600 }}>
              <Chip tone={s.tone}>New</Chip>{s.text}
            </div>
          ))}
          {cleared.map((t) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: btb.textMuted, fontWeight: 600 }}>
              <Chip>Cleared</Chip><span style={{ textDecoration: 'line-through' }}>{t}</span>
            </div>
          ))}
        </div>
      )}
      {added.length === 0 && cleared.length === 0 && <div style={{ color: btb.textDim, fontSize: 12.5, marginTop: 12 }}>No signals came or went.</div>}
    </>
  );
}

/** Recent swaps on the deepest pool by hour: buys above the line and sells below, or the running net total. */
function FlowChart({ d }: { d: ScanResult }) {
  const f = d.flow;
  const [hover, setHover] = useState<number | null>(null);
  const [mode, setMode] = useState<'hourly' | 'running'>('hourly');
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  if (!f || f.hours.length === 0) {
    return (
      <>
        <SectionTitle title="Buys and sells by hour" sub="Recent swaps on the main pool"/>
        <div style={{ color: btb.textMuted, fontSize: 13.5, padding: '30px 0', textAlign: 'center' }}>No recent swaps recorded for this scan.</div>
      </>
    );
  }
  const net = f.buyUsd - f.sellUsd;
  const spanH = Math.max(1, Math.round((f.to - f.from) / 3600));
  const hourLabel = (ts: number) => new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const H = 170, AXIS = 52, W = Math.max(0, width - AXIS), mid = H / 2;
  const n = f.hours.length, step = W / n, bw = Math.max(4, Math.min(30, step * 0.6));
  const cx = (i: number) => step * i + step / 2;
  const max = Math.max(...f.hours.map((h) => Math.max(h.buyUsd, h.sellUsd)), 1);
  const running = f.hours.reduce<number[]>((acc, h) => [...acc, (acc[acc.length - 1] ?? 0) + h.buyUsd - h.sellUsd], []);
  const rMax = Math.max(...running.map(Math.abs), 1);
  const rY = (v: number) => mid - (v / rMax) * (mid - 10);
  const rLine = smoothPath(running.map((v, i) => [cx(i), rY(v)]));
  const endUp = running[running.length - 1] >= 0;
  const hh = hover != null ? f.hours[hover] : null;

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / Math.max(1, step)))));
  }

  return (
    <>
      <SectionTitle title="Buys and sells by hour" sub={`Last ${f.trades} swaps on the main pool, over ${spanH} hour${spanH === 1 ? '' : 's'}`}
        right={<Toggle options={[{ value: 'hourly' as const, label: 'Hourly' }, { value: 'running' as const, label: 'Running' }]} value={mode} onChange={setMode}/>}/>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: btb.text, fontSize: 30, fontWeight: 900, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>{net >= 0 ? '+' : '−'}{usd(Math.abs(net))}</span>
        <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 700 }}>net · {f.wallets} wallets</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12.5, fontWeight: 700 }}>
        <span style={{ color: btb.green }}>Bought {usd(f.buyUsd)}</span>
        <span style={{ color: btb.loss }}>Sold {usd(f.sellUsd)}</span>
      </div>
      <div ref={ref} style={{ position: 'relative', height: H + 22, marginTop: 14 }}>
        {width > 0 && (
          <>
            <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <title>{mode === 'hourly' ? 'Buys and sells per hour' : 'Running net flow'}</title>
              <defs>
                <linearGradient id={`r${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={endUp ? btb.green : btb.loss} stopOpacity={0.3}/>
                  <stop offset="100%" stopColor={endUp ? btb.green : btb.loss} stopOpacity={0}/>
                </linearGradient>
              </defs>
              {[0, H / 4, (3 * H) / 4, H].map((y) => <line key={y} x1={0} x2={W} y1={y} y2={y} stroke={btb.text} strokeOpacity={0.06} strokeDasharray="2 5"/>)}
              <line x1={0} x2={W} y1={mid} y2={mid} stroke={btb.text} strokeOpacity={0.28}/>
              {hover != null && <rect x={step * hover} y={0} width={step} height={H} rx={6} fill={btb.text} fillOpacity={0.05}/>}
              {mode === 'hourly' ? f.hours.map((h, i) => (
                <g key={h.at} opacity={hover == null || hover === i ? 1 : 0.4}>
                  <path d={barPath(cx(i) - bw / 2, bw, mid - 1, mid - 1 - (h.buyUsd / max) * (mid - 6), 5)} fill={btb.green}/>
                  <path d={barPath(cx(i) - bw / 2, bw, mid + 1, mid + 1 + (h.sellUsd / max) * (mid - 6), 5)} fill={btb.loss}/>
                </g>
              )) : (
                <>
                  <path d={`${rLine}L${cx(n - 1)} ${mid}L${cx(0)} ${mid}Z`} fill={`url(#r${gid})`}/>
                  <path d={rLine} fill="none" stroke={endUp ? btb.green : btb.loss} strokeOpacity={0.18} strokeWidth={9} strokeLinecap="round"/>
                  <path d={rLine} fill="none" stroke={endUp ? btb.green : btb.loss} strokeWidth={2.5} strokeLinecap="round"/>
                </>
              )}
            </svg>
            <span style={{ ...axisText, left: W + 10, top: 2 }}>+{usd(mode === 'hourly' ? max : rMax)}</span>
            <span style={{ ...axisText, left: W + 10, top: mid - 7 }}>$0</span>
            <span style={{ ...axisText, left: W + 10, top: H - 14 }}>−{usd(mode === 'hourly' ? max : rMax)}</span>
            <span style={{ ...axisText, left: 0, top: H + 6 }}>{hourLabel(f.hours[0].at)}</span>
            <span style={{ ...axisText, left: W, top: H + 6, transform: 'translateX(-100%)' }}>{hourLabel(f.hours[n - 1].at)}</span>
            {mode === 'running' && hover == null && <LiveDot x={cx(n - 1)} y={rY(running[n - 1])} color={endUp ? btb.green : btb.loss}/>}
            {hh && hover != null && (
              <Tooltip x={cx(hover)} width={W}>
                <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700 }}>{hourLabel(hh.at)}</div>
                <div style={{ color: btb.green, fontSize: 12.5, fontWeight: 800, marginTop: 3 }}>Bought {usd(hh.buyUsd)}</div>
                <div style={{ color: btb.loss, fontSize: 12.5, fontWeight: 800 }}>Sold {usd(hh.sellUsd)}</div>
                <div style={{ color: btb.text, fontSize: 12.5, fontWeight: 800, marginTop: 3 }}>Running {running[hover] >= 0 ? '+' : '−'}{usd(Math.abs(running[hover]))}</div>
              </Tooltip>
            )}
            <div onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ position: 'absolute', left: 0, top: 0, width: W, height: H }}/>
          </>
        )}
      </div>
    </>
  );
}

/** Supply by holder rank, as one bar split into parts, with the numbers beside it. */
function Concentration({ d }: { d: ScanResult }) {
  const c = d.concentration;
  const parts = c ? [
    { label: 'Top 10', value: c.top10, color: btb.text },
    { label: 'Ranks 11 to 50', value: c.r11to50, color: tint(btb.text, 62) },
    { label: 'Ranks 51 to 100', value: c.r51to100, color: tint(btb.text, 38) },
    { label: 'Pools and lockers', value: c.pools, color: btb.green },
    { label: 'Everyone else', value: c.rest, color: tint(btb.text, 16) },
  ] : [];
  return (
    <>
      <SectionTitle title="Supply concentration" sub="Burn addresses left out"/>
      {!c ? (
        <div style={{ color: btb.textMuted, fontSize: 13.5, padding: '30px 0', textAlign: 'center' }}>
          {d.top10Share != null ? `Top 10 wallets hold ${(d.top10Share * 100).toFixed(1)}%. The explorer's holder list was not available for this scan, so the full split is missing.` : 'The explorer\'s holder list was not available for this scan.'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ color: btb.text, fontSize: 30, fontWeight: 900, letterSpacing: -0.8 }}>{(c.top10 * 100).toFixed(1)}%</span>
            <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 700 }}>held by the top 10 wallets</span>
          </div>
          <div style={{ display: 'flex', gap: 2, height: 18, marginTop: 14, borderRadius: 6, overflow: 'hidden' }}>
            {parts.filter((x) => x.value > 0.002).map((x) => <div key={x.label} title={`${x.label}: ${(x.value * 100).toFixed(1)}%`} style={{ flex: x.value, background: x.color }}/>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
            {parts.map((x) => (
              <div key={x.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: x.color, flexShrink: 0, border: btb.borderSoft }}/>
                <span style={{ color: btb.textMuted, fontWeight: 650, flex: 1 }}>{x.label}</span>
                <span style={{ color: btb.text, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{(x.value * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function TopHolders({ d }: { d: ScanResult }) {
  const { isMobile } = useSidebar();
  const rows = d.topHolders ?? [];
  const host = SCAN_CHAINS[d.chainId]?.blockscout;
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <>
      <SectionTitle title="Top wallets" sub="The 10 largest holders, pools left out. Addresses are public chain data, not identities."/>
      {rows.length === 0 ? (
        <div style={{ color: btb.textMuted, fontSize: 13.5, padding: '30px 0', textAlign: 'center' }}>The explorer's holder list was not available for this scan.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r, i) => (
            <a key={r.address} href={host ? `${host}/address/${r.address}` : undefined} target="_blank" rel="noreferrer"
              style={{ display: 'grid', gridTemplateColumns: isMobile ? '18px minmax(0, 1fr) 60px 52px' : '22px minmax(0, 1fr) 90px 56px', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 12, textDecoration: 'none', background: i % 2 ? 'transparent' : btb.surfaceSoft }}>
              <span style={{ color: btb.textDim, fontSize: 12, fontWeight: 800 }}>{i + 1}</span>
              <span style={{ minWidth: 0, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 3 : 8 }}>
                <span style={{ color: btb.text, fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'nowrap' }}>{short(r.address)}</span>
                {(r.label || r.contract) && <span style={{ color: btb.textMuted, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: btb.surface, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label ?? 'Contract'}</span>}
              </span>
              <span style={{ height: 6, borderRadius: 3, background: btb.surfaceStrong, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(r.share / max) * 100}%`, borderRadius: 3, background: btb.text }}/>
              </span>
              <span style={{ color: btb.text, fontSize: 13, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(r.share * 100).toFixed(2)}%</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

/** Grade across every stored scan of the token, plus the holder count each time. */
function ScanHistory({ d }: { d: ScanResult }) {
  const rows = useQuery(api.tokenScan.timeline, { chainId: d.chainId, token: d.token });
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  if (!rows) return <SectionTitle title="Scan history" sub="Loading…"/>;
  const H = 110, AXIS = 30, W = Math.max(0, width - AXIS);
  const X = (i: number) => (rows.length < 2 ? W / 2 : 8 + (i / (rows.length - 1)) * (W - 16));
  const Y = (s: number) => 8 + (1 - s / 100) * (H - 16);
  const xy = rows.map((r, i) => [X(i), Y(r.score)] as [number, number]);
  const line = smoothPath(xy);
  const hr = hover != null ? rows[hover] : null;
  return (
    <>
      <SectionTitle title="Scan history" sub={rows.length < 2 ? 'Builds up with every scan' : `${rows.length} scans since ${new Date(rows[0].at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}/>
      {rows.length >= 2 && (
        <div ref={ref} style={{ position: 'relative', height: H }} onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <>
              <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
                <title>{`${d.symbol} grade across ${rows.length} scans`}</title>
                <defs>
                  <linearGradient id={`h${gid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={btb.green} stopOpacity={0.28}/>
                    <stop offset="100%" stopColor={btb.green} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                {[0, 50, 100].map((v) => <line key={v} x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke={btb.text} strokeOpacity={v === 50 ? 0.16 : 0.06} strokeDasharray="2 5"/>)}
                <path d={`${line}L${X(rows.length - 1)} ${H}L${X(0)} ${H}Z`} fill={`url(#h${gid})`}/>
                <path d={line} fill="none" stroke={btb.green} strokeOpacity={0.18} strokeWidth={8} strokeLinecap="round"/>
                <path d={line} fill="none" stroke={btb.green} strokeWidth={2.5} strokeLinecap="round"/>
                {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={hover === i ? 6 : 4} fill={btb.green} stroke={btb.bg} strokeWidth={2} onMouseEnter={() => setHover(i)} style={{ cursor: 'default' }}/>)}
              </svg>
              {[0, 50, 100].map((v) => <span key={v} style={{ ...axisText, left: W + 8, top: Y(v) - 7 }}>{v}</span>)}
              {hr && hover != null && (
                <Tooltip x={X(hover)} width={W}>
                  <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700 }}>{new Date(hr.at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ color: btb.text, fontSize: 14, fontWeight: 850, marginTop: 2 }}>{letterFor(hr.score)} {hr.score}</div>
                  {hr.holders != null && <div style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 650 }}>{num(hr.holders)} holders</div>}
                </Tooltip>
              )}
            </>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: rows.length >= 2 ? 12 : 0 }}>
        {[...rows].reverse().slice(0, 5).map((r) => (
          <div key={r.at} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 12, alignItems: 'center', padding: '8px 10px', borderRadius: 12, background: btb.surfaceSoft }}>
            <span style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 650 }}>{new Date(r.at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            <span style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 650 }}>{r.holders != null ? `${num(r.holders)} holders` : ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: btb.text, fontSize: 13, fontWeight: 800 }}>{r.score}</span>
              <GradeTile score={r.score} size={26}/>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** What the suggested range could earn on a deposit the reader picks, the risk at each edge, and how it is worked out. */
function Earnings({ d, filling }: { d: ScanResult; filling: boolean }) {
  const [amount, setAmount] = useState('1000');
  const [how, setHow] = useState(false);
  const deposit = Math.max(0, Number(amount.replace(/[^0-9.]/g, '')) || 0);
  const e = lpEarnings(d, deposit);
  const money = (n: number) => (n >= 1000 ? usd(n) : `$${n.toFixed(n < 10 ? 2 : 0)}`);
  if (!e) {
    return (
      <>
        <SectionTitle step={3} title="What you could earn"/>
        <MissingNote filling={filling} what="this pool's fee rate"/>
      </>
    );
  }
  const edge = (label: string, pct: number, vs: number, days: number | null) => (
    <div style={{ padding: '12px 14px', borderRadius: 16, background: btb.surfaceSoft, border: btb.borderSoft }}>
      <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 700 }}>{label} ({pct > 0 ? '+' : ''}{pct}%)</div>
      <div style={{ color: btb.loss, fontSize: 18, fontWeight: 850, marginTop: 4 }}>{(vs * 100).toFixed(1)}% <span style={{ color: btb.textMuted, fontSize: 13, fontWeight: 700 }}>vs holding</span></div>
      <div style={{ color: btb.textMuted, fontSize: 12, marginTop: 4 }}>
        About {money(-vs * deposit)} on {money(deposit)}{days != null ? `, or ${days < 1 ? 'under a day' : `${Math.round(days)} day${Math.round(days) === 1 ? '' : 's'}`} of fees` : ''}
      </div>
    </div>
  );
  return (
    <>
      <SectionTitle step={3} title="What you could earn" sub={`The suggested range on ${d.symbol} / ${d.lp.pool?.quote} (${e.fee}% fee), if things carry on like the last 30 days`}
        right={
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: btb.textMuted, fontSize: 12.5, fontWeight: 700 }}>
            If you add
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 10px', borderRadius: 12, border: btb.borderSoft, background: btb.surface }}>
              <span style={{ color: btb.textDim }}>$</span>
              <input value={amount} onChange={(ev) => setAmount(ev.target.value)} inputMode="decimal" aria-label="Deposit in dollars"
                style={{ width: 80, border: 'none', outline: 'none', background: 'transparent', color: btb.text, fontFamily: 'inherit', fontSize: 14, fontWeight: 800, marginLeft: 4 }}/>
            </span>
          </label>
        }/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <MiniStat label="Per day" value={money(e.perDay)} tone="good"/>
        <MiniStat label="Per month" value={money(e.perMonth)} tone="good"/>
        <MiniStat label="Yearly rate" value={`${(e.apr * 100).toFixed(e.apr < 0.1 ? 1 : 0)}%`}/>
        <MiniStat label="Days in range, last 30" value={`${Math.round(e.inRange * 100)}%`} tone={e.inRange >= 0.7 ? 'good' : e.inRange >= 0.4 ? 'warn' : 'bad'}/>
      </div>
      <div style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, marginTop: 16 }}>If the price runs to an edge</div>
      <div style={{ color: btb.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>
        Your position slowly swaps into the token that is falling. At an edge it is all one token and stops earning until the price comes back or you rebalance.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
        {edge('Price falls to the lower edge', d.lp.lowerPct, e.edgeLow, e.daysToRecoverLow)}
        {edge('Price rises to the upper edge', d.lp.upperPct, e.edgeHigh, e.daysToRecoverHigh)}
      </div>
      <button type="button" onClick={() => setHow((h) => !h)}
        style={{ marginTop: 14, padding: 0, border: 'none', background: 'none', color: btb.textMuted, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 750, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        {how ? 'Hide how this is worked out' : 'How this is worked out'}
      </button>
      {how && (
        <ol style={{ color: btb.textMuted, fontSize: 12.5, lineHeight: 1.6, margin: '8px 0 0', paddingLeft: 18 }}>
          <li>The pool traded {usd(e.avgVolume)} a day on average over the last {d.volumeHistory?.length || 1} days. At a {e.fee}% fee that pays {usd(e.poolFeesDay)} a day to everyone providing liquidity.</li>
          <li>Spread over the pool's {usd(d.lp.pool?.liquidityUsd)} of liquidity, that is {((e.poolFeesDay / (d.lp.pool?.liquidityUsd || 1)) * 36500).toFixed(1)}% a year for an average LP.</li>
          <li>{e.concentrated
            ? `A range from ${d.lp.lowerPct}% to +${d.lp.upperPct}% puts your money to work ${e.boost.toFixed(2)}x as hard as a typical ±30% range, while the price is inside it.`
            : 'This is a full range pool, so every LP earns the same rate on each dollar.'}</li>
          <li>Over the last 30 days the price stayed inside this range on {Math.round(e.inRange * 100)}% of days, and fees only come in on those days.</li>
          <li>It assumes volume and the other LPs stay as they were. Real results move with both, so treat it as a guide, not a promise.</li>
          {d.lp.pool?.dex === 'aero' && <li>On Aero, trading fees go to the sAERO holders who vote for the pool, and LPs who stake earn AERO rewards instead. Unstaked, you keep the fees.</li>}
          {d.lp.pool?.dex === 'aerodrome' && <li>This is an old Aerodrome pool. Aero replaced Aerodrome and its gauges were switched off, so look for the Aero pool of this pair.</li>}
        </ol>
      )}
    </>
  );
}

// ── Paid extras ─────────────────────────────────────────────────────────────

function ageLabel(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86_400_000);
  if (days < 1) return 'Launched today';
  if (days < 60) return `${days} days old`;
  const months = Math.floor(days / 30.4);
  return months < 24 ? `${months} months old` : `${Math.floor(months / 12)} years old`;
}

function LinkChip({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 11px', borderRadius: 999, border: btb.borderSoft, background: btb.surface, color: btb.textMuted, fontSize: 12, fontWeight: 750, textDecoration: 'none', whiteSpace: 'nowrap' }}>
      {label}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>
    </a>
  );
}

function Definitions({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px 18px', marginTop: 14, padding: '12px 14px', borderRadius: 14, background: btb.surfaceSoft, border: btb.borderSoft }}>
      {items.map(([term, text]) => (
        <div key={term} style={{ fontSize: 12, lineHeight: 1.5, color: btb.textMuted }}>
          <span style={{ color: btb.text, fontWeight: 800 }}>{term}: </span>{text}
        </div>
      ))}
    </div>
  );
}

const pctText = (x: number, digits = 0) => `${x > 0 ? '+' : ''}${(x * 100).toFixed(digits)}%`;

/** The suggested range against one half as wide and one twice as wide: what each earns and what each risks. */
function RangeCompare({ d, range, setRange, filling }: { d: ScanResult; range: Range; setRange: (r: Range) => void; filling: boolean }) {
  const { isMobile } = useSidebar();
  const ranges = [
    { name: 'Narrow', note: 'Most fees, needs watching', lowerPct: Math.max(-90, Math.round(d.lp.lowerPct / 2)), upperPct: Math.max(1, Math.round(d.lp.upperPct / 2)) },
    { name: 'Suggested', note: 'Sized from the last 30 days of moves', lowerPct: d.lp.lowerPct, upperPct: d.lp.upperPct },
    { name: 'Wide', note: 'Set and forget, fewer fees', lowerPct: Math.max(-90, d.lp.lowerPct * 2), upperPct: d.lp.upperPct * 2 },
  ];
  const isCustom = !ranges.some((r) => r.lowerPct === range.lowerPct && r.upperPct === range.upperPct);
  if (isCustom) ranges.push({ name: 'Yours', note: 'Set by dragging the price chart', ...range });
  const rows = ranges.map((r) => ({ ...r, e: lpEarnings(d, 1000, r), on: r.lowerPct === range.lowerPct && r.upperPct === range.upperPct }));
  if (!rows[1].e) {
    return (
      <>
        <SectionTitle step={2} title="Pick a range" sub="Narrow, suggested and wide"/>
        <MissingNote filling={filling} what="this pool's fee rate"/>
      </>
    );
  }
  const head: CSSProperties = { color: btb.textDim, fontSize: 11.5, fontWeight: 750, textAlign: 'right' };
  const pick = (r: Range) => setRange({ lowerPct: r.lowerPct, upperPct: r.upperPct });
  if (isMobile) {
    return (
      <>
        <SectionTitle step={2} title="Pick a range" sub={`You only earn while ${d.symbol}'s price stays inside your range. Narrow earns more but the price leaves it more often. Tap one, or drag the lines on the price chart.`}/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <button key={r.name} type="button" aria-label={`${r.name} range, ${r.lowerPct}% to +${r.upperPct}%`} aria-pressed={r.on} onClick={() => pick(r)}
              style={{ textAlign: 'left', padding: 14, borderRadius: 16, border: r.on ? `1.5px solid ${btb.green}` : btb.borderSoft, background: r.on ? tint(btb.green, 8) : btb.surfaceSoft, color: btb.text, fontFamily: 'inherit', cursor: 'pointer' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, borderRadius: 9, border: `2px solid ${r.on ? btb.green : btb.textDim}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {r.on && <span style={{ width: 9, height: 9, borderRadius: 5, background: btb.green }}/>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 850 }}>{r.name} <span style={{ color: btb.textMuted, fontSize: 12.5, fontWeight: 700 }}>{r.lowerPct}% to +{r.upperPct}%</span></span>
                  <span style={{ display: 'block', color: btb.textDim, fontSize: 12, fontWeight: 650, marginTop: 2 }}>{r.note}</span>
                </span>
              </span>
              <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
                <span><span style={{ display: 'block', color: btb.textDim, fontSize: 11, fontWeight: 750 }}>Yearly</span><span style={{ display: 'block', color: btb.green, fontSize: 16, fontWeight: 850 }}>{r.e ? `${(r.e.apr * 100).toFixed(0)}%` : 'n/a'}</span></span>
                <span><span style={{ display: 'block', color: btb.textDim, fontSize: 11, fontWeight: 750 }}>In range</span><span style={{ display: 'block', fontSize: 16, fontWeight: 850 }}>{r.e ? `${Math.round(r.e.inRange * 100)}%` : 'n/a'}</span></span>
                <span><span style={{ display: 'block', color: btb.textDim, fontSize: 11, fontWeight: 750 }}>At an edge</span><span style={{ display: 'block', color: btb.loss, fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{r.e ? `${pctText(r.e.edgeLow, 0)} / ${pctText(r.e.edgeHigh, 0)}` : 'n/a'}</span></span>
              </span>
            </button>
          ))}
        </div>
        <Definitions items={[
          ['Yearly', 'fees for this range, counting only days the price was inside'],
          ['In range', 'share of the last 30 days the price stayed inside'],
          ['At an edge', 'behind just holding if the price fell or rose to that edge'],
        ]}/>
      </>
    );
  }
  return (
    <>
      <SectionTitle step={2} title="Pick a range" sub={`You only earn while ${d.symbol}'s price stays inside your range. Narrow earns more per dollar but the price leaves it more often. Tap a row, or drag the lines on the price chart.`}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) repeat(3, minmax(0, 1fr))', alignItems: 'stretch' }}>
        <span style={{ ...head, textAlign: 'left', paddingBottom: 6 }}>Range</span>
        <span style={head}>Yearly earnings</span>
        <span style={head}>Time in range</span>
        <span style={head}>If price hits an edge</span>
        {rows.map((r) => {
          const on = r.on;
          const cell: CSSProperties = { padding: '12px 10px 12px 10px', borderTop: btb.borderSoft, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: 14, fontWeight: 800, color: btb.text, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', background: on ? tint(btb.green, 8) : undefined, cursor: 'pointer' };
          return (
            <div key={r.name} role="button" tabIndex={0} onClick={() => setRange({ lowerPct: r.lowerPct, upperPct: r.upperPct })}
              onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') setRange({ lowerPct: r.lowerPct, upperPct: r.upperPct }); }}
              style={{ display: 'contents', cursor: 'pointer' }}>
              <div style={{ ...cell, textAlign: 'left', alignItems: 'flex-start', paddingLeft: 10, borderRadius: '12px 0 0 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${on ? btb.green : btb.textDim}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {on && <span style={{ width: 8, height: 8, borderRadius: 4, background: btb.green }}/>}
                  </span>
                  {r.name}{on && <Chip tone="good">Selected</Chip>}
                </div>
                <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 650, marginTop: 2 }}>{r.lowerPct}% to +{r.upperPct}% from today</div>
                <div style={{ color: btb.textDim, fontSize: 11.5, fontWeight: 650, marginTop: 2 }}>{r.note}</div>
              </div>
              <div style={{ ...cell, color: btb.green }}>{r.e ? `${(r.e.apr * 100).toFixed(0)}%` : 'n/a'}</div>
              <div style={cell}>{r.e ? `${Math.round(r.e.inRange * 100)}%` : 'n/a'}</div>
              <div style={{ ...cell, color: btb.loss, fontSize: 13 }}>
                {r.e ? <><span>Down {pctText(r.e.edgeLow, 1)}</span><span>Up {pctText(r.e.edgeHigh, 1)}</span></> : 'n/a'}
              </div>
            </div>
          );
        })}
      </div>
      <Definitions items={[
        ['Yearly earnings', 'fees for this range on the pool from Step 1, counting only the days the price was inside'],
        ['Time in range', 'share of the last 30 days the price stayed inside, so you earned'],
        ['If price hits an edge', 'how far behind just holding the two tokens you would be, if the price fell (Down) or rose (Up) to that edge'],
      ]}/>
    </>
  );
}

/** What a deposit in the suggested range would have done over the stored days, drawn against holding the tokens. */
function Backtest({ d, filling }: { d: ScanResult; filling: boolean }) {
  const deposit = 1000;
  const b = lpBacktest(d, deposit);
  const [ref, width] = useWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, '');
  if (!b) {
    return (
      <>
        <SectionTitle title="Did it work lately?" sub="The last 30 days, replayed"/>
        <MissingNote filling={filling} what={!d.history?.length ? 'the price history' : "this pool's fee rate"}/>
      </>
    );
  }
  const H = 120, AXIS = 52, W = Math.max(0, width - AXIS);
  const vals = b.series.flatMap((x) => [x.lp, x.hold]);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const X = (i: number) => (b.series.length < 2 ? 0 : (i / (b.series.length - 1)) * W);
  const Y = (v: number) => 6 + (1 - (v - lo) / span) * (H - 12);
  const lpLine = smoothPath(b.series.map((x, i) => [X(i), Y(x.lp)]));
  const holdLine = smoothPath(b.series.map((x, i) => [X(i), Y(x.hold)]));
  const beat = b.total - b.hold;
  return (
    <>
      <SectionTitle title="Did it work lately?" sub={`$1,000 put in the suggested range ${b.days} days ago, replayed day by day`}/>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ color: btb.text, fontSize: 30, fontWeight: 900, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums' }}>{usd(b.total)}</span>
        <Chip tone={beat >= 0 ? 'good' : 'bad'}>{beat >= 0 ? '+' : '−'}{usd(Math.abs(beat))} vs holding</Chip>
      </div>
      <div ref={ref} style={{ position: 'relative', height: H, marginTop: 12 }}>
        {width > 0 && (
          <>
            <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <title>Position plus fees against holding the tokens, day by day</title>
              <defs>
                <linearGradient id={`k${gid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={btb.green} stopOpacity={0.25}/>
                  <stop offset="100%" stopColor={btb.green} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <line x1={0} x2={W} y1={Y(deposit)} y2={Y(deposit)} stroke={btb.text} strokeOpacity={0.15} strokeDasharray="2 5"/>
              <path d={`${lpLine}L${W} ${H}L0 ${H}Z`} fill={`url(#k${gid})`}/>
              <path d={holdLine} fill="none" stroke={btb.textMuted} strokeWidth={2} strokeDasharray="5 5"/>
              <path d={lpLine} fill="none" stroke={btb.green} strokeOpacity={0.18} strokeWidth={8} strokeLinecap="round"/>
              <path d={lpLine} fill="none" stroke={btb.green} strokeWidth={2.5} strokeLinecap="round"/>
            </svg>
            <span style={{ ...axisText, left: W + 8, top: Y(deposit) - 7 }}>$1,000</span>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, color: btb.textDim, fontSize: 11.5, marginTop: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: btb.green, borderRadius: 2 }}/>Your LP with fees</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 0, borderTop: `2px dashed ${btb.textMuted}` }}/>Holding the tokens</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 12 }}>
        <MiniStat label="Fees earned" value={`+${usd(b.fees)}`} tone="good"/>
        <MiniStat label="Position" value={usd(b.position)} tone={b.position >= deposit ? undefined : 'bad'}/>
        <MiniStat label="Days in range" value={`${b.daysIn} of ${b.days}`}/>
      </div>
      <div style={{ color: btb.textDim, fontSize: 12, marginTop: 10, lineHeight: 1.5 }}>
        Price moved {pctText(b.priceMove, 1)} over the period. Holding would be {usd(b.hold)}; keeping the dollars, $1,000.
      </div>
    </>
  );
}

/** Every pool of the token side by side, best fee rate marked, each with Add LP where the app can add there. */
function PoolsTable({ d, onLp, picked, onPick }: { d: ScanResult; onLp: OnLp; picked: string | null; onPick: (pair: string) => void }) {
  const { isMobile } = useSidebar();
  const pools = d.lp.pools ?? (d.lp.pool ? [d.lp.pool] : []);
  if (pools.length === 0) return <SectionTitle step={1} title="Pick a pool" sub="No pools in this scan"/>;
  const floor = Math.max(25_000, (pools[0]?.liquidityUsd ?? 0) * 0.1);
  const base = d.symbol.toLowerCase();
  const reason = (p: ScanPool): { text: string; tone?: Tone } | null => {
    if (p.pair === d.lp.bestPair) return { text: 'Best: high fees and deep enough to trust', tone: 'good' };
    if (p.feeApr == null) return { text: 'Fee unknown, so no rate' };
    if (p.liquidityUsd < floor) return { text: 'Small pool: the rate swings a lot' };
    if (p.quote.toLowerCase().includes(base)) return { text: 'Same asset: low risk, low fees' };
    if (p.feeApr < 0.05) return { text: 'Little trading for its size' };
    return null;
  };
  const cols = isMobile ? 'minmax(0, 1fr) auto' : 'minmax(0, 1.6fr) 70px 110px 110px 100px 110px';
  const head: CSSProperties = { color: btb.textDim, fontSize: 11.5, fontWeight: 750, textAlign: 'right' };
  return (
    <>
      <SectionTitle step={1} title="Pick a pool" sub={`Each pool is a separate market where ${d.symbol} trades against another token. Its traders pay a fee on every swap, and LPs share it. Tap a pool to use it in the steps below.`}/>
      <div style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'stretch' }}>
        {!isMobile && <>
          <span style={{ ...head, textAlign: 'left', paddingBottom: 6 }}>Pool</span><span style={head}>Fee per trade</span><span style={head}>Money in pool</span><span style={head}>Traded today</span><span style={head}>Yearly fees</span><span/>
        </>}
        {pools.map((p) => {
          const best = p.pair === d.lp.bestPair;
          const on = p.pair === picked;
          const t = lpTargetFor(d.chainId, d.token, p);
          const cell: CSSProperties = { padding: '12px 10px 12px 12px', borderTop: btb.borderSoft, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontSize: 13.5, fontWeight: 750, color: btb.text, whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', background: on ? tint(btb.green, 8) : undefined, cursor: 'pointer' };
          const name = (
            <div style={{ ...cell, textAlign: 'left', minWidth: 0, alignItems: 'flex-start', paddingLeft: 10, whiteSpace: 'normal' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 16, height: 16, borderRadius: 8, border: `2px solid ${on ? btb.green : btb.textDim}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {on && <span style={{ width: 8, height: 8, borderRadius: 4, background: btb.green }}/>}
                </span>
                <span style={{ fontWeight: 850 }}>{d.symbol} / {p.quote}</span>
                {best && <Chip tone="good">Best</Chip>}
                {on && !best && <Chip tone="good">Picked</Chip>}
              </div>
              <div style={{ color: btb.textMuted, fontSize: 12, fontWeight: 650, marginTop: 2 }}>
                {dexName(p.dex)}{p.version ? ` ${p.version.toUpperCase()}` : ''}{isMobile ? ` · ${p.feePct != null ? `${p.feePct}% fee` : 'fee unknown'} · ${usd(p.liquidityUsd)}` : ''}
              </div>
              {(() => { const r = reason(p); return r && !best ? <div style={{ color: r.tone ? TONE[r.tone] : btb.textDim, fontSize: 11.5, fontWeight: 700, marginTop: 3 }}>{r.text}</div> : r && best ? <div style={{ color: btb.green, fontSize: 11.5, fontWeight: 700, marginTop: 3 }}>{r.text}</div> : null; })()}
            </div>
          );
          const action = (
            <div style={{ ...cell, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }} onClick={(ev) => ev.stopPropagation()}>
              {isMobile && <span style={{ color: btb.green, fontWeight: 850, alignSelf: 'center', marginRight: 6 }}>{p.feeApr != null ? `${(p.feeApr * 100).toFixed(0)}%` : 'n/a'}</span>}
              {t ? <Button fullWidth={false} size="sm" variant={best ? 'success' : 'ghost'} onClick={() => onLp(t, false)} style={{ height: 32, padding: '0 12px', fontSize: 12 }}>Add LP</Button>
                : <a href={p.url} target="_blank" rel="noreferrer" style={{ color: btb.textMuted, fontSize: 12, fontWeight: 750 }}>View</a>}
            </div>
          );
          return (
            <div key={p.pair} role="button" tabIndex={0} aria-pressed={on} aria-label={`Use ${d.symbol} / ${p.quote} on ${dexName(p.dex)} in the next steps`}
              onClick={() => onPick(p.pair)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') onPick(p.pair); }}
              style={{ display: 'contents' }}>
              {name}
              {!isMobile && <>
                <div style={cell}>{p.feePct != null ? `${p.feePct}%` : 'unknown'}</div>
                <div style={cell}>{usd(p.liquidityUsd)}</div>
                <div style={cell}>{usd(p.volume24hUsd)}</div>
                <div style={{ ...cell, color: p.feeApr != null ? btb.green : btb.textDim, fontWeight: 850 }}>{p.feeApr != null ? `${(p.feeApr * 100).toFixed(p.feeApr < 0.1 ? 1 : 0)}%` : 'n/a'}</div>
              </>}
              {action}
            </div>
          );
        })}
      </div>
      <Definitions items={[
        ['Fee per trade', 'the share of every swap paid to LPs in this pool'],
        ['Money in pool', 'what all LPs have deposited, in dollars'],
        ['Traded today', 'how much changed hands here in the last 24 hours'],
        ['Yearly fees', 'today\'s fees divided by the money in the pool, for a full year. What an average LP earns. Your range changes it, see Step 2'],
      ]}/>
    </>
  );
}

function BigTrades({ d }: { d: ScanResult }) {
  const rows = d.flow?.big ?? [];
  const host = SCAN_CHAINS[d.chainId]?.blockscout;
  const max = Math.max(...rows.map((r) => r.usd), 1);
  return (
    <>
      <SectionTitle title="Biggest trades" sub="The largest swaps among the last 300 on the main pool"/>
      {rows.length === 0 ? (
        <div style={{ color: btb.textMuted, fontSize: 13.5, padding: '30px 0', textAlign: 'center' }}>No trade list in this scan.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((r, i) => (
            <a key={`${r.at}-${i}`} href={host && r.wallet ? `${host}/address/${r.wallet}` : undefined} target="_blank" rel="noreferrer"
              style={{ display: 'grid', gridTemplateColumns: '44px 118px minmax(50px, 1fr) 76px', alignItems: 'center', gap: 12, padding: '9px 10px', borderRadius: 12, textDecoration: 'none', background: i % 2 ? 'transparent' : btb.surfaceSoft }}>
              <span style={{ color: r.buy ? btb.green : btb.loss, fontSize: 12, fontWeight: 850 }}>{r.buy ? 'Buy' : 'Sell'}</span>
              <span style={{ color: btb.text, fontSize: 13, fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.wallet ? short(r.wallet) : 'unknown'}</span>
              <span style={{ height: 6, borderRadius: 3, background: btb.surfaceStrong, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(r.usd / max) * 100}%`, borderRadius: 3, background: r.buy ? btb.green : btb.loss }}/>
              </span>
              <span style={{ color: btb.text, fontSize: 13, fontWeight: 800, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{usd(r.usd)}</span>
            </a>
          ))}
        </div>
      )}
    </>
  );
}

function ContractCheck({ d }: { d: ScanResult }) {
  const { isMobile } = useSidebar();
  const det = d.safety.details;
  const yes = (v: boolean | null | undefined, good: boolean): { text: string; tone?: Tone } =>
    v == null ? { text: 'n/a' } : { text: v ? 'Yes' : 'No', tone: v === good ? 'good' : 'warn' };
  const share = (v: number | null | undefined, warnAt: number): { text: string; tone?: Tone } =>
    v == null ? { text: 'n/a' } : { text: `${(v * 100).toFixed(1)}%`, tone: v >= warnAt ? 'warn' : 'good' };
  const rows: { label: string; v: { text: string; tone?: Tone } }[] = det ? [
    // Only classic pools mint an LP token that can be locked; concentrated positions are NFTs, so the number means nothing there.
    ...((d.lp.pool?.version ?? '').toLowerCase() === 'v2' && det.lpLockedPct != null
      ? [{ label: 'Liquidity locked or burned', v: { text: `${(det.lpLockedPct * 100).toFixed(0)}%`, tone: (det.lpLockedPct >= 0.5 ? 'good' : 'warn') as Tone } }] : []),
    { label: 'Creator holds', v: share(det.creatorPct, 0.05) },
    { label: 'Owner holds', v: share(det.ownerPct, 0.05) },
    { label: 'Ownership given up', v: yes(det.ownerRenounced, true) },
    { label: 'Code can be upgraded', v: yes(det.proxy, false) },
    { label: 'Source code verified', v: yes(det.openSource, true) },
    { label: 'Creator made honeypots before', v: det.sameCreatorHoneypot == null ? { text: 'n/a' } : det.sameCreatorHoneypot ? { text: 'Yes', tone: 'bad' } : { text: 'No', tone: 'good' } },
  ] : [];
  return (
    <>
      <SectionTitle title="Contract check" sub={d.safety.checked ? 'From GoPlus' : 'Not available on this chain'}/>
      {d.safety.checked && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          <MiniStat label="Can be sold" value={d.safety.honeypot ? 'No' : 'Yes'} tone={d.safety.honeypot ? 'bad' : 'good'}/>
          <MiniStat label="Powers" value={d.safety.flags.length ? String(d.safety.flags.length) : 'None'} tone={d.safety.flags.length ? 'warn' : 'good'}/>
          <MiniStat label="Buy tax" value={d.safety.buyTaxPct != null ? `${d.safety.buyTaxPct.toFixed(1)}%` : 'n/a'} tone={(d.safety.buyTaxPct ?? 0) > 0 ? 'warn' : undefined}/>
          <MiniStat label="Sell tax" value={d.safety.sellTaxPct != null ? `${d.safety.sellTaxPct.toFixed(1)}%` : 'n/a'} tone={(d.safety.sellTaxPct ?? 0) >= 10 ? 'bad' : (d.safety.sellTaxPct ?? 0) > 0 ? 'warn' : undefined}/>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 2px', borderTop: btb.borderSoft, fontSize: 13 }}>
              <span style={{ color: btb.textMuted, fontWeight: 650 }}>{r.label}</span>
              <span style={{ color: r.v.tone ? TONE[r.v.tone] : btb.text, fontWeight: 800 }}>{r.v.text}</span>
            </div>
          ))}
        </div>
      )}
      {d.safety.flags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {d.safety.flags.map((f) => <Chip key={f} tone="warn">{f}</Chip>)}
        </div>
      )}
    </>
  );
}

/** Fresh data now, for RESCAN_BTB, instead of waiting for the 24 hours to run out. Unlocks 15 minutes after a scan. */
function RescanButton({ createdAt, onClick, busy, err, canPay }: { createdAt: number; onClick: () => void; busy: boolean; err: string | null; canPay: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const readyAt = createdAt + RESCAN_MIN_AGE_MS;
  useEffect(() => {
    if (now >= readyAt) return;
    const t = setTimeout(() => setNow(Date.now()), Math.min(30_000, readyAt - now + 50));
    return () => clearTimeout(t);
  }, [now, readyAt]);
  const wait = Math.max(0, Math.ceil((readyAt - now) / 60_000));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
      <button type="button" onClick={onClick} disabled={busy || wait > 0}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 999, border: btb.border, background: btb.surfaceStrong, color: wait > 0 ? btb.textDim : btb.text, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: busy || wait > 0 ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>
        {busy ? 'Getting fresh data…' : wait > 0 ? `Rescan opens in ${wait} min` : canPay ? `Rescan for ${RESCAN_BTB} BTB` : `Top up to rescan (${RESCAN_BTB} BTB)`}
      </button>
      {wait === 0 && !busy && <span style={{ color: btb.textDim, fontSize: 12 }}>Fresh data now, shared free with everyone for 24h</span>}
      {err && <span style={{ color: btb.loss, fontSize: 12.5, fontWeight: 650 }}>{err}</span>}
    </div>
  );
}

/** What a card says when it lacks data: loading while the page fetches it, else why, and what to do. */
function MissingNote({ filling, what }: { filling: boolean; what: string }) {
  if (filling) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: btb.textMuted, fontSize: 13.5, padding: '18px 0' }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, border: `2px solid ${btb.textDim}`, borderTopColor: btb.text, animation: 'scanSpin 0.8s linear infinite', flexShrink: 0 }}/>
        <style>{'@keyframes scanSpin{to{transform:rotate(360deg)}}'}</style>
        Loading pool data…
      </div>
    );
  }
  return (
    <div style={{ color: btb.textMuted, fontSize: 13.5, lineHeight: 1.5 }}>
      GeckoTerminal has no data on {what}, so this can't be worked out. Pick another pool in Step 1, or rescan for fresh data.
    </div>
  );
}
