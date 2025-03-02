'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { 
  ArrowsRightLeftIcon, 
  MagnifyingGlassIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

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

interface TokensListProps {
  tokens: TokenBalance[];
  onSwapClick?: (token: TokenBalance) => void;
}

export default function TokensList({ tokens, onSwapClick }: TokensListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'value' | 'name' | 'chain'>('value');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter tokens based on search term
  const filteredTokens = tokens.filter(token => 
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.chain.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort tokens based on sort criteria
  const sortedTokens = [...filteredTokens].sort((a, b) => {
    if (sortBy === 'value') {
      const valueA = parseFloat(a.balanceUSD.replace(/[^0-9.-]+/g, ''));
      const valueB = parseFloat(b.balanceUSD.replace(/[^0-9.-]+/g, ''));
      return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
    } else if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.symbol.localeCompare(b.symbol)
        : b.symbol.localeCompare(a.symbol);
    } else {
      return sortDirection === 'asc'
        ? a.chain.localeCompare(b.chain)
        : b.chain.localeCompare(a.chain);
    }
  });

  const toggleSort = (criteria: 'value' | 'name' | 'chain') => {
    if (sortBy === criteria) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(criteria);
      setSortDirection('desc');
    }
  };

  if (!tokens || tokens.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-500 dark:text-gray-400">
              No tokens found. Connect your wallet to see your token balances.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate total portfolio value
  const totalValue = tokens.reduce((sum, token) => {
    const value = parseFloat(token.balanceUSD.replace(/[^0-9.-]+/g, ''));
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Your Tokens</h2>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Total Value: <span className="font-semibold text-gray-900 dark:text-white">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Search tokens by name or symbol"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSort('name')}
                  >
                    <div className="flex items-center">
                      Token
                      {sortBy === 'name' && (
                        <ChevronDownIcon 
                          className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} 
                        />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Balance
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSort('value')}
                  >
                    <div className="flex items-center">
                      Value
                      {sortBy === 'value' && (
                        <ChevronDownIcon 
                          className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} 
                        />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer"
                    onClick={() => toggleSort('chain')}
                  >
                    <div className="flex items-center">
                      Chain
                      {sortBy === 'chain' && (
                        <ChevronDownIcon 
                          className={`ml-1 h-4 w-4 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`} 
                        />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedTokens.map((token) => (
                  <tr key={`${token.address}-${token.chainId}`} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {token.symbol}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {token.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {parseFloat(token.balance).toLocaleString(undefined, { 
                          minimumFractionDigits: 0, 
                          maximumFractionDigits: 6 
                        })}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Price: {token.priceUSD}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {token.balanceUSD}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                        {token.chain}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 dark:text-blue-400"
                        onClick={() => onSwapClick && onSwapClick(token)}
                      >
                        <ArrowsRightLeftIcon className="h-4 w-4 mr-1" />
                        Swap
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
