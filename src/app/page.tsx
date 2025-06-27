'use client';

import React, { useState, useEffect, useRef } from 'react';
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

const Testimonials = lazy(() => import('./components/home/Testimonials'));
const ChainSelector = lazy(() => import('./components/home/ChainSelector'));
const Stats = lazy(() => import('./components/home/Stats'));
import { Button, MotionButton } from './components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from './components/ui/card';
import TypewriterEffect from './components/ui/typewriter-effect';

const features = [
  {
    name: 'Unified DeFi Interface',
    description: 'Access all your favorite DeFi apps in one place - Aave, Compound, yield farming, and more through a single intuitive interface.',
    icon: GlobeAltIcon,
    href: '/unified-interface',
    color: 'from-blue-500 to-blue-600'
  },
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
    name: 'BTB Bear NFT Swap',
    description: 'Swap between BTB tokens and Bear NFTs with instant liquidity. Our unique tokenomics ensures the price always goes up!',
    detailedDescription: "Our innovative BTB Bear NFT Swap creates a revolutionary tokenomics model where the price always increases, regardless of whether you're buying or selling. Swap your BTB tokens for unique Bear NFTs or convert your NFTs back to BTB tokens with instant liquidity, all while benefiting from our ever-increasing price floor mechanism.",
    features: ['Instant NFT liquidity', 'Ever-increasing price floor', 'Seamless token-to-NFT swaps', 'Progressive UI loading'],
    icon: CubeTransparentIcon,
    href: '/nftswap',
    bgColor: 'bg-gradient-to-br from-amber-600/10 to-orange-800/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800'
  },
  {
    name: 'Larry Ecosystem',
    description: 'The rebase-less stability token. Trade, leverage up to 100x, and borrow ETH against LARRY collateral.',
    detailedDescription: 'Larry is our revolutionary stability token with a unique mechanism where the price can only go up, never down. Trade LARRY/ETH pairs, open leveraged positions up to 100x, or use LARRY as collateral to borrow ETH. Our innovative stability mechanism ensures price appreciation with every transaction.',
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
    href: '/token',
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
  { step: "Hold BTB Tokens", desc: "BTB holders vote on which pools receive IL protection" },
  { step: "Earn LP Fees", desc: "BTB voters receive 10% of the LP fees from those pools" },
  { step: "Provide Liquidity", desc: "Users provide liquidity to protected pools across multiple protocols" },
  { step: "IL Protection", desc: "Liquidity providers receive IL refunds from BTB treasury" },
  { step: "Risk-Free Farming", desc: "Users enjoy yield farming without fear of impermanent loss" },
  { step: "Deeper Liquidity", desc: "More liquidity providers join protected pools" },
  { step: "Ecosystem Growth", desc: "The liquidity hub expands to more protocols and pools" }
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
    name: 'CHICKS Trade',
    description: 'Trade, borrow & leverage CHICKS tokens',
    href: '/chicks/trade',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🐣</span>
    ),
    color: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    name: 'BTB Bridge',
    description: 'Bridge your BTB tokens across multiple blockchains',
    href: '/btb-bridge',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🌉</span>
    ),
    color: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400'
  },
  {
    name: 'Larry',
    description: 'Trade & leverage the stability token',
    href: '/larryecosystem',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>💚</span>
    ),
    color: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-600 dark:text-emerald-400'
  },
  {
    name: 'Megapot',
    description: 'Win big with daily USDC jackpots',
    href: '/megapot',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎰</span>
    ),
    color: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400'
  },
  {
    name: 'NFT Swap',
    description: 'Swap between BTB tokens and Bear NFTs',
    href: '/nftswap',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🔄</span>
    ),
    color: 'bg-amber-100 dark:bg-amber-900/30',
    textColor: 'text-amber-600 dark:text-amber-400'
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
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);
  
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature(prev => (prev + 1) % features.length);
    }, 5000);
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="relative isolate">

      {/* Hero section */}
      <div className="relative min-h-[90vh] flex flex-col justify-center" ref={heroRef}>
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
                <LazyWrapper>
                  <ChainSelector />
                </LazyWrapper>
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
                <span className="font-bold">Our Mission:</span> To create the ultimate liquidity hub where BTB token holders vote on pools and receive 10% of LP fees, while liquidity providers get impermanent loss refunds from the BTB treasury, ensuring nobody ever loses money in DeFi again.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}
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
                    href="https://btb.finance/chicks"
                    className="relative flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light hover:shadow-lg transition-all duration-300 shadow-md shadow-btb-primary/20"
                  >
                    Explore Chicks <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block mt-3 sm:mt-0 sm:ml-3"
                >
                  <Link
                    href="https://btb.finance/token"
                    className="relative border-2 border-btb-primary text-btb-primary px-6 py-3 rounded-lg font-medium hover:bg-white/10 hover:border-btb-primary-light transition-all duration-300 flex items-center"
                  >
                    BTB Token <ArrowRightIcon className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform duration-300" />
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
      </div>

      {/* Product showcase section */}
      <div className="py-16 sm:py-20 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl text-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl font-heading">
              Explore the BTB Finance ecosystem
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Powerful tools for decentralized finance
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((product, index) => (
              <div 
                key={index} 
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
              </div>
            ))}
          </div>
        </div>
      </div>

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
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Our ecosystem creates a powerful self-reinforcing cycle that eliminates impermanent loss and benefits all participants:</p>
                    
                    <ol className="space-y-2">
                      {[
                        { step: "BTB Governance", desc: "BTB holders vote on pools that receive IL protection" },
                        { step: "Voter Rewards", desc: "BTB voters receive 10% of LP fees from those pools" },
                        { step: "Multi-Protocol Access", desc: "Users access all DeFi protocols through one interface" },
                        { step: "Protected Liquidity", desc: "Users provide liquidity to protected pools without risk" },
                        { step: "IL Refunds", desc: "Liquidity providers receive refunds from BTB treasury" },
                        { step: "Deeper Liquidity", desc: "Protected pools attract more liquidity" },
                        { step: "Ecosystem Expansion", desc: "More protocols and pools join the ecosystem" }
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
            
            {/* Real-world Example */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-btb-primary mb-3">Real-World Example</h3>
              
              <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 text-sm">
                <p className="mb-2">
                  <span className="font-semibold">Alice</span> holds BTB tokens and votes for the USDC/ETH pool to receive impermanent loss protection. As a BTB voter, she now receives 10% of all LP fees generated by this pool.
                </p>
                
                <p className="mb-2">
                  <span className="font-semibold">Bob</span> provides liquidity to the USDC/ETH pool through BTB's unified interface. When the market experiences volatility, Bob would normally face impermanent loss, but instead receives full compensation from the BTB treasury, funded by the platform's revenue.
                </p>
                
                <p>
                  <span className="font-semibold">Carol</span> uses BTB's single interface to manage her positions across multiple DeFi protocols - lending on Aave, yield farming on another platform, and providing liquidity to various pools - all without switching between different applications.
                </p>
              </div>
              
              <div className="mt-5 text-center">
                <Link 
                  href="/unified-interface"
                  className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light hover:shadow-md transition-all duration-300"
                >
                  Experience the BTB Liquidity Hub <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
                </Link>
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
                Larry: The Rebase-less Stability Token
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Trade, leverage up to 100x, and borrow against LARRY with our innovative stability mechanism where the price can only go up, never down.
              </p>
              
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

      {/* CHICKS Token Section */}
      <div className="py-16 sm:py-24 bg-white dark:bg-gray-950 relative overflow-hidden">
        {/* Abstract geometric background */}
        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-r from-cyan-400 to-blue-500 skew-y-6 transform -translate-y-24"></div>
          <div className="absolute bottom-0 right-0 w-full h-64 bg-gradient-to-l from-cyan-400 to-blue-500 skew-y-6 transform translate-y-24"></div>
          <div className="grid grid-cols-6 grid-rows-6 gap-4 absolute inset-0">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="bg-blue-500/5 dark:bg-blue-500/10 rounded-lg transform rotate-45"></div>
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
                <div className="inline-flex items-center px-4 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium mb-4">
                  <BanknotesIcon className="h-4 w-4 mr-2" />
                  <span>Capital Efficiency</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 inline-flex items-center">
                  <SparklesIcon className="h-8 w-8 mr-2 text-purple-500" />
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">CHICKS</span>
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-xl">
                  The most capital efficient token in DeFi. 100% USDC-backed with up to 99% LTV borrowing and leveraging through Aave.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link 
                    href="/chicks" 
                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 transition-all duration-300"
                  >
                    Get Started <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                  <Link 
                    href="/chicks#learn" 
                    className="inline-flex items-center px-6 py-3 rounded-md font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all duration-300"
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
                <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-8 border border-blue-100 dark:border-blue-800/30 shadow-lg">
                  <div className="absolute -top-4 -right-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold px-4 py-1 rounded-full">New</div>
                  
                  <div className="flex items-center justify-center mb-8">
                    <div className="relative h-24 w-24 flex-shrink-0">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full opacity-20 animate-pulse"></div>
                      <div className="absolute inset-2 rounded-full bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">$</span>
                      </div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">CHICKS Token</h3>
                      <p className="text-gray-600 dark:text-gray-400">USDC-backed efficiency</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <ShieldCheckIcon className="h-6 w-6 text-blue-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">100% USDC Backed</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Full collateralization</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <ArrowTrendingUpIcon className="h-6 w-6 text-green-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">99% LTV Borrowing</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Maximum capital efficiency</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                      <BoltIcon className="h-6 w-6 text-cyan-500 mr-3" />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">Aave Integration</h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Seamless yield generation</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 rounded-lg">
                    <div className="flex items-center">
                      <SparklesIcon className="h-5 w-5 mr-2" />
                      <p className="font-medium">Unlock maximum capital efficiency today!</p>
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

      {/* Megapot Lottery Section */}
      <div className="py-16 sm:py-24 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-xl animate-blob"></div>
          <div className="absolute top-80 -right-24 w-96 h-96 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-24 left-1/2 w-96 h-96 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-xl animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl md:text-4xl font-bold mb-4 inline-flex items-center">
                  <SparklesIcon className="h-8 w-8 mr-2 text-purple-500" />
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Megapot Lottery</span>
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  Win big with daily USDC jackpots! Buy tickets for a chance to win and earn 50% extra MegaPoints.
                </p>
              </motion.div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-purple-100 dark:border-purple-900/30 transform hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 flex items-center justify-center mr-4">
                      <TrophyIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">Daily Jackpots</h3>
                      <p className="text-gray-600 dark:text-gray-300">New lottery runs every 24 hours</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-purple-100 dark:border-purple-900/30 transform hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center mr-4">
                      <CurrencyDollarIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">USDC-Backed Prizes</h3>
                      <p className="text-gray-600 dark:text-gray-300">All prizes paid in stable USDC</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-purple-100 dark:border-purple-900/30 transform hover:-translate-y-1 transition-all duration-300">
                  <div className="flex items-center mb-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center mr-4">
                      <SparklesIcon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">50% MegaPoints Bonus</h3>
                      <p className="text-gray-600 dark:text-gray-300">Get 50% extra points with BTB referral</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-center md:text-left mt-8">
                  <Link 
                    href="/contracts/megapot" 
                    className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg transition-all duration-300"
                  >
                    Play Now <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl transform rotate-1"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                  <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg overflow-hidden mb-6 p-4">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="relative w-32 h-32 mx-auto mb-4">
                          <motion.div 
                            className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 opacity-75"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <div className="absolute inset-2 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">WIN!</span>
                          </div>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 font-medium">Daily USDC Jackpot</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ticket Price</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">$1 USDC</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Jackpot</p>
                      <p className="text-xl font-bold text-green-500">$250,000+</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg">
                    <div className="flex items-center">
                      <SparklesIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 mr-2" />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Get 50% extra MegaPoints when using BTB website as your referrer!</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
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
                      className="bg-btb-primary hover:bg-btb-primary-dark text-white font-semibold py-3 px-6 rounded-lg shadow-lg shadow-btb-primary/20 dark:shadow-btb-primary/10"
                      asChild
                    >
                      <Link href="/nftswap">
                        Try BTB Bear NFT Swap
                      </Link>
                    </MotionButton>
                    <MotionButton
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-btb-primary dark:text-btb-primary-light border border-btb-primary/30 dark:border-btb-primary-light/30 font-semibold py-3 px-6 rounded-lg shadow-md"
                      asChild
                    >
                      <Link href="/token">
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

      {/* Stats Section */}
      <LazyWrapper>
        <Stats />
      </LazyWrapper>

      {/* Testimonials */}
      <LazyWrapper>
        <Testimonials />
      </LazyWrapper>
    </div>
  );
}
