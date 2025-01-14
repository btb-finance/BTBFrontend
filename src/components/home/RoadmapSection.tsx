'use client';

import { motion } from 'framer-motion';

const roadmap = [
  {
    phase: 'Q1 2025',
    title: 'Launch & Growth',
    items: [
      'Protocol Launch on Optimism with Velodrome',
      'Liquid Staking for veVELO',
      'Perpetual Lock System Implementation',
    ],
    status: 'completed',
  },
  {
    phase: 'Q2 2025',
    title: 'Protocol Enhancement',
    items: [
      'Advanced Voting Strategies',
      'Buyback Pool Optimization',
      'Rewards Distribution System',
    ],
    status: 'in-progress',
  },
  {
    phase: 'Q3 2025',
    title: 'Ecosystem Growth',
    items: [
      'Enhanced Governance Features',
      'Multi-Pool Voting Strategies',
      'Strategic Partnerships',
    ],
    status: 'upcoming',
  },
  {
    phase: 'Q4 2025',
    title: 'Innovation',
    items: [
      'Advanced Liquidity Features',
      'Cross-Protocol Integration',
      'Protocol Owned Liquidity',
    ],
    status: 'upcoming',
  },
];

export function RoadmapSection() {
  return (
    <section className="py-20 px-6">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Roadmap
        </h2>
        <p className="text-[var(--text-secondary)] text-center mb-12 max-w-2xl mx-auto">
          Our vision for the future of BTB Finance
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roadmap.map((phase, index) => (
            <motion.div
              key={phase.phase}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <div className="gradient-border p-6 bg-[var(--background-light)] h-full">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-[var(--primary)] bg-opacity-20 text-[var(--primary)]">
                    {phase.phase}
                  </span>
                  <span
                    className={`text-sm ${
                      phase.status === 'completed'
                        ? 'text-green-500'
                        : phase.status === 'in-progress'
                        ? 'text-yellow-500'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {phase.status === 'completed'
                      ? '✓ Completed'
                      : phase.status === 'in-progress'
                      ? '⟳ In Progress'
                      : '○ Upcoming'}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-4">{phase.title}</h3>
                <ul className="space-y-2">
                  {phase.items.map((item) => (
                    <li
                      key={item}
                      className="text-[var(--text-secondary)] flex items-start"
                    >
                      <span className="mr-2">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
