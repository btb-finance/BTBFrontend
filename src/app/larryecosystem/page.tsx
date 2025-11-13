'use client';

import React, { useState, useEffect } from 'react';
import { useWalletConnection } from '../hooks/useWalletConnection';
import { Alert } from '../components/ui/alert';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { 
  ChartBarIcon, 
  LockIcon, 
  ArrowRightLeftIcon, 
  TrendingUpIcon, 
  ShieldIcon, 
  WalletIcon, 
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  InfoIcon,
  CoinsIcon,
  CreditCardIcon,
  ArrowUpDownIcon,
  DollarSignIcon,
  AlertCircleIcon
} from 'lucide-react';
import larryService from '../services/larryService';
import { formatNumber } from '../utils/formatNumber';

export default function LarryEcosystemPage() {
  const { isConnected, address } = useWalletConnection();
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Form states
  const [ethAmount, setEthAmount] = useState('');
  const [larryAmount, setLarryAmount] = useState('');
  const [leverageEthAmount, setLeverageEthAmount] = useState('');
  const [leverageDays, setLeverageDays] = useState('30');
  const [borrowEthAmount, setBorrowEthAmount] = useState('');
  const [borrowDays, setBorrowDays] = useState('365');
  const [borrowQuote, setBorrowQuote] = useState<any>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [flashCloseQuote, setFlashCloseQuote] = useState<any>(null);
  
  // Real contract data
  const [larryStats, setLarryStats] = useState({
    larryPrice: '0',
    totalSupply: '0',
    backing: '0',
    userLarryBalance: '0',
    userEthBalance: '0',
    totalBorrowed: '0',
    totalCollateral: '0',
    buyFee: '0',
    sellFee: '0'
  });

  // Quotes from contract
  const [buyQuote, setBuyQuote] = useState<any>(null);
  const [sellQuote, setSellQuote] = useState<any>(null);
  const [leverageQuote, setLeverageQuote] = useState<any>(null);
  
  // User loan data
  const [userLoan, setUserLoan] = useState({
    collateral: '0',
    borrowed: '0',
    endDate: '0',
    numberOfDays: '0'
  });

  // Check if we're on Base network (chainId 8453)
  useEffect(() => {
    const checkNetwork = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
          setIsCorrectNetwork(chainId === '0x2105'); // 0x2105 is Base network
        } catch (error) {
          console.error('Error checking network:', error);
        }
      }
    };
    
    checkNetwork();

    // Listen for network changes
    if ((window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', checkNetwork);
    }

    return () => {
      if ((window as any).ethereum) {
        (window as any).ethereum.removeListener('chainChanged', checkNetwork);
      }
    };
  }, []);

  // Fetch real contract data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setRefreshing(true);
        
        // Get price and metrics
        const [price, metrics, contractStatus] = await Promise.all([
          larryService.getCurrentPrice(),
          larryService.getTokenMetrics(),
          larryService.getContractStatus()
        ]);

        // Get user-specific data if connected
        let userBalance = '0';
        let ethBalance = '0';
        let loan = { collateral: '0', borrowed: '0', endDate: '0', numberOfDays: '0' };
        
        if (isConnected && address) {
          [userBalance, loan] = await Promise.all([
            larryService.getUserBalance(address),
            larryService.getUserLoan(address)
          ]);
          
          // Get ETH balance
          if ((window as any).ethereum) {
            const balance = await (window as any).ethereum.request({
              method: 'eth_getBalance',
              params: [address, 'latest']
            });
            ethBalance = (parseInt(balance, 16) / 1e18).toFixed(4);
          }
        }

        setLarryStats({
          larryPrice: price,
          totalSupply: metrics.totalSupply,
          backing: metrics.backing,
          userLarryBalance: userBalance,
          userEthBalance: ethBalance,
          totalBorrowed: contractStatus.totalBorrowed,
          totalCollateral: contractStatus.totalCollateral,
          buyFee: contractStatus.buyFee,
          sellFee: contractStatus.sellFee
        });

        setUserLoan(loan);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to fetch contract data');
      } finally {
        setRefreshing(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [isConnected, address]);

  // Get buy quote
  useEffect(() => {
    const getQuote = async () => {
      if (!ethAmount || isNaN(Number(ethAmount))) {
        setBuyQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteBuy(ethAmount);
        setBuyQuote(quote);
      } catch (error) {
        console.error('Error getting buy quote:', error);
        setBuyQuote(null);
      }
    };
    getQuote();
  }, [ethAmount]);

  // Get sell quote
  useEffect(() => {
    const getQuote = async () => {
      if (!larryAmount || isNaN(Number(larryAmount))) {
        setSellQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteSell(larryAmount);
        setSellQuote(quote);
      } catch (error) {
        console.error('Error getting sell quote:', error);
        setSellQuote(null);
      }
    };
    getQuote();
  }, [larryAmount]);

  // Get leverage quote
  useEffect(() => {
    const getQuote = async () => {
      if (!leverageEthAmount || isNaN(Number(leverageEthAmount))) {
        setLeverageQuote(null);
        return;
      }
      
      try {
        // User enters the fee amount they want to pay
        // We need to calculate the position size that would result in this fee
        const targetFeeAmount = parseFloat(leverageEthAmount);
        const days = parseInt(leverageDays);
        
        // Smart contract values (from the contract code you provided)
        const buy_fee_leverage = 100; // 1% from contract (buy_fee_leverage = 100)
        const base_interest = 0.001; // 0.1% base fee
        const annual_rate = 0.039; // 3.9% annual rate
        
        // Calculate the total fee rate more precisely
        const leverage_fee_rate = buy_fee_leverage / 10000; // 1% = 0.01
        const daily_interest_rate = annual_rate / 365; // Daily rate
        const total_interest_rate = (daily_interest_rate * days) + base_interest;
        const total_fee_rate = leverage_fee_rate + total_interest_rate;
        
        // Calculate position size from target fee: positionSize = targetFee / feeRate
        const calculatedPositionSize = targetFeeAmount / total_fee_rate;
        
        console.log('Fee calculation:', {
          targetFeeAmount,
          days,
          leverage_fee_rate,
          total_interest_rate,
          total_fee_rate,
          calculatedPositionSize
        });
        
        // Now get the actual quote for this calculated position size
        const quote = await larryService.quoteLeverage(calculatedPositionSize.toString(), leverageDays);
        
                 if (quote) {
           // Calculate total ETH needed (from smart contract logic)
           // totalFee = ETHFee + overCollateralizationAmount (1% of position)
           const overCollateralizationAmount = calculatedPositionSize * 0.01; // 1% of position
           const totalEthNeeded = parseFloat(quote.totalFee) + overCollateralizationAmount;
           
           // Add our calculated values to the quote
           const enhancedQuote = {
             ...quote,
             calculatedPositionSize: calculatedPositionSize.toString(),
             targetFeeAmount: targetFeeAmount.toString(),
             actualFeeUsed: quote.totalFee,
             leverageMultiplier: calculatedPositionSize / targetFeeAmount,
             feeAccuracy: Math.abs(parseFloat(quote.totalFee) - targetFeeAmount),
             isCloseMatch: Math.abs(parseFloat(quote.totalFee) - targetFeeAmount) < targetFeeAmount * 0.1,
             overCollateralizationAmount: overCollateralizationAmount.toString(),
             totalEthNeeded: totalEthNeeded.toString(),
             hasEnoughBalance: parseFloat(larryStats.userEthBalance) >= totalEthNeeded
           };
           
           setLeverageQuote(enhancedQuote);
         } else {
           setLeverageQuote(null);
         }
      } catch (error) {
        console.error('Error getting leverage quote:', error);
        setLeverageQuote(null);
      }
    };
    getQuote();
  }, [leverageEthAmount, leverageDays]);

  // Get borrow quote
  useEffect(() => {
    const getQuote = async () => {
      if (!borrowEthAmount || isNaN(Number(borrowEthAmount))) {
        setBorrowQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteBorrow(borrowEthAmount, borrowDays);
        setBorrowQuote(quote);
      } catch (error) {
        console.error('Error getting borrow quote:', error);
        setBorrowQuote(null);
      }
    };
    getQuote();
  }, [borrowEthAmount, borrowDays]);

  // Get flash close quote
  useEffect(() => {
    const getQuote = async () => {
      if (!isConnected || !address || parseFloat(userLoan.collateral) === 0) {
        setFlashCloseQuote(null);
        return;
      }
      
      try {
        const quote = await larryService.quoteFlashClose(address);
        setFlashCloseQuote(quote);
      } catch (error) {
        console.error('Error getting flash close quote:', error);
        setFlashCloseQuote(null);
      }
    };
    getQuote();
  }, [isConnected, address, userLoan.collateral, userLoan.borrowed]);

  const connectWallet = async () => {
    setLoading(true);
    setError('');
    try {
      if (!(window as any).ethereum) {
        setError('Please install MetaMask to use this feature');
        return;
      }

      await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
      setSuccess('Wallet connected successfully!');
    } catch (error: any) {
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    // Trigger data refresh
    window.location.reload();
  };

  const executeBuy = async () => {
    if (!isConnected || !ethAmount) return;
    
    setLoading(true);
    setError('');
    try {
      const tx = await larryService.buyTokens(ethAmount);
      setSuccess('LARRY tokens purchased successfully!');
      setEthAmount('');
      setBuyQuote(null);
    } catch (error: any) {
      setError(error.message || 'Failed to buy LARRY tokens');
    } finally {
      setLoading(false);
    }
  };

  const executeSell = async () => {
    if (!isConnected || !larryAmount) return;
    
    setLoading(true);
    setError('');
    try {
      const tx = await larryService.sellTokens(larryAmount);
      setSuccess('LARRY tokens sold successfully!');
      setLarryAmount('');
      setSellQuote(null);
    } catch (error: any) {
      setError(error.message || 'Failed to sell LARRY tokens');
    } finally {
      setLoading(false);
    }
  };

  const executeLeverage = async () => {
    if (!isConnected || !leverageEthAmount || !leverageQuote) return;
    
    setLoading(true);
    setError('');
    try {
      // Use the calculated position size, not the fee amount entered by user
      const positionSize = leverageQuote.calculatedPositionSize || leverageQuote.ethPosition;
      const tx = await larryService.leverage(positionSize, leverageDays);
      setSuccess(`Leverage position opened! Paid ${leverageEthAmount} ETH fee for ${parseFloat(positionSize).toFixed(4)} ETH position.`);
      setLeverageEthAmount('');
      setLeverageQuote(null);
    } catch (error: any) {
      setError(error.message || 'Failed to open leverage position');
    } finally {
      setLoading(false);
    }
  };

  const executeBorrow = async () => {
    if (!isConnected || !borrowEthAmount) return;
    
    setLoading(true);
    setError('');
    try {
      // Check if user already has a loan
      const hasExistingLoan = parseFloat(userLoan.collateral) > 0 || parseFloat(userLoan.borrowed) > 0;
      
      if (hasExistingLoan) {
        // Borrow more on existing loan
        const tx = await larryService.borrowMore(borrowEthAmount);
        setSuccess(`Borrowed more successfully! Added ${borrowEthAmount} ETH to your existing loan.`);
      } else {
        // Create new loan
        const tx = await larryService.borrow(borrowEthAmount, borrowDays);
        setSuccess('New loan created successfully!');
      }
      
      setBorrowEthAmount('');
      setBorrowQuote(null);
      await refreshData(); // Refresh loan data
    } catch (error: any) {
      setError(error.message || 'Failed to process loan');
    } finally {
      setLoading(false);
    }
  };

  const repayLoan = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    setError('');
    try {
      // If repayAmount is empty or 0, repay full amount, otherwise repay specific amount
      const amountToRepay = !repayAmount || parseFloat(repayAmount) === 0 ? '0' : repayAmount;
      const tx = await larryService.repay(amountToRepay);
      setSuccess(`Loan repaid successfully! Amount: ${amountToRepay === '0' ? 'Full amount' : amountToRepay + ' ETH'}`);
      setRepayAmount(''); // Clear input after successful repay
      await refreshData(); // Refresh loan data
    } catch (error: any) {
      setError(error.message || 'Failed to repay loan');
    } finally {
      setLoading(false);
    }
  };

  const closePosition = async () => {
    if (!isConnected) return;
    
    setLoading(true);
    setError('');
    try {
      const tx = await larryService.flashClosePosition();
      setSuccess('Position closed successfully with flash loan!');
      await refreshData(); // Refresh loan data
    } catch (error: any) {
      setError(error.message || 'Failed to close position');
    } finally {
      setLoading(false);
    }
  };

  // Max button functions
  const setMaxEth = () => {
    // Leave some ETH for gas fees (0.001 ETH)
    const maxAmount = Math.max(0, parseFloat(larryStats.userEthBalance) - 0.001);
    setEthAmount(maxAmount.toString());
  };

  const setMaxLarry = () => {
    setLarryAmount(larryStats.userLarryBalance);
  };

  const setMaxLeverageEth = () => {
    // Calculate maximum fee that user can actually afford
    // Available ETH minus gas reserve
    const availableEth = Math.max(0, parseFloat(larryStats.userEthBalance) - 0.005);
    
    if (availableEth <= 0) {
      setLeverageEthAmount('0');
      return;
    }
    
    // We need to solve: availableEth = totalFee + overCollateral
    // Where: overCollateral = positionSize * 0.01
    // And: positionSize = targetFee / feeRate
    // So: availableEth = targetFee + (targetFee / feeRate) * 0.01
    // Therefore: targetFee = availableEth / (1 + 0.01/feeRate)
    
    const days = parseInt(leverageDays);
    const buy_fee_leverage = 100; // 1%
    const base_interest = 0.001; // 0.1%
    const annual_rate = 0.039; // 3.9%
    
    const leverage_fee_rate = buy_fee_leverage / 10000;
    const daily_interest_rate = annual_rate / 365;
    const total_interest_rate = (daily_interest_rate * days) + base_interest;
    const total_fee_rate = leverage_fee_rate + total_interest_rate;
    
    // Calculate max fee considering overcollateralization
    const overCollateralRate = 0.01; // 1%
    const maxFeeAmount = availableEth / (1 + overCollateralRate / total_fee_rate);
    
    setLeverageEthAmount(maxFeeAmount.toFixed(6));
  };

  const setMaxBorrowEth = () => {
    // Calculate max borrowable based on LARRY balance
    // Typically you can borrow up to 70% of collateral value
    const larryValue = parseFloat(larryStats.userLarryBalance) * parseFloat(larryStats.larryPrice);
    const maxBorrow = larryValue * 0.7; // 70% loan-to-value ratio
    setBorrowEthAmount(maxBorrow.toString());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-32 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-orange-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30 backdrop-blur-sm">
              <ChartBarIcon className="h-5 w-5 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">Live on Base Mainnet</span>
            </div>
            
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-emerald-400 via-green-400 to-cyan-400 bg-clip-text text-transparent">
              Larry Ecosystem
            </h1>
            
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Trade, leverage, and borrow with the rebase-less stability token
            </p>

            {/* Live Price Display */}
            <div className="mt-6 p-4 bg-gradient-to-r from-emerald-900/50 to-green-900/50 border border-emerald-500/30 backdrop-blur-sm rounded-lg max-w-md mx-auto">
              <div className="text-sm text-emerald-400 mb-1">Current LARRY Price</div>
              <div className="text-3xl font-bold text-white">Ξ {parseFloat(larryStats.larryPrice).toFixed(10)}</div>
              <div className="text-xs text-gray-400 mt-1">Live from contract</div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-emerald-900/50 to-green-900/50 border-emerald-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">LARRY Price</span>
                  <TrendingUpIcon className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white">Ξ {parseFloat(larryStats.larryPrice).toFixed(8)}</div>
                <div className="text-xs text-gray-400 mt-1">Stability protected</div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Total Collateral</span>
                  <LockIcon className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">{formatNumber(larryStats.totalCollateral, 0)}</div>
                <div className="text-xs text-gray-400 mt-1">LARRY tokens</div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/50 to-cyan-900/50 border-blue-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Total Borrowed</span>
                  <ShieldIcon className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-white">{formatNumber(larryStats.totalBorrowed, 2)}</div>
                <div className="text-xs text-gray-400 mt-1">ETH borrowed</div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-orange-900/50 to-red-900/50 border-orange-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">ETH Backing</span>
                  <DollarSignIcon className="h-4 w-4 text-orange-400" />
                </div>
                <div className="text-2xl font-bold text-white">{formatNumber(larryStats.backing, 4)}</div>
                <div className="text-xs text-gray-400 mt-1">ETH reserves</div>
              </div>
            </Card>
          </div>

          {/* Network Check Alert */}
          {isConnected && !isCorrectNetwork && (
            <Alert className="mb-6 bg-yellow-900/50 border-yellow-500/50 text-yellow-200 backdrop-blur-sm">
              <InfoIcon className="h-4 w-4" />
              <span className="ml-2">Please switch to Base Network to use the Larry Ecosystem.</span>
            </Alert>
          )}

          {!isConnected ? (
            <Card className="max-w-md mx-auto bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
              <div className="p-8 text-center">
                <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-500">
                  <WalletIcon className="h-10 w-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
                <p className="text-gray-300 mb-6">
                  Connect your wallet to start trading, leveraging, and borrowing with LARRY
                </p>
                
                <Button
                  onClick={connectWallet}
                  className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-3"
                  disabled={loading}
                >
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Trading Interface */}
              <div className="lg:col-span-2">
                <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                  <div className="p-6">
                    {error && (
                      <Alert className="mb-4 bg-red-900/50 border-red-500/50 text-red-200">
                        <XCircleIcon className="h-4 w-4" />
                        <span className="ml-2">{error}</span>
                      </Alert>
                    )}
                    
                    {success && (
                      <Alert className="mb-4 bg-green-900/50 border-green-500/50 text-green-200">
                        <CheckCircleIcon className="h-4 w-4" />
                        <span className="ml-2">{success}</span>
                      </Alert>
                    )}

                    <Tabs defaultValue="trade" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 p-1 rounded-lg">
                        <TabsTrigger value="trade" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-green-600">
                          Trade
                        </TabsTrigger>
                        <TabsTrigger value="leverage" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600">
                          Leverage
                        </TabsTrigger>
                        <TabsTrigger value="borrow" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-cyan-600">
                          Borrow
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="trade" className="mt-6 space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">
                              You Pay (ETH)
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={setMaxEth}
                              className="text-emerald-400 hover:text-emerald-300 text-xs"
                              disabled={loading}
                            >
                              MAX
                            </Button>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              value={ethAmount}
                              onChange={(e) => setEthAmount(e.target.value)}
                              placeholder="0.0"
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                              disabled={loading}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CreditCardIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">ETH</span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            Balance: {formatNumber(larryStats.userEthBalance, 4)} ETH
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowUpDownIcon className="h-8 w-8 text-emerald-400" />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            You Receive (LARRY)
                          </label>
                          <div className="relative">
                            <Input
                              type="text"
                              value={buyQuote ? formatNumber(buyQuote.tokenAmount, 2) : '0.00'}
                              readOnly
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CoinsIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">LARRY</span>
                            </div>
                          </div>
                          {buyQuote && (
                            <div className="mt-1 text-xs text-emerald-400">
                              Buy Fee: {buyQuote.buyFee}%
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={executeBuy}
                          className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-3"
                          disabled={loading || !ethAmount || parseFloat(ethAmount) <= 0 || !isCorrectNetwork}
                        >
                          {loading ? 'Processing...' : 'Buy LARRY'}
                        </Button>

                        <div className="border-t border-gray-700 pt-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-300">
                                Sell LARRY
                              </label>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={setMaxLarry}
                                className="text-red-400 hover:text-red-300 text-xs"
                                disabled={loading}
                              >
                                MAX
                              </Button>
                            </div>
                            <div className="relative">
                              <Input
                                type="number"
                                value={larryAmount}
                                onChange={(e) => setLarryAmount(e.target.value)}
                                placeholder="0.0"
                                className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                                disabled={loading}
                              />
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <CoinsIcon className="h-5 w-5 text-gray-400" />
                                <span className="text-gray-400 font-medium">LARRY</span>
                              </div>
                            </div>
                            <div className="mt-1 text-xs text-gray-400">
                              Balance: {formatNumber(larryStats.userLarryBalance, 2)} LARRY
                            </div>
                            {sellQuote && (
                              <div className="mt-2 p-3 bg-gray-800/30 rounded-lg">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">You Receive:</span>
                                  <span className="text-white">{formatNumber(sellQuote.ethAmount, 4)} ETH</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-400">Sell Fee:</span>
                                  <span className="text-red-400">{sellQuote.sellFee}%</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={executeSell}
                            className="w-full mt-3 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold py-3"
                            disabled={loading || !larryAmount || parseFloat(larryAmount) <= 0 || !isCorrectNetwork}
                          >
                            {loading ? 'Processing...' : 'Sell LARRY'}
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="leverage" className="mt-6 space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">
                              ETH Fee You Want to Pay (Total)
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={setMaxLeverageEth}
                              className="text-purple-400 hover:text-purple-300 text-xs"
                              disabled={loading}
                            >
                              MAX
                            </Button>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              value={leverageEthAmount}
                              onChange={(e) => setLeverageEthAmount(e.target.value)}
                              placeholder="0.0"
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                              disabled={loading}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CreditCardIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">ETH</span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            Available: {larryStats.userEthBalance} ETH • MAX calculates optimal fee for your balance
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Loan Duration: {leverageDays} days
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="365"
                            step="1"
                            value={leverageDays}
                            onChange={(e) => setLeverageDays(e.target.value)}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>1 day</span>
                            <span>365 days</span>
                          </div>
                        </div>

                                                 {leverageQuote && leverageEthAmount && parseFloat(leverageEthAmount) > 0 && (
                           <div className="p-4 bg-gray-800/30 rounded-lg">
                             <div className="text-center mb-3">
                               <div className="text-lg font-bold text-emerald-400">
                                 🎯 Fee-First Leverage ({leverageDays} days)
                               </div>
                               <div className="text-2xl font-bold text-purple-400 mt-1">
                                 {leverageQuote.leverageMultiplier ? 
                                   `${leverageQuote.leverageMultiplier.toFixed(1)}x Leverage` :
                                   `${(parseFloat(leverageQuote.calculatedPositionSize || leverageQuote.ethPosition) / parseFloat(leverageEthAmount)).toFixed(1)}x`
                                 }
                               </div>
                               <div className="text-xs text-gray-400">
                                 Pay {leverageEthAmount} ETH fee → Get {parseFloat(leverageQuote.calculatedPositionSize || leverageQuote.ethPosition).toFixed(4)} ETH position
                               </div>
                               <div className="text-xs text-orange-400 mt-1">
                                 Contract will be called with position size: {parseFloat(leverageQuote.calculatedPositionSize || leverageQuote.ethPosition).toFixed(4)} ETH
                               </div>
                               
                               {leverageQuote.totalEthNeeded && !leverageQuote.hasEnoughBalance && (
                                 <div className="mt-2 p-2 bg-red-900/30 border border-red-500/50 rounded text-xs text-red-300">
                                   ⚠️ Insufficient balance! Need {parseFloat(leverageQuote.totalEthNeeded).toFixed(6)} ETH total, you have {larryStats.userEthBalance} ETH
                                 </div>
                               )}
                             </div>
                             
                             <div className="space-y-2">
                               <div className="flex justify-between text-sm font-semibold">
                                 <span className="text-gray-400">💰 Target Fee:</span>
                                 <span className="text-red-400">{leverageEthAmount} ETH</span>
                               </div>
                               {leverageQuote.totalEthNeeded && (
                                 <div className="flex justify-between text-sm font-semibold">
                                   <span className="text-gray-400">💸 Total ETH Needed:</span>
                                   <span className={leverageQuote.hasEnoughBalance ? "text-green-400" : "text-red-400"}>
                                     {parseFloat(leverageQuote.totalEthNeeded).toFixed(6)} ETH
                                   </span>
                                 </div>
                               )}
                               <div className="flex justify-between text-sm font-semibold">
                                 <span className="text-gray-400">📈 Position Size:</span>
                                 <span className="text-purple-400">{parseFloat(leverageQuote.calculatedPositionSize || leverageQuote.ethPosition).toFixed(4)} ETH</span>
                               </div>
                               <div className="flex justify-between text-sm">
                                 <span className="text-gray-400">🔒 LARRY Collateral:</span>
                                 <span className="text-emerald-400">{formatNumber(leverageQuote.larryAmount)} LARRY</span>
                               </div>
                               <div className="flex justify-between text-sm">
                                 <span className="text-gray-400">💸 You Borrow:</span>
                                 <span className="text-blue-400">{parseFloat(leverageQuote.borrowAmount).toFixed(4)} ETH</span>
                               </div>
                               <div className="flex justify-between text-sm">
                                 <span className="text-gray-400">📊 APR:</span>
                                 <span className="text-yellow-400">{leverageQuote.apr}%</span>
                               </div>
                             </div>

                             {leverageQuote.totalEthNeeded && (
                               <div className="mt-3 p-2 bg-gray-800/50 rounded text-xs">
                                 <div className="text-gray-400 mb-2 font-medium">ETH Breakdown:</div>
                                 <div className="flex justify-between">
                                   <span className="text-gray-400">• Leverage Fee:</span>
                                   <span className="text-red-400">{parseFloat(leverageQuote.actualFeeUsed).toFixed(6)} ETH</span>
                                 </div>
                                 {leverageQuote.overCollateralizationAmount && (
                                   <div className="flex justify-between">
                                     <span className="text-gray-400">• Over-collateral (1%):</span>
                                     <span className="text-orange-400">{parseFloat(leverageQuote.overCollateralizationAmount).toFixed(6)} ETH</span>
                                   </div>
                                 )}
                                 <div className="border-t border-gray-600 mt-1 pt-1">
                                   <div className="flex justify-between font-medium">
                                     <span className="text-gray-300">Total Required:</span>
                                     <span className={leverageQuote.hasEnoughBalance ? "text-green-400" : "text-red-400"}>
                                       {parseFloat(leverageQuote.totalEthNeeded).toFixed(6)} ETH
                                     </span>
                                   </div>
                                 </div>
                               </div>
                             )}

                             <div className="mt-3 p-3 bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded border border-purple-500/30">
                               <div className="text-xs text-purple-200">
                                 💡 <strong>How it works:</strong> You pay {leverageEthAmount} ETH as fee to get a {parseFloat(leverageQuote.calculatedPositionSize || leverageQuote.ethPosition).toFixed(4)} ETH leveraged position. 
                                 That's {leverageQuote.leverageMultiplier ? leverageQuote.leverageMultiplier.toFixed(1) : (parseFloat(leverageQuote.calculatedPositionSize || leverageQuote.ethPosition) / parseFloat(leverageEthAmount)).toFixed(1)}x your money!
                               </div>
                             </div>
                           </div>
                         )}

                        <Button
                          onClick={executeLeverage}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
                          disabled={loading || !leverageEthAmount || parseFloat(leverageEthAmount) <= 0 || !isCorrectNetwork}
                        >
                          {loading ? 'Processing...' : 'Open Leverage Position'}
                        </Button>
                      </TabsContent>

                      <TabsContent value="borrow" className="mt-6 space-y-4">
                        <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/30 mb-4">
                          <div className="text-sm text-blue-300">
                            <strong>📝 How it works:</strong> You provide LARRY tokens as collateral → Get ETH to borrow
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-gray-300">
                              ETH Amount to Borrow
                            </label>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={setMaxBorrowEth}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                              disabled={loading}
                            >
                              MAX
                            </Button>
                          </div>
                          <div className="relative">
                            <Input
                              type="number"
                              value={borrowEthAmount}
                              onChange={(e) => setBorrowEthAmount(e.target.value)}
                              placeholder="0.0"
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                              disabled={loading}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CreditCardIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">ETH</span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            💰 You'll receive this ETH amount (you provide LARRY as collateral)
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Loan Duration: {borrowDays} days
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="365"
                            step="1"
                            value={borrowDays}
                            onChange={(e) => setBorrowDays(e.target.value)}
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>1 day</span>
                            <span>365 days</span>
                          </div>
                        </div>

                        {borrowQuote && (
                          <div className="p-4 bg-gray-800/30 rounded-lg border border-blue-500/20">
                            <div className="text-xs text-blue-300 mb-3 font-medium">📊 Loan Summary:</div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">📤 LARRY Collateral Required:</span>
                              <span className="text-yellow-400 font-medium">{formatNumber(borrowQuote.requiredCollateral, 2)} LARRY</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-gray-400">💸 Interest Fee:</span>
                              <span className="text-red-400">{formatNumber(borrowQuote.interestFee, 4)} ETH</span>
                            </div>
                            <div className="flex justify-between text-sm mb-1 border-t border-gray-600 pt-2">
                              <span className="text-gray-300 font-medium">📥 ETH You'll Receive:</span>
                              <span className="text-green-400 font-bold">{formatNumber(borrowQuote.netAmount, 4)} ETH</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-400">🔢 APR:</span>
                              <span className="text-blue-400">{borrowQuote.apr}%</span>
                            </div>
                          </div>
                        )}

                        <Button
                          onClick={executeBorrow}
                          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3"
                          disabled={loading || !borrowEthAmount || parseFloat(borrowEthAmount) <= 0 || !isCorrectNetwork}
                        >
                          {loading ? 'Processing...' : 
                           (parseFloat(userLoan.collateral) > 0 || parseFloat(userLoan.borrowed) > 0) ? 
                           'Borrow More' : 'Create Loan'}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>
                </Card>
              </div>

              {/* Stats Panel */}
              <div className="space-y-4">
                <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Your Balances</h3>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={refreshData}
                        disabled={refreshing}
                        className="text-purple-400 hover:text-purple-300"
                      >
                        <RefreshCwIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CreditCardIcon className="h-5 w-5 text-blue-400" />
                          <span className="text-gray-300">ETH</span>
                        </div>
                        <span className="text-white font-medium">
                          {formatNumber(larryStats.userEthBalance, 4)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CoinsIcon className="h-5 w-5 text-emerald-400" />
                          <span className="text-gray-300">LARRY</span>
                        </div>
                        <span className="text-white font-medium">
                          {formatNumber(larryStats.userLarryBalance, 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* User Loan Status */}
                {(parseFloat(userLoan.collateral) > 0 || parseFloat(userLoan.borrowed) > 0) && (
                  <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">Your Loan</h3>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                          <span className="text-gray-300">Collateral</span>
                          <span className="text-emerald-400 font-medium">
                            {formatNumber(userLoan.collateral, 2)} LARRY
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                          <span className="text-gray-300">Borrowed</span>
                          <span className="text-blue-400 font-medium">
                            {formatNumber(userLoan.borrowed, 4)} ETH
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                          <span className="text-gray-300">Days Remaining</span>
                          <span className="text-yellow-400 font-medium">
                            {userLoan.numberOfDays}
                          </span>
                        </div>
                      </div>

                      {/* Repay Amount Input */}
                      <div className="mt-4 space-y-3">
                        <div>
                          <Label className="text-sm text-gray-400 mb-2 block">Repay Amount (ETH)</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder="Enter amount to repay (leave empty for full repay)"
                              value={repayAmount}
                              onChange={(e) => setRepayAmount(e.target.value)}
                              className="w-full bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-green-500 pr-16"
                              step="0.0001"
                            />
                            <Button
                              size="sm"
                              onClick={() => setRepayAmount(userLoan.borrowed)}
                              className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-7"
                            >
                              MAX
                            </Button>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Leave empty to repay full amount ({userLoan.borrowed} ETH)
                          </div>
                        </div>
                      </div>

                      {/* Flash Close Quote */}
                      {flashCloseQuote && (
                        <div className="mt-4 p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                          <div className="text-xs text-red-300 mb-3 font-medium">⚡ Flash Close Preview:</div>
                          <div className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <span className="text-gray-400">💰 Collateral Value:</span>
                              <span className="text-white">{formatNumber(flashCloseQuote.collateralValue, 4)} ETH</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">💸 Loan to Repay:</span>
                              <span className="text-red-400">-{formatNumber(flashCloseQuote.borrowed, 4)} ETH</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">🔥 Flash Close Fee:</span>
                              <span className="text-orange-400">-{formatNumber(flashCloseQuote.totalFee, 4)} ETH</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-600 pt-2 font-bold">
                              <span className="text-gray-300">📥 You'll Receive:</span>
                              <span className="text-green-400">{formatNumber(flashCloseQuote.userReceives, 4)} ETH</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <Button
                          onClick={repayLoan}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
                          disabled={loading}
                        >
                          {repayAmount ? `Repay ${repayAmount} ETH` : 'Repay Full'}
                        </Button>
                        <Button
                          onClick={closePosition}
                          className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white font-semibold"
                          disabled={loading || (flashCloseQuote && !flashCloseQuote.canClose)}
                        >
                          Flash Close
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Protocol Stats</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Total Supply</span>
                          <span className="text-gray-300">{formatNumber(larryStats.totalSupply, 0)}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-emerald-500 to-green-600 h-2 rounded-full"
                            style={{ width: '75%' }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">ETH Backing</span>
                          <span className="text-gray-300">{formatNumber(larryStats.backing, 4)} ETH</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-cyan-600 h-2 rounded-full"
                            style={{ width: '60%' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Trading Fees</h3>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                        <span className="text-gray-300">Buy Fee</span>
                        <span className="text-green-400 font-medium">{larryStats.buyFee}%</span>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                        <span className="text-gray-300">Sell Fee</span>
                        <span className="text-red-400 font-medium">{larryStats.sellFee}%</span>
                      </div>
                    </div>

                    <div className="mt-4 p-3 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                      <div className="flex items-start space-x-2">
                        <AlertCircleIcon className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-emerald-300">
                          <p className="font-semibold mb-1">Stability Mechanism</p>
                          <p>Larry's price can only go up. Buy fees ensure upward price pressure with every transaction.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}