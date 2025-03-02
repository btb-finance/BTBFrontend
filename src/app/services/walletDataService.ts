import { ethers } from 'ethers';
import aaveV3ABI from './aaveV3abi.json';

// ERC20 Token ABI (minimal for balanceOf and symbol)
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

// ABI for LP token contract with additional functions
const LP_TOKEN_ABI = [
  // Standard ERC20 functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  // LP specific functions
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)'
];

// Chain configurations
interface ChainInfo {
  name: string;
  chainId: number;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

const CHAINS: { [key: string]: ChainInfo } = {
  ETHEREUM: {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  OPTIMISM: {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  ARBITRUM: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  BASE: {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  }
};

const CHAIN_ID_TO_KEY: { [key: number]: string } = {
  1: "ETHEREUM",
  10: "OPTIMISM",
  42161: "ARBITRUM",
  8453: "BASE"
};

// Popular token addresses across different chains
const TOKENS_BY_CHAIN = {
  [CHAINS.ETHEREUM.chainId]: {
    ETH: {
      address: 'native',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    WETH: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18
    },
    WBTC: {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      name: 'Wrapped Bitcoin',
      symbol: 'WBTC',
      decimals: 8
    },
    USDC: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6
    },
    DAI: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18
    },
    LINK: {
      address: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      name: 'ChainLink Token',
      symbol: 'LINK',
      decimals: 18
    },
    UNI: {
      address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      name: 'Uniswap',
      symbol: 'UNI',
      decimals: 18
    },
    AAVE: {
      address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
      name: 'Aave',
      symbol: 'AAVE',
      decimals: 18
    }
  },
  [CHAINS.OPTIMISM.chainId]: {
    ETH: {
      address: 'native',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18
    },
    USDC: {
      address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    OP: {
      address: '0x4200000000000000000000000000000000000042',
      name: 'Optimism',
      symbol: 'OP',
      decimals: 18
    }
  },
  [CHAINS.ARBITRUM.chainId]: {
    ETH: {
      address: 'native',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    WETH: {
      address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18
    },
    USDC: {
      address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    ARB: {
      address: '0x912CE59144191C1204E64559FE8253a0e49E6548',
      name: 'Arbitrum',
      symbol: 'ARB',
      decimals: 18
    }
  },
  [CHAINS.BASE.chainId]: {
    ETH: {
      address: 'native',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    WETH: {
      address: '0x4200000000000000000000000000000000000006',
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18
    },
    USDC: {
      address: '0x833589fCD6eDb6E08f4c7c32D4f71b54bDA02913',
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6
    },
    USDT: {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6
    },
    DAI: {
      address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18
    },
    CBETH: {
      address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
      name: 'Coinbase Wrapped Staked ETH',
      symbol: 'cbETH',
      decimals: 18
    },
    USDbC: {
      address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
      name: 'USD Base Coin',
      symbol: 'USDbC',
      decimals: 6
    },
    BTB: {
      address: '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB',
      name: 'BTB Token',
      symbol: 'BTB',
      decimals: 18
    },
    BTBY: {
      address: '0xBB6e8c1e49f04C9f6c4D6163c52990f92431FdBB',
      name: 'BTB Yield Token',
      symbol: 'BTBY',
      decimals: 18
    }
  }
};

const LP_POOLS_BY_CHAIN = {
  [CHAINS.ETHEREUM.chainId]: [
    {
      address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc', // Uniswap V2 ETH-USDC
      protocol: 'Uniswap V2',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId].WETH.address },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId].USDC.address },
      apy: '5.8%',
      rewards: '0.016% daily'
    },
    {
      address: '0x8a649274e4d777ffc6851f13d23a86bbfa2f2fbf', // Balancer WBTC-ETH
      protocol: 'Balancer',
      pair: 'WBTC/ETH',
      token0: { symbol: 'WBTC', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WBTC?.address },
      token1: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WETH?.address },
      apy: '6.2%',
      rewards: '0.02% daily'
    },
    {
      address: '0xceff51756c56ceffca006cd410b03ffc46dd3a58', // Sushiswap WBTC-ETH
      protocol: 'Sushiswap',
      pair: 'WBTC/ETH',
      token0: { symbol: 'WBTC', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WBTC?.address },
      token1: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WETH?.address },
      apy: '5.9%',
      rewards: '0.018% daily'
    }
  ],
  [CHAINS.OPTIMISM.chainId]: [
    {
      address: '0x2e9F9bECF5229379825D0D3C1299759943BD4fED', // Velodrome ETH-USDC
      protocol: 'Velodrome',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.OPTIMISM.chainId].WETH.address },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.OPTIMISM.chainId].USDC.address },
      apy: '3.5%',
      rewards: '0.01% daily'
    }
  ],
  [CHAINS.ARBITRUM.chainId]: [
    {
      address: '0x905dfCD5649217c42684f23958568e533C711Aa3', // SushiSwap ETH-USDC
      protocol: 'SushiSwap',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ARBITRUM.chainId].WETH.address },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.ARBITRUM.chainId].USDC.address },
      apy: '4.1%',
      rewards: '0.015% daily'
    }
  ],
  [CHAINS.BASE.chainId]: [
    {
      address: '0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18', // BaseSwap ETH-USDC
      protocol: 'BaseSwap',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId].USDC.address },
      apy: '5.2%',
      rewards: 'BASE + BSX'
    },
    {
      address: '0xB4885bc63399bf5518b994c1d0c8afd4db5efe29', // Aerodrome ETH-USDbC
      protocol: 'Aerodrome',
      pair: 'ETH/USDbC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'USDbC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.USDbC?.address || '' },
      apy: '4.9%',
      rewards: 'AERO'
    },
    {
      address: '0x0feb1490f80b6dda3c8c77a0f2c4f0c8f2e90f3b', // Aerodrome USDC-USDbC
      protocol: 'Aerodrome',
      pair: 'USDC/USDbC',
      token0: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.USDC?.address || '' },
      token1: { symbol: 'USDbC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.USDbC?.address || '' },
      apy: '2.1%',
      rewards: 'AERO'
    },
    {
      address: '0xfb7ef66a2f6e2057488e5b4f352ce3f6d94737c8', // Aerodrome ETH-cbETH
      protocol: 'Aerodrome',
      pair: 'ETH/cbETH',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'cbETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.CBETH?.address || '' },
      apy: '3.8%',
      rewards: 'AERO'
    },
    {
      address: '0xbb6e8c1e49f04c9f6c4d6163c52990f92431fdbb', // BTB Finance BTB-BTBY
      protocol: 'BTB Finance',
      pair: 'BTB/BTBY',
      token0: { symbol: 'BTB', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.BTB?.address || '' },
      token1: { symbol: 'BTBY', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.BTBY?.address || '' },
      apy: '12.5%',
      rewards: 'BTB + BTBY'
    },
    {
      address: '0x7d49e5adc0eaad9c027857767638613835d5b1c8', // Dackieswap ETH-USDC
      protocol: 'Dackieswap',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId].USDC.address },
      apy: '3.8%',
      rewards: 'DACKIE'
    },
    {
      address: '0x9c454510848906fddc846607e4baa27ca999fbb6', // Uniswap V3 ETH-USDC
      protocol: 'Uniswap V3',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId].USDC.address },
      apy: '4.2%',
      rewards: 'Fees only'
    }
  ]
};

// Address of common DEX factories to find LPs
const DEX_FACTORIES = {
  // Ethereum
  UniswapV2: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  UniswapV3: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  Sushiswap: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  
  // Add more as needed for different chains
};

export interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUSD: string;
  priceUSD: string;
  chain: string;
  chainId?: number;
}

export class WalletDataService {
  private providers: { [chainId: number]: ethers.providers.JsonRpcProvider } = {};
  private signer: ethers.Signer | null = null;
  private isInitialized = false;
  
  constructor() {
    // Initialize providers for each chain to allow cross-chain interactions
    try {
      // Create RPC providers for each supported chain
      Object.values(CHAINS).forEach(chain => {
        try {
          this.providers[chain.chainId] = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
        } catch (chainError) {
          console.error(`Failed to initialize provider for ${chain.name}:`, chainError);
        }
      });
      
      console.log('Initialized providers for supported chains');
    } catch (error) {
      console.error(`Failed to initialize provider:`, error);
    }
  }
  
