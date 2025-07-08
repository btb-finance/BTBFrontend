'use client';

import React from 'react';
import { CheckCircleIcon, ClockIcon, SparklesIcon, CpuChipIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

const RoadmapPage = () => {
  const completedMilestones = [
    {
      title: "BTB Impermanent Loss Refund",
      description: "World's first automatic IL protection system that completely eliminates impermanent loss risk for all liquidity providers",
      icon: "🛡️",
      details: "Breakthrough technology that makes LP positions risk-free"
    },
    {
      title: "Larry Meme Coin",
      description: "Revolutionary meme token that redefined the entire meme economy with unprecedented utility and sustainable tokenomics",
      icon: "🐺",
      details: "The meme coin that proved utility and fun can coexist"
    },
    {
      title: "BTB Play-to-Earn Game",
      description: "Immersive bear hunting ecosystem where players earn real BTB tokens through strategic gameplay and NFT interactions",
      icon: "🎮",
      details: "Gaming meets DeFi in an unprecedented earning experience"
    }
  ];

  const upcomingMilestones = [
    {
      title: "BTB RISC-V Blockchain",
      description: "The world's first RISC-V powered blockchain featuring native onchain function scheduling, automatic execution, and web-speed performance that makes current blockchains obsolete",
      icon: "⚡",
      details: "The blockchain that finally works like the internet should"
    },
    {
      title: "USDBTB Stable Coin",
      description: "The first truly innovative stablecoin that generates yield automatically while maintaining perfect price stability through revolutionary reward-based mechanisms",
      icon: "💰",
      details: "Stability that pays you to hold it"
    },
    {
      title: "BTB Uniswap V4 Hook",
      description: "Intelligent LP management system that automatically handles rebalancing, eliminates impermanent loss, and reinvests rewards - making liquidity provision completely passive and profitable",
      icon: "🔄",
      details: "Set it and forget it LP management perfection"
    },
    {
      title: "BTB Launch Pad",
      description: "The ultimate token launch platform where developers, liquidity providers, and holders all earn perpetual rewards with mathematical impossibility of rug pulls",
      icon: "🚀",
      details: "Where everyone wins, forever"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-btb-primary/5 via-white to-btb-primary/5 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/10 dark:from-btb-primary/20 dark:to-btb-primary-light/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <div className="flex items-center justify-center mb-6">
              <SparklesIcon className="h-8 w-8 text-btb-primary mr-3" />
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white">
                BTB Roadmap
              </h1>
            </div>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto">
              Pioneering the world's first RISC-V blockchain with onchain function automation, 
              web-speed performance, and built-in impermanent loss protection for all
            </p>
          </motion.div>
        </div>
      </div>

      {/* Roadmap Timeline */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        {/* Timeline Container */}
        <div className="relative">
          {/* Vertical Timeline Line */}
          <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 w-1 bg-gradient-to-b from-green-500 via-blue-500 to-purple-500 h-full rounded-full"></div>
          
          {/* Completed Milestones */}
          {completedMilestones.map((milestone, index) => (
            <motion.div
              key={`completed-${index}`}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className={`relative flex items-center mb-16 ${
                index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}
            >
              {/* Timeline Dot */}
              <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 -translate-y-1/2 top-1/2 z-10">
                <div className="w-6 h-6 bg-green-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center">
                  <CheckCircleIcon className="w-4 h-4 text-white" />
                </div>
              </div>
              
              {/* Content Card */}
              <div className={`ml-16 md:ml-0 md:w-5/12 ${
                index % 2 === 0 ? 'md:mr-auto md:pr-8' : 'md:ml-auto md:pl-8'
              }`}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-green-200 dark:border-green-700">
                  <div className="flex items-center mb-4">
                    <div className="text-3xl mr-3">{milestone.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {milestone.title}
                      </h3>
                      <div className="flex items-center">
                        <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                        <span className="text-sm font-medium text-green-600 dark:text-green-400">COMPLETED</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {milestone.description}
                  </p>
                  <div className="text-sm text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                    ✅ {milestone.details}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Phase Separator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: completedMilestones.length * 0.2 }}
            className="relative flex justify-center mb-16"
          >
            <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 z-10">
              <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="ml-16 md:ml-0 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full shadow-lg">
              <span className="font-bold text-lg">🚀 NEXT PHASE: REVOLUTIONARY INNOVATIONS</span>
            </div>
          </motion.div>
          
          {/* Upcoming Milestones */}
          {upcomingMilestones.map((milestone, index) => (
            <motion.div
              key={`upcoming-${index}`}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: (completedMilestones.length + 1 + index) * 0.2 }}
              className={`relative flex items-center mb-16 ${
                index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
              }`}
            >
              {/* Timeline Dot */}
              <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 -translate-y-1/2 top-1/2 z-10">
                <div className="w-6 h-6 bg-blue-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center animate-pulse">
                  <ClockIcon className="w-4 h-4 text-white" />
                </div>
              </div>
              
              {/* Content Card */}
              <div className={`ml-16 md:ml-0 md:w-5/12 ${
                index % 2 === 0 ? 'md:mr-auto md:pr-8' : 'md:ml-auto md:pl-8'
              }`}>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border border-blue-200 dark:border-blue-700 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-bl-full"></div>
                  <div className="flex items-center mb-4">
                    <div className="text-3xl mr-3">{milestone.icon}</div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {milestone.title}
                      </h3>
                      <div className="flex items-center">
                        <ClockIcon className="w-4 h-4 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">IN DEVELOPMENT</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {milestone.description}
                  </p>
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                    🔮 {milestone.details}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
          
          {/* Future Vision */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: (completedMilestones.length + upcomingMilestones.length + 1) * 0.2 }}
            className="relative flex justify-center"
          >
            <div className="absolute left-8 md:left-1/2 transform md:-translate-x-1/2 z-10">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full border-4 border-white dark:border-gray-900 shadow-lg flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="ml-16 md:ml-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl shadow-xl text-center">
              <div className="text-2xl font-bold mb-2">🌟 THE FUTURE OF DEFI</div>
              <div className="text-sm opacity-90">Where blockchain finally works like magic</div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* RISC-V Blockchain Explanation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 mb-16"
        >
          <div className="flex items-center mb-8">
            <CpuChipIcon className="h-8 w-8 text-purple-500 mr-3" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              RISC-V: The Architecture That Changes Everything
            </h2>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-3">⚡</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  RISC-V (Risk-Five)
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                RISC-V (pronounced "risk-five") is the revolutionary open-source processor architecture that's transforming computing. Unlike proprietary chips, RISC-V is completely customizable and optimized for maximum performance.
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                The foundation of our lightning-fast blockchain
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-3">🚀</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Onchain Function Calls
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Imagine never having to manually liquidate users or rebalance portfolios again. Our blockchain executes functions automatically onchain - like having intelligent web backends, but completely decentralized and trustless.
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                The end of manual blockchain operations
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-3">🕐</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Function Scheduling
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Set functions to execute at precise times or when specific conditions are met. This breakthrough capability - impossible on today's blockchains - transforms how DeFi protocols operate.
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                Time-based execution, natively onchain
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-3">🛡️</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  No More IL Worries
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                The days of impermanent loss anxiety are over. Our blockchain architecture provides automatic, native protection for all liquidity providers - no additional protocols or complexities required.
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                Peace of mind for every liquidity provider
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-3">🌐</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Web-Speed Performance
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Experience blockchain transactions that feel instant - faster than traditional web applications. No more waiting for confirmations or dealing with network congestion.
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                Instant transactions, every time
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <div className="text-4xl mr-3">🔧</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Pre-Built Everything
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-3">
                Deploy your contract and start building immediately. Unlike other blockchains where you build everything from scratch, our ecosystem comes with backends, frontends, and infrastructure ready to use.
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                From idea to deployment in minutes
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Vision Statement */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mt-16 bg-gradient-to-r from-btb-primary/10 to-btb-primary-light/10 dark:from-btb-primary/20 dark:to-btb-primary-light/20 rounded-2xl p-8 text-center"
        >
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Our Revolutionary Vision
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-4xl mx-auto mb-6">
            We're not just building another blockchain - we're creating the future of decentralized computing. Our RISC-V powered architecture delivers what the crypto world has been waiting for: automatic execution, native scheduling, instant transactions, and built-in protections that make DeFi truly accessible to everyone.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto text-left">
            <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">😤 Today's Blockchain Frustrations:</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• "Oops, forgot to liquidate that position"</li>
                <li>• "Lost money to impermanent loss again"</li>
                <li>• "Why is this transaction taking forever?"</li>
                <li>• "Need to build everything from zero"</li>
                <li>• "Wish I could schedule this function"</li>
              </ul>
            </div>
            <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🚀 The BTB RISC-V Experience:</h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• "Functions execute themselves automatically"</li>
                <li>• "IL protection? That's built-in now"</li>
                <li>• "Faster than my web browser!"</li>
                <li>• "Deploy and go - everything's ready"</li>
                <li>• "Schedule any function, anytime"</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RoadmapPage;