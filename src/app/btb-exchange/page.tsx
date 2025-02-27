'use client';

import React from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/alert';
import BTBStatusPanel from '../components/btb-exchange/BTBStatusPanel';
import TradingInterface from '../components/btb-exchange/TradingInterface';
import BTBManagement from '../components/btb-exchange/BTBManagement';

export default function BTBExchangePage() {
  const { isConnected, isCorrectNetwork, connectWallet } = useWalletConnection();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6 text-btb-primary">BTB Exchange</h1>
          <Alert className="mb-6">
            Please connect your wallet to access the BTB Exchange
          </Alert>
          <Button 
            onClick={connectWallet}
            className="bg-btb-primary hover:bg-btb-primary-dark text-white"
          >
            Connect Wallet
          </Button>
        </div>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6 text-btb-primary">BTB Exchange</h1>
          <Alert className="mb-6">
            Please switch to the Base network to use BTB Exchange
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-btb-primary">BTB Exchange</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <BTBStatusPanel />
          <div className="mt-6">
            <BTBManagement />
          </div>
        </div>
        <div>
          <TradingInterface />
        </div>
      </div>
    </div>
  );
}
