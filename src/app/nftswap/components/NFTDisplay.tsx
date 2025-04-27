'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { ethers } from 'ethers';
import { useWallet } from '../../context/WalletContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ExclamationCircleIcon, PhotoIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface NFTDisplayProps {
  bearNftAddress: string;
  isConnected: boolean;
}

// ERC721 ABI for token functions
const erc721ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

export default function NFTDisplay({ bearNftAddress, isConnected }: NFTDisplayProps) {
  const { address } = useWallet();
  const [userNfts, setUserNfts] = useState<number[]>([]);
  const [nftMetadata, setNftMetadata] = useState<{[tokenId: number]: { image: string; name: string; description: string }}>({});
  const [isLoadingMetadata, setIsLoadingMetadata] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentNftIndex, setCurrentNftIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's NFTs
  useEffect(() => {
    const fetchUserNFTs = async () => {
      if (!isConnected || !address) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        if (!window.ethereum) {
          console.error('No ethereum provider found');
          setIsLoading(false);
          setError('No Ethereum provider found. Please install MetaMask or another Web3 wallet.');
          return;
        }
        const provider = new ethers.providers.Web3Provider(window.ethereum as any);
        const bearNftContract = new ethers.Contract(
          bearNftAddress,
          erc721ABI,
          provider
        );

        // Get user's NFT balance
        const balance = await bearNftContract.balanceOf(address);
        const balanceNumber = balance.toNumber();

        // Get all NFT IDs owned by the user
        const tokenIds = [];
        for (let i = 0; i < balanceNumber; i++) {
          const tokenId = await bearNftContract.tokenOfOwnerByIndex(address, i);
          tokenIds.push(tokenId.toNumber());
        }

        setUserNfts(tokenIds);
        
        // Fetch metadata for each NFT
        if (tokenIds.length > 0) {
          await fetchNFTMetadata(bearNftContract, tokenIds);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user NFTs:', error);
        setError('Failed to load NFTs. Please try again later.');
        setIsLoading(false);
      }
    };

    fetchUserNFTs();
  }, [isConnected, address, bearNftAddress]);

  const fetchNFTMetadata = async (contract: ethers.Contract, tokenIds: number[]) => {
    try {
      setIsLoadingMetadata(true);
      const metadata: {[tokenId: number]: { image: string; name: string; description: string }} = {};
      
      for (const tokenId of tokenIds) {
        try {
          // Get token URI
          const tokenURI = await contract.tokenURI(tokenId);
          
          // Handle different URI formats
          let metadataURL = tokenURI;
          if (tokenURI.startsWith('ipfs://')) {
            // Convert IPFS URI to HTTP gateway URL
            metadataURL = tokenURI.replace('ipfs://', 'https://ipfs.io/ipfs/');
          }
          
          // Fetch metadata
          const response = await fetch(metadataURL);
          if (response.ok) {
            const data = await response.json();
            
            // Process image URL
            let imageUrl = data.image || '';
            if (imageUrl.startsWith('ipfs://')) {
              imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
            }
            
            metadata[tokenId] = {
              image: imageUrl,
              name: data.name || `Bear NFT #${tokenId}`,
              description: data.description || ''
            };
          }
        } catch (err) {
          console.error(`Error fetching metadata for token ${tokenId}:`, err);
          // Provide fallback data
          metadata[tokenId] = {
            image: '',
            name: `Bear NFT #${tokenId}`,
            description: 'Metadata unavailable'
          };
        }
      }
      
      setNftMetadata(metadata);
    } catch (err) {
      console.error('Error fetching NFT metadata:', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handlePrevNft = () => {
    setCurrentNftIndex((prev) => (prev > 0 ? prev - 1 : userNfts.length - 1));
  };

  const handleNextNft = () => {
    setCurrentNftIndex((prev) => (prev < userNfts.length - 1 ? prev + 1 : 0));
  };

  return (
    <Card className="border border-gray-200 dark:border-gray-800 shadow-md h-full">
      <CardHeader>
        <CardTitle>Your NFT Collection</CardTitle>
        <CardDescription>View and manage your Bear NFTs</CardDescription>
      </CardHeader>
      <CardContent className="p-6">

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-10 w-10 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
          </div>
        ) : userNfts.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300 font-medium">You don't have any Bear NFTs in your wallet.</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4 text-sm text-red-800 dark:text-red-200">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 text-red-500 dark:text-red-400 mr-2 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 bg-gray-900/70 rounded-lg overflow-hidden mb-4 relative">
              {isLoadingMetadata ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full border-2 border-t-transparent border-blue-500 animate-spin"></div>
                </div>
              ) : nftMetadata[userNfts[currentNftIndex]]?.image ? (
                <div className="relative w-full h-full min-h-[200px]">
                  <Image 
                    src={nftMetadata[userNfts[currentNftIndex]].image}
                    alt={nftMetadata[userNfts[currentNftIndex]].name}
                    fill
                    className="object-contain p-4"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto bg-btb-primary/30 rounded-full flex items-center justify-center mb-2 border border-btb-primary/50">
                      <PhotoIcon className="h-12 w-12 text-btb-primary" />
                      <span className="text-xl font-bold text-btb-primary drop-shadow-sm absolute">#{userNfts[currentNftIndex]}</span>
                    </div>
                    <p className="text-white font-medium drop-shadow-sm">
                      {nftMetadata[userNfts[currentNftIndex]]?.name || `Bear NFT #${userNfts[currentNftIndex]}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {nftMetadata[userNfts[currentNftIndex]]?.description && (
              <div className="mb-4 px-2">
                <p className="text-sm text-gray-200 italic">
                  {nftMetadata[userNfts[currentNftIndex]].description}
                </p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <Button 
                onClick={handlePrevNft} 
                variant="outline" 
                size="icon" 
                className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Button>
              <span className="text-gray-700 dark:text-gray-300 font-medium">{currentNftIndex + 1} of {userNfts.length}</span>
              <Button 
                onClick={handleNextNft} 
                variant="outline" 
                size="icon" 
                className="border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
