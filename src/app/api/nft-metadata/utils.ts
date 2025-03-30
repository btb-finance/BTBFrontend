/**
 * Utility functions for NFT metadata handling
 */

// IPFS Gateway URLs in order of preference
const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.filebase.io/ipfs/'
];

// IPFS hash for the NFT collection
export const IPFS_HASH = 'bafybeigh7eyxenck6zzsrgko4gmin67njweynfcvzganuyoiagkh4bxqyq';

/**
 * Fetch metadata from IPFS with fallback support
 * @param tokenId The NFT token ID
 * @returns The metadata JSON object
 */
export async function fetchMetadataWithFallback(tokenId: string): Promise<any> {
  let lastError: Error | null = null;

  // Try each gateway in order until one succeeds
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const ipfsUrl = `${gateway}${IPFS_HASH}/${tokenId}.json`;
      const response = await fetch(ipfsUrl, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Gateway ${gateway} returned status ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Failed to fetch from gateway ${gateway}:`, error);
      // Continue to next gateway
    }
  }
  
  // If all gateways fail
  throw lastError || new Error('All IPFS gateways failed');
}

/**
 * Transform metadata by updating the name field
 * @param metadata The original metadata object
 * @param tokenId The NFT token ID
 * @returns The modified metadata object
 */
export function transformMetadata(metadata: any, tokenId: string): any {
  // Create a deep copy to avoid modifying the original
  const transformed = JSON.parse(JSON.stringify(metadata));
  
  // Update the name field from "BitBerry (BTB)" to "BTB Finance"
  if (transformed.name && transformed.name.includes('BitBerry (BTB)')) {
    transformed.name = transformed.name.replace('BitBerry (BTB)', 'BTB Finance');
  } else if (transformed.name) {
    // If it doesn't have the exact "BitBerry (BTB)" string but has a name field
    transformed.name = `BTB Finance #${tokenId}`;
  }
  
  return transformed;
} 