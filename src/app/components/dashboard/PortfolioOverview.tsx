'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { Chart } from 'chart.js/auto';
import { useEffect, useRef, useMemo } from 'react';
import { Portfolio } from '../../services/btbApi';

interface PortfolioOverviewProps {
  portfolioData: Portfolio | null;
}

export default function PortfolioOverview({ portfolioData }: PortfolioOverviewProps) {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Format number as currency
  const formatCurrency = (value: number | string): string => {
    // Handle string inputs (like '$12,450.75')
    if (typeof value === 'string') {
      if (value.startsWith('$')) return value;
      const numValue = parseFloat(value.replace(/,/g, ''));
      if (isNaN(numValue)) return value;
      value = numValue;
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(value);
  };

  // If no data is provided, use empty stats
  const stats = useMemo(() => {
    if (!portfolioData) return [];
    
    return [
      {
        name: 'Total Value',
        value: typeof portfolioData.totalValue === 'number' 
          ? formatCurrency(portfolioData.totalValue)
          : (portfolioData.totalValue as string || '$0.00'),
        change: portfolioData.changePercentage24h || '+0.0%',
        changeType: (portfolioData.changePercentage24h && portfolioData.changePercentage24h.startsWith('-')) 
          ? 'decrease' as const 
          : 'increase' as const
      },
      {
        name: 'Total Earnings',
        value: portfolioData.totalEarnings !== undefined 
          ? formatCurrency(portfolioData.totalEarnings)
          : '$0.00',
        change: '+0.0%',
        changeType: 'increase' as const
      },
      {
        name: 'Average APY',
        value: portfolioData.averageApy !== undefined 
          ? `${typeof portfolioData.averageApy === 'number' ? portfolioData.averageApy.toFixed(1) : portfolioData.averageApy}%` 
          : '0.0%',
        change: '0.0%',
        changeType: 'neutral' as const
      },
      {
        name: 'Active Positions',
        value: (portfolioData.activePositions !== undefined) 
          ? portfolioData.activePositions.toString()
          : (portfolioData.assets?.tokens + portfolioData.assets?.liquidity).toString() || '0',
        change: '0',
        changeType: 'neutral' as const
      }
    ];
  }, [portfolioData]);

  // Create and update chart when portfolio data changes
  useEffect(() => {
    if (!chartRef.current || !portfolioData) return;

    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Use performanceHistory or history data depending on what's available
    const historyData = portfolioData.performanceHistory || portfolioData.history || [];
    
    // Prepare chart data
    const labels = historyData.map(item => item.date);
    const values = historyData.map(item => item.value);

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Portfolio Value',
            data: values,
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: gradient,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (context) => {
                return `Value: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            }
          },
          y: {
            grid: {
              borderDash: [2, 4],
              color: 'rgba(160, 174, 192, 0.2)'
            },
            ticks: {
              callback: (value) => {
                return formatCurrency(value as number);
              }
            }
          }
        }
      }
    });

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [portfolioData]);

  if (!portfolioData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Portfolio Overview
        </h2>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">
            Connect your wallet to view portfolio
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Portfolio Overview</h2>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</p>
            <p className="text-xl font-semibold mt-1">{stat.value}</p>
            <div className="flex items-center mt-2">
              {stat.changeType === 'increase' ? (
                <ArrowUpIcon className="w-4 h-4 text-green-500 mr-1" />
              ) : stat.changeType === 'decrease' ? (
                <ArrowDownIcon className="w-4 h-4 text-red-500 mr-1" />
              ) : null}
              <span
                className={`text-sm ${
                  stat.changeType === 'increase'
                    ? 'text-green-500'
                    : stat.changeType === 'decrease'
                    ? 'text-red-500'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {stat.change}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Portfolio Value Over Time</h3>
        <div className="w-full h-64">
          <canvas ref={chartRef}></canvas>
        </div>
      </div>
    </div>
  );
}
