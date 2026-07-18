/**
 * Full-market pool discovery, shared by Simulate (token pair) and Discover
 * (single token search): merges GeckoTerminal + DexScreener results into one
 * deduped, TVL-sorted list covering every DEX they track — Uniswap V2/V3,
 * SushiSwap, Balancer, and anything else, not just protocols the app can
 * mint on.
 */
import { searchPairPools } from './geckoterminal';
import { fetchDexScreenerPairPools } from './dexscreener';

export interface MarketPool {
  address: string;          // lowercase pool address
  dexId: string;            // raw source id, e.g. "uniswap_v3"
  dexLabel: string;         // human label, e.g. "Uniswap V3"
  name: string;             // e.g. "COMP / WETH 0.3%" (may be empty from DexScreener)
  /** Fee as a fraction (0.003 = 0.3%) when known, else null. */
  feePct: number | null;
  tvlUsd: number;
  volume24hUsd: number;
  /** Whole-pool fee APR % (volume × fee / TVL, annualized) when the fee is known. */
  aprPct: number | null;
  url: string;              // pool page on DexScreener
}

export interface MarketPoolNetworks {
  gecko: string;
  dexScreener: string;
}

/** DEXes with a fixed 0.30% swap fee (Uniswap V2 forks) — lets us compute a
 * real APR for pools whose fee the APIs don't state. */
const V2_STYLE_DEX = /uniswap.?v2|sushiswap|shibaswap|sakeswap|defi.?swap/i;

/** "uniswap_v3" / "balancer_ethereum" → a human label. DexScreener sometimes
 * reports a raw factory address instead of a name — those become "Other DEX"
 * rather than leaking a 0x… string into the UI. */
export function prettyDexLabel(dexId: string): string {
  const clean = dexId.replace(/_ethereum$/, '').replace(/[_-]+/g, ' ').trim();
  if (!clean || clean.toLowerCase() === 'unknown' || /^0x[0-9a-f]{6,}/i.test(clean)) return 'Other DEX';
  const KNOWN: Record<string, string> = {
    'uniswap v2': 'Uniswap V2', 'uniswap v3': 'Uniswap V3', 'uniswap': 'Uniswap',
    'sushiswap': 'SushiSwap', 'shibaswap': 'ShibaSwap', 'sakeswap': 'SakeSwap',
    'balancer': 'Balancer', 'defi swap': 'DeFi Swap', 'curve': 'Curve',
    'pancakeswap v3': 'PancakeSwap V3',
  };
  return KNOWN[clean.toLowerCase()] ?? clean.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * All pools for a token (tokenB omitted) or an exact pair (tokenB given).
 * Dust pools under `minTvlUsd` are dropped as noise.
 */
export async function searchMarketPools(
  tokenAAddress: string,
  tokenBAddress?: string,
  minTvlUsd = 100,
  networks: MarketPoolNetworks = { gecko: 'eth', dexScreener: 'ethereum' },
): Promise<MarketPool[]> {
  const [gt, ds] = await Promise.all([
    searchPairPools(tokenAAddress, tokenBAddress, networks.gecko).catch(() => []),
    fetchDexScreenerPairPools(tokenAAddress, tokenBAddress, networks.dexScreener).catch(() => []),
  ]);

  type Raw = { address: string; dexId: string; name: string; tvlUsd: number; volume24hUsd: number; fee: number | null };
  const byAddr = new Map<string, Raw>();
  // GeckoTerminal first — it carries the fee tier (parsed from the pool name)
  for (const p of gt) byAddr.set(p.address, { address: p.address, dexId: p.dexId, name: p.name, tvlUsd: p.tvlUsd, volume24hUsd: p.volume24hUsd, fee: p.fee });
  for (const p of ds) {
    const cur = byAddr.get(p.address);
    if (cur) {
      if (!cur.tvlUsd) cur.tvlUsd = p.tvlUsd;
      if (!cur.volume24hUsd) cur.volume24hUsd = p.volume24hUsd;
    } else {
      byAddr.set(p.address, {
        address: p.address,
        dexId: [p.dexId, ...p.labels].join(' '),
        name: '',
        tvlUsd: p.tvlUsd, volume24hUsd: p.volume24hUsd, fee: null,
      });
    }
  }

  const out: MarketPool[] = [];
  for (const r of byAddr.values()) {
    if (r.tvlUsd < minTvlUsd) continue;
    const feePct = r.fee ?? (V2_STYLE_DEX.test(r.dexId) ? 0.003 : null);
    const aprPct = feePct != null && r.tvlUsd > 0
      ? (r.volume24hUsd * feePct * 365 / r.tvlUsd) * 100
      : null;
    out.push({
      address: r.address,
      dexId: r.dexId,
      dexLabel: prettyDexLabel(r.dexId),
      name: r.name,
      feePct,
      tvlUsd: r.tvlUsd,
      volume24hUsd: r.volume24hUsd,
      aprPct: aprPct != null && isFinite(aprPct) ? aprPct : null,
      url: `https://dexscreener.com/${networks.dexScreener}/${r.address}`,
    });
  }
  out.sort((a, b) => b.tvlUsd - a.tvlUsd);
  return out;
}
