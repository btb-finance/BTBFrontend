import { useQuery } from '@tanstack/react-query';
import { ethers } from 'ethers';
import { useWalletConnection } from './useWalletConnection'; // To get the provider

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'; // Or from a constants file

async function fetchTokenDecimals(
  provider: ethers.providers.Web3Provider | null,
  tokenAddress: string,
  networkChainId: number | undefined
): Promise<number> {
  if (!provider || !tokenAddress || !networkChainId) {
    throw new Error('Provider, token address, or chainId is missing');
  }

  if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
    return 18; // Native tokens like ETH usually have 18 decimals
  }

  try {
    const contract = new ethers.Contract(tokenAddress, ['function decimals() view returns (uint8)'], provider);
    const decimals = await contract.decimals();
    return Number(decimals);
  } catch (error) {
    console.warn(`Failed to fetch decimals for ${tokenAddress} on chain ${networkChainId}, defaulting to 18:`, error);
    return 18; // Default to 18 if fetching fails
  }
}

export function useTokenDecimals(tokenAddress: string | null | undefined) {
  const { provider, chainId } = useWalletConnection(); // Assuming this hook provides the current provider and chainId

  const enabled = !!provider && !!tokenAddress && !!chainId;

  return useQuery<number, Error>({
    queryKey: ['tokenDecimals', tokenAddress, chainId],
    queryFn: () => {
      if (!provider || !tokenAddress || !chainId) {
        // This should ideally not be reached if 'enabled' is working correctly,
        // but as a safeguard for type checking and promise fulfillment.
        return Promise.reject(new Error('Query function called with missing dependencies.'));
      }
      return fetchTokenDecimals(provider, tokenAddress, chainId);
    },
    enabled,
    staleTime: Infinity, // Decimals are usually static for a token address
    cacheTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => {
      // Do not retry for "invalid address" type errors, but retry for network issues.
      if (error.message.includes('invalid address') || error.message.includes('bad address')) {
        return false;
      }
      return failureCount < 2; // Retry up to 2 times for other errors
    },
  });
}
