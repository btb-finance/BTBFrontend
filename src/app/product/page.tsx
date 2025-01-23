'use client';

import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Header } from '@/components/layout/Header';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { Icons } from '@/components/ui/Icons';
import { generateProductSchema, generateFAQSchema } from '@/lib/schema';
import { JsonLd } from '@/components/shared/JsonLd';
import { motion } from 'framer-motion';

const faqs = [
  {
    question: "What's the minimum amount of BTB required to participate in governance?",
    answer: "There is no minimum amount of BTB required to participate in governance.",
  },
  {
    question: "How does the Liquid Staking work?",
    answer: "When you stake BTB tokens, you receive stBTB tokens in return. These tokens represent your stake and can be used for governance.",
  },
  {
    question: "What are the benefits of staking with BTB Finance?",
    answer: "Staking with BTB Finance allows you to participate in governance, earn rewards, and benefit from our perpetual lock system and strategic voting strategies.",
  },
  {
    question: "What is BTB Finance's Liquid Staking System?",
    answer: "BTB Finance's Liquid Staking System is an innovative protocol that revolutionizes Velodrome staking with flexible liquidity and optimized rewards.",
  },
];

export default function ProductPage() {
  const features = [
    {
      title: 'Liquid Staking',
      description: 'Stake your VELO tokens and receive liquid btbVELO tokens, maintaining flexibility while earning rewards.',
      icon: 'ShieldCheck',
    },
    {
      title: 'Perpetual Lock System',
      description: 'Our innovative perpetual lock system ensures sustainable growth through continuous buybacks and strategic voting, maximizing rewards for all participants.',
      icon: 'Lock',
    },
    {
      title: 'Rewards Distribution',
      description: '90% of voting rewards go to btbVELO holders, while 10% supports the buyback pool, ensuring continuous liquidity and system sustainability.',
      icon: 'ChartBar',
    },
  ];

  return (
    <>
      <JsonLd data={generateProductSchema()} />
      <JsonLd data={generateFAQSchema(faqs)} />
      <ErrorBoundary>
        <main className="min-h-screen bg-[var(--background-dark)]">
          <Header />
          
          {/* Hero Section */}
          <section className="relative pt-32 pb-20 px-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="container mx-auto max-w-6xl relative z-10"
            >
              <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight text-center">
                Maximize Your{' '}
                <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent">
                  DeFi
                </span>
                <br />
                Returns
              </h1>
              <p className="text-xl md:text-2xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-12 leading-relaxed text-center">
                Stake VELO without 4-year locks, protect your Uniswap V3 positions from IL, and earn protocol fees with stBTB.
              </p>
              <div className="flex justify-center gap-4">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="gradient-border glow px-8 py-4 bg-[var(--background-light)] text-lg font-medium hover:bg-[var(--background-dark)] transition-colors flex items-center"
                >
                  Start Staking Now
                  <Icons.ChevronRight className="ml-2 w-5 h-5" />
                </motion.button>
                <motion.a
                  href="https://docs.btb.finance"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white/10 text-lg font-medium hover:bg-white/20 transition-colors rounded-lg flex items-center"
                >
                  Documentation
                  <Icons.ExternalLink className="ml-2 w-5 h-5" />
                </motion.a>
              </div>
            </motion.div>

            {/* Enhanced Background Gradient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] opacity-30">
              <div className="absolute inset-0 rotate-45 translate-y-[-60%] blur-3xl">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--primary)] to-transparent" />
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20 px-6 bg-[var(--background-light)]">
            <div className="container mx-auto max-w-6xl">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.2 }}
                    viewport={{ once: true }}
                  >
                    <FeatureCard {...feature} />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </section>

          {/* Products Section */}
          <section className="py-20 px-6">
            <div className="container mx-auto max-w-6xl">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Our Products</h2>
              
              {/* Velodrome Liquid Staking */}
              <div className="mb-16">
                <div className="flex items-center justify-center mb-8">
                  <div className="relative w-16 h-16 mr-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] rounded-full opacity-20 blur-lg" />
                    <Icons.Lock className="w-16 h-16 text-[var(--primary)] relative z-10" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold">Velodrome Liquid Staking</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="gradient-border p-6 bg-[var(--background-light)] flex flex-col items-center text-center">
                    <Icons.ArrowTrend className="w-12 h-12 mb-4 text-[var(--primary)]" />
                    <h4 className="text-xl font-semibold mb-4">Step 1: Stake</h4>
                    <p className="text-[var(--text-secondary)]">Stake your VELO tokens and receive btbVELO instantly, with no 4-year lock</p>
                  </div>
                  <div className="gradient-border p-6 bg-[var(--background-light)] flex flex-col items-center text-center">
                    <Icons.Repeat className="w-12 h-12 mb-4 text-[var(--primary)]" />
                    <h4 className="text-xl font-semibold mb-4">Step 2: Optimize</h4>
                    <p className="text-[var(--text-secondary)]">Protocol automatically maintains optimal lock duration for maximum rewards</p>
                  </div>
                  <div className="gradient-border p-6 bg-[var(--background-light)] flex flex-col items-center text-center">
                    <Icons.ChartBar className="w-12 h-12 mb-4 text-[var(--primary)]" />
                    <h4 className="text-xl font-semibold mb-4">Step 3: Earn</h4>
                    <p className="text-[var(--text-secondary)]">Earn 90% of voting rewards while maintaining full liquidity flexibility</p>
                  </div>
                </div>
              </div>

              {/* Uniswap V3 IL Protection */}
              <div className="mb-16">
                <div className="flex items-center justify-center mb-8">
                  <div className="relative w-16 h-16 mr-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] rounded-full opacity-20 blur-lg" />
                    <Icons.ShieldCheck className="w-16 h-16 text-[var(--primary)] relative z-10" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold">Uniswap V3 IL Protection</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="gradient-border p-6 bg-[var(--background-light)]">
                    <div className="flex items-center mb-6">
                      <Icons.Activity className="w-8 h-8 text-[var(--primary)] mr-3" />
                      <h4 className="text-xl font-semibold">Protection Process</h4>
                    </div>
                    <div className="relative pl-8 border-l-2 border-[var(--primary)] space-y-6">
                      <div className="relative">
                        <div className="absolute -left-[41px] w-5 h-5 rounded-full bg-[var(--primary)]" />
                        <h5 className="font-medium mb-2">Provide Liquidity</h5>
                        <p className="text-[var(--text-secondary)]">Add liquidity to approved Uniswap V3 pairs</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[41px] w-5 h-5 rounded-full bg-[var(--primary)]" />
                        <h5 className="font-medium mb-2">Real-time Monitoring</h5>
                        <p className="text-[var(--text-secondary)]">Smart contract continuously tracks IL exposure</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[41px] w-5 h-5 rounded-full bg-[var(--primary)]" />
                        <h5 className="font-medium mb-2">Automatic Compensation</h5>
                        <p className="text-[var(--text-secondary)]">Receive immediate compensation for any IL</p>
                      </div>
                    </div>
                  </div>
                  <div className="gradient-border p-6 bg-[var(--background-light)]">
                    <div className="flex items-center mb-6">
                      <Icons.PieChart className="w-8 h-8 text-[var(--primary)] mr-3" />
                      <h4 className="text-xl font-semibold">Fee Distribution</h4>
                    </div>
                    <div className="relative aspect-square">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-full bg-[var(--background-dark)] rounded-full overflow-hidden">
                          <div className="h-full w-[80%] bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] relative">
                            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold">80%</span>
                          </div>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 w-full text-center space-y-2">
                        <p className="text-sm text-[var(--text-secondary)]">80% to LPs</p>
                        <p className="text-sm text-[var(--text-secondary)]">10% to Governance</p>
                        <p className="text-sm text-[var(--text-secondary)]">10% to Treasury</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Example Section */}
              <div>
                <h3 className="text-2xl md:text-3xl font-bold mb-6">Protection Example</h3>
                <div className="gradient-border p-6 bg-[var(--background-light)]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xl font-semibold mb-4">ETH/USDC Pool Example</h4>
                      <ul className="space-y-3 text-[var(--text-secondary)]">
                        <li>• Initial Position: $10,000</li>
                        <li>• After Price Change: $9,000</li>
                        <li>• Impermanent Loss: $1,000</li>
                        <li className="text-[var(--primary)] font-medium">
                          • BTB Protection: Full $1,000 refund
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xl font-semibold mb-4">How Protection Works</h4>
                      <ul className="space-y-3 text-[var(--text-secondary)]">
                        <li>1. Position monitored by smart contract</li>
                        <li>2. IL calculated at withdrawal</li>
                        <li>3. Compensation paid from treasury</li>
                        <li>4. No action needed from LP</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="py-20 px-6 bg-[var(--background-light)]">
            <div className="container mx-auto max-w-6xl">
              <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="gradient-border p-6 bg-[var(--background-dark)]">
                    <h3 className="text-xl font-semibold mb-4">Liquid Staking</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      Stake your VELO tokens and receive liquid btbVELO tokens, maintaining flexibility while earning rewards. Trade or use your btbVELO tokens while your stake remains locked.
                    </p>
                  </div>
                  <div className="gradient-border p-6 bg-[var(--background-dark)]">
                    <h3 className="text-xl font-semibold mb-4">Perpetual Lock System</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      Our innovative perpetual lock system ensures sustainable growth through continuous buybacks and strategic voting, maximizing rewards for all participants.
                    </p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div className="gradient-border p-6 bg-[var(--background-dark)]">
                    <h3 className="text-xl font-semibold mb-4">Rewards Distribution</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      90% of voting rewards go to btbVELO holders, while 10% supports the buyback pool, ensuring continuous liquidity and system sustainability.
                    </p>
                  </div>
                  <div className="gradient-border p-6 bg-[var(--background-dark)]">
                    <h3 className="text-xl font-semibold mb-4">Strategic Voting</h3>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      Participate in governance with your btbVELO tokens or let our team optimize voting strategies for maximum rewards on high-performing pools.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Example Section */}
          <section className="py-20 px-6">
            <div className="container mx-auto max-w-6xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
                Liquid Staking Example
              </h2>
              <div className="gradient-border p-8 bg-[var(--background-light)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-2xl font-semibold mb-4">
                      Scenario: VELO Staking
                    </h3>
                    <p className="text-[var(--text-secondary)] mb-6">
                      Let's say you stake 100 VELO tokens:
                    </p>
                    <ul className="space-y-3 text-[var(--text-secondary)]">
                      <li>• Initial Stake: 100 VELO</li>
                      <li>• Rewards: 10 btbVELO tokens</li>
                      <li>• Total Value: 110 VELO equivalent</li>
                    </ul>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] opacity-20 blur-2xl absolute" />
                    <div className="relative text-6xl">💰</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </ErrorBoundary>
    </>
  );
}
