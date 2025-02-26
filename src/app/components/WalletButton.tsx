'use client';

import { useState } from 'react';
import { useWallet } from '../context/WalletContext';

interface WalletButtonProps {
  large?: boolean;
}

export default function WalletButton({ large = false }: WalletButtonProps) {
  const { isConnected, isConnecting, address, connectWallet, disconnectWallet, error, clearError } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowDropdown(false);
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className={`inline-flex items-center border border-transparent rounded-md shadow-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors
            ${large ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'}`}
        >
          {isConnecting ? (
            <>
              <svg className={`animate-spin -ml-1 mr-2 text-white ${large ? 'h-5 w-5' : 'h-4 w-4'}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Connecting...
            </>
          ) : (
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className={`mr-2 ${large ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
              </svg>
              Connect Wallet
            </span>
          )}
        </button>
        
        {error && (
          <div className="absolute top-full mt-2 right-0 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded z-50 w-64">
            <div className="flex justify-between">
              <p className="text-sm">{error}</p>
              <button onClick={clearError} className="text-red-700 hover:text-red-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`inline-flex items-center border border-transparent rounded-md shadow-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors
          ${large ? 'px-6 py-3 text-base' : 'px-4 py-2 text-sm'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`mr-2 ${large ? 'h-5 w-5' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {address ? formatAddress(address) : 'Connected'}
      </button>

      {showDropdown && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Connected Wallet</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{address}</p>
          </div>
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="user-menu">
            <a
              href={`https://etherscan.io/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              role="menuitem"
            >
              View on Etherscan
            </a>
            <a
              href="#"
              className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              onClick={(e) => {
                e.preventDefault();
                handleDisconnect();
              }}
              role="menuitem"
            >
              Disconnect Wallet
            </a>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute top-full mt-2 right-0 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded z-50 w-64">
          <div className="flex justify-between">
            <p className="text-sm">{error}</p>
            <button onClick={clearError} className="text-red-700 hover:text-red-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
