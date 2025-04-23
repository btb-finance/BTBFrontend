'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Pool, Token } from '@/app/uniswap/types/uniswap';
import UniswapV4Service from '@/app/uniswap/services/uniswapV4Service';
import LiquidityService from '@/app/uniswap/services/liquidityService';
import { PoolsList } from '@/app/uniswap/components/PoolsList';
import { PoolMetrics } from '@/app/uniswap/components/PoolMetrics';
import { TokenSearch } from '@/app/uniswap/components/TokenSearch';
import { AddLiquidity, LiquidityData } from '@/app/uniswap/components/AddLiquidity';
import { FiRefreshCw, FiSearch, FiDollarSign, FiPlusCircle } from 'react-icons/fi';
import { MdError } from 'react-icons/md';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import ComingSoonBanner from '@/app/components/common/ComingSoonBanner';

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [filteredPools, setFilteredPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'liquidity' | 'apr'>('liquidity');
  const [searchToken, setSearchToken] = useState<Token | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0); // Added for manual refresh
  const [sortBy, setSortBy] = useState<'tvl' | 'apr'>('tvl');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [activeTab, setActiveTab] = useState<'explore' | 'add'>('explore');
  const [txStatus, setTxStatus] = useState<{
    pending: boolean;
    success: boolean;
    error: string | null;
    txHash: string | null;
  }>({
    pending: false,
    success: false,
    error: null,
    txHash: null
  });

  // Initialize services
  const uniswapV4Service = UniswapV4Service.getInstance();
  const liquidityService = LiquidityService.getInstance();

  // Function to reload data
  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    setLoading(true);
    setError(null);
  }, []);

  // Fetch pools based on filter type
  useEffect(() => {
    let isMounted = true;
    
    async function fetchPools() {
      if (!isMounted) return; // Prevent multiple simultaneous fetches
      
      setLoading(true);
      setError(null);
      
      try {
        let fetchedPools: Pool[] = [];

        // If searching for a specific token
        if (searchToken) {
          fetchedPools = await uniswapV4Service.getPoolsForToken(searchToken.address);
        } else {
          // Based on filter type
          if (filterType === 'liquidity') {
            fetchedPools = await uniswapV4Service.getTopPoolsByLiquidity();
          } else {
            fetchedPools = await uniswapV4Service.getPoolsWithHighestAPR();
          }
        }

        if (!isMounted) return;

        // If no pools were fetched from the API, use mock data
        if (fetchedPools.length === 0) {
          console.log("No pools returned, using mock data");
          fetchedPools = uniswapV4Service.getMockPools();
          
          if (fetchedPools.length === 0) {
            setError('No pools found. Using sample data for demonstration.');
          }
        }

        setPools(fetchedPools);
        setFilteredPools(fetchedPools);

        // Auto-select the first pool if none is selected
        if (fetchedPools.length > 0 && !selectedPool) {
          setSelectedPool(fetchedPools[0]);
        }
      } catch (error) {
        if (!isMounted) return;
        
        console.error('Error fetching pools:', error);
        setError('Failed to fetch pools. Using sample data for demonstration.');
        
        // Use mock data as fallback
        const mockPools = uniswapV4Service.getMockPools();
        setPools(mockPools);
        setFilteredPools(mockPools);
        
        if (mockPools.length > 0 && !selectedPool) {
          setSelectedPool(mockPools[0]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    fetchPools();
    
    return () => {
      isMounted = false;
    };
  }, [filterType, searchToken, refreshKey, uniswapV4Service, selectedPool]);

  // Filter pools when search term changes
  useEffect(() => {
    if (!searchTerm) {
      setFilteredPools(pools);
      return;
    }

    const filtered = pools.filter(pool => 
      pool.token0.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pool.token1.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setFilteredPools(filtered);
  }, [searchTerm, pools]);

  // Handle filter type change
  const handleFilterTypeChange = (type: 'liquidity' | 'apr') => {
    setFilterType(type);
    setSearchToken(null);
  };

  // Handle token search
  const handleTokenSearch = (token: Token) => {
    setSearchToken(token);
    setFilterType('liquidity'); // Reset to liquidity when searching by token
  };

  // Handle pool selection
  const handlePoolSelect = (pool: Pool) => {
    setSelectedPool(pool);
  };
  
  // Handle add liquidity from pool details
  const handleAddLiquidityFromPool = (pool: Pool) => {
    setActiveTab('add');
    // Pre-select the tokens from the pool
    const liquidityData: LiquidityData = {
      token0: pool.token0,
      token1: pool.token1,
      amount0: '',
      amount1: '',
      fee: pool.fee,
      lowerTick: 0,
      upperTick: 0,
      pool: pool
    };
    // We'll pass this to the AddLiquidity component
    setSelectedPool(pool);
  };

  // Handle sort change
  const handleSortChange = (sortKey: 'tvl' | 'apr') => {
    setSortBy(sortKey);
    
    const sorted = [...filteredPools].sort((a, b) => 
      sortKey === 'tvl' ? b.tvl - a.tvl : b.apr - a.apr
    );
    
    setFilteredPools(sorted);
  };

  const clearTokenSearch = () => {
    setSearchToken(null);
  };
  
  // Handle adding liquidity
  const handleAddLiquidity = async (data: LiquidityData) => {
    setTxStatus({
      pending: true,
      success: false,
      error: null,
      txHash: null
    });
    
    try {
      const result = await liquidityService.addLiquidity(data);
      
      if (result.success) {
        setTxStatus({
          pending: false,
          success: true,
          error: null,
          txHash: result.txHash || null
        });
        
        // Refresh pools after a successful transaction
        setTimeout(() => {
          refreshData();
        }, 3000);
      } else {
        setTxStatus({
          pending: false,
          success: false,
          error: result.error || 'Transaction failed',
          txHash: null
        });
      }
    } catch (error) {
      setTxStatus({
        pending: false,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        txHash: null
      });
    }
  };

  return (
    <div className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ComingSoonBanner productName="Pools" />
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Uniswap Pools on Base
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Find the best pools and APR for your investments on Base chain.
          </p>
        </div>

        {/* Main Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Main Tabs">
            <button
              className={`py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === 'explore'
                  ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('explore')}
            >
              Explore Pools
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-md ${
                activeTab === 'add'
                  ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('add')}
            >
              <FiPlusCircle className="inline-block h-5 w-5 mr-1" />
              Add Liquidity
            </button>
          </nav>
        </div>

        {/* Explore Tabs */}
        {activeTab === 'explore' && (
          <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                className={`py-4 px-1 border-b-2 font-medium text-md ${
                  filterType === 'liquidity'
                    ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => handleFilterTypeChange('liquidity')}
              >
                Top Pools by Liquidity
              </button>
              <button
                className={`py-4 px-1 border-b-2 font-medium text-md ${
                  filterType === 'apr'
                    ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
                onClick={() => handleFilterTypeChange('apr')}
              >
                <FiDollarSign className="inline-block h-5 w-5 mr-1" />
                Highest APR
              </button>
              <div
                className={`py-4 px-1 border-b-2 font-medium text-md ${
                  searchToken
                    ? 'border-btb-primary text-btb-primary dark:text-btb-primary-light'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <FiSearch className="inline-block h-5 w-5 mr-1" />
                Search by Token
              </div>
            </nav>
          </div>
        )}

        {/* Main content */}
        {activeTab === 'explore' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left sidebar */}
            <div className="md:col-span-1">
              <TokenSearch onSelectToken={handleTokenSearch} isLoading={loading} />
              
              {searchToken && (
                <div className="mt-2 p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md flex justify-between items-center">
                  <span>
                    Filtering by: <strong>{searchToken.symbol || searchToken.address.substring(0, 8)}</strong>
                  </span>
                  <button 
                    className="bg-red-800 px-3 py-1 rounded text-white"
                    onClick={clearTokenSearch}
                  >
                    Clear
                  </button>
                </div>
              )}
              
              <div className="mt-4">
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Filter pools..."
                    className="w-full p-2 border rounded-md bg-gray-50 dark:bg-slate-800"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                  />
                </div>
                
                <PoolsList 
                  pools={filteredPools} 
                  selectedPool={selectedPool} 
                  onSelectPool={handlePoolSelect} 
                  isLoading={loading} 
                />
              </div>
            </div>
            
            {/* Right content area */}
            <div className="md:col-span-2">
              {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-200 p-4 rounded-lg mb-6 flex items-center">
                  <MdError className="text-xl mr-2" />
                  <span>{error}</span>
                  <button 
                    className="ml-auto bg-red-800 px-3 py-1 rounded text-white"
                    onClick={refreshData}
                  >
                    Try Again
                  </button>
                </div>
              )}
              {selectedPool ? (
                <PoolMetrics 
                  pool={selectedPool} 
                  isLoading={loading}
                  onAddLiquidity={handleAddLiquidityFromPool}
                />
              ) : (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 flex items-center justify-center h-64">
                  <p className="text-gray-500 dark:text-gray-400">
                    {loading ? 'Loading pools...' : 'Select a pool to view details'}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Add Liquidity Form */}
            <div className="md:col-span-2">
              {txStatus.pending && (
                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-500 text-blue-800 dark:text-blue-200 p-4 rounded-lg mb-6 flex items-center">
                  <div className="animate-spin mr-2">
                    <FiRefreshCw className="h-5 w-5" />
                  </div>
                  <span>Transaction pending. Please wait...</span>
                </div>
              )}
              
              {txStatus.success && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-500 text-green-800 dark:text-green-200 p-4 rounded-lg mb-6 flex items-center">
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  <div>
                    <p>Transaction successful!</p>
                    {txStatus.txHash && (
                      <p className="text-sm mt-1">
                        TX Hash: <span className="font-mono">{txStatus.txHash.substring(0, 10)}...{txStatus.txHash.substring(txStatus.txHash.length - 8)}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {txStatus.error && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-500 text-red-800 dark:text-red-200 p-4 rounded-lg mb-6 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span>{txStatus.error}</span>
                </div>
              )}
              
              <AddLiquidity 
                pools={pools}
                isLoading={loading}
                onAddLiquidity={handleAddLiquidity}
                initialPool={activeTab === 'add' ? selectedPool : null}
              />
            </div>
            
            {/* Right sidebar - Info */}
            <div className="md:col-span-1">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-4">
                <h3 className="text-lg font-medium mb-3">BTB Liquidity Benefits</h3>
                <ul className="space-y-3">
                  <li className="flex">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full mr-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Simplified LP Experience</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Just select tokens and a price range, BTB handles the rest
                      </p>
                    </div>
                  </li>
                  <li className="flex">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full mr-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Impermanent Loss Protection</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        BTB token holders vote on pools and users get 10% of the pool price weekly as refunds
                      </p>
                    </div>
                  </li>
                  <li className="flex">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full mr-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">Automatic Zapping</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Integrates with KyberSwap for optimal token swapping and liquidity provision
                      </p>
                    </div>
                  </li>
                  <li className="flex">
                    <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full mr-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">BTB Rewards</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Earn additional BTB tokens on top of standard trading fees
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
              
              <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Currently on Base Chain
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  BTB Finance is currently operating on the Base blockchain. Support for additional chains coming soon.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
