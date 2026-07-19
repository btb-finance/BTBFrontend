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
  apyPct1D?: number;   // APY change over the last 24h, in percentage points
  volume24hUsd?: number;
  feeTierPct?: number; // e.g. 0.3 for "0.30%" — DeFiLlama's `poolMeta` on AMM rows
  stablecoin: boolean;
  ilRisk: string;      // "yes" | "no"
  underlyingTokens?: string[];
}

// project slug -> friendly DEX name. Add more slugs to widen coverage.
const DEX_NAMES: Record<string, string> = {
  'uniswap-v3': 'Uniswap', 'uniswap-v2': 'Uniswap', 'uniswap-v4': 'Uniswap',
  'aerodrome-v1': 'Aerodrome', 'aerodrome-slipstream': 'Aerodrome',
  'alien-base-v3': 'Alien Base',
  'blackhole-clmm': 'Blackhole', 'blackhole': 'Blackhole',
  'beets-dex-v3': 'Beets',
  'velodrome-v2': 'Velodrome', 'velodrome-v3': 'Velodrome',
  'pancakeswap-amm': 'PancakeSwap', 'pancakeswap-amm-v3': 'PancakeSwap',
  'sushiswap': 'SushiSwap', 'sushiswap-v3': 'SushiSwap',
  'curve-dex': 'Curve',
  'balancer-v2': 'Balancer', 'balancer-v3': 'Balancer',
  'camelot-v2': 'Camelot', 'camelot-v3': 'Camelot',
  'fluid-dex': 'Fluid',
  'project-x': 'Project X',
  'nest-amm': 'Nest', 'nest-cl': 'Nest',
  'hybra-v4': 'Hybra',
  'hyperswap-v2': 'HyperSwap', 'hyperswap-v3': 'HyperSwap',
  'ultrasolid-v2': 'Ultrasolid', 'ultrasolid-v3': 'Ultrasolid',
  'hypertrade-v2': 'Hypertrade', 'hypertrade-v3': 'Hypertrade',
  'upheaval-v2': 'Upheaval Finance', 'upheaval-v3': 'Upheaval Finance',
  'hyperlynx-v2': 'HyperLynx', 'hyperlynx-v3': 'HyperLynx',
  'brownfi-v2': 'BrownFi', 'brownfi-v3': 'BrownFi',
  'gliquid': 'Gliquid',
  'noxa-dex-v2': 'NOXA', 'noxa-dex-v3': 'NOXA',
  'spinup-dex': 'SpinUp',
  'hx-finance': 'HX Finance',
  'hyperbrick': 'HyperBrick',
  'wombat-exchange': 'Wombat Exchange',
  'skate-amm': 'Skate AMM',
  'woofi-swap': 'WOOFi',
  'joe-v2.2': 'Trader Joe',
  'kyberswap-fairflow': 'KyberSwap',
  'pharaoh-v3': 'Pharaoh',
  'quickswap-dex': 'QuickSwap',
  'ramses-cl-v2': 'Ramses',
  'sparkdex-v3.1': 'SparkDEX', 'sparkdex-v4': 'SparkDEX',
  'raydium-amm': 'Raydium',
  'orca-dex': 'Orca',
  'bluefin-spot': 'Bluefin',
  'cetus-clmm': 'Cetus',
  'turbos': 'Turbos',
  'flowx-v2': 'FlowX', 'flowx-v3': 'FlowX',
  'full-sail': 'Full Sail',
};

interface RawPool {
  pool: string; project: string; chain: string; symbol: string;
  tvlUsd?: number; apy?: number; apyBase?: number; apyReward?: number; apyPct1D?: number;
  volumeUsd1d?: number; poolMeta?: string;
  stablecoin?: boolean; ilRisk?: string; underlyingTokens?: string[];
}

function parseFeeTierPct(poolMeta?: string): number | undefined {
  if (!poolMeta) return undefined;
  const n = parseFloat(poolMeta.replace('%', ''));
  return isFinite(n) ? n : undefined;
}

/**
 * @param projects Restrict to these DeFiLlama project slugs before ranking by
 * TVL and slicing to `limit`. Without this, a handful of huge Curve/Balancer
 * pools can fill the whole top-N slice and crowd out every actionable
 * Uniswap/PancakeSwap pool a caller actually wanted (they'd just get filtered
 * back out downstream, wasting the slots). Pass the exact slugs you'll use.
 */
