'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DocumentDuplicateIcon, 
  ArrowPathIcon, 
  ShieldCheckIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { Button, MotionButton } from '@/app/components/ui/button';
import { Card, MotionCard, CardContent } from '@/app/components/ui/card';
import { useWallet } from '@/app/context/WalletContext';
import { ethers } from 'ethers';
import bulksenderABI from './bulksenderabi.json';
import useNetworkSwitcher from '@/app/hooks/useNetworkSwitcher';
import BulkSenderForm from './components/BulkSenderForm';
import TransactionHistory from './components/TransactionHistory';
import TokenSelector from './components/TokenSelector';

// Contract addresses for different networks
const CONTRACT_ADDRESSES: {[chainId: number]: string} = {
  // Base Mainnet
  8453: '0xA5c55020dc1D2c7F9C7be3C32c93ae00F0d5690b',
  // Base Sepolia testnet
  84532: '0xb636bEc2F6a035123445d148d06B2A2401Ce72C5'
};

// Default to Base Mainnet for initial rendering
const DEFAULT_CONTRACT_ADDRESS = '0xA5c55020dc1D2c7F9C7be3C32c93ae00F0d5690b';

// Features of the Bulk Sender
const bulkSenderFeatures = [
  {
    title: 'Efficient Batch Transactions',
    description: 'Send tokens to multiple recipients in a single transaction, saving on gas fees and time.',
    icon: ArrowsRightLeftIcon,
    color: 'from-blue-500 to-blue-700',
    highlight: true
  },
  {
    title: 'Support for Any ERC20 Token',
    description: 'Compatible with any standard ERC20 token across supported networks.',
    icon: BanknotesIcon,
    color: 'from-green-500 to-teal-600'
  },
  {
    title: 'Scalable Distribution',
    description: 'Distribute tokens to hundreds of addresses in just a few clicks.',
    icon: UserGroupIcon,
    color: 'from-purple-500 to-indigo-600',
    highlight: true
  },
  {
    title: 'Multi-Format CSV Import',
    description: 'Import from CSV, Etherscan exports or any address list and distribute tokens equally or by custom amounts.',
    icon: DocumentDuplicateIcon,
    color: 'from-amber-500 to-orange-600',
    highlight: true
  },
  {
    title: 'Transaction Verification',
    description: 'Real-time verification and confirmation of all transactions.',
    icon: ShieldCheckIcon,
    color: 'from-indigo-500 to-blue-600'
  },
  {
    title: 'Low Fees',
    description: 'Minimal service fees to keep your token distribution cost-efficient.',
    icon: CurrencyDollarIcon,
    color: 'from-pink-500 to-rose-600',
    highlight: true
  }
];

