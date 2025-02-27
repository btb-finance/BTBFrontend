'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert } from '../ui/alert';
import btbExchangeService from '../../services/btbExchangeService';
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';

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

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await btbExchangeService.getCurrentPrice();
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
      if (!isConnected) {
        setBuyQuote(null);
        return;
      }
      
      if (buyAmount && !isNaN(Number(buyAmount))) {
        try {
          const quote = await btbExchangeService.quoteTokensForUsdc(buyAmount);
          setBuyQuote(quote);
        } catch (error) {
          console.error('Error getting buy quote:', error);
          setBuyQuote(null);
        }
      } else {
        setBuyQuote(null);
      }
    };
    getQuote();
  }, [buyAmount, isConnected]);

  useEffect(() => {
    const getQuote = async () => {
      if (!isConnected) {
        setSellQuote(null);
        return;
      }
      
      if (sellAmount && !isNaN(Number(sellAmount))) {
        try {
          const quote = await btbExchangeService.quoteUsdcForTokens(sellAmount);
          setSellQuote(quote);
        } catch (error) {
          console.error('Error getting sell quote:', error);
          setSellQuote(null);
        }
      } else {
        setSellQuote(null);
      }
    };
    getQuote();
  }, [sellAmount, isConnected]);

  const handleBuy = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
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
      
      // Refresh price
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
      setError('Please connect your wallet first');
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
      
      // Refresh price
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
      <h2 className="text-2xl font-bold mb-6 text-btb-primary">Trading Interface</h2>
      
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

      <div className="mb-6">
        <p className="text-lg font-semibold">
          Current Price: {formatNumber(currentPrice)} USDC
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Buy Tokens</h3>
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
              <div className="text-sm text-gray-600">
                <p>You will receive: {formatNumber(buyQuote.tokenAmount)} Tokens</p>
                <p>Total fees: {formatNumber(buyQuote.totalFeeAmount)} USDC</p>
              </div>
            )}
            <Button
              onClick={handleBuy}
              disabled={!buyAmount || !buyQuote || isProcessing || !isConnected}
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
            >
              {isProcessing ? 'Processing...' : 'Buy'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Sell Tokens</h3>
          <div className="space-y-2">
            <Label htmlFor="sellAmount">Token Amount</Label>
            <Input
              id="sellAmount"
              type="number"
              value={sellAmount}
              onChange={(e) => setSellAmount(e.target.value)}
              placeholder="Enter token amount"
              disabled={isProcessing || !isConnected}
            />
            {sellQuote && (
              <div className="text-sm text-gray-600">
                <p>You will receive: {formatNumber(sellQuote.usdcAfterFee)} USDC</p>
                <p>Total fees: {formatNumber(sellQuote.totalFeeAmount)} USDC</p>
              </div>
            )}
            <Button
              onClick={handleSell}
              disabled={!sellAmount || !sellQuote || isProcessing || !isConnected}
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
            >
              {isProcessing ? 'Processing...' : 'Sell'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
