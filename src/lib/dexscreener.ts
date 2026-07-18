/**
 * DexScreener — free, keyless, no signup. One call per pool returns real
 * liquidity (TVL) and 24h volume together (DexPaprika needs a second
 * detail call for the same two numbers), and it indexes Uniswap V4 pools by
 * the same poolId hash we already compute. Used alongside DexPaprika as a
 * fallback behind DeFiLlama/GeckoTerminal — never used to invent a fee tier,
 * only ever combined with one we already resolved on-chain.
 */
const BASE = 'https://api.dexscreener.com/latest/dex/pairs';

export interface DexScreenerStats {
  tvlUsd: number;
  volume24hUsd: number;
}

export async function fetchDexScreenerPool(id: string, chain = 'ethereum'): Promise<DexScreenerStats | null> {
  try {
    const res = await fetch(`${BASE}/${chain}/${id.toLowerCase()}`);
    if (!res.ok) return null;
    const d = await res.json();
    const pair = d?.pairs?.[0];
    if (!pair) return null;
    const tvlUsd = typeof pair.liquidity?.usd === 'number' ? pair.liquidity.usd : undefined;
    const volume24hUsd = typeof pair.volume?.h24 === 'number' ? pair.volume.h24 : undefined;
    if (tvlUsd == null && volume24hUsd == null) return null;
    return { tvlUsd: tvlUsd ?? 0, volume24hUsd: volume24hUsd ?? 0 };
  } catch { return null; }
}

export async function fetchDexScreenerPools(ids: string[], chain = 'ethereum'): Promise<Record<string, DexScreenerStats>> {
  const out: Record<string, DexScreenerStats> = {};
  const results = await Promise.allSettled(ids.map((id) => fetchDexScreenerPool(id, chain)));
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) out[ids[i].toLowerCase()] = r.value;
  });
  return out;
}

export interface DexScreenerPairPool {
  address: string;        // lowercase pair address
  dexId: string;          // e.g. "uniswap", "sushiswap", "balancer"
  labels: string[];       // e.g. ["v3"] — version hints when DexScreener has them
  tvlUsd: number;
  volume24hUsd: number;
}

/**
 * Every pool DexScreener knows for a token (or token pair), across ALL DEXes
 * — merged with GeckoTerminal's search so pool discovery is complete rather
 * than limited to the protocols the app can mint on.
 */
export async function fetchDexScreenerPairPools(tokenAAddress: string, tokenBAddress?: string, chain = 'ethereum'): Promise<DexScreenerPairPool[]> {
  const a = tokenAAddress.toLowerCase();
  const b = tokenBAddress?.toLowerCase();
  const byAddress = new Map<string, DexScreenerPairPool>();
  try {
    // Query both token indexes for an exact pair. Each endpoint returns a
    // capped token-centric list; taking their union prevents the busier
    // token from hiding chain-native DEXes farther down its ranking.
    const queries = b ? [a, b] : [a];
    const responses = await Promise.allSettled(queries.map(async query => {
      const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chain}/${query}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return [];
      return res.json() as Promise<{
        pairAddress?: string; dexId?: string; labels?: string[];
        baseToken?: { address?: string }; quoteToken?: { address?: string };
        liquidity?: { usd?: number }; volume?: { h24?: number };
      }[]>;
    }));

    for (const result of responses) {
      if (result.status !== 'fulfilled') continue;
      for (const p of result.value ?? []) {
        const side = new Set([p.baseToken?.address?.toLowerCase(), p.quoteToken?.address?.toLowerCase()]);
        if (!side.has(a) || (b && !side.has(b)) || !p.pairAddress) continue;
        // Balancer multi-token pool ids etc. aren't plain addresses — skip those.
        if (!/^0x[0-9a-fA-F]{40}$/.test(p.pairAddress)) continue;
        const address = p.pairAddress.toLowerCase();
        const pool: DexScreenerPairPool = {
          address,
          dexId: p.dexId ?? 'unknown',
          labels: p.labels ?? [],
          tvlUsd: p.liquidity?.usd ?? 0,
          volume24hUsd: p.volume?.h24 ?? 0,
        };
        const previous = byAddress.get(address);
        byAddress.set(address, previous ? {
          ...previous,
          ...pool,
          labels: [...new Set([...previous.labels, ...pool.labels])],
          tvlUsd: Math.max(previous.tvlUsd, pool.tvlUsd),
          volume24hUsd: Math.max(previous.volume24hUsd, pool.volume24hUsd),
        } : pool);
      }
    }
  } catch { /* best-effort — caller merges whatever arrives */ }
  return [...byAddress.values()];
}
