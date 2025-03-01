'use client';

import { useState, useEffect } from 'react';
import { useWalletConnection } from '@/app/hooks/useWalletConnection';
import kyberSwapService from '@/app/services/kyberSwapService';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { InfoIcon, RefreshCwIcon, ArrowDownIcon } from 'lucide-react';
import { ethers } from 'ethers';

// Token configuration
const TOKENS = {
  ETH: {
    address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    symbol: 'ETH',
    decimals: 18,
    name: 'Ethereum'
  },
  USDC: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin'
  },
  BTB: {
    address: '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB',
    symbol: 'BTB',
    decimals: 18,
    name: 'BTB Token'
  },
  BTBY: {
    address: '0xBB6e8c1e49f04C9f6c4D6163c52990f92431FdBB',
    symbol: 'BTBY',
    decimals: 18,
    name: 'BTBY Token'
  }
};

export default function KyberSwapExchange() {
  const { isConnected, address: account } = useWalletConnection();
  const [fromToken, setFromToken] = useState<keyof typeof TOKENS>('ETH');
  const [toToken, setToToken] = useState<keyof typeof TOKENS>('BTB');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippageTolerance, setSlippageTolerance] = useState('1.0');
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  const [balances, setBalances] = useState<Record<string, string>>({
    ETH: '0',
    USDC: '0',
    BTB: '0',
    BTBY: '0'
  });

  // Initialize provider and signer when component mounts
  useEffect(() => {
    const initializeProviderAndSigner = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum as any);
          kyberSwapService.setProviderAndSigner(provider);
          console.log('Provider and signer initialized on component mount');
        } catch (error) {
          console.error('Error initializing provider and signer:', error);
        }
      }
    };

    initializeProviderAndSigner();
  }, []);

  // Set provider and signer when wallet connection changes
  useEffect(() => {
    if (isConnected && window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      kyberSwapService.setProviderAndSigner(provider);
    }
  }, [isConnected]);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !account) return;

      try {
        if (window.ethereum) {
          const provider = new ethers.providers.Web3Provider(window.ethereum as any);
          kyberSwapService.setProviderAndSigner(provider);
          
          const newBalances: Record<string, string> = {};
          for (const [symbol, token] of Object.entries(TOKENS)) {
            const balance = await kyberSwapService.getTokenBalance(
              token.address,
              account
            );
            newBalances[symbol] = balance;
          }
          
          setBalances(newBalances);
        }
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    };

    fetchBalances();
  }, [isConnected, account]);

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken as keyof typeof TOKENS);
    setToToken(temp as keyof typeof TOKENS);
    setFromAmount(toAmount);
    setToAmount('');
    setQuote(null);
  };

  const executeSwap = async () => {
    if (!isConnected || !account) {
      setError('Please connect your wallet first');
      return;
    }

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsSwapping(true);
    setError(null);
    
    try {
      const fromTokenObj = TOKENS[fromToken];
      const toTokenObj = TOKENS[toToken];
      
      setSwapStatus('Preparing swap...');
      
      // Use a higher slippage tolerance to avoid "Return amount is not enough" errors
      // Convert from percentage string to decimal (e.g., "0.5" -> 0.005)
      const slippageValue = Number(slippageTolerance) / 100;
      
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        kyberSwapService.setProviderAndSigner(provider);
        
        const result = await kyberSwapService.executeSwap(
          fromTokenObj.address,
          toTokenObj.address,
          fromAmount,
          slippageValue,
          account,
          fromTokenObj.decimals
        );
        
        console.log('Swap executed successfully:', result);
        setSwapStatus('Swap completed successfully!');
        
        // Refresh balances after swap
        const newBalances: Record<string, string> = {};
        for (const [symbol, token] of Object.entries(TOKENS)) {
          const balance = await kyberSwapService.getTokenBalance(
            token.address,
            account
          );
          newBalances[symbol] = balance;
        }
        
        setBalances(newBalances);
        
        // Reset form
        setFromAmount('');
        setToAmount('');
        setQuote(null);
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      
      let errorMessage = error.message || 'An error occurred during the swap';
      
      // Handle specific error cases
      if (errorMessage.includes('Return amount is not enough')) {
        errorMessage = 'Price changed during transaction. Try increasing slippage tolerance or try again later.';
      } else if (errorMessage.includes('user rejected transaction')) {
        errorMessage = 'Transaction was rejected by user.';
      } else if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for this swap.';
      }
      
      setError(errorMessage);
      setSwapStatus(null);
    } finally {
      setIsSwapping(false);
    }
  };

  const fetchQuote = async () => {
    if (!fromAmount || !fromToken || !toToken) {
      setQuote(null);
      setToAmount('');
      return;
    }

    try {
      setIsSwapping(true);
      setError(null);

      // Ensure provider and signer are set before fetching quote
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        kyberSwapService.setProviderAndSigner(provider);
      } else {
        throw new Error('Ethereum provider not available');
      }

      const quote = await kyberSwapService.getFormattedQuote(
        TOKENS[fromToken].address,
        TOKENS[toToken].address,
        fromAmount,
        account || undefined,
        TOKENS[fromToken].decimals
      );

      setQuote(quote);
      if (quote.formattedOutputAmount) {
        setToAmount(quote.formattedOutputAmount);
      } else {
        setToAmount('');
      }
    } catch (error: any) {
      console.error('Error fetching quote:', error);
      setError(`Error fetching quote: ${error.message}`);
      setQuote(null);
      setToAmount('');
    } finally {
      setIsSwapping(false);
    }
  };

  useEffect(() => {
    fetchQuote();
  }, [fromToken, toToken, fromAmount, account]);

  return (
    <Card className="p-6 w-full max-w-md mx-auto bg-btb-background border-btb-border">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-btb-text">Swap</h2>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Open slippage settings modal or dropdown
                const newSlippage = prompt('Enter slippage tolerance (%):', slippageTolerance);
                if (newSlippage !== null) {
                  const slippageValue = parseFloat(newSlippage);
                  if (!isNaN(slippageValue) && slippageValue > 0 && slippageValue <= 50) {
                    setSlippageTolerance(newSlippage);
                  } else {
                    setError('Please enter a valid slippage between 0.1 and 50%');
                  }
                }
              }}
              className="text-xs"
              title="Adjust slippage tolerance"
            >
              Slippage: {slippageTolerance}%
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchQuote()}
              className="text-xs"
              title="Refresh quote"
            >
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {!isConnected && (
          <Alert className="bg-yellow-100 border-yellow-400 text-yellow-700">
            You need to connect your wallet to execute swaps.
          </Alert>
        )}
        
        {error && (
          <Alert className="bg-red-100 border-red-400 text-red-700">
            {error}
          </Alert>
        )}
        
        {swapStatus && (
          <Alert className="bg-blue-100 border-blue-400 text-blue-700">
            {swapStatus}
          </Alert>
        )}
        
        {/* From Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
            {isConnected && (
              <span className="text-sm text-gray-500">
                Balance: {balances[fromToken]} {fromToken}
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <Select
              value={fromToken}
              onValueChange={(value: string) => setFromToken(value as keyof typeof TOKENS)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TOKENS).map(([symbol, token]) => (
                  <SelectItem key={symbol} value={symbol}>
                    {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="flex-1"
              min="0"
            />
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSwapTokens}
            className="rounded-full"
          >
            <ArrowDownIcon className="h-4 w-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To</label>
            {isConnected && (
              <span className="text-sm text-gray-500">
                Balance: {balances[toToken]} {toToken}
              </span>
            )}
          </div>
          <div className="flex space-x-2">
            <Select
              value={toToken}
              onValueChange={(value: string) => setToToken(value as keyof typeof TOKENS)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Select token" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TOKENS).map(([symbol, token]) => (
                  <SelectItem key={symbol} value={symbol}>
                    {token.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="flex-1 bg-gray-50"
            />
          </div>
        </div>

        {/* Exchange Rate */}
        {quote && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Exchange Rate:</span>
              <span>
                1 {fromToken} = {quote.exchangeRate?.toFixed(6)} {toToken}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Price Impact:</span>
              <span>{quote.routeSummary?.priceImpact?.toFixed(2)}%</span>
            </div>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={executeSwap}
          disabled={!fromAmount || !quote || isSwapping || !isConnected || fromToken === toToken}
          className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
        >
          {isSwapping ? (
            <div className="flex items-center">
              <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </div>
          ) : !isConnected ? (
            'Connect wallet to swap'
          ) : fromToken === toToken ? (
            'Cannot swap same token'
          ) : !fromAmount ? (
            'Enter amount'
          ) : !quote ? (
            'Get quote'
          ) : (
            `Swap ${fromToken} for ${toToken}`
          )}
        </Button>
      </div>
    </Card>
  );
}
