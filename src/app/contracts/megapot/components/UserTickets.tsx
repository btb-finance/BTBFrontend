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

interface UserTicketsProps {
  contractAddress: string;
  isConnected: boolean;
  userAddress: string | null;
  connectWallet: () => Promise<void>;
}

export default function UserTickets({ 
  contractAddress, 
  isConnected,
  userAddress,
  connectWallet
}: UserTicketsProps) {
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [winningsClaimable, setWinningsClaimable] = useState<number | null>(null);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Fetch user ticket information
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (isConnected && userAddress) {
        try {
          setIsLoading(true);
          
          // Use public provider for Base network for read-only operations
          const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
          const contract = new ethers.Contract(contractAddress, megapotABI, provider);
          
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
        setIsLoading(false);
      }
    };
    
    fetchUserInfo();
    
    // Set up an interval to refresh the data every 5 minutes
    const intervalId = setInterval(fetchUserInfo, 300000); // 5 minutes = 300000 ms
    
    return () => clearInterval(intervalId);
  }, [isConnected, userAddress, contractAddress]);
  
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
        
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-btb-primary" />
          </div>
        ) : (
          <>
            {/* Ticket information */}
            <div className="space-y-4 mb-6">
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
                  <div className={`w-3 h-3 rounded-full mr-2 ${isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-gray-700 dark:text-gray-300">Status:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">
                    {isActive ? 'Active Participant' : 'Not Active'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {isActive ? 
                    'You are actively participating in the lottery. Good luck!' : 
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
