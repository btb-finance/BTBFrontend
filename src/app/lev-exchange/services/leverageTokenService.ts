import { ethers } from 'ethers';

// Contract addresses on Base Sepolia
export const LEVERAGE_TOKEN_FACTORY = '0x4b95dB6aE06Fd6Eb248bC8587a1466c8345e0873';
export const LEVERAGE_MIMO_TOKEN = '0x37BA881a5358aEA5c71B8A69BCc831E2ACAABdbD';
export const MIMO_TOKEN = '0x2e481Be4F28aF8F0597c62fbca3f2E180B8E8AC1';

// Factory ABI (truncated for key functions)
const FACTORY_ABI = [
  "function getAllTokens() external view returns (address[])",
  "function getActiveTokens() external view returns (address[])",
  "function getTokenInfo(address backingToken) external view returns (tuple(address backingToken, address leverageContract, string name, string symbol, uint256 deployedAt, bool active))",
  "function isTokenActive(address backingToken) external view returns (bool)",
  "function getPlatformStats() external view returns (uint256 totalTokens, uint256 activeTokens, uint256 totalVolume, uint256 totalFeesCollected)"
];

// Leverage Token ABI (key trading functions)
const LEVERAGE_TOKEN_ABI = [
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function getBacking() external view returns (uint256)",
  "function lastPrice() external view returns (uint256)",
  "function buy(address receiver, uint256 amount) external",
  "function sell(uint256 tokens) external",
  "function getBuyAmount(uint256 amount) external view returns (uint256)",
  "function getBuyTokens(uint256 amount) external view returns (uint256)",
  "function getBuyFee() external view returns (uint256)",
  "function TokensToBacking(uint256 value) external view returns (uint256)",
  "function BackingToTokens(uint256 value) external view returns (uint256)",
  "function leverage(uint256 backingAmount, uint256 numberOfDays) external",
  "function borrow(uint256 backingAmount, uint256 numberOfDays) external",
  "function repay(uint256 amount) external",
  "function closePosition() external",
  "function getLoanByAddress(address _address) external view returns (uint256, uint256, uint256)",
  "function isLoanExpired(address _address) external view returns (bool)"
];

export interface TokenInfo {
  backingToken: string;
  leverageContract: string;
  name: string;
  symbol: string;
  deployedAt: number;
  active: boolean;
  price?: string;
  priceChange24h?: number;
  volume24h?: string;
  tvl?: string;
  leverage?: string;
  apy?: string;
}

export interface PlatformStats {
  totalTokens: number;
  activeTokens: number;
  totalVolume: string;
  totalFeesCollected: string;
}

export interface UserBalance {
  token: string;
  balance: string;
  backingBalance: string;
}

export interface LoanInfo {
  collateral: string;
  borrowed: string;
  endDate: number;
  isExpired: boolean;
}

class LeverageTokenService {
  private provider: ethers.providers.Web3Provider | null = null;
  private factoryContract: ethers.Contract | null = null;

