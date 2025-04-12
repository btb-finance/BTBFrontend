import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ethers } from 'ethers';
import subscriptionJackpotABI from '../../src/app/contracts/megapot/subscriptionjackpotabi.json';

// Contract address on Base mainnet
const SUBSCRIPTION_JACKPOT_ADDRESS = '0x92C1fce71847cd68a794A3377741b372F392b25a';

// Calculate today's batch index (always 0 for daily processing)
const calculateBatchIndex = (): number => {
  return 0;
}

// Check and calculate the next valid processing time
const getNextProcessingTime = async (contract: ethers.Contract): Promise<{
  lastBatchTimestamp: number;
  processingInterval: number;
  nextValidTime: Date;
  canProcessNow: boolean;
  secondsUntilNextValid: number;
}> => {
  try {
    // Get the timestamp of the last batch processing
    const lastBatchTimestamp = await contract.lastBatchTimestamp();
    
    // Get the required interval between processing (likely 24 hours = 86400 seconds)
    const processingInterval = await contract.PROCESSING_INTERVAL();
    
    // Calculate the next valid processing time
    const nextValidTimestamp = lastBatchTimestamp.add(processingInterval).toNumber() * 1000; // Convert to JS timestamp
    const nextValidTime = new Date(nextValidTimestamp);
    
    // Check if we can process now
    const now = Date.now();
    const canProcessNow = now >= nextValidTimestamp;
    const secondsUntilNextValid = canProcessNow ? 0 : Math.ceil((nextValidTimestamp - now) / 1000);
    
    return {
      lastBatchTimestamp: lastBatchTimestamp.toNumber(),
      processingInterval: processingInterval.toNumber(),
      nextValidTime,
      canProcessNow,
      secondsUntilNextValid
    };
  } catch (error) {
    console.error('Error getting next processing time:', error);
    throw error;
  }
};

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

// Function to process the batch with precise timing
const processBatchWithPreciseTiming = async (
  contract: ethers.Contract,
  wallet: ethers.Wallet,
  provider: ethers.providers.JsonRpcProvider,
): Promise<{
  success: boolean;
  result: any;
}> => {
  try {
    // Get next processing time information
    const processingTimeInfo = await getNextProcessingTime(contract);
    
    // If we can process now, proceed immediately
    if (processingTimeInfo.canProcessNow) {
      console.log('Processing time reached. Proceeding with transaction...');
      return processBatch(contract, wallet, provider);
    }
    
    // Calculate how long to wait
    const waitTimeMs = processingTimeInfo.secondsUntilNextValid * 1000;
    
    // Only wait if it's less than 10 minutes
    if (waitTimeMs > 10 * 60 * 1000) {
      console.log(`Wait time too long (${processingTimeInfo.secondsUntilNextValid} seconds). Try again later.`);
      return {
        success: false,
        result: {
          message: 'Wait time too long',
          nextValidTime: processingTimeInfo.nextValidTime.toISOString(),
          secondsRemaining: processingTimeInfo.secondsUntilNextValid
        }
      };
    }
    
    // Log that we're waiting for the exact processing time
    console.log(`Waiting exactly ${processingTimeInfo.secondsUntilNextValid} seconds until processing time...`);
    
    // Wait until exact processing time (plus 1 second buffer)
    await new Promise(resolve => setTimeout(resolve, waitTimeMs + 1000));
    
    console.log('Wait complete. Proceeding with transaction...');
    
    // Process the batch
    return processBatch(contract, wallet, provider);
    
  } catch (error) {
    console.error('Error in precise timing processing:', error);
    return {
      success: false,
      result: {
        message: 'Error during precise timing processing',
        error: String(error)
      }
    };
  }
};

