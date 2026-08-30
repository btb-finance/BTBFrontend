/**
 * Full-market pool discovery, shared by Simulate (token pair) and Discover
 * (single token search): merges GeckoTerminal + DexScreener results into one
 * deduped, TVL-sorted list covering every DEX they track — Uniswap V2/V3,
 * SushiSwap, Balancer, and anything else, not just protocols the app can
 * mint on.
 */
import { searchPairPools } from './geckoterminal';
import { fetchDexScreenerPairPools } from './dexscreener';
import { erc20Abi, type PublicClient } from 'viem';
import { getTokenPricesUsd } from './defillama';
import type { EarnPool } from './pools';
import { BAND_FACTOR } from './pools';
import { withSafeMulticall } from './safeMulticall';

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
  /** True when aprPct is the ±5%-range-adjusted figure rather than whole-pool. */
  aprIsRange?: boolean;
  /** Gauge-backed APR replaces generic fee math for ve(3,3) pools. */
  aprKind?: 'fee' | 'gauge';
  aprLabel?: string;
  /**
   * AMM architecture, decided by what the pool contract answers to — not by
   * brand name, so it works for every DEX on every chain. 'v3' means the pool
   * responds to the standard Uniswap V3 slot0/fee reads and can be simulated
   * and range-priced with the shared V3 math; 'v2' means constant-product;
   * 'algebra' means an Algebra-style CLAMM; 'unknown' = unprobed.
   */
  ammClass: 'v3' | 'v2' | 'algebra' | 'unknown';
  url: string;              // pool page on DexScreener
}

export interface MarketPoolNetworks {
  gecko: string;
  dexScreener: string;
}

const MARKET_CACHE_TTL_MS = 5 * 60_000;
const marketPoolCache = new Map<string, { expiresAt: number; request: Promise<MarketPool[]> }>();
const RANGE_TTL = 5 * 60_000;
/** apr null = recently probed but unpriceable (negative cache). */
const rangeCache = new Map<string, { at: number; apr: number | null }>();

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
/** Standard Uniswap V3 pool state — any pool answering these is simulatable
 * with the shared V3 math, regardless of which DEX deployed it. */