  async initializeProvider() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      this.factoryContract = new ethers.Contract(
        LEVERAGE_TOKEN_FACTORY,
        FACTORY_ABI,
        this.provider
      );
    }
  }

  async connectWallet(): Promise<string[]> {
    await this.initializeProvider();
    if (!this.provider) throw new Error('No wallet provider found');
    
    const accounts = await this.provider.send('eth_requestAccounts', []);
    return accounts;
  }

  async getPlatformStats(): Promise<PlatformStats> {
    if (!this.factoryContract) await this.initializeProvider();
    if (!this.factoryContract) throw new Error('Factory contract not initialized');

    try {
      const stats = await this.factoryContract.getPlatformStats();
      return {
        totalTokens: stats.totalTokens.toNumber(),
        activeTokens: stats.activeTokens.toNumber(),
        totalVolume: ethers.utils.formatEther(stats.totalVolume),
        totalFeesCollected: ethers.utils.formatEther(stats.totalFeesCollected)
      };
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      // Return mock data for demo
      return {
        totalTokens: 2,
        activeTokens: 2,
        totalVolume: '1200000',
        totalFeesCollected: '12000'
      };
    }
  }

  async getAllTokens(): Promise<TokenInfo[]> {
    if (!this.factoryContract) await this.initializeProvider();
    if (!this.factoryContract) throw new Error('Factory contract not initialized');

    try {
      const tokenAddresses = await this.factoryContract.getAllTokens();
      const tokenInfos = await Promise.all(
        tokenAddresses.map(async (address: string) => {
          const info = await this.factoryContract!.getTokenInfo(address);
          return {
            backingToken: info.backingToken,
            leverageContract: info.leverageContract,
            name: info.name,
            symbol: info.symbol,
            deployedAt: info.deployedAt.toNumber(),
            active: info.active
          };
        })
      );
      
      // Enhance with additional data (price, volume, etc.)
      return this.enhanceTokenData(tokenInfos);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      // Return mock data for demo
      return this.getMockTokens();
    }
  }

  async getActiveTokens(): Promise<TokenInfo[]> {
    const allTokens = await this.getAllTokens();
    return allTokens.filter(token => token.active);
  }

  async getTokenContract(address: string): Promise<ethers.Contract | null> {
    if (!this.provider) await this.initializeProvider();
    if (!this.provider) return null;

    return new ethers.Contract(address, LEVERAGE_TOKEN_ABI, this.provider);
  }

  async getUserBalance(tokenAddress: string, userAddress: string): Promise<UserBalance> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) throw new Error('Token contract not found');

    try {
      const [tokenBalance, backingAmount] = await Promise.all([
        contract.balanceOf(userAddress),
        contract.getBacking()
      ]);

      return {
        token: ethers.utils.formatEther(tokenBalance),
        balance: ethers.utils.formatEther(tokenBalance),
        backingBalance: ethers.utils.formatEther(backingAmount)
      };
    } catch (error) {
      console.error('Error fetching user balance:', error);
      return {
        token: '0',
        balance: '0',
        backingBalance: '0'
      };
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<string> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) return '0';

    try {
      const price = await contract.lastPrice();
      return ethers.utils.formatEther(price);
    } catch (error) {
      console.error('Error fetching token price:', error);
      return '0';
    }
  }

  async getBuyQuote(tokenAddress: string, amount: string): Promise<{
    tokensOut: string;
    priceImpact: string;
    fee: string;
  }> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) throw new Error('Token contract not found');

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const [tokensOut, fee] = await Promise.all([
        contract.getBuyTokens(amountWei),
        contract.getBuyFee()
      ]);

      return {
        tokensOut: ethers.utils.formatEther(tokensOut),
        priceImpact: '0.1', // Calculate based on slippage
        fee: ethers.utils.formatEther(fee)
      };
    } catch (error) {
      console.error('Error getting buy quote:', error);
      return {
        tokensOut: '0',
        priceImpact: '0',
        fee: '0'
      };
    }
  }

  async executeBuy(tokenAddress: string, amount: string, userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    
    const signer = this.provider.getSigner();
    const contract = new ethers.Contract(tokenAddress, LEVERAGE_TOKEN_ABI, signer);
    
    const amountWei = ethers.utils.parseEther(amount);
    const tx = await contract.buy(userAddress, amountWei);
    
    return tx.hash;
  }

  async executeSell(tokenAddress: string, tokenAmount: string): Promise<string> {
    if (!this.provider) throw new Error('Provider not initialized');
    
    const signer = this.provider.getSigner();
    const contract = new ethers.Contract(tokenAddress, LEVERAGE_TOKEN_ABI, signer);
    
    const tokenAmountWei = ethers.utils.parseEther(tokenAmount);
    const tx = await contract.sell(tokenAmountWei);
    
    return tx.hash;
  }

  async getUserLoan(tokenAddress: string, userAddress: string): Promise<LoanInfo | null> {
    const contract = await this.getTokenContract(tokenAddress);
    if (!contract) return null;

    try {
      const [collateral, borrowed, endDate] = await contract.getLoanByAddress(userAddress);
      const isExpired = await contract.isLoanExpired(userAddress);

      return {
        collateral: ethers.utils.formatEther(collateral),
        borrowed: ethers.utils.formatEther(borrowed),
        endDate: endDate.toNumber(),
        isExpired
      };
    } catch (error) {
      console.error('Error fetching loan info:', error);
      return null;
    }
  }

  private async enhanceTokenData(tokens: TokenInfo[]): Promise<TokenInfo[]> {
    // In a real implementation, fetch price data from external sources
    // For now, return mock enhanced data
    return tokens.map((token, index) => ({
      ...token,
      price: index === 0 ? '$0.95' : '$2,845.67',
      priceChange24h: index === 0 ? -2.34 : 3.42,
      volume24h: index === 0 ? '$45,230' : '$125,890',
      tvl: index === 0 ? '$892,456' : '$2,340,123',
      leverage: index === 0 ? '2.5x' : '3.0x',
      apy: index === 0 ? '15.6%' : '12.3%'
    }));
  }

  private getMockTokens(): TokenInfo[] {
    return [
      {
        backingToken: MIMO_TOKEN,
        leverageContract: LEVERAGE_MIMO_TOKEN,
        name: 'Leverage MiMo GaMe',
        symbol: 'levMIMO',
        deployedAt: 1705363200, // 2024-01-15
        active: true,
        price: '$0.95',
        priceChange24h: -2.34,
        volume24h: '$45,230',
        tvl: '$892,456',
        leverage: '2.5x',
        apy: '15.6%'
      },
      {
        backingToken: '0x4200000000000000000000000000000000000006', // WETH on Base
        leverageContract: '0x...',
        name: 'Leverage Ethereum',
        symbol: 'levETH',
        deployedAt: 1705795200, // 2024-01-20
        active: false, // Set to false since it's not deployed yet
        price: '$2,845.67',
        priceChange24h: 3.42,
        volume24h: '$125,890',
        tvl: '$2,340,123',
        leverage: '3.0x',
        apy: '12.3%'
      }
    ];
  }
}

// Helper function to get token symbol from address
export const getTokenSymbolFromAddress = (address: string): string => {
  switch (address.toLowerCase()) {
    case MIMO_TOKEN.toLowerCase():
      return 'MIMO';
    case '0x4200000000000000000000000000000000000006': // WETH on Base
      return 'WETH';
    default:
      return 'Unknown';
  }
};

export default new LeverageTokenService();