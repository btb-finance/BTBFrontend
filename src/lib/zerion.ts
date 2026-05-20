// Zerion API — wallet positions across all chains

const ZERION_KEY = process.env.NEXT_PUBLIC_ZERION_KEY ?? 'zk_15fdaf56e7b249f199dade0df01730a6';
const AUTH = 'Basic ' + btoa(ZERION_KEY + ':');
const BASE = 'https://api.zerion.io/v1';

// Zerion chain slug → wagmi chainId
export const ZERION_CHAIN_ID: Record<string, number> = {
  ethereum:  1,
  binance:   56,   // BSC
  'binance-smart-chain': 56,
  polygon:   137,
  arbitrum:  42161,
  optimism:  10,
  base:      8453,
  avalanche: 43114,
  fantom:    250,
  linea:     59144,
  scroll:    534352,
  gnosis:    100,
  zksync:    324,
  mantle:    5000,
  blast:     81457,
};

export interface ZerionPosition {
  address: string;       // token contract address (lowercase) or 'ETH'
  chainId: number;
  chainSlug: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance: string;       // formatted float as string
  balanceRaw: string;    // integer string
  usdPrice: number;
  usdValue: number;
  verified: boolean;
  positionType: string;  // 'wallet' | 'deposit' | 'staked' | etc
  change1d?: number;     // absolute USD change
  changePct1d?: number;
}

export async function fetchZerionPositions(
  walletAddress: string,
  filter: 'only_simple' | 'no_filter' = 'only_simple',
): Promise<ZerionPosition[]> {
  const filterParam = filter === 'no_filter' ? '' : `&filter[positions]=${filter}`;
  const url = `${BASE}/wallets/${walletAddress}/positions/?currency=usd&filter[trash]=only_non_trash&sort=-value${filterParam}`;
  const res = await fetch(url, { headers: { Authorization: AUTH, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Zerion positions ${res.status}`);
  const json = await res.json();

  const positions: ZerionPosition[] = [];
  for (const item of (json.data ?? [])) {
    const attr = item.attributes;
    const fi   = attr.fungible_info;
    const chainSlug: string = item.relationships?.chain?.data?.id ?? 'ethereum';
    const chainId = ZERION_CHAIN_ID[chainSlug] ?? 1;

    // pick the implementation matching this chain for the address
    const impl = (fi.implementations ?? []).find((im: any) => im.chain_id === chainSlug)
      ?? fi.implementations?.[0];

    const rawAddress = impl?.address ?? null;
    // native ETH / gas token — use special sentinel per chain
    const isNative = !rawAddress || rawAddress === '0x0000000000000000000000000000000000000000';
    const address  = isNative ? 'ETH' : rawAddress.toLowerCase();

    positions.push({
      address,
      chainId,
      chainSlug,
      symbol:      fi.symbol ?? '???',
      name:        fi.name   ?? fi.symbol ?? '???',
      decimals:    impl?.decimals ?? 18,
      logoURI:     fi.icon?.url,
      balance:     String(attr.quantity?.float  ?? 0),
      balanceRaw:  String(attr.quantity?.int     ?? '0'),
      usdPrice:    attr.price ?? 0,
      usdValue:    attr.value ?? 0,
      verified:    fi.flags?.verified ?? false,
      positionType: attr.position_type ?? 'wallet',
      change1d:    attr.changes?.absolute_1d,
      changePct1d: attr.changes?.percent_1d,
    });
  }

  return positions;
}
