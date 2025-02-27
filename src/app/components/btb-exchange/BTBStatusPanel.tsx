'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { formatNumber } from '@/app/utils/formatNumber';
import btbExchangeService from '@/app/services/btbExchangeService';
import { useWalletConnection } from '@/app/hooks/useWalletConnection';
import { Alert } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';

export default function BTBStatusPanel() {
  const { isConnected, isCorrectNetwork, connectWallet } = useWalletConnection();
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
        <h2 className="text-2xl font-bold mb-4 text-btb-primary">BTB Status</h2>
        <Alert className="mb-4">
          Please connect your wallet to view BTB status
        </Alert>
        <Button
          onClick={connectWallet}
          className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
        >
          Connect Wallet
        </Button>
      </Card>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4 text-btb-primary">BTB Status</h2>
        <Alert className="mb-4">
          Please switch to the correct network to view BTB status
        </Alert>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-btb-primary">BTB Status</h2>
      <div className="space-y-4">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Total Deposited</p>
          <p className="text-xl font-semibold">{formatNumber(status.totalDeposited)} BTB</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Locked Amount</p>
          <p className="text-xl font-semibold">{formatNumber(status.lockedAmount)} BTB</p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Available Amount</p>
          <p className="text-xl font-semibold">{formatNumber(status.availableAmount)} BTB</p>
        </div>
        {status.lockReleaseTimestamp > 0 && (
          <div>
            <p className="text-gray-600 dark:text-gray-400">Lock Release Time</p>
            <p className="text-xl font-semibold">
              {new Date(status.lockReleaseTimestamp * 1000).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
