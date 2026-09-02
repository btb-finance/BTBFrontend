/**
 * Shared multichain pool catalog used by Discover, Simulate enrichment, and LP
 * suggestions. Official indexers provide the actionable Uniswap/PancakeSwap
 * rows; one DeFiLlama snapshot supplies the wider DEX market (Aerodrome,
 * Curve, Balancer, SushiSwap, chain-native venues, and others) without a
 * request per DEX.
 */
import { decodeFunctionResult, encodeFunctionData, type Abi, type PublicClient } from 'viem';
import { getTopPools as getLlamaPools, getTokenPricesUsd, fmtCompactUsd, type LlamaPool } from './defillama';
import { getV3TopPools } from '@/protocols/dexs/uniswap/v3/subgraph';
import { getV4TopPools } from '@/protocols/dexs/uniswap/v4/subgraph';
import { getPancakeTopPools } from '@/protocols/dexs/pancakeswap';
import { hasGraphKey, fmtFeeTier, DYNAMIC_FEE_FLAG, IndexedPool } from '@/protocols/dexs/uniswap/graph';
import { POOL_ABI } from '@/protocols/dexs/uniswap/v3/abis';
import { STATE_VIEW_ABI, POSITION_MANAGER_ABI } from '@/protocols/dexs/uniswap/v4/abis';
import { UNISWAP_V4, NATIVE_CURRENCY } from '@/protocols/dexs/uniswap/v4/addresses';
import { WETH } from '@/protocols/dexs/uniswap/v3/addresses';
import { fetchNetworkTopPools, fetchNetworkDexes, type DexPaprikaPoolRow, type DexPaprikaDex } from './dexpaprika';
import { fetchDexScreenerPool } from './dexscreener';
import { withSafeMulticall } from './safeMulticall';

export { fmtCompactUsd, fmtFeeTier };

export interface EarnPool {
  id: string;
  /** 'uniswap-v3' | 'uniswap-v4' | 'pancakeswap-v3' | DeFiLlama project slug. */
  project: string;
  dex: string;            // friendly name for the filter chips, e.g. "Uniswap"
  version?: 'V2' | 'V3' | 'V4';  // set for indexer-sourced Uniswap pools
  chain: string;
  chainId?: number;
  pair: string;           // e.g. "WETH-USDC"
  feeTier?: number;       // hundredths of a bip — indexer pools only
  /** V4 only — zero address (or unset) means no hook. */
  hooks?: string;
  tvlUsd: number;
  apy: number;            // actionable headline APY/APR % for one LP strategy
  apyBase: number;        // fee APY/APR %
  apyReward: number;      // incentive APY % (DeFiLlama only)
  /** Gauge reward token addresses, e.g. AERO/RAM/PHAR. */
  rewardTokens?: string[];
  /** Human symbols for known gauge reward tokens. */
  rewardTokenSymbols?: string[];
  /** Whether the headline reward requires depositing the LP position in a gauge. */
  requiresStaking?: boolean;
  /** ve(3,3) pools may offer gauge emissions instead of, rather than on top of, LP fees. */
  yieldMode?: 'combined' | 'stake-or-fees' | 'staked-rewards';
  liquidityModel?: 'AMM' | 'CLMM' | 'DLMM';
  poolMeta?: string;
  /** Provider supplied logo URLs, resolved once server side so the client
   *  never has to keep a name-to-asset map in sync. Both may be absent; the
   *  UI falls back to a bundled asset and then to a letter mark. */
  dexLogo?: string;
  chainLogo?: string;
  volume24hUsd?: number;  // last complete day — indexer pools only
  fees24hUsd?: number;
  stablecoin: boolean;
  ilRisk: string;         // "yes" | "no"
  underlyingTokens?: string[];
  /** Address-keyed USD quotes from the pool's native chain data source. */
  tokenPricesUsd?: Record<string, number>;
  token1Decimals?: number; // indexer pools only — needed for the range APR
  externalUrl?: string;
  /** Estimated fee APR % for a ±RANGE_APR_PCT% concentrated position (see addRangeAprs). */
  aprRange?: number;
  /** APY change over the last 24h, in percentage points — DeFiLlama-sourced pools only. */
  apyChange1d?: number;
  source: 'uniswap' | 'defillama' | 'dexscreener';
}

interface BlockscoutTokensPage {
  items?: Array<{ address_hash?: string; reputation?: string }>;
  next_page_params?: Record<string, string | number | boolean | null>;
}

