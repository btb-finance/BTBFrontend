'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '../context/WalletContext';
import btbApi from '../services/btbApi';
import walletDataService from '../services/walletDataService';
import PortfolioOverview from '../components/dashboard/PortfolioOverview';
import PositionsList from '../components/dashboard/PositionsList';
import MarketOverview from '../components/dashboard/MarketOverview';
import AlertsPanel from '../components/dashboard/AlertsPanel';
import WalletButton from '../components/WalletButton';
import { Portfolio, Position, MarketData, Alert } from '../services/btbApi';

export default function DashboardPage() {
  const { isConnected, address } = useWallet();
  const [portfolioData, setPortfolioData] = useState<Portfolio | null>(null);
  const [positionsData, setPositionsData] = useState<Position[]>([]);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [alertsData, setAlertsData] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<any[]>([]);
  const [lpPositions, setLpPositions] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!isConnected) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Initialize wallet data service
        await walletDataService.initialize();
        
        // Get real wallet data first (on-chain data)
        const [walletPortfolio, popularTokens, lpPositions] = await Promise.all([
          walletDataService.getWalletPortfolioOverview(address || undefined),
          walletDataService.getPopularTokenBalances(address || undefined),
          walletDataService.getLPPositions(address || undefined)
        ]);
        
        // Log the real wallet data
        console.log('Wallet portfolio:', walletPortfolio);
        console.log('Token balances:', popularTokens);
        console.log('LP positions:', lpPositions);
        
        // Store token balances and LP positions
        setTokenBalances(popularTokens);
        setLpPositions(lpPositions);
        
        // Map wallet data to our application's data format
        const mappedPortfolio: Portfolio = {
          totalValue: Number(walletPortfolio.totalValueUSD),
          change24h: Number(walletPortfolio.totalChange24h),
          changePercentage24h: Number(walletPortfolio.totalChangePercentage24h),
          assets: {
            active: Object.values(walletPortfolio.assets).filter(v => v > 0).length,
            total: Object.values(walletPortfolio.assets).length
          },
          positions: []
        };
        
        // Map LP positions to our format
        const mappedPositions: Position[] = lpPositions.map(lp => ({
          id: lp.address,
          protocol: lp.protocol,
          pair: `${lp.token0?.symbol || ''}/${lp.token1?.symbol || ''}`,
          tvl: lp.tvl || '0',
          apy: lp.apy || '0',
          rewards: [],
          risk: "Medium",
          health: "Healthy",
          chain: "Ethereum"
        }));
        
        // Map token positions
        const tokenPositions: Position[] = popularTokens
          .filter(token => token && token.balance)
          .map(token => ({
            id: token.address,
            protocol: "Token",
            pair: token.symbol,
            tvl: token.balanceUSD,
            apy: "0",
            rewards: [],
            risk: "Low",
            health: "Healthy",
            chain: token.chain || "Unknown"
          }));
        
        setPortfolioData(mappedPortfolio);
        setPositionsData([...mappedPositions, ...tokenPositions]);
        
        // Try to get additional data from BTB API (market data, alerts)
        try {
          const [market, alerts] = await Promise.all([
            btbApi.getMarketOverview(),
            btbApi.getAlerts()
          ]);
          
          setMarketData(market);
          setAlertsData(alerts);
        } catch (apiError) {
          console.warn('Failed to fetch market data from API, using fallbacks:', apiError);
          
          // Fallback to mock data for market and alerts
          setMarketData(await btbApi.mockMarketOverview());
          setAlertsData(await btbApi.mockAlerts());
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load wallet data. Please make sure your wallet is correctly connected.');
        
        // Fallback to mock data if all else fails
        try {
          setPortfolioData(await btbApi.mockPortfolioOverview());
          setPositionsData(await btbApi.mockPositions());
          setMarketData(await btbApi.mockMarketOverview());
          setAlertsData(await btbApi.mockAlerts());
        } catch (mockError) {
          console.error('Failed to load mock data:', mockError);
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchDashboardData();
  }, [isConnected, address]);

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Wallet Button */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gradient">
              Your DeFi Investment Control Center
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Monitor, adjust, and optimize your yield farming strategies across platforms
            </p>
          </div>
          <WalletButton />
        </div>

        {isConnected ? (
          isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-8 rounded">
              <p>{error}</p>
            </div>
          ) : (
            /* Main Dashboard Grid */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Portfolio Overview */}
              <div className="lg:col-span-2">
                <div className="card">
                  <PortfolioOverview portfolioData={portfolioData} />
                </div>

                {/* Token Balances Section */}
                {tokenBalances.length > 0 && (
                  <div className="card mt-8">
                    <h2 className="text-xl font-bold mb-4">Token Balances</h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Token</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Balance</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Address</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {tokenBalances.filter(token => parseFloat(token.formattedBalance) > 0).map((token, index) => (
                            <tr key={token.address || index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{token.symbol}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{token.formattedBalance}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                                {token.address === 'native' ? 'Native ETH' : token.address}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Positions Section */}
                <div className="card mt-8">
                  <PositionsList positions={positionsData} />
                </div>
              </div>

              {/* Right Column - Market & Alerts */}
              <div>
                <div className="card">
                  <MarketOverview marketData={marketData} />
                </div>
                <div className="card mt-8">
                  <AlertsPanel alerts={alertsData} />
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Connect your wallet to view your portfolio and positions
              </p>
            </div>
            <WalletButton large />
          </div>
        )}
      </div>
    </div>
  );
}
