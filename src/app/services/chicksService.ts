import { ethers } from 'ethers';
// Fix the import to use the ABI directly
import chicksABI from '../contracts/Chicks/chicksabi.json';

interface ContractError extends Error {
  data?: {
    originalError?: {
      data: string;
    };
  };
}

// Base network configuration
const BASE_NETWORK = {
  chainId: 84532,
  name: 'Base Sepolia',
  rpcUrl: 'https://sepolia.base.org',
  blockExplorer: 'https://sepolia.basescan.org',
};

// USDC contract address on Base Sepolia
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC address

// Minimal ERC20 ABI for USDC interactions
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function allowance(address owner, address spender) public view returns (uint256)',
  'function balanceOf(address account) public view returns (uint256)'
];

class ChicksService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract address for Chicks on Base Sepolia
  private readonly contractAddress = '0xa617AD4f9aA6B2d13815A6CEC4dfEdEaF14dbF52';

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
      this.contractAddress,
      chicksABI,
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
        this.contractAddress,
        chicksABI,
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
      this.contractAddress,
      chicksABI,
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

  // Get the current price of CHICKS in USDC
  public async getCurrentPrice(): Promise<string> {
    try {
      const price = await this.contract!.lastPrice();
      return ethers.utils.formatUnits(price, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Error getting current price:', error);
      throw error;
    }
  }

  // Get the total backing of CHICKS in USDC
  public async getBacking(): Promise<string> {
    try {
      const backing = await this.contract!.getBacking();
      return ethers.utils.formatUnits(backing, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Error getting backing:', error);
      throw error;
    }
  }

  // Get user's CHICKS balance
  public async getChicksBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const balance = await this.contract!.balanceOf(address);
      return ethers.utils.formatUnits(balance, 6); // CHICKS has 6 decimals
    } catch (error) {
      console.error('Error getting CHICKS balance:', error);
      throw error;
    }
  }

  // Get user's USDC balance
  public async getUsdcBalance(): Promise<string> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.provider!);
      const balance = await usdcContract.balanceOf(address);
      return ethers.utils.formatUnits(balance, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Error getting USDC balance:', error);
      throw error;
    }
  }

  // Get user's loan information
  public async getUserLoan() {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      const loan = await this.contract!.Loans(address);
      
      return {
        collateral: ethers.utils.formatUnits(loan.collateral, 6),
        borrowed: ethers.utils.formatUnits(loan.borrowed, 6),
        endDate: loan.endDate.toNumber(),
        numberOfDays: loan.numberOfDays.toNumber()
      };
    } catch (error) {
      console.error('Error getting loan information:', error);
      throw error;
    }
  }

  // Check if user's loan is expired
  public async isLoanExpired(): Promise<boolean> {
    await this.ensureInitialized();
    try {
      const address = await this.signer!.getAddress();
      return await this.contract!.isLoanExpired(address);
    } catch (error) {
      console.error('Error checking if loan is expired:', error);
      throw error;
    }
  }

  // Check if user has an active loan
  public async hasActiveLoan(): Promise<boolean> {
    await this.ensureInitialized();
    
    try {
      const address = await this.signer!.getAddress();
      const loan = await this.contract!.Loans(address);
      
      // Check if the loan exists and has a non-zero borrowed amount
      return loan && !loan.borrowed.isZero();
    } catch (error) {
      console.error('Error checking active loan:', error);
      return false;
    }
  }

  // Buy CHICKS with USDC
  public async buyChicks(usdcAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      const address = await this.signer!.getAddress();
      
      // Get USDC contract
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.signer!);
      
      // Check allowance
      const allowance = await usdcContract.allowance(address, this.contractAddress);
      
      // If allowance is insufficient, approve first
      if (allowance.lt(parsedAmount)) {
        const approveTx = await usdcContract.approve(this.contractAddress, parsedAmount);
        await approveTx.wait();
      }
      
      // Execute buy transaction
      const tx = await this.contract!.buy(address, parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error buying CHICKS:', error);
      throw error;
    }
  }

  // Sell CHICKS for USDC
  public async sellChicks(chicksAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(chicksAmount, 6); // CHICKS has 6 decimals
      
      // Execute sell transaction
      const tx = await this.contract!.sell(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error selling CHICKS:', error);
      throw error;
    }
  }

  // Get the amount of CHICKS that would be received for a given USDC amount
  public async getBuyAmount(usdcAmount: string): Promise<string> {
    try {
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      const chicksAmount = await this.contract!.getBuyAmount(parsedAmount);
      return ethers.utils.formatUnits(chicksAmount, 6); // CHICKS has 6 decimals
    } catch (error) {
      console.error('Error getting buy amount:', error);
      throw error;
    }
  }

  // Get the amount of USDC that would be received for a given CHICKS amount
  public async getSellAmount(chicksAmount: string): Promise<string> {
    try {
      const parsedAmount = ethers.utils.parseUnits(chicksAmount, 6); // CHICKS has 6 decimals
      const usdcAmount = await this.contract!.ChicksToUSDC(parsedAmount);
      return ethers.utils.formatUnits(usdcAmount, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Error getting sell amount:', error);
      throw error;
    }
  }

  // Calculate leverage fee
  public async getLeverageFee(usdcAmount: string, numberOfDays: number): Promise<string> {
    await this.ensureInitialized();
    
    try {
      // Validate inputs
      if (!usdcAmount || isNaN(parseFloat(usdcAmount)) || parseFloat(usdcAmount) <= 0) {
        throw new Error('Invalid USDC amount');
      }
      
      if (!numberOfDays || numberOfDays <= 0) {
        throw new Error('Invalid number of days');
      }
      
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      const fee = await this.contract!.leverageFee(parsedAmount, numberOfDays);
      return ethers.utils.formatUnits(fee, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Error calculating leverage fee:', error);
      throw error;
    }
  }

  // Create a leveraged position
  public async leverage(usdcAmount: string, numberOfDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Validate inputs
      if (!usdcAmount || isNaN(parseFloat(usdcAmount)) || parseFloat(usdcAmount) <= 0) {
        throw new Error('Invalid USDC amount');
      }
      
      if (!numberOfDays || numberOfDays <= 0) {
        throw new Error('Invalid number of days');
      }
      
      // Check if user already has an active loan
      const address = await this.signer!.getAddress();
      const hasLoan = await this.hasActiveLoan();
      if (hasLoan) {
        throw new Error('You already have an active loan. Please repay or close your existing position before creating a new one.');
      }
      
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      
      // Calculate the fee
      const fee = await this.contract!.leverageFee(parsedAmount, numberOfDays);
      
      // Get total amount needed (USDC amount + fee)
      const totalAmount = parsedAmount.add(fee);
      
      // Get USDC contract
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.signer!);
      
      // Check USDC balance
      const balance = await usdcContract.balanceOf(address);
      if (balance.lt(totalAmount)) {
        throw new Error(`Insufficient USDC balance. You need ${ethers.utils.formatUnits(totalAmount, 6)} USDC but have ${ethers.utils.formatUnits(balance, 6)} USDC.`);
      }
      
      // Check allowance
      const allowance = await usdcContract.allowance(address, this.contractAddress);
      
      // If allowance is insufficient, approve first
      if (allowance.lt(totalAmount)) {
        console.log('Approving USDC spend...');
        try {
          const approveTx = await usdcContract.approve(this.contractAddress, ethers.constants.MaxUint256);
          await approveTx.wait();
          console.log('USDC approval successful');
        } catch (approveError) {
          console.error('Error approving USDC:', approveError);
          throw new Error('Failed to approve USDC spending. Please try again.');
        }
      }
      
      console.log('Executing leverage transaction...');
      console.log('Parameters:', {
        parsedAmount: parsedAmount.toString(),
        numberOfDays,
        contractAddress: this.contractAddress
      });
      
      // Try different approaches if the first one fails
      try {
        // First attempt with standard parameters
        const tx = await this.contract!.leverage(parsedAmount, numberOfDays, {
          gasLimit: 1000000,
        });
        console.log('Leverage transaction submitted:', tx.hash);
        return tx;
      } catch (error1) {
        console.error('First leverage attempt failed:', error1);
        
        // Second attempt with different gas settings
        try {
          const tx = await this.contract!.leverage(parsedAmount, numberOfDays, {
            gasLimit: 2000000,
            gasPrice: ethers.utils.parseUnits('50', 'gwei')
          });
          console.log('Leverage transaction submitted (second attempt):', tx.hash);
          return tx;
        } catch (error2) {
          console.error('Second leverage attempt failed:', error2);
          
          // Check if user has an existing loan that might be causing issues
          try {
            const loan = await this.contract!.Loans(address);
            if (loan && loan.borrowed && !loan.borrowed.isZero()) {
              throw new Error('You already have an active loan. Please repay or close your existing position before creating a new one.');
            }
          } catch (loanError) {
            console.error('Error checking loan status:', loanError);
          }
          
          throw new Error('Transaction failed. The contract rejected the operation. This could be due to contract restrictions or an issue with the parameters.');
        }
      }
    } catch (error: any) {
      console.error('Error creating leveraged position:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to create leveraged position';
      
      if (error.reason) {
        errorMessage += `: ${error.reason}`;
      } else if (error.message) {
        errorMessage += `: ${error.message}`;
      } else if (error.data) {
        errorMessage += ` (error code: ${error.data})`;
      }
      
      throw new Error(errorMessage);
    }
  }

  // Borrow USDC against CHICKS
  public async borrow(usdcAmount: string, numberOfDays: number): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      
      // Execute borrow transaction
      const tx = await this.contract!.borrow(parsedAmount, numberOfDays);
      return tx;
    } catch (error: any) {
      console.error('Error borrowing USDC:', error);
      
      // Check if the error message contains "Use borrowMore"
      if (error.data && typeof error.data === 'object' && error.data.message) {
        if (error.data.message.includes('Use borrowMore')) {
          throw new Error('You already have an active loan. Please use "Borrow More" instead.');
        }
      } else if (error.message && error.message.includes('Use borrowMore')) {
        throw new Error('You already have an active loan. Please use "Borrow More" instead.');
      }
      
      throw error;
    }
  }

  // Borrow more USDC against existing collateral
  public async borrowMore(usdcAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      
      // Execute borrowMore transaction
      const tx = await this.contract!.borrowMore(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error borrowing more USDC:', error);
      throw error;
    }
  }

  // Repay part of a loan
  public async repay(usdcAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Validate input to prevent overflow/underflow
      const amount = parseFloat(usdcAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Invalid repay amount. Amount must be greater than 0.");
      }
      
      // Get the user's loan to check if repay amount is valid
      const loan = await this.getUserLoan();
      const borrowedAmount = parseFloat(loan.borrowed);
      
      // Ensure repay amount is not greater than borrowed amount
      if (amount > borrowedAmount) {
        console.warn(`Repay amount (${amount}) is greater than borrowed amount (${borrowedAmount}). Adjusting to borrowed amount.`);
        usdcAmount = borrowedAmount.toString();
      }
      
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      
      // Get USDC contract
      const address = await this.signer!.getAddress();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.signer!);
      
      // Check allowance
      const allowance = await usdcContract.allowance(address, this.contractAddress);
      
      // If allowance is insufficient, approve first
      if (allowance.lt(parsedAmount)) {
        const approveTx = await usdcContract.approve(this.contractAddress, parsedAmount);
        await approveTx.wait();
      }
      
      // Execute repay transaction
      const tx = await this.contract!.repay(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error repaying loan:', error);
      throw error;
    }
  }

  // Close a position by repaying the full loan amount
  public async closePosition(usdcAmount?: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Get the user's loan to determine the exact borrowed amount
      const loan = await this.getUserLoan();
      const borrowedAmount = loan.borrowed;
      
      // Parse the borrowed amount
      const parsedAmount = ethers.utils.parseUnits(borrowedAmount, 6); // USDC has 6 decimals
      
      // Get USDC contract
      const address = await this.signer!.getAddress();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.signer!);
      
      // Check allowance
      const allowance = await usdcContract.allowance(address, this.contractAddress);
      
      // If allowance is insufficient, approve first
      if (allowance.lt(parsedAmount)) {
        const approveTx = await usdcContract.approve(this.contractAddress, parsedAmount);
        await approveTx.wait();
      }
      
      try {
        // Try to execute closePosition transaction with the exact borrowed amount
        const tx = await this.contract!.closePosition(parsedAmount);
        return tx;
      } catch (error: any) {
        // Check if the error is due to insufficient collateral
        if (error.message && error.message.includes("You do not have enough collateral to close position")) {
          console.log("Not enough collateral to close position normally, trying flash close...");
          // Fall back to flash close position
          return await this.flashClosePosition();
        }
        // If it's a different error, rethrow it
        throw error;
      }
    } catch (error) {
      console.error('Error closing position:', error);
      throw error;
    }
  }

  // Flash close position (repay loan using flash loan)
  public async flashClosePosition(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Check if user has an active loan first
      const hasLoan = await this.hasActiveLoan();
      if (!hasLoan) {
        throw new Error("No active loan to close");
      }
      
      // Get the user's loan to log details for debugging
      const loan = await this.getUserLoan();
      console.log("Attempting flash close for loan:", {
        borrowed: loan.borrowed,
        collateral: loan.collateral,
        endDate: loan.endDate
      });
      
      try {
        // Execute flashClosePosition transaction
        const tx = await this.contract!.flashClosePosition();
        return tx;
      } catch (error: any) {
        // Check for specific error messages and provide more helpful errors
        if (error.message && error.message.includes("arithmetic")) {
          console.error("Arithmetic error in flash close. This may be due to precision issues with the loan amounts.");
          throw new Error("Failed to flash close position due to calculation error. Please try again or contact support.");
        }
        throw error;
      }
    } catch (error) {
      console.error('Error flash closing position:', error);
      throw error;
    }
  }

  // Remove collateral from a position
  public async removeCollateral(chicksAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(chicksAmount, 6); // CHICKS has 6 decimals
      
      // Execute removeCollateral transaction
      const tx = await this.contract!.removeCollateral(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error removing collateral:', error);
      throw error;
    }
  }

  // Extend loan duration
  public async extendLoan(numberOfDays: number, extensionFee: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedFee = ethers.utils.parseUnits(extensionFee, 6); // USDC has 6 decimals
      
      // Get USDC contract
      const address = await this.signer!.getAddress();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, this.signer!);
      
      // Check allowance
      const allowance = await usdcContract.allowance(address, this.contractAddress);
      
      // If allowance is insufficient, approve first
      if (allowance.lt(parsedFee)) {
        const approveTx = await usdcContract.approve(this.contractAddress, parsedFee);
        await approveTx.wait();
      }
      
      // Execute extendLoan transaction
      const tx = await this.contract!.extendLoan(numberOfDays, parsedFee);
      return tx;
    } catch (error) {
      console.error('Error extending loan:', error);
      throw error;
    }
  }

  // Get borrow fee
  public async getBorrowFee(usdcAmount: string, numberOfDays: number): Promise<string> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      
      // Calculate the fee using the correct function name getInterestFee
      const fee = await this.contract!.getInterestFee(parsedAmount, numberOfDays);
      
      return ethers.utils.formatUnits(fee, 6);
    } catch (error) {
      console.error('Error calculating borrow fee:', error);
      throw error;
    }
  }

  // Liquidate a position
  public async liquidate(): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      // Execute liquidate transaction
      const tx = await this.contract!.liquidate();
      return tx;
    } catch (error) {
      console.error('Error liquidating position:', error);
      throw error;
    }
  }

  // Add collateral to a position
  public async addCollateral(chicksAmount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    
    try {
      const parsedAmount = ethers.utils.parseUnits(chicksAmount, 6); // CHICKS has 6 decimals
      
      // Execute addCollateral transaction
      const tx = await this.contract!.addCollateral(parsedAmount);
      return tx;
    } catch (error) {
      console.error('Error adding collateral:', error);
      throw error;
    }
  }

  // Get liquidation price for a user's position
  public async getLiquidationPrice(): Promise<string> {
    await this.ensureInitialized();
    
    try {
      const address = await this.signer!.getAddress();
      
      // Get user's loan data
      const loan = await this.contract!.loans(address);
      
      // If no loan, return 0
      if (loan.borrowed.eq(0)) {
        return '0';
      }
      
      // Calculate liquidation price
      // Liquidation happens when collateral value = debt * liquidation threshold (usually 110%)
      // So: collateral * liquidation_price = debt * 1.1
      // liquidation_price = (debt * 1.1) / collateral
      const totalDebt = loan.borrowed.add(loan.interest);
      const liquidationThreshold = ethers.BigNumber.from(110).mul(totalDebt).div(100);
      const liquidationPrice = liquidationThreshold.mul(ethers.utils.parseUnits('1', 6)).div(loan.collateral);
      
      return ethers.utils.formatUnits(liquidationPrice, 6);
    } catch (error) {
      console.error('Error calculating liquidation price:', error);
      throw error;
    }
  }

  // Get health factor for a user's position
  public async getHealthFactor(): Promise<string> {
    await this.ensureInitialized();
    
    try {
      const address = await this.signer!.getAddress();
      
      // Get user's loan data
      const loan = await this.contract!.loans(address);
      
      // If no loan, return max health factor
      if (loan.borrowed.eq(0)) {
        return '999';
      }
      
      // Get current price
      const price = await this.contract!.lastPrice();
      
      // Calculate health factor
      // Health factor = (collateral * price) / (borrowed + interest)
      const collateralValue = loan.collateral.mul(price).div(ethers.utils.parseUnits('1', 6));
      const totalDebt = loan.borrowed.add(loan.interest);
      const healthFactor = collateralValue.mul(100).div(totalDebt);
      
      return ethers.utils.formatUnits(healthFactor, 2);
    } catch (error) {
      console.error('Error calculating health factor:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const chicksService = new ChicksService();
export default chicksService;
