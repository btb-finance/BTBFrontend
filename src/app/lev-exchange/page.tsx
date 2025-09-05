'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  SearchIcon,
  FilterIcon,
  BarChart3Icon,
  PieChartIcon,
  RefreshCcwIcon
} from 'lucide-react';
import { useAccount } from 'wagmi';
import TokenCard from './components/TokenCard';
import TradingPanel from './components/TradingPanel';
import leverageTokenService, { TokenInfo } from './services/leverageTokenService';

export default function LeverageExchange() {
  // Initialize provider on component mount
  useEffect(() => {
    leverageTokenService.initializeProvider();
  }, []);
  const { address, isConnected } = useAccount();
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('volume');
  const [filterActive, setFilterActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState({
    totalVolume: '$1.2M',
    totalTokens: 2,
    totalTVL: '$3.2M',
    activeTokens: 2
  });

  // Load tokens on component mount
  useEffect(() => {
    const loadTokens = async () => {
      setIsLoading(true);
      try {
        const tokenList = await leverageTokenService.getAllTokens();
        setTokens(tokenList);
        if (tokenList.length > 0 && !selectedToken) {
          setSelectedToken(tokenList[0]);
        }
        
        // Load platform stats
        const stats = await leverageTokenService.getPlatformStats();
        setPlatformStats({
          totalVolume: `$${(Number(stats.totalVolume) / 1000000).toFixed(1)}M`,
          totalTokens: stats.totalTokens,
          totalTVL: '$3.2M', // Calculate from token data
          activeTokens: stats.activeTokens
        });
      } catch (error) {
        console.error('Error loading tokens:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTokens();
  }, []);

  const filteredTokens = tokens.filter(token => 
    (token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
     token.name.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (!filterActive || token.active)
  );

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return parseFloat((b.volume24h || '0').replace(/[$,]/g, '')) - parseFloat((a.volume24h || '0').replace(/[$,]/g, ''));
      case 'price':
        return parseFloat((b.price || '0').replace(/[$,]/g, '')) - parseFloat((a.price || '0').replace(/[$,]/g, ''));
      case 'change':
        return (b.priceChange24h || 0) - (a.priceChange24h || 0);
      case 'tvl':
        return parseFloat((b.tvl || '0').replace(/[$,]/g, '')) - parseFloat((a.tvl || '0').replace(/[$,]/g, ''));
      default:
        return 0;
    }
  });

  const refreshData = async () => {
    setIsLoading(true);
    try {
      const tokenList = await leverageTokenService.getAllTokens();
      setTokens(tokenList);
      
      const stats = await leverageTokenService.getPlatformStats();
      setPlatformStats({
        totalVolume: `$${(Number(stats.totalVolume) / 1000000).toFixed(1)}M`,
        totalTokens: stats.totalTokens,
        totalTVL: '$3.2M',
        activeTokens: stats.activeTokens
      });
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Leverage Token Exchange
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg max-w-2xl mx-auto">
            Trade leveraged tokens with automated rebalancing and enhanced yield opportunities
          </p>
          
          {/* Platform Stats */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-6 mt-8"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-btb-primary">{platformStats.totalVolume}</div>
              <div className="text-sm text-gray-500">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-btb-primary">{platformStats.totalTokens}</div>
              <div className="text-sm text-gray-500">Listed Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-btb-primary">{platformStats.totalTVL}</div>
              <div className="text-sm text-gray-500">Total TVL</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-btb-primary">Base Sepolia</div>
              <div className="text-sm text-gray-500">Network</div>
            </div>
          </motion.div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Token List */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">Available Tokens</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshData}
                    disabled={isLoading}
                  >
                    <RefreshCcwIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                  {/* Search */}
                  <div className="relative flex-1 sm:flex-initial">
                    <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-full sm:w-48"
                    />
                  </div>
                  
                  {/* Sort */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm"
                  >
                    <option value="volume">Volume</option>
                    <option value="price">Price</option>
                    <option value="change">24h Change</option>
                    <option value="tvl">TVL</option>
                  </select>
                  
                  {/* Filter */}
                  <Button
                    variant={filterActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterActive(!filterActive)}
                    className="px-4"
                  >
                    <FilterIcon className="w-4 h-4 mr-2" />
                    Active Only
                  </Button>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-12">
                  <RefreshCcwIcon className="w-8 h-8 animate-spin mx-auto mb-4 text-btb-primary" />
                  <p className="text-gray-500">Loading tokens...</p>
                </div>
              ) : sortedTokens.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 mb-4">No tokens found</p>
                  <Button onClick={refreshData} variant="outline">
                    <RefreshCcwIcon className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedTokens.map((token) => (
                    <TokenCard
                      key={token.leverageContract}
                      token={token}
                      isSelected={selectedToken?.leverageContract === token.leverageContract}
                      onSelect={setSelectedToken}
                      onTrade={(token) => {
                        setSelectedToken(token);
                        // Could add scroll to trading panel logic here
                      }}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Trading Panel */}
          <div className="space-y-6">
            {selectedToken ? (
              <TradingPanel selectedToken={selectedToken} />
            ) : (
              <Card className="p-12 text-center">
                <h3 className="text-lg font-semibold mb-2">Select a Token</h3>
                <p className="text-gray-500">Choose a leverage token from the list to start trading</p>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3Icon className="w-4 h-4 mr-2" />
                  View Chart
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <PieChartIcon className="w-4 h-4 mr-2" />
                  Portfolio Analytics
                </Button>
              </div>
            </Card>

            {/* Network Info */}
            <Card className="p-4">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-1">Network</div>
                <div className="font-semibold">Base Sepolia Testnet</div>
                <div className="text-xs text-gray-500 mt-1 break-all">
                  Factory: 0x4b95dB6aE06Fd6Eb248bC8587a1466c8345e0873
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}