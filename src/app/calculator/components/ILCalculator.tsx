'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import * as math from 'mathjs';

export default function ILCalculator() {
  // Initial state values from Uniswap V3 WETH/USDC pool data
  const [volatileAsset, setVolatileAsset] = useState('WETH');
  const [initialPrice, setInitialPrice] = useState(2223.24);
  const [initialAmount, setInitialAmount] = useState(0.213342);
  const [upperTick, setUpperTick] = useState(2331.25);
  const [lowerTick, setLowerTick] = useState(2109.22);
  const [estimatedAPR, setEstimatedAPR] = useState(5.978); // 597.8% annual
  const [daysInFuture, setDaysInFuture] = useState(7);
  const [daysOutOfRange, setDaysOutOfRange] = useState(0);
  const [futurePrice, setFuturePrice] = useState(2223.24);
  
  // Calculated values
  const [calculations, setCalculations] = useState({
    futureAmountETH: 0,
    futureAmountStables: 0,
    futureValue: 0,
    initialStablesNeeded: 0,
    lpYield: 0,
    effectiveAPR: 0,
    estimatedInterest: 0,
    futureValueWithInterest: 0,
    ethValueIfHeld: 0,
    stablesValueIfHeld: 0,
    totalValueIfHeld: 0,
    impermanentLossDollars: 0,
    impermanentLossPercent: 0,
    ethValueIfLP: 0,
    stablesValueIfLP: 0,
    totalIfLP: 0,
    pnlAfterYieldDollars: 0,
    pnlAfterYieldPercent: 0,
    hodlOrLP: ''
  });

  // Calculate all values whenever inputs change
  useEffect(() => {
    // Helpers to match Excel math more clearly
    const sqrt = (x: number) => Math.sqrt(x);
    
    // Calculate liquidity values
    const liquidityX = initialAmount * ((sqrt(initialPrice) * sqrt(upperTick)) / (sqrt(upperTick) - sqrt(initialPrice)));
    const initialStablesNeeded = liquidityX * (sqrt(initialPrice) - sqrt(lowerTick));
    
    // Calculate LP yield
    const lpYield = ((daysInFuture - daysOutOfRange) / 365) * estimatedAPR;
    const effectiveAPR = (365 / daysInFuture) * lpYield;
    
    // Future ETH amount calculation - matches the Excel formula
    let futureAmountETH;
    if (futurePrice >= lowerTick && futurePrice < upperTick) {
      futureAmountETH = liquidityX * ((sqrt(upperTick) - sqrt(futurePrice)) / (sqrt(futurePrice) * sqrt(upperTick)));
    } else if (futurePrice < lowerTick) {
      futureAmountETH = liquidityX * ((sqrt(upperTick) - sqrt(lowerTick)) / (sqrt(lowerTick) * sqrt(upperTick)));
    } else { // futurePrice >= upperTick
      futureAmountETH = liquidityX * ((sqrt(upperTick) - sqrt(upperTick)) / (sqrt(upperTick) * sqrt(upperTick)));
    }
    
    // Future stables amount
    let futureAmountStables;
    if (futurePrice >= lowerTick && futurePrice <= upperTick) {
      futureAmountStables = liquidityX * (sqrt(futurePrice) - sqrt(lowerTick));
    } else if (futurePrice < lowerTick) {
      futureAmountStables = liquidityX * (sqrt(lowerTick) - sqrt(lowerTick));
    } else { // futurePrice > upperTick
      futureAmountStables = liquidityX * (sqrt(upperTick) - sqrt(lowerTick));
    }
    
    // Future value calculation
    const futureValue = futureAmountETH * futurePrice + futureAmountStables;
    
    // Estimating interest
    const estimatedInterest = futureValue * lpYield;
    const futureValueWithInterest = futureValue + estimatedInterest;
    
    // HODL values
    const ethValueIfHeld = initialAmount * futurePrice;
    const stablesValueIfHeld = initialStablesNeeded;
    const totalValueIfHeld = ethValueIfHeld + stablesValueIfHeld;
    
    // LP values
    const ethValueIfLP = futureAmountETH * futurePrice;
    const stablesValueIfLP = futureAmountStables;
    const totalIfLP = ethValueIfLP + stablesValueIfLP;
    
    // Impermanent Loss and PnL calculations
    const impermanentLossDollars = totalIfLP - totalValueIfHeld;
    const impermanentLossPercent = impermanentLossDollars / totalValueIfHeld;
    
    const pnlAfterYieldDollars = totalIfLP - totalValueIfHeld + estimatedInterest;
    const pnlAfterYieldPercent = pnlAfterYieldDollars / totalValueIfHeld;
    
    // HODL or LP recommendation
    const hodlOrLP = pnlAfterYieldDollars > 0 ? "LP" : "HODL";
    
    // Update state with all calculations
    setCalculations({
      futureAmountETH,
      futureAmountStables,
      futureValue,
      initialStablesNeeded,
      lpYield,
      effectiveAPR,
      estimatedInterest,
      futureValueWithInterest,
      ethValueIfHeld,
      stablesValueIfHeld,
      totalValueIfHeld,
      impermanentLossDollars,
      impermanentLossPercent,
      ethValueIfLP,
      stablesValueIfLP,
      totalIfLP,
      pnlAfterYieldDollars,
      pnlAfterYieldPercent,
      hodlOrLP
    });
  }, [volatileAsset, initialPrice, initialAmount, upperTick, lowerTick, estimatedAPR, daysInFuture, daysOutOfRange, futurePrice]);

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format percentage values
  const formatPercent = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <Card className="mb-8">
        <CardHeader className="bg-btb-primary-light/20">
          <CardTitle className="text-center text-2xl text-btb-primary">
            CONCENTRATED LIQUIDITY IMPERMANENT LOSS CALCULATOR (STABLE/UNSTABLE PAIR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div className="space-y-4 p-4 bg-btb-primary-light/10 rounded-md">
              <h2 className="text-xl font-bold text-center bg-btb-primary text-white p-2 rounded">INPUTS</h2>
              
              <div className="space-y-2">
                <Label htmlFor="volatileAsset">Volatile Asset</Label>
                <Input 
                  id="volatileAsset" 
                  value={volatileAsset} 
                  onChange={(e) => setVolatileAsset(e.target.value)}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="initialPrice">Initial Price ({volatileAsset})</Label>
                <Input 
                  id="initialPrice" 
                  type="number" 
                  value={initialPrice.toString()} 
                  onChange={(e) => setInitialPrice(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="initialAmount">{volatileAsset} Initial Amount</Label>
                <Input 
                  id="initialAmount" 
                  type="number" 
                  value={initialAmount.toString()} 
                  onChange={(e) => setInitialAmount(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="upperTick">{volatileAsset} Upper Tick</Label>
                <Input 
                  id="upperTick" 
                  type="number" 
                  value={upperTick.toString()} 
                  onChange={(e) => setUpperTick(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lowerTick">{volatileAsset} Lower Tick</Label>
                <Input 
                  id="lowerTick" 
                  type="number" 
                  value={lowerTick.toString()} 
                  onChange={(e) => setLowerTick(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimatedAPR">Estimated APR</Label>
                <Input 
                  id="estimatedAPR" 
                  type="number" 
                  step="0.01"
                  value={estimatedAPR.toString()} 
                  onChange={(e) => setEstimatedAPR(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">Input as decimal (5.978 = 597.8%)</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="futurePrice">Future Price ({volatileAsset})</Label>
                <Input 
                  id="futurePrice" 
                  type="number" 
                  value={futurePrice.toString()} 
                  onChange={(e) => setFuturePrice(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="daysInFuture">Days in The Future</Label>
                <Input 
                  id="daysInFuture" 
                  type="number" 
                  value={daysInFuture.toString()} 
                  onChange={(e) => setDaysInFuture(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="daysOutOfRange">Days Out of Range</Label>
                <Input 
                  id="daysOutOfRange" 
                  type="number" 
                  value={daysOutOfRange.toString()} 
                  onChange={(e) => setDaysOutOfRange(Number(e.target.value))}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-md space-y-4">
                <h2 className="text-xl font-bold text-center bg-green-600 text-white p-2 rounded">OUTPUTS</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Future Amount, {volatileAsset}</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{calculations.futureAmountETH.toFixed(3)}</div>
                  </div>
                  
                  <div>
                    <Label>Future Amount, Stables</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.futureAmountStables)}</div>
                  </div>
                  
                  <div>
                    <Label>Future Value</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.futureValue)}</div>
                  </div>
                  
                  <div>
                    <Label>Initial Stables Needed</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.initialStablesNeeded)}</div>
                  </div>
                  
                  <div>
                    <Label>LP Yield</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatPercent(calculations.lpYield)}</div>
                  </div>
                  
                  <div>
                    <Label>Effective APR</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatPercent(calculations.effectiveAPR)}</div>
                  </div>
                  
                  <div>
                    <Label>Estimated Interest</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.estimatedInterest)}</div>
                  </div>
                  
                  <div>
                    <Label>Future Value w/ Interest</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.futureValueWithInterest)}</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-md">
                <h2 className="text-xl font-bold text-center bg-btb-primary text-white p-2 rounded mb-4">IMPERMANENT LOSS CALCULATIONS</h2>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>{volatileAsset} Value if Held</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.ethValueIfHeld)}</div>
                  </div>
                  
                  <div>
                    <Label>Stables Value if Held</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.stablesValueIfHeld)}</div>
                  </div>
                  
                  <div>
                    <Label>Total Value if Held</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.totalValueIfHeld)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>{volatileAsset} Value if LP</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.ethValueIfLP)}</div>
                  </div>
                  
                  <div>
                    <Label>Stables Value if LP</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.stablesValueIfLP)}</div>
                  </div>
                  
                  <div>
                    <Label>Total if LP</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.totalIfLP)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label>Impermanent Loss ($)</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.impermanentLossDollars)}</div>
                  </div>
                  
                  <div>
                    <Label>Impermanent Loss (%)</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatPercent(calculations.impermanentLossPercent)}</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>PnL After Yield Added ($)</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatCurrency(calculations.pnlAfterYieldDollars)}</div>
                  </div>
                  
                  <div>
                    <Label>PnL After Yield Added (%)</Label>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded border">{formatPercent(calculations.pnlAfterYieldPercent)}</div>
                  </div>
                  
                  <div>
                    <Label>HODL or LP?</Label>
                    <div className={`p-2 rounded border text-center font-bold ${calculations.hodlOrLP === 'LP' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}`}>
                      {calculations.hodlOrLP}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2">
        <p>Calculator based on Uniswap V3 concentrated liquidity impermanent loss formulas.</p>
        <p className="mt-1">Formula: (X + (L/√Pb))(Y + L√Pa) = L²</p>
      </div>
    </div>
  );
}
