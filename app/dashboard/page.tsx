'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { getTokenSaleContract, getBTBTokenContract, formatEther } from '../utils/web3';
import { ethers } from 'ethers';

interface VestingSchedule {
  totalAmount: bigint;
  startTime: bigint;
  endTime: bigint;
  lastClaimTime: bigint;
  claimedAmount: bigint;
  isActive: boolean;
}

export default function Dashboard() {
  const { account, signer, connect, connecting } = useWeb3();
  const [vestingNFTs, setVestingNFTs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchVestingNFTs = async () => {
    if (!signer || !account) return;

    try {
      setLoading(true);
      setError('');
      const contract = await getTokenSaleContract(signer);
      const vestingNFTAddress = await contract.vestingNFT();
      const vestingNFTContract = new ethers.Contract(
        vestingNFTAddress,
        ['function balanceOf(address) view returns (uint256)', 'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)', 'function getVestingSchedule(uint256) view returns (tuple(uint256 totalAmount, uint256 startTime, uint256 endTime, uint256 lastClaimTime, uint256 claimedAmount, bool isActive))'],
        signer
      );

      const balance = await vestingNFTContract.balanceOf(account);
      const nfts = [];

      for (let i = 0; i < balance; i++) {
        const tokenId = await vestingNFTContract.tokenOfOwnerByIndex(account, i);
        const schedule = await vestingNFTContract.getVestingSchedule(tokenId);
        nfts.push({ tokenId, schedule });
      }

      setVestingNFTs(nfts);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const claimVestedTokens = async (tokenId: number) => {
    if (!signer) return;

    try {
      setLoading(true);
      setError('');
      const contract = await getTokenSaleContract(signer);
      const tx = await contract.claimVestedTokens(tokenId);
      await tx.wait();
      await fetchVestingNFTs();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (account) {
      fetchVestingNFTs();
    }
  }, [account]);

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <button
            onClick={connect}
            disabled={connecting}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">Vesting Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {vestingNFTs.map(({ tokenId, schedule }) => (
            <div key={tokenId.toString()} className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold mb-4">NFT #{tokenId.toString()}</h3>
              <div className="space-y-2 text-sm">
                <p>Total Amount: {formatEther(schedule.totalAmount)} BTB</p>
                <p>Claimed: {formatEther(schedule.claimedAmount)} BTB</p>
                <p>Start: {new Date(Number(schedule.startTime) * 1000).toLocaleDateString()}</p>
                <p>End: {new Date(Number(schedule.endTime) * 1000).toLocaleDateString()}</p>
                <p>Status: {schedule.isActive ? 'Active' : 'Inactive'}</p>
              </div>
              
              {schedule.isActive && (
                <button
                  onClick={() => claimVestedTokens(tokenId)}
                  disabled={loading}
                  className="mt-4 w-full bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Claim Vested Tokens
                </button>
              )}
            </div>
          ))}
        </div>

        {vestingNFTs.length === 0 && !loading && (
          <p className="text-center text-gray-600">No vesting NFTs found.</p>
        )}

        {error && (
          <div className="mt-4 text-red-600 text-sm text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
