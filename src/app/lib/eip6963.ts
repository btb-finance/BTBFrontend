/**
 * EIP-6963 Provider Discovery Utilities
 * Implements the Multi Injected Provider Discovery standard
 */

import {
  EIP6963ProviderDetail,
  EIP6963AnnounceProviderEvent,
  EIP6963ProvidersMapType,
} from '../types/eip6963';

/**
 * Discovers all EIP-6963 compatible wallet providers
 * @returns Promise that resolves with a map of discovered providers
 */
export function discoverEIP6963Providers(): Promise<EIP6963ProvidersMapType> {
  return new Promise((resolve) => {
    const providers: EIP6963ProvidersMapType = {};

    // Set a timeout to resolve after collecting announcements
    const timeout = setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
      resolve(providers);
    }, 100); // Wait 100ms for all providers to announce

    const handleAnnouncement = (event: EIP6963AnnounceProviderEvent) => {
      const { detail } = event;

      // Store provider by UUID to avoid duplicates
      if (detail && detail.info && detail.provider) {
        providers[detail.info.uuid] = detail;
        console.log('[EIP-6963] Discovered provider:', detail.info.name, detail.info.rdns);
      }
    };

    // Listen for provider announcements
    window.addEventListener('eip6963:announceProvider', handleAnnouncement);

    // Request providers to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  });
}

/**
 * Creates a listener for real-time provider announcements
 * @param callback Function to call when a provider is announced
 * @returns Cleanup function to remove the listener
 */
export function listenForProviders(
  callback: (providerDetail: EIP6963ProviderDetail) => void
): () => void {
  const handleAnnouncement = (event: EIP6963AnnounceProviderEvent) => {
    if (event.detail && event.detail.info && event.detail.provider) {
      callback(event.detail);
    }
  };

  window.addEventListener('eip6963:announceProvider', handleAnnouncement);

  // Request providers to announce themselves
  window.dispatchEvent(new Event('eip6963:requestProvider'));

  // Return cleanup function
  return () => {
    window.removeEventListener('eip6963:announceProvider', handleAnnouncement);
  };
}

/**
 * Gets a specific provider by its RDNS (Reverse DNS Name)
 * @param rdns The reverse DNS name of the provider (e.g., 'io.metamask')
 * @returns Promise that resolves with the provider detail or null
 */
export async function getProviderByRdns(
  rdns: string
): Promise<EIP6963ProviderDetail | null> {
  const providers = await discoverEIP6963Providers();

  for (const uuid in providers) {
    if (providers[uuid].info.rdns === rdns) {
      return providers[uuid];
    }
  }

  return null;
}

/**
 * Checks if EIP-6963 is supported in the current environment
 * @returns true if EIP-6963 is supported
 */
export function isEIP6963Supported(): boolean {
  return typeof window !== 'undefined' &&
         typeof window.dispatchEvent === 'function' &&
         typeof window.addEventListener === 'function';
}

/**
 * Gets the provider from window.ethereum (legacy fallback)
 * Only use this if EIP-6963 providers are not available
 */
export function getLegacyProvider() {
  if (typeof window !== 'undefined' && window.ethereum) {
    return {
      info: {
        uuid: 'legacy-injected-provider',
        name: 'Injected Wallet',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTE2IDMyYzguODM3IDAgMTYtNy4xNjMgMTYtMTZTMjQuODM3IDAgMTYgMCAwIDcuMTYzIDAgMTZzNy4xNjMgMTYgMTYgMTZ6IiBmaWxsPSIjZmZmIi8+PC9zdmc+',
        rdns: 'legacy.injected',
      },
      provider: window.ethereum,
    } as EIP6963ProviderDetail;
  }
  return null;
}

/**
 * Request all providers to announce themselves
 * Useful for refreshing the provider list
 */
export function requestProviders(): void {
  if (isEIP6963Supported()) {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }
}