const V3_STATE_ABI = [
  {
    type: 'function',
    name: 'slot0',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'liquidity',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const;
const POOL_TOKENS_ABI = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;
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
      // Name-based guess only — enrichMarketPoolApr upgrades this to whatever
      // the pool contract actually answers, which is the authoritative class.
      ammClass: ALGEBRA_STYLE_POOL.test(r.dexId) ? 'algebra' : V2_STYLE_DEX.test(r.dexId) ? 'v2' : 'unknown',
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
 *
 * Probe results are cached per pool address — fee tier and ABI class barely
 * change over minutes, and without the cache every re-compare of the same
 * pair re-fires the whole probe burst at the RPC.
 */
const PROBE_TTL = 10 * 60_000;
const probeCache = new Map<string, { at: number; feePct: number | null; ammClass: MarketPool['ammClass'] }>();

export async function enrichMarketPoolApr(
  client: PublicClient,
  pools: MarketPool[],
): Promise<MarketPool[]> {
  const now = Date.now();
  const freshHits = new Set<string>();
  const seeded = pools.map(pool => {
    const hit = probeCache.get(`${client.chain?.id ?? 0}:${pool.address}`);
    if (!hit || hit.at + PROBE_TTL < now) return pool;
    freshHits.add(pool.address);
    const patched = { ...pool };
    if (patched.feePct == null && hit.feePct != null) patched.feePct = hit.feePct;
    if (patched.ammClass === 'unknown' && hit.ammClass !== 'unknown') patched.ammClass = hit.ammClass;
    return patched;
  });
  // Pools probed recently that yielded nothing (no valid fee, class unknown)
  // are negative-cache entries: re-asking the chain every compare just burns
  // RPC for the same "unknown".
  const failedFresh = new Set<string>();
  for (const address of freshHits) {
    const hit = probeCache.get(`${client.chain?.id ?? 0}:${address}`);
    if (hit && hit.feePct == null && hit.ammClass === 'unknown') failedFresh.add(address);
  }

  const missing = seeded.filter(pool =>
    pool.feePct == null &&
    !failedFresh.has(pool.address) &&
    /^0x[0-9a-f]{40}$/i.test(pool.address) &&
    pool.dexId.trim().toLowerCase() !== SWAAP_VAULT_ID,
  );
  if (missing.length === 0 && !seeded.some(pool => pool.ammClass === 'unknown' && !failedFresh.has(pool.address) && /^0x[0-9a-f]{40}$/i.test(pool.address))) return seeded;

  const feeByAddress = new Map<string, number>();
  const classByAddress = new Map<string, MarketPool['ammClass']>();
  let pendingAlgebra = missing.filter(pool => ALGEBRA_STYLE_POOL.test(pool.dexId));
  for (let attempt = 0; attempt < 2 && pendingAlgebra.length > 0; attempt++) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 250));
    const batch = pendingAlgebra;
    const reads = await withSafeMulticall(client).multicall({
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
        classByAddress.set(pool.address, 'algebra');
      }
    });
    pendingAlgebra = reads.length === 0 && attempt === 0 ? batch : failed;
  }

  const solidlyPools = missing.filter(pool => SOLIDLY_CLASSIC_POOL.test(pool.dexId));
  if (solidlyPools.length > 0) {
    const metadata = await retryRpcOnce(() => withSafeMulticall(client).multicall({
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
      ? await retryRpcOnce(() => withSafeMulticall(client).multicall({
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
    const stableReads = await retryRpcOnce(() => withSafeMulticall(client).multicall({
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
      ? await retryRpcOnce(() => withSafeMulticall(client).multicall({
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
    // Two reads per pool: fee decides the APR, and a successful slot0 proves
    // the pool speaks the standard V3 ABI — that, not the DEX's name, is what
    // makes it simulatable with the shared V3 math.
    const reads = await withSafeMulticall(client).multicall({
      contracts: batch.flatMap(pool => [
        {
          address: pool.address as `0x${string}`,
          abi: POOL_FEE_ABI,
          functionName: 'fee' as const,
        },
        {
          address: pool.address as `0x${string}`,
          abi: V3_STATE_ABI,
          functionName: 'slot0' as const,
        },
      ]),
      allowFailure: true,
    }).catch(() => []);
    const failed: MarketPool[] = [];
    batch.forEach((pool, index) => {
      const feeRead = reads[index * 2];
      const slot0Read = reads[index * 2 + 1];
      if (!feeRead || feeRead.status !== 'success') {
        if (slot0Read?.status !== 'success') failed.push(pool);
        return;
      }
      const fee = Number(feeRead.result);
      // V3-style fees use millionths. Reject zero and the V4 dynamic-fee flag
      // rather than turning either into a fabricated APR. A successful but
      // incompatible fee result is not transient, so it is not retried.
      if (Number.isInteger(fee) && fee > 0 && fee < 1_000_000) {
        feeByAddress.set(pool.address, fee / 1_000_000);
        if (slot0Read?.status === 'success') classByAddress.set(pool.address, 'v3');
      }
    });
    pending = failed;
    if (reads.length === 0 && attempt === 0) {
      // The whole RPC batch failed. The next iteration retries the same
      // unresolved subset through the client's fallback transport.
      pending = batch;
    }
  }

  // Pools whose fee the provider already stated still need their class
  // probed before they can be simulated — the provider's name is not proof
  // of the pool's ABI.
  const needsClass = pools.filter(pool =>
    pool.ammClass === 'unknown'
    && !failedFresh.has(pool.address)
    && !feeByAddress.has(pool.address)
    && !classByAddress.has(pool.address)
    && /^0x[0-9a-f]{40}$/i.test(pool.address)
    && pool.dexId.trim().toLowerCase() !== SWAAP_VAULT_ID,
  );
  if (needsClass.length > 0) {
    const reads = await withSafeMulticall(client).multicall({
      contracts: needsClass.map(pool => ({
        address: pool.address as `0x${string}`,
        abi: V3_STATE_ABI,
        functionName: 'slot0' as const,
      })),
      allowFailure: true,
    }).catch(() => []);
    needsClass.forEach((pool, index) => {
      if (reads[index]?.status === 'success') classByAddress.set(pool.address, 'v3');
    });
  }
  if (feeByAddress.size === 0 && classByAddress.size === 0) return seeded;

  return seeded.map(pool => {
    const feePct = feeByAddress.get(pool.address);
    const ammClass = classByAddress.get(pool.address) ?? pool.ammClass;
    if (feePct != null || ammClass !== pool.ammClass) {
      probeCache.set(`${client.chain?.id ?? 0}:${pool.address}`, { at: now, feePct: feePct ?? pool.feePct, ammClass });
    }
    if (feePct == null && ammClass === pool.ammClass) return pool;
    const aprPct = feePct != null && pool.tvlUsd > 0
      ? (pool.volume24hUsd * feePct * 365 / pool.tvlUsd) * 100
      : null;
    return {
      ...pool,
      ...(feePct != null ? { feePct, aprPct: aprPct != null && isFinite(aprPct) ? aprPct : null } : {}),
      ammClass,
    };
  });
}

/**
 * Upgrade V3-class market pools from whole-pool fee APR to the ±5%-range
 * figure, using the exact same band math as `addRangeAprs` for indexer pools.
 * Architecture-agnostic: any pool classified 'v3' by the probe above gets it,
 * whatever DEX or chain it is on. Pools missing a USD price for token1 keep
 * the whole-pool APR rather than a wrong number.
 */
export async function addMarketRangeAprs(
  client: PublicClient,
  pools: MarketPool[],
  llamaNetwork: string,
): Promise<MarketPool[]> {
  const now = Date.now();
  // Fresh range figures skip the chain entirely — the ±5% band read is the
  // heaviest part of enrichment (5 reads per pool) and barely moves in minutes.
  // null = probed recently and unpriceable (no USD quote for token1): negative
  // cache, so a pool that can't be ranged doesn't get re-read on every compare.
  const served = pools.map(pool => {
    const hit = rangeCache.get(`${client.chain?.id ?? 0}:${pool.address}`);
    if (hit && hit.at + RANGE_TTL > now) {
      if (hit.apr == null) return { ...pool, rangeFailed: true } as MarketPool & { rangeFailed?: boolean };
      return { ...pool, aprPct: hit.apr, aprIsRange: true };
    }
    return pool;
  });
  const targets = served.filter(pool =>
    pool.ammClass === 'v3'
    && !(pool as MarketPool & { rangeFailed?: boolean }).rangeFailed
    && !pool.aprIsRange
    && pool.feePct != null
    && pool.feePct > 0
    && pool.tvlUsd > 0
    && pool.volume24hUsd > 0
    && /^0x[0-9a-f]{40}$/i.test(pool.address),
  );
  if (targets.length === 0) return served;

  // Round 1 resolves the pool's tokens; round 2 reads state + token1 decimals.
  const tokens = await withSafeMulticall(client).multicall({
    contracts: targets.flatMap(pool => ([
      { address: pool.address as `0x${string}`, abi: POOL_TOKENS_ABI, functionName: 'token0' as const },
      { address: pool.address as `0x${string}`, abi: POOL_TOKENS_ABI, functionName: 'token1' as const },
    ])),
    allowFailure: true,
  }).catch(() => []);
  const resolved = targets.flatMap((pool, index) => {
    const t0 = tokens[index * 2], t1 = tokens[index * 2 + 1];
    if (t0?.status !== 'success' || t1?.status !== 'success') return [];
    return [{ pool, token1: (t1.result as string).toLowerCase() as `0x${string}` }];
  });
  if (resolved.length === 0) return pools;

  const state = await withSafeMulticall(client).multicall({
    contracts: resolved.flatMap(({ pool, token1 }) => ([
      { address: pool.address as `0x${string}`, abi: V3_STATE_ABI, functionName: 'slot0' as const },
      { address: pool.address as `0x${string}`, abi: V3_STATE_ABI, functionName: 'liquidity' as const },
      { address: token1, abi: erc20Abi, functionName: 'decimals' as const },
    ])),
    allowFailure: true,
  }).catch(() => []);

  const prices = await getTokenPricesUsd(
    [...new Set(resolved.map(({ token1 }) => token1))],
    llamaNetwork,
  ).catch(() => ({} as Record<string, number>));

  const rangeByAddress = new Map<string, number>();
  resolved.forEach(({ pool, token1 }, index) => {
    const s = state[index * 3], l = state[index * 3 + 1], d = state[index * 3 + 2];
    if (s?.status !== 'success' || l?.status !== 'success' || d?.status !== 'success') return;
    const sqrtPriceX96 = (s.result as readonly unknown[])[0] as bigint;
    const liquidity = l.result as bigint;
    const decimals1 = Number(d.result as number);
    const price1 = prices[token1];
    if (!price1 || liquidity === 0n || sqrtPriceX96 === 0n || !Number.isFinite(decimals1)) return;
    const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
    const bandUsd = (Number(liquidity) * sqrtP * BAND_FACTOR * price1) / 10 ** decimals1;
    if (!(bandUsd > 0)) return;
    const fees24h = pool.volume24hUsd * (pool.feePct ?? 0);
    if (fees24h <= 0) return;
    rangeByAddress.set(pool.address, Math.min((fees24h * 365 * 100) / bandUsd, 99_999));
  });
  if (rangeByAddress.size === 0) {
    // Nothing priced — remember the misses so the next compare doesn't re-read.
    for (const pool of targets) {
      rangeCache.set(`${client.chain?.id ?? 0}:${pool.address}`, { at: now, apr: null });
    }
    return served;
  }

  return served.map(pool => {
    const range = rangeByAddress.get(pool.address);
    if (range == null) return pool;
    rangeCache.set(`${client.chain?.id ?? 0}:${pool.address}`, { at: now, apr: range });
    return { ...pool, aprPct: range, aprIsRange: true };
  });
}

/**
 * One enrichment pipeline for single-chain search and cross-chain research.
 * The hourly catalog supplies gauge/reward APRs, while the chain supplies
 * missing pool fee tiers and the AMM class (by probing the pool contract).
 * Reapplying the catalog last ensures an actionable gauge route is not
 * overwritten by the generic whole-pool fee estimate.
 */
export async function enrichMarketPools(
  client: PublicClient | undefined,
  pools: MarketPool[],
  earnPools: EarnPool[],
  chainName: string,
  tokenAAddress: string,
  tokenBAddress?: string,
  llamaNetwork?: string,
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
  const ranged = client && llamaNetwork
    ? await addMarketRangeAprs(client, feeEnriched, llamaNetwork).catch(() => feeEnriched)
    : feeEnriched;
  return applyGaugeAprCatalog(
    ranged,
    earnPools,
    chainName,
    tokenAAddress,
    tokenBAddress,
  );
}
