'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { ethers } from 'ethers';

interface Asset {
  tokenAddress: string;
  symbol: string;
  name: string;
  liquidityRate: string;
  variableBorrowRate: string;
  stableBorrowRate: string;
  availableLiquidity: string;
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  ltv: string;
  priceInEth: string;
}

interface AaveMarketsProps {
  assets: Asset[];
  onSupply: (asset: Asset) => void;
  onBorrow: (asset: Asset) => void;
}

export function AaveMarkets({ assets, onSupply, onBorrow }: AaveMarketsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'supplyApy' | 'borrowApr'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Format APY/APR
  const formatAPY = (value: string | number) => {
    // Check if it's already formatted with a % sign
    if (typeof value === 'string' && value.includes('%')) {
      return value;
    }

    try {
      // If it's a string that might be a large BigNumber
      if (typeof value === 'string' && value.length > 18) {
        try {
          // Convert ray (10^27) to percentage
          const ray = ethers.BigNumber.from(value);
          const percentage = ray.mul(100).div(ethers.BigNumber.from(10).pow(25));
          return (percentage.toNumber() / 100).toFixed(2) + '%';
        } catch {
          // If conversion as BigNumber fails, try as regular number
          console.log('BigNumber conversion failed, trying as regular number for', value);
        }
      }
      
      // If it's already in decimal format (either string or number)
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      // Check if the value is already a percentage or a decimal
      const percentage = numValue > 1 ? numValue : numValue * 100;
      return percentage.toFixed(2) + '%';
    } catch (error) {
      console.error('Error formatting APY:', error, value);
      // Return a safe value
      return '0.00%';
    }
  };

  // Format liquidity
  const formatLiquidity = (value: string) => {
    // If the value is a large number in wei format (e.g., for ETH), convert to a reasonable number
    let num = parseFloat(value);
    
    // Check if this is likely a large wei number (more than 18 digits)
    if (value && value.length > 18) {
      try {
        // Convert from wei to ETH equivalent
        const bn = ethers.BigNumber.from(value);
        // Calculate USD value (rough estimate - $2000 per ETH)
        num = parseFloat(ethers.utils.formatEther(bn)) * 2000;
      } catch (error) {
        console.log('Error formatting liquidity:', error);
        // Fallback to direct parsing if BigNumber conversion fails
      }
    }
    
    // If the number is still extremely large or NaN, provide a fallback
    if (isNaN(num) || !isFinite(num)) {
      num = 1000000; // Default to 1M as fallback
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Sort function
  const sortAssets = (a: Asset, b: Asset) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'name':
        comparison = a.symbol.localeCompare(b.symbol);
        break;
      case 'supplyApy':
        comparison = parseFloat(a.liquidityRate) - parseFloat(b.liquidityRate);
        break;
      case 'borrowApr':
        comparison = parseFloat(a.variableBorrowRate) - parseFloat(b.variableBorrowRate);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  };

  // Toggle sort
  const toggleSort = (column: 'name' | 'supplyApy' | 'borrowApr') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Filter assets by search term
  const filteredAssets = assets.filter(asset => 
    asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Debugging function to log asset details
  const logAssetDetails = () => {
    console.log(`AaveMarkets received ${assets.length} assets:`, assets);
    if (assets.length > 0) {
      console.log('First asset details:', assets[0]);
    }
  };
  
  // Call the logging function on component mount
  useEffect(() => {
    logAssetDetails();
  }, [assets]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 space-y-4 md:space-y-0">
          <h2 className="text-xl font-bold">Available Markets {assets.length > 0 ? `(${assets.length})` : ''}</h2>
          
          <div className="relative w-full md:w-64">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or symbol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th 
                  className={`px-4 py-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer`}
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center">
                    Asset
                    {sortBy === 'name' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className={`px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer`}
                  onClick={() => toggleSort('supplyApy')}
                >
                  <div className="flex items-center justify-end">
                    Supply APY
                    {sortBy === 'supplyApy' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th 
                  className={`px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer`}
                  onClick={() => toggleSort('borrowApr')}
                >
                  <div className="flex items-center justify-end">
                    Borrow APR
                    {sortBy === 'borrowApr' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                  Available Liquidity
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.sort(sortAssets).map((asset) => (
                <tr 
                  key={asset.tokenAddress}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                        {asset.symbol.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium">{asset.symbol}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {asset.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right text-green-600 dark:text-green-400 font-medium">
                    {formatAPY(asset.liquidityRate)}
                  </td>
                  <td className="px-4 py-4 text-right text-red-600 dark:text-red-400 font-medium">
                    {formatAPY(asset.variableBorrowRate)}
                  </td>
                  <td className="px-4 py-4 text-right font-medium">
                    {formatLiquidity(asset.availableLiquidity)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => onSupply(asset)}
                        disabled={!asset.usageAsCollateralEnabled}
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                        Supply
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => onBorrow(asset)}
                        disabled={!asset.borrowingEnabled}
                      >
                        <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                        Borrow
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No assets match your search criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
