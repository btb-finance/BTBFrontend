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
const DIRECT_BASE = 'https://api.dexpaprika.com';

function proxied(path: string, params: Record<string, string | number>): string {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
  // Server side (Convex discover cron, Next server) there's no CORS and a
  // relative URL has no origin — hit DexPaprika directly. Browsers use the proxy.
  if (typeof window === 'undefined') {
    return `${DIRECT_BASE}/${path}?${new URLSearchParams(flat).toString()}`;
  }
  const qs = new URLSearchParams({ path, ...flat });
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

/**
 * One pool from the network wide listing.
 *
 * Note what is NOT here: `fee` comes back null even for well known Uniswap
 * pools, and token symbols are absent entirely (the response carries token
 * addresses only). Callers pair this with an on chain fee read and their own
 * symbol resolution, so a fee tier is never invented from this data.
 */
export interface DexPaprikaPoolRow {
  /** Pool contract address (V2/V3 style) or poolId hash (V4). */
  id: string;
  dexId: string;          // 'uniswap_v3'
  dexName: string;        // 'Uniswap V3'
  volume24hUsd: number;
  tvlUsd: number;
  transactions24h: number;
  priceChange24h?: number;
  priceUsd: number;
  tokenAddresses: string[];
  /** Swap fee as a percent (0.01 = 0.01%). Often null; present on some venues. */
  feePct?: number;
}

const MAX_PAGE = 100;   // the API rejects limit > 100 with a 400

interface SearchRow {
  id?: string;
  dex_id?: string;
  dex_name?: string;
  volume_usd_24h?: number;
  liquidity_usd?: number;
  transactions_24h?: number;
  price_change_percentage_24h?: number;
  price_usd?: number;
  fee?: number | null;
  tokens?: { id?: string }[];
}

/**
 * Every DEX's top pools on one network, ranked by 24h volume.
 *
 * This is the discovery half of the Discover pipeline: which pools exist and
 * how much they actually trade. Volume ranking is the point. DeFiLlama ranks
 * by TVL, which floats dead pools (large balance, no trades) to the top of
 * the table; ordering by traded volume puts the pools people actually use
 * first, matching how DexScreener presents a chain.
 *
 * The previous per DEX endpoint (`/dexes/{dexId}/pools`) was removed upstream
 * and had been failing silently behind a catch. This replacement is strictly
 * better: one call covers every DEX on the network, and TVL and trade counts
 * come inline, so no per pool detail call is needed.
 */
export async function fetchNetworkTopPools(network: string, limit = 100): Promise<DexPaprikaPoolRow[]> {
  const out: DexPaprikaPoolRow[] = [];
  let cursor: string | undefined;

  while (out.length < limit) {
    const page = Math.min(MAX_PAGE, limit - out.length);
    const params: Record<string, string | number> = { limit: page };
    if (cursor) params.cursor = cursor;
    let body: { results?: SearchRow[]; has_next_page?: boolean; next_cursor?: string };
    try {
      const res = await fetch(proxied(`networks/${network}/pools/search`, params));
      if (!res.ok) break;
      body = await res.json();
    } catch { break; }

    const rows = Array.isArray(body?.results) ? body.results : [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const tokens = (row.tokens ?? []).map(t => t.id).filter((a): a is string => !!a);
      if (!row.id || tokens.length < 2) continue;
      out.push({
        id: row.id,
        dexId: row.dex_id ?? 'unknown',
        dexName: row.dex_name ?? row.dex_id ?? 'DEX',
        volume24hUsd: row.volume_usd_24h ?? 0,
        tvlUsd: row.liquidity_usd ?? 0,
        transactions24h: row.transactions_24h ?? 0,
        priceChange24h: row.price_change_percentage_24h,
        priceUsd: row.price_usd ?? 0,
        tokenAddresses: tokens,
        feePct: typeof row.fee === 'number' && row.fee > 0 ? row.fee : undefined,
      });
    }

    if (!body.has_next_page || !body.next_cursor) break;
    cursor = body.next_cursor;
  }
  return out;
}

/**
 * The DEX registry for one network, straight from the provider.
 *
 * `protocol` is the part that matters: it groups every product a venue runs
 * ("aerodrome_slipstream_3", "aerodrome_v3", "aerodrome" all report protocol
 * "aerodrome"). That is the brand grouping the Discover filter chips need, and
 * taking it from here means no hand maintained name map to fall behind.
 */
export interface DexPaprikaDex {
  dexId: string;
  dexName: string;
  protocol: string;
}

export async function fetchNetworkDexes(network: string): Promise<DexPaprikaDex[]> {
  try {
    const res = await fetch(proxied(`networks/${network}/dexes`, {}));
    if (!res.ok) return [];
    const body = await res.json();
    const rows = body?.dexes ?? body?.results ?? (Array.isArray(body) ? body : []);
    return (rows as { dex_id?: string; dex_name?: string; protocol?: string }[])
      .filter(d => !!d.dex_id)
      .map(d => ({
        dexId: d.dex_id as string,
        dexName: d.dex_name ?? (d.dex_id as string),
        protocol: d.protocol ?? (d.dex_id as string),
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
