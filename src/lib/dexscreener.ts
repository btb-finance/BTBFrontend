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
  const b = tokenBAddress?.toLowerCase();
  const out: DexScreenerPairPool[] = [];
  try {
    const res = await fetch(`https://api.dexscreener.com/token-pairs/v1/${chain}/${tokenAAddress}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return out;
    const pairs = await res.json() as {
      pairAddress?: string; dexId?: string; labels?: string[];
      baseToken?: { address?: string }; quoteToken?: { address?: string };
      liquidity?: { usd?: number }; volume?: { h24?: number };
    }[];
    for (const p of pairs ?? []) {
      const side = new Set([p.baseToken?.address?.toLowerCase(), p.quoteToken?.address?.toLowerCase()]);
      if ((b && !side.has(b)) || !p.pairAddress) continue;
      // Balancer multi-token pool ids etc. aren't plain addresses — skip those.
      if (!/^0x[0-9a-fA-F]{40}$/.test(p.pairAddress)) continue;
      out.push({
        address: p.pairAddress.toLowerCase(),
        dexId: p.dexId ?? 'unknown',
        labels: p.labels ?? [],
        tvlUsd: p.liquidity?.usd ?? 0,
        volume24hUsd: p.volume?.h24 ?? 0,
      });
    }
  } catch { /* best-effort — caller merges whatever arrives */ }
  return out;
}