// Extract batch processing logic to a separate function
const processBatch = async (
  contract: ethers.Contract,
  wallet: ethers.Wallet,
  provider: ethers.providers.JsonRpcProvider,
  testGasOnly: boolean = false
): Promise<{
  success: boolean;
  result: any;
}> => {
  try {
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
        success: true,
        result: {
          message: `Batch ${batchIndex} is already processed. Skipping.`
        }
      };
    }
    
    // Dynamically estimate required gas
    console.log('Estimating gas required for batch processing...');
    let gasLimit;
    try {
      // Estimate gas for this specific transaction
      gasLimit = await contract.estimateGas.processDailyBatch(batchIndex);
      
      // Use exact estimated gas with no buffer
      console.log(`Using exact estimated gas: ${gasLimit.toString()}`);
    } catch (error: any) {
      console.error('Error estimating gas - cannot proceed without accurate estimate:', error.message);
      return {
        success: false,
        result: {
          message: 'Failed to estimate gas for transaction',
          error: error.message || String(error)
        }
      };
    }
    
    // Get current gas price from provider
    const gasPrice = await provider.getGasPrice();
    
    // Get network fee data for dynamic gas pricing
    const feeData = await provider.getFeeData();
    
    // Use minimum gas fees possible - we're not in a hurry
    // Base fee is the minimum required, no need for premium
    const maxFeePerGas = feeData.lastBaseFeePerGas || gasPrice;
    
    // Use minimal priority fee - just enough to be included eventually
    // On Base, even 0.01 gwei is often enough since it's not congested
    const minPriorityFee = ethers.utils.parseUnits("0.01", "gwei");
    const maxPriorityFeePerGas = minPriorityFee;
    
    // Log the minimal gas prices being used
    console.log(`Using minimal maxFeePerGas: ${ethers.utils.formatUnits(maxFeePerGas, 'gwei')} gwei (base fee only)`);
    console.log(`Using minimal maxPriorityFeePerGas: ${ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei')} gwei`);
    
    // Calculate estimated transaction cost
    const estimatedGasCost = maxFeePerGas.mul(gasLimit);
    const formattedEstimatedGasCost = ethers.utils.formatEther(estimatedGasCost);
    console.log(`Estimated transaction cost: ${formattedEstimatedGasCost} ETH`);
    
    // If this is a gas test only, return the gas estimates without sending transaction
    if (testGasOnly) {
      return {
        success: true,
        result: {
          message: 'Gas estimation test completed successfully',
          gasEstimates: {
            gasLimit: gasLimit.toString(),
            maxFeePerGas: ethers.utils.formatUnits(maxFeePerGas, 'gwei') + ' gwei',
            maxPriorityFeePerGas: ethers.utils.formatUnits(maxPriorityFeePerGas, 'gwei') + ' gwei',
            estimatedCost: formattedEstimatedGasCost + ' ETH',
            currentWalletBalance: ethers.utils.formatEther(await wallet.getBalance()) + ' ETH'
          },
          batchIndex: batchIndex,
          networkDetails: {
            network: await provider.getNetwork().then(n => `${n.name} (chainId: ${n.chainId})`),
            currentBlock: await provider.getBlockNumber(),
            gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei',
            baseFeePerGas: feeData.lastBaseFeePerGas ? 
              ethers.utils.formatUnits(feeData.lastBaseFeePerGas, 'gwei') + ' gwei' : 'Not available'
          }
        }
      };
    }
    
    // Implement retry mechanism with minimal adjustments
    let tx;
    let receipt;
    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    
    while (!success && attempt < maxRetries) {
      attempt++;
      console.log(`Transaction attempt ${attempt} of ${maxRetries}`);
      
      try {
        // Start with minimal fees, only increase priority fee on retries if needed
        let attemptMaxFeePerGas = maxFeePerGas;
        let attemptPriorityFeePerGas = maxPriorityFeePerGas;
        
        // Only very slightly increase priority fee on retries if first attempt failed
        if (attempt > 1) {
          // Minimal increase to priority fee only on retry attempts
          // Keep base fee the same - it's the network minimum
          attemptPriorityFeePerGas = ethers.utils.parseUnits((0.01 * attempt).toString(), "gwei");
          console.log(`Retry attempt ${attempt} - using minimal priority fee: ${ethers.utils.formatUnits(attemptPriorityFeePerGas, 'gwei')} gwei`);
        }
        
        console.log(`Gas limit: ${gasLimit.toString()}`);
        console.log(`Max fee: ${ethers.utils.formatUnits(attemptMaxFeePerGas, 'gwei')} gwei (base fee only)`);
        console.log(`Priority fee: ${ethers.utils.formatUnits(attemptPriorityFeePerGas, 'gwei')} gwei`);
        
        // Call the processDailyBatch function with dynamically adjusted gas settings
        tx = await contract.processDailyBatch(batchIndex, {
          gasLimit: gasLimit,
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
          
          // For "too soon" errors, we should return with that information
          return {
            success: false,
            result: {
              message: 'Transaction cannot be processed yet',
              error: 'Too soon to process daily batch',
              waitTimeSeconds: waitTimeSeconds,
              suggestedRetryTime: new Date(Date.now() + (waitTimeSeconds * 1000)).toISOString(),
              hint: "The contract can only be called once every 24 hours. Try again after the suggested retry time."
            }
          };
        } 
        
        // Check specific error conditions (existing code)
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
      success: true,
      result: {
        message: 'Daily batch processed successfully',
        batchIndex: batchIndex,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei',
        totalCost: formattedTotalCost + ' ETH'
      }
    };
  } catch (error: any) {
    console.error('Error in batch processing:', error);
    return {
      success: false,
      result: {
        message: 'Error processing daily batch',
        error: error.message || String(error),
        transactionData: error.transaction || 'No transaction data available'
      }
    };
  }
};

