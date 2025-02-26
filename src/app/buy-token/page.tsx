'use client';

import { useState, useEffect } from 'react';
import { ethers, utils, providers } from 'ethers';

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
    // Clear processing state after 3 seconds
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

      if (network.chainId !== BigInt(OPTIMISM_SEPOLIA_CHAIN_ID)) {
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

      if (network.chainId !== BigInt(OPTIMISM_SEPOLIA_CHAIN_ID)) {
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
      const txParams = {
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
        const rate = oneEth * BigInt(1e18) / currentPrice;
        setRate(rate.toString());

      } catch (contractError: any) {
        console.error('Contract call error:', {
          message: contractError.message,
          code: contractError.code,
          data: contractError.data
        });
        
        // Use fallback values
        console.log('Using fallback values for rates');
        setRate((BigInt(1e18) * BigInt(1e18) / INSTANT_PRICE).toString());
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
      setRate((BigInt(1e18) * BigInt(1e18) / INSTANT_PRICE).toString());
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
    return (weiAmount * BigInt(1e18)) / pricePerToken;
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
        const options: ethers.TransactionRequest = {
          value: weiAmount,
          gasLimit: gasEstimate ? (gasEstimate * BigInt(120)) / BigInt(100) : undefined
        };

        try {
          if (withVesting) {
            gasEstimate = await saleContract.buyTokensVesting.estimateGas(options);
          } else {
            gasEstimate = await saleContract.buyTokensInstant.estimateGas(options);
          }
          console.log('Estimated gas:', gasEstimate.toString());
          
          // Add 20% buffer to gas estimate
          options.gasLimit = gasEstimate ? (gasEstimate * BigInt(120)) / BigInt(100) : undefined;
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
    <div className="min-h-screen bg-gradient-to-br from-[#FF0420] via-[#FF0420]/80 to-[#FF0420] py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Buy BTB Tokens</h1>
          <p className="text-lg text-white/80">Join the BTB Finance ecosystem and be part of the future of DeFi</p>
        </div>

        {/* Wallet Section */}
        <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Your Wallet</h2>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <p className="text-white/80">
                {account && typeof account === 'string' ? 
                  `Connected: ${account.slice(0, 6)}...${account.slice(-4)}` : 
                  'Not Connected'}
              </p>
              <p className="text-xl font-bold text-white mt-2">BTB Balance: {tokenBalance} BTB</p>
            </div>
            {!account && (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className={`px-6 py-3 ${
                  isConnecting 
                    ? 'bg-gray-500' 
                    : 'bg-white text-[#FF0420] hover:bg-white/90'
                } rounded-lg font-semibold transition-colors`}
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        {/* Buy Tokens Section */}
        <div className="bg-black/20 backdrop-blur-lg rounded-xl p-6 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-6">Buy Tokens</h2>
          <div className="space-y-6">
            <div className="bg-black/30 rounded-lg p-4 border border-white/10 text-white">
              <p className="text-white/80 text-sm">Current Rate</p>
              <p className="text-xl font-bold text-white">{rate} BTB per ETH</p>
            </div>

            <div>
              <label className="block text-white/80 mb-2">ETH Amount</label>
              <input
                type="number"
                value={ethAmount}
                onChange={(e) => {
                  setEthAmount(e.target.value);
                  setTokenAmount(calculateTokenAmount(e.target.value, false).toString());
                }}
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:border-white/30"
                placeholder="0.0"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-white/80 mb-2">You Will Receive</label>
              <div className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white">
                {tokenAmount} BTB
              </div>
            </div>

            <div>
              <label className="block text-white/80 mb-2">Vesting Duration (days)</label>
              <input
                type="number"
                value={vestingDuration}
                onChange={(e) => setVestingDuration(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-black/30 border border-white/10 text-white placeholder-white/50 focus:outline-none focus:border-white/30"
                placeholder="Enter vesting duration in days"
                min="0"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => buyTokens(false)}
                disabled={loading || !account || !ethAmount}
                className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                  loading || !account || !ethAmount
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-white text-[#FF0420] hover:bg-white/90'
                }`}
              >
                Buy Tokens
              </button>
              <button
                onClick={() => buyTokens(true)}
                disabled={loading || !account || !ethAmount || !vestingDuration}
                className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-colors ${
                  loading || !account || !ethAmount || !vestingDuration
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-white text-[#FF0420] hover:bg-white/90'
                }`}
              >
                Buy with Vesting
              </button>
            </div>
            
            {vestingInfo && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold text-white mb-4">Vesting Information</h2>
                <div className="bg-black/30 rounded-lg p-4 border border-white/10 text-white">
                  <p className="mb-2">Total Vested Amount: {vestingInfo.totalAmount} BTB</p>
                  <p className="mb-2">Released Amount: {vestingInfo.releasedAmount} BTB</p>
                  <p className="mb-2">Start Time: {new Date(vestingInfo.startTime * 1000).toLocaleString()}</p>
                  <p className="mb-2">Duration: {vestingInfo.duration / (24 * 60 * 60)} days</p>
                  <p className="mb-4">Releasable Amount: {releasableAmount} BTB</p>
                  
                  <button
                    onClick={releaseTokens}
                    disabled={loading || parseFloat(releasableAmount) <= 0}
                    className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                      loading || parseFloat(releasableAmount) <= 0
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-white text-[#FF0420] hover:bg-white/90'
                    }`}
                  >
                    Release Available Tokens
                  </button>
                </div>
              </div>
            )}
            
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 bg-green-900/20 border border-green-500/50 rounded-lg text-green-200">
                {success}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
