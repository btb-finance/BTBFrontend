'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/card';
import { TrendingUpIcon } from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';
import larryService from '../../services/larryService';

export default function PriceDisplay() {
  const [currentPrice, setCurrentPrice] = useState('0');
  const [backing, setBacking] = useState('0');
  const [totalSupply, setTotalSupply] = useState('0');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await larryService.getTokenMetrics();
        setCurrentPrice(data.price);
        setBacking(data.backing);
        setTotalSupply(data.totalSupply);
      } catch (error) {
        console.error('Error fetching price data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="p-6 bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-emerald-700">LARRY Price</h3>
        <TrendingUpIcon className="h-5 w-5 text-emerald-600" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Current Price</p>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? '...' : `${formatNumber(currentPrice)} ETH`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Backing</p>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? '...' : `${formatNumber(backing)} ETH`}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Supply</p>
          <p className="text-2xl font-bold text-emerald-600">
            {loading ? '...' : formatNumber(totalSupply)}
          </p>
        </div>
      </div>
      
      <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg">
        <p className="text-xs text-center text-emerald-700">
          Price can only increase, never decrease - guaranteed by smart contract
        </p>
      </div>
    </Card>
  );
}