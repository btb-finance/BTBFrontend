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
import type { EarnPool } from './pools';

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
  /** Gauge-backed APR replaces generic fee math for ve(3,3) pools. */
  aprKind?: 'fee' | 'gauge';
  aprLabel?: string;
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
const ALGEBRA_STYLE_POOL = /hydrex|integral|clamm/i;
const SOLIDLY_CLASSIC_POOL = /^(?:aerodrome|velodrome)(?!.*slipstream).*$/i;
const INFUSION_POOL = /^infusion(?:[\s_-]+v[12])?$/i;
const SWAAP_VAULT_ID = '0x03c01acae3d0173a93d819efdc832c7c4f153b06';
const INFUSION_BASE_FACTORY = '0x2D9A3a2bd6400eE28d770c7254cA840c82faf23f' as const;
const POOL_FEE_ABI = [{
  type: 'function',
  name: 'fee',
  stateMutability: 'view',
  inputs: [],
  outputs: [{ type: 'uint24' }],
}] as const;
const ALGEBRA_GLOBAL_STATE_ABI = [{
  type: 'function',
  name: 'globalState',
  stateMutability: 'view',
  inputs: [],
  outputs: [
    { name: 'price', type: 'uint160' },
    { name: 'tick', type: 'int24' },
    { name: 'lastFee', type: 'uint16' },
    { name: 'pluginConfig', type: 'uint8' },
    { name: 'communityFee', type: 'uint16' },
    { name: 'unlocked', type: 'bool' },
  ],
}] as const;
const SOLIDLY_POOL_ABI = [
  {
    type: 'function',
    name: 'stable',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'factory',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;
const SOLIDLY_FACTORY_FEE_ABI = [{
  type: 'function',
  name: 'getFee',
  stateMutability: 'view',
  inputs: [{ type: 'address' }, { type: 'bool' }],
  outputs: [{ type: 'uint256' }],
}] as const;
const INFUSION_FACTORY_FEE_ABI = [{
  type: 'function',
  name: 'getFee',
  stateMutability: 'view',
  inputs: [{ type: 'bool' }],
  outputs: [{ type: 'uint256' }],
}] as const;

async function retryRpcOnce<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    await new Promise(resolve => setTimeout(resolve, 250));
    try {
      return await read();
    } catch {
      return null;
    }
  }
}

/** "uniswap_v3" / "balancer_ethereum" → a human label. DexScreener sometimes
 * reports a raw factory address instead of a name — those become "Other DEX"
 * rather than leaking a 0x… string into the UI. */