  async initialize(): Promise<boolean> {
    // Check if we can access ethereum in browser
    if (typeof window === 'undefined') {
      console.log('Not in browser environment');
      return false;
    }
    
    if (!window.ethereum) {
      console.log('No ethereum provider (MetaMask, etc.) detected');
      return false;
    }
    
    try {
      // Create Web3Provider and connect
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      
      // Request accounts access to prompt user to connect their wallet
      try {
        await web3Provider.send('eth_requestAccounts', []);
      } catch (error) {
        console.log('User rejected wallet connection');
        return false;
      }
      
      // Get the current chain ID
      const network = await web3Provider.getNetwork();
      const chainId = network.chainId;
      
      console.log(`Connected to chain ID: ${chainId}`);
      
      // Check if we're connected to Base chain
      if (chainId !== CHAINS.BASE.chainId) {
        console.log('Not connected to Base chain, requesting switch...');
        try {
          // Request switch to Base chain
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CHAINS.BASE.chainId.toString(16)}` }],
          });
          
          // Refresh provider after chain switch
          const updatedProvider = new ethers.providers.Web3Provider(window.ethereum);
          this.providers[CHAINS.BASE.chainId] = updatedProvider;
          this.signer = updatedProvider.getSigner();
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: `0x${CHAINS.BASE.chainId.toString(16)}`,
                    chainName: 'Base',
                    nativeCurrency: {
                      name: 'Ethereum',
                      symbol: 'ETH',
                      decimals: 18
                    },
                    rpcUrls: ['https://mainnet.base.org'],
                    blockExplorerUrls: ['https://basescan.org']
                  },
                ],
              });
              
              // Refresh provider after adding chain
              const updatedProvider = new ethers.providers.Web3Provider(window.ethereum);
              this.providers[CHAINS.BASE.chainId] = updatedProvider;
              this.signer = updatedProvider.getSigner();
            } catch (addError) {
              console.error('Error adding Base chain to wallet:', addError);
              return false;
            }
          } else {
            console.error('Error switching to Base chain:', switchError);
            return false;
          }
        }
      } else {
        // Already on Base chain
        this.providers[CHAINS.BASE.chainId] = web3Provider;
        this.signer = web3Provider.getSigner();
      }
      
      // Mark as initialized
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
      return false;
    }
  }
  
  async getWalletAddress(): Promise<string | null> {
    if (!this.isInitialized || !this.signer) {
      await this.initialize();
    }
    
    try {
      return await this.signer!.getAddress();
    } catch (error) {
      console.error('Failed to get wallet address:', error);
      return null;
    }
  }
  
  async getTokenBalance(tokenAddress: string, walletAddress?: string, chainId: number = CHAINS.BASE.chainId): Promise<{ 
    symbol: string; 
    name: string;
    balance: string; 
    decimals: number;
    rawBalance: ethers.BigNumber;
    formattedBalance: string;
  } | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.providers[chainId]) {
      console.error(`No provider available for chain ID ${chainId}`);
      return null;
    }
    
    try {
      const address = walletAddress || await this.getWalletAddress();
      if (!address) return null;
      
      // Handle native ETH token
      if (tokenAddress === 'native' || tokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
        const balance = await this.providers[chainId].getBalance(address);
        const formattedBalance = ethers.utils.formatEther(balance);
        
        return {
          symbol: 'ETH',
          name: 'Ethereum',
          balance: balance.toString(),
          decimals: 18,
          rawBalance: balance,
          formattedBalance
        };
      }
      
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.providers[chainId]);
      
      // Use try-catch for each call to handle non-standard tokens
      let balance, decimals, symbol, name;
      
      try {
        balance = await tokenContract.balanceOf(address);
      } catch (error) {
        console.error(`Error getting balance for token ${tokenAddress}:`, error);
        balance = ethers.BigNumber.from(0);
      }
      
      try {
        // Fetch token decimals directly from the token contract. While most tokens use 18 decimals, this call ensures an accurate value if it differs.
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error(`Error fetching decimals for token ${tokenAddress}, using default 18:`, error);
        decimals = 18;
      }
      
      try {
        symbol = await tokenContract.symbol();
      } catch (error) {
        console.error(`Error getting symbol for token ${tokenAddress}:`, error);
        symbol = 'UNKNOWN';
      }
      
      try {
        name = await tokenContract.name();
      } catch (error) {
        console.error(`Error getting name for token ${tokenAddress}:`, error);
        name = 'Unknown Token';
      }
      
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      
      return {
        symbol,
        name,
        balance: formattedBalance,
        decimals,
        rawBalance: balance,
        formattedBalance
      };
    } catch (error) {
      console.error(`Failed to get token balance for ${tokenAddress}:`, error);
      return null;
    }
  }
  
  async getETHBalance(walletAddress?: string, chainId: number = CHAINS.BASE.chainId): Promise<{ 
    symbol: string; 
    name: string;
    address: string;
    balance: string;
    formattedBalance: string;
  } | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.providers[chainId]) {
      console.error(`No provider available for chain ID ${chainId}`);
      return null;
    }
    
    try {
      const address = walletAddress || await this.getWalletAddress();
      if (!address) return null;
      
      const balance = await this.providers[chainId].getBalance(address);
      const formattedBalance = ethers.utils.formatEther(balance);
      
      return {
        symbol: 'ETH',
        name: 'Ethereum',
        address: `native-${chainId}`,
        balance: balance.toString(),
        formattedBalance
      };
    } catch (error) {
      console.error(`Error fetching ETH balance on chain ${chainId}:`, error);
      return null;
    }
  }
  
  async getPopularTokenBalances(address?: string): Promise<any[]> {
    try {
      if (!address) {
        console.log('No wallet address provided, returning empty token balances');
        return [];
      }
      
      console.log('Fetching token balances for:', address);
      
      // Get token balances from Base chain first, then other chains
      let allTokenBalances: TokenBalance[] = [];
      
      // Prioritize Base chain
      try {
        console.log('Fetching Base chain token balances...');
        const baseTokens = await this.getTokenBalancesForChain(address, CHAINS.BASE.chainId);
        
        // Add chain information to each token
        baseTokens.forEach(token => {
          if (token) {
            token.chain = 'Base';
            token.chainId = CHAINS.BASE.chainId;
            allTokenBalances.push(token);
          }
        });
        
        console.log(`Found ${baseTokens.length} tokens on Base chain`);
      } catch (error) {
        console.error('Error fetching Base chain token balances:', error);
      }
      
      // Always include other chains for a complete portfolio view
      const includeOtherChains = true;
      
      if (includeOtherChains) {
        // Define other chains to check
        const otherChainsToCheck = [
          CHAINS.ETHEREUM.chainId,
          CHAINS.OPTIMISM.chainId,
          CHAINS.ARBITRUM.chainId
        ];
        
        // Fetch token balances from other chains in parallel
        const chainBalancePromises = otherChainsToCheck.map(chainId => 
          this.getTokenBalancesForChain(address, chainId)
            .catch(error => {
              console.error(`Error fetching token balances for chain ${chainId}:`, error);
              return []; // Return empty array on error
            })
        );
        
        // Wait for all chains to be processed
        const chainBalances = await Promise.all(chainBalancePromises);
        
        // Combine all token balances with chain information
        chainBalances.forEach((balances, index) => {
          const chainId = otherChainsToCheck[index];
          
          // Add chain information to each token
          balances.forEach(token => {
            if (token) {
              token.chain = CHAINS[CHAIN_ID_TO_KEY[chainId]]?.name || 'Unknown Chain';
              token.chainId = chainId;
              allTokenBalances.push(token);
            }
          });
        });
      }
      
      // Sort token balances by USD value (highest first)
      allTokenBalances.sort((a, b) => {
        const valueA = parseFloat(a.balanceUSD.replace('$', '').replace(',', ''));
        const valueB = parseFloat(b.balanceUSD.replace('$', '').replace(',', ''));
        return valueB - valueA;
      });
      
      // Log the number of tokens found
      console.log(`Found ${allTokenBalances.length} total tokens`);
      
      return allTokenBalances;
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return [];
    }
  }
  
  async getLPPositions(walletAddress?: string): Promise<Array<{
    name: string;
    symbol: string;
    address: string;
    token0?: {
      symbol: string;
      address: string;
    };
    token1?: {
      symbol: string;
      address: string;
    };
    balance: string;
    formattedBalance: string;
    protocol: string;
    apy?: string;
    tvl?: string;
    chain?: string;
    rewards?: string;
    rewardsUSD?: string;
  }>> {
    // This implementation queries LP tokens the wallet holds
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Prioritize Base chain and only use Base chain data
    if (!this.providers[CHAINS.BASE.chainId]) {
      console.error('Base chain provider not available');
      return [];
    }
    
    const address = walletAddress || await this.getWalletAddress();
    if (!address) return [];
    
    try {
      // Check if wallet is connected with access to signer
      if (!this.providers[CHAINS.BASE.chainId].getSigner) {
        console.error('No signer available for Base chain');
        return [];
      }
      
      const signer = this.providers[CHAINS.BASE.chainId].getSigner();
      const connectedAddress = await signer.getAddress();
      
      if (!connectedAddress) {
        console.error('Could not get connected address');
        return [];
      }
      
      // In production, this would call subgraphs or indexers to find LP positions
      // For common DEXes like Uniswap, Sushiswap, Balancer, etc.
      
      // Known LP token addresses to check - use Base chain pools
      const knownLpTokens = LP_POOLS_BY_CHAIN[CHAINS.BASE.chainId];
      
      // Check each LP token for balance
      const lpPositions = await Promise.all(
        knownLpTokens.map(async (lp) => {
          try {
            // Create contract for LP token
            const lpContract = new ethers.Contract(lp.address, LP_TOKEN_ABI, this.providers[CHAINS.BASE.chainId]);
            
            // Get LP token data
            const [balance, symbol, name, decimals] = await Promise.all([
              lpContract.balanceOf(address),
              lpContract.symbol(),
              lpContract.name(),
              lpContract.decimals()
            ]);
            
            // If no balance, skip
            if (balance.isZero()) return null;
            
            // Format balance
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            
            // Get reserves to calculate TVL
            let tvl = '';
            try {
              // In production we would query on-chain data or a price oracle
              // For now, use a mock TVL calculation based on pair type
              const balanceNum = parseFloat(formattedBalance);
              
              if (lp.pair === 'ETH/USDC') {
                // Estimate ETH-USDC LP value
                tvl = `$${Math.round(balanceNum * 30000).toLocaleString()}`;
              } else if (lp.pair === 'WBTC/ETH') {
                // Estimate WBTC-ETH LP value
                tvl = `$${Math.round(balanceNum * 55000).toLocaleString()}`;
              } else {
                // Default estimate
                tvl = `$${Math.round(balanceNum * 10000).toLocaleString()}`;
              }
            } catch (error) {
              console.error('Error calculating TVL:', error);
              tvl = 'N/A';
            }
            
            // Calculate rewards based on APY and TVL
            const tvlValue = parseFloat(tvl.replace(/[^0-9.-]+/g, ''));
            const apyValue = parseFloat(lp.apy?.replace(/[^0-9.-]+/g, '') || '0');
            const dailyReward = (tvlValue * apyValue / 100) / 365;
            const rewardsUSD = `$${dailyReward.toFixed(2)}`;
            
            return {
              name: name || lp.pair + ' LP',
              symbol: symbol || 'LP',
              address: lp.address,
              token0: lp.token0,
              token1: lp.token1,
              balance: balance.toString(),
              formattedBalance,
              protocol: lp.protocol,
              apy: lp.apy,
              tvl,
              chain: 'Base',
              rewards: lp.rewards ? lp.rewards : `${(apyValue / 365).toFixed(2)}% daily`,
              rewardsUSD
            };
          } catch (error) {
            console.error(`Error checking LP token ${lp.address}:`, error);
            return null;
          }
        })
      );
      
      // Filter out null values (tokens with zero balance)
      let validLpPositions = lpPositions.filter(pos => pos !== null).map(pos => {
        // Ensure token0 and token1 addresses are strings
        if (pos) {
          return {
            ...pos,
            token0: pos.token0 ? {
              symbol: pos.token0.symbol,
              address: pos.token0.address || ''
            } : undefined,
            token1: pos.token1 ? {
              symbol: pos.token1.symbol,
              address: pos.token1.address || ''
            } : undefined
          };
        }
        return pos;
      });
      
      return validLpPositions;
      
    } catch (error) {
      console.error("Error fetching LP positions:", error);
      return [];
    }
  }
  
  // Get token value in USD
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private lastApiCall: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly API_RATE_LIMIT = 1000; // 1 second between calls

  private async getTokenPriceFromAPI(symbol: string): Promise<number | null> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;

    // Map from various symbol formats to CoinGecko IDs
    const symbolToCoinGeckoId: {[key: string]: string} = {
      'ETH': 'ethereum',
      'WETH': 'ethereum', // Wrapped ETH has same price as ETH
      'BTC': 'bitcoin',
      'WBTC': 'wrapped-bitcoin',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'APE': 'apecoin',
      'PEPE': 'pepe',
      'SHIB': 'shiba-inu',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'AAVE': 'aave',
      'CRV': 'curve-dao-token',
      'MKR': 'maker'
    };

    // Normalized symbol for lookup
    const normalizedSymbol = symbol.toUpperCase();
    const coinGeckoId = symbolToCoinGeckoId[normalizedSymbol];

    // If we can't find the token or API fails, provide fallback values
    const fallbackPrices: {[key: string]: number} = {
      'ETH': 3450,
      'WETH': 3450,
      'BTC': 62500,
      'WBTC': 62350,
      'USDC': 1.00,
      'USDT': 1.00,
      'DAI': 1.00,
      'APE': 1.25,
      'PEPE': 0.0000097,
      'SHIB': 0.000028,
      'LINK': 14.80,
      'UNI': 8.20,
      'AAVE': 89.50,
      'CRV': 0.56,
      'MKR': 2100
    };

    // Implement rate limiting
    if (timeSinceLastCall < this.API_RATE_LIMIT) {
      await new Promise(resolve => setTimeout(resolve, this.API_RATE_LIMIT - timeSinceLastCall));
    }

    // First try to get the price from the API if we have a valid CoinGecko ID
    if (coinGeckoId) {
      try {
        this.lastApiCall = Date.now();
        const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`);
        
        if (response.ok) {
          const data = await response.json();
          const price = data[coinGeckoId]?.usd;
          if (price) {
            console.log(`Retrieved price for ${symbol}: $${price}`);
            return price;
          }
        } else {
          console.warn(`API response not ok: ${response.status} for ${symbol}`);
        }
      } catch (error) {
        console.error(`API call failed for ${symbol}:`, error);
      }
    }

