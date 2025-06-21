'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { 
  ShieldCheckIcon,
  ArrowRightIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  GlobeAltIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

// Game components
import { GameProvider } from './components/GameContext';
import GameDashboard from './components/GameDashboard';

export default function GamePage() {
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showGameInterface, setShowGameInterface] = useState(false);
  
  return (
    <div className="relative isolate">
      {/* Progress Bar (Mobile Only) */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 dark:bg-gray-800 z-50 md:hidden">
        <div className="h-full bg-gradient-to-r from-btb-primary to-blue-500 w-0" 
             style={{width: "var(--scroll-percent, 0%)"}}
             id="progressBar"></div>
      </div>
      <script dangerouslySetInnerHTML={{
        __html: `
          document.addEventListener('DOMContentLoaded', function() {
            window.addEventListener('scroll', function() {
              const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
              const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
              const scrolled = (winScroll / height) * 100;
              document.documentElement.style.setProperty('--scroll-percent', scrolled + '%');
            });
          });
        `
      }} />
      
      {/* Main Content */}
      {showGameInterface ? (
        <GameProvider>
          <div className="py-4 min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-950 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              {/* Grid pattern */}
              <svg className="absolute inset-0 w-full h-full opacity-5 dark:opacity-10" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btb-primary dark:text-blue-400" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              
              {/* Animated particles */}
              {[...Array(30)].map((_, i) => (
                <motion.div 
                  key={i}
                  className="absolute rounded-full bg-btb-primary/20 dark:bg-btb-primary/30"
                  style={{
                    width: Math.random() * 10 + 2 + 'px',
                    height: Math.random() * 10 + 2 + 'px',
                    left: Math.random() * 100 + '%',
                    top: Math.random() * 100 + '%',
                    zIndex: 1,
                  }}
                  animate={{
                    y: [0, Math.random() * -60 - 20, 0],
                    x: [0, Math.random() * 40 - 20, 0],
                    opacity: [0.1, 0.5, 0.1],
                  }}
                  transition={{
                    duration: Math.random() * 8 + 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
              
              {/* Gradient orbs */}
              <div className="absolute top-1/4 -left-20 w-60 h-60 bg-gradient-to-r from-btb-primary/20 to-blue-400/5 blur-3xl rounded-full"></div>
              <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-gradient-to-r from-indigo-400/10 to-btb-primary/10 blur-3xl rounded-full"></div>
            </div>
            
            <div className="container mx-auto px-4 mb-8 relative z-10">
              <div className="flex justify-between items-center">
                <motion.button
                  onClick={() => setShowGameInterface(false)}
                  whileHover={{ x: -3, backgroundColor: "rgba(255, 255, 255, 0.95)" }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-btb-primary dark:hover:text-btb-primary-light bg-white/80 dark:bg-gray-800/80 px-4 py-2 rounded-full shadow-md backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 transition-all duration-200"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Back to Game Info
                </motion.button>
                
                <motion.div 
                  className="flex items-center px-5 py-2.5 bg-gradient-to-r from-btb-primary/20 to-blue-500/20 dark:from-btb-primary/30 dark:to-blue-600/30 rounded-full backdrop-blur-md border border-blue-200/70 dark:border-blue-800/50 shadow-md"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary to-blue-600 dark:from-btb-primary-light dark:to-blue-400">MiMo Game</span>
                  <motion.span 
                    className="ml-2 text-sm px-2.5 py-0.5 bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 rounded-full border border-yellow-400/30"
                    animate={{ 
                      boxShadow: ["0 0 0 rgba(251, 191, 36, 0)", "0 0 8px rgba(251, 191, 36, 0.5)", "0 0 0 rgba(251, 191, 36, 0)"]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Testnet
                  </motion.span>
                </motion.div>
              </div>
              
              {/* Testnet Notice */}
              <motion.div 
                className="bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40 border border-yellow-200 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-300 p-5 rounded-xl my-5 shadow-md backdrop-blur-md"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full p-2 mt-0.5 shadow-md">
                    <motion.svg 
                      className="h-5 w-5 text-white" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, 0, -5, 0]
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </motion.svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-800 dark:text-amber-300">Testnet Environment</h3>
                    <p className="text-sm mt-1 leading-relaxed">
                      You're currently playing on Base Sepolia testnet. Game mechanics may have small adjustments on mainnet, but all core features will remain the same.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
            
            <GameDashboard />
          </div>
        </GameProvider>
      ) : (
        <>
          {/* Hero section */}
          <div className="relative min-h-[85vh] flex flex-col justify-center overflow-hidden">
            {/* Enhanced background with mesh gradient */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 dark:from-indigo-950 dark:via-purple-950 dark:to-pink-950"></div>
              
              {/* Animated mesh overlay */}
              <div className="absolute inset-0 opacity-30">
                <svg width="100%" height="100%" viewBox="0 0 400 400" className="animate-spin slow-spin">
                  <defs>
                    <linearGradient id="mesh1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8"/>
                      <stop offset="100%" stopColor="#EC4899" stopOpacity="0.4"/>
                    </linearGradient>
                  </defs>
                  <polygon points="200,50 350,200 200,350 50,200" fill="url(#mesh1)"/>
                </svg>
              </div>
              
              {/* Enhanced animated particles */}
              <div className="absolute inset-0">
                {[...Array(80)].map((_, i) => (
                  <motion.div 
                    key={i}
                    className={`absolute rounded-full ${i % 3 === 0 ? 'bg-yellow-400/60' : i % 3 === 1 ? 'bg-purple-400/60' : 'bg-pink-400/60'}`}
                    style={{
                      width: Math.random() * 12 + 3 + 'px',
                      height: Math.random() * 12 + 3 + 'px',
                      left: Math.random() * 100 + '%',
                      top: Math.random() * 100 + '%',
                    }}
                    animate={{
                      y: [0, Math.random() * -60 - 20, 0],
                      x: [0, Math.random() * 40 - 20, 0],
                      opacity: [0.3, 0.9, 0.3],
                      scale: [0.8, 1.2, 0.8],
                    }}
                    transition={{
                      duration: Math.random() * 8 + 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              
              {/* Enhanced grid pattern */}
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="enhancedGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="url(#mesh1)" strokeWidth="1"/>
                      <circle cx="20" cy="20" r="1" fill="url(#mesh1)"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#enhancedGrid)" />
                </svg>
              </div>
            </div>
            
            <div className="container mx-auto px-4 text-center relative z-20">
              {/* Enhanced hero content */}
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="max-w-5xl mx-auto"
              >
                {/* Game Logo/Icon */}
                <motion.div 
                  className="mb-8 flex justify-center"
                  animate={{ 
                    rotate: [0, 5, 0, -5, 0],
                    scale: [1, 1.05, 1]
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                >
                  <div className="relative">
                    <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600 rounded-3xl shadow-2xl flex items-center justify-center">
                      <span className="text-6xl">🎮</span>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-400 rounded-full animate-pulse flex items-center justify-center">
                      <span className="text-sm">🔥</span>
                    </div>
                  </div>
                </motion.div>

                <motion.h1 
                  className="text-6xl md:text-8xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-yellow-200 to-orange-300"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  MiMo Game
                </motion.h1>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="mb-8"
                >
                  <p className="text-xl md:text-2xl text-gray-200 mb-4 font-medium">
                    The Ultimate BEAR Hunter Ecosystem
                  </p>
                  <p className="text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed">
                    Deploy your hunters, earn MiMo tokens, and build the most powerful ecosystem in DeFi. 
                    Hunt, feed, and grow your digital companions in this immersive Web3 gaming experience.
                  </p>
                </motion.div>

                {/* Enhanced feature highlights */}
                <motion.div 
                  className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                >
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                    <div className="text-4xl mb-4">🏹</div>
                    <h3 className="text-xl font-bold text-white mb-2">Strategic Hunting</h3>
                    <p className="text-gray-300 text-sm">Deploy hunters to earn MiMo tokens through strategic gameplay</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                    <div className="text-4xl mb-4">⚡</div>
                    <h3 className="text-xl font-bold text-white mb-2">Power Mechanics</h3>
                    <p className="text-gray-300 text-sm">Feed and maintain your hunters to maximize their potential</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all duration-300">
                    <div className="text-4xl mb-4">💎</div>
                    <h3 className="text-xl font-bold text-white mb-2">NFT Integration</h3>
                    <p className="text-gray-300 text-sm">Convert BEAR NFTs into powerful hunters and vice versa</p>
                  </div>
                </motion.div>

                {/* Enhanced CTA buttons */}
                <motion.div 
                  className="flex flex-col sm:flex-row gap-6 justify-center items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  <motion.button
                    onClick={() => setShowGameInterface(true)}
                    whileHover={{ scale: 1.05, boxShadow: "0 20px 40px -15px rgba(139, 69, 19, 0.6)" }}
                    whileTap={{ scale: 0.98 }}
                    className="group relative bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white px-12 py-4 rounded-2xl font-bold text-xl shadow-2xl overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="relative flex items-center gap-3">
                      <span>🎮</span>
                      <span>Enter Game</span>
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <ArrowRightIcon className="w-6 h-6" />
                      </motion.div>
                    </div>
                  </motion.button>
                  
                  <motion.button
                    onClick={() => document.getElementById('learn-more')?.scrollIntoView({ behavior: 'smooth' })}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-white/20 backdrop-blur-lg border border-white/30 text-white px-10 py-4 rounded-2xl font-semibold text-lg hover:bg-white/30 transition-all duration-300 flex items-center gap-2"
                  >
                    <span>📚</span>
                    Learn More
                  </motion.button>
                </motion.div>

                {/* Game stats preview */}
                <motion.div 
                  className="mt-16 bg-black/30 backdrop-blur-lg rounded-3xl p-8 border border-white/10 max-w-4xl mx-auto"
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.0 }}
                >
                  <h3 className="text-2xl font-bold text-white mb-6 text-center">Live Game Statistics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-400 mb-2">🎯</div>
                      <div className="text-2xl font-bold text-white">Active</div>
                      <div className="text-gray-300">Hunters</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400 mb-2">💰</div>
                      <div className="text-2xl font-bold text-white">Earning</div>
                      <div className="text-gray-300">MiMo Daily</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400 mb-2">🔥</div>
                      <div className="text-2xl font-bold text-white">Base</div>
                      <div className="text-gray-300">Testnet</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400 mb-2">⚡</div>
                      <div className="text-2xl font-bold text-white">24/7</div>
                      <div className="text-gray-300">Active</div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Enhanced Game Features Section */}
          <section id="learn-more" className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0">
              <div className="absolute top-20 left-10 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl"></div>
              <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl"></div>
            </div>
            
            <div className="container mx-auto px-4 relative z-10">
              <motion.div 
                className="text-center mb-16"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <h2 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
                  Game Features
                </h2>
                <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                  Discover the innovative mechanics that make MiMo Game the most engaging DeFi gaming experience
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                {[
                  {
                    icon: "🎯",
                    title: "Hunter Deployment",
                    description: "Convert your BEAR NFTs into powerful hunters that can earn MiMo tokens autonomously",
                    color: "from-red-500 to-orange-500"
                  },
                  {
                    icon: "⚡",
                    title: "Power System",
                    description: "Each hunter has unique power levels that affect earning potential and hunting success",
                    color: "from-yellow-500 to-red-500"
                  },
                  {
                    icon: "🍖",
                    title: "Feeding Mechanics",
                    description: "Keep your hunters healthy and powerful by feeding them regularly to maintain performance",
                    color: "from-green-500 to-blue-500"
                  },
                  {
                    icon: "🏹",
                    title: "Strategic Hunting",
                    description: "Target other players or hunt yourself to earn MiMo tokens through skill-based gameplay",
                    color: "from-purple-500 to-pink-500"
                  },
                  {
                    icon: "💰",
                    title: "Token Economy",
                    description: "Earn, burn, and redistribute MiMo tokens through various game mechanics and strategies",
                    color: "from-blue-500 to-indigo-500"
                  },
                  {
                    icon: "🔄",
                    title: "NFT Conversion",
                    description: "Seamlessly convert between BEAR NFTs and hunters, maintaining value and utility",
                    color: "from-indigo-500 to-purple-500"
                  }
                ].map((feature, index) => (
                  <motion.div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl border border-gray-100 dark:border-gray-700 hover:shadow-2xl transition-all duration-300"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    whileHover={{ y: -5 }}
                  >
                    <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">{feature.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
                  </motion.div>
                ))}
              </div>

              {/* Call to Action */}
              <motion.div 
                className="text-center"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <motion.button
                  onClick={() => setShowGameInterface(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white px-12 py-4 rounded-2xl font-bold text-xl shadow-2xl hover:shadow-purple-500/25 transition-all duration-300"
                >
                  🚀 Start Playing Now
                </motion.button>
              </motion.div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}