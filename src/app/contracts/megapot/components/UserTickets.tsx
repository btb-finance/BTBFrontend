'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TicketIcon, 
  ArrowPathIcon, 
  CheckIcon, 
  ExclamationCircleIcon,
  InformationCircleIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  BoltIcon,
  ClockIcon,
  XCircleIcon,
  PlusCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { ethers } from 'ethers';
import megapotABI from '../megapotabi.json';
import subscriptionJackpotABI from '../subscriptionjackpotabi.json';

interface UserTicketsProps {
  contractAddress: string;
  isConnected: boolean;
  userAddress: string | null;
  connectWallet: () => Promise<void>;
  subscriptionContractAddress: string;
  refreshTrigger?: number;
}

export default function UserTickets({ 
  contractAddress, 
  isConnected,
  userAddress,
  connectWallet,
  subscriptionContractAddress,
  refreshTrigger = 0
}: UserTicketsProps) {
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [winningsClaimable, setWinningsClaimable] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Subscription state variables
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState({
    ticketsPerDay: 0,
    daysRemaining: 0,
    lastProcessedBatchDay: 0,
    isActive: false
  });
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  
  // Fetch user ticket information
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (isConnected && userAddress) {
        try {
          setIsLoading(true);
          console.log("Fetching user info for address:", userAddress);
          
          // Use public provider for Base network for read-only operations
          const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
          const contract = new ethers.Contract(contractAddress, megapotABI, provider);
          
          // Ensure we're using the correct subscription contract address, with a hardcoded fallback
          const CORRECT_SUB_CONTRACT = '0x92C1fce71847cd68a794A3377741b372F392b25a';
          
          // Always use the hardcoded correct address
          let subscriptionContract;
          
          if (typeof window !== 'undefined' && window.ethereum) {
            try {
              // Force a fresh provider instance
              const walletProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
              // Force provider to update its accounts
              await walletProvider.send('eth_accounts', []);
              
              const signer = walletProvider.getSigner();
              // Use the correct hardcoded address
              subscriptionContract = new ethers.Contract(
                CORRECT_SUB_CONTRACT, 
                subscriptionJackpotABI, 
                signer
              );
              console.log("Using Web3Provider with signer for subscription contract at", CORRECT_SUB_CONTRACT);
            } catch (err) {
              console.error("Error creating subscription contract with signer:", err);
              // Fallback to read-only provider but still use correct address
              subscriptionContract = new ethers.Contract(
                CORRECT_SUB_CONTRACT, 
                subscriptionJackpotABI, 
                provider
              );
              console.log("Falling back to JsonRpcProvider for subscription contract at", CORRECT_SUB_CONTRACT);
            }
          } else {
            // Use read-only provider with correct address
            subscriptionContract = new ethers.Contract(
              CORRECT_SUB_CONTRACT, 
              subscriptionJackpotABI, 
              provider
            );
            console.log("Using JsonRpcProvider for subscription contract at", CORRECT_SUB_CONTRACT);
          }
          
          // Get user info
          const userInfo = await contract.usersInfo(userAddress);
          
          // Convert from basis points (1 bps = 0.01%)
          // ticketsPurchasedTotalBps is in basis points, divide by 10000 to get actual count
          const ticketsBps = userInfo.ticketsPurchasedTotalBps.toNumber();
          setTicketCount(Math.ceil(ticketsBps / 10000));
          
          // Get claimable winnings
          const winnings = parseFloat(ethers.utils.formatUnits(userInfo.winningsClaimable, 6));
          setWinningsClaimable(winnings);
          
          // Get active status
          setIsActive(userInfo.active);
          
          // Get subscription info
          try {
            console.log("Checking subscription status for:", userAddress);
            console.log("Using subscription contract at:", CORRECT_SUB_CONTRACT);
            
            const hasSubscription = await subscriptionContract.hasActiveSubscription(userAddress);
            console.log("Has active subscription:", hasSubscription);
            setHasActiveSubscription(hasSubscription);
            
            if (hasSubscription) {
              console.log("Fetching subscription details...");
              const subInfo = await subscriptionContract.getSubscription(userAddress);
              console.log("Subscription details:", {
                ticketsPerDay: subInfo[0].toNumber(),
                daysRemaining: subInfo[1].toNumber(),
                lastProcessedBatchDay: subInfo[2].toNumber(),
                isActive: subInfo[3]
              });
              
              setSubscriptionDetails({
                ticketsPerDay: subInfo[0].toNumber(),
                daysRemaining: subInfo[1].toNumber(),
                lastProcessedBatchDay: subInfo[2].toNumber(),
                isActive: subInfo[3]
              });
            } else {
              // Reset subscription details if no active subscription
              setSubscriptionDetails({
                ticketsPerDay: 0,
                daysRemaining: 0,
                lastProcessedBatchDay: 0,
                isActive: false
              });
            }
          } catch (subError) {
            console.error("Error fetching subscription info:", subError);
            setHasActiveSubscription(false);
            setSubscriptionDetails({
              ticketsPerDay: 0,
              daysRemaining: 0,
              lastProcessedBatchDay: 0,
              isActive: false
            });
          }
          
        } catch (error) {
          console.error("Error fetching user info:", error);
          setError('Failed to fetch your ticket information. Please try again.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setTicketCount(null);
        setWinningsClaimable(null);
        setIsActive(null);
        setHasActiveSubscription(false);
        setSubscriptionDetails({
          ticketsPerDay: 0,
          daysRemaining: 0,
          lastProcessedBatchDay: 0,
          isActive: false
        });
        setIsLoading(false);
      }
    };
    
    fetchUserInfo();
    
    // Set up an interval to refresh the data every 5 minutes
    const intervalId = setInterval(fetchUserInfo, 300000); // 5 minutes = 300000 ms
    
    return () => clearInterval(intervalId);
  }, [isConnected, userAddress, contractAddress, subscriptionContractAddress, refreshTrigger]);
  
  // Add a manual refresh function
  const manualRefresh = async () => {
    if (!isConnected || !userAddress) {
      console.log('Cannot refresh: wallet not connected or no address');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Manually refreshing user ticket data for:", userAddress);
      
      // First ensure wallet connection is fresh
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Request accounts explicitly to force wallet reconnection
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          // Create a fresh provider instance
          const walletProvider = new ethers.providers.Web3Provider(window.ethereum as any, 'any');
          await walletProvider.send('eth_accounts', []);
          
          const signer = walletProvider.getSigner();
          const account = await signer.getAddress();
          console.log('Current signer account:', account);
          
          // Use RPC provider for reliable read operations
          const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
          const contract = new ethers.Contract(contractAddress, megapotABI, provider);
          
          // Get user info
          const userInfo = await contract.usersInfo(account);
          
          // Convert from basis points and set state
          const ticketsBps = userInfo.ticketsPurchasedTotalBps.toNumber();
          setTicketCount(Math.ceil(ticketsBps / 10000));
          
          // Get claimable winnings
          const winnings = parseFloat(ethers.utils.formatUnits(userInfo.winningsClaimable, 6));
          setWinningsClaimable(winnings);
          
          // Get active status
          setIsActive(userInfo.active);
          
          // Get subscription info with signer for better accuracy
          const CORRECT_SUB_CONTRACT = '0x92C1fce71847cd68a794A3377741b372F392b25a';
          
          try {
            console.log("Checking subscription status with signer for:", account);
            const subscriptionContract = new ethers.Contract(
              CORRECT_SUB_CONTRACT,
              subscriptionJackpotABI,
              signer
            );
            
            const hasSubscription = await subscriptionContract.hasActiveSubscription(account);
            console.log("Has active subscription (with signer):", hasSubscription);
            setHasActiveSubscription(hasSubscription);
            
            if (hasSubscription) {
              console.log("Fetching subscription details with signer...");
              const subInfo = await subscriptionContract.getSubscription(account);
              
              setSubscriptionDetails({
                ticketsPerDay: subInfo[0].toNumber(),
                daysRemaining: subInfo[1].toNumber(),
                lastProcessedBatchDay: subInfo[2].toNumber(),
                isActive: subInfo[3]
              });
              
              console.log("Subscription details refreshed successfully:", {
                ticketsPerDay: subInfo[0].toNumber(),
                daysRemaining: subInfo[1].toNumber(),
                lastProcessedBatchDay: subInfo[2].toNumber(),
                isActive: subInfo[3]
              });
            }
          } catch (subError) {
            console.error("Error fetching subscription with signer:", subError);
            
            // Fallback to read-only provider
            try {
              console.log("Falling back to read-only provider for subscription check");
              const subscriptionContract = new ethers.Contract(
                CORRECT_SUB_CONTRACT,
                subscriptionJackpotABI,
                provider
              );
              
              const hasSubscription = await subscriptionContract.hasActiveSubscription(account);
              console.log("Has active subscription (read-only):", hasSubscription);
              setHasActiveSubscription(hasSubscription);
              
              if (hasSubscription) {
                const subInfo = await subscriptionContract.getSubscription(account);
                setSubscriptionDetails({
                  ticketsPerDay: subInfo[0].toNumber(),
                  daysRemaining: subInfo[1].toNumber(),
                  lastProcessedBatchDay: subInfo[2].toNumber(),
                  isActive: subInfo[3]
                });
              }
            } catch (fallbackError) {
              console.error("Fallback subscription check also failed:", fallbackError);
            }
          }
          
          console.log("Manual refresh completed successfully with signer");
        } catch (error) {
          console.error("Error in wallet-connected refresh:", error);
          
          // Fall back to read-only if wallet connection fails
          await refreshWithReadOnlyProvider();
        }
      } else {
        // No window.ethereum, use read-only provider
        await refreshWithReadOnlyProvider();
      }
    } catch (error) {
      console.error("Error in manual refresh:", error);
      setError('Failed to refresh data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper function for read-only provider refreshes
  const refreshWithReadOnlyProvider = async () => {
    try {
      console.log("Using read-only provider for refresh");
      const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const contract = new ethers.Contract(contractAddress, megapotABI, provider);
      
      // Get user info
      const userInfo = await contract.usersInfo(userAddress);
      
      // Convert from basis points and set state
      const ticketsBps = userInfo.ticketsPurchasedTotalBps.toNumber();
      setTicketCount(Math.ceil(ticketsBps / 10000));
      
      // Get claimable winnings
      const winnings = parseFloat(ethers.utils.formatUnits(userInfo.winningsClaimable, 6));
      setWinningsClaimable(winnings);
      
      // Get active status
      setIsActive(userInfo.active);
      
      // Check subscription with read-only provider
      const CORRECT_SUB_CONTRACT = '0x92C1fce71847cd68a794A3377741b372F392b25a';
      const subscriptionContract = new ethers.Contract(
        CORRECT_SUB_CONTRACT,
        subscriptionJackpotABI,
        provider
      );
      
      const hasSubscription = await subscriptionContract.hasActiveSubscription(userAddress);
      setHasActiveSubscription(hasSubscription);
      
      if (hasSubscription) {
        const subInfo = await subscriptionContract.getSubscription(userAddress);
        setSubscriptionDetails({
          ticketsPerDay: subInfo[0].toNumber(),
          daysRemaining: subInfo[1].toNumber(),
          lastProcessedBatchDay: subInfo[2].toNumber(),
          isActive: subInfo[3]
        });
      }
      
      console.log("Read-only refresh completed successfully");
    } catch (error) {
      console.error("Error in read-only refresh:", error);
      throw error; // Re-throw to be caught by the calling function
    }
  };
  
  const handleWithdrawWinnings = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    if (!winningsClaimable || winningsClaimable <= 0) {
      setError('No winnings available to withdraw.');
      return;
    }
    
    setIsWithdrawing(true);
    setError('');
    setSuccess('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        const megapotContract = new ethers.Contract(contractAddress, megapotABI, signer);
        
        // Withdraw winnings
        const tx = await megapotContract.withdrawWinnings();
        
        setTxHash(tx.hash);
        await tx.wait();
        
        setSuccess('Successfully withdrew your winnings!');
        
        // Update the winnings to zero after successful withdrawal
        setWinningsClaimable(0);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (error) {
      console.error("Error withdrawing winnings:", error);
      setError('Failed to withdraw winnings. Please try again.');
    } finally {
      setIsWithdrawing(false);
    }
  };
  
  const handleCancelSubscription = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }
    
    if (!hasActiveSubscription) {
      setError('You do not have an active subscription to cancel.');
      return;
    }
    
    const confirm = window.confirm(
      `Cancel your subscription?\n\n` +
      `• You will be refunded for your remaining ${subscriptionDetails.daysRemaining} days\n` +
      `• Your ${subscriptionDetails.ticketsPerDay} daily tickets will stop being automatically purchased\n` +
      `• A small cancellation fee may apply`
    );
    
    if (!confirm) return;
    
    setIsCancellingSubscription(true);
    setError('');
    setSuccess('');
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const signer = provider.getSigner();
        
        // Use the hardcoded correct address
        const CORRECT_SUB_CONTRACT = '0x92C1fce71847cd68a794A3377741b372F392b25a';
        
        const subscriptionContract = new ethers.Contract(
          CORRECT_SUB_CONTRACT, 
          subscriptionJackpotABI, 
          signer
        );
        
        console.log("Cancelling subscription using contract at:", CORRECT_SUB_CONTRACT);
        
        // Cancel subscription
        const tx = await subscriptionContract.cancelSubscription();
        
        setTxHash(tx.hash);
        await tx.wait();
        
        setSuccess('Your subscription has been cancelled and remaining days refunded!');
        setHasActiveSubscription(false);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      }
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      setError('Failed to cancel subscription. Please try again.');
    } finally {
      setIsCancellingSubscription(false);
    }
  };
  
  const handleScrollToSubscription = () => {
    document.getElementById('subscription')?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'center'
    });
  };
  
  // If not connected, show connect wallet prompt
  if (!isConnected) {
    return (
      <Card className="border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-800">
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-center mb-4 md:mb-6">
            <motion.div 
              className="p-2 md:p-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 mr-2 md:mr-3"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <TicketIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </motion.div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Your Lottery Tickets</h3>
          </div>
          
          <div className="text-center p-6">
            <p className="text-gray-600 dark:text-gray-400 mb-4">Connect your wallet to view your tickets and winnings</p>
            <Button 
              onClick={connectWallet}
              className="min-h-[44px]"
              size="lg"
            >
              Connect Wallet
            </Button>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card className="border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <div className="flex items-center">
            <motion.div 
              className="p-2 md:p-3 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 mr-2 md:mr-3"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <TicketIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </motion.div>
            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
              Your Tickets
            </h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={manualRefresh}
            disabled={isLoading || !isConnected}
            className="flex items-center"
          >
            <ArrowPathIcon className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-btb-primary" />
          </div>
        ) : (
          <>
            {/* Ticket information */}
            <div className="space-y-4 mb-6">
              {/* Subscription Section - Always Display */}
              <div className={`p-4 bg-gradient-to-r ${hasActiveSubscription ? 'from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30' : 'from-gray-100 to-gray-200 dark:from-gray-800/50 dark:to-gray-700/50'} rounded-lg`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <CalendarIcon className={`w-5 h-5 ${hasActiveSubscription ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-400'} mr-2`} />
                    <span className={`text-lg font-bold ${hasActiveSubscription ? 'text-purple-800 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>Auto-Buy Subscription</span>
                  </div>
                  {hasActiveSubscription ? (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Not Active</span>
                    </div>
                  )}
                </div>
                
                {hasActiveSubscription ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Daily Tickets</div>
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-300 flex items-center">
                          {subscriptionDetails.ticketsPerDay}
                          <BoltIcon className="w-4 h-4 ml-1 text-yellow-500" />
                        </div>
                      </div>
                      
                      <div className="bg-white/50 dark:bg-gray-800/30 rounded-lg p-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">Days Remaining</div>
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-300 flex items-center">
                          {subscriptionDetails.daysRemaining}
                          <ClockIcon className="w-4 h-4 ml-1 text-blue-500" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {subscriptionDetails.ticketsPerDay * subscriptionDetails.daysRemaining} total tickets left
                      </div>
                      
                      <Button
                        variant="outline"
                        className="border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-xs h-8"
                        onClick={handleCancelSubscription}
                        disabled={isCancellingSubscription}
                      >
                        {isCancellingSubscription ? (
                          <>
                            <ArrowPathIcon className="w-3 h-3 mr-1 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="w-3 h-3 mr-1" />
                            Cancel & Refund
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      You don't have an active subscription. Subscribe to automatically buy tickets daily.
                    </p>
                    <Button
                      variant="outline"
                      className="border-purple-300 bg-purple-50 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm"
                      onClick={handleScrollToSubscription}
                    >
                      <PlusCircleIcon className="w-4 h-4 mr-1" />
                      Get Auto-Buy Subscription
                    </Button>
                  </div>
                )}
              </div>
            
              <div className="p-4 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Your Tickets:</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    {ticketCount !== null ? ticketCount : '0'}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                    style={{ width: `${ticketCount ? Math.min(100, (ticketCount / 100) * 100) : 0}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {ticketCount ? 
                    `You have purchased ${ticketCount} ticket${ticketCount !== 1 ? 's' : ''} in the current lottery round.` : 
                    'You have not purchased any tickets in the current lottery round.'
                  }
                  {hasActiveSubscription && (
                    <span className="inline-flex items-center ml-1 text-purple-600 dark:text-purple-400">
                      <BoltIcon className="w-3 h-3 mr-1" />
                      Auto-buying {subscriptionDetails.ticketsPerDay} tickets daily
                    </span>
                  )}
                </p>
              </div>
              
              {/* Winnings information */}
              <div className="p-4 bg-gradient-to-r from-green-100 to-teal-100 dark:from-green-900/30 dark:to-teal-900/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700 dark:text-gray-300">Claimable Winnings:</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${winningsClaimable !== null ? winningsClaimable.toFixed(2) : '0.00'}
                  </span>
                </div>
                {winningsClaimable && winningsClaimable > 0 ? (
                  <Button 
                    onClick={handleWithdrawWinnings}
                    className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white min-h-[44px]"
                    size="lg"
                    disabled={isWithdrawing}
                  >
                    {isWithdrawing ? (
                      <>
                        <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                        Withdrawing...
                      </>
                    ) : (
                      <>
                        <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                        Withdraw Winnings
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    You don't have any winnings to claim at the moment.
                  </p>
                )}
              </div>
              
              {/* Participation status */}
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-2 ${isActive || hasActiveSubscription ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-gray-700 dark:text-gray-300">Status:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {isActive || hasActiveSubscription ? 'Active Participant' : 'Not Active'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {isActive || hasActiveSubscription ? 
                    `You are actively participating in the lottery. ${hasActiveSubscription ? 'Your subscription ensures you never miss a draw!' : ''} Good luck!` : 
                    'You are not currently active in the lottery. Buy tickets to participate!'
                  }
                </p>
              </div>
            </div>
            
            {/* Success message */}
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm mb-4"
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
                className="flex items-center p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm mb-4"
              >
                <ExclamationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
            
            {/* Transaction hash */}
            {txHash && (
              <div className="flex items-center p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm mb-4">
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
            
            <div className="text-center text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-4">
              <p>
                Ticket information is updated every 5 minutes. Refresh the page for the latest data.
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
