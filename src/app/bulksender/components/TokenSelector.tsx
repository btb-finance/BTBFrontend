'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { ethers } from 'ethers';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// Default list of common tokens on Base
const defaultTokens = [
  {
    address: '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB',
    name: 'BTB Finance',
    symbol: 'BTB',
    logo: '/images/btblogo.jpg' // Logo from the website
  },
  {
    address: '0x4200000000000000000000000000000000000006',
    name: 'Wrapped Ether',
    symbol: 'WETH',
    logo: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png'
  },
  {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USD Coin',
    symbol: 'USDC',
    logo: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  },
  {
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    name: 'USD Base Coin',
    symbol: 'USDbC',
    logo: 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  }
];

// Minimal ERC20 ABI for token interactions
const erc20ABI = [
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  }
];

interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  logo?: string;
  balance?: string;
  decimals?: number;
}

interface TokenSelectorProps {
  isConnected: boolean;
  selectedToken: string;
  setSelectedToken: (token: string) => void;
  connectWallet: () => Promise<void>;
}

export default function TokenSelector({
  isConnected,
  selectedToken,
  setSelectedToken,
  connectWallet
}: TokenSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tokenList, setTokenList] = useState<TokenMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [error, setError] = useState('');

  // Load common tokens on mount
  useEffect(() => {
    setTokenList(defaultTokens);
    setIsLoading(false);
  }, []);

  // Fetch balances when wallet is connected
  useEffect(() => {
    if (isConnected && tokenList.length > 0) {
      fetchTokenBalances();
    }
  }, [isConnected, tokenList.length]);

  // Fetch balances for common tokens
  const fetchTokenBalances = async () => {
    if (!isConnected || !window.ethereum) return;

    setIsLoading(true);
    try {
      if (!window.ethereum) throw new Error("Ethereum provider not found");
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const updatedTokens = await Promise.all(
        tokenList.map(async (token) => {
          try {
            const tokenContract = new ethers.Contract(token.address, erc20ABI, provider);
            const decimals = await tokenContract.decimals();
            const balance = await tokenContract.balanceOf(address);
            
            return {
              ...token,
              balance: ethers.formatUnits(balance, decimals),
              decimals
            };
          } catch (error) {
            console.error(`Error fetching data for token ${token.symbol}:`, error);
            return token;
          }
        })
      );

      setTokenList(updatedTokens);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter tokens based on search query
  const filteredTokens = tokenList.filter(token =>
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add custom token
  const addCustomToken = async () => {
    if (!ethers.utils.isAddress(customTokenAddress)) {
      setError('Invalid token address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (!window.ethereum) throw new Error("Ethereum provider not found");
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.providers.ExternalProvider);
      const tokenContract = new ethers.Contract(customTokenAddress, erc20ABI, provider);
      
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      let balance = '0';
      if (isConnected) {
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balanceWei = await tokenContract.balanceOf(address);
        balance = ethers.formatUnits(balanceWei, decimals);
      }

      // Check if token already exists in the list
      const exists = tokenList.some(token => 
        token.address.toLowerCase() === customTokenAddress.toLowerCase()
      );

      if (!exists) {
        const newToken = {
          address: customTokenAddress,
          name,
          symbol,
          balance,
          decimals
        };
        
        setTokenList([newToken, ...tokenList]);
        setCustomTokenAddress('');
      } else {
        setError('Token already in your list');
      }
    } catch (error) {
      console.error('Error adding custom token:', error);
      setError('Error loading token data. Please check the address and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a token
  const handleSelectToken = (address: string) => {
    setSelectedToken(address);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Select Token</h3>
        
        {/* Search and Custom Token Input */}
        <div className="mb-4">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search by name, symbol, or address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <MagnifyingGlassIcon className="absolute top-2.5 left-3 w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>
          
          <div className="flex space-x-2 mb-4">
            <input
              type="text"
              placeholder="Custom token address"
              value={customTokenAddress}
              onChange={(e) => setCustomTokenAddress(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <Button
              variant="outline"
              onClick={addCustomToken}
              disabled={!customTokenAddress || isLoading}
            >
              Add
            </Button>
          </div>
          
          {error && (
            <p className="text-red-500 dark:text-red-400 text-sm mb-4">{error}</p>
          )}
          
          {/* Refresh button */}
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchTokenBalances}
              disabled={!isConnected || isLoading}
              className="flex items-center"
            >
              <ArrowPathIcon className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Token List */}
        <div className="max-h-80 overflow-y-auto">
          {isConnected ? (
            filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <div
                  key={token.address}
                  className={`flex justify-between items-center p-3 mb-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 border ${selectedToken === token.address ? 'border-btb-primary' : 'border-gray-200 dark:border-gray-700'}`}
                  onClick={() => handleSelectToken(token.address)}
                >
                  <div className="flex items-center">
                    {token.logo ? (
                      <img src={token.logo} alt={token.symbol} className="w-8 h-8 mr-3 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 mr-3 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-xs font-bold">{token.symbol?.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{token.symbol}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{token.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {token.balance 
                        ? parseFloat(token.balance).toFixed(4) 
                        : isLoading ? '...' : '0.0000'}
                    </p>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">No tokens found</p>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">Loading tokens...</p>
            )
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">Connect your wallet to view your tokens</p>
              <Button onClick={connectWallet} className="bg-btb-primary hover:bg-btb-primary-dark text-white">
                Connect Wallet
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}