import { ethers } from 'ethers';
import BearHunterEcosystemABI from '../abi/BearHunterEcosystem.json';
import StakingABI from '../abi/staking.json';
import BTBSwapLogicABI from '../abi/BTBSwapLogic.json';

// Base network configuration
const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://mainnet-preconf.base.org',
  blockExplorer: 'https://basescan.org',
};

class GameService {
  private contract: ethers.Contract | null = null;
  private stakingContract: ethers.Contract | null = null;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;
  
  // Caching mechanism
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  // Contract addresses - Version 0.9.2 - PRODUCTION READY
  private readonly gameContractAddress = '0x25bB56840715242C1E140d4125F0cc283B1Df717'; // BearHunterEcosystem
  private readonly mimoTokenAddress = '0x4060244A1B59A6395747c3b6f322dF4c1F04e5f6'; // MiMo Token
  private readonly btbTokenAddress = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488'; // BTB Token (Existing)
  private readonly bearNFTAddress = '0x000081733751860A8E5BA00FdCF7000b53E90dDD'; // BEAR NFT (Existing)
  private readonly btbSwapLogicAddress = '0x84dddA499a92754863CAC64dA83D21b892fB2b37'; // BTBSwapLogic
  private readonly stakingContractAddress = '0x891dBd50DAeB51BFeDf1cEB51ED30E0C4846b330'; // Staking Contract
  private readonly lpTokenAddress = '0xA93b1f2A2D66FA476ca84Ead39A6fCD72bA957EC'; // LP Token

