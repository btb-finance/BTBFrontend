/**
 * Unified pool list for the Earn tab — Uniswap V3 + V4 on Ethereum mainnet.
 *
 * Primary source: Uniswap's own indexers (V3 + V4 official subgraphs) — real
 * pool addresses, fee tiers, 24h volume/fees, and fee APR computed from actual
 * fees earned. Set NEXT_PUBLIC_GRAPH_KEY (free Graph API key) to enable.
 *
 * Other DEXs (Aerodrome, Curve, …) are staged — the Earn tab shows them as
 * "coming soon" instead of listing pools we can't act on. DeFiLlama's keyless
 * yields API remains only as a fallback for Uniswap V3 mainnet whenever the
 * subgraphs are unavailable, so the screen always has actionable pools.
 */
import type { Abi, PublicClient } from 'viem';
import { getTopPools as getLlamaPools, getTokenPricesUsd, fmtCompactUsd } from './defillama';
import { getV3TopPools } from '@/protocols/dexs/uniswap/v3/subgraph';
import { getV4TopPools } from '@/protocols/dexs/uniswap/v4/subgraph';
import { hasGraphKey, fmtFeeTier, IndexedPool } from '@/protocols/dexs/uniswap/graph';
import { POOL_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { STATE_VIEW_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import { UNISWAP_V4 } from '@/protocols/dexs/uniswap/v4/addresses';

export { fmtCompactUsd, fmtFeeTier };

export interface EarnPool {
  id: string;
  /** 'uniswap-v3' | 'uniswap-v4' | DeFiLlama project slug. */
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
  source: 'uniswap' | 'defillama';
}

const STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDS', 'USDE', 'FRAX', 'GHO', 'LUSD', 'PYUSD', 'TUSD', 'USDP', 'FDUSD']);

function fromIndexed(p: IndexedPool): EarnPool {
  const stable = STABLES.has(p.token0.symbol.toUpperCase()) && STABLES.has(p.token1.symbol.toUpperCase());
  return {
    id: p.id,
    project: `uniswap-${p.version}`,
    dex: 'Uniswap',
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

export async function getEarnPools(): Promise<EarnPool[]> {
  const [v3, v4, llama] = await Promise.allSettled([
    hasGraphKey ? getV3TopPools() : Promise.reject(new Error('no key')),
    hasGraphKey ? getV4TopPools() : Promise.reject(new Error('no key')),
    getLlamaPools(),
  ]);

  const pools: EarnPool[] = [];

  if (v3.status === 'fulfilled') pools.push(...v3.value.map(fromIndexed));
  if (v4.status === 'fulfilled') pools.push(...v4.value.map(fromIndexed));

  if (llama.status === 'fulfilled') {
    for (const p of llama.value) {
      // Uniswap V3 mainnet only, and only when the indexer rows are missing —
      // every listed pool must be actionable in-app. Other DEXs are staged.
      if (p.project !== 'uniswap-v3' || p.chain !== 'Ethereum') continue;
      if (v3.status === 'fulfilled') continue;
      pools.push({ ...p, source: 'defillama' });
    }
  }

  if (pools.length === 0) {
    const err =
      (llama.status === 'rejected' && llama.reason instanceof Error && llama.reason.message) || 'no pool source available';
    throw new Error(err);
  }

  return pools.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

/** External link for a pool — Uniswap explore page for indexer pools, DeFiLlama otherwise. */
export function poolLink(p: EarnPool): string {
  if (p.source === 'uniswap') return `https://app.uniswap.org/explore/pools/ethereum/${p.id}`;
  return `https://defillama.com/yields/pool/${p.id}`;
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
