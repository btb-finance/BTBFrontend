export const CHAINS = {
  ETHEREUM: {
    name: 'Ethereum',
    chainId: 1,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrl: 'https://mainnet.infura.io/v3/your-infura-key',
    blockExplorerUrl: 'https://etherscan.io'
  },
  OPTIMISM: {
    name: 'Optimism',
    chainId: 10,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorerUrl: 'https://optimistic.etherscan.io'
  },
  ARBITRUM: {
    name: 'Arbitrum',
    chainId: 42161,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorerUrl: 'https://arbiscan.io'
  },
  BASE: {
    name: 'Base',
    chainId: 8453,
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrl: 'https://mainnet.base.org',
    blockExplorerUrl: 'https://basescan.org'
  },
  AVALANCHE: {
    name: 'Avalanche',
    chainId: 43114,
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    },
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorerUrl: 'https://snowtrace.io'
  },
  POLYGON: {
    name: 'Polygon',
    chainId: 137,
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorerUrl: 'https://polygonscan.com'
  }
};
