'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Loader2, ArrowRightLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState<'mint' | 'redeem'>('mint');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

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
            setSuccess('Transaction confirmed successfully!');
            toast.success('Transaction confirmed successfully!');
            setAmount('');
            refetchBtb();
            refetchBtbt();
            refetchAllowance();
        }
    }, [isConfirmed, refetchBtb, refetchBtbt, refetchAllowance]);

    useEffect(() => {
        if (writeError) {
            setError(`Transaction failed: ${writeError.message}`);
            toast.error(`Transaction failed: ${writeError.message}`);
        }
    }, [writeError]);

    // Clear messages on tab change
    useEffect(() => {
        setError(null);
        setSuccess(null);
    }, [activeTab]);

    // Handlers
    const handleApprove = () => {
        if (!amount) return;
        try {
            setError(null);
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
            setError(null);
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
            setError(null);
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

    const handlePercentage = (percentage: number) => {
        const balance = activeTab === 'mint' ? btbBalance : btbtBalance;
        if (balance) {
            const amt = (BigInt(balance) * BigInt(percentage)) / 100n;
            setAmount(formatEther(amt));
        }
    };

    // Helper to format balance
    const formatBalance = (bal: bigint | undefined) => {
        if (!bal) return '0.00';
        const num = parseFloat(formatEther(bal));
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    const needsApproval = activeTab === 'mint' &&
        allowance !== undefined &&
        amount &&
        allowance < parseEther(amount);

    return (
        <div className="space-y-6">
            {/* Balance Info Banner */}
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2 border-blue-200 dark:border-blue-800/50">
                <CardContent className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                {formatBalance(btbBalance)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">BTB Balance</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {formatBalance(btbtBalance)}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">BTBT Balance</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Trading Interface */}
            <Card className="border-2 border-blue-200 dark:border-blue-800/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                        BTB ⇄ BTBT (Ardeem)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'mint' | 'redeem')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="mint" className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Mint BTBT
                            </TabsTrigger>
                            <TabsTrigger value="redeem" className="flex items-center gap-2">
                                <TrendingDown className="w-4 h-4" />
                                Redeem BTB
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="mint" className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">BTB Amount</label>
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={amount}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                                    disabled={!isConnected || isPending || isConfirming}
                                />
                                <div className="space-y-2 mt-1">
                                    <div className="text-xs text-gray-500 text-right">
                                        Balance: {formatBalance(btbBalance)} BTB
                                    </div>
                                    <div className="flex gap-2">
                                        {[25, 50, 75, 100].map((percent) => (
                                            <button
                                                key={percent}
                                                onClick={() => handlePercentage(percent)}
                                                disabled={!btbBalance}
                                                className="flex-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {percent === 100 ? 'MAX' : `${percent}%`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">BTBT to Receive</label>
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={amount}
                                    readOnly
                                    className="bg-gray-50 dark:bg-gray-800"
                                />
                                <div className="text-xs text-gray-500">1:1 ratio - No fees on minting</div>
                            </div>
                            {needsApproval ? (
                                <Button
                                    onClick={handleApprove}
                                    disabled={!isConnected || !amount || isPending || isConfirming}
                                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                                >
                                    {isPending || isConfirming ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Confirming...
                                        </>
                                    ) : !isConnected ? (
                                        'Connect Wallet'
                                    ) : (
                                        'Approve BTB'
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleMint}
                                    disabled={!isConnected || !amount || isPending || isConfirming}
                                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                                >
                                    {isPending || isConfirming ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Confirming...
                                        </>
                                    ) : !isConnected ? (
                                        'Connect Wallet to Mint'
                                    ) : (
                                        'Mint BTBT'
                                    )}
                                </Button>
                            )}
                        </TabsContent>

                        <TabsContent value="redeem" className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">BTBT Amount</label>
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={amount}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                                    disabled={!isConnected || isPending || isConfirming}
                                />
                                <div className="space-y-2 mt-1">
                                    <div className="text-xs text-gray-500 text-right">
                                        Balance: {formatBalance(btbtBalance)} BTBT
                                    </div>
                                    <div className="flex gap-2">
                                        {[25, 50, 75, 100].map((percent) => (
                                            <button
                                                key={percent}
                                                onClick={() => handlePercentage(percent)}
                                                disabled={!btbtBalance}
                                                className="flex-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {percent === 100 ? 'MAX' : `${percent}%`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">BTB to Receive</label>
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={amount}
                                    readOnly
                                    className="bg-gray-50 dark:bg-gray-800"
                                />
                                <div className="text-xs text-gray-500">1:1 ratio - No fees on redeeming</div>
                            </div>
                            <Button
                                onClick={handleRedeem}
                                disabled={!isConnected || !amount || isPending || isConfirming}
                                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                            >
                                {isPending || isConfirming ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Confirming...
                                    </>
                                ) : !isConnected ? (
                                    'Connect Wallet to Redeem'
                                ) : (
                                    'Redeem BTB'
                                )}
                            </Button>
                        </TabsContent>
                    </Tabs>

                    {/* Messages */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success && (
                        <Alert className="bg-green-50 border-green-500">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                    )}

                    {/* Info Badges */}
                    <div className="flex flex-wrap gap-2 pt-4">
                        <Badge variant="secondary" className="flex items-center gap-1">
                            <ArrowRightLeft className="w-3 h-3" />
                            1:1 Mint/Redeem Ratio
                        </Badge>
                        <Badge variant="secondary" className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            1% tax on BTBT transfers only
                        </Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
