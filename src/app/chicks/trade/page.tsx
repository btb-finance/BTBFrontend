'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import chicksService from '../../services/chicksService';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '../../components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { 
  ArrowsRightLeftIcon, 
  ArrowTrendingUpIcon, 
  BanknotesIcon, 
  ClockIcon,
  LockClosedIcon,
  ShieldCheckIcon 
} from '@heroicons/react/24/outline';
import {
  BuyForm,
  SellForm,
  LeverageForm,
  BorrowForm,
  RepayForm,
  ExtendLoanForm,
  LoanInfo
} from './components';

export default function ChicksTradePanel() {
  const { isConnected } = useWallet();
  const [chicksPrice, setChicksPrice] = useState<string>('0');
  const [chicksBalance, setChicksBalance] = useState<string>('0');
  const [usdcBalance, setUsdcBalance] = useState<string>('0');
  const [backing, setBacking] = useState<string>('0');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasLoan, setHasLoan] = useState<boolean>(false);
  const [loanData, setLoanData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isConnected) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Get price and backing data
        const price = await chicksService.getCurrentPrice();
        const backingValue = await chicksService.getBacking();
        
        // Get user balances
        const chicks = await chicksService.getChicksBalance();
        const usdc = await chicksService.getUsdcBalance();
        
        // Get loan information
        const loan = await chicksService.getUserLoan();
        const hasActiveLoan = parseFloat(loan.borrowed) > 0;
        
        setChicksPrice(price);
        setBacking(backingValue);
        setChicksBalance(chicks);
        setUsdcBalance(usdc);
        setHasLoan(hasActiveLoan);
        setLoanData(loan);
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
      const price = await chicksService.getCurrentPrice();
      const backingValue = await chicksService.getBacking();
      
      // Get user balances
      const chicks = await chicksService.getChicksBalance();
      const usdc = await chicksService.getUsdcBalance();
      
      // Get loan information
      const loan = await chicksService.getUserLoan();
      const hasActiveLoan = parseFloat(loan.borrowed) > 0;
      
      setChicksPrice(price);
      setBacking(backingValue);
      setChicksBalance(chicks);
      setUsdcBalance(usdc);
      setHasLoan(hasActiveLoan);
      setLoanData(loan);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">CHICKS Trading</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Buy, sell, leverage, borrow, and manage your CHICKS positions
            </p>
            {isConnected && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
                  <p className="text-xl font-bold">${parseFloat(chicksPrice).toFixed(6)} USDC</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Backing</p>
                  <p className="text-xl font-bold">${parseFloat(backing).toFixed(4)} USDC</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your CHICKS</p>
                  <p className="text-xl font-bold">{parseFloat(chicksBalance).toFixed(4)}</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your USDC</p>
                  <p className="text-xl font-bold">{parseFloat(usdcBalance).toFixed(4)}</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              className="flex items-center gap-2"
              disabled={isLoading}
            >
              <span className={`${isLoading ? 'animate-spin' : ''}`}>⟳</span>
              Refresh
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
                  <TabsList className="grid grid-cols-6 mb-6">
                    <TabsTrigger value="buy" className="flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Buy</span>
                    </TabsTrigger>
                    <TabsTrigger value="sell" className="flex items-center gap-1">
                      <ArrowsRightLeftIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Sell</span>
                    </TabsTrigger>
                    <TabsTrigger value="leverage" className="flex items-center gap-1">
                      <ArrowTrendingUpIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Leverage</span>
                    </TabsTrigger>
                    <TabsTrigger value="borrow" className="flex items-center gap-1">
                      <LockClosedIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Borrow</span>
                    </TabsTrigger>
                    <TabsTrigger value="repay" className="flex items-center gap-1">
                      <ShieldCheckIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Repay</span>
                    </TabsTrigger>
                    <TabsTrigger value="extend" className="flex items-center gap-1">
                      <ClockIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Extend</span>
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="buy">
                    <BuyForm 
                      chicksPrice={chicksPrice}
                      usdcBalance={usdcBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="sell">
                    <SellForm 
                      chicksPrice={chicksPrice}
                      chicksBalance={chicksBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="leverage">
                    <LeverageForm 
                      chicksPrice={chicksPrice}
                      usdcBalance={usdcBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="borrow">
                    <BorrowForm 
                      chicksPrice={chicksPrice}
                      chicksBalance={chicksBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="repay">
                    <RepayForm 
                      hasLoan={hasLoan}
                      loanData={loanData}
                      usdcBalance={usdcBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                  
                  <TabsContent value="extend">
                    <ExtendLoanForm 
                      hasLoan={hasLoan}
                      loanData={loanData}
                      usdcBalance={usdcBalance}
                      onSuccess={handleRefresh}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Loan Information */}
          <div>
            <LoanInfo 
              hasLoan={hasLoan}
              loanData={loanData}
              chicksPrice={chicksPrice}
              onSuccess={handleRefresh}
            />
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>CHICKS Token Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Current Price
                        </td>
                        <td className="px-4 py-3 font-medium">
                          ${parseFloat(chicksPrice).toFixed(6)} USDC
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          USDC Backing
                        </td>
                        <td className="px-4 py-3 font-medium">
                          ${parseFloat(backing).toFixed(2)} USDC
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Buy Fee
                        </td>
                        <td className="px-4 py-3 font-medium">
                          2.5%
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Sell Fee
                        </td>
                        <td className="px-4 py-3 font-medium">
                          2.5%
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                          Leverage Fee
                        </td>
                        <td className="px-4 py-3 font-medium">
                          1.0% + Interest
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
