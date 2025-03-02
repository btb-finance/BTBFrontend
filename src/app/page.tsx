'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  CurrencyDollarIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  ArrowRightIcon,
  CalculatorIcon,
  BeakerIcon,
  LightBulbIcon,
  SparklesIcon,

  CubeTransparentIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import Testimonials from './components/home/Testimonials';
import ChainSelector from './components/home/ChainSelector';
import Stats from './components/home/Stats';
import Logo from './components/common/Logo';
import UniswapHooks from './components/home/UniswapHooks';
import ImpermanentLossProtection from './components/home/ImpermanentLossProtection';
import { Button, MotionButton } from './components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from './components/ui/card';
import TypewriterEffect from './components/ui/typewriter-effect';

const features = [
  {
    name: 'BTB Token Ecosystem',
    description: 'Explore our comprehensive ecosystem of digital assets including BTB Token, BTBT Tax Token, and BTBN NFTs.',
    icon: CurrencyDollarIcon,
    href: '/token',
    color: 'from-blue-500 to-blue-600'
  },
  {
    name: 'Yield Farming Platform',
    description: 'Access sophisticated yield farming solutions with our advanced IL Calculator and pool management tools.',
    icon: ChartBarIcon,
    href: '/calculator',
    color: 'from-green-500 to-emerald-600'
  },
  {
    name: 'BTB Exchange',
    description: 'Trade on our unique exchange with revolutionary bonding curve pricing where prices increase with both buys AND sells.',
    icon: BeakerIcon,
    href: '/btb-exchange',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    name: 'Global Community',
    description: 'Join our vibrant community of crypto enthusiasts, developers, and investors worldwide.',
    icon: UserGroupIcon,
    href: '/community',
    color: 'from-amber-500 to-orange-600'
  }
];

const products = [
  {
    name: 'BTB Token',
    description: 'Our governance token with staking rewards and ecosystem benefits. Lock BTB tokens to access trading on our exchange.',
    detailedDescription: 'BTB is the core governance token of our ecosystem with a total supply of 1,000,000,000 tokens. It enables staking rewards, voting rights, and exclusive access to our trading platform. By locking BTB tokens, users gain the ability to trade on our revolutionary exchange with bonding curve pricing.',
    features: ['Governance voting rights', 'Staking rewards up to 15% APY', 'Exchange access token', 'Deflationary tokenomics'],
    icon: CurrencyDollarIcon,
    href: '/token',
    bgColor: 'bg-gradient-to-br from-blue-600/10 to-blue-800/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  {
    name: 'Impermanent Loss Calculator',
    description: 'Understand and mitigate your risks with our sophisticated IL calculator tool.',
    detailedDescription: 'Our advanced Impermanent Loss Calculator helps liquidity providers accurately predict potential losses when providing liquidity to AMMs. This essential tool simulates various market scenarios to help you make informed decisions about your yield farming strategy.',
    features: ['Real-time IL calculations', 'Multiple AMM support', 'Price impact simulation', 'Historical data analysis'],
    icon: CalculatorIcon,
    href: '/calculator',
    bgColor: 'bg-gradient-to-br from-emerald-600/10 to-green-800/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800'
  },
  {
    name: 'BTB Exchange',
    description: 'Trade on our unique exchange with revolutionary bonding curve pricing where prices increase with both buys AND sells.',
    detailedDescription: 'The BTB Exchange features a groundbreaking bonding curve mechanism where token prices increase with BOTH buys and sells. This revolutionary approach creates a sustainable economic flywheel that benefits all participants while ensuring continuous price appreciation.',
    features: ['Unique bonding curve pricing', 'Token-gated trading access', 'Fee distribution to LPs', 'Arbitrage opportunities'],
    icon: BeakerIcon,
    href: '/btb-exchange',
    bgColor: 'bg-gradient-to-br from-purple-600/10 to-indigo-800/10',
    iconColor: 'text-purple-600 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  {
    name: 'DeFi Hooks',
    description: 'Advanced DeFi hooks for seamless trading and investment across the Optimism ecosystem.',
    detailedDescription: 'Our DeFi Hooks provide developers and users with powerful integrations to connect with various DeFi protocols across the Optimism ecosystem. These hooks enable seamless trading, liquidity provision, and yield optimization with minimal friction.',
    features: ['Cross-protocol integrations', 'Gas-optimized transactions', 'Automated yield strategies', 'Custom trading hooks'],
    icon: LightBulbIcon,
    href: '/hooks',
    bgColor: 'bg-gradient-to-br from-amber-600/10 to-amber-800/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800'
  }
];

