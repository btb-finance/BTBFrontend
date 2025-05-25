'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert } from '../../components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';
import { LockIcon, CalendarIcon } from 'lucide-react';
import larryService from '../../services/larryService';

export default function LoansManagement() {
  const { isConnected, address } = useWalletConnection();
  const [userLoan, setUserLoan] = useState<any>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [extendDays, setExtendDays] = useState('30');
  const [borrowMore, setBorrowMore] = useState('');
  const [removeCollateral, setRemoveCollateral] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoan = async () => {
      if (!isConnected || !address) {
        setUserLoan(null);
        return;
      }
      
      try {
        const loan = await larryService.getUserLoan(address);
        setUserLoan(loan);
      } catch (error) {
        console.error('Error fetching loan:', error);
      }
    };

    fetchLoan();
    const interval = setInterval(fetchLoan, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address]);

  const handleRepay = async () => {
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Repaying loan...');
      const tx = await larryService.repay(repayAmount);
      await tx.wait();
      
      setTxStatus('Repayment successful!');
      setRepayAmount('');
    } catch (error: any) {
      console.error('Error repaying:', error);
      setError(error?.message || 'Failed to repay');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleExtend = async () => {
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Extending loan...');
      const tx = await larryService.extendLoan(extendDays);
      await tx.wait();
      
      setTxStatus('Extension successful!');
      setExtendDays('30');
    } catch (error: any) {
      console.error('Error extending:', error);
      setError(error?.message || 'Failed to extend');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleBorrowMore = async () => {
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Borrowing more...');
      const tx = await larryService.borrowMore(borrowMore);
      await tx.wait();
      
      setTxStatus('Additional borrow successful!');
      setBorrowMore('');
    } catch (error: any) {
      console.error('Error borrowing more:', error);
      setError(error?.message || 'Failed to borrow more');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleRemoveCollateral = async () => {
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Removing collateral...');
      const tx = await larryService.removeCollateral(removeCollateral);
      await tx.wait();
      
      setTxStatus('Collateral removed successfully!');
      setRemoveCollateral('');
    } catch (error: any) {
      console.error('Error removing collateral:', error);
      setError(error?.message || 'Failed to remove collateral');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleClosePosition = async () => {
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Closing position...');
      const tx = await larryService.closePosition();
      await tx.wait();
      
      setTxStatus('Position closed successfully!');
    } catch (error: any) {
      console.error('Error closing position:', error);
      setError(error?.message || 'Failed to close position');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleFlashClose = async () => {
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);

    try {
      setTxStatus('Flash closing position...');
      const tx = await larryService.flashClosePosition();
      await tx.wait();
      
      setTxStatus('Position flash closed successfully!');
    } catch (error: any) {
      console.error('Error flash closing:', error);
      setError(error?.message || 'Failed to flash close');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  if (!userLoan || userLoan.borrowed === '0' || userLoan.endDate === '0') {
    return null;
  }

  const endDateTimestamp = Number(userLoan.endDate);
  const daysRemaining = endDateTimestamp > 0 ? Math.max(0, Math.floor((endDateTimestamp - Date.now() / 1000) / 86400)) : 0;
  const isExpired = endDateTimestamp === 0 || endDateTimestamp < Date.now() / 1000;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-emerald-600">Your Loan</h3>
        <LockIcon className="h-6 w-6 text-emerald-500" />
      </div>

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

      {isExpired && (
        <Alert className="mb-4 bg-red-100 border-red-400 text-red-700">
          Your loan has expired and may be liquidated. Please repay immediately.
        </Alert>
      )}

      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Borrowed</p>
            <p className="text-lg font-bold">{formatNumber(userLoan.borrowed)} ETH</p>
          </div>
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Collateral</p>
            <p className="text-lg font-bold">{formatNumber(userLoan.collateral)} LARRY</p>
          </div>
        </div>
        
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 dark:text-emerald-300">
                {isExpired ? 'Expired' : `${daysRemaining} days remaining`}
              </span>
            </div>
            <span className="text-sm text-gray-600">
              Expires: {endDateTimestamp > 0 ? new Date(endDateTimestamp * 1000).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="repay" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="repay">Repay</TabsTrigger>
          <TabsTrigger value="manage">Manage</TabsTrigger>
          <TabsTrigger value="close">Close</TabsTrigger>
        </TabsList>

        <TabsContent value="repay" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="repayAmount">Repay Amount (ETH)</Label>
            <div className="relative">
              <Input
                id="repayAmount"
                type="number"
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="Enter ETH amount"
                disabled={isProcessing}
                className="pr-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRepayAmount(userLoan.borrowed)}
                disabled={isProcessing}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-emerald-600 hover:text-emerald-700"
              >
                MAX
              </Button>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p>Total borrowed: {formatNumber(userLoan.borrowed)} ETH</p>
              {repayAmount && Number(repayAmount) > 0 && (
                <p>Remaining after repay: {formatNumber((Number(userLoan.borrowed) - Number(repayAmount)).toString())} ETH</p>
              )}
            </div>
            <Button
              onClick={handleRepay}
              disabled={!repayAmount || isProcessing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? 'Processing...' : `Repay ${repayAmount || '0'} ETH`}
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="extendDays">Extend Loan (days)</Label>
            <Input
              id="extendDays"
              type="number"
              value={extendDays}
              onChange={(e) => setExtendDays(e.target.value)}
              placeholder="Enter days"
              min="1"
              max="365"
              disabled={isProcessing}
            />
            <Button
              onClick={handleExtend}
              disabled={!extendDays || isProcessing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? 'Processing...' : 'Extend Loan'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="borrowMore">Borrow More (ETH)</Label>
            <Input
              id="borrowMore"
              type="number"
              value={borrowMore}
              onChange={(e) => setBorrowMore(e.target.value)}
              placeholder="Enter ETH amount"
              disabled={isProcessing || isExpired}
            />
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p>Current borrowed: {formatNumber(userLoan.borrowed)} ETH</p>
              {borrowMore && Number(borrowMore) > 0 && (
                <p>New total borrowed: {formatNumber((Number(userLoan.borrowed) + Number(borrowMore)).toString())} ETH</p>
              )}
            </div>
            <Button
              onClick={handleBorrowMore}
              disabled={!borrowMore || isProcessing || isExpired}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? 'Processing...' : `Borrow ${borrowMore || '0'} ETH More`}
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="removeCollateral">Remove Collateral (LARRY)</Label>
            <Input
              id="removeCollateral"
              type="number"
              value={removeCollateral}
              onChange={(e) => setRemoveCollateral(e.target.value)}
              placeholder="Enter LARRY amount"
              disabled={isProcessing || isExpired}
            />
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p>Current collateral: {formatNumber(userLoan.collateral)} LARRY</p>
              {removeCollateral && Number(removeCollateral) > 0 && (
                <p>Remaining collateral: {formatNumber((Number(userLoan.collateral) - Number(removeCollateral)).toString())} LARRY</p>
              )}
            </div>
            <Button
              onClick={handleRemoveCollateral}
              disabled={!removeCollateral || isProcessing || isExpired}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? 'Processing...' : `Remove ${removeCollateral || '0'} LARRY`}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="close" className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Repay full borrowed amount to close your position
            </p>
            <Button
              onClick={handleClosePosition}
              disabled={isProcessing}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isProcessing ? 'Processing...' : `Close Position (Repay ${formatNumber(userLoan.borrowed)} ETH)`}
            </Button>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Use collateral to repay loan (1% fee applies)
            </p>
            <Button
              onClick={handleFlashClose}
              disabled={isProcessing}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isProcessing ? 'Processing...' : 'Flash Close Position'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}