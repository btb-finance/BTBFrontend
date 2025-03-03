'use client';

import { useState, useEffect } from 'react';
import { ethers, utils, providers } from 'ethers';
import { TransactionRequest } from '@ethersproject/abstract-provider';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Alert } from '@/app/components/ui/alert';
import { ChartBarIcon, ArrowDownIcon, WalletIcon } from 'lucide-react';

// Network configuration
const OPTIMISM_SEPOLIA_CHAIN_ID = 11155420;
const OPTIMISM_SEPOLIA_RPC_URL = 'https://sepolia.optimism.io';

// Contract Addresses on Optimistic Sepolia
const BTB_TOKEN_ADDRESS = '0x31e17E48956B05F5db4Cc5B6f8291897724918E1';
const TOKEN_SALE_ADDRESS = '0x7398e9CBa26b47771aB45a05915CcAc8740709CF';
const VESTING_NFT_ADDRESS = '0x4aa2b35ae4f758d555561111a123F7181257fb07';

// Price constants
const INSTANT_PRICE = utils.parseEther('0.000001');   // 0.000001 ETH per token
const VESTING_PRICE = utils.parseEther('0.0000005');  // 0.0000005 ETH per token (50% discount)
const VESTING_DURATION = 365 * 24 * 60 * 60; // 365 days in seconds

// Contract ABIs
const BTBTokenABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
  "function owner() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const TokenSaleABI = [
  // View functions
  "function btbToken() view returns (address)",
  "function owner() view returns (address)",
  "function price() view returns (uint256)",
  "function vestingPrice() view returns (uint256)",
  "function vestingDuration() view returns (uint256)",
  "function isActive() view returns (bool)",
  // Purchase functions
  "function buyTokensInstant() payable",
  "function buyTokensVesting() payable",
  // Events
  "event TokensPurchased(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount)"
];

const VestingNFTABI = [
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function getVestingSchedule(uint256 tokenId) view returns (uint256 totalAmount, uint256 releasedAmount, uint256 startTime, uint256 duration)",
  "function release(uint256 tokenId) returns (uint256)",
  "function releasableAmount(uint256 tokenId) view returns (uint256)",
  "function vestedAmount(uint256 tokenId) view returns (uint256)",
  "event TokensReleased(address indexed beneficiary, uint256 indexed tokenId, uint256 amount)"
];

