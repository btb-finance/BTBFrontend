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
