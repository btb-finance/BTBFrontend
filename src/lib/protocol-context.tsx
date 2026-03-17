'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import { CONTRACTS, ERC20_ABI, BTBB_ABI, BEAR_NFT_ABI, BEAR_STAKING_ABI } from '@/lib/contracts'

interface ProtocolData {
  // Global
  btbSupply?: bigint
  btbbStats?: [bigint, bigint]           // [btbBalance, btbbSupply]
  stakingStats?: [bigint, bigint, bigint, bigint, bigint] // [totalStaked, totalRewardsDistributed, pendingToCollect, rewardsLast24h, estimatedAPR]
  nftTotalMinted?: bigint
  nftRemaining?: bigint
  nftPrice?: bigint
  nftTotalStaked?: bigint

  // User (undefined when not connected)
  btbBalance?: bigint
  btbbBalance?: bigint
  btbAllowanceForBtbb?: bigint
  nftBalance?: bigint
  nftStakedCount?: bigint
  nftApprovedForStaking?: boolean
  pendingRewards?: [bigint, bigint, bigint] // [gross, net, taxAmount]

  // Actions
  refetch: () => void
}

const ProtocolContext = createContext<ProtocolData>({
  refetch: () => {},
})

export function useProtocol() {
  return useContext(ProtocolContext)
}

export function ProtocolProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()

  const { data, refetch } = useReadContracts({
    contracts: [
      // Global data (0-5)
      { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'totalSupply' } as any,
      { address: CONTRACTS.BTBB, abi: BTBB_ABI, functionName: 'getStats' } as any,
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'getStats' } as any,
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'totalMinted' } as any,
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'remainingSupply' } as any,
      { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'pricePerNFT' } as any,
      { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'totalStaked' } as any,
      // User data (7-13)
      ...(address ? [
        { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
        { address: CONTRACTS.BTBB, abi: ERC20_ABI, functionName: 'balanceOf', args: [address] } as any,
        { address: CONTRACTS.BTB, abi: ERC20_ABI, functionName: 'allowance', args: [address, CONTRACTS.BTBB] } as any,
        { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'balanceOf', args: [address] } as any,
        { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'stakedCountOf', args: [address] } as any,
        { address: CONTRACTS.BEAR_NFT, abi: BEAR_NFT_ABI, functionName: 'isApprovedForAll', args: [address, CONTRACTS.BEAR_STAKING] } as any,
        { address: CONTRACTS.BEAR_STAKING, abi: BEAR_STAKING_ABI, functionName: 'pendingRewardsDetailed', args: [address] } as any,
      ] : []),
    ],
    query: {
      refetchInterval: 15_000, // refresh every 15s
    },
  })

  const value: ProtocolData = {
    btbSupply: data?.[0]?.result as bigint | undefined,
    btbbStats: data?.[1]?.result as [bigint, bigint] | undefined,
    stakingStats: data?.[2]?.result as [bigint, bigint, bigint, bigint, bigint] | undefined,
    nftTotalMinted: data?.[3]?.result as bigint | undefined,
    nftRemaining: data?.[4]?.result as bigint | undefined,
    nftPrice: data?.[5]?.result as bigint | undefined,
    nftTotalStaked: data?.[6]?.result as bigint | undefined,

    btbBalance: data?.[7]?.result as bigint | undefined,
    btbbBalance: data?.[8]?.result as bigint | undefined,
    btbAllowanceForBtbb: data?.[9]?.result as bigint | undefined,
    nftBalance: data?.[10]?.result as bigint | undefined,
    nftStakedCount: data?.[11]?.result as bigint | undefined,
    nftApprovedForStaking: data?.[12]?.result as boolean | undefined,
    pendingRewards: data?.[13]?.result as [bigint, bigint, bigint] | undefined,

    refetch,
  }

  return (
    <ProtocolContext.Provider value={value}>
      {children}
    </ProtocolContext.Provider>
  )
}
