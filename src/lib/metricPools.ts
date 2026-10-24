import { STABLES, type EarnPool } from './pools';

/**
 * Metric's pools for Discover (https://docs.metric.xyz). Metric prices each pool from an oracle (its Price Provider)
 * and keeps liquidity in bins set as percentages around that price, so a position follows the price with no range to
 * manage. Its public API (no key) covers Ethereum, BNB Chain and Robinhood Chain and lists every pool with TVL, 24h
 * volume and the 7 day Edge APR its own app shows: the LPs' share of the spread after the curator's and Metric's fees.
 *
 * Deposits happen on Metric's app (bins are picked per position), so rows link to the pool there.
 */

const API = 'https://api.metric.xyz/public/v1/evm/metadata';

/** Chain names as Discover's chain filter knows them (DISCOVERY_CHAINS in pools.ts). */
const CHAINS: Record<number, string> = { 1: 'Ethereum', 56: 'BNB Chain', 4663: 'Robinhood Chain' };

const MIN_TVL_USD = 10_000;
const PAGE = 500;

type MetricPool = {
  pair: string;
  chain: string;
  poolAddress: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  token0LogoUrl?: string | null;
  token1LogoUrl?: string | null;
  tvlFiat?: number | null;
  aprBps7d?: number | null;
  pauseLevel?: number;
  depositWhitelistingEnabled?: boolean;
  classificationSummary?: { tierQualification?: string };
  analytics24h?: { volumeFiat?: number | null; feesFiat?: number | null } | null;
};

/** Chain id from the API's chain name; its casing varies (`ethereum`, `BSC`, `Robinhood`). */
function chainIdOf(name: string): number | null {
  const n = name.toLowerCase();
  return n === 'ethereum' ? 1 : n === 'bsc' ? 56 : n === 'robinhood' ? 4663 : null;
}

/**
 * Every Metric pool worth listing, as Discover rows. Left out: paused pools, pools with a deposit allowlist (outside
 * LPs cannot join), pools Metric rates High Risk (missing the safeguards its tiers require) and pools under $10k.
 */
export async function ingestMetricPools(): Promise<EarnPool[]> {
  const rows: MetricPool[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await fetch(`${API}?count=${PAGE}&offset=${offset}&sortBy=tvl&include24h=true`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Metric metadata ${res.status}`);
    const json = await res.json() as { data?: MetricPool[]; nextOffset?: number | null };
    rows.push(...(json.data ?? []));
    if (!json.nextOffset || (json.data ?? []).length < PAGE) break;
  }
  const out: EarnPool[] = [];
  for (const p of rows) {
    const chainId = chainIdOf(p.chain);
    const chain = chainId != null ? CHAINS[chainId] : undefined;
    const tvl = p.tvlFiat ?? 0;
    if (!chainId || !chain || tvl < MIN_TVL_USD) continue;
    if ((p.pauseLevel ?? 0) > 0 || p.depositWhitelistingEnabled) continue;
    if (p.classificationSummary?.tierQualification === 'red') continue;
    const apr = (p.aprBps7d ?? 0) / 100;
    const stable = [p.token0Symbol, p.token1Symbol].every((s) => STABLES.has(s.toUpperCase()));
    out.push({
      id: p.poolAddress.toLowerCase(),
      project: 'metric',
      dex: 'Metric',
      chain,
      chainId,
      pair: `${p.token0Symbol}-${p.token1Symbol}`,
      tvlUsd: tvl,
      apy: apr,
      apyBase: apr,
      apyReward: 0,
      liquidityModel: 'DLMM',
      poolMeta: 'Oracle priced',
      underlyingTokens: [p.token0.toLowerCase(), p.token1.toLowerCase()],
      tokenLogos: [p.token0LogoUrl ?? null, p.token1LogoUrl ?? null],
      dexLogo: 'https://app.metric.xyz/favicon.svg',
      volume24hUsd: p.analytics24h?.volumeFiat ?? undefined,
      fees24hUsd: p.analytics24h?.feesFiat ?? undefined,
      stablecoin: stable,
      ilRisk: stable ? 'no' : 'yes',
      externalUrl: `https://app.metric.xyz/pool/${chainId}/${p.poolAddress}`,
      source: 'metric',
    });
  }
  return out;
}
