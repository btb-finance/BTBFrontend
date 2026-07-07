// Alchemy Portfolio API — token balances + NFTs across chains

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY ?? 'INhvk7-hUrgf5niZBGbae';
const BASE = `https://api.g.alchemy.com/data/v1/${ALCHEMY_KEY}`;

// Alchemy network slug → wagmi chainId
export const ALCHEMY_CHAIN_ID: Record<string, number> = {
  'eth-mainnet':    1,
  'matic-mainnet':  137,
  'arb-mainnet':    42161,
  'opt-mainnet':    10,
  'base-mainnet':   8453,
  'avax-mainnet':   43114,
  'zksync-mainnet': 324,
  'blast-mainnet':  81457,
  'scroll-mainnet': 534352,
  'linea-mainnet':  59144,
};

// All networks we query for tokens
export const ALCHEMY_NETWORKS = Object.keys(ALCHEMY_CHAIN_ID);


// Native gas token symbol/name per network — Alchemy reports the native
// balance with `tokenAddress: null`, so this is the only place that identity
// comes from.
export const NATIVE_TOKEN: Record<string, { symbol: string; name: string }> = {
  'eth-mainnet':    { symbol: 'ETH',   name: 'Ethereum' },
  'matic-mainnet':  { symbol: 'MATIC', name: 'Polygon' },
  'arb-mainnet':    { symbol: 'ETH',   name: 'Ethereum' },
  'opt-mainnet':    { symbol: 'ETH',   name: 'Ethereum' },
  'base-mainnet':   { symbol: 'ETH',   name: 'Ethereum' },
  'avax-mainnet':   { symbol: 'AVAX',  name: 'Avalanche' },
  'zksync-mainnet': { symbol: 'ETH',   name: 'Ethereum' },
  'blast-mainnet':  { symbol: 'ETH',   name: 'Ethereum' },
  'scroll-mainnet': { symbol: 'ETH',   name: 'Ethereum' },
  'linea-mainnet':  { symbol: 'ETH',   name: 'Ethereum' },
};

// ─── Token Balances ───────────────────────────────────────────────────────────

export interface AlchemyTokenBalance {
  network: string;
  chainId: number;
  tokenAddress: string | null;   // null = native gas token
  tokenBalance: string;          // raw integer string (hex or decimal)
}

export async function fetchAlchemyTokenBalances(
  walletAddress: string,
  networks: string[] = ALCHEMY_NETWORKS,
): Promise<AlchemyTokenBalance[]> {
  const res = await fetch(`${BASE}/assets/tokens/balances/by-address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      addresses: [{ address: walletAddress, networks }],
      includeNativeTokens: true,
      includeErc20Tokens: true,
    }),
  });
  if (!res.ok) throw new Error(`Alchemy tokens ${res.status}`);
  const json = await res.json();

  return (json.data?.tokens ?? []).map((t: any) => ({
    network:      t.network,
    chainId:      ALCHEMY_CHAIN_ID[t.network] ?? 1,
    tokenAddress: t.tokenAddress ?? null,
    tokenBalance: t.tokenBalance ?? '0',
  }));
}

// ─── Token metadata (per-chain JSON-RPC, one call per unique token) ───────────

export interface AlchemyTokenMeta {
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

/** `alchemy_getTokenMetadata` — no batch endpoint, so callers should only ask for unique (network, address) pairs actually held. */
export async function fetchAlchemyTokenMetadata(network: string, tokenAddress: string): Promise<AlchemyTokenMeta | null> {
  try {
    const res = await fetch(`https://${network}.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'alchemy_getTokenMetadata', params: [tokenAddress] }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json.result;
    if (!r || r.decimals == null) return null;
    return { symbol: r.symbol ?? '?', name: r.name ?? r.symbol ?? 'Unknown', decimals: r.decimals, logo: r.logo ?? undefined };
  } catch {
    return null;
  }
}

// ─── Prices ───────────────────────────────────────────────────────────────────

/** Batched USD prices by (network, address) — keyed here as `${network}:${address.toLowerCase()}`. */
export async function fetchAlchemyTokenPrices(pairs: { network: string; address: string }[]): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const CHUNK = 25;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);
    try {
      const res = await fetch(`https://api.g.alchemy.com/prices/v1/${ALCHEMY_KEY}/tokens/by-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: chunk.map(p => ({ network: p.network, address: p.address })) }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      for (const row of json.data ?? []) {
        const usd = row.prices?.find((p: any) => p.currency === 'usd')?.value;
        if (usd != null) result[`${row.network}:${row.address.toLowerCase()}`] = parseFloat(usd);
      }
    } catch { /* skip failed chunk */ }
  }
  return result;
}

/** Native gas token prices (ETH/MATIC/AVAX/…) — keyed by symbol, since natives have no contract address. */
export async function fetchAlchemyNativePrices(symbols: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(symbols)];
  if (unique.length === 0) return {};
  try {
    const qs = unique.map(s => `symbols=${encodeURIComponent(s)}`).join('&');
    const res = await fetch(`https://api.g.alchemy.com/prices/v1/${ALCHEMY_KEY}/tokens/by-symbol?${qs}`);
    if (!res.ok) return {};
    const json = await res.json();
    const result: Record<string, number> = {};
    for (const row of json.data ?? []) {
      const usd = row.prices?.find((p: any) => p.currency === 'usd')?.value;
      if (usd != null) result[row.symbol] = parseFloat(usd);
    }
    return result;
  } catch {
    return {};
  }
}

