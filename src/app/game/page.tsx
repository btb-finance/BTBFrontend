'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import gameService from './services/gameService';
import {
  SparklesIcon,
  FireIcon,
  GiftIcon,
  ArrowsRightLeftIcon,
  ShieldExclamationIcon,
  CurrencyDollarIcon,
  TrophyIcon
} from '@heroicons/react/24/outline';
import { Button } from '../components/ui/button';
import {
  GameDashboard,
  DepositBear,
  FeedHunter,
  HuntMimo,
  RedeemBear,
  HunterCard,
  GameOverview,
  MiMoProtectionWarning,
  StakingPanel
} from './components';
import GrainOverlay from '@/app/components/home/bolder/GrainOverlay';

export default function GamePanel() {
  const { isConnected } = useWallet();
  const [activeTab, setActiveTab] = useState('overview');

  // Game Stats
  const [gameStats, setGameStats] = useState({
    mimoBalance: '0',
    bearNFTBalance: '0',
    hunterNFTBalance: '0',
    btbBalance: '0',
    lpBalance: '0',
    totalHunted: '0',
    swapRate: '0'
  });

  const [hunterTokens, setHunterTokens] = useState<any[]>([]);
  const [bearTokens, setBearTokens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch Data Logic
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const swapRate = await gameService.getSwapRate();

        if (isConnected) {
          const [mimo, bear, hunter, btb, lp] = await Promise.all([
            gameService.getMiMoBalance(),
            gameService.getBearNFTBalance(),
            gameService.getHunterNFTBalance(),
            gameService.getBTBBalance(),
            gameService.getLPTokenBalance()
          ]);

          setGameStats({
            mimoBalance: mimo,
            bearNFTBalance: bear,
            hunterNFTBalance: hunter,
            btbBalance: btb,
            lpBalance: lp,
            totalHunted: '0', // This would be summed from hunters
            swapRate
          });

          // Load NFTs
          const hunters = await gameService.getUserHunters();
          const bears = await gameService.getUserBears();
          setHunterTokens(hunters);
          setBearTokens(bears);
        } else {
          setGameStats(prev => ({ ...prev, swapRate }));
        }
      } catch (error) {
        console.error('Error fetching game data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const handleRefresh = async () => {
    // Simplified refresh logic for brevity
    setIsLoading(true);
    // ... (re-fetch logic would go here)
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-indigo-500/30">
      <GrainOverlay opacity={0.05} />

      {/* Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-indigo-900/20 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] right-[20%] w-[60%] h-[60%] bg-purple-900/20 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 md:py-20">

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
            <TrophyIcon className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-medium text-white/80 tracking-wide">BEAR HUNTER ECOSYSTEM</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/50">
              ARENA
            </span>
          </h1>

          <p className="text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
            Hunt, feed, and battle. Collect NFTs and earn rewards in the MiMoGaMe universe.
          </p>
        </motion.div>

        {/* Stats Bar */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12"
          >
            {[
              { label: 'MiMo', value: parseFloat(gameStats.mimoBalance).toFixed(0), color: 'bg-purple-500' },
              { label: 'Bears', value: gameStats.bearNFTBalance, color: 'bg-orange-500' },
              { label: 'Hunters', value: gameStats.hunterNFTBalance, color: 'bg-red-500' },
              { label: 'BTB', value: parseFloat(gameStats.btbBalance).toFixed(2), color: 'bg-blue-500' },
              { label: 'Hunted', value: parseFloat(gameStats.totalHunted).toFixed(0), color: 'bg-green-500' },
              { label: 'LP', value: parseFloat(gameStats.lpBalance).toFixed(2), color: 'bg-indigo-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                  <span className="text-xs font-bold text-white/40 uppercase">{stat.label}</span>
                </div>
                <div className="text-xl font-bold text-white">{stat.value}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Main Game Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Game Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-white/10 scrollbar-hide">
              {[
                { id: 'overview', icon: SparklesIcon, label: 'Overview' },
                { id: 'deposit', icon: GiftIcon, label: 'Deposit' },
                { id: 'feed', icon: FireIcon, label: 'Feed' },
                { id: 'hunt', icon: ShieldExclamationIcon, label: 'Hunt' },
                { id: 'redeem', icon: ArrowsRightLeftIcon, label: 'Redeem' },
                { id: 'staking', icon: CurrencyDollarIcon, label: 'Staking' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-5 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === tab.id
                      ? 'text-white bg-white/5 border-b-2 border-indigo-500'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-8 min-h-[400px]">
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <GameOverview
                      gameStats={gameStats}
                      hunterTokens={hunterTokens}
                      bearTokens={bearTokens}
                    />
                  </motion.div>
                )}
                {activeTab === 'deposit' && (
                  <motion.div
                    key="deposit"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <DepositBear
                      bearTokens={bearTokens}
                      onSuccess={handleRefresh}
                    />
                  </motion.div>
                )}
                {activeTab === 'feed' && (
                  <motion.div
                    key="feed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <FeedHunter
                      hunterTokens={hunterTokens}
                      onSuccess={handleRefresh}
                    />
                  </motion.div>
                )}
                {activeTab === 'hunt' && (
                  <motion.div
                    key="hunt"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <HuntMimo
                      hunterTokens={hunterTokens}
                      mimoBalance={gameStats.mimoBalance}
                      onSuccess={handleRefresh}
                    />
                  </motion.div>
                )}
                {activeTab === 'redeem' && (
                  <motion.div
                    key="redeem"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <RedeemBear
                      mimoBalance={gameStats.mimoBalance}
                      swapRate={gameStats.swapRate}
                      onSuccess={handleRefresh}
                    />
                  </motion.div>
                )}
                {activeTab === 'staking' && (
                  <motion.div
                    key="staking"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <StakingPanel onSuccess={handleRefresh} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Right Column: NFT Inventory */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-bold text-white">Your Hunters</h3>
              <p className="text-white/40 text-sm">Manage your NFT inventory</p>
            </div>

            <div className="p-6 flex-1 overflow-y-auto max-h-[600px] space-y-4 custom-scrollbar">
              {isLoading ? (
                <div className="text-center py-12 text-white/40">Loading inventory...</div>
              ) : hunterTokens.length > 0 ? (
                hunterTokens.map((hunter, index) => (
                  <div key={index} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors">
                    <HunterCard
                      hunter={hunter}
                      onFeed={handleRefresh}
                      onHunt={handleRefresh}
                    />
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <SparklesIcon className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <p className="text-white/40">No hunters found. Deposit a Bear to start!</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}