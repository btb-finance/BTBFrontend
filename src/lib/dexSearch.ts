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

/** One retry after a short pause if the entire transport batch came back
 * empty. Per-read failures are already tolerated by allowFailure, and the
 * failover transport handles flaky endpoints — no fixed sleeps on the happy
 * path. */
type BatchRead = { status: 'success' | 'failure'; result?: unknown; error?: unknown };

async function multicallBatch(client: PublicClient, contracts: readonly unknown[]): Promise<BatchRead[]> {
  const run = () => withSafeMulticall(client).multicall({ contracts: contracts as never, allowFailure: true }).catch(() => [] as BatchRead[]);
  const first = await run();
  if (Array.isArray(first) && first.length > 0) return first as BatchRead[];
  await new Promise(resolve => setTimeout(resolve, 200));
  return (await run()) as BatchRead[];
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
      // Name-based guess only — probePoolsOnChain upgrades this to whatever
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

// ── On-chain enrichment ─────────────────────────────────────────────────────
// Two speculative rounds for ANY number of pools, whatever the probe needs:
//   round 1: fee/globalState + slot0 + token0 + token1  (classify + fee + tokens)
//   round 2: liquidity + decimals(token1)               (range math inputs)
// With Multicall3 batching each round is one RPC request, so a 40-pool search
// costs ~2 requests instead of the ~5–6 sequential rounds it used to.

const PROBE_TTL = 10 * 60_000;
const probeCache = new Map<string, { at: number; feePct: number | null; ammClass: MarketPool['ammClass'] }>();

const validAddr = (address: string) => /^0x[0-9a-f]{40}$/i.test(address);
const validFeeMilli = (fee: number) => Number.isInteger(fee) && fee > 0 && fee < 1_000_000;

/**
 * Fill fee APRs the market APIs could not calculate, classify each pool's AMM
 * by what its contract answers (fee+slot0 → simulatable V3; globalState →
 * Algebra), and — when `llamaNetwork` is given — upgrade V3-class pools to the
 * ±5%-range APR using the same band math as addRangeAprs for indexer pools.
 * Probe results are cached per address (including negatives: a pool that
 * yielded nothing is not re-asked on every compare).
 */
export async function probePoolsOnChain(
  client: PublicClient,
  pools: MarketPool[],
  llamaNetwork?: string,
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
  // Negative entries: probed recently, learned nothing. Re-asking the chain
  // every compare just burns RPC for the same "unknown".
  const failedFresh = new Set<string>();
  for (const address of freshHits) {
    const hit = probeCache.get(`${client.chain?.id ?? 0}:${address}`);
    if (hit && hit.feePct == null && hit.ammClass === 'unknown') failedFresh.add(address);
  }
  const rangeFailed = new Set<string>();
  const served = seeded.map(pool => {
    const hit = rangeCache.get(`${client.chain?.id ?? 0}:${pool.address}`);
    if (hit && hit.at + RANGE_TTL > now) {
      if (hit.apr == null) { rangeFailed.add(pool.address); return pool; }
      return { ...pool, aprPct: hit.apr, aprIsRange: true };
    }
    return pool;
  });

  // Pools that need chain reads at all: fee unknown, class unknown, or range
  // upgrade wanted (and not already served/negatively-cached).
  const needsFeeOrClass = (p: MarketPool) =>
    (p.feePct == null || p.ammClass === 'unknown')
    && !failedFresh.has(p.address)
    && validAddr(p.address)
    && p.dexId.trim().toLowerCase() !== SWAAP_VAULT_ID;
  const needsRange = (p: MarketPool) =>
    llamaNetwork != null
    && p.ammClass === 'v3'
    && !p.aprIsRange
    && !rangeFailed.has(p.address)
    && validAddr(p.address);
  const probed = served.filter(pool => needsFeeOrClass(pool) || needsRange(pool));
  if (probed.length === 0) return served;

  const feeByAddress = new Map<string, number>();
  const classByAddress = new Map<string, MarketPool['ammClass']>();
  const token1ByAddress = new Map<string, `0x${string}`>();
  const sqrtByAddress = new Map<string, bigint>();

  // ── Round 1: identity + fee + class + tokens, one batch ──
  // (per-pool read counts differ — algebra pools skip fee/slot0 — so each
  // pool records its own offset into the flat contract list)
  let r1Cursor = 0;
  const layout = probed.map(pool => {
    const algebra = ALGEBRA_STYLE_POOL.test(pool.dexId);
    const base = algebra
      ? [{ address: pool.address as `0x${string}`, abi: ALGEBRA_GLOBAL_STATE_ABI, functionName: 'globalState' as const }]
      : [
          { address: pool.address as `0x${string}`, abi: POOL_FEE_ABI, functionName: 'fee' as const },
          { address: pool.address as `0x${string}`, abi: V3_STATE_ABI, functionName: 'slot0' as const },
        ];
    const contracts = [
      ...base,
      { address: pool.address as `0x${string}`, abi: POOL_TOKENS_ABI, functionName: 'token0' as const },
      { address: pool.address as `0x${string}`, abi: POOL_TOKENS_ABI, functionName: 'token1' as const },
    ];
    const start = r1Cursor;
    r1Cursor += contracts.length;
    return { pool, algebra, start, contracts };
  });
  const r1 = await multicallBatch(client, layout.flatMap(({ contracts }) => contracts));
  if (r1.length > 0) {
    layout.forEach(({ pool, algebra, start }) => {
      const gs = r1[start];
      const feeRead = algebra ? null : r1[start];
      const slot0Read = algebra ? null : r1[start + 1];
      const t1Read = r1[start + (algebra ? 1 : 2)];
      if (t1Read?.status === 'success') {
        token1ByAddress.set(pool.address, (t1Read.result as string).toLowerCase() as `0x${string}`);
      }
      if (algebra) {
        if (gs?.status === 'success') {
          const fee = Number((gs.result as readonly unknown[])[2]);
          if (validFeeMilli(fee)) {
            feeByAddress.set(pool.address, fee / 1_000_000);
            classByAddress.set(pool.address, 'algebra');
          }
        }
        return;
      }
      const slot0Ok = slot0Read?.status === 'success';
      if (slot0Ok) sqrtByAddress.set(pool.address, (slot0Read.result as readonly unknown[])[0] as bigint);
      if (!feeRead || feeRead.status !== 'success') return;
      const fee = Number(feeRead.result);
      // V3-style fees use millionths. Reject zero and the V4 dynamic-fee flag
      // rather than turning either into a fabricated APR.
      if (validFeeMilli(fee)) {
        feeByAddress.set(pool.address, fee / 1_000_000);
        if (slot0Ok) classByAddress.set(pool.address, 'v3');
      }
    });
  }

  // ── Solidly / Infusion fee resolution (factory-mediated, name-gated) ──
  const stillFeeless = probed.filter(pool => !feeByAddress.has(pool.address) && pool.feePct == null);
  const solidlyPools = stillFeeless.filter(pool => SOLIDLY_CLASSIC_POOL.test(pool.dexId));
  if (solidlyPools.length > 0) {
    const metadata = await multicallBatch(client, solidlyPools.flatMap(pool => [
      { address: pool.address as `0x${string}`, abi: SOLIDLY_POOL_ABI, functionName: 'stable' as const },
      { address: pool.address as `0x${string}`, abi: SOLIDLY_POOL_ABI, functionName: 'factory' as const },
    ]));
    const resolved = solidlyPools.flatMap((pool, index) => {
      const stableRead = metadata[index * 2];
      const factoryRead = metadata[index * 2 + 1];
      if (stableRead?.status !== 'success' || factoryRead?.status !== 'success') return [];
      return [{ pool, stable: stableRead.result as boolean, factory: factoryRead.result as `0x${string}` }];
    });
    const fees = resolved.length > 0
      ? await multicallBatch(client, resolved.map(({ pool, stable, factory }) => ({
          address: factory,
          abi: SOLIDLY_FACTORY_FEE_ABI,
          functionName: 'getFee' as const,
          args: [pool.address as `0x${string}`, stable] as const,
        })))
      : [];
    resolved.forEach(({ pool }, index) => {
      const read = fees[index];
      const fee = read?.status === 'success' ? Number(read.result) : NaN;
      if (Number.isInteger(fee) && fee > 0 && fee < 10_000) {
        feeByAddress.set(pool.address, fee / 10_000);
      }
    });
  }
  const infusionPools = stillFeeless.filter(pool => INFUSION_POOL.test(pool.dexId));
  if (infusionPools.length > 0) {
    const stableReads = await multicallBatch(client, infusionPools.map(pool => ({
      address: pool.address as `0x${string}`,
      abi: SOLIDLY_POOL_ABI,
      functionName: 'stable' as const,
    })));
    const resolved = infusionPools.flatMap((pool, index) => {
      const read = stableReads[index];
      return read?.status === 'success' ? [{ pool, stable: read.result as boolean }] : [];
    });
    const fees = resolved.length > 0
      ? await multicallBatch(client, resolved.map(({ stable }) => ({
          address: INFUSION_BASE_FACTORY,
          abi: INFUSION_FACTORY_FEE_ABI,
          functionName: 'getFee' as const,
          args: [stable] as const,
        })))
      : [];
    resolved.forEach(({ pool }, index) => {
      const read = fees[index];
      const fee = read?.status === 'success' ? Number(read.result) : NaN;
      if (Number.isInteger(fee) && fee > 0 && fee < 10_000) {
        feeByAddress.set(pool.address, fee / 10_000);
      }
    });
  }

  // ── Round 2: liquidity + token1 decimals for V3-class pools (range inputs) ──
  const r2Targets = llamaNetwork != null
    ? probed.filter(pool =>
        (classByAddress.get(pool.address) ?? pool.ammClass) === 'v3'
        && token1ByAddress.has(pool.address))
    : [];
  const liqByAddress = new Map<string, bigint>();
  const decByAddress = new Map<string, number>();
  let prices: Record<string, number> = {};
  if (r2Targets.length > 0) {
    const token1Of = new Map(r2Targets.map(p => [p.address, token1ByAddress.get(p.address)!]));
    const [state, priceResult] = await Promise.all([
      multicallBatch(client, r2Targets.flatMap(pool => [
        { address: pool.address as `0x${string}`, abi: V3_STATE_ABI, functionName: 'liquidity' as const },
        { address: token1Of.get(pool.address)!, abi: erc20Abi, functionName: 'decimals' as const },
      ])),
      getTokenPricesUsd([...new Set(token1Of.values())], llamaNetwork).catch(() => ({} as Record<string, number>)),
    ]);
    prices = priceResult;
    r2Targets.forEach((pool, index) => {
      const l = state[index * 2], d = state[index * 2 + 1];
      if (l?.status === 'success') liqByAddress.set(pool.address, l.result as bigint);
      if (d?.status === 'success') decByAddress.set(pool.address, Number(d.result as number));
    });
  }

  // ── Merge: fee APR, class, ±5% range APR, caches ──
  return served.map(pool => {
    const feePct = feeByAddress.get(pool.address) ?? pool.feePct;
    const ammClass = classByAddress.get(pool.address) ?? pool.ammClass;
    const wasProbed = probed.some(p => p.address === pool.address);

    // Cache every probed pool — including negatives (fee unresolved, class
    // unknown), so the next compare doesn't re-ask for the same "unknown".
    if (wasProbed) {
      probeCache.set(`${client.chain?.id ?? 0}:${pool.address}`, { at: now, feePct, ammClass });
    }

    const aprPct = feePct != null && pool.tvlUsd > 0
      ? (pool.volume24hUsd * feePct * 365 / pool.tvlUsd) * 100
      : null;

    // ±5% range upgrade — same band math as addRangeAprs for indexer pools.
    let rangeApr: number | null = null;
    const wentThroughRound2 = llamaNetwork != null
      && token1ByAddress.has(pool.address)
      && classByAddress.get(pool.address) === 'v3';
    if (llamaNetwork != null && ammClass === 'v3') {
      const token1 = token1ByAddress.get(pool.address);
      const sqrtPriceX96 = sqrtByAddress.get(pool.address);
      const liquidity = liqByAddress.get(pool.address);
      const decimals1 = token1 != null ? decByAddress.get(token1) : undefined;
      const price1 = token1 != null ? prices[token1] : undefined;
      const priced = sqrtPriceX96 != null && liquidity != null && decimals1 != null && price1;
      if (priced && liquidity > 0n && sqrtPriceX96 > 0n && feePct != null && feePct > 0 && pool.volume24hUsd > 0) {
        const sqrtP = Number(sqrtPriceX96) / 2 ** 96;
        const bandUsd = (Number(liquidity) * sqrtP * BAND_FACTOR * price1!) / 10 ** decimals1!;
        const fees24h = pool.volume24hUsd * feePct;
        if (bandUsd > 0 && fees24h > 0) {
          rangeApr = Math.min((fees24h * 365 * 100) / bandUsd, 99_999);
          rangeCache.set(`${client.chain?.id ?? 0}:${pool.address}`, { at: now, apr: rangeApr });
        }
      } else if (wentThroughRound2 && !rangeApr) {
        // Round 2 ran but the pool couldn't be priced (no USD quote, zero
        // liquidity…) — negative-cache so the next compare doesn't re-read.
        rangeCache.set(`${client.chain?.id ?? 0}:${pool.address}`, { at: now, apr: null });
      }
    }

    const merged: MarketPool = {
      ...pool,
      ...(feePct != null && feePct !== pool.feePct
        ? { feePct, aprPct: aprPct != null && isFinite(aprPct) ? aprPct : null }
        : feePct != null ? { feePct } : {}),
      ammClass,
    };
    if (rangeApr != null) {
      merged.aprPct = rangeApr;
      merged.aprIsRange = true;
    }
    return merged;
  });
}

/**
 * Backwards-compatible wrapper — fee + class only, no range upgrade.
 */
export async function enrichMarketPoolApr(
  client: PublicClient,
  pools: MarketPool[],
): Promise<MarketPool[]> {
  return probePoolsOnChain(client, pools);
}

/**
 * Backwards-compatible wrapper — range upgrade for already-classified pools.
 */
export async function addMarketRangeAprs(
  client: PublicClient,
  pools: MarketPool[],
  llamaNetwork: string,
): Promise<MarketPool[]> {
  return probePoolsOnChain(client, pools, llamaNetwork);
}

/**
 * One enrichment pipeline for single-chain search and cross-chain research.
 * The hourly catalog supplies gauge/reward APRs, while the chain supplies
 * missing pool fee tiers and the AMM class (by probing the pool contract) in
 * two speculative rounds. Reapplying the catalog last ensures an actionable
 * gauge route is not overwritten by the generic whole-pool fee estimate.
 *
 * When `chainId` is given, enrichment runs through the shared server route
 * (/api/pools/enrich) so results are cached across users in Convex — the
 * browser never re-probes what someone else already asked. If the route
 * fails, the same probing runs client-side through the wallet's transport.
 */
export async function enrichMarketPools(
  client: PublicClient | undefined,
  pools: MarketPool[],
  earnPools: EarnPool[],
  chainName: string,
  tokenAAddress: string,
  tokenBAddress?: string,
  llamaNetwork?: string,
  chainId?: number,
): Promise<MarketPool[]> {
  const catalogEnriched = applyGaugeAprCatalog(
    pools,
    earnPools,
    chainName,
    tokenAAddress,
    tokenBAddress,
  );
  let probed = catalogEnriched;
  if (chainId != null) {
    try {
      const res = await fetch('/api/pools/enrich', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chainId,
          llamaNetwork,
          pools: catalogEnriched.map(({ address, dexId, tvlUsd, volume24hUsd, feePct, ammClass, aprIsRange, aprPct }) =>
            ({ address, dexId, tvlUsd, volume24hUsd, feePct, ammClass, aprIsRange, aprPct })),
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json() as { pools?: MarketPool[] };
        if (Array.isArray(data.pools) && data.pools.length > 0) {
          probed = data.pools.map(p => ({
            ...p,
            dexLabel: catalogEnriched.find(c => c.address === p.address)?.dexLabel ?? prettyDexLabel(p.dexId),
          }));
        }
      }
    } catch {
      // Route unavailable (cold function, network) — probe client-side below.
    }
  }
  if (probed === catalogEnriched && client) {
    probed = await probePoolsOnChain(client, catalogEnriched, llamaNetwork).catch(() => catalogEnriched);
  }
  return applyGaugeAprCatalog(
    probed,
    earnPools,
    chainName,
    tokenAAddress,
    tokenBAddress,
  );
}
