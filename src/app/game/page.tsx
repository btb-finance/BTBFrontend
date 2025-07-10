'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import gameService from './services/gameService';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  SparklesIcon,
  FireIcon,
  GiftIcon,
  ArrowsRightLeftIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';
import {
  GameDashboard,
  DepositBear,
  FeedHunter,
  HuntMimo,
  RedeemBear,
  HunterCard,
  GameOverview,
  MiMoProtectionWarning
} from './components';

export default function GamePanel() {
  const { isConnected } = useWallet();
  const [gameStats, setGameStats] = useState({
    mimoBalance: '0',
    bearNFTBalance: '0',
    hunterNFTBalance: '0',
    btbBalance: '0',
    totalHunted: '0',
    swapRate: '0'
  });
  const [hunterTokens, setHunterTokens] = useState<any[]>([]);
  const [bearTokens, setBearTokens] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingHunters, setIsLoadingHunters] = useState<boolean>(false);
  const [isLoadingBears, setIsLoadingBears] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Always fetch swap rate regardless of connection status
        const swapRate = await gameService.getSwapRate();
        
        if (isConnected) {
          // Get user balances first and show immediately
          setLoadingProgress('Loading balances...');
          
          const mimoBalance = await gameService.getMiMoBalance();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const bearBalance = await gameService.getBearNFTBalance();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const hunterBalance = await gameService.getHunterNFTBalance();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const btbBalance = await gameService.getBTBBalance();
          await new Promise(resolve => setTimeout(resolve, 100));

          // Update stats immediately with balances
          setGameStats({
            mimoBalance,
            bearNFTBalance: bearBalance,
            hunterNFTBalance: hunterBalance,
            btbBalance,
            totalHunted: '0',
            swapRate
          });
          
          // Set main loading to false so UI shows with balances
          setIsLoading(false);
          
          // Load NFTs in background
          setIsLoadingHunters(true);
          setIsLoadingBears(true);
          
          // Load hunters progressively
          const loadHuntersProgressively = async () => {
            try {
              for await (const { hunters, loaded, total } of gameService.getUserHuntersProgressive()) {
                setHunterTokens(hunters);
                setLoadingProgress(`Loading hunters: ${loaded}/${total}`);
                
                if (loaded === total) {
                  setIsLoadingHunters(false);
                  setLoadingProgress('');
                }
              }
            } catch (error) {
              console.error('Error loading hunters:', error);
              setIsLoadingHunters(false);
              setLoadingProgress('');
            }
          };
          
          // Load bears normally (they're usually fewer)
          const loadBears = async () => {
            try {
              const bears = await gameService.getUserBears();
              setBearTokens(bears);
              setIsLoadingBears(false);
            } catch (error) {
              console.error('Error loading bears:', error);
              setIsLoadingBears(false);
            }
          };
          
          // Start both operations
          loadHuntersProgressively();
          loadBears();
          
        } else {
          setGameStats(prev => ({
            ...prev,
            swapRate
          }));
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Set up interval to refresh data every 60 minutes
    const interval = setInterval(fetchData, 3600000);
    
    return () => clearInterval(interval);
  }, [isConnected]);

  const handleRefresh = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      
      // Get updated balances with delays
      const mimoBalance = await gameService.getMiMoBalance();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const bearBalance = await gameService.getBearNFTBalance();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const hunterBalance = await gameService.getHunterNFTBalance();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const btbBalance = await gameService.getBTBBalance();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const swapRate = await gameService.getSwapRate();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Invalidate cache to ensure fresh data
      gameService.invalidateCache();
      
      // Get updated Hunter NFTs with stats
      const hunters = await gameService.getUserHunters();
      
      // Get updated Bear NFTs
      const bears = await gameService.getUserBears();
      
      setGameStats({
        mimoBalance,
        bearNFTBalance: bearBalance,
        hunterNFTBalance: hunterBalance,
        btbBalance,
        totalHunted: hunters.reduce((total: number, hunter: any) => total + parseFloat(hunter.totalHunted || '0'), 0).toString(),
        swapRate
      });
      
      setHunterTokens(hunters);
      setBearTokens(bears);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 mb-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">MiMoGaMe Arena</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base leading-relaxed">
                Hunt, feed, and battle in the Bear Hunter Ecosystem
              </p>
            </div>
            
            <div className="flex-shrink-0 w-full sm:w-auto">
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/60 dark:to-gray-900/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-gray-700/40 shadow-sm flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all w-full sm:w-auto"
                disabled={isLoading}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-transform ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                <span className="text-sm font-medium">{isLoading ? 'Refreshing...' : 'Refresh'}</span>
              </Button>
            </div>
          </div>

          {/* Stats Grid - Better Mobile Layout */}
          {isConnected && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
              <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                    </span>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">MiMo</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-right">{parseFloat(gameStats.mimoBalance).toFixed(0)}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-orange-500"></span>
                    </span>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">Bears</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-right">{gameStats.bearNFTBalance}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-red-500"></span>
                    </span>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">Hunters</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-right">{gameStats.hunterNFTBalance}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    </span>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">BTB</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-right">{parseFloat(gameStats.btbBalance).toFixed(2)}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                    </span>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">Hunted</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-right">{parseFloat(gameStats.totalHunted).toFixed(0)}</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex-shrink-0">
                      <span className="h-2 w-2 rounded-full bg-yellow-500"></span>
                    </span>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">Rate</p>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-right">{parseFloat(gameStats.swapRate).toFixed(0)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* MiMo Protection Warning */}
        {isConnected && parseFloat(gameStats.mimoBalance) > 0 && (
          <MiMoProtectionWarning 
            mimoBalance={gameStats.mimoBalance}
          />
        )}
        
        {/* Main Game Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Left Column - Game Actions */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <Tabs defaultValue="overview" className="w-full">
                  {/* Mobile: Dropdown style tabs for small screens */}
                  <div className="block sm:hidden mb-4">
                    <TabsList className="grid grid-cols-2 gap-1 h-auto p-1">
                      <TabsTrigger value="overview" className="flex items-center justify-center gap-1 px-2 py-2 text-xs">
                        <SparklesIcon className="h-3 w-3" />
                        <span>Overview</span>
                      </TabsTrigger>
                      <TabsTrigger value="deposit" className="flex items-center justify-center gap-1 px-2 py-2 text-xs">
                        <GiftIcon className="h-3 w-3" />
                        <span>Deposit</span>
                      </TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-1 h-auto p-1 mt-1">
                      <TabsTrigger value="feed" className="flex items-center justify-center gap-1 px-2 py-2 text-xs">
                        <FireIcon className="h-3 w-3" />
                        <span>Feed</span>
                      </TabsTrigger>
                      <TabsTrigger value="hunt" className="flex items-center justify-center gap-1 px-2 py-2 text-xs">
                        <ShieldExclamationIcon className="h-3 w-3" />
                        <span>Hunt</span>
                      </TabsTrigger>
                    </TabsList>
                    <TabsList className="grid grid-cols-2 gap-1 h-auto p-1 mt-1">
                      <TabsTrigger value="redeem" className="flex items-center justify-center gap-1 px-2 py-2 text-xs">
                        <ArrowsRightLeftIcon className="h-3 w-3" />
                        <span>Redeem</span>
                      </TabsTrigger>
                      <TabsTrigger value="swap" className="flex items-center justify-center gap-1 px-2 py-2 text-xs">
                        <ArrowsRightLeftIcon className="h-3 w-3" />
                        <span>Swap</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tablet and Desktop: Original layout */}
                  <TabsList className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-6 mb-4 lg:mb-6 h-auto p-1">
                    <TabsTrigger value="overview" className="flex items-center justify-center gap-1 px-2 lg:px-3 py-2 text-xs lg:text-sm">
                      <SparklesIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span className="hidden lg:inline">Overview</span>
                      <span className="lg:hidden">Over</span>
                    </TabsTrigger>
                    <TabsTrigger value="deposit" className="flex items-center justify-center gap-1 px-2 lg:px-3 py-2 text-xs lg:text-sm">
                      <GiftIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span className="hidden lg:inline">Deposit</span>
                      <span className="lg:hidden">Dep</span>
                    </TabsTrigger>
                    <TabsTrigger value="feed" className="flex items-center justify-center gap-1 px-2 lg:px-3 py-2 text-xs lg:text-sm">
                      <FireIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span>Feed</span>
                    </TabsTrigger>
                    <TabsTrigger value="hunt" className="flex items-center justify-center gap-1 px-2 lg:px-3 py-2 text-xs lg:text-sm">
                      <ShieldExclamationIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span>Hunt</span>
                    </TabsTrigger>
                    <TabsTrigger value="redeem" className="flex items-center justify-center gap-1 px-2 lg:px-3 py-2 text-xs lg:text-sm">
                      <ArrowsRightLeftIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span className="hidden lg:inline">Redeem</span>
                      <span className="lg:hidden">Red</span>
                    </TabsTrigger>
                    <TabsTrigger value="swap" className="flex items-center justify-center gap-1 px-2 lg:px-3 py-2 text-xs lg:text-sm">
                      <ArrowsRightLeftIcon className="h-3 w-3 lg:h-4 lg:w-4" />
                      <span>Swap</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="overview">
                    <GameOverview 
                      gameStats={gameStats}
                      hunterTokens={hunterTokens}
                      bearTokens={bearTokens}
                    />
                  </TabsContent>
                  
                  <TabsContent value="deposit">
                    <DepositBear 
                      bearTokens={bearTokens}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="feed">
                    <FeedHunter 
                      hunterTokens={hunterTokens}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="hunt">
                    <HuntMimo 
                      hunterTokens={hunterTokens}
                      mimoBalance={gameStats.mimoBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="redeem">
                    <RedeemBear 
                      mimoBalance={gameStats.mimoBalance}
                      swapRate={gameStats.swapRate}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="swap">
                    <GameDashboard 
                      gameStats={gameStats}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Hunter Cards */}
          <div>
            <Card>
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-lg sm:text-xl">Your Hunters</CardTitle>
                <CardDescription className="text-sm">
                  Manage your Hunter NFTs and view their stats
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
                {isLoadingHunters && loadingProgress && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {loadingProgress}
                      </span>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                    </div>
                  </div>
                )}
                
                <div className="space-y-3 max-h-80 sm:max-h-96 overflow-y-auto">
                  {hunterTokens.length > 0 ? (
                    hunterTokens.map((hunter, index) => (
                      <HunterCard 
                        key={hunter.tokenId || index}
                        hunter={hunter}
                        onFeed={() => handleRefresh()}
                        onHunt={() => handleRefresh()}
                      />
                    ))
                  ) : !isLoadingHunters ? (
                    <div className="text-center py-6 sm:py-8">
                      <SparklesIcon className="h-8 w-8 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
                      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 px-2">
                        {isConnected ? 'No hunters yet. Deposit a Bear NFT to get started!' : 'Connect wallet to view your hunters'}
                      </p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}