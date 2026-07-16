export type AccountAsset = {
  address: string | null;
  symbol: string;
  name: string;
  decimals: number;
  rawBalance: string;
  balance: number;
  priceUsd: number;
  usdValue: number;
  imageUrl: string;
  native: boolean;
};

export async function fetchAccountAssets(address: string, signal?: AbortSignal, refreshKey = 0): Promise<AccountAsset[]> {
  const refresh = refreshKey > 0 ? `&refresh=${refreshKey}` : '';
  const response = await fetch(`/api/account-assets?address=${encodeURIComponent(address)}${refresh}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Balances are unavailable');
  const body = await response.json() as { assets?: AccountAsset[] };
  return Array.isArray(body.assets) ? body.assets : [];
}
