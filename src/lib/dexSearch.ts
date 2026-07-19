/**
 * Full-market pool discovery, shared by Simulate (token pair) and Discover
 * (single token search): merges GeckoTerminal + DexScreener results into one
 * deduped, TVL-sorted list covering every DEX they track — Uniswap V2/V3,
 * SushiSwap, Balancer, and anything else, not just protocols the app can
 * mint on.
 */
import { searchPairPools } from './geckoterminal';
import { fetchDexScreenerPairPools } from './dexscreener';
import type { PublicClient } from 'viem';

export interface MarketPool {
  address: string;          // lowercase pool address
  dexId: string;            // raw source id, e.g. "uniswap_v3"
  dexLabel: string;         // human label, e.g. "Uniswap V3"
  name: string;             // e.g. "COMP / WETH 0.3%" (may be empty from DexScreener)
  /** Fee as a fraction (0.003 = 0.3%) when known, else null. */
  feePct: number | null;
  tvlUsd: number;
  volume24hUsd: number;
  /** Whole-pool fee APR % (volume × fee / TVL, annualized) when the fee is known. */
  aprPct: number | null;
  url: string;              // pool page on DexScreener
}

export interface MarketPoolNetworks {
  gecko: string;
  dexScreener: string;
}

const MARKET_CACHE_TTL_MS = 5 * 60_000;
const marketPoolCache = new Map<string, { expiresAt: number; request: Promise<MarketPool[]> }>();

/** DEXes with a fixed 0.30% swap fee (Uniswap V2 forks) — lets us compute a
 * real APR for pools whose fee the APIs don't state. */
const V2_STYLE_DEX = /uniswap.?v2|sushiswap|shibaswap|sakeswap|defi.?swap/i;
const FEE_BEARING_POOL = /(?:^|[\s_-])v3(?:$|[\s_-])|slipstream|integral/i;
const POOL_FEE_ABI = [{
  type: 'function',
  name: 'fee',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'uint24' }],
}] as const;

/** "uniswap_v3" / "balancer_ethereum" → a human label. DexScreener sometimes
 * reports a raw factory address instead of a name — those become "Other DEX"
 * rather than leaking a 0x… string into the UI. */
