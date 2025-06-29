'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { WalletIcon } from '@heroicons/react/24/outline';

interface ConnectButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export function ConnectButton({ 
  className = '', 
  size = 'md',
  showIcon = true 
}: ConnectButtonProps) {
  
  const { address, isConnected } = useAccount();
  const { connect, isPending: isConnecting, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm'
  };

  const handleClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      const connector = connectors[0];
      if (connector) {
        connect({ connector });
      }
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={`inline-flex items-center justify-center font-medium rounded-md bg-white text-btb-primary hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300 shadow-sm ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <WalletIcon className="mr-1.5 h-3.5 w-3.5" />}
      <span className="font-semibold">
        {isConnecting ? 'Connecting...' : isConnected ? 
          `${address?.substring(0, 4)}...${address?.substring(address.length - 4)}` : 
          'Connect Wallet'}
      </span>
    </button>
  );
}