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

interface Loan {
  id: string;
  protocol: string;
  collateral: {
    symbol: string;
    amount: string;
    valueUSD: string;
  };
  debt: {
    symbol: string;
    amount: string;
    valueUSD: string;
  };
  health: string;
  liquidationPrice: string;
  interestRate: string;
}

interface LoansListProps {
  loans: Loan[];
}

export default function LoansList({ loans }: LoansListProps) {
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const toggleExpand = (loanId: string) => {
    setExpandedLoan(expandedLoan === loanId ? null : loanId);
  };

  const getHealthColor = (health: string) => {
    switch (health.toLowerCase()) {
      case 'healthy':
      case 'good':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health.toLowerCase()) {
      case 'healthy':
      case 'good':
        return <ShieldExclamationIcon className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ShieldExclamationIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!loans || loans.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12">
            <BanknotesIcon className="h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Active Loans</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
              You don't have any active loans. Create a new loan to leverage your assets.
            </p>
            <Button>Create New Loan</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Your Active Loans</h2>
          <Button>Create New Loan</Button>
        </div>

        <div className="space-y-4">
          {loans.map((loan) => (
            <div 
              key={loan.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              {/* Loan Header */}
              <div 
                className={`p-4 cursor-pointer ${
                  expandedLoan === loan.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                    : 'bg-white dark:bg-gray-800'
                }`}
                onClick={() => toggleExpand(loan.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getHealthIcon(loan.health)}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{loan.protocol}</h3>
                      <div className="flex items-center mt-1">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {loan.collateral.symbol} → {loan.debt.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        Debt: {loan.debt.valueUSD}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Collateral: {loan.collateral.valueUSD}
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${getHealthColor(loan.health)}`}>
                      {loan.health}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Loan Details */}
              {expandedLoan === loan.id && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Collateral Details
                      </h4>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Asset</span>
                          <span className="text-sm font-medium">{loan.collateral.symbol}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Amount</span>
                          <span className="text-sm font-medium">{loan.collateral.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Value</span>
                          <span className="text-sm font-medium">{loan.collateral.valueUSD}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Debt Details
                      </h4>
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Asset</span>
                          <span className="text-sm font-medium">{loan.debt.symbol}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Amount</span>
                          <span className="text-sm font-medium">{loan.debt.amount}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Value</span>
                          <span className="text-sm font-medium">{loan.debt.valueUSD}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Interest Rate</span>
                          <span className="text-sm font-medium">{loan.interestRate}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Health Factor
                      </div>
                      <div className={`text-lg font-semibold ${
                        loan.health.toLowerCase() === 'healthy' ? 'text-green-500' :
                        loan.health.toLowerCase() === 'warning' ? 'text-yellow-500' :
                        'text-red-500'
                      }`}>
                        {loan.health}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Liquidation Price
                      </div>
                      <div className="text-lg font-semibold">
                        {loan.liquidationPrice}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Interest Rate
                      </div>
                      <div className="text-lg font-semibold">
                        {loan.interestRate}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <Button variant="outline" leftIcon={<ArrowUpTrayIcon className="h-4 w-4" />}>
                      Repay
                    </Button>
                    <Button variant="outline" leftIcon={<ArrowDownTrayIcon className="h-4 w-4" />}>
                      Borrow More
                    </Button>
                    <Button leftIcon={<ArrowUpTrayIcon className="h-4 w-4" />}>
                      Add Collateral
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
