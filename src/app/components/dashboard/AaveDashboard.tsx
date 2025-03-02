'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import { useToast } from '@/app/components/ui/use-toast';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { aaveService } from '@/app/services/aaveService';
import { AavePositions } from '@/app/components/dashboard/AavePositions';
import { AaveMarkets } from '@/app/components/dashboard/AaveMarkets';
import { AaveTransactionModal } from '@/app/components/dashboard/AaveTransactionModal';
import AaveMarketOverview from '@/app/components/dashboard/AaveMarketOverview'; 
import { CHAINS } from '@/app/constants/chains';
import { ethers } from 'ethers';

interface Asset {
  tokenAddress: string;
  symbol: string;
  name: string;
  liquidityRate: string;
  variableBorrowRate: string;
  stableBorrowRate: string;
  availableLiquidity: string;
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  ltv: string;
  priceInEth: string;
  formattedLiquidityRate?: string;
  formattedVariableBorrowRate?: string;
  currentATokenBalance?: string;
  currentVariableDebt?: string;
  currentStableDebt?: string;
  formattedSupplied?: string;
  formattedBorrowed?: string;
}

interface UserPosition {
  totalCollateralBase: string;
  totalDebtBase: string;
  availableBorrowsBase: string;
  currentLiquidationThreshold: string;
  ltv: string;
  healthFactor: string;
  reserves: Asset[];
}

