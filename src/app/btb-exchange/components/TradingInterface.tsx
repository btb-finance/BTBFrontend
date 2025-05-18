'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import btbExchangeService from '../services/btbExchangeService';
import { formatNumber } from '@/app/utils/formatNumber';
import { useWalletConnection } from '@/app/hooks/useWalletConnection';
import { InfoIcon } from 'lucide-react';

export default function TradingInterface() {
  const { isConnected } = useWalletConnection();
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [currentPrice, setCurrentPrice] = useState('0');
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [slippage, setSlippage] = useState('0.5');
  const [btbBalance, setBtbBalance] = useState<{ availableAmount: string } | null>(null);
  const [btbyBalance, setBtbyBalance] = useState<string>('0');

  useEffect(() => {
    const fetchBTBBalance = async () => {
      if (!isConnected) {
        setBtbBalance(null);
        return;
      }
      try {
        const btbStatus = await btbExchangeService.getBTBStatus();
        setBtbBalance(btbStatus);
      } catch (error) {
        console.error('Error fetching BTB balance:', error);
        setBtbBalance(null);
      }
    };

    fetchBTBBalance();
    if (isConnected) {
      const interval = setInterval(fetchBTBBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  useEffect(() => {
    const fetchBTBYBalance = async () => {
      if (!isConnected) {
        setBtbyBalance('0');
        return;
      }
      try {
        const balance = await btbExchangeService.getBTBYBalance();
        setBtbyBalance(balance);
      } catch (error) {
        console.error('Error fetching BTBY balance:', error);
        setBtbyBalance('0');
      }
    };

    fetchBTBYBalance();
    if (isConnected) {
      const interval = setInterval(fetchBTBYBalance, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await btbExchangeService.getCurrentPrice();
        setCurrentPrice(price);
        setPriceHistory(prev => [...prev, { time: new Date().toLocaleTimeString(), price: Number(price) }].slice(-20));
      } catch (error) {
        console.error('Error fetching price:', error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const getQuote = async () => {
      if (!isConnected || !buyAmount || isNaN(Number(buyAmount))) {
        setBuyQuote(null);
        return;
      }
      
      try {
        const quote = await btbExchangeService.quoteTokensForUsdc(buyAmount);
        setBuyQuote(quote);
      } catch (error) {
        console.error('Error getting buy quote:', error);
        setBuyQuote(null);
      }
    };
    getQuote();
  }, [buyAmount, isConnected]);

  useEffect(() => {
    const getQuote = async () => {
      if (!isConnected || !sellAmount || isNaN(Number(sellAmount))) {
        setSellQuote(null);
        return;
      }
      
      try {
        const quote = await btbExchangeService.quoteUsdcForTokens(sellAmount);
        setSellQuote(quote);
      } catch (error) {
        console.error('Error getting sell quote:', error);
        setSellQuote(null);
      }
    };
    getQuote();
  }, [sellAmount, isConnected]);

  const handleBuy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet using the button in the navigation bar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Approving USDC...');
      const { tx1, tx2 } = await btbExchangeService.buyTokens(buyAmount);
      
      if (tx1) {
        setTxStatus('Waiting for USDC approval...');
        await tx1.wait();
      }
      
      setTxStatus('Buying tokens...');
      await tx2.wait();
      
      setTxStatus('Purchase successful!');
      setBuyAmount('');
      setBuyQuote(null);
      
      const newPrice = await btbExchangeService.getCurrentPrice();
      setCurrentPrice(newPrice);
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
      setError('Please connect your wallet using the button in the navigation bar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Selling tokens...');
      const tx = await btbExchangeService.sellTokens(sellAmount);
      await tx.wait();
      
      setTxStatus('Sale successful!');
      setSellAmount('');
      setSellQuote(null);
      
      const newPrice = await btbExchangeService.getCurrentPrice();
      setCurrentPrice(newPrice);
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

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-btb-primary">Trading Interface</h2>
        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
          <InfoIcon className="h-4 w-4" />
          <span>Price updates every 10s</span>
        </div>
      </div>
      
      {!isConnected && (
        <Alert className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700">
          Please connect your wallet using the button in the navigation bar to trade
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
          <p className="text-lg font-semibold">
            Current Price: <span className="text-btb-primary">{formatNumber(currentPrice)} USDC</span>
          </p>
          <div className="flex items-center space-x-2">
            <Label htmlFor="slippage" className="text-sm">Slippage:</Label>
            <Input
              id="slippage"
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="w-20 h-8 text-sm"
            />
            <span className="text-sm">%</span>
          </div>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="price" stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="buy" className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="buy" className="w-1/2">Buy Tokens</TabsTrigger>
          <TabsTrigger value="sell" className="w-1/2">Sell Tokens</TabsTrigger>
        </TabsList>

        <TabsContent value="buy" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyAmount">USDC Amount</Label>
            <Input
              id="buyAmount"
              type="number"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              placeholder="Enter USDC amount"
              disabled={isProcessing || !isConnected}
            />
            {buyQuote && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>You will receive:</span>
                  <span className="font-medium">{formatNumber(buyQuote.tokenAmount)} Tokens</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total fees:</span>
                  <span>{formatNumber(buyQuote.totalFeeAmount)} USDC</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Min. received after slippage:</span>
                  <span>{formatNumber(buyQuote.tokenAmount * (1 - Number(slippage) / 100))} Tokens</span>
                </div>
              </div>
            )}
            <Button
              onClick={handleBuy}
              disabled={!buyAmount || !buyQuote || isProcessing || !isConnected}
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white mt-2"
            >
              {isProcessing ? 'Processing...' : 'Buy'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="sell" className="space-y-4">
          <div className="space-y-2">
            <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              Available BTBY Balance: {formatNumber(btbyBalance)}
            </div>
            <Label htmlFor="sellAmount">BTBY Token Amount</Label>
            <Input
              id="sellAmount"
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="Enter BTBY amount"
              disabled={isProcessing || !isConnected}
            />
            {sellQuote && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>You will receive:</span>
                  <span className="font-medium">{formatNumber(sellQuote.usdcAfterFee)} USDC</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Total fees:</span>
                  <span>{formatNumber(sellQuote.totalFeeAmount)} USDC</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Min. received after slippage:</span>
                  <span>{formatNumber(sellQuote.usdcAfterFee * (1 - Number(slippage) / 100))} USDC</span>
                </div>
              </div>
            )}
            <Button
              onClick={handleSell}
              disabled={!sellAmount || !sellQuote || isProcessing || !isConnected}
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white mt-2"
            >
              {isProcessing ? 'Processing...' : 'Sell BTBY'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
