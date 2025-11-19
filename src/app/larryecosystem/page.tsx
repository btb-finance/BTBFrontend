'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWalletConnection } from '../hooks/useWalletConnection';
import {
  ChartBarIcon,
  LockIcon,
  ArrowRightLeftIcon,
  TrendingUpIcon,
  ShieldIcon,
  WalletIcon,
  CoinsIcon,
  CreditCardIcon,
  ArrowUpDownIcon,
  DollarSignIcon,
  XCircleIcon,
  CheckCircleIcon,
  InfoIcon
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import larryService from '../services/larryService';
import { formatNumber } from '../utils/formatNumber';
import GrainOverlay from '@/app/components/home/bolder/GrainOverlay';

export default function LarryEcosystemPage() {
  const { isConnected, address } = useWalletConnection();
  const [activeTab, setActiveTab] = useState<'trade' | 'leverage' | 'borrow'>('trade');

  // State
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [ethAmount, setEthAmount] = useState('');
  const [larryAmount, setLarryAmount] = useState('');
  const [leverageEthAmount, setLeverageEthAmount] = useState('');
  const [leverageDays, setLeverageDays] = useState('30');
  const [borrowEthAmount, setBorrowEthAmount] = useState('');
  const [borrowDays, setBorrowDays] = useState('365');

  // Data states
  const [larryStats, setLarryStats] = useState({
    larryPrice: '0',
    totalSupply: '0',
    backing: '0',
    userLarryBalance: '0',
    userEthBalance: '0',
    totalBorrowed: '0',
    totalCollateral: '0',
    buyFee: '0',
    sellFee: '0'
  });

  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [sellQuote, setSellQuote] = useState<any>(null);

  // Network check
  useEffect(() => {
    const checkNetwork = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
          setIsCorrectNetwork(chainId === '0x2105'); // Base
        } catch (error) {
          console.error('Error checking network:', error);
        }
      }
    };
    checkNetwork();
  }, []);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [price, metrics, contractStatus] = await Promise.all([
          larryService.getCurrentPrice(),
          larryService.getTokenMetrics(),
          larryService.getContractStatus()
        ]);

        let userBalance = '0';
        let ethBalance = '0';

        if (isConnected && address) {
          userBalance = await larryService.getUserBalance(address);
          if ((window as any).ethereum) {
            const balance = await (window as any).ethereum.request({
              method: 'eth_getBalance',
              params: [address, 'latest']
            });
            ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);
          }
        }

        setLarryStats({
          larryPrice: price,
          totalSupply: metrics.totalSupply,
          backing: metrics.backing,
          userLarryBalance: userBalance,
          userEthBalance: ethBalance,
          totalBorrowed: contractStatus.totalBorrowed,
          totalCollateral: contractStatus.totalCollateral,
          buyFee: contractStatus.buyFee,
          sellFee: contractStatus.sellFee
        });
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address]);

  // Quote effects
  useEffect(() => {
    const getQuote = async () => {
      if (!ethAmount || isNaN(Number(ethAmount))) {
        setBuyQuote(null);
        return;
      }
      try {
        const quote = await larryService.quoteBuy(ethAmount);
        setBuyQuote(quote);
      } catch (error) {
        setBuyQuote(null);
      }
    };
    getQuote();
  }, [ethAmount]);

  useEffect(() => {
    const getQuote = async () => {
      if (!larryAmount || isNaN(Number(larryAmount))) {
        setSellQuote(null);
        return;
      }
      try {
        const quote = await larryService.quoteSell(larryAmount);
        setSellQuote(quote);
      } catch (error) {
        setSellQuote(null);
      }
    };
    getQuote();
  }, [larryAmount]);

  // Actions
  const connectWallet = async () => {
    setLoading(true);
    try {
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const executeBuy = async () => {
    if (!isConnected || !ethAmount) return;
    setLoading(true);
    try {
      await larryService.buyTokens(ethAmount);
      setSuccess('LARRY purchased successfully!');
      setEthAmount('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const executeSell = async () => {
    if (!isConnected || !larryAmount) return;
    setLoading(true);
    try {
      await larryService.sellTokens(larryAmount);
      setSuccess('LARRY sold successfully!');
      setLarryAmount('');
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-green-500/30">
      <GrainOverlay opacity={0.05} />

      {/* Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-green-900/10 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <ChartBarIcon className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-white/80 tracking-wide">DECENTRALIZED STABILITY</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50">
              LARRY
            </span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            The rebase-less stability token. Trade, leverage, and borrow with confidence.
            <span className="block mt-2 text-green-400/90 font-medium">
              Current Price: Ξ {parseFloat(larryStats.larryPrice).toFixed(8)}
            </span>
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Total Collateral', value: formatNumber(larryStats.totalCollateral, 0), icon: LockIcon, color: 'text-purple-400' },
            { label: 'Total Borrowed', value: formatNumber(larryStats.totalBorrowed, 2), icon: ShieldIcon, color: 'text-blue-400' },
            { label: 'ETH Backing', value: formatNumber(larryStats.backing, 4), icon: DollarSignIcon, color: 'text-orange-400' },
            { label: 'LARRY Price', value: `Ξ ${parseFloat(larryStats.larryPrice).toFixed(6)}`, icon: TrendingUpIcon, color: 'text-green-400' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-white/40 text-xs font-bold uppercase tracking-wider">{stat.label}</span>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Main Interface */}
        <div className="max-w-2xl mx-auto">
          {!isConnected ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center"
            >
              <WalletIcon className="w-16 h-16 text-white/20 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-4">Connect Wallet</h2>
              <p className="text-white/40 mb-8">Connect your wallet to access the Larry Ecosystem.</p>
              <Button
                onClick={connectWallet}
                className="w-full bg-white text-black hover:bg-gray-200 font-bold py-4 rounded-xl transition-all"
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden"
            >
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                {['trade', 'leverage', 'borrow'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`flex-1 py-6 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === tab
                        ? 'text-white bg-white/5'
                        : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-8">
                {/* Messages */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2"
                    >
                      <XCircleIcon className="w-5 h-5" />
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-2"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Trade Tab */}
                {activeTab === 'trade' && (
                  <div className="space-y-6">
                    {/* Buy Section */}
                    <div className="space-y-4">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>PAY (ETH)</span>
                        <span>BAL: {larryStats.userEthBalance}</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          value={ethAmount}
                          onChange={(e) => setEthAmount(e.target.value)}
                          placeholder="0.0"
                          className="w-full bg-transparent border-b border-white/20 py-2 text-3xl font-light text-white focus:outline-none focus:border-green-500 transition-colors placeholder-white/10"
                        />
                        <div className="absolute right-0 bottom-2 flex items-center gap-2 text-white/40">
                          <CreditCardIcon className="w-5 h-5" />
                          <span>ETH</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <ArrowUpDownIcon className="w-6 h-6 text-white/20" />
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between text-xs text-white/40">
                        <span>RECEIVE (LARRY)</span>
                        <span>ESTIMATED</span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={buyQuote ? formatNumber(buyQuote.tokenAmount, 2) : '0.00'}
                          readOnly
                          className="w-full bg-transparent border-b border-white/10 py-2 text-3xl font-light text-green-400 focus:outline-none"
                        />
                        <div className="absolute right-0 bottom-2 flex items-center gap-2 text-white/40">
                          <CoinsIcon className="w-5 h-5" />
                          <span>LARRY</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={executeBuy}
                      disabled={loading || !ethAmount}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20"
                    >
                      {loading ? 'Processing...' : 'BUY LARRY'}
                    </Button>

                    {/* Sell Section (Collapsed/Secondary) */}
                    <div className="pt-8 border-t border-white/10">
                      <h3 className="text-sm font-bold text-white/40 uppercase mb-4">Sell LARRY</h3>
                      <div className="flex gap-4">
                        <div className="flex-1 relative">
                          <input
                            type="number"
                            value={larryAmount}
                            onChange={(e) => setLarryAmount(e.target.value)}
                            placeholder="0.0"
                            className="w-full bg-transparent border-b border-white/20 py-2 text-xl font-light text-white focus:outline-none focus:border-red-500 transition-colors placeholder-white/10"
                          />
                        </div>
                        <Button
                          onClick={executeSell}
                          disabled={loading || !larryAmount}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold px-6 rounded-xl transition-all"
                        >
                          SELL
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Leverage Tab Placeholder */}
                {activeTab === 'leverage' && (
                  <div className="text-center py-12">
                    <InfoIcon className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Leverage Trading</h3>
                    <p className="text-white/40">Coming soon to the Obsidian interface.</p>
                  </div>
                )}

                {/* Borrow Tab Placeholder */}
                {activeTab === 'borrow' && (
                  <div className="text-center py-12">
                    <InfoIcon className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Borrowing</h3>
                    <p className="text-white/40">Coming soon to the Obsidian interface.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}