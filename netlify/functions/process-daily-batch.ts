import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ethers } from 'ethers';
import subscriptionJackpotABI from '../../src/app/contracts/megapot/subscriptionjackpotabi.json';

// Contract address on Base mainnet
const SUBSCRIPTION_JACKPOT_ADDRESS = '0x92C1fce71847cd68a794A3377741b372F392b25a';

// Calculate today's batch index (always 0 for daily processing)
const calculateBatchIndex = (): number => {
  return 0;
}

// Extended event interface with isScheduled property
interface ScheduledEvent extends HandlerEvent {
  isScheduled?: boolean;
}

// Check if the current time is within our allowed processing window
const isWithinProcessingWindow = (): boolean => {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  
  // Allow processing if it's 1:00 PM - 1:15 PM UTC (13:00-13:15)
  return hour === 13 && minute >= 0 && minute <= 15;
}

const handler: Handler = async (event: ScheduledEvent, context: HandlerContext) => {
  // For manual testing via GET request, always allow
  // For scheduled runs, check if we're in the processing window
  if (event.httpMethod !== 'GET' && !event.isScheduled) {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }
  
  // For scheduled events, ensure we're in the processing window
  if (event.isScheduled && !isWithinProcessingWindow()) {
    console.log('Scheduled event outside processing window. Skipping.');
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Scheduled event outside processing window. Skipping.',
        currentTimeUTC: new Date().toISOString()
      })
    };
  }

  try {
    // Initialize provider with Base mainnet RPC URL
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
    
    // Initialize wallet with private key from environment variable
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
    
    // Check wallet balance before proceeding
    const balance = await wallet.getBalance();
    const formattedBalance = ethers.utils.formatEther(balance);
    console.log(`Wallet ${wallet.address} balance: ${formattedBalance} ETH`);
    
    // Lower minimum required gas threshold based on actual usage (21,000 gas)
    const minGasRequired = ethers.utils.parseEther("0.00005"); // 0.00005 ETH is plenty for this tx
    
    if (balance.lt(minGasRequired)) {
      console.error(`Insufficient wallet balance: ${formattedBalance} ETH. Need at least 0.00005 ETH for gas.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Insufficient funds for transaction',
          walletAddress: wallet.address,
          currentBalance: formattedBalance,
          minRequired: "0.00005 ETH",
          hint: "Please send some ETH to the wallet address to cover gas fees."
        })
      };
    }
    
    // Create contract instance
    const contract = new ethers.Contract(
      SUBSCRIPTION_JACKPOT_ADDRESS,
      subscriptionJackpotABI,
      wallet
    );

    // First check if we need to process batches at all
    const allBatchesProcessed = await contract.allBatchesProcessed().catch((error: any) => {
      console.log("Error checking if all batches processed:", error.message);
      return false;
    });

    // If all batches are already processed, no need to continue
    if (allBatchesProcessed) {
      console.log('All batches are already processed. No action needed.');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'All batches are already processed. No action needed.'
        })
      };
    }

    // Calculate the batch index for today
    const batchIndex = calculateBatchIndex();
    console.log('Processing daily batch with index:', batchIndex);
    
    // Check if this batch is already processed
    const isBatchProcessed = await contract.batchProcessed(batchIndex).catch((error: any) => {
      console.log(`Error checking if batch ${batchIndex} is processed:`, error.message);
      return false;
    });

    if (isBatchProcessed) {
      console.log(`Batch ${batchIndex} is already processed. Skipping.`);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `Batch ${batchIndex} is already processed. Skipping.`
        })
      };
    }
    
    // Use a gas limit based on actual usage (21,000) with a small buffer
    const gasLimit = 25000; // Just slightly over the 21,000 observed
    
    // Get current gas price from provider
    const gasPrice = await provider.getGasPrice();
    
    // Calculate total gas cost with current gas price
    const gasCost = gasPrice.mul(gasLimit);
    const formattedGasCost = ethers.utils.formatEther(gasCost);
    console.log(`Estimated gas cost with current gas price: ${formattedGasCost} ETH`);
    
    // Double check we have enough balance
    if (balance.lt(gasCost)) {
      console.error(`Insufficient wallet balance: ${formattedBalance} ETH. Need at least ${formattedGasCost} ETH for gas.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Insufficient funds for transaction',
          walletAddress: wallet.address,
          currentBalance: formattedBalance,
          requiredGasCost: formattedGasCost,
          hint: "Please send some ETH to the wallet address to cover gas fees."
        })
      };
    }
    
    // Call the processDailyBatch function with optimized gas settings
    const tx = await contract.processDailyBatch(batchIndex, {
      gasLimit: gasLimit,
      // Use type 2 EIP-1559 transaction
      type: 2,
      // Base fee actual usage showed 0.00080988 Gwei, use slightly higher
      maxFeePerGas: ethers.utils.parseUnits("0.0021", "gwei"), // Max fee from observed tx
      // Priority fee was 0.0011 Gwei in observed tx
      maxPriorityFeePerGas: ethers.utils.parseUnits("0.0011", "gwei") // Same as observed tx
    });
    
    console.log('Transaction sent:', tx.hash);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    console.log('Transaction successful. Hash:', receipt.transactionHash);
    
    // Calculate total cost including L1 and L2 fees
    const totalCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const formattedTotalCost = ethers.utils.formatEther(totalCost);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Daily batch processed successfully',
        batchIndex: batchIndex,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei',
        totalCost: formattedTotalCost + ' ETH'
      })
    };
  } catch (error: any) {
    console.error('Error processing daily batch:', error);
    
    // Check if this is due to insufficient funds
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('insufficient funds')) {
      // Extract the wallet address
      let walletAddress = '';
      try {
        if (error.transaction && error.transaction.from) {
          walletAddress = error.transaction.from;
        }
      } catch (e) {}
      
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Insufficient funds for transaction',
          error: 'The wallet does not have enough ETH to cover gas costs',
          walletAddress: walletAddress,
          hint: "Please send some more ETH to the wallet address. Try at least 0.0001 ETH.",
          rawError: errorMessage
        })
      };
    }
    
    // Check if this is due to "execution reverted"
    if (errorMessage.includes('execution reverted')) {
      // Try to get more detailed error message
      let detailedError = errorMessage;
      
      try {
        if (error.error && error.error.body) {
          const body = JSON.parse(error.error.body);
          if (body.error && body.error.message) {
            detailedError = body.error.message;
          }
        }
      } catch (parseError) {
        console.error('Error parsing error body:', parseError);
      }
      
      console.log('Contract execution reverted:', detailedError);
      
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Contract execution reverted',
          error: detailedError,
          possibleReasons: [
            'Batch may have already been processed',
            'Contract may be paused',
            'No subscribers to process'
          ]
        })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing daily batch',
        error: errorMessage,
        transactionData: error.transaction || 'No transaction data available'
      })
    };
  }
};

export { handler };
