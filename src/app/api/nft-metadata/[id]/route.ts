import { NextRequest, NextResponse } from 'next/server';

interface MetadataResponse {
  name: string;
  description?: string;
  [key: string]: any;
}

type RouteParams = {
  params: {
    id: string;
  };
};

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const id = context.params.id;
    
    // Construct the IPFS URL using gateway for better reliability
    const ipfsUrl = `https://ipfs.io/ipfs/bafybeigh7eyxenck6zzsrgko4gmin67njweynfcvzganuyoiagkh4bxqyq/${id}.json`;
    
    // Fetch the original metadata
    const response = await fetch(ipfsUrl);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch metadata from IPFS: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Parse the original metadata
    const originalMetadata: MetadataResponse = await response.json();
    
    // Update the name field
    if (originalMetadata.name) {
      // Handle "BitBerry NFT #X" format
      if (originalMetadata.name.startsWith("BitBerry NFT #")) {
        originalMetadata.name = originalMetadata.name.replace("BitBerry NFT #", "BTB Finance #");
      }
      // Handle "BitBerry (BTB)" format
      else if (originalMetadata.name.includes("BitBerry (BTB)")) {
        originalMetadata.name = originalMetadata.name.replace("BitBerry (BTB)", "BTB Finance");
      } 
      // Generic fallback
      else {
        originalMetadata.name = originalMetadata.name.replace(/BitBerry|BTB/gi, "BTB Finance").trim();
        // Avoid duplications like "BTB Finance Finance"
        originalMetadata.name = originalMetadata.name.replace(/BTB Finance Finance/g, "BTB Finance");
      }
    } else {
      originalMetadata.name = "BTB Finance";
    }
    
    // Optionally update description if it exists
    if (originalMetadata.description && originalMetadata.description.includes("BitBerry NFT")) {
      originalMetadata.description = originalMetadata.description.replace(
        /BitBerry NFT/g, 
        "BTB Finance NFT"
      );
    }
    
    // Return the modified metadata
    return NextResponse.json(originalMetadata);
  } catch (error) {
    console.error('Error processing metadata:', error);
    return NextResponse.json(
      { error: 'Failed to process metadata' },
      { status: 500 }
    );
  }
} 