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
                A comprehensive DeFi platform combining revolutionary exchange mechanics, advanced yield farming, and an ecosystem built for success on BASE.
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-10">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl font-heading">
              The BTB Exchange Flywheel
            </h2>
            <p className="mt-3 text-base text-gray-600 dark:text-gray-300">
              Our revolutionary economic model creates a self-reinforcing ecosystem where everyone wins
            </p>
          </div>
          
          <div className="relative">
            {/* Flywheel Diagram */}
            <div className="mb-10 relative max-w-3xl mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/5 to-btb-primary-light/5 rounded-lg transform -rotate-1"></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="w-full md:w-1/2">
                    <h3 className="text-lg font-bold text-btb-primary mb-2">How The Flywheel Spins</h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">Our ecosystem creates a powerful self-reinforcing cycle that benefits all participants:</p>
                    
                    <ol className="space-y-2">
                      {[
                        { step: "BTB Utility", desc: "Users lock BTB tokens to gain trading access" },
                        { step: "Trading Activity", desc: "Trading generates fees while using the bonding curve" },
                        { step: "LP Rewards", desc: "Fees reward BTBY/ETH liquidity providers" },
                        { step: "Arbitrage Opportunity", desc: "Price differences create arbitrage opportunities" },
                        { step: "More Volume", desc: "Arbitrageurs increase trading volume on both platforms" },
                        { step: "Enhanced Liquidity", desc: "More LP providers join for the rewards" },
                        { step: "Ecosystem Growth", desc: "Back to step 1 with more participants" }
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
                  <span className="font-semibold">Alice</span> locks 9,000 BTB to trade. She buys BTBY tokens, generating a 0.1% fee for BTBY/ETH LP providers. The bonding curve ensures her purchase <span className="font-semibold">increases</span> the BTBY price.
                </p>
                
                <p className="mb-2">
                  <span className="font-semibold">Bob</span> arbitrages between platforms. Even when <span className="font-semibold">selling</span> BTBY, the price still <span className="font-semibold">increases</span>! He profits while paying fees that reward LP providers.
                </p>
                
                <p>
                  <span className="font-semibold">Carol</span> provides liquidity to BTBY/ETH on Uniswap, earning rewards. The <span className="font-semibold">revolutionary bonding curve</span> creates a positive cycle strengthening the ecosystem.
                </p>
              </div>
              
              <div className="mt-5 text-center">
                <Link 
                  href="/btb-exchange"
                  className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light hover:shadow-md transition-all duration-300"
                >
                  Experience the BTB Exchange <ArrowRightIcon className="ml-1.5 h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Real-time Calculations</h3>
                    <p className="text-gray-600 dark:text-gray-300">Instantly see how price changes affect your liquidity position</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mr-4">
                    <span className="text-lg font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Multiple AMM Support</h3>
                    <p className="text-gray-600 dark:text-gray-300">Compare IL across different protocols and pool types</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400 mr-4">
                    <span className="text-lg font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Visual Analytics</h3>
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
                  
                  <div className="mt-2 text-xs">
                    <Link 
                      href="/risk-disclosure" 
                      className="inline-flex items-center px-2 py-1 rounded-md bg-btb-primary/10 text-btb-primary dark:text-btb-primary-light hover:bg-btb-primary/20 transition-colors"
                    >
                      Read full risk disclosure <ArrowRightIcon className="ml-1 h-2.5 w-2.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats Section */}
      <Stats />

      {/* Testimonials */}
      <Testimonials />
    </div>
  );
}
