'use client';

import { ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const alerts = [
  {
    id: 1,
    type: 'warning',
    title: 'High Price Volatility',
    message: 'ETH/USDC pool experiencing significant price movements. Consider adjusting position.',
    timestamp: '10 minutes ago'
  },
  {
    id: 2,
    type: 'info',
    title: 'New Farming Opportunity',
    message: 'High APY opportunity detected in Curve stETH/ETH pool.',
    timestamp: '1 hour ago'
  },
  {
    id: 3,
    type: 'warning',
    title: 'Low Liquidity Alert',
    message: 'BTC/ETH pool liquidity dropping below optimal levels.',
    timestamp: '2 hours ago'
  },
  {
    id: 4,
    type: 'info',
    title: 'Rewards Available',
    message: 'New rewards ready to claim from your Uniswap V3 position.',
    timestamp: '3 hours ago'
  }
];

export default function AlertsPanel() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Alerts & Notifications
        </h2>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          {alerts.length} New
        </span>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg ${
              alert.type === 'warning'
                ? 'bg-yellow-50 dark:bg-yellow-900/20'
                : 'bg-blue-50 dark:bg-blue-900/20'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {alert.type === 'warning' ? (
                  <ExclamationTriangleIcon
                    className="h-5 w-5 text-yellow-400"
                    aria-hidden="true"
                  />
                ) : (
                  <InformationCircleIcon
                    className="h-5 w-5 text-blue-400"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${
                  alert.type === 'warning'
                    ? 'text-yellow-800 dark:text-yellow-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}>
                  {alert.title}
                </h3>
                <div className={`mt-2 text-sm ${
                  alert.type === 'warning'
                    ? 'text-yellow-700 dark:text-yellow-300'
                    : 'text-blue-700 dark:text-blue-300'
                }`}>
                  {alert.message}
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {alert.timestamp}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
