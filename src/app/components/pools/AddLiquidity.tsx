import React, { useState, useEffect } from 'react';
import { Pool, Token } from '@/app/types/uniswap';
import { formatCurrency, formatPercent } from '@/app/utils/formatting';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Slider } from '@/app/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Loader2, ArrowRight, Info, AlertCircle } from 'lucide-react';
import { TokenSearch } from '@/app/components/pools/TokenSearch';

interface AddLiquidityProps {
  pools: Pool[];
  isLoading: boolean;
  onAddLiquidity: (data: LiquidityData) => void;
  initialPool?: Pool | null;
}

export interface LiquidityData {
  token0: Token;
  token1: Token;
  amount0: string;
  amount1: string;
  fee: number;
  lowerTick: number;
  upperTick: number;
  pool?: Pool;
}

export const AddLiquidity: React.FC<AddLiquidityProps> = ({ pools, isLoading, onAddLiquidity, initialPool }) => {
  const [token0, setToken0] = useState<Token | null>(null);
  const [token1, setToken1] = useState<Token | null>(null);
  const [amount0, setAmount0] = useState<string>('');
  const [amount1, setAmount1] = useState<string>('');
  const [fee, setFee] = useState<number>(3000); // Default to 0.3%
  const [rangeWidth, setRangeWidth] = useState<number>(5); // Default to ±5%
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [estimating, setEstimating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1);

  // Available fee tiers
  const feeTiers = [
    { value: 100, label: '0.01%' },
    { value: 500, label: '0.05%' },
    { value: 3000, label: '0.3%' },
    { value: 10000, label: '1%' }
  ];

  // Initialize from initialPool if provided
  useEffect(() => {
    if (initialPool) {
      setToken0(initialPool.token0);
      setToken1(initialPool.token1);
      setSelectedPool(initialPool);
      setFee(initialPool.fee);
    }
  }, [initialPool]);

  // Reset form when tokens change
  useEffect(() => {
    setAmount0('');
    setAmount1('');
    setError(null);
    
    // Find matching pool if both tokens are selected
    if (token0 && token1) {
      const matchingPool = pools.find(pool => 
        (pool.token0.address.toLowerCase() === token0.address.toLowerCase() && 
         pool.token1.address.toLowerCase() === token1.address.toLowerCase()) ||
        (pool.token0.address.toLowerCase() === token1.address.toLowerCase() && 
         pool.token1.address.toLowerCase() === token0.address.toLowerCase())
      );
      
      if (matchingPool) {
        setSelectedPool(matchingPool);
        setFee(matchingPool.fee);
      }
    }
  }, [token0, token1, pools]);

  // Simulate estimating token amounts
  const estimateAmounts = () => {
    if (!token0 || !token1 || !amount0) return;
    
    setEstimating(true);
    setError(null);
    
    // Simulate API call delay
    setTimeout(() => {
      try {
        // This is a simplified calculation. In a real implementation,
        // you would call a smart contract or API to get the exact amounts
        const token0Amount = parseFloat(amount0);
        const mockPrice = selectedPool ? 
          selectedPool.token0.symbol === 'WETH' ? 1800 : 
          selectedPool.token0.symbol === 'USDC' || selectedPool.token0.symbol === 'USDbC' ? 1 : 
          Math.random() * 100 : 
          Math.random() * 100;
          
        const calculatedAmount1 = token0Amount * mockPrice;
        setAmount1(calculatedAmount1.toFixed(6));
        setEstimating(false);
      } catch (err) {
        setError('Failed to estimate amounts. Please try again.');
        setEstimating(false);
      }
    }, 1000);
  };

  // Calculate price range based on current price and range width
  const calculatePriceRange = () => {
    if (!selectedPool) return { lower: 0, upper: 0, current: 0 };
    
    // This is simplified. In a real implementation, you would use the actual price from the pool
    const currentPrice = selectedPool.token0.symbol === 'WETH' ? 1800 : 
                        selectedPool.token0.symbol === 'USDC' || selectedPool.token0.symbol === 'USDbC' ? 1 : 
                        10; // Arbitrary price for other tokens
    
    const lowerPrice = currentPrice * (1 - rangeWidth / 100);
    const upperPrice = currentPrice * (1 + rangeWidth / 100);
    
    return {
      lower: lowerPrice,
      upper: upperPrice,
      current: currentPrice
    };
  };

  // Simplified tick calculation (not accurate for production)
  const calculateTicks = () => {
    const priceRange = calculatePriceRange();
    
    // In Uniswap V3, ticks are logarithmic. This is a very simplified version.
    // In production, you would use the actual formula from Uniswap
    const lowerTick = Math.floor(Math.log(priceRange.lower) * 100);
    const upperTick = Math.ceil(Math.log(priceRange.upper) * 100);
    
    return { lowerTick, upperTick };
  };

  const handleAddLiquidity = () => {
    if (!token0 || !token1 || !amount0 || !amount1) {
      setError('Please fill in all fields');
      return;
    }
    
    const { lowerTick, upperTick } = calculateTicks();
    
    const liquidityData: LiquidityData = {
      token0: token0,
      token1: token1,
      amount0,
      amount1,
      fee,
      lowerTick,
      upperTick,
      pool: selectedPool || undefined
    };
    
    onAddLiquidity(liquidityData);
  };

  const handleSwapTokens = () => {
    const tempToken = token0;
    const tempAmount = amount0;
    
    setToken0(token1);
    setToken1(tempToken);
    setAmount0(amount1);
    setAmount1(tempAmount);
  };

  const priceRange = calculatePriceRange();

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Add Liquidity</CardTitle>
        <CardDescription>
          Provide liquidity to earn fees and BTB rewards
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Select Token Pair</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <TokenSearch 
                      onSelectToken={(token) => setToken0(token)} 
                      isLoading={isLoading}
                      selectedToken={token0}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={handleSwapTokens}
                    disabled={!token0 && !token1}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <TokenSearch 
                      onSelectToken={(token) => setToken1(token)} 
                      isLoading={isLoading}
                      selectedToken={token1}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fee Tier</label>
                <Select 
                  value={fee.toString()} 
                  onValueChange={(value) => setFee(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fee tier" />
                  </SelectTrigger>
                  <SelectContent>
                    {feeTiers.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value.toString()}>
                        {tier.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm font-medium">Price Range (±{rangeWidth}%)</label>
                  <span className="text-sm text-gray-500">Simplified</span>
                </div>
                <Slider
                  value={[rangeWidth]}
                  min={1}
                  max={20}
                  step={1}
                  onValueChange={(values) => setRangeWidth(values[0])}
                  className="mb-4"
                />
                
                {selectedPool && (
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-gray-100 dark:bg-slate-800 p-2 rounded">
                      <div className="text-gray-500">Min Price</div>
                      <div className="font-medium">{formatCurrency(priceRange.lower)}</div>
                    </div>
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded">
                      <div className="text-gray-500">Current Price</div>
                      <div className="font-medium">{formatCurrency(priceRange.current)}</div>
                    </div>
                    <div className="bg-gray-100 dark:bg-slate-800 p-2 rounded">
                      <div className="text-gray-500">Max Price</div>
                      <div className="font-medium">{formatCurrency(priceRange.upper)}</div>
                    </div>
                  </div>
                )}
              </div>

              <Button 
                className="w-full" 
                disabled={!token0 || !token1}
                onClick={() => setStep(2)}
              >
                Continue
              </Button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium">Deposit Amounts</h3>
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                  Back
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {token0?.symbol || 'Token 0'} Amount
                </label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="0.0"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    onClick={estimateAmounts}
                    disabled={!token0 || !token1 || !amount0 || estimating}
                  >
                    {estimating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Calculate'}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {token1?.symbol || 'Token 1'} Amount (Estimated)
                </label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amount1}
                  onChange={(e) => setAmount1(e.target.value)}
                  disabled={estimating}
                />
              </div>

              {error && (
                <div className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded-md flex items-start">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-md flex items-start">
                <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-800 dark:text-blue-200">
                  BTB Finance will automatically handle zapping your tokens into the correct ratio and adding liquidity within your specified price range.
                </span>
              </div>

              <Button 
                className="w-full" 
                disabled={!token0 || !token1 || !amount0 || !amount1 || estimating}
                onClick={handleAddLiquidity}
              >
                Add Liquidity
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="text-xs text-gray-500 border-t pt-4">
        <div className="w-full">
          <p className="mb-1">Benefits of BTB Finance LP:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Simplified liquidity provision with automatic price ranges</li>
            <li>Protection against impermanent loss through BTB token refunds</li>
            <li>Earn additional BTB rewards on top of trading fees</li>
          </ul>
        </div>
      </CardFooter>
    </Card>
  );
};
