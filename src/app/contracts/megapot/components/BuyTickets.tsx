'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TicketIcon, 
  ArrowPathIcon, 
  CheckIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { ethers } from 'ethers';
import megapotABI from '../megapotabi.json';
import usdcABI from './usdcABI.json';

interface BuyTicketsProps {
  contractAddress: string;
  usdcAddress: string;
  referralAddress: string;
  ticketPrice: number;
  isConnected: boolean;
  userAddress: string | null;
  connectWallet: () => Promise<void>;
}

export default function BuyTickets({ 
  contractAddress, 
  usdcAddress, 
  referralAddress,
  ticketPrice, 
  isConnected,
  userAddress,
  connectWallet
}: BuyTicketsProps) {
  const [ticketCount, setTicketCount] = useState(1);
  const [totalPrice, setTotalPrice] = useState(ticketPrice);
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  
  // Calculate total price and refund when ticket count changes
  useEffect(() => {
    setTotalPrice(ticketCount * ticketPrice);
    setRefundAmount(ticketCount * 0.10); // $0.10 refund per ticket
  }, [ticketCount, ticketPrice]);
  
  // Check USDC approval and balance when connected
  useEffect(() => {
    const checkApprovalAndBalance = async () => {
      if (isConnected && userAddress) {
        try {
          if (typeof window !== 'undefined' && window.ethereum) {
            const provider = new ethers.providers.Web3Provider(window.ethereum as any);
            const signer = provider.getSigner();
            const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
            
            // Check USDC balance
            const balance = await usdcContract.balanceOf(userAddress);
            setUsdcBalance(parseFloat(ethers.utils.formatUnits(balance, 6)));
            
            // Check if contract is approved to spend USDC
            const allowance = await usdcContract.allowance(userAddress, contractAddress);
            const requiredAmount = ethers.utils.parseUnits((totalPrice).toString(), 6);
            setIsApproved(allowance.gte(requiredAmount));
          }
        } catch (error) {
          console.error("Error checking approval:", error);
        }
      }
    };
    
    checkApprovalAndBalance();
  }, [isConnected, userAddress, contractAddress, usdcAddress, totalPrice]);
  
  const handleApproveUsdc = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    setIsApproving(true);
    setError('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
        
        // Only approve the exact amount needed for the purchase
        const approvalAmount = ethers.utils.parseUnits(totalPrice.toString(), 6);
        const tx = await usdcContract.approve(contractAddress, approvalAmount);
        
        await tx.wait();
        setIsApproved(true);
        setSuccess(`USDC approved successfully for ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}!`);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      }
    } catch (error) {
      console.error("Error approving USDC:", error);
      setError('Failed to approve USDC. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };
  
  const handleBuyTickets = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    setIsBuying(true);
    setError('');
    setSuccess('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
        const megapotContract = new ethers.Contract(contractAddress, megapotABI, signer);
        
        // Calculate the exact amount in wei
        const purchaseAmount = ethers.utils.parseUnits(totalPrice.toString(), 6);
        
        // Check approval status again before proceeding
        const allowance = await usdcContract.allowance(userAddress, contractAddress);
        
        // If not approved, handle approval first
        if (allowance.lt(purchaseAmount)) {
          setIsBuying(false);
          await handleApproveUsdc();
          return;
        }
        
        // Buy tickets with referral
        const tx = await megapotContract.purchaseTickets(
          referralAddress,
          purchaseAmount,
          userAddress // recipient is the user's address
        );
        
        setTxHash(tx.hash);
        await tx.wait();
        
        setSuccess(`Successfully purchased ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}!`);
        
        // Reset ticket count after successful purchase
        setTicketCount(1);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (error) {
      console.error("Error buying tickets:", error);
      setError('Failed to buy tickets. Please try again.');
    } finally {
      setIsBuying(false);
    }
  };
  
  const handleIncrement = () => {
    setTicketCount(prev => prev + 1);
  };
  
  const handleDecrement = () => {
    setTicketCount(prev => (prev > 1 ? prev - 1 : 1));
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTicketCount(value);
    } else {
      setTicketCount(1);
    }
  };
  
  return (
    <Card className="border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-800">
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center mb-4 md:mb-6">
          <motion.div 
            className="p-2 md:p-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 mr-2 md:mr-3"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <TicketIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </motion.div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Buy Lottery Tickets</h3>
        </div>
        
        {/* Balance display */}
        {isConnected && (
          <div className="mb-4 md:mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Your USDC Balance:</span>
              <span className="font-bold text-gray-900 dark:text-white">${usdcBalance.toFixed(2)}</span>
            </div>
          </div>
        )}
        
        {/* Ticket quantity selector */}
        <div className="mb-4 md:mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Number of Tickets
          </label>
          <div className="flex items-center">
            <button
              onClick={handleDecrement}
              className="p-2 rounded-l-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Decrease ticket count"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              value={ticketCount}
              onChange={handleInputChange}
              className="w-full p-2 text-center bg-white dark:bg-gray-800 border-y border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none min-h-[44px]"
              aria-label="Ticket count"
            />
            <button
              onClick={handleIncrement}
              className="p-2 rounded-r-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
              aria-label="Increase ticket count"
            >
              +
            </button>
          </div>
        </div>
        
        {/* Price display */}
        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/10 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Total Price:</span>
            <span className="text-lg md:text-xl font-bold text-btb-primary">${totalPrice.toFixed(2)}</span>
          </div>
        </div>
        
        {/* Refund information - Beautiful highlight box */}
        <div className="mb-4 md:mb-6 overflow-hidden">
          <motion.div 
            className="p-3 md:p-4 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-lg border border-green-200 dark:border-green-800 shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <motion.div 
                  className="mr-2 p-1.5 bg-green-200 dark:bg-green-800 rounded-full"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <CurrencyDollarIcon className="w-4 h-4 text-green-700 dark:text-green-300" />
                </motion.div>
                <span className="font-medium text-green-800 dark:text-green-200">Eligible for 10% Cashback!</span>
              </div>
              <span className="text-lg font-bold text-green-700 dark:text-green-300">${refundAmount.toFixed(2)}</span>
            </div>
          </motion.div>
        </div>
        
        {/* Action buttons */}
        <div className="space-y-3 md:space-y-4">
          {!isConnected ? (
            <Button 
              onClick={connectWallet}
              className="w-full min-h-[44px]"
              size="lg"
            >
              Connect Wallet
            </Button>
          ) : !isApproved ? (
            <Button 
              onClick={handleApproveUsdc}
              className="w-full min-h-[44px]"
              size="lg"
              disabled={isApproving}
            >
              {isApproving ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Approving USDC...
                </>
              ) : (
                <>
                  Approve USDC
                </>
              )}
            </Button>
          ) : (
            <Button 
              onClick={handleBuyTickets}
              className="w-full min-h-[44px]"
              size="lg"
              disabled={isBuying || totalPrice > usdcBalance}
            >
              {isBuying ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Buying Tickets...
                </>
              ) : (
                <>
                  Buy {ticketCount} Ticket{ticketCount !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
          
          {totalPrice > usdcBalance && isConnected && (
            <div className="flex items-center p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-lg text-sm">
              <ExclamationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>Insufficient USDC balance. You need ${(totalPrice - usdcBalance).toFixed(2)} more.</span>
            </div>
          )}
          
          {/* Success message */}
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm"
            >
              <CheckIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{success}</span>
            </motion.div>
          )}
          
          {/* Error message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm"
            >
              <ExclamationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
          
          {/* Transaction hash */}
          {txHash && (
            <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm">
              <InformationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 text-gray-600 dark:text-gray-400" />
              <div className="flex flex-col">
                <span className="text-gray-700 dark:text-gray-300">Transaction submitted:</span>
                <a 
                  href={`https://basescan.org/tx/${txHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-btb-primary hover:underline truncate"
                >
                  {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 8)}
                </a>
              </div>
            </div>
          )}
        </div>
        
        {/* Referral info */}
        <div className="mt-4 md:mt-6 text-center text-xs md:text-sm text-gray-600 dark:text-gray-400">
          <div className="mt-2 p-3 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg">
            <div className="flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="font-medium text-purple-800 dark:text-purple-300">
                50% MegaPoints Bonus!
              </span>
            </div>
            <p className="mt-1 text-purple-700 dark:text-purple-300">
              Earn 50% more MegaPoints (tracked onchain) as BTB is a VIP partner site of Megapot.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}
