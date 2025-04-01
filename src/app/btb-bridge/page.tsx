'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/app/context/WalletContext';
import useWeb3Provider from '@/app/hooks/useWeb3Provider';
import useNetworkSwitcher from '@/app/hooks/useNetworkSwitcher';
import { CHAIN_CONFIG, getBTBBalance, getCurrentChain, sendBTBToChain } from '@/app/services/simpleBridgeService';
import { ethers } from 'ethers';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { 
  ArrowPathIcon, 
  ArrowsRightLeftIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';

export default function BTBBridgePage() {
  const { isConnected, connectWallet } = useWallet();
  const { provider } = useWeb3Provider();
  const { switchNetwork, isSwitching } = useNetworkSwitcher();
  const [amount, setAmount] = useState('');
  const [sourceChain, setSourceChain] = useState<keyof typeof CHAIN_CONFIG>('AVALANCHE');
  const [destinationChain, setDestinationChain] = useState<keyof typeof CHAIN_CONFIG>('BASE');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [currentChain, setCurrentChain] = useState('');
  const [balance, setBalance] = useState('0');

  // Get current chain and balance
  useEffect(() => {
    const fetchChainAndBalance = async () => {
      if (isConnected && provider) {
        try {
          // Get current chain info
          const chainInfo = await getCurrentChain(provider);
          setCurrentChain(chainInfo.name);
          
          // Sync the UI with the current connected network
          syncSourceChainWithNetwork(chainInfo.name);
          
          // Get BTB balance
          const btbBalance = await getBTBBalance(provider);
          setBalance(parseFloat(btbBalance).toFixed(2));
        } catch (err) {
          console.error('Error fetching chain or balance:', err);
        }
      }
    };

    fetchChainAndBalance();
    
    // Set up event listener for chain changes
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = () => {
        // Refresh chain and balance data when chain changes
        fetchChainAndBalance();
      };
      
      // Using optional chaining to handle potentially undefined ethereum
      window.ethereum?.on('chainChanged', handleChainChanged);
      
      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [isConnected, provider]);
  
  // Function to sync the source chain selector with the current network
  const syncSourceChainWithNetwork = (networkName: string) => {
    // Find the chain key that matches the current network name
    const chainKey = Object.entries(CHAIN_CONFIG).find(
      ([_, config]) => config.name === networkName
    )?.[0] as keyof typeof CHAIN_CONFIG | undefined;
    
    if (chainKey) {
      setSourceChain(chainKey);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and decimals
    if (value === '' || /^[0-9]*[.]?[0-9]*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleMaxClick = () => {
    setAmount(balance);
  };

  const handleSourceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSourceChain = e.target.value as keyof typeof CHAIN_CONFIG;
    setSourceChain(newSourceChain);
    
    // Show warning if Arbitrum is selected
    if (newSourceChain === 'ARBITRUM') {
      setError('Warning: Arbitrum chain is currently not enabled. Please select a different chain.');
      return;
    } else {
      setError('');
    }
    
    // If connected, attempt to switch to the selected network
    if (isConnected) {
      setIsLoading(true);
      addStatusMessage(`Switching to ${CHAIN_CONFIG[newSourceChain].name} network...`);
      
      const success = await switchNetwork(newSourceChain);
      
      if (success) {
        addStatusMessage(`Successfully switched to ${CHAIN_CONFIG[newSourceChain].name} network`);
      } else {
        addStatusMessage(`Failed to switch to ${CHAIN_CONFIG[newSourceChain].name} network. Please switch manually in your wallet.`);
      }
      
      setIsLoading(false);
    }
  };

  const handleDestinationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDestChain = e.target.value as keyof typeof CHAIN_CONFIG;
    setDestinationChain(newDestChain);
    
    // Show warning if Arbitrum is selected
    if (newDestChain === 'ARBITRUM') {
      setError('Warning: Arbitrum chain is currently not enabled. Please select a different chain.');
    } else if (sourceChain !== 'ARBITRUM') {
      // Only clear error if source chain is also not Arbitrum
      setError('');
    }
  };
  
  const handleSwapChains = async () => {
    const temp = sourceChain;
    setSourceChain(destinationChain);
    setDestinationChain(temp);
    
    // If connected, switch to the new source chain
    if (isConnected) {
      setIsLoading(true);
      addStatusMessage(`Switching to ${CHAIN_CONFIG[destinationChain].name} network...`);
      
      const success = await switchNetwork(destinationChain);
      
      if (success) {
        addStatusMessage(`Successfully switched to ${CHAIN_CONFIG[destinationChain].name} network`);
      } else {
        addStatusMessage(`Failed to switch to ${CHAIN_CONFIG[destinationChain].name} network. Please switch manually in your wallet.`);
        // Revert the UI state if network switching failed
        setSourceChain(temp);
        setDestinationChain(sourceChain);
      }
      
      setIsLoading(false);
    }
  };

  const addStatusMessage = (message: string) => {
    setStatusMessages(prev => [...prev, message]);
  };

  const handleBridge = async () => {
    if (!isConnected) {
      await connectWallet();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Reset states
    setIsLoading(true);
    setStatusMessages([]);
    setTxHash('');
    setError('');

    try {
      if (!provider) {
        setError('No provider available. Please connect your wallet.');
        setIsLoading(false);
        return;
      }
      
      // Check if balance is sufficient
      const currentBalance = await getBTBBalance(provider);
      if (parseFloat(currentBalance) < parseFloat(amount)) {
        setError('Insufficient BTB balance');
        setIsLoading(false);
        return;
      }

      // Get source and destination chain EIDs
      const sourceChainEid = CHAIN_CONFIG[sourceChain].eid;
      const destChainEid = CHAIN_CONFIG[destinationChain].eid;
      
      // Bridge tokens
      const result = await sendBTBToChain(
        provider,
        amount,
        sourceChainEid,
        destChainEid,
        addStatusMessage
      );

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while bridging tokens');
      console.error('Bridge error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">BTB Bridge</h1>
          <p className="text-muted-foreground">
            Transfer your BTB tokens seamlessly across multiple chains
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bridge BTB Tokens</CardTitle>
            <CardDescription>
              Move your BTB tokens between Avalanche, Arbitrum, Optimism, and Base chains
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Current chain and balance info */}
            {isConnected && (
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current Chain</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{currentChain}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">BTB Balance</p>
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{balance} BTB</p>
                </div>
              </div>
            )}

            {/* Amount input */}
            <div className="mb-6">
              <label htmlFor="amount" className="block text-sm font-medium mb-2">
                Amount to Bridge
              </label>
              <div className="relative">
                <Input
                  type="text"
                  id="amount"
                  placeholder="0.0"
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isLoading}
                  className="pr-20"
                />
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    type="button"
                    className="px-3 py-1 text-sm font-medium text-primary hover:text-primary/80 focus:outline-none mr-2"
                    onClick={handleMaxClick}
                    disabled={isLoading}
                  >
                    MAX
                  </button>
                  <span className="text-muted-foreground pr-3">BTB</span>
                </div>
              </div>
            </div>

            {/* Chain selectors */}
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                {/* From chain selector */}
                <div>
                  <label htmlFor="source" className="block text-sm font-medium mb-2">
                    From Chain
                  </label>
                  <select
                    id="source"
                    className="w-full h-10 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    value={sourceChain}
                    onChange={handleSourceChange}
                    disabled={isLoading}
                  >
                    {Object.entries(CHAIN_CONFIG).map(([key, config]) => (
                      <option key={key} value={key} disabled={key === destinationChain}>
                        {config.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* To (destination) chain selector */}
                <div>
                  <label htmlFor="destination" className="block text-sm font-medium mb-2">
                    To Chain
                  </label>
                  <select
                    id="destination"
                    className="w-full h-10 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                    value={destinationChain}
                    onChange={handleDestinationChange}
                    disabled={isLoading}
                  >
                    {Object.entries(CHAIN_CONFIG).map(([key, config]) => (
                      <option 
                        key={key} 
                        value={key} 
                        disabled={key === sourceChain}
                        className={key === 'ARBITRUM' ? 'text-amber-500 dark:text-amber-400 font-medium' : ''}
                      >
                        {config.name}{key === 'ARBITRUM' ? ' (Not Enabled)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Swap button */}
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1"
                  onClick={handleSwapChains}
                  disabled={isLoading || isSwitching}
                >
                  <ArrowsRightLeftIcon className={`h-4 w-4 ${isSwitching ? 'animate-spin' : ''}`} />
                  {isSwitching ? 'Switching Network...' : 'Swap Chains'}
                </Button>
              </div>
            </div>

            {/* Arbitrum warning banner */}
            {(sourceChain === 'ARBITRUM' || destinationChain === 'ARBITRUM') && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-500 dark:border-amber-700 rounded-md flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>Important:</strong> Arbitrum chain is currently not enabled. Please select a different chain.
                </p>
              </div>
            )}
            
            {/* Bridge button */}
            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={handleBridge}
              disabled={isLoading || isSwitching || sourceChain === 'ARBITRUM' || destinationChain === 'ARBITRUM'}
            >
              {isLoading || isSwitching ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : isConnected ? (
                <>
                  <ArrowsRightLeftIcon className="h-5 w-5" />
                  Bridge BTB
                </>
              ) : (
                'Connect Wallet'
              )}
            </Button>

            {/* Error message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-500 dark:border-red-700 rounded-md flex items-start">
                <ExclamationCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {/* Status messages */}
            {statusMessages.length > 0 && (
              <div className="mt-6 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Transaction Status</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto text-sm">
                  {statusMessages.map((message, index) => (
                    <p key={index} className="text-gray-700 dark:text-gray-300">
                      {message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction success */}
            {txHash && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-500 dark:border-green-700 rounded-md">
                <div className="flex items-start">
                  <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Transaction Successful!</p>
                    <div className="mt-2">
                      <a
                        href={`https://layerzeroscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline break-all"
                      >
                        View on LayerZero Explorer: {txHash}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <GlobeAltIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>How It Works</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                BTB Bridge uses LayerZero's cross-chain messaging protocol to enable seamless transfers of BTB tokens across multiple blockchain networks.
              </p>
              <div className="grid grid-cols-1 gap-4">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="font-medium mb-1">1. Select Amount</p>
                  <p className="text-sm text-muted-foreground">Choose how many BTB tokens you want to bridge</p>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="font-medium mb-1">2. Choose Destination</p>
                  <p className="text-sm text-muted-foreground">Select which blockchain you want to receive your tokens on</p>
                </div>
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="font-medium mb-1">3. Confirm Transaction</p>
                  <p className="text-sm text-muted-foreground">Approve the transaction in your wallet and wait for confirmation</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ShieldCheckIcon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Supported Chains</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(CHAIN_CONFIG).map(([key, config]) => (
                  <div key={key} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium">{config.symbol}</span>
                    </div>
                    <span className="font-medium">{config.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
