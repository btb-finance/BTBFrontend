'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Pool, Token } from '@/app/types/uniswap';
import UniswapV4Service from '@/app/services/uniswapV4Service';
import { PoolsList } from '@/app/components/pools/PoolsList';
import { PoolMetrics } from '@/app/components/pools/PoolMetrics';
import { TokenSearch } from '@/app/components/pools/TokenSearch';
import { FiRefreshCw, FiSearch, FiDollarSign } from 'react-icons/fi';
import { MdError } from 'react-icons/md';

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

  // Initialize Uniswap service
  const uniswapV4Service = UniswapV4Service.getInstance();

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

  return (
    <div className="py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Uniswap Pools on Base
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Find the best pools and APR for your investments on Base chain.
          </p>
        </div>

        {/* Tabs */}
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

        {/* Main content */}
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
      </div>
    </div>
  );
}
