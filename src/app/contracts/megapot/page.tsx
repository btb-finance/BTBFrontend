'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  ArrowPathIcon, 
  TicketIcon,
  BanknotesIcon, 
  BoltIcon, 
  CheckIcon,
  ClockIcon,
  CurrencyDollarIcon, 
  GiftIcon,
  LockClosedIcon,
  PlayCircleIcon,
  QuestionMarkCircleIcon,
  TrophyIcon,
  UserGroupIcon,
  UserIcon,
  WalletIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Button, MotionButton } from '../../components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '../../components/ui/card';
import MegapotStats from './components/MegapotStats';
import LotteryCountdown from './components/LotteryCountdown';
import BuyTickets from './components/BuyTickets';
import UserTickets from './components/UserTickets';
import SubscriptionTickets from './components/SubscriptionTickets';
import { useWallet } from '../../context/WalletContext';
import { ethers } from 'ethers';
import megapotABI from './megapotabi.json';
import useNetworkSwitcher from '@/app/hooks/useNetworkSwitcher';

// CSS variables for feature card colors
const colorStyles = `
  :root {
    --green-500: #10b981;
    --teal-600: #0d9488;
    --purple-500: #8b5cf6;
    --indigo-600: #4f46e5;
    --indigo-700: #4338ca;
    --blue-400: #60a5fa;
    --blue-500: #3b82f6;
    --blue-600: #2563eb;
    --blue-700: #1d4ed8;
    --cyan-500: #06b6d4;
    --cyan-600: #0891b2;
    --gray-700: #374151;
    --gray-900: #111827;
    --pink-500: #ec4899;
    --rose-600: #e11d48;
    --amber-500: #f59e0b;
    --orange-600: #ea580c;
    --sky-500: #0ea5e9;
  }
`;

// Key features of Megapot Lottery
const megapotFeatures = [
  {
    title: 'USDC-Backed Prizes',
    description: 'All lottery prizes are backed by USDC deposits, ensuring real value and transparency for every winner.',
    icon: BanknotesIcon,
    color: 'from-blue-500 to-blue-700',
    highlight: true
  },
  {
    title: 'Daily Jackpots',
    description: 'New jackpot runs every 24 hours, giving you daily chances to win big prizes.',
    icon: ClockIcon,
    color: 'from-purple-500 to-indigo-600'
  },
  {
    title: 'Auto-Renewing Subscriptions',
    description: 'Set up automatic daily ticket purchases with our subscription service. Never miss a draw and get special cashback benefits.',
    icon: ArrowPathIcon,
    color: 'from-indigo-500 to-blue-600',
    highlight: true
  },
  {
    title: 'Referral Rewards',
    description: 'Earn 5% in referral fees when friends buy tickets using your referral address.',
    icon: GiftIcon,
    color: 'from-green-500 to-teal-600'
  },
  {
    title: 'MegaPoints & Cashback Bonus',
    description: <>Earn <span className="font-bold text-btb-primary">50% more MegaPoints</span> (tracked onchain) AND get <span className="font-bold text-green-500">10% USDC cashback</span> on all ticket purchases as BTB is a VIP partner site of Megapot!</>,
    icon: TrophyIcon,
    color: 'from-purple-500 to-pink-600',
    highlight: true,
    special: true
  },
  {
    title: 'Transparent Draws',
    description: 'Lottery draws use Pyth Network\'s Entropy for provably fair and verifiable randomness.',
    icon: LockClosedIcon,
    color: 'from-amber-500 to-orange-600'
  },
  {
    title: 'Instant Prizes',
    description: 'Winners receive their prizes immediately after the draw, with no waiting period.',
    icon: BoltIcon,
    color: 'from-pink-500 to-rose-600'
  },
  {
    title: 'LP Opportunities',
    description: 'Become a liquidity provider to earn fees from the lottery pool.',
    icon: CurrencyDollarIcon,
    color: 'from-cyan-500 to-sky-600'
  }
];

