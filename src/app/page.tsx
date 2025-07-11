'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  ArrowTrendingUpIcon,
  BanknotesIcon,
  BoltIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ArrowRightIcon,
  BeakerIcon,
  LightBulbIcon,
  SparklesIcon,
  TrophyIcon,
  CubeTransparentIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import LazyWrapper from './components/common/LazyWrapper';
import Logo from './components/common/Logo';
import { lazy } from 'react';

const ChainSelector = lazy(() => import('./components/home/ChainSelector'));
import { Button, MotionButton } from './components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from './components/ui/card';
import TypewriterEffect from './components/ui/typewriter-effect';

const features = [
  {
    name: 'BTB Governance',
    description: 'BTB token holders vote on supported pools and influence how the 10% weekly rewards are distributed across the ecosystem.',
    icon: UserGroupIcon,
    href: '/governance',
    color: 'from-purple-500 to-pink-600'
  },
  {
    name: 'Ultimate Yield Farming',
    description: 'Experience the biggest yield farming opportunity in DeFi with risk-free returns and optimized strategies across multiple protocols.',
    icon: ChartBarIcon,
    href: '/yield-farming',
    color: 'from-indigo-500 to-indigo-600'
  }
];

const products = [
  {
    name: 'BTB Game Ecosystem',
    description: 'Hunt, feed, and earn in our exciting new game ecosystem - our next big focus that revolutionizes GameFi!',
    detailedDescription: "Our innovative BTB Game is an exciting multi-contract ecosystem where players can deposit BEAR tokens, feed hunters, and hunt for rewards. The innovative game mechanics create a sustainable and engaging experience with real economic incentives and rewards.",
    features: ['Hunt-to-Earn gameplay', 'Balanced tokenomics', 'Multi-contract ecosystem', 'Interactive game dashboard'],
    icon: GlobeAltIcon,
    href: '/game',
    bgColor: 'bg-gradient-to-br from-red-600/10 to-orange-800/10',
    iconColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    isNew: true,
    highlight: true
  },
  {
    name: 'Larry Ecosystem',
    description: 'Larry is a meme coin that is fully audited and battle tested. The rebase-less stability token lets you trade, leverage up to 100x, and borrow ETH against LARRY collateral. Always remember - it\'s a meme coin.',
    detailedDescription: 'Larry is a meme coin with a revolutionary stability mechanism where the price can only go up, never down. Larry is fully audited and battle tested, but always remember it\'s a meme coin. Trade LARRY/ETH pairs, open leveraged positions up to 100x, or use LARRY as collateral to borrow ETH.',
    features: ['Price only goes up, never down', '100x leverage trading', 'Borrow ETH against LARRY', 'No rebase mechanism'],
    icon: ShieldCheckIcon,
    href: '/larryecosystem',
    bgColor: 'bg-gradient-to-br from-emerald-600/10 to-green-800/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800'
  },
  {
    name: 'BTB Token',
    description: 'Our governance token that powers the ecosystem. BTB holders vote on pools and receive 10% of LP fees from those pools.',
    detailedDescription: 'BTB is the core governance token of our ecosystem with voting rights that directly impact which pools receive impermanent loss protection. Token holders vote on pools (like USDC/ETH) and receive 10% of the LP fees from those pools. In return, liquidity providers in these pools receive impermanent loss refunds from the BTB treasury, ensuring they never lose money.',
    features: ['Pool selection voting rights', 'Receive 10% of LP fees from voted pools', 'Governance of IL protection', 'Deflationary tokenomics'],
    icon: CurrencyDollarIcon,
    href: '/btb-finance',
    bgColor: 'bg-gradient-to-br from-blue-600/10 to-blue-800/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  {
    name: 'All-in-One DeFi Dashboard',
    description: 'Access all your favorite DeFi protocols through a single intuitive interface - Aave, Compound, and more.',
    detailedDescription: "Our unified dashboard brings together the best DeFi protocols in one place. No more juggling between different websites and interfaces. Whether you're providing liquidity, lending on Aave, or yield farming elsewhere, manage everything through our streamlined, user-friendly interface.",
    features: ['Multi-protocol integration', 'Single-view portfolio tracking', 'Cross-protocol yield optimization', 'Simplified user experience'],
    icon: GlobeAltIcon,
    href: '/dashboard',
    bgColor: 'bg-gradient-to-br from-emerald-600/10 to-green-800/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800'
  },
  {
    name: 'Aero Booster',
    description: 'Professional AERO voting service for projects. Tiered rates: 5% for 1k, 4% for 5k, 2% for 10k+ AERO weekly fees.',
    detailedDescription: "BTB owns significant locked AERO tokens and provides weekly voting support for projects' liquidity pools. Tiered pricing structure: 5% weekly fee for 1k AERO, 4% for 5k AERO, 2% for 10k+ AERO. Better rates as you scale up! Contact us via X, Telegram, Discord, or email.",
    features: ['Weekly voting power', 'Scalable pricing structure', 'Multiple contact methods', 'Guaranteed LP boost'],
    icon: ArrowTrendingUpIcon,
    href: '/aero-booster',
    bgColor: 'bg-gradient-to-br from-sky-600/10 to-cyan-800/10',
    iconColor: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-200 dark:border-sky-800',
    isNew: true,
    highlight: true
  }
];

const stats = [
  { label: 'Total Value Locked', value: '$42M+' },
  { label: 'IL Protection Paid', value: '$3.8M+' },
  { label: 'Integrated DeFi Protocols', value: '15+' },
  { label: 'Supported Networks', value: '5+' }
];

// BTB Liquidity Hub Flywheel steps
const flywheelSteps = [
  { step: "ETH Movement", desc: "Price changes trigger BTB repricing" },
  { step: "Arbitrage Created", desc: "Price gaps appear on DEXs" },
  { step: "Exclusive Capture", desc: "Our bots mint BTB and capture spreads" },
  { step: "Profit Accumulation", desc: "Each trade adds to IL refund pool" },
  { step: "Automatic Refunds", desc: "LPs receive exact IL compensation" },
  { step: "Sustainable Cycle", desc: "Volatility creates profits, not losses" }
];

