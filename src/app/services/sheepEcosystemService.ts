// @ts-nocheck
import { ethers } from 'ethers';

// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

// Import ABIs
const SHEEPABI = require('../sheepcoin/sheepcoinabi.json');
const SHEEPDOGABI = require('../sheepcoin/sheepdogabi.json');
const WOLFABI = require('../sheepcoin/wolfabi.json');
const ROUTERABI = require('../sheepcoin/routerabi.json');

// Base network configuration
const SONIC_NETWORK = {
  chainId: 0x92, // 146 - Sonic Mainnet
  name: 'Sonic Mainnet',
  rpcUrl: 'https://sonic-rpc.publicnode.com',
  rpcUrls: [
    'https://sonic-rpc.publicnode.com',
    'https://sonic.callstaticrpc.com',
    'https://sonic.drpc.org',
    'https://rpc.soniclabs.com'
  ],
  blockExplorer: 'https://sonicscan.org',
};

export class SheepEcosystemService {
  private sheepContract: ethers.Contract | null = null;
  private sheepDogContract: ethers.Contract | null = null;
  private wolfContract: ethers.Contract | null = null;
  private routerContract: ethers.Contract | null = null;
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract addresses
  private readonly sheepAddress = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
  private readonly sheepDogAddress = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
  private readonly wolfAddress = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';
  private readonly routerAddress = '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38';

  public SHEEP_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  public SHEEPDOG_CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  public WOLF_CONTRACT_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

  constructor() {
    // Initialize the read-only provider
    this.provider = new ethers.providers.StaticJsonRpcProvider(
      SONIC_NETWORK.rpcUrls[0],
      {
        chainId: SONIC_NETWORK.chainId,
        name: SONIC_NETWORK.name,
        ensAddress: undefined
      }
    );

    // Initialize contracts with provider
    this.sheepContract = new ethers.Contract(
      this.sheepAddress,
      SHEEPABI,
      this.provider
    );

    this.sheepDogContract = new ethers.Contract(
      this.sheepDogAddress,
      SHEEPDOGABI,
      this.provider
    );

    this.wolfContract = new ethers.Contract(
      this.wolfAddress,
      WOLFABI,
      this.provider
    );
    
    this.routerContract = new ethers.Contract(
      this.routerAddress,
      ROUTERABI,
      this.provider
    );
  }

  public async connect() {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      throw new Error('No wallet detected');
    }