// Contract addresses
const CONTRACT_ADDRESS = '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const REFERRAL_ADDRESS = '0xfed2Ff614E0289D41937139730B49Ee158D02299';
const SUBSCRIPTION_CONTRACT_ADDRESS = '0x819eB717232992db08F0B8ffA9704DE496c136B5';
const SCHEDULE_CONTRACT_ADDRESS = '0x92C1fce71847cd68a794A3377741b372F392b25a'; 
const NETWORK = 'base';

export default function MegapotPage() {
  const { isConnected, address, connectWallet } = useWallet();
  const { switchNetwork } = useNetworkSwitcher();
  const [jackpotAmount, setJackpotAmount] = useState<number | null>(null);
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);
  const [participants, setParticipants] = useState<number | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Contract addresses
  const MEGAPOT_CONTRACT_ADDRESS = CONTRACT_ADDRESS;
  
  // Function to refresh USDC balances
  const refreshBalances = () => {
    console.log('Refreshing USDC balances');
    setRefreshTrigger(prev => prev + 1);
  };

  // Function to explicitly fetch USDC balance
  const fetchUsdcBalance = async () => {
    if (!isConnected || !address) {
      console.log('Cannot fetch USDC balance: wallet not connected or no address');
      return;
    }
    
    try {
      console.log('Explicitly fetching USDC balance for', address);
      
      // First try with window.ethereum
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          // Request accounts explicitly to force wallet reconnection
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          
          // Create a fresh provider
          const provider = new ethers.providers.Web3Provider(window.ethereum, 'any');
          // Force provider to update its accounts
          await provider.send('eth_accounts', []);
          const signer = provider.getSigner();
          const account = await signer.getAddress();
          console.log('Current signer account:', account);
          
          // Use minimal ABI for better reliability
          const minABI = [
            // balanceOf
            {
              "constant": true,
              "inputs": [{ "name": "_owner", "type": "address" }],
              "name": "balanceOf",
              "outputs": [{ "name": "balance", "type": "uint256" }],
              "type": "function"
            },
            // decimals
            {
              "constant": true,
              "inputs": [],
              "name": "decimals",
              "outputs": [{ "name": "", "type": "uint8" }],
              "type": "function"
            }
          ];
          
          const usdcContract = new ethers.Contract(USDC_ADDRESS, minABI, signer);
          
          // Check USDC balance with the current signer account
          const balance = await usdcContract.balanceOf(account);
          console.log('USDC balance refreshed successfully (web3):', ethers.utils.formatUnits(balance, 6));
          
          return parseFloat(ethers.utils.formatUnits(balance, 6));
        } catch (error) {
          console.error('Error fetching balance with Web3Provider:', error);
          
          // Fallback to JsonRpcProvider
          console.log('Falling back to JsonRpcProvider for USDC balance');
          const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
          
          // Use minimal ABI
          const minABI = [
            // balanceOf
            {
              "constant": true,
              "inputs": [{ "name": "_owner", "type": "address" }],
              "name": "balanceOf",
              "outputs": [{ "name": "balance", "type": "uint256" }],
              "type": "function"
            }
          ];
          
          const usdcContract = new ethers.Contract(USDC_ADDRESS, minABI, provider);
          
          // Check USDC balance with explicit address
          const balance = await usdcContract.balanceOf(address);
          console.log('USDC balance refreshed successfully (rpc):', ethers.utils.formatUnits(balance, 6));
          
          return parseFloat(ethers.utils.formatUnits(balance, 6));
        }
      } else {
        // Use JsonRpcProvider if window.ethereum not available
        console.log('No window.ethereum, using JsonRpcProvider');
        const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        
        // Use minimal ABI
        const minABI = [
          // balanceOf
          {
            "constant": true,
            "inputs": [{ "name": "_owner", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "name": "balance", "type": "uint256" }],
            "type": "function"
          }
        ];
        
        const usdcContract = new ethers.Contract(USDC_ADDRESS, minABI, provider);
        
        // Check USDC balance with explicit address
        const balance = await usdcContract.balanceOf(address);
        console.log('USDC balance refreshed successfully (fallback):', ethers.utils.formatUnits(balance, 6));
        
        return parseFloat(ethers.utils.formatUnits(balance, 6));
      }
    } catch (error) {
      console.error('Error explicitly fetching USDC balance:', error);
      return null;
    }
  };

  // Listen for window focus events to refresh balances
  useEffect(() => {
    const handleFocus = () => {
      if (isConnected) {
        console.log('Window focused, refreshing balances');
        refreshBalances();
        fetchUsdcBalance();
      }
    };

    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, address]);

  // Refresh balances when connected
  useEffect(() => {
    if (isConnected) {
      refreshBalances();
      fetchUsdcBalance();
    }
  }, [isConnected, address]);
  
  // Force refresh on page load
  useEffect(() => {
    // Force refresh on initial page load
    if (isConnected && address) {
      console.log('Initial page load, force refreshing USDC balance');
      const timer = setTimeout(() => {
        fetchUsdcBalance();
      }, 1000); // Delay slightly to ensure wallet is fully connected
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Silent network switching
  useEffect(() => {
    if (isConnected && typeof window.ethereum !== 'undefined') {
      try {
        const checkNetwork = async () => {
          // Add type guard to make TypeScript happy
          if (!window.ethereum) return;
          
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const network = await provider.getNetwork();
          if (network.chainId !== 8453) { // If not on Base
            switchNetwork('BASE'); // Silently switch
          }
        };
        
        checkNetwork();
        
        // Listen for chain changes
        const handleChainChanged = () => {
          checkNetwork();
        };
        
        window.ethereum.on('chainChanged', handleChainChanged);
        
        return () => {
          if (window.ethereum?.removeListener) {
            window.ethereum.removeListener('chainChanged', handleChainChanged);
          }
        };
      } catch (error) {
        console.error('Network check error:', error);
      }
    }
  }, [isConnected, switchNetwork]);

  // Fetch contract data
  useEffect(() => {
    const fetchContractData = async () => {
      try {
        // Use public provider for Base network
        const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(CONTRACT_ADDRESS, megapotABI, provider);
        
        // Get jackpot pool size
        const lpPoolTotal = await contract.lpPoolTotal();
        setJackpotAmount(parseFloat(ethers.utils.formatUnits(lpPoolTotal, 6)));
        
        // Get ticket price
        const price = await contract.ticketPrice();
        setTicketPrice(parseFloat(ethers.utils.formatUnits(price, 6)));
        
        // Get last winner
        const winner = await contract.lastWinnerAddress();
        setLastWinner(winner);
        
        // Get active participants count - using ticketCountTotal instead of userLimit
        const ticketCountTotalBps = await contract.ticketCountTotalBps();
        // Convert from basis points and divide by 10000 to get actual count
        const actualParticipants = Math.ceil(ticketCountTotalBps.div(10000).toNumber() / 3); // Assuming average 3 tickets per user
        setParticipants(actualParticipants);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching contract data:', error);
        setIsLoading(false);
      }
    };

    fetchContractData();
  }, []);

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/10 dark:from-btb-primary/5 dark:to-btb-primary-light/5"></div>
        <div className="container mx-auto px-4 relative z-10">
          {/* Warning Banner */}
          <div className="bg-red-600 text-white p-4 rounded-lg shadow-md mb-8">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold text-base">WARNING:</p>
                <p className="text-sm md:text-base">Megapot is a 3rd party app. Always invest at your own risk. Gambling may result in loss of your entire investment.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
            <div className="w-full lg:w-1/2">
              <motion.h1 
                className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                Win Big with <span className="text-btb-primary">Megapot Lottery</span>
              </motion.h1>
              <motion.p 
                className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6 md:mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                We buy lottery tickets on your behalf with USDC for a chance to win the jackpot. The more tickets you buy, the higher your chances of winning! ⚡ <span className="font-bold text-btb-primary">EXCLUSIVE BONUS: Earn 50% more MegaPoints</span> (tracked onchain) and <span className="font-bold text-green-500">get 10% USDC cashback</span> on all purchases as BTB is a VIP partner site of Megapot!
              </motion.p>
              
              <motion.p
                className="text-md md:text-lg text-gray-700 dark:text-gray-300 mb-6 md:mb-8 bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border-l-4 border-indigo-600"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <span className="font-bold text-indigo-700 dark:text-indigo-400">NEW!</span> <span className="font-bold">Auto-Buy Subscription:</span> Set it once and never miss a draw! Our smart contract automatically enters you daily without returning to the site. <span className="italic">Plus, subscribers get the same 50% MegaPoints bonus and 10% cashback benefits!</span> <span className="font-bold text-green-600 dark:text-green-400">Cancel anytime!</span> 🔄
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-8 lg:mb-0"
              >
                <MotionButton
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-btb-primary hover:bg-btb-primary-dark text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg w-full sm:w-auto mr-0 sm:mr-4 mb-4 sm:mb-0"
                  onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Buy Tickets Now
                </MotionButton>
                <MotionButton
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg w-full sm:w-auto"
                  onClick={() => document.getElementById('subscription')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Auto-Buy Daily
                </MotionButton>
              </motion.div>
            </div>
            <div className="w-full lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-btb-primary to-btb-primary-light rounded-2xl opacity-20 blur-xl"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-6 md:p-8">
                    <div className="flex items-center justify-center mb-6">
                      <TicketIcon className="w-10 h-10 text-btb-primary mr-3" />
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Current Jackpot</h3>
                    </div>
                    <div className="text-center mb-6">
                      <span className="text-5xl md:text-6xl font-bold text-btb-primary">
                        ${jackpotAmount ? jackpotAmount.toLocaleString() : '---'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Ticket Price</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">${ticketPrice || '--'}</p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Participants</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{participants ? participants.toLocaleString() : '--'}</p>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                      size="lg"
                      onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Enter Now
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Contract Verification Section */}
      <section className="py-4 md:py-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between">
            <div className="flex items-center mb-3 md:mb-0">
              <ShieldCheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">Contract Verified & Audited</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <a 
                href={`https://basescan.org/address/${CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm flex items-center px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Contract
              </a>
              <a 
                href={`https://basescan.org/address/${SUBSCRIPTION_CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm flex items-center px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Subscription
              </a>
              <a 
                href={`https://basescan.org/address/${SCHEDULE_CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm flex items-center px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Schedule
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Section */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Live Lottery Stats</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Real-time updates on the current lottery round</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <MegapotStats 
              jackpotAmount={jackpotAmount}
              ticketPrice={ticketPrice}
              participants={participants}
              lastWinner={lastWinner}
              isLoading={isLoading}
              contractAddress={CONTRACT_ADDRESS}
            />
            <LotteryCountdown contractAddress={CONTRACT_ADDRESS} />
          </div>
        </div>
      </section>

      {/* Buy Tickets Section */}
      <section id="buy-tickets" className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Buy Your Tickets</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Get your tickets now for a chance to win big</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <BuyTickets 
              contractAddress={MEGAPOT_CONTRACT_ADDRESS}
              usdcAddress={USDC_ADDRESS}
              referralAddress={REFERRAL_ADDRESS}
              ticketPrice={ticketPrice || 10}
              isConnected={isConnected}
              userAddress={address}
              connectWallet={handleConnectWallet}
              refreshTrigger={refreshTrigger}
            />
            <div id="subscription">
              <SubscriptionTickets
                contractAddress={MEGAPOT_CONTRACT_ADDRESS}
                usdcAddress={USDC_ADDRESS}
                referralAddress={REFERRAL_ADDRESS}
                ticketPrice={ticketPrice || 10}
                isConnected={isConnected}
                userAddress={address}
                connectWallet={handleConnectWallet}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
          
          {/* User Tickets Section */}
          <div className="mt-12 md:mt-16">
            <div className="max-w-3xl mx-auto">
              <UserTickets
                contractAddress={MEGAPOT_CONTRACT_ADDRESS}
                isConnected={isConnected}
                userAddress={address}
                connectWallet={handleConnectWallet}
                subscriptionContractAddress={SUBSCRIPTION_CONTRACT_ADDRESS}
                refreshTrigger={refreshTrigger}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">How It Works</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Simple steps to participate in the lottery</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              {
                icon: <WalletIcon className="w-12 h-12 text-btb-primary" />,
                title: "Connect Wallet",
                description: "Connect your wallet to the platform to get started."
              },
              {
                icon: <TicketIcon className="w-12 h-12 text-btb-primary" />,
                title: "Buy Tickets",
                description: "Purchase tickets using USDC. Each ticket costs $1."
              },
              {
                icon: <ArrowPathIcon className="w-12 h-12 text-btb-primary" />,
                title: "Subscribe (Optional)",
                description: "Set up auto-buy to enter draws daily without returning to the website."
              },
              {
                icon: <TrophyIcon className="w-12 h-12 text-btb-primary" />,
                title: "Win Prizes",
                description: "Wait for the draw and check if you've won the jackpot!"
              }
            ].map((step, index) => (
              <MotionCard
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-6 text-center">
                  <div className="flex justify-center mb-4">{step.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-gray-700 dark:text-gray-300">{step.description}</p>
                </div>
              </MotionCard>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Frequently Asked Questions</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Everything you need to know about the Megapot Lottery</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              {[
                {
                  question: "How does the lottery subscription work?",
                  answer: "The auto-buy feature automatically purchases tickets for you every day without you needing to return to the website. Your tickets are entered into each daily draw, so you never miss a chance to win."
                },
                {
                  question: "What are the benefits of subscribing?",
                  answer: "The main benefit is convenience - you never need to remember to visit the site and buy tickets daily. Your subscription handles everything automatically, ensuring you're always entered in the draws for your selected duration."
                },
                {
                  question: "How does the 10% cashback work?",
                  answer: "When you buy a Megapot ticket, you use our custom smart contract that returns the 10% fee that is normally paid to apps, directly to your wallet. It all takes place in one transaction."
                },
                {
                  question: "How do the 50% bonus Megapoints work?",
                  answer: <>BTB is part of Megapot's VIP program. You can learn more <a href="https://docs.megapot.io/appendix/vip-program" target="_blank" rel="noopener noreferrer" className="text-btb-primary hover:underline">here</a>.</>
                },
                {
                  question: "How often are the lottery draws?",
                  answer: "Lottery draws occur every 24 hours. The exact time is displayed in the countdown timer."
                },
                {
                  question: "How is the winner selected?",
                  answer: "Winners are selected randomly using a provably fair algorithm on the blockchain."
                },
                {
                  question: "What is the ticket price?",
                  answer: "Each ticket costs $1 USDC."
                },
                {
                  question: "How big is the jackpot?",
                  answer: "The jackpot size varies based on the number of tickets sold. 70% of all ticket sales go directly to the jackpot. For referred tickets through our app, 20% goes to LPs and 10% goes to BTB Finance."
                },
                {
                  question: "Can I buy multiple tickets?",
                  answer: "Yes, you can buy as many tickets as you want. The more tickets you buy, the higher your chances of winning."
                },
                {
                  question: "Can I cancel my subscription?",
                  answer: "Yes, you can cancel your subscription at any time and receive a refund for the remaining days, minus a small withdrawal fee."
                }
              ].map((faq, index) => (
                <MotionCard
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{faq.question}</h3>
                    <p className="text-gray-700 dark:text-gray-300">{faq.answer}</p>
                  </div>
                </MotionCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-btb-primary to-btb-primary-light text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6">Ready to Try Your Luck?</h2>
            <p className="text-lg md:text-xl mb-6 md:mb-8">Buy tickets now or set up auto-buy so you don't need to return to the website daily!</p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <MotionButton
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-btb-primary hover:bg-gray-100 font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg"
                onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Buy Tickets Now
              </MotionButton>
              <MotionButton
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-indigo-700 text-white hover:bg-indigo-800 font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg"
                onClick={() => document.getElementById('subscription')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Auto-Buy Daily
              </MotionButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
