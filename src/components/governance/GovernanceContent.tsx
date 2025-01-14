'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { AnimatedSection, AnimatedGradient, AnimatedScale } from '@/components/ui/AnimatedSection';
import { Button } from '@/components/ui/Button';
import { StakeModal } from './StakeModal';
import { UserStats } from './UserStats';
import { useWallet, useVoting } from '@/hooks/useWeb3';

export function GovernanceContent() {
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const { isConnected, connect } = useWallet();
  const { castVote } = useVoting();

  const handleVote = async (proposalId: number, support: boolean) => {
    if (!isConnected) {
      connect();
      return;
    }
    await castVote(proposalId, support);
  };

  const proposals = {
    active: [
      {
        id: 1,
        title: 'Add IL Protection for USDC/ETH Pool',
        description: 'Proposal to extend impermanent loss protection to the USDC/ETH pool on Uniswap V3.',
        votesFor: 65,
        votesAgainst: 35,
        endsIn: '2 days',
      },
      {
        id: 2,
        title: 'Increase Treasury Allocation',
        description: 'Increase treasury allocation from 10% to 12% to ensure long-term sustainability.',
        votesFor: 45,
        votesAgainst: 55,
        endsIn: '3 days',
      },
    ],
    past: [
      {
        id: 3,
        title: 'Add IL Protection for BTC/ETH Pool',
        description: 'Successfully added IL protection for the BTC/ETH pool.',
        votesFor: 80,
        votesAgainst: 20,
        status: 'Passed',
      },
      {
        id: 4,
        title: 'Adjust Staking Lock Period',
        description: 'Proposal to reduce staking lock period from 30 to 25 days.',
        votesFor: 30,
        votesAgainst: 70,
        status: 'Failed',
      },
    ],
  };

  return (
    <>
      <StakeModal isOpen={isStakeModalOpen} onClose={() => setIsStakeModalOpen(false)} />
      
      <main className="min-h-screen bg-[var(--background-dark)]">
        <Header />
        
        {/* Hero Section */}
        <AnimatedSection className="relative pt-32 pb-20 px-6 overflow-hidden">
          <div className="container mx-auto max-w-6xl relative z-10">
            <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
              Shape the Future of{' '}
              <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent">
                BTB Finance
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-[var(--text-secondary)] max-w-2xl mb-12 leading-relaxed">
              Participate in governance by staking BTB tokens and voting on key protocol decisions.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={() => setIsStakeModalOpen(true)}>
                Stake BTB
              </Button>
              <Button variant="secondary" size="lg">Create Proposal</Button>
            </div>
          </div>

          {/* Background Gradient */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] opacity-30">
            <div className="absolute inset-0 rotate-45 translate-y-[-60%] blur-3xl">
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--primary)] to-transparent" />
            </div>
          </div>
        </AnimatedSection>

        {/* Stats Section */}
        <section className="py-20 px-6 bg-[var(--background-light)]">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <UserStats onStakeClick={() => setIsStakeModalOpen(true)} />
              </div>
              <div className="md:col-span-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { label: 'Total Value Staked', value: '$2.5M' },
                    { label: 'Active Proposals', value: '2' },
                    { label: 'Total Voters', value: '1,234' },
                  ].map((stat, index) => (
                    <AnimatedScale key={stat.label} delay={index * 0.1}>
                      <div
                        className="gradient-border p-6 bg-[var(--background-dark)] text-center"
                        role="status"
                        aria-label={`${stat.label}: ${stat.value}`}
                      >
                        <div className="text-3xl font-bold mb-2">{stat.value}</div>
                        <div className="text-[var(--text-secondary)]">{stat.label}</div>
                      </div>
                    </AnimatedScale>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Proposals Section */}
        <section className="py-20 px-6" role="region" aria-label="Governance Proposals">
          <div className="container mx-auto max-w-6xl">
            <div className="flex justify-between items-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">Proposals</h2>
              <div className="flex gap-4" role="tablist">
                <Button
                  variant={activeTab === 'active' ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab('active')}
                  role="tab"
                  aria-selected={activeTab === 'active'}
                  aria-controls="active-proposals"
                >
                  Active
                </Button>
                <Button
                  variant={activeTab === 'past' ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab('past')}
                  role="tab"
                  aria-selected={activeTab === 'past'}
                  aria-controls="past-proposals"
                >
                  Past
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              {proposals[activeTab].map((proposal, index) => (
                <AnimatedGradient
                  key={proposal.id}
                  delay={index * 0.1}
                  role="article"
                  aria-label={`Proposal: ${proposal.title}`}
                >
                  <div className="gradient-border p-6 bg-[var(--background-light)] hover:bg-[var(--background-dark)] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold">{proposal.title}</h3>
                      {'status' in proposal ? (
                        <span
                          className={`px-3 py-1 rounded-full text-sm ${
                            proposal.status === 'Passed'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-red-500/20 text-red-500'
                          }`}
                          role="status"
                        >
                          {proposal.status}
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)] text-sm">
                          Ends in {proposal.endsIn}
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)] mb-6">
                      {proposal.description}
                    </p>
                    {'votesFor' in proposal && (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Yes: {proposal.votesFor}%</span>
                          <span>No: {proposal.votesAgainst}%</span>
                        </div>
                        <div 
                          className="h-2 bg-[var(--background-dark)] rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={proposal.votesFor}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className="h-full bg-[var(--primary)]"
                            style={{ width: `${proposal.votesFor}%` }}
                          />
                        </div>
                        {activeTab === 'active' && (
                          <div className="flex gap-4 mt-6">
                            <Button 
                              variant="primary"
                              onClick={() => handleVote(proposal.id, true)}
                            >
                              Vote Yes
                            </Button>
                            <Button 
                              variant="secondary"
                              onClick={() => handleVote(proposal.id, false)}
                            >
                              Vote No
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </AnimatedGradient>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