export function prettyDexLabel(dexId: string): string {
  const clean = dexId
    .replace(/[_-]+/g, ' ')
    .replace(/\s+(ethereum|base|bsc|polygon|arbitrum|optimism|avalanche|linea|berachain|sonic|ronin|unichain|hyperevm|plasma|etherlink|monad|megaeth|robinhood)$/i, '')
    .trim();
  if (!clean || clean.toLowerCase() === 'unknown' || /^0x[0-9a-f]{6,}/i.test(clean)) return 'Other DEX';
  if (/^aerodrome slipstream(?: \d+)?$/i.test(clean)) return 'Aerodrome Slipstream';
  const KNOWN: Record<string, string> = {
    'uniswap v2': 'Uniswap V2', 'uniswap v3': 'Uniswap V3', 'uniswap': 'Uniswap',
    'sushiswap': 'SushiSwap', 'shibaswap': 'ShibaSwap', 'sakeswap': 'SakeSwap',
    'balancer': 'Balancer', 'defi swap': 'DeFi Swap', 'curve': 'Curve',
    'pancakeswap': 'PancakeSwap', 'pancakeswap v3': 'PancakeSwap V3',
    'aerodrome': 'Aerodrome', 'baseswap': 'BaseSwap', 'quickswap': 'QuickSwap',
    'prjx': 'Project X', 'project x': 'Project X',
    'nest': 'Nest', 'nest cl': 'Nest V3',
    'hyperswap': 'HyperSwap', 'hyperswap v3': 'HyperSwap V3',
    'ramses': 'Ramses', 'kittenswap': 'Kittenswap',
    'hybra finance': 'Hybra', 'hybra finance v3': 'Hybra V3',
    'ultrasolid': 'Ultrasolid', 'hypertrade': 'Hypertrade',
    'upheaval finance': 'Upheaval Finance', 'hyperlynx': 'HyperLynx',
    'brownfi': 'BrownFi', 'gliquid': 'Gliquid', 'noxa': 'NOXA',
    'spinup': 'SpinUp', 'hx finance': 'HX Finance', 'hyperbrick': 'HyperBrick',
    'wombat exchange': 'Wombat Exchange', 'skate amm': 'Skate AMM', 'woofi': 'WOOFi',
    'raydium': 'Raydium', 'raydium amm': 'Raydium',
    'orca': 'Orca', 'orca dex': 'Orca',
    'bluefin': 'Bluefin', 'bluefin spot': 'Bluefin',
    'cetus': 'Cetus', 'cetus clmm': 'Cetus',
    'turbos': 'Turbos', 'flowx': 'FlowX', 'full sail': 'Full Sail',
  };
  return KNOWN[clean.toLowerCase()] ?? clean.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * All pools for a token (tokenB omitted) or an exact pair (tokenB given).
 * Dust pools under `minTvlUsd` are dropped as noise.
 */
async function loadMarketPools(
  tokenAAddress: string,
  tokenBAddress?: string,
  minTvlUsd = 100,
  networks: MarketPoolNetworks = { gecko: 'eth', dexScreener: 'ethereum' },
): Promise<MarketPool[]> {
  const [gt, ds] = await Promise.all([
    searchPairPools(tokenAAddress, tokenBAddress, networks.gecko).catch(() => []),
    fetchDexScreenerPairPools(tokenAAddress, tokenBAddress, networks.dexScreener).catch(() => []),
  ]);

  type Raw = { address: string; dexId: string; name: string; tvlUsd: number; volume24hUsd: number; fee: number | null };
  const byAddr = new Map<string, Raw>();
  // GeckoTerminal first — it carries the fee tier (parsed from the pool name)
  for (const p of gt) byAddr.set(p.address, { address: p.address, dexId: p.dexId, name: p.name, tvlUsd: p.tvlUsd, volume24hUsd: p.volume24hUsd, fee: p.fee });
  for (const p of ds) {
    const cur = byAddr.get(p.address);
    if (cur) {
      if (!cur.tvlUsd) cur.tvlUsd = p.tvlUsd;
      if (!cur.volume24hUsd) cur.volume24hUsd = p.volume24hUsd;
    } else {
      byAddr.set(p.address, {
        address: p.address,
        dexId: [p.dexId, ...p.labels].join(' '),
        name: '',
        tvlUsd: p.tvlUsd, volume24hUsd: p.volume24hUsd, fee: null,
      });
    }
  }

  const out: MarketPool[] = [];
  for (const r of byAddr.values()) {
    if (r.tvlUsd < minTvlUsd) continue;
    const feePct = r.fee ?? (V2_STYLE_DEX.test(r.dexId) ? 0.003 : null);
    const aprPct = feePct != null && r.tvlUsd > 0
      ? (r.volume24hUsd * feePct * 365 / r.tvlUsd) * 100
      : null;
    out.push({
      address: r.address,
      dexId: r.dexId,
      dexLabel: prettyDexLabel(r.dexId),
      name: r.name,
      feePct,
      tvlUsd: r.tvlUsd,
      volume24hUsd: r.volume24hUsd,
      aprPct: aprPct != null && isFinite(aprPct) ? aprPct : null,
      url: `https://dexscreener.com/${networks.dexScreener}/${r.address}`,
    });
  }
  out.sort((a, b) => b.tvlUsd - a.tvlUsd);
  return out;
}

/**
 * Shared cached entry point for Discover and Simulate. Pair keys are order
 * independent, so A/B and B/A navigation reuse the same provider response.
 */
export function searchMarketPools(
  tokenAAddress: string,
  tokenBAddress?: string,
  minTvlUsd = 100,
  networks: MarketPoolNetworks = { gecko: 'eth', dexScreener: 'ethereum' },
): Promise<MarketPool[]> {
  const tokens = [tokenAAddress.toLowerCase(), tokenBAddress?.toLowerCase()].filter((token): token is string => !!token);
  if (tokens.length === 2) tokens.sort();
  const key = `${networks.gecko}:${networks.dexScreener}:${minTvlUsd}:${tokens.join(':')}`;
  const cached = marketPoolCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.request;

  const request = loadMarketPools(tokenAAddress, tokenBAddress, minTvlUsd, networks)
    .catch(error => {
      marketPoolCache.delete(key);
      throw error;
    });
  marketPoolCache.set(key, { expiresAt: Date.now() + MARKET_CACHE_TTL_MS, request });
  return request;
}

/**
 * Fill fee APRs that the market APIs could not calculate by reading every
 * missing V3-style pool fee in one EVM multicall. This is especially
 * important for Robinhood (not indexed by GeckoTerminal) and also makes
 * transient Gecko rate limits harmless: DexScreener can still provide
 * TVL/volume while the chain supplies the fee.
 */
export async function enrichMarketPoolApr(
  client: PublicClient,
  pools: MarketPool[],
): Promise<MarketPool[]> {
  const missing = pools.filter(pool =>
    pool.feePct == null &&
    /^0x[0-9a-f]{40}$/i.test(pool.address) &&
    FEE_BEARING_POOL.test(pool.dexId),
  );
  if (missing.length === 0) return pools;

  const feeByAddress = new Map<string, number>();
  let pending = missing;
  for (let attempt = 0; attempt < 2 && pending.length > 0; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 250));
    const batch = pending;
    const reads = await client.multicall({
      contracts: batch.map(pool => ({
        address: pool.address as `0x${string}`,
        abi: POOL_FEE_ABI,
        functionName: 'fee' as const,
      })),
      allowFailure: true,
    }).catch(() => []);
    const failed: MarketPool[] = [];
    batch.forEach((pool, index) => {
      const read = reads[index];
      if (!read || read.status !== 'success') {
        failed.push(pool);
        return;
      }
      const fee = Number(read.result);
      // V3-style fees use millionths. Reject zero and the V4 dynamic-fee flag
      // rather than turning either into a fabricated APR. A successful but
      // incompatible fee result is not transient, so it is not retried.
      if (Number.isInteger(fee) && fee > 0 && fee < 1_000_000) {
        feeByAddress.set(pool.address, fee / 1_000_000);
      }
    });
    pending = failed;
    if (reads.length === 0 && attempt === 0) {
      // The whole RPC batch failed. The next iteration retries the same
      // unresolved subset through the client's fallback transport.
      pending = batch;
    }
  }
  if (feeByAddress.size === 0) return pools;

  return pools.map(pool => {
    const feePct = feeByAddress.get(pool.address);
    if (feePct == null) return pool;
    const aprPct = pool.tvlUsd > 0
      ? (pool.volume24hUsd * feePct * 365 / pool.tvlUsd) * 100
      : null;
    return {
      ...pool,
      feePct,
      aprPct: aprPct != null && isFinite(aprPct) ? aprPct : null,
    };
  });
}
