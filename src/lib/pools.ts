/**
 * Unified pool list for the Earn tab.
 *
 * Primary source: Uniswap's own indexers (V3 + V4 official subgraphs) — real
 * pool addresses, fee tiers, 24h volume/fees, and fee APR computed from actual
 * fees earned. Set NEXT_PUBLIC_GRAPH_KEY (free Graph API key) to enable.
 *
 * Coverage + fallback: DeFiLlama's keyless yields API for the other DEXs
 * (Aerodrome, Curve, …) and for Uniswap whenever the subgraphs are
 * unavailable, so the screen always has data.
 */
import { getTopPools as getLlamaPools, fmtCompactUsd } from './defillama';
import { getV3TopPools } from '@/protocols/dexs/uniswap/v3/subgraph';
import { getV4TopPools } from '@/protocols/dexs/uniswap/v4/subgraph';
import { hasGraphKey, fmtFeeTier, IndexedPool } from '@/protocols/dexs/uniswap/graph';

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
  tvlUsd: number;
  apy: number;            // total APY % (indexer pools: fee APR)
  apyBase: number;        // fee APY/APR %
  apyReward: number;      // incentive APY % (DeFiLlama only)
  volume24hUsd?: number;  // last complete day — indexer pools only
  fees24hUsd?: number;
  stablecoin: boolean;
  ilRisk: string;         // "yes" | "no"
  underlyingTokens?: string[];
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
    tvlUsd: p.tvlUsd,
    apy: p.feeApr,
    apyBase: p.feeApr,
    apyReward: 0,
    volume24hUsd: p.volume24hUsd,
    fees24hUsd: p.fees24hUsd,
    stablecoin: stable,
    ilRisk: stable ? 'no' : 'yes',
    underlyingTokens: [p.token0.address, p.token1.address],
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
      // Indexer rows replace DeFiLlama's Uniswap V3 mainnet rows (richer data,
      // same pools). Other chains/DEXs keep coming from DeFiLlama.
      if (v3.status === 'fulfilled' && p.project === 'uniswap-v3' && p.chain === 'Ethereum') continue;
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
