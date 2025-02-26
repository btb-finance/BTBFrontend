import { ethers } from 'ethers';
import GraphQLService from './graphQLService';
import { Pool, Token } from '@/app/types/uniswap';

// Constants
const UNISWAP_V4_SUBGRAPH_ID = '2L6yxqUZ7dT6GWoTy9qxNBkf9kEk65me3XPMvbGsmJUZ';

// Define GraphQL queries
const POOLS_QUERY = `
  query GetPools($first: Int, $skip: Int, $orderBy: Pool_orderBy, $orderDirection: OrderDirection) {
    pools(
      first: $first, 
      skip: $skip, 
      orderBy: $orderBy, 
      orderDirection: $orderDirection
    ) {
      id
      poolId
      currency0 {
        id
        name
        symbol
        decimals
      }
      currency1 {
        id
        name
        symbol
        decimals
      }
      liquidity
      sqrtPrice
      tick
      feeTier
      totalValueLockedUSD
      volumeUSD
      feesUSD
    }
  }
`;

const POOLS_BY_TOKEN_QUERY = `
  query GetPoolsByToken($tokenAddress: String, $first: Int) {
    pools(
      first: $first, 
      where: {
        or: [
          { currency0: $tokenAddress }, 
          { currency1: $tokenAddress }
        ]
      },
      orderBy: totalValueLockedUSD,
      orderDirection: desc
    ) {
      id
      poolId
      currency0 {
        id
        name
        symbol
        decimals
      }
      currency1 {
        id
        name
        symbol
        decimals
      }
      liquidity
      sqrtPrice
      tick
      feeTier
      totalValueLockedUSD
      volumeUSD
      feesUSD
    }
  }
`;

const POOL_BY_ID_QUERY = `
  query GetPool($id: ID!) {
    pool(id: $id) {
      id
      poolId
      currency0 {
        id
        name
        symbol
        decimals
      }
      currency1 {
        id
        name
        symbol
        decimals
      }
      liquidity
      sqrtPrice
      tick
      feeTier
      totalValueLockedUSD
      volumeUSD
      feesUSD
    }
  }
`;

class UniswapV4Service {
  private static instance: UniswapV4Service;
  private graphQLService: GraphQLService;
  private apiKey: string;
  private tokenCache: Map<string, Token>;

  private constructor() {
    this.graphQLService = GraphQLService.getInstance();
    this.apiKey = ''; // API key should be stored securely, ideally in environment variables
    this.tokenCache = new Map();
  }

  public static getInstance(): UniswapV4Service {
    if (!UniswapV4Service.instance) {
      UniswapV4Service.instance = new UniswapV4Service();
    }
    return UniswapV4Service.instance;
  }

  // Set API key (from environment or configuration)
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  // Get top pools by liquidity
  public async getTopPoolsByLiquidity(limit: number = 10): Promise<Pool[]> {
    try {
      const data = await this.graphQLService.executeQuery(
        POOLS_QUERY,
        UNISWAP_V4_SUBGRAPH_ID,
        this.apiKey,
        {
          first: limit,
          orderBy: 'totalValueLockedUSD',
          orderDirection: 'desc'
        }
      );

      return data.pools.map((poolData: any) => this.mapGraphQLPoolToPool(poolData));
    } catch (error) {
      console.error('Error fetching top pools by liquidity:', error);
      return this.getMockPools();
    }
  }

  // Get pools with highest APR
  public async getPoolsWithHighestAPR(limit: number = 10): Promise<Pool[]> {
    try {
      // Fetch pools ordered by fee generation relative to TVL as a proxy for APR
      const data = await this.graphQLService.executeQuery(
        POOLS_QUERY,
        UNISWAP_V4_SUBGRAPH_ID,
        this.apiKey,
        {
          first: limit * 2, // Fetch more to filter
          orderBy: 'feesUSD',
          orderDirection: 'desc'
        }
      );

      // Calculate APR for each pool and sort
      const poolsWithAPR = data.pools
        .map((poolData: any) => {
          const pool = this.mapGraphQLPoolToPool(poolData);
          // Calculate APR based on fees relative to TVL
          if (pool.tvl > 0) {
            // Annualize the fees
            const annualizedFees = parseFloat(poolData.feesUSD) * 365 / 7; // Assuming 7 days of data
            pool.apr = (annualizedFees / pool.tvl) * 100;
          }
          return pool;
        })
        .filter((pool: Pool) => pool.tvl > 0 && !isNaN(pool.apr))
        .sort((a: Pool, b: Pool) => b.apr - a.apr)
        .slice(0, limit);

      return poolsWithAPR;
    } catch (error) {
      console.error('Error fetching pools with highest APR:', error);
      return this.getMockPools();
    }
  }

