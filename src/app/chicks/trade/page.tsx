'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../context/WalletContext';
import chicksService from '../../services/chicksService';
import openOceanService from '../../services/openOceanService';
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
  ShieldCheckIcon,
  GlobeAltIcon 
} from '@heroicons/react/24/outline';
import {
  BuyForm,
  SellForm,
  LeverageForm,
  BorrowForm,
  RepayForm,
  ExtendLoanForm,
  LoanInfo,
  MarketSwapForm
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
  const [marketPrice, setMarketPrice] = useState<string>('0');
  const [priceDifference, setPriceDifference] = useState<string>('0');
  const [priceDifferencePercentage, setPriceDifferencePercentage] = useState<string>('0');
  const [isLoadingMarketPrice, setIsLoadingMarketPrice] = useState<boolean>(false);

  // Fetch market price and calculate arbitrage opportunity
  const fetchMarketPrice = async (btbPrice: string) => {
    if (!btbPrice || parseFloat(btbPrice) === 0) return;
    
    try {
      setIsLoadingMarketPrice(true);
      const comparison = await openOceanService.getPriceComparison(btbPrice);
      
      setMarketPrice(comparison.openOceanPrice);
      setPriceDifference(comparison.priceDifference);
      setPriceDifferencePercentage(comparison.priceDifferencePercentage);
    } catch (error) {
      console.error('Error fetching market price:', error);
      setMarketPrice('0');
      setPriceDifference('0');
      setPriceDifferencePercentage('0');
    } finally {
      setIsLoadingMarketPrice(false);
    }
  };

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
        
        // Fetch market price after getting BTB price
        await fetchMarketPrice(price);
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
      
      // Refresh market price
      await fetchMarketPrice(price);
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
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">CHICKS Trading</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-2 md:mb-4">
              Buy, sell, leverage, borrow, and manage your CHICKS positions
            </p>
            {isConnected && (
              <>
                {parseFloat(marketPrice) > 0 && parseFloat(priceDifference) !== 0 && (
                  <div className={`p-2 md:p-4 mb-2 rounded-lg text-white text-sm ${parseFloat(priceDifference) > 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-sm md:text-base">Arbitrage Opportunity</h3>
                      <div className="text-xs md:text-sm bg-white bg-opacity-20 px-1.5 py-0.5 rounded">
                        {isLoadingMarketPrice ? 'Updating...' : `${parseFloat(priceDifferencePercentage) > 0 ? '+' : ''}${priceDifferencePercentage}%`}
                      </div>
                    </div>
                    <p className="text-xs md:text-sm mt-0.5 md:mt-1">
                      {parseFloat(priceDifference) > 0 ? (
                        <>Earn <span className="font-bold">${priceDifference}</span>/CHICKS: Buy here at <span className="font-bold">${chicksPrice}</span>, sell on market at <span className="font-bold">${marketPrice}</span></>  
                      ) : (
                        <>Earn <span className="font-bold">${Math.abs(parseFloat(priceDifference)).toFixed(6)}</span>/CHICKS: Buy on market at <span className="font-bold">${marketPrice}</span>, sell here at <span className="font-bold">${chicksPrice}</span></>  
                      )}
                    </p>
                    <div className="mt-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-white bg-opacity-20 hover:bg-opacity-30 border-0 text-white text-xs md:text-sm py-0.5 md:py-1 h-6 md:h-8"
                        onClick={() => {
                          // Find the market tab trigger and click it
                          const marketTab = document.querySelector('button[value="market"]') as HTMLButtonElement;
                          if (marketTab) {
                            marketTab.click();
                          }
                        }}
                      >
                        Go to Market Swap
                      </Button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 md:p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">BTB Price</p>
                      <div className="flex items-center">
                        <p className="text-sm md:text-base font-bold">${parseFloat(chicksPrice).toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 md:p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Market Price</p>
                      <div className="flex items-center">
                        {isLoadingMarketPrice && <span className="text-xs animate-pulse mr-1">⟳</span>}
                        <p className="text-sm md:text-base font-bold">${parseFloat(marketPrice).toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 md:p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Your CHICKS</p>
                      <p className="text-sm md:text-base font-bold">{parseFloat(chicksBalance).toFixed(4)}</p>
                    </div>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 md:p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Your USDC</p>
                      <p className="text-sm md:text-base font-bold">{parseFloat(usdcBalance).toFixed(4)}</p>
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
                  <TabsList className="grid grid-cols-7 mb-6">
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
                    <TabsTrigger value="market" className="flex items-center gap-1">
                      <GlobeAltIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">Market</span>
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
                  
                  <TabsContent value="market">
                    <MarketSwapForm 
                      chicksPrice={chicksPrice}
                      chicksBalance={chicksBalance}
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
