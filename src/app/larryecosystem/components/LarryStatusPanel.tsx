'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { ShieldIcon, AlertCircleIcon } from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';
import larryService from '../../services/larryService';
import { useWalletConnection } from '../../hooks/useWalletConnection';

export default function LarryStatusPanel() {
  const { address, isConnected } = useWalletConnection();
  const [userBalance, setUserBalance] = useState('0');
  const [pendingRewards, setPendingRewards] = useState('0');
  const [contractStatus, setContractStatus] = useState({
    totalBorrowed: '0',
    totalCollateral: '0',
    buyFee: '0',
    sellFee: '0'
  });
  const [loading, setLoading] = useState(true);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);

  // Check if we're on Ethereum mainnet
  useEffect(() => {
    const checkNetwork = async () => {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
          setIsCorrectNetwork(chainId === '0x1'); // 0x1 is Ethereum mainnet
        } catch (error) {
          console.error('Error checking network:', error);
        }
      }
    };
    
    checkNetwork();
    
    if ((window as any).ethereum) {
      (window as any).ethereum.on('chainChanged', checkNetwork);
    }

    return () => {
      if ((window as any).ethereum) {
        (window as any).ethereum.removeListener('chainChanged', checkNetwork);
      }
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!isConnected || !address) {
        setUserBalance('0');
        setPendingRewards('0');
        return;
      }

      try {
        const balance = await larryService.getUserBalance(address);
        setUserBalance(balance);
        
        const status = await larryService.getContractStatus();
        setContractStatus(status);
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [isConnected, address]);

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-emerald-600">Larry Status</h3>
        <ShieldIcon className="h-6 w-6 text-emerald-500" />
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your Balance</p>
            <p className="text-xl font-bold text-emerald-600">
              {loading ? '...' : formatNumber(userBalance)} LARRY
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Buy Fee</p>
            <p className="text-xl font-bold text-emerald-600">
              {loading ? '...' : `${contractStatus.buyFee}%`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Borrowed</p>
            <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
              {loading ? '...' : formatNumber(contractStatus.totalBorrowed)} ETH
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Collateral</p>
            <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
              {loading ? '...' : formatNumber(contractStatus.totalCollateral)} LARRY
            </p>
          </div>
        </div>

        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
          <div className="flex items-start space-x-3">
            <AlertCircleIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
            <div className="text-sm text-emerald-700 dark:text-emerald-300">
              <p className="font-semibold mb-1">Stability Mechanism</p>
              <p>Larry's price is guaranteed to never decrease. Buy fees ensure price only goes up with every transaction.</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}