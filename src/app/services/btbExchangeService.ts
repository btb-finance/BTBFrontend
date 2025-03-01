import { ethers } from 'ethers';
import { BTBExchangeABI } from '../contracts/BTBExchange';
import { BTBTokenABI } from '../contracts/BTBToken';

interface ContractError extends Error {
  data?: {
    originalError?: {
      data: string;
    };
  };
}

// Base network configuration
const BASE_NETWORK = {
  chainId: 8453,
  name: 'Base',
  rpcUrl: 'https://mainnet.base.org',
  blockExplorer: 'https://basescan.org',
};

class BTBExchangeService {
  private contract: ethers.Contract | null = null;
  private provider: ethers.providers.StaticJsonRpcProvider | null = null;
  private signer: ethers.Signer | null = null;
  private isInitialized = false;

  // Contract addresses for Base Mainnet
  private readonly contractAddress = '0xBB8c1a46DCe6e0D90B7226b56700B1B1166FA8BB';
  private readonly tokenAddress = '0xBB6e8c1e49f04C9f6c4D6163c52990f92431FdBB';
  private readonly usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  private readonly btbTokenAddress = '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB';

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
      BTBExchangeABI,
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
        BTBExchangeABI,
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
      BTBExchangeABI,
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

  public async getCurrentPrice(): Promise<string> {
    try {
      const price = await this.contract!.getCurrentPrice();
      return ethers.utils.formatUnits(price, 6); // USDC has 6 decimals
    } catch (error) {
      console.error('Error getting current price:', error);
      throw error;
    }
  }

  public async getBTBStatus() {
    try {
      const address = this.signer ? await this.signer.getAddress() : null;
      if (!address) throw new Error('No wallet connected');

      const [totalDeposited, lockedAmount, availableAmount, lockReleaseTimestamp] = await this.contract!.getUserBTBStatus(address);

      return {
        totalDeposited: ethers.utils.formatEther(totalDeposited),
        lockedAmount: ethers.utils.formatEther(lockedAmount),
        availableAmount: ethers.utils.formatEther(availableAmount),
        lockReleaseTimestamp: lockReleaseTimestamp.toNumber()
      };
    } catch (error) {
      console.error('Error getting BTB status:', error);
      throw error;
    }
  }

  public async depositBTB(amount: string) {
    await this.ensureInitialized();

    const btbToken = new ethers.Contract(
      this.btbTokenAddress,
      BTBTokenABI,
      this.signer!
    );

    const parsedAmount = ethers.utils.parseEther(amount);
    
    // Check existing allowance
    const address = await this.signer!.getAddress();
    const currentAllowance = await btbToken.allowance(address, this.contractAddress);
    
    let tx1;
    if (currentAllowance.lt(parsedAmount)) {
      // First approve the exchange contract
      tx1 = await btbToken.approve(this.contractAddress, parsedAmount);
    }

    // Then deposit
    const tx2 = await this.contract!.depositBTB(parsedAmount);

    return { tx1, tx2 };
  }

  public async withdrawBTB(amount: string): Promise<ethers.ContractTransaction> {
    await this.ensureInitialized();
    const parsedAmount = ethers.utils.parseEther(amount);
    const tx = await this.contract!.withdrawBTB(parsedAmount);
    return tx;
  }

  public async unlockBTB() {
    await this.ensureInitialized();
    const tx = await this.contract!.unlockBTB();
    await tx.wait();
  }

