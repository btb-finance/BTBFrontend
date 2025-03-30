# NFT Metadata Proxy

This API provides a proxy for updating the NFT metadata for the BTB Finance collection.

## Purpose

The proxy transforms NFT metadata from the original IPFS source, changing the collection name from "BitBerry (BTB)" to "BTB Finance" while keeping all other metadata (including images) intact.

## Endpoints

### 1. Get Metadata for a Specific Token

```
GET /api/nft-metadata/{tokenId}
```

Returns the modified metadata for the specified NFT token ID.

#### Parameters

- `tokenId` (path parameter): The ID of the NFT token

#### Response

The JSON metadata with the name field updated to use "BTB Finance" instead of "BitBerry (BTB)".

### 2. Test Endpoint

```
GET /api/nft-metadata/test
```

Returns both the original and modified metadata for token #1, allowing comparison to verify the transformation works correctly.

## Implementation Details

- The proxy fetches the original metadata from IPFS (ipfs://bafybeigh7eyxenck6zzsrgko4gmin67njweynfcvzganuyoiagkh4bxqyq/{tokenId}.json)
- It modifies only the name field to use the new brand name
- The proxy has built-in caching (7 days) to improve performance
- The API uses Next.js Edge Runtime for optimal performance

## Usage with NFT Contract

After deploying this metadata proxy, you'll need to update your NFT contract by calling the `setBaseURI()` function to point to this new API endpoint:

```solidity
// Example call (adjust according to your contract's specific function)
contract.setBaseURI("https://your-domain.com/api/nft-metadata/");
```

This will make marketplaces like OpenSea fetch metadata from this proxy instead of directly from IPFS. 