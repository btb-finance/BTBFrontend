'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import { InfoIcon } from 'lucide-react';
import larryService from '../../services/larryService';

interface TradingInterfaceProps {
  mode?: 'trade' | 'borrow';
}

export default function TradingInterface({ mode = 'trade' }: TradingInterfaceProps) {
  const { isConnected, address } = useWalletConnection();
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [borrowDays, setBorrowDays] = useState('30');
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [borrowQuote, setBorrowQuote] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [userBalance, setUserBalance] = useState('0');

  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address) {
        setUserBalance('0');
        return;
      }
      try {
        const balance = await larryService.getUserBalance(address);
        setUserBalance(balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address]);

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        const price = await larryService.getCurrentPrice();
        setPriceHistory(prev => [...prev, { 
          time: new Date().toLocaleTimeString(), 
          price: parseFloat(price)
        }].slice(-20));
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    };

    fetchPriceHistory();
    const interval = setInterval(fetchPriceHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const getQuote = async () => {
      if (!buyAmount || isNaN(Number(buyAmount))) {
        setBuyQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteBuy(buyAmount);
        setBuyQuote(quote);
      } catch (error) {
        console.error('Error getting buy quote:', error);
        setBuyQuote(null);
      }
    };
    getQuote();
  }, [buyAmount]);

  useEffect(() => {
    const getQuote = async () => {
      if (!sellAmount || isNaN(Number(sellAmount))) {
        setSellQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteSell(sellAmount);
        setSellQuote(quote);
      } catch (error) {
        console.error('Error getting sell quote:', error);
        setSellQuote(null);
      }
    };
    getQuote();
  }, [sellAmount]);

  useEffect(() => {
    const getQuote = async () => {
      if (!borrowAmount || isNaN(Number(borrowAmount)) || !borrowDays) {
        setBorrowQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteBorrow(borrowAmount, borrowDays);
        setBorrowQuote(quote);
      } catch (error) {
        console.error('Error getting borrow quote:', error);
        setBorrowQuote(null);
      }
    };
    getQuote();
  }, [borrowAmount, borrowDays]);

  const handleBuy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Buying LARRY...');
      const tx = await larryService.buyTokens(buyAmount);
      await tx.wait();
      
      setTxStatus('Purchase successful!');
      setBuyAmount('');
      setBuyQuote(null);
    } catch (error: any) {
      console.error('Error buying tokens:', error);
      setError(error?.message || 'Failed to buy tokens');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleSell = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Selling LARRY...');
      const tx = await larryService.sellTokens(sellAmount);
      await tx.wait();
      
      setTxStatus('Sale successful!');
      setSellAmount('');
      setSellQuote(null);
    } catch (error: any) {
      console.error('Error selling tokens:', error);
      setError(error?.message || 'Failed to sell tokens');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleBorrow = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Processing borrow...');
      const tx = await larryService.borrow(borrowAmount, borrowDays);
      await tx.wait();
      
      setTxStatus('Borrow successful!');
      setBorrowAmount('');
      setBorrowQuote(null);
    } catch (error: any) {
      console.error('Error borrowing:', error);
      setError(error?.message || 'Failed to borrow');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  if (mode === 'borrow') {
    return (
      <Card className="p-6">
        <h2 className="text-2xl font-bold text-emerald-600 mb-6">Borrow ETH</h2>
        
        {error && (
          <Alert className="mb-4 bg-red-100 border-red-400 text-red-700">
            {error}
          </Alert>
        )}
        
        {txStatus && (
          <Alert className="mb-4 bg-blue-100 border-blue-400 text-blue-700">
            {txStatus}
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="borrowAmount">ETH Amount to Borrow</Label>
            <Input
              id="borrowAmount"
              type="number"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              placeholder="Enter ETH amount"
              disabled={isProcessing || !isConnected}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="borrowDays">Loan Duration (days)</Label>
            <Input
              id="borrowDays"
              type="number"
              value={borrowDays}
              onChange={(e) => setBorrowDays(e.target.value)}
              placeholder="Enter days"
              min="1"
              max="365"
              disabled={isProcessing || !isConnected}
            />
          </div>

          {borrowQuote && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">You will receive:</span>
                  <span className="text-lg font-bold text-blue-600">{formatNumber(borrowQuote.netAmount)} ETH</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Required LARRY Collateral:</span>
                  <span className="font-medium">{formatNumber(borrowQuote.requiredCollateral)} LARRY</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Interest Fee:</span>
                  <span>{formatNumber(borrowQuote.interestFee)} ETH</span>
                </div>
                <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Collateralization Ratio:</span>
                    <span className="font-medium">101%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">APR:</span>
                    <span className="font-medium">{borrowQuote.apr}%</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Total Interest ({borrowDays} days):</span>
                    <span className="font-medium">{((Number(borrowQuote.apr) * Number(borrowDays)) / 365).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleBorrow}
            disabled={!borrowAmount || !borrowQuote || isProcessing || !isConnected}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isProcessing ? 'Processing...' : 'Borrow ETH'}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-emerald-600">Trading Interface</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <InfoIcon className="h-4 w-4" />
          <span>Price updates every 10s</span>
        </div>
      </div>
      
      {!isConnected && (
        <Alert className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700">
          Please connect your wallet to trade
        </Alert>
      )}
      
      {error && (
        <Alert className="mb-4 bg-red-100 border-red-400 text-red-700">
          {error}
        </Alert>
      )}
      
      {txStatus && (
        <Alert className="mb-4 bg-blue-100 border-blue-400 text-blue-700">
          {txStatus}
        </Alert>
      )}

      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">Your LARRY Balance: {formatNumber(userBalance)}</p>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="price" stroke="#10b981" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="buy" className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="buy" className="w-1/2">Buy LARRY</TabsTrigger>
          <TabsTrigger value="sell" className="w-1/2">Sell LARRY</TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyAmount">ETH Amount</Label>
            <Input
              id="buyAmount"
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="Enter ETH amount"
              disabled={isProcessing || !isConnected}
            />
            {buyQuote && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">You will receive:</span>
                    <span className="text-lg font-bold text-emerald-600">{formatNumber(buyQuote.tokenAmount)} LARRY</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Exchange rate:</span>
                    <span>1 ETH = {formatNumber(Number(buyQuote.tokenAmount) / Number(buyAmount))} LARRY</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Buy fee:</span>
                    <span>{buyQuote.buyFee}%</span>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 dark:border-emerald-700">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Net cost per LARRY:</span>
                      <span className="font-medium">{formatNumber(Number(buyAmount) / Number(buyQuote.tokenAmount))} ETH</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={handleBuy}
              disabled={!buyAmount || !buyQuote || isProcessing || !isConnected}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
            >
              {isProcessing ? 'Processing...' : 'Buy LARRY'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="sell" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sellAmount">LARRY Amount</Label>
            <Input
              id="sellAmount"
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="Enter LARRY amount"
              disabled={isProcessing || !isConnected}
            />
            {sellQuote && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">You will receive:</span>
                    <span className="text-lg font-bold text-red-600">{formatNumber(sellQuote.ethAmount)} ETH</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Exchange rate:</span>
                    <span>1 LARRY = {formatNumber(Number(sellQuote.ethAmount) / Number(sellAmount))} ETH</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Sell fee:</span>
                    <span>{sellQuote.sellFee}%</span>
                  </div>
                  <div className="pt-2 border-t border-red-200 dark:border-red-700">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Net price per LARRY:</span>
                      <span className="font-medium">{formatNumber(Number(sellQuote.ethAmount) / Number(sellAmount))} ETH</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Button
              onClick={handleSell}
              disabled={!sellAmount || !sellQuote || isProcessing || !isConnected}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2"
            >
              {isProcessing ? 'Processing...' : 'Sell LARRY'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}