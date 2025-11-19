'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseEther, formatEther, formatUnits, parseUnits } from 'viem';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react';
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
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Market Info Banner */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-2 border-purple-200 dark:border-purple-800/50">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {parseFloat(pricePerBTB).toFixed(6)} ETH
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Price per BTB</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {Array.isArray(marketInfo) && marketInfo[1] ? formatEther(marketInfo[1] as bigint).slice(0, 8) : '0'}B
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Circulating Supply</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {Array.isArray(marketInfo) && marketInfo[2] ? formatEther(marketInfo[2] as bigint).slice(0, 6) : '0'} ETH
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">ETH Backing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {Array.isArray(marketInfo) && marketInfo[4] ? Number((marketInfo[4] as bigint)) / 100 : '0'}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Trading Fee</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trading Interface */}
      <Card className="border-2 border-purple-200 dark:border-purple-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            Bonding Curve Trading
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'buy' | 'sell')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Buy BTB
              </TabsTrigger>
              <TabsTrigger value="sell" className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Sell BTB
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ETH Amount</label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={ethAmount}
                  onChange={(e) => handleEthInputChange(e.target.value)}
                  disabled={!isConnected || isLoading}
                />
                <div className="space-y-2 mt-1">
                  <div className="text-xs text-gray-500 text-right">
                    Balance: {ethBalance ? parseFloat(formatEther(ethBalance.value)).toFixed(4) : '0.0000'} ETH
                  </div>
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handlePercentageBuy(percent)}
                        disabled={!ethBalance}
                        className="flex-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  value={btbAmount}
                  readOnly
                  className="bg-gray-50 dark:bg-gray-800"
                />
              </div>
              <Button
                onClick={handleBuy}
                disabled={!isConnected || !ethAmount || isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
              >
                {isLoading && isBuyConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirming Transaction...
                  </>
                ) : !isConnected ? (
                  'Connect Wallet to Buy'
                ) : (
                  'Buy BTB'
                )}
              </Button>
            </TabsContent>

            <TabsContent value="sell" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">BTB Amount</label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={btbAmount}
                  onChange={(e) => handleBtbInputChange(e.target.value)}
                  disabled={!isConnected || isLoading}
                />
                <div className="space-y-2 mt-1">
                  <div className="text-xs text-gray-500">
                    Balance: {userBTBBalance ? parseFloat(formatEther(userBTBBalance as bigint)).toFixed(2) : '0.00'} BTB
                  </div>
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((percent) => (
                      <button
                        key={percent}
                        onClick={() => handlePercentageSell(percent)}
                        disabled={!userBTBBalance}
                        className="flex-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {percent === 100 ? 'MAX' : `${percent}%`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ETH to Receive</label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={ethAmount}
                  readOnly
                  className="bg-gray-50 dark:bg-gray-800"
                />
              </div>
              <Button
                onClick={handleSell}
                disabled={!isConnected || !btbAmount || isLoading}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
              >
                {isLoading && isSellConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Confirming Transaction...
                  </>
                ) : !isConnected ? (
                  'Connect Wallet to Sell'
                ) : (
                  'Sell BTB'
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
              <TrendingUp className="w-3 h-3" />
              Price updates with each trade
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Fees stay in contract as backing
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}