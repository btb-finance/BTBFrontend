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

// Parse error message to extract wait time if it's a "too soon" error
const parseTooSoonError = (errorMessage: string): number | null => {
  // Pattern to match "You need to wait X more seconds" or similar messages
  const waitTimeRegex = /wait\s+(\d+)\s+(?:more\s+)?seconds/i;
  const match = errorMessage.match(waitTimeRegex);
  
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  
  // If we can't parse an exact time, check if it's any kind of "too soon" error
  if (errorMessage.toLowerCase().includes('too soon') || 
      errorMessage.toLowerCase().includes('wait') ||
      errorMessage.toLowerCase().includes('not time yet')) {
    // Return a default wait time of 60 seconds if we can't parse the exact time
    return 60;
  }
  
  return null;
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
    
    // Dynamically estimate required gas instead of using fixed value
    console.log('Estimating gas required for batch processing...');
    let gasLimit;
    try {
      // Estimate gas for this specific transaction
      gasLimit = await contract.estimateGas.processDailyBatch(batchIndex);
      
      // Add 30% buffer to ensure transaction doesn't run out of gas
      gasLimit = gasLimit.mul(130).div(100);
      console.log(`Estimated gas needed: ${gasLimit.toString()} (with 30% buffer)`);
    } catch (error: any) {
      console.warn('Error estimating gas, falling back to default gas limit:', error.message);
      // Fallback to reasonable default if estimation fails
      gasLimit = 50000; 
      console.log(`Using fallback gas limit: ${gasLimit}`);
    }
    
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
    
    // Get network fee data for dynamic gas pricing
    const feeData = await provider.getFeeData();
    
    // Apply multipliers to ensure transactions go through (1.5x for maxFeePerGas and 1.3x for priority fee)
    const maxFeeMultiplier = 1.5;
    const priorityFeeMultiplier = 1.3;
    
    // Calculate gas fees with safety multipliers
    const maxFeePerGas = feeData.maxFeePerGas 
      ? feeData.maxFeePerGas.mul(Math.floor(maxFeeMultiplier * 10)).div(10)
      : gasPrice.mul(2); // Fallback if maxFeePerGas is null
    
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
      ? feeData.maxPriorityFeePerGas.mul(Math.floor(priorityFeeMultiplier * 10)).div(10)
      : gasPrice; // Fallback if maxPriorityFeePerGas is null
    
    // Log the gas prices being used
    console.log(`Using maxFeePerGas: ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} gwei`);
    console.log(`Using maxPriorityFeePerGas: ${ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`);
    
    // Recalculate expected gas cost with new gas prices
    const estimatedGasCost = maxFeePerGas.mul(gasLimit);
    const formattedEstimatedGasCost = ethers.utils.formatEther(estimatedGasCost);
    console.log(`Updated estimated gas cost: ${formattedEstimatedGasCost} ETH`);
    
    // Recheck balance against new gas estimate
    if (balance.lt(estimatedGasCost)) {
      console.error(`Insufficient wallet balance for dynamic gas prices: ${formattedBalance} ETH. Need at least ${formattedEstimatedGasCost} ETH.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Insufficient funds for transaction with current gas prices',
          walletAddress: wallet.address,
          currentBalance: formattedBalance,
          requiredGasCost: formattedEstimatedGasCost,
          hint: "Please send some ETH to the wallet address to cover gas fees."
        })
      };
    }
    
    // Implement retry mechanism with escalating gas parameters
    let tx;
    let receipt;
    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    
    while (!success && attempt < maxRetries) {
      attempt++;
      console.log(`Transaction attempt ${attempt} of ${maxRetries}`);
      
      try {
        // Increase gas parameters on each retry
        const retryMultiplier = 1 + (attempt * 0.25); // Add 25% more gas each retry
        
        // Calculate adjusted gas values for this attempt
        const attemptMaxFeePerGas = maxFeePerGas.mul(Math.floor(retryMultiplier * 10)).div(10);
        const attemptPriorityFeePerGas = maxPriorityFeePerGas.mul(Math.floor(retryMultiplier * 10)).div(10);
        const attemptGasLimit = typeof gasLimit === 'number' 
          ? Math.floor(gasLimit * retryMultiplier)
          : gasLimit.mul(Math.floor(retryMultiplier * 10)).div(10);
        
        console.log(`Attempt ${attempt} - Using multiplier: ${retryMultiplier.toFixed(2)}`);
        console.log(`Gas limit: ${typeof attemptGasLimit === 'number' ? attemptGasLimit : attemptGasLimit.toString()}`);
        console.log(`Max fee: ${ethers.utils.formatUnits(attemptMaxFeePerGas, 'gwei')} gwei`);
        console.log(`Priority fee: ${ethers.utils.formatUnits(attemptPriorityFeePerGas, 'gwei')} gwei`);
        
        // Call the processDailyBatch function with dynamically adjusted gas settings
        tx = await contract.processDailyBatch(batchIndex, {
          gasLimit: attemptGasLimit,
          type: 2, // Use type 2 EIP-1559 transaction
          maxFeePerGas: attemptMaxFeePerGas,
          maxPriorityFeePerGas: attemptPriorityFeePerGas
        });
        
        console.log(`Transaction sent (attempt ${attempt}):`, tx.hash);
        
        // Wait for transaction with increasing timeout on each retry
        const waitTimeoutMs = 60000 * attempt; // 1, 2, 3 minutes based on attempt
        console.log(`Waiting up to ${waitTimeoutMs/1000} seconds for confirmation...`);
        
        // Create a timeout promise
        const timeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), waitTimeoutMs);
        });
        
        // Wait for transaction with timeout
        receipt = await Promise.race([
          tx.wait(),
          timeout
        ]);
        
        // If we get here, transaction was successful
        console.log(`Transaction successful on attempt ${attempt}. Hash:`, receipt.transactionHash);
        success = true;
      } catch (txError: any) {
        console.error(`Transaction attempt ${attempt} failed:`, txError.message);
        
        // Check if this is a "too soon" error
        const waitTimeSeconds = parseTooSoonError(txError.message);
        if (waitTimeSeconds) {
          console.log(`Detected "too soon" error. Need to wait ${waitTimeSeconds} seconds.`);
          
          // If this is the first attempt and we need to wait, let's wait and retry once
          if (attempt === 1 && waitTimeSeconds < 600) { // Only wait if less than 10 minutes
            console.log(`Waiting ${waitTimeSeconds} seconds before retrying...`);
            
            // Wait the specified time plus a small buffer (5 seconds)
            const waitTimeMs = (waitTimeSeconds + 5) * 1000;
            await new Promise(resolve => setTimeout(resolve, waitTimeMs));
            
            console.log('Wait time completed, retrying transaction...');
            // Decrement attempt to retry with same parameters
            attempt--;
            continue;
          } else {
            // If this isn't the first attempt or wait time is too long, inform about the timing issue
            return {
              statusCode: 400,
              body: JSON.stringify({
                message: 'Transaction cannot be processed yet',
                error: 'Too soon to process daily batch',
                waitTimeSeconds: waitTimeSeconds,
                suggestedRetryTime: new Date(Date.now() + (waitTimeSeconds * 1000)).toISOString(),
                hint: "The contract can only be called once every 24 hours. Try again after the suggested retry time."
              })
            };
          }
        } 
        
        // Check specific error conditions
        if (txError.message.includes('timeout') ||
            txError.message.includes('transaction underpriced') ||
            txError.message.includes('replacement fee too low') ||
            txError.message.includes('nonce has already been used')) {
          console.log(`Retrying with higher gas parameters...`);
          // Continue to next attempt
        } else if (txError.message.includes('insufficient funds')) {
          // Fatal error - no point in retrying
          throw txError;
        } else if (attempt >= maxRetries) {
          // Last attempt failed, propagate the error
          throw txError;
        }
        
        // Small delay before retry to allow network conditions to change
        if (attempt < maxRetries) {
          const delayMs = 5000 * attempt; // Increasing delay: 5s, 10s, 15s
          console.log(`Waiting ${delayMs/1000} seconds before retrying...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    if (!success) {
      throw new Error(`Transaction failed after ${maxRetries} attempts`);
    }
    
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
