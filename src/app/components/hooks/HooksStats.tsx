'use client';

import React from 'react';
import { hookStats } from '@/app/data/hooksData';

const StatCard = ({ title, value, change }: { title: string; value: string; change?: string }) => (
  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
    <h3 className="text-white/80 font-roboto mb-2">{title}</h3>
    <div className="flex items-baseline gap-3">
      <p className="text-2xl font-semibold font-montserrat text-white">{value}</p>
      {change && (
        <span className={`text-sm ${change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
          {change}
        </span>
      )}
    </div>
  </div>
);

export default function HooksStats() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-yellow-400">⚠️</span>
          <p className="text-sm text-white/80">
            All TVL and volume data are estimates. For accurate data, please visit each protocol&apos;s official website.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Value Locked" 
            value={hookStats.totalTvl} 
            change={hookStats.changes.tvl} 
          />
          <StatCard 
            title="24h Volume" 
            value={hookStats.volume24h} 
            change={hookStats.changes.volume} 
          />
          <StatCard 
            title="Active Hooks" 
            value={hookStats.activeHooks.toString()} 
            change={hookStats.changes.hooks} 
          />
          <StatCard 
            title="Total Transactions" 
            value={hookStats.totalTransactions} 
            change={hookStats.changes.transactions} 
          />
        </div>
      </div>
    </div>
  );
}
