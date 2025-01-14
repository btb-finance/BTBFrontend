'use client';

import { useState } from 'react';
import {
  useAccount,
  useWriteContract,
  useSimulateContract,
  useReadContract,
  type Address,
} from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { formatEther, parseEther } from 'viem';
import { mainnet } from 'wagmi/chains';

// Replace with actual contract addresses
const BTB_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_BTB_TOKEN_ADDRESS as Address;
const GOVERNANCE_ADDRESS = process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS as Address;

// ABI snippets for the contracts
const BTB_TOKEN_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const GOVERNANCE_ABI = [
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'bool' },
    ],
    name: 'castVote',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'getVotes',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const connect = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  const { data: btbBalance } = useReadContract({
    address: BTB_TOKEN_ADDRESS,
    abi: BTB_TOKEN_ABI,
    functionName: 'balanceOf',
    args: [address!],
    chainId: mainnet.id,
    enabled: !!address,
  });

  const { data: votingPower } = useReadContract({
    address: GOVERNANCE_ADDRESS,
    abi: GOVERNANCE_ABI,
    functionName: 'getVotes',
    args: [address!],
    chainId: mainnet.id,
    enabled: !!address,
  });

  return {
    address,
    isConnected,
    connect,
    btbBalance: btbBalance ? formatEther(btbBalance) : '0',
    votingPower: votingPower ? formatEther(votingPower) : '0',
  };
}

export function useStaking() {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  // Prepare approval transaction
  const { data: approveSimulation } = useSimulateContract({
    address: BTB_TOKEN_ADDRESS,
    abi: BTB_TOKEN_ABI,
    functionName: 'approve',
    args: [GOVERNANCE_ADDRESS, parseEther(amount || '0')],
    chainId: mainnet.id,
    enabled: !!amount && !!address,
  });

  // Prepare stake transaction
  const { data: stakeSimulation } = useSimulateContract({
    address: GOVERNANCE_ADDRESS,
    abi: GOVERNANCE_ABI,
    functionName: 'stake',
    args: [parseEther(amount || '0')],
    chainId: mainnet.id,
    enabled: !!amount && !!address,
  });

  const { writeContract: approve, isLoading: isApproveLoading } = useWriteContract();
  const { writeContract: stake, isLoading: isStakeLoading } = useWriteContract();

  const handleStake = async () => {
    if (!amount || !address) return;

    try {
      setIsApproving(true);
      if (approveSimulation?.request) {
        await approve(approveSimulation.request);
      }
      if (stakeSimulation?.request) {
        await stake(stakeSimulation.request);
      }
    } catch (error) {
      console.error('Staking failed:', error);
    } finally {
      setIsApproving(false);
    }
  };

  return {
    amount,
    setAmount,
    handleStake,
    isLoading: isApproveLoading || isStakeLoading || isApproving,
  };
}

export function useVoting() {
  const { address } = useAccount();
  const { data: simulation, error } = useSimulateContract({
    address: GOVERNANCE_ADDRESS,
    abi: GOVERNANCE_ABI,
    functionName: 'castVote',
    chainId: mainnet.id,
    enabled: !!address,
  });

  const { writeContract } = useWriteContract();

  return {
    castVote: async (proposalId: string, support: boolean) => {
      if (simulation?.request) {
        return writeContract({
          ...simulation.request,
          args: [proposalId, support],
        });
      }
      throw error || new Error('Failed to simulate contract');
    },
  };
}
