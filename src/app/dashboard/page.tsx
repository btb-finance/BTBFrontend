'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { 
  ArrowPathIcon, 
  WalletIcon, 
  ChartBarIcon, 
  BanknotesIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowsRightLeftIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

import PortfolioOverview from '../components/dashboard/PortfolioOverview';
import MarketOverview from '../components/dashboard/MarketOverview';
import PositionsList from '../components/dashboard/PositionsList';
import AlertsPanel from '../components/dashboard/AlertsPanel';
import TokensList from '../components/dashboard/TokensList';
import LoansList from '../components/dashboard/LoansList';
import TokenSwap from '../components/dashboard/TokenSwap';
import AaveDashboard from '../components/dashboard/AaveDashboard';
import walletDataService from '../services/walletDataService';
import kyberSwapService from '../services/kyberSwapService';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { aaveService } from '../services/aaveService';

// Import types from components
import { Portfolio } from '../components/dashboard/PortfolioOverview';
import { MarketData } from '../components/dashboard/MarketOverview';
import { Position } from '../components/dashboard/PositionsList';

// Using imported types directly without extending

// Using imported Position type directly

interface Alert {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUSD: string;
  priceUSD: string;
  chain: string;
  chainId?: number;
}

interface Loan {
  id: string;
  protocol: string;
  collateral: {
    symbol: string;
    amount: string;
    valueUSD: string;
  };
  debt: {
    symbol: string;
    amount: string;
    valueUSD: string;
  };
  health: string;
  liquidationPrice: string;
  interestRate: string;
}

