export type MarketToken = {
  address: string;
  symbol: string;
  name: string;
  quoteSymbol: string;
  quoteAddress: string;
  pairAddress: string;
  dex: string;
  version: string;
  priceUsd: number;
  change5m: number | null;
  change1h: number | null;
  change24h: number | null;
  volume24h: number;
  liquidityUsd: number;
  buys24h: number;
  sells24h: number;
  marketCap: number;
  pairCreatedAt: number | null;
  imageUrl: string;
  boosts: number;
  url: string;
  trendingScore: number;
};

export async function fetchMarketFeed(signal?: AbortSignal): Promise<MarketToken[]> {
  const response = await fetch('/api/markets', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Markets are unavailable');
  const body = await response.json() as { markets?: MarketToken[] };
  return Array.isArray(body.markets) ? body.markets : [];
}