  constructor() {
    // Initialize the read-only provider
    this.provider = new ethers.JsonRpcProvider(
      BASE_NETWORK.rpcUrl,
      {
        chainId: BASE_NETWORK.chainId,
        name: BASE_NETWORK.name,
        ensAddress: undefined
      }
    );

    // Initialize contracts with provider
    this.contract = new ethers.Contract(
      this.gameContractAddress,
      BearHunterEcosystemABI,
      this.provider
    );

    this.stakingContract = new ethers.Contract(
      this.stakingContractAddress,
      StakingABI,
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
      const injectedProvider = new ethers.BrowserProvider(window.ethereum, {
        chainId: BASE_NETWORK.chainId,
        name: BASE_NETWORK.name,
        ensAddress: undefined
      });
      
      this.signer = injectedProvider.getSigner();
      
      // Debug ABI import
      console.log('BearHunterEcosystemABI type:', typeof BearHunterEcosystemABI);
      console.log('BearHunterEcosystemABI isArray:', Array.isArray(BearHunterEcosystemABI));
      console.log('BearHunterEcosystemABI length:', BearHunterEcosystemABI?.length);
      
      // Find depositBears in ABI
      const depositBearsFuncs = BearHunterEcosystemABI.filter((item: any) => 
        item.type === 'function' && item.name === 'depositBears'
      );
      console.log('depositBears functions found in ABI:', depositBearsFuncs.length);
      console.log('depositBears function details:', depositBearsFuncs);

      // Initialize contracts with signer
      this.contract = new ethers.Contract(
        this.gameContractAddress,
        BearHunterEcosystemABI,
        this.signer
      );

      this.stakingContract = new ethers.Contract(
        this.stakingContractAddress,
        StakingABI,
        this.signer
      );

      // Debug contract methods
      console.log('Contract created. Checking for depositBears method...');
      console.log('typeof contract.depositBears:', typeof this.contract.depositBears);
      console.log('depositBears exists:', 'depositBears' in this.contract);
      
      // List all available functions on the contract
      const contractMethods = this.contract ? Object.getOwnPropertyNames(this.contract)
        .filter(prop => typeof this.contract![prop] === 'function')
        .sort() : [];
      console.log('Available contract methods:', contractMethods);

      // Check if we can find depositBears in different ways
      console.log('contract["depositBears"]:', this.contract["depositBears"]);
      console.log('contract.functions.depositBears:', this.contract.functions?.depositBears);

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
    this.stakingContract = new ethers.Contract(
      this.stakingContractAddress,
      StakingABI,
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
      
      // First try: Check if this is actually part of the game contract (internal balance)
      try {
        // Some game contracts track MiMo as internal balances
        const gameBalance = await this.contract!.getMiMoBalance(address);
        return ethers.formatUnits(gameBalance, 18);
      } catch (error) {
        console.log('No internal MiMo balance function, trying external token contract');
      }
      
      // Second try: Standard ERC20 token contract
      const mimoContract = new ethers.Contract(
        this.mimoTokenAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        this.provider!
      );
      
      try {
        const balance = await mimoContract.balanceOf(address);
        let decimals = 18;
        try {
          decimals = await mimoContract.decimals();
        } catch (e) {
          console.warn('Could not get MiMo decimals, using 18');
        }
        return ethers.formatUnits(balance, decimals);
      } catch (error) {
        console.error('Error calling MiMo token contract - may not be a standard ERC20:', error);
        
        // Third try: Maybe it's a different interface
        try {
          // Some contracts use different function names
          const altMimoContract = new ethers.Contract(
            this.mimoTokenAddress,
            ['function balance(address) view returns (uint256)'],
            this.provider!
          );
          const balance = await altMimoContract.balance(address);
          return ethers.formatUnits(balance, 18);
        } catch (altError) {
          console.error('Alternative MiMo balance methods also failed:', altError);
          return '0';
        }
      }
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
      return ethers.formatUnits(balance, 18);
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
      // Validate inputs
      if (!bearIds || bearIds.length === 0) {
        throw new Error('No bear IDs provided');
      }

      console.log('Starting depositBears with IDs:', bearIds);
      console.log('Contract available:', !!this.contract);
      console.log('Signer available:', !!this.signer);

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
        console.log('Setting approval for Bear NFTs...');
        const approveTx = await bearContract.setApprovalForAll(this.gameContractAddress, true);
        await approveTx.wait();
        console.log('Approval set successfully');
      }
      
      // Try different approaches to call depositBears
      let tx: ethers.ContractTransaction;
      
      // Method 1: Direct function call - handle overloaded function
      if (typeof this.contract!.depositBears === 'function') {
        console.log('Using direct method call');
        try {
          // Try the single parameter version first
          tx = await this.contract!['depositBears(uint256[])'](bearIds);
        } catch (e) {
          // Fallback to basic call
          tx = await this.contract!.depositBears(bearIds);
        }
      }
      // Method 2: Using contract.functions with specific signature
      else if (this.contract!.functions && this.contract!.functions['depositBears(uint256[])']) {
        console.log('Using contract.functions approach');
        tx = await this.contract!.functions['depositBears(uint256[])'](bearIds);
      }
      // Method 3: Using bracket notation with specific signature
      else if (this.contract!['depositBears(uint256[])']) {
        console.log('Using bracket notation with signature');
        tx = await this.contract!['depositBears(uint256[])'](bearIds);
      }
      // Method 3b: Using bracket notation without signature
      else if (this.contract!["depositBears"]) {
        console.log('Using bracket notation');
        tx = await this.contract!["depositBears"](bearIds);
      }
      // Method 4: Try with interface encoding (specify the exact function signature)
      else {
        console.log('Using interface encoding approach');
        const iface = new ethers.utils.Interface(BearHunterEcosystemABI);
        
        // Use the single-parameter version: depositBears(uint256[])
        const data = iface.encodeFunctionData('depositBears(uint256[])', [bearIds]);
        
        tx = await this.signer!.sendTransaction({
          to: this.gameContractAddress,
          data: data
        });
      }
      
      console.log('Transaction created:', tx.hash);
      return tx;
    } catch (error: any) {
      console.error('Error depositing bears:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('function selector was not recognized')) {
        throw new Error('Contract does not support depositBears function. Please check the contract address.');
      } else if (error.message?.includes('user rejected')) {
        throw new Error('Transaction was cancelled by user');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient funds for transaction');
      } else {
        throw new Error(`Failed to deposit bears: ${error.message || 'Unknown error'}`);
      }
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

  public async redeemBears(count: number, hunterIds: number[]): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // For now, try direct redemption - the contract may handle MiMo internally
      // If this fails, we'll know we need approval
      try {
        const tx = await this.contract!.redeemBears(count, hunterIds);
        return tx;
      } catch (error: any) {
        // If error mentions approval or allowance, try to approve MiMo tokens
        if (error.message && (error.message.includes('allowance') || error.message.includes('approve'))) {
          console.log('Approval required, attempting to approve MiMo tokens...');
          
          // Calculate required MiMo amount (1M per bear + 10% fee)
          const REDEMPTION_COST = 1000000; // 1M MiMo per Bear
          const REDEMPTION_FEE = 0.1; // 10% fee
          const totalCost = count * REDEMPTION_COST;
          const feeAmount = totalCost * REDEMPTION_FEE;
          const totalWithFee = totalCost + feeAmount;
          const requiredAmount = ethers.parseUnits(totalWithFee.toString(), 18);

          // Approve MiMo tokens for the game contract
          const mimoContract = new ethers.Contract(
            this.mimoTokenAddress,
            [
              'function approve(address spender, uint256 amount) external returns (bool)',
              'function allowance(address owner, address spender) view returns (uint256)'
            ],
            this.signer!
          );
          
          const address = await this.signer!.getAddress();
          const allowance = await mimoContract.allowance(address, this.gameContractAddress);
          
          if (allowance.LT_TEMP(requiredAmount)) {
            const approveTx = await mimoContract.approve(this.gameContractAddress, requiredAmount);
            await approveTx.wait();
          }

          // Retry the redemption
          const tx = await this.contract!.redeemBears(count, hunterIds);
          return tx;
        } else {
          // Re-throw the original error if it's not approval related
          throw error;
        }
      }
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
      const buyPremiumWei = ethers.parseUnits(buyPremium, 18);
      
      let baseRate = rate;
      if (rate.gt(buyPremiumWei)) {
        baseRate = rate.sub(buyPremiumWei);
      } else {
        baseRate = BigInt('0');
      }
      
      return ethers.formatUnits(baseRate, 18); // BTB has 18 decimals
    } catch (error) {
      console.error('Error getting swap rate:', error);
      return '0';
    }
  }

