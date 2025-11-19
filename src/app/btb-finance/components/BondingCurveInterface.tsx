'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther, formatUnits, parseUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Wallet, ArrowRightLeft, Activity } from 'lucide-react';
import BTBBondingCurveABI from '../BTBBondingCurveABI.json';

const BONDING_CURVE_ADDRESS = '0x88888E2Dbd96cC16BD8f52D1de0eCCF2252562d6';
const BTB_TOKEN_ADDRESS = '0x888e85C95c84CA41eEf3E4C8C89e8dcE03e41488';
const BTB_DECIMALS = 18;

interface MarketInfo {
  currentPrice: bigint;
  circulatingSupply: bigint;
  ethBacking: bigint;
  availableBTB: bigint;
  tradingFee: bigint;
}

export function BondingCurveInterface() {
  const { address, isConnected } = useAccount();

  // UI State
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [ethAmount, setEthAmount] = useState('');
  const [btbAmount, setBtbAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Contract reads
  const { data: marketInfo, refetch: refetchMarketInfo, isError: marketInfoError } = useReadContract({
    address: BONDING_CURVE_ADDRESS,
    abi: BTBBondingCurveABI,
    functionName: 'getMarketInfo',
  });

  const { data: userBTBBalance } = useReadContract({
    address: BTB_TOKEN_ADDRESS,
    abi: BTBBondingCurveABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Contract writes
  const { writeContract: buyBTB, data: buyHash } = useWriteContract();
  const { writeContract: sellBTB, data: sellHash } = useWriteContract();
  const { writeContract: approveBTB } = useWriteContract();

  // Transaction receipts
  const { isLoading: isBuyConfirming, isSuccess: buySuccess } = useWaitForTransactionReceipt({
    hash: buyHash,
  });

  const { isLoading: isSellConfirming, isSuccess: sellSuccess } = useWaitForTransactionReceipt({
    hash: sellHash,
  });

  // Calculate price per BTB in ETH
  const pricePerBTB = marketInfo && Array.isArray(marketInfo) && marketInfo[0] ? formatEther(marketInfo[0] as bigint) : '0';

  // Preview calculations
  const previewBuy = async (ethInput: string) => {
    if (!ethInput || !marketInfo || !Array.isArray(marketInfo)) return { btbAmount: '0', fee: '0' };

    try {
      const ethAmountWei = parseEther(ethInput);
      const currentPrice = marketInfo[0] as bigint;
      const tradingFee = marketInfo[4] as bigint;

      const fee = (ethAmountWei * tradingFee) / 10000n;
      const ethAfterFee = ethAmountWei - fee;
      const btbAmount = (ethAfterFee * BigInt(10 ** BTB_DECIMALS)) / currentPrice;

      return {
        btbAmount: formatEther(btbAmount),
        fee: formatEther(fee)
      };
    } catch (err) {
      return { btbAmount: '0', fee: '0' };
    }
  };

  const previewSell = async (btbInput: string) => {
    if (!btbInput || !marketInfo || !Array.isArray(marketInfo)) return { ethAmount: '0', fee: '0' };

    try {
      const btbAmountWei = parseEther(btbInput);
      const currentPrice = marketInfo[0] as bigint;
      const tradingFee = marketInfo[4] as bigint;

      const ethAmount = (btbAmountWei * currentPrice) / BigInt(10 ** BTB_DECIMALS);
      const fee = (ethAmount * tradingFee) / 10000n;
      const ethAfterFee = ethAmount - fee;

      return {
        ethAmount: formatEther(ethAfterFee),
        fee: formatEther(fee)
      };
    } catch (err) {
      return { ethAmount: '0', fee: '0' };
    }
  };

  // Handle ETH input change
  const handleEthInputChange = async (value: string) => {
    setEthAmount(value);
    if (value && marketInfo) {
      const preview = await previewBuy(value);
      setBtbAmount(preview.btbAmount);
    } else {
      setBtbAmount('');
    }
  };

  // Handle BTB input change
  const handleBtbInputChange = async (value: string) => {
    setBtbAmount(value);
    if (value && marketInfo) {
      const preview = await previewSell(value);
      setEthAmount(preview.ethAmount);
    } else {
      setEthAmount('');
    }
  };

  const handlePercentageSell = (percentage: number) => {
    if (userBTBBalance) {
      const balance = BigInt(userBTBBalance as bigint);
      const amount = (balance * BigInt(percentage)) / 100n;
      handleBtbInputChange(formatEther(amount));
    }
  };

  const handlePercentageBuy = (percentage: number) => {
    if (ethBalance) {
      const balance = ethBalance.value;
      // Leave some ETH for gas if buying 100% (e.g., 0.01 ETH)
      const gasBuffer = parseEther('0.01');
      let amount = (balance * BigInt(percentage)) / 100n;

      if (percentage === 100 && amount > gasBuffer) {
        amount = amount - gasBuffer;
      }

      handleEthInputChange(formatEther(amount));
    }
  };

  // Buy BTB
  const handleBuy = async () => {
    if (!ethAmount || !isConnected) return;

    try {
      setIsLoading(true);
      setError(null);

      buyBTB({
        address: BONDING_CURVE_ADDRESS,
        abi: BTBBondingCurveABI,
        functionName: 'buy',
        value: parseEther(ethAmount),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to buy BTB');
      setIsLoading(false);
    }
  };

  // Sell BTB
  const handleSell = async () => {
    if (!btbAmount || !isConnected) return;

    try {
      setIsLoading(true);
      setError(null);

      // First approve BTB spending
      const btbAmountWei = parseUnits(btbAmount, BTB_DECIMALS);

      approveBTB({
        address: BTB_TOKEN_ADDRESS,
        abi: BTBBondingCurveABI,
        functionName: 'approve',
        args: [BONDING_CURVE_ADDRESS, btbAmountWei],
      });

      // Then sell (this would need to be chained properly in production)
      sellBTB({
        address: BONDING_CURVE_ADDRESS,
        abi: BTBBondingCurveABI,
        functionName: 'sell',
        args: [btbAmountWei],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sell BTB');
      setIsLoading(false);
    }
  };

  // Handle transaction success
  useEffect(() => {
    if (buySuccess) {
      setSuccess(`Successfully bought BTB! Transaction: ${buyHash}`);
      setEthAmount('');
      setBtbAmount('');
      setIsLoading(false);
      refetchMarketInfo();
    }
  }, [buySuccess]);

  useEffect(() => {
    if (sellSuccess) {
      setSuccess(`Successfully sold BTB! Transaction: ${sellHash}`);
      setEthAmount('');
      setBtbAmount('');
      setIsLoading(false);
      refetchMarketInfo();
    }
  }, [sellSuccess]);

  // Clear messages on tab change
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [activeTab]);

  if (!marketInfo || marketInfoError) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Market Info Ticker */}
      <div className="relative overflow-hidden rounded-xl bg-black/40 border border-white/10 backdrop-blur-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-blue-900/20" />
        <div className="relative p-4 flex flex-wrap justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Current Price</div>
              <div className="text-lg font-bold text-white font-mono">
                Ξ {parseFloat(pricePerBTB) < 0.000001
                  ? pricePerBTB.substring(0, 14)
                  : parseFloat(pricePerBTB).toFixed(6)}
              </div>
            </div>
          </div>

          <div className="w-px h-10 bg-white/10 hidden md:block" />

          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Circulating Supply</div>
            <div className="text-lg font-bold text-blue-400 font-mono">
              {Array.isArray(marketInfo) && marketInfo[1] ? formatEther(marketInfo[1] as bigint).slice(0, 8) : '0'}B
            </div>
          </div>

          <div className="w-px h-10 bg-white/10 hidden md:block" />

          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">ETH Backing</div>
            <div className="text-lg font-bold text-green-400 font-mono">
              {Array.isArray(marketInfo) && marketInfo[2] ? formatEther(marketInfo[2] as bigint).slice(0, 6) : '0'} ETH
            </div>
          </div>

          <div className="w-px h-10 bg-white/10 hidden md:block" />

          <div>
            <div className="text-[10px] text-white/40 uppercase tracking-wider">Trading Fee</div>
            <div className="text-lg font-bold text-orange-400 font-mono">
              {Array.isArray(marketInfo) && marketInfo[4] ? Number((marketInfo[4] as bigint)) / 100 : '0'}%
            </div>
          </div>
        </div>
      </div>

      {/* Trading Interface */}
      <div className="relative rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
        {/* Header & Tabs */}
        <div className="p-6 border-b border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <ArrowRightLeft className="w-6 h-6 text-blue-500" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Bonding Curve</h2>
            </div>

            {/* Custom Tab Switcher */}
            <div className="relative flex bg-black/40 rounded-full p-1 border border-white/10">
              <button
                onClick={() => setActiveTab('buy')}
                className={`relative z-10 px-8 py-2 text-sm font-bold transition-colors duration-300 ${activeTab === 'buy' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                BUY
              </button>
              <button
                onClick={() => setActiveTab('sell')}
                className={`relative z-10 px-8 py-2 text-sm font-bold transition-colors duration-300 ${activeTab === 'sell' ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
              >
                SELL
              </button>

              {/* Sliding Background */}
              <motion.div
                className={`absolute top-1 bottom-1 rounded-full ${activeTab === 'buy' ? 'bg-green-600' : 'bg-red-600'}`}
                initial={false}
                animate={{
                  left: activeTab === 'buy' ? '4px' : '50%',
                  width: activeTab === 'buy' ? 'calc(50% - 4px)' : 'calc(50% - 4px)',
                  x: activeTab === 'buy' ? 0 : 0
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'buy' ? (
              <motion.div
                key="buy"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Buy Form */}
                <div className="space-y-6">
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between text-xs text-white/40 mb-2">
                      <span>YOU PAY (ETH)</span>
                      <span>BAL: {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.0"
                        value={ethAmount}
                        onChange={(e) => handleEthInputChange(e.target.value)}
                        className="w-full bg-transparent border-b border-white/20 py-2 text-3xl font-light text-white focus:outline-none focus:border-green-500 transition-colors placeholder-white/10"
                      />
                      <div className="absolute right-0 bottom-2 flex gap-2">
                        {[25, 50, 75, 100].map((percent) => (
                          <button
                            key={percent}
                            onClick={() => handlePercentageBuy(percent)}
                            disabled={!ethBalance}
                            className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          >
                            {percent === 100 ? 'MAX' : `${percent}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="p-2 rounded-full bg-white/5 border border-white/10">
                      <ArrowRightLeft className="w-4 h-4 text-white/40 rotate-90" />
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between text-xs text-white/40 mb-2">
                      <span>YOU RECEIVE (BTB)</span>
                      <span>ESTIMATED</span>
                    </div>
                    <input
                      type="text"
                      value={btbAmount}
                      readOnly
                      className="w-full bg-transparent border-b border-white/5 py-2 text-3xl font-light text-green-400 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleBuy}
                    disabled={!isConnected || !ethAmount || isLoading}
                    className="relative group w-full overflow-hidden rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative bg-black/80 backdrop-blur-sm rounded-xl px-6 py-4 transition-all group-hover:bg-black/60">
                      <div className="flex items-center justify-center gap-2 font-bold text-white text-lg tracking-wide">
                        {isLoading && isBuyConfirming ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>CONFIRMING...</span>
                          </>
                        ) : !isConnected ? (
                          <>
                            <Wallet className="w-5 h-5" />
                            <span>CONNECT WALLET</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-5 h-5" />
                            <span>BUY BTB</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="sell"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* Sell Form */}
                <div className="space-y-6">
                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between text-xs text-white/40 mb-2">
                      <span>YOU SELL (BTB)</span>
                      <span>BAL: {userBTBBalance ? parseFloat(formatEther(userBTBBalance as bigint)).toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.0"
                        value={btbAmount}
                        onChange={(e) => handleBtbInputChange(e.target.value)}
                        className="w-full bg-transparent border-b border-white/20 py-2 text-3xl font-light text-white focus:outline-none focus:border-red-500 transition-colors placeholder-white/10"
                      />
                      <div className="absolute right-0 bottom-2 flex gap-2">
                        {[25, 50, 75, 100].map((percent) => (
                          <button
                            key={percent}
                            onClick={() => handlePercentageSell(percent)}
                            disabled={!userBTBBalance}
                            className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          >
                            {percent === 100 ? 'MAX' : `${percent}%`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="p-2 rounded-full bg-white/5 border border-white/10">
                      <ArrowRightLeft className="w-4 h-4 text-white/40 rotate-90" />
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                    <div className="flex justify-between text-xs text-white/40 mb-2">
                      <span>YOU RECEIVE (ETH)</span>
                      <span>ESTIMATED</span>
                    </div>
                    <input
                      type="text"
                      value={ethAmount}
                      readOnly
                      className="w-full bg-transparent border-b border-white/5 py-2 text-3xl font-light text-red-400 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleSell}
                    disabled={!isConnected || !btbAmount || isLoading}
                    className="relative group w-full overflow-hidden rounded-xl bg-gradient-to-r from-red-500 to-rose-600 p-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative bg-black/80 backdrop-blur-sm rounded-xl px-6 py-4 transition-all group-hover:bg-black/60">
                      <div className="flex items-center justify-center gap-2 font-bold text-white text-lg tracking-wide">
                        {isLoading && isSellConfirming ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>CONFIRMING...</span>
                          </>
                        ) : !isConnected ? (
                          <>
                            <Wallet className="w-5 h-5" />
                            <span>CONNECT WALLET</span>
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-5 h-5" />
                            <span>SELL BTB</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feedback Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {success}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}