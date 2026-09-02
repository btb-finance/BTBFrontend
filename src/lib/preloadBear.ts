'use client';
import { useReadContracts } from 'wagmi';
import { CONTRACTS } from './wagmi';
import { BEAR_NFT_ABI, BEAR_STAKING_ABI } from '../contracts/abis';
import { useSnapshot } from './convexCache';

/** Snapshot key — must match convex/globalRefresh.ts. */
const SNAPSHOT_KEY = 'bear-stats';

type BearStatsWire = {
  version?: number;
  totalMinted: string;
  pricePerNFT: string;
  remainingSupply: string;
  stats: {
    totalStaked: string;
    totalRewardsDistributed: string;
    pendingToCollect: string;
    rewardsLast24h: string;
    estimatedApr: string;
  };
};

export type BearStats = {
  totalMinted: bigint;
  pricePerNFT: bigint;
  remainingSupply: bigint;
  totalStaked: bigint;
  totalRewardsDistributed: bigint;
  pendingToCollect: bigint;
  rewardsLast24h: bigint;
  estimatedApr: bigint;
};

/**
 * Global BearNFT/BearStaking numbers — mint progress and pool stats.
 *
 * These are the same for every visitor, so they come from a Convex snapshot
 * refreshed every 30 minutes (convex/globalRefresh.ts) instead of an RPC batch
 * per session. Returns null until the first snapshot lands.
 */
export function useBearStats(): BearStats | null {
  const { data } = useSnapshot<BearStatsWire>(SNAPSHOT_KEY);
  if (!data?.stats) return null;
  return {
    totalMinted: BigInt(data.totalMinted),
    pricePerNFT: BigInt(data.pricePerNFT),
    remainingSupply: BigInt(data.remainingSupply),
    totalStaked: BigInt(data.stats.totalStaked),
    totalRewardsDistributed: BigInt(data.stats.totalRewardsDistributed),
    pendingToCollect: BigInt(data.stats.pendingToCollect),
    rewardsLast24h: BigInt(data.stats.rewardsLast24h),
    estimatedApr: BigInt(data.stats.estimatedApr),
  };
}

/**
 * Warms the wallet-specific BearNFT/BearStaking reads so the NFT/Agent tab
 * renders instantly on first navigation.
 *
 * Two things this deliberately does not do any more. It no longer polls: the
 * shell ran these every 15-20 seconds on every screen, and warming only needs
 * one pass — NFTScreen keeps its own interval while it is actually open. And
 * it no longer runs for a disconnected visitor, which used to read the zero
 * address forever for nothing.
 *
 * The call shapes still mirror NFTScreen's batches exactly, including the
 * global entries: wagmi derives its cache key from the whole contracts array,
 * so trimming them here would change the key and warm nothing.
 */
export function usePreloadBear(address?: string) {
  const addr = address as `0x${string}` | undefined;
  const enabled = !!addr;

  // Mint stats — same call shape as MintTab in NFTScreen.
  useReadContracts({
    contracts: [
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'totalMinted'     },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'pricePerNFT'     },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'remainingSupply' },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'balanceOf', args: [addr!] },
    ] as const,
    query: { enabled },
  });

  // Stake pool + user info — same call shape as StakeTab in NFTScreen.
  useReadContracts({
    contracts: [
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getStats'         },
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getUserInfo',       args: [addr!] },
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'pendingRewardsNet', args: [addr!] },
      { address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'balanceOf',         args: [addr!] },
      { address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'isApprovedForAll',  args: [addr!, CONTRACTS.BEAR_STAKING] },
    ] as const,
    query: { enabled },
  });
}
