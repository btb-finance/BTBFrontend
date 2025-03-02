import { ethers } from 'ethers';

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
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
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

// LP Pools by chain
const LP_POOLS_BY_CHAIN = {
  [CHAINS.ETHEREUM.chainId]: [
    {
      address: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc', // Uniswap V2 ETH-USDC
      protocol: 'Uniswap V2',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId].WETH.address },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId].USDC.address },
      apy: '4.8%'
    },
    {
      address: '0x8a649274e4d777ffc6851f13d23a86bbfa2f2fbf', // Balancer WBTC-ETH
      protocol: 'Balancer',
      pair: 'WBTC/ETH',
      token0: { symbol: 'WBTC', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WBTC?.address },
      token1: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WETH?.address },
      apy: '6.2%'
    },
    {
      address: '0xceff51756c56ceffca006cd410b03ffc46dd3a58', // Sushiswap WBTC-ETH
      protocol: 'Sushiswap',
      pair: 'WBTC/ETH',
      token0: { symbol: 'WBTC', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WBTC?.address },
      token1: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ETHEREUM.chainId]?.WETH?.address },
      apy: '5.9%'
    }
  ],
  [CHAINS.OPTIMISM.chainId]: [
    {
      address: '0x2e9F9bECF5229379825D0D3C1299759943BD4fED', // Velodrome ETH-USDC
      protocol: 'Velodrome',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.OPTIMISM.chainId].WETH.address },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.OPTIMISM.chainId].USDC.address },
      apy: '3.5%'
    }
  ],
  [CHAINS.ARBITRUM.chainId]: [
    {
      address: '0x905dfCD5649217c42684f23958568e533C711Aa3', // SushiSwap ETH-USDC
      protocol: 'SushiSwap',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.ARBITRUM.chainId].WETH.address },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.ARBITRUM.chainId].USDC.address },
      apy: '4.1%'
    }
  ],
  [CHAINS.BASE.chainId]: [
    {
      address: '0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18', // BaseSwap ETH-USDC
      protocol: 'BaseSwap',
      pair: 'ETH/USDC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId].USDC.address },
      apy: '5.2%'
    },
    {
      address: '0xB4885Bc63399BF5518b994c1d0C8AFd4Db5EfE29', // Aerodrome ETH-USDbC
      protocol: 'Aerodrome',
      pair: 'ETH/USDbC',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'USDbC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.USDbC?.address || '' },
      apy: '4.9%'
    },
    {
      address: '0x0FeB1490f80B6DDa3c8C77A0f2C4F0C8F2e90F3B', // Aerodrome USDC-USDbC
      protocol: 'Aerodrome',
      pair: 'USDC/USDbC',
      token0: { symbol: 'USDC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.USDC?.address || '' },
      token1: { symbol: 'USDbC', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.USDbC?.address || '' },
      apy: '2.1%'
    },
    {
      address: '0xFB7eF66a2F6E2057488E5B4F352Ce3F6d94737c8', // Aerodrome ETH-cbETH
      protocol: 'Aerodrome',
      pair: 'ETH/cbETH',
      token0: { symbol: 'ETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.WETH?.address || '' },
      token1: { symbol: 'cbETH', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.CBETH?.address || '' },
      apy: '3.8%'
    },
    {
      address: '0xBB6e8c1e49f04C9f6c4D6163c52990f92431FdBB', // BTB Finance BTB-BTBY
      protocol: 'BTB Finance',
      pair: 'BTB/BTBY',
      token0: { symbol: 'BTB', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.BTB?.address || '' },
      token1: { symbol: 'BTBY', address: TOKENS_BY_CHAIN[CHAINS.BASE.chainId]?.BTBY?.address || '' },
      apy: '12.5%'
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

export class WalletDataService {
  private providers: { [chainId: number]: ethers.providers.JsonRpcProvider } = {};
  private signer: ethers.Signer | null = null;
  private isInitialized = false;
  
  constructor() {
    // Initialize providers for all chains
    Object.values(CHAINS).forEach(chain => {
      try {
        this.providers[chain.chainId] = new ethers.providers.JsonRpcProvider(chain.rpcUrl);
      } catch (error) {
        console.error(`Failed to initialize provider for ${chain.name}:`, error);
      }
    });
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
        decimals = await tokenContract.decimals();
      } catch (error) {
        console.error(`Error getting decimals for token ${tokenAddress}, using default 18:`, error);
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
        balance: balance.toString(),
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
      
      // If we want to include other chains as well (optional)
      const includeOtherChains = false;
      
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
  }>> {
    // This implementation queries LP tokens the wallet holds
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Prioritize Base chain
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
              tvl
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
  async getTokenValueUSD(symbol: string, amount: string): Promise<string | null> {
    try {
      if (!amount || parseFloat(amount) === 0) {
        return '$0.00';
      }
      
      const balance = parseFloat(amount);
      let priceUSD = 0;
      
      // In a real app, this would call a price API for all tokens
      // For demonstration, use specific price lookup for common tokens
      if (symbol === 'ETH' || symbol === 'WETH') {
        // Try to get real ETH price from a public API
        try {
          const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
          const data = await response.json();
          if (data.ethereum?.usd) {
            priceUSD = data.ethereum.usd;
          } else {
            // Fallback price
            priceUSD = 2200;
          }
        } catch (e) {
          console.error(`Error getting price for ETH:`, e);
          priceUSD = 2200; // Fallback price
        }
      } else if (symbol === 'WBTC' || symbol === 'BTC') {
        try {
          const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
          const data = await response.json();
          if (data.bitcoin?.usd) {
            priceUSD = data.bitcoin.usd;
          } else {
            priceUSD = 48000;
          }
        } catch (e) {
          console.error(`Error getting price for BTC:`, e);
          priceUSD = 48000; // Fallback price
        }
      } else if (['USDC', 'USDT', 'DAI', 'BUSD'].includes(symbol)) {
        // Stablecoins at roughly $1
        priceUSD = 1;
      } else if (symbol === 'OP') {
        priceUSD = 2.5; // Optimism token estimate
      } else if (symbol === 'ARB') {
        priceUSD = 1.2; // Arbitrum token estimate
      } else {
        // For other tokens, try to get price or use fallback
        try {
          const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`);
          const data = await response.json();
          const price = data[symbol.toLowerCase()]?.usd;
          if (price) {
            priceUSD = price;
          } else {
            // Fallback estimate based on token type
            priceUSD = symbol === 'LINK' ? 15 : 
                      symbol === 'UNI' ? 7 : 
                      symbol === 'AAVE' ? 80 : 
                      symbol === 'SNX' ? 3 : 5;
          }
        } catch (e) {
          // Fallback to reasonable estimates if API fails
          priceUSD = symbol === 'LINK' ? 15 : 
                    symbol === 'UNI' ? 7 : 
                    symbol === 'AAVE' ? 80 : 
                    symbol === 'SNX' ? 3 : 5;
        }
      }
      
      const valueUSD = balance * priceUSD;
      return `$${valueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } catch (error) {
      console.error(`Error calculating value for ${symbol}:`, error);
      return null;
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
        balance: nativeBalance.toString(),
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
            const contract = new ethers.Contract(token.address, ERC20_ABI_MINIMAL, provider);
            
            const [balance, decimals] = await Promise.all([
              contract.balanceOf(address),
              contract.decimals()
            ]);
            
            if (balance.isZero()) {
              return null; // Skip zero balances
            }
            
            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            const valueUSD = await this.getTokenValueUSD(token.symbol, formattedBalance);
            
            return {
              name: token.name,
              symbol: token.symbol,
              address: token.address,
              balance: balance.toString(),
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
            // APE token
            '0x4d224452801ACEd8B2F0aebE155379bb5D594381',
            // PEPE token
            '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
            // SHIB token
            '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE'
          ];
          
          const additionalTokenPromises = commonAdditionalTokenAddresses.map(async tokenAddress => {
            try {
              // Create contract for this token
              const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI_MINIMAL, provider);
              
              // Check if user has a balance
              const balance = await tokenContract.balanceOf(address);
              
              if (balance.isZero()) {
                return null; // Skip if no balance
              }
              
              // Get token details
              const [symbol, name, decimals] = await Promise.all([
                tokenContract.symbol().catch(() => 'UNKNOWN'),
                tokenContract.name().catch(() => 'Unknown Token'),
                tokenContract.decimals().catch(() => 18)
              ]);
              
              // Format the balance
              const formattedBalance = ethers.utils.formatUnits(balance, decimals);
              
              // Get USD value if possible
              const valueUSD = await this.getTokenValueUSD(symbol, formattedBalance);
              
              return {
                name,
                symbol,
                address: tokenAddress,
                balance: balance.toString(),
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
            chain: CHAINS[chainId]?.name || 'Unknown'
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
}

export default new WalletDataService();
