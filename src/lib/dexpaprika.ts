/**
 * DexPaprika (coinpaprika.com's DEX data API) — free, keyless, generous rate
 * limit (300 req/min for pool endpoints). Used as a third TVL/volume fallback
 * behind DeFiLlama and GeckoTerminal, for pools neither of those index yet.
 *
 * Its pool-list endpoint has no reliable per-pool fee tier (comes back null
 * even for well-known Uniswap pools), so it's only ever paired with a fee
 * tier we already know on-chain — never used to invent one.
 *
 * DexPaprika's API sends no CORS headers at all, so a direct browser fetch()
 * fails with "Failed to fetch" for every user — every call here goes through
 * our own `/api/dexpaprika` route (`src/app/api/dexpaprika/route.ts`), which
 * forwards it server-side where CORS doesn't apply.
 */
const BASE = '/api/dexpaprika';

function proxied(path: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams({ path, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return `${BASE}?${qs.toString()}`;
}

export interface DexPaprikaStats {
  tvlUsd: number;
  volume24hUsd: number;
}

export interface DexPaprikaToken {
  address: string;
  symbol: string;
  decimals: number;
}

export interface DexPaprikaPoolRaw {
  /** Pool contract address (V3/PancakeSwap V3) or poolId hash (V4). */
  id: string;
  volume24hUsd: number;
  priceUsd: number;
  token0: DexPaprikaToken;
  token1: DexPaprikaToken;
}

/**
 * Top pools for one DEX on one network, ranked by 24h volume — the
 * "discovery" half of the pipeline (which pools exist and how big are they).
 * No TVL or fee tier here (DexPaprika's pool-list endpoint doesn't carry
 * either reliably); pair with an on-chain fee read and `fetchDexPaprikaPool`
 * (or DexScreener) for TVL.
 */
export async function fetchDexPaprikaTopPools(
  dexId: 'uniswap_v3' | 'uniswap_v4' | 'pancakeswap_v3',
  limit = 50,
  network = 'ethereum',
): Promise<DexPaprikaPoolRaw[]> {
  try {
    const res = await fetch(proxied(`networks/${network}/dexes/${dexId}/pools`, { limit, order_by: 'volume_usd', sort: 'desc' }));
    if (!res.ok) return [];
    const d = await res.json();
    const pools = Array.isArray(d?.pools) ? d.pools : [];
    return pools
      .filter((p: { tokens?: unknown[] }) => Array.isArray(p.tokens) && p.tokens.length >= 2)
      .map((p: { id: string; volume_usd: number; price_usd: number; tokens: { id: string; symbol: string; decimals: number }[] }) => ({
        id: p.id,
        volume24hUsd: p.volume_usd ?? 0,
        priceUsd: p.price_usd ?? 0,
        token0: { address: p.tokens[0].id, symbol: p.tokens[0].symbol, decimals: p.tokens[0].decimals },
        token1: { address: p.tokens[1].id, symbol: p.tokens[1].symbol, decimals: p.tokens[1].decimals },
      }));
  } catch { return []; }
}

/** Uniswap V4 pools are keyed by the same poolId hash we compute on-chain — no separate address. */
export async function fetchDexPaprikaPool(id: string, network = 'ethereum'): Promise<DexPaprikaStats | null> {
  try {
    const res = await fetch(proxied(`networks/${network}/pools/${id.toLowerCase()}`, {}));
    if (!res.ok) return null;
    const d = await res.json();
    const tvlUsd = typeof d.liquidity_usd === 'number' ? d.liquidity_usd : undefined;
    const volume24hUsd = typeof d['24h']?.volume_usd === 'number' ? d['24h'].volume_usd : undefined;
    if (tvlUsd == null && volume24hUsd == null) return null;
    return { tvlUsd: tvlUsd ?? 0, volume24hUsd: volume24hUsd ?? 0 };
  } catch { return null; }
}

/** Batched by concurrent per-pool detail calls (no bulk-by-id endpoint) — fine at Simulate's small N. */
export async function fetchDexPaprikaPools(ids: string[], network = 'ethereum'): Promise<Record<string, DexPaprikaStats>> {
  const out: Record<string, DexPaprikaStats> = {};
  const results = await Promise.allSettled(ids.map((id) => fetchDexPaprikaPool(id, network)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) out[ids[i].toLowerCase()] = r.value;
  });
  return out;
}
