'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../../../context/WalletContext';
import chicksService from '../../services/chicksService';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { ShieldCheckIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface LoanData {
  collateral: string;
  borrowed: string;
  endDate: number;
  numberOfDays: number;
}

interface LoanInfoProps {
  hasLoan: boolean;
  loanData: LoanData | null;
  chicksPrice: string; // Keeping for future use
  onSuccess: () => void; // Keeping for future use
}

export default function LoanInfo({ hasLoan, loanData }: LoanInfoProps) {
  const { isConnected } = useWallet();
  const [isExpired, setIsExpired] = useState<boolean>(false);

  const checkLoanExpiry = useCallback(async () => {
    if (!hasLoan || !loanData) return;

    try {
      const expired = await chicksService.isLoanExpired();
      setIsExpired(expired);
    } catch (error) {
      console.error('Error checking loan expiry:', error);
    }
  }, [hasLoan, loanData]);

  useEffect(() => {
    if (hasLoan && loanData) {
      checkLoanExpiry();
    }
  }, [hasLoan, loanData, checkLoanExpiry]);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp * 1000);
      const options: Intl.DateTimeFormatOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      return date.toLocaleDateString(undefined, options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'N/A';
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
            You don&apos;t have any active loans at this time.
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
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <table className="w-full">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                  Borrowed Amount
                </td>
                <td className="px-4 py-3 font-medium">
                  {loanData ? parseFloat(loanData.borrowed).toFixed(6) : '0.00'} USDC
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                  Collateral
                </td>
                <td className="px-4 py-3 font-medium">
                  {loanData ? parseFloat(loanData.collateral).toFixed(6) : '0.00'} CHICKS
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                  Loan Duration
                </td>
                <td className="px-4 py-3 font-medium">
                  {loanData ? loanData.numberOfDays : '0'} days
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                  Loan Expiry
                </td>
                <td className="px-4 py-3 font-medium">
                  {loanData && loanData.endDate ? formatDate(loanData.endDate) : 'N/A'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {isExpired && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded text-sm">
            <div className="flex items-start">
              <CalendarIcon className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Loan Expired
                </p>
                <p className="text-yellow-700 dark:text-yellow-300">
                  Your loan has expired. Please repay your loan to retrieve your collateral.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
