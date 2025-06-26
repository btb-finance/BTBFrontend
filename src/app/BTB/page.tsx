'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ethers, providers, Contract } from 'ethers';
import { motion } from 'framer-motion';
import { 
  WalletIcon, 
  BanknoteIcon,
  ArrowUpDownIcon,
  ShieldCheckIcon,
  TrendingUpIcon,
  BoxIcon as CubeTransparentIcon,
  RefreshCwIcon,
  CheckCircleIcon,
  XCircleIcon,
  CoinsIcon,
  CalculatorIcon,
  ChartBarIcon,
  CreditCardIcon
} from 'lucide-react';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Alert } from '@/app/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';

// Import ABIs
import BTBTokenABI from './btbtokenabi.json';
import BTBDefiProtocolABI from './BTBDefiProtocol.json';

// Contract Addresses on Base Sepolia
const CONTRACTS = {
  BTB_TOKEN: '0x802F93D0EB6826E2489D6cD2ded70f15E9CE77F3',
  BURN_ADDRESS: '0xdabb36D297b83adF57039a0B140e6c81471e30ff',
  DEFI_PROTOCOL: '0x055019bD201E1F90B5b61D327797f2aBDd0A19Fd',
  BASE_SEPOLIA_CHAIN_ID: 84532
};

// ERC20 ABI for basic token interactions
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

interface ProtocolStats {
  backing: string;
  effectiveSupply: string;
  price: string;
  totalBorrowed: string;
  totalCollateral: string;
  isActive: boolean;
}

interface UserPosition {
  collateralAmount: string;
  borrowedAmount: string;
  expirationDate: number;
  loanDurationDays: number;
}

interface AdvancedUserInfo {
  freeCollateral: string;
  maxBorrow: string;
  maxLoop: string;
  canLoop: boolean;
  loopReason: string;
  isPositionExpired: boolean;
}

interface LoopCalculation {
  loopFee: string;
  userBorrow: string;
  overCollateralizationAmount: string;
  interestFee: string;
  totalRequired: string;
  tokensOut: string;
}

