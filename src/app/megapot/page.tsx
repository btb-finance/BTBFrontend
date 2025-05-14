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
import { Button, MotionButton } from '@/app/components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '@/app/components/ui/card';
import MegapotStats from './components/MegapotStats';
import LotteryCountdown from './components/LotteryCountdown';
import BuyTickets from './components/BuyTickets';
import UserTickets from './components/UserTickets';
import SubscriptionTickets from './components/SubscriptionTickets';
import { useWallet } from '@/app/context/WalletContext';
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
    description: 'Set up automatic daily ticket purchases with our subscription service. Never miss a draw!',
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
        <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/10 via-indigo-500/5 to-btb-primary-light/10 dark:from-btb-primary/10 dark:via-indigo-500/5 dark:to-btb-primary-light/10"></div>
        
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-btb-primary/10 dark:bg-btb-primary/5 blur-3xl"
            animate={{ 
              x: [0, 20, 0], 
              y: [0, -20, 0],
              scale: [1, 1.1, 1] 
            }}
            transition={{ 
              duration: 12, 
              repeat: Infinity, 
              repeatType: "reverse" 
            }}
          />
          <motion.div 
            className="absolute top-1/3 -left-20 w-72 h-72 rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl"
            animate={{ 
              x: [0, -30, 0], 
              y: [0, 30, 0],
              scale: [1, 1.2, 1] 
            }}
            transition={{ 
              duration: 10, 
              repeat: Infinity, 
              repeatType: "reverse",
              delay: 2 
            }}
          />
          <motion.div 
            className="absolute -bottom-40 left-1/3 w-80 h-80 rounded-full bg-amber-500/10 dark:bg-amber-500/5 blur-3xl"
            animate={{ 
              x: [0, 40, 0], 
              y: [0, -20, 0],
              scale: [1, 1.15, 1] 
            }}
            transition={{ 
              duration: 14, 
              repeat: Infinity, 
              repeatType: "reverse",
              delay: 1 
            }}
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          {/* Warning Banner */}
          <motion.div 
            className="relative overflow-hidden border border-red-500 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white p-3 rounded-lg shadow-lg mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Pulsing background effect */}
            <motion.div 
              className="absolute inset-0 bg-red-500/20"
              animate={{ 
                opacity: [0.1, 0.2, 0.1]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                repeatType: "reverse" 
              }}
            />
            
            <div className="flex items-center">
              <div className="mr-3 flex-shrink-0 relative">
                <motion.div
                  className="relative bg-yellow-500 p-1.5 rounded-full"
                  animate={{ 
                    rotate: [0, 5, 0, -5, 0] 
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    className="h-5 w-5 text-red-800" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </motion.div>
              </div>
              
              <div className="relative z-10 flex-1">
                <p className="font-bold text-sm md:text-base">
                  <span className="text-yellow-300">RISK WARNING:</span> Megapot is a third-party lottery application. 
                  Gambling involves risk of losing your investment. Only risk funds you can afford to lose.
                </p>
              </div>
            </div>
          </motion.div>
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
            <div className="w-full lg:w-1/2">
              <motion.h1 
                className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-btb-primary to-gray-900 dark:from-white dark:via-btb-primary dark:to-white mb-4 md:mb-6"
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
                Join the daily jackpot with USDC-backed lottery tickets for your chance to win big! <motion.span 
                  className="font-bold text-btb-primary"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 3 }}
                >
                  EXCLUSIVE BONUS: Earn 50% more MegaPoints
                </motion.span> (tracked onchain) and <motion.span 
                  className="font-bold text-green-500"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity, repeatDelay: 3, delay: 0.5 }}
                >
                  get 10% USDC cashback
                </motion.span> on all purchases when you buy through BTB! <span className="inline-block bg-red-500 text-white font-bold px-2 py-1 rounded-md text-sm transform -rotate-1">Limited time offer!</span>
              </motion.p>
              
              <motion.div 
                className="mb-6 md:mb-8 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 p-4 rounded-lg border-l-4 border-indigo-600 shadow-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <div className="flex items-start">
                  <div className="mr-3 mt-1">
                    <motion.div
                      className="bg-indigo-600 rounded-full p-1.5"
                      animate={{ rotate: [0, 10, 0, -10, 0] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <ArrowPathIcon className="w-5 h-5 text-white" />
                    </motion.div>
                  </div>
                  <div>
                    <h3 className="font-bold text-indigo-700 dark:text-indigo-400 text-lg mb-1">NEW! Auto-Buy Subscription</h3>
                    <p className="text-gray-700 dark:text-gray-300">Set it once and never miss a draw! Our smart contract automatically enters you daily without returning to the site. <span className="italic">Get the same 50% MegaPoints bonus!</span> <span className="font-bold text-green-600 dark:text-green-400">Cancel anytime</span> 🔄</p>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mb-8 lg:mb-0 flex flex-col sm:flex-row gap-4"
              >
                <MotionButton
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-btb-primary to-btb-primary-dark text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg w-full sm:w-auto"
                  onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <TicketIcon className="w-5 h-5 mr-2 inline-block" />
                  Buy Tickets Now
                </MotionButton>
                <MotionButton
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg w-full sm:w-auto"
                  onClick={() => document.getElementById('subscription')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  <ArrowPathIcon className="w-5 h-5 mr-2 inline-block" />
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
                <motion.div 
                  className="absolute -inset-4 bg-gradient-to-r from-btb-primary via-purple-500 to-btb-primary-light rounded-2xl opacity-20 blur-xl"
                  animate={{ 
                    opacity: [0.15, 0.25, 0.15],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{ 
                    duration: 5,
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                ></motion.div>
                
                <div className="relative bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-btb-primary via-purple-500 to-btb-primary-light"></div>
                  
                  <div className="p-6 md:p-8">
                    <div className="flex items-center justify-center mb-6">
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          rotate: [0, 5, 0, -5, 0]
                        }}
                        transition={{ 
                          duration: 2,
                          repeat: Infinity,
                          repeatDelay: 3
                        }}
                      >
                        <TrophyIcon className="w-10 h-10 text-btb-primary mr-3" />
                      </motion.div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Current Jackpot</h3>
                    </div>
                    
                    <motion.div 
                      className="text-center mb-6"
                      animate={{ 
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 3
                      }}
                    >
                      <span className="text-5xl md:text-6xl xl:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary via-purple-500 to-btb-primary-light">
                        ${jackpotAmount ? jackpotAmount.toLocaleString() : '---'}
                      </span>
                    </motion.div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 p-4 rounded-lg text-center shadow-md">
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Ticket Price</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">${ticketPrice || '--'}</p>
                      </div>
                      <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 p-4 rounded-lg text-center shadow-md">
                        <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Participants</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{participants ? participants.toLocaleString() : '--'}</p>
                      </div>
                    </div>
                    
                    <MotionButton
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full bg-gradient-to-r from-btb-primary to-btb-primary-dark hover:from-btb-primary-dark hover:to-btb-primary text-white font-bold py-3 md:py-4 rounded-lg shadow-lg flex items-center justify-center gap-2"
                      onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      <TicketIcon className="w-5 h-5" />
                      <span>Enter Now</span>
                    </MotionButton>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Contract Verification Section */}
      <section className="py-5 md:py-7 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50/30 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/10 border-t border-b border-blue-100 dark:border-blue-900/20">
        <div className="container mx-auto px-4">
          <motion.div 
            className="flex flex-col md:flex-row items-center justify-center md:justify-between"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center mb-4 md:mb-0">
              <motion.div
                className="bg-gradient-to-r from-green-500 to-emerald-600 p-1.5 rounded-full mr-3 shadow-md"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                animate={{ rotate: [0, 10, 0, -10, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
              >
                <ShieldCheckIcon className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <span className="text-sm md:text-base font-bold text-gray-800 dark:text-gray-200 block">
                  Contract Verified & Audited
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Smart contract security validated by independent auditors
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3 items-center">
              <motion.a 
                href={`https://basescan.org/address/${CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm flex items-center px-3 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-blue-200 dark:border-blue-900/30 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all shadow-sm hover:shadow"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Main Contract
              </motion.a>
              
              <motion.a 
                href={`https://basescan.org/address/${SUBSCRIPTION_CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm flex items-center px-3 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-indigo-200 dark:border-indigo-900/30 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm hover:shadow"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Subscription
              </motion.a>
              
              <motion.a 
                href={`https://basescan.org/address/${SCHEDULE_CONTRACT_ADDRESS}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm flex items-center px-3 py-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg border border-purple-200 dark:border-purple-900/30 text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all shadow-sm hover:shadow"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Schedule
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Live Stats Section */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900 relative overflow-hidden">
        {/* Background decoration elements */}
        <div className="absolute inset-0 overflow-hidden">
          <svg className="absolute top-0 right-0 opacity-10 dark:opacity-5" width="350" height="350" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#3B82F6" d="M37.5,-48.4C51.9,-38.6,68.5,-30.8,74.1,-18.3C79.7,-5.8,74.2,11.5,65.5,25.9C56.8,40.3,44.8,51.8,30.8,57C16.7,62.3,0.5,61.4,-16.3,57.8C-33.1,54.3,-50.5,48.1,-60.9,35.7C-71.3,23.3,-74.7,4.7,-70.9,-11.5C-67.1,-27.7,-56,-41.4,-42.4,-51.5C-28.8,-61.5,-12.6,-67.8,0.6,-68.6C13.8,-69.3,23.1,-58.3,37.5,-48.4Z" transform="translate(100 120)" />
          </svg>
          <svg className="absolute bottom-0 left-0 opacity-10 dark:opacity-5" width="350" height="350" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#8B5CF6" d="M45.1,-70.5C60.1,-62.5,75.2,-53.1,79.7,-39.5C84.2,-25.9,78.1,-8.1,73.7,8.2C69.3,24.5,66.6,39.3,57.7,49.7C48.8,60.1,33.7,66.1,18.5,69.2C3.2,72.3,-12.2,72.5,-26.7,68.3C-41.2,64,-54.8,55.5,-65.4,43.2C-76,30.9,-83.6,14.8,-84.1,-1.8C-84.7,-18.5,-78.2,-36.3,-66.8,-47.9C-55.5,-59.5,-39.2,-64.9,-24.2,-73C-9.3,-81.1,5.2,-92,19.3,-89.5C33.3,-87,47,-78.5,45.1,-70.5Z" transform="translate(100 100)" />
          </svg>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-10 md:mb-14"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary via-purple-600 to-indigo-600 dark:from-btb-primary dark:via-purple-400 dark:to-indigo-400 mb-4 md:mb-5 inline-block">
              Live Lottery Stats
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-btb-primary to-indigo-600 mx-auto rounded-full mb-4"></div>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
              Real-time updates on the current lottery round - 
              <span className="text-btb-primary font-medium">next draw happening soon!</span>
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="transform hover:scale-[1.02] transition-transform duration-300"
            >
              <MegapotStats 
                jackpotAmount={jackpotAmount}
                ticketPrice={ticketPrice}
                participants={participants}
                lastWinner={lastWinner}
                isLoading={isLoading}
                contractAddress={CONTRACT_ADDRESS}
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="transform hover:scale-[1.02] transition-transform duration-300"
            >
              <LotteryCountdown contractAddress={CONTRACT_ADDRESS} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Buy Tickets Section */}
      <section id="buy-tickets" className="py-12 md:py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-indigo-200/30 dark:bg-indigo-900/10 blur-3xl"
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 15, 0]
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity,
              repeatType: "reverse" 
            }}
          />
          <motion.div 
            className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-btb-primary/20 dark:bg-btb-primary/10 blur-3xl"
            animate={{ 
              scale: [1, 1.3, 1],
              rotate: [0, -15, 0]
            }}
            transition={{ 
              duration: 25, 
              repeat: Infinity,
              repeatType: "reverse",
              delay: 2
            }}
          />
          
          {/* Pattern overlay */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="inline-block mb-3">
              <div className="flex items-center justify-center bg-btb-primary/10 dark:bg-btb-primary/20 rounded-full p-2 mb-3">
                <TicketIcon className="w-6 h-6 text-btb-primary" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 md:mb-5">
              Enter the <span className="text-btb-primary">Daily Jackpot</span>
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-btb-primary to-indigo-600 mx-auto rounded-full mb-4"></div>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              Choose between one-time tickets with <span className="font-medium text-btb-primary">exclusive 10% cashback</span> or subscribe to auto-enter daily draws!
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
            <motion.div 
              id="subscription" 
              className="order-1 lg:order-1"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur-sm opacity-75"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-indigo-100 dark:border-indigo-900/30 overflow-hidden shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                  <div className="py-3 px-4 bg-indigo-600 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ArrowPathIcon className="w-5 h-5" />
                        <h3 className="font-bold">Auto-Buy Subscription</h3>
                      </div>
                      <span className="bg-white text-indigo-600 text-xs font-bold py-1 px-2 rounded-full">RECOMMENDED</span>
                    </div>
                  </div>
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
            </motion.div>
            
            <motion.div 
              className="order-2 lg:order-2"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-btb-primary to-btb-primary-light rounded-2xl blur-sm opacity-75"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-btb-primary/10 dark:border-btb-primary/30 overflow-hidden shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-btb-primary to-btb-primary-light"></div>
                  <div className="py-3 px-4 bg-btb-primary text-white">
                    <div className="flex items-center space-x-2">
                      <TicketIcon className="w-5 h-5" />
                      <h3 className="font-bold">Buy Single Tickets</h3>
                    </div>
                  </div>
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
                </div>
              </div>
            </motion.div>
          </div>
          
          {/* User Tickets Section */}
          <motion.div 
            className="mt-16 md:mt-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            viewport={{ once: true }}
          >
            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl blur-sm opacity-50"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-amber-200 dark:border-amber-900/30 overflow-hidden shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
                  <div className="py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                    <div className="flex items-center space-x-2">
                      <UserIcon className="w-5 h-5" />
                      <h3 className="font-bold">Your Active Tickets</h3>
                    </div>
                  </div>
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
          </motion.div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute top-0 left-1/4 opacity-10 dark:opacity-5" width="400" height="400" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#3B82F6" d="M52.7,-66.9C68.2,-57.6,80.9,-42.8,85.5,-25.9C90.1,-9,86.7,9.9,78.8,26.5C71,43.1,58.9,57.2,43.9,67C28.9,76.8,11,82.2,-6.2,79.8C-23.3,77.4,-39.7,67.1,-55.3,55C-70.8,42.9,-85.4,29,-87.4,13.7C-89.5,-1.6,-79.1,-18.3,-67,-31.8C-54.9,-45.3,-41.1,-55.5,-27,-63.5C-12.9,-71.6,1.4,-77.4,17.1,-77.4C32.8,-77.4,49.9,-71.4,52.7,-66.9Z" transform="translate(100 100)" />
          </svg>
          <svg className="absolute right-0 bottom-0 opacity-10 dark:opacity-5" width="350" height="350" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <path fill="#8B5CF6" d="M41.8,-51.5C55.4,-46.7,68.2,-33.6,74.1,-16.8C79.9,-0.1,78.8,20.3,69.5,35.9C60.2,51.5,42.7,62.3,25.1,67.1C7.5,71.9,-10.3,70.7,-26.5,64.5C-42.7,58.3,-57.3,47.1,-64.8,31.7C-72.3,16.3,-72.7,-3.3,-67.3,-21.4C-61.9,-39.4,-50.8,-55.8,-36.3,-60.4C-21.9,-65,-3,-57.8,9.5,-53.3C22,-48.8,38,-56.2,41.8,-51.5Z" transform="translate(100 100)" />
          </svg>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="inline-block mb-3">
              <div className="flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/30 dark:to-indigo-500/30 rounded-full p-2 mb-2">
                <PlayCircleIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 md:mb-5">
              How Megapot <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Works</span>
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded-full mb-4"></div>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              Participating is easy! Follow these four simple steps to enter the lottery
            </p>
          </motion.div>
          
          <div className="relative">
            {/* Connecting line between steps (desktop) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-blue-200 via-btb-primary-light to-indigo-300 dark:from-blue-900/50 dark:via-btb-primary-dark/50 dark:to-indigo-900/50 transform -translate-y-1/2"></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-6 relative z-10 max-w-6xl mx-auto">
              {[
                {
                  icon: WalletIcon,
                  iconBg: "from-blue-500 to-blue-600",
                  title: "Connect Wallet",
                  description: "Connect your wallet to the platform to get started with Megapot lottery."
                },
                {
                  icon: TicketIcon,
                  iconBg: "from-btb-primary to-btb-primary-dark",
                  title: "Buy Tickets",
                  description: "Purchase tickets using USDC. Each ticket costs $1 with a 10% cashback to your wallet."
                },
                {
                  icon: ArrowPathIcon,
                  iconBg: "from-indigo-500 to-indigo-600",
                  title: "Subscribe (Optional)",
                  description: "Set up auto-buy to enter draws daily without returning to the website."
                },
                {
                  icon: TrophyIcon,
                  iconBg: "from-amber-500 to-orange-600",
                  title: "Win Prizes",
                  description: "Wait for the daily draw and check if you've won the USDC jackpot!"
                }
              ].map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                    
                    {/* Step number marker */}
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-full shadow-md border border-gray-100 dark:border-gray-700 w-8 h-8 flex items-center justify-center">
                      <span className="text-sm font-bold text-btb-primary">{index + 1}</span>
                    </div>
                    
                    <div className="p-6 md:p-7 text-center">
                      <div className="flex justify-center mb-5">
                        <div className={`p-3 rounded-full bg-gradient-to-br ${step.iconBg} transform transition-transform group-hover:scale-110 shadow-md`}>
                          <step.icon className="w-8 h-8 text-white" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                      <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Call to action */}
          <motion.div 
            className="text-center mt-12 md:mt-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
          >
            <MotionButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-btb-primary to-indigo-600 hover:from-btb-primary-dark hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg"
              onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Start Now
            </MotionButton>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            className="absolute right-1/4 top-20 w-72 h-72 rounded-full bg-purple-200/30 dark:bg-purple-900/10 blur-3xl"
            animate={{ 
              scale: [1, 1.1, 1],
              y: [0, 15, 0]
            }}
            transition={{ 
              duration: 15, 
              repeat: Infinity,
              repeatType: "reverse" 
            }}
          />
          <motion.div 
            className="absolute left-1/4 bottom-20 w-64 h-64 rounded-full bg-blue-200/20 dark:bg-blue-900/10 blur-3xl"
            animate={{ 
              scale: [1, 1.15, 1],
              y: [0, -15, 0]
            }}
            transition={{ 
              duration: 18, 
              repeat: Infinity,
              repeatType: "reverse",
              delay: 3
            }}
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            className="text-center mb-12 md:mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <div className="inline-block mb-3">
              <div className="flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-indigo-500/20 dark:from-purple-500/30 dark:to-indigo-500/30 rounded-full p-2 mb-2">
                <QuestionMarkCircleIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 md:mb-5">
              Frequently Asked <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">Questions</span>
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-purple-500 to-indigo-600 mx-auto rounded-full mb-4"></div>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-3xl mx-auto">
              Everything you need to know about the Megapot Lottery and how to participate
            </p>
          </motion.div>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {[
                {
                  question: "How does the lottery subscription work?",
                  answer: "The auto-buy feature automatically purchases tickets for you every day without you needing to return to the website. Your tickets are entered into each daily draw, so you never miss a chance to win.",
                  icon: ArrowPathIcon,
                  color: "from-blue-500 to-indigo-600"
                },
                {
                  question: "What are the benefits of subscribing?",
                  answer: "The main benefit is convenience - you never need to remember to visit the site and buy tickets daily. Your subscription handles everything automatically, ensuring you're always entered in the draws for your selected duration.",
                  icon: CheckIcon,
                  color: "from-green-500 to-emerald-600"
                },
                {
                  question: "How does the 10% cashback work?",
                  answer: "When you buy a Megapot ticket immediately, you use our custom smart contract that returns the 10% fee directly to your wallet. This cashback benefit is only available for immediate purchases, not for subscriptions.",
                  icon: CurrencyDollarIcon,
                  color: "from-btb-primary to-btb-primary-dark"
                },
                {
                  question: "How do the 50% bonus MegaPoints work?",
                  answer: <>BTB is part of Megapot's VIP program. You earn 50% more MegaPoints for each ticket purchase. Learn more <a href="https://docs.megapot.io/appendix/vip-program" target="_blank" rel="noopener noreferrer" className="text-btb-primary hover:underline font-medium">here</a>.</>,
                  icon: BoltIcon,
                  color: "from-purple-500 to-violet-600"
                },
                {
                  question: "How often are the lottery draws?",
                  answer: "Lottery draws occur every 24 hours. The exact time is displayed in the countdown timer on our website.",
                  icon: ClockIcon,
                  color: "from-orange-500 to-amber-600"
                },
                {
                  question: "How is the winner selected?",
                  answer: "Winners are selected randomly using Pyth Network's Entropy for provably fair and verifiable randomness on the blockchain.",
                  icon: LockClosedIcon,
                  color: "from-indigo-500 to-blue-600"
                },
                {
                  question: "What is the ticket price?",
                  answer: "Each ticket costs $1 USDC. You receive 10% cashback when you purchase through BTB's referral link.",
                  icon: TicketIcon,
                  color: "from-rose-500 to-pink-600" 
                },
                {
                  question: "How big is the jackpot?",
                  answer: "The jackpot size varies based on the number of tickets sold. 70% of all ticket sales go directly to the jackpot. For referred tickets through our app, 20% goes to LPs and 10% goes to BTB Finance.",
                  icon: TrophyIcon,
                  color: "from-amber-500 to-yellow-600"
                },
                {
                  question: "Can I buy multiple tickets?",
                  answer: "Yes, you can buy as many tickets as you want. The more tickets you buy, the higher your chances of winning the jackpot.",
                  icon: TicketIcon,
                  color: "from-cyan-500 to-sky-600"
                },
                {
                  question: "Can I cancel my subscription?",
                  answer: "Yes, you can cancel your subscription at any time and receive a refund for the remaining days, minus a small withdrawal fee.",
                  icon: BanknotesIcon,
                  color: "from-teal-500 to-green-600"
                }
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="relative group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start mb-3">
                        <div className={`p-2 rounded-full bg-gradient-to-br ${faq.color} mr-3 shrink-0`}>
                          <faq.icon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{faq.question}</h3>
                      </div>
                      <div className="ml-10">
                        <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            
            {/* Additional question call to action */}
            <motion.div 
              className="mt-10 text-center p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl border border-indigo-100 dark:border-indigo-800/30 shadow-md"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              viewport={{ once: true }}
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Have More Questions?</h3>
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Join our community or check out the official Megapot documentation for more information.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a 
                  href="https://t.me/btbfinance" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm-4.668 11.857l.648.646c.121.12.249.172.366.154.118-.017.215-.103.289-.255l.708-1.416c.046.015.092.03.137.043l1.5.5c.297.1.505-.01.586-.416l.436-2.179c.079-.394-.03-.569-.404-.665l-3.154-.629c-.387-.077-.613.039-.717.347l-1.24 4.154c-.105.309-.032.496.289.657l1.556.809zm7.168-6.857c-2.486 0-4.5 2.015-4.5 4.5s2.014 4.5 4.5 4.5c2.484 0 4.5-2.015 4.5-4.5s-2.016-4.5-4.5-4.5zm-.553 6.836l-.856-2.562c-.143-.427-.317-.579-.736-.579h-.333v-1.071c0-.285-.143-.429-.429-.429h-.857c-.285 0-.429.144-.429.429v1.071h-.53c-.241 0-.365.124-.365.365v.673c0 .241.124.364.365.364h.53v3.535c0 .285.144.429.429.429h.857c.286 0 .429-.144.429-.429v-3.535h.245c.245 0 .365-.123.365-.364v-.673c0-.241-.12-.365-.365-.365h-.245v-.331h.121c.122 0 .183.061.245.245l.856 2.562c.061.184.184.245.368.245h.857c.245 0 .347-.184.245-.429z" />
                  </svg>
                  Join Telegram
                </a>
                <a 
                  href="https://docs.megapot.io/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 rounded-lg transition-colors dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Megapot Docs
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-btb-primary via-purple-600 to-indigo-600"></div>
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white/20"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                width: `${Math.random() * 30 + 10}px`,
                height: `${Math.random() * 30 + 10}px`,
              }}
              animate={{
                y: [0, -100],
                opacity: [0, 0.7, 0],
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.div 
              className="bg-white/10 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-white/20 shadow-2xl"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  viewport={{ once: true }}
                  className="mb-6 inline-block"
                >
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-white/30 blur-md"></div>
                    <div className="relative bg-white/20 p-4 rounded-full">
                      <TrophyIcon className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </motion.div>
                
                <motion.h2 
                  className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 md:mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                >
                  Ready to Join the Next <br />
                  <span className="text-yellow-300">Winning Jackpot?</span>
                </motion.h2>
                
                <motion.p 
                  className="text-lg md:text-xl text-white/90 mb-8 md:mb-10"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  Buy tickets now and get <span className="font-bold text-yellow-300">10% cashback</span> on every purchase, 
                  or set up auto-buy and never miss a draw!
                </motion.p>
                
                <motion.div 
                  className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  viewport={{ once: true }}
                >
                  <MotionButton
                    whileHover={{ scale: 1.05, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-white text-btb-primary hover:text-btb-primary-dark font-bold py-4 px-8 rounded-xl shadow-xl text-lg w-full sm:w-auto flex justify-center items-center gap-2"
                    onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <TicketIcon className="w-5 h-5" />
                    <span>Buy Tickets Now</span>
                  </MotionButton>
                  
                  <MotionButton
                    whileHover={{ scale: 1.05, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-indigo-900/60 backdrop-blur-sm border border-indigo-500/50 text-white hover:bg-indigo-900/80 font-bold py-4 px-8 rounded-xl shadow-xl text-lg w-full sm:w-auto flex justify-center items-center gap-2"
                    onClick={() => document.getElementById('subscription')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <ArrowPathIcon className="w-5 h-5" />
                    <span>Auto-Buy Daily</span>
                  </MotionButton>
                </motion.div>
                
                <motion.p 
                  className="mt-8 text-white/80 text-sm flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  viewport={{ once: true }}
                >
                  <ShieldCheckIcon className="w-5 h-5 mr-2" /> 
                  Verified contract · Secure transactions · Instant prize delivery
                </motion.p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
