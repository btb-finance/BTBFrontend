'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
// Removed unused Slider import
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import { TrendingUpIcon, AlertTriangleIcon } from 'lucide-react';
import larryService from '../../services/larryService';

export default function LeverageInterface() {
  const { isConnected } = useWalletConnection();
  const [ethAmount, setEthAmount] = useState(''); // This is the ETH position size to leverage (not just collateral)
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
        // Get the leverage fee for the ETH amount and days
        const quote = await larryService.quoteLeverage(ethAmount, days);
        setLeverageQuote(quote);
      } catch (error) {
        console.error('Error getting leverage quote:', error);
        setLeverageQuote(null);
      }
    };
    getQuote();
  }, [ethAmount, days]);

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
      const tx = await larryService.leverage(ethAmount, days);
      
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
          <Label htmlFor="ethAmount">ETH Position Size</Label>
          <Input
            id="ethAmount"
            type="number"
            value={ethAmount}
            onChange={(e) => setEthAmount(e.target.value)}
            placeholder="Enter ETH amount for leveraged position"
            disabled={isProcessing || !isConnected}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            This is the total ETH position size you want to leverage. You'll only pay fees + 1% collateral.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="days">Loan Duration (days)</Label>
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
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700 space-y-3">
            <div className="flex justify-between">
              <span>Position Size:</span>
              <span className="font-medium text-emerald-600">{formatNumber(leverageQuote.ethPosition)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span>Your Payment:</span>
              <span className="font-medium">{formatNumber(leverageQuote.requiredEth)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-lg">Leverage:</span>
              <span className="font-bold text-lg text-emerald-600">
                {(Number(leverageQuote.ethPosition) / Number(leverageQuote.requiredEth)).toFixed(1)}x
              </span>
            </div>
            <hr className="border-emerald-200 dark:border-emerald-700" />
            <div className="flex justify-between">
              <span>LARRY Collateral:</span>
              <span className="font-medium">{formatNumber(leverageQuote.larryAmount)} LARRY</span>
            </div>
            <div className="flex justify-between">
              <span>ETH You'll Borrow:</span>
              <span className="font-medium">{formatNumber(leverageQuote.borrowAmount)} ETH</span>
            </div>
            <div className="flex justify-between">
              <span>Total Fee:</span>
              <span className="font-medium">{formatNumber(leverageQuote.totalFee)} ETH</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              <p>Interest APR: {leverageQuote.apr}%</p>
              <p>Loan Duration: {days} days</p>
            </div>
          </div>
        )}

        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
          <div className="flex items-start space-x-3">
            <AlertTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm text-yellow-700 dark:text-yellow-300">
              <p className="font-semibold mb-1">How LARRY Leverage Works</p>
              <p>You specify an ETH position size. The protocol mints LARRY as collateral and borrows most of the ETH for your position. You only pay fees + 1% collateral. If the loan expires, your LARRY collateral is liquidated.</p>
            </div>
          </div>
        </div>

        <Button
          onClick={handleLeverage}
          disabled={!ethAmount || !leverageQuote || isProcessing || !isConnected}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {isProcessing ? 'Processing...' : 'Open Leveraged Position'}
        </Button>
      </div>
    </Card>
  );
}