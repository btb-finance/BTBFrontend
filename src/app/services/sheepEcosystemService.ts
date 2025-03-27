// @ts-nocheck
import { ethers } from 'ethers';

// Extend Window interface to include ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

// Import ABIs
import SHEEPABI_RAW from '../sheepcoin/sheepcoinabi.json';
import SHEEPDOGABI_RAW from '../sheepcoin/sheepdogabi.json';
import WOLFABI_RAW from '../sheepcoin/wolfabi.json';
import ROUTERABI_RAW from '../sheepcoin/routerabi.json';

// Parse the ABIs
const SHEEPABI = JSON.parse(JSON.stringify(SHEEPABI_RAW));
const SHEEPDOGABI = JSON.parse(JSON.stringify(SHEEPDOGABI_RAW));
const WOLFABI = JSON.parse(JSON.stringify(WOLFABI_RAW));
const ROUTERABI = JSON.parse(JSON.stringify(ROUTERABI_RAW));

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
  public wolfContract: ethers.Contract | null = null;
  private routerContract: ethers.Contract | null = null;
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  public signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract addresses
  private readonly sheepAddress = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
  private readonly sheepDogAddress = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
  private readonly wolfAddress = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';
  private readonly routerAddress = '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38';

  public SHEEP_CONTRACT_ADDRESS = "0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4";
  public SHEEPDOG_CONTRACT_ADDRESS = "0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2";
  public WOLF_CONTRACT_ADDRESS = "0xf1152a195B93d51457633F96B81B1CF95a96E7A7";

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

  // Helper function to clean decimal values for BigNumber conversion
  private cleanDecimalString(value: string): string {
    return value.includes('.')
      ? value.replace(/0+$/, '').replace(/\.$/, '')
      : value;
  }

  public async buySheep(amountETH: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Clean the amount string and parse it
      const cleanAmount = this.cleanDecimalString(amountETH);
      const parsedAmount = ethers.utils.parseEther(cleanAmount);
      
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
    const cleanAmount = this.cleanDecimalString(amount);
    const parsedAmount = ethers.utils.parseEther(cleanAmount);
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
    try {
      const shares = await this.getSheepDogShares(address);
      return this.formatTokenAmount(shares);
    } catch (error) {
      console.error('Error getting formatted SheepDog shares:', error);
      return "0";
    }
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
    try {
      const balance = await this.getTotalSheepBalance(address);
      return this.formatTokenAmount(balance);
    } catch (error) {
      console.error('Error getting total SHEEP balance:', error);
      return "0";
    }
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
    const cleanAmount = this.cleanDecimalString(amount);
    const parsedAmount = ethers.utils.parseEther(cleanAmount);
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

      // Would normally query wolf hunger from contract
      // For demo:
      return (35 + Math.floor(Math.random() * 65)).toString(); // Random 35-99%
    } catch (error) {
      console.error('Error getting WOLF hunger:', error);
      return "0";
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
      // Clean the amount string to avoid issues with trailing zeros in decimal part
      const cleanAmount = this.cleanDecimalString(amount);
      
      // Convert amount to wei (18 decimals)
      const amountWei = ethers.utils.parseEther(cleanAmount);
      
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

  // Get the wolf ID for the given index (for iterating through user's wolves)
  public async getWolfId(index: number): Promise<number> {
    try {
      const targetAddress = this.signer ? await this.signer.getAddress() : null;
      if (!targetAddress) throw new Error('No wallet connected');

      // For a real implementation, this would call tokenOfOwnerByIndex from ERC721Enumerable
      // For demo we'll return mock IDs
      return 1000 + index;
    } catch (error) {
      console.error('Error getting Wolf ID:', error);
      return 0;
    }
  }
  
  // Get the wolf hunger level as a percentage
  public async getWolfHunger(wolfId: number): Promise<string> {
    try {
      // In a real implementation, this would query hunger from the Wolf contract
      // For demo, generate random hunger based on wolfId for consistency
      const hunger = (wolfId * 17) % 100; // Pseudo-random but consistent for each ID
      return hunger.toString();
    } catch (error) {
      console.error('Error getting Wolf hunger:', error);
      return "0";
    }
  }
  
  // Get the timestamp of the wolf's last feeding
  public async getWolfLastFeeding(wolfId: number): Promise<number> {
    try {
      // In a real implementation, this would query the last feeding time from the contract
      // For demo, we'll return a timestamp from the last few days
      const now = Math.floor(Date.now() / 1000);
      const daysSince = (wolfId * 13) % 14; // 0-13 days based on wolfId
      return now - (daysSince * 24 * 60 * 60);
    } catch (error) {
      console.error('Error getting Wolf last feeding:', error);
      return Math.floor(Date.now() / 1000);
    }
  }
  
  // Check if the wolf is starved
  public async isWolfStarved(wolfId: number): Promise<boolean> {
    try {
      // In a real implementation, this would check the starved status from the contract
      // For demo, we'll determine based on wolfId (some are starved, some aren't)
      return wolfId % 5 === 0; // Every 5th wolf is starved
    } catch (error) {
      console.error('Error checking if Wolf is starved:', error);
      return false;
    }
  }
  
  // Check if the wolf can eat (is not starved and hasn't eaten recently)
  public async canWolfEat(wolfId: number): Promise<boolean> {
    try {
      const isStarved = await this.isWolfStarved(wolfId);
      if (isStarved) return false;
      
      // In a real implementation, this would check hunger and last feeding time
      // For demo, use wolfId to determine
      return wolfId % 3 !== 0; // 2/3 of wolves can eat
    } catch (error) {
      console.error('Error checking if Wolf can eat:', error);
      return false;
    }
  }
  
  // Get the wolf metadata (image, attributes)
  public async getWolfMetadata(wolfId: number): Promise<any> {
    try {
      // In a real implementation, this would fetch the NFT metadata from IPFS or a server
      // For demo, we'll return mock metadata
      return {
        image: `https://api.dicebear.com/6.x/identicon/svg?seed=${wolfId}`,
        attributes: [
          { trait_type: "Generation", value: "Gen " + (wolfId % 3 + 1) },
          { trait_type: "Rarity", value: wolfId % 10 === 0 ? "Legendary" : wolfId % 5 === 0 ? "Rare" : "Common" },
          { trait_type: "Strength", value: ((wolfId * 17) % 100).toString() },
          { trait_type: "Aggression", value: ((wolfId * 23) % 100).toString() }
        ]
      };
    } catch (error) {
      console.error('Error getting Wolf metadata:', error);
      return { image: "", attributes: [] };
    }
  }
  
  // Get the cost to feed a wolf (in SHEEP tokens)
  public async getWolfFeedingCost(): Promise<string> {
    try {
      // In a real implementation, this would query the contract
      // For demo, return a fixed cost
      return "5000";
    } catch (error) {
      console.error('Error getting Wolf feeding cost:', error);
      return "0";
    }
  }
  
  // Feed a wolf, consuming SHEEP tokens
  public async feedWolf(wolfId: number): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // In a real implementation, this would call a contract method to feed the wolf
      console.log(`Feeding Wolf #${wolfId} (simulated)`);
      
      // Simulate a delay for the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    } catch (error) {
      console.error('Error feeding Wolf:', error);
      throw error;
    }
  }

  // Get potential targets for wolf to eat
  public async getPotentialTargets(limit: number = 8, isCacheUpdate: boolean = false): Promise<any[]> {
    try {
      // Addresses to exclude (protected addresses and LP)
      const EXCLUDED_ADDRESSES = [
        '0xe0707Bd1e3800067447282eA95cE5B41D7E493d1',
        '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2'
      ].map(addr => addr.toLowerCase());
      
      // Return cached targets if they exist and are recent (unless this is a cache update call)
      const now = Date.now();
      if (!isCacheUpdate && 
          SheepEcosystemService.cachedTargets.length > 0 && 
          now - SheepEcosystemService.targetsCacheTime < SheepEcosystemService.CACHE_DURATION) {
        console.log("Using cached targets:", SheepEcosystemService.cachedTargets.length);
        
        // Filter out excluded addresses from cached targets
        const filteredTargets = SheepEcosystemService.cachedTargets.filter(
          target => !EXCLUDED_ADDRESSES.includes(target.address.toLowerCase())
        );
        
        // Return a random subset of the filtered cached targets
        if (limit < filteredTargets.length) {
          // Create a copy to shuffle
          const targets = [...filteredTargets];
          
          // Fisher-Yates shuffle algorithm
          for (let i = targets.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [targets[i], targets[j]] = [targets[j], targets[i]];
          }
          
          return targets.slice(0, limit);
        }
        
        return filteredTargets.slice(0, limit);
      }
      
      // Check if we have a provider
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }
      
      console.log("Searching for new targets...");
      // Get some recent blocks to find addresses
      const latestBlockNumber = await this.provider.getBlockNumber();
      const addressMap = new Map<string, boolean>();
      const targets = [];
      
      // Add excluded addresses to the map to skip them
      EXCLUDED_ADDRESSES.forEach(addr => addressMap.set(addr, true));
      
      // First attempt: Look through more blocks
      for (let i = 0; i < 15 && targets.length < 500; i++) {
        const blockNumber = latestBlockNumber - i;
        const block = await this.provider.getBlock(blockNumber, true);
        
        if (!block || !block.transactions) continue;
        
        // Shuffle transactions to get random addresses
        const shuffledTxs = [...block.transactions].sort(() => Math.random() - 0.5);
        
        for (const tx of shuffledTxs) {
          const fromAddress = tx.from ? tx.from.toLowerCase() : null;
          
          // Skip if we already have this address, if it's null, or if it's the zero address or excluded
          if (!fromAddress || 
              addressMap.has(fromAddress) || 
              fromAddress === '0x0000000000000000000000000000000000000000') {
            continue;
          }
          
          // Check if this address has any SHEEP tokens
          try {
            const sheepBalance = await this.sheepContract!.balanceOf(tx.from);
            
            if (sheepBalance.gt(0)) {
              // Check if this address has protection (has SheepDog)
              const sheepDogShares = await this.sheepDogContract!.sheepDogShares(tx.from);
              const canBeEaten = sheepDogShares.isZero(); // Can be eaten if no SheepDog shares
              
              // Truncate address for display
              const shortAddress = tx.from.substring(0, 6) + "..." + tx.from.substring(tx.from.length - 4);
              
              targets.push({
                address: tx.from,
                name: `Wallet ${shortAddress}`,
                sheepBalance: ethers.utils.formatEther(sheepBalance),
                canBeEaten
              });
              
              addressMap.set(fromAddress, true);
              
              // Break if we have enough targets
              if (targets.length >= 500) break;
            }
          } catch (error) {
            console.warn(`Error checking balance for ${tx.from}:`, error);
          }
        }
      }
      
      // Second attempt: If we still don't have addresses, try checking the "to" addresses in transactions too
      if (targets.length < 300) {
        for (let i = 0; i < 10 && targets.length < 500; i++) {
          const blockNumber = latestBlockNumber - i - 15; // Check different blocks than before
          const block = await this.provider.getBlock(blockNumber, true);
          
          if (!block || !block.transactions) continue;
          
          for (const tx of block.transactions) {
            const toAddress = tx.to ? tx.to.toLowerCase() : null;
            
            // Check recipient addresses too
            if (toAddress && 
                !addressMap.has(toAddress) && 
                toAddress !== '0x0000000000000000000000000000000000000000') {
              try {
                const sheepBalance = await this.sheepContract!.balanceOf(tx.to);
                
                if (sheepBalance.gt(0)) {
                  const sheepDogShares = await this.sheepDogContract!.sheepDogShares(tx.to);
                  const canBeEaten = sheepDogShares.isZero();
                  
                  const shortAddress = tx.to.substring(0, 6) + "..." + tx.to.substring(tx.to.length - 4);
                  
                  targets.push({
                    address: tx.to,
                    name: `Wallet ${shortAddress}`,
                    sheepBalance: ethers.utils.formatEther(sheepBalance),
                    canBeEaten
                  });
                  
                  addressMap.set(toAddress, true);
                  
                  if (targets.length >= 500) break;
                }
              } catch (error) {
                console.warn(`Error checking balance for ${tx.to}:`, error);
              }
            }
          }
        }
      }
      
      // Third attempt: If we still have too few, try checking some known whale addresses
      if (targets.length < 100) {
        // Get top holders from contract events (transfers to/from)
        try {
          const transferEvents = await this.sheepContract!.queryFilter(
            this.sheepContract!.filters.Transfer(),
            latestBlockNumber - 5000,
            latestBlockNumber
          );
          
          // Count frequency of addresses in transfer events
          const addressFrequency = new Map<string, number>();
          for (const event of transferEvents) {
            const from = event.args?.from?.toLowerCase();
            const to = event.args?.to?.toLowerCase();
            
            if (from && 
                from !== '0x0000000000000000000000000000000000000000' && 
                !addressMap.has(from) && 
                !EXCLUDED_ADDRESSES.includes(from)) {
              addressFrequency.set(from, (addressFrequency.get(from) || 0) + 1);
            }
            
            if (to && 
                to !== '0x0000000000000000000000000000000000000000' && 
                !addressMap.has(to) && 
                !EXCLUDED_ADDRESSES.includes(to)) {
              addressFrequency.set(to, (addressFrequency.get(to) || 0) + 1);
            }
          }
          
          // Sort addresses by frequency
          const sortedAddresses = [...addressFrequency.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
          
          // Check top addresses for SHEEP balances
          for (const address of sortedAddresses.slice(0, 50)) {
            if (addressMap.has(address)) continue;
            
            try {
              const sheepBalance = await this.sheepContract!.balanceOf(address);
              
              if (sheepBalance.gt(0)) {
                const sheepDogShares = await this.sheepDogContract!.sheepDogShares(address);
                const canBeEaten = sheepDogShares.isZero();
                
                const shortAddress = address.substring(0, 6) + "..." + address.substring(address.length - 4);
                
                targets.push({
                  address: address,
                  name: `Active Wallet ${shortAddress}`,
                  sheepBalance: ethers.utils.formatEther(sheepBalance),
                  canBeEaten
                });
                
                addressMap.set(address, true);
                
                if (targets.length >= 500) break;
              }
            } catch (error) {
              console.warn(`Error checking balance for ${address}:`, error);
            }
          }
        } catch (error) {
          console.warn("Error querying transfer events:", error);
        }
      }
      
      // If we STILL couldn't find enough real targets (which is unlikely after 3 attempts), 
      // then and ONLY then use fallback addresses
      if (targets.length === 0) {
        console.warn("Could not find ANY real targets, falling back to mock data");
        
        // Generate random-looking addresses that will be different each time
        const randomAddress = () => {
          let addr = "0x";
          for (let i = 0; i < 40; i++) {
            addr += "0123456789abcdef"[Math.floor(Math.random() * 16)];
          }
          return addr;
        };
        
        const randomBalance = () => {
          return (Math.floor(Math.random() * 500000) + 100000).toString();
        };
        
        // Generate 50 random addresses
        for (let i = 0; i < 50; i++) {
          const addr = randomAddress();
          const shortAddr = addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
          
          targets.push({
            address: addr,
            name: `Random Wallet ${shortAddr}`,
            sheepBalance: randomBalance(),
            canBeEaten: Math.random() > 0.3 // 70% chance of being eatable
          });
        }
      }
      
      // Cache the results
      console.log(`Found ${targets.length} potential targets`);
      SheepEcosystemService.cachedTargets = targets.slice(0, 500);
      SheepEcosystemService.targetsCacheTime = now;
      
      // Return the targets, but make sure we're not returning too many at once
      return targets.slice(0, limit);
    } catch (error) {
      console.error('Error getting potential targets:', error);
      
      // Even on error, generate random addresses instead of fixed mock ones
      const targets = [];
      for (let i = 0; i < 8; i++) {
        const addr = `0x${Math.random().toString(16).substring(2, 42).padEnd(40, '0')}`;
        const shortAddr = addr.substring(0, 6) + "..." + addr.substring(addr.length - 4);
        
        targets.push({
          address: addr,
          name: `Random Wallet ${shortAddr}`,
          sheepBalance: (Math.floor(Math.random() * 5000000) + 100000).toString(),
          canBeEaten: Math.random() > 0.2 // 80% chance of being eatable
        });
      }
      
      return targets;
    }
  }
  
  // Eat a target with a wolf
  public async eatTarget(wolfId: number, targetAddress: string): Promise<boolean> {
    try {
      await this.ensureInitialized();
      
      // Call the actual eatSheep function from the wolf contract
      const tx = await this.wolfContract!.eatSheep(targetAddress, wolfId, {
        gasLimit: ethers.BigNumber.from("3000000")
      });
      
      // Wait for transaction to be mined
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Error eating target:', error);
      throw error;
    }
  }

  // Get more targets from the cache
  public getMoreTargetsFromCache(count: number = 8): any[] {
    if (SheepEcosystemService.cachedTargets.length === 0) return [];
    
    // Addresses to exclude (protected addresses and LP)
    const EXCLUDED_ADDRESSES = [
      '0xe0707Bd1e3800067447282eA95cE5B41D7E493d1',
      '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2'
    ].map(addr => addr.toLowerCase());
    
    // Filter out excluded addresses
    const filteredTargets = SheepEcosystemService.cachedTargets.filter(
      target => !EXCLUDED_ADDRESSES.includes(target.address.toLowerCase())
    );
    
    if (filteredTargets.length === 0) return [];
    
    // Instead of getting random indexes which might repeat,
    // let's shuffle the entire cache and then take the first 'count' elements
    const shuffled = [...filteredTargets].sort(() => 0.5 - Math.random());
    
    // Take the first 'count' elements or all if there are fewer
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}

export default new SheepEcosystemService(); 