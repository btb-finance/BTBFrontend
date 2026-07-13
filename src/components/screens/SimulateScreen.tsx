'use client';
import { useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeAbiParameters, keccak256, parseAbiParameters, type PublicClient } from 'viem';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Portal } from '../Portal';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { CreatePosition } from '../CreatePosition';
import { useSidebar } from '../../lib/SidebarContext';
import { useTokenStore, Token } from '../../lib/TokenStore';
import { FACTORY_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { fmtFeeTier } from '@/protocols/dexs/uniswap/graph';
import { UNISWAP_V3_DEPLOYMENT } from '@/protocols/dexs/uniswap/v3/addresses';
import { UNISWAP_V4, NATIVE_CURRENCY } from '@/protocols/dexs/uniswap/v4/addresses';
import { STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import { PANCAKE_V3_DEPLOYMENT } from '@/protocols/dexs/pancakeswap';
import { WETH } from '@/protocols/dexs/uniswap/v3/addresses';
import { fetchPoolStats } from '../../lib/geckoterminal';
import { fetchDexPaprikaPools } from '../../lib/dexpaprika';
import { fetchDexScreenerPools } from '../../lib/dexscreener';
import { getEarnPools, addRangeAprs, fmtApr, fmtCompactUsd, type EarnPool } from '../../lib/pools';

type Protocol = 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3';

const PROTOCOLS: { id: Protocol; label: string; dex: 'uniswap' | 'pancakeswap' }[] = [
  { id: 'uniswap-v3',     label: 'Uniswap V3',     dex: 'uniswap' },
  { id: 'uniswap-v4',     label: 'Uniswap V4',     dex: 'uniswap' },
  { id: 'pancakeswap-v3', label: 'PancakeSwap V3', dex: 'pancakeswap' },
];

// Standard tick spacing per fee tier — used to probe for V4 pools (no-hook case)
// since V4 has no factory to query; the pool either exists at these canonical
// spacings or it doesn't.
const V4_TICK_SPACINGS: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
const V4_FEE_TIERS = [100, 500, 3000, 10000];

function toCurrency(address: string): `0x${string}` {
  return (address.toLowerCase() === 'eth' ? NATIVE_CURRENCY : address) as `0x${string}`;
}

/** V3/PancakeSwap V3 have no native-ETH pools — 'ETH' always means the WETH contract there. */
function toV3Address(address: string): `0x${string}` {
  return (address.toLowerCase() === 'eth' ? WETH : address) as `0x${string}`;
}

/** One retry for transient RPC hiccups — a public multicall failing once
 * shouldn't read as "no pool exists" (which is a different, false claim). */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

function sortCurrencies(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

function computeV4PoolId(currency0: `0x${string}`, currency1: `0x${string}`, fee: number, tickSpacing: number, hooks: `0x${string}`): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [currency0, currency1, fee, tickSpacing, hooks],
  );
  return keccak256(encoded);
}

interface FoundPool {
  protocol: Protocol;
  feeTier: number;
  v4PoolId?: `0x${string}`;
  /** Resolved on-chain pool contract address (V3/PancakeSwap V3 only) — used to fetch a TVL fallback. */
  address?: `0x${string}`;
  tvlUsd?: number;
  apy?: number;
  /** True when `apy` came from GeckoTerminal's whole-pool fees/TVL fallback
   * (DeFiLlama doesn't index this pool — common for PancakeSwap on Ethereum)
   * rather than the ±5% range-adjusted figure everywhere else uses. */
  aprIsUnranged?: boolean;
}

const PROTOCOL_FOR_EARN_POOL = (p: EarnPool): Protocol | null => {
  if (p.dex === 'PancakeSwap') return 'pancakeswap-v3';
  if (p.version === 'V4') return 'uniswap-v4';
  if (p.version === 'V3') return 'uniswap-v3';
  return null;
};

/** True when an EarnPool's pair is this exact token pair, symbol-based (robust to native/wrapped address differences). */
function pairMatches(p: EarnPool, tokenA: Token, tokenB: Token): boolean {
  const syms = p.pair.split('-').map(s => s.toUpperCase());
  const want = [tokenA.symbol.toUpperCase(), tokenB.symbol.toUpperCase()];
  const norm = (s: string) => (s === 'ETH' ? 'WETH' : s);
  return syms.length === 2 && [syms[0], syms[1]].map(norm).sort().join() === want.map(norm).sort().join();
}

/** Enriches on-chain-probed pools with real TVL/APR, and adds any pools the
 * indexer knows about that our standard-fee-tier probe can't find — mainly
 * V4, which allows arbitrary (non-standard) fee tiers since pools are
 * permissionless, unlike V3's fixed tier set. */
function mergeWithEarnPools(probed: FoundPool[], earnPools: EarnPool[], tokenA: Token, tokenB: Token): FoundPool[] {
  const matched = earnPools.filter(p => p.chain === 'Ethereum' && pairMatches(p, tokenA, tokenB));
  // Same headline APR everywhere: the ±5% concentrated-range figure (aprRange)
  // when we have it, never the whole-pool fees/TVL number — that understates
  // concentrated LPing by 10-100x and would read as a different, lower APR
  // than the same pool shows on Discover.
  const merged = probed.map(f => {
    const hit = matched.find(p => PROTOCOL_FOR_EARN_POOL(p) === f.protocol && p.feeTier === f.feeTier);
    return hit ? { ...f, tvlUsd: hit.tvlUsd, apy: hit.aprRange ?? hit.apy } : f;
  });
  // Extra V4 rows at fee tiers our standard-tier probe wouldn't have tried.
  for (const p of matched) {
    if (PROTOCOL_FOR_EARN_POOL(p) !== 'uniswap-v4' || p.source !== 'uniswap') continue;
    if (p.feeTier == null) continue;
    if (merged.some(f => f.protocol === 'uniswap-v4' && f.feeTier === p.feeTier)) continue;
    merged.push({ protocol: 'uniswap-v4', feeTier: p.feeTier, v4PoolId: p.id as `0x${string}`, tvlUsd: p.tvlUsd, apy: p.aprRange ?? p.apy });
  }
  return merged.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
}

function TokenPickerButton({ label, token, onPick, tokens }: {
  label: string; token: Token | null; onPick: (t: Token) => void; tokens: Token[];
}) {
  const { width: sidebarWidth } = useSidebar();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = q
    ? tokens.filter(t => t.symbol.toLowerCase().includes(q.toLowerCase()) || t.name.toLowerCase().includes(q.toLowerCase()))
    : tokens;

  return (
    <>
      <div onClick={() => setOpen(true)} style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        background: btb.surfaceSoft, border: btb.borderSoft, borderRadius: 14, padding: '12px 14px',
      }}>
        {token ? <TokenIcon symbol={token.symbol} size={28} logoUrl={token.logoURI} /> : (
          <div style={{ width: 28, height: 28, borderRadius: 999, border: '1.5px dashed rgba(255,255,255,0.25)' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: btb.textDim, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
          <div style={{ color: token ? btb.text : btb.textMuted, fontSize: 14, fontWeight: 700 }}>{token ? token.symbol : 'Select token'}</div>
        </div>
        <Icon name="down" size={14} color={btb.textMuted} />
      </div>

      {open && (
        <Portal>
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', top: 0, left: sidebarWidth, right: 0, bottom: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: '100%', maxWidth: 420, maxHeight: '80vh', background: 'rgba(10,10,15,0.98)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 28, display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ padding: '20px 20px 0' }}>
                <div style={{ color: btb.text, fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Select {label.toLowerCase()}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: btb.borderSoft, borderRadius: 14, padding: '10px 14px', marginBottom: 8 }}>
                  <Icon name="search" size={16} color={btb.textMuted} />
                  <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search token…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: btb.text, fontSize: 15, fontFamily: 'inherit' }} />
                </div>
              </div>
              <div style={{ overflowY: 'auto', padding: '0 12px 20px' }}>
                {filtered.slice(0, 200).map(t => (
                  <div key={t.address} onClick={() => { onPick(t); setOpen(false); setQ(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 14, cursor: 'pointer',
                  }}>
                    <TokenIcon symbol={t.symbol} size={34} logoUrl={t.logoURI} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: btb.text, fontSize: 14.5, fontWeight: 700 }}>{t.symbol}</div>
                      <div style={{ color: btb.textMuted, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div style={{ color: btb.textMuted, fontSize: 13, textAlign: 'center', padding: 24 }}>No tokens found</div>}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}

async function findV4Pools(client: PublicClient, tokenA: Token, tokenB: Token): Promise<FoundPool[]> {
  const [c0, c1] = sortCurrencies(toCurrency(tokenA.address), toCurrency(tokenB.address));
  const results = await client.multicall({
    contracts: V4_FEE_TIERS.map(fee => ({
      address: UNISWAP_V4.stateView,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0' as const,
      args: [computeV4PoolId(c0, c1, fee, V4_TICK_SPACINGS[fee], NATIVE_CURRENCY)],
    })),
    allowFailure: true,
  });
  const pools: FoundPool[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'success') return;
    const sqrtPriceX96 = (r.result as readonly unknown[])[0] as bigint;
    if (sqrtPriceX96 > 0n) {
      const fee = V4_FEE_TIERS[i];
      pools.push({ protocol: 'uniswap-v4', feeTier: fee, v4PoolId: computeV4PoolId(c0, c1, fee, V4_TICK_SPACINGS[fee], NATIVE_CURRENCY) });
    }
  });
  return pools;
}

async function findV3Pools(client: PublicClient, protocol: 'uniswap-v3' | 'pancakeswap-v3', tokenA: Token, tokenB: Token): Promise<FoundPool[]> {
  const deployment = protocol === 'pancakeswap-v3' ? PANCAKE_V3_DEPLOYMENT : UNISWAP_V3_DEPLOYMENT;
  const addrA = toV3Address(tokenA.address);
  const addrB = toV3Address(tokenB.address);
  const results = await client.multicall({
    contracts: deployment.feeTiers.map(fee => ({
      address: deployment.factory,
      abi: FACTORY_ABI,
      functionName: 'getPool' as const,
      args: [addrA, addrB, fee],
    })),
    allowFailure: true,
  });
  const pools: FoundPool[] = [];
  results.forEach((r, i) => {
    if (r.status !== 'success') return;
    const addr = r.result as `0x${string}`;
    if (addr !== '0x0000000000000000000000000000000000000000') pools.push({ protocol, feeTier: deployment.feeTiers[i], address: addr });
  });
  return pools;
}

export function SimulateScreen() {
  const config = useConfig();
  const { isMobile } = useSidebar();
  const { tokens } = useTokenStore();
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundPool[] | null>(null);
  const [sheetFee, setSheetFee] = useState<FoundPool | null>(null);

  const canSearch = !!tokenA && !!tokenB && tokenA.address.toLowerCase() !== tokenB.address.toLowerCase();

  async function findPools() {
    if (!tokenA || !tokenB) return;
    setError(null);
    setFound(null);
    setSheetFee(null);
    setLoading(true);
    try {
      const client = getPublicClient(config);
      if (!client) throw new Error('No RPC client available');

      // Compare across every protocol we can act on in one search, instead
      // of making the user re-run this per protocol tab. Real TVL/APR (and
      // any non-standard V4 fee tiers) come from the same pool data Discover
      // uses, merged in below — otherwise this table would only ever show
      // fee-split theory, not which pool is actually worth more.
      // Each check is retried once and its failure tracked separately from a
      // genuine "no pool exists" — an RPC hiccup must never be presented as
      // the pair having no pool when we simply couldn't check.
      const checks: { label: string; run: () => Promise<FoundPool[]> }[] = [
        { label: 'Uniswap V3', run: () => findV3Pools(client, 'uniswap-v3', tokenA, tokenB) },
        { label: 'Uniswap V4', run: () => findV4Pools(client, tokenA, tokenB) },
        { label: 'PancakeSwap V3', run: () => findV3Pools(client, 'pancakeswap-v3', tokenA, tokenB) },
      ];
      const results = await Promise.all(checks.map(c => withRetry(c.run).then(
        (v): { ok: true; pools: FoundPool[] } => ({ ok: true, pools: v }),
        (e): { ok: false; error: Error } => ({ ok: false, error: e as Error }),
      )));
      const failedChecks = checks.filter((_, i) => !results[i].ok).map(c => c.label);
      const probed = results.flatMap(r => (r.ok ? r.pools : []));

      // No TVL floor — a pool we just confirmed exists on-chain should still
      // get its real (if small) TVL/APR rather than being silently dropped.
      const earnPoolsRaw = await withRetry(() => getEarnPools(0, client)).catch(() => [] as EarnPool[]);
      // Same ±5%-range APR upgrade Discover applies — otherwise this table's
      // APR would be the (much lower, misleading) whole-pool figure for
      // indexer-sourced pools while Discover shows the range-adjusted one.
      const earnPools = await addRangeAprs(client, earnPoolsRaw).catch(() => earnPoolsRaw);
      const merged = mergeWithEarnPools(probed, earnPools, tokenA, tokenB);

      // DeFiLlama only indexes a subset of pools (PancakeSwap-on-Ethereum
      // especially sparsely) — for anything it missed, fall back to
      // GeckoTerminal's real on-chain reserve/volume figures using the
      // resolved pool address, so a pool doesn't just show blank dashes.
      // The APR fallback is whole-pool fees/TVL, not the ±5% range-adjusted
      // figure used everywhere else, so it's tagged and rendered distinctly
      // rather than presented as the same metric.
      const needsData = merged.filter(f => (f.tvlUsd == null || f.apy == null) && f.address);
      if (needsData.length > 0) {
        const stats = await fetchPoolStats(needsData.map(f => f.address!)).catch(() => ({} as Record<string, { tvlUsd: number; volume24hUsd: number; aprPct: number | null }>));
        for (const f of merged) {
          if (!f.address) continue;
          const s = stats[f.address.toLowerCase()];
          if (!s) continue;
          if (f.tvlUsd == null) f.tvlUsd = s.tvlUsd;
          if (f.apy == null && s.aprPct != null) { f.apy = s.aprPct; f.aprIsUnranged = true; }
        }
      }
      // Third/fourth fallback: DexScreener + DexPaprika (both free, keyless,
      // index V4 by the same poolId hash). Neither has a reliable per-pool fee
      // tier of its own, so their volume is only ever combined with the fee
      // tier we already resolved on-chain above — never used to invent a fee
      // we don't actually know. DexScreener returns TVL+volume in one call
      // (DexPaprika needs a second detail call for the same numbers), so it
      // wins when both have data.
      const stillNeeds = merged.filter(f => (f.tvlUsd == null || f.apy == null));
      if (stillNeeds.length > 0) {
        const ids = stillNeeds.map(f => f.v4PoolId ?? f.address).filter((x): x is `0x${string}` => !!x);
        const [ds, dp] = await Promise.all([
          fetchDexScreenerPools(ids).catch(() => ({} as Record<string, { tvlUsd: number; volume24hUsd: number }>)),
          fetchDexPaprikaPools(ids).catch(() => ({} as Record<string, { tvlUsd: number; volume24hUsd: number }>)),
        ]);
        for (const f of merged) {
          const id = (f.v4PoolId ?? f.address)?.toLowerCase();
          if (!id) continue;
          const s = ds[id] ?? dp[id];
          if (!s) continue;
          if (f.tvlUsd == null) f.tvlUsd = s.tvlUsd;
          if (f.apy == null && s.volume24hUsd > 0 && s.tvlUsd > 0) {
            const apr = (s.volume24hUsd * (f.feeTier / 1_000_000) * 365 / s.tvlUsd) * 100;
            if (isFinite(apr) && apr > 0) { f.apy = apr; f.aprIsUnranged = true; }
          }
        }
      }
      const pools = merged.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));

      if (pools.length === 0 && failedChecks.length > 0) {
        setError(`Couldn't check ${failedChecks.join(', ')} right now (RPC error) — try again. ${3 - failedChecks.length > 0 ? 'No pool found on the rest.' : ''}`);
      } else if (pools.length === 0) {
        setError(`No pool found for ${tokenA.symbol}/${tokenB.symbol} on Uniswap V3/V4 or PancakeSwap V3.`);
      } else if (failedChecks.length > 0) {
        setError(`Couldn't check ${failedChecks.join(', ')} right now (RPC error) — results below may be incomplete. Try again to include them.`);
      }
      setFound(pools);
    } catch (e) {
      setError(`Couldn't look up pools — ${(e as Error).message?.slice(0, 120)}`);
    } finally {
      setLoading(false);
    }
  }

  const sheetMeta = sheetFee ? PROTOCOLS.find(p => p.id === sheetFee.protocol)! : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 760 }}>
      <Glass padding={20} radius={22}>
        <div style={{ color: btb.text, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Compare pools for a pair</div>
        <div style={{ color: btb.textMuted, fontSize: 12, marginBottom: 14 }}>
          Pick the two tokens — no pool address needed. We check Uniswap V3, Uniswap V4, and PancakeSwap V3 at once so you can compare fee tiers and versions side by side.
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <TokenPickerButton label="Token 1" token={tokenA} onPick={t => { setTokenA(t); setFound(null); }} tokens={tokens} />
          <TokenPickerButton label="Token 2" token={tokenB} onPick={t => { setTokenB(t); setFound(null); }} tokens={tokens} />
        </div>

        <Button variant="success" size="md" onClick={findPools} disabled={!canSearch} loading={loading} style={{ borderRadius: 12 }}>
          Compare pools
        </Button>

        {error && (
          <div style={{ marginTop: 12, background: 'rgba(255,107,122,0.12)', border: '1px solid rgba(255,107,122,0.35)', borderRadius: 12, padding: '10px 14px', color: btb.loss, fontSize: 13 }}>
            {error}
          </div>
        )}
      </Glass>

      {found && found.length > 0 && (
        <Glass padding={0} radius={22} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 4px', color: btb.text, fontSize: 14, fontWeight: 700 }}>
            {found.length} pool{found.length > 1 ? 's' : ''} found for {tokenA?.symbol}/{tokenB?.symbol}
          </div>
          <div style={{ padding: '0 18px 10px', color: btb.textMuted, fontSize: 11.5 }}>
            Sorted by TVL — higher TVL usually means steadier, more reliable fee income; a high APR on a tiny pool can vanish fast.
            {found.some(f => f.aprIsUnranged) && ' † = whole-pool APR (fallback data), not the ±5% range-adjusted figure used elsewhere.'}
          </div>
          {(() => {
            const hasV3 = found.some(f => f.protocol === 'uniswap-v3');
            const hasV4 = found.some(f => f.protocol === 'uniswap-v4');
            if (!hasV3) return null;
            return (
              <div style={{ margin: '0 18px 12px', background: 'rgba(255,179,107,0.1)', border: '1px solid rgba(255,179,107,0.3)', borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="bolt" size={13} color={btb.amber} />
                <span style={{ color: btb.amber, fontSize: 11.5, lineHeight: 1.5 }}>
                  Uniswap V3 can charge a governance-controlled protocol fee (up to 25% of swap fees on some tiers) — when it's active on a pool, that's earnings you don't keep.
                  {hasV4 ? ' Uniswap V4 currently charges none, so the V4 row above keeps 100% of fees.' : ' No V4 pool exists yet for this pair to compare against.'}
                </span>
              </div>
            );
          })()}
          {isMobile ? (
            // Stacked cards — the 5-column comparison grid doesn't fit a phone.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 12px 14px' }}>
              {found.map((f, i) => {
                const p = PROTOCOLS.find(x => x.id === f.protocol)!;
                return (
                  <div key={`${f.protocol}-${f.feeTier}`} style={{
                    borderRadius: 14, border: btb.borderSoft, padding: '12px 14px',
                    background: i === 0 ? 'rgba(82,227,164,0.05)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                        {p.label} · {fmtFeeTier(f.feeTier)}
                        {i === 0 && <span title="Highest TVL" style={{ fontSize: 10, marginLeft: 5 }}>🏆</span>}
                        {f.protocol === 'uniswap-v4' && <span title="No protocol fee" style={{ fontSize: 10, marginLeft: 5 }}>🛡️</span>}
                      </span>
                      <span
                        style={{ color: f.apy != null ? (f.aprIsUnranged ? btb.amber : btb.green) : btb.textDim, fontSize: 14, fontWeight: 800, fontStyle: f.aprIsUnranged ? 'italic' : 'normal' }}
                        title={f.aprIsUnranged ? 'Whole-pool fees/TVL — not the ±5% range-adjusted figure (this pool isn\'t in DeFiLlama\'s data)' : undefined}
                      >
                        {f.apy != null ? fmtApr(f.apy) : '—'}{f.aprIsUnranged && '†'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <span style={{ color: btb.textMuted, fontSize: 12 }}>TVL {f.tvlUsd != null ? fmtCompactUsd(f.tvlUsd) : '—'}</span>
                      <Button variant="ghost" size="sm" onClick={() => setSheetFee(f)} style={{ height: 32, fontSize: 12, border: btb.borderSoft, marginLeft: 'auto', width: 100 }}>
                        Simulate
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr 1fr', padding: '8px 18px', borderTop: btb.borderSoft, borderBottom: btb.borderSoft }}>
              {['Protocol', 'Fee tier', 'TVL', 'APR (±5%)', ''].map(h => (
                <span key={h} style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</span>
              ))}
            </div>
            {found.map((f, i) => {
              const p = PROTOCOLS.find(x => x.id === f.protocol)!;
              return (
                <div key={`${f.protocol}-${f.feeTier}`} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr 1fr', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(82,227,164,0.05)' : undefined }}>
                  <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.label}
                    {i === 0 && <span title="Highest TVL" style={{ fontSize: 9 }}>🏆</span>}
                    {f.protocol === 'uniswap-v4' && <span title="No protocol fee" style={{ fontSize: 9 }}>🛡️</span>}
                  </span>
                  <span style={{ color: btb.text, fontSize: 13 }}>{fmtFeeTier(f.feeTier)}</span>
                  <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{f.tvlUsd != null ? fmtCompactUsd(f.tvlUsd) : '—'}</span>
                  <span
                    style={{ color: f.apy != null ? (f.aprIsUnranged ? btb.amber : btb.green) : btb.textDim, fontSize: 13, fontWeight: 700, fontStyle: f.aprIsUnranged ? 'italic' : 'normal' }}
                    title={f.aprIsUnranged ? 'Whole-pool fees/TVL — not the ±5% range-adjusted figure (this pool isn\'t in DeFiLlama\'s data)' : undefined}
                  >
                    {f.apy != null ? fmtApr(f.apy) : '—'}{f.aprIsUnranged && '†'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setSheetFee(f)} style={{ height: 32, fontSize: 12, border: btb.borderSoft, justifySelf: 'end', width: 100 }}>
                    Simulate
                  </Button>
                </div>
              );
            })}
          </div>
          )}
        </Glass>
      )}

      {sheetFee && sheetMeta && tokenA && tokenB && (
        <CreatePosition
          tokenA={sheetFee.protocol !== 'uniswap-v4' ? (tokenA.address as `0x${string}`) : undefined}
          tokenB={sheetFee.protocol !== 'uniswap-v4' ? (tokenB.address as `0x${string}`) : undefined}
          initialFee={sheetFee.protocol !== 'uniswap-v4' ? sheetFee.feeTier : undefined}
          v4PoolId={sheetFee.v4PoolId}
          dex={sheetMeta.dex}
          simulate
          onClose={() => setSheetFee(null)}
          onDone={() => setSheetFee(null)}
        />
      )}
    </div>
  );
}