export function prettyDexLabel(dexId: string): string {
  if (dexId.trim().toLowerCase() === SWAAP_VAULT_ID) return 'Swaap V2';
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

function normalizedMarketChain(name: string): string {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return {
    bnbchain: 'bsc',
    bnbsmartchain: 'bsc',
    arbitrumone: 'arbitrum',
    opmainnet: 'optimism',
    polygonmainnet: 'polygon',
    hyperliquidl1: 'hyperevm',
  }[normalized] ?? normalized;
}

function marketDexBrand(label: string): string {
  return label.replace(/\s+V\d+.*$/i, '').replace(/\s+Slipstream.*$/i, '').trim().toLowerCase();
}

/** Reuse the hourly shared gauge catalog to attach real ve(3,3) APRs without
 * another protocol request. Multiple pools can share the same token pair, so
 * fee tier, liquidity model, TVL, and volume identify the closest row. */
export function applyGaugeAprCatalog(
  marketPools: MarketPool[],
  earnPools: EarnPool[],
  chainName: string,
  tokenAAddress: string,
  tokenBAddress?: string,
): MarketPool[] {
  const tokenA = tokenAAddress.toLowerCase();
  const pairKey = tokenBAddress
    ? [tokenA, tokenBAddress.toLowerCase()].sort().join(':')
    : null;
  const candidates = earnPools.filter(pool =>
    pool.yieldMode !== undefined
    && pool.yieldMode !== 'combined'
    && normalizedMarketChain(pool.chain) === normalizedMarketChain(chainName)
    && pool.underlyingTokens?.length === 2
    && (pairKey
      ? pool.underlyingTokens.map(address => address.toLowerCase()).sort().join(':') === pairKey
      : pool.underlyingTokens.some(address => address.toLowerCase() === tokenA))
  );
  if (candidates.length === 0) return marketPools;

  const ratioDistance = (a: number, b?: number) => b != null && a > 0 && b > 0
    ? Math.abs(Math.log(a / b))
    : 0;
  const distance = (market: MarketPool, pool: EarnPool): number => {
    const marketText = `${market.dexId} ${market.dexLabel} ${market.name}`.toLowerCase();
    const asksForCl = /slipstream|concentrated|\bcl\b|\bv3\b/.test(marketText);
    const modelPenalty = asksForCl && pool.liquidityModel !== 'CLMM' ? 4 : 0;
    const poolFee = pool.feeTier != null ? pool.feeTier / 1_000_000 : undefined;
    const feePenalty = market.feePct != null && poolFee != null
      // ve(3,3) CL fees can move dynamically; use the fee as a tie-breaker,
      // while TVL and volume remain the stronger identity signals.
      ? ratioDistance(market.feePct, poolFee)
      : 0;
    return modelPenalty
      + feePenalty
      + ratioDistance(market.tvlUsd, pool.tvlUsd)
      + ratioDistance(market.volume24hUsd, pool.volume24hUsd);
  };

  return marketPools.map(market => {
    const sameDex = candidates.filter(pool => marketDexBrand(pool.dex) === marketDexBrand(market.dexLabel));
    if (sameDex.length === 0) return market;
    const match = [...sameDex].sort((a, b) => distance(market, a) - distance(market, b))[0];
    // Do not smear one popular pair's gauge APR onto a different small pool
    // merely because its token symbols and DEX are the same.
    if (!match || distance(market, match) > 2.5 || !(match.apy > 0)) return market;
    const reward = match.rewardTokenSymbols?.join(' + ') || 'gauge';
    return {
      ...market,
      aprPct: match.apy,
      aprKind: match.requiresStaking ? 'gauge' : 'fee',
      aprLabel: match.requiresStaking ? `Stake LP · ${reward}` : 'Unstaked fees',
    };
  });
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
      aprLabel: r.dexId.trim().toLowerCase() === SWAAP_VAULT_ID
        ? 'Swaap V2 has no on-chain swap fee. LP economics are included in signed RFQ quotes, so volume cannot be converted into a fee APR.'
        : undefined,
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
 * Fill fee APRs that the market APIs could not calculate by reading pool fees
 * from the chain. Standard V3 pools expose fee(), while Algebra-style CLAMMs
 * expose their active fee through globalState(). This also makes transient
 * Gecko rate limits harmless: DexScreener can provide TVL/volume while the
 * chain supplies the fee.
 */
export async function enrichMarketPoolApr(
  client: PublicClient,
  pools: MarketPool[],
): Promise<MarketPool[]> {
  const missing = pools.filter(pool =>
    pool.feePct == null &&
    /^0x[0-9a-f]{40}$/i.test(pool.address) &&
    pool.dexId.trim().toLowerCase() !== SWAAP_VAULT_ID,
  );
  if (missing.length === 0) return pools;

  const feeByAddress = new Map<string, number>();
  let pendingAlgebra = missing.filter(pool => ALGEBRA_STYLE_POOL.test(pool.dexId));
  for (let attempt = 0; attempt < 2 && pendingAlgebra.length > 0; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 250));
    const batch = pendingAlgebra;
    const reads = await client.multicall({
      contracts: batch.map(pool => ({
        address: pool.address as `0x${string}`,
        abi: ALGEBRA_GLOBAL_STATE_ABI,
        functionName: 'globalState' as const,
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
      const fee = Number(read.result[2]);
      if (Number.isInteger(fee) && fee > 0 && fee < 1_000_000) {
        feeByAddress.set(pool.address, fee / 1_000_000);
      }
    });
    pendingAlgebra = reads.length === 0 && attempt === 0 ? batch : failed;
  }

  const solidlyPools = missing.filter(pool => SOLIDLY_CLASSIC_POOL.test(pool.dexId));
  if (solidlyPools.length > 0) {
    const metadata = await retryRpcOnce(() => client.multicall({
      contracts: solidlyPools.flatMap(pool => [
        {
          address: pool.address as `0x${string}`,
          abi: SOLIDLY_POOL_ABI,
          functionName: 'stable' as const,
        },
        {
          address: pool.address as `0x${string}`,
          abi: SOLIDLY_POOL_ABI,
          functionName: 'factory' as const,
        },
      ]),
      allowFailure: true,
    })) ?? [];
    const resolved = solidlyPools.flatMap((pool, index) => {
      const stableRead = metadata[index * 2];
      const factoryRead = metadata[index * 2 + 1];
      if (stableRead?.status !== 'success' || factoryRead?.status !== 'success') return [];
      return [{
        pool,
        stable: stableRead.result as boolean,
        factory: factoryRead.result as `0x${string}`,
      }];
    });
    const fees = resolved.length > 0
      ? await retryRpcOnce(() => client.multicall({
          contracts: resolved.map(({ pool, stable, factory }) => ({
            address: factory,
            abi: SOLIDLY_FACTORY_FEE_ABI,
            functionName: 'getFee' as const,
            args: [pool.address as `0x${string}`, stable] as const,
          })),
          allowFailure: true,
        })) ?? []
      : [];
    resolved.forEach(({ pool }, index) => {
      const read = fees[index];
      const fee = read?.status === 'success' ? Number(read.result) : NaN;
      if (Number.isInteger(fee) && fee > 0 && fee < 10_000) {
        feeByAddress.set(pool.address, fee / 10_000);
      }
    });
  }

  const infusionPools = missing.filter(pool => INFUSION_POOL.test(pool.dexId));
  if (infusionPools.length > 0) {
    const stableReads = await retryRpcOnce(() => client.multicall({
      contracts: infusionPools.map(pool => ({
        address: pool.address as `0x${string}`,
        abi: SOLIDLY_POOL_ABI,
        functionName: 'stable' as const,
      })),
      allowFailure: true,
    })) ?? [];
    const resolved = infusionPools.flatMap((pool, index) => {
      const read = stableReads[index];
      return read?.status === 'success' ? [{ pool, stable: read.result as boolean }] : [];
    });
    const fees = resolved.length > 0
      ? await retryRpcOnce(() => client.multicall({
          contracts: resolved.map(({ stable }) => ({
            address: INFUSION_BASE_FACTORY,
            abi: INFUSION_FACTORY_FEE_ABI,
            functionName: 'getFee' as const,
            args: [stable] as const,
          })),
          allowFailure: true,
        })) ?? []
      : [];
    resolved.forEach(({ pool }, index) => {
      const read = fees[index];
      const fee = read?.status === 'success' ? Number(read.result) : NaN;
      if (Number.isInteger(fee) && fee > 0 && fee < 10_000) {
        feeByAddress.set(pool.address, fee / 10_000);
      }
    });
  }

  let pending = missing.filter(pool =>
    !ALGEBRA_STYLE_POOL.test(pool.dexId)
    && !feeByAddress.has(pool.address),
  );
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

/**
 * One enrichment pipeline for single-chain search and cross-chain research.
 * The hourly catalog supplies gauge/reward APRs, while the chain supplies
 * missing pool fee tiers. Reapplying the catalog last ensures an actionable
 * gauge route is not overwritten by the generic whole-pool fee estimate.
 */
export async function enrichMarketPools(
  client: PublicClient | undefined,
  pools: MarketPool[],
  earnPools: EarnPool[],
  chainName: string,
  tokenAAddress: string,
  tokenBAddress?: string,
): Promise<MarketPool[]> {
  const catalogEnriched = applyGaugeAprCatalog(
    pools,
    earnPools,
    chainName,
    tokenAAddress,
    tokenBAddress,
  );
  const feeEnriched = client
    ? await enrichMarketPoolApr(client, catalogEnriched).catch(() => catalogEnriched)
    : catalogEnriched;
  return applyGaugeAprCatalog(
    feeEnriched,
    earnPools,
    chainName,
    tokenAAddress,
    tokenBAddress,
  );
}
