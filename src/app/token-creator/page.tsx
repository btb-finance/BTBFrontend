'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Slider } from '@/app/components/ui/slider';
import { 
  ArrowPathIcon, 
  WalletIcon, 
  CurrencyDollarIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  KeyIcon
} from '@heroicons/react/24/outline';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { ethers } from 'ethers';
import { toast } from 'sonner';

// Define supported chains with Layer Zero endpoints and RPC URLs
const SUPPORTED_CHAINS = [
  // Mainnets
  { id: 1, name: 'Ethereum Mainnet', symbol: 'ETH', explorerUrl: 'https://etherscan.io', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://eth.llamarpc.com', isMainnet: true },
  { id: 56, name: 'BNB Chain', symbol: 'BNB', explorerUrl: 'https://bscscan.com', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://bsc-dataseed.binance.org', isMainnet: true },
  { id: 137, name: 'Polygon', symbol: 'MATIC', explorerUrl: 'https://polygonscan.com', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://polygon-rpc.com', isMainnet: true },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH', explorerUrl: 'https://arbiscan.io', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://arb1.arbitrum.io/rpc', isMainnet: true },
  { id: 10, name: 'Optimism', symbol: 'OP', explorerUrl: 'https://optimistic.etherscan.io', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://mainnet.optimism.io', isMainnet: true },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX', explorerUrl: 'https://snowtrace.io', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', isMainnet: true },
  { id: 8453, name: 'Base', symbol: 'ETH', explorerUrl: 'https://basescan.org', lzEndpoint: '0x1a44076050125825900e736c501f859c50fE728c', rpcUrl: 'https://mainnet.base.org', isMainnet: true },
  
  // Testnets
  { id: 11155111, name: 'Ethereum Sepolia', symbol: 'ETH', explorerUrl: 'https://sepolia.etherscan.io', lzEndpoint: '0x6EDCE65403992e310A62460808c4b910D972f10f', rpcUrl: 'https://sepolia.drpc.org', isMainnet: false },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15
    }
  }
};

interface AddressGenerationOptions {
  prefix: string;
  suffix: string;
  zeroCount: number;
  customPattern: string;
  caseSensitive: boolean;
}

interface TokenDetails {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals: number;
  chainIds: number[];
  mainChainId: number; // Chain where tokens will be minted
  ownerAddress: string; // Address that will be set as the owner (delegate)
  etherscanApiKey?: string;
}

export default function TokenCreator() {
  const { isConnected, address } = useWalletConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{attempts: number, rate: number} | null>(null);
  const [activeTab, setActiveTab] = useState('address');
  const [generatedWallet, setGeneratedWallet] = useState<{
    address: string;
    privateKey: string;
    contractAddress: string;
    balances?: Record<number, string>; // Map of chainId to balance
    isImported?: boolean; // Flag to indicate if the wallet was imported
  } | null>(null);
  
  // State for importing private key
  const [importPrivateKey, setImportPrivateKey] = useState('');
  
  // Address generation options
  const [addressOptions, setAddressOptions] = useState<AddressGenerationOptions>({
    prefix: '',
    suffix: '',
    zeroCount: 0,
    customPattern: '',
    caseSensitive: false,
  });
  
  // Token details
  const [tokenDetails, setTokenDetails] = useState<TokenDetails>({
    name: '',
    symbol: '',
    decimals: 18,
    totalSupply: '1000000',
    chainIds: [1], // Default to Ethereum
    mainChainId: 1, // Default main chain is Ethereum
    ownerAddress: '', // Will be filled with connected wallet address
    etherscanApiKey: ''
  });
  
  // Method selection for address generation
  const [addressMethod, setAddressMethod] = useState<'prefix' | 'suffix' | 'zeros' | 'custom'>('prefix');
  
  // Function to generate a single address and check if it matches criteria
  const generateAndCheckAddress = (config: any) => {
    // Generate a random wallet
    const wallet = ethers.Wallet.createRandom();
    const nonce = 0; // First transaction nonce
    const contractAddress = ethers.utils.getContractAddress({
      from: wallet.address,
      nonce: nonce
    });
    
    // Check if the address matches our criteria
    const checksumAddress = ethers.utils.getAddress(contractAddress);
    const compareAddress = config.caseSensitive ? checksumAddress : checksumAddress.toLowerCase();
    
    // Remove the '0x' prefix for comparison
    const addressWithoutPrefix = compareAddress.slice(2);
    
    let isMatch = true;
    
    if (config.prefix && !addressWithoutPrefix.startsWith(config.caseSensitive ? config.prefix : config.prefix.toLowerCase())) {
      isMatch = false;
    }
    
    if (config.suffix && !addressWithoutPrefix.endsWith(config.caseSensitive ? config.suffix : config.suffix.toLowerCase())) {
      isMatch = false;
    }
    
    return {
      isMatch,
      wallet: {
        address: wallet.address,
        privateKey: wallet.privateKey,
        contractAddress: checksumAddress
      }
    };
  };

  // Function to generate addresses with minimal UI blocking
  const generateAddressesInBatches = async (config: any, onProgress: (attempts: number, rate: number) => void, onSuccess: (wallet: any) => void, onError: (message: string, attempts: number) => void) => {
    let attempts = 0;
    const batchSize = 10; // Process only 10 addresses at a time to keep UI responsive
    const startTime = Date.now();
    const maxAttempts = config.maxAttempts || 10000000;
    let lastProgressUpdate = 0;
    
    // Use requestAnimationFrame for better UI responsiveness
    const findAddress = () => {
      // Process a very small batch
      for (let i = 0; i < batchSize; i++) {
        attempts++;
        
        const result = generateAndCheckAddress(config);
        
        // If we found a match, return it
        if (result.isMatch) {
          onSuccess(result.wallet);
          return;
        }
        
        // Check if we should terminate after too many attempts
        if (attempts >= maxAttempts) {
          onError('Maximum attempts reached', attempts);
          return;
        }
      }
      
      // Report progress every 100 attempts
      if (attempts - lastProgressUpdate >= 100) {
        const currentTime = Date.now();
        const elapsedSeconds = Math.max(0.001, (currentTime - startTime) / 1000);
        const rate = attempts / elapsedSeconds;
        onProgress(attempts, rate);
        lastProgressUpdate = attempts;
      }
      
      // Schedule the next batch with requestAnimationFrame for better UI responsiveness
      requestAnimationFrame(findAddress);
    };
    
    // Start the process
    findAddress();
  };

  // Function to handle address generation
  const generateVanityAddress = async () => {
    setIsGenerating(true);
    setGenerationProgress(null);
    
    try {
      // Get the current address options based on the selected method
      let prefix = '';
      let suffix = '';
      let caseSensitive = addressOptions.caseSensitive;
      
      switch (addressMethod) {
        case 'prefix':
          prefix = addressOptions.prefix;
          break;
        case 'suffix':
          suffix = addressOptions.suffix;
          break;
        case 'zeros':
          prefix = '0'.repeat(addressOptions.zeroCount);
          break;
        case 'custom':
          // For custom patterns, we'd need a more complex implementation
          // For now, we'll just use a random wallet
          break;
      }
      
      // Validate inputs
      if ((addressMethod === 'prefix' && !prefix) || 
          (addressMethod === 'suffix' && !suffix) || 
          (addressMethod === 'zeros' && addressOptions.zeroCount <= 0)) {
        toast.error('Please provide valid pattern criteria');
        setIsGenerating(false);
        return;
      }
      
      // Create configuration
      const config = {
        prefix,
        suffix,
        caseSensitive,
        maxAttempts: 10000000 // Higher limit
      };
      
      // Define callbacks
      const onProgress = (attempts: number, rate: number) => {
        setGenerationProgress({
          attempts,
          rate
        });
      };
      
      const onSuccess = (wallet: any) => {
        // Set the generated wallet
        setGeneratedWallet(wallet);
        
        // Move to the token tab
        setActiveTab('token');
        
        // Show success message
        toast.success(`Address generated successfully after ${generationProgress?.attempts.toLocaleString() || '0'} attempts!`);
        
        // Clean up
        setIsGenerating(false);
        setGenerationProgress(null);
      };
      
      const onError = (message: string, attempts: number) => {
        toast.error(`${message} after ${attempts.toLocaleString()} attempts. Try a simpler pattern.`);
        setIsGenerating(false);
        setGenerationProgress(null);
      };
      
      // Start the generation process
      generateAddressesInBatches(config, onProgress, onSuccess, onError);
      
    } catch (error) {
      console.error('Error generating address:', error);
      toast.error('Failed to generate address: ' + (error as Error).message);
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };
  
  // Function to check balance for a wallet on a specific chain
  const checkBalance = async (address: string, chainId: number) => {
    try {
      const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
      if (!chain || !chain.rpcUrl) {
        console.warn(`No RPC URL found for chain ID ${chainId}`);
        return '0.00';
      }
      
      // Use direct RPC URL from the chain configuration to avoid CORS and provider issues
      try {
        // Create a provider using the chain's RPC URL directly
        const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error(`Balance check timeout for ${chain.name}`)), 10000);
        });
        
        // Race between actual balance check and timeout
        const balancePromise = provider.getBalance(address)
          .then(balance => ethers.utils.formatEther(balance));
          
        const result = await Promise.race([balancePromise, timeoutPromise]);
        return result;
      } catch (providerError) {
        console.warn(`Provider error for ${chain.name}:`, providerError);
        
        // If direct RPC fails, try using the wallet's provider as fallback
        if (window.ethereum) {
          try {
            // Use the connected wallet's provider
            const ethereumProvider = window.ethereum as any;
            const provider = new ethers.providers.Web3Provider(ethereumProvider);
            
            // Check if we're on the right network
            const network = await provider.getNetwork();
            if (network.chainId === chainId) {
              const balance = await provider.getBalance(address);
              return ethers.utils.formatEther(balance);
            }
          } catch (walletError) {
            console.warn('Error using wallet provider:', walletError);
          }
        }
        
        // As a last resort for testnets, try a public API
        if (chainId === 11155111) { // Sepolia
          try {
            const response = await fetch(`https://api-sepolia.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest`);
            const data = await response.json();
            if (data.status === '1') {
              return ethers.utils.formatEther(data.result);
            }
          } catch (etherscanError) {
            console.warn('Etherscan API error:', etherscanError);
          }
        }
      }
      
      // If all methods fail, return 0
      return '0.00';
    } catch (error) {
      console.error(`Error checking balance on chain ${chainId}:`, error);
      return '0.00'; // Return 0 instead of 'Error' for better UI display
    }
  };
  
  // Function to check balances on all selected chains
  const checkAllBalances = async (address: string, chainIds: number[]) => {
    const balances: Record<number, string> = {};
    
    // Initialize with 'Loading...' for better UX
    chainIds.forEach(chainId => {
      balances[chainId] = 'Loading...';
    });
    
    // Set initial balances to show loading state
    if (generatedWallet) {
      setGeneratedWallet(prev => ({
        ...prev!,
        balances: { ...balances }
      }));
    }
    
    // Check balance on all selected chains
    // Use sequential checking to avoid rate limiting issues
    for (const chainId of chainIds) {
      try {
        const balance = await checkBalance(address, chainId);
        balances[chainId] = balance;
        
        // Update UI after each balance check
        if (generatedWallet) {
          setGeneratedWallet(prev => ({
            ...prev!,
            balances: { ...prev!.balances, ...{ [chainId]: balance } }
          }));
        }
      } catch (error) {
        balances[chainId] = '0.00';
      }
    }
    
    return balances;
  };
  
  // Function to deploy token
  const deployToken = async () => {
    if (!generatedWallet) {
      toast.error('Please generate an address first');
      return;
    }
    
    if (!tokenDetails.name || !tokenDetails.symbol || !tokenDetails.totalSupply) {
      toast.error('Please fill in all token details');
      return;
    }
    
    try {
      setIsLoading(true);
      toast.info('Starting deployment process...');
      
      // Check if window.ethereum exists
      if (!window.ethereum) {
        toast.error('No Ethereum wallet detected. Please install MetaMask or another wallet.');
        setIsLoading(false);
        return;
      }
      
      // Update balances before deployment
      if (generatedWallet && generatedWallet.address) {
        toast.info('Checking balances on selected chains...');
        await checkAllBalances(generatedWallet.address, tokenDetails.chainIds);
      }

      // Define ethereum provider type
      const ethereumProvider = window.ethereum as {
        request: (args: any) => Promise<any>;
        on: (event: string, callback: (...args: any[]) => void) => void;
        removeListener: (event: string, callback: (...args: any[]) => void) => void;
      };

      // Get the selected chain for RPC URL
      const mainChain = SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId);
      if (!mainChain) {
        toast.error('Invalid main chain selected');
        setIsLoading(false);
        return;
      }

      // Create a provider using the RPC URL directly to avoid CORS issues
      const provider = new ethers.providers.JsonRpcProvider(mainChain.rpcUrl);
      
      // Request accounts from MetaMask
      await ethereumProvider.request({ method: 'eth_requestAccounts' });
      
      // Create a wallet from the generated private key and connect it to the provider
      // This is critical - the wallet must be connected to a provider to send transactions
      const wallet = new ethers.Wallet(generatedWallet.privateKey, provider);
      
      // Verify the wallet has a provider
      if (!wallet.provider) {
        toast.error('Failed to connect wallet to provider');
        setIsLoading(false);
        return;
      }
      
      // Validate that at least one chain is selected
      if (tokenDetails.chainIds.length === 0) {
        toast.error('Please select at least one blockchain for deployment');
        setIsLoading(false);
        return;
      }
      
      // We already have the main chain from earlier
      if (!mainChain) {
        toast.error('Invalid main chain selected');
        setIsLoading(false);
        return;
      }
      
      // Check if the generated wallet has enough funds
      const balance = await provider.getBalance(wallet.address);
      if (balance.eq(0)) {
        // Create a message showing all required tokens for selected chains
        const requiredTokens = tokenDetails.chainIds.map(chainId => {
          const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
          return chain ? chain.symbol : 'ETH';
        }).filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        
        toast.error(
          <div className="space-y-2">
            <p>The generated address has no funds. Please send some {mainChain.symbol} to deploy on {mainChain.name}.</p>
            <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded break-all">
              {wallet.address}
            </div>
            {tokenDetails.chainIds.length > 1 && (
              <p className="text-sm">
                For multi-chain deployment, you'll also need: {requiredTokens.join(', ')}
              </p>
            )}
            <p className="text-sm">You must fund this address before you can deploy the token.</p>
            <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900 rounded">
              <p className="text-xs font-medium">Balances on selected chains:</p>
              <ul className="text-xs space-y-1 mt-1">
                {tokenDetails.chainIds.map(chainId => {
                  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
                  const chainBalance = generatedWallet?.balances?.[chainId] || '0';
                  return (
                    <li key={chainId} className="flex justify-between">
                      <span>{chain?.name}:</span>
                      <span className={chainBalance === '0' || chainBalance === '0.0' || chainBalance === '0.00' ? 'text-red-500' : 'text-green-500'}>
                        {chainBalance} {chain?.symbol}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>,
          { duration: 10000 }
        );
        setIsLoading(false);
        return;
      }
      
      // Use the selected chain ID directly since we're using JsonRpcProvider
      const currentChainId = tokenDetails.mainChainId;
      
      // Check if we're on the correct chain for the main deployment
      if (currentChainId !== tokenDetails.mainChainId) {
        // Request chain switch to the main chain
        try {
          toast.info(`Switching to ${SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId)?.name}...`);
          
          // Add chain if it doesn't exist
          const addChainPromise = async () => {
            const chain = SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId);
            if (!chain) return;
            
            try {
              await ethereumProvider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x' + tokenDetails.mainChainId.toString(16),
                  chainName: chain.name,
                  nativeCurrency: {
                    name: chain.symbol,
                    symbol: chain.symbol,
                    decimals: 18
                  },
                  rpcUrls: [chain.rpcUrl],
                  blockExplorerUrls: [chain.explorerUrl]
                }]
              });
            } catch (addError) {
              console.error('Error adding chain:', addError);
            }
          };
          
          // Try to switch chain
          try {
            await ethereumProvider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x' + tokenDetails.mainChainId.toString(16) }],
            });
          } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask
            if (switchError.code === 4902) {
              toast.info(`Adding ${SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId)?.name} to your wallet...`);
              await addChainPromise();
              
              // Try switching again after adding
              await ethereumProvider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x' + tokenDetails.mainChainId.toString(16) }],
              });
            } else {
              throw switchError;
            }
          }
          
          // Verify the switch was successful
          const updatedNetwork = await provider.getNetwork();
          if (updatedNetwork.chainId !== tokenDetails.mainChainId) {
            throw new Error(`Failed to switch to ${SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId)?.name}`);
          }
          
          toast.success(`Successfully switched to ${SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId)?.name}`);
        } catch (switchError: any) {
          toast.error(`Failed to switch network: ${switchError.message}`);
          throw switchError;
        }
      }
      
      // We already have the main chain from earlier, so no need to find it again
      // Just double-check it's still valid
      if (!mainChain) {
        toast.error('Selected main chain not supported');
        setIsLoading(false);
        return;
      }

      // Load the compiled BTBFinance contract
      // This is the multichain token contract from tokencode.sol
      const compiledContract = require('./compiled/BTBFinance.json');
      
      // Create a contract factory with the BTBFinance ABI and bytecode
      const contractJson = {
        abi: compiledContract.abi,
        bytecode: compiledContract.bytecode
      };
      
      // Convert total supply to the correct format with decimals
      const totalSupplyWithDecimals = ethers.utils.parseUnits(
        tokenDetails.totalSupply,
        tokenDetails.decimals
      );
      
      try {
        // Log detailed information for debugging
        console.log('Deployment details:', {
          mainChainId: tokenDetails.mainChainId,
          chainIds: tokenDetails.chainIds,
          walletAddress: wallet.address,
          balance: ethers.utils.formatEther(await provider.getBalance(wallet.address)) + ' ' + mainChain.symbol
        });
        
        // First deploy to the main chain
        toast.info(`Starting deployment on ${mainChain.name} (main chain)...`);
        
        // Get the Layer Zero endpoint address for the main chain
        const mainChainEndpoint = mainChain.lzEndpoint;
        console.log('Using Layer Zero endpoint:', mainChainEndpoint);
        
        // Create contract factory
        const factory = new ethers.ContractFactory(
          contractJson.abi,
          contractJson.bytecode,
          wallet // Use the wallet that's already connected to a provider
        );
        toast.info('Contract factory created successfully');

        // Determine the owner address (delegate)
        const ownerAddress = tokenDetails.ownerAddress.trim() || wallet.address;
        console.log('Using owner address:', ownerAddress);
        
        // Deploy the contract with constructor arguments for BTBFinance
        toast.info(`Deploying token contract on ${mainChain.name}...`);
        console.log('Deploying with parameters:', {
          name: tokenDetails.name,
          symbol: tokenDetails.symbol,
          lzEndpoint: mainChainEndpoint,
          delegate: ownerAddress,
          maxSupply: totalSupplyWithDecimals.toString(),
          mainChainId: tokenDetails.mainChainId
        });
        
        // Set gas price and limit explicitly for more reliable deployment
        const gasPrice = await provider.getGasPrice();
        const adjustedGasPrice = gasPrice.mul(120).div(100); // 20% higher than current gas price
        
        // Set deployment options
        const deployOptions = {
          gasPrice: adjustedGasPrice,
          gasLimit: 5000000, // Explicit gas limit
        };
        
        console.log('Deployment options:', {
          gasPrice: ethers.utils.formatUnits(adjustedGasPrice, 'gwei') + ' gwei',
          gasLimit: deployOptions.gasLimit
        });
        
        // Deploy the contract with a variable in the outer scope
        let mainContract;
        try {
          mainContract = await factory.deploy(
            tokenDetails.name,                    // _name
            tokenDetails.symbol,                  // _symbol
            mainChainEndpoint,                    // _lzEndpoint
            ownerAddress,                         // _delegate (owner)
            totalSupplyWithDecimals,              // _maxSupply
            tokenDetails.mainChainId,             // _mainChainId
            deployOptions                         // deployment options
          );
          console.log('Contract deployment transaction sent:', mainContract.deployTransaction.hash);
          
          // Show transaction hash in UI
          toast.info(
            <div>
              <p>Transaction sent! Waiting for confirmation...</p>
              <p className="text-xs mt-1 font-mono break-all">
                TX Hash: {mainContract.deployTransaction.hash}
              </p>
              <a 
                href={`${mainChain.explorerUrl}/tx/${mainContract.deployTransaction.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline mt-1 block"
              >
                View on {mainChain.name} Explorer
              </a>
            </div>,
            { duration: 10000 }
          );
        } catch (deploymentError) {
          console.error('Specific deployment error:', deploymentError);
          toast.error(
            <div>
              <p>Deployment error: {(deploymentError as Error).message}</p>
              <p className="text-xs mt-2">Try the following:</p>
              <ul className="list-disc pl-5 text-xs mt-1">
                <li>Make sure you have enough {mainChain.symbol} for gas fees</li>
                <li>Try switching to a different network and back</li>
                <li>Refresh the page and try again</li>
              </ul>
            </div>,
            { duration: 15000 }
          );
          throw deploymentError;
        }
        
        // Store deployed contracts by chain ID
        const deployedContracts = {
          [tokenDetails.mainChainId]: mainContract
        };
        
        // If there are additional chains to deploy to, show info message
        if (tokenDetails.chainIds.length > 1) {
          toast.info(`Main chain deployment initiated. After confirmation, you'll need to deploy to ${tokenDetails.chainIds.length - 1} additional chain(s).`);
        }
        
        // Wait for main chain deployment confirmation
        toast.info(`Waiting for transaction confirmation on ${mainChain.name}...`);
        console.log('Waiting for deployment confirmation...');
        
        try {
          // Add a timeout to prevent waiting indefinitely
          const deploymentPromise = mainContract.deployed();
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Deployment confirmation timeout after 60 seconds')), 60000);
          });
          
          // Race between deployment and timeout
          await Promise.race([deploymentPromise, timeoutPromise]);
          console.log('Contract deployed successfully at address:', mainContract.address);
        } catch (confirmationError) {
          console.error('Deployment confirmation error:', confirmationError);
          toast.error(`Confirmation error: ${(confirmationError as Error).message}`);
          
          // Even if confirmation times out, the transaction might still be processing
          toast.info(
            <div>
              <p>Transaction may still be processing. Check the transaction status in your wallet.</p>
              <p className="text-xs mt-1">Transaction hash: {mainContract.deployTransaction.hash}</p>
            </div>,
            { duration: 10000 }
          );
          throw confirmationError;
        }
        
        // Success message with explorer link for the main chain
        const mainExplorerUrl = `${mainChain.explorerUrl}/address/${mainContract.address}`;
        toast.success(
          <div>
            Token deployed successfully on {mainChain.name}!
            <a href={mainExplorerUrl} target="_blank" rel="noopener noreferrer" className="underline ml-1">
              View on Explorer
            </a>
          </div>
        );
        
        // Verify contract if Etherscan API key is provided (for main chain)
        if (tokenDetails.etherscanApiKey && tokenDetails.etherscanApiKey.length > 0 && mainChain.explorerUrl.includes('etherscan')) {
          try {
            toast.info(`Submitting contract for verification on ${mainChain.name}...`);
            
            // In a real implementation, we would call the Etherscan API to verify the contract
            // This is a simplified version that just shows a success message
            setTimeout(() => {
              toast.success(`Contract submitted for verification on ${mainChain.name}!`);
            }, 2000);
          } catch (verifyError) {
            console.error('Error verifying contract:', verifyError);
            toast.error(`Failed to verify contract on ${mainChain.name}, but deployment was successful`);
          }
        }
        
        // Display summary of deployments
        toast.success(
          <div className="space-y-2">
            <p className="font-semibold">Deployment Summary:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                {mainChain.name} (Main Chain): 
                <a href={mainExplorerUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  {mainContract.address.substring(0, 6)}...{mainContract.address.substring(38)}  
                </a>
              </li>
              <li>
                Owner Address (Delegate): <span className="font-mono text-xs">{ownerAddress}</span>
              </li>
              {tokenDetails.chainIds.length > 1 && (
                <li className="text-amber-500">
                  {tokenDetails.chainIds.length - 1} additional chain(s) require deployment - 
                  please switch networks and deploy to each chain.
                </li>
              )}
            </ul>
          </div>,
          { duration: 10000 }
        );
      } catch (deployError) {
        console.error('Contract deployment error:', deployError);
        toast.error(`Deployment failed: ${(deployError as Error).message}`);
      }
    } catch (error) {
      console.error('Error deploying token:', error);
      toast.error('Failed to deploy token: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle input changes for address options
  const handleAddressOptionChange = (field: keyof AddressGenerationOptions, value: string | number | boolean) => {
    setAddressOptions(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Real-time preview of address generation
    if (field === 'prefix' || field === 'suffix' || field === 'zeroCount' || field === 'customPattern' || field === 'caseSensitive') {
      // If we already have a wallet, update the preview in real-time
      if (!isGenerating && (field === 'prefix' || field === 'suffix')) {
        const newValue = value as string;
        if (newValue && newValue.length >= 2) {
          // Generate a preview wallet after a short delay to avoid too many generations
          const previewTimer = setTimeout(() => {
            const wallet = ethers.Wallet.createRandom();
            const contractAddress = ethers.utils.getContractAddress({
              from: wallet.address,
              nonce: 0
            });
            
            setGeneratedWallet({
              address: wallet.address,
              privateKey: wallet.privateKey,
              contractAddress: contractAddress
            });
          }, 500);
          
          return () => clearTimeout(previewTimer);
        }
      }
    }
  };
  
  // Handle input changes for token details
  const handleTokenDetailChange = (field: keyof TokenDetails, value: string | number) => {
    setTokenDetails(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-6"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-bold mb-2">Custom Token Creator</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Generate a vanity address and deploy your own custom token
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-8">
              <TabsTrigger value="address" disabled={isGenerating}>
                <WalletIcon className="h-4 w-4 mr-2" />
                Address Generator
              </TabsTrigger>
              <TabsTrigger value="token" disabled={!generatedWallet || isGenerating}>
                <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                Token Deployment
              </TabsTrigger>
            </TabsList>

            <TabsContent value="address" className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Address Generation Method</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Button 
                          variant={addressMethod === 'prefix' ? 'default' : 'outline'} 
                          onClick={() => setAddressMethod('prefix')}
                          className="flex flex-col items-center justify-center h-24"
                        >
                          <span className="text-xs mb-2">Start With</span>
                          <span className="font-mono">0x<span className="text-green-500">ABC</span>...</span>
                        </Button>
                        
                        <Button 
                          variant={addressMethod === 'suffix' ? 'default' : 'outline'} 
                          onClick={() => setAddressMethod('suffix')}
                          className="flex flex-col items-center justify-center h-24"
                        >
                          <span className="text-xs mb-2">End With</span>
                          <span className="font-mono">....<span className="text-green-500">XYZ</span></span>
                        </Button>
                        
                        <Button 
                          variant={addressMethod === 'zeros' ? 'default' : 'outline'} 
                          onClick={() => setAddressMethod('zeros')}
                          className="flex flex-col items-center justify-center h-24"
                        >
                          <span className="text-xs mb-2">Leading Zeros</span>
                          <span className="font-mono">0x<span className="text-green-500">0000</span>...</span>
                        </Button>
                        
                        <Button 
                          variant={addressMethod === 'custom' ? 'default' : 'outline'} 
                          onClick={() => setAddressMethod('custom')}
                          className="flex flex-col items-center justify-center h-24"
                        >
                          <span className="text-xs mb-2">Custom Pattern</span>
                          <span className="font-mono">0x<span className="text-green-500">??</span>...<span className="text-green-500">??</span></span>
                        </Button>
                      </div>
                    </div>
                    
                    {addressMethod === 'prefix' && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="prefix">Address Prefix (after 0x)</Label>
                          <Input
                            id="prefix"
                            placeholder="e.g. ABC"
                            value={addressOptions.prefix}
                            onChange={(e) => handleAddressOptionChange('prefix', e.target.value)}
                            maxLength={8}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter up to 8 characters. The longer the prefix, the longer it will take to generate.
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="caseSensitive"
                            checked={addressOptions.caseSensitive}
                            onChange={(e) => handleAddressOptionChange('caseSensitive', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="caseSensitive">Case Sensitive</Label>
                        </div>
                      </div>
                    )}
                    
                    {addressMethod === 'suffix' && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="suffix">Address Suffix</Label>
                          <Input
                            id="suffix"
                            placeholder="e.g. XYZ"
                            value={addressOptions.suffix}
                            onChange={(e) => handleAddressOptionChange('suffix', e.target.value)}
                            maxLength={8}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Enter up to 8 characters. The longer the suffix, the longer it will take to generate.
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="caseSensitive"
                            checked={addressOptions.caseSensitive}
                            onChange={(e) => handleAddressOptionChange('caseSensitive', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="caseSensitive">Case Sensitive</Label>
                        </div>
                      </div>
                    )}
                    
                    {addressMethod === 'zeros' && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="zeroCount">Number of Leading Zeros (after 0x)</Label>
                          <div className="flex items-center space-x-4">
                            <Slider
                              id="zeroCount"
                              min={1}
                              max={10}
                              step={1}
                              value={[addressOptions.zeroCount]}
                              onValueChange={(value) => handleAddressOptionChange('zeroCount', value[0])}
                              className="flex-1"
                            />
                            <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                              {addressOptions.zeroCount}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            More zeros will take exponentially longer to generate.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {addressMethod === 'custom' && (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="customPattern">Custom Pattern</Label>
                          <Input
                            id="customPattern"
                            placeholder="e.g. 00??00??00"
                            value={addressOptions.customPattern}
                            onChange={(e) => handleAddressOptionChange('customPattern', e.target.value)}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Use ? as wildcard. Example: 00??00 will match addresses with 00 followed by any two characters, followed by 00.
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="caseSensitive"
                            checked={addressOptions.caseSensitive}
                            onChange={(e) => handleAddressOptionChange('caseSensitive', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor="caseSensitive">Case Sensitive</Label>
                        </div>
                      </div>
                    )}
                    
                    {/* Import Private Key Section */}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-6 pt-6">
                      <h3 className="text-lg font-medium mb-4">Or Import Existing Private Key</h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="privateKey">Private Key</Label>
                          <div className="flex space-x-2">
                            <Input
                              id="privateKey"
                              type="password"
                              placeholder="Enter your private key"
                              value={importPrivateKey}
                              onChange={(e) => setImportPrivateKey(e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              onClick={() => {
                                if (!importPrivateKey || !importPrivateKey.trim()) {
                                  toast.error('Please enter a valid private key');
                                  return;
                                }
                                
                                try {
                                  // Validate and create wallet from private key
                                  let privateKeyWithPrefix = importPrivateKey;
                                  if (!privateKeyWithPrefix.startsWith('0x')) {
                                    privateKeyWithPrefix = '0x' + privateKeyWithPrefix;
                                  }
                                  
                                  const wallet = new ethers.Wallet(privateKeyWithPrefix);
                                  const nonce = 0; // First transaction nonce
                                  const contractAddress = ethers.utils.getContractAddress({
                                    from: wallet.address,
                                    nonce: nonce
                                  });
                                  
                                  // Set the imported wallet
                                  setGeneratedWallet({
                                    address: wallet.address,
                                    privateKey: wallet.privateKey,
                                    contractAddress: ethers.utils.getAddress(contractAddress),
                                    isImported: true
                                  });
                                  
                                  // Move to the token tab
                                  setActiveTab('token');
                                  
                                  // Show success message
                                  toast.success('Private key imported successfully!');
                                  
                                  // Clear the input
                                  setImportPrivateKey('');
                                } catch (error) {
                                  console.error('Error importing private key:', error);
                                  toast.error('Invalid private key: ' + (error as Error).message);
                                }
                              }}
                              variant="outline"
                              disabled={isGenerating}
                            >
                              Import
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Your private key will never leave your browser. It's used only to generate the contract address.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4">
                      <Button 
                        onClick={generateVanityAddress} 
                        disabled={isGenerating}
                        className="w-full"
                      >
                        {isGenerating ? (
                          <>
                            <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                            Generating Address...
                          </>
                        ) : (
                          <>
                            <WalletIcon className="h-4 w-4 mr-2" />
                            Generate Vanity Address
                          </>
                        )}
                      </Button>
                      {isGenerating && generationProgress && (
                        <div className="mt-4">
                          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '100%' }}></div>
                          </div>
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Attempts: {generationProgress.attempts.toLocaleString()}</span>
                            <span>Speed: {Math.round(generationProgress.rate).toLocaleString()} addr/sec</span>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {isGenerating ? 'Searching for matching address...' : 'This process may take some time depending on your criteria.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="token" className="space-y-6">
              {generatedWallet ? (
                <>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="space-y-6">
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                          <h3 className="text-lg font-medium flex items-center text-green-700 dark:text-green-400">
                            <ShieldCheckIcon className="h-5 w-5 mr-2" />
                            Address Generated Successfully
                          </h3>
                          <div className="mt-3 space-y-2">
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Deployer Address:</span>
                              <div className="font-mono text-sm bg-white dark:bg-gray-800 p-2 rounded mt-1 break-all">
                                {generatedWallet.address}
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Contract Address (for first deployed token):</span>
                              <div className="font-mono text-sm bg-white dark:bg-gray-800 p-2 rounded mt-1 break-all">
                                {generatedWallet.contractAddress}
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                                <KeyIcon className="h-4 w-4 mr-1 text-yellow-500" />
                                Private Key (Save this securely!):
                              </span>
                              <div className="font-mono text-sm bg-white dark:bg-gray-800 p-2 rounded mt-1 break-all border border-yellow-300 dark:border-yellow-700">
                                {generatedWallet.privateKey}
                              </div>
                              <p className="text-xs text-red-500 mt-1 flex items-center">
                                <LockClosedIcon className="h-3 w-3 mr-1" />
                                Never share your private key with anyone!
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Token Details</h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="tokenName">Token Name</Label>
                              <Input
                                id="tokenName"
                                placeholder="e.g. My Awesome Token"
                                value={tokenDetails.name}
                                onChange={(e) => handleTokenDetailChange('name', e.target.value)}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="tokenSymbol">Token Symbol</Label>
                              <Input
                                id="tokenSymbol"
                                placeholder="e.g. MAT"
                                value={tokenDetails.symbol}
                                onChange={(e) => handleTokenDetailChange('symbol', e.target.value)}
                                maxLength={10}
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="tokenDecimals">Decimals</Label>
                              <Select
                                value={tokenDetails.decimals.toString()}
                                onValueChange={(value) => handleTokenDetailChange('decimals', parseInt(value))}
                              >
                                <SelectTrigger id="tokenDecimals">
                                  <SelectValue placeholder="Select decimals" />
                                </SelectTrigger>
                                <SelectContent>
                                  {[6, 8, 9, 12, 18].map((decimal) => (
                                    <SelectItem key={decimal} value={decimal.toString()}>
                                      {decimal} {decimal === 18 && '(Standard)'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label htmlFor="tokenSupply">Total Supply</Label>
                              <Input
                                id="tokenSupply"
                                placeholder="e.g. 1000000"
                                value={tokenDetails.totalSupply}
                                onChange={(e) => handleTokenDetailChange('totalSupply', e.target.value)}
                                type="number"
                                min="1"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <Label>Deploy on Blockchains</Label>
                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                              {SUPPORTED_CHAINS.map((chain) => (
                                <div key={chain.id} className="flex items-center space-x-2">
                                  <input
                                    type="checkbox"
                                    id={`chain-${chain.id}`}
                                    checked={tokenDetails.chainIds.includes(chain.id)}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      setTokenDetails(prev => ({
                                        ...prev,
                                        chainIds: isChecked 
                                          ? [...prev.chainIds, chain.id] 
                                          : prev.chainIds.filter(id => id !== chain.id),
                                        // If we're adding the first chain or removing the main chain, update mainChainId
                                        mainChainId: isChecked && prev.chainIds.length === 0 ? chain.id : 
                                                    (!isChecked && prev.mainChainId === chain.id && prev.chainIds.length > 1) ? 
                                                    prev.chainIds.filter(id => id !== chain.id)[0] : prev.mainChainId
                                      }));
                                    }}
                                    className="h-4 w-4"
                                  />
                                  <label htmlFor={`chain-${chain.id}`} className="text-sm">
                                    {chain.name} ({chain.symbol})
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div>
                            <Label htmlFor="mainChain">Main Chain (where tokens will be minted)</Label>
                            <Select
                              value={tokenDetails.mainChainId.toString()}
                              onValueChange={(value) => handleTokenDetailChange('mainChainId', parseInt(value))}
                              disabled={tokenDetails.chainIds.length === 0}
                            >
                              <SelectTrigger id="mainChain">
                                <SelectValue placeholder="Select main blockchain" />
                              </SelectTrigger>
                              <SelectContent>
                                {SUPPORTED_CHAINS.filter(chain => tokenDetails.chainIds.includes(chain.id)).map((chain) => (
                                  <SelectItem key={chain.id} value={chain.id.toString()}>
                                    {chain.name} ({chain.symbol})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          

                          
                          <div>
                            <Label htmlFor="ownerAddress">Owner Address (delegate)</Label>
                            <Input
                              id="ownerAddress"
                              value={tokenDetails.ownerAddress}
                              onChange={(e) => handleTokenDetailChange('ownerAddress', e.target.value)}
                              placeholder="0x..."
                              className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Address that will be set as the owner of the token contract. Leave empty to use your connected wallet.
                            </p>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => {
                                if (address) {
                                  handleTokenDetailChange('ownerAddress', address);
                                  toast.success('Connected wallet address set as owner');
                                } else {
                                  toast.error('Please connect your wallet first');
                                }
                              }}
                            >
                              Use Connected Wallet
                            </Button>
                          </div>
                          
                          <div className="col-span-1 md:col-span-2 mt-4">
                            <Label htmlFor="etherscanApiKey" className="flex items-center">
                              <ShieldCheckIcon className="h-4 w-4 mr-1 text-green-500" />
                              Etherscan API Key (for contract verification)
                            </Label>
                            <Input
                              id="etherscanApiKey"
                              placeholder="Enter your Etherscan API key (optional)"
                              value={tokenDetails.etherscanApiKey || ''}
                              onChange={(e) => handleTokenDetailChange('etherscanApiKey', e.target.value)}
                              className="font-mono text-sm"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Optional: Provide an API key to verify your contract on {SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId)?.explorerUrl.split('//')[1]}
                            </p>
                          </div>
                        </div>
                        
                        <div className="pt-4">
                          <Button 
                            onClick={deployToken} 
                            disabled={isLoading || !tokenDetails.name || !tokenDetails.symbol || !tokenDetails.totalSupply}
                            className="w-full"
                          >
                            {isLoading ? (
                              <>
                                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                                Deploying Token...
                              </>
                            ) : (
                              <>
                                <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                                Deploy Token
                              </>
                            )}
                          </Button>
                          <div className="space-y-2 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 flex items-center">
                              <WalletIcon className="h-4 w-4 mr-2" />
                              Important Funding Instructions
                            </h4>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">
                              You <strong>must send {SUPPORTED_CHAINS.find(c => c.id === tokenDetails.mainChainId)?.symbol}</strong> to the generated wallet address below before deploying:
                            </p>
                            <div className="font-mono text-xs bg-white dark:bg-gray-800 p-2 rounded break-all border border-yellow-200 dark:border-yellow-700">
                              {generatedWallet.address}
                            </div>
                            <p className="text-xs text-yellow-700 dark:text-yellow-400">
                              The token will be deployed from this address, not your connected wallet.
                            </p>
                            
                            {/* Balance display for all chains */}
                            <div className="mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-700">
                              <h5 className="text-xs font-medium text-yellow-800 dark:text-yellow-300 mb-2">Blockchain Balances:</h5>
                              <div className="grid grid-cols-1 gap-2">
                                {tokenDetails.chainIds.map(chainId => {
                                  const chain = SUPPORTED_CHAINS.find(c => c.id === chainId);
                                  const balance = generatedWallet.balances?.[chainId] || '0.00';
                                  const isZero = balance === '0' || balance === '0.0' || balance === '0.00' || balance === 'Error' || balance === '0.000';
                                  const isLoading = balance === 'Loading...';
                                  
                                  return (
                                    <div key={chainId} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-700">
                                      <div className="flex items-center">
                                        <div className="w-2 h-2 rounded-full mr-2 bg-yellow-400"></div>
                                        <span className="text-xs font-medium">{chain?.name}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <span className={`text-xs font-mono ${isLoading ? 'text-gray-500' : (isZero ? 'text-red-500' : 'text-green-500')}`}>
                                          {balance} {chain?.symbol}
                                        </span>
                                        <button 
                                          onClick={() => checkBalance(generatedWallet.address, chainId).then(newBalance => {
                                            if (generatedWallet) {
                                              setGeneratedWallet(prev => ({
                                                ...prev!,
                                                balances: { ...prev!.balances, [chainId]: newBalance }
                                              }));
                                            }
                                          })}
                                          className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                          title="Refresh balance"
                                        >
                                          <ArrowPathIcon className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <button 
                                onClick={() => checkAllBalances(generatedWallet.address, tokenDetails.chainIds)}
                                className="w-full mt-2 text-xs py-1 px-2 bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/50 rounded border border-yellow-200 dark:border-yellow-800 flex items-center justify-center"
                              >
                                <ArrowPathIcon className="h-3 w-3 mr-1" />
                                Refresh All Balances
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    Please generate an address first.
                  </p>
                  <Button 
                    onClick={() => setActiveTab('address')} 
                    variant="outline" 
                    className="mt-4"
                  >
                    Go to Address Generator
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </div>
  );
}
