'use client';

import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { JsonLd, generateProductSchema, generateFAQSchema } from '@/components/shared/JsonLd';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Icons } from '@/components/ui/Icons';
import { AnimatedSection, AnimatedScale } from '@/components/ui/AnimatedSection';
import { Button } from '@/components/ui/Button';

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
          <AnimatedSection className="relative pt-32 pb-20 px-6 overflow-hidden">
            <div className="container mx-auto max-w-6xl relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="text-center glass p-8 rounded-2xl backdrop-blur-xl"
              >
                <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
                  Maximize Your{' '}
                  <motion.span
                    className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent inline-block"
                    animate={{
                      y: [0, -10, 0],
                      scale: [1, 1.02, 1]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    DeFi
                  </motion.span>
                  <br />
                  Returns
                </h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="text-xl md:text-2xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-12 leading-relaxed"
                >
                  Stake VELO without 4-year locks, protect your Uniswap V3 positions from IL, and earn protocol fees with stBTB.
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <Button size="lg" className="hover:scale-105 transition-transform duration-300 glow">
                    Start Staking Now
                    <Icons.ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                </motion.div>
              </motion.div>
            </div>

            {/* Background Gradient */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] opacity-30">
              <div className="absolute inset-0 rotate-45 translate-y-[-60%] blur-3xl">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--primary)] to-transparent" />
              </div>
            </div>
          </AnimatedSection>

          {/* Features Section */}
          <section className="py-20 px-6 bg-[var(--background-light)]">
            <div className="container mx-auto max-w-6xl">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold text-center mb-12"
              >
                Our Innovative Solutions
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  >
                    <FeatureCard {...feature} />
                  </motion.div>
                ))}
              </div>
            </div>
          </section>

          {/* Products Section */}
          <section className="py-20 px-6">
            <div className="container mx-auto max-w-6xl">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold text-center mb-12"
              >
                Our Products
              </motion.h2>
              
              {/* Velodrome Liquid Staking */}
              <div className="mb-16">
                <motion.h3
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-2xl md:text-3xl font-bold mb-6"
                >
                  Velodrome Liquid Staking
                </motion.h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <AnimatedScale>
                    <div className="gradient-border p-6 bg-[var(--background-light)] hover:bg-[var(--background-dark)] transition-colors duration-300">
                      <div className="flex items-center mb-4">
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className="w-10 h-10 rounded-lg bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mr-3"
                        >
                          <Icons.ShieldCheck className="w-6 h-6 text-[var(--primary)]" />
                        </motion.div>
                        <h4 className="text-xl font-semibold">How It Works</h4>
                      </div>
                      <ul className="space-y-3 text-[var(--text-secondary)]">
                        <motion.li
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="flex items-center"
                        >
                          <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                          Stake VELO tokens and receive btbVELO instantly
                        </motion.li>
                        <motion.li
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="flex items-center"
                        >
                          <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                          No 4-year lock requirement
                        </motion.li>
                        <motion.li
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                          className="flex items-center"
                        >
                          <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                          Earn 90% of voting rewards
                        </motion.li>
                      </ul>
                    </div>
                  </AnimatedScale>
                  <AnimatedScale>
                    <div className="gradient-border p-6 bg-[var(--background-light)] hover:bg-[var(--background-dark)] transition-colors duration-300">
                      <div className="flex items-center mb-4">
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className="w-10 h-10 rounded-lg bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mr-3"
                        >
                          <Icons.ChartBar className="w-6 h-6 text-[var(--primary)]" />
                        </motion.div>
                        <h4 className="text-xl font-semibold">Benefits</h4>
                      </div>
                      <ul className="space-y-3 text-[var(--text-secondary)]">
                        <motion.li
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                          className="flex items-center"
                        >
                          <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                          Trade or use btbVELO while earning rewards
                        </motion.li>
                        <motion.li
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="flex items-center"
                        >
                          <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                          Protocol maintains optimal lock duration
                        </motion.li>
                        <motion.li
                          initial={{ opacity: 0, x: -20 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                          className="flex items-center"
                        >
                          <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                          Participate in governance or delegate voting
                        </motion.li>
                      </ul>
                    </div>
                  </AnimatedScale>
                </div>
              </div>

              {/* Uniswap V3 Refunds */}
              <div className="mb-16">
                <h3 className="text-2xl md:text-3xl font-bold mb-6">Uniswap V3 IL Protection</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="gradient-border p-6 bg-[var(--background-light)]">
                    <h4 className="text-xl font-semibold mb-4">How Refunds Work</h4>
                    <ul className="space-y-3 text-[var(--text-secondary)]">
                      <li className="flex items-center">
                        <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                        Provide liquidity to approved Uniswap V3 pairs
                      </li>
                      <li className="flex items-center">
                        <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                        Smart contract monitors IL in real-time
                      </li>
                      <li className="flex items-center">
                        <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                        Receive compensation for any impermanent loss
                      </li>
                    </ul>
                  </div>
                  <div className="gradient-border p-6 bg-[var(--background-light)]">
                    <h4 className="text-xl font-semibold mb-4">Fee Structure</h4>
                    <ul className="space-y-3 text-[var(--text-secondary)]">
                      <li className="flex items-center">
                        <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                        80% of fees go to LPs
                      </li>
                      <li className="flex items-center">
                        <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                        10% to stBTB holders for governance
                      </li>
                      <li className="flex items-center">
                        <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                        10% to treasury for IL protection
                      </li>
                    </ul>
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
