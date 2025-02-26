import { useState, useEffect } from 'react';

// List of free, public API keys that can be used without an API key
const PUBLIC_APIS = {
  // RPC endpoints
  RPC: {
    ETHEREUM: 'https://eth.llamarpc.com',
    OPTIMISM: 'https://mainnet.optimism.io',
    ARBITRUM: 'https://arb1.arbitrum.io/rpc',
    BASE: 'https://mainnet.base.org',
    POLYGON: 'https://polygon-rpc.com',
    AVAX: 'https://api.avax.network/ext/bc/C/rpc'
  },
  
  // Price APIs
  PRICE: {
    COINGECKO_FREE: 'https://api.coingecko.com/api/v3',
    COINBASE: 'https://api.coinbase.com/v2',
    BINANCE: 'https://api.binance.com/api/v3'
  },
  
  // NFT APIs
  NFT: {
    OPENSEA_PUBLIC: 'https://api.opensea.io/api/v1'
  },
  
  // DEX APIs
  DEX: {
    UNISWAP_SUBGRAPH: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
    SUSHISWAP_SUBGRAPH: 'https://api.thegraph.com/subgraphs/name/sushi-labs/sushiswap-ethereum'
  },
  
  // API Keys that are public but still needed
  API_KEYS: {
    HOOKRANK: 'b87e9ee22c7d1b23c7dc69062db0e90681fefcc56571235dc907f68207060951'
  }
};

// Chain IDs for reference
export const CHAIN_IDS = {
  ETHEREUM: 1,
  OPTIMISM: 10,
  ARBITRUM: 42161,
  BASE: 8453,
  POLYGON: 137,
  AVALANCHE: 43114
};

/**
 * Hook to access public APIs without requiring an API key
 * @param apiType The type of API to use (RPC, PRICE, NFT, DEX)
 * @param network Optional network name for RPC endpoints
 * @returns The API URL and loading state
 */
export function usePublicApi(apiType: keyof typeof PUBLIC_APIS, network?: string) {
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (!PUBLIC_APIS[apiType]) {
        throw new Error(`API type ${apiType} not supported`);
      }
      
      if (apiType === 'RPC' && network) {
        const rpcEndpoint = PUBLIC_APIS.RPC[network as keyof typeof PUBLIC_APIS.RPC];
        if (!rpcEndpoint) {
          throw new Error(`Network ${network} not supported for RPC`);
        }
        setApiUrl(rpcEndpoint);
      } else {
        // For non-RPC APIs, just return the base URL
        const apis = PUBLIC_APIS[apiType];
        setApiUrl(Object.values(apis)[0] as string);
      }
      
      setIsLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setIsLoading(false);
    }
  }, [apiType, network]);

  return { apiUrl, isLoading, error };
}

/**
 * Function to get a specific API URL directly without using the hook
 * @param apiType The type of API
 * @param apiName The specific API name within the type
 * @returns The API URL or null if not found
 */
export function getPublicApiUrl(
  apiType: keyof typeof PUBLIC_APIS, 
  apiName: string
): string | null {
  try {
    const apis = PUBLIC_APIS[apiType];
    return (apis as Record<string, string>)[apiName] || null;
  } catch (error) {
    console.error('Error getting API URL:', error);
    return null;
  }
}

/**
 * Get the HOOKRANK API key
 * @returns The HOOKRANK API key
 */
export function getHookrankApiKey(): string {
  return PUBLIC_APIS.API_KEYS.HOOKRANK;
}

export default usePublicApi;
