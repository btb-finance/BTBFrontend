'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { IconType } from 'react-icons';

interface ContractCardProps {
  name: string;
  description: string;
  contractAddress: string;
  network: string;
  icon: React.ElementType;
  delay?: number;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  features: string[];
}

export default function ContractCard({
  name,
  description,
  contractAddress,
  network,
  icon: Icon,
  delay = 0,
  bgColor,
  iconColor,
  borderColor,
  features
}: ContractCardProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleOpenExplorer = () => {
    let explorerUrl = '';
    
    // Determine the explorer URL based on the network
    if (network.toLowerCase() === 'sonic') {
      explorerUrl = `https://sonicscan.org/token/${contractAddress}`;
    } else {
      // Default to Etherscan for other networks
      explorerUrl = `https://etherscan.io/address/${contractAddress}`;
    }
    
    window.open(explorerUrl, '_blank');
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(contractAddress);
    // You could add a toast notification here
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={`overflow-hidden border rounded-xl ${borderColor} ${bgColor}`}
    >
      <Card className="h-full bg-transparent border-0">
        <CardContent className="p-6 flex flex-col h-full">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${iconColor} bg-white dark:bg-gray-800 shadow-sm mb-6`}>
            <Icon className="w-6 h-6" />
          </div>
          
          <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
            {name}
          </CardTitle>
          
          <CardDescription className="mt-2 text-gray-500 dark:text-gray-300">
            {description}
          </CardDescription>
          
          <div className="mt-4 space-y-2">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="ml-3 text-sm text-gray-500 dark:text-gray-300">{feature}</p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex-grow">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500 dark:text-gray-300">Contract:</p>
              <button 
                onClick={handleCopyAddress}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Copy
              </button>
            </div>
            <p className="text-sm font-mono break-all text-blue-600 dark:text-blue-400">{truncateAddress(contractAddress)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-2">Network: {network}</p>
          </div>
          
          <div className="mt-4">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleOpenExplorer}
            >
              View on Explorer
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
} 