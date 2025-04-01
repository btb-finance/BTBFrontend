import { ethers } from 'ethers';

// Base network configuration (same as in chicksService)
const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
};

// USDC contract address on Base Mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// CHICKS contract address on Base Mainnet
const CHICKS_ADDRESS = '0x0000a88106096104877F79674396708E017DFf00';

// Minimal ERC20 ABI for token interactions
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)'
];

class OpenOceanService {
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // OpenOcean API endpoints
  private readonly apiBaseUrl = 'https://open-api.openocean.finance/v4';
  
  constructor() {
    // Initialize the read-only provider
    this.provider = new ethers.providers.StaticJsonRpcProvider(
      BASE_NETWORK.rpcUrl,
      {
        chainId: BASE_NETWORK.chainId,
        name: BASE_NETWORK.name,
        ensAddress: undefined
      }
    );
  }

  public async connect() {
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet detected');
    }

    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      // Check and switch network if needed
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== `0x${BASE_NETWORK.chainId.toString(16)}`) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${BASE_NETWORK.chainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${BASE_NETWORK.chainId.toString(16)}`,
                chainName: BASE_NETWORK.name,
                nativeCurrency: {
                  name: 'ETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [BASE_NETWORK.rpcUrl],
                blockExplorerUrls: [BASE_NETWORK.blockExplorer],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Create Web3Provider and signer
      const injectedProvider = new ethers.providers.Web3Provider(window.ethereum, {
        chainId: BASE_NETWORK.chainId,
        name: BASE_NETWORK.name,
        ensAddress: undefined
      });
      
      this.signer = injectedProvider.getSigner();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  public async disconnect() {
    this.signer = null;
    this.isInitialized = false;
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.connect();
    }
  }

  // Get quote for a swap
  public async getQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<any> {
    try {
      // OpenOcean API expects amount without decimals (e.g., 1.23 USDC as "1.23")
      // No need to convert to wei format
      
      const url = `${this.apiBaseUrl}/${BASE_NETWORK.chainId}/quote?inTokenAddress=${fromToken}&outTokenAddress=${toToken}&amount=${amount}&gasPrice=5`;
      
      console.log('OpenOcean Quote URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenOcean API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.code !== 200) {
        throw new Error(`OpenOcean API error: ${data.message || JSON.stringify(data)}`);
      }
      return data;
    } catch (error) {
      console.error('Error getting quote:', error);
      throw error;
    }
  }

  // Get swap transaction data
  public async getSwap(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<any> {
    await this.ensureInitialized();
    
    try {
      const address = await this.signer!.getAddress();
      
      // Get current gas price from network
      let gasPrice = '5'; // Default fallback
      try {
        const feeData = await this.provider!.getFeeData();
        if (feeData.gasPrice) {
          gasPrice = Math.ceil(parseFloat(ethers.utils.formatUnits(feeData.gasPrice, 'gwei'))).toString();
          console.log('Current network gas price:', gasPrice, 'gwei');
        }
      } catch (error) {
        console.warn('Error getting network gas price:', error);
      }
      
      // OpenOcean API expects amount without decimals (e.g., 1.23 USDC as "1.23")
      // No need to convert to wei format
      
      const url = `${this.apiBaseUrl}/${BASE_NETWORK.chainId}/swap?inTokenAddress=${fromToken}&outTokenAddress=${toToken}&amount=${amount}&slippage=${slippage}&gasPrice=${gasPrice}&account=${address}`;
      
      console.log('OpenOcean Swap URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenOcean API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('OpenOcean Swap API response:', data);
      
      if (data.code !== 200) {
        throw new Error(`OpenOcean API error: ${data.message || JSON.stringify(data)}`);
      }
      return data;
    } catch (error) {
      console.error('Error getting swap data:', error);
      throw error;
    }
  }

  // Execute a swap transaction
  public async executeSwap(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<ethers.providers.TransactionResponse> {
    await this.ensureInitialized();
    
    try {
      const swapData = await this.getSwap(fromToken, toToken, amount, slippage);
      
      if (!swapData.data) {
        throw new Error('No swap data received from OpenOcean');
      }
      
      // Check if approval is needed
      if (fromToken !== '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') { // Not ETH
        await this.approveTokenIfNeeded(fromToken, swapData.data.to, amount);
      }
      
      console.log('Swap data for transaction:', swapData.data);
      
      // Prepare transaction parameters with proper error handling
      const txParams: any = {
        to: swapData.data.to,
        data: swapData.data.data,
        from: await this.signer!.getAddress(), // Explicitly set from address
      };
      
      // Handle value parameter (for ETH transactions)
      if (fromToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        if (swapData.data.value) {
          txParams.value = ethers.BigNumber.from(swapData.data.value);
        } else {
          txParams.value = ethers.BigNumber.from(0);
        }
      } else {
        txParams.value = ethers.BigNumber.from(0);
      }
      
      // Set a reasonable gas limit directly instead of estimating
      // This helps avoid the "gas required exceeds allowance" error
      txParams.gasLimit = ethers.BigNumber.from("3000000"); // Set a high fixed gas limit
      
      // Handle gas price - use network's recommended gas price if available
      try {
        const feeData = await this.provider!.getFeeData();
        if (feeData.gasPrice) {
          txParams.gasPrice = feeData.gasPrice;
          console.log('Using network gas price:', ethers.utils.formatUnits(feeData.gasPrice, 'gwei'), 'gwei');
        } else if (swapData.data.gasPrice) {
          txParams.gasPrice = ethers.utils.parseUnits(swapData.data.gasPrice.toString(), 'gwei');
        }
      } catch (error) {
        console.warn('Error getting fee data, using default gas price:', error);
        // Use a reasonable default if all else fails
        txParams.gasPrice = ethers.utils.parseUnits('5', 'gwei');
      }
      
      console.log('Final transaction parameters:', txParams);
      
      // Execute the swap transaction
      const tx = await this.signer!.sendTransaction(txParams);
      
      return tx;
    } catch (error) {
      console.error('Error executing swap:', error);
      throw error;
    }
  }

  // Get token decimals
  private async getTokenDecimals(tokenAddress: string): Promise<number> {
    try {
      // If it's ETH (represented by a special address in OpenOcean)
      if (tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        return 18;
      }
      
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider!);
      const decimals = await tokenContract.decimals();
      return decimals;
    } catch (error) {
      console.error('Error getting token decimals:', error);
      return 18; // Default to 18 decimals
    }
  }

  // Approve token spending if needed
  private async approveTokenIfNeeded(
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<void> {
    await this.ensureInitialized();
    
    try {
      const address = await this.signer!.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer!);
      
      // Get decimals for the token
      const decimals = await this.getTokenDecimals(tokenAddress);
      
      // Convert amount to the correct format based on decimals
      const parsedAmount = ethers.utils.parseUnits(amount, decimals);
      
      // Check current allowance
      const allowance = await tokenContract.allowance(address, spenderAddress);
      
      // If allowance is insufficient, approve
      if (allowance.lt(parsedAmount)) {
        console.log(`Approving ${tokenAddress} for ${spenderAddress}...`);
        
        // Approve max uint256 to save gas on future transactions
        const maxApproval = ethers.constants.MaxUint256;
        
        // Set explicit gas limit for approval to avoid estimation issues
        const approveTx = await tokenContract.approve(spenderAddress, maxApproval, {
          gasLimit: ethers.BigNumber.from("100000"), // Standard gas limit for ERC20 approvals
        });
        
        await approveTx.wait();
        console.log('Approval transaction confirmed');
      } else {
        console.log('Token already approved');
      }
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }

  // Get price comparison between OpenOcean and BTB
  public async getPriceComparison(
    btbPrice: string,
    amount: string = '1'
  ): Promise<{
    btbPrice: string;
    openOceanPrice: string;
    priceDifference: string;
    priceDifferencePercentage: string;
  }> {
    try {
      // Get OpenOcean price for 1 CHICKS
      const quoteData = await this.getQuote(
        CHICKS_ADDRESS,
        USDC_ADDRESS,
        amount
      );
      
      if (!quoteData.data) {
        throw new Error('No quote data received from OpenOcean');
      }
      
      console.log('OpenOcean quote data:', quoteData);
      
      // Calculate price per CHICKS
      // The API returns inAmount and outAmount with decimals already applied
      const inAmount = parseFloat(amount);
      const outAmount = parseFloat(ethers.utils.formatUnits(quoteData.data.outAmount, 6));
      const openOceanPrice = (outAmount / inAmount).toFixed(6);
      
      // Calculate price difference
      const btbPriceNum = parseFloat(btbPrice);
      const openOceanPriceNum = parseFloat(openOceanPrice);
      const priceDifference = (openOceanPriceNum - btbPriceNum).toFixed(6);
      const priceDifferencePercentage = (((openOceanPriceNum - btbPriceNum) / btbPriceNum) * 100).toFixed(2);
      
      return {
        btbPrice,
        openOceanPrice,
        priceDifference,
        priceDifferencePercentage
      };
    } catch (error) {
      console.error('Error getting price comparison:', error);
      return {
        btbPrice,
        openOceanPrice: '0',
        priceDifference: '0',
        priceDifferencePercentage: '0'
      };
    }
  }
}

// Create a singleton instance
const openOceanService = new OpenOceanService();
export default openOceanService;
