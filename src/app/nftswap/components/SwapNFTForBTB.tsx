'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowLeftIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import nftswapabi from '../nftswapabi.json';

interface SwapNFTForBTBProps {
  bearNftAddress: string;
  nftSwapAddress: string;
  swapRate: string;
}

// ERC721 ABI for approval and token functions
const erc721ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  "function setApprovalForAll(address operator, bool approved)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

export default function SwapNFTForBTB({ bearNftAddress, nftSwapAddress, swapRate }: SwapNFTForBTBProps) {
  const { address, isConnected } = useWallet();
  const [nftIds, setNftIds] = useState<number[]>([]);
  const [selectedNftIds, setSelectedNftIds] = useState<number[]>([]);
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [baseBtbAmount, setBaseBtbAmount] = useState<string>('0');
  const [feeAmount, setFeeAmount] = useState<string>('0');
  const [estimatedBtb, setEstimatedBtb] = useState<string>('0');
  const [feePercentage, setFeePercentage] = useState<number>(0.01); // Default to 1% but will be updated from contract
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch user's NFTs and contract data
  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!isConnected || !address) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        if (!window.ethereum) {
          console.error('No ethereum provider found');
          setIsLoading(false);
          return;
        }
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const bearNftContract = new ethers.Contract(
          bearNftAddress,
          erc721ABI,
          provider
        );
        
        // Create NFT swap contract instance to get fee percentage
        const nftSwapContract = new ethers.Contract(
          nftSwapAddress,
          nftswapabi,
          provider
        );

        // Get fee percentage from contract
        const feePercentageBN = await nftSwapContract.feePercentage();
        // Convert from basis points (e.g., 100 = 1%) to decimal
        const feePercentageValue = feePercentageBN.toNumber() / 10000;
        setFeePercentage(feePercentageValue);

        // Get user's NFT balance
        const balance = await bearNftContract.balanceOf(address);
        const balanceNumber = balance.toNumber();

        // Check if NFTs are approved for the swap contract
        const approved = await bearNftContract.isApprovedForAll(address, nftSwapAddress);
        setIsApproved(approved);

        // Get NFT IDs progressively
        if (balanceNumber > 0) {
          // Set loading to false once we have the balance
          setIsLoading(false);
          
          // Load NFTs in batches to improve UX
          const batchSize = 5;
          for (let i = 0; i < balanceNumber; i += batchSize) {
            const batchPromises = [];
            const end = Math.min(i + batchSize, balanceNumber);
            
            for (let j = i; j < end; j++) {
              batchPromises.push(
                bearNftContract.tokenOfOwnerByIndex(address, j)
                  .then((tokenId: ethers.BigNumber) => tokenId.toNumber())
              );
            }
            
            const batchResults = await Promise.all(batchPromises);
            // Use a Set to ensure uniqueness of NFT IDs
            setNftIds(prev => {
              // Create a Set from the existing IDs
              const uniqueIds = new Set([...prev]);
              // Add new IDs to the Set
              batchResults.forEach(id => uniqueIds.add(id));
              // Convert back to array
              return Array.from(uniqueIds);
            });
            
            // Small delay to allow UI to update between batches
            if (i + batchSize < balanceNumber) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching user NFTs:', error);
        setIsLoading(false);
      }
    };

    // Reset NFT IDs when component mounts or dependencies change
    setNftIds([]);
    fetchUserNFTs();
  }, [isConnected, address, bearNftAddress, nftSwapAddress]);

  // Calculate estimated BTB based on selected NFTs
  useEffect(() => {
    if (selectedNftIds.length > 0 && swapRate) {
      // Base amount calculation
      const baseAmount = selectedNftIds.length * parseFloat(swapRate);
      setBaseBtbAmount(baseAmount.toFixed(4));
      
      // Fee calculation using the fee percentage from the contract
      const fee = baseAmount * feePercentage;
      setFeeAmount(fee.toFixed(4));
      
      // Amount user receives (base - fee)
      const amountToUser = baseAmount - fee;
      setEstimatedBtb(amountToUser.toFixed(4));
    } else {
      setBaseBtbAmount('0');
      setFeeAmount('0');
      setEstimatedBtb('0');
    }
  }, [selectedNftIds, swapRate, feePercentage]);

  const handleApprove = async () => {
    if (!isConnected || !address) return;

    try {
      setIsApproving(true);
      setError(null);
      
      if (!window.ethereum) {
        console.error('No ethereum provider found');
        setIsSwapping(false);
        setError('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
        return;
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      // Create Bear NFT contract instance
      const bearNftContract = new ethers.Contract(
        bearNftAddress,
        erc721ABI,
        signer
      );

      // Approve all NFTs for the swap contract
      const tx = await bearNftContract.setApprovalForAll(nftSwapAddress, true);

      // Wait for transaction to be mined
      await tx.wait();
      
      setIsApproved(true);
      setSuccessMessage('Approval successful!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error approving NFTs:', error);
      setError(error.message || 'Error approving NFTs');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !address || selectedNftIds.length === 0) return;

    try {
      setIsSwapping(true);
      setError(null);
      
      if (!window.ethereum) {
        console.error('No ethereum provider found');
        setIsSwapping(false);
        setError('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
        return;
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      // Create NFT Swap contract instance
      const nftSwapContract = new ethers.Contract(
        nftSwapAddress,
        nftswapabi,
        signer
      );

      // Swap NFTs for BTB
      const tx = await nftSwapContract.swapNFTForBTB(selectedNftIds);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Get the BTB amount from the event
      const event = receipt.events?.find((e: ethers.Event) => e.event === 'SwapNFTForBTB');
      const btbAmount = event?.args?.btbAmount ? ethers.utils.formatEther(event.args.btbAmount) : '0';
      
      setSuccessMessage(`Successfully swapped ${selectedNftIds.length} NFTs for ${btbAmount} BTB!`);
      
      // Reset selected NFTs
      setSelectedNftIds([]);
      
      // Refetch user's NFTs
      const updatedBalance = await new ethers.Contract(
        bearNftAddress,
        erc721ABI,
        provider
      ).balanceOf(address);
      
      const updatedBalanceNumber = updatedBalance.toNumber();
      const updatedTokenIds = [];
      
      for (let i = 0; i < updatedBalanceNumber; i++) {
        const tokenId = await new ethers.Contract(
          bearNftAddress,
          erc721ABI,
          provider
        ).tokenOfOwnerByIndex(address, i);
        updatedTokenIds.push(tokenId.toNumber());
      }
      
      setNftIds(updatedTokenIds);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (error: any) {
      console.error('Error swapping NFTs for BTB:', error);
      setError(error.message || 'Error swapping NFTs for BTB');
    } finally {
      setIsSwapping(false);
    }
  };

  const toggleNftSelection = (tokenId: number, e: React.MouseEvent<HTMLDivElement>) => {
    setSelectedNftIds(prev => 
      prev.includes(tokenId)
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const selectAllNfts = () => {
    setSelectedNftIds([...nftIds]);
  };

  const deselectAllNfts = () => {
    setSelectedNftIds([]);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* NFT Selection */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-gray-700 dark:text-gray-300 font-medium">Your Bear NFTs</h3>
          {nftIds.length > 0 && (
            <div className="flex space-x-2">
              <button
                onClick={selectAllNfts}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Select All
              </button>
              <button
                onClick={deselectAllNfts}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>
        
        {isLoading && nftIds.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-10 w-10 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
          </div>
        ) : nftIds.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">You don't have any Bear NFTs in your wallet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 mb-4 max-h-[300px] overflow-y-auto p-1">
            {nftIds.map((tokenId) => (
              <div
                key={tokenId}
                onClick={(e) => toggleNftSelection(tokenId, e)}
                className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${selectedNftIds.includes(tokenId) ? 'border-blue-500 shadow-md' : 'border-gray-200 dark:border-gray-700'}`}
              >
                <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-700 dark:text-gray-300">#{tokenId}</span>
                </div>
                {selectedNftIds.includes(tokenId) && (
                  <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="h-6 w-6 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
              </div>
            )}
          </div>
        )}
      </div>

      {nftIds.length > 0 && (
        <>
          <div className="flex justify-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
              <ArrowLeftIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Transaction Details */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-700 space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Details</h3>
            <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Selected NFTs</span>
              <span className="text-sm font-medium">{selectedNftIds.length}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Swap Rate</span>
              <span className="text-sm font-medium">{parseFloat(swapRate).toFixed(3)} BTB per NFT</span>
            </div>
            <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Fee ({(feePercentage * 100).toFixed(2)}%)</span>
              <span className="text-sm font-medium">{feeAmount} BTB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">You Receive</span>
              <span className="text-sm font-medium font-bold">{estimatedBtb} BTB</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-800 dark:text-red-200">
              <div className="flex">
                <ExclamationCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm text-green-800 dark:text-green-200">
              <div className="flex">
                <CheckCircleIcon className="h-5 w-5 text-green-500 dark:text-green-400 mr-2 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            </div>
          )}

          {/* Swap Button */}
          <div className="flex justify-center">
            {!isApproved ? (
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium transition-colors"
              >
                {isApproving ? (
                  <div className="flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin mr-2"></div>
                    <span>Approving...</span>
                  </div>
                ) : (
                  'Approve NFTs'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleSwap}
                disabled={isSwapping || selectedNftIds.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium transition-colors"
              >
                {isSwapping ? (
                  <div className="flex items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin mr-2"></div>
                    <span>Swapping...</span>
                  </div>
                ) : (
                  `Swap ${selectedNftIds.length} NFT${selectedNftIds.length !== 1 ? 's' : ''} for BTB`
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
