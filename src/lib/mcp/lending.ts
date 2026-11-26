/**
 * Lending and savings rates for agents: what a token earns when supplied to Aave, Compound, Morpho, Spark, Euler,
 * Fluid, Moonwell and other lending markets, per chain, from DefiLlama's yields feed (refreshed hourly upstream,
 * kept here for 30 minutes). So "where do I earn most on my USDC" gets a live number, never a guess.
 */

const FEED = 'https://yields.llama.fi/pools';
const TTL_MS = 30 * 60_000;

/** Lending and savings markets: DefiLlama project slug → the name people know. */
const PROJECTS: Record<string, string> = {
  'aave-v3': 'Aave V3', 'aave-v4': 'Aave V4', 'compound-v3': 'Compound V3', 'compound-v2': 'Compound V2', 'morpho-blue': 'Morpho',
  'sparklend': 'SparkLend', 'spark-savings': 'Spark Savings', 'euler-v2': 'Euler', 'fluid-lending': 'Fluid', 'moonwell-lending': 'Moonwell',
  'venus-core-pool': 'Venus', 'silo-v2': 'Silo', 'kamino-lend': 'Kamino',
};
/** Liquid staking: project → the token it pays in and the names that token trades under (wrapped forms earn the same). */
const STAKING: Record<string, { name: string; token: string; aliases: string[] }> = {
  'lido': { name: 'Lido', token: 'stETH', aliases: ['steth', 'wsteth'] },
  'ether.fi-stake': { name: 'ether.fi', token: 'weETH', aliases: ['eeth', 'weeth'] },
  'binance-staked-eth': { name: 'Binance', token: 'wBETH', aliases: ['wbeth'] },
  'rocket-pool': { name: 'Rocket Pool', token: 'rETH', aliases: ['reth'] },
  'coinbase-wrapped-staked-eth': { name: 'Coinbase', token: 'cbETH', aliases: ['cbeth'] },
  'kelp': { name: 'Kelp', token: 'rsETH', aliases: ['rseth', 'wrseth'] },
  'liquid-collective': { name: 'Liquid Collective', token: 'LsETH', aliases: ['lseth'] },
  'meth-protocol': { name: 'Mantle', token: 'mETH', aliases: ['meth', 'cmeth'] },
  'stakewise-v3': { name: 'StakeWise', token: 'osETH', aliases: ['oseth'] },
  'renzo': { name: 'Renzo', token: 'ezETH', aliases: ['ezeth'] },
  'frax-ether': { name: 'Frax', token: 'sfrxETH', aliases: ['sfrxeth', 'frxeth'] },
  'swell-liquid-staking': { name: 'Swell', token: 'swETH', aliases: ['sweth'] },
  'stader': { name: 'Stader', token: 'ETHx', aliases: ['ethx'] },
};

/** The BTB protocol registry slug for each, when it has the contracts (get_protocol, then build_tx). */
const REGISTRY: Record<string, string> = { 'aave-v3': 'aave-v3', 'morpho-blue': 'morpho' };

interface Row {
  chain: string; project: string; symbol: string; tvlUsd: number; apy: number | null; apyBase: number | null; apyReward: number | null;
  apyMean30d: number | null; stablecoin: boolean; exposure: string; poolMeta: string | null; underlyingTokens: string[] | null; pool: string; outlier: boolean;
}

let cache: { at: number; rows: Promise<Row[]> } | null = null;

function feed(): Promise<Row[]> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const rows = fetch(FEED, { signal: AbortSignal.timeout(20_000) })
      .then((r) => { if (!r.ok) throw new Error(`rates feed ${r.status}`); return r.json() as Promise<{ data: Row[] }>; })
      // Single-asset rows of the lending and liquid-staking projects only: about 1,800 of the feed's 15,000.
      .then((b) => b.data.filter((p) => (PROJECTS[p.project] || STAKING[p.project]) && p.exposure === 'single' && typeof p.apy === 'number'));
    cache = { at: Date.now(), rows };
    rows.catch(() => { if (cache?.rows === rows) cache = null; });
  }
  return cache.rows;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const CHAIN_ALIASES: Record<string, string> = { eth: 'ethereum', mainnet: 'ethereum', '1': 'ethereum', '8453': 'base', bsc: 'bsc', bnb: 'bsc', bnbchain: 'bsc', '56': 'bsc', arb: 'arbitrum', '42161': 'arbitrum', op: 'opmainnet', optimism: 'opmainnet', '10': 'opmainnet', robinhood: 'robinhoodchain', '4663': 'robinhoodchain', matic: 'polygon', '137': 'polygon', avax: 'avalanche', '43114': 'avalanche', '130': 'unichain' };
