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
  pool_created_at?: string;
}

export interface PoolStats { tvlUsd: number; volume24hUsd: number; aprPct: number | null; createdAt?: number; }

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
        const createdMs = Date.parse(row.attributes.pool_created_at ?? '');
        result[addr] = { tvlUsd, volume24hUsd, aprPct, ...(Number.isFinite(createdMs) ? { createdAt: createdMs } : {}) };
      }
    } catch { /* skip failed chunk — caller falls back to whatever it already has */ }
  }
  return result;
}

export interface PairPool {
  address: string;        // lowercase pool address
  dexId: string;          // e.g. "uniswap_v3", "sushiswap", "balancer_ethereum"
  name: string;           // e.g. "COMP / WETH 0.3%"
  tvlUsd: number;
  volume24hUsd: number;
  /** Fee as a fraction (0.003 = 0.3%) when GeckoTerminal knows it (from the pool name), else null. */
  fee: number | null;
}

/**
 * Every pool GeckoTerminal knows for a token (or token pair), across ALL
 * DEXes (V2, V3, Sushi, Balancer, …). Searches by the first token's address;
 * when a second token is given, only pools pairing the two are returned.
 */
export async function searchPairPools(tokenAAddress: string, tokenBAddress?: string, network = 'eth'): Promise<PairPool[]> {
  const a = tokenAAddress.toLowerCase();
  const b = tokenBAddress?.toLowerCase();
  const byAddress = new Map<string, PairPool>();
  try {
    // Pair searches run from both token sides. Provider result pages are
    // capped, so a busy asset such as WETH can otherwise push a valid
    // Aerodrome/Curve/Balancer pool out of token A's first page.
    const queries = b ? [a, b] : [a];
    const responses = await Promise.allSettled(queries.map(async query => {
      const res = await fetch(`${BASE}/search/pools?query=${encodeURIComponent(query)}&network=${network}&page=1`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      const json = await res.json() as {
        data?: {
          attributes: PoolAttrs & { name?: string };
          relationships?: {
            dex?: { data?: { id?: string } };
            base_token?: { data?: { id?: string } };
            quote_token?: { data?: { id?: string } };
          };
        }[];
      };
      return json.data ?? [];
    }));

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      for (const row of result.value) {
        const base = row.relationships?.base_token?.data?.id?.split('_').pop()?.toLowerCase();
        const quote = row.relationships?.quote_token?.data?.id?.split('_').pop()?.toLowerCase();
        const pair = new Set([base, quote]);
        if (!pair.has(a) || (b && !pair.has(b))) continue;
        const address = row.attributes.address?.toLowerCase();
        if (!address) continue;
        const name = row.attributes.name ?? '';
        // Fee is embedded in the pool name for fee-tiered DEXes ("COMP / WETH 0.3%")
        const feeMatch = name.match(/([\d.]+)%\s*$/);
        const pool: PairPool = {
          address,
          dexId: row.relationships?.dex?.data?.id ?? 'unknown',
          name,
          tvlUsd: parseFloat(row.attributes.reserve_in_usd ?? '0') || 0,
          volume24hUsd: parseFloat(row.attributes.volume_usd?.h24 ?? '0') || 0,
          fee: feeMatch ? parseFloat(feeMatch[1]) / 100 : null,
        };
        const previous = byAddress.get(address);
        byAddress.set(address, previous ? {
          ...previous,
          ...pool,
          tvlUsd: Math.max(previous.tvlUsd, pool.tvlUsd),
          volume24hUsd: Math.max(previous.volume24hUsd, pool.volume24hUsd),
          fee: previous.fee ?? pool.fee,
        } : pool);
      }
    }
  } catch { /* search is best-effort — caller merges whatever arrives */ }
  return [...byAddress.values()];
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

// ── DEX registry and per-DEX pools ──────────────────────────────────────────
// GeckoTerminal lists every DEX it indexes on a network and the top pools of
// each one. The Discover cron uses this to cover venues the volume-ranked top
// list misses: on a young chain the second and third DEX by TVL can have no
// pool in the network's top hundred.

export interface DexRegistryEntry { id: string; name: string }

/** Every DEX GeckoTerminal knows on a network, all pages. */
export async function fetchDexRegistry(network = 'eth'): Promise<DexRegistryEntry[]> {
  const out: DexRegistryEntry[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${BASE}/networks/${network}/dexes?page=${page}`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) break;
    const json = await res.json() as { data?: { id: string; attributes?: { name?: string } }[] };
    const rows = json.data ?? [];
    for (const r of rows) out.push({ id: r.id, name: r.attributes?.name ?? r.id });
    if (rows.length < 20) break;
  }
  return out;
}

export interface DexPoolRow {
  address: string;
  dexId: string;
  name: string;
  tvlUsd: number;
  volume24hUsd: number;
  transactions24h: number;
  priceChange24h?: number;
  priceUsd: number;
  tokenAddresses: string[];
  /** Fee as a percent (0.3 = 0.3%) when the pool name carries it. */
  feePct?: number;
}

// The free tier allows 30 calls a minute across everything, and the Discover
// cron walks several chains at once, so per-DEX pool calls queue through one
// shared pacer instead of each chain pacing itself.
let paceTail: Promise<void> = Promise.resolve();
function paced<T>(fn: () => Promise<T>, gapMs = 2_500): Promise<T> {
  const run = paceTail.then(fn);
  paceTail = run.then(() => new Promise<void>(r => setTimeout(r, gapMs)), () => new Promise<void>(r => setTimeout(r, gapMs)));
  return run;
}

/** One page (20) of a DEX's top pools by 24h volume, with the fields the
 * Discover pipeline needs. Paced to the public rate limit. */
export function fetchDexTopPools(network: string, dexId: string, page = 1): Promise<DexPoolRow[]> {
  return paced(() => fetchDexTopPoolsNow(network, dexId, page));
}

async function fetchDexTopPoolsNow(network: string, dexId: string, page = 1): Promise<DexPoolRow[]> {
  let res: Response | null = null;
  // The public limit is enforced in bursts as well as per minute; on a 429
  // honour Retry-After (or wait a little) and try again, twice.
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${BASE}/networks/${network}/dexes/${dexId}/pools?page=${page}&sort=h24_volume_usd_desc`, { signal: AbortSignal.timeout(12000) });
    if (res.status !== 429) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 8_000));
  }
  if (!res || !res.ok) return [];
  const json = await res.json() as {
    data?: {
      attributes: PoolAttrs & { name?: string; base_token_price_usd?: string; price_change_percentage?: { h24?: string }; transactions?: { h24?: { buys?: number; sells?: number } } };
      relationships?: { dex?: { data?: { id?: string } }; base_token?: { data?: { id?: string } }; quote_token?: { data?: { id?: string } } };
    }[];
  };
  const out: DexPoolRow[] = [];
  for (const row of json.data ?? []) {
    const address = row.attributes.address?.toLowerCase();
    const base = row.relationships?.base_token?.data?.id?.split('_').pop()?.toLowerCase();
    const quote = row.relationships?.quote_token?.data?.id?.split('_').pop()?.toLowerCase();
    if (!address || !base || !quote) continue;
    const name = row.attributes.name ?? '';
    const feeMatch = name.match(/([\d.]+)%\s*$/);
    const tx = row.attributes.transactions?.h24;
    out.push({
      address,
      dexId: row.relationships?.dex?.data?.id ?? dexId,
      name,
      tvlUsd: parseFloat(row.attributes.reserve_in_usd ?? '0') || 0,
      volume24hUsd: parseFloat(row.attributes.volume_usd?.h24 ?? '0') || 0,
      transactions24h: (tx?.buys ?? 0) + (tx?.sells ?? 0),
      priceChange24h: row.attributes.price_change_percentage?.h24 != null ? parseFloat(row.attributes.price_change_percentage.h24) : undefined,
      priceUsd: parseFloat(row.attributes.base_token_price_usd ?? '0') || 0,
      tokenAddresses: [base, quote],
      feePct: feeMatch ? parseFloat(feeMatch[1]) : undefined,
    });
  }
  return out;
}

/** Token logos for up to 30 addresses on one network, keyed by lowercase address. Paced. */
export function fetchTokenLogos(network: string, addresses: string[]): Promise<Map<string, string>> {
  return paced(() => fetchTokenLogosNow(network, addresses));
}

async function fetchTokenLogosNow(network: string, addresses: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const batch = addresses.slice(0, 30);
  if (batch.length === 0) return out;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`${BASE}/networks/${network}/tokens/multi/${batch.join(',')}`, { signal: AbortSignal.timeout(12000) });
    if (res.status !== 429) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 20) * 1000 : 8_000));
  }
  // Throw rather than return an empty map: the caller records "no logo" for
  // addresses a successful answer left out, and a rate limit must not look like that.
  if (!res || !res.ok) throw new Error(`GeckoTerminal token lookup failed (${res?.status ?? 'no response'})`);
  const json = await res.json() as { data?: { attributes?: { address?: string; image_url?: string | null } }[] };
  for (const t of json.data ?? []) {
    const a = t.attributes?.address?.toLowerCase();
    const url = t.attributes?.image_url;
    if (a && url && !/missing/i.test(url)) out.set(a, url);
  }
  return out;
}