  // Get pools that include a specific token
  public async getPoolsForToken(tokenAddress: string, limit: number = 10): Promise<Pool[]> {
    try {
      // Normalize the token address
      const normalizedAddress = this.normalizeAddress(tokenAddress);
      if (!normalizedAddress) {
        throw new Error(`Invalid token address: ${tokenAddress}`);
      }

      const data = await this.graphQLService.executeQuery(
        POOLS_BY_TOKEN_QUERY,
        UNISWAP_V4_SUBGRAPH_ID,
        this.apiKey,
        {
          tokenAddress: normalizedAddress.toLowerCase(),
          first: limit
        }
      );

      return data.pools.map((poolData: any) => this.mapGraphQLPoolToPool(poolData));
    } catch (error) {
      console.error(`Error fetching pools for token ${tokenAddress}:`, error);
      return [];
    }
  }

  // Get a specific pool by its ID
  public async getPoolById(poolId: string): Promise<Pool | null> {
    try {
      const data = await this.graphQLService.executeQuery(
        POOL_BY_ID_QUERY,
        UNISWAP_V4_SUBGRAPH_ID,
        this.apiKey,
        {
          id: poolId
        }
      );

      if (!data.pool) {
        return null;
      }

      return this.mapGraphQLPoolToPool(data.pool);
    } catch (error) {
      console.error(`Error fetching pool ${poolId}:`, error);
      return null;
    }
  }

  // Get pools for a pair of tokens
  public async getPoolsByTokens(token0Address: string, token1Address: string): Promise<Pool[]> {
    try {
      // Normalize addresses
      const normalizedToken0 = this.normalizeAddress(token0Address);
      const normalizedToken1 = this.normalizeAddress(token1Address);
      
      if (!normalizedToken0 || !normalizedToken1) {
        throw new Error(`Invalid token address: ${token0Address} or ${token1Address}`);
      }
      
      // Custom query to find pools containing both tokens
      const customQuery = `
        query GetPoolsByTokenPair($token0: String, $token1: String) {
          pools0: pools(
            where: { 
              currency0: $token0,
              currency1: $token1
            }
          ) {
            id
            poolId
            currency0 {
              id
              name
              symbol
              decimals
            }
            currency1 {
              id
              name
              symbol
              decimals
            }
            liquidity
            sqrtPrice
            tick
            feeTier
            totalValueLockedUSD
            volumeUSD
            feesUSD
          }
          pools1: pools(
            where: { 
              currency0: $token1,
              currency1: $token0
            }
          ) {
            id
            poolId
            currency0 {
              id
              name
              symbol
              decimals
            }
            currency1 {
              id
              name
              symbol
              decimals
            }
            liquidity
            sqrtPrice
            tick
            feeTier
            totalValueLockedUSD
            volumeUSD
            feesUSD
          }
        }
      `;
      
      const token0Lower = normalizedToken0.toLowerCase();
      const token1Lower = normalizedToken1.toLowerCase();
      
      const data = await this.graphQLService.executeQuery(
        customQuery,
        UNISWAP_V4_SUBGRAPH_ID,
        this.apiKey,
        {
          token0: token0Lower,
          token1: token1Lower
        }
      );
      
      // Combine both result sets
      const pools = [
        ...(data.pools0 || []).map((pool: any) => this.mapGraphQLPoolToPool(pool)),
        ...(data.pools1 || []).map((pool: any) => this.mapGraphQLPoolToPool(pool))
      ];
      
      return pools;
    } catch (error) {
      console.error(`Error fetching pools for token pair ${token0Address}/${token1Address}:`, error);
      return [];
    }
  }

  // Helper to normalize Ethereum addresses
  private normalizeAddress(address: string): string | null {
    try {
      // First check basic format
      if (!address || typeof address !== 'string' || !address.match(/^0x[0-9a-fA-F]{40}$/)) {
        return null;
      }
      
      // Then normalize through ethers (handles checksums)
      return ethers.utils.getAddress(address);
    } catch (error) {
      console.error(`Invalid address format: ${address}`, error);
      return null;
    }
  }