export default function Dashboard() {
  const { isConnected, address, connectWallet } = useWalletConnection();
  const [isLoading, setIsLoading] = useState(true);
  const [portfolioData, setPortfolioData] = useState<Portfolio | null>(null);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);

  // Check if wallet is connected on component mount
  useEffect(() => {
    // No need to manually check localStorage or set connection state
    // as this is now handled by the useWalletConnection hook
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!isConnected || !address) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // Initialize services with wallet provider if needed
        // This would typically be done in a wallet connection context
        
        // Fetch portfolio overview
        const portfolioOverview = await walletDataService.getWalletPortfolioOverview(address);
        
        // Fetch token balances
        const tokenBalances = await walletDataService.getPopularTokenBalances(address);
        setTokens(tokenBalances);

        // Fetch LP positions
        const lpPositions = await walletDataService.getLPPositions(address);
        
        // Calculate total daily rewards
        let totalDailyRewards = 0;
        lpPositions.forEach(position => {
          if (position.rewardsUSD) {
            const rewardsValue = parseFloat(position.rewardsUSD.replace(/[^0-9.-]+/g, '')) || 0;
            totalDailyRewards += rewardsValue;
          }
        });
        
        // Add daily rewards to portfolio data
        const dailyRewards = `$${totalDailyRewards.toFixed(2)}`;
        
        setPortfolioData({
          totalValueUSD: portfolioOverview.totalValueUSD,
          totalValue: parseFloat(portfolioOverview.totalValueUSD.replace(/[^0-9.-]+/g, '')),
          totalEarningsUSD: portfolioOverview.totalEarningsUSD,
          dailyRewards: dailyRewards, // Add daily rewards from LP positions
          averageApy: portfolioOverview.averageApy || '8.2%',
          activePositions: portfolioOverview.activePositions,
          totalChange24h: portfolioOverview.totalChange24h,
          change24h: parseFloat(portfolioOverview.totalChange24h.replace(/[^0-9.-]+/g, '')),
          totalChangePercentage24h: portfolioOverview.totalChangePercentage24h,
          changePercentage24h: portfolioOverview.totalChangePercentage24h,
          assets: {
            tokens: portfolioOverview.assets.tokens,
            liquidity: portfolioOverview.assets.liquidity,
            lending: portfolioOverview.assets.lending,
            staking: portfolioOverview.assets.staking,
            active: portfolioOverview.activePositions,
            total: portfolioOverview.assets.tokens + portfolioOverview.assets.liquidity + 
                   portfolioOverview.assets.lending + portfolioOverview.assets.staking
          },
          history: portfolioOverview.history || []
        });

        // Format LP positions for display
        const formattedPositions = lpPositions.map((lp: any, index) => ({
          id: `lp-${index}`,
          type: 'liquidity', // Required field
          asset: lp.token0?.symbol || 'ETH', // Required field
          protocol: lp.protocol || 'Uniswap V3',
          pair: `${lp.token0?.symbol || ''}/${lp.token1?.symbol || ''}`,
          value: lp.tvl || '$0', // Required field
          rewards: lp.rewards || '$0.00', // Now using rewards from service
          rewardsUSD: lp.rewardsUSD || undefined, // New field for USD value of rewards
          rewardsTokens: lp.rewards || undefined, // New field for reward token names
          tvl: lp.tvl || '$0',
          apy: lp.apy || 'N/A',
          risk: lp.risk || 'Low',
          health: lp.health || 'Healthy',
          chain: lp.chain || 'Base', // New field for chain information
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Required field
        }));
        setPositions(formattedPositions);

        // Fetch real market data from an API
        try {
          // Using kyberSwapService to get real market data
          const marketOverview = await kyberSwapService.getMarketOverview();
          
          setMarketData({
            totalTVL: marketOverview.totalTVL || 0,
            tvlChange24h: (marketOverview as any).tvlChange24h || 0,
            tvlChangePercentage24h: (marketOverview as any).tvlChangePercentage24h || 0,
            totalVolume24h: (marketOverview as any).totalVolume24h || 0,
            volumeChange24h: (marketOverview as any).volumeChange24h || 0,
            volumeChangePercentage24h: (marketOverview as any).volumeChangePercentage24h || 0,
            totalFees24h: (marketOverview as any).totalFees24h || 0,
            feesChange24h: (marketOverview as any).feesChange24h || 0,
            feesChangePercentage24h: (marketOverview as any).feesChangePercentage24h || 0,
            topProtocols: (marketOverview as any).topProtocols || [],
            topPairs: (marketOverview as any).topPairs || []
          });
        } catch (error) {
          console.error('Error fetching market data:', error);
          // Fallback to empty data structure if API fails
          setMarketData({
            totalTVL: 0,
            tvlChange24h: 0,
            tvlChangePercentage24h: 0,
            totalVolume24h: 0,
            volumeChange24h: 0,
            volumeChangePercentage24h: 0,
            totalFees24h: 0,
            feesChange24h: 0,
            feesChangePercentage24h: 0,
            topProtocols: [],
            topPairs: []
          });
        }

        // Fetch real loans data from lending protocols
        try {
          // Use aaveService directly to fetch user positions on all chains
          const aaveLoans = [];
          
          // Define supported chains
          const supportedChains = ['1', '10', '42161', '8453']; // Mainnet, Optimism, Arbitrum, Base
          
          for (const chainId of supportedChains) {
            try {
              console.log(`Fetching Aave data for chain ${chainId}`);
              
              // Get user position
              const userPosition = await aaveService.getUserPosition(address, chainId);
              
              if (userPosition && 
                  (parseFloat(userPosition.totalCollateralETH) > 0 || 
                   parseFloat(userPosition.totalDebtETH) > 0)) {
                
                console.log(`Found Aave position on chain ${chainId}:`, userPosition);
                
                // Get reserves for detailed data
                const reserves = await aaveService.getReservesConfiguration(chainId);
                console.log(`Got ${reserves.length} reserves for chain ${chainId}`);
                
                // Process each reserve to see if user has a position
                for (const reserve of reserves) {
                  try {
                    const reserveData = await aaveService.getUserReserveData(
                      address, 
                      chainId, 
                      reserve.tokenAddress
                    );
                    
                    const hasSupply = parseFloat(reserveData.currentATokenBalance) > 0;
                    const hasBorrow = 
                      parseFloat(reserveData.currentVariableDebt) > 0 || 
                      parseFloat(reserveData.currentStableDebt) > 0;
                    
                    if (hasSupply || hasBorrow) {
                      aaveLoans.push({
                        id: `aave-${chainId}-${reserve.id}`,
                        protocol: 'Aave V3',
                        collateral: {
                          symbol: reserve.symbol,
                          amount: hasSupply ? reserveData.currentATokenBalance : '0',
                          valueUSD: '$0' // Will need to calculate in production
                        },
                        debt: {
                          symbol: reserve.symbol,
                          amount: hasBorrow ? 
                            (parseFloat(reserveData.currentVariableDebt) + 
                            parseFloat(reserveData.currentStableDebt)).toString() : '0',
                          valueUSD: '$0' // Will need to calculate in production
                        },
                        health: userPosition.healthFactor,
                        liquidationPrice: '$0', // Will need to calculate in production
                        interestRate: reserve.variableBorrowRate
                      });
                    }
                  } catch (reserveError) {
                    console.error(`Error processing reserve ${reserve.symbol}:`, reserveError);
                  }
                }
              }
            } catch (chainError) {
              console.error(`Error processing chain ${chainId}:`, chainError);
            }
          }
          
          console.log('Final Aave loans:', aaveLoans);
          setLoans(aaveLoans);
        } catch (error) {
          console.error('Error fetching loans data:', error);
          setLoans([]);
        }

        // Fetch real alerts based on user's portfolio
        try {
          // Get user alerts from wallet data service
          const userAlerts = await walletDataService.getUserAlerts(address);
          setAlerts(userAlerts);
        } catch (error) {
          console.error('Error fetching user alerts:', error);
          setAlerts([]);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [address, isConnected]);

  const handleRefresh = async () => {
    if (isConnected && address) {
      setIsLoading(true);
      try {
        // Re-fetch all data using the same logic as in useEffect
        const portfolioOverview = await walletDataService.getWalletPortfolioOverview(address);
        
        // Fetch token balances
        const tokenBalances = await walletDataService.getPopularTokenBalances(address);
        setTokens(tokenBalances);

        // Fetch LP positions
        const lpPositions = await walletDataService.getLPPositions(address);
        
        // Calculate total daily rewards
        let totalDailyRewards = 0;
        lpPositions.forEach(position => {
          if (position.rewardsUSD) {
            const rewardsValue = parseFloat(position.rewardsUSD.replace(/[^0-9.-]+/g, '')) || 0;
            totalDailyRewards += rewardsValue;
          }
        });
        
        // Add daily rewards to portfolio data
        const dailyRewards = `$${totalDailyRewards.toFixed(2)}`;
        
        setPortfolioData({
          totalValueUSD: portfolioOverview.totalValueUSD,
          totalValue: parseFloat(portfolioOverview.totalValueUSD.replace(/[^0-9.-]+/g, '')),
          totalEarningsUSD: portfolioOverview.totalEarningsUSD,
          dailyRewards: dailyRewards,
          averageApy: portfolioOverview.averageApy || '0%',
          activePositions: portfolioOverview.activePositions,
          totalChange24h: portfolioOverview.totalChange24h,
          change24h: parseFloat(portfolioOverview.totalChange24h.replace(/[^0-9.-]+/g, '')),
          totalChangePercentage24h: portfolioOverview.totalChangePercentage24h,
          changePercentage24h: portfolioOverview.totalChangePercentage24h,
          assets: {
            tokens: portfolioOverview.assets.tokens,
            liquidity: portfolioOverview.assets.liquidity,
            lending: portfolioOverview.assets.lending,
            staking: portfolioOverview.assets.staking,
            active: portfolioOverview.activePositions,
            total: portfolioOverview.assets.tokens + portfolioOverview.assets.liquidity + 
                   portfolioOverview.assets.lending + portfolioOverview.assets.staking
          },
          history: portfolioOverview.history || []
        });

        // Format LP positions for display
        const formattedPositions = lpPositions.map((lp: any, index) => ({
          id: `lp-${index}`,
          type: 'liquidity',
          asset: lp.token0?.symbol || 'ETH',
          protocol: lp.protocol || 'Uniswap V3',
          pair: `${lp.token0?.symbol || ''}/${lp.token1?.symbol || ''}`,
          value: lp.tvl || '$0',
          rewards: lp.rewards || '$0.00',
          rewardsUSD: lp.rewardsUSD || undefined,
          rewardsTokens: lp.rewards || undefined,
          tvl: lp.tvl || '$0',
          apy: lp.apy || 'N/A',
          risk: lp.risk || 'Low',
          health: lp.health || 'Healthy',
          chain: lp.chain || 'Base',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }));
        setPositions(formattedPositions);

        // Fetch market data
        try {
          const marketOverview = await kyberSwapService.getMarketOverview();
          setMarketData({
            totalTVL: marketOverview.totalTVL || 0,
            tvlChange24h: (marketOverview as any).tvlChange24h || 0,
            tvlChangePercentage24h: (marketOverview as any).tvlChangePercentage24h || 0,
            totalVolume24h: (marketOverview as any).totalVolume24h || 0,
            volumeChange24h: (marketOverview as any).volumeChange24h || 0,
            volumeChangePercentage24h: (marketOverview as any).volumeChangePercentage24h || 0,
            totalFees24h: (marketOverview as any).totalFees24h || 0,
            feesChange24h: (marketOverview as any).feesChange24h || 0,
            feesChangePercentage24h: (marketOverview as any).feesChangePercentage24h || 0,
            topProtocols: (marketOverview as any).topProtocols || [],
            topPairs: (marketOverview as any).topPairs || []
          });
        } catch (error) {
          console.error('Error fetching market data:', error);
        }

        // Fetch loans data
        try {
          const userLoans = await walletDataService.getUserLoans(address);
          setLoans(userLoans);
        } catch (error) {
          console.error('Error fetching loans data:', error);
        }

        // Fetch alerts
        try {
          const userAlerts = await walletDataService.getUserAlerts(address);
          setAlerts(userAlerts);
        } catch (error) {
          console.error('Error fetching user alerts:', error);
        }

      } catch (error) {
        console.error('Error refreshing dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSwapClick = (token: TokenBalance) => {
    setSelectedToken(token);
    setActiveTab('swap');
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center py-12">
              <WalletIcon className="h-16 w-16 text-gray-400 mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Connect your wallet to view your portfolio, positions, and personalized insights.
              </p>
              <Button size="lg" onClick={connectWallet}>
                Connect Wallet
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div 
        className="mb-6 flex items-center justify-between"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button 
          variant="secondary" 
          onClick={handleRefresh}
          disabled={isLoading}
          leftIcon={<ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh
        </Button>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Alerts Panel */}
        <motion.div variants={itemVariants} className="mb-8">
          <AlertsPanel alerts={alerts} />
        </motion.div>

        {/* Portfolio Overview */}
        <motion.div variants={itemVariants} className="mb-8">
          <PortfolioOverview portfolioData={portfolioData} />
        </motion.div>

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="tokens">
              <CurrencyDollarIcon className="h-5 w-5 mr-2" />
              Tokens
            </TabsTrigger>
            <TabsTrigger value="positions">
              <ArrowTrendingUpIcon className="h-5 w-5 mr-2" />
              Positions
            </TabsTrigger>
            <TabsTrigger value="loans">
              <BanknotesIcon className="h-5 w-5 mr-2" />
              Loans
            </TabsTrigger>
            <TabsTrigger value="aave">
              <ShieldCheckIcon className="h-5 w-5 mr-2" />
              Aave
            </TabsTrigger>
            <TabsTrigger value="swap">
              <ArrowsRightLeftIcon className="h-5 w-5 mr-2" />
              Swap
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <motion.div variants={itemVariants}>
              <MarketOverview marketData={marketData} />
            </motion.div>
          </TabsContent>

          <TabsContent value="tokens">
            <motion.div variants={itemVariants}>
              <TokensList 
                tokens={tokens} 
                onSwapClick={handleSwapClick} 
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="positions">
            <motion.div variants={itemVariants}>
              <PositionsList positions={positions} />
            </motion.div>
          </TabsContent>

          <TabsContent value="loans">
            <motion.div variants={itemVariants}>
              <LoansList loans={loans} />
            </motion.div>
          </TabsContent>

          <TabsContent value="aave">
            <motion.div variants={itemVariants}>
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div className="text-center p-6">
                    <h2 className="text-2xl font-bold mb-4">Aave Dashboard</h2>
                    <p className="text-gray-500 mb-6">Access the full Aave dashboard for lending, borrowing, and managing your positions.</p>
                    <Button 
                      size="lg" 
                      onClick={() => window.location.href = '/aave'}
                      className="px-6"
                    >
                      <ShieldCheckIcon className="h-5 w-5 mr-2" />
                      Open Aave Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="swap">
            <motion.div variants={itemVariants}>
              <TokenSwap 
                tokens={tokens} 
                onSwapComplete={handleRefresh} 
                selectedToken={selectedToken}
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