async function getRobinhoodTokenAddresses(): Promise<string[]> {
  const addresses = new Set<string>();
  let url = 'https://robinhoodchain.blockscout.com/api/v2/tokens?type=ERC-20';
  // Five explorer pages = up to 250 contracts. This stays bounded while
  // covering the active official, stock-token and meme-token universe.
  for (let page = 0; page < 5; page++) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) break;
    const body = await res.json() as BlockscoutTokensPage;
    for (const token of body.items ?? []) {
      if (/^0x[0-9a-fA-F]{40}$/.test(token.address_hash ?? '') && token.reputation?.toLowerCase() !== 'spam') {
        addresses.add(token.address_hash!);
      }
    }
    if (!body.next_page_params) break;
    const params = new URLSearchParams({ type: 'ERC-20' });
    for (const [key, value] of Object.entries(body.next_page_params)) {
      if (value != null) params.set(key, String(value));
    }
    url = `https://robinhoodchain.blockscout.com/api/v2/tokens?${params}`;
  }
  return [...addresses];
}

async function getRobinhoodFees(rows: DexScreenerPairRow[]): Promise<Map<string, number>> {
  const unique = new Map<string, DexScreenerPairRow>();
  for (const row of rows) {
    if (row.pairAddress) unique.set(row.pairAddress.toLowerCase(), row);
  }
  const pools = [...unique.values()].filter(row => {
    const id = row.pairAddress ?? '';
    const labelledV4 = row.labels?.some(label => label.toLowerCase() === 'v4');
    return /^0x[0-9a-fA-F]{64}$/.test(id) || (/^0x[0-9a-fA-F]{40}$/.test(id) && !labelledV4);
  });
  if (pools.length === 0) return new Map();
  const out = new Map<string, number>();
  for (let offset = 0; offset < pools.length; offset += 40) {
    const chunk = pools.slice(offset, offset + 40);
    const body = chunk.map((row, id) => {
      const isV4 = /^0x[0-9a-fA-F]{64}$/.test(row.pairAddress ?? '');
      return {
        jsonrpc: '2.0', id, method: 'eth_call',
        params: [isV4
          ? {
              to: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
              data: encodeFunctionData({ abi: STATE_VIEW_ABI, functionName: 'getSlot0', args: [row.pairAddress as `0x${string}`] }),
            }
          : { to: row.pairAddress, data: '0xddca3f43' }, 'latest'],
      };
    });
    try {
      const res = await fetch('https://rpc.mainnet.chain.robinhood.com/', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
      });
      if (!res.ok) continue;
      const replies = await res.json() as Array<{ id: number; result?: string }>;
      for (const reply of replies) {
        const pool = chunk[reply.id];
        if (!pool?.pairAddress || !reply.result) continue;
        try {
          const isV4 = /^0x[0-9a-fA-F]{64}$/.test(pool.pairAddress);
          const fee = isV4
            ? Number(decodeFunctionResult({ abi: STATE_VIEW_ABI, functionName: 'getSlot0', data: reply.result as `0x${string}` })[3])
            : Number(BigInt(reply.result));
          if (fee > 0 && fee < 1_000_000) out.set(pool.pairAddress.toLowerCase(), fee);
        } catch { /* one malformed pool must not discard every valid fee */ }
      }
    } catch { /* continue with remaining chunks */ }
  }
  return out;
}

