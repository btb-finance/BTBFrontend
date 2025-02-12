import { ethers } from 'ethers';
import { BTBTokenABI } from '../contracts/BTBToken';
import { TokenSaleABI } from '../contracts/TokenSale';
import { VestingNFTABI } from '../contracts/VestingNFT';

// Optimistic Sepolia deployed contract addresses
export const BTB_TOKEN_ADDRESS = '0x31e17E48956B05F5db4Cc5B6f8291897724918E1';
export const TOKEN_SALE_ADDRESS = '0x7398e9CBa26b47771aB45a05915CcAc8740709CF';
export const VESTING_NFT_ADDRESS = '0x4aa2b35ae4f758d555561111a123F7181257fb07';

// Price per token in ETH - MUST match contract constants exactly
export const INSTANT_PRICE = ethers.parseEther('0.000001');   // 0.000001 ETH per token
export const VESTING_PRICE = ethers.parseEther('0.0000005');  // 0.0000005 ETH per token (50% discount)
export const VESTING_DURATION = 365 * 24 * 60 * 60; // 365 days in seconds

export const getWeb3Provider = () => {
    if (typeof window === 'undefined') return null;
    if (!window.ethereum) return null;
    return new ethers.BrowserProvider(window.ethereum);
};

export const connectWallet = async () => {
    const provider = getWeb3Provider();
    if (!provider) {
        throw new Error('Please install MetaMask to use this feature');
    }

    try {
        const signer = await provider.getSigner();
        return signer;
    } catch (error) {
        console.error('Failed to get signer:', error);
        throw new Error('Please connect your wallet');
    }
};

export const getBTBTokenContract = (signerOrProvider: ethers.Signer | ethers.Provider) => {
    return new ethers.Contract(
        BTB_TOKEN_ADDRESS,
        BTBTokenABI,
        signerOrProvider
    );
};

export const getTokenSaleContract = (signerOrProvider: ethers.Signer | ethers.Provider) => {
    return new ethers.Contract(
        TOKEN_SALE_ADDRESS,
        TokenSaleABI,
        signerOrProvider
    );
};

export const getVestingNFTContract = (signerOrProvider: ethers.Signer | ethers.Provider) => {
    return new ethers.Contract(
        VESTING_NFT_ADDRESS,
        VestingNFTABI,
        signerOrProvider
    );
};

export const formatEther = (wei: bigint): string => {
    return ethers.formatEther(wei);
};

export const parseEther = (ether: string): bigint => {
    return ethers.parseEther(ether);
};

// Helper function to calculate token amount for a given ETH amount
export const calculateTokenAmount = (ethAmount: string, isVesting: boolean): bigint => {
    const weiAmount = ethers.parseUnits(ethAmount, 'ether');
    const pricePerToken = isVesting ? VESTING_PRICE : INSTANT_PRICE;
    
    // Calculate tokens the same way the contract does:
    // tokenAmount = (msg.value * 1e18) / PRICE
    return (weiAmount * BigInt(1e18)) / pricePerToken;
};

export const checkTokenSaleSetup = async () => {
    const provider = getWeb3Provider();
    if (!provider) throw new Error('Please install MetaMask to use this feature');

    const tokenSaleContract = getTokenSaleContract(provider);
    const tokenContract = getBTBTokenContract(provider);

    // Get token sale balance
    const tokenSaleBalance = await tokenContract.balanceOf(TOKEN_SALE_ADDRESS);
    
    // Get token owner and sale owner
    const tokenOwner = await tokenContract.owner();
    const saleOwner = await tokenSaleContract.owner();

    // Get token contract address from sale contract
    const btbTokenAddress = await tokenSaleContract.btbToken();
    console.log('Contract Setup:', {
        tokenSaleBalance: formatEther(tokenSaleBalance),
        tokenOwner,
        saleOwner,
        btbTokenAddress,
        expectedTokenAddress: BTB_TOKEN_ADDRESS
    });

    if (btbTokenAddress.toLowerCase() !== BTB_TOKEN_ADDRESS.toLowerCase()) {
        throw new Error('Token sale contract is not properly initialized with BTB token');
    }

    return {
        tokenSaleBalance: formatEther(tokenSaleBalance),
        tokenOwner,
        saleOwner
    };
};

