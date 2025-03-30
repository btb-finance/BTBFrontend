import { NextRequest, NextResponse } from 'next/server';
import { fetchMetadataWithFallback, transformMetadata } from '../utils';

// Add revalidation period - 7 days (in seconds)
export const revalidate = 604800; // 7 days

type Params = { params: { tokenId: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const tokenId = params.tokenId;
    
    if (!tokenId || !/^\d+$/.test(tokenId)) {
      return NextResponse.json(
        { error: 'Invalid token ID' },
        { status: 400 }
      );
    }

    // Fetch the original metadata from IPFS with fallback support
    const metadata = await fetchMetadataWithFallback(tokenId);
    
    // Transform the metadata (update the name field)
    const transformedMetadata = transformMetadata(metadata, tokenId);
    
    // Return the modified metadata with cache control headers
    const jsonResponse = NextResponse.json(transformedMetadata);
    jsonResponse.headers.set('Cache-Control', 'public, max-age=604800'); // 7 days
    
    return jsonResponse;
  } catch (error) {
    console.error('Error processing metadata:', error);
    return NextResponse.json(
      { error: 'Failed to process metadata', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 