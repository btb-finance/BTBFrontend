import { ethers } from 'ethers';
// Import the ABI files
import BTBDefiProtocolABI from '../contracts/BTBDefiProtocol.json';
import btbTokenABI from '../contracts/btbtokenabi.json';

// Base network configuration
const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base Mainnet',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
};


class BTBFinanceService {
  private contract: ethers.Contract | null = null;
  private btbTokenContract: ethers.Contract | null = null;
  private provider: ethers.JsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract addresses on Base Mainnet
  private readonly protocolAddress = '0x5EE1360f47D2ecd266aD8d69cF7D04AEFdBfe9d5';
  private readonly btbTokenAddress = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

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
      this.protocolAddress,
      BTBDefiProtocolABI,
      this.provider
    );

    this.btbTokenContract = new ethers.Contract(
      this.btbTokenAddress,
      btbTokenABI,
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
      
      this.signer = await injectedProvider.getSigner();
      
      // Initialize contracts with signer
      this.contract = new ethers.Contract(
        this.protocolAddress,
        BTBDefiProtocolABI,
        this.signer
      );

      this.btbTokenContract = new ethers.Contract(
        this.btbTokenAddress,
        btbTokenABI,
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
      this.protocolAddress,
      BTBDefiProtocolABI,
      this.provider!
    );
    this.btbTokenContract = new ethers.Contract(
      this.btbTokenAddress,
      btbTokenABI,
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

  // Get the current price of BTB tokens
  public async getCurrentPrice(): Promise<string> {
    try {
      const price = await this.contract!.currentPrice();
      return ethers.formatEther(price);
    } catch (error) {
      console.error('Error getting current price:', error);
      return '0.000001';
    }
  }

  // Get the total backing of BTB tokens
  public async getBacking(): Promise<string> {
    try {
      const backing = await this.contract!.getProtocolBacking();
      return ethers.formatEther(backing);
    } catch (error) {
      console.error('Error getting backing:', error);
      return '0';
    }
  }

  // Get total borrowed amount
  public async getTotalBorrowed(): Promise<string> {
    try {
      const totalBorrowed = await this.contract!.getTotalBorrowedAmount();
      return ethers.formatEther(totalBorrowed);
    } catch (error) {
      console.error('Error getting total borrowed:', error);
      return '0';
    }
  }

  // Get total collateral amount (in BTB tokens)
  public async getTotalCollateral(): Promise<string> {
    try {
      const totalCollateral = await this.contract!.getTotalCollateralAmount();
      return ethers.formatUnits(totalCollateral, 18);
    } catch (error) {
      console.error('Error getting total collateral:', error);
      return '0';
    }
  }

  // Get user's BTB token balance
  public async getBTBBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const balance = await this.btbTokenContract!.balanceOf(address);
      return ethers.formatUnits(balance, 18); // BTB tokens typically have 18 decimals
    } catch (error) {
      console.error('Error getting BTB balance:', error);
      throw error;
    }
  }


  // Get user's loan information
  public async getUserLoan() {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const loan = await this.contract!.getUserLoanInfo(address);
      
      return {
        collateral: ethers.formatUnits(loan[0], 18),
        borrowed: ethers.formatEther(loan[1]),
        expirationDate: loan[2]Number(
      };
    } catch (error) {
      console.error('Error getting loan information:', error);
      return {
        collateral: '0',
        borrowed: '0',
        expirationDate: 0
      };
    }
  }

  // Buy BTB tokens with ETH
  public async buyBTB(ethAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      const address = await this.signer!.getAddress();
      
      // Execute buy transaction - send ETH directly with recipient address
      const tx = await this.contract!.purchaseTokens(address, { value: parsedAmount });
      return tx;
    } catch (error) {
      console.error('Error buying BTB:', error);
      throw error;
    }
  }

  // Sell BTB tokens for ETH
  public async sellBTB(btbAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseUnits(btbAmount, 18); // BTB has 18 decimals
      const address = await this.signer!.getAddress();
      
      // Check current allowance
      const currentAllowance = await this.btbTokenContract!.allowance(address, this.protocolAddress);
      
      // If allowance is insufficient, approve first
      if (currentAllowance.LT_TEMP(parsedAmount)) {
        const approveTx = await this.btbTokenContract!.approve(this.protocolAddress, parsedAmount);
        await approveTx.wait();
      }
      
      // Execute sell transaction
      const tx = await this.contract!.sellTokens(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error selling BTB:', error);
      throw error;
    }
  }

  // Create loop position (advanced ETH multiplier)
  public async createLoopPosition(ethAmount: string, numberOfDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      // Get the total required amount directly from contract (returns BigNumber)
      const [, totalRequiredBN] = await this.contract!.getLoopOutput(parsedAmount, numberOfDays);
      
      // Execute loop transaction with required payment
      const tx = await this.contract!.createLoopPosition(parsedAmount, numberOfDays, {
        value: totalRequiredBN
      });
      return tx;
    } catch (error) {
      console.error('Error creating loop position:', error);
      throw error;
    }
  }

  // Create leveraged position
  public async createLeveragePosition(ethAmount: string, numberOfDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      // Get leverage cost
      const leverageCost = await this.contract!.calculateLeverageCost(parsedAmount, numberOfDays);
      const overcollateralAmount = parsedAmount / BigInt(100); // 1% overcollateral
      const totalRequired = leverageCost.ADD_TEMP(overcollateralAmount);
      
      // Execute leverage transaction
      const tx = await this.contract!.createLeveragePosition(parsedAmount, numberOfDays, {
        value: totalRequired
      });
      return tx;
    } catch (error) {
      console.error('Error creating leverage position:', error);
      throw error;
    }
  }

  // Borrow against BTB collateral
  public async borrowAgainstCollateral(ethAmount: string, numberOfDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      
      // Execute borrow transaction
      const tx = await this.contract!.borrowAgainstCollateral(parsedAmount, numberOfDays);
      return tx;
    } catch (error) {
      console.error('Error borrowing against collateral:', error);
      throw error;
    }
  }

  // Make partial payment on loan
  public async makePayment(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(amount);
      const tx = await this.contract!.makePayment({ value: parsedAmount });
      return tx;
    } catch (error) {
      console.error('Error making payment:', error);
      throw error;
    }
  }

  // Close position by repaying full loan amount
  public async closePosition(repayAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(repayAmount);
      const tx = await this.contract!.closePosition({ value: parsedAmount });
      return tx;
    } catch (error) {
      console.error('Error closing position:', error);
      throw error;
    }
  }

  // Instantly close position by selling collateral
  public async instantClosePosition(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const tx = await this.contract!.instantClosePosition();
      return tx;
    } catch (error) {
      console.error('Error instant closing position:', error);
      throw error;
    }
  }

  // Extend loan duration
  public async extendLoanDuration(additionalDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Get user loan info to calculate extension fee
      const address = await this.signer!.getAddress();
      const [, borrowedAmount] = await this.contract!.getUserLoanInfo(address);
      
      // Calculate extension fee
      const extensionFee = await this.contract!.getInterestCost(borrowedAmount, additionalDays);
      
      // Execute extend loan transaction
      const tx = await this.contract!.extendLoanDuration(additionalDays, { value: extensionFee });
      return tx;
    } catch (error) {
      console.error('Error extending loan:', error);
      throw error;
    }
  }

  // Expand existing loan with more ETH
  public async expandLoan(ethAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      const tx = await this.contract!.expandLoan(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error expanding loan:', error);
      throw error;
    }
  }

  // Get loop output estimation
  public async getLoopOutput(ethAmount: string, numberOfDays: number): Promise<{tokens: string, totalRequired: string}> {
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      const [tokens, totalRequired] = await this.contract!.getLoopOutput(parsedAmount, numberOfDays);
      return {
        tokens: ethers.formatUnits(tokens, 18),
        totalRequired: ethers.formatEther(totalRequired)
      };
    } catch (error) {
      console.error('Error getting loop output:', error);
      return { tokens: '0', totalRequired: '0' };
    }
  }

  // Get max borrow amount for user
  public async getMaxBorrow(numberOfDays: number): Promise<{userETH: string, userBorrow: string, interestFee: string}> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const [userETH, userBorrow, interestFee] = await this.contract!.getMaxBorrow(address, numberOfDays);
      return {
        userETH: ethers.formatEther(userETH),
        userBorrow: ethers.formatEther(userBorrow),
        interestFee: ethers.formatEther(interestFee)
      };
    } catch (error) {
      console.error('Error getting max borrow:', error);
      return { userETH: '0', userBorrow: '0', interestFee: '0' };
    }
  }

  // Get max loop amount for user  
  public async getMaxLoop(numberOfDays: number): Promise<{maxETH: string, userBorrow: string, totalRequired: string}> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const [maxETH, userBorrow, totalRequired] = await this.contract!.getMaxLoop(address, numberOfDays);
      return {
        maxETH: ethers.formatEther(maxETH),
        userBorrow: ethers.formatEther(userBorrow),
        totalRequired: ethers.formatEther(totalRequired)
      };
    } catch (error) {
      console.error('Error getting max loop:', error);
      return { maxETH: '0', userBorrow: '0', totalRequired: '0' };
    }
  }

  // Check if user can create loop position
  public async canUserLoop(): Promise<{canLoop: boolean, reason: string}> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const [canLoop, reason] = await this.contract!.canUserLoop(address);
      return { canLoop, reason };
    } catch (error) {
      console.error('Error checking if user can loop:', error);
      return { canLoop: false, reason: 'Error checking loop eligibility' };
    }
  }

  // Get purchase amount estimation
  public async getPurchaseEstimate(ethAmount: string): Promise<string> {
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      const estimate = await this.contract!.estimatePurchaseTokens(parsedAmount);
      return ethers.formatUnits(estimate, 18);
    } catch (error) {
      console.error('Error getting purchase estimate:', error);
      return '0';
    }
  }

  // Get sell amount estimation (what user will actually receive after 0.1% fee)
  public async getSellEstimate(btbAmount: string): Promise<string> {
    try {
      const parsedAmount = ethers.parseUnits(btbAmount, 18);
      // Use the same calculation as sellTokens function: calculateTokensToETH
      const ethToSend = await this.contract!.calculateTokensToETH(parsedAmount);
      // Apply trading fee - user gets tradingFeePercentage/10000 (default 9990/10000 = 99.9%)
      const tradingFeePercentage = await this.contract!.tradingFeePercentage();
      const userETH = ethToSend.MUL_TEMP(tradingFeePercentage).div(10000);
      return ethers.formatEther(userETH);
    } catch (error) {
      console.error('Error getting sell estimate:', error);
      return '0';
    }
  }

  // Get leverage cost
  public async getLeverageCost(ethAmount: string, numberOfDays: number): Promise<string> {
    try {
      const parsedAmount = ethers.parseEther(ethAmount);
      const cost = await this.contract!.calculateLeverageCost(parsedAmount, numberOfDays);
      return ethers.formatEther(cost);
    } catch (error) {
      console.error('Error getting leverage cost:', error);
      return '0';
    }
  }

  // Get interest cost for borrowing
  public async getInterestCost(amount: string, numberOfDays: number): Promise<string> {
    try {
      const parsedAmount = ethers.parseEther(amount);
      const cost = await this.contract!.getInterestCost(parsedAmount, numberOfDays);
      return ethers.formatEther(cost);
    } catch (error) {
      console.error('Error getting interest cost:', error);
      return '0';
    }
  }
}

// Create a singleton instance
const btbFinanceService = new BTBFinanceService();
export default btbFinanceService;
