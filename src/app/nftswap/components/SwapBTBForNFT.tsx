'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ArrowRightIcon, ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import nftswapabi from '../nftswapabi.json';
import { erc20Abi } from 'viem';

interface SwapBTBForNFTProps {
  btbTokenAddress: string;
  nftSwapAddress: string;
  swapRate: string;
}

export default function SwapBTBForNFT({ btbTokenAddress, nftSwapAddress, swapRate }: SwapBTBForNFTProps) {
  const { address, isConnected } = useWallet();
  const [nftAmount, setNftAmount] = useState<string>('1');
  const [btbAmount, setBtbAmount] = useState<string>('0');
  const [feeAmount, setFeeAmount] = useState<string>('0');
  const [totalAmount, setTotalAmount] = useState<string>('0');
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isSwapping, setIsSwapping] = useState<boolean>(false);
  const [btbBalance, setBtbBalance] = useState<string>('0');
  const [feePercentage, setFeePercentage] = useState<number>(0.01); // Default to 1% but will be updated from contract
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Calculate BTB amount based on NFT amount and swap rate
  useEffect(() => {
    if (nftAmount && swapRate && parseFloat(swapRate) > 0) {
      // Base amount calculation
      const baseAmount = parseFloat(nftAmount) * parseFloat(swapRate);
      setBtbAmount(baseAmount.toFixed(4));
      
      // Fee calculation using the fee percentage from the contract
      const fee = baseAmount * feePercentage;
      setFeeAmount(fee.toFixed(4));
      
      // Total amount with fee
      const total = baseAmount + fee;
      setTotalAmount(total.toFixed(4));
    } else {
      setBtbAmount('0');
      setFeeAmount('0');
      setTotalAmount('0');
    }
  }, [nftAmount, swapRate, feePercentage]);

  // Fetch fee percentage from contract and check allowance and balance
  useEffect(() => {
    const fetchContractData = async () => {
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
          erc20Abi,
          signer
        );

        // Create NFT swap contract instance
        const nftSwapContract = new ethers.Contract(
          nftSwapAddress,
          nftswapabi,
          signer
        );

        // Get fee percentage from contract
        const feePercentageBN = await nftSwapContract.feePercentage();
        // Convert from basis points (e.g., 100 = 1%) to decimal
        const feePercentageValue = feePercentageBN.toNumber() / 10000;
        setFeePercentage(feePercentageValue);

        // Check balance
        const balance = await btbContract.balanceOf(address);
        setBtbBalance(ethers.utils.formatEther(balance));

        // Check allowance
        const allowance = await btbContract.allowance(address, nftSwapAddress);
        const requiredAmount = ethers.utils.parseEther(totalAmount || '0');
        
        // Check if allowance is sufficient for the current transaction
        if (allowance.gte(requiredAmount) && !requiredAmount.isZero()) {
          setIsApproved(true);
        } else {
          setIsApproved(false);
        }
      } catch (error) {
        console.error('Error fetching contract data:', error);
      }
    };

    fetchContractData();
  }, [isConnected, address, btbTokenAddress, nftSwapAddress, totalAmount]);

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
        erc20Abi,
        signer
      );

      // Calculate the exact amount needed for approval
      const amountToApprove = ethers.utils.parseEther(totalAmount);
      
      // Only approve the exact amount needed
      const tx = await btbContract.approve(
        nftSwapAddress,
        amountToApprove
      );

      await tx.wait();
      setIsApproved(true);
      setIsApproving(false);
    } catch (error: any) {
      console.error('Error approving tokens:', error);
      setError(error.message || 'Failed to approve tokens');
      console.error('Error approving BTB:', error);
      setError(error.message || 'Error approving BTB');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !address || !nftAmount || parseInt(nftAmount) <= 0) return;
    
    try {
      setIsSwapping(true);
      setError(null);
      setSuccessMessage(null);
      
      if (!window.ethereum) {
        throw new Error('No Ethereum provider found');
      }
      
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const signer = provider.getSigner();
      
      // Create contract instances
      const btbContract = new ethers.Contract(
        btbTokenAddress,
        erc20Abi,
        signer
      );
      
      const nftSwapContract = new ethers.Contract(
        nftSwapAddress,
        nftswapabi,
        signer
      );
      
      // Check allowance
      const allowance = await btbContract.allowance(address, nftSwapAddress);
      const btbAmountWei = ethers.utils.parseEther(btbAmount);
      
      // If allowance is insufficient, request approval
      if (allowance.lt(btbAmountWei)) {
        const approveTx = await btbContract.approve(nftSwapAddress, ethers.constants.MaxUint256);
        await approveTx.wait();
      }
      
      // Execute swap - pass the number of NFTs to buy
      const tx = await nftSwapContract.swapBTBForNFT(parseInt(nftAmount));
      const receipt = await tx.wait();
      
      // Get the NFT IDs from the event
      const event = receipt.events?.find((e: ethers.Event) => e.event === 'SwapBTBForNFT');
      const nftIds = event?.args?.nftIds || [];
      
      setSuccessMessage(`Successfully swapped ${btbAmount} BTB for ${nftIds.length} NFTs!`);
      
      // Refresh balances
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
            erc20Abi,
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
    } catch (error: any) {
      console.error('Error swapping BTB for NFT:', error);
      setError(error.message || 'An error occurred during the swap');
    } finally {
      setIsSwapping(false);
    }
  };

  const handleNftAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow positive integers for NFT amount
    if (value === '' || /^\d+$/.test(value)) {
      setNftAmount(value === '' ? '1' : value);
    }
  };

  const handleMaxClick = () => {
    // Calculate maximum number of NFTs user can buy with their BTB balance
    if (parseFloat(swapRate) > 0) {
      const maxNfts = Math.floor(parseFloat(btbBalance) / parseFloat(swapRate));
      setNftAmount(maxNfts.toString());
    }
  };

  const formatBTB = (amount: string) => {
    return parseFloat(amount).toFixed(4);
  };

  const estimatedNftCount = parseFloat(nftAmount);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Amount Input */}
      <div className="space-y-1 sm:space-y-2">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          Number of NFTs to Buy
        </label>
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Input
              type="text"
              value={nftAmount}
              onChange={handleNftAmountChange}
              className="border-gray-300 dark:border-gray-700 dark:bg-gray-800 pr-12 h-8 sm:h-10 text-sm"
              placeholder="Enter NFT amount"
              disabled={isSwapping}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">NFTs</span>
            </div>
          </div>
          <Button
            onClick={handleMaxClick}
            variant="outline"
            className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 h-8 sm:h-10 px-2 text-xs sm:text-sm"
            disabled={isSwapping || !btbBalance || parseFloat(btbBalance) === 0 || !swapRate || parseFloat(swapRate) === 0}
          >
            MAX
          </Button>
        </div>
        {Math.floor(parseFloat(btbBalance) / parseFloat(swapRate)) !== null && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Max NFTs: {Math.floor(parseFloat(btbBalance) / parseFloat(swapRate))}
          </p>
        )}
      </div>

      <div className="flex justify-center my-4">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
          <ArrowRightIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="space-y-1 sm:space-y-2">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
          Total BTB Required (including fee)
        </label>
        <Input
          type="text"
          value={totalAmount}
          readOnly
          className="border-gray-300 dark:border-gray-700 dark:bg-gray-800 h-8 sm:h-10 text-sm"
        />
        <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">Rate: 1 NFT = {parseFloat(swapRate).toFixed(3)} BTB + {(feePercentage * 100).toFixed(2)}% fee</p>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-700 space-y-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Transaction Details</h3>
        <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Swap Rate</span>
          <span className="text-sm font-medium">{parseFloat(swapRate).toFixed(3)} BTB per NFT</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Fee ({(feePercentage * 100).toFixed(2)}%)</span>
          <span className="text-sm font-medium">{feeAmount} BTB</span>
        </div>
        <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Total You Pay</span>
          <span className="text-sm font-medium font-bold">{totalAmount} BTB</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">You Receive</span>
          <span className="text-sm font-medium">{nftAmount} NFT{parseInt(nftAmount) !== 1 ? 's' : ''}</span>
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
            disabled={!isConnected || !nftAmount || isSwapping || parseInt(nftAmount) <= 0 || parseFloat(totalAmount) > parseFloat(btbBalance)}
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
