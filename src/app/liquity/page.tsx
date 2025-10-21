"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, TrendingUp, Wallet, ArrowRight, Info } from "lucide-react";
import { RangeSelector } from "./components/RangeSelector";
import { LiquidityChart } from "./components/LiquidityChart";
import { liquityService } from "./services/liquityService";
import { calculateLiquidity, formatPrice } from "./utils/rangeCalculations";
import { FEE_TIERS, PoolInfo, UserPosition } from "./types/liquity";
import { toast } from "sonner";

// Common token pairs (example addresses - update with actual addresses)
const TOKEN_PAIRS = [
  {
    name: "WETH/USDC",
    token0: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    token1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    token0Symbol: "WETH",
    token1Symbol: "USDC",
  },
  {
    name: "WBTC/WETH",
    token0: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    token1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    token0Symbol: "WBTC",
    token1Symbol: "WETH",
  },
  {
    name: "DAI/USDC",
    token0: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    token1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    token0Symbol: "DAI",
    token1Symbol: "USDC",
  },
];

export default function LiquityPage() {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pool selection
  const [selectedPair, setSelectedPair] = useState(TOKEN_PAIRS[0]);
  const [selectedFee, setSelectedFee] = useState(FEE_TIERS[1].value);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);

  // Liquidity inputs
  const [token0Amount, setToken0Amount] = useState("");
  const [token1Amount, setToken1Amount] = useState("");
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);

  // User positions
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<UserPosition | null>(null);

  // Transaction state
  const [isApproving, setIsApproving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Initialize provider and load pool info
  useEffect(() => {
    if (isConnected && window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      liquityService.initialize(provider);
      loadPoolInfo();
      if (address) {
        loadUserPositions();
      }
    }
  }, [isConnected, address, selectedPair, selectedFee]);

  const loadPoolInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const info = await liquityService.getPoolInfo(
        selectedPair.token0,
        selectedPair.token1,
        selectedFee
      );

      setPoolInfo(info);

      // Set initial price range (±10% of current price)
      const currentPrice = info.currentPrice;
      setMinPrice(currentPrice * 0.9);
      setMaxPrice(currentPrice * 1.1);
    } catch (err: any) {
      console.error("Error loading pool info:", err);
      setError(err.message || "Failed to load pool information");
    } finally {
      setLoading(false);
    }
  };

  const loadUserPositions = async () => {
    if (!address) return;

    try {
      const positions = await liquityService.getUserPositions(address);
      setUserPositions(positions);
    } catch (err: any) {
      console.error("Error loading user positions:", err);
    }
  };

  // Calculate liquidity based on inputs
  const liquidityCalculation = useMemo(() => {
    if (!poolInfo || !token0Amount || !token1Amount || !minPrice || !maxPrice) {
      return null;
    }

    try {
      return calculateLiquidity(
        token0Amount,
        token1Amount,
        poolInfo.currentPrice,
        minPrice,
        maxPrice,
        poolInfo.token0Decimals,
        poolInfo.token1Decimals
      );
    } catch (err) {
      return null;
    }
  }, [poolInfo, token0Amount, token1Amount, minPrice, maxPrice]);

  const handleRangeChange = (newMinPrice: number, newMaxPrice: number) => {
    setMinPrice(newMinPrice);
    setMaxPrice(newMaxPrice);
  };

  const handleToken0AmountChange = (value: string) => {
    setToken0Amount(value);

    // Auto-calculate token1 amount based on current price
    if (poolInfo && value && !isNaN(parseFloat(value))) {
      const amount = parseFloat(value);
      const estimatedToken1 = amount * poolInfo.currentPrice;
      setToken1Amount(estimatedToken1.toFixed(6));
    }
  };

  const handleToken1AmountChange = (value: string) => {
    setToken1Amount(value);

    // Auto-calculate token0 amount based on current price
    if (poolInfo && value && !isNaN(parseFloat(value))) {
      const amount = parseFloat(value);
      const estimatedToken0 = amount / poolInfo.currentPrice;
      setToken0Amount(estimatedToken0.toFixed(6));
    }
  };

  const handleAddLiquidity = async () => {
    if (!poolInfo || !token0Amount || !token1Amount || !isConnected) {
      toast.error("Please fill in all fields and connect your wallet");
      return;
    }

    try {
      setIsAdding(true);

      const amount0 = BigInt(
        Math.floor(parseFloat(token0Amount) * 10 ** poolInfo.token0Decimals)
      );
      const amount1 = BigInt(
        Math.floor(parseFloat(token1Amount) * 10 ** poolInfo.token1Decimals)
      );

      const tx = await liquityService.addLiquidity(
        poolInfo.token0,
        poolInfo.token1,
        poolInfo.fee,
        minPrice,
        maxPrice,
        amount0,
        amount1,
        0.5 // 0.5% slippage tolerance
      );

      toast.success("Transaction submitted! Waiting for confirmation...");

      await tx.wait();

      toast.success("Liquidity added successfully!");

      // Reset form
      setToken0Amount("");
      setToken1Amount("");

      // Reload positions
      if (address) {
        loadUserPositions();
      }
    } catch (err: any) {
      console.error("Error adding liquidity:", err);
      toast.error(err.message || "Failed to add liquidity");
    } finally {
      setIsAdding(false);
    }
  };

  const handleCollectFees = async (tokenId: bigint) => {
    try {
      const tx = await liquityService.collectFees(tokenId);
      toast.success("Collecting fees... Please wait for confirmation");

      await tx.wait();
      toast.success("Fees collected successfully!");

      if (address) {
        loadUserPositions();
      }
    } catch (err: any) {
      console.error("Error collecting fees:", err);
      toast.error(err.message || "Failed to collect fees");
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
          <p className="text-muted-foreground mb-6">
            Please connect your wallet to provide liquidity
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Concentrated Liquidity</h1>
        <p className="text-muted-foreground">
          Provide liquidity within a specific price range to maximize capital efficiency
        </p>
      </div>

      <Tabs defaultValue="add" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="add">Add Liquidity</TabsTrigger>
          <TabsTrigger value="positions">Your Positions</TabsTrigger>
        </TabsList>

        {/* Add Liquidity Tab */}
        <TabsContent value="add" className="space-y-6">
          {/* Pool Selection */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Select Pool</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Token Pair</label>
                <Select
                  value={selectedPair.name}
                  onValueChange={(value) => {
                    const pair = TOKEN_PAIRS.find((p) => p.name === value);
                    if (pair) setSelectedPair(pair);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TOKEN_PAIRS.map((pair) => (
                      <SelectItem key={pair.name} value={pair.name}>
                        {pair.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Fee Tier</label>
                <Select
                  value={selectedFee.toString()}
                  onValueChange={(value) => setSelectedFee(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_TIERS.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value.toString()}>
                        {tier.label} - {tier.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {poolInfo && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Current Price</div>
                    <div className="font-semibold">
                      {formatPrice(poolInfo.currentPrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Liquidity</div>
                    <div className="font-semibold">
                      {ethers.formatUnits(poolInfo.liquidity, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Fee Rate</div>
                    <div className="font-semibold">{poolInfo.fee / 10000}%</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {loading && (
            <Card className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading pool information...</p>
            </Card>
          )}

          {/* Main Content */}
          {!loading && poolInfo && (
            <>
              {/* Price Range Selector */}
              <RangeSelector
                currentPrice={poolInfo.currentPrice}
                minPrice={minPrice}
                maxPrice={maxPrice}
                onRangeChange={handleRangeChange}
                token0Symbol={poolInfo.token0Symbol}
                token1Symbol={poolInfo.token1Symbol}
              />

              {/* Liquidity Chart */}
              <LiquidityChart
                currentPrice={poolInfo.currentPrice}
                minPrice={minPrice}
                maxPrice={maxPrice}
                token0Symbol={poolInfo.token0Symbol}
                token1Symbol={poolInfo.token1Symbol}
              />

              {/* Amount Inputs */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Deposit Amounts</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        {poolInfo.token0Symbol}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Balance: 0.0
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={token0Amount}
                        onChange={(e) => handleToken0AmountChange(e.target.value)}
                        placeholder="0.0"
                        step="any"
                        className="pr-20"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold">
                        {poolInfo.token0Symbol}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">
                        {poolInfo.token1Symbol}
                      </label>
                      <span className="text-xs text-muted-foreground">
                        Balance: 0.0
                      </span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={token1Amount}
                        onChange={(e) => handleToken1AmountChange(e.target.value)}
                        placeholder="0.0"
                        step="any"
                        className="pr-20"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold">
                        {poolInfo.token1Symbol}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Liquidity Summary */}
              {liquidityCalculation && (
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Position Summary</h3>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {poolInfo.token0Symbol} Deposited
                      </span>
                      <span className="font-semibold">
                        {ethers.formatUnits(
                          liquidityCalculation.token0Amount,
                          poolInfo.token0Decimals
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {poolInfo.token1Symbol} Deposited
                      </span>
                      <span className="font-semibold">
                        {ethers.formatUnits(
                          liquidityCalculation.token1Amount,
                          poolInfo.token1Decimals
                        )}
                      </span>
                    </div>

                    <div className="h-px bg-border my-2" />

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Liquidity</span>
                      <span className="font-semibold">
                        {ethers.formatUnits(liquidityCalculation.liquidity, 0)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Expected APR</span>
                      <span className="font-semibold text-green-600">
                        {liquidityCalculation.expectedAPR.toFixed(2)}%
                      </span>
                    </div>

                    {liquidityCalculation.priceImpact > 0.1 && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Price Impact</span>
                        <span className="font-semibold text-yellow-600">
                          {liquidityCalculation.priceImpact.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex gap-2">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        Your position will only earn fees when the price is within your
                        selected range ({formatPrice(minPrice)} - {formatPrice(maxPrice)})
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Add Liquidity Button */}
              <Button
                onClick={handleAddLiquidity}
                disabled={
                  !token0Amount ||
                  !token1Amount ||
                  isAdding ||
                  !liquidityCalculation
                }
                className="w-full h-12 text-lg"
                size="lg"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Adding Liquidity...
                  </>
                ) : (
                  <>
                    Add Liquidity
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}
        </TabsContent>

        {/* Your Positions Tab */}
        <TabsContent value="positions" className="space-y-6">
          {userPositions.length === 0 ? (
            <Card className="p-12 text-center">
              <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-2xl font-bold mb-2">No Positions Yet</h2>
              <p className="text-muted-foreground mb-6">
                Add liquidity to start earning fees
              </p>
              <Button onClick={() => {}} variant="outline">
                Add Your First Position
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {userPositions.map((position) => (
                <Card key={position.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Position #{position.id}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Token ID: {position.tokenId.toString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCollectFees(position.tokenId)}
                      >
                        Collect Fees
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Liquidity</div>
                      <div className="font-semibold">
                        {ethers.formatUnits(position.liquidity, 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Min Tick</div>
                      <div className="font-semibold">{position.minTick}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Max Tick</div>
                      <div className="font-semibold">{position.maxTick}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Fees Earned</div>
                      <div className="font-semibold text-green-600">
                        {ethers.formatUnits(position.feesEarned0, 18)} /{" "}
                        {ethers.formatUnits(position.feesEarned1, 18)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
