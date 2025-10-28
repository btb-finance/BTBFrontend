'use client';

import React, { useState } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { useEIP6963Wallets } from '../../hooks/useEIP6963Wallets';
import { EIP6963ProviderDetail } from '../../types/eip6963';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

interface WalletSelectorProps {
  onWalletSelect?: (provider: EIP6963ProviderDetail) => void;
  className?: string;
}

/**
 * WalletSelector component that displays all EIP-6963 compatible wallets
 * and allows users to select one for connection
 */
export function WalletSelector({ onWalletSelect, className }: WalletSelectorProps) {
  const { providersArray, isLoading, hasProviders, providerCount } = useEIP6963Wallets();
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const handleWalletClick = async (provider: EIP6963ProviderDetail) => {
    setSelectedProvider(provider.info.uuid);

    // Try to find matching wagmi connector
    const matchingConnector = connectors.find(
      (c) => c.id === 'injected' || c.name.toLowerCase().includes(provider.info.name.toLowerCase())
    );

    if (matchingConnector) {
      try {
        await connect({ connector: matchingConnector });
        onWalletSelect?.(provider);
      } catch (error) {
        console.error('[WalletSelector] Connection error:', error);
        setSelectedProvider(null);
      }
    } else {
      console.warn('[WalletSelector] No matching connector found for:', provider.info.name);
      onWalletSelect?.(provider);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className || ''}`}>
        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        <span className="ml-3 text-gray-400">Discovering wallets...</span>
      </div>
    );
  }

  if (!hasProviders) {
    return (
      <Card className={`p-6 text-center ${className || ''}`}>
        <div className="text-gray-400 mb-4">
          <svg
            className="mx-auto h-12 w-12 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">No Wallets Found</h3>
          <p className="text-sm">
            Please install a Web3 wallet extension (like MetaMask, Rainbow, or Coinbase Wallet) to continue.
          </p>
        </div>
      </Card>
    );
  }

  if (isConnected) {
    return (
      <Card className={`p-6 text-center ${className || ''}`}>
        <div className="text-green-400 mb-2">
          <svg
            className="mx-auto h-12 w-12 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Wallet Connected</h3>
        </div>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          Select a Wallet
        </h3>
        <p className="text-sm text-gray-400">
          {providerCount} wallet{providerCount !== 1 ? 's' : ''} detected
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {providersArray.map((provider) => (
          <Card
            key={provider.info.uuid}
            className="p-4 cursor-pointer hover:border-purple-500 hover:bg-purple-500/5 transition-all duration-200"
            onClick={() => handleWalletClick(provider)}
          >
            <div className="flex items-center gap-4">
              {/* Wallet Icon */}
              <div className="flex-shrink-0">
                <img
                  src={provider.info.icon}
                  alt={provider.info.name}
                  className="w-10 h-10 rounded-lg"
                  onError={(e) => {
                    // Fallback to a default icon if the wallet icon fails to load
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0iIzdCM0ZGMiIvPjwvc3ZnPg==';
                  }}
                />
              </div>

              {/* Wallet Info */}
              <div className="flex-1">
                <h4 className="text-white font-medium">{provider.info.name}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{provider.info.rdns}</p>
              </div>

              {/* Loading or Arrow */}
              {selectedProvider === provider.info.uuid ? (
                <div className="animate-spin h-5 w-5 border-2 border-purple-500 border-t-transparent rounded-full" />
              ) : (
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* EIP-6963 Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>
            Wallet detection powered by{' '}
            <a
              href="https://eips.ethereum.org/EIPS/eip-6963"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 underline"
            >
              EIP-6963
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
