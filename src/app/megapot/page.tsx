'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowPathIcon,
  TicketIcon,
  BanknotesIcon,
  BoltIcon,
  ClockIcon,
  CurrencyDollarIcon,
  GiftIcon,
  LockClosedIcon,
  TrophyIcon,
  ShieldCheckIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/app/components/ui/button';
import MegapotStats from './components/MegapotStats';
import LotteryCountdown from './components/LotteryCountdown';
import { useWallet } from '@/app/context/WalletContext';
import { ethers } from 'ethers';
import megapotABI from './megapotabi.json';
import useNetworkSwitcher from '@/app/hooks/useNetworkSwitcher';
import GrainOverlay from '@/app/components/home/bolder/GrainOverlay';

// Contract addresses
const CONTRACT_ADDRESS = '0xbEDd4F2beBE9E3E636161E644759f3cbe3d51B95';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const SUBSCRIPTION_CONTRACT_ADDRESS = '0x819eB717232992db08F0B8ffA9704DE496c136B5';
const SCHEDULE_CONTRACT_ADDRESS = '0x92C1fce71847cd68a794A3377741b372F392b25a';

export default function MegapotPage() {
  const { isConnected, address, connectWallet } = useWallet();
  const { switchNetwork } = useNetworkSwitcher();
  const [jackpotAmount, setJackpotAmount] = useState<number | null>(null);
  const [ticketPrice, setTicketPrice] = useState<number | null>(null);
  const [participants, setParticipants] = useState<number | null>(null);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch contract data
  useEffect(() => {
    const fetchContractData = async () => {
      try {
        // Use public provider for Base network
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(CONTRACT_ADDRESS, megapotABI, provider);

        // Get jackpot pool size
        const lpPoolTotal = await contract.lpPoolTotal();
        setJackpotAmount(parseFloat(ethers.formatUnits(lpPoolTotal, 6)));

        // Get ticket price
        const price = await contract.ticketPrice();
        setTicketPrice(parseFloat(ethers.formatUnits(price, 6)));

        // Get last winner
        const winner = await contract.lastWinnerAddress();
        setLastWinner(winner);

        // Get active participants count
        const ticketCountTotalBps = await contract.ticketCountTotalBps();
        const actualParticipants = Math.ceil(Number(ticketCountTotalBps / BigInt(10000)) / 3);
        setParticipants(actualParticipants);

        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching contract data:', error);
        setIsLoading(false);
      }
    };

    fetchContractData();
  }, []);

  // Network switching logic
  useEffect(() => {
    if (isConnected && typeof window !== 'undefined' && window.ethereum) {
      const checkNetwork = async () => {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum as any);
          const network = await provider.getNetwork();
          if (Number(network.chainId) !== 8453) {
            switchNetwork('BASE');
          }
        } catch (e) {
          console.error(e);
        }
      };
      checkNetwork();
    }
  }, [isConnected, switchNetwork]);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      <GrainOverlay opacity={0.05} />

      {/* Ambient Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute top-[40%] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-amber-500/5 blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <SparklesIcon className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white/80 tracking-wide">USDC-BACKED LOTTERY</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50">
              MEGAPOT
            </span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            The daily jackpot protocol. Provably fair, instantly paid, and fully on-chain.
            <span className="block mt-2 text-amber-400/90 font-medium">
              Win big with USDC.
            </span>
          </p>
        </motion.div>

        {/* Main Stats Display - The Monolith */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-20">
          {/* Jackpot Display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="lg:col-span-8 relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500 opacity-50" />
            <div className="relative h-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 flex flex-col justify-center items-center overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <h3 className="text-white/40 text-sm font-bold tracking-[0.2em] uppercase mb-4">Current Jackpot</h3>
              <div className="text-7xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 tracking-tighter">
                ${jackpotAmount ? jackpotAmount.toLocaleString() : '---'}
              </div>
              <div className="mt-6 flex items-center gap-2 text-green-400 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-bold">LIVE ROUND ACTIVE</span>
              </div>
            </div>
          </motion.div>

          {/* Side Stats */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Ticket Price */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white/40 text-xs font-bold tracking-[0.2em] uppercase">Ticket Price</h3>
                  <TicketIcon className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-4xl font-bold text-white">${ticketPrice || '--'}</div>
                <div className="text-white/40 text-sm mt-1">USDC per entry</div>
              </div>
            </motion.div>

            {/* Participants */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white/40 text-xs font-bold tracking-[0.2em] uppercase">Players</h3>
                  <TrophyIcon className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-4xl font-bold text-white">{participants ? participants.toLocaleString() : '--'}</div>
                <div className="text-white/40 text-sm mt-1">Active in this round</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Interactive Interfaces */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left: Stats & Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-1 overflow-hidden">
              <MegapotStats
                jackpotAmount={jackpotAmount}
                ticketPrice={ticketPrice}
                participants={participants}
                lastWinner={lastWinner}
                isLoading={isLoading}
                contractAddress={CONTRACT_ADDRESS}
              />
            </div>

            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-1 overflow-hidden">
              <LotteryCountdown contractAddress={CONTRACT_ADDRESS} />
            </div>
          </motion.div>

          {/* Right: Actions (Buy Tickets) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/50"
            id="buy-tickets"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10">
                <TicketIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Get Tickets</h2>
                <p className="text-white/40 text-sm">Enter the next draw</p>
              </div>
            </div>

            {/* Placeholder for the actual buy component logic which would be imported or implemented here */}
            <div className="p-8 rounded-2xl bg-black/40 border border-white/5 text-center">
              <p className="text-white/60 mb-6">
                Connect your wallet to purchase tickets directly with USDC.
              </p>
              <Button
                onClick={connectWallet}
                className="w-full bg-white text-black hover:bg-gray-200 font-bold py-4 rounded-xl transition-all"
              >
                {isConnected ? 'Purchase Interface Loading...' : 'Connect Wallet'}
              </Button>
            </div>

            {/* Features List */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <ShieldCheckIcon className="w-6 h-6 text-green-400 mb-2" />
                <div className="text-sm font-bold text-white">Verified</div>
                <div className="text-xs text-white/40">Audited Contract</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                <BoltIcon className="w-6 h-6 text-amber-400 mb-2" />
                <div className="text-sm font-bold text-white">Instant</div>
                <div className="text-xs text-white/40">Automated Payouts</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer / Contract Links */}
        <div className="mt-20 pt-10 border-t border-white/5 flex flex-wrap justify-center gap-6 text-sm text-white/40">
          <a
            href={`https://basescan.org/address/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <LockClosedIcon className="w-4 h-4" />
            Main Contract
          </a>
          <a
            href={`https://basescan.org/address/${SUBSCRIPTION_CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Subscription Contract
          </a>
        </div>

      </div>
    </div>
  );
}
