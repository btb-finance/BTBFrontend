import { ethers } from 'ethers';

export interface KyberSwapQuoteResponse {
  routeSummary: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    receivedUsd: number;
    priceImpact: number;
    swaps: any[];
  };
  routerAddress: string;
  encodedSwapData?: string;
  formattedOutputAmount?: string;
  exchangeRate?: number;
}

export class KyberSwapService {
  private readonly baseUrl = 'https://aggregator-api.kyberswap.com';
  private readonly ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Alias for NATIVE_TOKEN_ADDRESS for backward compatibility
  private readonly USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  private readonly BTB_ADDRESS = '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB';
  private readonly BTBY_ADDRESS = '0xBB6e8c1e49f04C9f6c4D6163c52990f92431FdBB';
  private readonly CHAIN_ID = 8453; // Base network
  private readonly CHAIN_NAME = 'base'; // Chain name for API URL path
  private readonly NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  private provider: ethers.providers.Web3Provider | null = null;
  private signer: ethers.Signer | null = null;

  constructor() {
    // Provider and signer will be set when needed
  }

  /**
   * Sets the provider and signer for the service
   */
  public setProviderAndSigner(provider: ethers.providers.Web3Provider) {
    this.provider = provider;
    this.signer = provider.getSigner();
  }

  /**
   * Normalizes token addresses, treating ETH specially
   */
  private normalizeTokenAddress(token: string): string {
    if (token.toLowerCase() === 'eth') {
      return this.ETH_ADDRESS;
    } else if (token.toLowerCase() === 'usdc') {
      return this.USDC_ADDRESS;
    } else if (token.toLowerCase() === 'btb') {
      return this.BTB_ADDRESS;
    } else if (token.toLowerCase() === 'btby') {
      return this.BTBY_ADDRESS;
    }
    return token;
  }