  public async getBuyPremium(): Promise<string> {
    try {
      // Use the BTBSwapLogic contract address directly
      const swapContract = new ethers.Contract(
        this.btbSwapLogicAddress,
        [
          'function buyPremium() view returns (uint256)'
        ],
        this.provider!
      );
      
      const premium = await swapContract.buyPremium();
      return ethers.formatUnits(premium, 18); // BTB has 18 decimals
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
      const baseAmount = ethers.parseUnits(
        ((parseFloat(swapRate) + parseFloat(buyPremium)) * nftAmount).toString(), 
        18
      );
      
      // Add 1% swap fee
      const feeAmount = baseAmount.MUL_TEMP(100).div(10000); // 1% fee
      const totalAmount = baseAmount.ADD_TEMP(feeAmount);
      
      // First approve BTB tokens for the BTBSwapLogic contract
      const btbContract = new ethers.Contract(
        this.btbTokenAddress,
        [
          'function approve(address spender, uint256 amount) external returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        this.signer!
      );
      
      const address = await this.signer!.getAddress();
      const allowance = await btbContract.allowance(address, this.btbSwapLogicAddress);
      
      if (allowance.LT_TEMP(totalAmount)) {
        const approveTx = await btbContract.approve(this.btbSwapLogicAddress, totalAmount);
        await approveTx.wait();
      }
      
      // Call BTBSwapLogic contract with correct signature
      const swapContract = new ethers.Contract(
        this.btbSwapLogicAddress,
        BTBSwapLogicABI,
        this.signer!
      );
      
      const tx = await swapContract.swapBTBForNFT(address, nftAmount);
      return tx;
    } catch (error) {
      console.error('Error swapping BTB for NFT:', error);
      throw error;
    }
  }

  public async swapNFTForBTB(tokenIds: number[]): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // First approve NFTs for the BTBSwapLogic contract
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        [
          'function setApprovalForAll(address operator, bool approved) external',
          'function isApprovedForAll(address owner, address operator) view returns (bool)'
        ],
        this.signer!
      );
      
