'use client';

import React, { useState, useEffect } from 'react';
import { Alert } from '../ui/alert';
import { Button } from '../ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function NetworkChangeAlert() {
  const [showAlert, setShowAlert] = useState(false);
  const [fromChain, setFromChain] = useState<string | null>(null);
  const [toChain, setToChain] = useState<string | null>(null);

  useEffect(() => {
    // Handler for network changes
    const handleNetworkChange = (event: CustomEvent) => {
      // Show alert when network changes
      setToChain(getChainName(event.detail.chainId));
      setShowAlert(true);
    };

    // Track the initial chain
    const trackInitialChain = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setFromChain(getChainName(parseInt(chainId, 16)));
        } catch (error) {
          console.error('Failed to get initial chain:', error);
        }
      }
    };
    
    trackInitialChain();

    // Listen for our custom network change event
    window.addEventListener('btb:networkChanged' as any, handleNetworkChange as any);

    return () => {
      window.removeEventListener('btb:networkChanged' as any, handleNetworkChange as any);
    };
  }, []);

  // Convert chain ID to name
  const getChainName = (chainId: number): string => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      56: 'BNB Chain',
      137: 'Polygon',
      42161: 'Arbitrum',
      10: 'Optimism',
      8453: 'Base',
      43114: 'Avalanche',
    };
    
    return chains[chainId] || `Network (${chainId})`;
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!showAlert) {
    return null;
  }

  return (
    <Alert className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-100 border-yellow-400 text-yellow-700 p-4 rounded-md shadow-lg flex items-center max-w-md w-full">
      <div className="flex-shrink-0 mr-2">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p>Network changed from {fromChain} to {toChain}. Please refresh to update the page.</p>
      </div>
      <Button onClick={handleRefresh} variant="outline" size="sm" className="ml-2 bg-yellow-200 hover:bg-yellow-300 flex items-center">
        <RefreshCw className="h-4 w-4 mr-1" />
        Refresh
      </Button>
    </Alert>
  );
}