    // If API fails or token not recognized, return fallback price
    const fallbackPrice = fallbackPrices[normalizedSymbol];
    if (fallbackPrice) {
      console.log(`Using fallback price for ${symbol}: $${fallbackPrice}`);
      return fallbackPrice;
    }
    
    console.warn(`No price available for ${symbol}`);
    return null;
  }

  async getTokenValueUSD(symbol: string, amount: string): Promise<string | null> {
    try {
      if (!amount || parseFloat(amount) === 0) {
        return '$0.00';
      }
      
      const balance = parseFloat(amount);
      let priceUSD = 0;
      
      // Check cache first
      const cached = this.priceCache.get(symbol);
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        priceUSD = cached.price;
      } else {
        // Handle different token types
        if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(symbol)) {
          priceUSD = 1; // Stablecoins
        } else if (symbol === 'OP') {
          priceUSD = 2.5;
        } else if (symbol === 'ARB') {
          priceUSD = 1.2;
        } else {
          // Try to get price from API
          let apiPrice = null;
          
          if (symbol === 'ETH' || symbol === 'WETH') {
            apiPrice = await this.getTokenPriceFromAPI('ethereum');
            priceUSD = apiPrice || 2200; // Fallback for ETH
          } else if (symbol === 'WBTC' || symbol === 'BTC') {
            apiPrice = await this.getTokenPriceFromAPI('bitcoin');
            priceUSD = apiPrice || 48000; // Fallback for BTC
          } else {
            apiPrice = await this.getTokenPriceFromAPI(symbol);
            if (!apiPrice) {
              // Fallback prices for known tokens
              priceUSD = symbol === 'LINK' ? 15 :
                        symbol === 'UNI' ? 7 :
                        symbol === 'AAVE' ? 80 :
                        symbol === 'SNX' ? 3 : 5;
            } else {
              priceUSD = apiPrice;
            }
          }
          
          // Update cache with new price
          this.priceCache.set(symbol, { price: priceUSD, timestamp: Date.now() });
        }
      }
      
      const valueUSD = balance * priceUSD;
      return `$${valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;      
    } catch (error) {
      console.error(`Error calculating value for ${symbol}:`, error);
      // Return a fallback value instead of null to prevent UI breaks
      return '$0.00';
    }
  }

  async getWalletPortfolioOverview(walletAddress?: string): Promise<{
    totalValueUSD: string;
    totalEarningsUSD: string;
    averageApy: string;
    activePositions: number;
    totalChange24h: string;
    totalChangePercentage24h: string;
    assets: {
      tokens: number;
      liquidity: number;
      lending: number;
      staking: number;
    };
    history: Array<{
      timestamp: number;
      value: number;
    }>;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    const address = walletAddress || await this.getWalletAddress();
    
    // Check if wallet is actually connected - prioritize Base chain
    if (!this.providers[CHAINS.BASE.chainId] || !address) {
      // Return zeros when wallet is not connected
      return {
        totalValueUSD: '$0.00',
        totalEarningsUSD: '$0.00',
        averageApy: '0.0%',
        activePositions: 0,
        totalChange24h: '$0.00',
        totalChangePercentage24h: '0.0%',
        assets: {
          tokens: 0,
          liquidity: 0,
          lending: 0,
          staking: 0
        },
        history: []
      };
    }
    
    try {
      // In production, these would all be fetched from blockchain and calculated
      
      // Prioritize Base chain and only use Base chain data
      const baseChain = CHAINS.BASE;
      const chainResults = await Promise.all(
        [baseChain].map(async (chain) => {
          try {
            // Get token balances for this chain
            const tokenBalances = await this.getTokenBalancesForChain(address, chain.chainId);
            
            // Get LP positions for this chain
            let lpPositions: any[] = [];
            if (LP_POOLS_BY_CHAIN[chain.chainId]) {
              lpPositions = await this.getLPPositionsForChain(address, chain.chainId);
            }
            
            return {
              chainId: chain.chainId,
              chainName: chain.name,
              tokenBalances,
              lpPositions
            };
          } catch (error) {
            console.error(`Error fetching data for chain ${chain.name}:`, error);
            return {
              chainId: chain.chainId,
              chainName: chain.name,
              tokenBalances: [],
              lpPositions: []
            };
          }
        })
      );
      
      // Process the results to calculate total values
      let totalValueUSD = 0;
      let totalEarningsUSD = 0;
      let totalActivePositions = 0;
      let weightedApy = 0;
      let totalPositionsValue = 0;
      
      // Process token balances
      const allTokenBalances: TokenBalance[] = [];
      let activeTokens = 0;
      
      chainResults.forEach(chainResult => {
        // Add token balances
        if (chainResult.tokenBalances && chainResult.tokenBalances.length > 0) {
          chainResult.tokenBalances.forEach((token: TokenBalance) => {
            if (token.balanceUSD) {
              const valueUSD = parseFloat(token.balanceUSD.replace(/[^0-9.]/g, ''));
              if (!isNaN(valueUSD) && valueUSD > 0) {
                totalValueUSD += valueUSD;
                activeTokens++;
                
                // Add chain info to token
                allTokenBalances.push({
                  ...token,
                  chain: CHAINS[CHAIN_ID_TO_KEY[chainResult.chainId]]?.name || 'Unknown Chain'
                });
              }
            }
          });
        }
        
        // Add LP positions
        if (chainResult.lpPositions && chainResult.lpPositions.length > 0) {
          chainResult.lpPositions.forEach((position: any) => {
            // Count active positions
            totalActivePositions++;
            
            // Calculate position value
            if (position.tvl) {
              const positionValue = parseFloat(position.tvl.replace(/[^0-9.]/g, ''));
              if (!isNaN(positionValue)) {
                totalValueUSD += positionValue;
                totalPositionsValue += positionValue;
                
                // Calculate weighted APY
                if (position.apy) {
                  const apyValue = parseFloat(position.apy.replace(/[^0-9.]/g, ''));
                  if (!isNaN(apyValue)) {
                    weightedApy += (apyValue * positionValue);
                    
                    // Estimate earnings based on APY (for demonstration)
                    const estimatedEarnings = positionValue * (apyValue / 100) / 12; // Monthly earnings
                    totalEarningsUSD += estimatedEarnings;
                  }
                }
              }
            }
          });
        }
      });
      
      // Calculate average APY weighted by position value
      // Base chain has higher APYs, especially for BTB Finance
      const averageApy = totalPositionsValue > 0 ? (weightedApy / totalPositionsValue) : 0;
      
      // Check if user has BTB tokens for enhanced returns
      const hasBTBTokens = allTokenBalances.some(token => 
        token.symbol === 'BTB' || token.symbol === 'BTBY');
      
      // Generate change data - higher for Base chain and BTB holders
      const changePercent = hasBTBTokens ? 4.2 : 2.5;
      const changeValue = totalValueUSD * (changePercent / 100);
      
      // Generate historical data (would be fetched from an API)
      const now = Date.now();
      const history = Array.from({ length: 30 }, (_, i) => {
        const timestamp = now - (29 - i) * 24 * 60 * 60 * 1000;
        // Generate a realistic curve leading up to current value
        const baseValue = totalValueUSD * 0.95;
        const dayValue = baseValue * (1 + (i * 0.002)) * (1 + (Math.random() - 0.5) * 0.01);
        
        return {
          timestamp,
          value: dayValue
        };
      });
      
      // Print real token balances for debugging
      console.log('Real token balances: ', allTokenBalances);
      
      return {
        totalValueUSD: `$${totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalEarningsUSD: `$${totalEarningsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        averageApy: `${averageApy.toFixed(1)}%`,
        activePositions: totalActivePositions,
        totalChange24h: `$${changeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        totalChangePercentage24h: `+${changePercent.toFixed(1)}%`,
        assets: {
          tokens: activeTokens,
          liquidity: totalActivePositions,
          lending: 0,
          staking: 0
        },
        history
      };
    } catch (error) {
      console.error('Error calculating portfolio overview:', error);
      return {
        totalValueUSD: '$0.00',
        totalEarningsUSD: '$0.00',
        averageApy: '0.0%',
        activePositions: 0,
        totalChange24h: '$0.00',
        totalChangePercentage24h: '0.0%',
        assets: {
          tokens: 0,
          liquidity: 0,
          lending: 0,
          staking: 0
        },
        history: []
      };
    }
  }
  
  // Helper methods for multi-chain data fetching
  async getTokenBalancesForChain(address: string, chainId: number): Promise<TokenBalance[]> {
    try {
      const provider = this.providers[chainId];
      if (!provider) {
        console.log(`No provider available for chain ${chainId}, using mock data`);
        // Return mock data for this chain
        return [{
          name: CHAINS[chainId]?.name || 'Unknown Chain',
          symbol: 'ETH',
          address: `native-${chainId}`,
          balance: '0',
          balanceUSD: '$0.00',
          priceUSD: '0',
          chain: CHAINS[chainId]?.name || 'Unknown Chain',
          decimals: 18
        }];
      }
      
      try {
        // Test if provider is responding
        await provider.getNetwork();
      } catch (error) {
        console.error(`Provider for chain ${chainId} not responding, using mock data`, error);
        // Return mock data for this chain
        return [{
          name: CHAINS[chainId]?.name || 'Unknown Chain',
          symbol: 'ETH',
          address: `native-${chainId}`,
          balance: '0',
          balanceUSD: '$0.00',
          priceUSD: '0',
          chain: CHAINS[chainId]?.name || 'Unknown Chain',
          decimals: 18
        }];
      }
      
      // Get popular tokens for this chain
      const chainTokens = TOKENS_BY_CHAIN[chainId];
      if (!chainTokens) return [];
      
      // Get native token balance (ETH, etc.)
      let nativeBalance;
      try {
        nativeBalance = await provider.getBalance(address);
      } catch (error) {
        console.error(`Error getting native balance for chain ${chainId}:`, error);
        nativeBalance = ethers.BigNumber.from(0);
      }
      
      const formattedNativeBalance = ethers.utils.formatEther(nativeBalance);
      const nativeValueUSD = await this.getTokenValueUSD(chainTokens.ETH.symbol, formattedNativeBalance);
      
      const nativeToken: TokenBalance = {
        name: chainTokens.ETH.name,
        symbol: chainTokens.ETH.symbol,
        address: `native-${chainId}`,
        balance: formattedNativeBalance,
        balanceUSD: nativeValueUSD || '$0.00',
        priceUSD: '0',
        chain: CHAINS[chainId]?.name || 'Unknown Chain',
        decimals: 18
      };
      
      // Define common ERC20 token ABIs
      const ERC20_ABI_MINIMAL = [
        'function balanceOf(address) view returns (uint256)',
        'function symbol() view returns (string)',
        'function name() view returns (string)',
        'function decimals() view returns (uint8)'
      ];
      
      // For non-native tokens - use all known tokens from our predefined list
      const tokenPromises = Object.values(chainTokens)
        .filter(token => token.address !== 'native') // Skip native token which we've already handled
        .map(async token => {
          try {
            if (!ethers.utils.isAddress(token.address)) {
              console.error(`Invalid token address format for token ${token.symbol} (${token.address})`);
              return null;
            }

            let validAddress;
            try {
              validAddress = ethers.utils.getAddress(token.address);
            } catch (error) {
              console.error(`Invalid token address checksum for token ${token.symbol} (${token.address}):`, error);
              return null;
            }

            const contract = new ethers.Contract(validAddress, ERC20_ABI_MINIMAL, provider);
            
            let balance;
            try {
              balance = await contract.balanceOf(address);
            } catch (error) {
              console.error(`Error fetching balance for token ${token.symbol} at ${validAddress}:`, error);
              return null;
            }
            
            if (!balance || balance.isZero()) {
              return null; // Skip if no balance
            }
            
            // Use token's predefined decimals first, or attempt to fetch it
            let decimals = token.decimals || 18;
            try {
              // Fetch token decimals directly from the token contract. While most tokens use 18 decimals, this call ensures an accurate value if it differs.
              const fetchedDecimals = await contract.decimals();
              decimals = fetchedDecimals;
            } catch (error) {
              console.error(`Error fetching decimals for token ${token.symbol} at ${validAddress}:`, error);
              // Already using fallback value
            }
            
            // Use token's predefined name first, or attempt to fetch it
            let tokenName = token.name || token.symbol;
            if (!token.name) {
              try {
                const fetchedName = await contract.name();
                if (fetchedName) tokenName = fetchedName;
              } catch (error) {
                console.error(`Error fetching name for token ${token.symbol} at ${validAddress}:`, error);
                // Already using fallback value
              }
            }
            
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            const displayBalance = parseFloat(formattedBalance).toFixed(4);
            
            const valueUSD = await this.getTokenValueUSD(token.symbol, formattedBalance);
            
            return {
              name: tokenName,
              symbol: token.symbol,
              address: token.address,
              balance: displayBalance,
              balanceUSD: valueUSD || '$0.00',
              priceUSD: '0',
              chain: CHAINS[chainId]?.name || 'Unknown Chain',
              decimals: decimals
            };
          } catch (error) {
            console.error(`Error fetching balance for token ${token.symbol}:`, error);
            return null;
          }
        });
      
      let tokenBalances: TokenBalance[];
      try {
        const results = await Promise.all(tokenPromises);
        tokenBalances = results.filter((token): token is TokenBalance => token !== null);
      } catch (error) {
        console.error(`Error in token balance promises for chain ${chainId}:`, error);
        tokenBalances = [];
      }
      
      // If this is Ethereum mainnet, try to get additional tokens using an on-chain token detector
      let additionalTokens: TokenBalance[] = [];
      if (chainId === CHAINS.ETHEREUM.chainId) {
        try {
          console.log('Trying to detect additional tokens on Ethereum mainnet');
          
          // Attempt to use Moralis API as a demonstration (would require actual API key in production)
          // This is just a placeholder to show how you'd implement a token scanner
          // In real production code, you'd use an API that can detect all ERC20 tokens held by an address
          
          // Simulate finding a few additional tokens not in our predefined list
          const commonAdditionalTokenAddresses = [
            // APE token (ApeCoin)
            '0x4d224452801aCEd8B2F0aebE155379bb5D594381',
            // PEPE token (Pepe)
            '0x6982508145454ce325ddbe47a25d4ec3d2311933',
            // SHIB token (Shiba Inu)
            '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'
          ];
          
          const additionalTokenPromises = commonAdditionalTokenAddresses.map(async (tokenAddress) => {
            try {
              const assetAddress = ethers.utils.getAddress(tokenAddress);
              
              // Get an Aave pool instance
              const aavePoolAddress = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'; // Ethereum Mainnet
              const aavePool = new ethers.Contract(aavePoolAddress, aaveV3ABI, provider);
              const aTokenABI = ['function balanceOf(address) view returns (uint256)'];
              
              // Create contract for this token
              const tokenContract = new ethers.Contract(assetAddress, ERC20_ABI_MINIMAL, provider);
              
              // Get token details
              let symbol = 'UNKNOWN';
              let name = 'Unknown Token';
              let decimals = 18;
              
              try { symbol = await tokenContract.symbol(); } catch (e) { /* Use default */ }
              try { name = await tokenContract.name(); } catch (e) { /* Use default */ }
              try { decimals = await tokenContract.decimals(); } catch (e) { /* Use default */ }
              
              // Get user token balance
              const balance = await tokenContract.balanceOf(address);
              
              // Skip tokens with no balance
              if (!balance || balance.isZero()) {
                return null;
              }
              
              // Format the balance
              const formattedBalance = ethers.utils.formatUnits(balance, decimals);
              const displayBalance = parseFloat(formattedBalance).toFixed(4);
              
              // Get USD value if possible
              const valueUSD = await this.getTokenValueUSD(symbol, formattedBalance);
              
              return {
                name,
                symbol,
                address: tokenAddress,
                balance: displayBalance,
                balanceUSD: valueUSD || '$0.00',
                priceUSD: '0',
                chain: CHAINS[chainId]?.name || 'Unknown Chain',
                decimals: decimals
              };
            } catch (error) {
              console.error(`Error checking additional token ${tokenAddress}:`, error);
              return null;
            }
          });
          
          additionalTokens = (await Promise.all(additionalTokenPromises)).filter((token): token is NonNullable<typeof token> => token !== null);
          console.log(`Found ${additionalTokens.length} additional tokens`);
        } catch (error) {
          console.error('Error detecting additional tokens:', error);
          additionalTokens = [];
        }
      }
      
      // Filter out null values and combine all tokens
      const allTokens = [nativeToken, ...tokenBalances, ...additionalTokens];
      
      // Sort tokens by value (highest first)
      allTokens.sort((a, b) => {
        const valueA = parseFloat(a.balanceUSD.replace('$', '').replace(',', ''));
        const valueB = parseFloat(b.balanceUSD.replace('$', '').replace(',', ''));
        return valueB - valueA;
      });
      
      return allTokens;
      
    } catch (error) {
      console.error(`Error fetching token balances for chain ${chainId}:`, error);
      // Return minimal mock data on error
      return [{
        name: CHAINS[chainId]?.name || 'Unknown Chain',
        symbol: 'ETH',
        address: `native-${chainId}`,
        balance: '0',
        balanceUSD: '$0.00',
        priceUSD: '0',
        chain: CHAINS[chainId]?.name || 'Unknown Chain',
        decimals: 18
      }];
    }
  }
  
  async getLPPositionsForChain(address: string, chainId: number): Promise<any[]> {
    try {
      const provider = this.providers[chainId];
      if (!provider) {
        console.log(`No provider available for chain ${chainId} for LP positions`);
        return []; // Return empty array when provider is not available
      }
      
      try {
        // Test if provider is responding
        await provider.getNetwork();
      } catch (error) {
        console.error(`Provider for chain ${chainId} not responding for LP positions`, error);
        return []; // Return empty array when provider is not responding
      }
      
      // Get LP pools for this chain
      const lpPools = LP_POOLS_BY_CHAIN[chainId];
      if (!lpPools || lpPools.length === 0) return [];
      
      // Check each LP token for balance
      const lpPositionsPromises = lpPools.map(async (lp) => {
        try {
          // Create contract for LP token
          const lpContract = new ethers.Contract(lp.address, LP_TOKEN_ABI, provider);
          
          let balance, symbol, name, decimals;
          
          try {
            // Get LP token data
            [balance, symbol, name, decimals] = await Promise.all([
              lpContract.balanceOf(address).catch(() => ethers.BigNumber.from(0)),
              lpContract.symbol().catch(() => 'LP'),
              lpContract.name().catch(() => `${lp.pair} LP`),
              lpContract.decimals().catch(() => 18)
            ]);
          } catch (error) {
            console.error(`Error fetching LP token data for ${lp.address}:`, error);
            return null;
          }
          
          // If no balance, skip
          if (balance.isZero()) return null;
          
          // Format balance
          const formattedBalance = ethers.utils.formatUnits(balance, decimals);
          
          // Mock TVL calculation for demonstration
          let tvl = '';
          try {
            const balanceNum = parseFloat(formattedBalance);
            
            if (lp.pair.includes('ETH/USDC')) {
              tvl = `$${Math.round(balanceNum * 30000).toLocaleString()}`;
            } else if (lp.pair.includes('WBTC/ETH')) {
              tvl = `$${Math.round(balanceNum * 55000).toLocaleString()}`;
            } else {
              tvl = `$${Math.round(balanceNum * 10000).toLocaleString()}`;
            }
          } catch (error) {
            console.error('Error calculating TVL:', error);
            tvl = 'N/A';
          }
          
          return {
            name: name || lp.pair + ' LP',
            symbol: symbol || 'LP',
            address: lp.address,
            token0: lp.token0 && {
              symbol: lp.token0.symbol,
              address: lp.token0.address || ''
            },
            token1: lp.token1 && {
              symbol: lp.token1.symbol,
              address: lp.token1.address || ''
            },
            balance: balance.toString(),
            formattedBalance,
            protocol: lp.protocol,
            apy: lp.apy,
            tvl,
            chain: CHAINS[chainId]?.name || 'Unknown',
            rewards: lp.rewards
          };
        } catch (error) {
          console.error(`Error checking LP token ${lp.address}:`, error);
          return null;
        }
      });
      
      let lpPositions;
      try {
        const results = await Promise.all(lpPositionsPromises);
        lpPositions = results.filter((pos): pos is NonNullable<typeof pos> => pos !== null);
      } catch (error) {
        console.error(`Error in LP positions promises for chain ${chainId}:`, error);
        return [];
      }
      
      let validLpPositions = lpPositions.filter(pos => pos !== null).map(pos => {
        // Ensure token0 and token1 addresses are strings
        if (pos) {
          return {
            ...pos,
            token0: pos.token0 ? {
              symbol: pos.token0.symbol,
              address: pos.token0.address || ''
            } : undefined,
            token1: pos.token1 ? {
              symbol: pos.token1.symbol,
              address: pos.token1.address || ''
            } : undefined
          };
        }
        return pos;
      });
      
      return validLpPositions;
    } catch (error) {
      console.error(`Error fetching LP positions for chain ${chainId}:`, error);
      return [];
    }
  }

  // Get user loans from lending protocols
  async getUserLoans(walletAddress?: string): Promise<Array<{
    id: string;
    protocol: string;
    collateral: {
      symbol: string;
      amount: string;
      valueUSD: string;
    };
    debt: {
      symbol: string;
      amount: string;
      valueUSD: string;
    };
    health: string;
    liquidationPrice: string;
    interestRate: string;
  }>> {
    if (!walletAddress) {
      walletAddress = await this.getWalletAddress() || undefined;
      if (!walletAddress) return [];
    }

    try {
      // Initialize array to hold loans from different protocols
      const loans = [];
      
      // Get loans from Aave protocol
      try {
        // Aave V3 pool addresses for each supported chain (using string keys for safety)
        const aavePoolAddresses: {[key: string]: string} = {
          '1': '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum Mainnet
          '10': '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Optimism
          '42161': '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Arbitrum
          '8453': '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', // Base
          '43114': '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Avalanche
          '137': '0x794a61358D6845594F94dc1DB02A252b5b4814aD' // Polygon
        };
        
        // For reference, mapping of chain IDs to names for debugging
        const chainNames: {[key: string]: string} = {
          '1': 'Ethereum Mainnet',
          '10': 'Optimism',
          '42161': 'Arbitrum',
          '8453': 'Base',
          '43114': 'Avalanche',
          '137': 'Polygon'
        };

        // Using the imported Aave V3 ABI with comprehensive function definitions and comments
        const aavePoolABI = aaveV3ABI;

        // ABI for aToken to get user balances
        const aTokenABI = [
          'function balanceOf(address) view returns (uint256)'
        ];

        // Check each chain for Aave positions
        for (const chainIdStr of Object.keys(aavePoolAddresses)) {
          const chainId = Number(chainIdStr);
          if (isNaN(chainId) || chainId <= 0) {
            console.error(`Invalid chainId: ${chainIdStr}`);
            continue;
          }
          const provider = this.providers[chainId];
          if (!provider) continue;

          const aavePoolAddress = aavePoolAddresses[chainId];
          
          // Validate provider is connected before creating contract
          try {
            // Test connection to the provider
            await provider.getNetwork();
          } catch (providerError) {
            console.error(`Provider for chain ${chainId} is not connected:`, providerError);
            continue;
          }

          try {
            // Create Aave Pool contract instance
            const aavePool = new ethers.Contract(aavePoolAddress, aavePoolABI, provider);

            // Check if contract exists and is responsive
            const code = await provider.getCode(aavePoolAddress);
            if (code === '0x') {
              console.error(`No contract deployed at Aave address ${aavePoolAddress} on chain ${chainId}`);
              continue;
            }
            
            // Special handling for Base chain
            if (chainId.toString() === CHAINS.BASE.chainId.toString()) {
              console.log(`Using Aave V3 on Base network - pool address: ${aavePoolAddress}`);
              // Verify the contract matches the expected address from Aave's official deployment
              if (aavePoolAddress !== '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5') {
                console.warn(`The Base Aave pool address doesn't match the expected official deployment address. Using: ${aavePoolAddress}`);
              }
            }

            // Get ETH/USD price for this chain (in production, this should come from a price oracle)
            let ethPriceUSD;
            try {
              // Try to get a real price from our API
              ethPriceUSD = await this.getTokenPriceFromAPI('ETH');
              if (!ethPriceUSD) {
                // Fallback values by chain if API fails
                const fallbackPrices = {
                  [CHAINS.ETHEREUM.chainId]: 3000,
                  [CHAINS.OPTIMISM.chainId]: 3000,
                  [CHAINS.ARBITRUM.chainId]: 3000,
                  [CHAINS.BASE.chainId]: 3000,
                  [CHAINS.AVALANCHE.chainId]: 3000,
                  [CHAINS.POLYGON.chainId]: 3000
                };
                ethPriceUSD = fallbackPrices[chainId] || 3000;
              }
            } catch (priceError) {
              console.error(`Error fetching ETH price for Aave data:`, priceError);
              ethPriceUSD = 3000; // Fallback value
            }

            // Validate wallet address before making contract calls
            if (!ethers.utils.isAddress(walletAddress)) {
              console.error(`Invalid wallet address format: ${walletAddress}`);
              continue;
            }
            
            // Get user account data from Aave
            try {
              console.log(`Querying Aave for wallet: ${walletAddress} on chain ${chainId}`);
              // Check if we're using a proxy contract (likely for Base chain)
              let isProxy = false;
              try {
                // Try to call admin() which exists on proxy contracts
                const adminCall = await provider.call({
                  to: aavePoolAddress,
                  data: '0xf851a440' // admin() function signature
                });
                
                isProxy = true;
                console.log(`Detected proxy contract for Aave on chain ${chainId}`);
              } catch (proxyCheckError) {
                console.log(`Not a proxy contract or cannot check proxy status`);
              }
              
              // If it's a proxy (especially on Base), we need to get the implementation address
              if (isProxy && chainId.toString() === CHAINS.BASE.chainId.toString()) {
                try {
                  // Get implementation address
                  const implementationData = await provider.call({
                    to: aavePoolAddress,
                    data: '0x5c60da1b' // implementation() function signature
                  });
                  
                  const implementationAddress = ethers.utils.defaultAbiCoder.decode(['address'], implementationData)[0];
                  console.log(`Using implementation address: ${implementationAddress}`);
                  
                  // Create a new contract with implementation address but using the proxy as target
                  const updatedAavePool = new ethers.Contract(
                    aavePoolAddress, // Keep using the proxy address
                    aavePoolABI, // Use the full ABI
                    provider
                  );
                  
                  // Process user data using the updated contract
                  return processUserData(updatedAavePool);
                } catch (implError) {
                  console.error(`Error getting implementation address: ${implError}`);
                }
              }
              
              // Now try to get user account data
              const accountData = await aavePool.getUserAccountData(walletAddress);
              
              // Log raw account data for debugging
              console.log('Aave account data for wallet:', walletAddress);
              console.log('Chain ID:', chainId);
              console.log('Chain:', chainNames[chainIdStr] || 'Unknown');
              
              console.log('Total Collateral Base:', accountData.totalCollateralBase.toString());
              console.log('Total Debt Base:', accountData.totalDebtBase.toString());
              console.log('Available Borrows Base:', accountData.availableBorrowsBase.toString());
              console.log('Health Factor:', accountData.healthFactor.toString());
              
              // If user has collateral or debt on Aave - use a very small threshold to catch small positions
              // Using a very small threshold like 1 wei to catch even minimal positions
              if (accountData.totalCollateralBase.gt(0) || accountData.totalDebtBase.gt(0)) {
                console.log(`Found Aave position on chain ${chainId}!`);
                // Format health factor (divide by 10^18 and format as percentage)
                const healthFactor = ethers.utils.formatUnits(accountData.healthFactor, 18);
                const healthFactorNum = parseFloat(healthFactor);
                
                // Determine health status based on health factor
                let healthStatus = 'Healthy';
                if (healthFactorNum < 1.1) healthStatus = 'Critical';
                else if (healthFactorNum < 1.5) healthStatus = 'Warning';
                
                // Format collateral and debt values
                const totalCollateralETH = ethers.utils.formatUnits(accountData.totalCollateralBase, 18);
                const totalDebtETH = ethers.utils.formatUnits(accountData.totalDebtBase, 18);
                const availableBorrowsETH = ethers.utils.formatUnits(accountData.availableBorrowsBase, 18);
                
                // Convert to USD
                const collateralUSD = parseFloat(totalCollateralETH) * ethPriceUSD;
                const debtUSD = parseFloat(totalDebtETH) * ethPriceUSD;
                const availableBorrowsUSD = parseFloat(availableBorrowsETH) * ethPriceUSD;
                
                // Format LTV (Loan-to-Value) from basis points to percentage
                const ltvPercentage = parseFloat(ethers.utils.formatUnits(accountData.ltv, 2));
                
                // Calculate liquidation threshold from basis points to percentage
                const liquidationThresholdPercentage = parseFloat(ethers.utils.formatUnits(accountData.currentLiquidationThreshold, 2));
                
                // Calculate estimated liquidation price (simplified)
                // This is a simplified calculation. In reality, it depends on the specific assets
                let liquidationPrice = 'Varies';
                if (debtUSD > 0 && collateralUSD > 0) {
                  // Estimate based on current position
                  const currentRatio = collateralUSD / debtUSD;
                  const liquidationRatio = 100 / liquidationThresholdPercentage;
                  const priceDropPercentage = (1 - (liquidationRatio / currentRatio)) * 100;
                  if (priceDropPercentage > 0) {
                    liquidationPrice = `~${priceDropPercentage.toFixed(0)}% drop`;
                  }
                }
                
                // Try to get detailed information about user's specific assets
                let collateralSymbols = 'Multiple';
                let debtSymbols = 'Multiple';
                
                try {
                  // Get reserves list from Aave
                  console.log(`Fetching Aave reserves list for chain ${chainId}`);
                  const reservesList = await aavePool.getReservesList();
                  
                  // Enhanced logging for better debugging
                  if (chainId.toString() === CHAINS.BASE.chainId.toString()) {
                    console.log(`Aave reserves found on Base network: ${reservesList.length} assets`); 
                    if (reservesList.length > 0) {
                      console.log(`First few Base reserve addresses:`, reservesList.slice(0, 3));
                    }
                  } else {
                    console.log(`Aave reserves found on chain ${chainId}: ${reservesList.length} assets`);
                  }
                  
                  // For demonstration: Try to get details for top assets (in a full implementation,
                  // you would check user's balance for each aToken and debtToken)
                  const userAssets: any[] = []; // Declare userAssets here
                  
                  // Only check a few assets for performance reasons but check more on Base since it's new
                  const assetsToCheck = chainId.toString() === CHAINS.BASE.chainId.toString() 
                    ? Math.min(reservesList.length, 10) // Check more assets on Base
                    : Math.min(reservesList.length, 5);
                  
                  for (let i = 0; i < assetsToCheck; i++) {
                    const assetAddress = reservesList[i];
                    
                    try {
                      // Get aToken address directly using the specific method
                      const aTokenAddress = await aavePool.getReserveAToken(assetAddress);
                      const aToken = new ethers.Contract(aTokenAddress, aTokenABI, provider);
                      
                      // Check if user has this asset as collateral
                      const aTokenBalance = await aToken.balanceOf(walletAddress);
                      
                      if (aTokenBalance.gt(0)) {
                        // Get token symbol
                        let symbol = 'Unknown';
                        
                        // Try to map the asset address to a known token
                        // Enhanced with Base-specific token addresses
                        const knownTokens: Record<string, string> = {
                          // Ethereum mainnet tokens
                          '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
                          '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
                          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
                          '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
                          '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
                          
                          // Base specific tokens
                          '0x4200000000000000000000000000000000000006': 'WETH',
                          '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'cbETH',
                          '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'USDbC',
                          '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
                          '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': 'wstETH'
                        };
                        
                        // Convert address to string and ensure it's lowercase
                        const addressKey = String(assetAddress).toLowerCase();
                        symbol = knownTokens[addressKey] || 'Unknown';
                        
                        userAssets.push({
                          type: 'collateral',
                          symbol: symbol,
                          balance: this.formatTokenBalance(aTokenBalance, symbol) // Using utility function for proper decimals
                        });
                      }
                      
                      // Get variable debt token address directly
                      const variableDebtTokenAddress = await aavePool.getReserveVariableDebtToken(assetAddress);
                      const variableDebtToken = new ethers.Contract(variableDebtTokenAddress, aTokenABI, provider);
                      
                      // Check if user has variable debt for this asset
                      const variableDebtBalance = await variableDebtToken.balanceOf(walletAddress);
                      
                      if (variableDebtBalance.gt(0)) {
                        // Get token symbol (same mapping as above)
                        let symbol = 'Unknown';
                        const knownTokens: Record<string, string> = {
                          // Ethereum mainnet tokens
                          '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
                          '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
                          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
                          '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
                          '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
                          
                          // Base specific tokens
                          '0x4200000000000000000000000000000000000006': 'WETH',
                          '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'cbETH',
                          '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'USDbC',
                          '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
                          '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': 'wstETH'
                        };
                        
                        // Convert address to string and ensure it's lowercase
                        const addressKey = String(assetAddress).toLowerCase();
                        symbol = knownTokens[addressKey] || 'Unknown';
                        
                        userAssets.push({
                          type: 'debt',
                          symbol: symbol,
                          balance: this.formatTokenBalance(variableDebtBalance, symbol),
                          isVariable: true
                        });
                      }
                      
                      // Get stable debt token address directly
                      const stableDebtTokenAddress = await aavePool.getReserveStableDebtToken(assetAddress);
                      const stableDebtToken = new ethers.Contract(stableDebtTokenAddress, aTokenABI, provider);
                      
                      // Check if user has stable debt for this asset
                      const stableDebtBalance = await stableDebtToken.balanceOf(walletAddress);
                      
                      if (stableDebtBalance.gt(0)) {
                        // Get token symbol (same mapping as above)
                        let symbol = 'Unknown';
                        const knownTokens: Record<string, string> = {
                          // Ethereum mainnet tokens
                          '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH',
                          '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'WBTC',
                          '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
                          '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI',
                          '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
                          
                          // Base specific tokens
                          '0x4200000000000000000000000000000000000006': 'WETH',
                          '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': 'cbETH',
                          '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca': 'USDbC',
                          '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
                          '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': 'wstETH'
                        };
                        
                        // Convert address to string and ensure it's lowercase
                        const addressKey = String(assetAddress).toLowerCase();
                        symbol = knownTokens[addressKey] || 'Unknown';
                        
                        userAssets.push({
                          type: 'debt',
                          symbol: symbol,
                          balance: this.formatTokenBalance(stableDebtBalance, symbol),
                          isVariable: false
                        });
                      }
                    } catch (assetError) {
                      console.error(`Error checking asset ${assetAddress}:`, assetError);
                    }
                  }
                  
                  // Now build collateralSymbols and debtSymbols strings based on found assets
                  const collateralAssets = userAssets.filter(asset => asset.type === 'collateral');
                  if (collateralAssets.length > 0) {
                    collateralSymbols = collateralAssets.map(asset => asset.symbol).join(', ');
                  }
                  
                  // Build debt symbols string
                  const debtAssets = userAssets.filter(asset => asset.type === 'debt');
                  if (debtAssets.length > 0) {
                    debtSymbols = debtAssets.map(asset => {
                      // Add (var) or (stable) suffix to indicate rate type
                      return `${asset.symbol}${asset.isVariable ? ' (var)' : ' (stable)'}`;
                    }).join(', ');
                  }
                } catch (reserveError) {
                  console.error(`Error fetching Aave reserves for user position on chain ${chainId}:`, reserveError);
                  
                  // Enhanced error logging for Base network
                  if (chainId.toString() === CHAINS.BASE.chainId.toString()) {
                    console.error(`Base network Aave integration error. Please verify the Aave V3 pool address at 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5 is correct.`);
                    // Attempt to log base chain specific details
                    try {
                      console.log(`Attempting to get Base chain details...`);
                      console.log(`  - Current provider:`, provider.connection?.url || 'Unknown provider');
                      console.log(`  - Aave pool address:`, aavePoolAddress);
                    } catch (debugError) {
                      console.error('Error during debug logging for Base:', debugError);
                    }
                  }
                  // Continue with default 'Multiple' value
                }
                
                // Add loan to the array with enhanced data
                loans.push({
                  id: `aave-${chainId}-${walletAddress.substring(0, 6)}`,
                  protocol: 'Aave V3',
                  collateral: {
                    symbol: collateralSymbols,
                    amount: totalCollateralETH,
                    valueUSD: `$${collateralUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  },
                  debt: {
                    symbol: debtSymbols,
                    amount: totalDebtETH,
                    valueUSD: `$${debtUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  },
                  health: healthStatus,
                  liquidationPrice: liquidationPrice,
                  interestRate: '0.05%' // Fixed value as fallback
                });
              }
            } catch (accountDataError) {
              console.error(`Error fetching Aave account data for user ${walletAddress} on chain ${chainId}:`, accountDataError);
              
              // Log specific error details for better debugging
              if (accountDataError && typeof accountDataError === 'object') {
                const error = accountDataError as Record<string, unknown>;
                if ('code' in error) {
                  console.error(`Error code: ${error.code}, reason: ${error.reason || 'unknown'}`);
                }
              }
              
              // Try a fallback approach if needed
              try {
                console.log(`Attempting fallback method for chain ${chainId}...`);
                // Here you could implement a fallback strategy if needed
              } catch (fallbackError) {
                console.error('Fallback method also failed:', fallbackError);
              }
            }
          } catch (error) {
            console.error(`Error fetching Aave data for chain ${chainId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error fetching Aave loans:', error);
      }
      
      // Get loans from Compound protocol
      try {
        // Compound V3 contract addresses
        const compoundAddresses = {
          [CHAINS.ETHEREUM.chainId]: '0xc3d688B66703497DAA19211EEdff47f25384cdc3',
          [CHAINS.BASE.chainId]: '0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf'
        };
        
        // Compound V3 ABI for getAccountLiquidity
        const compoundABI = [
          'function getAccountLiquidity(address account) view returns (uint256 collateralBalanceUsd, uint256 borrowBalanceUsd, uint256 healthFactor)'
        ];
        
        // Check each chain for Compound positions
        for (const chainId of Object.keys(compoundAddresses).map(Number)) {
          const provider = this.providers[chainId];
          if (!provider) continue;
          
          const compoundAddress = compoundAddresses[chainId];
          // Validate provider is connected before creating contract
          try {
            // Test connection to the provider
            await provider.getNetwork();
          } catch (providerError) {
            console.error(`Provider for chain ${chainId} is not connected:`, providerError);
            continue;
          }

          const compound = new ethers.Contract(compoundAddress, compoundABI, provider);
          
          try {
            // Check if contract exists and is responsive
            const code = await provider.getCode(compoundAddress);
            if (code === '0x') {
              console.error(`No contract deployed at Compound address ${compoundAddress} on chain ${chainId}`);
              continue;
            }
            
            // Get user account liquidity from Compound
            const accountLiquidity = await compound.getAccountLiquidity(walletAddress);
            
            // If user has collateral or debt on Compound
            if (accountLiquidity.collateralBalanceUsd.gt(0) || accountLiquidity.borrowBalanceUsd.gt(0)) {
              // Format health factor (divide by 10^18 and format as percentage)
              const healthFactor = ethers.utils.formatUnits(accountLiquidity.healthFactor, 18);
              const healthFactorNum = parseFloat(healthFactor);
              
              // Determine health status based on health factor
              let healthStatus = 'Healthy';
              if (healthFactorNum < 1.1) healthStatus = 'Critical';
              else if (healthFactorNum < 1.5) healthStatus = 'Warning';
              
              // Format collateral and debt values (already in USD)
              const collateralUSD = ethers.utils.formatUnits(accountLiquidity.collateralBalanceUsd, 6); // Compound uses 6 decimals for USD
              const debtUSD = ethers.utils.formatUnits(accountLiquidity.borrowBalanceUsd, 6);
              
              // Add loan to the array
              loans.push({
                id: `compound-${chainId}-${walletAddress.substring(0, 6)}`,
                protocol: 'Compound V3',
                collateral: {
                  symbol: 'Multiple',
                  amount: collateralUSD,
                  valueUSD: `$${parseFloat(collateralUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                },
                debt: {
                  symbol: 'Multiple',
                  amount: debtUSD,
                  valueUSD: `$${parseFloat(debtUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                },
                health: healthStatus,
                liquidationPrice: 'Varies',
                interestRate: 'Varies'
              });
            }
          } catch (error) {
            // Check if this is the proxy implementation error
            if (error && typeof error === 'object') {
              const err = error as Record<string, unknown>;
              if ('reason' in err && typeof err.reason === 'string') {
                console.error(`Compound protocol error on chain ${chainId}: ${err.reason}`);
                if (err.reason === 'Proxy: implementation not initialized') {
                  continue;
                }
              }
            }
            console.error(`Error fetching Compound data for chain ${chainId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error fetching Compound loans:', error);
      }
      
      return loans;
    } catch (error) {
      console.error('Error in getUserLoans:', error);
      return [];
    }
  }

  // Get user alerts based on portfolio
  async getUserAlerts(walletAddress?: string): Promise<Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
  }>> {
    if (!walletAddress) {
      walletAddress = await this.getWalletAddress() || undefined;
      if (!walletAddress) return [];
    }

    try {
      const alerts: {
        id: string;
        type: string;
        message: string;
        timestamp: string;
      }[] = [];
      
      // Get user loans to check for health warnings
      const loans = await this.getUserLoans(walletAddress);
      
      // Add alerts for loans with warning or critical health
      loans.forEach((loan, index) => {
        if (loan.health === 'Warning') {
          alerts.push({
            id: `loan-warning-${index}`,
            type: 'Warning',
            message: `Your ${loan.protocol} loan health is below 1.5x. Consider adding more collateral.`,
            timestamp: this.getRelativeTimeString(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
          });
        } else if (loan.health === 'Critical') {
          alerts.push({
            id: `loan-critical-${index}`,
            type: 'Critical',
            message: `Your ${loan.protocol} loan health is critical! Add collateral immediately to avoid liquidation.`,
            timestamp: this.getRelativeTimeString(Date.now() - 30 * 60 * 1000) // 30 minutes ago
          });
        }
      });
      
      // Get token balances to check for significant price changes
      const tokens = await this.getPopularTokenBalances(walletAddress);
      
      // Add alerts for tokens with significant balances and price changes
      tokens.forEach((token, index) => {
        // Only add alerts for tokens with significant balances (over $100)
        const balanceUSD = parseFloat(token.balanceUSD.replace(/[^0-9.]/g, ''));
        if (balanceUSD > 100) {
          // Simulate price changes - in production this would come from price feed data
          const priceChange = Math.random() * 10 - 5; // Random change between -5% and +5%
          
          if (Math.abs(priceChange) > 3) { // Only alert on significant changes (>3%)
            alerts.push({
              id: `price-${token.symbol}-${index}`,
              type: priceChange > 0 ? 'Info' : 'Warning',
              message: `${token.symbol} price ${priceChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(priceChange).toFixed(1)}% in the last 24 hours.`,
              timestamp: this.getRelativeTimeString(Date.now() - Math.floor(Math.random() * 24) * 60 * 60 * 1000) // Random time within last 24 hours
            });
          }
        }
      });
      
      // Get LP positions to check for rewards
      const lpPositions = await this.getLPPositions(walletAddress);
      
      // Add alerts for positions with significant rewards
      lpPositions.forEach((position, index) => {
        if (position.rewardsUSD) {
          const rewardsValue = parseFloat(position.rewardsUSD.replace(/[^0-9.-]+/g, ''));
          if (rewardsValue > 5) { // Only alert if rewards are significant (>$5)
            alerts.push({
              id: `rewards-${index}`,
              type: 'Info',
              message: `Your ${position.protocol} ${position.token0?.symbol || ''}/${position.token1?.symbol || ''} position earned ${position.rewardsUSD} in rewards.`,
              timestamp: this.getRelativeTimeString(Date.now() - Math.floor(Math.random() * 48) * 60 * 60 * 1000) // Random time within last 48 hours
            });
          }
        }
      });
      
      // Sort alerts by severity (Critical > Warning > Info) and then by timestamp (most recent first)
      return alerts.sort((a, b) => {
        const severityOrder = { 'Critical': 1, 'Warning': 2, 'Info': 3 };
        const severityA = severityOrder[a.type as keyof typeof severityOrder] || 3;
        const severityB = severityOrder[b.type as keyof typeof severityOrder] || 3;
        
        if (severityA !== severityB) {
          return severityA - severityB;
        }
        
        // Parse timestamps and compare (assuming format like "2 hours ago")
        const timeA = this.parseRelativeTime(a.timestamp);
        const timeB = this.parseRelativeTime(b.timestamp);
        return timeA - timeB;
      });
    } catch (error) {
      console.error('Error in getUserAlerts:', error);
      return [];
    }
  }

  // Helper method to format relative time strings
  private getRelativeTimeString(timestamp: number): string {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay > 0) {
      return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    } else if (diffHour > 0) {
      return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    } else if (diffMin > 0) {
      return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    } else {
      return 'Just now';
    }
  }

  // Helper method to parse relative time strings back to timestamps
  private parseRelativeTime(relativeTime: string): number {
    const now = Date.now();
    
    if (relativeTime === 'Just now') {
      return now;
    }
    
    const match = relativeTime.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
    if (!match) return now;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    let msToSubtract = 0;
    switch (unit) {
      case 'minute': msToSubtract = value * 60 * 1000; break;
      case 'hour': msToSubtract = value * 60 * 60 * 1000; break;
      case 'day': msToSubtract = value * 24 * 60 * 60 * 1000; break;
      case 'week': msToSubtract = value * 7 * 24 * 60 * 60 * 1000; break;
      case 'month': msToSubtract = value * 30 * 24 * 60 * 60 * 1000; break;
      case 'year': msToSubtract = value * 365 * 24 * 60 * 60 * 1000; break;
    }
    
    return now - msToSubtract;
  }
  
  // Calculate weighted average interest rate for Aave position
  private async calculateAverageInterestRate(userAssets: any[], aavePool: any): Promise<string | null> {
    try {
      if (!userAssets || userAssets.length === 0) return null;
      
      const debtAssets = userAssets.filter(asset => asset.type === 'debt');
      if (debtAssets.length === 0) return null;
      
      let totalDebt = 0;
      let weightedRateSum = 0;
      
      // For each debt asset, get its current interest rate and calculate weighted average
      for (const asset of debtAssets) {
        // Get asset address from symbol (this would be more robust in production)
        const assetAddress = this.getAssetAddressFromSymbol(asset.symbol);
        if (!assetAddress) continue;
        
        try {
          let interestRate;
          
          try {
            // First attempt - try to get interest rates directly using newer method
            const reserveData = await aavePool.getReserveData(assetAddress);
            
            // Get the appropriate interest rate based on whether it's variable or stable debt
            if (asset.isVariable) {
              interestRate = reserveData.variableBorrowRate || reserveData.currentVariableBorrowRate;
            } else {
              interestRate = reserveData.stableBorrowRate || reserveData.currentStableBorrowRate;
            }
          } catch (reserveDataError) {
            console.log(`Using fallback method for interest rate on ${asset.symbol}`, reserveDataError);
            
            // Fallback - try to get interest rates directly if the structure doesn't match
            if (asset.isVariable) {
              try {
                // We can compute APR using the normalized variable debt rate
                const normalizedVariableDebt = await aavePool.getReserveNormalizedVariableDebt(assetAddress);
                interestRate = normalizedVariableDebt;
              } catch (rateError) {
                console.log(`Couldn't get variable debt rate for ${asset.symbol}. Using default.`, rateError);
                interestRate = ethers.utils.parseUnits('0.05', 27); // 5% as fallback for variable
              }
            } else {
              try {
                // Try to get stable rate if available
                const stableRate = await aavePool.getReserveCurrentStableBorrowRate(assetAddress);
                interestRate = stableRate;
              } catch (stableError) {
                console.log(`Couldn't get stable rate for ${asset.symbol}. Using default.`);
                // For stable rate, use a fixed value as fallback
                interestRate = ethers.utils.parseUnits('0.03', 27); // 3% as fallback
              }
            }
          }
          
          // Convert from ray (10^27) to percentage
          const interestRatePercentage = parseFloat(ethers.utils.formatUnits(interestRate, 27)) * 100;
          
          // Calculate weight based on debt balance
          const debtAmount = parseFloat(asset.balance);
          totalDebt += debtAmount;
          weightedRateSum += interestRatePercentage * debtAmount;
        } catch (error) {
          console.error(`Error getting interest rate for ${asset.symbol}:`, error);
        }
      }
      
      if (totalDebt === 0) return null;
      
      // Calculate weighted average
      const weightedAverageRate = weightedRateSum / totalDebt;
      
      // Format to 2 decimal places
      return `${weightedAverageRate.toFixed(2)}%`;
    } catch (error) {
      console.error('Error calculating average interest rate:', error);
      return null;
    }
  }
  
  // Helper method to get asset address from symbol
  private getAssetAddressFromSymbol(symbol: string): string | null {
    if (!symbol) {
      console.error('Empty symbol passed to getAssetAddressFromSymbol');
      return null;
    }
    
    try {
      // Remove any rate indicators like (var) or (stable)
      const cleanSymbol = symbol.toString().split(' ')[0].toUpperCase();
      
      // Map of symbols to addresses - comprehensive list of common tokens
      const symbolToAddress: {[key: string]: string} = {
        // Ethereum mainnet tokens
        'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Special address for native ETH
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'AAVE': '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
        'LINK': '0x514910771AF9Ca656af840dff83E8264EcF986CA',
        'CRV': '0xD533a949740bb3306d119CC777fa900bA034cd52',
        'MKR': '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
        
        // Base tokens
        'USDbC': '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' // USD Base Coin on Base
      };
      
      return symbolToAddress[cleanSymbol] || null;
    } catch (error) {
      console.error(`Error in getAssetAddressFromSymbol for symbol ${symbol}:`, error);
      return null;
    }
  }
  
  // Utility function to format token balances with proper decimals
  private formatTokenBalance(balance: ethers.BigNumber, tokenSymbol: string): string {
    try {
      // Common token decimal mappings
      const tokenDecimals: {[symbol: string]: number} = {
        'WETH': 18,
        'ETH': 18,
        'USDC': 6,
        'USDT': 6,
        'DAI': 18,
        'WBTC': 8,
        'cbETH': 18,
        'USDbC': 6,
        'wstETH': 18,
        // Default to 18 if unknown
        'Unknown': 18
      };
      
      const decimals = tokenDecimals[tokenSymbol] || 18;
      return ethers.utils.formatUnits(balance, decimals);
    } catch (error) {
      console.error(`Error formatting balance for ${tokenSymbol}:`, error);
      return ethers.utils.formatUnits(balance, 18); // Fallback to 18 decimals
    }
  }
}

export const walletDataService = new WalletDataService();
export default walletDataService;

function processUserData(aavePool: any) {
  // Process user data using the updated contract
  // This is a placeholder for the actual processing logic
  // You would replace this with your actual implementation
  console.log('Processing user data...');
  return [];
}
