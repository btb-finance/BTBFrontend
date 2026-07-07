/**
 * CoinGecko's free public API (no key, no cost) — used to build our own
 * portfolio-value chart instead of paying for a third-party portfolio API.
 */
const BASE = 'https://api.coingecko.com/api/v3';
const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

export interface PricePoint { timestamp: number; price: number; }

/** Native 'ETH' has no CoinGecko contract entry — price it via WETH instead. */
export function coingeckoAddress(tokenAddress: string): string {
  const a = tokenAddress.toLowerCase();
  return a === 'eth' ? WETH : a;
}

/** Historical USD price series for one ERC-20 contract on Ethereum mainnet. */
export async function fetchTokenMarketChart(tokenAddress: string, days: number): Promise<PricePoint[]> {
  try {
    const res = await fetch(
      `${BASE}/coins/ethereum/contract/${coingeckoAddress(tokenAddress)}/market_chart/?vs_currency=usd&days=${days}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!res.ok) return [];
    const json = await res.json() as { prices?: [number, number][] };
    return (json.prices ?? []).map(([timestamp, price]) => ({ timestamp, price }));
  } catch {
    return [];
  }
}
