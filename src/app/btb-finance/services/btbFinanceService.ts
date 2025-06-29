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
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract addresses on Base Mainnet
  private readonly protocolAddress = '0x5EE1360f47D2ecd266aD8d69cF7D04AEFdBfe9d5';
  private readonly btbTokenAddress = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

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
      const injectedProvider = new ethers.providers.Web3Provider(window.ethereum, {
        chainId: BASE_NETWORK.chainId,
        name: BASE_NETWORK.name,
        ensAddress: undefined
      });
      
      this.signer = injectedProvider.getSigner();
      
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
      return ethers.utils.formatEther(price);
    } catch (error) {
      console.error('Error getting current price:', error);
      return '0.000001';
    }
  }

  // Get the total backing of BTB tokens
  public async getBacking(): Promise<string> {
    try {
      const backing = await this.contract!.getProtocolBacking();
      return ethers.utils.formatEther(backing);
    } catch (error) {
      console.error('Error getting backing:', error);
      return '0';
    }
  }

  // Get total borrowed amount
  public async getTotalBorrowed(): Promise<string> {
    try {
      const totalBorrowed = await this.contract!.getTotalBorrowedAmount();
      return ethers.utils.formatEther(totalBorrowed);
    } catch (error) {
      console.error('Error getting total borrowed:', error);
      return '0';
    }
  }

  // Get total collateral amount (converted to ETH value)
  public async getTotalCollateral(): Promise<string> {
    try {
      const totalCollateralTokens = await this.contract!.getTotalCollateralAmount();
      // Convert BTB tokens to ETH value
      const totalCollateralETH = await this.contract!.calculateTokensToETH(totalCollateralTokens);
      return ethers.utils.formatEther(totalCollateralETH);
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
      return ethers.utils.formatUnits(balance, 18); // BTB tokens typically have 18 decimals
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
        collateral: ethers.utils.formatUnits(loan[0], 18),
        borrowed: ethers.utils.formatUnits(loan[1], 6),
        expirationDate: loan[2].toNumber()
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
      const parsedAmount = ethers.utils.parseEther(ethAmount);
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
      const parsedAmount = ethers.utils.parseUnits(btbAmount, 18); // BTB has 18 decimals
      const address = await this.signer!.getAddress();
      
      // Check current allowance
      const currentAllowance = await this.btbTokenContract!.allowance(address, this.protocolAddress);
      
      // If allowance is insufficient, approve first
      if (currentAllowance.lt(parsedAmount)) {
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

  // Create leveraged position
  public async createLeveragePosition(ethAmount: string, numberOfDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseEther(ethAmount);
      
      // Execute leverage transaction
      const tx = await this.contract!.createLeveragePosition(parsedAmount, numberOfDays, {
        value: parsedAmount
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
      const parsedAmount = ethers.utils.parseEther(ethAmount);
      
      // Execute borrow transaction
      const tx = await this.contract!.borrowAgainstCollateral(parsedAmount, numberOfDays);
      return tx;
    } catch (error) {
      console.error('Error borrowing against collateral:', error);
      throw error;
    }
  }

  // Repay loan
  public async repayLoan(amount?: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      let tx;
      if (amount) {
        const parsedAmount = ethers.utils.parseEther(amount);
        tx = await this.contract!.makePayment({ value: parsedAmount });
      } else {
        tx = await this.contract!.closePosition({ value: ethers.utils.parseEther('0') });
      }
      return tx;
    } catch (error) {
      console.error('Error repaying loan:', error);
      throw error;
    }
  }

  // Extend loan duration
  public async extendLoan(additionalDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Calculate extension fee
      const extensionFee = await this.contract!.extendLoanDuration(additionalDays);
      
      // Execute extend loan transaction
      const tx = await this.contract!.extendLoanDuration(additionalDays, { value: extensionFee });
      return tx;
    } catch (error) {
      console.error('Error extending loan:', error);
      throw error;
    }
  }

  // Flash loan
  public async flashLoan(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseEther(amount);
      
      // Execute flash loan transaction (implementation depends on your contract)
      // This is a placeholder - you'll need to implement based on your contract's flash loan function
      const tx = await this.contract!.flashLoan(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error executing flash loan:', error);
      throw error;
    }
  }

  // Get purchase amount estimation
  public async getPurchaseEstimate(ethAmount: string): Promise<string> {
    try {
      const parsedAmount = ethers.utils.parseEther(ethAmount);
      const estimate = await this.contract!.estimatePurchaseTokens(parsedAmount);
      return ethers.utils.formatUnits(estimate, 18);
    } catch (error) {
      console.error('Error getting purchase estimate:', error);
      return '0';
    }
  }

  // Get sell amount estimation (what user will actually receive after 0.1% fee)
  public async getSellEstimate(btbAmount: string): Promise<string> {
    try {
      const parsedAmount = ethers.utils.parseUnits(btbAmount, 18);
      // Use the same calculation as sellTokens function: calculateTokensToETH
      const ethToSend = await this.contract!.calculateTokensToETH(parsedAmount);
      // Apply trading fee - user gets tradingFeePercentage/10000 (default 9990/10000 = 99.9%)
      const tradingFeePercentage = await this.contract!.tradingFeePercentage();
      const userETH = ethToSend.mul(tradingFeePercentage).div(10000);
      return ethers.utils.formatEther(userETH);
    } catch (error) {
      console.error('Error getting sell estimate:', error);
      return '0';
    }
  }

  // Get leverage cost
  public async getLeverageCost(ethAmount: string, numberOfDays: number): Promise<string> {
    try {
      const parsedAmount = ethers.utils.parseEther(ethAmount);
      const cost = await this.contract!.calculateLeverageCost(parsedAmount, numberOfDays);
      return ethers.utils.formatEther(cost);
    } catch (error) {
      console.error('Error getting leverage cost:', error);
      return '0';
    }
  }

  // Get interest cost for borrowing
  public async getInterestCost(amount: string, numberOfDays: number): Promise<string> {
    try {
      const parsedAmount = ethers.utils.parseEther(amount);
      const cost = await this.contract!.getInterestCost(parsedAmount, numberOfDays);
      return ethers.utils.formatEther(cost);
    } catch (error) {
      console.error('Error getting interest cost:', error);
      return '0';
    }
  }
}

// Create a singleton instance
const btbFinanceService = new BTBFinanceService();
export default btbFinanceService;