export async function getTopPools(limit = 80, minTvlUsd = 50_000, projects?: string[]): Promise<LlamaPool[]> {
  const res = await fetch('https://yields.llama.fi/pools');
  if (!res.ok) throw new Error(`DeFiLlama ${res.status}`);
  const json = await res.json();
  const rows: RawPool[] = json?.data ?? [];
  const allowed = projects ? new Set(projects) : null;

  const ranked = rows
    .filter((r) => DEX_NAMES[r.project] && (!allowed || allowed.has(r.project)) && (r.tvlUsd ?? 0) >= minTvlUsd)
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
      apyPct1D: r.apyPct1D ?? undefined,
      volume24hUsd: r.volumeUsd1d ?? undefined,
      feeTierPct: parseFeeTierPct(r.poolMeta),
      stablecoin: !!r.stablecoin,
      ilRisk: r.ilRisk ?? 'yes',
      underlyingTokens: r.underlyingTokens,
    }))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);

  // Keep the global leaders, then reserve enough rows for every indexed chain.
  // Otherwise Ethereum/Base consume the entire global slice and healthy pools
  // on HyperEVM and other smaller chains never reach the shared snapshot.
  const selected = ranked.slice(0, limit);
  const selectedIds = new Set(selected.map((pool) => pool.id));
  const chainCounts = new Map<string, number>();
  for (const pool of selected) chainCounts.set(pool.chain, (chainCounts.get(pool.chain) ?? 0) + 1);
  const minPoolsPerChain = 12;
  for (const pool of ranked) {
    if (selectedIds.has(pool.id) || (chainCounts.get(pool.chain) ?? 0) >= minPoolsPerChain) continue;
    selected.push(pool);
    selectedIds.add(pool.id);
    chainCounts.set(pool.chain, (chainCounts.get(pool.chain) ?? 0) + 1);
  }

  // Non-EVM discovery is intentionally read-only for now, so DeFiLlama is
  // its complete catalog. Retain a few qualifying pools per DEX as well as
  // per chain; otherwise the largest Raydium/Bluefin rows can hide smaller
  // venues such as Orca, Turbos, FlowX, and Full Sail.
  const nonEvmChains = new Set(['Solana', 'Sui']);
  const venueCounts = new Map<string, number>();
  for (const pool of selected) {
    if (!nonEvmChains.has(pool.chain)) continue;
    const key = `${pool.chain}:${pool.project}`;
    venueCounts.set(key, (venueCounts.get(key) ?? 0) + 1);
  }
  const minPoolsPerNonEvmVenue = 3;
  for (const pool of ranked) {
    if (!nonEvmChains.has(pool.chain) || selectedIds.has(pool.id)) continue;
    const key = `${pool.chain}:${pool.project}`;
    if ((venueCounts.get(key) ?? 0) >= minPoolsPerNonEvmVenue) continue;
    selected.push(pool);
    selectedIds.add(pool.id);
    venueCounts.set(key, (venueCounts.get(key) ?? 0) + 1);
  }
  return selected.sort((a, b) => b.tvlUsd - a.tvlUsd);
}

export interface PoolChartPoint { timestamp: number; tvlUsd: number; apy: number; }

interface RawChartPoint { timestamp: string; tvlUsd: number | null; apy: number | null; }

/**
 * Historical TVL/APY for a single DeFiLlama-sourced pool — free, keyless.
 * Used for the Discover table's trend sparkline + day-over-day APY change
 * when a pool has no on-chain address to query elsewhere (see geckoterminal.ts
 * for the indexer-sourced-pool equivalent).
 */
export async function fetchPoolChart(poolId: string): Promise<PoolChartPoint[]> {
  try {
    const res = await fetch(`https://yields.llama.fi/chart/${poolId}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const json = await res.json() as { data?: RawChartPoint[] };
    return (json.data ?? [])
      .filter((r): r is RawChartPoint & { tvlUsd: number; apy: number } => r.tvlUsd != null && r.apy != null)
      .map(r => ({ timestamp: new Date(r.timestamp).getTime(), tvlUsd: r.tvlUsd, apy: r.apy }));
  } catch {
    return [];
  }
}

/**
 * Current USD prices for Ethereum mainnet tokens via DeFiLlama's keyless
 * coins API. Returns a map keyed by lowercase address; missing tokens omitted.
 */
export async function getTokenPricesUsd(addresses: string[], chain = 'ethereum'): Promise<Record<string, number>> {
  const keys = addresses.map((a) => `${chain}:${a.toLowerCase()}`);
  const res = await fetch(`https://coins.llama.fi/prices/current/${keys.join(',')}`);
  if (!res.ok) throw new Error(`llama prices ${res.status}`);
  const json = await res.json();
  const out: Record<string, number> = {};
  for (const a of addresses) {
    const price = json?.coins?.[`${chain}:${a.toLowerCase()}`]?.price;
    if (typeof price === 'number' && price > 0) out[a.toLowerCase()] = price;
  }
  return out;
}

/** Compact USD, e.g. $1.2M / $940K. */
export function fmtCompactUsd(n: number): string {
  if (!isFinite(n) || n <= 0) return '$0';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
