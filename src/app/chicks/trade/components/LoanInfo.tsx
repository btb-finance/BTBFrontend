'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../../services/chicksService';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface LoanInfoProps {
  hasLoan: boolean;
  loanData: any;
  chicksPrice: string;
  onSuccess: () => void;
}

export default function LoanInfo({ hasLoan, loanData, chicksPrice, onSuccess }: LoanInfoProps) {
  const { isConnected } = useWallet();
  const [liquidationPrice, setLiquidationPrice] = useState<string>('0');
  const [healthFactor, setHealthFactor] = useState<number>(0);
  const [isLiquidating, setIsLiquidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasLoan && loanData && chicksPrice) {
      calculateLoanMetrics();
    }
  }, [hasLoan, loanData, chicksPrice]);

  const calculateLoanMetrics = () => {
    if (!hasLoan || !loanData) return;

    try {
      const totalDebt = parseFloat(loanData.borrowed) + parseFloat(loanData.interest);
      const collateralValue = parseFloat(loanData.collateral) * parseFloat(chicksPrice);
      
      // Calculate health factor (collateral value / debt)
      const factor = collateralValue / totalDebt;
      setHealthFactor(factor);
      
      // Calculate liquidation price
      // Liquidation happens when collateral value = debt * liquidation threshold (usually 110%)
      // So: collateral * liquidation_price = debt * 1.1
      // liquidation_price = (debt * 1.1) / collateral
      const liquidationThreshold = 1.1; // 110%
      const liqPrice = (totalDebt * liquidationThreshold) / parseFloat(loanData.collateral);
      setLiquidationPrice(liqPrice.toFixed(6));
    } catch (error) {
      console.error('Error calculating loan metrics:', error);
    }
  };

  const getHealthColor = () => {
    if (healthFactor >= 2) return 'text-green-500';
    if (healthFactor >= 1.5) return 'text-yellow-500';
    if (healthFactor >= 1.2) return 'text-orange-500';
    return 'text-red-500';
  };

  const getHealthStatus = () => {
    if (healthFactor >= 2) return 'Excellent';
    if (healthFactor >= 1.5) return 'Good';
    if (healthFactor >= 1.2) return 'Caution';
    return 'At Risk';
  };

  const handleLiquidate = async () => {
    if (!hasLoan || !loanData) {
      return;
    }

    try {
      setIsLiquidating(true);
      setError(null);

      // Execute liquidate transaction
      const tx = await chicksService.liquidate();
      await tx.wait();

      // Refresh data
      onSuccess();
    } catch (error: any) {
      console.error('Error liquidating loan:', error);
      setError(error.message || 'Failed to liquidate loan. Please try again.');
    } finally {
      setIsLiquidating(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan Information</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Please connect your wallet to view loan information
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasLoan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan Information</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-6">
          <ShieldCheckIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h4 className="text-lg font-medium mb-2">No Active Loans</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You don't have any active loans at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Borrowed Amount
            </div>
            <div className="font-medium">
              {loanData ? parseFloat(loanData.borrowed).toFixed(6) : '0.00'} USDC
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Accrued Interest
            </div>
            <div className="font-medium">
              {loanData ? parseFloat(loanData.interest).toFixed(6) : '0.00'} USDC
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Debt
            </div>
            <div className="font-medium">
              {loanData 
                ? (parseFloat(loanData.borrowed) + parseFloat(loanData.interest)).toFixed(6) 
                : '0.00'} USDC
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Collateral
            </div>
            <div className="font-medium">
              {loanData ? parseFloat(loanData.collateral).toFixed(6) : '0.00'} CHICKS
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Loan Expiry
            </div>
            <div className="font-medium">
              {loanData && loanData.expiry 
                ? new Date(parseInt(loanData.expiry) * 1000).toLocaleDateString() 
                : 'N/A'}
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Health Factor
            </div>
            <div className={`font-medium ${getHealthColor()}`}>
              {healthFactor.toFixed(2)} ({getHealthStatus()})
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Liquidation Price
            </div>
            <div className="font-medium">
              ${parseFloat(liquidationPrice).toFixed(6)} USDC
            </div>
          </div>
        </div>
        
        {healthFactor < 1.2 && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded text-sm">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200 mb-1">
                  Liquidation Risk
                </p>
                <p className="text-red-700 dark:text-red-300">
                  Your loan is at risk of liquidation. Consider repaying some of your debt or adding more collateral to improve your health factor.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded">
            {error}
          </div>
        )}
        
        <div className="pt-2">
          <Button
            onClick={handleLiquidate}
            disabled={isLiquidating || healthFactor > 1.1}
            variant="destructive"
            className="w-full"
          >
            {isLiquidating ? 'Processing...' : 'Liquidate Position'}
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            Liquidate your position to retrieve your collateral minus liquidation penalty.
            Only available when health factor is critically low.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
