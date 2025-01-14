'use client';

import { JsonLd, generateFAQSchema } from '@/components/shared/JsonLd';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { GovernanceContent } from './GovernanceContent';

const faqs = [
  {
    question: 'How can I participate in BTB Finance governance?',
    answer: 'To participate in governance, you need to stake BTB tokens to receive stBTB. Once staked, you can vote on protocol decisions and earn rewards.',
  },
  {
    question: 'What can I vote on?',
    answer: 'As a stBTB holder, you can vote on which trading pairs receive IL protection, protocol upgrades, and treasury management decisions.',
  },
  {
    question: 'How long is the staking lock period?',
    answer: 'BTB tokens are locked for 30 days when staked. During this period, you can participate in governance and earn rewards.',
  },
];

export function GovernanceClientPage() {
  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-[var(--background)]">
        <GovernanceContent />
      </main>
      <JsonLd data={generateFAQSchema(faqs)} />
    </ErrorBoundary>
  );
}
