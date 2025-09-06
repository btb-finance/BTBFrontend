'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import { 
  WalletIcon,
  ArrowUpDownIcon,
  InfoIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LoaderIcon,
  SettingsIcon,
  RefreshCcwIcon
} from 'lucide-react';
import { useAccount, useBalance, useContractRead } from 'wagmi';
import { TokenInfo, getTokenSymbolFromAddress } from '../services/leverageTokenService';
import leverageTokenService from '../services/leverageTokenService';

interface TradingPanelProps {
  selectedToken: TokenInfo;
  onTokenChange?: (token: TokenInfo) => void;
}

export default function TradingPanel({ selectedToken }: TradingPanelProps) {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'trade' | 'leverage' | 'manage'>('trade');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('1.0');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Leverage specific states
  const [leverageAmount, setLeverageAmount] = useState('');
  const [leverageDays, setLeverageDays] = useState('30');
  const [leverageFee, setLeverageFee] = useState('0');
  const [isLeverageProcessing, setIsLeverageProcessing] = useState(false);
  
  // Transaction states
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);
  
  // Balance states
  const [tokenBalance, setTokenBalance] = useState('0');
  const [backingBalance, setBackingBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  
  // Loan info
  const [loanInfo, setLoanInfo] = useState<any>(null);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !address) return;
      
      try {
        const userBalance = await leverageTokenService.getUserBalance(selectedToken.leverageContract, address);
        setTokenBalance(userBalance.balance);
        setBackingBalance(userBalance.backingBalance);
        
        // Fetch loan info
        const loan = await leverageTokenService.getUserLoan(selectedToken.leverageContract, address);
        setLoanInfo(loan);
      } catch (err) {
        console.error('Error fetching balances:', err);
      }
    };
    
    fetchBalances();
    const interval = setInterval(fetchBalances, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address, selectedToken]);

  // Get quote when amount changes
  useEffect(() => {
    const getQuote = async () => {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setQuote(null);
        return;
      }
      
      try {
        if (tradeType === 'buy') {
          const buyQuote = await leverageTokenService.getBuyQuote(selectedToken.leverageContract, amount);
          setQuote(buyQuote);
        }
      } catch (err) {
        console.error('Error getting quote:', err);
        setQuote(null);
      }
    };
    
    getQuote();
  }, [amount, tradeType, selectedToken]);

  // Get leverage fee quote
  useEffect(() => {
    const getLeverageFeeQuote = async () => {
      if (!leverageAmount || isNaN(Number(leverageAmount)) || Number(leverageAmount) <= 0 || !leverageDays || parseInt(leverageDays) < 1 || parseInt(leverageDays) > 365) {
        setLeverageFee('0');
        return;
      }

      try {
        const fee = await leverageTokenService.getLeverageFee(selectedToken.leverageContract, leverageAmount, leverageDays);
        setLeverageFee(fee);
      } catch (err) {
        console.error('Error getting leverage fee:', err);
        setLeverageFee('0');
      }
    };

    getLeverageFeeQuote();
  }, [leverageAmount, leverageDays, selectedToken]);

  const handleTrade = async () => {
    if (!isConnected || !address) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      let txHash: string;
      
      if (tradeType === 'buy') {
        txHash = await leverageTokenService.executeBuy(selectedToken.leverageContract, amount, address);
      } else {
        txHash = await leverageTokenService.executeSell(selectedToken.leverageContract, amount);
      }
      
      setTxHash(txHash);
      setAmount('');
      
      // Refresh balances after successful transaction
      setTimeout(() => {
        // This would trigger a balance refresh
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLeverage = async () => {
    if (!isConnected || !address) return;
    if (!leverageAmount || Number(leverageAmount) <= 0 || !leverageDays || (parseInt(leverageDays) < 1 || parseInt(leverageDays) > 365)) {
      setError('Invalid amount or days. Amount must be > 0, days 1-365.');
      return;
    }

    setIsLeverageProcessing(true);
    setError(null);

    try {
      const txHash = await leverageTokenService.executeLeverage(
        selectedToken.leverageContract,
        leverageAmount,
        leverageDays,
        address
      );
      setTxHash(txHash);
      setLeverageAmount('');
      setLeverageDays('30');
    } catch (err: any) {
      setError(err.message || 'Leverage transaction failed');
    } finally {
      setIsLeverageProcessing(false);
    }
  };

  const maxBalance = tradeType === 'buy' ? backingBalance : tokenBalance;
  const maxPercentages = [25, 50, 75, 100];

  const setMaxAmount = (percentage: number) => {
    const max = Number(maxBalance);
    const newAmount = ((max * percentage) / 100).toString();
    setAmount(newAmount);
  };

  return (
    <div className="space-y-6">
      {/* Token Info Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-btb-primary to-btb-primary-light rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {selectedToken.symbol.replace('lev', '').slice(0, 2)}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold">{selectedToken.symbol}</h3>
              <p className="text-sm text-gray-500">{selectedToken.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <InfoIcon className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-500">Current Price</div>
            <div className="text-xl font-bold">{selectedToken.price || '$0.00'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">24h Change</div>
            <div className={`text-xl font-bold flex items-center ${
              (selectedToken.priceChange24h || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(selectedToken.priceChange24h || 0) >= 0 ? (
                <TrendingUpIcon className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDownIcon className="w-4 h-4 mr-1" />
              )}
              {(selectedToken.priceChange24h || 0) >= 0 ? '+' : ''}
              {(selectedToken.priceChange24h || 0).toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Leverage</div>
            <div className="font-semibold text-btb-primary">{selectedToken.leverage || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">APY</div>
            <div className="font-semibold text-green-600">{selectedToken.apy || 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">TVL</div>
            <div className="font-semibold">{selectedToken.tvl || '$0'}</div>
          </div>
        </div>
      </Card>

      {/* Trading Interface */}
      <Card className="p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trade">Trade</TabsTrigger>
            <TabsTrigger value="leverage">Leverage</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
          </TabsList>
          
          {/* Trade Tab */}
          <TabsContent value="trade" className="space-y-4 mt-6">
            <div className="flex space-x-2 mb-4">
              <Button
                variant={tradeType === 'buy' ? "default" : "outline"}
                onClick={() => setTradeType('buy')}
                className={`flex-1 ${tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                Buy {selectedToken.symbol}
              </Button>
              <Button
                variant={tradeType === 'sell' ? "default" : "outline"}
                onClick={() => setTradeType('sell')}
                className={`flex-1 ${tradeType === 'sell' ? 'bg-red-600 hover:bg-red-700' : ''}`}
              >
                Sell {selectedToken.symbol}
              </Button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <Label>
                  Amount ({tradeType === 'buy' ? getTokenSymbolFromAddress(selectedToken.backingToken) : selectedToken.symbol})
                </Label>
                <div className="text-xs text-gray-500">
                  Balance: {Number(maxBalance).toFixed(4)} {tradeType === 'buy' ? getTokenSymbolFromAddress(selectedToken.backingToken) : selectedToken.symbol}
                </div>
              </div>
              <div className="relative">
                <Input
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  step="0.0001"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAmount(maxBalance)}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs h-6"
                >
                  MAX
                </Button>
              </div>
              
              {/* Quick percentage buttons */}
              <div className="flex space-x-2 mt-2">
                {maxPercentages.map((percentage) => (
                  <Button
                    key={percentage}
                    variant="outline"
                    size="sm"
                    onClick={() => setMaxAmount(percentage)}
                    className="flex-1 text-xs"
                  >
                    {percentage}%
                  </Button>
                ))}
              </div>
            </div>

            {/* Quote Display */}
            {quote && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>You'll receive (approx)</span>
                  <span className="font-semibold">{Number(quote.tokensOut).toFixed(4)} {selectedToken.symbol}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Trading Fee</span>
                  <span>{Number(quote.fee).toFixed(4)} ETH</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Price Impact</span>
                  <span>{quote.priceImpact}%</span>
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm"
              >
                <SettingsIcon className="w-4 h-4 mr-2" />
                Advanced Settings
              </Button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-3 p-3 border rounded-lg space-y-3"
                  >
                    <div>
                      <Label>Slippage Tolerance (%)</Label>
                      <div className="flex space-x-2 mt-1">
                        {['0.5', '1.0', '2.0', '5.0'].map((s) => (
                          <Button
                            key={s}
                            variant={slippage === s ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSlippage(s)}
                            className="flex-1"
                          >
                            {s}%
                          </Button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Error Display */}
            {error && (
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertCircleIcon className="w-4 h-4" />
                <div>{error}</div>
              </Alert>
            )}

            {/* Success Display */}
            {txHash && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <CheckCircleIcon className="w-4 h-4" />
                <div>
                  Transaction submitted! 
                  <a 
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 underline"
                  >
                    View on Explorer
                  </a>
                </div>
              </Alert>
            )}

            {/* Trade Button */}
            {!isConnected ? (
              <Button className="w-full btn-primary">
                <WalletIcon className="w-4 h-4 mr-2" />
                Connect Wallet
              </Button>
            ) : (
              <Button 
                className={`w-full ${tradeType === 'buy' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
                onClick={handleTrade}
                disabled={isProcessing || !amount || Number(amount) <= 0}
              >
                {isProcessing ? (
                  <>
                    <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${selectedToken.symbol}`
                )}
              </Button>
            )}
          </TabsContent>

          {/* Leverage Tab */}
          <TabsContent value="leverage" className="space-y-4 mt-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Open Leverage Position</h3>
              <p className="text-sm text-gray-500 mb-4">Deposit backing tokens to open a leveraged position with automatic rebalancing</p>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">Backing Amount ({getTokenSymbolFromAddress(selectedToken.backingToken)})</Label>
                  <Input
                    placeholder="0.0"
                    value={leverageAmount}
                    onChange={(e) => setLeverageAmount(e.target.value)}
                    type="number"
                    step="0.0001"
                    className="mt-1"
                  />
                  <div className="flex space-x-2 mt-2">
                    {[25, 50, 75, 100].map((percentage) => (
                      <Button
                        key={percentage}
                        variant="outline"
                        size="sm"
                        onClick={() => setLeverageAmount((Number(backingBalance) * percentage / 100).toString())}
                        className="flex-1 text-xs"
                      >
                        {percentage}%
                      </Button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Balance: {Number(backingBalance).toFixed(4)} {getTokenSymbolFromAddress(selectedToken.backingToken)}
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Position Duration (Days)</Label>
                  <Input
                    placeholder="30"
                    value={leverageDays}
                    onChange={(e) => setLeverageDays(e.target.value)}
                    type="number"
                    min="1"
                    max="365"
                    className="mt-1"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Max 365 days. Position will auto-liquidate after expiration.
                  </div>
                </div>

                {leverageFee !== '0' && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span>Estimated Fees</span>
                      <span className="font-semibold">{leverageFee} {getTokenSymbolFromAddress(selectedToken.backingToken)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Includes minting and interest fees
                    </div>
                  </div>
                )}

                {error && (
                  <Alert className="border-red-200 bg-red-50 text-red-800">
                    <AlertCircleIcon className="w-4 h-4" />
                    <div>{error}</div>
                  </Alert>
                )}

                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleLeverage}
                  disabled={isLeverageProcessing || !leverageAmount || Number(leverageAmount) <= 0 || !leverageDays || (parseInt(leverageDays) < 1 || parseInt(leverageDays) > 365)}
                >
                  {isLeverageProcessing ? (
                    <>
                      <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Open ${selectedToken.leverage}x Position`
                  )}
                </Button>
              </div>

              <div className="mt-6 p-4 border rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center mb-2">
                  <InfoIcon className="w-4 h-4 mr-2 text-blue-600" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">Important</span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Leverage positions require 100% collateralization. Positions auto-liquidate daily after expiration.
                  Monitor your position regularly to avoid liquidation.
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Manage Tab */}
          <TabsContent value="manage" className="space-y-4 mt-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Portfolio Management</h3>
              
              {/* Current Holdings */}
              <div className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium">Current Holdings</h4>
                  <Button variant="ghost" size="sm">
                    <RefreshCcwIcon className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{selectedToken.symbol} Balance</span>
                    <span className="font-medium">{Number(tokenBalance).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Backing Token Balance</span>
                    <span className="font-medium">{Number(backingBalance).toFixed(4)} {getTokenSymbolFromAddress(selectedToken.backingToken)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Value</span>
                    <span className="font-medium">$0.00</span>
                  </div>
                </div>
              </div>

              {/* Active Loans */}
              {loanInfo && (loanInfo.collateral !== '0' || loanInfo.borrowed !== '0') && (
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Active Loan</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Collateral</span>
                      <span className="font-medium">{Number(loanInfo.collateral).toFixed(4)} {getTokenSymbolFromAddress(selectedToken.backingToken)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Borrowed</span>
                      <span className="font-medium">{Number(loanInfo.borrowed).toFixed(4)} {getTokenSymbolFromAddress(selectedToken.backingToken)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status</span>
                      <Badge variant={loanInfo.isExpired ? "destructive" : "success"}>
                        {loanInfo.isExpired ? "Expired" : "Active"}
                      </Badge>
                    </div>
                    {loanInfo.endDate > 0 && (
                      <div className="flex justify-between">
                        <span>Expires</span>
                        <span className="font-medium">
                          {new Date(loanInfo.endDate * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 mt-4">
                    <Button variant="outline" size="sm" className="flex-1">
                      Repay Loan
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Extend Loan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}