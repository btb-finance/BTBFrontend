'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
// Removed chart dependency
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import { 
  InfoIcon, 
  TrendingUpIcon, 
  TrendingDownIcon, 
  WalletIcon,
  ArrowUpDownIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LoaderIcon,
  DollarSignIcon,
  PercentIcon
} from 'lucide-react';
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
  const [userBalance, setUserBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  const [currentPrice, setCurrentPrice] = useState('0');

  useEffect(() => {
    const fetchBalance = async () => {
      if (!isConnected || !address) {
        setUserBalance('0');
        setEthBalance('0');
        return;
      }
      try {
        const [larryBalance, ethBal] = await Promise.all([
          larryService.getUserBalance(address),
          window.ethereum?.request({ 
            method: 'eth_getBalance', 
            params: [address, 'latest'] 
          }).then((bal: string) => (parseInt(bal, 16) / 1e18).toFixed(4))
        ]);
        setUserBalance(larryBalance);
        setEthBalance(ethBal || '0');
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address]);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await larryService.getCurrentPrice();
        setCurrentPrice(price);
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

  const setMaxBuyAmount = () => {
    setBuyAmount(ethBalance);
  };

  const setMaxSellAmount = () => {
    setSellAmount(userBalance);
  };

  if (mode === 'borrow') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-6">
            <motion.div 
              className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <DollarSignIcon className="w-5 h-5 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Borrow ETH
            </h2>
          </div>
          
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <Alert className="bg-red-100 border-red-400 text-red-700 flex items-center gap-2">
                  <AlertCircleIcon className="w-4 h-4" />
                  {error}
                </Alert>
              </motion.div>
            )}
            
            {txStatus && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4"
              >
                <Alert className="bg-blue-100 border-blue-400 text-blue-700 flex items-center gap-2">
                  {isProcessing ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
                  {txStatus}
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <motion.div 
              className="space-y-2"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Label htmlFor="borrowAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                ETH Amount to Borrow
              </Label>
              <div className="relative">
                <Input
                  id="borrowAmount"
                  type="number"
                  value={borrowAmount}
                  onChange={(e) => setBorrowAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isProcessing || !isConnected}
                  className="pl-10 text-lg font-medium"
                />
                <DollarSignIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </motion.div>

            <motion.div 
              className="space-y-2"
              whileHover={{ scale: 1.02 }}
              transition={{ duration: 0.2 }}
            >
              <Label htmlFor="borrowDays" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Loan Duration (days)
              </Label>
              <Input
                id="borrowDays"
                type="number"
                value={borrowDays}
                onChange={(e) => setBorrowDays(e.target.value)}
                placeholder="30"
                min="1"
                max="365"
                disabled={isProcessing || !isConnected}
                className="text-lg font-medium"
              />
            </motion.div>

            <AnimatePresence>
              {borrowQuote && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  className="p-6 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl border border-blue-200 dark:border-blue-700"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">You will receive:</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {formatNumber(borrowQuote.netAmount)} ETH
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Borrow amount:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {borrowAmount} ETH
                      </span>
                    </div>
                    <hr className="border-blue-200 dark:border-blue-700" />
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Required Collateral:</span>
                        <span className="font-medium">{formatNumber(borrowQuote.requiredCollateral)} LARRY</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Interest Fee:</span>
                        <span className="font-medium">{formatNumber(borrowQuote.interestFee)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Collateral Ratio:</span>
                        <span className="font-medium text-green-600">101%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">APR:</span>
                        <span className="font-medium">{borrowQuote.apr}%</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <p>You provide {formatNumber(borrowQuote.requiredCollateral)} LARRY as collateral</p>
                      <p>You receive {formatNumber(borrowQuote.netAmount)} ETH (after {formatNumber(borrowQuote.interestFee)} ETH interest fee)</p>
                      <p>Loan duration: {borrowDays} days</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleBorrow}
                disabled={!borrowAmount || !borrowQuote || isProcessing || !isConnected}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 text-lg font-semibold"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  'Borrow ETH'
                )}
              </Button>
            </motion.div>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header with Price Info */}
      <Card className="p-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div 
              className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 flex items-center justify-center"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ArrowUpDownIcon className="w-5 h-5 text-white" />
            </motion.div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              Trading Interface
            </h2>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <InfoIcon className="h-4 w-4" />
            <span>Price updates every 10s</span>
          </div>
        </div>

        {/* Current Price */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Current LARRY Price</span>
            <motion.span 
              className="text-lg font-bold text-emerald-600"
              key={currentPrice}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              {formatNumber(currentPrice)} ETH
            </motion.span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Price can only go up, never down ↗
          </div>
        </div>
      </Card>

      {/* Wallet Info */}
      <Card className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <WalletIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">LARRY Balance: </span>
              <span className="font-bold text-emerald-600">{formatNumber(userBalance)}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">ETH Balance: </span>
              <span className="font-bold text-blue-600">{formatNumber(ethBalance)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Status Alerts */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert className="bg-yellow-100 border-yellow-400 text-yellow-700 flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4" />
              Please connect your wallet to trade
            </Alert>
          </motion.div>
        )}
        
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert className="bg-red-100 border-red-400 text-red-700 flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4" />
              {error}
            </Alert>
          </motion.div>
        )}
        
        {txStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert className="bg-green-100 border-green-400 text-green-700 flex items-center gap-2">
              {isProcessing ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <CheckCircleIcon className="w-4 h-4" />}
              {txStatus}
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trading Tabs */}
      <Card className="p-6">
        <Tabs defaultValue="buy" className="space-y-6">
          <TabsList className="w-full bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            <TabsTrigger 
              value="buy" 
              className="w-1/2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-green-600 data-[state=active]:text-white"
            >
              Buy LARRY
            </TabsTrigger>
            <TabsTrigger 
              value="sell" 
              className="w-1/2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white"
            >
              Sell LARRY
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-2">
                <Label htmlFor="buyAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  ETH Amount
                </Label>
                <div className="relative">
                  <Input
                    id="buyAmount"
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={isProcessing || !isConnected}
                    className="pl-10 pr-16 text-lg font-medium"
                  />
                  <DollarSignIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={setMaxBuyAmount}
                    disabled={!isConnected}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {buyQuote && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="p-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-xl border border-emerald-200 dark:border-emerald-700"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">You will receive:</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                          {formatNumber(buyQuote.tokenAmount)} LARRY
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Exchange Rate:</span>
                          <span className="font-medium">1 ETH = {formatNumber(Number(buyQuote.tokenAmount) / Number(buyAmount))} LARRY</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Buy Fee:</span>
                          <span className="font-medium flex items-center gap-1">
                            <PercentIcon className="w-3 h-3" />
                            {buyQuote.buyFee}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleBuy}
                  disabled={!buyAmount || !buyQuote || isProcessing || !isConnected}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white py-3 text-lg font-semibold"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <LoaderIcon className="w-5 h-5 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TrendingUpIcon className="w-5 h-5" />
                      Buy LARRY
                    </div>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </TabsContent>

          <TabsContent value="sell">
            <motion.div 
              className="space-y-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-2">
                <Label htmlFor="sellAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  LARRY Amount
                </Label>
                <div className="relative">
                  <Input
                    id="sellAmount"
                    type="number"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0.00"
                    disabled={isProcessing || !isConnected}
                    className="pl-10 pr-16 text-lg font-medium"
                  />
                  <ArrowUpDownIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={setMaxSellAmount}
                    disabled={!isConnected}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-red-600 hover:text-red-700"
                  >
                    MAX
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {sellQuote && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.95 }}
                    className="p-6 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl border border-red-200 dark:border-red-700"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">You will receive:</span>
                        <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                          {formatNumber(sellQuote.ethAmount)} ETH
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Exchange Rate:</span>
                          <span className="font-medium">1 LARRY = {formatNumber(Number(sellQuote.ethAmount) / Number(sellAmount))} ETH</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Sell Fee:</span>
                          <span className="font-medium flex items-center gap-1">
                            <PercentIcon className="w-3 h-3" />
                            {sellQuote.sellFee}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSell}
                  disabled={!sellAmount || !sellQuote || isProcessing || !isConnected}
                  className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white py-3 text-lg font-semibold"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <LoaderIcon className="w-5 h-5 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <TrendingDownIcon className="w-5 h-5" />
                      Sell LARRY
                    </div>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </Card>
    </motion.div>
  );
}