    try {
      // Request account access
      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });

      // Check and switch network if needed
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      if (chainId !== `0x${SONIC_NETWORK.chainId.toString(16)}`) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${SONIC_NETWORK.chainId.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await (window as any).ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${SONIC_NETWORK.chainId.toString(16)}`,
                chainName: SONIC_NETWORK.name,
                nativeCurrency: {
                  name: 'Sonic',
                  symbol: 'S',
                  decimals: 18,
                },
                rpcUrls: SONIC_NETWORK.rpcUrls,
                blockExplorerUrls: [SONIC_NETWORK.blockExplorer],
              }],
            });
          } else {
            throw switchError;
          }
        }
      }

      // Create Web3Provider and signer
      const injectedProvider = new ethers.providers.Web3Provider((window as any).ethereum, {
        chainId: SONIC_NETWORK.chainId,
        name: SONIC_NETWORK.name,
        ensAddress: undefined
      });
      
      this.signer = injectedProvider.getSigner();
      
      // Initialize contracts with signer
      this.sheepContract = new ethers.Contract(
        this.sheepAddress,
        SHEEPABI,
        this.signer
      );

      this.sheepDogContract = new ethers.Contract(
        this.sheepDogAddress,
        SHEEPDOGABI,
        this.signer
      );

      this.wolfContract = new ethers.Contract(
        this.wolfAddress,
        WOLFABI,
        this.signer
      );
      
      this.routerContract = new ethers.Contract(
        this.routerAddress,
        ROUTERABI,
        this.signer
      );

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  public async disconnect() {
    // Reset contracts to read-only
    this.sheepContract = new ethers.Contract(
      this.sheepAddress,
      SHEEPABI,
      this.provider!
    );

    this.sheepDogContract = new ethers.Contract(
      this.sheepDogAddress,
      SHEEPDOGABI,
      this.provider!
    );

    this.wolfContract = new ethers.Contract(
      this.wolfAddress,
      WOLFABI,
      this.provider!
    );

    this.routerContract = new ethers.Contract(
      this.routerAddress,
      ROUTERABI,
      this.provider!
    );

    this.signer = null;
    this.isInitialized = false;
    return true;
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.connect();
    }
  }

  // Sheep methods
  public async getSheepBalance(address?: string): Promise<string> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      const balance = await this.sheepContract!.balanceOf(targetAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting Sheep balance:', error);
      throw error;
    }
  }

  // Helper method to format token amounts to 2 decimal places
  private formatTokenAmount(amount: string): string {
    try {
      return parseFloat(amount).toFixed(2);
    } catch (error) {
      console.error('Error formatting token amount:', error);
      return amount;
    }
  }

  // Get formatted Sheep balance with 2 decimal places
  public async getFormattedSheepBalance(address?: string): Promise<string> {
    const balance = await this.getSheepBalance(address);
    return this.formatTokenAmount(balance);
  }

  // Get the staked SHEEP balance (amount in SheepDog contract)
  public async getStakedSheepBalance(address?: string): Promise<string> {
    try {
      const totalBalance = await this.getTotalSheepBalance(address);
      const walletBalance = await this.getSheepBalance(address);
      
      const totalNum = parseFloat(totalBalance);
      const walletNum = parseFloat(walletBalance);
      const stakedNum = Math.max(0, totalNum - walletNum); // Ensure we don't return negative values
      
      return this.formatTokenAmount(stakedNum.toString());
    } catch (error) {
      console.error('Error calculating staked SHEEP balance:', error);
      return "0";
    }
  }

  public async buySheep(amountETH: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Parse the amount of Sonic (native token) to spend
      const parsedAmount = ethers.utils.parseEther(amountETH);
      
      // Call the mintForFee function on the SHEEP contract
      // This will:
      // 1. Take the Sonic tokens as payment
      // 2. Apply a 5% fee to the team
      // 3. Mint SHEEP tokens at a 1:1 ratio (minus fees)
      console.log(`Buying SHEEP with ${amountETH} Sonic using mintForFee`);
      
      // Use the payable mintForFee function that accepts ETH directly
      const tx = await this.sheepContract!.mintForFee({
        value: parsedAmount,
        gasLimit: ethers.BigNumber.from("3000000")
      });
      
      return tx;
    } catch (error: any) {
      console.error("Error in buySheep:", error);
      
      // Enhanced error reporting
      let errorMessage = "Failed to buy Sheep";
      
      if (error.reason) {
        errorMessage = `Error: ${error.reason}`;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code) {
        errorMessage = `Code ${error.code}: ${error.error?.message || JSON.stringify(error)}`;
      }
      
      throw new Error(errorMessage);
    }
  }

  public async sellSheep(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    // Note: In real implementation, this would involve interacting with a DEX
    // This is just a placeholder for demonstration
    const parsedAmount = ethers.utils.parseEther(amount);
    throw new Error('Selling Sheep is not implemented in the current contract');
  }

  // SheepDog methods
  public async getSheepDogShares(address?: string): Promise<string> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      const shares = await this.sheepDogContract!.sheepDogShares(targetAddress);
      return ethers.utils.formatEther(shares);
    } catch (error) {
      console.error('Error getting SheepDog shares:', error);
      throw error;
    }
  }

  // To get SheepDog shares, you need to stake SHEEP tokens.
  // SheepDog shares are not minted directly, but rather represent your stake in the SheepDog contract.
  public async stakeSheepForShares(initialStakeAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // First, we need to approve the SheepDog contract to use our SHEEP tokens
      const amountWei = ethers.utils.parseEther(initialStakeAmount);
      const approveTx = await this.sheepContract!.approve(this.sheepDogAddress, amountWei);
      await approveTx.wait();
      
      console.log(`Approved SheepDog to spend ${initialStakeAmount} SHEEP tokens`);
      
      // Then we call the protect function to stake SHEEP and get SheepDog shares
      // Note: If this is the first deposit, it must be at least 100 SHEEP
      const tx = await this.sheepDogContract!.protect(amountWei);
      return tx;
    } catch (error) {
      console.error('Error getting SheepDog shares by staking SHEEP:', error);
      throw error;
    }
  }

  // Get formatted SheepDog shares with 2 decimal places
  public async getFormattedSheepDogShares(address?: string): Promise<string> {
    const shares = await this.getSheepDogShares(address);
    return this.formatTokenAmount(shares);
  }

  // Get total SHEEP balance including what's staked in SheepDog
  public async getTotalSheepBalance(address?: string): Promise<string> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      // Get wallet SHEEP balance
      const walletBalance = await this.getSheepBalance(targetAddress);
      
      // Get protected SHEEP in SheepDog
      const protectedAmount = await this.getUserProtectedAmount(targetAddress);
      
      // Sum both balances to get total SHEEP holdings
      const totalBalance = parseFloat(walletBalance) + parseFloat(protectedAmount);
      return totalBalance.toString();
    } catch (error) {
      console.error('Error getting total SHEEP balance:', error);
      return "0";
    }
  }

  // Get formatted total SHEEP balance with 2 decimal places
  public async getFormattedTotalSheepBalance(address?: string): Promise<string> {
    const balance = await this.getTotalSheepBalance(address);
    return this.formatTokenAmount(balance);
  }

  // Update the existing getProtectionStatus method to work with total SHEEP balance
  public async getProtectionStatus(address?: string): Promise<number> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      // Get wallet SHEEP balance (unprotected)
      const walletSheepBalance = await this.getSheepBalance(targetAddress);
      
      // Get SHEEP staked in SheepDog (already protected)
      const protectedAmount = await this.getUserProtectedAmount(targetAddress);
      
      // Get total SHEEP holdings
      const totalSheepBalance = parseFloat(walletSheepBalance) + parseFloat(protectedAmount);
      
      // Get SheepDog shares for protection calculation
      const sheepDogShares = await this.getSheepDogShares(targetAddress);
      
      // Calculate protection percentage (1 SheepDog protects 100 Sheep)
      // But SHEEP already in the SheepDog contract is already protected
      const protectionCapacity = parseFloat(sheepDogShares) * 100;
      
      if (totalSheepBalance === 0) return 100; // No sheep to protect
      
      // Calculate protection percentage:
      // - SHEEP in wallet needs protection from SheepDog shares
      // - SHEEP already in SheepDog is already protected (100%)
      const walletSheepAmount = parseFloat(walletSheepBalance);
      const protectedSheepAmount = parseFloat(protectedAmount);
      
      if (walletSheepAmount === 0) return 100; // All SHEEP is protected in SheepDog
      
      // Calculate protection percentage for wallet SHEEP
      const walletProtectionPercentage = Math.min(100, (protectionCapacity / walletSheepAmount) * 100);
      
      // Calculate overall protection percentage
      // (wallet_sheep * wallet_protection + protected_sheep * 100%) / total_sheep
      const overallProtectionPercentage = 
        ((walletSheepAmount * (walletProtectionPercentage / 100)) + protectedSheepAmount) / totalSheepBalance * 100;
      
      return Math.min(100, overallProtectionPercentage);
    } catch (error) {
      console.error('Error calculating protection status:', error);
      throw error;
    }
  }

  // Get total protected sheep balance
  public async getTotalProtectedSheep(address?: string): Promise<string> {
    try {
      const totalSheep = await this.sheepDogContract!.totalSheep();
      return ethers.utils.formatEther(totalSheep);
    } catch (error) {
      console.error('Error getting total protected sheep:', error);
      throw error;
    }
  }

  // Get user's total protected amount
  public async getUserProtectedAmount(address?: string): Promise<string> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      // Calculate user's protected amount based on their share
      const userShares = await this.sheepDogContract!.sheepDogShares(targetAddress);
      const totalShares = await this.sheepDogContract!.totalShares();
      const totalSheep = await this.sheepDogContract!.totalSheep();
      
      // If there are no total shares, return 0
      if (totalShares.eq(0)) return "0";
      
      // Calculate user's share of the pool
      const userProtectedAmount = userShares.mul(totalSheep).div(totalShares);
      return ethers.utils.formatEther(userProtectedAmount);
    } catch (error) {
      console.error('Error getting user protected amount:', error);
      return "0";
    }
  }

  // Get current rent to pay when unstaking (in wSonic/wGasToken)
  public async getCurrentRentRewards(address?: string): Promise<string> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      const currentRent = await this.sheepDogContract!.getCurrentRent(targetAddress);
      return ethers.utils.formatEther(currentRent);
    } catch (error) {
      console.error('Error getting current rent to pay in wSonic:', error);
      return "0";
    }
  }

  // Initiate the unstaking process by putting the SheepDog to sleep (requires 2-day wait before retrieving SHEEP)
  public async removeProtection(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // Call the dogSleep function which initiates a 2-day wait period
      const tx = await this.sheepDogContract!.dogSleep();
      return tx;
    } catch (error) {
      console.error('Error initiating unstake process:', error);
      throw error;
    }
  }

  // Pay rent in wSonic/wGasToken to retrieve SHEEP after the 2-day wait period
  public async claimRewards(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // Call the getSheep function which requires rent payment in wSonic tokens
      // Can only be called after the 2-day wait period initiated by dogSleep()
      const tx = await this.sheepDogContract!.getSheep();
      return tx;
    } catch (error) {
      console.error('Error paying rent and retrieving SHEEP:', error);
      throw error;
    }
  }

  // This doesn't actually "buy" SheepDog tokens as they don't exist as purchasable items.
  // Instead, it calls the buySheep function on the SheepDog contract, which uses accumulated
  // rent payments (in wSonic) to buy SHEEP tokens for the contract. The caller receives a 
  // 1% fee of the bought SHEEP tokens.
  public async buySheepDogDistributeRewards(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // The buySheep function on the SheepDog contract converts accumulated rent in wSonic
      // to SHEEP tokens. Caller gets a 1% fee.
      const tx = await this.sheepDogContract!.buySheep({
        gasLimit: ethers.BigNumber.from("3000000")
      });
      return tx;
    } catch (error) {
      console.error('Error calling buySheep on SheepDog contract:', error);
      throw error;
    }
  }

  public async activateProtection(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    const parsedAmount = ethers.utils.parseEther(amount);
    const tx = await this.sheepDogContract!.protect(parsedAmount);
    return tx;
  }

  // Wolf methods
  public async getWolfCount(address?: string): Promise<number> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');
      
      const wolfBalance = await this.wolfContract!.balanceOf(targetAddress);
      return wolfBalance.toNumber();
    } catch (error) {
      console.error('Error getting Wolf count:', error);
      return 0;
    }
  }

  public async getWolfHungerLevel(wolfId: number): Promise<string> {
    try {
      const hunger = await this.wolfContract!.hunger(wolfId);
      
      // The hunger level increments each time the wolf eats
      // Let's convert it to a percentage without using toNumber() directly
      // We'll use string representation and calculation instead
      
      // Convert BigNumber to string
      const hungerStr = hunger.toString();
      
      // Define max hunger as string (10 with 18 decimal places - a reasonable max)
      const maxHungerValue = "10000000000000000000"; 
      
      // Calculate percentage safely using ethers utils
      let hungerPercentage = 0;
      try {
        // Calculate (hunger / maxHunger) * 100
        hungerPercentage = Math.min(100, 
          (parseFloat(ethers.utils.formatEther(hunger)) / 10.0) * 100
        );
      } catch (error) {
        // If any calculation error, default to 100%
        hungerPercentage = 100;
        console.warn("Wolf hunger level is extremely high, defaulting to 100%");
      }
      
      return `${Math.round(hungerPercentage)}%`;
    } catch (error) {
      console.error('Error getting Wolf hunger level:', error);
      throw error;
    }
  }

  public async getHighestWolfHunger(address?: string): Promise<string> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');
      
      // Get wolf balance
      const wolfCount = await this.getWolfCount(targetAddress);
      if (wolfCount === 0) return '0%';
      
      // For simplicity, we'll just return a simulated hunger level
      // In a real implementation, you would query each Wolf's hunger level
      // For now, we'll return a random percentage between 20-90%
      const hunger = Math.floor(Math.random() * 70) + 20;
      return `${hunger}%`;
    } catch (error) {
      console.error('Error getting Wolf hunger:', error);
      return '0%';
    }
  }

  public async eatSheep(victim: string, wolfId: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    const tx = await this.wolfContract!.eatSheep(victim, wolfId);
    return tx;
  }

  public async getNewWolf(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    const tx = await this.wolfContract!.getWolf();
    return tx;
  }

  // SheepDog shares are obtained by staking SHEEP, not by direct purchase
  // This method is kept for compatibility but now returns information about staking
  public async getSheepDogPrice(): Promise<string> {
    try {
      // SheepDog shares don't have a direct price, they're earned by staking SHEEP
      // The initial deposit must be at least 100 SHEEP if it's the first stake
      // Return this minimum stake amount as the "price"
      return "100.00";
    } catch (error) {
      console.error('Error getting minimum stake amount:', error);
      return "100.00"; // Default value - contract requires 100 SHEEP for first deposit
    }
  }

  // Approve SHEEP to be spent by a contract
  public async approveSheep(amount: string, spenderAddress: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    try {
      // Convert amount to wei (18 decimals)
      const amountWei = ethers.utils.parseEther(amount);
      
      // Call the approve function on the SHEEP contract
      const tx = await this.sheepContract!.approve(spenderAddress, amountWei);
      return tx;
    } catch (error) {
      console.error('Error approving SHEEP tokens:', error);
      throw error;
    }
  }

  // Check if SheepDog is sleeping and when it can be claimed
  public async getSleepStatus(address?: string): Promise<{ isSleeping: boolean; canClaimTime: Date | null }> {
    try {
      const targetAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!targetAddress) throw new Error('No wallet connected and no address provided');

      // Get the time when the user can claim their SHEEP (when the dog is fully asleep)
      const wenToClaim = await this.sheepDogContract!.wenToClaim(targetAddress);
      
      // If wenToClaim is 0, the dog is not sleeping yet
      if (wenToClaim.eq(0)) {
        return { isSleeping: false, canClaimTime: null };
      }
      
      // Convert the timestamp to a JavaScript Date object
      const canClaimTime = new Date(wenToClaim.toNumber() * 1000);
      
      return { 
        isSleeping: true, 
        canClaimTime 
      };
    } catch (error) {
      console.error('Error checking sleep status:', error);
      return { isSleeping: false, canClaimTime: null };
    }
  }

  // Add method for Wolf attack (feeding Wolf)
  public async feedWolf(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // In a real implementation, this would call the Wolf contract's feed or attack method
      // For now, we'll simulate the attack by transferring some SHEEP from the user to "nowhere" (burn address)
      const address = await this.signer!.getAddress();
      
      // Get user's SHEEP balance
      const sheepBalance = await this.sheepContract!.balanceOf(address);
      
      // Calculate protection percentage
      const protection = await this.getProtectionStatus();
      
      // Calculate unprotected SHEEP amount
      const unprotectedSheep = sheepBalance.mul(100 - protection).div(100);
      
      // Get Wolf hunger level (removing the % sign)
      const hungerLevelStr = await this.getHighestWolfHunger();
      const hungerLevel = parseInt(hungerLevelStr.replace('%', ''));
      
      // Calculate amount to burn: unprotectedSheep * hungerLevel * 0.05 / 100
      const amountToBurn = unprotectedSheep.mul(hungerLevel).mul(5).div(10000);
      
      // Execute the transfer to burn address
      const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
      const tx = await this.sheepContract!.transfer(BURN_ADDRESS, amountToBurn);
      
      return tx;
    } catch (error) {
      console.error('Error feeding Wolf:', error);
      throw error;
    }
  }
}

export default new SheepEcosystemService(); 