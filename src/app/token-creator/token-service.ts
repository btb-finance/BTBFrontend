import { ethers } from 'ethers';
import tokenContractABI from './tokencode-abi.json';

// Interface for address generation options
export interface AddressGenerationOptions {
  prefix?: string;
  suffix?: string;
  zeroCount?: number;
  customPattern?: string;
  caseSensitive?: boolean;
}

// Interface for token details
export interface TokenDetails {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  chainId: number;
}

// Interface for generated wallet
export interface GeneratedWallet {
  address: string;
  privateKey: string;
  contractAddress: string;
  attempts: number;
}

// Chain configuration
export const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum', symbol: 'ETH', rpcUrl: 'https://eth.llamarpc.com' },
  { id: 56, name: 'BNB Smart Chain', symbol: 'BNB', rpcUrl: 'https://bsc-dataseed.binance.org' },
  { id: 137, name: 'Polygon', symbol: 'MATIC', rpcUrl: 'https://polygon-rpc.com' },
  { id: 42161, name: 'Arbitrum', symbol: 'ARB', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  { id: 10, name: 'Optimism', symbol: 'OP', rpcUrl: 'https://mainnet.optimism.io' },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX', rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
];

/**
 * Checks if an address matches the given pattern
 * @param address The Ethereum address to check
 * @param options The pattern options to match against
 * @returns Boolean indicating if the address matches the pattern
 */
