'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Alert } from '@/app/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import btbExchangeService from '../services/btbExchangeService';
import { formatNumber } from '@/app/utils/formatNumber';
import { useWalletConnection } from '@/app/hooks/useWalletConnection';
import { ArrowDownIcon, ArrowUpIcon, LockIcon, UnlockIcon, WalletIcon } from 'lucide-react';

export default function BTBManagement() {
  const { isConnected } = useWalletConnection();
  const [status, setStatus] = useState({
    totalDeposited: '0',
    lockedAmount: '0',
    availableAmount: '0',
    lockReleaseTimestamp: 0,
  });
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!isConnected) return;
      
      try {
        await btbExchangeService.connect();
        const btbStatus = await btbExchangeService.getBTBStatus();
        setStatus(btbStatus);
      } catch (error) {
        console.error('Error fetching BTB status:', error);
      }
    };

    if (isConnected) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  const handleDeposit = async () => {
    if (!isConnected) {
      setError('Please connect your wallet using the button in the navigation bar');
      return;
    }
  
    setIsProcessing(true);
    setError(null);
    setTxStatus(null);
    setSuccessMessage(null);
  
    try {
      setTxStatus('Approving BTB token...');
      const { tx1, tx2 } = await btbExchangeService.depositBTB(depositAmount);
      
      setTxStatus('Waiting for approval confirmation...');
      await tx1.wait();
      
      setTxStatus('Depositing BTB...');
      await tx2.wait();
      
      setSuccessMessage(`Successfully deposited ${depositAmount} BTB!`);
      setDepositAmount('');
      
      // Refresh status
      const newStatus = await btbExchangeService.getBTBStatus();
      setStatus(newStatus);
    } catch (error: unknown) {
      console.error('Error depositing BTB:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        setError(error.message as string);
      } else {
        setError('Failed to deposit BTB. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      setTxStatus(null);
      setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      setError('Please connect your wallet using the button in the navigation bar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);
    setSuccessMessage(null);

    try {
      setTxStatus('Withdrawing BTB...');
      const tx = await btbExchangeService.withdrawBTB(withdrawAmount);
      await tx.wait();
      
      setSuccessMessage(`Successfully withdrew ${withdrawAmount} BTB!`);
      setWithdrawAmount('');
      
      // Refresh status
      const newStatus = await btbExchangeService.getBTBStatus();
      setStatus(newStatus);
    } catch (error: unknown) {
      console.error('Error withdrawing BTB:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        setError(error.message as string);
      } else {
        setError('Failed to withdraw BTB. Please try again.');
      }
    } finally {
      setIsProcessing(false);
      setTxStatus(null);
      setTimeout(() => {
        setSuccessMessage(null);
        setError(null);
      }, 5000);
    }
  };

  const handleUnlock = async () => {
    if (!isConnected) {
      setError('Please connect your wallet using the button in the navigation bar');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTxStatus(null);
    setSuccessMessage(null);

    try {
      setTxStatus('Unlocking BTB...');
      const tx = await btbExchangeService.unlockBTB();
      // No need to await tx.wait() as it's already done in the service
      
      setSuccessMessage('Successfully unlocked BTB!');
      
      // Refresh status
      const newStatus = await btbExchangeService.getBTBStatus();
      setStatus(newStatus);
    } catch (error: any) {
      console.error('Error unlocking BTB:', error);
      setError(error?.message || 'Failed to unlock BTB');
    } finally {
      setIsProcessing(false);
      setTxStatus(null);
    }
  };

  if (!isConnected) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-btb-primary">BTB Management</h2>
          <WalletIcon className="h-6 w-6 text-gray-400" />
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Please connect your wallet using the button in the navigation bar to manage your BTB tokens.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6 text-btb-primary">BTB Management</h2>
      
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

      {successMessage && (
        <Alert className="mb-4 bg-green-100 border-green-400 text-green-700">
          {successMessage}
        </Alert>
      )}

      <Tabs defaultValue="deposit" className="space-y-6">
        <TabsList className="w-full">
          <TabsTrigger value="deposit" className="w-1/2">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw" className="w-1/2">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="deposit" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownIcon className="h-5 w-5 text-green-500" />
            <h3 className="text-xl font-semibold">Deposit BTB</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Amount to Deposit</Label>
            <Input
              id="depositAmount"
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Enter BTB amount"
              disabled={isProcessing}
            />
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <p>Depositing BTB tokens allows you to participate in trading on the BTB Exchange.</p>
            </div>
            <Button
              onClick={handleDeposit}
              disabled={!depositAmount || isNaN(Number(depositAmount)) || isProcessing}
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
            >
              {isProcessing ? 'Processing...' : 'Deposit'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="withdraw" className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpIcon className="h-5 w-5 text-blue-500" />
            <h3 className="text-xl font-semibold">Withdraw BTB</h3>
          </div>
          <div className="space-y-2">
            <Label htmlFor="withdrawAmount">Amount to Withdraw</Label>
            <Input
              id="withdrawAmount"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter BTB amount"
              disabled={isProcessing}
            />
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-2">
              <div className="flex justify-between">
                <span>Available:</span>
                <span className="font-medium">{formatNumber(status.availableAmount)} BTB</span>
              </div>
              {Number(status.lockedAmount) > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Locked:</span>
                  <span className="font-medium">{formatNumber(status.lockedAmount)} BTB</span>
                </div>
              )}
            </div>
            <Button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                isNaN(Number(withdrawAmount)) ||
                Number(withdrawAmount) > Number(status.availableAmount) ||
                isProcessing
              }
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
            >
              {isProcessing ? 'Processing...' : 'Withdraw'}
            </Button>
          </div>

          {Number(status.lockedAmount) > 0 && status.lockReleaseTimestamp > 0 && (
            <div className="mt-6 p-4 border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <LockIcon className="h-5 w-5 text-amber-600" />
                <h4 className="font-semibold text-amber-700 dark:text-amber-400">Locked BTB</h4>
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                You have {formatNumber(status.lockedAmount)} BTB locked until {new Date(status.lockReleaseTimestamp * 1000).toLocaleString()}
              </p>
              <Button
                onClick={handleUnlock}
                disabled={Date.now() < status.lockReleaseTimestamp * 1000 || isProcessing}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
              >
                <UnlockIcon className="h-4 w-4" />
                {Date.now() < status.lockReleaseTimestamp * 1000 ? 'Unlock Available After Lock Period' : 'Unlock BTB'}
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
