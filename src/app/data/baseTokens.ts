// Common token addresses on Base
export const BASE_TOKENS = {
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  TOSHI: '0x8544Fe9d190fD7EC52860cA2c75E2F6498D2DC1D',
  CBETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  DEGEN: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  BALD: '0x27D2DECb4bFC9C76F0309b8E88dec3a601Fe25a8',
  AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
};

// Fee tiers
export const FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

// Uniswap V3 Factory addresses on Base
export const UNISWAP_V3_ADDRESSES = {
  FACTORY: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD', // Uniswap V3 Factory on Base
};

// Pool tags and descriptions
export const POOL_TAGS = {
  STABLE: {
    name: 'Stable',
    description: 'Pools with stablecoins (USDC, USDbC, DAI)',
    color: 'blue'
  },
  VOLATILE: {
    name: 'Volatile',
    description: 'Pools with more price volatility',
    color: 'amber'
  },
  HIGH_APR: {
    name: 'High APR',
    description: 'Pools with higher than average APR',
    color: 'green'
  },
  HIGH_VOLUME: {
    name: 'High Volume',
    description: 'Pools with high trading volume',
    color: 'purple'
  }
};