function addressMatchesPattern(address: string, options: AddressGenerationOptions): boolean {
  // Remove 0x prefix for easier processing
  const addressWithoutPrefix = address.slice(2).toLowerCase();
  
  if (options.prefix) {
    const prefix = options.caseSensitive ? options.prefix : options.prefix.toLowerCase();
    if (!addressWithoutPrefix.startsWith(prefix)) {
      return false;
    }
  }
  
  if (options.suffix) {
    const suffix = options.caseSensitive ? options.suffix : options.suffix.toLowerCase();
    if (!addressWithoutPrefix.endsWith(suffix)) {
      return false;
    }
  }
  
  if (options.zeroCount && options.zeroCount > 0) {
    const zeroPattern = '0'.repeat(options.zeroCount);
    if (!addressWithoutPrefix.startsWith(zeroPattern)) {
      return false;
    }
  }
  
  if (options.customPattern) {
    // Convert the custom pattern to a regex
    // ? in the pattern means any character
    const regexPattern = options.customPattern.replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}`, options.caseSensitive ? '' : 'i');
    if (!regex.test(addressWithoutPrefix)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Generates a vanity address based on the provided options
 * @param options The address generation options
 * @param statusCallback Optional callback to report generation progress
 * @returns Promise resolving to the generated wallet
 */
export async function generateVanityAddress(
  options: AddressGenerationOptions,
  statusCallback?: (attempts: number) => void
): Promise<GeneratedWallet> {
  let attempts = 0;
  const maxAttempts = 100000; // Safety limit
  
  // For browser-based generation, we'll use a simple approach
  // In production, this would use web workers or a backend service
  
  while (attempts < maxAttempts) {
    const wallet = ethers.Wallet.createRandom();
    const nonce = 0; // First transaction nonce
    const contractAddress = ethers.utils.getContractAddress({
      from: wallet.address,
      nonce: nonce
    });
    
    attempts++;
    
    // Report progress every 100 attempts
    if (attempts % 100 === 0 && statusCallback) {
      statusCallback(attempts);
    }
    
    // Check if the contract address matches our pattern
    if (addressMatchesPattern(contractAddress, options)) {
      return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        contractAddress,
        attempts
      };
    }
  }
  
  throw new Error(`Failed to generate matching address after ${maxAttempts} attempts`);
}

/**
 * Deploys a token contract with the provided details
 * @param wallet The wallet to deploy from
 * @param tokenDetails The token details
 * @param statusCallback Optional callback to report deployment status
 * @returns Promise resolving to the deployed contract address
 */
export async function deployToken(
  wallet: { privateKey: string },
  tokenDetails: TokenDetails,
  statusCallback?: (status: string) => void
): Promise<string> {
  try {
    // Find the chain configuration
    const chain = SUPPORTED_CHAINS.find(c => c.id === tokenDetails.chainId);
    if (!chain) {
      throw new Error(`Unsupported chain ID: ${tokenDetails.chainId}`);
    }
    
    if (statusCallback) statusCallback('Connecting to network...');
    
    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
    const walletWithProvider = new ethers.Wallet(wallet.privateKey, provider);
    
    if (statusCallback) statusCallback('Preparing contract deployment...');
    
    // Get the contract factory
    const factory = new ethers.ContractFactory(
      tokenContractABI,
      '0x608060405234801561001057600080fd5b50610b0a806100206000396000f3fe608060405234801561001057600080fd5b50600436106100935760003560e01c8063313ce56711610066578063313ce5671461013157806340c10f1914610149578063a457c2d714610165578063a9059cbb14610181578063dd62ed3e1461019d57610093565b806306fdde0314610098578063095ea7b3146100b657806318160ddd146100e257806323b872dd14610100575b600080fd5b6100a06101cb565b6040516100ad9190610795565b60405180910390f35b6100d060048036038101906100cb9190610850565b61025d565b6040516100dd9190610895565b60405180910390f35b6100ea610280565b6040516100f791906108bf565b60405180910390f35b61011a60048036038101906101159190610946565b61028a565b6040516101289190610895565b60405180910390f35b6101396102b9565b60405161014691906108da565b60405180910390f35b610163600480360381019061015e9190610850565b6102c3565b005b61017f600480360381019061017a9190610850565b610338565b005b61019b60048036038101906101969190610850565b6103a9565b005b6101b560048036038101906101b09190610987565b6103bc565b6040516101c291906108bf565b60405180910390f35b6060600380546101da906109f6565b80601f0160208091040260200160405190810160405280929190818152602001828054610206906109f6565b80156102535780601f1061022857610100808354040283529160200191610253565b820191906000526020600020905b81548152906001019060200180831161023657829003601f168201915b5050505050905090565b600061027661026a610443565b848461044b565b6001905092915050565b6000600254905090565b60006102a761029761044356565b8484610614565b6001905092915050565b6000600560009054906101000a900460ff16905090565b6102cb610443565b73ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614610338576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161032f90610a96565b60405180910390fd5b5050565b60008061034461044356565b90506000610352828561044b565b905080156103a3578373ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef866040516103a091906108bf565b60405180910390a35b5050505050565b6103b1610443565b6103ba8383610781565b505050565b6000600160008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600033905090565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036104ba576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b190610b28565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610529576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161052090610bba565b60405180910390fd5b80600160008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925836040516106079190610bda565b60405180910390a3505050565b600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610683576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161067a90610c6c565b60405180910390fd5b600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036106f2576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016106e990610cfe565b60405180910390fd5b6107038383836107fe565b60008060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905081811015610789576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078090610d90565b60405180910390fd5b610799858585846107fe565b5050505050565b600081600160008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516107f19190610bda565b60405180910390a350505050565b505050565b600081519050919050565b600082825260208201905092915050565b60005b8381101561083a57808201518184015260208101905061081f565b60008484015250505050565b6000601f19601f8301169050919050565b60006108588235610a57565b905061086482826109a7565b919050565b600061087482610803565b61087e818561080e565b935061088e81856020860161081f565b61089781610846565b840191505092915050565b6000602082019050610a0c6000830184610895565b92915050565b6000819050919050565b610a2681610a13565b82525050565b6000602082019050610a416000830184610a1d565b92915050565b6000819050919050565b610a5a81610a47565b8114610a6557600080fd5b50565b600081359050610a7781610a51565b92915050565b600060208284031215610a9357610a92610a4c565b5b6000610aa184828501610a68565b91505092915050565b600082825260208201905092915050565b7f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572600082015250565b6000610ae2602083610aab565b9150610aed82610abc565b602082019050919050565b60006020820190508181036000830152610b1181610ad5565b9050919050565b7f45524332303a20617070726f76652066726f6d20746865207a65726f20616464600082015250565b6000610b4e602483610aab565b9150610b5982610b18565b604082019050919050565b60006020820190508181036000830152610b7d81610b41565b9050919050565b7f45524332303a20617070726f766520746f20746865207a65726f20616464726560008201527f7373000000000000000000000000000000000000000000000000000000000000602082015250565b6000610be0602283610aab565b9150610beb82610b84565b604082019050919050565b60006020820190508181036000830152610c0f81610bd3565b9050919050565b610c1f81610a13565b82525050565b6000602082019050610c3a6000830184610c16565b92915050565b7f45524332303a207472616e736665722066726f6d20746865207a65726f20616460008201527f6472657373000000000000000000000000000000000000000000000000000000602082015250565b6000610c96602583610aab565b9150610ca182610c40565b604082019050919050565b60006020820190508181036000830152610cc581610c89565b9050919050565b7f45524332303a207472616e7366657220746f20746865207a65726f206164647260008201527f6573730000000000000000000000000000000000000000000000000000000000602082015250565b6000610d28602383610aab565b9150610d3382610cd2565b604082019050919050565b60006020820190508181036000830152610d5781610d1b565b9050919050565b7f45524332303a207472616e7366657220616d6f756e742065786365656473206260008201527f616c616e63650000000000000000000000000000000000000000000000000000602082015250565b6000610dba602683610aab565b9150610dc582610d5e565b604082019050919050565b60006020820190508181036000830152610de981610dad565b9050919050565b610df981610a47565b8114610e0457600080fd5b5056fea2646970667358221220d7a0f12f7d9a3a1f8b5e5f3e9c9b9c9d9e9f9091929394959697989990a0b0c0d0e0f1011121314151617181920212223242526272829303132333435363738394041424344454647484950515253545556575859606162636465666768697071727374757677787980818283848586878889909192939495969798990a0b0c0d0e0f101112131415161718192021222324252627282930313233343536373839404142434445464748495051525354555657585960616263646566676869707172737475767778798081828384858687888990919293949596979899a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff',
      walletWithProvider
    );
    
    // Calculate the total supply with decimals
    const totalSupply = ethers.utils.parseUnits(
      tokenDetails.totalSupply, 
      tokenDetails.decimals
    );
    
    if (statusCallback) statusCallback('Deploying token contract...');
    
    // Deploy the contract
    const contract = await factory.deploy(
      tokenDetails.name,
      tokenDetails.symbol,
      tokenDetails.decimals,
      totalSupply,
      walletWithProvider.address
    );
    
    if (statusCallback) statusCallback('Waiting for deployment confirmation...');
    
    // Wait for the contract to be deployed
    await contract.deployed();
    
    if (statusCallback) statusCallback('Token deployed successfully!');
    
    return contract.address;
  } catch (error) {
    console.error('Error deploying token:', error);
    throw error;
  }
}
