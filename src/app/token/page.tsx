'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/app/components/ui/card';

const PieChart = dynamic(
  () => import('react-minimal-pie-chart').then((mod) => mod.PieChart),
  { ssr: false }
);

export default function TokenPage() {
  const [mounted, setMounted] = useState(false);
  const tokenData = [
    { title: 'Initial Supply', value: 20, color: '#4f46e5' },
    { title: 'Liquidity Pool', value: 10, color: '#10b981' },
    { title: 'Team & Development', value: 70, color: '#6366f1' },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 mb-4 rounded-full bg-btb-primary/10 border border-btb-primary/20">
              <p className="text-sm font-medium text-btb-primary">BTB Token</p>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent">
              BTB Finance Token
            </h1>
            <p className="text-lg mb-6 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              The governance token of BTB Finance, powering the future of DeFi on Base Network
            </p>
          </div>

          {/* Token Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Token Details */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Token Details</h2>
              <div className="space-y-4">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Name</h3>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">BTB Finance</p>
                </div>
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Symbol</h3>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">BTB</p>
                </div>
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Network</h3>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">Base</p>
                </div>
                <div className="pb-4">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Supply</h3>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">1,000,000,000 BTB</p>
                </div>
              </div>
            </Card>

            {/* Distribution Chart */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Token Distribution</h2>
              {mounted && (
                <div className="flex items-center justify-center mb-8">
                  <div className="w-64 h-64">
                    <PieChart
                      data={tokenData}
                      lineWidth={50}
                      paddingAngle={2}
                      rounded
                      label={({ dataEntry }) => `${dataEntry.value}%`}
                      labelStyle={{
                        fontSize: '6px',
                        fontFamily: 'sans-serif',
                        fill: '#fff',
                      }}
                      labelPosition={70}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {tokenData.map((item) => (
                  <div key={item.title} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.title}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Token Allocation Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Initial Supply</h3>
              <p className="text-3xl font-bold text-btb-primary mb-2">200M BTB</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">20% of total supply available at launch for early supporters and community initiatives</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Liquidity Pool</h3>
              <p className="text-3xl font-bold text-emerald-500 mb-2">100M BTB</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">10% allocated to ensure deep liquidity across major DEXs</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Team & Development</h3>
              <p className="text-3xl font-bold text-indigo-500 mb-2">700M BTB</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">70% reserved for team, future development, and ecosystem growth</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