  public async quoteTokensForUsdc(usdcAmount: string) {
    try {
      const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6); // USDC has 6 decimals
      const [tokenAmount, adminFee, platformFee, totalFee] = await this.contract!.quoteTokensForUsdc(parsedAmount);
      
      return {
        tokenAmount: ethers.utils.formatEther(tokenAmount),
        adminFeeAmount: ethers.utils.formatUnits(adminFee, 6),
        platformFeeAmount: ethers.utils.formatUnits(platformFee, 6),
        totalFeeAmount: ethers.utils.formatUnits(totalFee, 6)
      };
    } catch (error) {
      console.error('Error getting token quote:', error);
      throw error;
    }
  }

  public async quoteUsdcForTokens(tokenAmount: string) {
    try {
      const parsedAmount = ethers.utils.parseEther(tokenAmount);
      const [usdcAmount, adminFee, platformFee] = await this.contract!.quoteUsdcForTokens(parsedAmount);
      
      return {
        usdcAmount: ethers.utils.formatUnits(usdcAmount, 6),
        adminFeeAmount: ethers.utils.formatUnits(adminFee, 6),
        platformFeeAmount: ethers.utils.formatUnits(platformFee, 6),
        totalFeeAmount: ethers.utils.formatUnits(adminFee.add(platformFee), 6)
      };
    } catch (error) {
      console.error('Error getting USDC quote:', error);
      throw error;
    }
  }

  public async buyTokens(usdcAmount: string) {
    await this.ensureInitialized();
    
    // First approve USDC with complete ABI
    const usdcToken = new ethers.Contract(
      this.usdcAddress,
      [
        'function approve(address spender, uint256 amount) public returns (bool)',
        'function allowance(address owner, address spender) public view returns (uint256)',
        'function balanceOf(address account) public view returns (uint256)',
        'function decimals() public view returns (uint8)',
        'function symbol() public view returns (string)',
        'function name() public view returns (string)',
        'function totalSupply() public view returns (uint256)',
        'function transfer(address recipient, uint256 amount) public returns (bool)'
      ],
      this.signer!
    );

    const parsedAmount = ethers.utils.parseUnits(usdcAmount, 6);
    
    try {
      // Validate input amount
      if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
        throw new Error('Invalid USDC amount');
      }

      // Check USDC balance
      const address = await this.signer!.getAddress();
      const balance = await usdcToken.balanceOf(address);
      if (balance.lt(parsedAmount)) {
        throw new Error('Insufficient USDC balance');
      }

     // Get quote to validate liquidity
      const quote = await this.quoteTokensForUsdc(usdcAmount).catch((error: ContractError) => {
        if (error.data?.originalError?.data) {
          const decodedError = this.contract!.interface.parseError(error.data.originalError.data);
          throw new Error(`Quote failed: ${decodedError.name}`);
        }
        throw error;
      });

      if (!quote.tokenAmount || parseFloat(quote.tokenAmount) <= 0) {
        throw new Error('Insufficient liquidity in the exchange');
      }

      // Check existing allowance
      const currentAllowance = await usdcToken.allowance(address, this.contractAddress);
      
      let tx1;
      if (currentAllowance.lt(parsedAmount)) {
        // First approve the exchange contract with max allowance for better UX
        const maxApproval = ethers.constants.MaxUint256;
        tx1 = await usdcToken.approve(this.contractAddress, maxApproval);
        await tx1.wait(); // Wait for approval to be mined
      }

      // Try to execute the buy transaction with a fixed gas limit
      const tx2 = await this.contract!.buyTokens(parsedAmount, {
        gasLimit: 500000 // Set a reasonable fixed gas limit
      }).catch((error: ContractError) => {
        // Decode contract revert reason if available
        if (error.data?.originalError?.data) {
          try {
            const decodedError = this.contract!.interface.parseError(error.data.originalError.data);
            throw new Error(`Transaction failed: ${decodedError.name}`);
          } catch (e) {
            // If we can't decode the error, check for common cases
            if (error.data.originalError.data.includes('0x0d25268d')) {
              throw new Error('Insufficient liquidity or price slippage too high');
            }
            throw new Error('Transaction would fail: Please check your input parameters and try again');
          }
        }
        throw error;
      });

      // Wait for transaction confirmation
      await tx2.wait();
      
      return { tx1, tx2 };
    } catch (error: any) {
      console.error('Buy tokens error:', error);

      // Format user-friendly error messages
      if (error.message.includes('user rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient ETH for gas fees');
      } else if (error.message.includes('execution reverted')) {
        throw new Error('Transaction reverted: The exchange might be paused or have insufficient liquidity');
      }

      // Throw the original error if none of the above conditions match
      throw error;
    }
  }

  public async getBTBYBalance(address?: string): Promise<string> {
    try {
      const userAddress = address || (this.signer ? await this.signer.getAddress() : null);
      if (!userAddress) throw new Error('No wallet connected');

      const btbyToken = new ethers.Contract(
        this.tokenAddress,
        ['function balanceOf(address account) public view returns (uint256)'],
        this.provider!
      );

      const balance = await btbyToken.balanceOf(userAddress);
      return ethers.utils.formatEther(balance);
    } catch (error) {
      console.error('Error getting BTBY balance:', error);
      return '0';
    }
  }

  public async sellTokens(tokenAmount: string) {
    await this.ensureInitialized();

    try {
      // Validate input amount
      if (!tokenAmount || parseFloat(tokenAmount) <= 0) {
        throw new Error('Invalid token amount');
      }

      // Create BTBY token contract instance
      const btbyToken = new ethers.Contract(
        this.tokenAddress,
        [
          'function balanceOf(address account) public view returns (uint256)',
          'function approve(address spender, uint256 amount) public returns (bool)',
          'function allowance(address owner, address spender) public view returns (uint256)'
        ],
        this.signer!
      );

      // Get user's address
      const address = await this.signer!.getAddress();

      // Check BTBY balance
      const balance = await btbyToken.balanceOf(address);
      const parsedAmount = ethers.utils.parseEther(tokenAmount);
      if (balance.lt(parsedAmount)) {
        throw new Error(`Insufficient BTBY balance. You have ${ethers.utils.formatEther(balance)} BTBY`);
      }

      // Check allowance and approve if needed
      const currentAllowance = await btbyToken.allowance(address, this.contractAddress);
      if (currentAllowance.lt(parsedAmount)) {
        const approveTx = await btbyToken.approve(this.contractAddress, ethers.constants.MaxUint256);
        await approveTx.wait();
      }

      // Get quote to validate liquidity
      const quote = await this.quoteUsdcForTokens(tokenAmount).catch((error) => {
        if (error.data?.originalError?.data) {
          const decodedError = this.contract!.interface.parseError(error.data.originalError.data);
          throw new Error(`Quote failed: ${decodedError.name}`);
        }
        throw error;
      });

      if (!quote.usdcAmount || parseFloat(quote.usdcAmount) <= 0) {
        throw new Error('Insufficient liquidity in the exchange');
      }

      const tx = await this.contract!.sellTokens(parsedAmount, {
        gasLimit: 500000 // Set a reasonable fixed gas limit
      }).catch((error: ContractError) => {
        if (error.data?.originalError?.data) {
          const decodedError = this.contract!.interface.parseError(error.data.originalError.data);
          throw new Error(`Transaction failed: ${decodedError.name}`);
        }
        throw error;
      });

      await tx.wait();
      return tx;
    } catch (error: any) {
      console.error('Sell tokens error:', error);

      // Format user-friendly error messages
      if (error.message.includes('user rejected')) {
        throw new Error('Transaction was rejected by user');
      } else if (error.message.includes('insufficient funds')) {
        throw new Error('Insufficient ETH for gas fees');
      } else if (error.message.includes('execution reverted')) {
        throw new Error('Transaction reverted: The exchange might be paused or have insufficient liquidity');
      }

      // Throw the original error if none of the above conditions match
      throw error;
    }
  }
}

// Create a singleton instance
const btbExchangeService = new BTBExchangeService();
export default btbExchangeService;