  // Map GraphQL pool data to our Pool type
  private mapGraphQLPoolToPool(poolData: any): Pool {
    // Calculate APR based on fees relative to TVL
    let apr = 0;
    const tvl = parseFloat(poolData.totalValueLockedUSD) || 0;
    
    if (tvl > 0 && poolData.feesUSD) {
      // Assume fees are for the past week and annualize
      const annualizedFees = parseFloat(poolData.feesUSD) * 365 / 7;
      apr = (annualizedFees / tvl) * 100;
    }
    
    // Convert fee tier from basis points (e.g., 500 = 0.05%)
    const feeTier = parseInt(poolData.feeTier) || 0;
    const fee = feeTier * 100; // Convert to the format expected in our app
    
    return {
      address: poolData.id,
      token0: {
        address: poolData.currency0.id,
        symbol: poolData.currency0.symbol || 'UNK',
        decimals: parseInt(poolData.currency0.decimals) || 18,
        name: poolData.currency0.name || 'Unknown Token'
      },
      token1: {
        address: poolData.currency1.id,
        symbol: poolData.currency1.symbol || 'UNK',
        decimals: parseInt(poolData.currency1.decimals) || 18,
        name: poolData.currency1.name || 'Unknown Token'
      },
      fee,
      tickSpacing: 60, // Default for V4, adjust if this info is available in the subgraph
      liquidity: poolData.liquidity || '0',
      sqrtPrice: poolData.sqrtPrice || '0',
      tick: parseInt(poolData.tick) || 0,
      apr,
      tvl,
      volume24h: parseFloat(poolData.volumeUSD) || 0
    };
  }

  // Mock data for fallback
  public getMockPools(): Pool[] {
    console.log("Generating mock pools data");
    // Generate some realistic looking mock data
    const mockPools: Pool[] = [
      {
        address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        token0: {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'WETH',
          decimals: 18,
          name: 'Wrapped Ether'
        },
        token1: {
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin'
        },
        fee: 500, // 0.05%
        tickSpacing: 10,
        liquidity: '34567891234567890',
        sqrtPrice: '1192536588456435634',
        tick: 200123,
        apr: 12.45,
        tvl: 4500000,
        volume24h: 1200000
      },
      {
        address: '0xc31e54c7a869b9fcbecc14363cf510d1c41fa443',
        token0: {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'WETH',
          decimals: 18,
          name: 'Wrapped Ether'
        },
        token1: {
          address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
          symbol: 'USDbC',
          decimals: 6,
          name: 'USD Base Coin'
        },
        fee: 3000, // 0.3%
        tickSpacing: 60,
        liquidity: '98765432109876543',
        sqrtPrice: '980765432178906543',
        tick: 198765,
        apr: 8.92,
        tvl: 3800000,
        volume24h: 950000
      },
      {
        address: '0x5c128d25a21f681e678cb050e551a895c9309945',
        token0: {
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin'
        },
        token1: {
          address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
          symbol: 'USDbC',
          decimals: 6,
          name: 'USD Base Coin'
        },
        fee: 100, // 0.01%
        tickSpacing: 1,
        liquidity: '567891234098765432',
        sqrtPrice: '1000000000000000000',
        tick: 0,
        apr: 3.54,
        tvl: 12500000,
        volume24h: 3200000
      },
      {
        address: '0x4b5ab61593a2401b1075b90c04cbcdd3f87ce011',
        token0: {
          address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
          symbol: 'DAI',
          decimals: 18,
          name: 'Dai Stablecoin'
        },
        token1: {
          address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          symbol: 'USDC',
          decimals: 6,
          name: 'USD Coin'
        },
        fee: 100, // 0.01%
        tickSpacing: 1,
        liquidity: '876543210987654321',
        sqrtPrice: '1000000000000000000',
        tick: 0,
        apr: 2.87,
        tvl: 9800000,
        volume24h: 1800000
      },
      {
        address: '0x85149247691df622eaf1a8bd0cafd40bc45154a9',
        token0: {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'WETH',
          decimals: 18,
          name: 'Wrapped Ether'
        },
        token1: {
          address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
          symbol: 'cbETH',
          decimals: 18,
          name: 'Coinbase Staked ETH'
        },
        fee: 500, // 0.05%
        tickSpacing: 10,
        liquidity: '43210987654321098',
        sqrtPrice: '1050000000000000000',
        tick: 24680,
        apr: 5.61,
        tvl: 2900000,
        volume24h: 580000
      },
      {
        address: '0x75a5b116d5f94d703e7a054f18f9f0b1176ef11f',
        token0: {
          address: '0xb5DE3f06aF62D8428a8BF7b4400Ea42aD2E0bc53',
          symbol: 'TOSHI',
          decimals: 18,
          name: 'Toshi Token'
        },
        token1: {
          address: '0x4200000000000000000000000000000000000006',
          symbol: 'WETH',
          decimals: 18,
          name: 'Wrapped Ether'
        },
        fee: 3000, // 0.3%
        tickSpacing: 60,
        liquidity: '12345678901234567',
        sqrtPrice: '120000000000000000',
        tick: -45678,
        apr: 18.35,
        tvl: 1200000,
        volume24h: 450000
      }
    ];
    
    return mockPools;
  }
}

export default UniswapV4Service;
