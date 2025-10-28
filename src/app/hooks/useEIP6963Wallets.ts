'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  EIP6963ProviderDetail,
  EIP6963ProvidersMapType,
} from '../types/eip6963';
import {
  discoverEIP6963Providers,
  listenForProviders,
  getLegacyProvider,
  isEIP6963Supported,
} from '../lib/eip6963';

/**
 * Custom hook to discover and manage EIP-6963 wallet providers
 * @returns Object containing discovered providers and utility functions
 */
export function useEIP6963Wallets() {
  const [providers, setProviders] = useState<EIP6963ProvidersMapType>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Discovers all available wallet providers
   */
  const discoverProviders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isEIP6963Supported()) {
        // Fallback to legacy provider if EIP-6963 is not supported
        const legacyProvider = getLegacyProvider();
        if (legacyProvider) {
          setProviders({ [legacyProvider.info.uuid]: legacyProvider });
        }
        setIsLoading(false);
        return;
      }

      // Discover EIP-6963 providers
      const discoveredProviders = await discoverEIP6963Providers();

      // If no EIP-6963 providers found, check for legacy provider
      if (Object.keys(discoveredProviders).length === 0) {
        const legacyProvider = getLegacyProvider();
        if (legacyProvider) {
          discoveredProviders[legacyProvider.info.uuid] = legacyProvider;
        }
      }

      setProviders(discoveredProviders);
      setIsLoading(false);
    } catch (err) {
      console.error('[useEIP6963Wallets] Error discovering providers:', err);
      setError(err instanceof Error ? err : new Error('Failed to discover providers'));
      setIsLoading(false);
    }
  }, []);

  /**
   * Sets up real-time listener for new provider announcements
   */
  useEffect(() => {
    if (!isEIP6963Supported()) {
      // Just discover once if EIP-6963 is not supported
      discoverProviders();
      return;
    }

    // Initial discovery
    discoverProviders();

    // Listen for new provider announcements
    const cleanup = listenForProviders((providerDetail: EIP6963ProviderDetail) => {
      setProviders((prev) => ({
        ...prev,
        [providerDetail.info.uuid]: providerDetail,
      }));
    });

    return cleanup;
  }, [discoverProviders]);

  /**
   * Gets a provider by its UUID
   */
  const getProvider = useCallback(
    (uuid: string): EIP6963ProviderDetail | null => {
      return providers[uuid] || null;
    },
    [providers]
  );

  /**
   * Gets a provider by its RDNS (Reverse DNS Name)
   */
  const getProviderByRdns = useCallback(
    (rdns: string): EIP6963ProviderDetail | null => {
      for (const uuid in providers) {
        if (providers[uuid].info.rdns === rdns) {
          return providers[uuid];
        }
      }
      return null;
    },
    [providers]
  );

  /**
   * Gets all providers as an array
   */
  const getProvidersArray = useCallback((): EIP6963ProviderDetail[] => {
    return Object.values(providers);
  }, [providers]);

  /**
   * Checks if any providers are available
   */
  const hasProviders = Object.keys(providers).length > 0;

  /**
   * Gets the number of available providers
   */
  const providerCount = Object.keys(providers).length;

  return {
    providers,
    providersArray: getProvidersArray(),
    isLoading,
    error,
    hasProviders,
    providerCount,
    getProvider,
    getProviderByRdns,
    refresh: discoverProviders,
  };
}
