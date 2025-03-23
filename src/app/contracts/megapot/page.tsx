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
  WalletIcon
} from '@heroicons/react/24/outline';
import { Button, MotionButton } from '../../components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '../../components/ui/card';
import MegapotStats from './components/MegapotStats';
import LotteryCountdown from './components/LotteryCountdown';
import BuyTickets from './components/BuyTickets';
import UserTickets from './components/UserTickets';
import { useWallet } from '../../context/WalletContext';
import { ethers } from 'ethers';
import megapotABI from './megapotabi.json';

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
    title: 'Referral Rewards',
    description: 'Earn 5% in referral fees when friends buy tickets using your referral address.',
    icon: GiftIcon,
    color: 'from-green-500 to-teal-600'
  },
  {
    title: 'MegaPoints Bonus',
    description: 'Earn 50% more MegaPoints (tracked onchain) as BTB is a VIP partner site of Megapot.',
    icon: TrophyIcon,
    color: 'from-purple-500 to-pink-600',
    highlight: true
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
const NETWORK = 'base';

export default function MegapotPage() {
  const { isConnected, address, connectWallet } = useWallet();
  const [jackpotAmount, setJackpotAmount] = useState<number | null>(null);
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);
  const [participants, setParticipants] = useState<number | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Contract addresses
  const MEGAPOT_CONTRACT_ADDRESS = CONTRACT_ADDRESS;

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
                Buy tickets with USDC for a chance to win the jackpot. The more tickets you buy, the higher your chances of winning! ⚡ BONUS: Earn 50% more MegaPoints (tracked onchain) as BTB is a VIP partner site of Megapot!
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
                  className="bg-btb-primary hover:bg-btb-primary-dark text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg w-full sm:w-auto"
                  onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Buy Tickets Now
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
            />
            <UserTickets
              contractAddress={MEGAPOT_CONTRACT_ADDRESS}
              isConnected={isConnected}
              userAddress={address}
              connectWallet={handleConnectWallet}
            />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
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
                  answer: "The jackpot size varies based on the number of tickets sold. 90% of all ticket sales go directly to the jackpot."
                },
                {
                  question: "Can I buy multiple tickets?",
                  answer: "Yes, you can buy as many tickets as you want. The more tickets you buy, the higher your chances of winning."
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
            <p className="text-lg md:text-xl mb-6 md:mb-8">Buy your tickets now and get a chance to win the jackpot!</p>
            <MotionButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-btb-primary hover:bg-gray-100 font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg w-full sm:w-auto"
              onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Buy Tickets Now
            </MotionButton>
          </div>
        </div>
      </section>
    </div>
  );
}
