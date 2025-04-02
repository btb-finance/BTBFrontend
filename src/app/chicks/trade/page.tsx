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
        
        // Fetch market price after getting the price
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
                  <div className={`rounded-xl overflow-hidden mb-4 bg-white dark:bg-gray-900 border ${parseFloat(priceDifference) > 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'} shadow-md`}>
                    {/* Header */}
                    <div className={`flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 ${parseFloat(priceDifference) > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                      <h3 className={`font-bold text-sm sm:text-base ${parseFloat(priceDifference) > 0 ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>Arbitrage Alert</h3>
                      <div className={`text-xs sm:text-sm font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${parseFloat(priceDifference) > 0 ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>
                        {isLoadingMarketPrice ? 'Updating...' : `${parseFloat(priceDifferencePercentage) > 0 ? '+' : ''}${priceDifferencePercentage}%`}
                      </div>
                    </div>
                    
                    {/* Visualization */}
                    <div className="px-3 sm:px-4 py-2 sm:py-3">
                      <div className="mb-2 sm:mb-3">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                          <div className="flex items-center">
                            <div className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full ${parseFloat(priceDifference) > 0 ? 'bg-green-500' : 'bg-red-500'} mr-1.5 sm:mr-2`}></div>
                            <span className="text-xs sm:text-sm font-medium">Arbitrage Opportunity</span>
                          </div>
                          <span className={`text-xs sm:text-sm font-bold ${parseFloat(priceDifference) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${parseFloat(priceDifference) > 0 ? priceDifference : Math.abs(parseFloat(priceDifference)).toFixed(6)}/CHICKS
                          </span>
                        </div>
                        
                        {/* Price visualization */}
                        <div className="relative h-32 sm:h-28 my-3 w-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                          {/* Price markers */}
                          <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center">
                            <div className="relative h-1 w-full mx-4 sm:mx-10 bg-gray-300 dark:bg-gray-600">
                              {/* BTB and Market price positions */}
                              {(() => {
                                // Calculate relative positions (for visual purposes)
                                const minPrice = Math.min(parseFloat(chicksPrice), parseFloat(marketPrice)) * 0.998;
                                const maxPrice = Math.max(parseFloat(chicksPrice), parseFloat(marketPrice)) * 1.002;
                                const range = maxPrice - minPrice;
                                
                                // BTB position as percentage
                                const btbPos = ((parseFloat(chicksPrice) - minPrice) / range) * 100;
                                // Market position as percentage
                                const marketPos = ((parseFloat(marketPrice) - minPrice) / range) * 100;
                                
                                // Make sure positions are not too close to edges on mobile
                                const adjustedBtbPos = Math.max(15, Math.min(85, btbPos));
                                const adjustedMarketPos = Math.max(15, Math.min(85, marketPos));
                                
                                // Determine if labels should be stacked (for close values on mobile)
                                const shouldStackLabels = Math.abs(adjustedMarketPos - adjustedBtbPos) < 20;
                                
                                return (
                                  <>
                                    {/* Difference area */}
                                    <div 
                                      className={`absolute top-1/2 h-1 transform -translate-y-1/2 ${parseFloat(priceDifference) > 0 ? 'bg-green-400' : 'bg-red-400'}`}
                                      style={{
                                        left: `${Math.min(adjustedBtbPos, adjustedMarketPos)}%`,
                                        width: `${Math.abs(adjustedMarketPos - adjustedBtbPos)}%`
                                      }}
                                    ></div>
                                    
                                    {/* BTB Price marker */}
                                    <div className="absolute top-0 transform -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${adjustedBtbPos}%` }}>
                                      <div className="relative">
                                        <div className="w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800 shadow-md group-hover:scale-125 transition-transform"></div>
                                        <div 
                                          className={`absolute transform -translate-x-1/2 left-1/2 min-w-max bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-[10px] sm:text-xs font-medium py-0.5 sm:py-1 px-1.5 sm:px-2 rounded shadow-sm group-hover:opacity-100 opacity-90`}
                                          style={{
                                            top: shouldStackLabels && adjustedBtbPos < adjustedMarketPos ? '6px' : '14px'
                                          }}
                                        >
                                          BTB: ${chicksPrice}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Market Price marker */}
                                    <div className="absolute top-0 transform -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${adjustedMarketPos}%` }}>
                                      <div className="relative">
                                        <div className="w-4 sm:w-5 h-4 sm:h-5 rounded-full bg-purple-500 border-2 border-white dark:border-gray-800 shadow-md group-hover:scale-125 transition-transform"></div>
                                        <div 
                                          className={`absolute transform -translate-x-1/2 left-1/2 min-w-max bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-[10px] sm:text-xs font-medium py-0.5 sm:py-1 px-1.5 sm:px-2 rounded shadow-sm group-hover:opacity-100 opacity-90`}
                                          style={{
                                            top: shouldStackLabels && adjustedBtbPos < adjustedMarketPos ? '23px' : '14px'
                                          }}
                                        >
                                          Market: ${marketPrice}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Difference label */}
                                    <div 
                                      className="absolute -bottom-1 transform -translate-x-1/2 -translate-y-full text-center"
                                      style={{ left: `${(Math.min(adjustedBtbPos, adjustedMarketPos) + Math.abs(adjustedMarketPos - adjustedBtbPos)/2)}%` }}
                                    >
                                      <div className={`text-[10px] sm:text-xs py-0.5 px-1.5 rounded ${parseFloat(priceDifference) > 0 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'} font-medium`}>
                                        Δ ${Math.abs(parseFloat(priceDifference)).toFixed(6)}
                                      </div>
                                    </div>
                                  </>
                                );
                              })()}
                              
                              {/* Arrow indicating direction - moved down for more space */}
                              <div className="absolute -bottom-12 sm:-bottom-8 left-0 right-0 flex items-center justify-center">
                                <div className={`flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium ${parseFloat(priceDifference) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {parseFloat(priceDifference) > 0 ? (
                                    <>
                                      <span>Buy on BTB</span>
                                      <svg className="h-3 w-4 sm:w-6 rotate-90 sm:rotate-0" viewBox="0 0 24 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M1 3H23M23 3L20 1M23 3L20 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                      </svg>
                                      <span>Sell on Market</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>Buy on Market</span>
                                      <svg className="h-3 w-4 sm:w-6 rotate-90 sm:rotate-0" viewBox="0 0 24 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M23 3H1M1 3L4 1M1 3L4 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                      </svg>
                                      <span>Sell on BTB</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Action steps */}
                        <div className={`rounded-lg text-xs sm:text-sm overflow-hidden border ${parseFloat(priceDifference) > 0 ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}`}>
                          <div className={`font-medium py-1.5 sm:py-2 px-3 ${parseFloat(priceDifference) > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'}`}>
                            How to capture this arbitrage:
                          </div>
                          
                          <div className="p-2 sm:p-3 bg-white dark:bg-gray-900">
                            <div className="flex flex-col space-y-2">
                              {parseFloat(priceDifference) > 0 ? (
                                <>
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-green-800 dark:text-green-300 font-bold text-[10px] sm:text-xs">1</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">Buy CHICKS on BTB</p>
                                      <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs mt-0.5">Price: <span className="font-semibold">${chicksPrice}</span> per CHICKS</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-green-800 dark:text-green-300 font-bold text-[10px] sm:text-xs">2</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">Sell CHICKS on Market</p>
                                      <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs mt-0.5">Price: <span className="font-semibold">${marketPrice}</span> per CHICKS</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-green-800 dark:text-green-300 font-bold text-[10px] sm:text-xs">3</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">Profit per CHICKS</p>
                                      <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs mt-0.5">
                                        <span className="font-semibold text-green-600 dark:text-green-400">${priceDifference}</span> 
                                        (<span className="font-semibold text-green-600 dark:text-green-400">+{priceDifferencePercentage}%</span>)
                                      </p>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-red-800 dark:text-red-300 font-bold text-[10px] sm:text-xs">1</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">Buy CHICKS on Market</p>
                                      <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs mt-0.5">Price: <span className="font-semibold">${marketPrice}</span> per CHICKS</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-red-800 dark:text-red-300 font-bold text-[10px] sm:text-xs">2</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">Sell CHICKS on BTB</p>
                                      <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs mt-0.5">Price: <span className="font-semibold">${chicksPrice}</span> per CHICKS</p>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-start">
                                    <div className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mr-2 mt-0.5">
                                      <span className="text-red-800 dark:text-red-300 font-bold text-[10px] sm:text-xs">3</span>
                                    </div>
                                    <div>
                                      <p className="font-medium text-xs sm:text-sm">Profit per CHICKS</p>
                                      <p className="text-gray-600 dark:text-gray-400 text-[10px] sm:text-xs mt-0.5">
                                        <span className="font-semibold text-red-600 dark:text-red-400">${Math.abs(parseFloat(priceDifference)).toFixed(6)}</span> 
                                        (<span className="font-semibold text-red-600 dark:text-red-400">{priceDifferencePercentage}%</span>)
                                      </p>
                                    </div>
                                  </div>
                                </>
                              )}
                              
                              {/* Calculator result for 10,000 CHICKS */}
                              <div className={`mt-1 p-1.5 sm:p-2 rounded text-[10px] sm:text-xs ${parseFloat(priceDifference) > 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-red-50 dark:bg-red-900/10'}`}>
                                <p className="font-medium">
                                  Example: Trading 10,000 CHICKS = <span className="font-bold">${(Math.abs(parseFloat(priceDifference)) * 10000).toFixed(2)}</span> profit
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-2 sm:mt-3">
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-blue-500"></span>
                        </span>
                        CHICKS Price
                      </p>
                      <div className="flex items-center">
                        <p className="text-xs sm:text-sm md:text-base font-bold">${parseFloat(chicksPrice).toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-purple-500"></span>
                        </span>
                        Market Price
                      </p>
                      <div className="flex items-center">
                        {isLoadingMarketPrice && (
                          <span className="text-[10px] mr-1">
                            <svg className="animate-spin h-2.5 w-2.5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </span>
                        )}
                        <p className="text-xs sm:text-sm md:text-base font-bold">${parseFloat(marketPrice).toFixed(6)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-green-500"></span>
                        </span>
                        Your CHICKS
                      </p>
                      <p className="text-xs sm:text-sm md:text-base font-bold">{parseFloat(chicksBalance).toFixed(4)}</p>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-white/10 to-white/5 dark:from-gray-800/80 dark:to-gray-900/80 backdrop-blur-md p-2 sm:p-3 rounded-lg sm:rounded-xl border border-white/20 dark:border-gray-700/70 shadow-sm">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] sm:text-xs md:text-sm text-gray-700 dark:text-gray-300 flex items-center">
                        <span className="flex h-4 sm:h-5 w-4 sm:w-5 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 mr-1 sm:mr-1.5">
                          <span className="h-1.5 sm:h-2 w-1.5 sm:w-2 rounded-full bg-yellow-500"></span>
                        </span>
                        Your USDC
                      </p>
                      <p className="text-xs sm:text-sm md:text-base font-bold">{parseFloat(usdcBalance).toFixed(4)}</p>
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
