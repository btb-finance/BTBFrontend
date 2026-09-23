/**
 * Merkl (merkl.xyz): third-party reward campaigns on top of pools. Two uses:
 * the reward APR per pool for Discover, and a wallet's claimable rewards with
 * the Merkle proofs the Distributor needs. Same Distributor address on every
 * chain Merkl serves.
 */
export const MERKL_DISTRIBUTOR = '0x3Ef3D8bA38EBe18DB133cEc108f4D14CE00Dd9Ae' as const;
export const MERKL_CHAINS = new Set([1, 8453, 56, 4663, 5042, 42161, 10]);
const API = 'https://api.merkl.xyz/v4';

export interface MerklPoolReward {
  /** Pool address (V3) or pool id (V4), lowercase. */
  identifier: string;
  chainId: number;
  apr: number;               // reward APR in percent
  dailyRewardsUsd: number;
  rewardSymbols: string[];
  name: string;
  endsAt?: number;           // ms
}

/** Live pool campaigns on one chain, keyed by lowercase identifier. Server-side. */
export async function fetchMerklPoolRewards(chainId: number): Promise<Map<string, MerklPoolReward>> {
  const out = new Map<string, MerklPoolReward>();
  if (!MERKL_CHAINS.has(chainId)) return out;
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${API}/opportunities?chainId=${chainId}&action=POOL&status=LIVE&items=100&page=${page}`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) break;
    const rows = await res.json() as {
      identifier: string; chainId: number; apr: number; dailyRewards: number; name: string; latestCampaignEnd?: number;
      rewardsRecord?: { breakdowns?: { token?: { symbol?: string } }[] };
    }[];
    for (const r of rows) {
      if (!(r.apr > 0)) continue;
      const id = r.identifier.toLowerCase();
      const prev = out.get(id);
      const symbols = [...new Set((r.rewardsRecord?.breakdowns ?? []).map((b) => b.token?.symbol).filter((s): s is string => !!s))];
      // Several opportunities can point at one pool (per reward token); keep the sum.
      out.set(id, {
        identifier: id, chainId, name: r.name,
        apr: (prev?.apr ?? 0) + r.apr,
        dailyRewardsUsd: (prev?.dailyRewardsUsd ?? 0) + (r.dailyRewards ?? 0),
        rewardSymbols: [...new Set([...(prev?.rewardSymbols ?? []), ...symbols])],
        endsAt: r.latestCampaignEnd ? r.latestCampaignEnd * 1000 : prev?.endsAt,
      });
    }
    if (rows.length < 100) break;
  }
  return out;
}

export interface MerklClaim {
  chainId: number;
  token: `0x${string}`;
  symbol: string;
  decimals: number;
  /** Cumulative amount the Merkle root covers (what claim() takes). */
  amount: bigint;
  /** Already claimed part of `amount`. */
  claimed: bigint;
  /** Claimable now = amount - claimed. */
  claimable: bigint;
  /** Accrued but not yet in a root. */
  pending: bigint;
  proofs: `0x${string}`[];
  usd?: number;
}

/** Everything a wallet can claim on one chain, with proofs. Works in the browser and on the server. */
export async function fetchMerklClaims(address: string, chainId: number): Promise<MerklClaim[]> {
  if (!MERKL_CHAINS.has(chainId)) return [];
  // Through our proxy in the browser (Merkl's CORS skips some origins), direct on the server.
  const url = typeof window === 'undefined' ? `${API}/users/${address}/rewards?chainId=${chainId}` : `/api/merkl/rewards?address=${address}&chainId=${chainId}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const chains = await res.json() as { chain: { id: number }; rewards: { token: { address: string; symbol: string; decimals: number; price?: number }; amount: string; claimed: string; pending: string; proofs: string[] }[] }[];
  const out: MerklClaim[] = [];
  for (const c of chains) {
    for (const r of c.rewards ?? []) {
      const amount = BigInt(r.amount ?? '0'), claimed = BigInt(r.claimed ?? '0');
      const claimable = amount > claimed ? amount - claimed : 0n;
      if (claimable === 0n && BigInt(r.pending ?? '0') === 0n) continue;
      out.push({
        chainId: c.chain.id, token: r.token.address as `0x${string}`, symbol: r.token.symbol, decimals: r.token.decimals,
        amount, claimed, claimable, pending: BigInt(r.pending ?? '0'), proofs: r.proofs as `0x${string}`[],
        usd: r.token.price != null ? Number(claimable) / 10 ** r.token.decimals * r.token.price : undefined,
      });
    }
  }
  return out;
}

export const MERKL_DISTRIBUTOR_ABI = [
  { name: 'claim', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'users', type: 'address[]' }, { name: 'tokens', type: 'address[]' }, { name: 'amounts', type: 'uint256[]' }, { name: 'proofs', type: 'bytes32[][]' }], outputs: [] },
] as const;
