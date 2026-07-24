export const maxDuration = 25;

import { isAddress } from 'viem';
import type { AccountAsset } from '../../../lib/accountAssets';

type ExplorerBalance = {
  value?: string;
  token?: {
    address_hash?: string;
    decimals?: string;
    exchange_rate?: string;
    icon_url?: string;
    name?: string;
    symbol?: string;
    type?: string;
  };
};

type ExplorerAddress = { coin_balance?: string; exchange_rate?: string };
type Pair = {
  chainId?: string;
  baseToken?: { address?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  info?: { imageUrl?: string };
};

const EXPLORER = 'https://robinhoodchain.blockscout.com/api/v2';
const DEX = 'https://api.dexscreener.com/tokens/v1/robinhood';
const WETH = '0x0bd7d308f8e1639fab988df18a8011f41eacad73';

function amount(raw: string, decimals: number) {
  const value = Number(raw) / 10 ** decimals;
  return Number.isFinite(value) ? value : 0;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const address = searchParams.get('address') ?? '';
  const refresh = searchParams.has('refresh');
  if (!isAddress(address)) return Response.json({ error: 'invalid address', assets: [] }, { status: 400 });
  try {
    const [balancesResponse, addressResponse] = await Promise.all([
      fetch(`${EXPLORER}/addresses/${address}/token-balances`, refresh ? { cache: 'no-store', signal: AbortSignal.timeout(8_000) } : { next: { revalidate: 20 }, signal: AbortSignal.timeout(8_000) }),
      fetch(`${EXPLORER}/addresses/${address}`, refresh ? { cache: 'no-store', signal: AbortSignal.timeout(8_000) } : { next: { revalidate: 20 }, signal: AbortSignal.timeout(8_000) }),
    ]);
    if (!balancesResponse.ok || !addressResponse.ok) throw new Error('explorer unavailable');
    const balances = await balancesResponse.json() as ExplorerBalance[];
    const native = await addressResponse.json() as ExplorerAddress;
    const tokenBalances = balances.filter(item => item.token?.type === 'ERC-20' && isAddress(item.token.address_hash ?? '') && Number(item.value ?? 0) > 0);
    const addresses = tokenBalances.map(item => item.token!.address_hash!);
    const batches: string[][] = [];
    for (let index = 0; index < addresses.length; index += 30) batches.push(addresses.slice(index, index + 30));
    const settled = await Promise.allSettled(batches.map(async batch => {
      const response = await fetch(`${DEX}/${batch.join(',')}`, refresh ? { cache: 'no-store', signal: AbortSignal.timeout(8_000) } : { next: { revalidate: 20 }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) return [] as Pair[];
      return response.json() as Promise<Pair[]>;
    }));
    const prices = new Map<string, { price: number; liquidity: number; image: string }>();
    for (const pair of settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])) {
      if (pair.chainId !== 'robinhood' || !isAddress(pair.baseToken?.address ?? '')) continue;
      const key = pair.baseToken!.address!.toLowerCase();
      const liquidity = pair.liquidity?.usd ?? 0;
      if (!prices.has(key) || liquidity > prices.get(key)!.liquidity) prices.set(key, { price: Number(pair.priceUsd ?? 0), liquidity, image: pair.info?.imageUrl ?? '' });
    }
    const assets: AccountAsset[] = tokenBalances.map(item => {
      const token = item.token!;
      const decimals = Number(token.decimals ?? 18);
      const balance = amount(item.value ?? '0', decimals);
      const dex = prices.get(token.address_hash!.toLowerCase());
      const priceUsd = dex?.price || (token.address_hash!.toLowerCase() === WETH ? Number(token.exchange_rate ?? 0) || 0 : 0);
      return {
        address: token.address_hash!, symbol: token.symbol || 'TOKEN', name: token.name || token.symbol || 'Token',
        decimals, rawBalance: item.value ?? '0', balance, priceUsd, usdValue: balance * priceUsd,
        imageUrl: dex?.image || token.icon_url || '', native: false,
      };
    });
    const nativeBalance = amount(native.coin_balance ?? '0', 18);
    assets.push({ address: null, symbol: 'ETH', name: 'Ether', decimals: 18, rawBalance: native.coin_balance ?? '0', balance: nativeBalance, priceUsd: Number(native.exchange_rate ?? 0) || 0, usdValue: nativeBalance * (Number(native.exchange_rate ?? 0) || 0), imageUrl: '', native: true });
    assets.sort((a, b) => b.usdValue - a.usdValue || b.balance - a.balance);
    return Response.json({ assets }, { headers: { 'cache-control': refresh ? 'no-store' : 'public, s-maxage=20, stale-while-revalidate=60' } });
  } catch {
    return Response.json({ error: 'balances unavailable', assets: [] }, { status: 502 });
  }
}