export default function BuyToken() {
  const [account, setAccount] = useState('');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('0');
  const [vestingTokenAmount, setVestingTokenAmount] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rate, setRate] = useState('0');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const [vestingDuration, setVestingDuration] = useState('0');
  const [vestingInfo, setVestingInfo] = useState<{
    tokenId: string;
    totalAmount: string;
    releasedAmount: string;
    startTime: number;
    duration: number;
  } | null>(null);
  const [releasableAmount, setReleasableAmount] = useState('0');

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (isProcessingRequest) {
      const timer = setTimeout(() => {
        setIsProcessingRequest(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isProcessingRequest]);

  const checkConnection = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = new providers.Web3Provider((window as any).ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          setAccount(accounts[0] ? (typeof accounts[0] === 'string' ? accounts[0] : (accounts[0] as { address: string }).address) : '');
          await getTokenBalance(accounts[0] ? (typeof accounts[0] === 'string' ? accounts[0] : (accounts[0] as { address: string }).address) : '');
          await getTokenRate();
        }
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const hasMetaMask = (): boolean => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).ethereum);
  };

  const connectWallet = async (): Promise<boolean> => {
    try {
      if (!hasMetaMask()) {
        setError('MetaMask is not installed');
        return false;
      }

      setLoading(true);
      const ethereum = (window as any).ethereum;

      console.log('Requesting accounts...');
      await ethereum.request({ method: 'eth_requestAccounts' });

      // Initialize provider
      console.log('Initializing Web3 provider...');
      const provider = new providers.Web3Provider(ethereum);
      
      // Get current chain ID
      console.log('Getting chain ID...');
      const network = await provider.getNetwork();
      console.log('Current network:', network);

      if (Number(network.chainId) !== OPTIMISM_SEPOLIA_CHAIN_ID) {
        throw new Error(`Please switch to Optimistic Sepolia (Chain ID: ${OPTIMISM_SEPOLIA_CHAIN_ID})`);
      }

      // Set account and get balances
      const address = await ethereum.request({ method: 'eth_accounts' });
      setAccount(address[0]);
      
      try {
        await getTokenBalance(address[0]);
        await getTokenRate();
        setSuccess('Wallet connected successfully!');
      } catch (balanceError: any) {
        console.warn('Error getting token balances:', balanceError);
      }

      // Setup event listeners
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      console.log('Wallet connection complete!');
      return true;
    } catch (error: any) {
      const errorDetails = {
        name: error.name,
        message: error.message,
        code: error.code
      };
      console.error('Connection error:', errorDetails);
      
      if (error.code === 4001) {
        setError('User rejected the connection request');
      } else {
        setError(`Failed to connect wallet: ${error.message}`);
      }
      
      return false;
    } finally {
      setLoading(false);
      setIsConnecting(false);
      setIsProcessingRequest(false);
    }
  };

  const handleAccountsChanged = (accounts: string[]) => {
    console.log('Accounts changed:', accounts);
    if (accounts.length === 0) {
      setAccount('');
      setTokenBalance('0');
      setError('Please connect your wallet');
    } else {
      const address = accounts[0] ? (typeof accounts[0] === 'string' ? accounts[0] : (accounts[0] as { address: string }).address) : '';
      setAccount(address);
      getTokenBalance(address);
    }
  };

  const handleChainChanged = (_chainId: string) => {
    console.log('Chain changed:', _chainId);
    window.location.reload();
  };

  const verifyNetwork = async () => {
    try {
      if (!hasMetaMask()) {
        throw new Error('MetaMask is not installed');
      }

      const provider = new providers.Web3Provider((window as any).ethereum);
      const network = await provider.getNetwork();
      console.log('Current network:', network);

      if (Number(network.chainId) !== OPTIMISM_SEPOLIA_CHAIN_ID) {
        throw new Error(`Please switch to Optimistic Sepolia (Chain ID: ${OPTIMISM_SEPOLIA_CHAIN_ID})`);
      }

      // Initialize provider and signer
      const signer = await provider.getSigner();

      // Connect to token sale contract
      console.log('Connecting to token sale contract...');
      const tokenSaleContract = new ethers.Contract(TOKEN_SALE_ADDRESS, TokenSaleABI, signer);
      
      if (!tokenSaleContract.address) {
        throw new Error('Failed to connect to token sale contract');
      }

      // Calculate tokens based on ETH amount
      const tokens = calculateTokenAmount(ethAmount, false);
      console.log('Calculated tokens:', utils.formatEther(tokens));

      // Calculate total price (ethAmount as wei)
      const weiAmount = utils.parseEther(ethAmount);
      console.log('Wei amount to send:', weiAmount.toString());
      
      // Set transaction parameters
      const txParams: TransactionRequest = {
        value: weiAmount
      };

      return true;
    } catch (error: any) {
      console.error('Network verification error:', error);
      setError('Please connect to Optimistic Sepolia network: ' + (error.message || 'Unknown error'));
      return false;
    }
  };

  const getTokenBalance = async (address: string) => {
    try {
      if (!await verifyNetwork()) {
        return;
      }

      const provider = new providers.Web3Provider((window as any).ethereum);
      
      // Verify contract exists
      console.log('Checking BTB token contract...');
      const code = await provider.getCode(BTB_TOKEN_ADDRESS);
      if (code === '0x') {
        throw new Error('BTB token contract not found. Please verify the contract address.');
      }

      console.log('Creating token contract instance...');
      const tokenContract = new ethers.Contract(BTB_TOKEN_ADDRESS, BTBTokenABI, provider);
      
      console.log('Fetching token balance...');
      const balance = await tokenContract.balanceOf(address);
      console.log('Balance received:', balance.toString());
      
      setTokenBalance(utils.formatEther(balance));
    } catch (error: any) {
      console.error('Error getting token balance:', {
        message: error.message,
        code: error.code,
        data: error.data,
        error
      });
      setTokenBalance('Error');
      
      // More specific error messages
      if (error.code === 'CALL_EXCEPTION') {
        const provider = new providers.Web3Provider((window as any).ethereum);
        const network = await provider.getNetwork();
        setError(`Contract call failed. Current network: ${network.name} (${network.chainId}). ` +
                 'Please make sure you are on Optimistic Sepolia (Chain ID: 11155420)');
      } else {
        setError('Failed to get token balance: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const getTokenRate = async () => {
    try {
      if (!await verifyNetwork()) {
        return;
      }

      const provider = new providers.Web3Provider((window as any).ethereum);
      
      // Verify contract exists
      console.log('Checking token sale contract...');
      const code = await provider.getCode(TOKEN_SALE_ADDRESS);
      if (code === '0x') {
        throw new Error('Token sale contract not found. Please verify the contract address.');
      }

      console.log('Creating contract instance...');
      const saleContract = new ethers.Contract(TOKEN_SALE_ADDRESS, TokenSaleABI, provider);
      
      // Get all relevant rates and prices
      console.log('Fetching contract rates...');
      try {
        const currentPrice = await saleContract.price().catch((e: any) => {
          console.error('Error getting price:', e);
          return INSTANT_PRICE;
        });

        const vestingPrice = await saleContract.vestingPrice().catch((e: any) => {
          console.error('Error getting vesting price:', e);
          return VESTING_PRICE;
        });

        console.log('Contract rates:', {
          price: utils.formatEther(currentPrice),
          vestingPrice: utils.formatEther(vestingPrice)
        });

        // Calculate rate as tokens per ETH (1 ETH / price per token)
        const oneEth = utils.parseEther('1');
        const rate = BigInt(oneEth.toString()) * BigInt(1e18) / BigInt(currentPrice.toString());
        setRate(rate.toString());

      } catch (contractError: any) {
        console.error('Contract call error:', {
          message: contractError.message,
          code: contractError.code,
          data: contractError.data
        });
        
        // Use fallback values
        console.log('Using fallback values for rates');
        setRate((BigInt(1e18) * BigInt(1e18) / BigInt(INSTANT_PRICE.toString())).toString());
      }

    } catch (error: any) {
      console.error('Error getting token rate:', {
        message: error.message,
        code: error.code,
        data: error.data
      });

      // More specific error messages
      if (error.code === 'CALL_EXCEPTION') {
        const provider = new providers.Web3Provider((window as any).ethereum);
        const network = await provider.getNetwork();
        setError(`Contract call failed. Current network: ${network.name} (${network.chainId}). ` +
                 'Please make sure you are on Optimistic Sepolia (Chain ID: 11155420)');
      } else {
        setError('Error getting token rate: ' + (error.message || 'Unknown error'));
      }
      
      // Set fallback rate
      setRate((BigInt(1e18) * BigInt(1e18) / BigInt(INSTANT_PRICE.toString())).toString());
    }
  };

  const getVestingInfo = async (address: string) => {
    try {
      const provider = new providers.Web3Provider((window as any).ethereum);
      const vestingContract = new ethers.Contract(VESTING_NFT_ADDRESS, VestingNFTABI, provider);
      
      console.log('Checking vesting NFTs for address:', address);
      
      // First get the NFT balance
      const nftBalance = await vestingContract.balanceOf(address);
      console.log('NFT balance:', nftBalance.toString());
      
      if (nftBalance.eq(0)) {
        console.log('No vesting NFTs found');
        setVestingInfo(null);
        setReleasableAmount('0');
        return;
      }

      try {
        // Get the first token ID
        const tokenId = await vestingContract.tokenOfOwnerByIndex(address, 0);
        console.log('Found vesting NFT token ID:', tokenId.toString());

        // Get vesting schedule for this token
        const schedule = await vestingContract.getVestingSchedule(tokenId);
        console.log('Vesting schedule:', {
          totalAmount: utils.formatEther(schedule.totalAmount),
          releasedAmount: utils.formatEther(schedule.releasedAmount),
          startTime: new Date(schedule.startTime.toNumber() * 1000).toISOString(),
          duration: schedule.duration.toNumber() / (24 * 60 * 60) + ' days'
        });

        const releasable = await vestingContract.releasableAmount(tokenId);
        console.log('Releasable amount:', utils.formatEther(releasable));
        
        setVestingInfo({
          tokenId: tokenId.toString(),
          totalAmount: utils.formatEther(schedule.totalAmount),
          releasedAmount: utils.formatEther(schedule.releasedAmount),
          startTime: schedule.startTime.toNumber(),
          duration: schedule.duration.toNumber()
        });
        
        setReleasableAmount(utils.formatEther(releasable));
      } catch (error: any) {
        console.error('Error getting vesting NFT details:', error);
        setVestingInfo(null);
        setReleasableAmount('0');
        if (error.code === 'CALL_EXCEPTION') {
          console.log('This could be normal if you have not bought any tokens with vesting yet');
        }
      }
    } catch (error: any) {
      console.error('Error checking vesting info:', error);
      setVestingInfo(null);
      setReleasableAmount('0');
    }
  };

  const releaseTokens = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!vestingInfo?.tokenId) {
        throw new Error('No vesting NFT found');
      }

      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      const vestingContract = new ethers.Contract(VESTING_NFT_ADDRESS, VestingNFTABI, signer);

      console.log('Releasing tokens for NFT:', vestingInfo.tokenId);
      const tx = await vestingContract.release(vestingInfo.tokenId);
      
      console.log('Release transaction submitted:', tx.hash);
      setSuccess('Release transaction submitted. Waiting for confirmation...');
      
      await tx.wait();
      console.log('Release transaction confirmed');
      
      // Refresh vesting info and token balance
      await getVestingInfo(account);
      await getTokenBalance(account);
      
      setSuccess('Successfully released vested tokens!');
    } catch (error: any) {
      console.error('Error releasing tokens:', error);
      setError('Failed to release tokens: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const calculateTokenAmount = (ethAmount: string, isVesting: boolean): bigint => {
    const weiAmount = utils.parseEther(ethAmount);
    const pricePerToken = isVesting ? VESTING_PRICE : INSTANT_PRICE;
    
    // Calculate tokens the same way the contract does:
    // tokenAmount = (msg.value * 1e18) / PRICE
    return (BigInt(weiAmount.toString()) * BigInt(1e18)) / BigInt(pricePerToken.toString());
  };

  const buyTokens = async (withVesting: boolean = false) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (!ethAmount || parseFloat(ethAmount) <= 0) {
        throw new Error('Please enter a valid ETH amount');
      }

      // Verify network first
      if (!await verifyNetwork()) {
        return;
      }

      if (!hasMetaMask()) {
        throw new Error('Please install MetaMask to use this feature');
      }

      const provider = new providers.Web3Provider((window as any).ethereum);
      const signer = await provider.getSigner();
      
      // Check contract code exists
      console.log('Verifying contracts exist...');
      const tokenContract = new ethers.Contract(BTB_TOKEN_ADDRESS, BTBTokenABI, signer);
      const saleContract = new ethers.Contract(TOKEN_SALE_ADDRESS, TokenSaleABI, signer);

      // Check if token sale has enough tokens
      const tokenSaleBalance = await tokenContract.balanceOf(TOKEN_SALE_ADDRESS);
      console.log('Token sale balance:', utils.formatEther(tokenSaleBalance));

      // Convert amount to wei
      const weiAmount = utils.parseEther(ethAmount);
      console.log('Wei amount to send:', weiAmount.toString());
      
      // Calculate required tokens
      const requiredTokens = calculateTokenAmount(ethAmount, withVesting);
      console.log('Required tokens:', utils.formatEther(requiredTokens));
      
      if (tokenSaleBalance < requiredTokens) {
        throw new Error('Token sale contract does not have enough tokens to fulfill this purchase');
      }

      // Validate minimum payment
      const minPrice = withVesting ? VESTING_PRICE : INSTANT_PRICE;
      if (weiAmount < minPrice) {
        throw new Error(`Minimum payment required: ${utils.formatEther(minPrice)} ETH`);
      }

      console.log('Purchase parameters:', {
        ethAmount: ethAmount,
        weiAmount: weiAmount.toString(),
        requiredTokens: utils.formatEther(requiredTokens),
        withVesting
      });

      let gasEstimate: bigint | undefined;
      try {
        // First check if sale is active
        try {
          const isActive = await saleContract.isActive();
          if (!isActive) {
            throw new Error('Token sale is currently paused');
          }
        } catch (error: any) {
          console.log('Could not check if sale is active, proceeding anyway:', error);
        }

        // Estimate gas before sending transaction
        const options: TransactionRequest = {
          value: weiAmount,
          gasLimit: gasEstimate ? (gasEstimate * BigInt(120)) / BigInt(100) : undefined
        };

        try {
          if (withVesting) {
            gasEstimate = await saleContract.buyTokensVesting.estimateGas(options);
          } else {
            gasEstimate = await saleContract.buyTokensInstant.estimateGas(options);
          }
          if (gasEstimate) {
            console.log('Estimated gas:', gasEstimate.toString());
            
            // Add 20% buffer to gas estimate
            options.gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);
          }
        } catch (gasError: any) {
          console.error('Gas estimation failed:', gasError);
          // If gas estimation fails, set a high gas limit
          options.gasLimit = BigInt(500000);
        }

        let tx;
        if (withVesting) {
          console.log('Buying tokens with vesting...');
          tx = await saleContract.buyTokensVesting(options);
        } else {
          console.log('Buying tokens instantly...');
          tx = await saleContract.buyTokensInstant(options);
        }

        console.log('Transaction submitted:', tx.hash);
        setSuccess('Transaction submitted. Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        // Check if the transaction was successful
        if (receipt.status === 0) {
          throw new Error('Transaction failed during execution');
        }
        
        await getTokenBalance(account);
        if (withVesting) {
          await getVestingInfo(account);
        }
        
        setSuccess('Successfully purchased tokens!' + (withVesting ? ' Tokens are now vesting.' : ''));
        setEthAmount('');
        setTokenAmount('0');
      } catch (txError: any) {
        console.error('Transaction error:', {
          message: txError.message,
          code: txError.code,
          data: txError.data,
          receipt: txError.receipt
        });

        let errorMessage = 'Transaction failed: ';
        
        if (txError.message.includes('user rejected')) {
          errorMessage = 'You rejected the transaction.';
        } else if (txError.code === 'CALL_EXCEPTION') {
          errorMessage = 'Transaction reverted. This could be because:\n' +
                      '1. The sale is paused\n' +
                      '2. The payment amount is too low\n' +
                      '3. There are not enough tokens available\n' +
                      '4. You may need to increase your gas limit';
        } else if (txError.receipt?.status === 0) {
          errorMessage = 'Transaction failed during execution. Please check your wallet for details.';
        } else {
          errorMessage += txError.message || 'Unknown error';
        }

        setError(errorMessage);
        throw txError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Buy tokens error:', error);
      if (!error.message.includes('Transaction failed:')) {
        setError(error.message || 'Failed to buy tokens');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ethAmount && !isNaN(parseFloat(ethAmount))) {
      const tokens = calculateTokenAmount(ethAmount, false);
      setTokenAmount(utils.formatEther(tokens));
    } else {
      setTokenAmount('0');
    }
  }, [ethAmount]);

  useEffect(() => {
    if (ethAmount && !isNaN(parseFloat(ethAmount))) {
      const tokens = calculateTokenAmount(ethAmount, true);
      setVestingTokenAmount(utils.formatEther(tokens));
    } else {
      setVestingTokenAmount('0');
    }
  }, [ethAmount]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 mb-4 rounded-full bg-btb-primary/10 border border-btb-primary/20">
              <p className="text-sm font-medium text-btb-primary flex items-center">
                <ChartBarIcon className="h-4 w-4 mr-2" /> Live on Optimistic Sepolia
              </p>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent">
              Buy BTB Token
            </h1>
            <p className="text-lg mb-6 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Join the BTB ecosystem by purchasing BTB tokens. Choose between instant purchase or vesting options for long-term holders.
            </p>
          </div>

          {!account ? (
            <Card className="max-w-md mx-auto p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center mb-6">
                <WalletIcon className="h-12 w-12 text-btb-primary" />
              </div>
              <h2 className="text-xl font-semibold text-center mb-4">Connect Your Wallet</h2>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
                Connect your wallet to purchase BTB tokens and manage your holdings.
              </p>
              <Button
                onClick={() => connectWallet()}
                className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                disabled={loading}
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </Button>
            </Card>
          ) : (
            <div className="max-w-2xl mx-auto">
              {error && (
                <Alert className="mb-4 bg-red-100 border-red-400 text-red-700">
                  {error}
                </Alert>
              )}
              {success && (
                <Alert className="mb-4 bg-green-100 border-green-400 text-green-700">
                  {success}
                </Alert>
              )}
              
              <Card className="p-6 mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Purchase BTB Tokens</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ETH Amount
                    </label>
                    <Input
                      type="number"
                      value={ethAmount}
                      onChange={(e) => setEthAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full"
                      disabled={loading}
                    />
                  </div>
                  
                  <div className="flex justify-center">
                    <ArrowDownIcon className="h-6 w-6 text-gray-400" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      BTB Tokens to Receive
                    </label>
                    <Input
                      type="text"
                      value={tokenAmount}
                      readOnly
                      className="w-full bg-gray-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      onClick={() => buyTokens(false)}
                      className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                      disabled={loading || !ethAmount}
                    >
                      {loading ? 'Processing...' : 'Buy Instant'}
                    </Button>
                    <Button
                      onClick={() => buyTokens(true)}
                      className="w-full bg-btb-primary hover:bg-btb-primary-dark text-white"
                      disabled={loading || !ethAmount}
                    >
                      {loading ? 'Processing...' : 'Buy with Vesting'}
                    </Button>
                  </div>
                </div>
              </Card>

              {vestingInfo && (
                <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold mb-4">Vesting Status</h2>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-500">Total Amount</label>
                        <p className="font-semibold">{vestingInfo.totalAmount} BTB</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-500">Released Amount</label>
                        <p className="font-semibold">{vestingInfo.releasedAmount} BTB</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Releasable Amount</label>
                      <p className="font-semibold">{releasableAmount} BTB</p>
                    </div>
                    <Button
                      onClick={releaseTokens}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                      disabled={loading || parseFloat(releasableAmount) === 0}
                    >
                      {loading ? 'Processing...' : 'Release Available Tokens'}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
