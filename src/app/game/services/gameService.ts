import { ethers } from 'ethers';
import BearHunterEcosystemABI from '../abi/BearHunterEcosystem.json';

// Base network configuration
const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
};

class GameService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract addresses
  private readonly gameContractAddress = '0xc371c5B552F772b0Db406BD32212f9717DbEA6d3'; // BearHunterEcosystem
  private readonly mimoTokenAddress = '0xC96Bb66Cbc6a2e29Fc58A59407Cb8c9067016BaE'; // MiMoGaMe Token
  private readonly btbTokenAddress = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488'; // BTB Token
  private readonly bearNFTAddress = '0x000081733751860A8E5BA00FdCF7000b53E90dDD'; // BTB NFT
  private readonly btbSwapLogicAddress = '0x770E93Be2830DB16c153c825aA31427c59242249'; // BTBSwapLogic

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
      
      return ethers.utils.formatUnits(rate, 18); // BTB has 18 decimals
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
      const swapRate = await this.getSwapRate();
      const buyPremium = await this.getBuyPremium();
      
      const baseRatePerNFT = parseFloat(swapRate);
      const premiumPerNFT = parseFloat(buyPremium);
      
      // Check if we have a valid swap rate
      if (baseRatePerNFT === 0) {
        return {
          baseRate: '0',
          premium: premiumPerNFT.toFixed(4),
          subtotal: '0',
          fee: '0',
          total: '0',
          isValid: false,
          error: 'No liquidity available for buying NFTs'
        };
      }
      
      const subtotalPerNFT = baseRatePerNFT + premiumPerNFT;
      const subtotal = subtotalPerNFT * nftAmount;
      const fee = subtotal * 0.01; // 1% fee
      const total = subtotal + fee;
      
      return {
        baseRate: (baseRatePerNFT * nftAmount).toFixed(4),
        premium: (premiumPerNFT * nftAmount).toFixed(4),
        subtotal: subtotal.toFixed(4),
        fee: fee.toFixed(4),
        total: total.toFixed(4),
        isValid: true
      };
    } catch (error) {
      console.error('Error calculating BTB cost:', error);
      return {
        baseRate: '0',
        premium: '5000',
        subtotal: '0',
        fee: '0',
        total: '0',
        isValid: false,
        error: 'Error calculating costs'
      };
    }
  }

  public async calculateBTBReturnForNFTs(nftAmount: number): Promise<{
    baseRate: string;
    discount: string;
    subtotal: string;
    fee: string;
    userReceives: string;
    isValid: boolean;
    error?: string;
  }> {
    try {
      const swapRate = await this.getSwapRate();
      const sellDiscount = 5000; // 5000 BTB discount when selling
      
      const baseRatePerNFT = parseFloat(swapRate);
      const discountPerNFT = sellDiscount; // 5000 BTB discount per NFT
      
      // Check if we have a valid swap rate
      if (baseRatePerNFT === 0) {
        return {
          baseRate: '0',
          discount: (discountPerNFT * nftAmount).toFixed(4),
          subtotal: '0',
          fee: '0',
          userReceives: '0',
          isValid: false,
          error: 'No liquidity available for selling NFTs'
        };
      }
      
      const subtotalPerNFT = Math.max(0, baseRatePerNFT - discountPerNFT);
      const subtotal = subtotalPerNFT * nftAmount;
      const fee = subtotal * 0.01; // 1% fee
      const userReceives = subtotal - fee;
      
      return {
        baseRate: (baseRatePerNFT * nftAmount).toFixed(4),
        discount: (discountPerNFT * nftAmount).toFixed(4),
        subtotal: subtotal.toFixed(4),
        fee: fee.toFixed(4),
        userReceives: Math.max(0, userReceives).toFixed(4),
        isValid: true
      };
    } catch (error) {
      console.error('Error calculating BTB return:', error);
      return {
        baseRate: '0',
        discount: '5000',
        subtotal: '0',
        fee: '0',
        userReceives: '0',
        isValid: false,
        error: 'Error calculating returns'
      };
    }
  }

  // ==================== NFT DATA FUNCTIONS ====================

  public async getUserHunters(): Promise<any[]> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const balance = await this.contract!.balanceOf(address);
      const hunters = [];
      
      for (let i = 0; i < balance.toNumber(); i++) {
        try {
          const tokenId = await this.contract!.tokenOfOwnerByIndex(address, i);
          const stats = await this.contract!.getHunterStats(tokenId);
          const canFeed = await this.contract!.canFeed(tokenId);
          const canHunt = await this.contract!.canHunt(tokenId);
          const isActive = await this.contract!.isHunterActive(tokenId);
          
          hunters.push({
            tokenId: tokenId.toString(),
            creationTime: stats[0].toString(),
            lastFeedTime: stats[1].toString(),
            lastHuntTime: stats[2].toString(),
            power: ethers.utils.formatUnits(stats[3], 0), // Power is stored as integer
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
          console.error(`Error getting hunter ${i}:`, error);
        }
      }
      
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
      const bearContract = new ethers.Contract(
        this.bearNFTAddress,
        [
          'function balanceOf(address) view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)'
        ],
        this.signer!
      );
      
      const balance = await bearContract.balanceOf(address);
      const bears = [];
      
      for (let i = 0; i < balance.toNumber(); i++) {
        try {
          const tokenId = await bearContract.tokenOfOwnerByIndex(address, i);
          bears.push({
            tokenId: tokenId.toString()
          });
        } catch (error) {
          console.error(`Error getting bear ${i}:`, error);
        }
      }
      
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
        power: ethers.utils.formatUnits(stats[3], 0),
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