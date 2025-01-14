'use client';

import dynamic from 'next/dynamic';

const GovernanceClientPage = dynamic(
  () => import('@/components/governance/ClientPage').then(mod => mod.GovernanceClientPage),
  { ssr: false }
);

export default function GovernancePage() {
  return <GovernanceClientPage />;
}
