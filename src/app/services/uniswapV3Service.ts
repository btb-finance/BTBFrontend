import { ethers } from 'ethers';
import { getPublicApiUrl } from '../hooks-v2/usePublicApi';

// Uniswap V3 Contract ABIs
const UNISWAP_V3_POSITION_MANAGER_ABI = [
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
];

const UNISWAP_V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
];

const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
];

// Contract addresses
const UNISWAP_V3_ADDRESSES = {
  POSITION_MANAGER: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // NonfungiblePositionManager
  FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
};

// ETH-USDC Pool addresses
const ETH_USDC_POOLS = {
  '0.05%': '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
  '0.3%': '0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8',
};

// Types for Uniswap V3 position
export interface Position {
  tokenId: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0: string;
  amount1: string;
}

export interface PositionWithMetrics extends Position {
  currentPrice: number;
  priceLower: number;
  priceUpper: number;
  inRange: boolean;
  impermanentLoss: number;
  recoveryUpperTick: number;
  recoveryUpperPrice: number;
  valueAtEntry: number;
  currentValue: number;
  feesEarned: number;
  token0Percentage: number; // Percentage of position value in token0
}

export interface IUniswapV3Service {
  getCurrentEthPrice(): Promise<number>;
  getPositions(walletAddress: string): Promise<Position[]>;
  getPositionDetails(tokenId: string): Promise<Position>;
  getPositionsWithMetrics(walletAddress: string): Promise<PositionWithMetrics[]>;
  getMockPositions(): Promise<PositionWithMetrics[]>;
  priceToTick(price: number): number;
  tickToPrice(tick: number): number;
  calculateRecoveryUpperTick(position: Position, currentEthPrice: number): number;
}

class UniswapV3Service implements IUniswapV3Service {
  private provider: ethers.providers.Provider;
  private positionManager: ethers.Contract;
  
  constructor() {
    // Initialize provider using Ethereum mainnet
    // Try multiple RPC providers for better reliability
    const rpcUrls = [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
      'https://cloudflare-eth.com',
    ];
    
    // Try to connect to the first available RPC
    this.provider = new ethers.providers.FallbackProvider(
      rpcUrls.map((url, i) => ({
        provider: new ethers.providers.JsonRpcProvider(url),
        priority: i + 1, // Lower number = higher priority
        stallTimeout: 2000,
      }))
    );
    
    // Initialize position manager contract
    this.positionManager = new ethers.Contract(
      UNISWAP_V3_ADDRESSES.POSITION_MANAGER,
      UNISWAP_V3_POSITION_MANAGER_ABI,
      this.provider
    );
  }
  
  // Function to calculate tick to price
  tickToPrice(tick: number): number {
    return 1.0001 ** tick;
  }

  // Function to calculate price to tick
  priceToTick(price: number): number {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }
  
  // Get current ETH price from CoinGecko
  async getCurrentEthPrice(): Promise<number> {
    try {
      // First try CoinGecko API
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.ethereum && data.ethereum.usd) {
          console.log('ETH price from CoinGecko:', data.ethereum.usd);
          return data.ethereum.usd;
        }
      }
      
      // If CoinGecko fails, try backup source
      const backupResponse = await fetch('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD');
      
      if (backupResponse.ok) {
        const backupData = await backupResponse.json();
        if (backupData && backupData.USD) {
          console.log('ETH price from CryptoCompare:', backupData.USD);
          return backupData.USD;
        }
      }
      
