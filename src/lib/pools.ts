/**
 * Unified pool list for the Earn tab — Uniswap V3 + V4 and PancakeSwap V3,
 * Ethereum mainnet only.
 *
 * Primary source: the DEXs' own indexers (official subgraphs) — real pool
 * addresses, fee tiers, 24h volume/fees, and fee APR computed from actual fees
 * earned. Set NEXT_PUBLIC_GRAPH_KEY (free Graph API key) to enable.
 *
 * Other DEXs (Aerodrome, Curve, …) are staged — the Earn tab shows them as
 * "coming soon" instead of listing pools we can't act on. DeFiLlama's keyless
 * yields API remains as a fallback for Uniswap V3 / PancakeSwap V3 mainnet
 * whenever the subgraphs are unavailable, so the screen always has actionable
 * pools.
 */
import type { Abi, PublicClient } from 'viem';
import { getTopPools as getLlamaPools, getTokenPricesUsd, fmtCompactUsd, type LlamaPool } from './defillama';
import { getV3TopPools } from '@/protocols/dexs/uniswap/v3/subgraph';
import { getV4TopPools } from '@/protocols/dexs/uniswap/v4/subgraph';
import { getPancakeTopPools } from '@/protocols/dexs/pancakeswap';
import { hasGraphKey, fmtFeeTier, DYNAMIC_FEE_FLAG, IndexedPool } from '@/protocols/dexs/uniswap/graph';
import { POOL_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { STATE_VIEW_ABI, POSITION_MANAGER_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import { UNISWAP_V4, NATIVE_CURRENCY } from '@/protocols/dexs/uniswap/v4/addresses';
import { WETH } from '@/protocols/dexs/uniswap/v3/addresses';
import { fetchDexPaprikaTopPools, type DexPaprikaPoolRaw } from './dexpaprika';
import { fetchDexScreenerPool } from './dexscreener';

export { fmtCompactUsd, fmtFeeTier };

export interface EarnPool {
  id: string;
  /** 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3' | DeFiLlama project slug. */
  project: string;
  dex: string;            // friendly name for the filter chips, e.g. "Uniswap"
  version?: 'V3' | 'V4';  // set for indexer-sourced Uniswap pools
  chain: string;
  pair: string;           // e.g. "WETH-USDC"
  feeTier?: number;       // hundredths of a bip — indexer pools only
  /** V4 only — zero address (or unset) means no hook. */
  hooks?: string;
  tvlUsd: number;
  apy: number;            // total APY % (indexer pools: fee APR)
  apyBase: number;        // fee APY/APR %
  apyReward: number;      // incentive APY % (DeFiLlama only)
  volume24hUsd?: number;  // last complete day — indexer pools only
  fees24hUsd?: number;
  stablecoin: boolean;
  ilRisk: string;         // "yes" | "no"
  underlyingTokens?: string[];
  token1Decimals?: number; // indexer pools only — needed for the range APR
  /** Estimated fee APR % for a ±RANGE_APR_PCT% concentrated position (see addRangeAprs). */
  aprRange?: number;
  /** APY change over the last 24h, in percentage points — DeFiLlama-sourced pools only. */
  apyChange1d?: number;
  source: 'uniswap' | 'defillama';
}

/** Stablecoin symbols (uppercase) — shared stable-detection across the app. */
export const STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDS', 'USDE', 'FRAX', 'GHO', 'LUSD', 'PYUSD', 'TUSD', 'USDP', 'FDUSD']);

function fromIndexed(p: IndexedPool, dex: 'Uniswap' | 'PancakeSwap' = 'Uniswap'): EarnPool {
  const stable = STABLES.has(p.token0.symbol.toUpperCase()) && STABLES.has(p.token1.symbol.toUpperCase());
  const slug = dex === 'PancakeSwap' ? 'pancakeswap' : 'uniswap';
  return {
    id: p.id,
    project: `${slug}-${p.version}`,
    dex,
    version: p.version === 'v3' ? 'V3' : 'V4',
    chain: 'Ethereum',
    pair: `${p.token0.symbol}-${p.token1.symbol}`,
    feeTier: p.feeTier,
    hooks: p.hooks,
    tvlUsd: p.tvlUsd,
    apy: p.feeApr,
    apyBase: p.feeApr,
    apyReward: 0,
    volume24hUsd: p.volume24hUsd,
    fees24hUsd: p.fees24hUsd,
    stablecoin: stable,
    ilRisk: stable ? 'no' : 'yes',
    underlyingTokens: [p.token0.address, p.token1.address],
    token1Decimals: p.token1.decimals,
    source: 'uniswap',
  };
}

/** Converts a DeFiLlama-sourced pool into our shape, filling in real
 * volume/fees/24h-change from fields DeFiLlama already reports per-pool
 * (no extra API calls needed). */
function fromLlama(p: LlamaPool, overrides: Partial<Pick<EarnPool, 'dex' | 'version'>> = {}): EarnPool {
  const feeTier = p.feeTierPct != null ? Math.round(p.feeTierPct * 10000) : undefined;
  const fees24hUsd = p.volume24hUsd != null && p.feeTierPct != null
    ? p.volume24hUsd * (p.feeTierPct / 100)
    : undefined;
  return {
    id: p.id,
    project: p.project,
    dex: overrides.dex ?? p.dex,
    version: overrides.version,
    chain: p.chain,
    pair: p.pair,
    feeTier,
    tvlUsd: p.tvlUsd,
    apy: p.apy,
    apyBase: p.apyBase,
    apyReward: p.apyReward,
    apyChange1d: p.apyPct1D,
    volume24hUsd: p.volume24hUsd,
    fees24hUsd,
    stablecoin: p.stablecoin,
    ilRisk: p.ilRisk,
    underlyingTokens: p.underlyingTokens,
    source: 'defillama',
  };
}

const DEXPAPRIKA_MAP: { dexId: 'uniswap_v3' | 'uniswap_v4' | 'pancakeswap_v3'; project: string; dex: string; version: 'V3' | 'V4' }[] = [
  { dexId: 'uniswap_v3', project: 'uniswap-v3', dex: 'Uniswap', version: 'V3' },
  { dexId: 'uniswap_v4', project: 'uniswap-v4', dex: 'Uniswap', version: 'V4' },
  { dexId: 'pancakeswap_v3', project: 'pancakeswap-v3', dex: 'PancakeSwap', version: 'V3' },
];

/**
 * DexPaprika — free, keyless pool *discovery* (ranked by volume, covers pools
 * DeFiLlama doesn't index). It has no reliable fee tier or TVL of its own, so
 * every pool here gets its fee read straight from the chain (V3: `fee()` on
 * the pool contract; V4: the PositionManager's `poolKeys` mapping — pools
 * nobody has ever minted through there are skipped rather than guessed) and
 * its TVL from a DexPaprika detail call. Only pools that clear both checks
 * (and the same TVL floor as everything else) become real `EarnPool` rows —
 * this never fabricates a fee or an APR.
 */
async function ingestDexPaprika(client: PublicClient, existingIds: Set<string>, minTvlUsd: number): Promise<EarnPool[]> {
  const perDex = await Promise.all(DEXPAPRIKA_MAP.map((m) => fetchDexPaprikaTopPools(m.dexId, 50).then((rows) => ({ m, rows }))));
  const out: EarnPool[] = [];

  for (const { m, rows } of perDex) {
    // Cap how many "new" pools per DEX we bother resolving — this is a
    // supplemental discovery pass, not the primary source, so keep it fast.
    const fresh = rows.filter((r) => !existingIds.has(r.id.toLowerCase())).slice(0, 20) as DexPaprikaPoolRaw[];
    if (fresh.length === 0) continue;

    const feeCalls = m.version === 'V4'
      ? await client.multicall({
          contracts: fresh.map((r) => ({
            address: UNISWAP_V4.positionManager, abi: POSITION_MANAGER_ABI as Abi, functionName: 'poolKeys',
            args: [r.id.toLowerCase().slice(0, 52) as `0x${string}`],
          })),
          allowFailure: true,
        })
      : await client.multicall({
          contracts: fresh.map((r) => ({ address: r.id as `0x${string}`, abi: POOL_ABI as Abi, functionName: 'fee' })),
          allowFailure: true,
        });
    const feeOf = (i: number): number | null => {
      const r = feeCalls[i];
      if (r.status !== 'success') return null;
      return m.version === 'V4' ? Number((r.result as readonly unknown[])[2]) : Number(r.result as number);
    };

    // Only bother fetching TVL for pools with a real, known fee — skips
    // wasted detail calls for pools we'd drop anyway. TVL comes from
    // DexScreener (a separate rate-limit bucket from the discovery call
    // above, and real CORS support) rather than a second DexPaprika call, so
    // this discovery pass never puts more than one burst of load on either
    // provider. Still bounded (6 at a time) to be a good citizen.
    const withFee = fresh.map((r, i) => ({ r, fee: feeOf(i) })).filter((x) => x.fee != null && x.fee > 0);
    const tvlByIndex = new Map<number, number>();
    const CONCURRENCY = 6;
    for (let i = 0; i < withFee.length; i += CONCURRENCY) {
      const batch = withFee.slice(i, i + CONCURRENCY);
      const stats = await Promise.all(batch.map((x) => fetchDexScreenerPool(x.r.id)));
      stats.forEach((s, j) => tvlByIndex.set(i + j, s?.tvlUsd ?? 0));
    }

    withFee.forEach(({ r, fee }, i) => {
      const tvlUsd = tvlByIndex.get(i) ?? 0;
      if (fee == null || tvlUsd < minTvlUsd) return;
      const [t0, t1] = [r.token0, r.token1].sort((a, b) => a.address.toLowerCase().localeCompare(b.address.toLowerCase()));
      const stable = STABLES.has(t0.symbol.toUpperCase()) && STABLES.has(t1.symbol.toUpperCase());
      // Dynamic-fee V4 pools report the flag bit, not a fee — multiplying
      // volume by it fabricates absurd fees/APRs (838% "fee"), so their
      // fee-derived numbers stay unknown instead.
      const isDynamic = (fee & DYNAMIC_FEE_FLAG) !== 0;
      const fees24hUsd = isDynamic ? undefined : r.volume24hUsd * (fee / 1_000_000);
      const apy = !isDynamic && fees24hUsd != null && tvlUsd > 0 ? (fees24hUsd * 365 / tvlUsd) * 100 : 0;
      out.push({
        id: r.id, project: m.project, dex: m.dex, version: m.version, chain: 'Ethereum',
        pair: `${t0.symbol}-${t1.symbol}`, feeTier: fee, tvlUsd,
        apy, apyBase: apy, apyReward: 0,
        volume24hUsd: r.volume24hUsd, fees24hUsd,
        stablecoin: stable, ilRisk: stable ? 'no' : 'yes',
        underlyingTokens: [t0.address, t1.address], token1Decimals: t1.decimals,
        source: 'uniswap',
      });
    });
  }
  return out;
}

/**
 * @param minTvlUsd Floor applied to the DeFiLlama fallback rows only. Discover
 * uses the default (keeps the list to pools worth showing); Simulate's
 * pair-lookup passes 0 — it already confirmed the pool exists on-chain via
 * the factory, so a low-TVL pool should still get its real (if small)
 * TVL/APR instead of silently being dropped and showing blank dashes.
 * @param client When provided, also runs a DexPaprika discovery pass (see
 * `ingestDexPaprika`) to surface pools DeFiLlama/the subgraphs miss entirely.
 */
export async function getEarnPools(minTvlUsd = 50_000, client?: PublicClient): Promise<EarnPool[]> {
  const [v3, v4, cake, llama] = await Promise.allSettled([
    hasGraphKey ? getV3TopPools() : Promise.reject(new Error('no key')),
    hasGraphKey ? getV4TopPools() : Promise.reject(new Error('no key')),
    hasGraphKey ? getPancakeTopPools() : Promise.reject(new Error('no key')),
    // Rank within just the DEXs this app can actually act on (Add LP / Simulate),
    // so a handful of giant Curve/Balancer/Aerodrome pools can't crowd the
    // top-N slice before the actionable-project filter below even runs.
    getLlamaPools(200, minTvlUsd, ['uniswap-v3', 'uniswap-v4', 'pancakeswap-amm-v3']),
  ]);

  const pools: EarnPool[] = [];

  if (v3.status === 'fulfilled') pools.push(...v3.value.map((p) => fromIndexed(p)));
  if (v4.status === 'fulfilled') pools.push(...v4.value.map((p) => fromIndexed(p)));
  if (cake.status === 'fulfilled') pools.push(...cake.value.map((p) => fromIndexed(p, 'PancakeSwap')));

  if (llama.status === 'fulfilled') {
    for (const p of llama.value) {
      // Mintable-in-app DEXs on mainnet only — every listed pool must be
      // actionable. DeFiLlama rows back-fill whichever indexer is unavailable.
      if (p.chain !== 'Ethereum') continue;
      if (p.project === 'uniswap-v3' && v3.status !== 'fulfilled') pools.push(fromLlama(p, { version: 'V3' }));
      if (p.project === 'uniswap-v4' && v4.status !== 'fulfilled') pools.push(fromLlama(p, { version: 'V4' }));
      if (p.project === 'pancakeswap-amm-v3' && cake.status !== 'fulfilled') pools.push(fromLlama(p, { dex: 'PancakeSwap', version: 'V3' }));
    }
  }

  if (pools.length === 0 && !client) {
    const err =
      (llama.status === 'rejected' && llama.reason instanceof Error && llama.reason.message) || 'no pool source available';
    throw new Error(err);
  }

  if (client) {
    const existingIds = new Set(pools.map((p) => p.id.toLowerCase()));
    const extra = await ingestDexPaprika(client, existingIds, minTvlUsd).catch(() => [] as EarnPool[]);
    pools.push(...extra);
  }

  if (pools.length === 0) throw new Error('no pool source available');

  return pools.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

/** External link for a pool — Uniswap explore page for indexer pools, DeFiLlama otherwise. */
export function poolLink(p: EarnPool): string {
  if (p.project === 'pancakeswap-v3' && p.source === 'uniswap') return `https://pancakeswap.finance/info/v3/eth/pairs/${p.id}`;
  if (p.source === 'uniswap') return `https://app.uniswap.org/explore/pools/ethereum/${p.id}`;
  return `https://defillama.com/yields/pool/${p.id}`;
}

/**
 * CreatePosition props for a pool. Minting in-app covers Uniswap V3 + V4 on
 * Ethereum mainnet, with V4 limited to hookless pools — hooks can change
 * fees/behavior in ways we can't preview. The read-only simulator works for
 * hooked pools too (`forSimulate`). Null → not actionable.
 */
export function mintTarget(p: EarnPool, forSimulate = false): { tokenA?: `0x${string}`; tokenB?: `0x${string}`; v4PoolId?: `0x${string}`; dex?: 'uniswap' | 'pancakeswap' } | null {
  if (p.chain.toLowerCase() !== 'ethereum') return null;
  const tokens = (p.underlyingTokens ?? []) as `0x${string}`[];
  if (p.project === 'uniswap-v3' && tokens.length >= 2) return { tokenA: tokens[0], tokenB: tokens[1], dex: 'uniswap' };
  if (p.project === 'pancakeswap-v3' && tokens.length >= 2) return { tokenA: tokens[0], tokenB: tokens[1], dex: 'pancakeswap' };
  if (p.project === 'uniswap-v4' && (forSimulate || !p.hooks || /^0x0+$/.test(p.hooks))) return { v4PoolId: p.id as `0x${string}`, dex: 'uniswap' };
  return null;
}

/**
 * Pool-token addresses a wallet token can appear as. Native ETH trades as
 * WETH in V3 pools and as currency address(0) in V4 pools.
 */
export function lpAddressesForToken(address: string): string[] {
  const a = address.toLowerCase();
  if (a === 'eth' || a === NATIVE_CURRENCY || a === WETH.toLowerCase()) {
    return [WETH.toLowerCase(), NATIVE_CURRENCY];
  }
  return [a];
}

/** Pools whose pair contains any of `addrs` (case-insensitive). */
export function poolsForToken(pools: EarnPool[], addrs: string[]): EarnPool[] {
  const set = new Set(addrs.map((a) => a.toLowerCase()));
  return pools.filter((p) => p.underlyingTokens?.some((t) => set.has(t.toLowerCase())));
}

/** 385.9 → "386", 38.59 → "38.59", 3859 → "3,859". */
export function fmtApr(v: number): string {
  if (v >= 1000) return `${Math.round(v).toLocaleString('en-US')}%`;
  if (v >= 100) return `${v.toFixed(0)}%`;
  return `${v.toFixed(2)}%`;
}

/** The concentrated-range width the list's headline APR is quoted for. */
export const RANGE_APR_PCT = 5;

// Token1-units of value per unit of liquidity concentrated in a ±5% band:
// amount0·price + amount1 = L·√P·[(1 − 1/√1.05) + (1 − √0.95)].
const BAND_FACTOR = (1 - 1 / Math.sqrt(1 + RANGE_APR_PCT / 100)) + (1 - Math.sqrt(1 - RANGE_APR_PCT / 100));

/**
 * Headline APR like the LP simulators quote it: what a ±5% concentrated
 * position would earn at current volume — fees24h × 365 ÷ the USD value of the
 * pool's in-range liquidity as priced over a ±5% band. The whole-pool
 * fees/TVL figure understates concentrated LPing by 10–100×, since most TVL
 * sits outside any tight range.
 *
 * Reads live sqrtPrice + in-range liquidity (one multicall) and token1 USD
 * prices (DeFiLlama); marginal-deposit basis, matching the in-sheet simulator
 * for a small position. Pools it can't price keep the whole-pool APR.
 */
export async function addRangeAprs(client: PublicClient, pools: EarnPool[]): Promise<EarnPool[]> {
  const targets = pools.filter((p) =>
    p.source === 'uniswap' && (p.fees24hUsd ?? 0) > 0 &&
    p.token1Decimals !== undefined && (p.underlyingTokens?.length ?? 0) >= 2);
  if (targets.length === 0) return pools;

  // Mixed V3 pool / V4 StateView reads in one batch — typed loosely because
  // viem's multicall generics can't express the heterogeneous union.
  type McCall = { address: `0x${string}`; abi: Abi; functionName: string; args?: readonly unknown[] };
  const contracts: McCall[] = targets.flatMap((p) => p.version === 'V4'
    ? [
        { address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI as Abi, functionName: 'getSlot0', args: [p.id as `0x${string}`] },
        { address: UNISWAP_V4.stateView, abi: STATE_VIEW_ABI as Abi, functionName: 'getLiquidity', args: [p.id as `0x${string}`] },
      ]
    : [
        { address: p.id as `0x${string}`, abi: POOL_ABI as Abi, functionName: 'slot0' },
        { address: p.id as `0x${string}`, abi: POOL_ABI as Abi, functionName: 'liquidity' },
      ]);
  const [stateRes, prices] = await Promise.all([
    client.multicall({ contracts, allowFailure: true }),
    getTokenPricesUsd(targets.map((p) => p.underlyingTokens![1] as `0x${string}`)).catch(() => ({} as Record<string, number>)),
  ]);

  const byId = new Map<string, number>();
  targets.forEach((p, i) => {
    const s = stateRes[i * 2], l = stateRes[i * 2 + 1];
    if (s.status !== 'success' || l.status !== 'success') return;
    const sqrtPriceX96 = (s.result as readonly unknown[])[0] as bigint;
    const liquidity = l.result as bigint;
    const p1 = prices[(p.underlyingTokens![1] as string).toLowerCase()];
    if (!p1 || liquidity === 0n || sqrtPriceX96 === 0n) return;
    const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
    const bandUsd = (Number(liquidity) * sqrtP * BAND_FACTOR * p1) / 10 ** p.token1Decimals!;
    if (!(bandUsd > 0)) return;
    byId.set(p.id, Math.min(((p.fees24hUsd ?? 0) * 365 * 100) / bandUsd, 99_999));
  });

  return pools.map((p) => (byId.has(p.id) ? { ...p, aprRange: byId.get(p.id) } : p));
}
