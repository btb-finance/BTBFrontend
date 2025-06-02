'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers, providers, Contract } from 'ethers';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Alert } from '@/app/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { 
  ArrowUpDownIcon, 
  WalletIcon, 
  InfoIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  CoinsIcon
} from 'lucide-react';
import btbSwapABI from './buysellabi.json';

// Network configuration - Base Mainnet
const BASE_CHAIN_ID = 8453;
const BASE_RPC_URL = 'https://mainnet.base.org';

// Contract Addresses on Base Mainnet
const SWAP_CONTRACT_ADDRESS = '0x0dDE2D3f3BE0b48c6f960c819FF81c933cbc69f5';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
const BTB_ADDRESS = '0xBBF88F780072F5141dE94E0A711bD2ad2c1f83BB'; // BTB on Base

// Constants from contract
const RATE_MULTIPLIER = 1000; // 1 USDC = 1000 BTB
const TAX_PERCENTAGE = 5; // 5% tax for non-whitelisted
const USDC_DECIMALS = 6;
const BTB_DECIMALS = 18;

// ERC20 ABI for token interactions
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

interface SwapStats {
  usdcBalance: string;
  btbBalance: string;
  usdcReserve: string;
  btbReserve: string;
  userBTBBalance: string;
  userUSDCBalance: string;
  isWhitelisted: boolean;
}