export default function BulkSenderPage() {
  const { isConnected, address, connectWallet } = useWallet();
  const { switchNetwork } = useNetworkSwitcher();
  const [isLoading, setIsLoading] = useState(false);
  const [currentFee, setCurrentFee] = useState<string>('0');
  const [maxTransfers, setMaxTransfers] = useState<number>(0);
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [showHistory, setShowHistory] = useState(false);
  const [contractAddress, setContractAddress] = useState<string>(DEFAULT_CONTRACT_ADDRESS);

  // Fetch contract data
  useEffect(() => {
    const fetchContractData = async () => {
      try {
        // Get current network
        let currentChainId = 8453; // Default to Base Mainnet
        
        if (typeof window.ethereum !== 'undefined') {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const network = await web3Provider.getNetwork();
          currentChainId = network.chainId;
        }
        
        // Use appropriate provider based on current network
        let providerUrl = 'https://mainnet.base.org'; // Default to Base Mainnet
        
        if (currentChainId === 84532) {
          providerUrl = 'https://sepolia.base.org'; // Use Base Sepolia provider if on testnet
        }
        
        const provider = new ethers.JsonRpcProvider(providerUrl);
        
        // Use appropriate contract address based on the network
        const networkContractAddress = CONTRACT_ADDRESSES[currentChainId] || DEFAULT_CONTRACT_ADDRESS;
        setContractAddress(networkContractAddress);
        
        const contract = new ethers.Contract(networkContractAddress, bulksenderABI, provider);
        
        // Get fee per bulk
        const fee = await contract.feePerBulk();
        setCurrentFee(ethers.formatEther(fee));
        
        // Get max transfers
        const max = await contract.maxTransfersPerBulk();
        setMaxTransfers(maxNumber();
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching contract data:', error);
        setIsLoading(false);
      }
    };

    fetchContractData();
  }, []);

  // Network switching
  useEffect(() => {
    if (isConnected && typeof window.ethereum !== 'undefined') {
      try {
        const checkNetwork = async () => {
          // Add type guard
          if (!window.ethereum) return;
          
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          
          // Check if the network is either Base Mainnet (8453) or Base Sepolia (84532)
          const isBaseNetwork = network.chainId === 8453 || network.chainId === 84532;
          
          if (!isBaseNetwork) {
            // Default to Base Mainnet if not on any Base network
            switchNetwork('BASE'); // Silently switch
          }
        };
        
        checkNetwork();
        
        // Listen for chain changes
        const handleChainChanged = () => {
          checkNetwork();
        };
        
        window.ethereum.on('chainChanged', handleChainChanged);
        
        return () => {
          if (window.ethereum?.removeListener) {
            window.ethereum.removeListener('chainChanged', handleChainChanged);
          }
        };
      } catch (error) {
        console.error('Network check error:', error);
      }
    }
  }, [isConnected, switchNetwork]);

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/10 dark:from-btb-primary/5 dark:to-btb-primary-light/5"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12">
            <div className="w-full lg:w-1/2">
              <motion.h1 
                className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-gray-900 dark:text-white mb-4 md:mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                Bulk Token <span className="text-btb-primary">Sender</span>
              </motion.h1>
              <motion.p 
                className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-6 md:mb-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                Efficiently distribute any ERC20 token to multiple recipients in a single transaction. Save on gas fees and time with our bulk token sender.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {!isConnected ? (
                  <MotionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-btb-primary hover:bg-btb-primary-dark text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg"
                    onClick={handleConnectWallet}
                  >
                    Connect Wallet
                  </MotionButton>
                ) : (
                  <MotionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-btb-primary hover:bg-btb-primary-dark text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg"
                    onClick={() => document.getElementById('bulk-sender')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Start Sending
                  </MotionButton>
                )}
              </motion.div>
            </div>
            <div className="w-full lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-btb-primary to-btb-primary-light rounded-2xl opacity-20 blur-xl"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
                  <div className="p-6 md:p-8">
                    <div className="flex items-center justify-center mb-6">
                      <ArrowsRightLeftIcon className="w-10 h-10 text-btb-primary mr-3" />
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Sender Info</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Service Fee</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{currentFee} ETH</p>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg text-center">
                        <p className="text-gray-600 dark:text-gray-400 text-sm">Max Recipients</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-white">{maxTransfers}</p>
                      </div>
                    </div>
                    <Button
                      className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                      size="lg"
                      onClick={() => document.getElementById('bulk-sender')?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Contract Verification Section */}
      <section className="py-4 md:py-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-center md:justify-between">
            <div className="flex items-center mb-3 md:mb-0">
              <ShieldCheckIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-sm md:text-base font-medium text-gray-800 dark:text-gray-200">Contract Verified & Audited</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex space-x-2">
                <a 
                  href="https://basescan.org/address/0xA5c55020dc1D2c7F9C7be3C32c93ae00F0d5690b" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm flex items-center px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Base Mainnet
                </a>
                <a 
                  href={`https://sepolia.basescan.org/address/0xb636bEc2F6a035123445d148d06B2A2401Ce72C5`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm flex items-center px-3 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Base Sepolia
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Key Features</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Why use our bulk sender tool</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {bulkSenderFeatures.map((feature, index) => (
              <MotionCard
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className={`border ${feature.highlight ? 'border-btb-primary/30' : 'border-gray-200 dark:border-gray-700'} overflow-hidden h-full`}
              >
                <div className="p-6 h-full flex flex-col">
                  <div className={`w-12 h-12 rounded-lg mb-4 flex items-center justify-center bg-gradient-to-br ${feature.color}`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-700 dark:text-gray-300 flex-grow">{feature.description}</p>
                </div>
              </MotionCard>
            ))}
          </div>
        </div>
      </section>

      {/* Bulk Sender Form Section */}
      <section id="bulk-sender" className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Bulk Token Sender</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Send tokens to multiple addresses in a single transaction</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
            <div className="lg:col-span-4 order-2 lg:order-1">
              <TokenSelector 
                isConnected={isConnected}
                selectedToken={selectedToken}
                setSelectedToken={setSelectedToken}
                connectWallet={handleConnectWallet}
              />
              
              <div className="mt-6">
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Transaction History</h3>
                    <div className="flex justify-between items-center">
                      <p className="text-gray-700 dark:text-gray-300">View your recent bulk sending transactions</p>
                      <Button 
                        variant="outline"
                        onClick={() => setShowHistory(!showHistory)}
                      >
                        {showHistory ? 'Hide History' : 'Show History'}
                      </Button>
                    </div>
                    
                    {showHistory && (
                      <div className="mt-4">
                        <TransactionHistory 
                          isConnected={isConnected}
                          userAddress={address || undefined}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="lg:col-span-8 order-1 lg:order-2">
              <BulkSenderForm 
                contractAddress={contractAddress}
                isConnected={isConnected}
                userAddress={address || undefined}
                connectWallet={handleConnectWallet}
                serviceFee={currentFee}
                maxTransfers={maxTransfers}
                selectedToken={selectedToken}
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 md:py-16 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">How It Works</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Simple steps to distribute tokens in bulk</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              {
                icon: <ArrowsRightLeftIcon className="w-12 h-12 text-btb-primary" />,
                title: "Select Token",
                description: "Choose which ERC20 token you want to distribute."
              },
              {
                icon: <UserGroupIcon className="w-12 h-12 text-btb-primary" />,
                title: "Add Recipients",
                description: "Add recipient addresses and amounts manually or import from CSV."
              },
              {
                icon: <ShieldCheckIcon className="w-12 h-12 text-btb-primary" />,
                title: "Approve Tokens",
                description: "Approve the contract to handle your tokens for the distribution."
              },
              {
                icon: <ArrowPathIcon className="w-12 h-12 text-btb-primary" />,
                title: "Send Transaction",
                description: "Confirm and send your bulk transfer in a single transaction."
              }
            ].map((step, index) => (
              <MotionCard
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div className="p-6 text-center">
                  <div className="flex justify-center mb-4">{step.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
                  <p className="text-gray-700 dark:text-gray-300">{step.description}</p>
                </div>
              </MotionCard>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Frequently Asked Questions</h2>
            <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Everything you need to know about the Bulk Sender</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              {[
                {
                  question: "What tokens can I send with this tool?",
                  answer: "You can send any standard ERC20 token on the supported networks (currently Base Mainnet and Base Sepolia testnet)."
                },
                {
                  question: "How many addresses can I send to at once?",
                  answer: `You can send to up to ${maxTransfers} addresses in a single transaction.`
                },
                {
                  question: "What is the service fee?",
                  answer: `There is a small service fee of ${currentFee} ETH per bulk transaction.`
                },
                {
                  question: "Can I send different amounts to each address?",
                  answer: "Yes, you can specify a different amount for each recipient address."
                },
                {
                  question: "How do I format the CSV file for import?",
                  answer: "Your CSV should have two columns: the first for recipient addresses and the second for amounts. No headers are needed. For example: 0x123...,100"
                },
                {
                  question: "Is there a limit to how many tokens I can send?",
                  answer: "No, there's no limit to the total token amount, only to the number of recipients per transaction."
                }
              ].map((faq, index) => (
                <MotionCard
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{faq.question}</h3>
                    <p className="text-gray-700 dark:text-gray-300">{faq.answer}</p>
                  </div>
                </MotionCard>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-gradient-to-r from-btb-primary to-btb-primary-light text-white">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 md:mb-6">Ready to Distribute Tokens?</h2>
            <p className="text-lg md:text-xl mb-6 md:mb-8">Save gas and time by sending tokens to multiple addresses in a single transaction.</p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <MotionButton
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-btb-primary hover:bg-gray-100 font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg shadow-lg"
                onClick={() => document.getElementById('bulk-sender')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Start Sending
              </MotionButton>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}