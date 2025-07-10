import { ethers } from 'ethers';
import BearHunterEcosystemABI from '../abi/BearHunterEcosystem.json';

// Base network configuration
const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://base-mainnet.g.alchemy.com/v2/UqLpjGTYscN_cI1VF7MRq',
  blockExplorer: 'https://basescan.org',
};

class GameService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;
  
  // Caching mechanism
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  // Contract addresses
  private readonly gameContractAddress = '0x63478c2822874AaB175F4c96cc024E85e0213d52'; // BearHunterEcosystem
  private readonly mimoTokenAddress = '0x7c1604981bE181e856c458F3d604f15bc97c7661'; // MiMoGaMe Token
  private readonly btbTokenAddress = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488'; // BTB Token
  private readonly bearNFTAddress = '0x000081733751860A8E5BA00FdCF7000b53E90dDD'; // BTB NFT
  private readonly btbSwapLogicAddress = '0x4F3B9b9e423170C811bCAEDDC661f00A8D208755'; // BTBSwapLogic

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

    // Initialize contract with provider
    this.contract = new ethers.Contract(
      this.gameContractAddress,
      BearHunterEcosystemABI,
      this.provider
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
      
      // Initialize contract with signer
      this.contract = new ethers.Contract(
        this.gameContractAddress,
        BearHunterEcosystemABI,
        this.signer
      );

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  public async disconnect() {
    this.contract = new ethers.Contract(
      this.gameContractAddress,
      BearHunterEcosystemABI,
      this.provider!
    );
    this.signer = null;
    this.isInitialized = false;
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.connect();
    }
  }

  // Cache utility methods
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clearCache(): void {
    this.cache.clear();
  }

  // Batch contract calls utility with rate limiting and retry logic
  private async batchContractCalls(calls: Array<{ contract: ethers.Contract; method: string; args: any[] }>, batchSize: number = 10): Promise<any[]> {
    const results = [];
    
    // Process calls in chunks to avoid rate limits
    for (let i = 0; i < calls.length; i += batchSize) {
      const chunk = calls.slice(i, i + batchSize);
      
      // Retry logic for rate limit errors
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const promises = chunk.map(call => call.contract[call.method](...call.args));
          const chunkResults = await Promise.all(promises);
          results.push(...chunkResults);
          break; // Success, exit retry loop
        } catch (error: any) {
          retryCount++;
          
          if (error.message?.includes('Request limit exceeded') || error.message?.includes('rate limit')) {
            console.warn(`Rate limit hit, retrying chunk ${i}-${i + batchSize} (attempt ${retryCount}/${maxRetries})`);
            
            // Exponential backoff: 500ms, 1s, 2s
            const delay = 500 * Math.pow(2, retryCount - 1);
            await this.delay(delay);
            
            if (retryCount === maxRetries) {
              console.error('Max retries reached for batch calls');
              throw error;
            }
          } else {
            // Non-rate-limit error, don't retry
            console.error('Error in batch contract calls:', error);
            throw error;
          }
        }
      }
      
      // Add delay between chunks to prevent rate limiting
      if (i + batchSize < calls.length) {
        await this.delay(150);
      }
    }
    
    return results;
  }

  // Utility to add delays between operations
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Multicall implementation for efficient batch calls
  private async multicall(calls: Array<{ target: string; callData: string }>): Promise<string[]> {
    try {
      // Simple multicall using eth_call with batched requests
      const multicallPromises = calls.map(call => 
        this.provider!.call({
          to: call.target,
          data: call.callData
        })
      );
      
      // Process in smaller chunks to avoid overwhelming the RPC
      const results = [];
      const chunkSize = 50; // Reduce from previous batch sizes
      
      for (let i = 0; i < multicallPromises.length; i += chunkSize) {
        const chunk = multicallPromises.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk);
        results.push(...chunkResults);
        
        // Small delay between chunks
        if (i + chunkSize < multicallPromises.length) {
          await this.delay(50);
        }
      }
      
      return results;
    } catch (error) {
      console.error('Multicall failed, falling back to individual calls:', error);
      throw error;
    }
  }

  // Helper to encode function calls
  private encodeFunctionCall(contractInterface: ethers.utils.Interface, functionName: string, args: any[]): string {
    return contractInterface.encodeFunctionData(functionName, args);
  }

  // ==================== BALANCE FUNCTIONS ====================

  public async getMiMoBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      // Call MiMo token contract directly
      const mimoContract = new ethers.Contract(
        this.mimoTokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.signer!
      );
      const balance = await mimoContract.balanceOf(address);
      return ethers.utils.formatUnits(balance, 18);
    } catch (error) {
      console.error('Error getting MiMo balance:', error);
      return '0';
    }
  }

  public async getBTBBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      // Call BTB token contract directly
      const btbContract = new ethers.Contract(
        this.btbTokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.signer!
      );
      const balance = await btbContract.balanceOf(address);
      return ethers.utils.formatUnits(balance, 18);
    } catch (error) {
      console.error('Error getting BTB balance:', error);
      return '0';
    }
  }

  public async getBearNFTBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.signer!
      );
      const balance = await bearContract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      console.error('Error getting Bear NFT balance:', error);
      return '0';
    }
  }

  public async getHunterNFTBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const balance = await this.contract!.balanceOf(address);
      return balance.toString();
    } catch (error) {
      console.error('Error getting Hunter NFT balance:', error);
      return '0';
    }
  }

  // ==================== GAME FUNCTIONS ====================

  public async depositBears(bearIds: number[]): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // First approve the game contract to transfer Bear NFTs
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        [
          'function setApprovalForAll(address operator, bool approved) external',
          'function isApprovedForAll(address owner, address operator) view returns (bool)'
        ],
        this.signer!
      );
      
      const address = await this.signer!.getAddress();
      const isApproved = await bearContract.isApprovedForAll(address, this.gameContractAddress);
      
      if (!isApproved) {
        const approveTx = await bearContract.setApprovalForAll(this.gameContractAddress, true);
        await approveTx.wait();
      }
      
      // Deposit bears
      const tx = await this.contract!.depositBears(bearIds);
      return tx;
    } catch (error) {
      console.error('Error depositing bears:', error);
      throw error;
    }
  }

  public async feedHunters(hunterIds: number[]): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      const tx = await this.contract!.feedHunters(hunterIds);
      return tx;
    } catch (error) {
      console.error('Error feeding hunters:', error);
      throw error;
    }
  }

  public async hunt(hunterIds: number[], targets: string[]): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      const tx = await this.contract!.hunt(hunterIds, targets);
      return tx;
    } catch (error) {
      console.error('Error hunting:', error);
      throw error;
    }
  }

  public async redeemBears(count: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      const tx = await this.contract!.redeemBears(count);
      return tx;
    } catch (error) {
      console.error('Error redeeming bears:', error);
      throw error;
    }
  }

  // ==================== SWAP FUNCTIONS ====================

  public async getSwapRate(): Promise<string> {
    try {
      const rate = await this.contract!.getSwapRate();
      
      // Check if rate is type(uint256).max (indicates no liquidity or edge case)
      const maxUint256 = ethers.constants.MaxUint256;
      if (rate.eq(maxUint256)) {
        console.warn('Swap rate is at maximum value, indicating liquidity issues');
        return '0'; // Return 0 to indicate no valid rate
      }
      
      // getSwapRate() returns baseRate + buyPremium, we need to subtract premium to get base rate
      const buyPremium = await this.getBuyPremium();
      const buyPremiumWei = ethers.utils.parseUnits(buyPremium, 18);
      
      let baseRate = rate;
      if (rate.gt(buyPremiumWei)) {
        baseRate = rate.sub(buyPremiumWei);
      } else {
        baseRate = ethers.BigNumber.from('0');
      }
      
      return ethers.utils.formatUnits(baseRate, 18); // BTB has 18 decimals
    } catch (error) {
      console.error('Error getting swap rate:', error);
      return '0';
    }
  }

  public async getBuyPremium(): Promise<string> {
    try {
      // Get the BTBSwapLogic contract address from the main contract
      const swapContractAddress = await this.contract!.btbSwapContract();
      
      // Create a direct contract instance for BTBSwapLogic
      const swapContract = new ethers.Contract(
        swapContractAddress,
        [
          'function buyPremium() view returns (uint256)'
        ],
        this.provider!
      );
      
      const premium = await swapContract.buyPremium();
      return ethers.utils.formatUnits(premium, 18); // BTB has 18 decimals
    } catch (error) {
      console.error('Error getting buy premium:', error);
      return '5000'; // Default to 5000 BTB as mentioned
    }
  }

  public async swapBTBForNFT(nftAmount: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // Calculate required BTB amount (base rate + premium + fees)
      const swapRate = await this.getSwapRate();
      const buyPremium = await this.getBuyPremium();
      
      // Base amount = (swapRate + premium) * nftAmount
      const baseAmount = ethers.utils.parseUnits(
        ((parseFloat(swapRate) + parseFloat(buyPremium)) * nftAmount).toString(), 
        18
      );
      
      // Add 1% swap fee
      const feeAmount = baseAmount.mul(100).div(10000); // 1% fee
      const totalAmount = baseAmount.add(feeAmount);
      
      // First approve BTB tokens
      const btbContract = new ethers.Contract(
        this.btbTokenAddress,
        [
          'function approve(address spender, uint256 amount) external returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        this.signer!
      );
      
      const address = await this.signer!.getAddress();
      const allowance = await btbContract.allowance(address, this.gameContractAddress);
      
      if (allowance.lt(totalAmount)) {
        const approveTx = await btbContract.approve(this.gameContractAddress, totalAmount);
        await approveTx.wait();
      }
      
      const tx = await this.contract!.swapBTBForNFT(nftAmount);
      return tx;
    } catch (error) {
      console.error('Error swapping BTB for NFT:', error);
      throw error;
    }
  }

  public async swapNFTForBTB(tokenIds: number[]): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // First approve NFTs
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        [
          'function setApprovalForAll(address operator, bool approved) external',
          'function isApprovedForAll(address owner, address operator) view returns (bool)'
        ],
        this.signer!
      );
      
      const address = await this.signer!.getAddress();
      const isApproved = await bearContract.isApprovedForAll(address, this.gameContractAddress);
      
      if (!isApproved) {
        const approveTx = await bearContract.setApprovalForAll(this.gameContractAddress, true);
        await approveTx.wait();
      }
      
      const tx = await this.contract!.swapNFTForBTB(tokenIds);
      return tx;
    } catch (error) {
      console.error('Error swapping NFT for BTB:', error);
      throw error;
    }
  }

  public async getSwapLiquidityInfo(): Promise<{
    btbBalance: string;
    nftBalance: string;
    isLiquidityAvailable: boolean;
    status: string;
  }> {
    try {
      // Get the BTBSwapLogic contract address from the main contract
      const swapContractAddress = await this.contract!.btbSwapContract();
      
      // Create a direct contract instance for BTBSwapLogic
      const swapContract = new ethers.Contract(
        swapContractAddress,
        [
          'function btbToken() view returns (address)',
          'function bearNFT() view returns (address)'
        ],
        this.provider!
      );
      
      // Get BTB and NFT contracts
      const btbTokenAddress = await swapContract.btbToken();
      const bearNFTAddress = await swapContract.bearNFT();
      
      const btbContract = new ethers.Contract(
        btbTokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider!
      );
      
      const nftContract = new ethers.Contract(
        bearNFTAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider!
      );
      
      // Get balances
      const btbBalance = await btbContract.balanceOf(swapContractAddress);
      const nftBalance = await nftContract.balanceOf(swapContractAddress);
      
      const btbBalanceFormatted = ethers.utils.formatUnits(btbBalance, 18);
      const nftBalanceFormatted = nftBalance.toString();
      
      let status = 'Unknown';
      let isLiquidityAvailable = false;
      
      if (btbBalance.gt(0) && nftBalance.gt(0)) {
        status = 'Both BTB and NFT liquidity available';
        isLiquidityAvailable = true;
      } else if (btbBalance.gt(0)) {
        status = 'Only BTB liquidity available (can sell NFTs)';
        isLiquidityAvailable = false;
      } else if (nftBalance.gt(0)) {
        status = 'Only NFT liquidity available (can buy NFTs)';
        isLiquidityAvailable = false;
      } else {
        status = 'No liquidity available';
        isLiquidityAvailable = false;
      }
      
      return {
        btbBalance: btbBalanceFormatted,
        nftBalance: nftBalanceFormatted,
        isLiquidityAvailable,
        status
      };
    } catch (error) {
      console.error('Error getting swap liquidity info:', error);
      return {
        btbBalance: '0',
        nftBalance: '0',
        isLiquidityAvailable: false,
        status: 'Error fetching liquidity info'
      };
    }
  }

  // ==================== SWAP CALCULATION FUNCTIONS ====================

  public async calculateBTBCostForNFTs(nftAmount: number): Promise<{
    baseRate: string;
    premium: string;
    subtotal: string;
    fee: string;
    total: string;
    isValid: boolean;
    error?: string;
  }> {
    try {
      // For buying, we need the full contract rate (baseRate + premium)
      const contractRate = await this.contract!.getSwapRate();
      const maxUint256 = ethers.constants.MaxUint256;
      
      if (contractRate.eq(maxUint256) || contractRate.eq(0)) {
        return {
          baseRate: '0.000000',
          premium: '5000.000000',
          subtotal: '0.000000',
          fee: '0.000000',
          total: '0.000000',
          isValid: false,
          error: 'No liquidity available for buying NFTs'
        };
      }
      
      const baseRate = await this.getSwapRate(); // This is base rate only (after subtracting premium)
      const buyPremium = await this.getBuyPremium();
      
      const baseRatePerNFT = parseFloat(baseRate);
      const premiumPerNFT = parseFloat(buyPremium);
      
      if (baseRatePerNFT === 0) {
        return {
          baseRate: '0.000000',
          premium: premiumPerNFT.toFixed(6),
          subtotal: '0.000000',
          fee: '0.000000',
          total: '0.000000',
          isValid: false,
          error: 'No liquidity available for buying NFTs'
        };
      }
      
      // Contract calculation: baseAmount = contractRate * amount, then add 1% fee
      const contractRateFormatted = parseFloat(ethers.utils.formatUnits(contractRate, 18));
      const subtotal = contractRateFormatted * nftAmount; // This includes base + premium
      const fee = subtotal * 0.01; // 1% fee on (base + premium)
      const total = subtotal + fee;
      
      return {
        baseRate: (baseRatePerNFT * nftAmount).toFixed(6),
        premium: (premiumPerNFT * nftAmount).toFixed(6),
        subtotal: subtotal.toFixed(6),
        fee: fee.toFixed(6),
        total: total.toFixed(6),
        isValid: true
      };
    } catch (error) {
      console.error('Error calculating BTB cost:', error);
      return {
        baseRate: '0.000000',
        premium: '5000.000000',
        subtotal: '0.000000',
        fee: '0.000000',
        total: '0.000000',
        isValid: false,
        error: 'Error calculating costs'
      };
    }
  }

  public async calculateBTBReturnForNFTs(nftAmount: number): Promise<{
    baseRate: string;
    subtotal: string;
    fee: string;
    userReceives: string;
    isValid: boolean;
    error?: string;
  }> {
    try {
      // For selling, we use the base rate (no discount applied)
      const baseRate = await this.getSwapRate(); // This is the actual base rate
      
      const baseRatePerNFT = parseFloat(baseRate);
      
      // Check if we have a valid swap rate
      if (baseRatePerNFT === 0) {
        return {
          baseRate: '0.000000',
          subtotal: '0.000000',
          fee: '0.000000',
          userReceives: '0.000000',
          isValid: false,
          error: 'No liquidity available for selling NFTs'
        };
      }
      
      // For selling: baseRate - fee (no discount)
      const subtotal = baseRatePerNFT * nftAmount;
      const fee = subtotal * 0.01; // 1% fee on base rate
      const userReceives = subtotal - fee;
      
      return {
        baseRate: (baseRatePerNFT * nftAmount).toFixed(6),
        subtotal: subtotal.toFixed(6),
        fee: fee.toFixed(6),
        userReceives: userReceives.toFixed(6),
        isValid: true
      };
    } catch (error) {
      console.error('Error calculating BTB return:', error);
      return {
        baseRate: '0.000000',
        subtotal: '0.000000',
        fee: '0.000000',
        userReceives: '0.000000',
        isValid: false,
        error: 'Error calculating returns'
      };
    }
  }

  // ==================== NFT DATA FUNCTIONS ====================

  public async getUserHunters(progressCallback?: (loaded: number, total: number) => void): Promise<any[]> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const cacheKey = `hunters_${address}`;
      
      // Check cache first
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const balance = await this.contract!.balanceOf(address);
      const tokenCount = balance.toNumber();
      
      if (tokenCount === 0) {
        return [];
      }
      
      progressCallback?.(0, tokenCount);
      
      // Use multicall for efficient batching
      const contractInterface = new ethers.utils.Interface(BearHunterEcosystemABI);
      
      // Step 1: Get all token IDs using multicall
      const tokenIdCalls = [];
      for (let i = 0; i < tokenCount; i++) {
        tokenIdCalls.push({
          target: this.gameContractAddress,
          callData: this.encodeFunctionCall(contractInterface, 'tokenOfOwnerByIndex', [address, i])
        });
      }
      
      const tokenIdResults = await this.multicall(tokenIdCalls);
      const tokenIds = tokenIdResults.map(result => 
        contractInterface.decodeFunctionResult('tokenOfOwnerByIndex', result)[0]
      );
      
      // Step 2: Get all hunter data using multicall (more efficient)
      const allDataCalls = [];
      for (const tokenId of tokenIds) {
        allDataCalls.push(
          {
            target: this.gameContractAddress,
            callData: this.encodeFunctionCall(contractInterface, 'getHunterStats', [tokenId])
          },
          {
            target: this.gameContractAddress,
            callData: this.encodeFunctionCall(contractInterface, 'canFeed', [tokenId])
          },
          {
            target: this.gameContractAddress,
            callData: this.encodeFunctionCall(contractInterface, 'canHunt', [tokenId])
          },
          {
            target: this.gameContractAddress,
            callData: this.encodeFunctionCall(contractInterface, 'isHunterActive', [tokenId])
          }
        );
      }
      
      const allDataResults = await this.multicall(allDataCalls);
      
      // Process results
      const hunters = [];
      for (let i = 0; i < tokenIds.length; i++) {
        try {
          const tokenId = tokenIds[i];
          const dataIndex = i * 4;
          
          const stats = contractInterface.decodeFunctionResult('getHunterStats', allDataResults[dataIndex]);
          const canFeed = contractInterface.decodeFunctionResult('canFeed', allDataResults[dataIndex + 1]);
          const canHunt = contractInterface.decodeFunctionResult('canHunt', allDataResults[dataIndex + 2]);
          const isActive = contractInterface.decodeFunctionResult('isHunterActive', allDataResults[dataIndex + 3]);
          
          hunters.push({
            tokenId: tokenId.toString(),
            creationTime: stats[0].toString(),
            lastFeedTime: stats[1].toString(),
            lastHuntTime: stats[2].toString(),
            power: ethers.utils.formatUnits(stats[3], 18),
            missedFeedings: stats[4].toString(),
            inHibernation: stats[5],
            recoveryStartTime: stats[6].toString(),
            totalHunted: ethers.utils.formatUnits(stats[7], 18),
            daysRemaining: stats[8].toString(),
            canFeed: canFeed[0],
            canFeedReason: canFeed[1],
            canHunt: canHunt[0],
            canHuntReason: canHunt[1],
            isActive: isActive[0]
          });
          
          // Report progress every 10 hunters
          if ((i + 1) % 10 === 0 || i === tokenIds.length - 1) {
            progressCallback?.(i + 1, tokenCount);
          }
        } catch (error) {
          console.error(`Error processing hunter ${i}:`, error);
        }
      }
      
      // Cache the results
      this.setCachedData(cacheKey, hunters);
      
      return hunters;
    } catch (error) {
      console.error('Error getting user hunters:', error);
      return [];
    }
  }

  public async getUserBears(): Promise<any[]> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const cacheKey = `bears_${address}`;
      
      // Check cache first
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
        ],
        this.signer!
      );
      
      const balance = await bearContract.balanceOf(address);
      const tokenCount = balance.toNumber();
      
      if (tokenCount === 0) {
        return [];
      }
      
      // Batch fetch token IDs with smaller batch size
      const tokenIdCalls = [];
      for (let i = 0; i < tokenCount; i++) {
        tokenIdCalls.push({
          contract: bearContract,
          method: 'tokenOfOwnerByIndex',
          args: [address, i]
        });
      }
      
      const tokenIds = await this.batchContractCalls(tokenIdCalls, 5);
      const bears = tokenIds.map(tokenId => ({
        tokenId: tokenId.toString()
      }));
      
      // Cache the results
      this.setCachedData(cacheKey, bears);
      
      return bears;
    } catch (error) {
      console.error('Error getting user bears:', error);
      return [];
    }
  }

  // ==================== HUNTER STATS FUNCTIONS ====================

  public async getHunterStats(tokenId: number): Promise<any> {
    try {
      const stats = await this.contract!.getHunterStats(tokenId);
      const canFeed = await this.contract!.canFeed(tokenId);
      const canHunt = await this.contract!.canHunt(tokenId);
      const isActive = await this.contract!.isHunterActive(tokenId);
      
      return {
        creationTime: stats[0].toString(),
        lastFeedTime: stats[1].toString(),
        lastHuntTime: stats[2].toString(),
        power: ethers.utils.formatUnits(stats[3], 18),
        missedFeedings: stats[4].toString(),
        inHibernation: stats[5],
        recoveryStartTime: stats[6].toString(),
        totalHunted: ethers.utils.formatUnits(stats[7], 18),
        daysRemaining: stats[8].toString(),
        canFeed: canFeed[0],
        canFeedReason: canFeed[1],
        canHunt: canHunt[0],
        canHuntReason: canHunt[1],
        isActive
      };
    } catch (error) {
      console.error('Error getting hunter stats:', error);
      throw error;
    }
  }

  // ==================== PROGRESSIVE LOADING FUNCTIONS ====================

  public async *getUserHuntersProgressive(): AsyncGenerator<{ hunters: any[], loaded: number, total: number }> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const cacheKey = `hunters_${address}`;
      
      // Check cache first
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        yield { hunters: cachedData, loaded: cachedData.length, total: cachedData.length };
        return;
      }
      
      const balance = await this.contract!.balanceOf(address);
      const tokenCount = balance.toNumber();
      
      if (tokenCount === 0) {
        yield { hunters: [], loaded: 0, total: 0 };
        return;
      }
      
      const contractInterface = new ethers.utils.Interface(BearHunterEcosystemABI);
      
      // Get all token IDs first using multicall
      const tokenIdCalls = [];
      for (let i = 0; i < tokenCount; i++) {
        tokenIdCalls.push({
          target: this.gameContractAddress,
          callData: this.encodeFunctionCall(contractInterface, 'tokenOfOwnerByIndex', [address, i])
        });
      }
      
      const tokenIdResults = await this.multicall(tokenIdCalls);
      const tokenIds = tokenIdResults.map(result => 
        contractInterface.decodeFunctionResult('tokenOfOwnerByIndex', result)[0]
      );
      
      // Process hunters in batches using multicall
      const hunters = [];
      const batchSize = 25; // Larger batches since multicall is more efficient
      
      for (let i = 0; i < tokenIds.length; i += batchSize) {
        const batchTokenIds = tokenIds.slice(i, i + batchSize);
        
        // Create multicall for this batch
        const batchDataCalls = [];
        for (const tokenId of batchTokenIds) {
          batchDataCalls.push(
            {
              target: this.gameContractAddress,
              callData: this.encodeFunctionCall(contractInterface, 'getHunterStats', [tokenId])
            },
            {
              target: this.gameContractAddress,
              callData: this.encodeFunctionCall(contractInterface, 'canFeed', [tokenId])
            },
            {
              target: this.gameContractAddress,
              callData: this.encodeFunctionCall(contractInterface, 'canHunt', [tokenId])
            },
            {
              target: this.gameContractAddress,
              callData: this.encodeFunctionCall(contractInterface, 'isHunterActive', [tokenId])
            }
          );
        }
        
        const batchDataResults = await this.multicall(batchDataCalls);
        
        // Process this batch
        for (let j = 0; j < batchTokenIds.length; j++) {
          try {
            const tokenId = batchTokenIds[j];
            const dataIndex = j * 4;
            
            const stats = contractInterface.decodeFunctionResult('getHunterStats', batchDataResults[dataIndex]);
            const canFeed = contractInterface.decodeFunctionResult('canFeed', batchDataResults[dataIndex + 1]);
            const canHunt = contractInterface.decodeFunctionResult('canHunt', batchDataResults[dataIndex + 2]);
            const isActive = contractInterface.decodeFunctionResult('isHunterActive', batchDataResults[dataIndex + 3]);
            
            hunters.push({
              tokenId: tokenId.toString(),
              creationTime: stats[0].toString(),
              lastFeedTime: stats[1].toString(),
              lastHuntTime: stats[2].toString(),
              power: ethers.utils.formatUnits(stats[3], 18),
              missedFeedings: stats[4].toString(),
              inHibernation: stats[5],
              recoveryStartTime: stats[6].toString(),
              totalHunted: ethers.utils.formatUnits(stats[7], 18),
              daysRemaining: stats[8].toString(),
              canFeed: canFeed[0],
              canFeedReason: canFeed[1],
              canHunt: canHunt[0],
              canHuntReason: canHunt[1],
              isActive: isActive[0]
            });
          } catch (error) {
            console.error(`Error processing hunter ${i + j}:`, error);
          }
        }
        
        // Yield current progress
        yield { hunters: [...hunters], loaded: hunters.length, total: tokenCount };
        
        // Minimal delay between batches since multicall is more efficient
        if (i + batchSize < tokenIds.length) {
          await this.delay(50);
        }
      }
      
      // Cache the final results
      this.setCachedData(cacheKey, hunters);
      
    } catch (error) {
      console.error('Error getting user hunters:', error);
      yield { hunters: [], loaded: 0, total: 0 };
    }
  }

  // ==================== PAGINATION FUNCTIONS ====================

  public async loadMoreHunters(currentCount: number, batchSize: number = 25): Promise<any[]> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const balance = await this.contract!.balanceOf(address);
      
      if (currentCount >= balance.toNumber()) {
        return [];
      }
      
      const endCount = Math.min(currentCount + batchSize, balance.toNumber());
      const tokenIdCalls = [];
      
      for (let i = currentCount; i < endCount; i++) {
        tokenIdCalls.push({
          contract: this.contract!,
          method: 'tokenOfOwnerByIndex',
          args: [address, i]
        });
      }
      
      const tokenIds = await this.batchContractCalls(tokenIdCalls);
      
      // Batch fetch all hunter data
      const hunterDataCalls = [];
      for (const tokenId of tokenIds) {
        hunterDataCalls.push(
          { contract: this.contract!, method: 'getHunterStats', args: [tokenId] },
          { contract: this.contract!, method: 'canFeed', args: [tokenId] },
          { contract: this.contract!, method: 'canHunt', args: [tokenId] },
          { contract: this.contract!, method: 'isHunterActive', args: [tokenId] }
        );
      }
      
      const hunterDataResults = await this.batchContractCalls(hunterDataCalls);
      
      // Process the results
      const hunters = [];
      for (let i = 0; i < tokenIds.length; i++) {
        try {
          const tokenId = tokenIds[i];
          const statsIndex = i * 4;
          const stats = hunterDataResults[statsIndex];
          const canFeed = hunterDataResults[statsIndex + 1];
          const canHunt = hunterDataResults[statsIndex + 2];
          const isActive = hunterDataResults[statsIndex + 3];
          
          hunters.push({
            tokenId: tokenId.toString(),
            creationTime: stats[0].toString(),
            lastFeedTime: stats[1].toString(),
            lastHuntTime: stats[2].toString(),
            power: ethers.utils.formatUnits(stats[3], 18),
            missedFeedings: stats[4].toString(),
            inHibernation: stats[5],
            recoveryStartTime: stats[6].toString(),
            totalHunted: ethers.utils.formatUnits(stats[7], 18),
            daysRemaining: stats[8].toString(),
            canFeed: canFeed[0],
            canFeedReason: canFeed[1],
            canHunt: canHunt[0],
            canHuntReason: canHunt[1],
            isActive
          });
        } catch (error) {
          console.error(`Error processing hunter ${i}:`, error);
        }
      }
      
      return hunters;
    } catch (error) {
      console.error('Error loading more hunters:', error);
      return [];
    }
  }

  public async loadMoreBears(currentCount: number, batchSize: number = 25): Promise<any[]> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
        ],
        this.signer!
      );
      
      const balance = await bearContract.balanceOf(address);
      
      if (currentCount >= balance.toNumber()) {
        return [];
      }
      
      const endCount = Math.min(currentCount + batchSize, balance.toNumber());
      const tokenIdCalls = [];
      
      for (let i = currentCount; i < endCount; i++) {
        tokenIdCalls.push({
          contract: bearContract,
          method: 'tokenOfOwnerByIndex',
          args: [address, i]
        });
      }
      
      const tokenIds = await this.batchContractCalls(tokenIdCalls);
      const bears = tokenIds.map(tokenId => ({
        tokenId: tokenId.toString()
      }));
      
      return bears;
    } catch (error) {
      console.error('Error loading more bears:', error);
      return [];
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  public invalidateCache(): void {
    this.clearCache();
  }

  // ==================== CONTRACT INFO FUNCTIONS ====================

  public async getContractAddresses(): Promise<any> {
    return {
      gameContract: this.gameContractAddress,
      mimoToken: this.mimoTokenAddress,
      btbToken: this.btbTokenAddress,
      bearNFT: this.bearNFTAddress,
      btbSwapLogic: this.btbSwapLogicAddress
    };
  }
}

// Create a singleton instance
const gameService = new GameService();
export default gameService;