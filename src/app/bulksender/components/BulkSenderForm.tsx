'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { ethers } from 'ethers';
import bulksenderABI from '../bulksenderabi.json';
import { PaperClipIcon, TrashIcon, XMarkIcon, CheckIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

// Minimal ERC20 ABI for token interactions
const erc20ABI = [
  // balanceOf
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  // decimals
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  // symbol
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  // name
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  },
  // approve
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  // allowance
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" },
      { "name": "_spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  }
];

interface Recipient {
  address: string;
  amount: string;
  error?: string;
}

interface BulkSenderFormProps {
  contractAddress: string;
  isConnected: boolean;
  userAddress?: string;
  connectWallet: () => Promise<void>;
  serviceFee: string;
  maxTransfers: number;
  selectedToken: string;
}

export default function BulkSenderForm({
  contractAddress,
  isConnected,
  userAddress,
  connectWallet,
  serviceFee,
  maxTransfers,
  selectedToken
}: BulkSenderFormProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: '', amount: '' }]);
  const [tokenData, setTokenData] = useState<{
    name: string;
    symbol: string;
    decimals: number;
    balance: string;
  } | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isCheckingAllowance, setIsCheckingAllowance] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [totalAmount, setTotalAmount] = useState('0');
  const [processedAddresses, setProcessedAddresses] = useState<string[]>([]);
  // Use a ref to track processed addresses across renders and state updates
  const processedAddressesRef = useRef<Set<string>>(new Set());
  const [currentBatch, setCurrentBatch] = useState<number>(0);
  const [totalBatches, setTotalBatches] = useState<number>(0);
  const [completedBatches, setCompletedBatches] = useState<number>(0);
  const [totalProcessedCount, setTotalProcessedCount] = useState<number>(0);
  const [autoBatchMode, setAutoBatchMode] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Reset form when selected token changes
  useEffect(() => {
    if (selectedToken) {
      setRecipients([{ address: '', amount: '' }]);
      setIsApproved(false);
      setErrorMessage('');
      setSuccessMessage('');
      setProcessedAddresses([]);
      setCurrentBatch(0);
      setTotalBatches(0);
      setCompletedBatches(0);
      setTotalProcessedCount(0);
      // Reset the ref
      processedAddressesRef.current = new Set();
      // Reset the global counter
      window.originalAddressCount = undefined;
      fetchTokenData();
    } else {
      setTokenData(null);
    }
  }, [selectedToken]);

  // Calculate total amount whenever recipients change
  useEffect(() => {
    if (recipients.length > 0 && tokenData) {
      let total = 0;
      recipients.forEach(recipient => {
        if (recipient.amount && !isNaN(parseFloat(recipient.amount))) {
          total += parseFloat(recipient.amount);
        }
      });
      setTotalAmount(total.toString());
      
      // This will force a re-check of allowance whenever the total amount changes
      // (Allowance check is dependent on totalAmount in another useEffect)
    } else {
      setTotalAmount('0');
    }
  }, [recipients, tokenData]);

  // Check allowance when token data is fetched, user changes, or total amount changes
  useEffect(() => {
    if (tokenData && isConnected && userAddress && selectedToken) {
      checkAllowance();
    }
  }, [tokenData, isConnected, userAddress, selectedToken, totalAmount]);

  // Fetch token data
  const fetchTokenData = async () => {
    if (!selectedToken || !isConnected) return;

    try {
      // Type assertion for ethereum property
      if (!window.ethereum) throw new Error("Ethereum provider not found");
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const tokenContract = new ethers.Contract(selectedToken, erc20ABI, provider);

      const [name, symbol, decimals, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.balanceOf(userAddress)
      ]);

      setTokenData({
        name,
        symbol,
        decimals,
        balance: ethers.formatUnits(balance, decimals)
      });
      
      // Get current network for RPC provider
      let providerUrl = 'https://mainnet.base.org'; // Default to Base Mainnet
      try {
        const network = await provider.getNetwork();
        if (Number(network.chainId) === 84532) {
          providerUrl = 'https://sepolia.base.org'; // Use Base Sepolia provider if on testnet
          console.log('Using Base Sepolia for fee checking');
        }
      } catch (networkError) {
        console.error('Error getting network:', networkError);
      }
      
      // Use the appropriate RPC provider
      const rpcProvider = new ethers.JsonRpcProvider(providerUrl);
      
      // Get current fee
      const bulkSenderContract = new ethers.Contract(contractAddress, bulksenderABI, rpcProvider);
      try {
        // Get both general fee and sender-specific fee
        const [generalFee, senderFee] = await Promise.all([
          bulkSenderContract.feePerBulk(),
          bulkSenderContract.getFeeForSender(userAddress)
        ]);
        
        console.log('General fee per bulk:', ethers.formatEther(generalFee), 'ETH');
        console.log('Fee for this sender:', ethers.formatEther(senderFee), 'ETH');
      } catch (feeError) {
        console.error('Error fetching fee data:', feeError);
      }
    } catch (error) {
      console.error('Error fetching token data:', error);
      setErrorMessage('Error fetching token data. Please try again.');
    }
  };

  // Check if contract is approved to spend tokens
  const checkAllowance = async () => {
    if (!selectedToken || !isConnected || !userAddress || !contractAddress) return;

    try {
      setIsCheckingAllowance(true);
      // Type assertion for ethereum property
      if (!window.ethereum) throw new Error("Ethereum provider not found");
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const tokenContract = new ethers.Contract(selectedToken, erc20ABI, provider);
      
      // Calculate total amount needed for approval
      // If no amount entered yet, use a minimum value for initial check
      const totalAmountWei = ethers.parseUnits(
        totalAmount === '0' ? '1' : totalAmount, 
        tokenData?.decimals || 18
      );
      
      console.log('Checking allowance for:', userAddress, 'to spend', ethers.formatUnits(totalAmountWei, tokenData?.decimals || 18), tokenData?.symbol || 'tokens');
      
      // Check if contract is allowed to spend tokens
      const allowance = await tokenContract.allowance(userAddress, contractAddress);
      console.log('Current allowance:', ethers.formatUnits(allowance, tokenData?.decimals || 18), tokenData?.symbol || 'tokens');
      
      // Set approval state based on whether allowance is greater than or equal to total amount
      const isApprovedResult = allowance >= totalAmountWei;
      console.log('Is approved?', isApprovedResult);
      setIsApproved(isApprovedResult);
      
      setIsCheckingAllowance(false);
    } catch (error) {
      console.error('Error checking allowance:', error);
      setIsCheckingAllowance(false);
    }
  };

  // Approve token spending
  const approveTokens = async () => {
    if (!selectedToken || !isConnected || !tokenData) {
      setErrorMessage('Please connect your wallet and select a token');
      return;
    }

    try {
      setIsApproving(true);
      setErrorMessage('');
      setSuccessMessage('');
      
      if (!window.ethereum) throw new Error("Ethereum provider not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(selectedToken, erc20ABI, signer);
      
      // Approve max uint256 to prevent having to approve again
      const maxUint256 = ethers.MaxUint256;
      console.log('Approving contract to spend tokens. Contract address:', contractAddress);
      
      // Show pending approval message
      setSuccessMessage('Approval pending. Please confirm in your wallet...');
      
      // Submit approval transaction
      const tx = await tokenContract.approve(contractAddress, maxUint256);
      console.log('Approval transaction submitted:', tx.hash);
      
      // Update message to waiting for confirmation
      setSuccessMessage('Approval transaction submitted. Waiting for confirmation...');
      
      // Wait for transaction to be confirmed
      console.log('Approval transaction confirmed:', receipt);
      
      // Verify the allowance was set correctly
      const allowance = await tokenContract.allowance(userAddress, contractAddress);
      console.log('New allowance:', ethers.formatUnits(allowance, tokenData.decimals), tokenData.symbol);
      
      // Set approval state and show success message
      setIsApproved(true);
      setSuccessMessage('Token approval successful!');
      setIsApproving(false);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
    } catch (error: unknown) {
      console.error('Error approving tokens:', error);
      let errorMsg = 'Error approving tokens. Please try again.';
      
      // Extract user-friendly error message
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        if (error.message.includes('user rejected')) {
          errorMsg = 'You rejected the approval transaction.';
        }
      }
      
      setErrorMessage(errorMsg);
      setSuccessMessage('');
      setIsApproving(false);
    }
  };

  // Send tokens to multiple recipients
  const sendTokens = async () => {
    if (!isConnected || !selectedToken || !tokenData) {
      setErrorMessage('Please connect your wallet and select a token');
      return;
    }

    if (!validateRecipients()) {
      setErrorMessage('Please fix the errors in your recipient list');
      return;
    }

    // For large lists, we'll automatically handle in batches
    if (recipients.length > 300) {
      // Use fixed batch size of 300 as requested
      const batchSize = 300;
      
      // Calculate initial total addresses if not set yet
      if (totalBatches === 0) {
        // This is the first time we're processing the list
        // Set the originalTotal for future reference
        const originalTotal = recipients.length;
        window.originalAddressCount = originalTotal;
        console.log(`Setting original address count to ${originalTotal}`);
      }
      
      // Get the original total (if set) or current total
      const originalTotal = window.originalAddressCount || recipients.length;
      
      // Calculate batch info based on fixed batch size and filtered recipients
      // Use our ref for the most up-to-date list of processed addresses
      const remainingToProcess = recipients.filter(recipient => 
        !processedAddressesRef.current.has(recipient.address.toLowerCase())
      ).length;
      
      console.log(`Original total: ${originalTotal}, Already processed: ${processedAddressesRef.current.size}, Actually remaining: ${remainingToProcess}`);
      
      // Calculate total batches needed based on remaining unprocessed addresses
      const batchesNeededForRemaining = Math.ceil(remainingToProcess / batchSize);
      const totalBatchesNeeded = completedBatches + batchesNeededForRemaining;
      const startingBatch = completedBatches;
      
      // Set batch information
      setTotalBatches(totalBatchesNeeded);
      
      // Set current batch to the next one we're processing
      setCurrentBatch(startingBatch + 1);
      
      console.log(`Processing batch ${startingBatch + 1}/${totalBatchesNeeded} with batch size of ${batchSize}`);
      
      // Update message to indicate batch processing
      // Use the remainingToProcess count for accurate display
      setSuccessMessage(`Batch ${startingBatch + 1}/${totalBatchesNeeded}: Processing ${Math.min(batchSize, remainingToProcess)} of ${originalTotal} total addresses (${processedAddressesRef.current.size} already processed)...`);
    }
    
    // Force an approval check before proceeding
    await checkAllowance();
    
    if (!isApproved) {
      setErrorMessage('You need to approve the contract to spend your tokens first');
      return;
    }

    try {
      setIsSending(true);
      setErrorMessage('');
      
      if (!window.ethereum) throw new Error("Ethereum provider not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Determine which network we're on
      const network = await provider.getNetwork();
      const networkName = Number(network.chainId) === 84532 ? 'Base Sepolia Testnet' : 'Base Mainnet';
      console.log(`Sending transaction on ${networkName}`);
      
      const bulkSenderContract = new ethers.Contract(contractAddress, bulksenderABI, signer);
      
      // Set batch size to 300 as requested
      const optimalBatchSize = 300;
      
      // Debug info: Check if any addresses have already been processed
      if (processedAddresses.length > 0) {
        console.log(`Already processed ${processedAddresses.length} unique addresses before this batch`);
        
        // Check for duplicates in current batch
        const currentAddressSet = new Set(processedAddresses.map(addr => addr.toLowerCase()));
        const duplicateCount = recipients.filter(r => 
          currentAddressSet.has(r.address.toLowerCase())
        ).length;
        
        console.log(`Found ${duplicateCount} addresses in current batch that were already processed`);
      }
        
      if (recipients.length > 500) {
        // For large lists, log that we're using the defined batch size
        console.log(`Large recipient list detected (${recipients.length} addresses). Using batch size of ${optimalBatchSize}`);
      }
      
      // Prepare arrays for bulk transfer
      // Use our ref for reliable tracking of processed addresses
      console.log(`Using ref with ${processedAddressesRef.current.size} processed addresses`);
      
      // Filter out any addresses that were already processed in previous batches
      const filteredRecipients = recipients.filter(recipient => 
        !processedAddressesRef.current.has(recipient.address.toLowerCase())
      );
      
      console.log(`Filtered out ${recipients.length - filteredRecipients.length} already processed addresses`);
      
      // If we have more recipients than optimal batch size, only use the first batch
      const recipientsToProcess = filteredRecipients.length > optimalBatchSize 
        ? filteredRecipients.slice(0, optimalBatchSize) 
        : filteredRecipients;
      
      const addresses = recipientsToProcess.map(r => r.address);
      const amounts = recipientsToProcess.map(r => ethers.parseUnits(r.amount, tokenData.decimals));
      
      // Get fee for this sender specifically
      const fee = await bulkSenderContract.getFeeForSender(userAddress);
      console.log('Fee for bulk transfer:', ethers.formatEther(fee), 'ETH');
      
      // Execute bulk transfer with the fee included as ETH value in the transaction
      const tx = await bulkSenderContract.bulkTransfer(
        selectedToken,
        addresses,
        amounts,
        { value: fee }
      );
      
      // Show pending message
      setSuccessMessage(`Transaction pending on ${networkName}...`);
      
      // Wait for transaction confirmation
      console.log('Transaction confirmed:', receipt);
      
      // Generate explorer link based on network
      const explorerBaseUrl = network.chainId === 84532 
        ? 'https://sepolia.basescan.org/tx/' 
        : 'https://basescan.org/tx/';
      
      const explorerLink = `${explorerBaseUrl}${tx.hash}`;
      console.log('Transaction explorer link:', explorerLink);
      
      setSuccessMessage(
        `Tokens sent successfully! View on explorer: ${explorerLink}`
      );
      
      // Get the processed addresses for this batch
      const processedBatchAddresses = addresses.map(addr => addr.toLowerCase());
      
      // Immediately update our ref for the next batch
      processedBatchAddresses.forEach(addr => {
        processedAddressesRef.current.add(addr.toLowerCase());
      });
      
      console.log(`Updated processedAddressesRef with all processed addresses, total: ${processedAddressesRef.current.size}`);
      
      // Also update the state (for display purposes)
      // Use a Set to ensure uniqueness and convert back to array
      setProcessedAddresses(prev => {
        // Create a complete Set of all processed addresses
        const allProcessedAddresses = new Set([
          ...prev.map(addr => addr.toLowerCase()),
          ...processedBatchAddresses
        ]);
        
        // Convert the Set back to an array
        const uniqueAddresses = Array.from(allProcessedAddresses);
        
        console.log(`Total unique addresses processed: ${uniqueAddresses.length}`);
        console.log(`Added ${uniqueAddresses.length - prev.length} new addresses`);
        
        return uniqueAddresses;
      });
      
      // Increment the completed batches counter
      setCompletedBatches(prev => prev + 1);
      
      // Update the total processed count using the actual size of the processedAddresses Set
      // This ensures we're not double-counting addresses
      const updatedProcessedAddresses = new Set([
        ...processedAddresses.map(addr => addr.toLowerCase()),
        ...addresses.map(addr => addr.toLowerCase())
      ]);
      setTotalProcessedCount(updatedProcessedAddresses.size);
      
      // We're using the optimalBatchSize defined above
      
      // If we processed a subset of recipients, remove the processed ones and prepare for next batch
      if (recipients.length > 0) {
        // Use our ref which is up-to-date with all processed addresses
        // This solves the race condition with React state updates
        console.log(`Using ref with ${processedAddressesRef.current.size} processed addresses for filtering`);
        
        // Create a copy of the Set for this scope
        const allProcessedAddresses = new Set(processedAddressesRef.current);
        
        // Filter original recipients list to find ones we haven't processed yet
        const remainingRecipients = recipients.filter(recipient => 
          !allProcessedAddresses.has(recipient.address.toLowerCase())
        );
        
        console.log(`Removed ${recipients.length - remainingRecipients.length} processed addresses from the list`);
        console.log(`Total unique addresses processed so far: ${allProcessedAddresses.size}`);
        
        const nextBatch = currentBatch + 1;
        
        // Get original total from window object or use initial value
        const originalTotal = window.originalAddressCount || (processedAddresses.length + recipients.length);
        
        // Calculate total batches needed based on actual remaining addresses
        // Next batch number is completedBatches + 1
        const nextCompletedBatches = completedBatches + 1;
        const batchesForRemaining = remainingRecipients.length > 0 ? Math.ceil(remainingRecipients.length / 300) : 0;
        
        // For the first batch, we need to calculate the total number of batches required
        // for the entire operation, which is based on the total number of addresses
        // For subsequent batches, we use the already calculated totalBatches value
        let totalBatchesNeeded;
        
        if (completedBatches === 0) {
          // First batch - calculate total based on all addresses (processed + remaining)
          const totalAddresses = processedAddressesRef.current.size + remainingRecipients.length;
          totalBatchesNeeded = Math.ceil(totalAddresses / 300);
          console.log(`First batch: Total addresses: ${totalAddresses}, Total batches needed: ${totalBatchesNeeded}`);
        } else {
          // Use existing totalBatches but ensure it's at least the number of completed batches
          totalBatchesNeeded = Math.max(totalBatches, nextCompletedBatches);
          console.log(`Subsequent batch: Using existing total batches: ${totalBatchesNeeded}`);
        }
        
        console.log(`Completed ${completedBatches + 1} batches, need ${batchesForRemaining} more for remaining ${remainingRecipients.length} addresses`);
        
        // Update batch counters
        setCurrentBatch(nextBatch);
        setTotalBatches(totalBatchesNeeded);
        
        // Update recipients list
        setRecipients(remainingRecipients);
        
        // Calculate overall progress percentage based on the nextCompletedBatches we defined above
        // Ensure percentage never exceeds 100%
        const completedPercentage = Math.min(100, Math.round((nextCompletedBatches / totalBatchesNeeded) * 100));
        
        // Calculate total processed count for display (avoid duplicates)
        const nextTotalProcessed = allProcessedAddresses.size;
        
        // Notify user about remaining recipients and batch progress
        setSuccessMessage(
          `✅ Batch ${nextCompletedBatches}/${totalBatchesNeeded} completed successfully! (${completedPercentage}% complete) ` +
          `Processed ${addresses.length} addresses in this batch. ` +
          `${remainingRecipients.length} unique addresses remaining. ` +
          `Total unique addresses processed: ${processedAddressesRef.current.size}. ` +
          `${autoBatchMode && remainingRecipients.length > 0 ? 'Next batch will start automatically in 3 seconds...' : 'Click Send Tokens again to process the next batch.'}`
        );
        
        // If auto-batch mode is enabled, automatically send the next batch after a short delay
        if (autoBatchMode && remainingRecipients.length > 0) {
          const timeoutId = setTimeout(() => {
            sendTokens(); // This will process the next batch
          }, 3000); // Wait 3 seconds before sending next batch
          
          // Return timeout ID for cleanup (can be used to cancel if needed)
          return timeoutId;
        }
      } else if (recipients.length === 0) {
        // All recipients processed, capture the final count from our ref
        const finalProcessedCount = processedAddressesRef.current.size;
        
        // Reset form
        setRecipients([{ address: '', amount: '' }]);
        setProcessedAddresses([]);
        setCurrentBatch(0);
        setTotalBatches(0);
        setCompletedBatches(0);
        setTotalProcessedCount(0);
        
        // Show completion message before resetting the ref
        setSuccessMessage(`🎉 All ${finalProcessedCount} unique addresses processed successfully! Transaction complete.`);
        
        // Reset the ref and global counter
        processedAddressesRef.current = new Set();
        window.originalAddressCount = undefined;
      } else if (Array.isArray(recipients) && recipients.length > 0) {
        // Get unprocessed recipients
        const remainingRecipients = recipients.filter(recipient => 
          !processedAddressesRef.current.has(recipient.address.toLowerCase())
        );
        // Update recipients with the remaining ones
        setRecipients(remainingRecipients);
        setSuccessMessage(`✅ Batch completed! ${remainingRecipients.length} addresses remaining.`);
      }
      
      // Check token balance again
      await fetchTokenData();
      
      setIsSending(false);

      // Clear success message after 10 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 10000);
    } catch (error: unknown) {
      console.error('Error sending tokens:', error);
      
      // Try to extract error message if available
      let errorMsg = 'Error sending tokens. Please check your balances and try again.';
      if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        if (error.message.includes('insufficient funds')) {
          errorMsg = 'Insufficient ETH to pay the transaction fee.';
        } else if (error.message.includes('user rejected')) {
          errorMsg = 'Transaction was rejected.';
        } else if (error.message.includes('InsufficientETH')) {
          errorMsg = `Insufficient ETH sent to cover the service fee. Please try again.`;
        }
      }
      
      setErrorMessage(errorMsg);
      setIsSending(false);
    }
  };

  // Add a new recipient row
  const addRecipient = () => {
    setRecipients([...recipients, { address: '', amount: '' }]);
  };

  // Remove a recipient
  const removeRecipient = (index: number) => {
    if (recipients.length <= 1) return;
    const newRecipients = [...recipients];
    newRecipients.splice(index, 1);
    setRecipients(newRecipients);
  };

  // Update recipient address or amount
  const updateRecipient = (index: number, field: 'address' | 'amount', value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = { ...newRecipients[index], [field]: value };
    
    // Validate the recipient
    newRecipients[index].error = validateRecipient(newRecipients[index]);
    
    setRecipients(newRecipients);
  };

  // Validate a single recipient
  const validateRecipient = (recipient: Recipient): string | undefined => {
    if (!recipient.address) return 'Address is required';
    if (!ethers.isAddress(recipient.address)) return 'Invalid address';
    if (!recipient.amount) return 'Amount is required';
    if (isNaN(parseFloat(recipient.amount)) || parseFloat(recipient.amount) <= 0)
      return 'Amount must be a positive number';
    return undefined;
  };

  // Validate all recipients
  const validateRecipients = (): boolean => {
    const newRecipients = recipients.map(recipient => ({
      ...recipient,
      error: validateRecipient(recipient)
    }));
    
    setRecipients(newRecipients);
    return newRecipients.every(r => !r.error);
  };

  // Clear all recipients
  const clearAll = () => {
    setRecipients([{ address: '', amount: '' }]);
  };

  // Handle file upload for CSV
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    console.log("File selected:", file.name, "size:", file.size);
    
    // First check file size
    const MAX_FILE_SIZE_MB = 10; // 10MB max file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setErrorMessage('');
    setSuccessMessage('Processing file...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      console.log("File content length:", content.length);
      
      // Try to detect the newline character used
      let newlineChar = '\n';
      if (content.includes('\r\n')) {
        newlineChar = '\r\n';
      } else if (content.includes('\r')) {
        newlineChar = '\r';
      }
      
      console.log("Using newline character:", newlineChar === '\n' ? "\\n" : newlineChar === '\r' ? "\\r" : "\\r\\n");
      
      // Split content into lines
      const lines = content.split(newlineChar).filter(line => line.trim());
      console.log(`File contains ${lines.length} non-empty lines`);
      
      // Handle direct pasting of addresses without any delimiter
      // If we have a single line and it's very long, try to extract addresses from it
      if (lines.length === 1 && lines[0].length > 100 && lines[0].includes('0x')) {
        console.log("Detected potential list of addresses in a single line");
        
        // Try to extract all ETH addresses from the input
        const ethAddresses = lines[0].match(/0x[a-fA-F0-9]{40}/g);
        
        if (ethAddresses && ethAddresses.length > 0) {
          console.log(`Found ${ethAddresses.length} ETH addresses in the input`);
          
          // Create artificial lines with one address per line
          const artificialLines = ethAddresses.map(addr => addr);
          
          // Process these lines instead
          setTimeout(() => {
            processCSVContent(artificialLines);
          }, 100);
          return;
        }
      }
      
      // Show warning for very large files
      if (lines.length > 1000) {
        console.warn(`Processing a very large file with ${lines.length} lines. This may take a moment.`);
        setSuccessMessage(`Processing ${lines.length} lines. This may take a moment...`);
      }
      
      // Parse CSV content in batches to prevent UI freezing
      setTimeout(() => {
        processCSVContent(lines);
      }, 100);
    };
    
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // State for equal distribution mode
  const [equalDistributionMode, setEqualDistributionMode] = useState(false);
  const [equalAmount, setEqualAmount] = useState('');
  
  // Process CSV content in batches to handle very large files
  const processCSVContent = (lines: string[]) => {
    try {
      // Parse CSV content - supporting different formats
      const newRecipients: Recipient[] = [];
      let invalidCount = 0;
      
      // Detect format by examining the first non-empty line
      let hasHeader = false;
      let delimiter = ','; // Default to comma
      let format = 'simple'; // Default format: address,amount
      
      // Log the first few lines to debug
      console.log("First few lines of CSV:", lines.slice(0, 5));
      
      // Try to auto-detect format from first few lines
      for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        console.log(`Analyzing line ${i}:`, line);
        
        // Check for Etherscan export format (tab or multiple spaces between columns)
        if (line.includes('HolderAddress') || 
            (line.includes('Quantity') || line.includes('Balance') || line.includes('PendingBalanceUpdate'))) {
          console.log("Detected potential Etherscan format");
          hasHeader = true;
          format = 'etherscan';
          
          // Determine delimiter
          if (line.includes('\t')) {
            delimiter = '\t';
            console.log("Using tab delimiter");
          } else if (/\s{2,}/.test(line)) {
            // For space-delimited, we'll split on multiple spaces
            delimiter = 'multispace';
            console.log("Using multispace delimiter");
          } else {
            delimiter = ',';
            console.log("Using comma delimiter for Etherscan format");
          }
          break;
        }
        
        // Check for simple CSV with header
        if (line.toLowerCase().includes('address') || 
            line.toLowerCase().includes('wallet') || 
            line.toLowerCase().includes('holder')) {
          console.log("Detected simple CSV with header");
          hasHeader = true;
          format = 'simple';
          break;
        }
        
        // Check if line looks like an ETH address (simple heuristic)
        if (line.includes('0x') && line.length >= 40) {
          console.log("Detected line with ETH address, assuming simple format");
          format = 'simple';
          // Don't break - continue checking other lines for headers
        }
      }
      
      console.log(`Detected format: ${format}, delimiter: ${delimiter}, hasHeader: ${hasHeader}`);
      setSuccessMessage(`Detected format: ${format}. Processing...`);
      
      // Process in smaller batches
      const BATCH_SIZE = 5000;
      const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
      let currentBatch = 0;
      
      const processNextBatch = () => {
        if (currentBatch >= totalBatches) {
          // All batches processed
          finalizeImport(newRecipients, invalidCount, lines.length);
          
          // If we have recipients and not in equal distribution mode, ask if user wants to use it
          if (newRecipients.length > 0 && !equalDistributionMode) {
            const shouldUseEqualDistribution = window.confirm(
              `Do you want to distribute an equal amount of tokens to all ${newRecipients.length} addresses? ` +
              `If yes, click OK and you'll be prompted to enter the amount. ` +
              `If no, click Cancel to use the amounts from your CSV file.`
            );
            
            if (shouldUseEqualDistribution) {
              const amount = window.prompt(`Enter the amount to send to each of the ${newRecipients.length} addresses:`, '100');
              if (amount !== null) {
                setEqualDistributionMode(true);
                setEqualAmount(amount);
                
                // Update all recipients with the same amount
                const updatedRecipients = newRecipients.map(r => ({
                  ...r,
                  amount: amount
                }));
                
                setRecipients(updatedRecipients);
                setSuccessMessage(`Set ${amount} tokens for each of the ${newRecipients.length} addresses.`);
              }
            }
          }
          
          return;
        }
        
        const start = currentBatch * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, lines.length);
        
        // Update progress message
        setSuccessMessage(`Processing batch ${currentBatch + 1}/${totalBatches}...`);
        
        // Process this batch
        for (let i = start; i < end; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Skip header row if detected
          if (i === 0 && hasHeader) continue;
          
          let address = '';
          let amount = '0';
          
          console.log(`Processing line: "${line}"`);
          
          // First try to extract any Ethereum address from the line
          const ethAddressMatch = line.match(/0x[a-fA-F0-9]{40}/);
          if (ethAddressMatch) {
            // We found an Ethereum address in the line
            address = ethAddressMatch[0];
            console.log(`Found ETH address: ${address}`);
            
            // Now try to find an amount based on the format
            if (format === 'etherscan') {
              let parts: string[] = [];
              
              if (delimiter === 'multispace') {
                // Split on multiple spaces
                parts = line.split(/\s{2,}/).filter(p => p.trim());
                console.log("Multispace parts:", parts);
              } else if (delimiter === '\t') {
                // Split on tabs
                parts = line.split('\t').filter(p => p.trim());
                console.log("Tab parts:", parts);
              } else {
                // Split on commas
                parts = line.split(',').map(p => p.trim());
                console.log("Comma parts:", parts);
              }
              
              // Find the index of the address in the parts
              const addressIndex = parts.findIndex(part => part.includes(address));
              if (addressIndex !== -1 && addressIndex + 1 < parts.length) {
                // Try to extract a numeric amount from the next column
                const rawAmount = parts[addressIndex + 1].trim();
                // Remove any non-numeric characters except decimal point
                amount = rawAmount.replace(/[^\d.]/g, '');
                console.log(`Found amount: ${amount} from raw: ${rawAmount}`);
              } else if (parts.length >= 2) {
                // Just take the second column as amount
                const rawAmount = parts[1].trim();
                amount = rawAmount.replace(/[^\d.]/g, '');
                console.log(`Using second column amount: ${amount}`);
              } else {
                // Default amount
                amount = '0';
                console.log("Using default amount: 0");
              }
            } else {
              // Simple format - try to find a number in the line
              const parts = line.split(/[,\s]+/).map(p => p.trim()).filter(p => p);
              console.log("Simple parts:", parts);
              
              // Find the index of the address
              const addressIndex = parts.findIndex(part => part.includes(address));
              
              // Look for a number in the parts
              let foundAmount = false;
              for (let i = 0; i < parts.length; i++) {
                if (i !== addressIndex && !isNaN(parseFloat(parts[i]))) {
                  amount = parts[i];
                  foundAmount = true;
                  console.log(`Found numeric amount: ${amount}`);
                  break;
                }
              }
              
              if (!foundAmount) {
                // Default amount
                amount = '0';
                console.log("No amount found, using default: 0");
              }
            }
          } else {
            // No Ethereum address found directly, try splitting the line
            console.log("No ETH address found directly. Trying to split line.");
            
            if (format === 'etherscan') {
              let parts: string[] = [];
              
              if (delimiter === 'multispace') {
                parts = line.split(/\s{2,}/).filter(p => p.trim());
              } else if (delimiter === '\t') {
                parts = line.split('\t').filter(p => p.trim());
              } else {
                parts = line.split(',').map(p => p.trim());
              }
              
              console.log("Split parts:", parts);
              
              if (parts.length >= 2) {
                // Try the first part as address
                address = parts[0].trim();
                
                // And second part as amount
                const rawAmount = parts[1].trim();
                amount = rawAmount.replace(/[^\d.]/g, '');
                
                console.log(`Trying address: ${address}, amount: ${amount}`);
              }
            } else {
              // Simple CSV format: address,amount or just address
              const parts = line.split(/[,\s]+/).filter(p => p.trim());
              console.log("Simple split parts:", parts);
              
              if (parts.length >= 2) {
                // First part is likely address
                address = parts[0].trim();
                
                // Second part is likely amount
                amount = parts[1].trim();
                console.log(`From simple split - address: ${address}, amount: ${amount}`);
              } else if (parts.length === 1) {
                // Single part - check if it looks like an address
                const part = parts[0].trim();
                if (part.startsWith('0x') && part.length >= 40) {
                  address = part;
                  amount = '0';
                  console.log(`Single part address: ${address}`);
                }
              }
            }
          }
          
          // Only add if we have a valid address
          if (address && ethers.isAddress(address)) {
            newRecipients.push({
              address,
              amount,
              error: undefined
            });
          } else {
            invalidCount++;
            console.warn(`Skipping invalid address: ${address}`);
          }
        }
        
        // Schedule next batch
        currentBatch++;
        setTimeout(processNextBatch, 0);
      };
      
      // Start processing
      processNextBatch();
      
    } catch (error) {
      console.error('Error processing CSV:', error);
      setErrorMessage('Error processing CSV file.');
      setSuccessMessage('');
    }
  };
  
  // Finalize the import after all batches are processed
  const finalizeImport = (recipients: Recipient[], invalidCount: number, totalLines: number) => {
    if (recipients.length > 0) {
      console.log(`Finalizing import of ${recipients.length} valid addresses`);
      
      // Remove duplicates by address
      const uniqueAddresses = new Map<string, Recipient>();
      recipients.forEach(r => {
        // Only keep the last occurrence of each address
        uniqueAddresses.set(r.address.toLowerCase(), r);
      });
      
      console.log(`After removing duplicates: ${uniqueAddresses.size} addresses`);
      
      // Success message without warnings about transaction limits
      setSuccessMessage(`Successfully imported ${uniqueAddresses.size} addresses (${invalidCount} invalid addresses skipped out of ${totalLines} total lines).`);
      
      // Sort by address to make it easier to verify
      const sortedRecipients = Array.from(uniqueAddresses.values()).sort((a, b) => 
        a.address.toLowerCase().localeCompare(b.address.toLowerCase())
      );
      
      // Update the recipients state
      setRecipients(sortedRecipients);
      
      // Clear success message after 10 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 10000);
    } else {
      console.error('No valid addresses found in the parsed data');
      setErrorMessage('No valid addresses found in the file. Please check your data format.');
      setSuccessMessage('');
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Bulk Token Sender</h3>
        
        {/* Token Info */}
        {selectedToken && tokenData ? (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Selected Token</p>
                <p className="text-lg font-bold">{tokenData.name} ({tokenData.symbol})</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Balance</p>
                <p className="text-lg font-bold">{parseFloat(tokenData.balance).toFixed(4)} {tokenData.symbol}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-center text-gray-700 dark:text-gray-300">
              Please select a token to continue
            </p>
          </div>
        )}
        
        {/* Error message */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex items-start">
            <ExclamationCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <p>{errorMessage}</p>
          </div>
        )}
        
        {/* Success message */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 flex items-start">
            <CheckIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <p>{successMessage}</p>
          </div>
        )}
        
        {/* Recipients Form */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Recipients</label>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center"
              >
                <PaperClipIcon className="w-4 h-4 mr-1" />
                Import Addresses (CSV or List)
              </Button>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                className="flex items-center"
              >
                <TrashIcon className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
          
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 mb-2 px-2">
            <div className="col-span-6 text-sm font-medium text-gray-700 dark:text-gray-300">Address</div>
            <div className="col-span-5 text-sm font-medium text-gray-700 dark:text-gray-300">Amount</div>
            <div className="col-span-1"></div>
          </div>
          
          {/* Equal distribution option */}
          <div className="mb-4 flex items-center space-x-2 p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
            <input
              type="checkbox"
              id="equalDistribution"
              checked={equalDistributionMode}
              onChange={(e) => {
                setEqualDistributionMode(e.target.checked);
                
                if (e.target.checked && recipients.length > 0) {
                  // Ask for the amount when enabling
                  const amount = window.prompt(`Enter the amount to send to each of the ${recipients.length} addresses:`, equalAmount || '100');
                  if (amount !== null) {
                    setEqualAmount(amount);
                    
                    // Update all recipients with the same amount
                    const updatedRecipients = recipients.map(r => ({
                      ...r,
                      amount: amount
                    }));
                    
                    setRecipients(updatedRecipients);
                    setSuccessMessage(`Set ${amount} tokens for each of the ${recipients.length} addresses.`);
                  } else {
                    // User cancelled, revert checkbox
                    setEqualDistributionMode(false);
                  }
                }
              }}
              className="h-4 w-4 text-btb-primary rounded border-gray-300 focus:ring-btb-primary dark:bg-gray-700 dark:border-gray-600"
            />
            <label htmlFor="equalDistribution" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Equal distribution (same amount to all addresses)
            </label>
            
            {equalDistributionMode && (
              <div className="flex items-center ml-4">
                <label htmlFor="equalAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                  Amount:
                </label>
                <input
                  type="text"
                  id="equalAmount"
                  value={equalAmount}
                  onChange={(e) => {
                    setEqualAmount(e.target.value);
                    
                    // Update all recipients with the new amount
                    const updatedRecipients = recipients.map(r => ({
                      ...r,
                      amount: e.target.value
                    }));
                    
                    setRecipients(updatedRecipients);
                  }}
                  className="w-24 px-2 py-1 border rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="100"
                />
              </div>
            )}
          </div>
          
          {/* Auto-process batches option */}
          <div className="mb-2 p-3 border border-blue-200 dark:border-blue-800 rounded-md bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoBatchMode"
                checked={autoBatchMode}
                onChange={(e) => setAutoBatchMode(e.target.checked)}
                className="h-4 w-4 text-btb-primary rounded border-gray-300 focus:ring-btb-primary dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="autoBatchMode" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                Auto-process all batches (automatically sends the next batch after each successful transaction)
              </label>
            </div>
            {autoBatchMode && recipients.length > maxTransfers && (
              <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 pl-6">
                <p>✓ Auto-batch mode is enabled - the system will automatically process all {Math.ceil(recipients.length / maxTransfers)} batches</p>
                <p>✓ You'll be prompted to confirm each transaction in your wallet</p>
                <p>✓ There will be a 3-second delay between batches to allow for confirmations</p>
              </div>
            )}
          </div>
      
          {/* Batch progress indicator - show when processing multiple batches */}
          {totalBatches > 0 && (
            <div className="mb-4 p-3 border border-blue-200 dark:border-blue-800 rounded-md bg-blue-50 dark:bg-blue-900/20">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                  Batch Progress: {completedBatches}/{totalBatches}
                </span>
                {totalBatches > 0 && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {Math.round((completedBatches / totalBatches) * 100)}% Complete
                  </span>
                )}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${totalBatches > 0 ? Math.round((completedBatches / totalBatches) * 100) : 0}%` }}
                ></div>
              </div>
              
              <div className="mt-2 flex flex-col gap-1">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">{processedAddressesRef.current.size || totalProcessedCount}</span> unique addresses processed, 
                  <span className="font-medium"> {
                    recipients.filter(r => !processedAddressesRef.current.has(r.address.toLowerCase())).length
                  }</span> remaining
                  <span> (total: <span className="font-medium">{window.originalAddressCount || recipients.length}</span>)</span>
                </p>
                
                {recipients.length > 500 && (
                  <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-500">
                    <p className="font-medium">⚠️ Large Batch Notice:</p>
                    <p>• Processing {window.originalAddressCount || recipients.length} addresses in batches of 300</p>
                    <p>• Each batch will require a separate transaction confirmation</p>
                    <p>• Progress shown is based on actual completed transactions</p>
                    <p>• Please ensure your wallet has enough ETH for gas fees</p>
                  </div>
                )}
              </div>
            </div>
          )}
      
          {/* Recipients rows */}
          <div className="max-h-80 overflow-y-auto mb-4">
            {recipients.map((recipient, index) => {
              const isProcessed = processedAddresses.includes(recipient.address.toLowerCase());
              
              return (
                <div key={index} className={`grid grid-cols-12 gap-2 mb-2 ${isProcessed ? 'opacity-50' : ''}`}>
                  <div className="col-span-6">
                    <div className="relative">
                      <input
                        type="text"
                        value={recipient.address}
                        onChange={(e) => updateRecipient(index, 'address', e.target.value)}
                        placeholder="0x..."
                        className={`w-full px-3 py-2 border rounded-md ${recipient.error && recipient.error.includes('address') ? 'border-red-500 dark:border-red-700' : isProcessed ? 'border-green-500 dark:border-green-700' : 'border-gray-300 dark:border-gray-700'} ${isProcessed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-800'} text-gray-900 dark:text-white`}
                        disabled={isProcessed}
                      />
                      {isProcessed && (
                        <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                          <CheckIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
                        </div>
                      )}
                      {recipient.error && recipient.error.includes('address') && (
                        <p className="text-red-500 dark:text-red-400 text-xs mt-1">{recipient.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={recipient.amount}
                      onChange={(e) => {
                        // If in equal distribution mode, update the amount for all recipients
                        if (equalDistributionMode) {
                          setEqualAmount(e.target.value);
                          const updatedRecipients = recipients.map(r => ({
                            ...r,
                            amount: e.target.value
                          }));
                          setRecipients(updatedRecipients);
                        } else {
                          // Otherwise just update this recipient
                          updateRecipient(index, 'amount', e.target.value);
                        }
                      }}
                      placeholder="Amount"
                      disabled={equalDistributionMode || isProcessed}
                      className={`w-full px-3 py-2 border rounded-md 
                        ${recipient.error && recipient.error.includes('Amount') ? 'border-red-500 dark:border-red-700' : 
                          isProcessed ? 'border-green-500 dark:border-green-700' : 
                          'border-gray-300 dark:border-gray-700'} 
                        ${isProcessed ? 'bg-green-50 dark:bg-green-900/20' : 
                          equalDistributionMode ? 'bg-gray-100 dark:bg-gray-700' : 
                          'bg-white dark:bg-gray-800'} 
                        text-gray-900 dark:text-white`}
                    />
                    {recipient.error && recipient.error.includes('Amount') && (
                      <p className="text-red-500 dark:text-red-400 text-xs mt-1">{recipient.error}</p>
                    )}
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    {!isProcessed && (
                      <button 
                        onClick={() => removeRecipient(index)} 
                        className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                        disabled={recipients.length <= 1}
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Add more button */}
          <div className="flex flex-col space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addRecipient}
              className="w-full"
            >
              + Add Recipient
            </Button>
            
            {recipients.length > 100 && (
              <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800">
                <strong>Note:</strong> You have {recipients.length} recipients. The system will automatically handle processing them in batches.
              </div>
            )}
          </div>
        </div>
        
        {/* Summary and Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Recipients</p>
              <div className="flex items-center">
                <p className="text-lg font-bold mr-2">{recipients.length}</p>
                {recipients.length > 1 && (
                  <button
                    onClick={() => {
                      const addressList = recipients.map(r => r.address).join('\n');
                      navigator.clipboard.writeText(addressList);
                      // Show temporary alert
                      setSuccessMessage(`Copied ${recipients.length} addresses to clipboard`);
                      setTimeout(() => {
                        setSuccessMessage('');
                      }, 3000);
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Copy All
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Amount</p>
              <p className="text-lg font-bold">{totalAmount} {tokenData?.symbol || ''}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Service Fee</p>
              <p className="text-lg font-bold">{serviceFee} ETH</p>
            </div>
          </div>
          
          {!isConnected ? (
            <Button 
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white" 
              size="lg"
              onClick={connectWallet}
            >
              Connect Wallet
            </Button>
          ) : !selectedToken ? (
            <Button 
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white" 
              size="lg"
              disabled
            >
              Select a Token
            </Button>
          ) : !isApproved ? (
            <Button 
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white" 
              size="lg"
              onClick={approveTokens}
              disabled={isApproving || isCheckingAllowance}
            >
              {isApproving ? 'Approving...' : isCheckingAllowance ? 'Checking Allowance...' : 'Approve Tokens'}
            </Button>
          ) : (
            <Button 
              className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white" 
              size="lg"
              onClick={sendTokens}
              disabled={isSending || recipients.length === 0 || totalAmount === '0'}
            >
              {isSending ? 'Sending...' : 'Send Tokens'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}