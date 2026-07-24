// Alchemy Portfolio API — token balances + NFTs across chains

export const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_KEY ?? 'INhvk7-hUrgf5niZBGbae';
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


// ─── Position-NFT enumeration ────────────────────────────────────────────────
// LP positions (Uniswap V3/V4, PancakeSwap V3) are NFTs. One indexed Alchemy
// call returns every position tokenId the wallet owns across all of those
// contracts at once — replacing the slow on-chain paths (balanceOf +
// tokenOfOwnerByIndex loops for V3, Transfer-log scans for V4).
const NFT_HOST = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`;

/** TokenIds the owner holds per contract (keys are lowercase addresses). */
export async function fetchOwnedNftTokenIds(
  owner: string,
  contracts: string[],
): Promise<Map<string, bigint[]>> {
  const out = new Map<string, bigint[]>(contracts.map((c) => [c.toLowerCase(), []]));
  let pageKey: string | undefined;
  do {
    const qs = new URLSearchParams({ owner, withMetadata: 'false', pageSize: '100' });
    for (const c of contracts) qs.append('contractAddresses[]', c);
    if (pageKey) qs.set('pageKey', pageKey);
    const res = await fetch(`${NFT_HOST}/getNFTsForOwner?${qs}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`alchemy nft ${res.status}`);
    const json = await res.json() as { ownedNfts?: { contractAddress?: string; tokenId?: string }[]; pageKey?: string };
    for (const n of json.ownedNfts ?? []) {
      const key = n.contractAddress?.toLowerCase();
      if (!key || n.tokenId == null) continue;
      try { out.get(key)?.push(BigInt(n.tokenId)); } catch { /* non-numeric tokenId — skip */ }
    }
    pageKey = json.pageKey;
  } while (pageKey);
  return out;
}

/** Enumerate Robinhood Chain ERC-721 holdings through Blockscout. The app
 * subsequently verifies ownership and reads every position from chain RPC. */
export async function fetchRobinhoodOwnedNftTokenIds(owner: string, contracts: string[]): Promise<Map<string, bigint[]>> {
  const out = new Map<string, bigint[]>(contracts.map((c) => [c.toLowerCase(), []]));
  let params: Record<string, string> | null = null;
  do {
    const qs = new URLSearchParams({ type: 'ERC-721', ...(params ?? {}) });
    const res = await fetch(`https://robinhoodchain.blockscout.com/api/v2/addresses/${owner}/nft?${qs}`, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Robinhood NFT index ${res.status}`);
    const json = await res.json() as { items?: { id?: string; token?: { address_hash?: string } }[]; next_page_params?: Record<string, string | number> | null };
    for (const item of json.items ?? []) {
      const key = item.token?.address_hash?.toLowerCase();
      if (!key || item.id == null || !out.has(key)) continue;
      try { out.get(key)?.push(BigInt(item.id)); } catch { /* malformed id */ }
    }
    params = json.next_page_params ? Object.fromEntries(Object.entries(json.next_page_params).map(([k, v]) => [k, String(v)])) : null;
  } while (params);
  return out;
}
