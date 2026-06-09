/**
 * Live DeFi yield data from DeFiLlama's free, key-less yields API.
 * Powers the Earn tab's liquidity-pool list with real APR / TVL.
 *
 *   GET https://yields.llama.fi/pools  ->  { status, data: Pool[] }
 *
 * We keep only AMM/LP DEXs (so the list is "pools you provide liquidity to",
 * not lending/vault rows) and normalise each project slug to a friendly DEX
 * name used for the filter chips.
 */

export interface LlamaPool {
  id: string;          // DeFiLlama pool uuid
  project: string;     // raw slug, e.g. "uniswap-v3"
  dex: string;         // friendly name, e.g. "Uniswap"
  chain: string;       // e.g. "Ethereum", "Base", "Avalanche"
  pair: string;        // e.g. "WETH-USDC"
  tvlUsd: number;
  apy: number;         // total APY %
  apyBase: number;     // fee APY %
  apyReward: number;   // incentive APY %
  stablecoin: boolean;
  ilRisk: string;      // "yes" | "no"
  underlyingTokens?: string[];
}

// project slug -> friendly DEX name. Add more slugs to widen coverage.
const DEX_NAMES: Record<string, string> = {
  'uniswap-v3': 'Uniswap', 'uniswap-v2': 'Uniswap',
  'aerodrome-v1': 'Aerodrome', 'aerodrome-slipstream': 'Aerodrome',
  'blackhole-clmm': 'Blackhole', 'blackhole': 'Blackhole',
  'velodrome-v2': 'Velodrome', 'velodrome-v3': 'Velodrome',
  'pancakeswap-amm': 'PancakeSwap', 'pancakeswap-amm-v3': 'PancakeSwap',
  'sushiswap': 'SushiSwap', 'sushiswap-v3': 'SushiSwap',
  'curve-dex': 'Curve',
  'balancer-v2': 'Balancer', 'balancer-v3': 'Balancer',
  'camelot-v3': 'Camelot',
};

interface RawPool {
  pool: string; project: string; chain: string; symbol: string;
  tvlUsd?: number; apy?: number; apyBase?: number; apyReward?: number;
  stablecoin?: boolean; ilRisk?: string; underlyingTokens?: string[];
}

export async function getTopPools(limit = 80, minTvlUsd = 50_000): Promise<LlamaPool[]> {
  const res = await fetch('https://yields.llama.fi/pools');
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`);
  const json = await res.json();
  const rows: RawPool[] = json?.data ?? [];

  return rows
    .filter((r) => DEX_NAMES[r.project] && (r.tvlUsd ?? 0) >= minTvlUsd)
    .map((r) => ({
      id: r.pool,
      project: r.project,
      dex: DEX_NAMES[r.project],
      chain: r.chain,
      pair: r.symbol,
      tvlUsd: r.tvlUsd ?? 0,
      apy: r.apy ?? 0,
      apyBase: r.apyBase ?? 0,
      apyReward: r.apyReward ?? 0,
      stablecoin: !!r.stablecoin,
      ilRisk: r.ilRisk ?? 'yes',
      underlyingTokens: r.underlyingTokens,
    }))
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit);
}

/** Universal, always-valid link to a pool (shows stats + outbound to the DEX). */
export function poolLink(p: LlamaPool): string {
  return `https://defillama.com/yields/pool/${p.id}`;
}

/** Compact USD, e.g. $1.2M / $940K. */
export function fmtCompactUsd(n: number): string {
  if (!isFinite(n) || n <= 0) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
