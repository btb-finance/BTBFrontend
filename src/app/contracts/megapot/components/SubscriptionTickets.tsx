'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TicketIcon, 
  ArrowPathIcon, 
  CheckIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { ethers } from 'ethers';
import subscriptionJackpotABI from '../subscriptionjackpotabi.json';
import usdcABI from './usdcABI.json';

interface SubscriptionTicketsProps {
  contractAddress: string;
  usdcAddress: string;
  referralAddress: string;
  ticketPrice: number;
  isConnected: boolean;
  userAddress: string | null;
  connectWallet: () => Promise<void>;
}

// Subscription jackpot contract address
const SUBSCRIPTION_CONTRACT_ADDRESS = '0x92C1fce71847cd68a794A3377741b372F392b25a'; 

export default function SubscriptionTickets({ 
  contractAddress, 
  usdcAddress, 
  referralAddress,
  ticketPrice, 
  isConnected,
  userAddress,
  connectWallet
}: SubscriptionTicketsProps) {
  const [ticketsPerDay, setTicketsPerDay] = useState(1);
  const [daysCount, setDaysCount] = useState(7);
  const [totalPrice, setTotalPrice] = useState(0);
  const [isApproved, setIsApproved] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cashbackPercentage, setCashbackPercentage] = useState(0);
  const [cashbackAmount, setCashbackAmount] = useState(0);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscription, setSubscription] = useState({
    ticketsPerDay: 0,
    daysRemaining: 0,
    lastProcessedBatchDay: 0,
    isActive: false
  });
  
  // Calculate total price when ticket count or days change
  useEffect(() => {
    const calculatePrices = async () => {
      if (ticketPrice && isConnected && userAddress) {
        try {
          if (typeof window !== 'undefined' && window.ethereum) {
            // Get contract instance
            const provider = new ethers.providers.Web3Provider(window.ethereum as any);
            const signer = provider.getSigner();
            const subscriptionContract = new ethers.Contract(
              SUBSCRIPTION_CONTRACT_ADDRESS,
              subscriptionJackpotABI,
              signer
            );
            
            if (hasActiveSubscription) {
              // Use contract method to calculate upgrade cost
              const upgradeCost = await subscriptionContract.calculateUpgradeCost(
                userAddress,
                ticketsPerDay,
                daysCount
              );
              setTotalPrice(parseFloat(ethers.utils.formatUnits(upgradeCost, 6)));
            } else {
              // Use contract method to calculate subscription cost
              const subscriptionCost = await subscriptionContract.calculateSubscriptionCost(
                ticketsPerDay,
                daysCount
              );
              setTotalPrice(parseFloat(ethers.utils.formatUnits(subscriptionCost, 6)));
            }
            
            // Calculate cashback
            if (cashbackPercentage > 0) {
              const calculatedCashback = (totalPrice * cashbackPercentage) / 100;
              setCashbackAmount(calculatedCashback);
            }
          }
        } catch (error) {
          console.error("Error calculating prices:", error);
          // Fallback to local calculation
          const calculatedPrice = ticketsPerDay * daysCount * ticketPrice;
          setTotalPrice(calculatedPrice);
          
          if (cashbackPercentage > 0) {
            const calculatedCashback = (calculatedPrice * cashbackPercentage) / 100;
            setCashbackAmount(calculatedCashback);
          }
        }
      } else {
        // Fallback to local calculation if not connected
        const calculatedPrice = ticketsPerDay * daysCount * ticketPrice;
        setTotalPrice(calculatedPrice);
        
        if (cashbackPercentage > 0) {
          const calculatedCashback = (calculatedPrice * cashbackPercentage) / 100;
          setCashbackAmount(calculatedCashback);
        }
      }
    };
    
    calculatePrices();
  }, [ticketsPerDay, daysCount, ticketPrice, cashbackPercentage, isConnected, userAddress, hasActiveSubscription]);
  
  // Check USDC approval and balance, plus subscription status when connected
  useEffect(() => {
    const checkApprovalBalanceAndSubscription = async () => {
      if (isConnected && userAddress) {
        try {
          if (typeof window !== 'undefined' && window.ethereum) {
            const provider = new ethers.providers.Web3Provider(window.ethereum as any);
            const signer = provider.getSigner();
            const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
            const subscriptionContract = new ethers.Contract(
              SUBSCRIPTION_CONTRACT_ADDRESS,
              subscriptionJackpotABI,
              signer
            );
            
            // Check USDC balance
            const balance = await usdcContract.balanceOf(userAddress);
            setUsdcBalance(parseFloat(ethers.utils.formatUnits(balance, 6)));
            
            // Check if USDC is approved for the subscription contract
            const allowance = await usdcContract.allowance(userAddress, SUBSCRIPTION_CONTRACT_ADDRESS);
            const requiredAmount = ethers.utils.parseUnits(totalPrice.toString(), 6);
            setIsApproved(allowance.gte(requiredAmount));
            
            // Get cashback percentage
            const subscriberCashbackPercentage = await subscriptionContract.subscriptionCashbackPercentage();
            setCashbackPercentage(subscriberCashbackPercentage.toNumber() / 100); // Convert from basis points
            
            // Check if user has an active subscription
            const hasSubscription = await subscriptionContract.hasActiveSubscription(userAddress);
            setHasActiveSubscription(hasSubscription);
            
            if (hasSubscription) {
              // Get subscription details
              const subscriptionDetails = await subscriptionContract.getSubscription(userAddress);
              setSubscription({
                ticketsPerDay: subscriptionDetails[0].toNumber(),
                daysRemaining: subscriptionDetails[1].toNumber(),
                lastProcessedBatchDay: subscriptionDetails[2].toNumber(),
                isActive: subscriptionDetails[3]
              });
            }
          }
        } catch (error) {
          console.error("Error checking subscription status:", error);
        }
      }
    };
    
    checkApprovalBalanceAndSubscription();
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
        
        // Approve a large amount for future transactions
        const approvalAmount = ethers.utils.parseUnits(totalPrice.toString(), 6); // Only approve exact amount needed
        const tx = await usdcContract.approve(SUBSCRIPTION_CONTRACT_ADDRESS, approvalAmount);
        
        await tx.wait();
        setIsApproved(true);
        setSuccess('USDC approved successfully for subscription!');
        
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
  
  const handleCreateSubscription = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    setIsSubscribing(true);
    setError('');
    setSuccess('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const subscriptionContract = new ethers.Contract(
          SUBSCRIPTION_CONTRACT_ADDRESS,
          subscriptionJackpotABI,
          signer
        );
        
        // Check approval status again before proceeding
        const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
        const allowance = await usdcContract.allowance(userAddress, SUBSCRIPTION_CONTRACT_ADDRESS);
        const requiredAmount = ethers.utils.parseUnits(totalPrice.toString(), 6);
        
        // If not approved, handle approval first
        if (allowance.lt(requiredAmount)) {
          setIsSubscribing(false);
          await handleApproveUsdc();
          return;
        }
        
        // Create subscription
        const tx = await subscriptionContract.createSubscription(ticketsPerDay, daysCount);
        
        setTxHash(tx.hash);
        await tx.wait();
        
        // Update subscription status
        setHasActiveSubscription(true);
        const subscriptionDetails = await subscriptionContract.getSubscription(userAddress);
        setSubscription({
          ticketsPerDay: subscriptionDetails[0].toNumber(),
          daysRemaining: subscriptionDetails[1].toNumber(),
          lastProcessedBatchDay: subscriptionDetails[2].toNumber(),
          isActive: subscriptionDetails[3]
        });
        
        setSuccess(`Successfully created subscription for ${ticketsPerDay} tickets per day for ${daysCount} days with ${cashbackPercentage}% cashback!`);
        
        // Reset inputs after successful purchase
        setTicketsPerDay(1);
        setDaysCount(7);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (error) {
      console.error("Error creating subscription:", error);
      setError('Failed to create subscription. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };
  
  const handleCancelSubscription = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    setIsSubscribing(true);
    setError('');
    setSuccess('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const subscriptionContract = new ethers.Contract(
          SUBSCRIPTION_CONTRACT_ADDRESS,
          subscriptionJackpotABI,
          signer
        );
        
        // Cancel subscription
        const tx = await subscriptionContract.cancelSubscription();
        
        setTxHash(tx.hash);
        await tx.wait();
        
        // Update subscription status
        setHasActiveSubscription(false);
        setSubscription({
          ticketsPerDay: 0,
          daysRemaining: 0,
          lastProcessedBatchDay: 0,
          isActive: false
        });
        
        setSuccess('Successfully canceled subscription with refund for remaining days!');
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (error) {
      console.error("Error canceling subscription:", error);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };
  
  const handleUpgradeSubscription = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    setIsSubscribing(true);
    setError('');
    setSuccess('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const subscriptionContract = new ethers.Contract(
          SUBSCRIPTION_CONTRACT_ADDRESS,
          subscriptionJackpotABI,
          signer
        );
        
        // Check approval status again before proceeding
        const usdcContract = new ethers.Contract(usdcAddress, usdcABI, signer);
        
        // Calculate upgrade cost
        const upgradeCost = await subscriptionContract.calculateUpgradeCost(
          userAddress,
          ticketsPerDay,
          daysCount
        );
        
        const formattedCost = ethers.utils.formatUnits(upgradeCost, 6);
        
        const allowance = await usdcContract.allowance(userAddress, SUBSCRIPTION_CONTRACT_ADDRESS);
        
        // If not approved, handle approval first
        if (allowance.lt(upgradeCost)) {
          setIsSubscribing(false);
          await handleApproveUsdc();
          return;
        }
        
        // Upgrade subscription
        const tx = await subscriptionContract.upgradeSubscription(ticketsPerDay, daysCount);
        
        setTxHash(tx.hash);
        await tx.wait();
        
        // Update subscription status
        const subscriptionDetails = await subscriptionContract.getSubscription(userAddress);
        setSubscription({
          ticketsPerDay: subscriptionDetails[0].toNumber(),
          daysRemaining: subscriptionDetails[1].toNumber(),
          lastProcessedBatchDay: subscriptionDetails[2].toNumber(),
          isActive: subscriptionDetails[3]
        });
        
        setSuccess(`Successfully upgraded subscription to ${ticketsPerDay} tickets per day with ${daysCount} additional days!`);
        
        // Reset inputs after successful upgrade
        setTicketsPerDay(1);
        setDaysCount(7);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (error) {
      console.error("Error upgrading subscription:", error);
      setError('Failed to upgrade subscription. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };
  
  const handleTicketsIncrement = () => {
    setTicketsPerDay(prev => prev + 1);
  };
  
  const handleTicketsDecrement = () => {
    setTicketsPerDay(prev => (prev > 1 ? prev - 1 : 1));
  };
  
  const handleDaysIncrement = () => {
    setDaysCount(prev => prev + 1);
  };
  
  const handleDaysDecrement = () => {
    setDaysCount(prev => (prev > 1 ? prev - 1 : 1));
  };
  
  const handleTicketsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTicketsPerDay(value);
    } else {
      setTicketsPerDay(1);
    }
  };
  
  const handleDaysInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setDaysCount(value);
    } else {
      setDaysCount(7);
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
            <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </motion.div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Auto-Buy Tickets</h3>
        </div>
        
        {/* Auto-Buy Highlight Banner */}
        <motion.div 
          className="mb-4 md:mb-6 p-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg shadow-md"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <span className="font-bold text-sm md:text-base">NEVER MISS A DRAW: </span>
              <span className="text-sm md:text-base">No need to open the website daily!</span>
            </div>
          </div>
        </motion.div>
        
        {/* Active Subscription Status */}
        {isConnected && hasActiveSubscription && (
          <div className="mb-4 md:mb-6 p-4 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
            <h4 className="font-bold text-green-800 dark:text-green-400 mb-2">Your Active Subscription</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center">
                <TicketIcon className="w-4 h-4 mr-1 text-green-700 dark:text-green-500" />
                <span className="text-gray-700 dark:text-gray-300">Tickets per day:</span>
              </div>
              <div className="font-bold text-gray-900 dark:text-white">{subscription.ticketsPerDay}</div>
              
              <div className="flex items-center">
                <ClockIcon className="w-4 h-4 mr-1 text-green-700 dark:text-green-500" />
                <span className="text-gray-700 dark:text-gray-300">Days remaining:</span>
              </div>
              <div className="font-bold text-gray-900 dark:text-white">{subscription.daysRemaining}</div>
            </div>
            <div className="mt-3 flex space-x-2">
              <Button
                onClick={handleCancelSubscription}
                className="text-sm bg-red-600 hover:bg-red-700 text-white"
                disabled={isSubscribing}
                size="sm"
              >
                {isSubscribing ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : 'Cancel Subscription'}
              </Button>
              <Button
                onClick={() => {
                  // Set default upgrade values based on current subscription
                  setTicketsPerDay(subscription.ticketsPerDay);
                  setDaysCount(7); // Default add 7 days
                }}
                className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
                size="sm"
              >
                Upgrade
              </Button>
            </div>
          </div>
        )}
        
        {/* Balance display */}
        {isConnected && (
          <div className="mb-4 md:mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Your USDC Balance:</span>
              <span className="font-bold text-gray-900 dark:text-white">${usdcBalance.toFixed(2)}</span>
            </div>
          </div>
        )}
        
        {/* Input forms for subscription */}
        <div className="mb-4 md:mb-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Tickets per day selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tickets Per Day
              </label>
              <div className="flex items-center">
                <button
                  onClick={handleTicketsDecrement}
                  className="p-2 rounded-l-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Decrease tickets per day"
                >
                  -
                </button>
                <input
                  type="number"
                  value={ticketsPerDay}
                  onChange={handleTicketsInputChange}
                  className="w-full p-2 text-center bg-white dark:bg-gray-800 border-y border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none min-h-[44px]"
                  min="1"
                  aria-label="Number of tickets per day"
                />
                <button
                  onClick={handleTicketsIncrement}
                  className="p-2 rounded-r-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Increase tickets per day"
                >
                  +
                </button>
              </div>
            </div>
            
            {/* Days count selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Days
              </label>
              <div className="flex items-center">
                <button
                  onClick={handleDaysDecrement}
                  className="p-2 rounded-l-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Decrease number of days"
                >
                  -
                </button>
                <input
                  type="number"
                  value={daysCount}
                  onChange={handleDaysInputChange}
                  className="w-full p-2 text-center bg-white dark:bg-gray-800 border-y border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none min-h-[44px]"
                  min="1"
                  aria-label="Number of days"
                />
                <button
                  onClick={handleDaysIncrement}
                  className="p-2 rounded-r-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors min-h-[44px] min-w-[44px]"
                  aria-label="Increase number of days"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Order summary - streamlined version */}
        <div className="mb-4 md:mb-6 p-3 md:p-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg border border-indigo-500/20 dark:border-indigo-500/10">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Total Tickets:</span>
              <span className="font-medium text-gray-900 dark:text-white">{ticketsPerDay * daysCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">Total Price:</span>
              <span className="text-lg md:text-xl font-bold text-indigo-600 dark:text-indigo-400">${totalPrice.toFixed(2)}</span>
            </div>
            {cashbackPercentage > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">Cashback ({cashbackPercentage}%):</span>
                <span className="text-lg md:text-xl font-bold text-green-500">${cashbackAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-indigo-500/20 dark:border-indigo-500/10">
              <span className="text-gray-700 dark:text-gray-300 font-medium">Final Cost:</span>
              <span className="text-lg md:text-xl font-bold text-indigo-600 dark:text-indigo-400">${(totalPrice - cashbackAmount).toFixed(2)}</span>
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
              disabled={isApproving}
              size="lg"
            >
              {isApproving ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Approving USDC...
                </>
              ) : 'Approve USDC'}
            </Button>
          ) : hasActiveSubscription ? (
            <Button
              onClick={handleUpgradeSubscription}
              className="w-full min-h-[44px]"
              disabled={isSubscribing}
              size="lg"
            >
              {isSubscribing ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Upgrading Subscription...
                </>
              ) : 'Upgrade Subscription'}
            </Button>
          ) : (
            <Button
              onClick={handleCreateSubscription}
              className="w-full min-h-[44px]"
              disabled={isSubscribing}
              size="lg"
            >
              {isSubscribing ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                  Creating Subscription...
                </>
              ) : 'Create Subscription'}
            </Button>
          )}
        </div>
        
        {/* Status messages */}
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
                className="text-indigo-600 hover:underline truncate"
              >
                View on Basescan
              </a>
            </div>
          </div>
        )}
        
        {/* Informational note */}
        <div className="mt-4 flex items-start text-sm text-gray-600 dark:text-gray-400">
          <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-500" />
          <p>
            Subscribe to automatically buy tickets every day without needing to return to the website. Your subscription remains active for the selected number of days, and tickets are automatically entered into each daily draw.
          </p>
        </div>
      </div>
    </Card>
  );
} 