export const setupTokenSale = async (signer: ethers.Signer) => {
    const tokenContract = getBTBTokenContract(signer);
    const signerAddress = await signer.getAddress();
    
    // Check if signer is the token owner
    const tokenOwner = await tokenContract.owner();
    if (tokenOwner.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error('Only the token owner can set up the token sale');
    }

    // Get token balance
    const balance = await tokenContract.balanceOf(signerAddress);
    if (balance === BigInt(0)) {
        throw new Error('You have no BTB tokens to transfer');
    }

    // Transfer 50% of tokens to the token sale contract
    const transferAmount = balance / BigInt(2);
    console.log('Transferring tokens:', {
        from: signerAddress,
        to: TOKEN_SALE_ADDRESS,
        amount: formatEther(transferAmount)
    });

    try {
        const tx = await tokenContract.transfer(TOKEN_SALE_ADDRESS, transferAmount);
        console.log('Transfer transaction:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transfer confirmed:', receipt);
    } catch (error) {
        console.error('Transfer failed:', error);
        throw new Error('Failed to transfer tokens to the token sale contract');
    }
};

export const buyTokens = async (amount: string, isVesting: boolean) => {
    const signer = await connectWallet();
    const tokenSaleContract = getTokenSaleContract(signer);
    const tokenContract = getBTBTokenContract(signer);
    const signerAddress = await signer.getAddress();

    console.log('Buying tokens with params:', {
        isVesting,
        amount,
        signerAddress,
        tokenSaleAddress: TOKEN_SALE_ADDRESS
    });

    // Check if token sale has enough tokens
    const tokenSaleBalance = await tokenContract.balanceOf(TOKEN_SALE_ADDRESS);
    console.log('Token sale balance:', formatEther(tokenSaleBalance));

    // Convert amount to wei, making sure to handle decimal places correctly
    const weiAmount = ethers.parseUnits(amount, 'ether');
    console.log('Wei amount:', weiAmount.toString());
    
    // Calculate required tokens
    const requiredTokens = calculateTokenAmount(amount, isVesting);
    console.log('Required tokens:', formatEther(requiredTokens));
    
    if (tokenSaleBalance < requiredTokens) {
        throw new Error('Token sale contract does not have enough tokens to fulfill this purchase');
    }

    // Validate minimum payment
    const minPrice = isVesting ? VESTING_PRICE : INSTANT_PRICE;
    if (weiAmount < minPrice) {
        throw new Error(`Minimum payment required: ${formatEther(minPrice)} ETH`);
    }

    console.log('Sending ETH:', formatEther(weiAmount));
    console.log('Price per token:', formatEther(minPrice));
    console.log('Expected tokens:', formatEther(requiredTokens));

    try {
        const tx = isVesting ? 
            await tokenSaleContract.buyTokensVesting({ value: weiAmount }) : 
            await tokenSaleContract.buyTokensInstant({ value: weiAmount });
        
        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);
        
        return tx;
    } catch (error: any) {
        console.error('Transaction failed:', error);
        if (error.data) {
            console.error('Error data:', error.data);
        }
        throw error;
    }
};

// Export all functions as a default object
const web3 = {
    connectWallet,
    getBTBTokenContract,
    getTokenSaleContract,
    getVestingNFTContract,
    formatEther,
    parseEther,
    calculateTokenAmount,
    checkTokenSaleSetup,
    setupTokenSale,
    buyTokens,
    INSTANT_PRICE,
    VESTING_PRICE
};

export default web3;