const chainNorm = (c: string) => CHAIN_ALIASES[norm(c)] ?? norm(c);
const r2 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 100) / 100);

export async function lendingRates(a: { token?: string; chain?: string; protocol?: string; minTvlUsd?: number; limit?: number }) {
  const rows = (await feed()).filter((p) => PROJECTS[p.project]);
  const token = a.token?.trim().toLowerCase();
  const chain = a.chain ? chainNorm(a.chain) : null;
  const proto = a.protocol ? norm(a.protocol) : null;
  const minTvl = a.minTvlUsd ?? 1_000_000;
  const hits = rows
    .filter((p) => !chain || chainNorm(p.chain) === chain)
    .filter((p) => !proto || norm(p.project).startsWith(proto) || norm(PROJECTS[p.project]).startsWith(proto))
    // Vaults (Morpho, Euler) list under their own name, e.g. STEAKUSDC for a USDC vault: a name ending in the token counts.
    .filter((p) => !token || p.symbol.toLowerCase() === token || (token.length >= 3 && !token.startsWith('0x') && p.symbol.toLowerCase().endsWith(token))
      || (p.underlyingTokens ?? []).some((t) => t.toLowerCase() === token)
      || (token === 'eth' && /^w?eth$/i.test(p.symbol)) || (token === 'stable' && p.stablecoin))
    .filter((p) => p.tvlUsd >= minTvl && !p.outlier)
    .sort((x, y) => (y.apy ?? 0) - (x.apy ?? 0))
    .slice(0, Math.min(50, a.limit ?? 15));
  return {
    count: hits.length,
    markets: hits.map((p) => ({
      protocol: PROJECTS[p.project], chain: p.chain, token: p.symbol, market: p.poolMeta ?? (token && p.symbol.toLowerCase() !== token ? `${p.symbol} vault` : null),
      supplyApyPct: r2(p.apy), baseApyPct: r2(p.apyBase), rewardApyPct: r2(p.apyReward), avg30dApyPct: r2(p.apyMean30d),
      tvlUsd: Math.round(p.tvlUsd), tokenAddresses: p.underlyingTokens ?? [],
      ...(REGISTRY[p.project] ? { registry: REGISTRY[p.project] } : {}),
    })),
    notes: [
      'Supply APY: what lending the token earns now, variable. Rewards (if any) are paid in another token and can stop.',
      'To lend for a person: get_protocol(registry) for the official contract on that chain, then build_tx with steps [approve on the token, the supply call] and give them the signLink.',
      'Source: DefiLlama yields, refreshed about hourly. Markets under the TVL floor are left out (minTvlUsd, default 1000000). Not financial advice.',
    ],
  };
}

/**
 * What ETH earns staked, per liquid-staking token, best first. Wrapped forms earn the same yield (wstETH is stETH,
 * weETH is eETH), so a pool holding one of them earns that yield on that half on top of its trading fees.
 */
export async function stakingRates(a: { token?: string }) {
  const rows = await feed();
  const want = a.token?.trim().toLowerCase();
  const best = new Map<string, Row>();
  for (const p of rows) {
    const s = STAKING[p.project];
    if (!s || !s.aliases.includes(p.symbol.toLowerCase())) continue;
    // One row per project: the deepest market is the protocol's own staking rate.
    const had = best.get(p.project);
    if (!had || p.tvlUsd > had.tvlUsd) best.set(p.project, p);
  }
  const list = [...best.entries()]
    .map(([project, p]) => ({ project, p, s: STAKING[project] }))
    .filter(({ s }) => !want || s.aliases.includes(want) || s.token.toLowerCase() === want || norm(s.name).startsWith(norm(want)))
    .sort((x, y) => (y.p.apy ?? 0) - (x.p.apy ?? 0));
  return {
    count: list.length,
    staking: list.map(({ p, s }) => ({
      protocol: s.name, token: s.token, alsoTradesAs: s.aliases.filter((x) => x !== s.token.toLowerCase()),
      stakingApyPct: r2(p.apy), avg30dApyPct: r2(p.apyMean30d), tvlUsd: Math.round(p.tvlUsd),
    })),
    notes: [
      'A pool with one of these tokens (wstETH-WETH, weETH-ETH...) earns the token\'s staking APY on that half, on top of the pool APR the pool tools show.',
      'Restaking tokens (ezETH, rsETH, weETH) add restaking risk on top of staking. Source: DefiLlama yields. Not financial advice.',
    ],
  };
}
