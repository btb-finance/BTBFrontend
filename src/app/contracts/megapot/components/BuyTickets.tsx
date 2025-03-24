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
import buyticketABI from '../buyticketabi.json';

interface BuyTicketsProps {
  contractAddress: string;
  usdcAddress: string;
  referralAddress: string;
  ticketPrice: number;
  isConnected: boolean;
  userAddress: string | null;
  connectWallet: () => Promise<void>;
}

// Cashback helper contract address
const CASHBACK_CONTRACT_ADDRESS = '0x819eB717232992db08F0B8ffA9704DE496c136B5';

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
            
            // Check if USDC is approved for the cashback helper contract
            const allowance = await usdcContract.allowance(userAddress, CASHBACK_CONTRACT_ADDRESS);
            const requiredAmount = ethers.utils.parseUnits((totalPrice).toString(), 6);
            setIsApproved(allowance.gte(requiredAmount));
          }
        } catch (error) {
          console.error("Error checking approval:", error);
        }
      }
    };
    
    checkApprovalAndBalance();
  }, [isConnected, userAddress, usdcAddress, totalPrice]);
  
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
        const tx = await usdcContract.approve(CASHBACK_CONTRACT_ADDRESS, approvalAmount);
        
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
        const cashbackContract = new ethers.Contract(CASHBACK_CONTRACT_ADDRESS, buyticketABI, signer);
        
        // Calculate the exact amount in wei
        const purchaseAmount = ethers.utils.parseUnits(totalPrice.toString(), 6);
        
        // Check approval status again before proceeding
        const allowance = await usdcContract.allowance(userAddress, CASHBACK_CONTRACT_ADDRESS);
        
        // If not approved, handle approval first
        if (allowance.lt(purchaseAmount)) {
          setIsBuying(false);
          await handleApproveUsdc();
          return;
        }
        
        // Buy tickets with cashback in a single transaction using the helper contract
        const tx = await cashbackContract.purchaseTicketsWithCashback(purchaseAmount);
        
        setTxHash(tx.hash);
        await tx.wait();
        
        setSuccess(`Successfully purchased ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} with 10% cashback!`);
        
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
        
        {/* Cashback Highlight Banner */}
        <motion.div 
          className="mb-4 md:mb-6 p-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg shadow-md"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-bold text-sm md:text-base">EXCLUSIVE OFFER: </span>
              <span className="text-sm md:text-base">Get <span className="font-bold text-xl">10% USDC cashback</span> on all ticket purchases!</span>
            </div>
          </div>
        </motion.div>
        
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
        
        {/* Price display with cashback highlight */}
        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/10 rounded-lg border border-btb-primary/20 dark:border-btb-primary/10">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Total Price:</span>
              <span className="text-lg md:text-xl font-bold text-btb-primary">${totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Your Cashback (10%):</span>
              <span className="text-lg md:text-xl font-bold text-green-500">${(totalPrice * 0.1).toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-btb-primary/20 dark:border-btb-primary/10">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Final Cost:</span>
              <span className="text-lg md:text-xl font-bold text-btb-primary">${(totalPrice * 0.9).toFixed(2)}</span>
            </div>
          </div>
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
