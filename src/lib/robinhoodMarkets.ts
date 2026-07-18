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

type ExplorerToken = { address_hash?: string; reputation?: string };
type ExplorerPage = { items?: ExplorerToken[]; next_page_params?: Record<string, string | number | boolean | null> };

type Pair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  labels?: string[];
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  txns?: Record<string, { buys?: number; sells?: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
  boosts?: { active?: number };
};

const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2/tokens';
const DEX = 'https://api.dexscreener.com/tokens/v1/robinhood';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

async function tokenAddresses(): Promise<string[]> {
  const addresses = new Set<string>();
  let url = `${EXPLORER}?type=ERC-20`;
  for (let page = 0; page < 12; page++) {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) break;
    const body = await response.json() as ExplorerPage;
    for (const token of body.items ?? []) {
      if (ADDRESS.test(token.address_hash ?? '') && token.reputation?.toLowerCase() !== 'spam') {
        addresses.add(token.address_hash!.toLowerCase());
      }
    }
    if (!body.next_page_params) break;
    const params = new URLSearchParams({ type: 'ERC-20' });
    for (const [key, value] of Object.entries(body.next_page_params)) if (value != null) params.set(key, String(value));
    url = `${EXPLORER}?${params}`;
  }
  if (addresses.size === 0) throw new Error('Robinhood token registry unavailable');
  return [...addresses];
}

function score(pair: Pair): number {
  const volume = Math.max(0, pair.volume?.h24 ?? 0);
  const liquidity = Math.max(0, pair.liquidity?.usd ?? 0);
  const trades = Math.max(0, (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0));
  const boosts = Math.max(0, pair.boosts?.active ?? 0);
  return Math.log10(volume + 1) * 28 + Math.log10(liquidity + 1) * 18 + Math.log10(trades + 1) * 22 + Math.log10(boosts + 1) * 8;
}

/** One server-side Robinhood market scan, shared by the Convex refresher and
 * the legacy HTTP route. Browser consumers read the stored Convex snapshot. */
export async function buildRobinhoodMarketFeed(): Promise<MarketToken[]> {
  const addresses = await tokenAddresses();
  const batches: string[][] = [];
  for (let index = 0; index < addresses.length; index += 30) batches.push(addresses.slice(index, index + 30));
  const settled = await Promise.allSettled(batches.map(async batch => {
    const response = await fetch(`${DEX}/${batch.join(',')}`, { cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`DexScreener ${response.status}`);
    return response.json() as Promise<Pair[]>;
  }));
  const pairs = settled.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  const best = new Map<string, Pair>();
  for (const pair of pairs) {
    if (pair.chainId !== 'robinhood' || !ADDRESS.test(pair.baseToken?.address ?? '') || !pair.baseToken?.symbol) continue;
    const key = pair.baseToken.address!.toLowerCase();
    const current = best.get(key);
    const quality = (pair.liquidity?.usd ?? 0) + (pair.volume?.h24 ?? 0) * .2;
    const currentQuality = (current?.liquidity?.usd ?? 0) + (current?.volume?.h24 ?? 0) * .2;
    if (!current || quality > currentQuality) best.set(key, pair);
  }
  const markets = [...best.values()].map((pair): MarketToken => ({
    address: pair.baseToken!.address!,
    symbol: pair.baseToken!.symbol!,
    name: pair.baseToken!.name || pair.baseToken!.symbol!,
    quoteSymbol: pair.quoteToken?.symbol || '',
    quoteAddress: pair.quoteToken?.address || '',
    pairAddress: pair.pairAddress || '',
    dex: pair.dexId || 'DEX',
    version: pair.labels?.find(label => /^v\d$/i.test(label))?.toUpperCase() || '',
    priceUsd: Number(pair.priceUsd || 0),
    change5m: pair.priceChange?.m5 ?? null,
    change1h: pair.priceChange?.h1 ?? null,
    change24h: pair.priceChange?.h24 ?? null,
    volume24h: pair.volume?.h24 ?? 0,
    liquidityUsd: pair.liquidity?.usd ?? 0,
    buys24h: pair.txns?.h24?.buys ?? 0,
    sells24h: pair.txns?.h24?.sells ?? 0,
    marketCap: pair.marketCap ?? pair.fdv ?? 0,
    pairCreatedAt: pair.pairCreatedAt ?? null,
    imageUrl: pair.info?.imageUrl || '',
    boosts: pair.boosts?.active ?? 0,
    url: pair.url || '',
    trendingScore: score(pair),
  })).filter(market => market.priceUsd > 0 || market.liquidityUsd > 0 || market.volume24h > 0);
  if (markets.length === 0) throw new Error('Robinhood market feed unavailable');
  markets.sort((a, b) => b.trendingScore - a.trendingScore);
  return markets;
}