const stats = [
  { label: 'Total Value Locked', value: '$42M+' },
  { label: 'Active Users', value: '15,000+' },
  { label: 'Transactions', value: '1.2M+' },
  { label: 'Supported Networks', value: '5+' }
];

// BTB Exchange Flywheel steps
const flywheelSteps = [
  { step: "Lock BTB Tokens", desc: "Users must lock BTB tokens to access BTBY/USDC trading" },
  { step: "Trade BTBY/USDC", desc: "Trading generates 0.1% fees with our unique bonding curve" },
  { step: "Fees to LP", desc: "All trading fees fund BTBY/ETH liquidity providers on Uniswap" },
  { step: "Price Always Rises", desc: "BTBY price increases with BOTH buys AND sells" },
  { step: "Arbitrage Profit", desc: "Traders keep 100% of arbitrage profits between platforms" },
  { step: "Enhanced Liquidity", desc: "More LP providers join for the rewards" },
  { step: "Ecosystem Growth", desc: "Back to step 1 with more participants" }
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

// Who wins in the BTB Exchange model
const winnerGroups = [
  {
    title: "BTB Token Holders Win",
    benefits: [
      "Their tokens have clear utility (trading access)",
      "Benefit from all arbitrage activity",
      "Increasing demand for trading drives demand for BTB"
    ],
    icon: CurrencyDollarIcon,
    color: "bg-blue-50 dark:bg-blue-900/20"
  },
  {
    title: "BTBY/ETH Liquidity Providers Win",
    benefits: [
      "Earn rewards from all 0.1% trading fees",
      "Benefit from increased trading volume due to arbitrage",
      "Participate in a high-yield liquidity pool"
    ],
    icon: SparklesIcon,
    color: "bg-purple-50 dark:bg-purple-900/20"
  },
  {
    title: "Traders Win",
    benefits: [
      "Keep 100% of arbitrage profits",
      "Trade on a unique exchange with bonding curve pricing",
      "BTBY price always trends upward",
      "Participate in a market with growing liquidity"
    ],
    icon: ChartBarIcon,
    color: "bg-green-50 dark:bg-green-900/20"
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
    return () => clearInterval(interval);
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
                <ChainSelector />
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
                      'Revolutionizing DeFi on Optimism', 
                      'Secure Your Financial Future',
                      'Trade with Bonding Curve Pricing',
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
                A comprehensive DeFi platform combining revolutionary exchange mechanics, advanced yield farming, and an ecosystem built for success on Optimism.
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
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                  <Link
                    href="/btb-exchange"
                    className="relative flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light hover:shadow-lg transition-all duration-300 shadow-md shadow-btb-primary/20"
                  >
                    Trade on Exchange <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Link>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="inline-block"
                >
                  <Link
                    href="/pools"
                    className="relative border-2 border-btb-primary text-btb-primary px-6 py-3 rounded-lg font-medium hover:bg-white/10 hover:border-btb-primary-light transition-all duration-300 flex items-center"
                  >
                    Explore Pools <ArrowRightIcon className="ml-2 h-4 w-4 opacity-70 group-hover:translate-x-1 transition-transform duration-300" />
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
                className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-700 hover:border-optimism-red dark:hover:border-optimism-red"
              >
                <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-optimism-red opacity-10 group-hover:opacity-20 transition-opacity" />
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg ${product.bgColor} ${product.iconColor} p-2 mr-3`}>
                        <product.icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white font-heading">
                          {product.name}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 text-xs">
                          {product.description}
                        </p>
                      </div>
                    </div>
                    <Link 
                      href={product.href}
                      className="flex-shrink-0 inline-flex items-center text-optimism-red text-sm font-medium hover:text-optimism-red/80 transition-colors"
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl text-center mb-10"
          >
            <div className="inline-block px-4 py-1 mb-4 rounded-full bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/20 border border-btb-primary/20 backdrop-blur-sm shadow-lg">
              <p className="text-sm font-medium text-btb-primary flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Revolutionary Economic Model
              </p>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl font-heading bg-clip-text text-transparent bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light">
              The BTB Exchange Flywheel
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our innovative economic model creates a self-reinforcing ecosystem where all participants benefit from a continuous positive feedback loop
            </p>
          </motion.div>
          
          {/* Interactive Flywheel Diagram */}
          <div className="relative mb-16 overflow-hidden rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm shadow-xl border border-white/20 dark:border-gray-700/20">
            <div className="absolute inset-0 bg-gradient-to-br from-btb-primary/5 via-transparent to-btb-primary-light/5 opacity-70"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-btb-primary/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-btb-primary-light/10 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 p-6 md:p-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7 }}
                viewport={{ once: true }}
              >
                <FlywheelDiagram />
              </motion.div>
            </div>
          </div>
          
          {/* Key Benefits Section */}
          <div className="mb-16">
            <motion.h3 
              className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Key Benefits of Our Flywheel Model
            </motion.h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {winnerGroups.map((group, index) => (
                <motion.div
                  key={index}
                  className={`p-6 rounded-xl shadow-lg ${group.color} border border-white/20 dark:border-gray-700/30 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-center mb-4">
                    <div className="p-2 rounded-full bg-white/70 dark:bg-gray-800/70 mr-3 shadow-md">
                      <group.icon className="h-6 w-6 text-btb-primary" />
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white">{group.title}</h4>
                  </div>
                  
                  <ul className="space-y-3">
                    {group.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-btb-primary mr-2 text-lg">•</span>
                        <span className="text-gray-700 dark:text-gray-300 text-sm">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Real-world Example */}
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 mb-16 relative overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
          >
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-btb-primary/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-btb-primary-light/5 rounded-full blur-3xl"></div>
            
            <h3 className="text-2xl font-bold text-btb-primary mb-6 relative z-10">See The Flywheel In Action</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-100 dark:border-blue-800/30">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 font-bold mr-2">A</div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Alice: BTB Holder</h4>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Locks 9,000 BTB tokens to access the exchange. She buys BTBY tokens, generating a 0.1% fee for liquidity providers. The bonding curve ensures her purchase <span className="font-semibold text-btb-primary">increases</span> the BTBY price.
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-lg border border-purple-100 dark:border-purple-800/30">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold mr-2">B</div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Bob: Arbitrageur</h4>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Notices price differences and arbitrages between platforms. Even when <span className="font-semibold text-btb-primary">selling</span> BTBY, the price still <span className="font-semibold text-btb-primary">increases</span>! He profits while paying fees that reward LP providers.
                </p>
              </div>
              
              <div className="bg-green-50 dark:bg-green-900/20 p-5 rounded-lg border border-green-100 dark:border-green-800/30">
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center text-green-600 dark:text-green-300 font-bold mr-2">C</div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Carol: LP Provider</h4>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Provides liquidity to BTBY/ETH on Uniswap, earning rewards from all trading fees. As trading volume increases, her rewards grow, incentivizing her to add more liquidity to the pool.
                </p>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-block group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500"></div>
                <Link
                  href="/btb-exchange"
                  className="relative flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light hover:shadow-lg transition-all duration-300 shadow-md shadow-btb-primary/20"
                >
                  Experience the BTB Exchange <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Uniswap Hooks Section */}
      <UniswapHooks />

      {/* Impermanent Loss Protection Section */}
      <ImpermanentLossProtection />

      {/* Enhanced IL Calculator Section */}
      <div className="py-16 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
                Advanced Impermanent Loss Calculator
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                Our sophisticated IL calculator helps liquidity providers understand and mitigate risks when providing liquidity to AMM pools.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 mr-4">
                    <span className="text-lg font-semibold">1</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Real-time Calculations</h3>
                    <p className="text-gray-600 dark:text-gray-300">Instantly see how price changes affect your liquidity position</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mr-4">
                    <span className="text-lg font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Multiple AMM Support</h3>
                    <p className="text-gray-600 dark:text-gray-300">Compare IL across different protocols and pool types</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 mr-4">
                    <span className="text-lg font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visual Analytics</h3>
                    <p className="text-gray-600 dark:text-gray-300">Interactive charts help visualize potential outcomes</p>
                  </div>
                </div>
              </div>
              
              <Link 
                href="/calculator"
                className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-emerald-600 to-green-500 hover:shadow-lg transition-all duration-300"
              >
                Try the Calculator <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-green-500/10 rounded-xl transform rotate-1"></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
                <div className="aspect-w-16 aspect-h-9 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden mb-6">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-full h-64 bg-gradient-to-b from-emerald-500/20 to-green-500/20 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <ChartBarIcon className="h-16 w-16 mx-auto text-emerald-500 dark:text-emerald-400 mb-4" />
                        <p className="text-gray-700 dark:text-gray-300 font-medium">Interactive IL Chart Visualization</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Price Change</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">+50%</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Impermanent Loss</p>
                    <p className="text-xl font-bold text-red-500">-2.02%</p>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Fee APR</p>
                    <p className="text-sm font-medium text-green-500">+5.2%</p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Fee income offsets IL after 4.7 months</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <Stats />

      {/* Testimonials */}
      <Testimonials />
    </div>
  );
}