export default function AaveDashboard() {
  const { toast } = useToast();
  const [chainId, setChainId] = useState<string>('1'); // Default to Ethereum
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [userPositions, setUserPositions] = useState<UserPosition | null>(null);
  const [marketData, setMarketData] = useState<any>({ tvl: 0, totalLiquidity: 0, totalBorrowed: 0, depositApy: 0, borrowApy: 0 });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'supply' | 'withdraw' | 'borrow' | 'repay'>('supply');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Utility function for capitalizing first letter
  const capitalizeFirstLetter = (string: string): string => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setWalletAddress(address);
        
        // Get current chain
        const network = await provider.getNetwork();
        setChainId(network.chainId.toString());
        
        return address;
      } else {
        toast({
          title: 'Wallet not found',
          description: 'Please install MetaMask or another Ethereum wallet',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to your wallet',
        variant: 'destructive'
      });
    }
  };

  // Change network
  const changeNetwork = async (newChainId: string) => {
    try {
      if (newChainId !== chainId) {
        setChainId(newChainId);
        await loadAaveData(walletAddress, newChainId);
      }
    } catch (error) {
      console.error('Error changing network:', error);
      toast({
        title: 'Network Change Error',
        description: 'Failed to switch networks',
        variant: 'destructive'
      });
    }
  };

  // Load Aave data
  const loadAaveData = async (address: string, chain: string) => {
    console.log(`Loading Aave data for address ${address} on chain ${chain}`);
    if (!address) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    let hasErrors = false;
    
    try {
      // Fetch market data first
      try {
        console.log('Fetching market data...');
        const marketDataResult = await aaveService.getMarketData();
        console.log('Market data received:', marketDataResult);
        if (marketDataResult) {
          setMarketData(marketDataResult);
        } else {
          // Set default market data if API fails
          setMarketData({
            tvl: 0,
            totalLiquidity: 0,
            totalBorrowed: 0,
            depositApy: 0,
            borrowApy: 0
          });
          hasErrors = true;
        }
      } catch (marketError) {
        console.error('Error fetching market data:', marketError);
        // Set default market data if API fails
        setMarketData({
          tvl: 0,
          totalLiquidity: 0,
          totalBorrowed: 0,
          depositApy: 0,
          borrowApy: 0
        });
        hasErrors = true;
      }
    
      console.log('Fetching reserves configuration...');
      // Get reserves configuration with real data
      let reserves;
      try {
        reserves = await aaveService.getReservesConfiguration(chain);
        console.log(`Received ${reserves.length} reserves from Aave service`);
        if (reserves && reserves.length > 0) {
          setAssets(reserves);
        } else {
          hasErrors = true;
        }
      } catch (reservesError) {
        console.error('Error fetching reserves configuration:', reservesError);
        hasErrors = true;
        reserves = [];
      }
      
      // Get user account data if connected
      if (address) {
        try {
          console.log('Fetching user position data...');
          // Get user position data from the aaveService
          const userPositionData = await aaveService.getUserPosition(address, chain);
          console.log('User position data received:', userPositionData);
          
          if (userPositionData) {
            // Our updated AaveService now returns positions directly
            // Format data for the component
            const userPosition: UserPosition = {
              totalCollateralBase: userPositionData.totalCollateralETH || '0',
              totalDebtBase: userPositionData.totalDebtETH || '0',
              availableBorrowsBase: userPositionData.availableBorrowsETH || '0',
              currentLiquidationThreshold: userPositionData.currentLiquidationThreshold || '0',
              ltv: userPositionData.ltv || '0',
              healthFactor: userPositionData.healthFactor || '99',
              reserves: []
            };
            
            // Use positions data from the improved service
            if (userPositionData.positions && userPositionData.positions.length > 0) {
              console.log(`User has ${userPositionData.positions.length} active positions`);              
              // Map positions to the expected format
              const mappedReserves = userPositionData.positions.map((position: any) => {
                // Find the matching asset from reserves
                const matchingAsset = reserves.find((asset: any) => 
                  asset.tokenAddress?.toLowerCase() === position.tokenAddress?.toLowerCase()
                ) || {};
                
                return {
                  ...matchingAsset,
                  symbol: position.tokenSymbol || matchingAsset.symbol || 'Unknown',
                  currentATokenBalance: position.scaledATokenBalance || '0',
                  currentVariableDebt: position.scaledVariableDebt || '0',
                  currentStableDebt: position.principalStableDebt || '0',
                  formattedSupplied: position.supplied || '0',
                  formattedBorrowed: position.borrowed || '0'
                };
              });
              
              userPosition.reserves = mappedReserves;
            } else if (reserves && reserves.length > 0) {
              // Create empty reserve entries for display when user has no positions
              userPosition.reserves = reserves.slice(0, 10).map((asset: any) => ({
                ...asset,
                currentATokenBalance: '0',
                currentVariableDebt: '0',
                currentStableDebt: '0',
                formattedSupplied: '$0',
                formattedBorrowed: '$0'
              }));
            }
            
            setUserPositions(userPosition);
            console.log('User positions set successfully');
          } else {
            // Create empty user position object when API returns null
            console.log('No user position data received, creating empty position object');
            const emptyUserPosition: UserPosition = {
              totalCollateralBase: '0',
              totalDebtBase: '0',
              availableBorrowsBase: '0',
              currentLiquidationThreshold: '0',
              ltv: '0',
              healthFactor: '99',
              reserves: reserves && reserves.length > 0 ? reserves.slice(0, 10).map((asset: any) => ({
                ...asset,
                currentATokenBalance: '0',
                currentVariableDebt: '0',
                currentStableDebt: '0',
                formattedSupplied: '$0',
                formattedBorrowed: '$0'
              })) : []
            };
            setUserPositions(emptyUserPosition);
            hasErrors = true;
          }
        } catch (error) {
          console.error('Error getting user account data:', error);
          // Create empty user position object when API errors out
          const emptyUserPosition: UserPosition = {
            totalCollateralBase: '0',
            totalDebtBase: '0',
            availableBorrowsBase: '0',
            currentLiquidationThreshold: '0',
            ltv: '0',
            healthFactor: '99',
            reserves: reserves && reserves.length > 0 ? reserves.slice(0, 10).map((asset: any) => ({
              ...asset,
              currentATokenBalance: '0',
              currentVariableDebt: '0',
              currentStableDebt: '0',
              formattedSupplied: '$0',
              formattedBorrowed: '$0'
            })) : []
          };
          setUserPositions(emptyUserPosition);
          
          if (hasErrors) {
            toast({
              title: 'API Issues',
              description: 'Some data could not be loaded from Aave API. You may see partial information.',
              variant: 'destructive'
            });
          }
        }
      } else {
        setUserPositions(null);
      }
    } catch (error) {
      console.error('Error loading Aave data:', error);
      toast({
        title: 'API Error',
        description: 'Failed to load data from Aave API. Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  type TransactionType = 'supply' | 'withdraw' | 'borrow' | 'repay';

  // Function to handle opening the transaction modal
  const openTransactionModal = (type: TransactionType, selectedAsset: Partial<Asset>) => {
    // Ensure we have all required properties by fetching complete asset data
    const fullAsset = assets.find(a => a.tokenAddress === selectedAsset.tokenAddress);
    
    if (!fullAsset) {
      console.error('Selected asset not found in assets list:', selectedAsset);
      toast({
        variant: "destructive",
        title: "Asset Not Found",
        description: `Unable to find complete data for ${selectedAsset.symbol || 'selected asset'}`,
        duration: 5000,
      });
      return;
    }
    
    setModalType(type);
    setSelectedAsset(fullAsset);
    setModalOpen(true);
  };

  // Handle transaction submission
  const handleTransaction = async (type: string, asset: Asset, amount: string) => {
    try {
      setIsLoading(true);
      let result;
      
      switch (type) {
        case 'supply':
          result = await aaveService.supplyAsset(walletAddress, chainId, asset.tokenAddress, amount);
          break;
        case 'withdraw':
          result = await aaveService.withdrawAsset(walletAddress, chainId, asset.tokenAddress, amount);
          break;
        case 'borrow':
          result = await aaveService.borrowAsset(walletAddress, chainId, asset.tokenAddress, amount);
          break;
        case 'repay':
          result = await aaveService.repayLoan(walletAddress, chainId, asset.tokenAddress, amount);
          break;
      }
      
      toast({
        title: 'Transaction Successful',
        description: `Your ${type} transaction was processed successfully!`,
        variant: 'default'
      });
      
      // Reload data
      await loadAaveData(walletAddress, chainId);
      
    } catch (error) {
      console.error(`Error during ${type} transaction:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        variant: "destructive",
        title: `${capitalizeFirstLetter(type)} Failed`,
        description: errorMessage || `Failed to ${type} asset`,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
      setModalOpen(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      // Check if wallet address is already in localStorage
      const savedAddress = localStorage.getItem('walletAddress');
      
      if (savedAddress) {
        setWalletAddress(savedAddress);
        try {
          // Try to load data with the saved address
          await loadAaveData(savedAddress, chainId);
        } catch (error) {
          console.error('Error loading data with saved address:', error);
          setIsLoading(false);
        }
      } else {
        // Only try to connect wallet if not already connected
        const address = await connectWallet();
        if (address) {
          await loadAaveData(address, chainId);
        } else {
          setIsLoading(false);
        }
      }
    };
    
    init();
  }, []);

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Aave Lending Dashboard</h1>
        
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm">Network:</span>
            <select 
              value={chainId}
              onChange={(e) => changeNetwork(e.target.value)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md px-3 py-1 text-sm"
            >
              {Object.entries(CHAINS).map(([key, chain]) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>
          
          {walletAddress ? (
            <Button variant="outline" className="flex items-center space-x-2">
              <CreditCardIcon className="h-4 w-4" />
              <span>{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
            </Button>
          ) : (
            <Button onClick={connectWallet}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : !walletAddress ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex flex-col items-center justify-center">
              <CreditCardIcon className="h-16 w-16 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                Connect your wallet to view your Aave positions and interact with the protocol.
              </p>
              <Button onClick={connectWallet}>Connect Wallet</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <AaveMarketOverview marketData={marketData} />
          
          <Tabs defaultValue="positions">
            <TabsList className="mb-6">
              <TabsTrigger value="positions">Your Positions</TabsTrigger>
              <TabsTrigger value="markets">All Markets</TabsTrigger>
            </TabsList>
            
            <TabsContent value="positions">
              <AavePositions 
                userPositions={userPositions} 
                onSupply={(asset) => openTransactionModal('supply', asset)}
                onWithdraw={(asset) => openTransactionModal('withdraw', asset)}
                onBorrow={(asset) => openTransactionModal('borrow', asset)}
                onRepay={(asset) => openTransactionModal('repay', asset)}
              />
            </TabsContent>
            
            <TabsContent value="markets">
              <AaveMarkets 
                assets={assets}
                onSupply={(asset) => openTransactionModal('supply', asset)}
                onBorrow={(asset) => openTransactionModal('borrow', asset)}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
      
      {modalOpen && selectedAsset && (
        <AaveTransactionModal
          type={modalType}
          asset={selectedAsset}
          onClose={() => setModalOpen(false)}
          onSubmit={(amount) => handleTransaction(modalType, selectedAsset, amount)}
          userPositions={userPositions}
          chainId={chainId}
        />
      )}
    </div>
  );
}
