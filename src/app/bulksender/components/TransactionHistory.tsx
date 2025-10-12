'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import bulksenderABI from '../bulksenderabi.json';
import { DocumentTextIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface Transaction {
  hash: string;
  timestamp: number;
  token: string;
  tokenSymbol?: string;
  recipients: number;
  blockNumber: number;
}

interface TransactionHistoryProps {
  isConnected: boolean;
  userAddress?: string;
}

export default function TransactionHistory({ isConnected, userAddress }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenSymbols, setTokenSymbols] = useState<Record<string, string>>({});

  // ERC20 interface for getting token symbols
  const tokenABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [{ "name": "", "type": "string" }],
      "type": "function"
    }
  ];

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchTransactionHistory();
    } else {
      setTransactions([]);
      setIsLoading(false);
    }
  }, [isConnected, userAddress]);

  const fetchTransactionHistory = async () => {
    if (!userAddress) return;

    setIsLoading(true);
    try {
      // Get current network
      let currentChainId = 8453; // Default to Base Mainnet
      let providerUrl = 'https://mainnet.base.org'; // Default to Base Mainnet
        
      if (typeof window.ethereum !== 'undefined') {
        try {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const network = await web3Provider.getNetwork();
          currentChainId = network.chainId;
          
          if (currentChainId === 84532) {
            providerUrl = 'https://sepolia.base.org'; // Use Base Sepolia provider if on testnet
            console.log('Using Base Sepolia for transaction history');
          } else {
            console.log('Using Base Mainnet for transaction history');
          }
        } catch (error) {
          console.error('Error determining network:', error);
        }
      }
        
      // Use appropriate provider based on current network
      const provider = new ethers.JsonRpcProvider(providerUrl);
      
      // Get the contract instance
      const bulkSenderContract = '0xb636bEc2F6a035123445d148d06B2A2401Ce72C5';
      
      // We need to fetch actual transaction history
      // The best way is to filter for BulkTransfer events from the contract for this user
      
      // Check recent blocks for events
      const currentBlock = await provider.getBlockNumber();
      
      // Filter for bulk transfer events
      // Since we don't have a specific event for BulkTransfer in the ABI,
      // we'll need to use the provider's transaction history methods
      
      // Note: JsonRpcProvider doesn't have getHistory method directly
      // We'll use getTransactionReceipt for previously known transactions
      // As a workaround, let's get a list of transactions via custom approach

      // This is a simplified implementation since the original code relies on 
      // a non-standard provider method
      const latestBlockNumber = await provider.getBlockNumber();
      const searchFromBlock = Math.max(0, latestBlockNumber - 1000); // Last 1000 blocks
      
      // Get the most recent blocks
      const blocks = await Promise.all(
        Array.from({ length: 5 }, (_, i) => provider.getBlockWithTransactions(latestBlockNumber - i))
      );
      
      // Filter transactions related to the user address
      const history = blocks
        .flatMap(block => block.transactions)
        .filter(tx => 
          tx.from?.toLowerCase() === userAddress?.toLowerCase() || 
          tx.to?.toLowerCase() === userAddress?.toLowerCase()
        );
      
      // Filter for transactions to the bulkSender contract
      const relevantTxs = history.filter(tx => 
        tx.to?.toLowerCase() === bulkSenderContract.toLowerCase()
      );
      
      console.log(`Found ${relevantTxs.length} transactions to the bulk sender contract`);
      
      // Process each transaction to get details
      const processedTxs: Transaction[] = [];
      const symbols: Record<string, string> = {};
      
      for (const tx of relevantTxs) {
        try {
          // Get transaction receipt to check if it was successful
          const receipt = await provider.getTransactionReceipt(tx.hash);
          if (!receipt || !receipt.status) continue; // Skip failed transactions
          
          // Get block for timestamp
          const block = await provider.getBlock(receipt.blockNumber);
          
          // For each transaction, we need to decode the input data to find token and recipient count
          // This is complex without proper event parsing
          // For now, let's just use a simplified approach and extract what we can
          
          // Try to decode the function call
          const iface = new ethers.utils.Interface(bulksenderABI);
          let decodedData;
          let token = '';
          let recipientCount = 0;
          
          try {
            // Make sure tx.data exists and is a string
            if (tx.data && typeof tx.data === 'string') {
              decodedData = iface.parseTransaction({ data: tx.data });
              if (decodedData.name === 'bulkTransfer' && Array.isArray(decodedData.args)) {
                // Type safety for the decoded args
                token = decodedData.args[0]?.toString() || ''; // First arg should be token address
                recipientCount = Array.isArray(decodedData.args[1]) ? decodedData.args[1].length : 0; // Second arg should be recipients array
              }
            }
          } catch (decodeError) {
            console.error('Error decoding transaction:', decodeError);
            continue; // Skip if we can't decode
          }
          
          if (!token) continue; // Skip if we couldn't extract token
          
          // Get token symbol
          if (!symbols[token]) {
            try {
              const tokenContract = new ethers.Contract(token, tokenABI, provider);
              symbols[token] = await tokenContract.symbol();
            } catch (symbolError) {
              console.error(`Error fetching symbol for token ${token}:`, symbolError);
              symbols[token] = 'UNKNOWN';
            }
          }
          
          processedTxs.push({
            hash: tx.hash,
            timestamp: block.timestamp * 1000, // Convert to milliseconds
            token,
            recipients: recipientCount,
            blockNumber: receipt.blockNumber
          });
        } catch (error) {
          console.error(`Error processing transaction ${tx.hash}:`, error);
        }
      }
      
      // If we didn't find any transactions but want to display something for testing
      if (processedTxs.length === 0) {
        console.log('No transactions found. Show empty state instead of mock data.');
      }
      
      setTransactions(processedTxs);
      setTokenSymbols(symbols);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const shortenAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Generate explorer URL based on the current network
  const getExplorerUrl = (txHash: string) => {
    // Try to determine which network we're on based on the provider
    let explorerBaseUrl = 'https://basescan.org/tx/'; // Default to Base Mainnet
    
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        // Check if we can access chainId directly from window.ethereum
        if (window.ethereum.chainId) {
          const chainId = parseInt(window.ethereum.chainId, 16);
          if (chainId === 84532) {
            explorerBaseUrl = 'https://sepolia.basescan.org/tx/';
          }
        }
      } catch (error) {
        console.error('Error determining chain ID from window.ethereum:', error);
      }
    }
    
    return `${explorerBaseUrl}${txHash}`;
  };

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-btb-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading transactions...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No transaction history found</p>
          <p className="text-xs mt-2">Try testing on Base Sepolia first!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.hash} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tokenSymbols[tx.token] || 'Unknown'} Transfer</span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                      {tx.recipients} recipients
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(tx.timestamp)}</p>
                </div>
                <a 
                  href={getExplorerUrl(tx.hash)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-btb-primary hover:text-btb-primary-dark"
                >
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </a>
              </div>
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex justify-between items-center">
                  <div>
                    <p>Token: {shortenAddress(tx.token)}</p>
                    <p>Tx: {shortenAddress(tx.hash)}</p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigator.clipboard.writeText(tx.hash);
                      // Show temporary copy confirmation
                      const target = e.target as HTMLElement;
                      const originalText = target.innerText;
                      target.innerText = 'Copied!';
                      setTimeout(() => {
                        target.innerText = originalText;
                      }, 1500);
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Copy TX
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}