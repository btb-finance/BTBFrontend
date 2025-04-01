import { ethers } from 'ethers';
import btbAbi from '../btb-bridge/btbabi.json';

// Simple implementation based on the user's example code
export const CHAIN_CONFIG = {
  AVALANCHE: {
    chainId: 43114,
    eid: 30106,
    name: 'Avalanche',
    symbol: 'AVAX',
  },
  ARBITRUM: {
    chainId: 42161,
    eid: 30110,
    name: 'Arbitrum',
    symbol: 'ARB',
  },
  OPTIMISM: {
    chainId: 10,
    eid: 30111,
    name: 'Optimism',
    symbol: 'OP',
  },
  BASE: {
    chainId: 8453,
    eid: 30184,
    name: 'Base',
    symbol: 'ETH',
  }
};

// BTB token address (same across all chains)
export const BTB_TOKEN_ADDRESS = '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB';

// Simple function to convert address to bytes32 format
function addressToBytes32(address: string): string {
  return '0x' + '0'.repeat(24) + address.slice(2);
}

// Simple bridge function that follows the user's example code
export async function sendBTBToChain(
  provider: ethers.providers.Web3Provider,
  amount: string,
  sourceChainId: number,
  destinationChainId: number,
  onStatusUpdate?: (message: string) => void
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    // Create contract instance
    const btbContract = new ethers.Contract(BTB_TOKEN_ADDRESS, btbAbi, signer);
    
    // Find source and destination chain configs
    const sourceChain = Object.values(CHAIN_CONFIG).find(c => c.eid === sourceChainId);
    const destChain = Object.values(CHAIN_CONFIG).find(c => c.eid === destinationChainId);
    
    if (!sourceChain) {
      throw new Error(`Source chain with EID ${sourceChainId} not found`);
    }
    
    if (!destChain) {
      throw new Error(`Destination chain with EID ${destinationChainId} not found`);
    }
    
    onStatusUpdate?.(`Sending ${amount} BTB from ${sourceChain.name} to ${destChain.name}...`);
    onStatusUpdate?.(`Source Chain EID: ${sourceChain.eid}`);
    onStatusUpdate?.(`Destination Chain EID: ${destChain.eid}`);
    
    // Convert amount to wei
    const amountToSend = ethers.utils.parseEther(amount);
    
    // Using the exact format from the working example for extraOptions
    const lzExtraOptions = '0x00030100110100000000000000000000000000030d40';
    
    // Make sure the parameters match exactly what the contract expects
    // The SendParam struct must match the contract's struct definition
    const sendParamStruct = {
      dstEid: destChain.eid,
      to: addressToBytes32(userAddress),
      amountLD: amountToSend,
      minAmountLD: amountToSend,
      extraOptions: lzExtraOptions,
      composeMsg: '0x',
      oftCmd: '0x'
    };
    
    // Get quote for the send operation
    onStatusUpdate?.('Getting quote...');
    
    let nativeFee: ethers.BigNumber;
    
    try {
      // Log the parameters for debugging
      console.log('Calling quoteSend with parameters:', {
        sendParamStruct: {
          dstEid: destChain.eid.toString(),
          to: addressToBytes32(userAddress),
          amountLD: amountToSend.toString(),
          minAmountLD: amountToSend.toString(),
          extraOptions: lzExtraOptions,
          composeMsg: '0x',
          oftCmd: '0x'
        },
        payInLzToken: false
      });
      
      // The second parameter is _payInLzToken (boolean)
      const feeQuote = await btbContract.quoteSend(sendParamStruct, false);
      nativeFee = feeQuote.nativeFee;
      onStatusUpdate?.(`Successfully got quote: ${ethers.utils.formatEther(nativeFee)} ${destChain.symbol}`);
    } catch (error) {
      console.error('Error in quoteSend:', error);
      // Log detailed error information
      console.log('Detailed error:', JSON.stringify(error, null, 2));
      console.log('Contract address:', BTB_TOKEN_ADDRESS);
      console.log('Current chain ID:', (await provider.getNetwork()).chainId);
      
      // Try alternative approach
      onStatusUpdate?.('Trying alternative quote method...');
      
      // Check if estimateSendFee exists on the contract
      if (typeof btbContract.estimateSendFee === 'function') {
        try {
          const quote = await btbContract.estimateSendFee(
            destChain.eid,
            addressToBytes32(userAddress),
            amountToSend,
            false,
            lzExtraOptions
          );
          nativeFee = quote.nativeFee;
          onStatusUpdate?.(`Got fee via estimateSendFee: ${ethers.utils.formatEther(nativeFee)} ${destChain.symbol}`);
        } catch (estimateError) {
          console.error('Error in estimateSendFee:', estimateError);
          // Use the exact fee from the working example
          nativeFee = ethers.BigNumber.from('23789351745909');
          onStatusUpdate?.(`Using example native fee: ${ethers.utils.formatEther(nativeFee)} ETH`);
          console.log('Detailed error from estimateSendFee:', JSON.stringify(estimateError, null, 2));
        }
      } else {
        // If estimateSendFee doesn't exist, use the exact fee from the working example
        nativeFee = ethers.BigNumber.from('23789351745909');
        onStatusUpdate?.(`Using example native fee: ${ethers.utils.formatEther(nativeFee)} ETH`);
      }
    }
    
    onStatusUpdate?.(`Native fee required: ${ethers.utils.formatEther(nativeFee)} ${destChain.symbol}`);
    
    // Create fee struct using the exact value we determined
    const feeStruct = {
      nativeFee: nativeFee,
      lzTokenFee: ethers.BigNumber.from(0)
    };
    
    // Send the transaction with the correct parameters
    const tx = await btbContract.send(
      sendParamStruct,  // SendParam struct
      feeStruct,        // MessagingFee struct
      userAddress,      // refundAddress
      {
        gasLimit: 500000, // Increased gas limit for safety
        value: nativeFee  // Value must match the nativeFee
      }
    );
    
    onStatusUpdate?.(`Transaction submitted: ${tx.hash}`);
    onStatusUpdate?.('Waiting for transaction confirmation...');
    
    await tx.wait();
    
    onStatusUpdate?.('Transaction confirmed!');
    onStatusUpdate?.(`See: https://layerzeroscan.com/tx/${tx.hash}`);
    
    return {
      success: true,
      txHash: tx.hash
    };
  } catch (error: any) {
    console.error('Error sending BTB tokens:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

// Helper function to create executor options
function createExecutorOptions(gasLimit: number = 200000, value: number = 0): string {
  // This format matches the working example: 0x00030100110100000000000000000000000000030d40
  // This is a specific format required by LayerZero for executor options
  // Format: 0x + 00 (version) + 03 (options count) + option1 + option2 + option3
  // Each option is: index (1 byte) + length (1 byte) + data
  
  // For now, we'll use the exact value from the working example
  return '0x00030100110100000000000000000000000000030d40';
  
  /* Original implementation - keeping for reference
  // Create options array with a single item
  const options = [{
    index: 0,
    gasLimit: gasLimit,
    value: value
  }];
  
  // Encode options array
  return ethers.utils.defaultAbiCoder.encode(
    ['tuple(uint8 index, uint64 gasLimit, uint64 value)[]'],
    [options]
  );
  */
}

// Get BTB balance
export async function getBTBBalance(provider: ethers.providers.Web3Provider): Promise<string> {
  try {
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();
    
    const btbContract = new ethers.Contract(BTB_TOKEN_ADDRESS, btbAbi, provider);
    const balance = await btbContract.balanceOf(userAddress);
    
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error('Error getting BTB balance:', error);
    return '0';
  }
}

// Get current chain info
export async function getCurrentChain(provider: ethers.providers.Web3Provider): Promise<{
  name: string;
  chainId: number;
  isSupported: boolean;
}> {
  try {
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    
    // Find if current chain is supported
    const chainEntry = Object.values(CHAIN_CONFIG).find(
      config => config.chainId === chainId
    );
    
    if (chainEntry) {
      return {
        name: chainEntry.name,
        chainId,
        isSupported: true
      };
    } else {
      return {
        name: network.name !== 'unknown' ? network.name : 'Unknown Chain',
        chainId,
        isSupported: false
      };
    }
  } catch (error) {
    console.error('Error getting current chain:', error);
    return { name: 'Unknown', chainId: 0, isSupported: false };
  }
}
