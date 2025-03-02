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
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { ethers } from 'ethers';
import { aaveService } from '@/app/services/aaveService';

export default function AavePage() {
  const { toast } = useToast();
  const [chainId, setChainId] = useState<string>('1'); // Default to Ethereum
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [marketData, setMarketData] = useState<any>({
    tvl: 0,
    totalLiquidity: 0,
    totalBorrowed: 0,
    depositApy: 0,
    borrowApy: 0
  });
  const [reserves, setReserves] = useState<any[]>([]);
  const [userPosition, setUserPosition] = useState<any>(null);

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

  // Load data
  const loadData = async () => {
    setIsLoading(true);
    
    try {
      // Fetch market data
      console.log('Fetching Aave market data...');
      const marketDataResult = await aaveService.getMarketData();
      console.log('Market data result:', marketDataResult);
      setMarketData(marketDataResult);
      
      // Fetch reserves data
      console.log(`Fetching reserves for chain ${chainId}...`);
      const reservesData = await aaveService.getReservesConfiguration(chainId);
      console.log(`Reserves data (${reservesData.length} items):`, reservesData);
      setReserves(reservesData);
      
      // Fetch user position if wallet is connected
      if (walletAddress) {
        console.log(`Fetching user position for ${walletAddress} on chain ${chainId}...`);
        const userPositionData = await aaveService.getUserPosition(walletAddress, chainId);
        console.log('User position:', userPositionData);
        setUserPosition(userPositionData);
      }
    } catch (error) {
      console.error('Error loading Aave data:', error);
      toast({
        title: 'Data Loading Error',
        description: 'Failed to load Aave data',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Change network
  const changeNetwork = (newChainId: string) => {
    if (chainId !== newChainId) {
      setChainId(newChainId);
    }
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, [chainId]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Supported networks
  const networks = [
    { id: '1', name: 'Ethereum' },
    { id: '10', name: 'Optimism' },
    { id: '42161', name: 'Arbitrum' },
    { id: '8453', name: 'Base' }
  ];

  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-3xl font-bold mb-6">Aave Dashboard</h1>
      
      {/* Network selector */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Select Network</h2>
        <div className="flex flex-wrap gap-2">
          {networks.map(network => (
            <Button
              key={network.id}
              onClick={() => changeNetwork(network.id)}
              variant={chainId === network.id ? "default" : "outline"}
            >
              {network.name}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Wallet connection */}
      <div className="mb-6">
        {!walletAddress ? (
          <Button onClick={connectWallet}>
            Connect Wallet
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm">Connected: {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}</span>
            <Button variant="outline" size="sm" onClick={() => setWalletAddress('')}>
              Disconnect
            </Button>
          </div>
        )}
      </div>
      
      {/* Market Overview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Market Overview</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-secondary/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Value Locked</p>
                <p className="text-2xl font-bold">{formatCurrency(marketData.tvl)}</p>
              </div>
              <div className="bg-secondary/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Supply APY</p>
                <p className="text-2xl font-bold">{formatPercentage(marketData.depositApy)}</p>
              </div>
              <div className="bg-secondary/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Borrow APY</p>
                <p className="text-2xl font-bold">{formatPercentage(marketData.borrowApy)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Available Markets */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4">Available Assets</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : reserves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Asset</th>
                    <th className="text-right py-2">Supply APY</th>
                    <th className="text-right py-2">Borrow APY</th>
                    <th className="text-right py-2">Available Liquidity</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reserves.map((asset, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-3">
                        <div className="flex items-center">
                          <span className="font-medium">{asset.symbol}</span>
                        </div>
                      </td>
                      <td className="text-right py-3">
                        {parseFloat(asset.liquidityRate) > 0 
                          ? `${(parseFloat(asset.liquidityRate) * 100).toFixed(2)}%`
                          : '0.00%'
                        }
                      </td>
                      <td className="text-right py-3">
                        {parseFloat(asset.variableBorrowRate) > 0
                          ? `${(parseFloat(asset.variableBorrowRate) * 100).toFixed(2)}%`
                          : '0.00%'
                        }
                      </td>
                      <td className="text-right py-3">
                        {parseFloat(asset.availableLiquidity) > 0
                          ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format(parseFloat(asset.availableLiquidity))
                          : '$0'
                        }
                      </td>
                      <td className="text-right py-3">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline">
                            <ArrowUpTrayIcon className="h-4 w-4 mr-1" />
                            Supply
                          </Button>
                          {asset.borrowingEnabled && (
                            <Button size="sm" variant="outline">
                              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                              Borrow
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No assets available on this network</p>
          )}
        </CardContent>
      </Card>
      
      {/* User Position */}
      {walletAddress && (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4">Your Position</h2>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : userPosition ? (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-secondary/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Collateral</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(userPosition.totalCollateralETH).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-secondary/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Debt</p>
                    <p className="text-2xl font-bold">
                      ${parseFloat(userPosition.totalDebtETH).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-secondary/20 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Health Factor</p>
                    <p className="text-2xl font-bold">
                      {parseFloat(userPosition.healthFactor) < 1000000
                        ? parseFloat(userPosition.healthFactor).toFixed(2)
                        : '∞'}
                    </p>
                  </div>
                </div>
                
                {userPosition.positions && userPosition.positions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Asset</th>
                          <th className="text-right py-2">Supplied</th>
                          <th className="text-right py-2">Borrowed</th>
                          <th className="text-right py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userPosition.positions.map((position: any, index: number) => (
                          <tr key={index} className="border-b">
                            <td className="py-3">
                              <div className="flex items-center">
                                <span className="font-medium">{position.symbol}</span>
                              </div>
                            </td>
                            <td className="text-right py-3">
                              {position.supplied ? position.supplied : '0'}
                            </td>
                            <td className="text-right py-3">
                              {position.borrowed ? position.borrowed : '0'}
                            </td>
                            <td className="text-right py-3">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline">
                                  <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                                  Withdraw
                                </Button>
                                <Button size="sm" variant="outline">
                                  <BanknotesIcon className="h-4 w-4 mr-1" />
                                  Repay
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">No active positions</p>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Connect your wallet to view your positions</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
