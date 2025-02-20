'use client';

import PortfolioOverview from '../components/dashboard/PortfolioOverview';
import PositionsList from '../components/dashboard/PositionsList';
import MarketOverview from '../components/dashboard/MarketOverview';
import AlertsPanel from '../components/dashboard/AlertsPanel';

export default function DashboardPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gradient">
            Your DeFi Investment Control Center
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Monitor, adjust, and optimize your yield farming strategies across platforms
          </p>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Portfolio Overview */}
          <div className="lg:col-span-2">
            <div className="card">
              <PortfolioOverview />
            </div>
          </div>

          {/* Right Column - Alerts */}
          <div className="lg:col-span-1">
            <div className="card">
              <AlertsPanel />
            </div>
          </div>

          {/* Market Overview */}
          <div className="lg:col-span-3">
            <div className="card">
              <MarketOverview />
            </div>
          </div>

          {/* Active Positions */}
          <div className="lg:col-span-3">
            <div className="card">
              <PositionsList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
