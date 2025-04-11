import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { ethers } from 'ethers';
import subscriptionJackpotABI from '../../src/app/contracts/megapot/subscriptionjackpotabi.json';

// Contract address on Base mainnet
const SUBSCRIPTION_JACKPOT_ADDRESS = '0x92C1fce71847cd68a794A3377741b372F392b25a';

// Calculate today's batch index (0 on first day)
const calculateBatchIndex = (): number => {
  const startDate = new Date('2024-04-12'); // The first day we start at index 0
  const today = new Date();
  
  // Calculate days difference
  const diffTime = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Batch index is always 0 as it's for the day's batch
  return 0;
}

// Extended event interface with isScheduled property
interface ScheduledEvent extends HandlerEvent {
  isScheduled?: boolean;
}

const handler: Handler = async (event: ScheduledEvent, context: HandlerContext) => {
  // Only allow scheduled functions or GET requests for manual triggering
  if (event.httpMethod !== 'GET' && !event.isScheduled) {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    // Initialize provider with Base mainnet RPC URL
    const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC_URL);
    
    // Initialize wallet with private key from environment variable
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);
    
    // Create contract instance
    const contract = new ethers.Contract(
      SUBSCRIPTION_JACKPOT_ADDRESS,
      subscriptionJackpotABI,
      wallet
    );

    // Calculate the batch index for today
    const batchIndex = calculateBatchIndex();
    console.log('Processing daily batch with index:', batchIndex);
    
    // Call the processDailyBatch function with the calculated batch index
    const tx = await contract.processDailyBatch(batchIndex);
    
    // Wait for transaction to be mined
    const receipt = await tx.wait();
    
    console.log('Transaction successful. Hash:', receipt.transactionHash);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Daily batch processed successfully',
        batchIndex: batchIndex,
        transactionHash: receipt.transactionHash
      })
    };
  } catch (error) {
    console.error('Error processing daily batch:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error processing daily batch',
        error: error instanceof Error ? error.message : String(error)
      })
    };
  }
};

export { handler };
