'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { ArrowsRightLeftIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import kyberSwapService from '@/app/services/kyberSwapService';
import walletDataService from '@/app/services/walletDataService';

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain: string;
  chainId?: number;
  balance?: string;
  balanceUSD?: string;
}

interface TokenSwapProps {
  tokens: TokenOption[];
  selectedToken?: TokenOption | null;
  onSwapComplete?: () => void;
}

export default function TokenSwap({ tokens, selectedToken, onSwapComplete }: TokenSwapProps) {
  // Use localStorage to check if wallet is connected instead of wagmi
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const [fromToken, setFromToken] = useState<TokenOption | null>(null);
  const [toToken, setToToken] = useState<TokenOption | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [slippage, setSlippage] = useState<number>(1.0); // Default 1% slippage
  const [quoteData, setQuoteData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [swapStatus, setSwapStatus] = useState<'idle' | 'quoting' | 'approving' | 'swapping' | 'success' | 'error'>('idle');
  
  // Check if wallet is connected on component mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    if (savedAddress) {
      setAddress(savedAddress);
      setIsConnected(true);
    }
  }, []);

  // Set default tokens when component loads
  useEffect(() => {
    if (tokens.length > 0) {
      // If a token was selected from the TokensList, use it as the fromToken
      if (selectedToken) {
        setFromToken(selectedToken);
        // Try to find a suitable default for toToken
        const usdcToken = tokens.find(t => t.symbol === 'USDC');
        const ethToken = tokens.find(t => t.symbol === 'ETH');
        // Don't set the same token for both from and to
        if (usdcToken && selectedToken.symbol !== 'USDC') {
          setToToken(usdcToken);
        } else if (ethToken && selectedToken.symbol !== 'ETH') {
          setToToken(ethToken);
        } else {
          // Just pick the first token that's not the selectedToken
          const differentToken = tokens.find(t => t.symbol !== selectedToken.symbol);
          if (differentToken) setToToken(differentToken);
        }
      } else {
        // Default behavior when no token is selected
        const ethToken = tokens.find(t => t.symbol === 'ETH');
        const usdcToken = tokens.find(t => t.symbol === 'USDC');
        
        if (ethToken) setFromToken(ethToken);
        if (usdcToken) setToToken(usdcToken);
      }
    }
  }, [tokens, selectedToken]);

  // Swap the from and to tokens
  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setQuoteData(null);
  };

  // Get a quote for the swap
  const getQuote = async () => {
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !isConnected || !address) {
      setError('Please enter a valid amount and select tokens');
      return;
    }

    setError(null);
    setSwapStatus('quoting');
    setIsLoading(true);

    try {
      // Validate token addresses
      if (!fromToken.address || !toToken.address) {
        throw new Error('Invalid token address');
      }
      
      // Get provider from window.ethereum
      let provider;
      try {
        provider = new ethers.providers.Web3Provider(window.ethereum as any);
        kyberSwapService.setProviderAndSigner(provider);
      } catch (error) {
        console.error('Error connecting to provider:', error);
        throw new Error('Could not connect to wallet. Please make sure MetaMask is installed and unlocked.');
      }

      // Use try/catch for the quote to handle potential errors
      try {
        const quote = await kyberSwapService.getFormattedQuote(
          fromToken.address,
          toToken.address,
          amount,
          address,
          fromToken.decimals,
          toToken.decimals
        );

        setQuoteData(quote);
        setSwapStatus('idle');
      } catch (error: any) {
        console.error('Error getting quote:', error);
        throw new Error(`Failed to get quote: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in getQuote:', error);
      setError(error.message || 'An unknown error occurred');
      setSwapStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute the swap
  const executeSwap = async () => {
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || !isConnected || !address) {
      setError('Please enter a valid amount and select tokens');
      return;
    }

    setError(null);
    setSwapStatus('approving');
    setIsLoading(true);

    try {
      // Validate token addresses
      if (!fromToken.address || !toToken.address) {
        throw new Error('Invalid token address');
      }
      
      // Get provider from window.ethereum
      let provider;
      try {
        provider = new ethers.providers.Web3Provider(window.ethereum as any);
        kyberSwapService.setProviderAndSigner(provider);
      } catch (error) {
        console.error('Error connecting to provider:', error);
        throw new Error('Could not connect to wallet. Please make sure MetaMask is installed and unlocked.');
      }

      setSwapStatus('swapping');
      try {
        const receipt = await kyberSwapService.executeSwap(
          fromToken.address,
          toToken.address,
          amount,
          slippage,
          address,
          fromToken.decimals
        );

        console.log('Swap successful:', receipt);
        setSwapStatus('success');
        
        // Reset form
        setAmount('');
        setQuoteData(null);
        
        // Notify parent component that swap is complete
        if (onSwapComplete) {
          onSwapComplete();
        }
      } catch (error: any) {
        console.error('Error executing swap:', error);
        throw new Error(`Failed to execute swap: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error in executeSwap:', error);
      setError(error.message || 'An unknown error occurred');
      setSwapStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  // Format the exchange rate for display
  const formatExchangeRate = () => {
    if (!quoteData || !fromToken || !toToken) return null;
    
    const amountIn = parseFloat(amount);
    const amountOut = parseFloat(quoteData.formattedOutputAmount);
    
    if (isNaN(amountIn) || isNaN(amountOut) || amountIn === 0) return null;
    
    const rate = amountOut / amountIn;
    return `1 ${fromToken.symbol} = ${rate.toFixed(6)} ${toToken.symbol}`;
  };

  // Calculate max amount user can swap
  const setMaxAmount = () => {
    if (fromToken && fromToken.balance) {
      setAmount(fromToken.balance);
      setQuoteData(null);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Swap Tokens</h2>
            <div className="flex items-center space-x-2">
              <Label htmlFor="slippage">Slippage:</Label>
              <Select
                value={slippage.toString()}
                onValueChange={(value) => setSlippage(parseFloat(value))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Slippage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">0.5%</SelectItem>
                  <SelectItem value="1.0">1.0%</SelectItem>
                  <SelectItem value="2.0">2.0%</SelectItem>
                  <SelectItem value="3.0">3.0%</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {/* From Token */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="fromAmount">From</Label>
                {fromToken && fromToken.balance && (
                  <button 
                    onClick={setMaxAmount}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Balance: {parseFloat(fromToken.balance).toFixed(6)} {fromToken.symbol}
                  </button>
                )}
              </div>
              <div className="flex space-x-2">
                <div className="w-2/3">
                  <Input
                    id="fromAmount"
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setQuoteData(null);
                    }}
                    disabled={isLoading}
                  />
                </div>
                <div className="w-1/3">
                  <Select
                    value={fromToken?.symbol || ''}
                    onValueChange={(value) => {
                      const selected = tokens.find(t => t.symbol === value);
                      if (selected) {
                        setFromToken(selected);
                        setQuoteData(null);
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokens.map((token) => (
                        <SelectItem key={`${token.symbol}-${token.chainId}`} value={token.symbol}>
                          {token.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Swap Button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                disabled={isLoading}
              >
                <ArrowsRightLeftIcon className="h-6 w-6" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <Label htmlFor="toAmount">To (Estimated)</Label>
              <div className="flex space-x-2">
                <div className="w-2/3">
                  <Input
                    id="toAmount"
                    type="text"
                    placeholder="0.0"
                    value={quoteData ? quoteData.formattedOutputAmount : ''}
                    readOnly
                    disabled
                  />
                </div>
                <div className="w-1/3">
                  <Select
                    value={toToken?.symbol || ''}
                    onValueChange={(value) => {
                      const selected = tokens.find(t => t.symbol === value);
                      if (selected) {
                        setToToken(selected);
                        setQuoteData(null);
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select token" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokens.map((token) => (
                        <SelectItem key={`${token.symbol}-${token.chainId}`} value={token.symbol}>
                          {token.symbol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Exchange Rate */}
            {quoteData && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Exchange Rate:</span>
                  <span>{formatExchangeRate()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Price Impact:</span>
                  <span className={quoteData.routeSummary.priceImpact > 5 ? 'text-red-500' : ''}>
                    {quoteData.routeSummary.priceImpact.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="text-sm text-red-500 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-2">
              {!quoteData ? (
                <Button 
                  className="w-full" 
                  onClick={getQuote}
                  disabled={!fromToken || !toToken || !amount || parseFloat(amount) <= 0 || isLoading}
                >
                  {isLoading && swapStatus === 'quoting' ? (
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                  ) : null}
                  Get Quote
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={executeSwap}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      {swapStatus === 'approving' ? 'Approving...' : 'Swapping...'}
                    </>
                  ) : (
                    `Swap ${fromToken?.symbol} for ${toToken?.symbol}`
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
