'use client';

import React, { useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { WalletSelector } from './WalletSelector';
import { Button } from '../ui/button';

interface EIP6963ConnectButtonProps {
  className?: string;
  showModal?: boolean;
}

/**
 * Enhanced connect button that uses EIP-6963 wallet discovery
 * Displays all available wallets in a modal for selection
 */
export function EIP6963ConnectButton({
  className,
  showModal = false
}: EIP6963ConnectButtonProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(showModal);

  const handleDisconnect = () => {
    disconnect();
  };

  const handleWalletSelect = () => {
    setIsModalOpen(false);
  };

  if (isConnected && address) {
    return (
      <div className={`flex items-center gap-3 ${className || ''}`}>
        <div className="px-4 py-2 bg-gray-800 rounded-lg">
          <span className="text-sm text-gray-400">Connected:</span>
          <span className="ml-2 text-white font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </div>
        <Button
          onClick={handleDisconnect}
          className="bg-red-600 hover:bg-red-700"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className={`bg-purple-600 hover:bg-purple-700 ${className || ''}`}
      >
        Connect Wallet
      </Button>

      {/* Wallet Selection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md">
            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close modal"
            >
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Modal Content */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-700 shadow-2xl">
              <WalletSelector
                onWalletSelect={handleWalletSelect}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
