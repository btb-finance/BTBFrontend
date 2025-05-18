'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { formatNumber } from '@/app/utils/formatNumber';
import btbExchangeService from '../services/btbExchangeService';
import { useWalletConnection } from '@/app/hooks/useWalletConnection';
import { Alert } from '@/app/components/ui/alert';
import { InfoIcon, LockIcon, UnlockIcon, WalletIcon } from 'lucide-react';

export default function BTBStatusPanel() {
  const { isConnected, isCorrectNetwork } = useWalletConnection();
  const [status, setStatus] = useState({
    totalDeposited: '0',
    lockedAmount: '0',
    availableAmount: '0',
    lockReleaseTimestamp: 0,
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        await btbExchangeService.connect();
        const btbStatus = await btbExchangeService.getBTBStatus();
        setStatus(btbStatus);
      } catch (error) {
        console.error('Error fetching BTB status:', error);
      }
    };

    if (isConnected && isCorrectNetwork) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, isCorrectNetwork]);

  if (!isConnected) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-btb-primary">BTB Status</h2>
          <WalletIcon className="h-6 w-6 text-gray-400" />
        </div>
        <Alert className="mb-4">
          Please connect your wallet using the button in the navigation bar to view BTB status
        </Alert>
      </Card>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-btb-primary">BTB Status</h2>
          <InfoIcon className="h-6 w-6 text-yellow-500" />
        </div>
        <Alert className="mb-4">
          Please switch to the correct network to view BTB status
        </Alert>
      </Card>
    );
  }

  const timeUntilRelease = status.lockReleaseTimestamp > 0 
    ? Math.max(0, Math.floor((status.lockReleaseTimestamp * 1000 - Date.now()) / 1000))
    : 0;

  const formatTimeRemaining = (seconds: number) => {
    if (seconds === 0) return 'No lock';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-btb-primary">BTB Status</h2>
        {timeUntilRelease > 0 ? (
          <LockIcon className="h-6 w-6 text-red-500" />
        ) : (
          <UnlockIcon className="h-6 w-6 text-green-500" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Deposited</p>
          <p className="text-xl font-semibold text-btb-primary">{formatNumber(status.totalDeposited)} BTB</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Locked Amount</p>
          <p className="text-xl font-semibold text-red-500">{formatNumber(status.lockedAmount)} BTB</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Available Amount</p>
          <p className="text-xl font-semibold text-green-500">{formatNumber(status.availableAmount)} BTB</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">Lock Status</p>
          {status.lockReleaseTimestamp > 0 ? (
            <div>
              <p className="text-xl font-semibold text-btb-primary">{formatTimeRemaining(timeUntilRelease)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Unlocks at {new Date(status.lockReleaseTimestamp * 1000).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-xl font-semibold text-green-500">Unlocked</p>
          )}
        </div>
      </div>
    </Card>
  );
}
