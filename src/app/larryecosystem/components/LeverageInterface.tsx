'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
import { Slider } from '../../components/ui/slider';
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import { TrendingUpIcon, AlertTriangleIcon } from 'lucide-react';
import larryService from '../../services/larryService';

export default function LeverageInterface() {
  const { isConnected } = useWalletConnection();
  const [ethAmount, setEthAmount] = useState('');
  const [leverage, setLeverage] = useState(2);
  const [days, setDays] = useState('30');
  const [leverageQuote, setLeverageQuote] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  useEffect(() => {
    const getQuote = async () => {
      if (!ethAmount || isNaN(Number(ethAmount))) {
        setLeverageQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteLeverage(ethAmount, leverage.toString(), days);
        setLeverageQuote(quote);
      } catch (error) {
        console.error('Error getting leverage quote:', error);
        setLeverageQuote(null);
      }
    };
    getQuote();
  }, [ethAmount, leverage, days]);

  const handleLeverage = async () => {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Opening leveraged position...');
      const tx = await larryService.leverage(ethAmount, leverage.toString(), days);
      await tx.wait();
      
      setTxStatus('Position opened successfully!');
      setEthAmount('');
      setLeverageQuote(null);
    } catch (error: any) {
      console.error('Error opening position:', error);
      setError(error?.message || 'Failed to open position');
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
        <h2 className="text-2xl font-bold text-emerald-600">Leverage Trading</h2>
        <TrendingUpIcon className="h-6 w-6 text-emerald-500" />
      </div>
      
      {!isConnected && (
        <Alert className="mb-4 bg-yellow-100 border-yellow-400 text-yellow-700">
          Please connect your wallet to use leverage
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

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="ethAmount">ETH Amount</Label>
          <Input
            id="ethAmount"
            type="number"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            placeholder="Enter ETH amount"
            disabled={isProcessing || !isConnected}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="leverage">Leverage: {leverage}x</Label>
          <Slider
            id="leverage"
            min={2}
            max={100}
            step={1}
            value={[leverage]}
            onValueChange={(value) => setLeverage(value[0])}
            disabled={isProcessing || !isConnected}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-600">
            <span>2x</span>
            <span>50x</span>
            <span>100x</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="days">Duration (days)</Label>
          <Input
            id="days"
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="Enter days"
            min="1"
            max="365"
            disabled={isProcessing || !isConnected}
          />
        </div>

        {leverageQuote && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
            <div className="flex justify-between">
              <span>Position Size:</span>
              <span className="font-medium">{formatNumber(leverageQuote.positionSize)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span>LARRY Minted:</span>
              <span className="font-medium">{formatNumber(leverageQuote.larryAmount)} LARRY</span>
            </div>
            <div className="flex justify-between">
              <span>Total Fee:</span>
              <span className="font-medium">{formatNumber(leverageQuote.totalFee)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span>Required ETH:</span>
              <span className="font-medium">{formatNumber(leverageQuote.requiredEth)} ETH</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>Liquidation Price: {formatNumber(leverageQuote.liquidationPrice)} ETH</p>
              <p>APR: {leverageQuote.apr}%</p>
            </div>
          </div>
        )}

        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-start space-x-3">
            <AlertTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <p className="font-semibold mb-1">Risk Warning</p>
              <p>Leveraged positions can be liquidated if the collateral value drops below the borrowed amount. Higher leverage increases your risk.</p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleLeverage}
          disabled={!ethAmount || !leverageQuote || isProcessing || !isConnected}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isProcessing ? 'Processing...' : `Open ${leverage}x Position`}
        </Button>
      </div>
    </Card>
  );
}