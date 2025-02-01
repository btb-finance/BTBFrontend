'use client';

import { motion } from 'framer-motion';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { Button } from '@/components/ui/Button';
import { Icons } from '@/components/ui/Icons';
import { Header } from '@/components/layout/Header';
import { AnimatedSection, AnimatedScale } from '@/components/ui/AnimatedSection';
import Link from 'next/link';
import { StatsSection } from '@/components/home/StatsSection';
import { PartnersSection } from '@/components/home/PartnersSection';
import { RoadmapSection } from '@/components/home/RoadmapSection';
import { FaqSection } from '@/components/home/FaqSection';
import { TokenDetails } from '@/components/home/TokenDetails';

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--background-dark)]">
      <Header />

      {/* Hero Section */}
      <AnimatedSection className="relative min-h-[90vh] flex items-center justify-center pt-32 pb-20 px-6 overflow-hidden">
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center p-8 rounded-xl bg-background-light/80 shadow-lg"
          >
            <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight">
              Earn More in DeFi with{' '}
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
                BTB Finance
              </motion.span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-12 leading-relaxed"
            >
              Unlock multiple revenue streams through liquid staking, IL protection, and protocol governance.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-4 justify-center"
            >
              <Button
                size="lg"
                asChild
                className="hover:scale-105 transition-transform duration-300"
              >
                <Link href="/product">
                  Get Started
                  <Icons.ChevronRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                asChild
                className="hover:scale-105 transition-transform duration-300"
              >
                <a href="https://docs.btb.finance" target="_blank" rel="noopener noreferrer">
                  Documentation
                  <Icons.ExternalLink className="ml-2 w-5 h-5" />
                </a>
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
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Choose BTB Finance?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <FeatureCard
              icon="Lock"
              title="No Lock Period"
              description="Trade your btbVELO tokens anytime - no more waiting 4 years to access your liquidity"
            />
            <FeatureCard
              icon="ShieldCheck"
              title="IL Protection"
              description="Complete protection against impermanent loss for your liquidity positions"
            />
            <FeatureCard
              icon="ChartBar"
              title="Maximum Rewards"
              description="Earn 90% of all voting rewards while our protocol maintains the lock period"
            />
            <FeatureCard
              icon="UserGroup"
              title="Flexible Governance"
              description="Vote on pools or let our expert team optimize your rewards through strategic voting"
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Token Details Section */}
      <TokenDetails />

      {/* Protocols Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Supported Protocols
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <AnimatedScale>
              <div className="gradient-border p-6 bg-[var(--background-light)]">
                <div className="flex items-center space-x-4 mb-4">
                  <Icons.Optimism className="w-8 h-8 text-[#FF0420]" />
                  <div>
                    <h3 className="text-xl font-semibold">Velodrome</h3>
                    <p className="text-[var(--text-secondary)]">Liquid Staking Solution</p>
                  </div>
                </div>
                <ul className="space-y-2 text-[var(--text-secondary)]">
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    No 4-year lock requirement
                  </li>
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Instant btbVELO tokens
                  </li>
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    90% voting rewards
                  </li>
                </ul>
              </div>
            </AnimatedScale>
            <AnimatedScale>
              <div className="gradient-border p-6 bg-[var(--background-light)]">
                <div className="flex items-center space-x-4 mb-4">
                  <Icons.Optimism className="w-8 h-8 text-[#FF0420]" />
                  <div>
                    <h3 className="text-xl font-semibold">Uniswap V3</h3>
                    <p className="text-[var(--text-secondary)]">IL Protection System</p>
                  </div>
                </div>
                <ul className="space-y-2 text-[var(--text-secondary)]">
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Complete IL protection
                  </li>
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Smart fee distribution
                  </li>
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Governance-selected pairs
                  </li>
                </ul>
              </div>
            </AnimatedScale>
            <AnimatedScale>
              <div className="gradient-border p-6 bg-[var(--background-light)]">
                <div className="flex items-center space-x-4 mb-4">
                  <Icons.Optimism className="w-8 h-8 text-[#FF0420]" />
                  <div>
                    <h3 className="text-xl font-semibold">stBTB</h3>
                    <p className="text-[var(--text-secondary)]">Governance Token</p>
                  </div>
                </div>
                <ul className="space-y-2 text-[var(--text-secondary)]">
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Vote on protected pairs
                  </li>
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    30-day lock period
                  </li>
                  <li className="flex items-center">
                    <Icons.Check className="w-5 h-5 mr-2 text-[var(--primary)]" />
                    Earn protocol fees
                  </li>
                </ul>
              </div>
            </AnimatedScale>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <PartnersSection />

      {/* Roadmap Section */}
      <RoadmapSection />

      {/* FAQ Section */}
      <FaqSection />

      {/* CTA Section */}
      <section className="py-20 px-6 bg-[var(--background-light)]">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start?
          </h2>
          <p className="text-xl text-[var(--text-secondary)] mb-8 max-w-2xl mx-auto">
            Join BTB Finance today and protect your liquidity while earning protocol fees
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/product">Launch App</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <a href="https://docs.btb.finance" target="_blank" rel="noopener noreferrer">
                Learn More
                <Icons.ExternalLink className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-wrap justify-between items-center">
            <div className="text-[var(--text-secondary)]">
              &copy; 2025 BTB Finance. All rights reserved.
            </div>
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://twitter.com/btb_finance"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
              >
                <Icons.Twitter className="w-6 h-6" />
              </a>
              <a
                href="https://discord.gg/bqFEPA56Tc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
              >
                <Icons.Discord className="w-6 h-6" />
              </a>
              <a
                href="https://t.me/BTBFinance"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
              >
                <Icons.Telegram className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
