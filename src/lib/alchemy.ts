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

// ChainId → Alchemy network slug
export const CHAIN_TO_ALCHEMY: Record<number, string> = Object.fromEntries(
  Object.entries(ALCHEMY_CHAIN_ID).map(([k, v]) => [v, k])
);

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

// ─── NFTs ─────────────────────────────────────────────────────────────────────

// Networks that support NFTs in Alchemy
const NFT_NETWORKS = [
  'eth-mainnet', 'base-mainnet', 'matic-mainnet', 'arb-mainnet',
  'opt-mainnet', 'blast-mainnet', 'zksync-mainnet', 'scroll-mainnet',
  'linea-mainnet',
];

export interface AlchemyNFT {
  network: string;
  chainId: number;
  walletAddress: string;
  contractAddress: string;
  tokenId: string;
  tokenType: string;           // 'ERC721' | 'ERC1155'
  name: string;
  description: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  collectionName?: string;
  collectionSlug?: string;
  floorPrice?: number;
  attributes: { trait_type: string; value: string }[];
  acquiredAt?: string;         // block timestamp ISO
}

export async function fetchAlchemyNFTs(
  walletAddress: string,
  networks: string[] = NFT_NETWORKS,
  pageSize = 100,
): Promise<AlchemyNFT[]> {
  const res = await fetch(`${BASE}/assets/nfts/by-address`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      addresses: [{
        address: walletAddress,
        networks,
        excludeFilters: ['SPAM'],
      }],
      withMetadata: true,
      pageSize,
      orderBy: 'transferTime',
      sortOrder: 'desc',
    }),
  });
  if (!res.ok) throw new Error(`Alchemy NFTs ${res.status}`);
  const json = await res.json();

  const nfts: AlchemyNFT[] = [];
  for (const n of (json.data?.ownedNfts ?? [])) {
    nfts.push({
      network:         n.network,
      chainId:         ALCHEMY_CHAIN_ID[n.network] ?? 1,
      walletAddress:   n.address,
      contractAddress: n.contract?.address ?? '',
      tokenId:         n.tokenId ?? '',
      tokenType:       n.tokenType ?? 'ERC721',
      name:            n.name ?? n.contract?.name ?? 'NFT',
      description:     n.description ?? '',
      imageUrl:        n.image?.cachedUrl ?? n.image?.originalUrl ?? n.raw?.metadata?.image,
      thumbnailUrl:    n.image?.thumbnailUrl,
      collectionName:  n.collection?.name ?? n.contract?.openseaMetadata?.collectionName ?? n.contract?.name,
      collectionSlug:  n.collection?.slug,
      floorPrice:      n.contract?.openseaMetadata?.floorPrice,
      attributes:      n.raw?.metadata?.attributes ?? [],
      acquiredAt:      n.acquiredAt?.blockTimestamp,
    });
  }
  return nfts;
}