  /**
   * Gets a formatted quote for a swap
   */
  public async getFormattedQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    userAddress?: string,
    fromDecimals: number = 18,
    toDecimals: number = 18
  ): Promise<KyberSwapQuoteResponse> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider and signer are not set');
    }

    try {
      // Normalize token addresses
      const normalizedFromToken = this.normalizeTokenAddress(fromToken);
      const normalizedToToken = this.normalizeTokenAddress(toToken);
      
      console.log(`Getting formatted quote: ${amount} ${fromToken}(${normalizedFromToken}) -> ${toToken}(${normalizedToToken})`);
      
      // Use a default address if userAddress is not provided
      const address = userAddress || await this.signer.getAddress();
      
      const response = await fetch(
        `${this.baseUrl}/${this.CHAIN_NAME}/api/v1/routes?tokenIn=${normalizedFromToken}&tokenOut=${normalizedToToken}&amountIn=${ethers.utils.parseUnits(
          amount,
          fromDecimals
        )}&to=${address}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-client-id': 'btb-finance'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`KyberSwap API error (${response.status}):`, errorText);
        throw new Error(`KyberSwap API error: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      
      // Validate response
      if (!responseData || typeof responseData !== 'object') {
        console.error('Invalid response from KyberSwap API:', responseData);
        throw new Error('Invalid response from KyberSwap API');
      }
      
      if (responseData.code !== undefined && responseData.code !== 0) {
        console.error(`KyberSwap API error: Code ${responseData.code} - ${responseData.message || 'Unknown error'}`);
        throw new Error(`KyberSwap API error: ${responseData.message || 'Unknown error'} (Code: ${responseData.code})`);
      }
      
      const data = responseData.data;
      
      // Format the output amount
      const formattedOutputAmount = ethers.utils.formatUnits(data.routeSummary.amountOut, toDecimals);
      
      return {
        ...data,
        formattedOutputAmount
      };
    } catch (error: any) {
      console.error('Error getting formatted quote:', error);
      throw new Error(`Failed to get quote: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Checks if the user has approved the token for the router and approves if needed
   */
  private async checkAndApproveToken(
    tokenAddress: string,
    amount: string,
    userAddress: string
  ): Promise<string> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider and signer are not set');
    }

    try {
      tokenAddress = this.normalizeTokenAddress(tokenAddress);
      
      // If token is native ETH, no approval needed
      if (tokenAddress === this.NATIVE_TOKEN_ADDRESS) {
        return 'Approval not needed for native token';
      }
      
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          'function allowance(address owner, address spender) view returns (uint256)',
          'function approve(address spender, uint256 amount) returns (bool)',
          'function decimals() view returns (uint8)'
        ],
        this.signer
      );
      
      const routerAddress = '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5'; // KyberSwap router address
      const decimals = await tokenContract.decimals();
      const amountInWei = ethers.utils.parseUnits(amount, decimals);
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(userAddress, routerAddress);
      
      // If allowance is insufficient, request approval
      if (currentAllowance.lt(amountInWei)) {
        console.log(`Approving ${amount} of token ${tokenAddress} for KyberSwap router`);
        
        // Approve max uint256 to avoid frequent approvals
        const maxApproval = ethers.constants.MaxUint256;
        const tx = await tokenContract.approve(routerAddress, maxApproval);
        
        console.log('Approval transaction sent:', tx.hash);
        await tx.wait();
        console.log('Approval confirmed');
        
        return tx.hash;
      }
      
      return 'Already approved';
    } catch (error) {
      console.error('Error checking/approving token:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to approve token: ${errorMessage}`);
    }
  }

  /**
   * Encodes a swap transaction using the KyberSwap API
   */
  public async encodeSwapTransaction(
    fromToken: string,
    toToken: string,
    amountIn: string,
    slippageTolerance: number,
    userAddress: string,
    deadline: number
  ): Promise<any> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider and signer are not set');
    }

    try {
      console.log(`Encoding swap transaction: ${amountIn} ${fromToken} -> ${toToken}`);
      console.log(`Parameters: slippage=${slippageTolerance}, user=${userAddress}, deadline=${deadline}`);
      
      // Step 1: First get the route using the GET method
      const routeData = await this.getFormattedQuote(
        fromToken,
        toToken,
        ethers.utils.formatUnits(amountIn, 18), // Convert wei to ETH for the getQuote method
        userAddress
      );
      
      console.log('Route data received:', routeData);
      
      // Convert slippage from decimal to basis points (e.g., 0.5% -> 50)
      const slippageToleranceBps = Math.floor(slippageTolerance * 100);
      console.log(`Slippage tolerance in basis points: ${slippageToleranceBps}`);
      
      // Step 2: Build the transaction using the POST method
      const buildUrl = `${this.baseUrl}/${this.CHAIN_NAME}/api/v1/route/build`;
      
      const buildBody = {
        routeSummary: routeData.routeSummary,
        sender: userAddress,
        recipient: userAddress,
        slippageTolerance: slippageToleranceBps,
        deadline: deadline,
        source: 'btb-finance'
      };
      
      console.log('Sending build request with body:', JSON.stringify(buildBody));
      
      const buildResponse = await fetch(buildUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': 'btb-finance'
        },
        body: JSON.stringify(buildBody)
      });
      
      if (!buildResponse.ok) {
        const errorText = await buildResponse.text();
        console.error(`Error building transaction: ${buildResponse.status} ${buildResponse.statusText}`, errorText);
        throw new Error(`Error building transaction: ${buildResponse.status} ${buildResponse.statusText}`);
      }
      
      const buildData = await buildResponse.json();
      console.log('Build response:', buildData);
      
      if (buildData.code !== 0) {
        console.error(`KyberSwap API error: Code ${buildData.code} - ${buildData.message || 'Unknown error'}`);
        throw new Error(`KyberSwap API error: ${buildData.message || 'Unknown error'} (Code: ${buildData.code})`);
      }
      
      return {
        data: buildData.data.data,
        routerAddress: buildData.data.routerAddress,
        value: buildData.data.transactionValue
      };
    } catch (error: any) {
      console.error('Error encoding swap transaction:', error);
      throw new Error(`Failed to encode swap transaction: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Executes a swap transaction
   */
  public async executeSwap(
    fromToken: string,
    toToken: string,
    amount: string,
    slippageTolerance: number,
    userAddress: string,
    fromDecimals: number = 18
  ): Promise<any> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider and signer are not set');
    }

    try {
      console.log(`Executing swap: ${amount} ${fromToken} -> ${toToken}`);
      console.log(`Parameters: slippage=${slippageTolerance}, user=${userAddress}`);
      
      // Get the quote first
      const quote = await this.getFormattedQuote(fromToken, toToken, amount, userAddress, fromDecimals);
      
      // Check and approve token if needed
      await this.checkAndApproveToken(fromToken, amount, userAddress);
      
      // Encode the swap transaction
      const encodedSwapData = await this.encodeSwapTransaction(
        fromToken,
        toToken,
        quote.routeSummary.amountIn,
        slippageTolerance,
        userAddress,
        Math.floor(Date.now() / 1000) + 60 * 20 // 20 minutes from now
      );

      // Execute transaction
      const txParams: any = {
        to: encodedSwapData.routerAddress,
        data: encodedSwapData.data,
        value: '0'
      };
      
      // If the source token is ETH, we need to send ETH with the transaction
      if (fromToken.toLowerCase() === this.NATIVE_TOKEN_ADDRESS.toLowerCase()) {
        txParams.value = quote.routeSummary.amountIn;
      }
      
      console.log('Sending transaction with params:', txParams);
      
      // Estimate gas to check for potential errors before sending
      try {
        await this.signer.estimateGas(txParams);
      } catch (error: any) {
        console.error('Gas estimation failed:', error);
        
        // Check for specific error messages
        const errorMessage = error.message || '';
        if (errorMessage.includes('Return amount is not enough')) {
          // If it's a slippage error, suggest increasing slippage
          throw new Error('Price changed during transaction. Try increasing slippage tolerance or try again later.');
        } else if (errorMessage.includes('insufficient funds')) {
          throw new Error('Insufficient funds for this swap.');
        } else {
          // Re-throw the original error
          throw error;
        }
      }
      
      const tx = await this.signer.sendTransaction(txParams);
      console.log('Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);
      
      return receipt;
    } catch (error: any) {
      console.error('Error executing swap:', error);
      
      // Handle specific error cases
      if (error.code === 4001) {
        throw new Error('Transaction rejected by user');
      }
      
      throw new Error(`Failed to execute swap: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get token balance for a given token address and user address
   */
  public async getTokenBalance(
    tokenAddress: string,
    userAddress: string
  ): Promise<string> {
    if (!this.provider || !this.signer) {
      throw new Error('Provider and signer are not set');
    }

    try {
      tokenAddress = this.normalizeTokenAddress(tokenAddress);
      
      // If token is native ETH
      if (tokenAddress === this.NATIVE_TOKEN_ADDRESS) {
        const balanceWei = await this.provider.getBalance(userAddress);
        return ethers.utils.formatEther(balanceWei);
      } 
      
      // For ERC20 tokens
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        this.provider
      );
      
      const [balanceWei, decimals] = await Promise.all([
        tokenContract.balanceOf(userAddress),
        tokenContract.decimals()
      ]);
      
      return ethers.utils.formatUnits(balanceWei, decimals);
    } catch (error) {
      console.error(`Error getting balance for token ${tokenAddress}:`, error);
      return '0';
    }
  }
}

// Create a singleton instance
const kyberSwapService = new KyberSwapService();
export default kyberSwapService;
