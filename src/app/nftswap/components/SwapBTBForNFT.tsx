'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import nftswapabi from '../nftswapabi.json';
import { erc20ABI } from 'wagmi';

interface SwapBTBForNFTProps {
  btbTokenAddress: string;
  nftSwapAddress: string;
  swapRate: string;
}

export default function SwapBTBForNFT({ btbTokenAddress, nftSwapAddress, swapRate }: SwapBTBForNFTProps) {
  const { address, isConnected } = useWallet();
  const [btbAmount, setBtbAmount] = useState<string>('');
  const [nftAmount, setNftAmount] = useState<string>('0');
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [btbBalance, setBtbBalance] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate NFT amount based on BTB amount
  useEffect(() => {
    if (btbAmount && swapRate && parseFloat(swapRate) > 0) {
      const calculatedNFTs = parseFloat(btbAmount) / parseFloat(swapRate);
      setNftAmount(calculatedNFTs.toFixed(2));
    } else {
      setNftAmount('0');
    }
  }, [btbAmount, swapRate]);

  // Check allowance and balance
  useEffect(() => {
    const checkAllowanceAndBalance = async () => {
      if (!isConnected || !address) return;

      try {
        if (!window.ethereum) {
          console.error('No ethereum provider found');
          return;
        }
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        
        // Create BTB token contract instance
        const btbContract = new ethers.Contract(
          btbTokenAddress,
          erc20ABI,
          signer
        );

        // Check balance
        const balance = await btbContract.balanceOf(address);
        setBtbBalance(ethers.utils.formatEther(balance));

        // Check allowance
        const allowance = await btbContract.allowance(address, nftSwapAddress);
        
        // If allowance is greater than 0, set isApproved to true
        if (allowance.gt(0)) {
          setIsApproved(true);
        } else {
          setIsApproved(false);
        }
      } catch (error) {
        console.error('Error checking allowance and balance:', error);
      }
    };

    checkAllowanceAndBalance();
  }, [isConnected, address, btbTokenAddress, nftSwapAddress]);

  const handleApprove = async () => {
    if (!isConnected || !address) return;

    try {
      setIsApproving(true);
      setError(null);
      
      if (!window.ethereum) {
        console.error('No ethereum provider found');
        setIsApproving(false);
        setError('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
        return;
      }
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      // Create BTB token contract instance
      const btbContract = new ethers.Contract(
        btbTokenAddress,
        erc20ABI,
        signer
      );

      // Approve max amount
      const tx = await btbContract.approve(
        nftSwapAddress,
        ethers.constants.MaxUint256
      );

      // Wait for transaction to be mined
      await tx.wait();
      
      setIsApproved(true);
      setSuccessMessage('Approval successful!');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (error: any) {
      console.error('Error approving BTB:', error);
      setError(error.message || 'Error approving BTB');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async (e?: React.MouseEvent) => {
    if (!isConnected || !address || !btbAmount) return;

    try {
      setIsSwapping(true);
      setError(null);
      
      if (!window.ethereum) {
        console.error('No ethereum provider found');
        setIsApproving(false);
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

      // Convert BTB amount to wei
      const btbAmountWei = ethers.utils.parseEther(btbAmount);

      // Swap BTB for NFT
      const tx = await nftSwapContract.swapBTBForNFT(btbAmountWei);

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Get the NFT IDs from the event
      const event = receipt.events?.find((e: ethers.Event) => e.event === 'SwapBTBForNFT');
      const nftIds = event?.args?.nftIds || [];
      
      setSuccessMessage(`Successfully swapped ${btbAmount} BTB for ${nftIds.length} NFTs!`);
      
      // Reset form
      setBtbAmount('');
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (error: any) {
      console.error('Error swapping BTB for NFT:', error);
      setError(error.message || 'Error swapping BTB for NFT');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBtbAmount(e.target.value);
  };

  const handleMaxClick = () => {
    setBtbAmount(btbBalance);
  };

  const formatBTB = (amount: string) => {
    return parseFloat(amount).toFixed(4);
  };

  const estimatedNftCount = parseFloat(nftAmount);

  return (
    <div className="space-y-6">
      {/* Amount Input */}
      <div className="space-y-2">
        <label htmlFor="btbAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          BTB Amount
        </label>
        <div className="relative rounded-md shadow-sm">
          <Input
            id="btbAmount"
            type="number"
            placeholder="Enter BTB amount"
            value={btbAmount}
            onChange={handleAmountChange}
            className="pr-20 border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={handleMaxClick}
              className="h-full px-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:text-blue-700 dark:hover:text-blue-300"
            >
              MAX
            </Button>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Balance: {formatBTB(btbBalance)} BTB</span>
          <span>≈ {estimatedNftCount} NFT{estimatedNftCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex justify-center my-4">
        <div className="p-2 bg-btb-primary/20 rounded-full">
          <ArrowRightIcon className="h-5 w-5 text-btb-primary" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          NFT Amount (Estimated)
        </label>
        <Input
          type="text"
          value={nftAmount}
          readOnly
          className="bg-gray-900/50 border-gray-700/50 text-white font-medium"
        />
        <p className="text-sm text-white font-medium">Rate: 1 NFT = {swapRate} BTB</p>
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

      <div className="space-y-3">
        {!isApproved ? (
          <Button
            onClick={handleApprove}
            className="w-full"
            isLoading={isApproving}
            disabled={isApproving}
          >
            Approve BTB
          </Button>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={!isConnected || !btbAmount || isSwapping || parseFloat(btbAmount) <= 0 || parseFloat(btbAmount) > parseFloat(btbBalance)}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white py-2 px-4 rounded-md font-medium transition-colors"
          >
            {isSwapping ? (
              <div className="flex items-center justify-center">
                <div className="h-5 w-5 rounded-full border-2 border-t-transparent border-white animate-spin mr-2"></div>
                <span>Processing...</span>
              </div>
            ) : (
              'Swap BTB for NFT'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
