import React from 'react';
import HooksList from '../components/hooks/HooksList';
import HooksHeader from '../components/hooks/HooksHeader';
import HooksStats from '../components/hooks/HooksStats';

export default function HooksPage() {
  return (
    <div className="container mx-auto px-4">
      <HooksHeader />
      <HooksStats />
      <HooksList />
    </div>
  );
}
