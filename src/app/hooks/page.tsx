import React from 'react';
import HooksList from '../components/hooks/HooksList';
import HooksHeader from '../components/hooks/HooksHeader';
import HooksStats from '../components/hooks/HooksStats';

export default function HooksPage() {
  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="card">
          <HooksHeader />
        </div>
        <div className="card bg-btb-gradient text-white">
          <HooksStats />
        </div>
        <div className="card">
          <HooksList />
        </div>
      </div>
    </div>
  );
}
