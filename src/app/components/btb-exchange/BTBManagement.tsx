'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert } from '../ui/alert';
import btbExchangeService from '@/app/services/btbExchangeService';
import { formatNumber } from '../../utils/formatNumber';
import { useWalletConnection } from '../../hooks/useWalletConnection';

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
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

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
      setError('Please connect your wallet first');
      return;
    }
  
    setIsDepositing(true);
    setError(null);
    setTxStatus(null);
  
    try {
      setTxStatus('Approving BTB token...');
      const { tx1, tx2 } = await btbExchangeService.depositBTB(depositAmount);
      
      setTxStatus('Waiting for approval confirmation...');
      await tx1.wait();
      
      setTxStatus('Depositing BTB...');
      await tx2.wait();
      
      setTxStatus('Deposit successful!');
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
      setIsDepositing(false);
      setTimeout(() => {
        setTxStatus(null);
        setError(null);
      }, 5000);
    }
  };

  const handleWithdraw = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      await btbExchangeService.withdrawBTB(withdrawAmount);
      setWithdrawAmount('');
      const newStatus = await btbExchangeService.getBTBStatus();
      setStatus(newStatus);
    } catch (error: any) {
      console.error('Error withdrawing BTB:', error);
      setError(error?.message || 'Failed to withdraw BTB');
    }
  };

  const handleUnlock = async () => {
    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      await btbExchangeService.unlockBTB();
      const newStatus = await btbExchangeService.getBTBStatus();
      setStatus(newStatus);
    } catch (error: any) {
      console.error('Error unlocking BTB:', error);
      setError(error?.message || 'Failed to unlock BTB');
    }
  };

  if (!isConnected) {
    return (
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-6 text-btb-primary">BTB Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Please connect your wallet to manage your BTB.</p>
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

      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Deposit BTB</h3>
          <div className="space-y-2">
            <Label htmlFor="depositAmount">Amount to Deposit</Label>
            <Input
              id="depositAmount"
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="Enter BTB amount"
              disabled={isDepositing}
            />
            <Button
              onClick={handleDeposit}
              disabled={!depositAmount || isNaN(Number(depositAmount)) || isDepositing}
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
            >
              {isDepositing ? 'Processing...' : 'Deposit'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Withdraw BTB</h3>
          <div className="space-y-2">
            <Label htmlFor="withdrawAmount">Amount to Withdraw</Label>
            <Input
              id="withdrawAmount"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Enter BTB amount"
            />
            <p className="text-sm text-gray-600">
              Available: {formatNumber(status.availableAmount)} BTB
            </p>
            <Button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                isNaN(Number(withdrawAmount)) ||
                Number(withdrawAmount) > Number(status.availableAmount)
              }
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
            >
              Withdraw
            </Button>
          </div>
        </div>

        {Number(status.lockedAmount) > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Locked BTB</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Locked Amount: {formatNumber(status.lockedAmount)} BTB
              </p>
              <p className="text-sm text-gray-600">
                Unlocks at: {new Date(status.lockReleaseTimestamp * 1000).toLocaleString()}
              </p>
              <Button
                onClick={handleUnlock}
                disabled={Date.now() < status.lockReleaseTimestamp * 1000}
                className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
              >
                Unlock BTB
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
