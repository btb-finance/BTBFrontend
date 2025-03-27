'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '../../components/ui/card';

// Contract Addresses
const SHEEP_CONTRACT = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
const SHEEPDOG_CONTRACT = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
const WOLF_CONTRACT = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';

interface ActionProps {
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  buttonText: string;
}

const ActionCard: React.FC<ActionProps> = ({ 
  title, 
  description, 
  onClick, 
  disabled = false,
  buttonText
}) => {
  return (
    <Card className="overflow-hidden border border-gray-200 dark:border-gray-700">
      <CardContent className="p-6">
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </CardTitle>
        <CardDescription className="mt-2 text-gray-500 dark:text-gray-300">
          {description}
        </CardDescription>
        <div className="mt-6">
          <Button 
            variant="default" 
            className="w-full" 
            onClick={onClick}
            disabled={disabled}
          >
            {buttonText}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface ContractInteractionProps {
  className?: string;
}

export default function ContractInteraction({ className = '' }: ContractInteractionProps) {
  const [walletConnected, setWalletConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeContract, setActiveContract] = useState<string | null>(null);

  const handleConnectWallet = async () => {
    setLoading(true);
    try {
      // Simulating wallet connection
      // In a real implementation, you would use ethers.js or web3.js to connect to the wallet
      await new Promise(resolve => setTimeout(resolve, 1000));
      setWalletConnected(true);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setActiveContract(null);
  };

  const handleInteractWithContract = (contractAddress: string) => {
    setActiveContract(contractAddress);
    // In a real implementation, you would initialize a contract instance with ethers.js or web3.js
  };

  const actions = [
    {
      title: 'Buy Sheep Tokens',
      description: 'Purchase Sheep tokens with a 2% transaction fee applied to all buys and sells.',
      onClick: () => handleInteractWithContract(SHEEP_CONTRACT),
      disabled: !walletConnected,
      buttonText: 'Buy Sheep'
    },
    {
      title: 'Activate SheepDog Protection',
      description: 'Shield your Sheep tokens from Wolf by holding SheepDog tokens that create a protective barrier.',
      onClick: () => handleInteractWithContract(SHEEPDOG_CONTRACT),
      disabled: !walletConnected,
      buttonText: 'Activate Protection'
    },
    {
      title: 'Check Wolf Hunger Level',
      description: 'Monitor Wolf\'s current hunger level to assess the risk to unprotected Sheep tokens.',
      onClick: () => handleInteractWithContract(WOLF_CONTRACT),
      disabled: !walletConnected,
      buttonText: 'Check Hunger'
    }
  ];

  return (
    <div className={`py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.h2 
            className="text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Interact with Sheep Ecosystem
          </motion.h2>
          <motion.p 
            className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Connect your wallet to interact with the Sheep ecosystem contracts.
          </motion.p>
        </div>

        {/* Wallet Connection */}
        <div className="mb-12 flex justify-center">
          <Button 
            variant={walletConnected ? "outline" : "default"}
            size="lg"
            onClick={walletConnected ? handleDisconnectWallet : handleConnectWallet}
            disabled={loading}
            className="min-w-[200px]"
          >
            {loading ? 'Connecting...' : walletConnected ? 'Disconnect Wallet' : 'Connect Wallet'}
          </Button>
        </div>

        {/* Connection Status */}
        {walletConnected && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span>Wallet Connected</span>
            </div>
          </div>
        )}

        {/* Contract Actions */}
        <div className="grid gap-8 md:grid-cols-1 lg:grid-cols-3">
          {actions.map((action, index) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <ActionCard {...action} />
            </motion.div>
          ))}
        </div>

        {/* Active Contract Information */}
        {activeContract && (
          <motion.div 
            className="mt-12 p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Active Contract
            </h3>
            <p className="text-sm font-mono break-all text-blue-600 dark:text-blue-400">
              {activeContract}
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Button variant="outline" size="sm">View Balance</Button>
              <Button variant="outline" size="sm">View Rewards</Button>
              <Button variant="outline" size="sm">Claim Rewards</Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 