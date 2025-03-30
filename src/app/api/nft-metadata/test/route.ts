import { NextRequest, NextResponse } from 'next/server';
import { fetchMetadataWithFallback, transformMetadata } from '../utils';

// This is a test endpoint to verify the metadata transformation
export async function GET(request: NextRequest) {
  try {
    // The token ID for testing (using token #1)
    const tokenId = '1';
    
    // Fetch the original metadata from IPFS with fallback support
    const originalMetadata = await fetchMetadataWithFallback(tokenId);
    
    // Transform the metadata
    const modifiedMetadata = transformMetadata(originalMetadata, tokenId);
    
    // Return both the original and modified metadata for comparison
    return NextResponse.json({
      original: originalMetadata,
      modified: modifiedMetadata,
      proxyEndpoint: `/api/nft-metadata/${tokenId}`
    });
  } catch (error) {
    console.error('Error processing test metadata:', error);
    return NextResponse.json(
      { error: 'Failed to process test metadata', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 