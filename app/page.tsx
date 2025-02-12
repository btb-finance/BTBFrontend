'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
    connectWallet,
    getTokenSaleContract,
    formatEther,
    parseEther,
    setupTokenSale,
    calculateTokenAmount,
    INSTANT_PRICE,
    VESTING_PRICE,
    checkTokenSaleSetup,
    buyTokens
} from './utils/web3';

export default function Home() {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [estimatedTokens, setEstimatedTokens] = useState({ instant: '0', vesting: '0' });
    const [tokenSaleStatus, setTokenSaleStatus] = useState<{
        tokenSaleBalance: string;
        tokenOwner: string;
        saleOwner: string;
    } | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        setStatusLoading(true);
        try {
            const status = await checkTokenSaleSetup();
            setTokenSaleStatus(status);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Failed to check token sale status');
            setTokenSaleStatus(null);
        }
        setStatusLoading(false);
    };

    useEffect(() => {
        if (amount && !isNaN(Number(amount))) {
            try {
                const instantTokens = calculateTokenAmount(amount, false);
                const vestingTokens = calculateTokenAmount(amount, true);
                setEstimatedTokens({
                    instant: formatEther(instantTokens),
                    vesting: formatEther(vestingTokens)
                });
            } catch (err) {
                console.error('Error calculating tokens:', err);
            }
        } else {
            setEstimatedTokens({ instant: '0', vesting: '0' });
        }
    }, [amount]);

    const handleSetup = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const signer = await connectWallet();
            await setupTokenSale(signer);
            await checkStatus(); // Refresh status after setup
            setSuccess('Token sale setup completed successfully!');
        } catch (err: any) {
            setError(err.message || 'Failed to setup token sale');
        }
        setLoading(false);
    };

    const handleBuyInstant = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            // Check if token sale is set up
            if (!tokenSaleStatus) {
                throw new Error('Token sale is not set up yet. Please wait for admin to set it up.');
            }

            if (!amount || Number(amount) < Number(formatEther(INSTANT_PRICE))) {
                throw new Error(`Minimum amount is ${formatEther(INSTANT_PRICE)} ETH`);
            }

            await buyTokens(amount, false);
            await checkStatus(); // Refresh status after purchase
            setSuccess(`Successfully purchased ${estimatedTokens.instant} BTB tokens!`);
            setAmount('');
        } catch (err: any) {
            setError(err.message || 'Failed to purchase tokens');
        }
        setLoading(false);
    };

    const handleBuyVesting = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            // Check if token sale is set up
            if (!tokenSaleStatus) {
                throw new Error('Token sale is not set up yet. Please wait for admin to set it up.');
            }

            if (!amount || Number(amount) < Number(formatEther(VESTING_PRICE))) {
                throw new Error(`Minimum amount is ${formatEther(VESTING_PRICE)} ETH`);
            }

            await buyTokens(amount, true);
            await checkStatus(); // Refresh status after purchase
            setSuccess(`Successfully created vesting schedule for ${estimatedTokens.vesting} BTB tokens!`);
            setAmount('');
        } catch (err: any) {
            setError(err.message || 'Failed to create vesting schedule');
        }
        setLoading(false);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
                <h1 className="text-4xl font-bold mb-8 text-center">BTB Token Sale</h1>
                
                {/* Token Sale Status */}
                <div className="mb-8 p-6 border rounded-lg bg-gray-50">
                    <h2 className="text-xl font-semibold mb-4">Token Sale Status</h2>
                    {statusLoading ? (
                        <p>Checking token sale status...</p>
                    ) : tokenSaleStatus ? (
                        <div>
                            <div className="mb-4">
                                <p className={tokenSaleStatus.tokenSaleBalance === '0' ? 'text-red-600' : 'text-green-600'}>
                                    {tokenSaleStatus.tokenSaleBalance === '0' ? '✗' : '✓'} Available Tokens: {tokenSaleStatus.tokenSaleBalance} BTB
                                </p>
                            </div>
                            <div className="text-sm text-gray-600">
                                <p>BTB Token Owner: {tokenSaleStatus.tokenOwner}</p>
                                <p>Token Sale Owner: {tokenSaleStatus.saleOwner}</p>
                            </div>
                            {tokenSaleStatus.tokenSaleBalance === '0' && (
                                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
                                    <p className="text-yellow-700">
                                        The token sale needs to be set up by the BTB token owner. If you are the owner, please use the setup button below.
                                    </p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-red-600">✗ Token sale is not set up yet</p>
                    )}
                </div>
                
                {/* Admin Setup Section */}
                <div className="mb-8 p-6 border rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4">Admin Setup</h2>
                    <p className="mb-4 text-sm text-gray-600">
                        Only the BTB token owner can set up the token sale. The setup process will:
                        <br />1. Transfer 50% of your BTB tokens to the sale contract
                        <br />2. These tokens will be available for both instant and vesting purchases
                    </p>
                    <button
                        onClick={handleSetup}
                        disabled={loading}
                        className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
                    >
                        {loading ? 'Setting up...' : 'Setup Token Sale'}
                    </button>
                </div>

                {/* Purchase Form */}
                <div className="mb-8 p-6 border rounded-lg">
                    <h2 className="text-2xl font-semibold mb-4">Purchase Tokens</h2>
                    
                    {/* Price Information */}
                    <div className="mb-4 text-sm">
                        <p>Instant Price: {formatEther(INSTANT_PRICE)} ETH per token</p>
                        <p>Vesting Price: {formatEther(VESTING_PRICE)} ETH per token (50% discount)</p>
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">
                            Amount (ETH)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-2 border rounded text-black"
                            placeholder={formatEther(INSTANT_PRICE)}
                            step={formatEther(VESTING_PRICE)}
                            min={formatEther(VESTING_PRICE)}
                            disabled={!tokenSaleStatus || tokenSaleStatus.tokenSaleBalance === '0'}
                        />
                    </div>

                    {/* Estimated Tokens */}
                    {amount && !isNaN(Number(amount)) && (
                        <div className="mb-4 text-sm">
                            <p>Estimated tokens (Instant): {estimatedTokens.instant} BTB</p>
                            <p>Estimated tokens (Vesting): {estimatedTokens.vesting} BTB</p>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            onClick={handleBuyInstant}
                            disabled={loading || !amount || !tokenSaleStatus || tokenSaleStatus.tokenSaleBalance === '0'}
                            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Buy Instant'}
                        </button>
                        <button
                            onClick={handleBuyVesting}
                            disabled={loading || !amount || !tokenSaleStatus || tokenSaleStatus.tokenSaleBalance === '0'}
                            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : 'Buy with Vesting'}
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {error && (
                    <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="p-4 mb-4 text-green-700 bg-green-100 rounded-lg">
                        {success}
                    </div>
                )}
            </div>
        </main>
    );
}
