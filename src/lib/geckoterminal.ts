/**
 * GeckoTerminal's public on-chain API — free, keyless, no per-request cost.
 * Used for Discover pool trend data instead of a paid provider.
 */
const BASE = 'https://api.geckoterminal.com/api/v2';

interface PoolAttrs {
  address: string;
  price_change_percentage?: { h24?: string; h6?: string; h1?: string };
  reserve_in_usd?: string;
  volume_usd?: { h24?: string };
  pool_fee_percentage?: string;
}

export interface PoolStats { tvlUsd: number; volume24hUsd: number; aprPct: number | null; }

/**
 * Batched TVL/volume/fee-derived APR for many pools in as few requests as
 * possible — fallback for pools DeFiLlama's yields list doesn't cover (it
 * only indexes a subset, not literally every on-chain pool), so a pool that's
 * genuinely thin/dead shows real near-zero numbers instead of a blank dash
 * that reads as "we don't know."
 */
export async function fetchPoolStats(poolAddresses: string[], network = 'eth'): Promise<Record<string, PoolStats>> {
  const addrs = [...new Set(poolAddresses.map(a => a.toLowerCase()))];
  const result: Record<string, PoolStats> = {};
  const CHUNK = 30;

  for (let i = 0; i < addrs.length; i += CHUNK) {
    const chunk = addrs.slice(i, i + CHUNK);
    try {
      const res = await fetch(`${BASE}/networks/${network}/pools/multi/${chunk.join(',')}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const json = await res.json() as { data?: { attributes: PoolAttrs }[] };
      for (const row of json.data ?? []) {
        const addr = row.attributes.address?.toLowerCase();
        if (!addr) continue;
        const tvlUsd = parseFloat(row.attributes.reserve_in_usd ?? '0') || 0;
        const volume24hUsd = parseFloat(row.attributes.volume_usd?.h24 ?? '0') || 0;
        const feePct = parseFloat(row.attributes.pool_fee_percentage ?? '');
        const aprPct = tvlUsd > 0 && isFinite(feePct) ? (volume24hUsd * (feePct / 100) * 365 / tvlUsd) * 100 : null;
        result[addr] = { tvlUsd, volume24hUsd, aprPct };
      }
    } catch { /* skip failed chunk — caller falls back to whatever it already has */ }
  }
  return result;
}

/**
 * Batched 24h price-change % for many pools in as few requests as possible
 * (GeckoTerminal's `/pools/multi` accepts up to 30 addresses per call).
 * Returns a map of lowercase pool address -> 24h % change.
 */
export async function fetchPoolPriceChanges(poolAddresses: string[], network = 'eth'): Promise<Record<string, number>> {
  const addrs = [...new Set(poolAddresses.map(a => a.toLowerCase()))];
  const result: Record<string, number> = {};
  const CHUNK = 30;

  for (let i = 0; i < addrs.length; i += CHUNK) {
    const chunk = addrs.slice(i, i + CHUNK);
    try {
      const res = await fetch(`${BASE}/networks/${network}/pools/multi/${chunk.join(',')}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const json = await res.json() as { data?: { attributes: PoolAttrs }[] };
      for (const row of json.data ?? []) {
        const addr = row.attributes.address?.toLowerCase();
        const pct = row.attributes.price_change_percentage?.h24;
        if (addr && pct != null) result[addr] = parseFloat(pct);
      }
    } catch { /* skip failed chunk — table just shows dashes for it */ }
  }
  return result;
}

/**
 * Recent hourly close-price series for a single pool — used for the small
 * sparkline on hover/expand. One request per pool, so callers should only use
 * this for a handful of rows at a time (e.g. currently visible), not the
 * whole table at once.
 */
export async function fetchPoolSparkline(poolAddress: string, network = 'eth'): Promise<number[]> {
  try {
    const res = await fetch(
      `${BASE}/networks/${network}/pools/${poolAddress.toLowerCase()}/ohlcv/hour?aggregate=4&limit=24`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return [];
    const json = await res.json() as { data?: { attributes?: { ohlcv_list?: number[][] } } };
    const list = json.data?.attributes?.ohlcv_list ?? [];
    // [timestamp, open, high, low, close, volume] — oldest last; reverse to chronological.
    return list.map(row => row[4]).reverse();
  } catch {
    return [];
  }
}

export interface DailyBar { timestamp: number; open: number; high: number; low: number; close: number; volumeUsd: number; }

/**
 * Daily OHLCV for a single pool — free fallback price chart for the LP
 * simulator when no Graph API key is configured (the subgraph-based 30-day
 * chart is otherwise the only source, and paid-key-gated). Base/quote token
 * order isn't guaranteed to match the pool's on-chain token0/token1 — callers
 * that need a specific orientation should rescale against a known live price
 * rather than trust absolute units here.
 */
export async function fetchPoolDailyHistory(poolAddress: string, days = 30, network = 'eth'): Promise<DailyBar[]> {
  try {
    const res = await fetch(
      `${BASE}/networks/${network}/pools/${poolAddress.toLowerCase()}/ohlcv/day?limit=${days}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) return [];
    const json = await res.json() as { data?: { attributes?: { ohlcv_list?: number[][] } } };
    const list = json.data?.attributes?.ohlcv_list ?? [];
    // [timestamp, open, high, low, close, volume] — oldest last; reverse to chronological.
    return list.map(row => ({ timestamp: row[0], open: row[1], high: row[2], low: row[3], close: row[4], volumeUsd: row[5] })).reverse();
  } catch {
    return [];
  }
}
