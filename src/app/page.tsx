'use client';

import React from 'react';
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
      <AnimatedSection className="relative pt-24 pb-16 px-6 overflow-hidden">
        <div className="container mx-auto max-w-6xl relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Earn More in DeFi with{' '}
              <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] bg-clip-text text-transparent">
                BTB Finance
              </span>
            </h1>
            <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-8 leading-relaxed">
              Unlock multiple revenue streams through liquid staking, IL protection, and protocol governance.
            </p>

          </motion.div>
        </div>

        {/* Background Gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1500px] h-[1500px] opacity-60">
          <div className="absolute inset-0 rotate-45 translate-y-[-60%] blur-[120px]">
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-br from-[var(--primary)] via-[var(--primary-dark)] to-transparent" />
          </div>
        </div>
      </AnimatedSection>

      {/* Features Section */}
      <section className="py-24 px-6 bg-[var(--background-light)]">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-16 relative"
          >
            <div className="flex justify-center items-center gap-3 mb-4">
              <Icons.ShieldCheck className="w-8 h-8 text-[var(--primary)]" />
              <h2 className="text-4xl md:text-5xl font-bold">
                Why Choose BTB Finance?
              </h2>
            </div>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Experience the future of DeFi with our innovative features and robust protection mechanisms
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {[
              {
                icon: Icons.Lock,
                title: "No Lock Period",
                description: "Trade your btbVELO tokens anytime - no more waiting 4 years to access your liquidity"
              },
              {
                icon: Icons.ShieldCheck,
                title: "IL Protection",
                description: "Complete protection against impermanent loss for your liquidity positions"
              },
              {
                icon: Icons.ChartBar,
                title: "Maximum Rewards",
                description: "Earn 90% of all voting rewards while our protocol maintains the lock period"
              },
              {
                icon: Icons.UserGroup,
                title: "Flexible Governance",
                description: "Vote on pools or let our expert team optimize your rewards through strategic voting"
              }
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                viewport={{ once: true }}
                className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col items-center text-center group hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <h3 className="font-bold mb-2">{feature.title}</h3>
                <p className="text-[var(--text-secondary)]">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <StatsSection />

      {/* Token Details Section */}
      <TokenDetails />

      {/* Protocols Section */}
      <section className="py-24 px-6">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="text-center mb-16 relative"
          >
            <div className="flex justify-center items-center gap-3 mb-4">
              <Icons.Optimism className="w-8 h-8 text-[var(--primary)]" />
              <h2 className="text-4xl md:text-5xl font-bold">
                Supported Protocols
              </h2>
            </div>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
              Explore our integrated protocols designed to maximize your DeFi returns
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col group hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <Icons.Lock className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Velodrome</h3>
              <p className="text-[var(--text-secondary)] mb-4">Liquid Staking Solution</p>
              <ul className="space-y-3 text-[var(--text-secondary)]">
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
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col group hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <Icons.ShieldCheck className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">Uniswap V3</h3>
              <p className="text-[var(--text-secondary)] mb-4">IL Protection System</p>
              <ul className="space-y-3 text-[var(--text-secondary)]">
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
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-gradient-to-br from-[var(--background-light)] to-[var(--background-dark)] p-6 rounded-2xl flex flex-col group hover:shadow-lg transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-[var(--primary)] bg-opacity-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                  <Icons.ChartBar className="w-4 h-4 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2">stBTB</h3>
              <p className="text-[var(--text-secondary)] mb-4">Governance Token</p>
              <ul className="space-y-3 text-[var(--text-secondary)]">
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
            </motion.div>
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
            <Button variant="secondary" size="lg" asChild>
              <a href="https://docs.btb.finance" target="_blank" rel="noopener noreferrer">
                Documentation
                <Icons.ExternalLink className="ml-2 w-5 h-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-[var(--background-light)]">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-[var(--text-secondary)] text-center md:text-left">
              &copy; 2025 BTB Finance. All rights reserved.
            </div>
            <div className="flex items-center justify-center gap-6">
              <a
                href="https://twitter.com/btb_finance"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
                aria-label="Twitter"
              >
                <Icons.Twitter className="w-6 h-6" />
              </a>
              <a
                href="https://discord.gg/bqFEPA56Tc"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
                aria-label="Discord"
              >
                <Icons.Discord className="w-6 h-6" />
              </a>
              <a
                href="https://t.me/BTBFinance"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--primary)] transition-colors"
                aria-label="Telegram"
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