// Animation keyframes for the flywheel
const spinAnimation = {
  rotate: [0, 360],
  transition: {
    duration: 30,
    repeat: Infinity,
    ease: "linear"
  }
};

const spinReverseAnimation = {
  rotate: [360, 0],
  transition: {
    duration: 20,
    repeat: Infinity,
    ease: "linear"
  }
};

// Who wins in the BTB Liquidity Hub model
const winnerGroups = [
  {
    title: "BTB Token Holders Win",
    benefits: [
      "Governance rights to vote on protected pools",
      "Influence distribution of weekly rewards",
      "Growing ecosystem value as more users join"
    ],
    icon: CurrencyDollarIcon,
    color: "bg-blue-50 dark:bg-blue-900/20"
  },
  {
    title: "Liquidity Providers Win",
    benefits: [
      "Full protection against impermanent loss",
      "Impermanent loss refunds from BTB treasury",
      "Risk-free yield farming across multiple protocols"
    ],
    icon: ShieldCheckIcon,
    color: "bg-purple-50 dark:bg-purple-900/20"
  },
  {
    title: "DeFi Users Win",
    benefits: [
      "Single interface for all DeFi activities",
      "Simplified management of positions across protocols",
      "Better rates through optimized liquidity routing",
      "Enhanced user experience with unified dashboard"
    ],
    icon: GlobeAltIcon,
    color: "bg-green-50 dark:bg-green-900/20"
  }
];

// Quick navigation links for the popup
const quickNavLinks = [
  {
    name: 'BTB Game',
    description: 'Our next big thing - Hunt, feed and earn!',
    href: '/game',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎮</span>
    ),
    color: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-600 dark:text-red-400',
    isNew: true,
    highlight: true
  },
  {
    name: 'BTB Finance',
    description: 'Revolutionary protocol that profits from volatility instead of suffering from it. Through exclusive minting rights and first-mover arbitrage, we transform impermanent loss into sustainable yields for liquidity providers.',
    href: '/btb-finance',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>💰</span>
    ),
    color: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    name: 'Larry',
    description: 'Trade & leverage the audited meme coin',
    href: '/larryecosystem',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>💚</span>
    ),
    color: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    name: 'Megapot',
    description: 'Win $1M+ daily USDC jackpots with 10% cashback',
    href: '/megapot',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎰</span>
    ),
    color: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400'
  },
  {
    name: 'Aero Booster',
    description: 'Professional AERO voting service',
    href: '/aero-booster',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🚀</span>
    ),
    color: 'bg-sky-100 dark:bg-sky-900/30',
    textColor: 'text-sky-600 dark:text-sky-400',
    isNew: true
  }
];

