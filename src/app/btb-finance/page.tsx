'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../context/WalletContext';
import btbFinanceService from './services/btbFinanceService';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { 
  ArrowsRightLeftIcon, 
  BanknotesIcon
} from '@heroicons/react/24/outline';
import {
  BuyForm,
  SellForm,
  LoopForm,
  BorrowForm,
  LoanManager
} from './components/trade';

export default function BTBFinanceTradePanel() {
  const { isConnected } = useWallet();
  const [btbPrice, setBtbPrice] = useState<string>('0');
  const [btbBalance, setBtbBalance] = useState<string>('0');
  const [ethBalance, setEthBalance] = useState<string>('0');
  const [backing, setBacking] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Remove loan-related state for now
  const [totalBorrowed, setTotalBorrowed] = useState<string>('0');
  const [totalCollateral, setTotalCollateral] = useState<string>('0');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Always fetch price and backing data regardless of connection status
        const price = await btbFinanceService.getCurrentPrice();
        const backingValue = await btbFinanceService.getBacking();
        const borrowed = await btbFinanceService.getTotalBorrowed();
        const collateral = await btbFinanceService.getTotalCollateral();
        
        setBtbPrice(price);
        setBacking(backingValue);
        setTotalBorrowed(borrowed);
        setTotalCollateral(collateral);
        
        // Only fetch user-specific data if connected
        if (isConnected) {
          // Get user balances
          const btb = await btbFinanceService.getBTBBalance();
          
          // Get ETH balance
          if (window.ethereum) {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            const ethBal = await provider.getBalance(address);
            const ethFormatted = ethers.utils.formatEther(ethBal);
            setEthBalance(ethFormatted);
          }
          
          setBtbBalance(btb);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Set up interval to refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => clearInterval(interval);
  }, [isConnected]);

  const handleRefresh = async () => {
    if (!isConnected) return;
    
    try {
      setIsLoading(true);
      
      // Get price and backing data
      const price = await btbFinanceService.getCurrentPrice();
      const backingValue = await btbFinanceService.getBacking();
      const borrowed = await btbFinanceService.getTotalBorrowed();
      const collateral = await btbFinanceService.getTotalCollateral();
      
      // Get user balances
      const btb = await btbFinanceService.getBTBBalance();
      
      // Get ETH balance
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const ethBal = await provider.getBalance(address);
        const ethFormatted = ethers.utils.formatEther(ethBal);
        setEthBalance(ethFormatted);
      }
      
      setBtbPrice(price);
      setBacking(backingValue);
      setTotalBorrowed(borrowed);
      setTotalCollateral(collateral);
      setBtbBalance(btb);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">BTB DeFi Trading</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-2 md:mb-4">
              Advanced DeFi operations for BTB tokens: borrow, leverage, flash loans, and more
            </p>
            {isConnected && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-3">
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-blue-500"></span>
                        </span>
                        BTB Price
                      </p>
                      <div className="flex items-center">
                        <p className="text-xs sm:text-sm md:text-base font-bold">{parseFloat(btbPrice).toFixed(12)} ETH</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-green-500"></span>
                        </span>
                        Your BTB
                      </p>
                      <p className="text-xs sm:text-sm md:text-base font-bold">{parseFloat(btbBalance).toFixed(4)}</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-yellow-500"></span>
                        </span>
                        Your ETH
                      </p>
                      <p className="text-xs sm:text-sm md:text-base font-bold">{parseFloat(ethBalance).toFixed(4)}</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-purple-500"></span>
                        </span>
                        ETH Backing
                      </p>
                      <p className="text-xs sm:text-sm md:text-base font-bold">{parseFloat(backing).toFixed(4)} ETH</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/60 dark:to-gray-900/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 text-gray-800 dark:text-gray-200 hover:bg-white/20 dark:hover:bg-gray-700/40 shadow-sm flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              disabled={isLoading}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-4 w-4 transition-transform ${isLoading ? 'animate-spin' : 'group-hover:rotate-180'}`} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
              </svg>
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </Button>
          </div>
        </div>
        
        {/* Main Trading Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Trading Forms */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <Tabs defaultValue="buy" className="w-full">
                  <TabsList className="grid grid-cols-5 mb-6">
                    <TabsTrigger value="buy" className="flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4" />
                      <span>Buy BTB</span>
                    </TabsTrigger>
                    <TabsTrigger value="sell" className="flex items-center gap-1">
                      <ArrowsRightLeftIcon className="h-4 w-4" />
                      <span>Sell BTB</span>
                    </TabsTrigger>
                    <TabsTrigger value="loop" className="flex items-center gap-1">
                      <ArrowsRightLeftIcon className="h-4 w-4" />
                      <span>Loop</span>
                    </TabsTrigger>
                    <TabsTrigger value="borrow" className="flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4" />
                      <span>Borrow</span>
                    </TabsTrigger>
                    <TabsTrigger value="manage" className="flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4" />
                      <span>Manage</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="buy">
                    <BuyForm 
                      btbPrice={btbPrice}
                      ethBalance={ethBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="sell">
                    <SellForm 
                      btbPrice={btbPrice}
                      btbBalance={btbBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="loop">
                    <LoopForm 
                      ethBalance={ethBalance}
                      btbBalance={btbBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="borrow">
                    <BorrowForm 
                      btbBalance={btbBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="manage">
                    <LoanManager 
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Protocol Info */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Protocol Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          BTB Price
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {parseFloat(btbPrice).toFixed(12)} ETH
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Protocol Backing
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {parseFloat(backing).toFixed(4)} ETH
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Total Borrowed
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {parseFloat(totalBorrowed).toFixed(4)} ETH
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Total Collateral
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {parseFloat(totalCollateral).toFixed(4)} BTB
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