interface DexScreenerPairRow {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  labels?: string[];
  baseToken?: { address?: string; symbol?: string };
  quoteToken?: { address?: string; symbol?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  priceUsd?: string;
  priceNative?: string;
}

async function getRobinhoodPools(minTvlUsd: number): Promise<EarnPool[]> {
  const addresses = await getRobinhoodTokenAddresses();
  if (addresses.length === 0) throw new Error('Robinhood token registry unavailable');
  const batches: string[][] = [];
  for (let i = 0; i < addresses.length; i += 30) batches.push(addresses.slice(i, i + 30));
  const settled = await Promise.allSettled(batches.map(async batch => {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/robinhood/${batch.join(',')}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Robinhood pools ${res.status}`);
    return res.json() as Promise<DexScreenerPairRow[]>;
  }));
  const rows = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const poolFees = await getRobinhoodFees(rows).catch(() => new Map<string, number>());
  const seen = new Set<string>();
  // Robinhood is a brand-new chain whose canonical stock pools are still
  // bootstrapping. A $1k floor shows real official markets without opening the
  // table to zero-liquidity pair spam; callers asking for a lower floor keep it.
  const tvlFloor = Math.min(minTvlUsd, 1_000);
  return rows.flatMap((row): EarnPool[] => {
    const id = row.pairAddress;
    const token0 = row.baseToken;
    const token1 = row.quoteToken;
    const tvlUsd = row.liquidity?.usd ?? 0;
    const key = id?.toLowerCase();
    if (row.chainId !== 'robinhood' || !id || !key || seen.has(key) || !token0?.address || !token1?.address || !token0.symbol || !token1.symbol || tvlUsd < tvlFloor) return [];
    seen.add(key);
    const labels = row.labels?.map(label => label.toLowerCase()) ?? [];
    const version: 'V2' | 'V3' | 'V4' = labels.includes('v4') ? 'V4' : labels.includes('v2') ? 'V2' : 'V3';
    const feeTier = poolFees.get(id.toLowerCase());
    const volume24hUsd = row.volume?.h24;
    const fees24hUsd = feeTier != null && volume24hUsd != null ? volume24hUsd * feeTier / 1_000_000 : undefined;
    const feeApr = fees24hUsd != null && tvlUsd > 0 ? fees24hUsd * 365 / tvlUsd * 100 : 0;
    const stable = STABLES.has(token0.symbol.toUpperCase()) && STABLES.has(token1.symbol.toUpperCase());
    const baseUsd = Number(row.priceUsd);
    const baseInQuote = Number(row.priceNative);
    const quoteUsd = baseUsd > 0 && baseInQuote > 0 ? baseUsd / baseInQuote : 0;
    const tokenPricesUsd = {
      ...(baseUsd > 0 ? { [token0.address.toLowerCase()]: baseUsd } : {}),
      ...(quoteUsd > 0 ? { [token1.address.toLowerCase()]: quoteUsd } : {}),
    };
    return [{
      id, project: `uniswap-${version.toLowerCase()}`, dex: row.dexId === 'uniswap' ? 'Uniswap' : row.dexId || 'DEX', version,
      chain: 'Robinhood Chain', chainId: 4663, pair: `${token0.symbol}-${token1.symbol}`,
      feeTier, tvlUsd, apy: feeApr, apyBase: feeApr, apyReward: 0,
      volume24hUsd, fees24hUsd, apyChange1d: row.priceChange?.h24,
      stablecoin: stable, ilRisk: stable ? 'no' : 'yes',
      underlyingTokens: [token0.address, token1.address], externalUrl: row.url,
      tokenPricesUsd,
      source: 'dexscreener',
    }];
  });
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
  const isHyperEvm = p.chain === 'Hyperliquid L1';
  const isStakeOrFees = p.project === 'aerodrome-v1'
    || p.project === 'aerodrome-slipstream'
    || p.project === 'velodrome-v2'
    || p.project === 'velodrome-v3';
  const isGaugeRewardOnly = p.project === 'ramses-cl-v2'
    || p.project === 'pharaoh-v3'
    || p.project === 'blackhole-clmm';
  const yieldMode: EarnPool['yieldMode'] = isStakeOrFees
    ? 'stake-or-fees'
    : isGaugeRewardOnly ? 'staked-rewards' : 'combined';
  // These ve(3,3) routes do not simply add every number together. Aerodrome
  // and Velodrome LPs choose unstaked fee yield or staked emissions; Ramses,
  // Pharaoh, and Blackhole gauged rows report the staked emission route. Keep
  // the components, but rank one achievable strategy rather than their sum.
  // When real volume and a real fee tier are both known, the fee APR is
  // arithmetic we can check, so use it instead of the provider's apyBase.
  // DeFiLlama reports 0.00% for pools doing tens of millions a day.
  const computedFeeApr = fees24hUsd != null && p.tvlUsd > 0
    ? (fees24hUsd * 365 / p.tvlUsd) * 100
    : null;
  const apyBase = computedFeeApr ?? p.apyBase;
  const actionableApy = isStakeOrFees
    ? Math.max(apyBase, p.apyReward)
    : isGaugeRewardOnly ? p.apyReward : (computedFeeApr != null ? computedFeeApr + p.apyReward : p.apy);
  const rewardTokenSymbols = p.rewardTokens?.map(address => {
    const normalized = address.toLowerCase();
    if (normalized === '0x940181a94a35a4569e4529a3cdfb74e38fd98631') return 'AERO';
    if (normalized === '0x9560e827af36c94d2ac33a39bce1fe78631088db') return 'VELO';
    if (normalized === '0x555570a286f15ebdfe42b66ede2f724aa1ab5555') return 'RAM';
    if (normalized === '0x13a466998ce03db73abc2d4df3bbd845ed1f28e7') return 'PHAR';
    if (normalized === '0xcd94a87696fac69edae3a70fe5725307ae1c43f6') return 'BLACK';
    if (p.project.startsWith('velodrome-')) return 'VELO';
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  });
  const isConcentrated = p.project === 'aerodrome-slipstream'
    || p.project === 'velodrome-v3'
    || p.project === 'ramses-cl-v2'
    || p.project === 'pharaoh-v3'
    || p.project === 'blackhole-clmm';
  return {
    id: p.id,
    project: p.project,
    dex: overrides.dex ?? p.dex,
    version: overrides.version,
    chain: isHyperEvm ? 'HyperEVM' : normalizeChainName(p.chain),
    chainId: isHyperEvm ? 999 : undefined,
    pair: p.pair,
    feeTier,
    tvlUsd: p.tvlUsd,
    apy: actionableApy,
    apyBase,
    apyReward: p.apyReward,
    rewardTokens: p.rewardTokens,
    rewardTokenSymbols,
    requiresStaking: p.apyReward > 0 && (isStakeOrFees ? p.apyReward >= p.apyBase : isGaugeRewardOnly),
    yieldMode,
    liquidityModel: isConcentrated ? 'CLMM' : 'AMM',
    poolMeta: p.poolMeta,
    // DeFiLlama's change is for its summed APY. Once a ve(3,3) pool is split
    // into mutually exclusive fee/staking routes, that delta is no longer
    // comparable to our actionable headline and should not be presented.
    apyChange1d: yieldMode === 'combined' ? p.apyPct1D : undefined,
    volume24hUsd: p.volume24hUsd,
    fees24hUsd,
    stablecoin: p.stablecoin,
    ilRisk: p.ilRisk,
    underlyingTokens: p.underlyingTokens,
    source: 'defillama',
  };
}

/**
 * Chains given the volume ranked discovery pass, with their DexPaprika network
 * slug. Kept to where the volume actually is: each chain costs one listing call
 * plus two multicall rounds per cron tick, and the API rate limits at roughly
 * eight rapid requests.
 */
/**
 * Providers spell the same chain differently ("BSC" vs "BNB Chain", "OP
 * Mainnet" vs "Optimism"), which showed up as two filter chips for one chain.
 * Normalising on the way in keeps one chip per chain.
 */
const CHAIN_ALIASES: Record<string, string> = {
  bsc: 'BNB Chain', 'binance smart chain': 'BNB Chain', 'bnb smart chain': 'BNB Chain',
  'op mainnet': 'Optimism', 'arbitrum one': 'Arbitrum', 'avalanche c-chain': 'Avalanche',
  'ethereum mainnet': 'Ethereum', 'hyperliquid l1': 'HyperEVM',
};

export function normalizeChainName(name: string): string {
  return CHAIN_ALIASES[name.trim().toLowerCase()] ?? name;
}

/**
 * Identity of a pool independent of which provider described it: same chain,
 * same two tokens, same venue, same fee tier is the same pool.
 */
function poolShapeKey(p: EarnPool): string {
  const pair = p.pair.split('-').map(s => s.trim().toUpperCase()).sort().join('-');
  return [normalizeChainName(p.chain).toLowerCase(), pair, p.dex.toLowerCase(), p.feeTier ?? '?'].join('|');
}

/**
 * DEX and chain logos, taken from DeFiLlama's icon CDN rather than a folder of
 * webp files we have to remember to update. Their protocol names are versioned
 * ("Uniswap V3", "PancakeSwap AMM"), so a brand matches on prefix and the
 * shortest candidate wins, which is the plain brand entry when one exists.
 *
 * Resolved once per refresh, server side, and written into the snapshot: the
 * browser then just renders a URL.
 */
const CHAIN_ICON = (chain: string) =>
  `https://icons.llamao.fi/icons/chains/rsz_${chain.toLowerCase().replace(/[^a-z0-9]/g, '')}?w=48&h=48`;

async function fetchDexLogos(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const res = await fetch('https://api.llama.fi/protocols');
    if (!res.ok) return out;
    const list = await res.json() as { name?: string; logo?: string; category?: string }[];
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dexes = list.filter(p => p.name && p.logo && /dex/i.test(p.category ?? ''));
    // Shortest name per normalized prefix, so "Uniswap" resolves through
    // "Uniswap V2" rather than "Uniswap X" or a longer unrelated entry.
    for (const p of dexes.sort((a, b) => (a.name as string).length - (b.name as string).length)) {
      const key = norm(p.name as string);
      if (!out.has(key)) out.set(key, p.logo as string);
    }
  } catch { /* logos are decoration; never fail a refresh over them */ }
  return out;
}

function applyLogos(pools: EarnPool[], dexLogos: Map<string, string>): void {
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cache = new Map<string, string | undefined>();
  for (const pool of pools) {
    const brand = norm(pool.dex);
    if (!cache.has(brand)) {
      let hit = dexLogos.get(brand);
      if (!hit) for (const [name, logo] of dexLogos) { if (name.startsWith(brand)) { hit = logo; break; } }
      cache.set(brand, hit);
    }
    pool.dexLogo = cache.get(brand);
    pool.chainLogo = CHAIN_ICON(pool.chain);
  }
}

export const DISCOVERY_CHAINS: { chainId?: number; network: string; chain: string }[] = [
  { chainId: 1,    network: 'ethereum',  chain: 'Ethereum' },
  { chainId: 8453, network: 'base',      chain: 'Base' },
  { chainId: 56,   network: 'bsc',       chain: 'BNB Chain' },
  { chainId: 4663, network: 'robinhood', chain: 'Robinhood Chain' },
];

/** Algebra style CLAMMs expose their live fee through globalState(), not fee(). */
const ALGEBRA_GLOBAL_STATE_ABI = [{
  name: 'globalState', type: 'function', stateMutability: 'view', inputs: [],
  outputs: [
    { name: 'price', type: 'uint160' }, { name: 'tick', type: 'int24' },
    { name: 'fee', type: 'uint16' }, { name: 'timepointIndex', type: 'uint16' },
    { name: 'communityFeeToken0', type: 'uint16' }, { name: 'communityFeeToken1', type: 'uint16' },
    { name: 'unlocked', type: 'bool' },
  ],
}] as const;

const ERC20_SYMBOL_ABI = [{
  name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }],
}] as const;

/**
 * A pool is "live" when people are actually trading it. DeFiLlama ranks by
 * TVL, which is why Discover filled up with pools holding nine figures and
 * doing no trades at all. Requiring real turnover is what keeps them out.
 */
const MIN_TXNS_24H = 10;
const MIN_TURNOVER = 0.005;   // 24h volume worth at least 0.5% of TVL

/** Uniswap V2 forks charge a fixed 0.30%, so their fee needs no chain read. */
const FIXED_FEE_DEX = /(?:^|[_-])v2$|sushiswap|solidly/i;

/**
 * Venues whose `fee()` / `globalState()` really is in hundredths of a bip, the
 * Uniswap V3 convention.
 *
 * This allowlist is not optional. Curve's fee() is scaled by 1e10, so reading
 * it as Uniswap units turns a 0.03% pool into a 30% one and published a
 * 172,914% APR. Balancer, Maverick, Fluid and Ekubo each differ again. A pool
 * on a venue we cannot read confidently is dropped, never approximated.
 */
const UNISWAP_FEE_CONVENTION = /uniswap|pancakeswap|slipstream|velodrome|aerodrome|sushiswap_v3|quickswap|thena|ramses|pharaoh|blackhole|algebra|camelot/i;

/** Above this, a "fee tier" is a misread rather than a real pool. */
const MAX_PLAUSIBLE_FEE = 100_000;   // 10%

/**
 * Brand label for a venue, derived entirely from provider data.
 *
 * The provider groups products under `protocol` ("aerodrome_slipstream_3" and
 * "aerodrome" both report "aerodrome"), so the chips group on that. The label
 * shown is the shortest of that protocol's own names once a trailing version
 * token is dropped, which keeps the provider's own spelling ("PancakeSwap",
 * "LFJ") without us maintaining a name map that would fall behind every time a
 * venue ships a new version.
 */
const stripVersion = (name: string) => name.replace(/\s+v?\d+(\.\d+)?$/i, '').trim();
/** "uniswapv3" -> "uniswap", "aerodromev3" -> "aerodrome". The provider keeps
 *  versions apart in `protocol`; the brand is what the chips group on. */
const brandKey = (protocol: string) => protocol.replace(/v\d+(\.\d+)?$/i, '');

function brandLabels(dexes: DexPaprikaDex[]): Map<string, { label: string; protocol: string }> {
  const byBrand = new Map<string, string>();
  for (const d of dexes) {
    const key = brandKey(d.protocol);
    const candidate = stripVersion(d.dexName) || d.dexName;
    const current = byBrand.get(key);
    if (!current || candidate.length < current.length) byBrand.set(key, candidate);
  }
  const out = new Map<string, { label: string; protocol: string }>();
  for (const d of dexes) {
    const key = brandKey(d.protocol);
    out.set(d.dexId, { label: byBrand.get(key) ?? stripVersion(d.dexName), protocol: key });
  }
  return out;
}

/**
 * Slipstream/CLMM style venues are concentrated liquidity without carrying a
 * "v3" in their id, so matching on the digit alone mislabels them. This one
 * stays ours because `version` drives what the app can mint into, not display.
 */
function dexVersion(dexId: string): EarnPool['version'] | undefined {
  const explicit = dexId.match(/_v(\d)/i);
  if (explicit) {
    const n = explicit[1];
    return n === '4' ? 'V4' : n === '3' ? 'V3' : n === '2' ? 'V2' : undefined;
  }
  return /slipstream|clmm|_cl$/i.test(dexId) ? 'V3' : undefined;
}

function isPoolAddress(id: string): boolean {
  return /^0x[0-9a-f]{40}$/i.test(id);
}

/**
 * Volume ranked pool discovery for one chain, with every APR computed from
 * numbers we can defend: real 24h volume from the listing, the fee tier read
 * straight from the pool contract, and TVL from the listing.
 *
 *     fee APR = volume24h x feeRate x 365 / TVL
 *
 * Nothing here trusts a provider's own APY field. A pool whose fee cannot be
 * read is dropped rather than guessed at, because multiplying volume by an
 * invented fee is how you end up publishing an APR nobody can earn.
 */
export async function ingestChainPools(
  client: PublicClient | null,
  chainId: number | undefined,
  network: string,
  chainName: string,
  minTvlUsd: number,
  limit = 100,
): Promise<EarnPool[]> {
  const [rows, dexes] = await Promise.all([
    fetchNetworkTopPools(network, limit).catch(() => [] as DexPaprikaPoolRow[]),
    fetchNetworkDexes(network).catch(() => [] as DexPaprikaDex[]),
  ]);
  const brands = brandLabels(dexes);
  const live = rows.filter(r =>
    r.tvlUsd >= minTvlUsd
    && r.transactions24h >= MIN_TXNS_24H
    && r.volume24hUsd / Math.max(r.tvlUsd, 1) >= MIN_TURNOVER);
  if (live.length === 0) return [];

  // Round 1: fee tier. V2 style forks are a known constant; everything else is
  // asked directly, trying the standard fee() and the Algebra variant at once.
  const probes = client === null ? [] : live.filter(r =>
    isPoolAddress(r.id) && !FIXED_FEE_DEX.test(r.dexId) && UNISWAP_FEE_CONVENTION.test(r.dexId)
    // A fee the provider already told us needs no round trip to the chain.
    && r.feePct == null);
  const feeReads = probes.length === 0 || client === null ? [] : await withSafeMulticall(client).multicall({
    contracts: probes.flatMap(r => [
      { address: r.id as `0x${string}`, abi: POOL_ABI as Abi, functionName: 'fee' },
      { address: r.id as `0x${string}`, abi: ALGEBRA_GLOBAL_STATE_ABI as Abi, functionName: 'globalState' },
    ]),
    allowFailure: true,
  }).catch(() => []);

  const feeByPool = new Map<string, number>();
  probes.forEach((r, i) => {
    const plain = feeReads[i * 2];
    const algebra = feeReads[i * 2 + 1];
    let fee: number | null = null;
    if (plain?.status === 'success') fee = Number(plain.result as bigint);
    else if (algebra?.status === 'success') fee = Number((algebra.result as readonly unknown[])[2]);
    // Dynamic fee V4 pools report a flag bit rather than a rate; multiplying
    // volume by it fabricates absurd APRs, so they stay unpriced.
    if (fee != null && fee > 0 && fee <= MAX_PLAUSIBLE_FEE && (fee & DYNAMIC_FEE_FLAG) === 0) {
      feeByPool.set(r.id.toLowerCase(), fee);
    }
  });
  for (const r of live) {
    const key = r.id.toLowerCase();
    if (feeByPool.has(key)) continue;
    // The provider quotes a percent; EarnPool.feeTier is hundredths of a bip.
    if (r.feePct != null) {
      const tier = Math.round(r.feePct * 10_000);
      if (tier > 0 && tier <= MAX_PLAUSIBLE_FEE) feeByPool.set(key, tier);
    } else if (FIXED_FEE_DEX.test(r.dexId)) {
      feeByPool.set(key, 3_000);
    }
  }

  const priced = live.filter(r => feeByPool.has(r.id.toLowerCase()));
  if (priced.length === 0) return [];

  // Round 2: symbols. The listing carries token addresses only.
  const addresses = [...new Set(priced.flatMap(r => r.tokenAddresses.slice(0, 2)).map(a => a.toLowerCase()))]
    .filter(isPoolAddress);
  const symbolReads = addresses.length === 0 || client === null ? [] : await withSafeMulticall(client).multicall({
    contracts: addresses.map(address => ({ address: address as `0x${string}`, abi: ERC20_SYMBOL_ABI as Abi, functionName: 'symbol' })),
    allowFailure: true,
  }).catch(() => []);
  const symbolOf = new Map<string, string>();
  addresses.forEach((address, i) => {
    const read = symbolReads[i];
    if (read?.status === 'success' && typeof read.result === 'string' && read.result.length > 0) {
      symbolOf.set(address, read.result);
    }
  });

  return priced.flatMap((r): EarnPool[] => {
    const fee = feeByPool.get(r.id.toLowerCase())!;
    const [a, b] = r.tokenAddresses;
    const s0 = symbolOf.get(a.toLowerCase());
    const s1 = symbolOf.get(b.toLowerCase());
    // A row whose tokens cannot be named is not showable, and guessing a name
    // from an address helps nobody.
    if (!s0 || !s1) return [];
    const fees24hUsd = r.volume24hUsd * (fee / 1_000_000);
    const apy = r.tvlUsd > 0 ? (fees24hUsd * 365 / r.tvlUsd) * 100 : 0;
    const stable = STABLES.has(s0.toUpperCase()) && STABLES.has(s1.toUpperCase());
    const version = dexVersion(r.dexId);
    return [{
      id: r.id,
      project: brands.get(r.dexId)?.protocol ?? r.dexId,
      dex: brands.get(r.dexId)?.label ?? stripVersion(r.dexName),
      version,
      chain: normalizeChainName(chainName),
      chainId,
      pair: `${s0}-${s1}`,
      feeTier: fee,
      tvlUsd: r.tvlUsd,
      apy, apyBase: apy, apyReward: 0,
      volume24hUsd: r.volume24hUsd,
      fees24hUsd,
      apyChange1d: r.priceChange24h,
      liquidityModel: version === 'V2' ? 'AMM' : 'CLMM',
      stablecoin: stable,
      ilRisk: stable ? 'no' : 'yes',
      underlyingTokens: [a, b],
      source: 'dexscreener',
    }];
  });
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
export async function getEarnPools(
  minTvlUsd = 50_000,
  client?: PublicClient | ((chainId?: number) => PublicClient | null),
): Promise<EarnPool[]> {
  // Callers that only have mainnet keep passing a single client; the cron
  // passes a factory so every discovery chain gets its own transport.
  const clientFor = typeof client === 'function'
    ? client
    : client
      ? (chainId?: number) => (chainId === 1 ? client : null)
      : null;
  const [v3, v4, cake, llama, robinhood] = await Promise.allSettled([
    hasGraphKey ? getV3TopPools() : Promise.reject(new Error('no key')),
    hasGraphKey ? getV4TopPools() : Promise.reject(new Error('no key')),
    hasGraphKey ? getPancakeTopPools() : Promise.reject(new Error('no key')),
    // DeFiLlama already returns all supported DEX projects in one response.
    // Keep the wider market here so every consumer sees the same catalog.
    getLlamaPools(300, minTvlUsd),
    getRobinhoodPools(minTvlUsd),
  ]);

  const pools: EarnPool[] = [];

  if (v3.status === 'fulfilled') pools.push(...v3.value.map((p) => fromIndexed(p)));
  if (v4.status === 'fulfilled') pools.push(...v4.value.map((p) => fromIndexed(p)));
  if (cake.status === 'fulfilled') pools.push(...cake.value.map((p) => fromIndexed(p, 'PancakeSwap')));
  if (robinhood.status === 'fulfilled') pools.push(...robinhood.value);

  if (llama.status === 'fulfilled') {
    for (const p of llama.value) {
      // Ethereum's official indexers win when available; all other DEX/chain
      // rows come directly from the same already-fetched market snapshot.
      if (p.chain === 'Ethereum' && p.project === 'uniswap-v3' && v3.status === 'fulfilled') continue;
      if (p.chain === 'Ethereum' && p.project === 'uniswap-v4' && v4.status === 'fulfilled') continue;
      if (p.chain === 'Ethereum' && p.project === 'pancakeswap-amm-v3' && cake.status === 'fulfilled') continue;
      // Drop pools nobody trades. DeFiLlama ranks by TVL and happily lists
      // pools holding nine figures that have not seen a swap in days; over
      // half its DEX rows turn over less than 1% of TVL per day. A row with
      // no volume figure at all is kept only when it pays gauge rewards,
      // which is yield that does not depend on trading.
      if (p.volume24hUsd != null) {
        if (p.volume24hUsd / Math.max(p.tvlUsd, 1) < MIN_TURNOVER) continue;
      } else if (p.apyReward <= 0) {
        continue;
      }
      const version = /(?:^|-)v4(?:$|\.)/i.test(p.project) ? 'V4'
        : /(?:^|-)v3(?:$|\.)/i.test(p.project) ? 'V3'
          : /(?:^|-)v2(?:$|\.)/i.test(p.project) ? 'V2'
            : undefined;
      pools.push(fromLlama(p, { version }));
    }
  }

  if (pools.length === 0 && !clientFor) {
    const err =
      (llama.status === 'rejected' && llama.reason instanceof Error && llama.reason.message) || 'no pool source available';
    throw new Error(err);
  }

  // Volume ranked discovery, one chain at a time, with every APR computed from
  // real volume and an on chain fee. These rows are authoritative: where they
  // overlap a DeFiLlama row for the same pool, the computed numbers win.
  if (clientFor) {
    for (const { chainId, network, chain } of DISCOVERY_CHAINS) {
      const chainClient = clientFor(chainId);
      if (chainId != null && !chainClient) continue;
      const discovered = await ingestChainPools(chainClient, chainId, network, chain, minTvlUsd)
        .catch(() => [] as EarnPool[]);
      if (discovered.length === 0) continue;
      // Matching on id alone is not enough: DeFiLlama keys pools by its own
      // uuid while the listing keys them by pool address, so the same pool
      // arrived twice and rendered as two rows with slightly different TVL.
      // Identity is really chain + token pair + venue + fee tier.
      const replaced = new Set(discovered.map(p => p.id.toLowerCase()));
      const shape = new Set(discovered.map(poolShapeKey));
      for (let i = pools.length - 1; i >= 0; i--) {
        const existing = pools[i];
        if (replaced.has(existing.id.toLowerCase()) || shape.has(poolShapeKey(existing))) pools.splice(i, 1);
      }
      pools.push(...discovered);
      // The listing endpoint rate limits at roughly eight rapid requests.
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  if (pools.length === 0) throw new Error('no pool source available');

  applyLogos(pools, await fetchDexLogos());

  // Rank by what people actually trade. Sorting by TVL is what put pools with
  // nine figures of idle liquidity and zero trades at the top of Discover.
  return pools.sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0) || b.tvlUsd - a.tvlUsd);
}

/** External link for a pool — Uniswap explore page for indexer pools, DeFiLlama otherwise. */
export function poolLink(p: EarnPool): string {
  if (p.externalUrl) return p.externalUrl;
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
export function mintTarget(p: EarnPool, forSimulate = false): { tokenA?: `0x${string}`; tokenB?: `0x${string}`; v4PoolId?: `0x${string}`; dex?: 'uniswap' | 'pancakeswap'; chainId: 1 | 4663 } | null {
  const chainId = p.chain.toLowerCase() === 'ethereum' ? 1 : p.chain.toLowerCase() === 'robinhood chain' ? 4663 : null;
  if (!chainId) return null;
  if (p.dex.toLowerCase() !== 'uniswap' && p.project.startsWith('uniswap-')) return null;
  const tokens = (p.underlyingTokens ?? []) as `0x${string}`[];
  if (p.project === 'uniswap-v3' && tokens.length >= 2) return { tokenA: tokens[0], tokenB: tokens[1], dex: 'uniswap', chainId };
  if (chainId === 1 && p.project === 'pancakeswap-v3' && tokens.length >= 2) return { tokenA: tokens[0], tokenB: tokens[1], dex: 'pancakeswap', chainId };
  if (p.project === 'uniswap-v4' && (forSimulate || !p.hooks || /^0x0+$/.test(p.hooks))) return { v4PoolId: p.id as `0x${string}`, dex: 'uniswap', chainId };
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
// Shared with dexSearch's addMarketRangeAprs so market-priced pools and
// indexer pools quote the identical range figure.
export const BAND_FACTOR = (1 - 1 / Math.sqrt(1 + RANGE_APR_PCT / 100)) + (1 - Math.sqrt(1 - RANGE_APR_PCT / 100));

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
    withSafeMulticall(client).multicall({ contracts, allowFailure: true }),
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