      // If both APIs fail, try Uniswap pool as last resort
      console.warn('External price APIs failed, falling back to Uniswap pool');
      return this.getEthPriceFromUniswap();
    } catch (error) {
      console.error('Error getting ETH price from APIs:', error);
      // Fallback to Uniswap pool
      return this.getEthPriceFromUniswap();
    }
  }
  
  // Get ETH price from Uniswap V3 pool (as fallback)
  private async getEthPriceFromUniswap(): Promise<number> {
    try {
      // Use the 0.3% ETH-USDC pool for price
      const poolContract = new ethers.Contract(
        ETH_USDC_POOLS['0.3%'],
        UNISWAP_V3_POOL_ABI,
        this.provider
      );
      
      // Get the current price from slot0
      const slot0 = await poolContract.slot0();
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      
      // Convert sqrtPriceX96 to price
      // For ETH/USDC, we need to adjust for decimals (ETH has 18, USDC has 6)
      const price = (sqrtPriceX96 * sqrtPriceX96 * (10 ** 6)) / (2 ** 192 * (10 ** 18));
      
      // Sanity check - if price is too low or too high, return a reasonable default
      if (price < 100 || price > 10000) {
        console.warn('Uniswap price out of reasonable range:', price);
        return 3000; // Default fallback
      }
      
      console.log('ETH price from Uniswap:', price);
      return price;
    } catch (error) {
      console.error('Error getting ETH price from Uniswap:', error);
      // Fallback to a default price if there's an error
      return 3000;
    }
  }
  
  // Get all Uniswap V3 positions for a wallet
  async getPositions(walletAddress: string): Promise<Position[]> {
    try {
      // Get the number of positions owned by the wallet
      const balance = await this.positionManager.balanceOf(walletAddress);
      
      // If balance is 0, return empty array
      if (balance.toNumber() === 0) {
        console.log(`No positions found for wallet ${walletAddress}`);
        return [];
      }
      
      // Get all position token IDs
      const tokenIds = [];
      for (let i = 0; i < balance.toNumber(); i++) {
        try {
          const tokenId = await this.positionManager.tokenOfOwnerByIndex(walletAddress, i);
          tokenIds.push(tokenId);
        } catch (error) {
          console.error(`Error getting token ID at index ${i}:`, error);
        }
      }
      
      // If no token IDs were found, return empty array
      if (tokenIds.length === 0) {
        console.log(`No token IDs found for wallet ${walletAddress}`);
        return [];
      }
      
      // Get position details for each token ID
      const positions: Position[] = [];
      
      for (const tokenId of tokenIds) {
        try {
          const position = await this.getPositionDetails(tokenId.toString());
          positions.push(position);
        } catch (error) {
          console.error(`Error getting details for position ${tokenId}:`, error);
          // Skip this position and continue with others
        }
      }
      
      return positions;
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }
  
  // Get details for a specific position
  async getPositionDetails(tokenId: string): Promise<Position> {
    try {
      // Get position data from the position manager
      const positionData = await this.positionManager.positions(tokenId);
      
      // Check if we have valid position data
      if (!positionData || !positionData.token0 || !positionData.token1) {
        throw new Error(`Invalid position data for token ID ${tokenId}`);
      }
      
      // Get token information
      const token0Contract = new ethers.Contract(
        positionData.token0,
        ERC20_ABI,
        this.provider
      );
      
      const token1Contract = new ethers.Contract(
        positionData.token1,
        ERC20_ABI,
        this.provider
      );
      
      // Get token symbols and decimals
      let token0Symbol, token1Symbol, token0Decimals, token1Decimals;
      
      try {
        [
          token0Symbol,
          token1Symbol,
          token0Decimals,
          token1Decimals
        ] = await Promise.all([
          token0Contract.symbol(),
          token1Contract.symbol(),
          token0Contract.decimals(),
          token1Contract.decimals()
        ]);
      } catch (error) {
        console.error(`Error getting token information for position ${tokenId}:`, error);
        // Use default values if we can't get token information
        token0Symbol = "Unknown";
        token1Symbol = "Unknown";
        token0Decimals = 18;
        token1Decimals = 18;
      }
      
      // Only continue with ETH-USDC positions
      const isEthUsdcPair = 
        (token0Symbol === 'WETH' && token1Symbol === 'USDC') || 
        (token1Symbol === 'USDC' && token0Symbol === 'WETH');
        
      if (!isEthUsdcPair) {
        throw new Error(`Position ${tokenId} is not an ETH-USDC pair`);
      }
      
      // Get pool contract to calculate amounts
      const poolAddress = await this.getPoolAddress(
        positionData.token0,
        positionData.token1,
        positionData.fee
      );
      
      const poolContract = new ethers.Contract(
        poolAddress,
        UNISWAP_V3_POOL_ABI,
        this.provider
      );
      
      // Get current tick from pool
      const slot0 = await poolContract.slot0();
      const currentTick = slot0.tick;
      
      // Calculate amounts based on liquidity and ticks
      // This is a simplified calculation
      const sqrtRatioA = Math.sqrt(1.0001 ** positionData.tickLower);
      const sqrtRatioB = Math.sqrt(1.0001 ** positionData.tickUpper);
      const sqrtRatioC = Math.sqrt(1.0001 ** currentTick);
      
      let amount0 = 0;
      let amount1 = 0;
      
      // Calculate amounts based on current tick position
      if (currentTick <= positionData.tickLower) {
        // All liquidity is in token0
        amount0 = positionData.liquidity * (1 / sqrtRatioA - 1 / sqrtRatioB);
        amount1 = 0;
      } else if (currentTick >= positionData.tickUpper) {
        // All liquidity is in token1
        amount0 = 0;
        amount1 = positionData.liquidity * (sqrtRatioB - sqrtRatioA);
      } else {
        // Liquidity is in both tokens
        amount0 = positionData.liquidity * (1 / sqrtRatioC - 1 / sqrtRatioB);
        amount1 = positionData.liquidity * (sqrtRatioC - sqrtRatioA);
      }
      
      // Return position data
      return {
        tokenId,
        token0: positionData.token0,
        token1: positionData.token1,
        token0Symbol,
        token1Symbol,
        token0Decimals,
        token1Decimals,
        fee: positionData.fee,
        tickLower: positionData.tickLower,
        tickUpper: positionData.tickUpper,
        liquidity: positionData.liquidity.toString(),
        amount0: ethers.utils.parseUnits(amount0.toString(), token0Decimals).toString(),
        amount1: ethers.utils.parseUnits(amount1.toString(), token1Decimals).toString(),
      };
    } catch (error) {
      console.error(`Error getting position details for token ID ${tokenId}:`, error);
      throw error;
    }
  }
  
  // Get pool address from factory
  async getPoolAddress(token0: string, token1: string, fee: number): Promise<string> {
    try {
      // For ETH-USDC pools, return the known addresses
      if (
        (token0.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' && 
         token1.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48') ||
        (token1.toLowerCase() === '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' && 
         token0.toLowerCase() === '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
      ) {
        if (fee === 500) {
          return ETH_USDC_POOLS['0.05%'];
        } else if (fee === 3000) {
          return ETH_USDC_POOLS['0.3%'];
        }
      }
      
      // If it's not a known pool, use a fallback
      // For this app, we're focusing on ETH-USDC pools, so return the 0.3% pool as fallback
      console.warn('Unknown pool, using 0.3% ETH-USDC pool as fallback');
      return ETH_USDC_POOLS['0.3%'];
    } catch (error) {
      console.error('Error getting pool address:', error);
      // Return the 0.3% pool as a fallback
      return ETH_USDC_POOLS['0.3%'];
    }
  }
  
  // Calculate recovery upper tick for a position
  calculateRecoveryUpperTick(position: Position, currentPrice: number): number {
    // Calculate price boundaries
    const priceLower = this.tickToPrice(position.tickLower);
    const priceUpper = this.tickToPrice(position.tickUpper);
    
    // Calculate current position value
    const amount0 = parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals));
    const amount1 = parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals));
    const currentValue = amount0 * currentPrice + amount1;
    
    // Value if held without LP
    const initialETH = amount0 + (amount1 / priceLower);
    const valueIfHeld = initialETH * currentPrice;
    
    // Calculate impermanent loss
    const impermanentLoss = (currentValue / valueIfHeld) - 1;
    
    // Calculate recovery price
    const recoveryRatio = 1 / (1 + impermanentLoss);
    const recoveryPrice = currentPrice * recoveryRatio * 1.1; // Add 10% buffer
    
    return this.priceToTick(recoveryPrice);
  }
  
  // Mock data for testing when network is unavailable
  async getMockPositions(): Promise<PositionWithMetrics[]> {
    console.log('Using mock position data for testing');
    
    // Get current ETH price for realistic values
    let currentEthPrice = 3000;
    try {
      currentEthPrice = await this.getCurrentEthPrice();
    } catch (error) {
      console.warn('Could not get current ETH price for demo data, using default', error);
    }
    
    // Create multiple mock positions with different scenarios
    const mockPositions: PositionWithMetrics[] = [
      // Position 1: In-range position with small impermanent loss
      {
        tokenId: '123456',
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        token1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token0Symbol: 'WETH',
        token1Symbol: 'USDC',
        token0Decimals: 18,
        token1Decimals: 6,
        fee: 3000, // 0.3%
        tickLower: this.priceToTick(currentEthPrice * 0.9), // 10% below current price
        tickUpper: this.priceToTick(currentEthPrice * 1.1), // 10% above current price
        liquidity: '1500000000000000000',
        amount0: ethers.utils.parseUnits('0.4', 18).toString(), // 0.4 ETH
        amount1: ethers.utils.parseUnits(Math.floor(currentEthPrice * 0.6).toString(), 6).toString(), // Equivalent USDC
        currentPrice: currentEthPrice,
        priceLower: currentEthPrice * 0.9,
        priceUpper: currentEthPrice * 1.1,
        inRange: true,
        impermanentLoss: -0.015, // 1.5% IL
        recoveryUpperTick: this.priceToTick(currentEthPrice * 1.2),
        recoveryUpperPrice: currentEthPrice * 1.2,
        valueAtEntry: currentEthPrice * 1.0,
        currentValue: currentEthPrice * 0.985, // Value after IL
        feesEarned: currentEthPrice * 0.01, // 1% in fees
        token0Percentage: 0.4, // 40% of position value in token0
      },
      
      // Position 2: Out-of-range position (price moved up)
      {
        tokenId: '234567',
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        token1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token0Symbol: 'WETH',
        token1Symbol: 'USDC',
        token0Decimals: 18,
        token1Decimals: 6,
        fee: 500, // 0.05%
        tickLower: this.priceToTick(currentEthPrice * 0.7), // 30% below current price
        tickUpper: this.priceToTick(currentEthPrice * 0.95), // 5% below current price
        liquidity: '2500000000000000000',
        amount0: '0', // All converted to USDC
        amount1: ethers.utils.parseUnits(Math.floor(currentEthPrice * 1.2).toString(), 6).toString(),
        currentPrice: currentEthPrice,
        priceLower: currentEthPrice * 0.7,
        priceUpper: currentEthPrice * 0.95,
        inRange: false,
        impermanentLoss: -0.045, // 4.5% IL
        recoveryUpperTick: this.priceToTick(currentEthPrice * 0.85),
        recoveryUpperPrice: currentEthPrice * 0.85,
        valueAtEntry: currentEthPrice * 1.2,
        currentValue: currentEthPrice * 1.155, // Value after IL
        feesEarned: currentEthPrice * 0.015, // 1.5% in fees
        token0Percentage: 0, // 0% of position value in token0
      },
      
      // Position 3: Out-of-range position (price moved down)
      {
        tokenId: '345678',
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        token1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token0Symbol: 'WETH',
        token1Symbol: 'USDC',
        token0Decimals: 18,
        token1Decimals: 6,
        fee: 10000, // 1%
        tickLower: this.priceToTick(currentEthPrice * 1.05), // 5% above current price
        tickUpper: this.priceToTick(currentEthPrice * 1.3), // 30% above current price
        liquidity: '3000000000000000000',
        amount0: ethers.utils.parseUnits('1.2', 18).toString(), // All converted to ETH
        amount1: '0',
        currentPrice: currentEthPrice,
        priceLower: currentEthPrice * 1.05,
        priceUpper: currentEthPrice * 1.3,
        inRange: false,
        impermanentLoss: -0.06, // 6% IL
        recoveryUpperTick: this.priceToTick(currentEthPrice * 1.15),
        recoveryUpperPrice: currentEthPrice * 1.15,
        valueAtEntry: currentEthPrice * 1.3,
        currentValue: currentEthPrice * 1.24, // Value after IL
        feesEarned: currentEthPrice * 0.02, // 2% in fees
        token0Percentage: 1.0, // 100% of position value in token0
      },
      
      // Position 4: Narrow range with high fee tier
      {
        tokenId: '456789',
        token0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        token1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        token0Symbol: 'WETH',
        token1Symbol: 'USDC',
        token0Decimals: 18,
        token1Decimals: 6,
        fee: 10000, // 1%
        tickLower: this.priceToTick(currentEthPrice * 0.98), // 2% below current price
        tickUpper: this.priceToTick(currentEthPrice * 1.02), // 2% above current price
        liquidity: '5000000000000000000',
        amount0: ethers.utils.parseUnits('0.25', 18).toString(),
        amount1: ethers.utils.parseUnits(Math.floor(currentEthPrice * 0.75).toString(), 6).toString(),
        currentPrice: currentEthPrice,
        priceLower: currentEthPrice * 0.98,
        priceUpper: currentEthPrice * 1.02,
        inRange: true,
        impermanentLoss: -0.005, // 0.5% IL
        recoveryUpperTick: this.priceToTick(currentEthPrice * 1.03),
        recoveryUpperPrice: currentEthPrice * 1.03,
        valueAtEntry: currentEthPrice * 1.0,
        currentValue: currentEthPrice * 0.995, // Value after IL
        feesEarned: currentEthPrice * 0.03, // 3% in fees (high fee tier)
        token0Percentage: 0.25, // 25% of position value in token0
      }
    ];
    
    return mockPositions;
  }
  
  // Get positions with additional metrics
  async getPositionsWithMetrics(walletAddress: string): Promise<PositionWithMetrics[]> {
    try {
      // Get current ETH price
      const currentEthPrice = await this.getCurrentEthPrice();
      
      // Get all positions
      const positions = await this.getPositions(walletAddress);
      
      // If no positions found and we're in development, use mock data
      if (positions.length === 0 && process.env.NODE_ENV !== 'production') {
        return this.getMockPositions();
      }
      
      // Filter for active positions (with liquidity)
      const activePositions = positions.filter(position => 
        BigInt(position.liquidity) > BigInt(0)
      );
      
      if (activePositions.length === 0) {
        console.log('No active positions found');
        return [];
      }
      
      // Calculate additional metrics for each position
      const positionsWithMetrics: PositionWithMetrics[] = [];
      
      for (const position of activePositions) {
        try {
          // Calculate price range
          const priceLower = this.tickToPrice(position.tickLower);
          const priceUpper = this.tickToPrice(position.tickUpper);
          
          // Check if position is in range
          const inRange = currentEthPrice >= priceLower && currentEthPrice <= priceUpper;
          
          // Determine if ETH is token0 or token1
          const isEthToken0 = position.token0Symbol === 'WETH';
          
          // Get token amounts and adjust for decimals
          const ethAmount = isEthToken0 
            ? parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals))
            : parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals));
            
          const usdcAmount = isEthToken0
            ? parseFloat(ethers.utils.formatUnits(position.amount1, position.token1Decimals))
            : parseFloat(ethers.utils.formatUnits(position.amount0, position.token0Decimals));
          
          // Calculate current value
          const currentValue = ethAmount * currentEthPrice + usdcAmount;
          
          // Calculate value at entry (assuming entry at the lower bound)
          // This is a simplified calculation
          const valueAtEntry = ethAmount * priceLower + usdcAmount;
          
          // Calculate impermanent loss
          // Simplified calculation: compare current value to value if held
          const ethAmountIfHeld = (valueAtEntry / 2) / priceLower;
          const usdcAmountIfHeld = valueAtEntry / 2;
          const valueIfHeld = ethAmountIfHeld * currentEthPrice + usdcAmountIfHeld;
          const impermanentLoss = (currentValue / valueIfHeld) - 1;
          
          // Calculate recovery upper tick
          const recoveryUpperTick = this.calculateRecoveryUpperTick(position, currentEthPrice);
          const recoveryUpperPrice = this.tickToPrice(recoveryUpperTick);
          
          // Estimate fees earned (simplified)
          // In a real implementation, this would be calculated from events or subgraph data
          const feesEarned = currentValue * 0.01; // Assume 1% fees for demo
          
          // Calculate token0 percentage
          const token0Value = ethAmount * currentEthPrice;
          const token0Percentage = (token0Value / currentValue);
          
          positionsWithMetrics.push({
            ...position,
            currentPrice: currentEthPrice,
            priceLower,
            priceUpper,
            inRange,
            impermanentLoss,
            recoveryUpperTick,
            recoveryUpperPrice,
            valueAtEntry,
            currentValue,
            feesEarned,
            token0Percentage,
          });
        } catch (error) {
          console.error(`Error calculating metrics for position ${position.tokenId}:`, error);
          // Skip this position
        }
      }
      
      return positionsWithMetrics;
    } catch (error) {
      console.error('Error getting positions with metrics:', error);
      return [];
    }
  }
}

// Export singleton instance
const uniswapV3Service = new UniswapV3Service();
export default uniswapV3Service;
