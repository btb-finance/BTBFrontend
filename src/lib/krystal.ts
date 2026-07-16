const KRYSTAL_API = 'https://api.krystal.app/all/v1';
const LP_CHAIN_IDS = '1,10,56,130,137,146,2020,324,42161,43114,59144,80094,81457,8453,999';
const BALANCE_CHAIN_IDS = '1,10,56,130,137,146,2020,324,4663,42161,43114,59144,80094,81457,8453,999';
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface KrystalTokenAmount {
  token?: { symbol?: string; logo?: string; decimals?: number };
  balance?: string;
  quotes?: { usd?: { value?: number } };
}

export interface KrystalPositionAnalytics {
  chainId: number;
  chainName: string;
  tokenAddress?: string;
  chainLogo?: string;
  tokenId: string;
  status: string;
  pnl: number;
  returnOnInvestment: number;
  compareWithHodl: number;
  apr: number;
  feeApr: number;
  farmApr: number;
  totalDepositValue: number;
  totalWithdrawValue: number;
  currentPositionValue: number;
  createdTime: number;
  closedTime: number;
  feePending?: KrystalTokenAmount[];
  feesClaimed?: KrystalTokenAmount[];
  currentAmounts?: KrystalTokenAmount[];
  pool?: { projectKey?: string; project?: string };
}

export interface KrystalLpStats {
  openPositionCount: number;
  closedPositionCount: number;
  currentPositionValue: number;
  pnl: number;
  returnOnInvestment: number;
  compareWithHodl: number;
  totalFeeEarned: number;
  unclaimedFees: number;
  feeApr: number;
  farmApr: number;
}

export interface KrystalLpResponse {
  positions?: KrystalPositionAnalytics[];
  statsByChain?: Record<string, KrystalLpStats>;
}

export interface KrystalTokenBalanceOutput {
  data?: Array<{
    chainId: number;
    chainName: string;
    balances?: Array<{
      balance?: string;
      token?: { address?: string; symbol?: string; name?: string; decimals?: number; logo?: string; tag?: string };
      quotes?: { usd?: { value?: number; price?: number; marketPrice?: number; timestamp?: number } };
    }>;
  }>;
}

function assertAddress(address: string) {
  if (!EVM_ADDRESS.test(address)) throw new Error('Invalid wallet address');
}

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Krystal request failed (${response.status})`);
  return response.json() as Promise<T>;
}

/**
 * Central Krystal transport. Production uses the local proxy when available,
 * then Krystal's CORS-enabled public read API when serverless egress is blocked.
 */
export async function fetchKrystalLp(address: string): Promise<KrystalLpResponse> {
  assertAddress(address);
  try {
    return await readJson<KrystalLpResponse>(`/api/krystal/lp?address=${encodeURIComponent(address)}`);
  } catch { /* use public read-only fallback below */ }

  const loadPage = (positionStatus: 'open' | 'closed', offset: number) => {
    const query = new URLSearchParams({
      addresses: address,
      chainIds: LP_CHAIN_IDS,
      positionStatus,
      orderBy: 'lastAction',
      orderASC: 'false',
      limit: '100',
      offset: String(offset),
    });
    return readJson<KrystalLpResponse>(`${KRYSTAL_API}/lp/userPositions?${query}`);
  };

  const settled = await Promise.allSettled([
    loadPage('open', 0),
    loadPage('closed', 0),
    loadPage('closed', 100),
    loadPage('closed', 200),
  ]);
  const pages = settled.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  if (pages.length === 0) throw new Error('Krystal LP analytics unavailable');
  const seen = new Set<string>();
  const positions = pages.flatMap(page => page.positions ?? []).filter(position => {
    const key = `${position.chainId}:${position.tokenAddress ?? ''}:${position.tokenId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { statsByChain: pages[0]?.statsByChain ?? {}, positions };
}

export async function fetchKrystalTokenBalances(address: string): Promise<KrystalTokenBalanceOutput> {
  assertAddress(address);
  try {
    return await readJson<KrystalTokenBalanceOutput>(`/api/krystal/tokens?address=${encodeURIComponent(address)}`);
  } catch { /* use public read-only fallback below */ }

  const query = new URLSearchParams({
    addresses: `ethereum:${address.toLowerCase()}`,
    chainIDs: BALANCE_CHAIN_IDS,
    quoteSymbols: 'usd',
    sparkline: 'false',
  });
  const result = await readJson<KrystalTokenBalanceOutput>(`${KRYSTAL_API}/balance/token?${query}`);
  if (!Array.isArray(result.data)) throw new Error('Krystal balances unavailable');
  return result;
}