const handler: Handler = async (event: ScheduledEvent, context: HandlerContext) => {
  console.log('Starting process-daily-batch function for BTB Finance (btb.finance)');
  console.log('Current time UTC:', new Date().toISOString());
  
  // Check if this is a gas estimation test
  const isGasTest = event.queryStringParameters && event.queryStringParameters.test_gas === 'true';
  if (isGasTest) {
    console.log('Running in GAS TEST MODE - no transaction will be sent');
  }
  
  // For manual testing via GET request, always allow
  // For scheduled runs, check if we're in the processing window
  if (event.httpMethod !== 'GET' && !event.isScheduled) {
    return {
      statusCode: 405,
      body: JSON.stringify({ 
        message: 'Method not allowed',
        site: 'BTB Finance (btb.finance)'
      })
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
          site: 'BTB Finance (btb.finance)',
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
    
    // Get next processing time information
    const processingTimeInfo = await getNextProcessingTime(contract);
    console.log('Processing time info:', {
      lastProcessed: new Date(processingTimeInfo.lastBatchTimestamp * 1000).toISOString(),
      interval: `${processingTimeInfo.processingInterval} seconds (${processingTimeInfo.processingInterval / 3600} hours)`,
      nextValidTime: processingTimeInfo.nextValidTime.toISOString(),
      canProcessNow: processingTimeInfo.canProcessNow,
      timeRemaining: processingTimeInfo.canProcessNow ? 
        'Ready to process now' : 
        `Wait ${processingTimeInfo.secondsUntilNextValid} more seconds (${Math.ceil(processingTimeInfo.secondsUntilNextValid / 60)} minutes)`
    });
    
    // Check for manual testing (HTTP GET request) or gas testing
    if ((event.httpMethod === 'GET' && !event.isScheduled) || isGasTest) {
      // For gas testing, we want to estimate gas even if we can't process now
      if (isGasTest) {
        try {
          // Process the batch with the test flag set to true
          const result = await processBatch(contract, wallet, provider, true);
          return {
            statusCode: result.success ? 200 : 400,
            body: JSON.stringify({
              ...result.result,
              site: 'BTB Finance (btb.finance)',
              testMode: true,
              processingInfo: {
                canProcessNow: processingTimeInfo.canProcessNow,
                nextValidTime: processingTimeInfo.nextValidTime.toISOString(),
                secondsRemaining: processingTimeInfo.secondsUntilNextValid
              }
            })
          };
        } catch (error: any) {
          // If we're testing gas but can't process yet, provide default estimates
          if (!processingTimeInfo.canProcessNow && error.message.includes('Processing too soon')) {
            // Get current gas price from provider
            const gasPrice = await provider.getGasPrice();
            const feeData = await provider.getFeeData();
            
            // Use minimum gas fees as we do in the real transaction
            const maxFeePerGas = feeData.lastBaseFeePerGas || gasPrice;
            const minPriorityFee = ethers.utils.parseUnits("0.01", "gwei");
            
            // Use typical gas values for this type of transaction
            const typicalGasLimit = ethers.BigNumber.from("300000"); // typical gas for this transaction
            const estimatedGasCost = maxFeePerGas.mul(typicalGasLimit);
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Gas estimation test completed with default values (cannot estimate actual gas until processing time)',
                gasEstimates: {
                  note: 'Using default values since actual gas cannot be estimated until processing time',
                  gasLimit: typicalGasLimit.toString() + ' (default value)',
                  maxFeePerGas: ethers.utils.formatUnits(maxFeePerGas, 'gwei') + ' gwei',
                  maxPriorityFeePerGas: ethers.utils.formatUnits(minPriorityFee, 'gwei') + ' gwei',
                  estimatedCost: ethers.utils.formatEther(estimatedGasCost) + ' ETH (estimate based on default gas limit)',
                  currentWalletBalance: ethers.utils.formatEther(await wallet.getBalance()) + ' ETH'
                },
                batchIndex: calculateBatchIndex(),
                networkDetails: {
                  network: await provider.getNetwork().then(n => `${n.name} (chainId: ${n.chainId})`),
                  currentBlock: await provider.getBlockNumber(),
                  gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei') + ' gwei',
                  baseFeePerGas: feeData.lastBaseFeePerGas ? 
                    ethers.utils.formatUnits(feeData.lastBaseFeePerGas, 'gwei') + ' gwei' : 'Not available'
                },
                processingInfo: {
                  canProcessNow: processingTimeInfo.canProcessNow,
                  nextValidTime: processingTimeInfo.nextValidTime.toISOString(),
                  secondsRemaining: processingTimeInfo.secondsUntilNextValid
                }
              })
            };
          } else {
            // For other errors, just return them
            return {
              statusCode: 400,
              body: JSON.stringify({
                message: 'Error during gas test',
                error: error.message || String(error),
                site: 'BTB Finance (btb.finance)',
                testMode: true,
                processingInfo: {
                  canProcessNow: processingTimeInfo.canProcessNow,
                  nextValidTime: processingTimeInfo.nextValidTime.toISOString(),
                  secondsRemaining: processingTimeInfo.secondsUntilNextValid
                }
              })
            };
          }
        }
      }
      
      // For normal GET requests, just return timing info if we can't process yet
      if (!processingTimeInfo.canProcessNow) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Too soon to process daily batch',
            site: 'BTB Finance (btb.finance)',
            lastProcessed: new Date(processingTimeInfo.lastBatchTimestamp * 1000).toISOString(),
            processingInterval: `${processingTimeInfo.processingInterval} seconds`,
            nextValidTime: processingTimeInfo.nextValidTime.toISOString(),
            secondsRemaining: processingTimeInfo.secondsUntilNextValid,
            minutesRemaining: Math.ceil(processingTimeInfo.secondsUntilNextValid / 60)
          })
        };
      }
    }
    
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
          message: 'All batches are already processed. No action needed.',
          site: 'BTB Finance (btb.finance)'
        })
      };
    }
    
    // Process with precise timing
    const result = await processBatchWithPreciseTiming(contract, wallet, provider);
    
    // Return the result
    return {
      statusCode: result.success ? 200 : 400,
      body: JSON.stringify({
        ...result.result,
        site: 'BTB Finance (btb.finance)'
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
          site: 'BTB Finance (btb.finance)',
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
          site: 'BTB Finance (btb.finance)',
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
        site: 'BTB Finance (btb.finance)',
        error: errorMessage,
        transactionData: error.transaction || 'No transaction data available'
      })
    };
  }
};

export { handler };
