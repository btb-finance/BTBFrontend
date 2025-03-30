'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NFTMetadataProxy() {
  const [tokenId, setTokenId] = useState('1');
  const [testData, setTestData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchTestData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/nft-metadata/test');
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const data = await response.json();
      setTestData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTestData();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">NFT Metadata Proxy Tool</h1>
      <p className="mb-4">
        It's a cute cat project from BTB Finance NFT. The NFT token can always be exchanged for the BTB token, allowing you to use NFTs as a profile picture on your social media profiles and more.
      </p>
      <p className="mb-4">
        This tool allows you to proxy and transform NFT metadata, changing collection names from
        "BitBerry (BTB)" to "BTB Finance NFT" while preserving all other metadata.
      </p>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Test the Proxy</h2>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={fetchTestData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Run Test'}
          </button>
        </div>

        {error && (
          <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {testData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded p-4">
              <h3 className="font-semibold text-lg mb-2">Original Metadata</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(testData.original, null, 2)}
              </pre>
            </div>
            <div className="border rounded p-4">
              <h3 className="font-semibold text-lg mb-2">Modified Metadata</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(testData.modified, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Try a Specific Token ID</h2>
        <div className="flex items-center gap-4 mb-4">
          <input
            type="text"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Enter token ID"
            className="px-4 py-2 border rounded"
          />
          <Link
            href={`/api/nft-metadata/${tokenId}`}
            target="_blank"
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            View Metadata
          </Link>
        </div>
      </div>

      <div className="mt-8 border-t pt-6">
        <h2 className="text-xl font-semibold mb-2">Implementation Guide</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li>
            The proxy is now available at{' '}
            <code className="bg-gray-100 px-2 py-1 rounded">
              https://yoursite.com/api/nft-metadata/[tokenId]
            </code>
          </li>
          <li>
            Update your NFT contract by calling the <code className="bg-gray-100 px-2 py-1 rounded">setBaseURI()</code>{' '}
            function to point to this endpoint
          </li>
          <li>NFT marketplaces will now show the updated name "BTB Finance NFT" instead of "BitBerry (BTB)"</li>
        </ol>
      </div>
    </div>
  );
} 