export default function BTBPage() {
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('trade');
  
  // Token data
  const [btbBalance, setBtbBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  const [allowance, setAllowance] = useState('0');
  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [advancedUserInfo, setAdvancedUserInfo] = useState<AdvancedUserInfo | null>(null);
  const [loopCalculation, setLoopCalculation] = useState<LoopCalculation | null>(null);
  
  // Form inputs
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [leverageAmount, setLeverageAmount] = useState('');
  const [loanDays, setLoanDays] = useState('30');
  const [approveAmount, setApproveAmount] = useState('');
  const [loopAmount, setLoopAmount] = useState('');
  const [loopDays, setLoopDays] = useState('30');
  const [extendDays, setExtendDays] = useState('30');

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (account) {
      loadData();
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
      
      if (Number(network.chainId) !== CONTRACTS.BASE_SEPOLIA_CHAIN_ID) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CONTRACTS.BASE_SEPOLIA_CHAIN_ID.toString(16)}` }],
          });
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: `0x${CONTRACTS.BASE_SEPOLIA_CHAIN_ID.toString(16)}`,
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org']
              }]
            });
          }
        }
      }

      const accounts = await ethereum.request({ method: 'eth_accounts' });
      setAccount(accounts[0]);
      setSuccess('Wallet connected successfully!');
    } catch (error: any) {
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      setRefreshing(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      
      // Validate account and network first
      if (!account || !ethers.utils.isAddress(account)) {
        console.log('Invalid account address');
        return;
      }
      
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CONTRACTS.BASE_SEPOLIA_CHAIN_ID) {
        console.log('Wrong network');
        return;
      }
      
      // Get ETH balance
      try {
        const ethBal = await provider.getBalance(account);
        setEthBalance(ethers.utils.formatEther(ethBal));
      } catch (err) {
        console.error('Failed to get ETH balance:', err);
        setEthBalance('0');
      }
      
      // Initialize contracts with validation
      try {
        const btbContract = new Contract(CONTRACTS.BTB_TOKEN, ERC20_ABI, provider);
        const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, provider);
        
        // Test contract calls with timeout
        const timeout = 5000; // 5 second timeout
        
        // Get BTB balance with error handling
        try {
          const btbBalPromise = btbContract.balanceOf(account);
          const btbBal = await Promise.race([
            btbBalPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
          ]);
          setBtbBalance(ethers.utils.formatEther(btbBal));
        } catch (err) {
          console.error('Failed to get BTB balance:', err);
          setBtbBalance('0');
        }
        
        // Get allowance with error handling
        try {
          const allowancePromise = btbContract.allowance(account, CONTRACTS.DEFI_PROTOCOL);
          const allowanceAmount = await Promise.race([
            allowancePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
          ]);
          setAllowance(ethers.utils.formatEther(allowanceAmount));
        } catch (err) {
          console.error('Failed to get allowance:', err);
          setAllowance('0');
        }
        
        // Get protocol stats
        try {
          const stats = await defiContract.getProtocolStats();
          setProtocolStats({
            backing: ethers.utils.formatEther(stats[0]),
            effectiveSupply: ethers.utils.formatEther(stats[1]),
            price: ethers.utils.formatEther(stats[2]),
            totalBorrowed: ethers.utils.formatEther(stats[3]),
            totalCollateral: ethers.utils.formatEther(stats[4]),
            isActive: stats[5]
          });
        } catch (err) {
          console.log('Protocol stats not available');
        }
        
        // Get user position
        try {
          const position = await defiContract.getUserLoanInfo(account);
          if (position[0] && position[0].gt(0)) {
            setUserPosition({
              collateralAmount: ethers.utils.formatEther(position[0]),
              borrowedAmount: ethers.utils.formatEther(position[1]),
              expirationDate: Number(position[2]),
              loanDurationDays: 0
            });
          } else {
            setUserPosition(null);
          }
        } catch (err) {
          setUserPosition(null);
        }

        // Get advanced user info
        try {
          const [freeCollateral, maxBorrow, maxLoop, canLoop, isExpired] = await Promise.all([
            defiContract.getFreeCollateral(account),
            defiContract.getMaxBorrow(account, 30),
            defiContract.getMaxLoop(account, 30),
            defiContract.canUserLoop(account),
            defiContract.isPositionExpired(account)
          ]);

          setAdvancedUserInfo({
            freeCollateral: ethers.utils.formatEther(freeCollateral),
            maxBorrow: ethers.utils.formatEther(maxBorrow[0]),
            maxLoop: ethers.utils.formatEther(maxLoop[0]),
            canLoop: canLoop[0],
            loopReason: canLoop[1],
            isPositionExpired: isExpired
          });
        } catch (err) {
          console.log('Advanced user info not available');
          setAdvancedUserInfo(null);
        }
        
      } catch (err) {
        console.error('Failed to initialize contracts:', err);
      }
       
     } catch (error: any) {
       console.error('Failed to load data:', error);
     } finally {
       setRefreshing(false);
     }
   };

  const formatNumber = (value: string, decimals = 4) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: decimals 
    });
  };

  const executeTransaction = async (operation: string, txFunction: () => Promise<any>) => {
    try {
      setLoading(true);
      setError('');
      
      const tx = await txFunction();
      await tx.wait();
      
      setSuccess(`${operation} completed successfully!`);
      loadData();
      
    } catch (error: any) {
      setError(error.message || `${operation} failed`);
    } finally {
      setLoading(false);
    }
  };

  const purchaseTokens = async () => {
    if (!purchaseAmount) return;
    
    const provider = new providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
    
    await executeTransaction('Token purchase', () => 
      defiContract.purchaseTokens(account, {
        value: ethers.utils.parseEther(purchaseAmount)
      })
    );
    setPurchaseAmount('');
  };

  const sellTokens = async () => {
    if (!sellAmount) return;
    
    const provider = new providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
    
    await executeTransaction('Token sale', () => 
      defiContract.sellTokens(ethers.utils.parseEther(sellAmount))
    );
    setSellAmount('');
  };

  const approveTokens = async () => {
    if (!approveAmount) return;
    
    const provider = new providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const btbContract = new Contract(CONTRACTS.BTB_TOKEN, BTBTokenABI, signer);
    
    await executeTransaction('Token approval', () => 
      btbContract.approve(CONTRACTS.DEFI_PROTOCOL, ethers.utils.parseEther(approveAmount))
    );
    setApproveAmount('');
  };

  const createLeveragePosition = async () => {
    if (!leverageAmount) return;
    
    try {
      setLoading(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
      
      // User enters total ETH they want to spend (like Larry's fee approach)
      const totalEthToSpend = ethers.utils.parseEther(leverageAmount);
      const daysToUse = parseInt(loanDays) || 30;
      
      setSuccess(`Calculating optimal leverage position for ${leverageAmount} ETH investment...`);
      
      // Get protocol fees to calculate position size
      const leverageFeePercentage = await defiContract.leverageFeePercentage(); // This gives fee in basis points
      const feeRate = parseFloat(leverageFeePercentage.toString()) / 10000; // Convert to decimal
      
      // Calculate daily interest (assuming similar to Larry's 3.9% annual)
      const annualRate = 0.039; // 3.9%
      const dailyRate = annualRate / 365;
      const totalInterestRate = (dailyRate * daysToUse) + 0.001; // Base fee like Larry
      const totalFeeRate = feeRate + totalInterestRate;
      
      // Calculate position size: if user wants to spend X ETH total, 
      // position size = X / (totalFeeRate + overcollateralization)
      // Assuming 1% overcollateralization like Larry
      const overcollateralizationRate = 0.01;
      const totalCostRate = totalFeeRate + overcollateralizationRate;
      
      const positionSize = parseFloat(leverageAmount) / totalCostRate;
      const positionSizeWei = ethers.utils.parseEther(positionSize.toString());
      
      setSuccess(`Creating ${formatNumber(positionSize.toString())} ETH position using your ${leverageAmount} ETH investment...`);
      
      // Create the leverage position with calculated size
      const tx = await defiContract.createLeveragePosition(
        positionSizeWei, // Position size calculated from user's investment
        daysToUse,
        { value: totalEthToSpend } // User's total investment amount
      );
      
      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();
      
      setSuccess(`🚀 Leverage position created! Used ${leverageAmount} ETH to create ${formatNumber(positionSize.toString())} ETH position for ${daysToUse} days!`);
      await loadData();
      setLeverageAmount('');
      
    } catch (error: any) {
      console.error('Leverage position error:', error);
      setError(`Leverage position failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createLoopPosition = async () => {
    if (!loopAmount) return;
    
    try {
      setLoading(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
      
      // User enters total ETH they want to spend for loop
      const totalEthToSpend = ethers.utils.parseEther(loopAmount);
      const daysToUse = parseInt(loopDays) || 30;
      
      setSuccess(`Calculating optimal loop position for ${loopAmount} ETH investment...`);
      
      // Use the calculateInverseLoop function to find the ETH position size
      // that would require totalEthToSpend as total required payment
      const positionEthAmount = await defiContract.calculateInverseLoop(
        totalEthToSpend, // Total required amount (what user wants to spend)
        daysToUse
      );
      
      const positionSizeEth = parseFloat(ethers.utils.formatEther(positionEthAmount));
      
      setSuccess(`Creating ${formatNumber(positionSizeEth.toString())} ETH loop position using your ${loopAmount} ETH investment...`);
      
      // Create the loop position with calculated size
      const tx = await defiContract.createLoopPosition(
        positionEthAmount, // Position size calculated from inverse function
        daysToUse,
        { value: totalEthToSpend } // User's total investment amount
      );
      
      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();
      
      setSuccess(`🔄 Loop position created! Used ${loopAmount} ETH to create ${formatNumber(positionSizeEth.toString())} ETH loop for ${daysToUse} days to get maximum BTB!`);
      await loadData();
      setLoopAmount('');
      
    } catch (error: any) {
      console.error('Loop position error:', error);
      setError(`Loop position failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const extendLoanDuration = async () => {
    if (!extendDays) return;
    
    const provider = new providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
    
    await executeTransaction('Loan extension', () => 
      defiContract.extendLoanDuration(parseInt(extendDays))
    );
    setExtendDays('30');
  };

  const calculateLoopParameters = async () => {
    if (!loopAmount || !account) return;
    
    // Validate the input before trying to parse it
    const amount = parseFloat(loopAmount);
    if (isNaN(amount) || amount <= 0 || amount < 0.000001) {
      console.log('Invalid loop amount:', loopAmount);
      return;
    }
    
    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, provider);
      
      // Clean the amount to avoid precision issues
      const cleanAmount = amount.toFixed(18);
      
      const [loopParams, loopOutput] = await Promise.all([
        defiContract.calculateLoopParameters(
          ethers.utils.parseEther(cleanAmount),
          parseInt(loopDays)
        ),
        defiContract.getLoopOutput(
          ethers.utils.parseEther(cleanAmount),
          parseInt(loopDays)
        )
      ]);

      setLoopCalculation({
        loopFee: ethers.utils.formatEther(loopParams[0]),
        userBorrow: ethers.utils.formatEther(loopParams[1]),
        overCollateralizationAmount: ethers.utils.formatEther(loopParams[2]),
        interestFee: ethers.utils.formatEther(loopParams[3]),
        totalRequired: ethers.utils.formatEther(loopOutput[1]),
        tokensOut: ethers.utils.formatEther(loopOutput[0])
      });
    } catch (err) {
      console.error('Failed to calculate loop parameters:', err);
      setLoopCalculation(null);
    }
  };

  // Auto-calculate loop parameters when amount or days change
  useEffect(() => {
    if (loopAmount && parseFloat(loopAmount) > 0) {
      calculateLoopParameters();
    }
  }, [loopAmount, loopDays]);

  // Simple calculation function for buy amounts
  const [estimatedTokens, setEstimatedTokens] = useState('0');
  const [estimatedETH, setEstimatedETH] = useState('0');

  const calculatePurchaseEstimate = async () => {
    if (!purchaseAmount || !account || parseFloat(purchaseAmount) <= 0) {
      setEstimatedTokens('0');
      return;
    }

    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, provider);
      
      const ethAmount = ethers.utils.parseEther(purchaseAmount);
      console.log('Calculating for ETH amount:', purchaseAmount, 'Wei:', ethAmount.toString());
      
      // Try estimatePurchaseTokens first (includes fees)
      try {
        const result = await defiContract.estimatePurchaseTokens(ethAmount);
        const tokensOut = ethers.utils.formatEther(result);
        console.log('estimatePurchaseTokens result:', tokensOut);
        setEstimatedTokens(tokensOut);
        return;
      } catch (err) {
        console.log('estimatePurchaseTokens failed, trying calculateETHtoTokens:', err);
      }

      // Fallback to calculateETHtoTokens
      try {
        const result = await defiContract.calculateETHtoTokens(ethAmount);
        const tokensOut = ethers.utils.formatEther(result);
        console.log('calculateETHtoTokens result:', tokensOut);
        setEstimatedTokens(tokensOut);
        return;
      } catch (err) {
        console.log('calculateETHtoTokens failed:', err);
      }

      setEstimatedTokens('0');
    } catch (error) {
      console.error('Purchase calculation error:', error);
      setEstimatedTokens('0');
    }
  };

  const calculateSellEstimate = async () => {
    if (!sellAmount || !account || parseFloat(sellAmount) <= 0) {
      setEstimatedETH('0');
      return;
    }

    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, provider);
      
      const tokenAmount = ethers.utils.parseEther(sellAmount);
      console.log('Calculating sell for token amount:', sellAmount, 'Wei:', tokenAmount.toString());
      
      try {
        const result = await defiContract.calculateTokensToETH(tokenAmount);
        const ethOut = ethers.utils.formatEther(result);
        console.log('calculateTokensToETH result:', ethOut);
        setEstimatedETH(ethOut);
        return;
      } catch (err) {
        console.log('calculateTokensToETH failed:', err);
      }

      setEstimatedETH('0');
    } catch (error) {
      console.error('Sell calculation error:', error);
      setEstimatedETH('0');
    }
  };

  // Auto-calculate when purchase amount changes
  useEffect(() => {
    if (purchaseAmount && parseFloat(purchaseAmount) > 0) {
      calculatePurchaseEstimate();
    } else {
      setEstimatedTokens('0');
    }
  }, [purchaseAmount, account]);

  // Auto-calculate when sell amount changes
  useEffect(() => {
    if (sellAmount && parseFloat(sellAmount) > 0) {
      calculateSellEstimate();
    } else {
      setEstimatedETH('0');
    }
  }, [sellAmount, account]);

  const borrowAgainstCollateral = async () => {
    if (!borrowAmount) return;
    
    const provider = new providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
    
    await executeTransaction('Borrow operation', () => 
      defiContract.borrowAgainstCollateral(
        ethers.utils.parseEther(borrowAmount),
        parseInt(loanDays)
      )
    );
    setBorrowAmount('');
  };

  const repayLoan = async () => {
    if (!repayAmount) return;
    
    const provider = new providers.Web3Provider((window as any).ethereum);
    const signer = provider.getSigner();
    const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
    
    await executeTransaction('Loan repayment', () => 
      defiContract.makePayment({
        value: ethers.utils.parseEther(repayAmount)
      })
    );
    setRepayAmount('');
  };

  const closePosition = async () => {
    try {
      setLoading(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
      
      // First check if user has a position
      const [collateral, borrowed, expiration] = await defiContract.getUserLoanInfo(account);
      
      if (borrowed === '0') {
        setError('No active position to close');
        setLoading(false);
        return;
      }

      // Check if user has enough ETH to pay the debt
      const borrowedFloat = parseFloat(ethers.utils.formatEther(borrowed));
      const userEthBalance = parseFloat(ethBalance);
      
      if (userEthBalance < borrowedFloat) {
        setError(`❌ Insufficient ETH balance. Need ${formatNumber(borrowedFloat.toString())} ETH but you have ${formatNumber(userEthBalance.toString())} ETH. Use Flash Close instead.`);
        setLoading(false);
        return;
      }
      
      setSuccess(`Manual Close Preview:
• Debt to repay: ${formatNumber(ethers.utils.formatEther(borrowed))} ETH
• You will pay: ${formatNumber(ethers.utils.formatEther(borrowed))} ETH from your wallet
• Collateral returned: ${formatNumber(ethers.utils.formatEther(collateral))} BTB
• Requires exact ETH payment`);

      // Execute manual close - requires exact ETH payment
      const tx = await defiContract.closePosition({
        value: borrowed
      });
      
      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();
      
      setSuccess('Position closed manually! 🎉 Your collateral has been returned.');
      await loadData();
      
    } catch (error: any) {
      console.error('Manual close error:', error);
      
      if (error.message.includes('PositionExpired')) {
        setError('❌ Position has expired and may have been liquidated.');
      } else if (error.message.includes('IncorrectRepaymentAmount')) {
        setError('❌ Incorrect repayment amount. Must pay exact debt amount.');
      } else if (error.message.includes('user rejected')) {
        setError('Transaction cancelled by user');
      } else {
        setError(`Manual close failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Flash close using collateral auto-sell mechanism
  const instantClosePosition = async () => {
    try {
      setLoading(true);
      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = provider.getSigner();
      const defiContract = new Contract(CONTRACTS.DEFI_PROTOCOL, BTBDefiProtocolABI, signer);
      
      // Check position first
      const [collateral, borrowed, expiration] = await defiContract.getUserLoanInfo(account);
      
      if (borrowed === '0') {
        setError('No active position to close');
        setLoading(false);
        return;
      }

      // Calculate what will happen with auto-sell
      const collateralValueETH = await defiContract.calculateTokensToETH(collateral);
      const afterFeeValue = collateralValueETH.mul(99).div(100); // 99% after 1% fee
      const borrowedAmount = borrowed;
      
      if (afterFeeValue.lt(borrowedAmount)) {
        setError('❌ Insufficient collateral value to auto-close position. Your collateral value (after fees) is less than your debt.');
        setLoading(false);
        return;
      }

      const userReturn = afterFeeValue.sub(borrowedAmount);
      
      setSuccess(`Flash Close Preview (Auto-Pay):
• Collateral to sell: ${formatNumber(ethers.utils.formatEther(collateral))} BTB
• Collateral value: ${formatNumber(ethers.utils.formatEther(collateralValueETH))} ETH
• After 1% fee: ${formatNumber(ethers.utils.formatEther(afterFeeValue))} ETH
• Debt to pay: ${formatNumber(ethers.utils.formatEther(borrowed))} ETH
• ETH returned to you: ${formatNumber(ethers.utils.formatEther(userReturn))} ETH
• No upfront payment required!`);

      // Execute flash close - no payment required, uses collateral
      const tx = await defiContract.instantClosePosition();
      
      setSuccess('Transaction submitted! Waiting for confirmation...');
      await tx.wait();
      
      setSuccess(`🚀 Position closed via Flash Close! You received ${formatNumber(ethers.utils.formatEther(userReturn))} ETH!`);
      await loadData();
      
    } catch (error: any) {
      console.error('Flash close error:', error);
      
      if (error.message.includes('PositionExpired')) {
        setError('❌ Position has expired and may have been liquidated.');
      } else if (error.message.includes('InsufficientCollateralValue')) {
        setError('❌ Insufficient collateral value to close position. Your position may be undercollateralized.');
      } else if (error.message.includes('user rejected')) {
        setError('Transaction cancelled by user');
      } else {
        setError(`Flash close failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-dismiss alerts
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  return (
    <div className="relative isolate min-h-screen">
      {/* Background similar to game page */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-950"></div>
        
        {/* Animated background elements */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-5 dark:opacity-10" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btb-primary dark:text-blue-400" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          
          {/* Animated particles - fixed to prevent hydration mismatch */}
          {useMemo(() => 
            [...Array(20)].map((_, i) => (
              <motion.div 
                key={i}
                className="absolute rounded-full bg-btb-primary/20 dark:bg-btb-primary/30"
                style={{
                  width: (2 + (i * 0.4)) + 'px',
                  height: (2 + (i * 0.3)) + 'px',
                  left: ((i * 5.26) % 100) + '%',
                  top: ((i * 7.89) % 100) + '%',
                }}
                animate={{
                  y: [0, -30 - (i % 5) * 5, 0],
                  x: [0, (i % 2 === 0 ? 10 : -10), 0],
                  opacity: [0.1, 0.5, 0.1],
                }}
                transition={{
                  duration: 6 + (i % 4),
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )), []
          )}
        </div>
      </div>
      
      <div className="py-8 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center mb-4">
              <CubeTransparentIcon className="h-12 w-12 text-btb-primary mr-3" />
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary to-btb-primary-light">
                BTB Finance DeFi Protocol
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Complete DeFi solution for BTB token trading, lending, and leverage
            </p>
            
            {/* Testnet notice */}
            <motion.div 
              className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 border border-yellow-200 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-300 p-4 rounded-xl mt-4 shadow-md backdrop-blur-md max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full p-1.5">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-semibold">Base Sepolia Testnet - All features available for testing</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Connection Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-8"
          >
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
              <div className="p-6">
                {!account ? (
                  <div className="text-center">
                    <Button 
                      onClick={connectWallet} 
                      disabled={loading}
                      className="btn-primary"
                    >
                      <WalletIcon className="mr-2 h-5 w-5" />
                      {loading ? 'Connecting...' : 'Connect Wallet'}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Connected Account</div>
                      <div className="font-mono text-sm font-medium">
                        {account.slice(0, 6)}...{account.slice(-4)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">ETH Balance</div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatNumber(ethBalance)} ETH</span>
                        {parseFloat(ethBalance) === 0 && (
                          <Button 
                            onClick={loadData}
                            disabled={refreshing}
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 px-2"
                          >
                            {refreshing ? '...' : '↻'}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">BTB Balance</div>
                      <div className="font-semibold">{formatNumber(btbBalance)} BTB</div>
                    </div>
                    <div className="flex justify-end">
                      <Button 
                        onClick={loadData} 
                        disabled={refreshing}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCwIcon className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Alerts */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Alert className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300">
                <XCircleIcon className="h-4 w-4" />
                <div>{error}</div>
              </Alert>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300">
                <CheckCircleIcon className="h-4 w-4" />
                <div>{success}</div>
              </Alert>
            </motion.div>
          )}

          {/* Protocol Stats */}
          {account && protocolStats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mb-8"
            >
              <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <ChartBarIcon className="mr-2 h-5 w-5 text-btb-primary" />
                    Protocol Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                      <div className={`font-semibold ${protocolStats.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {protocolStats.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Price</div>
                      <div className="font-semibold">{formatNumber(protocolStats.price)} ETH</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Backing</div>
                      <div className="font-semibold">{formatNumber(protocolStats.backing)} ETH</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Supply</div>
                      <div className="font-semibold">{formatNumber(protocolStats.effectiveSupply)} BTB</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Borrowed</div>
                      <div className="font-semibold">{formatNumber(protocolStats.totalBorrowed)} ETH</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">Collateral</div>
                      <div className="font-semibold">{formatNumber(protocolStats.totalCollateral)} BTB</div>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

                     {/* User Position */}
           {account && userPosition && (
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, delay: 0.5 }}
               className="mb-8"
             >
               <Card className="bg-gradient-to-r from-btb-primary/5 to-blue-500/5 border border-btb-primary/20 shadow-lg">
                 <div className="p-6">
                   <h3 className="text-lg font-semibold mb-4 flex items-center text-btb-primary">
                     <ShieldCheckIcon className="mr-2 h-5 w-5" />
                     Your Active Position
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Collateral</div>
                       <div className="font-semibold">{formatNumber(userPosition.collateralAmount)} BTB</div>
                     </div>
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Borrowed</div>
                       <div className="font-semibold">{formatNumber(userPosition.borrowedAmount)} ETH</div>
                     </div>
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Expiration</div>
                       <div className={`font-semibold ${advancedUserInfo?.isPositionExpired ? 'text-red-600' : ''}`}>
                         {new Date(userPosition.expirationDate * 1000).toLocaleDateString()}
                         {advancedUserInfo?.isPositionExpired && <div className="text-xs text-red-600">EXPIRED</div>}
                       </div>
                     </div>
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Free Collateral</div>
                       <div className="font-semibold">{advancedUserInfo ? formatNumber(advancedUserInfo.freeCollateral) : 'Loading...'} BTB</div>
                     </div>
                     <div className="flex flex-col gap-2">
                       <Button 
                         onClick={instantClosePosition} 
                         disabled={loading}
                         className="btn-primary"
                         size="sm"
                       >
                         🚀 Flash Close (Auto-Pay)
                       </Button>
                       <Button 
                         onClick={closePosition} 
                         disabled={loading}
                         variant="outline"
                         size="sm"
                         className="text-xs"
                       >
                         💰 Manual Close (Pay ETH)
                       </Button>
                       <div className="grid grid-cols-2 gap-2">
                         <Input
                           type="number"
                           placeholder="Days"
                           value={extendDays}
                           onChange={(e) => setExtendDays(e.target.value)}
                           disabled={loading}
                           className="text-xs"
                           min="1"
                           max="365"
                         />
                         <Button 
                           onClick={extendLoanDuration} 
                           disabled={loading || !extendDays}
                           variant="outline"
                           size="sm"
                           className="text-xs"
                         >
                           Extend
                         </Button>
                       </div>
                     </div>
                   </div>
                 </div>
               </Card>
             </motion.div>
           )}

           {/* Advanced User Info */}
           {account && advancedUserInfo && (
             <motion.div
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, delay: 0.6 }}
               className="mb-8"
             >
               <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                 <div className="p-6">
                   <h3 className="text-lg font-semibold mb-4 flex items-center">
                     <CalculatorIcon className="mr-2 h-5 w-5 text-indigo-600" />
                     Advanced User Information
                   </h3>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Max Borrow (30d)</div>
                       <div className="font-semibold">{formatNumber(advancedUserInfo.maxBorrow)} ETH</div>
                     </div>
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Max Loop (30d)</div>
                       <div className="font-semibold">{formatNumber(advancedUserInfo.maxLoop)} ETH</div>
                     </div>
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Loop Status</div>
                       <div className={`font-semibold ${advancedUserInfo.canLoop ? 'text-green-600' : 'text-red-600'}`}>
                         {advancedUserInfo.canLoop ? 'Available' : 'Unavailable'}
                       </div>
                       {!advancedUserInfo.canLoop && (
                         <div className="text-xs text-gray-500 mt-1">{advancedUserInfo.loopReason}</div>
                       )}
                     </div>
                     <div>
                       <div className="text-sm text-gray-500 dark:text-gray-400">Position Status</div>
                       <div className={`font-semibold ${advancedUserInfo.isPositionExpired ? 'text-red-600' : 'text-green-600'}`}>
                         {advancedUserInfo.isPositionExpired ? 'Expired' : 'Active'}
                       </div>
                     </div>
                   </div>
                 </div>
               </Card>
             </motion.div>
           )}

          {/* Main Interface */}
          {account && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
                             <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                 <TabsList className="grid w-full grid-cols-5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md">
                   <TabsTrigger value="trade" className="flex items-center gap-2">
                     <ArrowUpDownIcon className="h-4 w-4" />
                     Trade
                   </TabsTrigger>
                   <TabsTrigger value="leverage" className="flex items-center gap-2">
                     <TrendingUpIcon className="h-4 w-4" />
                     Leverage
                   </TabsTrigger>
                   <TabsTrigger value="loop" className="flex items-center gap-2">
                     <RefreshCwIcon className="h-4 w-4" />
                     Loop
                   </TabsTrigger>
                   <TabsTrigger value="loans" className="flex items-center gap-2">
                     <BanknoteIcon className="h-4 w-4" />
                     Loans
                   </TabsTrigger>
                   <TabsTrigger value="manage" className="flex items-center gap-2">
                     <CalculatorIcon className="h-4 w-4" />
                     Manage
                   </TabsTrigger>
                 </TabsList>

                {/* Trading Tab */}
                <TabsContent value="trade" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                      <div className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <CoinsIcon className="mr-2 h-5 w-5 text-green-600" />
                          Buy BTB Tokens
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              ETH Amount
                            </label>
                            <Input
                              placeholder="0.1"
                              value={purchaseAmount}
                              onChange={(e) => setPurchaseAmount(e.target.value)}
                              disabled={loading}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button 
                                onClick={() => setPurchaseAmount('0.01')}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                0.01 ETH
                              </Button>
                              <Button 
                                onClick={() => setPurchaseAmount('0.05')}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                0.05 ETH
                              </Button>
                              <Button 
                                onClick={() => setPurchaseAmount('0.1')}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                0.1 ETH
                              </Button>
                            </div>
                          </div>

                          {/* Purchase Preview */}
                          {purchaseAmount && parseFloat(estimatedTokens) > 0 && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                              <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2">💰 You'll receive:</h4>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span>BTB Tokens:</span>
                                  <span className="font-bold text-green-600">{formatNumber(estimatedTokens)} BTB</span>
                                </div>
                                <div className="flex justify-between font-semibold border-t border-green-200 pt-1">
                                  <span>You pay:</span>
                                  <span className="text-blue-600">{purchaseAmount} ETH</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <Button 
                            onClick={purchaseTokens} 
                            disabled={loading || !purchaseAmount}
                            className="w-full btn-primary"
                          >
                            {loading ? 'Processing...' : 
                              (parseFloat(estimatedTokens) > 0 ? 
                                `Buy ${formatNumber(estimatedTokens)} BTB Tokens` : 
                                'Buy BTB Tokens'
                              )
                            }
                          </Button>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                      <div className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <CreditCardIcon className="mr-2 h-5 w-5 text-red-600" />
                          Sell BTB Tokens
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              BTB Amount
                            </label>
                            <Input
                              placeholder="100"
                              value={sellAmount}
                              onChange={(e) => setSellAmount(e.target.value)}
                              disabled={loading}
                            />
                            <div className="flex gap-2 mt-2">
                              <Button 
                                onClick={() => setSellAmount('100')}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                100 BTB
                              </Button>
                              <Button 
                                onClick={() => setSellAmount('500')}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                500 BTB
                              </Button>
                              <Button 
                                onClick={() => {
                                  const balance = parseFloat(btbBalance);
                                  if (balance > 0) {
                                    setSellAmount((balance * 0.5).toFixed(2));
                                  }
                                }}
                                disabled={loading || parseFloat(btbBalance) <= 0}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                50% Balance
                              </Button>
                            </div>
                          </div>

                          {/* Sell Preview */}
                          {sellAmount && parseFloat(estimatedETH) > 0 && (
                            <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                              <h4 className="font-semibold text-red-700 dark:text-red-300 mb-2">💸 You'll receive:</h4>
                              <div className="text-sm space-y-1">
                                <div className="flex justify-between">
                                  <span>ETH Amount:</span>
                                  <span className="font-bold text-red-600">{formatNumber(estimatedETH)} ETH</span>
                                </div>
                                <div className="flex justify-between font-semibold border-t border-red-200 pt-1">
                                  <span>You sell:</span>
                                  <span className="text-blue-600">{sellAmount} BTB</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <Button 
                            onClick={sellTokens} 
                            disabled={loading || !sellAmount}
                            className="w-full btn-secondary"
                          >
                            {loading ? 'Processing...' : 
                              (parseFloat(estimatedETH) > 0 ? 
                                `Sell for ${formatNumber(estimatedETH)} ETH` : 
                                'Sell BTB Tokens'
                              )
                            }
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                                 {/* Leverage Tab */}
                 <TabsContent value="leverage" className="space-y-6">
                   <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                     <div className="p-6">
                       <h3 className="text-lg font-semibold mb-4 flex items-center">
                         <TrendingUpIcon className="mr-2 h-5 w-5 text-purple-600" />
                         Create Leverage Position - Simple Mode
                       </h3>
                       
                       {/* Available Balance Display */}
                       <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4 border border-blue-200 dark:border-blue-800">
                         <div className="flex items-center justify-between">
                           <span className="text-sm text-blue-700 dark:text-blue-300">Available ETH Balance:</span>
                           <div className="flex items-center gap-2">
                             <span className="font-semibold text-blue-800 dark:text-blue-200">{formatNumber(ethBalance)} ETH</span>
                             {parseFloat(ethBalance) === 0 && account && (
                               <Button 
                                 onClick={loadData}
                                 disabled={refreshing}
                                 variant="outline"
                                 size="sm"
                                 className="text-xs h-6 px-2"
                               >
                                 {refreshing ? '...' : '↻'}
                               </Button>
                             )}
                           </div>
                         </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         <div>
                           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                             💰 How much ETH do you want to use?
                           </label>
                           <div className="space-y-2">
                             <Input
                               placeholder="0.1"
                               value={leverageAmount}
                               onChange={(e) => setLeverageAmount(e.target.value)}
                               disabled={loading}
                             />
                             <div className="flex gap-2">
                               <Button 
                                 onClick={() => {
                                   const balance = parseFloat(ethBalance);
                                   if (balance > 0) {
                                     setLeverageAmount((balance * 0.25).toFixed(6));
                                   }
                                 }}
                                 disabled={loading || parseFloat(ethBalance) <= 0}
                                 variant="outline"
                                 size="sm"
                                 className="text-xs"
                               >
                                 25%
                               </Button>
                               <Button 
                                 onClick={() => {
                                   const balance = parseFloat(ethBalance);
                                   if (balance > 0) {
                                     setLeverageAmount((balance * 0.5).toFixed(6));
                                   }
                                 }}
                                 disabled={loading || parseFloat(ethBalance) <= 0}
                                 variant="outline"
                                 size="sm"
                                 className="text-xs"
                               >
                                 50%
                               </Button>
                               <Button 
                                 onClick={() => {
                                   const balance = parseFloat(ethBalance);
                                   if (balance > 0) {
                                     setLeverageAmount((balance * 0.75).toFixed(6));
                                   }
                                 }}
                                 disabled={loading || parseFloat(ethBalance) <= 0}
                                 variant="outline"
                                 size="sm"
                                 className="text-xs"
                               >
                                 75%
                               </Button>
                               <Button 
                                 onClick={() => {
                                   const balance = parseFloat(ethBalance);
                                   if (balance > 0) {
                                     setLeverageAmount((balance * 0.9).toFixed(6));
                                   }
                                 }}
                                 disabled={loading || parseFloat(ethBalance) <= 0}
                                 variant="outline"
                                 size="sm"
                                 className="text-xs"
                               >
                                 Max
                               </Button>
                             </div>
                           </div>
                         </div>
                         <div>
                           <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                             ⏰ How many days?
                           </label>
                           <Input
                             type="number"
                             placeholder="30"
                             value={loanDays}
                             onChange={(e) => setLoanDays(e.target.value)}
                             disabled={loading}
                             min="1"
                             max="365"
                           />
                           <div className="flex gap-2 mt-2">
                             <Button onClick={() => setLoanDays('7')} disabled={loading} variant="outline" size="sm" className="text-xs">1W</Button>
                             <Button onClick={() => setLoanDays('30')} disabled={loading} variant="outline" size="sm" className="text-xs">1M</Button>
                             <Button onClick={() => setLoanDays('90')} disabled={loading} variant="outline" size="sm" className="text-xs">3M</Button>
                           </div>
                         </div>
                       </div>

                       {/* Auto Calculation Preview */}
                       {leverageAmount && loanDays && (
                         <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 mb-4">
                           <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">🚀 Your Leverage Preview:</h4>
                           <div className="text-sm space-y-1">
                             <div>• Investment: <span className="font-semibold text-blue-600">{formatNumber(leverageAmount)} ETH</span> (total cost)</div>
                             <div>• Duration: <span className="font-semibold">{loanDays} days</span></div>
                             <div>• Result: <span className="font-semibold text-green-600">Larger position than your investment</span></div>
                             <div>• Strategy: <span className="font-semibold text-purple-600">Optimal leverage calculated automatically</span></div>
                           </div>
                         </div>
                       )}

                       <Button 
                         onClick={createLeveragePosition} 
                         disabled={loading || !leverageAmount || !loanDays}
                         className="w-full btn-primary"
                       >
                         {loading ? 'Processing...' : `🚀 Leverage ${leverageAmount} ETH for ${loanDays} days`}
                       </Button>
                     </div>
                   </Card>
                 </TabsContent>

                 {/* Loop Tab */}
                 <TabsContent value="loop" className="space-y-6">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                       <div className="p-6">
                         <h3 className="text-lg font-semibold mb-4 flex items-center">
                           <RefreshCwIcon className="mr-2 h-5 w-5 text-indigo-600" />
                           Create Loop Position - Auto Mode
                         </h3>

                         {/* Available Balance & Loop Status */}
                         <div className="space-y-3 mb-4">
                           <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                             <div className="flex items-center justify-between">
                               <span className="text-sm text-blue-700 dark:text-blue-300">Available ETH Balance:</span>
                               <div className="flex items-center gap-2">
                                 <span className="font-semibold text-blue-800 dark:text-blue-200">{formatNumber(ethBalance)} ETH</span>
                                 {parseFloat(ethBalance) === 0 && account && (
                                   <Button 
                                     onClick={loadData}
                                     disabled={refreshing}
                                     variant="outline"
                                     size="sm"
                                     className="text-xs h-6 px-2"
                                   >
                                     {refreshing ? '...' : '↻'}
                                   </Button>
                                 )}
                               </div>
                             </div>
                           </div>
                           
                           <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                             <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 text-sm">
                               <span className="font-semibold">Loop Status:</span>
                               {advancedUserInfo ? (
                                 advancedUserInfo.canLoop ? (
                                   <span className="text-green-600 dark:text-green-400">✓ Available</span>
                                 ) : (
                                   <span className="text-red-600 dark:text-red-400">✗ {advancedUserInfo.loopReason}</span>
                                 )
                               ) : (
                                 <span>Loading...</span>
                               )}
                             </div>
                           </div>
                         </div>
                         
                         <div className="space-y-4">
                           <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                               🔄 How much ETH to loop?
                             </label>
                             <div className="space-y-2">
                               <Input
                                 placeholder="0.1"
                                 value={loopAmount}
                                 onChange={(e) => {
                                   setLoopAmount(e.target.value);
                                   if (e.target.value && loopDays) {
                                     calculateLoopParameters();
                                   }
                                 }}
                                 disabled={loading}
                               />
                               <div className="flex gap-2">
                                 <Button 
                                   onClick={() => {
                                     const balance = parseFloat(ethBalance);
                                     if (balance > 0) {
                                       const amount = (balance * 0.25).toFixed(6);
                                       setLoopAmount(amount);
                                       if (loopDays) calculateLoopParameters();
                                     }
                                   }}
                                   disabled={loading || parseFloat(ethBalance) <= 0}
                                   variant="outline"
                                   size="sm"
                                   className="text-xs"
                                 >
                                   25%
                                 </Button>
                                 <Button 
                                   onClick={() => {
                                     const balance = parseFloat(ethBalance);
                                     if (balance > 0) {
                                       const amount = (balance * 0.5).toFixed(6);
                                       setLoopAmount(amount);
                                       if (loopDays) calculateLoopParameters();
                                     }
                                   }}
                                   disabled={loading || parseFloat(ethBalance) <= 0}
                                   variant="outline"
                                   size="sm"
                                   className="text-xs"
                                 >
                                   50%
                                 </Button>
                                 <Button 
                                   onClick={() => {
                                     const balance = parseFloat(ethBalance);
                                     if (balance > 0) {
                                       const amount = (balance * 0.75).toFixed(6);
                                       setLoopAmount(amount);
                                       if (loopDays) calculateLoopParameters();
                                     }
                                   }}
                                   disabled={loading || parseFloat(ethBalance) <= 0}
                                   variant="outline"
                                   size="sm"
                                   className="text-xs"
                                 >
                                   75%
                                 </Button>
                                 <Button 
                                   onClick={() => {
                                     const balance = parseFloat(ethBalance);
                                     if (balance > 0) {
                                       const amount = (balance * 0.9).toFixed(6);
                                       setLoopAmount(amount);
                                       if (loopDays) calculateLoopParameters();
                                     }
                                   }}
                                   disabled={loading || parseFloat(ethBalance) <= 0}
                                   variant="outline"
                                   size="sm"
                                   className="text-xs"
                                 >
                                   Max
                                 </Button>
                               </div>
                             </div>
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                               ⏰ Loop Duration (Days)
                             </label>
                             <Input
                               type="number"
                               placeholder="30"
                               value={loopDays}
                               onChange={(e) => {
                                 setLoopDays(e.target.value);
                                 if (loopAmount && e.target.value) {
                                   calculateLoopParameters();
                                 }
                               }}
                               disabled={loading}
                               min="1"
                               max="365"
                             />
                             <div className="flex gap-2 mt-2">
                               <Button onClick={() => {
                                 setLoopDays('7');
                                 if (loopAmount) calculateLoopParameters();
                               }} disabled={loading} variant="outline" size="sm" className="text-xs">1W</Button>
                               <Button onClick={() => {
                                 setLoopDays('30');
                                 if (loopAmount) calculateLoopParameters();
                               }} disabled={loading} variant="outline" size="sm" className="text-xs">1M</Button>
                               <Button onClick={() => {
                                 setLoopDays('90');
                                 if (loopAmount) calculateLoopParameters();
                               }} disabled={loading} variant="outline" size="sm" className="text-xs">3M</Button>
                             </div>
                           </div>

                           {/* Simple Preview */}
                           {loopAmount && loopDays && (
                             <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 dark:from-indigo-900/20 dark:to-cyan-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                               <h4 className="font-semibold text-indigo-700 dark:text-indigo-300 mb-2">🔄 Your Loop Preview:</h4>
                               <div className="text-sm space-y-1">
                                 <div>• Investment: <span className="font-semibold text-blue-600">{formatNumber(loopAmount)} ETH</span> (total cost)</div>
                                 <div>• Duration: <span className="font-semibold">{loopDays} days</span></div>
                                 <div>• Result: <span className="font-semibold text-green-600">Larger loop position than your investment</span></div>
                                 <div>• Strategy: <span className="font-semibold text-indigo-600">Optimal loop size calculated automatically</span></div>
                               </div>
                             </div>
                           )}
                           
                           <Button 
                             onClick={createLoopPosition} 
                             disabled={loading || !loopAmount || !loopDays || !advancedUserInfo?.canLoop}
                             className="w-full btn-primary"
                           >
                             {loading ? 'Processing...' : `🔄 Loop ${loopAmount} ETH for ${loopDays} days`}
                           </Button>
                         </div>
                       </div>
                     </Card>

                     {/* Loop Calculations */}
                     {loopCalculation && (
                       <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 shadow-lg">
                         <div className="p-6">
                           <h3 className="text-lg font-semibold mb-4 flex items-center text-indigo-700 dark:text-indigo-300">
                             <CalculatorIcon className="mr-2 h-5 w-5" />
                             Loop Calculation Preview
                           </h3>
                           <div className="space-y-3">
                             <div className="grid grid-cols-2 gap-4">
                               <div>
                                 <div className="text-sm text-gray-600 dark:text-gray-400">Tokens Out</div>
                                 <div className="font-semibold text-lg">{formatNumber(loopCalculation.tokensOut)} BTB</div>
                               </div>
                               <div>
                                 <div className="text-sm text-gray-600 dark:text-gray-400">Total Required</div>
                                 <div className="font-semibold text-lg">{formatNumber(loopCalculation.totalRequired)} ETH</div>
                               </div>
                             </div>
                             <div className="border-t border-indigo-200 dark:border-indigo-800 pt-3">
                               <div className="grid grid-cols-2 gap-4 text-sm">
                                 <div>
                                   <div className="text-gray-600 dark:text-gray-400">Loop Fee</div>
                                   <div className="font-medium">{formatNumber(loopCalculation.loopFee)} ETH</div>
                                 </div>
                                 <div>
                                   <div className="text-gray-600 dark:text-gray-400">Interest Fee</div>
                                   <div className="font-medium">{formatNumber(loopCalculation.interestFee)} ETH</div>
                                 </div>
                                 <div>
                                   <div className="text-gray-600 dark:text-gray-400">User Borrow</div>
                                   <div className="font-medium">{formatNumber(loopCalculation.userBorrow)} ETH</div>
                                 </div>
                                 <div>
                                   <div className="text-gray-600 dark:text-gray-400">Over-Collateral</div>
                                   <div className="font-medium">{formatNumber(loopCalculation.overCollateralizationAmount)} ETH</div>
                                 </div>
                               </div>
                             </div>
                           </div>
                         </div>
                       </Card>
                     )}
                   </div>
                 </TabsContent>

                {/* Loans Tab */}
                <TabsContent value="loans" className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                      <div className="p-6">
                                                 <h3 className="text-lg font-semibold mb-4 flex items-center">
                           <BanknoteIcon className="mr-2 h-5 w-5 text-blue-600" />
                           Borrow Against Collateral
                         </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              ETH to Borrow
                            </label>
                            <Input
                              placeholder="0.05"
                              value={borrowAmount}
                              onChange={(e) => setBorrowAmount(e.target.value)}
                              disabled={loading}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Loan Duration (Days)
                            </label>
                            <Input
                              type="number"
                              placeholder="30"
                              value={loanDays}
                              onChange={(e) => setLoanDays(e.target.value)}
                              disabled={loading}
                              min="1"
                              max="365"
                            />
                          </div>
                          <Button 
                            onClick={borrowAgainstCollateral} 
                            disabled={loading || !borrowAmount}
                            className="w-full btn-primary"
                          >
                            {loading ? 'Processing...' : 'Borrow ETH'}
                          </Button>
                        </div>
                      </div>
                    </Card>

                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                      <div className="p-6">
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <ShieldCheckIcon className="mr-2 h-5 w-5 text-green-600" />
                          Repay Loan
                        </h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              ETH Amount to Repay
                            </label>
                            <Input
                              placeholder="0.05"
                              value={repayAmount}
                              onChange={(e) => setRepayAmount(e.target.value)}
                              disabled={loading}
                            />
                          </div>
                          <Button 
                            onClick={repayLoan} 
                            disabled={loading || !repayAmount}
                            className="w-full btn-primary"
                          >
                            {loading ? 'Processing...' : 'Repay Loan'}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                </TabsContent>

                {/* Manage Tab */}
                <TabsContent value="manage" className="space-y-6">
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-lg">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold mb-4 flex items-center">
                        <CalculatorIcon className="mr-2 h-5 w-5 text-indigo-600" />
                        Token Approvals
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                            Current Allowance: {formatNumber(allowance)} BTB
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Amount to Approve
                            </label>
                            <Input
                              placeholder="1000"
                              value={approveAmount}
                              onChange={(e) => setApproveAmount(e.target.value)}
                              disabled={loading}
                            />
                          </div>
                          <div className="flex items-end">
                            <Button 
                              onClick={approveTokens} 
                              disabled={loading || !approveAmount}
                              className="w-full btn-primary"
                            >
                              {loading ? 'Processing...' : 'Approve'}
                            </Button>
                          </div>
                        </div>
                        
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Contract Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">BTB Token</div>
                              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                {CONTRACTS.BTB_TOKEN}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">DeFi Protocol</div>
                              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                {CONTRACTS.DEFI_PROTOCOL}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500 dark:text-gray-400">Burn Address</div>
                              <div className="font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                {CONTRACTS.BURN_ADDRESS}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}