      const address = await this.signer!.getAddress();
      const isApproved = await bearContract.isApprovedForAll(address, this.btbSwapLogicAddress);
      
      if (!isApproved) {
        const approveTx = await bearContract.setApprovalForAll(this.btbSwapLogicAddress, true);
        await approveTx.wait();
      }
      
      // Call BTBSwapLogic contract with correct signature
      const swapContract = new ethers.Contract(
        this.btbSwapLogicAddress,
        BTBSwapLogicABI,
        this.signer!
      );
      
      const tx = await swapContract.swapNFTForBTB(address, tokenIds);
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
      // Use the BTBSwapLogic contract address directly
      const btbContract = new ethers.Contract(
        this.btbTokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider!
      );
      
      const nftContract = new ethers.Contract(
        this.bearNFTAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider!
      );
      
      // Get balances of the BTBSwapLogic contract
      const btbBalance = await btbContract.balanceOf(this.btbSwapLogicAddress);
      const nftBalance = await nftContract.balanceOf(this.btbSwapLogicAddress);
      
      const btbBalanceFormatted = ethers.formatUnits(btbBalance, 18);
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
      const contractRateFormatted = parseFloat(ethers.formatUnits(contractRate, 18));
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
      const tokenCount = balanceNumber(;
      
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
            power: ethers.formatUnits(stats[3], 18),
            missedFeedings: stats[4].toString(),
            inHibernation: stats[5],
            recoveryStartTime: stats[6].toString(),
            totalHunted: ethers.formatUnits(stats[7], 18),
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
      const tokenCount = balanceNumber(;
      
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
        power: ethers.formatUnits(stats[3], 18),
        missedFeedings: stats[4].toString(),
        inHibernation: stats[5],
        recoveryStartTime: stats[6].toString(),
        totalHunted: ethers.formatUnits(stats[7], 18),
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
      const tokenCount = balanceNumber(;
      
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
              power: ethers.formatUnits(stats[3], 18),
              missedFeedings: stats[4].toString(),
              inHibernation: stats[5],
              recoveryStartTime: stats[6].toString(),
              totalHunted: ethers.formatUnits(stats[7], 18),
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
      
      if (currentCount >= balanceNumber() {
        return [];
      }
      
      const endCount = Math.min(currentCount + batchSize, balanceNumber();
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
            power: ethers.formatUnits(stats[3], 18),
            missedFeedings: stats[4].toString(),
            inHibernation: stats[5],
            recoveryStartTime: stats[6].toString(),
            totalHunted: ethers.formatUnits(stats[7], 18),
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
      
      if (currentCount >= balanceNumber() {
        return [];
      }
      
      const endCount = Math.min(currentCount + batchSize, balanceNumber();
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
      btbSwapLogic: this.btbSwapLogicAddress,
      stakingContract: this.stakingContractAddress,
      lpToken: this.lpTokenAddress
    };
  }


  // ==================== STAKING FUNCTIONS ====================

  public async getLPTokenBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const lpContract = new ethers.Contract(
        this.lpTokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        this.signer!
      );
      const balance = await lpContract.balanceOf(address);
      return ethers.formatUnits(balance, 18);
    } catch (error) {
      console.error('Error getting LP token balance:', error);
      return '0';
    }
  }

  public async getStakingInfo(): Promise<{
    totalStaked: string;
    rewardRate: string;
    periodFinish: string;
    rewardPerToken: string;
    apr: string;
  }> {
    try {
      const cacheKey = 'staking_global_info';
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData) {
        return cachedData;
      }

      // Get global info first
      const globalInfo = await this.stakingContract!.getGlobalInfo();
      
      // Calculate APR manually since contract getAPR() might be failing
      const totalStaked = globalInfo._totalStaked;
      const rewardRate = globalInfo._rewardRate;
      
      let calculatedAPR = '0';
      if (!totalStaked.isZero() && !rewardRate.isZero()) {
        // APR = (rewardRate * seconds per year) / totalStaked * 100
        const secondsPerYear = BigInt('31536000'); // 365 * 24 * 3600
        const annualRewards = rewardRate.MUL_TEMP(secondsPerYear);
        
        // Calculate percentage: (annualRewards / totalStaked) * 100
        // Using precision scaling to avoid floating point issues
        const aprBasisPoints = annualRewards.MUL_TEMP(10000).div(totalStaked); // multiply by 10000 for basis points
        calculatedAPR = ethers.formatUnits(aprBasisPoints, 2); // divide by 100 to get percentage
      }

      const result = {
        totalStaked: ethers.formatUnits(globalInfo._totalStaked, 18),
        rewardRate: ethers.formatUnits(globalInfo._rewardRate, 18),
        periodFinish: globalInfo._periodFinish.toString(),
        rewardPerToken: ethers.formatUnits(globalInfo._rewardPerToken, 18),
        apr: calculatedAPR
      };

      this.setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error getting staking info:', error);
      return {
        totalStaked: '0',
        rewardRate: '0',
        periodFinish: '0',
        rewardPerToken: '0',
        apr: '0'
      };
    }
  }

  public async getUserStakingInfo(): Promise<{
    stakedAmount: string;
    earnedRewards: string;
    pendingRewards: string;
  }> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const userInfo = await this.stakingContract!.getUserInfo(address);
      
      return {
        stakedAmount: ethers.formatUnits(userInfo.staked, 18),
        earnedRewards: ethers.formatUnits(userInfo.earnedRewards, 18),
        pendingRewards: ethers.formatUnits(userInfo.pendingRewards, 18)
      };
    } catch (error) {
      console.error('Error getting user staking info:', error);
      return {
        stakedAmount: '0',
        earnedRewards: '0',
        pendingRewards: '0'
      };
    }
  }

