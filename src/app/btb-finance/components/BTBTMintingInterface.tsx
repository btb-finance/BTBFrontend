'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Loader2, ArrowRightLeft, Wallet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

// Contract Addresses
const BTBT_CONTRACT = '0x88888adda3AEd5Ca9CC7b1125Fb8A0A8208a8f65';
const BTB_CONTRACT = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';

// ABIs
const BTBT_ABI = [
    {
        "inputs": [{ "internalType": "uint256", "name": "btbAmount", "type": "uint256" }],
        "name": "mint",
        "outputs": [{ "internalType": "uint256", "name": "btbtAmount", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "uint256", "name": "btbtAmount", "type": "uint256" }],
        "name": "redeem",
        "outputs": [{ "internalType": "uint256", "name": "btbAmount", "type": "uint256" }],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

const ERC20_ABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "spender", "type": "address" },
            { "internalType": "uint256", "name": "value", "type": "uint256" }
        ],
        "name": "approve",
        "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            { "internalType": "address", "name": "owner", "type": "address" },
            { "internalType": "address", "name": "spender", "type": "address" }
        ],
        "name": "allowance",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
        "name": "balanceOf",
        "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

export function BTBTMintingInterface() {
    const { address, isConnected } = useAccount();
    const [amount, setAmount] = useState('');
    const [activeTab, setActiveTab] = useState('mint');

    // Contract Writes
    const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

    // Transaction Receipt
    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    });

    // Reads
    const { data: btbBalance, refetch: refetchBtb } = useReadContract({
        address: BTB_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const { data: btbtBalance, refetch: refetchBtbt } = useReadContract({
        address: BTBT_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
    });

    const { data: allowance, refetch: refetchAllowance } = useReadContract({
        address: BTB_CONTRACT,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, BTBT_CONTRACT] : undefined,
    });

    // Effects
    useEffect(() => {
        if (isConfirmed) {
            toast.success('Transaction confirmed successfully!');
            setAmount('');
            refetchBtb();
            refetchBtbt();
            refetchAllowance();
        }
    }, [isConfirmed, refetchBtb, refetchBtbt, refetchAllowance]);

    useEffect(() => {
        if (writeError) {
            toast.error(`Transaction failed: ${writeError.message}`);
        }
    }, [writeError]);

    // Handlers
    const handleApprove = () => {
        if (!amount) return;
        try {
            writeContract({
                address: BTB_CONTRACT,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [BTBT_CONTRACT, parseEther(amount)],
            });
        } catch (err) {
            console.error('Approval error:', err);
        }
    };

    const handleMint = () => {
        if (!amount) return;
        try {
            writeContract({
                address: BTBT_CONTRACT,
                abi: BTBT_ABI,
                functionName: 'mint',
                args: [parseEther(amount)],
            });
        } catch (err) {
            console.error('Mint error:', err);
        }
    };

    const handleRedeem = () => {
        if (!amount) return;
        try {
            writeContract({
                address: BTBT_CONTRACT,
                abi: BTBT_ABI,
                functionName: 'redeem',
                args: [parseEther(amount)],
            });
        } catch (err) {
            console.error('Redeem error:', err);
        }
    };

    const handleMax = () => {
        if (activeTab === 'mint' && btbBalance) {
            setAmount(formatEther(btbBalance));
        } else if (activeTab === 'redeem' && btbtBalance) {
            setAmount(formatEther(btbtBalance));
        }
    };

    // Helper to format balance
    const formatBalance = (bal: bigint | undefined) => {
        if (!bal) return '0.00';
        return parseFloat(formatEther(bal)).toLocaleString(undefined, { maximumFractionDigits: 4 });
    };

    const needsApproval = activeTab === 'mint' &&
        allowance !== undefined &&
        amount &&
        allowance < parseEther(amount);

    return (
        <Card className="w-full bg-white/5 dark:bg-black/20 backdrop-blur-xl border-white/10 shadow-2xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    <ArrowRightLeft className="w-6 h-6 text-blue-400" />
                    BTB ⇄ BTBT (Ardeem)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="mint" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-black/20">
                        <TabsTrigger value="mint" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            Mint BTBT
                        </TabsTrigger>
                        <TabsTrigger value="redeem" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                            Redeem BTB
                        </TabsTrigger>
                    </TabsList>

                    <div className="space-y-6">
                        {/* Balance Display */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <div className="text-sm text-blue-400 mb-1">BTB Balance</div>
                                <div className="text-xl font-bold text-white">{formatBalance(btbBalance)}</div>
                            </div>
                            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <div className="text-sm text-purple-400 mb-1">BTBT Balance</div>
                                <div className="text-xl font-bold text-white">{formatBalance(btbtBalance)}</div>
                            </div>
                        </div>

                        {/* Input Section */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Amount</span>
                                <button
                                    onClick={handleMax}
                                    className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                                >
                                    MAX
                                </button>
                            </div>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                                    className="bg-black/20 border-white/10 text-lg h-12 pr-16"
                                />
                                <div className="absolute right-3 top-3 text-sm font-bold text-gray-500">
                                    {activeTab === 'mint' ? 'BTB' : 'BTBT'}
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        {!isConnected ? (
                            <Button className="w-full h-12 bg-gray-700 hover:bg-gray-600" disabled>
                                <Wallet className="w-4 h-4 mr-2" />
                                Connect Wallet
                            </Button>
                        ) : (
                            <div className="space-y-3">
                                {needsApproval ? (
                                    <Button
                                        className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 font-bold text-lg"
                                        onClick={handleApprove}
                                        disabled={isPending || isConfirming}
                                    >
                                        {isPending || isConfirming ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : null}
                                        Approve BTB
                                    </Button>
                                ) : (
                                    <Button
                                        className={`w-full h-12 font-bold text-lg ${activeTab === 'mint'
                                            ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
                                            : 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600'
                                            }`}
                                        onClick={activeTab === 'mint' ? handleMint : handleRedeem}
                                        disabled={isPending || isConfirming || !amount}
                                    >
                                        {isPending || isConfirming ? (
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        ) : (
                                            <RefreshCw className="w-5 h-5 mr-2" />
                                        )}
                                        {activeTab === 'mint' ? 'Mint BTBT' : 'Redeem BTB'}
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Info Text */}
                        <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                            {activeTab === 'mint'
                                ? 'Minting BTBT is 1:1. No tax on minting.'
                                : 'Redeeming BTBT is 1:1. No tax on redeeming.'}
                            <br />
                            <span className="opacity-70">BTBT transfers incur a 1% tax.</span>
                        </div>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}
