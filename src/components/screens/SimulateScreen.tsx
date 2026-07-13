'use client';
import { useEffect, useRef, useState } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { encodeAbiParameters, keccak256, parseAbiParameters, type PublicClient } from 'viem';
import { Glass } from '../Glass';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Portal } from '../Portal';
import { TokenIcon } from '../TokenIcon';
import { btb } from '../design-tokens';
import { SimulatorPage } from '../simulator/SimulatorPage';
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
import { searchMarketPools } from '../../lib/dexSearch';
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
  /** Real (or fee-derived) 24h pool fees — feeds the earnings simulation in
   * the CreatePosition sheet, same as Discover passes for its pools. */
  fees24hUsd?: number;
  /** True when `apy` came from GeckoTerminal's whole-pool fees/TVL fallback
   * (DeFiLlama doesn't index this pool — common for PancakeSwap on Ethereum)
   * rather than the ±5% range-adjusted figure everywhere else uses. */
  aprIsUnranged?: boolean;
  /** Pool on a DEX the app can't mint on (Uniswap V2, SushiSwap, Balancer, …)
   * from the GeckoTerminal/DexScreener pair search — shown for completeness
   * with a link out instead of a Simulate button. */
  external?: { dexLabel: string; url: string };
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
  const dailyFees = (p: EarnPool) => p.fees24hUsd ?? (p.tvlUsd * p.apyBase) / 100 / 365;
  const merged = probed.map(f => {
    const hit = matched.find(p => PROTOCOL_FOR_EARN_POOL(p) === f.protocol && p.feeTier === f.feeTier);
    return hit ? { ...f, tvlUsd: hit.tvlUsd, apy: hit.aprRange ?? hit.apy, fees24hUsd: dailyFees(hit) } : f;
  });
  // Extra V4 rows at fee tiers our standard-tier probe wouldn't have tried.
  for (const p of matched) {
    if (PROTOCOL_FOR_EARN_POOL(p) !== 'uniswap-v4' || p.source !== 'uniswap') continue;
    if (p.feeTier == null) continue;
    if (merged.some(f => f.protocol === 'uniswap-v4' && f.feeTier === p.feeTier)) continue;
    merged.push({ protocol: 'uniswap-v4', feeTier: p.feeTier, v4PoolId: p.id as `0x${string}`, tvlUsd: p.tvlUsd, apy: p.aprRange ?? p.apy, fees24hUsd: dailyFees(p) });
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
  const [presetPair] = useState(() => {
    if (typeof window === 'undefined') return { a: null, b: null };
    const params = new URLSearchParams(window.location.search);
    return { a: params.get('tokenA')?.toLowerCase() ?? null, b: params.get('tokenB')?.toLowerCase() ?? null };
  });
  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<FoundPool[] | null>(null);
  const [sheetFee, setSheetFee] = useState<FoundPool | null>(null);
  const appliedPair = useRef(false);
  const autoComparedPair = useRef(false);

  // Discover links here with the pool's exact underlying-token addresses.
  // Keep the comparison screen in control: the two pickers are filled in, but
  // the user explicitly chooses when to run the comparison.
  useEffect(() => {
    if (appliedPair.current || tokens.length === 0) return;
    const { a, b } = presetPair;
    if (!a || !b) return;
    const findToken = (address: string) => tokens.find((t) =>
      t.address.toLowerCase() === address || toV3Address(t.address).toLowerCase() === address,
    );
    const presetA = findToken(a);
    const presetB = findToken(b);
    if (!presetA || !presetB) return;
    appliedPair.current = true;
    setTokenA(presetA); setTokenB(presetB);
  }, [presetPair, tokens]);

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

      // Full-market pool discovery (GeckoTerminal + DexScreener) runs in
      // parallel with the on-chain probes — it finds pools on DEXes the
      // probes can't (Uniswap V2, SushiSwap, Balancer, …).
      const externalP = searchMarketPools(toV3Address(tokenA.address), toV3Address(tokenB.address)).catch(() => []);

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
          if (f.fees24hUsd == null && s.volume24hUsd > 0 && f.feeTier > 0) {
            f.fees24hUsd = s.volume24hUsd * (f.feeTier / 1_000_000);
          }
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
          if (f.fees24hUsd == null && s.volume24hUsd > 0 && f.feeTier > 0) {
            f.fees24hUsd = s.volume24hUsd * (f.feeTier / 1_000_000);
          }
        }
      }
      // Merge in every other pool the market APIs know for this pair
      // (GeckoTerminal + DexScreener via the shared dexSearch module).
      const marketPools = await externalP;
      const known = new Set(
        merged.flatMap(f => [f.address?.toLowerCase(), f.v4PoolId?.toLowerCase()]).filter(Boolean),
      );
      for (const mp of marketPools) {
        if (known.has(mp.address)) continue;   // already listed via the on-chain probe
        merged.push({
          protocol: 'uniswap-v3', // unused for external rows — label comes from `external`
          feeTier: mp.feePct != null ? Math.round(mp.feePct * 1_000_000) : 0,
          address: mp.address as `0x${string}`,
          tvlUsd: mp.tvlUsd,
          apy: mp.aprPct != null && mp.aprPct > 0 ? mp.aprPct : undefined,
          aprIsUnranged: mp.aprPct != null && mp.aprPct > 0 ? true : undefined,
          fees24hUsd: mp.feePct != null ? mp.volume24hUsd * mp.feePct : undefined,
          external: { dexLabel: mp.dexLabel, url: mp.url },
        });
      }

      const pools = merged.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));

      if (pools.length === 0 && failedChecks.length > 0) {
        setError(`Couldn't check ${failedChecks.join(', ')} right now (RPC error) — try again. ${3 - failedChecks.length > 0 ? 'No pool found on the rest.' : ''}`);
      } else if (pools.length === 0) {
        setError(`No pool found for ${tokenA.symbol}/${tokenB.symbol} on any DEX we track.`);
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

  // Discover has already chosen the pair, so run its comparison immediately
  // instead of requiring a redundant second click on this screen.
  useEffect(() => {
    if (!appliedPair.current || autoComparedPair.current || !tokenA || !tokenB) return;
    autoComparedPair.current = true;
    void findPools();
    // `findPools` deliberately reads the current token state above. The ref
    // prevents reruns from its changing function identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenA, tokenB]);

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
          {loading ? 'Comparing pools…' : 'Compare pools'}
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
          {isMobile ? (
            // Stacked cards — the 5-column comparison grid doesn't fit a phone.
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 12px 14px' }}>
              {found.map((f, i) => {
                const label = f.external?.dexLabel ?? PROTOCOLS.find(x => x.id === f.protocol)!.label;
                const feeLabel = f.feeTier > 0 ? fmtFeeTier(f.feeTier) : '—';
                return (
                  <div key={f.external ? f.address : `${f.protocol}-${f.feeTier}`} style={{
                    borderRadius: 14, border: btb.borderSoft, padding: '12px 14px',
                    background: i === 0 ? 'rgba(82,227,164,0.05)' : 'rgba(255,255,255,0.03)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, flex: 1 }}>
                        {label} · {feeLabel}
                        {i === 0 && <span title="Highest TVL" style={{ fontSize: 10, marginLeft: 5 }}>🏆</span>}
                        {!f.external && f.protocol === 'uniswap-v4' && <span title="No protocol fee" style={{ fontSize: 10, marginLeft: 5 }}>🛡️</span>}
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
                      {f.external ? (
                        <a href={f.external.url} target="_blank" rel="noreferrer" style={{
                          height: 32, width: 100, marginLeft: 'auto', borderRadius: 14, border: btb.borderSoft,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          color: btb.textMuted, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                          background: 'rgba(255,255,255,0.06)',
                        }}>View ↗</a>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setSheetFee(f)} style={{ height: 32, fontSize: 12, border: btb.borderSoft, marginLeft: 'auto', width: 100 }}>
                          Simulate
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr 1fr', padding: '8px 18px', borderTop: btb.borderSoft, borderBottom: btb.borderSoft }}>
              {['Protocol', 'Fee tier', 'TVL', 'APR', ''].map(h => (
                <span key={h} style={{ color: btb.textMuted, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{h}</span>
              ))}
            </div>
            {found.map((f, i) => {
              const label = f.external?.dexLabel ?? PROTOCOLS.find(x => x.id === f.protocol)!.label;
              return (
                <div key={f.external ? f.address : `${f.protocol}-${f.feeTier}`} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.9fr 1fr 1fr 1fr', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i === 0 ? 'rgba(82,227,164,0.05)' : undefined }}>
                  <span style={{ color: btb.text, fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {label}
                    {i === 0 && <span title="Highest TVL" style={{ fontSize: 9 }}>🏆</span>}
                    {!f.external && f.protocol === 'uniswap-v4' && <span title="No protocol fee" style={{ fontSize: 9 }}>🛡️</span>}
                  </span>
                  <span style={{ color: btb.text, fontSize: 13 }}>{f.feeTier > 0 ? fmtFeeTier(f.feeTier) : '—'}</span>
                  <span style={{ color: btb.text, fontSize: 13, fontWeight: 600 }}>{f.tvlUsd != null ? fmtCompactUsd(f.tvlUsd) : '—'}</span>
                  <span
                    style={{ color: f.apy != null ? (f.aprIsUnranged ? btb.amber : btb.green) : btb.textDim, fontSize: 13, fontWeight: 700, fontStyle: f.aprIsUnranged ? 'italic' : 'normal' }}
                    title={f.aprIsUnranged ? 'Whole-pool fees/TVL — not the ±5% range-adjusted figure (this pool isn\'t in DeFiLlama\'s data)' : undefined}
                  >
                    {f.apy != null ? fmtApr(f.apy) : '—'}{f.aprIsUnranged && '†'}
                  </span>
                  {f.external ? (
                    <a href={f.external.url} target="_blank" rel="noreferrer" style={{
                      height: 32, width: 100, justifySelf: 'end', borderRadius: 14, border: btb.borderSoft,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      color: btb.textMuted, fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      background: 'rgba(255,255,255,0.06)',
                    }}>View ↗</a>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setSheetFee(f)} style={{ height: 32, fontSize: 12, border: btb.borderSoft, justifySelf: 'end', width: 100 }}>
                      Simulate
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </Glass>
      )}

      {sheetFee && sheetMeta && tokenA && tokenB && (
        <SimulatorPage
          tokenA={sheetFee.protocol !== 'uniswap-v4' ? tokenA.address : undefined}
          tokenB={sheetFee.protocol !== 'uniswap-v4' ? tokenB.address : undefined}
          selected={{
            ...sheetFee,
            fees24hUsd: sheetFee.fees24hUsd ?? (sheetFee.tvlUsd != null && sheetFee.apy != null ? (sheetFee.tvlUsd * sheetFee.apy) / 100 / 365 : undefined),
          }}
          siblings={(found ?? []).filter((f) => !f.external && f.protocol === sheetFee.protocol)}
          onClose={() => setSheetFee(null)}
        />
      )}
    </div>
  );
}