export default function BuyToken() {
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('buy');
  
  // Form states
  const [usdcAmount, setUsdcAmount] = useState('');
  const [btbAmount, setBtbAmount] = useState('');
  const [btbOutput, setBtbOutput] = useState('0');
  const [usdcOutput, setUsdcOutput] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  
  // Contract states
  const [swapStats, setSwapStats] = useState<SwapStats>({
    usdcBalance: '0',
    btbBalance: '0',
    usdcReserve: '0',
    btbReserve: '0',
    userBTBBalance: '0',
    userUSDCBalance: '0',
    isWhitelisted: false
  });
  
  const [refreshing, setRefreshing] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (account) {
      refreshData();
    }
  }, [account]);

  const checkConnection = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new providers.Web3Provider((window as any).ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (!(window as any).ethereum) {
        setError('Please install MetaMask to use this feature');
        return;
      }

      setLoading(true);
      setError('');
      
      const ethereum = (window as any).ethereum;
      await ethereum.request({ method: 'eth_requestAccounts' });
      
      const provider = new providers.Web3Provider(ethereum);
      const network = await provider.getNetwork();
      
      if (Number(network.chainId) !== BASE_CHAIN_ID) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${BASE_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            setError('Please add Base network to MetaMask');
          } else {
            setError('Please switch to Base network');
          }
          return;
        }
      }

      const accounts = await ethereum.request({ method: 'eth_accounts' });
      setAccount(accounts[0]);
      
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', () => window.location.reload());
      
      setSuccess('Wallet connected successfully!');
    } catch (error: any) {
      console.error('Connection error:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAccount('');
      setSwapStats({
        usdcBalance: '0',
        btbBalance: '0',
        usdcReserve: '0',
        btbReserve: '0',
        userBTBBalance: '0',
        userUSDCBalance: '0',
        isWhitelisted: false
      });
    } else {
      setAccount(accounts[0]);
    }
  };

  const refreshData = async () => {
    try {
      setRefreshing(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Initialize contracts
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, btbSwapABI, provider);
      const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const btbContract = new Contract(BTB_ADDRESS, ERC20_ABI, provider);
      
      // Get contract balances
      const [contractBalances, reserves] = await Promise.all([
        swapContract.getContractBalances(),
        swapContract.getReserveRequirements()
      ]);
      
      // Get user data
      const [userUSDC, userBTB, isWhitelisted] = await Promise.all([
        usdcContract.balanceOf(account),
        btbContract.balanceOf(account),
        swapContract.isWhitelisted(account)
      ]);
      
      setSwapStats({
        usdcBalance: ethers.utils.formatUnits(contractBalances.usdcBalance, USDC_DECIMALS),
        btbBalance: ethers.utils.formatUnits(contractBalances.btbBalance, BTB_DECIMALS),
        usdcReserve: ethers.utils.formatUnits(reserves.usdcReserve, USDC_DECIMALS),
        btbReserve: ethers.utils.formatUnits(reserves.btbReserve, BTB_DECIMALS),
        userUSDCBalance: ethers.utils.formatUnits(userUSDC, USDC_DECIMALS),
        userBTBBalance: ethers.utils.formatUnits(userBTB, BTB_DECIMALS),
        isWhitelisted
      });
      
    } catch (error: any) {
      console.error('Error refreshing data:', error);
      setError('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const calculateBuyOutput = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0 || !account) {
      setBtbOutput('0');
      setTaxAmount('0');
      return;
    }

    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, btbSwapABI, provider);
      
      const amountInWei = ethers.utils.parseUnits(amount, USDC_DECIMALS);
      const result = await swapContract.calculateBTBOut(amountInWei, account);
      
      setBtbOutput(ethers.utils.formatUnits(result.btbOut, BTB_DECIMALS));
      setTaxAmount(ethers.utils.formatUnits(result.tax, BTB_DECIMALS));
    } catch (error) {
      console.error('Error calculating output:', error);
      setBtbOutput('0');
      setTaxAmount('0');
    }
  }, [account]);

  const calculateSellOutput = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0 || !account) {
      setUsdcOutput('0');
      setTaxAmount('0');
      return;
    }

    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, btbSwapABI, provider);
      
      const amountInWei = ethers.utils.parseUnits(amount, BTB_DECIMALS);
      const result = await swapContract.calculateUSDCOut(amountInWei, account);
      
      setUsdcOutput(ethers.utils.formatUnits(result.usdcOut, USDC_DECIMALS));
      setTaxAmount(ethers.utils.formatUnits(result.tax, USDC_DECIMALS));
    } catch (error) {
      console.error('Error calculating output:', error);
      setUsdcOutput('0');
      setTaxAmount('0');
    }
  }, [account]);

  useEffect(() => {
    if (activeTab === 'buy') {
      calculateBuyOutput(usdcAmount);
    }
  }, [usdcAmount, activeTab, calculateBuyOutput]);

  useEffect(() => {
    if (activeTab === 'sell') {
      calculateSellOutput(btbAmount);
    }
  }, [btbAmount, activeTab, calculateSellOutput]);

  const checkAndApproveUSDC = async (amount: string) => {
    try {
      setApproving(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, signer);
      
      const amountInWei = ethers.utils.parseUnits(amount, USDC_DECIMALS);
      const currentAllowance = await usdcContract.allowance(account, SWAP_CONTRACT_ADDRESS);
      
      if (currentAllowance.lt(amountInWei)) {
        setSuccess('Approving USDC...');
        const tx = await usdcContract.approve(SWAP_CONTRACT_ADDRESS, amountInWei);
        await tx.wait();
        setSuccess('USDC approved successfully!');
      }
      
      return true;
    } catch (error: any) {
      console.error('Approval error:', error);
      setError('Failed to approve USDC: ' + (error.message || 'Unknown error'));
      return false;
    } finally {
      setApproving(false);
    }
  };

  const checkAndApproveBTB = async (amount: string) => {
    try {
      setApproving(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      const btbContract = new Contract(BTB_ADDRESS, ERC20_ABI, signer);
      
      const amountInWei = ethers.utils.parseUnits(amount, BTB_DECIMALS);
      const currentAllowance = await btbContract.allowance(account, SWAP_CONTRACT_ADDRESS);
      
      if (currentAllowance.lt(amountInWei)) {
        setSuccess('Approving BTB...');
        const tx = await btbContract.approve(SWAP_CONTRACT_ADDRESS, amountInWei);
        await tx.wait();
        setSuccess('BTB approved successfully!');
      }
      
      return true;
    } catch (error: any) {
      console.error('Approval error:', error);
      setError('Failed to approve BTB: ' + (error.message || 'Unknown error'));
      return false;
    } finally {
      setApproving(false);
    }
  };

  const buyBTB = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!usdcAmount || parseFloat(usdcAmount) <= 0) {
        throw new Error('Please enter a valid USDC amount');
      }

      // Check USDC balance
      if (parseFloat(usdcAmount) > parseFloat(swapStats.userUSDCBalance)) {
        throw new Error('Insufficient USDC balance');
      }

      // Approve USDC if needed
      const approved = await checkAndApproveUSDC(usdcAmount);
      if (!approved) return;

      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, btbSwapABI, signer);

      const amountInWei = ethers.utils.parseUnits(usdcAmount, USDC_DECIMALS);
      
      setSuccess('Swapping USDC for BTB...');
      const tx = await swapContract.buyBTB(amountInWei);
      
      setSuccess('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      
      setSuccess('Successfully swapped USDC for BTB!');
      setUsdcAmount('');
      setBtbOutput('0');
      
      // Refresh balances
      await refreshData();
      
    } catch (error: any) {
      console.error('Buy error:', error);
      if (error.code === 4001) {
        setError('Transaction cancelled');
      } else if (error.message.includes('Insufficient BTB')) {
        setError('Insufficient BTB liquidity in contract');
      } else if (error.message.includes('Would breach reserve')) {
        setError('This trade would breach reserve requirements');
      } else {
        setError(error.message || 'Failed to buy BTB');
      }
    } finally {
      setLoading(false);
    }
  };

  const sellBTB = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!btbAmount || parseFloat(btbAmount) <= 0) {
        throw new Error('Please enter a valid BTB amount');
      }

      // Check BTB balance
      if (parseFloat(btbAmount) > parseFloat(swapStats.userBTBBalance)) {
        throw new Error('Insufficient BTB balance');
      }

      // Approve BTB if needed
      const approved = await checkAndApproveBTB(btbAmount);
      if (!approved) return;

      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      const swapContract = new Contract(SWAP_CONTRACT_ADDRESS, btbSwapABI, signer);

      const amountInWei = ethers.utils.parseUnits(btbAmount, BTB_DECIMALS);
      
      setSuccess('Swapping BTB for USDC...');
      const tx = await swapContract.sellBTB(amountInWei);
      
      setSuccess('Transaction submitted. Waiting for confirmation...');
      await tx.wait();
      
      setSuccess('Successfully swapped BTB for USDC!');
      setBtbAmount('');
      setUsdcOutput('0');
      
      // Refresh balances
      await refreshData();
      
    } catch (error: any) {
      console.error('Sell error:', error);
      if (error.code === 4001) {
        setError('Transaction cancelled');
      } else if (error.message.includes('Insufficient USDC')) {
        setError('Insufficient USDC liquidity in contract');
      } else if (error.message.includes('Would breach reserve')) {
        setError('This trade would breach reserve requirements');
      } else {
        setError(error.message || 'Failed to sell BTB');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: string, decimals: number = 2) => {
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return '0';
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      <div className="absolute inset-0 bg-black/20" />
      
      <div className="relative container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 backdrop-blur-sm">
              <CoinsIcon className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Live on Base Mainnet</span>
            </div>
            
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              BTB Token Exchange
            </h1>
            
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Swap between USDC and BTB tokens instantly with our secure exchange
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Exchange Rate</span>
                  <TrendingUpIcon className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white">1 USDC = 1,000 BTB</div>
                <div className="text-xs text-gray-400 mt-1">Fixed rate exchange</div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Tax Rate</span>
                  {swapStats.isWhitelisted ? (
                    <CheckCircleIcon className="h-4 w-4 text-green-400" />
                  ) : (
                    <InfoIcon className="h-4 w-4 text-yellow-400" />
                  )}
                </div>
                <div className="text-2xl font-bold text-white">
                  {swapStats.isWhitelisted ? '0%' : '5%'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {swapStats.isWhitelisted ? 'Whitelisted address' : 'Standard rate'}
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-green-900/50 to-blue-900/50 border-green-500/30 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">Contract Status</span>
                  <ShieldCheckIcon className="h-4 w-4 text-green-400" />
                </div>
                <div className="text-2xl font-bold text-white">Active</div>
                <div className="text-xs text-gray-400 mt-1">Fully operational</div>
              </div>
            </Card>
          </div>

          {!account ? (
            <Card className="max-w-md mx-auto bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
              <div className="p-8 text-center">
                <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                  <WalletIcon className="h-10 w-10 text-white" />
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
                <p className="text-gray-300 mb-6">
                  Connect your wallet to start swapping tokens on Base network
                </p>
                
                <Button
                  onClick={connectWallet}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
                  disabled={loading}
                >
                  {loading ? 'Connecting...' : 'Connect Wallet'}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Swap Interface */}
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

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 bg-gray-800/50 p-1 rounded-lg">
                        <TabsTrigger value="buy" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600">
                          Buy BTB
                        </TabsTrigger>
                        <TabsTrigger value="sell" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600">
                          Sell BTB
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="buy" className="mt-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            You Pay
                          </label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={usdcAmount}
                              onChange={(e) => setUsdcAmount(e.target.value)}
                              placeholder="0.0"
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                              disabled={loading || approving}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CreditCardIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">USDC</span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            Balance: {formatNumber(swapStats.userUSDCBalance, 2)} USDC
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowUpDownIcon className="h-8 w-8 text-purple-400" />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            You Receive
                          </label>
                          <div className="relative">
                            <Input
                              type="text"
                              value={formatNumber(btbOutput, 2)}
                              readOnly
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CoinsIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">BTB</span>
                            </div>
                          </div>
                          {!swapStats.isWhitelisted && parseFloat(taxAmount) > 0 && (
                            <div className="mt-1 text-xs text-yellow-400">
                              Tax: {formatNumber(taxAmount, 2)} BTB (5%)
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={buyBTB}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
                          disabled={loading || approving || !usdcAmount || parseFloat(usdcAmount) <= 0}
                        >
                          {loading ? 'Processing...' : approving ? 'Approving...' : 'Swap USDC for BTB'}
                        </Button>
                      </TabsContent>

                      <TabsContent value="sell" className="mt-6 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            You Pay
                          </label>
                          <div className="relative">
                            <Input
                              type="number"
                              value={btbAmount}
                              onChange={(e) => setBtbAmount(e.target.value)}
                              placeholder="0.0"
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                              disabled={loading || approving}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CoinsIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">BTB</span>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-gray-400">
                            Balance: {formatNumber(swapStats.userBTBBalance, 2)} BTB
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <ArrowUpDownIcon className="h-8 w-8 text-purple-400" />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            You Receive
                          </label>
                          <div className="relative">
                            <Input
                              type="text"
                              value={formatNumber(usdcOutput, 2)}
                              readOnly
                              className="w-full pl-4 pr-20 py-3 bg-gray-800/50 border-gray-700 text-white text-lg"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <CreditCardIcon className="h-5 w-5 text-gray-400" />
                              <span className="text-gray-400 font-medium">USDC</span>
                            </div>
                          </div>
                          {!swapStats.isWhitelisted && parseFloat(taxAmount) > 0 && (
                            <div className="mt-1 text-xs text-yellow-400">
                              Tax: {formatNumber(taxAmount, 2)} USDC (5%)
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={sellBTB}
                          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3"
                          disabled={loading || approving || !btbAmount || parseFloat(btbAmount) <= 0}
                        >
                          {loading ? 'Processing...' : approving ? 'Approving...' : 'Swap BTB for USDC'}
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
                          <span className="text-gray-300">USDC</span>
                        </div>
                        <span className="text-white font-medium">
                          {formatNumber(swapStats.userUSDCBalance, 2)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center p-3 bg-gray-800/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CoinsIcon className="h-5 w-5 text-purple-400" />
                          <span className="text-gray-300">BTB</span>
                        </div>
                        <span className="text-white font-medium">
                          {formatNumber(swapStats.userBTBBalance, 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Contract Liquidity</h3>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">USDC Pool</span>
                          <span className="text-gray-300">{formatNumber(swapStats.usdcBalance, 2)}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
                            style={{ width: '75%' }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">BTB Pool</span>
                          <span className="text-gray-300">{formatNumber(swapStats.btbBalance, 2)}</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                            style={{ width: '85%' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="bg-gradient-to-br from-gray-900/90 to-purple-900/90 border-purple-500/30 backdrop-blur-sm">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Account Status</h3>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                      <span className="text-gray-300">Whitelist Status</span>
                      <div className="flex items-center gap-2">
                        {swapStats.isWhitelisted ? (
                          <>
                            <CheckCircleIcon className="h-5 w-5 text-green-400" />
                            <span className="text-green-400 font-medium">Whitelisted</span>
                          </>
                        ) : (
                          <>
                            <XCircleIcon className="h-5 w-5 text-yellow-400" />
                            <span className="text-yellow-400 font-medium">Standard</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-3">
                      {swapStats.isWhitelisted 
                        ? 'You enjoy 0% tax on all swaps'
                        : 'Standard accounts pay 5% tax on swaps'
                      }
                    </p>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}