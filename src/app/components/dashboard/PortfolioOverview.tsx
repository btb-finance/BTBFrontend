'use client';

import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';
import { Chart } from 'chart.js/auto';
import { useEffect, useRef } from 'react';

const stats = [
  {
    name: 'Total Value Locked',
    value: '$124,592.00',
    change: '+14.2%',
    changeType: 'increase'
  },
  {
    name: 'Total Earnings',
    value: '$12,789.00',
    change: '+7.8%',
    changeType: 'increase'
  },
  {
    name: 'Average APY',
    value: '24.5%',
    change: '-2.4%',
    changeType: 'decrease'
  },
  {
    name: 'Active Positions',
    value: '8',
    change: '+2',
    changeType: 'increase'
  }
];

export default function PortfolioOverview() {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Sample data for the portfolio value over time
    const data = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [
        {
          label: 'Portfolio Value',
          data: [95000, 102000, 98000, 115000, 124000, 124592],
          borderColor: '#1976D2',
          backgroundColor: 'rgba(25, 118, 210, 0.1)',
          fill: true,
          tension: 0.4,
        }
      ]
    };

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'Portfolio Value Over Time',
            color: 'rgb(156, 163, 175)',
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(156, 163, 175, 0.1)',
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
            }
          },
          y: {
            grid: {
              color: 'rgba(156, 163, 175, 0.1)',
            },
            ticks: {
              color: 'rgb(156, 163, 175)',
              callback: (value) => '$' + value.toLocaleString()
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
        Portfolio Overview
      </h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
          >
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {stat.name}
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stat.value}
              </div>
              <div
                className={`flex items-center text-sm ${
                  stat.changeType === 'increase'
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-red-600 dark:text-red-500'
                }`}
              >
                {stat.changeType === 'increase' ? (
                  <ArrowUpIcon className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4 mr-1" />
                )}
                {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="h-80">
        <canvas ref={chartRef} />
      </div>
    </div>
  );
}
