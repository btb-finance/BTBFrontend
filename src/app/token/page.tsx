'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const PieChart = dynamic(
  () => import('react-minimal-pie-chart').then((mod) => mod.PieChart),
  { ssr: false }
);

export default function TokenPage() {
  const [mounted, setMounted] = useState(false);
  const tokenData = [
    { title: 'Initial Supply', value: 20, color: '#1976D2' },
    { title: 'Liquidity Pool', value: 10, color: '#4CAF50' },
    { title: 'Team & Development', value: 70, color: '#FFD700' },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1976D2] via-blue-800 to-[#1976D2]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        {/* Hero Section */}
        <div className="text-center mb-8 sm:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-montserrat text-white mb-4 sm:mb-6">
            BTB Token
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 max-w-3xl mx-auto px-4">
            The governance token of BTB Finance, powering the future of DeFi on Optimism
          </p>
        </div>

        {/* Token Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-16">
          {/* Token Details */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-montserrat font-bold text-white mb-4 sm:mb-6">Token Details</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Name</h3>
                <p className="text-blue-100">BTB Finance</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Symbol</h3>
                <p className="text-blue-100">BTB</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Network</h3>
                <p className="text-blue-100">Optimism</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">Total Supply</h3>
                <p className="text-blue-100">1,000,000,000 BTB</p>
              </div>
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-montserrat font-bold text-white mb-4 sm:mb-6">Token Distribution</h2>
            {mounted && (
              <div className="flex items-center justify-center mb-6 sm:mb-8">
                <div className="w-48 h-48 sm:w-64 sm:h-64">
                  <PieChart
                    data={tokenData}
                    lineWidth={50}
                    paddingAngle={2}
                    rounded
                    label={({ dataEntry }) => `${dataEntry.value}%`}
                    labelStyle={{
                      fontSize: '5px',
                      fontFamily: 'sans-serif',
                      fill: '#fff',
                    }}
                    labelPosition={70}
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              {tokenData.map((item) => (
                <div key={item.title} className="flex items-center space-x-3">
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-sm sm:text-base text-blue-100">{item.title}</span>
                  <span className="text-sm sm:text-base text-blue-100 ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Token Allocation Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-montserrat font-bold text-white mb-3 sm:mb-4">Initial Supply</h3>
            <p className="text-2xl sm:text-3xl font-bold text-[#1976D2] mb-2">200M BTB</p>
            <p className="text-sm sm:text-base text-blue-100">20% of total supply available at launch for early supporters and community initiatives</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-montserrat font-bold text-white mb-3 sm:mb-4">Liquidity Pool</h3>
            <p className="text-2xl sm:text-3xl font-bold text-[#4CAF50] mb-2">100M BTB</p>
            <p className="text-sm sm:text-base text-blue-100">10% allocated to ensure deep liquidity across major DEXs</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 sm:p-6">
            <h3 className="text-lg sm:text-xl font-montserrat font-bold text-white mb-3 sm:mb-4">Team & Development</h3>
            <p className="text-2xl sm:text-3xl font-bold text-[#FFD700] mb-2">700M BTB</p>
            <p className="text-sm sm:text-base text-blue-100">70% reserved for team, future development, and ecosystem growth</p>
          </div>
        </div>
      </div>
    </div>
  );
}
