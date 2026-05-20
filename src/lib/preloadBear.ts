'use client';
import { useReadContracts } from 'wagmi';
import { CONTRACTS } from './wagmi';
import { BEAR_NFT_ABI, BEAR_STAKING_ABI } from '../contracts/abis';

const ZERO = '0x0000000000000000000000000000000000000000' as `0x${string}`;

/**
 * Fires the BearNFT + BearStaking reads as soon as the app mounts so the
 * results are in the wagmi/tanstack-query cache by the time the user opens
 * the NFT/Agent tab. Combined with the 60s `staleTime` set in `Providers`,
 * the NFT screen renders instantly on first navigation instead of waiting
 * for public RPCs to respond.
 *
 * We mirror the exact same `useReadContracts` calls the NFTScreen makes so
 * the query keys match — that's what wagmi uses to look the result up.
 */
export function usePreloadBear(address?: string) {
  const addr = (address ?? ZERO) as `0x${string}`;

  // Mint stats — same call shape as MintTab in NFTScreen.
  useReadContracts({
    contracts: [
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'totalMinted'     },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'pricePerNFT'     },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'remainingSupply' },
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'balanceOf', args: [addr] },
    ] as const,
    query: { refetchInterval: 20_000 },
  });

  // Stake pool + user info — same call shape as StakeTab in NFTScreen.
  useReadContracts({
    contracts: [
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getStats'         },
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getUserInfo',       args: [addr] },
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'pendingRewardsNet', args: [addr] },
      { address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'balanceOf',         args: [addr] },
      { address: CONTRACTS.BEAR_NFT,     abi: BEAR_NFT_ABI,     functionName: 'isApprovedForAll',  args: [addr, CONTRACTS.BEAR_STAKING] },
    ] as const,
    query: { refetchInterval: 15_000 },
  });
}
