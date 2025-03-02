'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  ShieldExclamationIcon,
  BanknotesIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { ethers } from 'ethers';

interface Asset {
  tokenAddress: string;
  symbol: string;
  name: string;
  // Original fields
  currentATokenBalance?: string;
  currentVariableDebt?: string;
  currentStableDebt?: string;
  liquidityRate?: string;
  stableBorrowRate?: string;
  variableBorrowRate?: string;
  // New fields from improved service
  formattedSupplied?: string;
  formattedBorrowed?: string;
  supplied?: string;
  borrowed?: string;
  decimals?: number;
}

interface UserPosition {
  totalCollateralBase: string;
  totalDebtBase: string;
  availableBorrowsBase: string;
  currentLiquidationThreshold: string;
  ltv: string;
  healthFactor: string;
  reserves: Asset[];
}

interface AavePositionsProps {
  userPositions: UserPosition | null;
  onSupply: (asset: Asset) => void;
  onWithdraw: (asset: Asset) => void;
  onBorrow: (asset: Asset) => void;
  onRepay: (asset: Asset) => void;
}

export function AavePositions({ 
  userPositions, 
  onSupply, 
  onWithdraw, 
  onBorrow, 
  onRepay 
}: AavePositionsProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);

  const toggleExpand = (assetAddress: string) => {
    setExpandedAsset(expandedAsset === assetAddress ? null : assetAddress);
  };

  const getHealthColor = (healthFactor: string) => {
    const health = parseFloat(healthFactor);
    if (health === Infinity || health >= 2) {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    } else if (health >= 1.1) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    } else {
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    }
  };

  const getHealthText = (healthFactor: string) => {
    const health = parseFloat(healthFactor);
    if (health === Infinity || health >= 2) {
      return 'Healthy';
    } else if (health >= 1.1) {
      return 'Warning';
    } else {
      return 'Critical';
    }
  };

  const getHealthIcon = (healthFactor: string) => {
    const health = parseFloat(healthFactor);
    if (health === Infinity || health >= 2) {
      return <ShieldExclamationIcon className="h-5 w-5 text-green-500" />;
    } else if (health >= 1.1) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    } else {
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    }
  };

  // Format currency with 2 decimal places
  const formatCurrency = (value: string | undefined) => {
    if (!value) return '$0.00';
    
    // Check if the value is already formatted
    if (typeof value === 'string' && value.startsWith('$')) {
      return value;
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  // Format percentage
  const formatPercent = (value: string) => {
    const percent = parseFloat(value) / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(percent);
  };

  // Format APY/APR
  const formatAPY = (value: string) => {
    // Convert ray (10^27) to percentage
    const ray = ethers.BigNumber.from(value);
    const percentage = ray.mul(100).div(ethers.BigNumber.from(10).pow(25));
    return (percentage.toNumber() / 100).toFixed(2) + '%';
  };

  if (!userPositions) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <BanknotesIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
              Connect your wallet to view your Aave positions and interact with the protocol.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Check if user has any actual positions (non-zero balances)
  const hasSuppliedAssets = userPositions.reserves.some(asset => 
    parseFloat(asset.currentATokenBalance || '0') > 0
  );
  
  const hasBorrowedAssets = userPositions.reserves.some(asset => 
    parseFloat(asset.currentVariableDebt || '0') > 0 || 
    parseFloat(asset.currentStableDebt || '0') > 0
  );
  
  const hasNoPositions = !hasSuppliedAssets && !hasBorrowedAssets && 
    parseFloat(userPositions.totalCollateralBase) === 0 && 
    parseFloat(userPositions.totalDebtBase) === 0;
  
  if (hasNoPositions) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <BanknotesIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Aave Positions</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
              You don't have any active positions on Aave. Start by supplying assets to earn interest or borrow against your collateral.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Position Summary */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-4">Position Summary</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Total Collateral
              </div>
              <div className="text-lg font-semibold">
                {formatCurrency(userPositions.totalCollateralBase)}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Total Debt
              </div>
              <div className="text-lg font-semibold">
                {formatCurrency(userPositions.totalDebtBase)}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Available to Borrow
              </div>
              <div className="text-lg font-semibold">
                {formatCurrency(userPositions.availableBorrowsBase)}
              </div>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Health Factor
              </div>
              <div className={`text-lg font-semibold ${
                parseFloat(userPositions.healthFactor) >= 2 ? 'text-green-500' :
                parseFloat(userPositions.healthFactor) >= 1.1 ? 'text-yellow-500' :
                'text-red-500'
              }`}>
                {parseFloat(userPositions.healthFactor) >= 1000000 
                  ? '∞' 
                  : parseFloat(userPositions.healthFactor).toFixed(2)}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Liquidation Threshold
              </div>
              <div className="text-lg font-semibold">
                {formatPercent(userPositions.currentLiquidationThreshold)}
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                LTV
              </div>
              <div className="text-lg font-semibold">
                {formatPercent(userPositions.ltv)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Supplied Assets */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-4">Your Supplied Assets</h2>
          
          {userPositions.reserves.filter(asset => 
            parseFloat(asset.currentATokenBalance || '0') > 0
          ).length === 0 ? (
            <div className="py-6 text-center text-gray-500 dark:text-gray-400">
              You haven't supplied any assets yet.
            </div>
          ) : (
            <div className="space-y-4">
              {userPositions.reserves
                .filter(asset => parseFloat(asset.currentATokenBalance || '0') > 0)
                .map((asset) => (
                  <div 
                    key={`supply-${asset.tokenAddress}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div 
                      className="p-4 cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => toggleExpand(asset.tokenAddress)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                            {asset.symbol.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-medium">{asset.symbol}</h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {asset.name}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-medium">
                            {parseFloat(asset.currentATokenBalance || '0').toFixed(6)}
                          </div>
                          <div className="text-sm text-green-600 dark:text-green-400">
                            APY: {formatAPY(asset.liquidityRate || '0')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {expandedAsset === asset.tokenAddress && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-end space-x-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onWithdraw(asset)}
                          >
                            <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                            Withdraw
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => onSupply(asset)}
                          >
                            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                            Supply More
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Borrowed Assets */}
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-bold mb-4">Your Borrowed Assets</h2>
          
          {userPositions.reserves.filter(asset => 
            parseFloat(asset.currentVariableDebt || '0') > 0 || 
            parseFloat(asset.currentStableDebt || '0') > 0
          ).length === 0 ? (
            <div className="py-6 text-center text-gray-500 dark:text-gray-400">
              You haven't borrowed any assets yet.
            </div>
          ) : (
            <div className="space-y-4">
              {userPositions.reserves
                .filter(asset => 
                  parseFloat(asset.currentVariableDebt || '0') > 0 || 
                  parseFloat(asset.currentStableDebt || '0') > 0
                )
                .map((asset) => (
                  <div 
                    key={`borrow-${asset.tokenAddress}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <div 
                      className="p-4 cursor-pointer bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => toggleExpand(`borrow-${asset.tokenAddress}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                            {asset.symbol.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-medium">{asset.symbol}</h3>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {asset.name}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="font-medium">
                            {parseFloat(asset.currentVariableDebt || '0') > 0 
                              ? parseFloat(asset.currentVariableDebt || '0').toFixed(6) 
                              : parseFloat(asset.currentStableDebt || '0').toFixed(6)
                            }
                          </div>
                          <div className="text-sm text-red-600 dark:text-red-400">
                            APR: {formatAPY(asset.variableBorrowRate || asset.stableBorrowRate || '0')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {expandedAsset === `borrow-${asset.tokenAddress}` && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-end space-x-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onRepay(asset)}
                          >
                            <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                            Repay
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => onBorrow(asset)}
                          >
                            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                            Borrow More
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