export default function Home() {
  const [currentFeature, setCurrentFeature] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);

  // Page scroll progress for navigation
  const { scrollYProgress: pageProgress } = useScroll();
  
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length);
    }, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  // Track scroll position for enhanced UX
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative isolate">
      {/* Scroll Progress Indicator */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light z-50 origin-left"
        style={{ 
          scaleX: pageProgress,
          opacity: isScrolled ? 1 : 0
        }}
        transition={{ opacity: { duration: 0.3 } }}
      />

      {/* Quick Navigation */}
      <AnimatePresence>
        {isScrolled && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className="fixed top-4 right-4 z-40 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-full px-4 py-2 shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <nav className="flex items-center space-x-3" aria-label="Quick navigation">
              <Link 
                href="/game" 
                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                aria-label="Go to BTB Game"
              >
                🎮 Game
              </Link>
              <Link 
                href="/btb-finance" 
                className="text-xs font-medium text-btb-primary hover:text-btb-primary-dark dark:text-btb-primary-light transition-colors"
                aria-label="Go to BTB Finance"
              >
                💰 Finance
              </Link>
              <Link 
                href="/megapot" 
                className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 transition-colors"
                aria-label="Go to Megapot Lottery"
              >
                🎰 Lottery
              </Link>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

              {/* Hero section */}
        <main className="relative min-h-[90vh] flex flex-col justify-center" ref={heroRef} role="main" aria-label="BTB Finance homepage hero section">
        {/* Background elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-x-0 -top-40 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-btb-primary-dark via-btb-primary to-btb-primary-light opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
          </div>
          <div className="absolute inset-x-0 -bottom-40 transform-gpu overflow-hidden blur-3xl">
            <div className="relative left-[calc(50%+11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-btb-primary-light via-btb-primary to-btb-primary-dark opacity-20 sm:left-[calc(50%+30rem)] sm:w-[72.1875rem]" />
          </div>
        </div>
        
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 sm:py-20 flex flex-col justify-center">
          <motion.div 
            style={{ opacity, scale, y }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              className="relative z-10"
            >
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="-mt-20"
              >
                <Suspense fallback={
                  <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                }>
                  <LazyWrapper>
                    <ChainSelector />
                  </LazyWrapper>
                </Suspense>
              </motion.div>
              
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                <div className="mb-2">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                  >
                    <span className="relative inline-block">
                      <span className="absolute -inset-1 blur-md bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light opacity-30"></span>
                      <span className="relative bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light bg-clip-text text-transparent">
                        BTB Finance
                      </span>
                    </span>
                  </motion.div>
                </div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="h-12 sm:h-14 mt-4"
                >
                  <TypewriterEffect 
                    words={[
                      'Introducing Our New Game Ecosystem!', 
                      'Hunt, Feed, and Earn in GameFi',
                      'Revolutionizing DeFi on Base', 
                      'Join the DeFi Evolution',
                      'Yield Farming Reimagined'
                    ]} 
                    typingSpeed={60}
                    deletingSpeed={30}
                    delayBetweenWords={1500}
                    className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white min-h-[3rem]"
                  />
                </motion.div>
              </h1>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="mt-4 text-base sm:text-lg leading-7 text-gray-600 dark:text-gray-300 max-w-xl"
              >
                Access all your favorite DeFi apps in one place - Aave, Compound, yield farming, and more through a single intuitive interface, while never worrying about impermanent loss again.
              </motion.p>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                className="mt-3 text-base sm:text-lg leading-7 text-btb-primary-dark dark:text-btb-primary-light font-medium max-w-xl border-l-4 border-btb-primary pl-3 py-1"
              >
                <span className="font-bold">Our Mission:</span> Users provide liquidity on USDC/BTB pairs on Uniswap and Aerodrome. When ETH price moves, BTB automatically reprices on our protocol, creating instant arbitrage opportunities between our protocol and these DEX pools. We capture the spreads first, using profits to eliminate IL - zero losses for LPs.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.5 }}
                className="mt-6 flex items-center gap-3 flex-wrap"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                  <Link
                    href="/game"
                    className="relative flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-red-600 via-red-500 to-red-400 hover:shadow-lg transition-all duration-300 shadow-md shadow-red-500/20"
                  >
                    Try Our Game <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white animate-pulse">NEW!</span> <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block group relative overflow-hidden ml-3"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                  <Link
                    href="/btb-finance"
                    className="relative flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light hover:shadow-lg transition-all duration-300 shadow-md shadow-btb-primary/20"
                  >
                    Explore BTB Finance <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </motion.div>
              </motion.div>
            </motion.div>
            
            <motion.div 
              className="h-[400px] w-full relative"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-64 h-64 md:w-80 md:h-80">
                  {/* Animated background elements */}
                  <motion.div 
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light opacity-20"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.2, 0.3, 0.2]
                    }}
                    transition={{ 
                      duration: 8, 
                      repeat: Infinity,
                      ease: "easeInOut" 
                    }}
                  />
                  
                  <motion.div 
                    className="absolute inset-4 rounded-full bg-gradient-to-r from-btb-primary to-btb-primary-light opacity-40"
                    animate={{ 
                      scale: [1, 1.1, 1],
                      opacity: [0.4, 0.5, 0.4]
                    }}
                    transition={{ 
                      duration: 6, 
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5
                    }}
                  />
                  
                  {/* Floating elements */}
                  <div className="absolute inset-0">
                    {[...Array(6)].map((_, i) => {
                      // Use fixed positions based on index instead of random values
                      const positions = [
                        { left: "30%", top: "30%" },
                        { left: "40%", top: "50%" },
                        { left: "60%", top: "40%" },
                        { left: "35%", top: "60%" },
                        { left: "65%", top: "55%" },
                        { left: "50%", top: "35%" }
                      ];
                      
                      // Use deterministic animation values based on index
                      const animationOffsets = [
                        { x: 10, y: 8 },
                        { x: -8, y: 10 },
                        { x: 12, y: -9 },
                        { x: -10, y: -7 },
                        { x: 9, y: 11 },
                        { x: -11, y: -10 }
                      ];
                      
                      return (
                        <motion.div
                          key={i}
                          className="absolute w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                          style={positions[i]}
                          animate={{
                            x: [0, animationOffsets[i].x],
                            y: [0, animationOffsets[i].y],
                            opacity: [0.6, 0.9, 0.6]
                          }}
                          transition={{
                            duration: 3 + (i % 3),
                            repeat: Infinity,
                            repeatType: "reverse",
                            delay: i * 0.5
                          }}
                        >
                          {i % 3 === 0 && <CurrencyDollarIcon className="h-4 w-4 text-white" />}
                          {i % 3 === 1 && <ChartBarIcon className="h-4 w-4 text-white" />}
                          {i % 3 === 2 && <CubeTransparentIcon className="h-4 w-4 text-white" />}
                        </motion.div>
                      );
                    })}
                  </div>
                  
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span 
                      className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-btb-primary-light via-white to-btb-primary-light bg-clip-text text-transparent"
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    >
                      BTB
                    </motion.span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </main>

      {/* Product showcase section */}
      <section className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900" aria-label="BTB Finance ecosystem products">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <header className="mx-auto max-w-xl text-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl font-heading">
              Explore the BTB Finance ecosystem
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Powerful tools for decentralized finance
            </p>
          </header>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((product, index) => (
                <motion.article 
                  key={index} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border ${product.highlight ? 'border-red-500 dark:border-red-500 ring-2 ring-red-500/50' : 'border-gray-100 dark:border-gray-700 hover:border-optimism-red dark:hover:border-optimism-red'}`}
                >
                {product.highlight && (
                  <div className="absolute right-0 top-0 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">
                    NEW
                  </div>
                )}
                <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-optimism-red opacity-10 group-hover:opacity-20 transition-opacity" />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${product.bgColor} ${product.iconColor} p-2 mr-3 ${product.highlight ? 'animate-pulse' : ''}`}>
                        <product.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className={`text-base font-bold font-heading ${product.highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {product.name}
                          {product.isNew && !product.highlight && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">New</span>}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 text-xs">
                          {product.description}
                        </p>
                      </div>
                    </div>
                    <Link 
                      href={product.href}
                      className={`flex-shrink-0 inline-flex items-center text-sm font-medium transition-colors ${product.highlight ? 'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300' : 'text-optimism-red hover:text-optimism-red/80'}`}
                    >
                      <span className="hidden sm:inline">Learn more</span> <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                      </Link>
                </div>
              </div>
            </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* BTB Exchange Flywheel Section */}
      <div className="py-16 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl font-heading">
              The BTB Liquidity Hub Flywheel
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
              Our revolutionary liquidity hub creates a self-reinforcing ecosystem where impermanent loss is eliminated and everyone wins
            </p>
          </div>
          
          <div className="relative">
            {/* Flywheel Diagram */}
            <div className="mb-10 relative max-w-3xl mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/5 to-btb-primary-light/5 rounded-lg transform -rotate-1"></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="w-full md:w-1/2">
                    <h3 className="text-lg font-bold text-btb-primary mb-2">How The Liquidity Hub Works</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Our mechanism turns volatility into profit through exclusive minting and first-mover arbitrage:</p>
                    
                    <ol className="space-y-2">
                      {[
                        { step: "ETH Price Movement", desc: "Triggers BTB repricing" },
                        { step: "Instant Arbitrage", desc: "Price difference between our protocol and DEXs" },
                        { step: "Exclusive Capture", desc: "Only we can mint BTB to arbitrage" },
                        { step: "Profit Accumulation", desc: "Each movement adds to IL refund pool" },
                        { step: "Automatic Refunds", desc: "LPs receive exact IL compensation" },
                        { step: "Sustainable Model", desc: "Volatility creates profits, not losses" }
                      ].map((item, i) => (
                        <li key={i} className="flex items-start">
                          <span className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-btb-primary text-white text-xs font-medium mr-2">{i+1}</span>
                          <div className="text-sm">
                            <span className="font-semibold text-gray-900 dark:text-white">{item.step}</span>
                            <span className="text-gray-600 dark:text-gray-300"> → {item.desc}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                  
                  <div className="w-full md:w-1/2 flex justify-center">
                    <div className="relative w-64 h-64">
                      {/* Circular flywheel visualization */}
                      <motion.div 
                        className="absolute inset-0 rounded-full border-4 border-dashed border-btb-primary/30"
                        animate={spinAnimation}
                      />
                      <motion.div 
                        className="absolute inset-4 rounded-full border-2 border-btb-primary/50"
                        animate={spinReverseAnimation}
                      />
                      
                      {/* Flywheel steps */}
                      {flywheelSteps.map((step, index) => {
                        const angle = (index / flywheelSteps.length) * Math.PI * 2;
                        const x = Math.cos(angle) * 100;
                        const y = Math.sin(angle) * 100;
                        
                        return (
                          <motion.div
                            key={index}
                            className="absolute w-8 h-8 rounded-full bg-white dark:bg-gray-700 shadow-md flex items-center justify-center text-xs font-medium text-btb-primary border border-btb-primary/20"
                            style={{
                              left: "50%",
                              top: "50%",
                              transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`
                            }}
                            whileHover={{ scale: 1.2, zIndex: 10 }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            {index + 1}
                          </motion.div>
                        );
                      })}
                      
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.span 
                          className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-btb-primary-light via-white to-btb-primary-light bg-clip-text text-transparent"
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          BTB
                        </motion.span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Who Wins Section */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-6">Who Wins in This Model?</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {winnerGroups.map((group, index) => (
                  <motion.div
                    key={index}
                    className={`p-4 rounded-lg shadow-md ${group.color}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <div className="flex items-center mb-2">
                      <div className="p-1.5 rounded-full bg-white/50 dark:bg-gray-800/50 mr-2">
                        <group.icon className="h-4 w-4 text-btb-primary" />
                      </div>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">{group.title}</h4>
                    </div>
                    
                    <ul className="space-y-1">
                      {group.benefits.map((benefit, i) => (
                        <li key={i} className="flex items-start">
                          <span className="text-btb-primary mr-1.5">•</span>
                          <span className="text-gray-700 dark:text-gray-300 text-xs">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* Technical Arbitrage Example */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-btb-primary mb-3">Technical Arbitrage Example</h3>
              
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-sm">
                <p className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-l-4 border-btb-primary">
                  <span className="font-semibold text-btb-primary">Real Example:</span> When ETH drops 5%, BTB reprices on our protocol but USDC/BTB pools on Uniswap and Aerodrome lag behind. Our bots mint fresh BTB at the new rate and sell into the old pool prices, capturing the 5% spread. If an LP in USDC/BTB would lose $100 to IL, we've already captured $500+ in arbitrage profits to eliminate their losses completely.
                </p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                    <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Traditional USDC/BTB LP</h4>
                    <ul className="text-xs space-y-1">
                      <li>• LP would lose $100 to IL</li>
                      <li>• Random arbitrageurs profit</li>
                      <li>• LP bears the full loss</li>
                      <li>• Unsustainable for LPs</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">BTB Protected USDC/BTB LP</h4>
                    <ul className="text-xs space-y-1">
                      <li>• BTB captures $500+ arbitrage first</li>
                      <li>• LP would lose $100 to IL</li>
                      <li>• LP receives $100 refund = 0 IL</li>
                      <li>• $400+ profit for treasury</li>
                    </ul>
                  </div>
                </div>
              </div>
              
            </div>

            {/* The IL Refund Guarantee Section */}
            <div className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
              <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4 flex items-center">
                <ShieldCheckIcon className="h-5 w-5 mr-2" />
                The IL Refund Guarantee
              </h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">We profit from the SAME price movements</span> that cause IL</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">Every oscillation within LP ranges</span> creates arbitrage</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">100+ daily price movements</span> = 100+ profit opportunities</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">We're not protecting against IL</span> - we're harvesting it</p>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-semibold">USDC/BTB LPs provide exit liquidity</span> to OUR bots, not random arbitrageurs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* BTB Game Ecosystem Section */}
      <div className="py-16 bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 relative overflow-hidden">
        {/* Abstract geometric background */}
        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-red-400 to-orange-500 skew-y-6 transform -translate-y-24"></div>
          <div className="absolute bottom-0 right-0 w-full h-64 bg-gradient-to-l from-red-400 to-orange-500 skew-y-6 transform translate-y-24"></div>
          <div className="grid grid-cols-6 grid-rows-6 gap-4 absolute inset-0">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-red-500/5 dark:bg-red-500/10 rounded-lg transform rotate-45"></div>
            ))}
          </div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:w-1/2 text-left"
              >
                <div className="inline-flex items-center px-4 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium mb-4">
                  <SparklesIcon className="h-4 w-4 mr-2" />
                  <span>Gaming Ecosystem</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 inline-flex items-center">
                  <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                    BTB Game Ecosystem
                  </span>
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
                  Hunt, feed, and earn in our revolutionary multi-contract game ecosystem. Deposit BEAR tokens, feed hunters, and hunt for rewards in this sustainable GameFi experience.
                </p>
                
                <div className="space-y-4 mt-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 mr-4">
                      <span className="text-lg font-semibold">1</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Deposit BEAR Tokens</h3>
                      <p className="text-gray-600 dark:text-gray-300">Start earning by depositing your BEAR tokens into the ecosystem</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400 mr-4">
                      <span className="text-lg font-semibold">2</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Feed Your Hunters</h3>
                      <p className="text-gray-600 dark:text-gray-300">Increase hunting potential by feeding your hunters regularly</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 mr-4">
                      <span className="text-lg font-semibold">3</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Hunt for Rewards</h3>
                      <p className="text-gray-600 dark:text-gray-300">Hunt MiMo tokens for great rewards with your strengthened hunters</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 mt-8">
                  <Link 
                    href="/game" 
                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-white bg-gradient-to-r from-red-600 to-orange-600 hover:shadow-lg transition-all duration-300"
                  >
                    Play Now <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                  <Link 
                    href="/game#learn" 
                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-300"
                  >
                    Learn More
                  </Link>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:w-1/2 relative"
              >
                <div className="relative bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl p-8 border border-red-100 dark:border-red-800/30 shadow-lg">
                  <div className="absolute -top-4 -right-4 bg-gradient-to-r from-red-600 to-orange-500 text-white text-sm font-bold px-4 py-1 rounded-full animate-pulse">HOT!</div>
                  
                  <div className="flex items-center justify-center mb-8">
                    <div className="relative h-24 w-24 flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full opacity-20 animate-pulse"></div>
                      <div className="absolute inset-2 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                        <span className="text-2xl">🎮</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">BTB Game</h3>
                      <p className="text-gray-600 dark:text-gray-400">Hunt-to-Earn Ecosystem</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <ShieldCheckIcon className="h-6 w-6 text-red-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Multi-Contract Ecosystem</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Secure and decentralized architecture</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <ArrowTrendingUpIcon className="h-6 w-6 text-amber-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Engaging Gameplay</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Balanced mechanics with financial incentives</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <BoltIcon className="h-6 w-6 text-orange-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Fair Economy</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Sustainable rewards system</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-4 rounded-lg">
                    <div className="flex items-center">
                      <SparklesIcon className="h-5 w-5 mr-2" />
                      <p className="font-medium">Join our exciting game ecosystem today!</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Stats section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">+500%</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Potential ROI</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">3</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Integrated Contracts</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">100%</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">On-Chain Logic</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">24/7</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Available to Play</p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Larry Ecosystem Section */}
      <div className="py-16 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                Larry: The Meme Coin with Stability Features
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                Larry is a meme coin that is fully audited and battle tested. Trade, leverage up to 100x, and borrow against LARRY with our innovative stability mechanism where the price can only go up, never down.
              </p>
              <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700/50">
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                  ⚠️ Important: Always remember - Larry is a meme coin. Fully audited and battle tested, but still a meme coin.
                </p>
              </div>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 mr-4">
                    <span className="text-lg font-semibold">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Guaranteed Price Stability</h3>
                    <p className="text-gray-600 dark:text-gray-300">Price only goes up with every transaction, never down</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 mr-4">
                    <span className="text-lg font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">100x Leverage Trading</h3>
                    <p className="text-gray-600 dark:text-gray-300">Open leveraged positions up to 100x with LARRY collateral</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 mr-4">
                    <span className="text-lg font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Borrow ETH Against LARRY</h3>
                    <p className="text-gray-600 dark:text-gray-300">Use LARRY as collateral to borrow ETH at competitive rates</p>
                  </div>
                </div>
              </div>
              
              <Link 
                href="/larryecosystem"
                className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:shadow-lg transition-all duration-300"
              >
                Trade Larry <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-xl transform rotate-1"></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                <div className="aspect-w-16 aspect-h-9 bg-gradient-to-b from-emerald-500/5 to-emerald-600/10 rounded-lg overflow-hidden mb-6 p-6">
                  <div className="w-full h-full flex flex-col justify-center">
                    {/* Price Chart Visualization */}
                    <div className="flex-1 flex items-end justify-between max-w-xs mx-auto w-full">
                      {[1.00, 1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.15].map((price, index) => (
                        <div key={index} className="flex-1 mx-0.5 relative group">
                          <div 
                            className="bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-sm transition-all duration-300 group-hover:from-emerald-600 group-hover:to-emerald-500"
                            style={{ height: `${(price - 1.00) * 800}%`, minHeight: '8px' }}
                          />
                          <span className="absolute bottom-[-20px] left-1/2 transform -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 hidden group-hover:block">
                            ${price}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Price trajectory (only up)</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Max Leverage</p>
                    <p className="text-2xl font-bold text-emerald-600">100x</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Borrow APR</p>
                    <p className="text-2xl font-bold text-emerald-600">3.9%</p>
                  </div>
                </div>
                
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-700">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center space-x-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Trade Fees</p>
                        <p className="text-lg font-bold text-emerald-600">Dynamic</p>
                      </div>
                      <div className="h-8 w-px bg-emerald-300 dark:bg-emerald-700"></div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Protocol Status</p>
                        <p className="text-lg font-bold text-emerald-600">Active</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BTB Finance Section */}
      <div className="py-16 sm:py-24 bg-white dark:bg-gray-950 relative overflow-hidden">
        {/* Abstract geometric background */}
        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-purple-400 to-pink-500 skew-y-6 transform -translate-y-24"></div>
          <div className="absolute bottom-0 right-0 w-full h-64 bg-gradient-to-l from-purple-400 to-pink-500 skew-y-6 transform translate-y-24"></div>
          <div className="grid grid-cols-6 grid-rows-6 gap-4 absolute inset-0">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-purple-500/5 dark:bg-purple-500/10 rounded-lg transform rotate-45"></div>
            ))}
          </div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:w-1/2 text-left"
              >
                <div className="inline-flex items-center px-4 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-medium mb-4">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  <span>Capital Efficiency</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 inline-flex items-center">
                  <SparklesIcon className="h-8 w-8 mr-2 text-purple-500" />
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">BTB Finance</span>
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
                  Revolutionary protocol that profits from volatility instead of suffering from it. Through exclusive minting rights and first-mover arbitrage, we transform impermanent loss into sustainable yields for liquidity providers.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link 
                    href="/btb-finance" 
                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-white bg-purple-600 hover:bg-purple-700 transition-all duration-300"
                  >
                    Get Started <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                  <Link 
                    href="/btb-finance" 
                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all duration-300"
                  >
                    Learn More
                  </Link>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="md:w-1/2 relative"
              >
                <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl p-8 border border-purple-100 dark:border-purple-800/30 shadow-lg">
                  <div className="absolute -top-4 -right-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-bold px-4 py-1 rounded-full">Featured</div>
                  
                  <div className="flex items-center justify-center mb-8">
                    <div className="relative h-24 w-24 flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-20 animate-pulse"></div>
                      <div className="absolute inset-2 rounded-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">💰</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">BTB Finance</h3>
                      <p className="text-gray-600 dark:text-gray-400">Complete DeFi Platform</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <ShieldCheckIcon className="h-6 w-6 text-purple-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">ETH-Backed Trading</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Secure collateralization</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <ArrowTrendingUpIcon className="h-6 w-6 text-green-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Loop & Leverage</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Advanced trading strategies</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <BoltIcon className="h-6 w-6 text-pink-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Loan Management</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Complete DeFi toolkit</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-lg">
                    <div className="flex items-center">
                      <SparklesIcon className="h-5 w-5 mr-2" />
                      <p className="font-medium">Unlock the most capital efficient DeFi platform!</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
            
            {/* Stats section */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">100%</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">USDC Backing</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/20 dark:to-cyan-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">99%</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Maximum LTV</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.3 }}
                className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">5x</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Leverage Potential</p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-6 text-center"
              >
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">24/7</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">Market Access</p>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Understanding Volatility Farming Section */}
      <div className="py-16 sm:py-24 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 relative overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-4 inline-flex items-center justify-center">
                  <LightBulbIcon className="h-8 w-8 mr-2 text-orange-500" />
                  <span className="bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">Understanding Volatility Farming</span>
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  How USDC/BTB liquidity providers on Uniswap and Aerodrome achieve zero impermanent loss
                </p>
              </motion.div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-red-200 dark:border-red-800"
              >
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4 flex items-center">
                  <span className="mr-2">❌</span> Traditional LPs
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>• USDC/BTB LPs lose money to arbitrageurs</li>
                  <li>• Suffer from impermanent loss on price changes</li>
                  <li>• No control over who profits from their liquidity</li>
                  <li>• Bear all the market volatility risk</li>
                  <li>• Random traders capture spreads from their pools</li>
                </ul>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-green-200 dark:border-green-800"
              >
                <h3 className="text-xl font-bold text-green-600 dark:text-green-400 mb-4 flex items-center">
                  <span className="mr-2">✅</span> BTB Protocol
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li>• BTB reprices creating arbitrage on USDC/BTB pools</li>
                  <li>• Our bots capture spreads on Uniswap/Aerodrome first</li>
                  <li>• Price movements generate 3-5% arbitrage profits</li>
                  <li>• These profits fund 100% IL refunds for LPs</li>
                  <li>• More volatility = more refund capacity</li>
                </ul>
              </motion.div>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-xl p-8 border border-yellow-300 dark:border-yellow-700"
            >
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">The Innovation</h3>
              <div className="text-center space-y-4">
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  <span className="font-bold text-orange-600">Traditional USDC/BTB LPs:</span> Lose money to random arbitrageurs
                </p>
                <div className="flex justify-center my-4">
                  <ArrowTrendingUpIcon className="h-6 w-6 text-orange-500" />
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  <span className="font-bold text-green-600">BTB Protected LPs:</span> We capture arbitrage profits and eliminate their IL
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Megapot Lottery Section - Premium Design */}
      <div className="relative py-24 overflow-hidden">
        {/* Dynamic Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(120,119,198,0.3),transparent)]" />
        </div>
        
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div 
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-gradient-to-r from-cyan-400/20 to-blue-500/20 blur-3xl"
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-3xl"
            animate={{ 
              scale: [1.2, 1, 1.2],
              opacity: [0.2, 0.4, 0.2],
              rotate: [0, -90, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          />
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/10"
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            {/* Header Section */}
            <motion.div 
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center justify-center mb-6">
                <motion.div
                  className="relative"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 p-1">
                    <div className="w-full h-full rounded-full bg-gradient-to-r from-indigo-900 to-purple-900 flex items-center justify-center">
                      <span className="text-2xl">🎰</span>
                    </div>
                  </div>
                  <motion.div 
                    className="absolute -inset-2 rounded-full border-2 border-yellow-400/30"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
              </div>
              
              <h2 className="text-5xl md:text-6xl font-bold mb-6">
                <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                  MEGAPOT
                </span>
                <br />
                <span className="text-white text-3xl md:text-4xl">Lottery</span>
              </h2>
              
              <motion.div 
                className="inline-block"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <div className="bg-gradient-to-r from-green-400 to-emerald-500 text-black px-8 py-4 rounded-full text-xl md:text-2xl font-bold shadow-2xl">
                  💰 $1,000,000+ Daily Jackpot
                </div>
              </motion.div>
              
              <p className="text-xl text-white/90 mt-6 max-w-3xl mx-auto leading-relaxed">
                Win <span className="font-bold text-yellow-300">life-changing money</span> with daily USDC jackpots. 
                Get <span className="font-bold text-green-400">10% instant cashback</span> + <span className="font-bold text-purple-300">50% bonus MegaPoints</span> through BTB!
              </p>
            </motion.div>
            
            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Left Column - Features */}
              <motion.div 
                className="xl:col-span-1 space-y-6"
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {[
                  {
                    icon: TrophyIcon,
                    title: "$1M+ Jackpots",
                    description: "Massive daily prizes in stable USDC",
                    gradient: "from-yellow-400 to-orange-500",
                    glow: "shadow-yellow-500/25"
                  },
                  {
                    icon: BanknotesIcon,
                    title: "10% Cashback",
                    description: "Instant USDC returns on every ticket",
                    gradient: "from-green-400 to-emerald-500",
                    glow: "shadow-green-500/25"
                  },
                  {
                    icon: SparklesIcon,
                    title: "50% Bonus Points",
                    description: "Extra MegaPoints with BTB referral",
                    gradient: "from-purple-400 to-pink-500",
                    glow: "shadow-purple-500/25"
                  }
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    className="group"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 hover:bg-white/15 transition-all duration-300">
                      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-xl bg-gradient-to-r ${feature.gradient} ${feature.glow} shadow-xl`}>
                          <feature.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white mb-1">{feature.title}</h3>
                          <p className="text-white/80 text-sm">{feature.description}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
              
              {/* Center Column - Jackpot Display */}
              <motion.div 
                className="xl:col-span-1"
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                <div className="relative">
                  {/* Outer Glow */}
                  <motion.div 
                    className="absolute -inset-4 bg-gradient-to-r from-yellow-400/20 via-orange-500/20 to-red-500/20 rounded-3xl blur-xl"
                    animate={{ 
                      scale: [1, 1.05, 1],
                      opacity: [0.5, 0.8, 0.5]
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  
                  <div className="relative bg-gradient-to-br from-white/20 to-white/5 backdrop-blur-xl rounded-3xl border border-white/30 p-8 shadow-2xl">
                    {/* Jackpot Amount */}
                    <div className="text-center mb-8">
                      <motion.div
                        animate={{ scale: [1, 1.02, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <div className="text-6xl md:text-7xl font-black mb-2">
                          <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-red-400 bg-clip-text text-transparent">
                            $1M+
                          </span>
                        </div>
                        <div className="text-white/90 text-lg font-medium">Daily Jackpot</div>
                      </motion.div>
                    </div>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                        <div className="text-white/70 text-sm font-medium mb-1">Ticket Price</div>
                        <div className="text-white text-2xl font-bold">$1</div>
                        <div className="text-green-400 text-xs font-medium">+10% back</div>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-white/10">
                        <div className="text-white/70 text-sm font-medium mb-1">Next Draw</div>
                        <div className="text-white text-lg font-bold">24h</div>
                        <div className="text-purple-400 text-xs font-medium">Daily draws</div>
                      </div>
                    </div>
                    
                    {/* CTA Button */}
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Link 
                        href="/megapot"
                        className="block w-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-black font-bold py-4 px-6 rounded-xl text-center text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:-translate-y-1"
                      >
                        🎲 Play Now - Win Big!
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
              
              {/* Right Column - Benefits */}
              <motion.div 
                className="xl:col-span-1 space-y-6"
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.6 }}
              >
                {/* Auto-Buy Feature */}
                <motion.div 
                  className="bg-gradient-to-br from-indigo-500/20 to-purple-600/20 backdrop-blur-md rounded-2xl border border-indigo-300/30 p-6"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-indigo-500 rounded-lg mr-3">
                      <ArrowRightIcon className="w-5 h-5 text-white transform rotate-90" />
                    </div>
                    <h3 className="text-white font-bold text-lg">Auto-Buy Subscription</h3>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Never miss a draw! Set up automatic daily entries and wake up to potential millions.
                  </p>
                </motion.div>
                
                {/* Security Badge */}
                <motion.div 
                  className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-md rounded-2xl border border-green-300/30 p-6"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-green-500 rounded-lg mr-3">
                      <ShieldCheckIcon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-white font-bold text-lg">100% Secure</h3>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Smart contracts audited. Prizes guaranteed. Transparent draws using Pyth Network entropy.
                  </p>
                </motion.div>
                
                {/* Instant Payouts */}
                <motion.div 
                  className="bg-gradient-to-br from-yellow-500/20 to-orange-600/20 backdrop-blur-md rounded-2xl border border-yellow-300/30 p-6"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-center mb-4">
                    <div className="p-2 bg-yellow-500 rounded-lg mr-3">
                      <BoltIcon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-white font-bold text-lg">Instant Payouts</h3>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Winners receive USDC prizes immediately after each draw. No waiting, no delays.
                  </p>
                </motion.div>
              </motion.div>
            </div>
            
            {/* Bottom CTA Strip */}
            <motion.div 
              className="mt-16 text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-md rounded-2xl border border-white/20 p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-left">
                    <h3 className="text-2xl font-bold text-white mb-2">Ready to Win $1,000,000?</h3>
                    <p className="text-white/80">Join thousands of players competing for life-changing prizes every day.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Link 
                        href="/megapot"
                        className="bg-gradient-to-r from-green-400 to-emerald-500 text-black font-bold py-3 px-8 rounded-xl whitespace-nowrap shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        💸 Buy Tickets (10% Back)
                      </Link>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Link 
                        href="/megapot#subscription"
                        className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-8 rounded-xl whitespace-nowrap shadow-lg hover:shadow-xl transition-all duration-300"
                      >
                        🔄 Auto-Subscribe
                      </Link>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Experimental Innovation Disclaimer */}
      <div className="py-10 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          <motion.div 
            className="absolute top-10 left-10 w-64 h-64 rounded-full bg-btb-primary/30 blur-3xl"
            animate={{ 
              x: [0, 50, 0], 
              y: [0, 30, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div 
            className="absolute bottom-10 right-10 w-80 h-80 rounded-full bg-btb-primary-light/20 blur-3xl"
            animate={{ 
              x: [0, -40, 0], 
              y: [0, -20, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>

        <div className="mx-auto max-w-5xl px-6 lg:px-8 relative z-10">
          <motion.div 
            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            {/* Innovation Lab Header */}
            <div className="bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light p-4 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="white" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  <path d="M20,50 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0" fill="none" stroke="url(#grad1)" strokeWidth="0.5">
                    <animate attributeName="stroke-dasharray" from="0 188.5" to="188.5 0" dur="3s" repeatCount="indefinite" />
                  </path>
                  <path d="M30,50 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.3">
                    <animate attributeName="stroke-dasharray" from="0 125.7" to="125.7 0" dur="3s" repeatCount="indefinite" begin="0.5s" />
                  </path>
                  <path d="M40,50 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.5">
                    <animate attributeName="stroke-dasharray" from="0 62.8" to="62.8 0" dur="3s" repeatCount="indefinite" begin="1s" />
                  </path>
                </svg>
              </div>
              
              <div className="relative z-10 flex items-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="w-12 h-12 mr-4 relative flex-shrink-0"
                >
                  <div className="absolute inset-0 rounded-full border-2 border-white/30 border-dashed"></div>
                  <div className="absolute inset-2 rounded-full border-1 border-white/50"></div>
                  <motion.div 
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <BeakerIcon className="h-6 w-6 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white font-heading">
                    Innovation Through <span className="text-white/90 italic">Experimentation</span>
                  </h2>
                  <div className="flex items-center text-white/80 text-sm">
                    <SparklesIcon className="h-3 w-3 mr-1" />
                    <span>Pushing the boundaries of DeFi with bold new concepts</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
              <div className="flex items-start mb-4">
                <div className="flex-shrink-0 w-1 self-stretch bg-gradient-to-b from-btb-primary to-btb-primary-light rounded-full mr-3 opacity-30"></div>
                <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed">
                  At BTB Finance, we're pioneering the future of DeFi through bold experimentation, creating innovative financial concepts that have never existed before.
                </p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <motion.div 
                  className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-btb-primary/30 dark:hover:border-btb-primary/30 transition-all duration-300"
                  whileHover={{ y: -3, boxShadow: "0 8px 15px -5px rgba(0, 0, 0, 0.1)" }}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-btb-primary/20 to-btb-primary-light/20 text-btb-primary mr-2">
                      <SparklesIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pioneering New Concepts</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-xs">
                        Our revolutionary bonding curve pricing and unique economic models are the first of their kind.
                      </p>
                    </div>
                  </div>
                </motion.div>
                
                <motion.div 
                  className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-btb-primary/30 dark:hover:border-btb-primary/30 transition-all duration-300"
                  whileHover={{ y: -3, boxShadow: "0 8px 15px -5px rgba(0, 0, 0, 0.1)" }}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-gradient-to-br from-btb-primary/20 to-btb-primary-light/20 text-btb-primary mr-2">
                      <ShieldCheckIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Risk Awareness</h3>
                      <p className="text-gray-600 dark:text-gray-300 text-xs">
                        We encourage all users to invest only what they can afford to lose.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
              
              <motion.div 
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-btb-primary/5 via-btb-primary/10 to-btb-primary-light/5 p-4 border border-btb-primary/20"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                viewport={{ once: true }}
              >
                <motion.div 
                  className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-btb-primary/5"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div 
                  className="absolute -bottom-12 -left-12 w-24 h-24 rounded-full bg-btb-primary/5"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.1, 0.2, 0.1],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
                />
                
                <div className="relative z-10">
                  <div className="flex items-center mb-2">
                    <div className="flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-r from-btb-primary to-btb-primary-light text-white mr-2">
                      <span className="text-xs font-bold">!</span>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Important Disclaimer</h3>
                  </div>
                  
                  <p className="text-gray-700 dark:text-gray-200 text-sm">
                    <strong>Always invest at your own risk.</strong> The experimental nature of our products means outcomes may differ from expectations. We're committed to transparency as we explore new financial frontiers together.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-8 sm:mt-12">
                    <MotionButton
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-btb-primary dark:text-btb-primary-light border border-btb-primary/30 dark:border-btb-primary-light/30 font-semibold py-3 px-6 rounded-lg shadow-md"
                      asChild
                    >
                      <Link href="/btb-finance">
                        Explore BTB Token
                      </Link>
                    </MotionButton>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Important Disclaimers Section */}
      <div className="py-12 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center">
                <ShieldCheckIcon className="h-6 w-6 mr-2 text-yellow-500" />
                Important Disclaimers
              </h2>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-700/50"
            >
              <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-700 dark:text-gray-300">
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p><span className="font-semibold">Experimental DeFi protocol</span> - invest only what you can afford to lose</p>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p><span className="font-semibold">IL refunds depend</span> on continued arbitrage opportunities</p>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p><span className="font-semibold">Smart contract risks exist</span> despite audits</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p><span className="font-semibold">Past performance</span> doesn't guarantee future results</p>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p><span className="font-semibold">This is not investment advice</span> - do your own research</p>
                  </div>
                  <div className="flex items-start">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                    <p><span className="font-semibold">Market conditions</span> can impact mechanism effectiveness</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Back to Top Button */}
      <AnimatePresence>
        {isScrolled && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-8 right-8 z-40 bg-btb-primary hover:bg-btb-primary-dark text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group"
            aria-label="Back to top"
          >
            <ArrowRightIcon className="h-5 w-5 transform -rotate-90 group-hover:-translate-y-1 transition-transform duration-300" />
          </motion.button>
        )}
      </AnimatePresence>

    </div>
  );
}