  public async stake(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // First approve LP tokens
      const lpContract = new ethers.Contract(
        this.lpTokenAddress,
        [
          'function approve(address spender, uint256 amount) external returns (bool)',
          'function allowance(address owner, address spender) view returns (uint256)'
        ],
        this.signer!
      );
      
      const address = await this.signer!.getAddress();
      const stakeAmount = ethers.parseUnits(amount, 18);
      const allowance = await lpContract.allowance(address, this.stakingContractAddress);
      
      if (allowance.LT_TEMP(stakeAmount)) {
        const approveTx = await lpContract.approve(this.stakingContractAddress, stakeAmount);
        await approveTx.wait();
      }
      
      // Stake LP tokens
      const tx = await this.stakingContract!.stake(stakeAmount);
      return tx;
    } catch (error) {
      console.error('Error staking:', error);
      throw error;
    }
  }

  public async unstake(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      const unstakeAmount = ethers.parseUnits(amount, 18);
      const tx = await this.stakingContract!.unstake(unstakeAmount);
      return tx;
    } catch (error) {
      console.error('Error unstaking:', error);
      throw error;
    }
  }

  public async claimRewards(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      const tx = await this.stakingContract!.claimRewards();
      return tx;
    } catch (error) {
      console.error('Error claiming rewards:', error);
      throw error;
    }
  }

  public async emergencyUnstake(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      const tx = await this.stakingContract!.emergencyUnstake();
      return tx;
    } catch (error) {
      console.error('Error emergency unstaking:', error);
      throw error;
    }
  }

  public async getEarnedRewards(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const earned = await this.stakingContract!.earned(address);
      return ethers.formatUnits(earned, 18);
    } catch (error) {
      console.error('Error getting earned rewards:', error);
      return '0';
    }
  }

  // ==================== HUNT TIMING FUNCTIONS ====================

  public async getHuntCooldown(): Promise<number> {
    await this.ensureInitialized();
    try {
      const cooldown = await this.contract!.HUNT_COOLDOWN();
      return cooldownNumber(;
    } catch (error) {
      console.error('Error getting hunt cooldown:', error);
      return 0;
    }
  }

  public async getNextHuntTime(tokenId: number): Promise<{
    nextHuntTime: number;
    timeUntilNextHunt: number;
    canHuntNow: boolean;
    formattedTimeRemaining: string;
  }> {
    await this.ensureInitialized();
    try {
      const [hunterStats, cooldown] = await Promise.all([
        this.contract!.getHunterStats(tokenId),
        this.contract!.HUNT_COOLDOWN()
      ]);

      const lastHuntTime = hunterStats.lastHuntTimeNumber(;
      const cooldownSeconds = cooldownNumber(;
      const nextHuntTime = lastHuntTime + cooldownSeconds;
      const currentTime = Math.floor(Date.now() / 1000);
      const timeUntilNextHunt = Math.max(0, nextHuntTime - currentTime);
      const canHuntNow = timeUntilNextHunt === 0;

      // Format remaining time
      let formattedTimeRemaining = '';
      if (timeUntilNextHunt > 0) {
        const hours = Math.floor(timeUntilNextHunt / 3600);
        const minutes = Math.floor((timeUntilNextHunt % 3600) / 60);
        const seconds = timeUntilNextHunt % 60;
        
        if (hours > 0) {
          formattedTimeRemaining = `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
          formattedTimeRemaining = `${minutes}m ${seconds}s`;
        } else {
          formattedTimeRemaining = `${seconds}s`;
        }
      } else {
        formattedTimeRemaining = 'Ready to hunt!';
      }

      return {
        nextHuntTime,
        timeUntilNextHunt,
        canHuntNow,
        formattedTimeRemaining
      };
    } catch (error) {
      console.error('Error calculating next hunt time:', error);
      return {
        nextHuntTime: 0,
        timeUntilNextHunt: 0,
        canHuntNow: false,
        formattedTimeRemaining: 'Error'
      };
    }
  }

  public async getHuntTimingForHunters(tokenIds: number[]): Promise<{[tokenId: number]: {
    nextHuntTime: number;
    timeUntilNextHunt: number;
    canHuntNow: boolean;
    formattedTimeRemaining: string;
  }}> {
    await this.ensureInitialized();
    try {
      const cooldown = await this.contract!.HUNT_COOLDOWN();
      const cooldownSeconds = cooldownNumber(;
      const currentTime = Math.floor(Date.now() / 1000);

      // Batch get hunter stats
      const contractInterface = new ethers.utils.Interface(BearHunterEcosystemABI);
      const calls = tokenIds.map(tokenId => ({
        target: this.gameContractAddress,
        callData: this.encodeFunctionCall(contractInterface, 'getHunterStats', [tokenId])
      }));

      const results = await this.multicall(calls);
      const huntTiming: {[tokenId: number]: any} = {};

      tokenIds.forEach((tokenId, index) => {
        try {
          const stats = contractInterface.decodeFunctionResult('getHunterStats', results[index]);
          const lastHuntTime = stats.lastHuntTimeNumber(;
          const nextHuntTime = lastHuntTime + cooldownSeconds;
          const timeUntilNextHunt = Math.max(0, nextHuntTime - currentTime);
          const canHuntNow = timeUntilNextHunt === 0;

          // Format remaining time
          let formattedTimeRemaining = '';
          if (timeUntilNextHunt > 0) {
            const hours = Math.floor(timeUntilNextHunt / 3600);
            const minutes = Math.floor((timeUntilNextHunt % 3600) / 60);
            const seconds = timeUntilNextHunt % 60;
            
            if (hours > 0) {
              formattedTimeRemaining = `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
              formattedTimeRemaining = `${minutes}m ${seconds}s`;
            } else {
              formattedTimeRemaining = `${seconds}s`;
            }
          } else {
            formattedTimeRemaining = 'Ready to hunt!';
          }

          huntTiming[tokenId] = {
            nextHuntTime,
            timeUntilNextHunt,
            canHuntNow,
            formattedTimeRemaining
          };
        } catch (error) {
          console.error(`Error processing hunt timing for hunter ${tokenId}:`, error);
          huntTiming[tokenId] = {
            nextHuntTime: 0,
            timeUntilNextHunt: 0,
            canHuntNow: false,
            formattedTimeRemaining: 'Error'
          };
        }
      });

      return huntTiming;
    } catch (error) {
      console.error('Error getting hunt timing for hunters:', error);
      return {};
    }
  }
}

// Create a singleton instance
const gameService = new GameService();
export default gameService;