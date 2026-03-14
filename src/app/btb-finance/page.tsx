'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther, parseUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Alert, AlertDescription } from '../components/ui/alert';

import {
  Loader2,
  ExternalLink,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Coins,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════
//                    ETH MAINNET CONTRACT ADDRESSES
// ═══════════════════════════════════════════════════════════════════════
const CONTRACTS = {
  BTB_FINANCE: '0x88888888c90CD71B35830daBFD24743DbC135B51' as const,
  BTB_BEAR: '0x88888880d5Ca13018D2dC11e2e4744BD91a5656f' as const,
  BEAR_NFT: '0x88888888aBa934ceA0b4f0000FeA62F1397D02A0' as const,
  BEAR_STAKING: '0x8888888Faf81E6a98deb2B90A05B46b6E903e927' as const,
};

const CHAIN_ID = 1; // Ethereum Mainnet

// ═══════════════════════════════════════════════════════════════════════
//                              ABIs
// ═══════════════════════════════════════════════════════════════════════

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const BTB_BEAR_ABI = [
  ...ERC20_ABI,
  {
    inputs: [{ name: 'btbAmount', type: 'uint256' }],
    name: 'mint',
    outputs: [{ name: 'btbbAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'btbbAmount', type: 'uint256' }],
    name: 'redeem',
    outputs: [{ name: 'btbAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getStats',
    outputs: [
      { name: 'btbBalance', type: 'uint256' },
      { name: 'btbbSupply', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pendingFees',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'previewTransfer',
    outputs: [
      { name: 'netAmount', type: 'uint256' },
      { name: 'taxAmount', type: 'uint256' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
] as const;

const BEAR_NFT_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'buyNFT',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pricePerNFT',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MAX_SUPPLY',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'remainingSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'getPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

const BEAR_STAKING_ABI = [
  {
    inputs: [],
    name: 'getStats',
    outputs: [
      { name: '_totalStaked', type: 'uint256' },
      { name: '_totalRewardsDistributed', type: 'uint256' },
      { name: '_pendingToCollect', type: 'uint256' },
      { name: '_rewardsLast24h', type: 'uint256' },
      { name: '_estimatedAPR', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_user', type: 'address' }],
    name: 'pendingRewards',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_user', type: 'address' }],
    name: 'pendingRewardsNet',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_user', type: 'address' }],
    name: 'stakedCountOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalStaked',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenIds', type: 'uint256[]' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'count', type: 'uint256' }],
    name: 'unstake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const ERC721_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════
//                          HELPERS
// ═══════════════════════════════════════════════════════════════════════

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatNumber(n: number, decimals = 2) {
  return n.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
}



// ═══════════════════════════════════════════════════════════════════════
//                          PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function BTBFinancePage() {
  const { address, isConnected } = useAccount();
  const [wrapAmount, setWrapAmount] = useState('');
  const [wrapTab, setWrapTab] = useState<'mint' | 'redeem'>('mint');
  const [nftAmount, setNftAmount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stakeTokenIds, setStakeTokenIds] = useState('');
  const [unstakeCount, setUnstakeCount] = useState('1');

  // ── BTB Token Reads ──
  const { data: btbBalance } = useReadContract({
    address: CONTRACTS.BTB_FINANCE,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
  });

  const { data: btbTotalSupply } = useReadContract({
    address: CONTRACTS.BTB_FINANCE,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    chainId: CHAIN_ID,
  });

  // ── BTB Bear Reads ──
  const { data: btbbBalance } = useReadContract({
    address: CONTRACTS.BTB_BEAR,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
  });

  const { data: btbbStats } = useReadContract({
    address: CONTRACTS.BTB_BEAR,
    abi: BTB_BEAR_ABI,
    functionName: 'getStats',
    chainId: CHAIN_ID,
  });

  const { data: btbbPendingFees } = useReadContract({
    address: CONTRACTS.BTB_BEAR,
    abi: BTB_BEAR_ABI,
    functionName: 'pendingFees',
    chainId: CHAIN_ID,
  });

  const { data: btbAllowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.BTB_FINANCE,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACTS.BTB_BEAR] : undefined,
    chainId: CHAIN_ID,
  });

  // ── Bear NFT Reads ──
  const { data: nftTotalSupply } = useReadContract({
    address: CONTRACTS.BEAR_NFT,
    abi: BEAR_NFT_ABI,
    functionName: 'totalSupply',
    chainId: CHAIN_ID,
  });

  const { data: nftPrice } = useReadContract({
    address: CONTRACTS.BEAR_NFT,
    abi: BEAR_NFT_ABI,
    functionName: 'pricePerNFT',
    chainId: CHAIN_ID,
  });

  const { data: nftRemaining } = useReadContract({
    address: CONTRACTS.BEAR_NFT,
    abi: BEAR_NFT_ABI,
    functionName: 'remainingSupply',
    chainId: CHAIN_ID,
  });

  const { data: userNftBalance } = useReadContract({
    address: CONTRACTS.BEAR_NFT,
    abi: BEAR_NFT_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
  });

  // ── Staking Reads ──
  const { data: stakingStats } = useReadContract({
    address: CONTRACTS.BEAR_STAKING,
    abi: BEAR_STAKING_ABI,
    functionName: 'getStats',
    chainId: CHAIN_ID,
  });

  const { data: userStakedCount } = useReadContract({
    address: CONTRACTS.BEAR_STAKING,
    abi: BEAR_STAKING_ABI,
    functionName: 'stakedCountOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
  });

  const { data: userPendingRewards } = useReadContract({
    address: CONTRACTS.BEAR_STAKING,
    abi: BEAR_STAKING_ABI,
    functionName: 'pendingRewardsNet',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
  });

  const { data: isNftApprovedForStaking, refetch: refetchNftApproval } = useReadContract({
    address: CONTRACTS.BEAR_NFT,
    abi: ERC721_ABI,
    functionName: 'isApprovedForAll',
    args: address ? [address, CONTRACTS.BEAR_STAKING] : undefined,
    chainId: CHAIN_ID,
  });

  const { data: ethBalance } = useBalance({ address });

  // ── Fetch User NFTs for Staking ──
  const userNftCount = userNftBalance ? Number(userNftBalance) : 0;
  
  const tokenOfOwnerContracts = useMemo(() => {
    if (!address || userNftCount === 0) return [];
    
    const contracts = [];
    for (let i = 0; i < userNftCount; i++) {
      contracts.push({
        address: CONTRACTS.BEAR_NFT,
        abi: BEAR_NFT_ABI as any,
        functionName: 'tokenOfOwnerByIndex',
        args: [address, BigInt(i)],
        chainId: CHAIN_ID,
      });
    }
    return contracts;
  }, [address, userNftCount]);

  const { data: userNftData } = useReadContracts({
    contracts: tokenOfOwnerContracts,
  });

  const ownedTokenIds = useMemo(() => {
    if (!userNftData) return [];
    return userNftData
      .filter((result) => result.status === 'success')
      .map((result) => result.result as bigint);
  }, [userNftData]);

  // Handle NFT selection
  const [selectedToStake, setSelectedToStake] = useState<bigint[]>([]);
  
  const toggleNftSelection = (tokenId: bigint) => {
    setSelectedToStake(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };
  
  const selectAllNfts = () => {
    setSelectedToStake(ownedTokenIds);
  };
  
  const clearSelection = () => {
    setSelectedToStake([]);
  };

  useEffect(() => {
    if (selectedToStake.length > 0) {
      setStakeTokenIds(selectedToStake.join(', '));
    } else {
      setStakeTokenIds('');
    }
  }, [selectedToStake]);
  
  // ── Writes ──
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Clear selection after successful tx
  useEffect(() => {
    if (isConfirmed) {
      setSelectedToStake([]);
    }
  }, [isConfirmed]);

  // ── Effects ──
  useEffect(() => {
    if (isConfirmed) {
      setSuccess('Transaction confirmed!');
      setWrapAmount('');
      setNftAmount('1');
      setStakeTokenIds('');
      setUnstakeCount('1');
      refetchAllowance();
      refetchNftApproval();
    }
  }, [isConfirmed, refetchAllowance, refetchNftApproval]);

  useEffect(() => {
    if (writeError) {
      setError(writeError.message || 'Transaction failed');
    }
  }, [writeError]);

  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [wrapTab]);

  // ── Handlers ──
  const needsApproval =
    wrapTab === 'mint' &&
    wrapAmount &&
    btbAllowance !== undefined &&
    btbAllowance < parseEther(wrapAmount || '0');

  const handleApprove = () => {
    if (!wrapAmount) return;
    writeContract({
      address: CONTRACTS.BTB_FINANCE,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.BTB_BEAR, parseEther(wrapAmount)],
    });
  };

  const handleMintBTBB = () => {
    if (!wrapAmount) return;
    writeContract({
      address: CONTRACTS.BTB_BEAR,
      abi: BTB_BEAR_ABI,
      functionName: 'mint',
      args: [parseEther(wrapAmount)],
    });
  };

  const handleRedeemBTBB = () => {
    if (!wrapAmount) return;
    writeContract({
      address: CONTRACTS.BTB_BEAR,
      abi: BTB_BEAR_ABI,
      functionName: 'redeem',
      args: [parseEther(wrapAmount)],
    });
  };

  const handleBuyNFT = () => {
    const amount = parseInt(nftAmount);
    if (!amount || !nftPrice) return;
    const totalPrice = (nftPrice as bigint) * BigInt(amount);
    writeContract({
      address: CONTRACTS.BEAR_NFT,
      abi: BEAR_NFT_ABI,
      functionName: 'buyNFT',
      args: [BigInt(amount)],
      value: totalPrice,
    });
  };

  const handleApproveNFTForStaking = () => {
    writeContract({
      address: CONTRACTS.BEAR_NFT,
      abi: ERC721_ABI,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.BEAR_STAKING, true],
    });
  };

  const handleStake = () => {
    const ids = stakeTokenIds.split(',').map(s => s.trim()).filter(Boolean).map(s => BigInt(s));
    if (ids.length === 0) return;
    writeContract({
      address: CONTRACTS.BEAR_STAKING,
      abi: BEAR_STAKING_ABI,
      functionName: 'stake',
      args: [ids],
    });
  };

  const handleUnstake = () => {
    const count = parseInt(unstakeCount);
    if (!count || count < 1) return;
    writeContract({
      address: CONTRACTS.BEAR_STAKING,
      abi: BEAR_STAKING_ABI,
      functionName: 'unstake',
      args: [BigInt(count)],
    });
  };

  const handleClaimRewards = () => {
    writeContract({
      address: CONTRACTS.BEAR_STAKING,
      abi: BEAR_STAKING_ABI,
      functionName: 'claim',
      args: [],
    });
  };

  const handleWrapPercentage = (pct: number) => {
    const balance = wrapTab === 'mint' ? btbBalance : btbbBalance;
    if (balance) {
      const amt = (BigInt(balance as bigint) * BigInt(pct)) / 100n;
      setWrapAmount(formatEther(amt));
    }
  };

  const fmtBal = (b: bigint | undefined) => (b ? formatNumber(parseFloat(formatEther(b))) : '0.00');

  return (
    <div className="container mx-auto px-2 sm:px-4 py-8 min-h-screen">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        {/* ━━━ Header ━━━ */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
            BTB Finance — Ethereum Mainnet
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
            ERC20 Token • Wrapped BTBB (1% Tax) • Bear NFT • Staking Rewards
          </p>
        </div>



        {/* ━━━ Token Stats ━━━ */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-2 border-purple-200 dark:border-purple-800/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {btbTotalSupply ? formatNumber(parseFloat(formatEther(btbTotalSupply as bigint)) / 1e6, 0) + 'M' : '—'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">BTB Total Supply</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {fmtBal(btbBalance as bigint | undefined)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Your BTB</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {fmtBal(btbbBalance as bigint | undefined)}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Your BTBB</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {btbbPendingFees ? formatNumber(parseFloat(formatEther(btbbPendingFees as bigint))) : '0.00'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">BTBB Pending Fees</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* ━━━ BTB Bear Wrap/Unwrap ━━━ */}
          <Card className="border-2 border-blue-200 dark:border-blue-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                BTB ⇄ BTBB (Bear Wrap)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
                1:1 mint/redeem ratio. BTBB transfers incur a 1% tax that goes to NFT stakers.
              </div>

              <Tabs value={wrapTab} onValueChange={(v) => setWrapTab(v as 'mint' | 'redeem')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="mint" className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Mint BTBB
                  </TabsTrigger>
                  <TabsTrigger value="redeem" className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Redeem BTB
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="mint" className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">BTB Amount</label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={wrapAmount}
                      onChange={(e) => setWrapAmount(e.target.value)}
                      disabled={!isConnected || isPending || isConfirming}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Balance: {fmtBal(btbBalance as bigint | undefined)} BTB</span>
                      <div className="flex gap-1">
                        {[25, 50, 75, 100].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleWrapPercentage(p)}
                            className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          >
                            {p === 100 ? 'MAX' : `${p}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">You receive: {wrapAmount || '0'} BTBB (1:1, no fee on mint)</div>
                  {needsApproval ? (
                    <Button
                      onClick={handleApprove}
                      disabled={!isConnected || !wrapAmount || isPending || isConfirming}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                    >
                      {isPending || isConfirming ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                      ) : (
                        'Approve BTB'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleMintBTBB}
                      disabled={!isConnected || !wrapAmount || isPending || isConfirming}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                      {isPending || isConfirming ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                      ) : !isConnected ? (
                        'Connect Wallet'
                      ) : (
                        'Mint BTBB'
                      )}
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="redeem" className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">BTBB Amount</label>
                    <Input
                      type="number"
                      placeholder="0.0"
                      value={wrapAmount}
                      onChange={(e) => setWrapAmount(e.target.value)}
                      disabled={!isConnected || isPending || isConfirming}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Balance: {fmtBal(btbbBalance as bigint | undefined)} BTBB</span>
                      <div className="flex gap-1">
                        {[25, 50, 75, 100].map((p) => (
                          <button
                            key={p}
                            onClick={() => handleWrapPercentage(p)}
                            className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                          >
                            {p === 100 ? 'MAX' : `${p}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">You receive: {wrapAmount || '0'} BTB (1:1, no fee on redeem)</div>
                  <Button
                    onClick={handleRedeemBTBB}
                    disabled={!isConnected || !wrapAmount || isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                  >
                    {isPending || isConfirming ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                    ) : !isConnected ? (
                      'Connect Wallet'
                    ) : (
                      'Redeem BTB'
                    )}
                  </Button>
                </TabsContent>
              </Tabs>


            </CardContent>
          </Card>

          {/* ━━━ Bear NFT Purchase ━━━ */}
          <Card className="border-2 border-orange-200 dark:border-orange-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-orange-600" />
                Bear NFT
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 bg-orange-50 dark:bg-orange-950/20 p-2 rounded">
                Mint Bear NFTs with ETH. Stake them to earn BTBB rewards from transfer fees.
              </div>

              {/* NFT Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  <div className="text-sm font-bold text-orange-600">
                    {nftTotalSupply !== undefined ? Number(nftTotalSupply).toLocaleString() : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500">Minted</div>
                </div>
                <div className="text-center bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  <div className="text-sm font-bold text-green-600">
                    {nftRemaining !== undefined ? Number(nftRemaining).toLocaleString() : '—'}
                  </div>
                  <div className="text-[10px] text-gray-500">Remaining</div>
                </div>
                <div className="text-center bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  <div className="text-sm font-bold text-blue-600">
                    {nftPrice ? formatEther(nftPrice as bigint) : '—'} ETH
                  </div>
                  <div className="text-[10px] text-gray-500">Price Each</div>
                </div>
              </div>

              {isConnected && (
                <div className="text-xs text-gray-500">
                  You own: <span className="font-bold">{userNftBalance ? Number(userNftBalance).toString() : '0'}</span> Bear NFTs
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount to Buy</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={nftAmount}
                    onChange={(e) => setNftAmount(e.target.value)}
                    disabled={!isConnected || isPending || isConfirming}
                    className="flex-1"
                  />
                  {[1, 5, 10].map((n) => (
                    <Button
                      key={n}
                      variant="outline"
                      size="sm"
                      onClick={() => setNftAmount(String(n))}
                      className="text-xs px-3"
                      disabled={!isConnected}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
                <div className="text-xs text-gray-500">
                  Total:{' '}
                  {nftPrice
                    ? formatNumber(parseFloat(formatEther((nftPrice as bigint) * BigInt(parseInt(nftAmount) || 0))), 4)
                    : '0'}{' '}
                  ETH
                </div>
              </div>

              <Button
                onClick={handleBuyNFT}
                disabled={!isConnected || !nftAmount || parseInt(nftAmount) < 1 || isPending || isConfirming}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
              >
                {isPending || isConfirming ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                ) : !isConnected ? (
                  'Connect Wallet'
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Buy {nftAmount || 0} Bear NFT{parseInt(nftAmount) !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ━━━ Staking Overview ━━━ */}
        <Card className="border-2 border-green-200 dark:border-green-800/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-green-600" />
              Bear NFT Staking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-green-50 dark:bg-green-950/20 p-2 rounded mb-4">
              Stake your Bear NFTs to earn BTBB rewards from the 1% transfer tax on all BTBB transfers.
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {stakingStats && Array.isArray(stakingStats) ? Number(stakingStats[0]).toLocaleString() : '—'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Staked</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {stakingStats && Array.isArray(stakingStats)
                    ? formatNumber(parseFloat(formatEther(stakingStats[1] as bigint)))
                    : '—'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Distributed</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {stakingStats && Array.isArray(stakingStats)
                    ? formatNumber(parseFloat(formatEther(stakingStats[2] as bigint)))
                    : '—'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Pending to Collect</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {stakingStats && Array.isArray(stakingStats)
                    ? formatNumber(parseFloat(formatEther(stakingStats[3] as bigint)))
                    : '—'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Rewards 24h</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stakingStats && Array.isArray(stakingStats)
                    ? `${(Number(stakingStats[4]) / 100).toFixed(2)}%`
                    : '—'}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Est. APR</div>
              </div>
            </div>

            {isConnected && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {userStakedCount !== undefined ? Number(userStakedCount).toString() : '0'}
                    </div>
                    <div className="text-xs text-gray-500">Your Staked NFTs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {userPendingRewards ? formatNumber(parseFloat(formatEther(userPendingRewards as bigint))) : '0.00'} BTBB
                    </div>
                    <div className="text-xs text-gray-500">Your Pending (net)</div>
                  </div>
                </div>

                {/* Stake */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">Select NFTs to Stake</label>
                      {ownedTokenIds.length > 0 && (
                        <div className="space-x-2">
                          <Button variant="ghost" size="sm" onClick={selectAllNfts} className="text-xs h-7">Select All</Button>
                          <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs h-7">Clear</Button>
                        </div>
                      )}
                    </div>
                    
                    {ownedTokenIds.length === 0 ? (
                      <div className="text-sm text-gray-500 italic p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center border border-dashed">
                        {userNftCount === 0 ? "You don't own any Bear NFTs to stake." : "Loading your NFTs..."}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                        {ownedTokenIds.map((tokenId) => {
                          const isSelected = selectedToStake.includes(tokenId);
                          return (
                            <button
                              key={tokenId.toString()}
                              onClick={() => toggleNftSelection(tokenId)}
                              disabled={isPending || isConfirming}
                              className={`
                                relative aspect-square rounded-md border-2 flex items-center justify-center font-bold text-sm transition-all
                                ${isSelected 
                                  ? 'border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shadow-md transform scale-105' 
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-300 dark:hover:border-green-700'}
                                ${isPending || isConfirming ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              `}
                            >
                              #{tokenId.toString()}
                              {isSelected && (
                                <div className="absolute -top-1.5 -right-1.5 bg-green-500 text-white rounded-full p-0.5">
                                  <CheckCircle2 className="w-3 h-3" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  
                  <Input
                    type="hidden"
                    value={stakeTokenIds}
                    disabled
                  />
                  
                  {selectedToStake.length > 0 && (
                    <div className="text-xs text-green-600 font-medium">
                      Selected {selectedToStake.length} NFT{selectedToStake.length !== 1 ? 's' : ''} to stake
                    </div>
                  )}
                  {!isNftApprovedForStaking ? (
                    <Button
                      onClick={handleApproveNFTForStaking}
                      disabled={isPending || isConfirming}
                      className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                    >
                      {isPending || isConfirming ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                      ) : (
                        'Approve NFTs for Staking'
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStake}
                      disabled={!stakeTokenIds.trim() || isPending || isConfirming}
                      className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    >
                      {isPending || isConfirming ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                      ) : (
                        <><Lock className="w-4 h-4 mr-2" /> Stake NFTs</>
                      )}
                    </Button>
                  )}
                </div>

                {/* Unstake */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Unstake NFTs</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={unstakeCount}
                      onChange={(e) => setUnstakeCount(e.target.value)}
                      disabled={isPending || isConfirming}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleUnstake}
                      disabled={!unstakeCount || parseInt(unstakeCount) < 1 || isPending || isConfirming}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      {isPending || isConfirming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Unstake'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Claim */}
                <Button
                  onClick={handleClaimRewards}
                  disabled={isPending || isConfirming || !userPendingRewards || (userPendingRewards as bigint) === 0n}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {isPending || isConfirming ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirming...</>
                  ) : (
                    <><Coins className="w-4 h-4 mr-2" /> Claim {userPendingRewards ? formatNumber(parseFloat(formatEther(userPendingRewards as bigint))) : '0'} BTBB Rewards</>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ━━━ Messages ━━━ */}
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

        {/* ━━━ Etherscan Links ━━━ */}
        <div className="text-center space-y-2">
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`https://etherscan.io/token/${CONTRACTS.BTB_FINANCE}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 hover:underline"
            >
              BTB on Etherscan <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={`https://etherscan.io/token/${CONTRACTS.BTB_BEAR}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              BTBB on Etherscan <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={`https://etherscan.io/token/${CONTRACTS.BEAR_NFT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 hover:underline"
            >
              Bear NFT on Etherscan <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <p className="text-xs text-gray-500">
            All contracts verified on Ethereum Mainnet (Chain ID: {CHAIN_ID})
          </p>
        </div>
      </div>
    </div>
  );
}
