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
import walletDataService from '../services/walletDataService';
import kyberSwapService from '../services/kyberSwapService';
import { useWalletConnection } from '../hooks/useWalletConnection';

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
        setPortfolioData({
          totalValueUSD: portfolioOverview.totalValueUSD,
          totalValue: parseFloat(portfolioOverview.totalValueUSD.replace(/[^0-9.-]+/g, '')),
          totalEarningsUSD: portfolioOverview.totalEarningsUSD,
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
          history: portfolioOverview.history || [
            { timestamp: Date.now() - 86400000 * 7, value: 9500 },
            { timestamp: Date.now() - 86400000 * 6, value: 9800 },
            { timestamp: Date.now() - 86400000 * 5, value: 10100 },
            { timestamp: Date.now() - 86400000 * 4, value: 10050 },
            { timestamp: Date.now() - 86400000 * 3, value: 10200 },
            { timestamp: Date.now() - 86400000 * 2, value: 10350 },
            { timestamp: Date.now() - 86400000, value: 10500 },
            { timestamp: Date.now(), value: 10750 }
          ]
        });

        // Fetch token balances
        const tokenBalances = await walletDataService.getPopularTokenBalances(address);
        setTokens(tokenBalances);

        // Fetch LP positions
        const lpPositions = await walletDataService.getLPPositions(address);
        const formattedPositions = lpPositions.map((lp, index) => ({
          id: `lp-${index}`,
          type: 'liquidity', // Required field
          asset: lp.token0?.symbol || 'ETH', // Required field
          protocol: lp.protocol || 'Uniswap V3',
          pair: `${lp.token0?.symbol || ''}/${lp.token1?.symbol || ''}`,
          value: lp.tvl || '$0', // Required field
          rewards: '$0.00', // Required field
          tvl: lp.tvl || '$0',
          apy: lp.apy || 'N/A',
          risk: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)], // Mock data
          health: ['Healthy', 'Warning', 'Critical'][Math.floor(Math.random() * 3)], // Mock data
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Required field
        }));
        setPositions(formattedPositions);

        // Mock market data (would come from a market data API in production)
        setMarketData({
          totalTVL: 13000000000,
          tvlChange24h: 280000000,
          tvlChangePercentage24h: 2.2,
          totalVolume24h: 800000000,
          volumeChange24h: 42000000,
          volumeChangePercentage24h: 5.5,
          totalFees24h: 2400000,
          feesChange24h: 126000,
          feesChangePercentage24h: 5.5,
          topProtocols: [
            { name: 'Uniswap V3', tvl: 5200000000, volume24h: 320000000, marketShare: 40.0, change24h: 2.3 },
            { name: 'Aave V3', tvl: 3800000000, volume24h: 180000000, marketShare: 29.2, change24h: -1.2 },
            { name: 'Compound', tvl: 2100000000, volume24h: 150000000, marketShare: 16.2, change24h: 0.8 },
            { name: 'Curve', tvl: 1900000000, volume24h: 150000000, marketShare: 14.6, change24h: -0.5 }
          ],
          topPairs: [
            { pair: 'ETH/USDC', volume24h: 320000000, tvl: 1300000000, fee: 0.3, apy: 12.5 },
            { pair: 'BTC/ETH', volume24h: 180000000, tvl: 950000000, fee: 0.3, apy: 8.2 },
            { pair: 'ETH/USDT', volume24h: 150000000, tvl: 820000000, fee: 0.3, apy: 11.7 },
            { pair: 'ARB/ETH', volume24h: 85000000, tvl: 320000000, fee: 0.3, apy: 15.3 },
            { pair: 'OP/ETH', volume24h: 65000000, tvl: 270000000, fee: 0.3, apy: 14.8 }
          ]
        });

        // Mock loans data (would come from lending protocols in production)
        setLoans([
          {
            id: 'loan-1',
            protocol: 'Aave V3',
            collateral: {
              symbol: 'ETH',
              amount: '5.0',
              valueUSD: '$10,000'
            },
            debt: {
              symbol: 'USDC',
              amount: '5,000',
              valueUSD: '$5,000'
            },
            health: 'Healthy',
            liquidationPrice: '$800',
            interestRate: '3.5%'
          },
          {
            id: 'loan-2',
            protocol: 'Compound',
            collateral: {
              symbol: 'WBTC',
              amount: '0.25',
              valueUSD: '$7,500'
            },
            debt: {
              symbol: 'DAI',
              amount: '3,000',
              valueUSD: '$3,000'
            },
            health: 'Warning',
            liquidationPrice: '$28,000',
            interestRate: '2.8%'
          }
        ]);

        // Mock alerts
        setAlerts([
          {
            id: 'alert-1',
            type: 'Warning',
            message: 'Your Compound loan health is below 1.5x. Consider adding more collateral.',
            timestamp: '2 hours ago'
          },
          {
            id: 'alert-2',
            type: 'Info',
            message: 'ETH price increased by 5% in the last 24 hours.',
            timestamp: '5 hours ago'
          },
          {
            id: 'alert-3',
            type: 'Info',
            message: 'Your staked BTB tokens earned 25 BTB in rewards.',
            timestamp: '1 day ago'
          }
        ]);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [address, isConnected]);

  const handleRefresh = () => {
    if (isConnected && address) {
      setIsLoading(true);
      // Re-fetch all data
      // This would call the same data fetching logic as in the useEffect
      setTimeout(() => {
        setIsLoading(false);
      }, 1000);
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
          <h1 className="text-3xl font-bold mb-6 font-heading">Dashboard</h1>
          <Card className="p-8 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center py-12">
              <WalletIcon className="h-16 w-16 text-btb-primary mb-4" />
              <h2 className="text-2xl font-semibold mb-2 font-heading">Connect Your Wallet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Connect your wallet to view your portfolio, positions, and personalized insights.
              </p>
              <Button size="lg" onClick={connectWallet} className="bg-btb-primary hover:bg-btb-primary-dark">
                Connect Wallet
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div 
        className="max-w-4xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-5 bg-btb-gradient bg-clip-text text-transparent font-heading">
          Manage All Your DeFi in One Place
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 max-w-3xl mx-auto">
          One unified dashboard to monitor and optimize all your DeFi yields across protocols.
        </p>
        
        <Card className="p-6 md:p-10 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-btb-primary-light/30 dark:border-btb-primary-dark/50">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-btb-primary dark:text-btb-primary-light font-heading">Coming Soon</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left mb-5 max-w-2xl mx-auto">
              <div className="flex items-center">
                <span className="mr-2 text-btb-primary">✓</span> Yield farming optimization
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-btb-primary">✓</span> Multi-chain portfolio tracking
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-btb-primary">✓</span> Automated yield strategies
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-btb-primary">✓</span> Risk assessment tools
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-btb-primary">✓</span> Real-time yield comparisons
              </div>
            </div>
            
            <Button size="lg" className="btn-primary mt-2">
              Join Waitlist
            </Button>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-4">
              We're working hard to bring you the ultimate DeFi dashboard experience.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
