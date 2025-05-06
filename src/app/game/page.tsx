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
          <div className="py-4">
            <div className="container mx-auto px-4 mb-8">
              <div className="flex justify-between items-center">
                <motion.button
                  onClick={() => setShowGameInterface(false)}
                  whileHover={{ x: -3 }}
                  className="flex items-center text-gray-600 dark:text-gray-400 hover:text-btb-primary dark:hover:text-btb-primary-light"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  Back to Game Info
                </motion.button>
                
                <div className="text-xl font-bold text-btb-primary dark:text-btb-primary-light">MiMo Game</div>
              </div>
            </div>
            
            <GameDashboard />
          </div>
        </GameProvider>
      ) : (
        <>
          {/* Hero section */}
          <div className="relative min-h-[60vh] flex flex-col justify-center overflow-hidden">
            {/* Modern background with mesh gradient */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 dark:from-blue-900 dark:via-indigo-950 dark:to-purple-950"></div>
              
              {/* Subtle mesh pattern */}
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" />
                    </pattern>
                    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                      <rect width="80" height="80" fill="url(#smallGrid)" />
                      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>
              
              {/* Floating particles */}
              <div className="absolute inset-0">
                {[...Array(40)].map((_, i) => (
                  <motion.div 
                    key={i}
                    className="absolute rounded-full bg-white/40"
                    style={{
                      width: Math.random() * 6 + 2 + 'px',
                      height: Math.random() * 6 + 2 + 'px',
                      left: Math.random() * 100 + '%',
                      top: Math.random() * 100 + '%',
                    }}
                    animate={{
                      y: [0, Math.random() * -30 - 10, 0],
                      opacity: [0.3, 0.8, 0.3],
                    }}
                    transition={{
                      duration: Math.random() * 3 + 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* Content */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 flex flex-col justify-center relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-center"
              >
                {/* Game Logo Container */}
                <div className="mb-8 inline-block">
                  <div className="relative h-24 w-24 sm:h-32 sm:w-32 mx-auto bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-btb-primary">
                    <span className="text-4xl sm:text-5xl">🎮</span>
                    <motion.div 
                      className="absolute -inset-2 rounded-full border-2 border-white/50"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [1, 0.5, 1]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    ></motion.div>
                  </div>
                </div>
                
                {/* Title and Subtitle */}
                <div className="bg-black/30 backdrop-blur-md rounded-xl p-6 sm:p-8 shadow-xl max-w-3xl mx-auto border border-white/10">
                  <h1 className="text-4xl sm:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">
                    MiMo Game
                  </h1>
                  
                  <div className="mb-4 relative">
                    <span className="relative text-xl sm:text-2xl font-bold tracking-widest text-white px-4 py-1">
                      <span className="absolute inset-0 bg-btb-primary/80 rounded-md backdrop-blur-sm -skew-x-6"></span>
                      <span className="relative">PLAY TO EARN</span>
                    </span>
                  </div>
                  
                  <p className="text-lg sm:text-xl font-medium text-white mx-auto mb-6 tracking-wide leading-relaxed">
                    Hunt, earn, and build your digital ecosystem with MiMo — 
                    where strategy meets reward in an engaging blockchain experience
                  </p>
                  
                  {/* Launch Game Button */}
                  <motion.button
                    onClick={() => setShowGameInterface(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-btb-primary text-white font-bold text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center mx-auto"
                  >
                    Launch Game
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </motion.button>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-8 flex flex-wrap gap-4 justify-center">
                  <motion.a
                    href="#overview"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-white text-blue-700 font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center"
                  >
                    Explore Features
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </motion.a>
                  <motion.a
                    href="#play-to-earn"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-transparent text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-white/70 hover:bg-white/10"
                  >
                    Learn More
                  </motion.a>
                </div>
              </motion.div>
            </div>
            
            {/* Decorative Bottom Wave */}
            <div className="absolute bottom-0 left-0 right-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="w-full">
                <path fill="#ffffff" fillOpacity="1" d="M0,224L80,213.3C160,203,320,181,480,186.7C640,192,800,224,960,229.3C1120,235,1280,213,1360,202.7L1440,192L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z" className="dark:fill-gray-900"></path>
              </svg>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-md py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="grid grid-cols-4 gap-1 sm:gap-2">
                <a href="#overview" className="bg-btb-primary/10 dark:bg-btb-primary/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:bg-btb-primary/20 transition-colors">
                  <GlobeAltIcon className="h-4 w-4 sm:mr-1" />
                  <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">Overview</span>
                </a>
                <a href="#play-to-earn" className="bg-btb-primary/10 dark:bg-btb-primary/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:bg-btb-primary/20 transition-colors">
                  <CurrencyDollarIcon className="h-4 w-4 sm:mr-1" />
                  <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">Earn</span>
                </a>
                <a href="#protection" className="bg-btb-primary/10 dark:bg-btb-primary/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:bg-btb-primary/20 transition-colors">
                  <ShieldCheckIcon className="h-4 w-4 sm:mr-1" />
                  <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">Protect</span>
                </a>
                <a href="#mechanics" className="bg-btb-primary/10 dark:bg-btb-primary/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:bg-btb-primary/20 transition-colors">
                  <SparklesIcon className="h-4 w-4 sm:mr-1" />
                  <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">Mechanics</span>
                </a>
              </div>
            </div>
          </div>

          {/* Content Sections */}
          <div className="container mx-auto px-4 py-8">
            {/* Section indicators */}
            <div className="hidden md:block fixed right-6 top-1/2 transform -translate-y-1/2 z-10">
              <div className="flex flex-col space-y-4">
                <a href="#overview" className="group flex items-center">
                  <div className="w-2 h-2 rounded-full bg-btb-primary/50 group-hover:bg-btb-primary group-hover:scale-150 transition-all duration-300 mr-2"></div>
                  <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-800/80 text-white px-2 py-1 rounded">Overview</span>
                </a>
                <a href="#play-to-earn" className="group flex items-center">
                  <div className="w-2 h-2 rounded-full bg-btb-primary/50 group-hover:bg-btb-primary group-hover:scale-150 transition-all duration-300 mr-2"></div>
                  <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-800/80 text-white px-2 py-1 rounded">Earn</span>
                </a>
                <a href="#protection" className="group flex items-center">
                  <div className="w-2 h-2 rounded-full bg-btb-primary/50 group-hover:bg-btb-primary group-hover:scale-150 transition-all duration-300 mr-2"></div>
                  <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-800/80 text-white px-2 py-1 rounded">Protection</span>
                </a>
                <a href="#mechanics" className="group flex items-center">
                  <div className="w-2 h-2 rounded-full bg-btb-primary/50 group-hover:bg-btb-primary group-hover:scale-150 transition-all duration-300 mr-2"></div>
                  <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-800/80 text-white px-2 py-1 rounded">Mechanics</span>
                </a>
              </div>
            </div>
            
            <div className="space-y-16">
              {/* GAME OVERVIEW SECTION */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8 scroll-mt-16"
                id="overview"
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-8 border border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-btb-primary to-blue-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800">
                      <GlobeAltIcon className="h-10 w-10 text-white" />
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">
                    Game Overview
                  </h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center bg-btb-primary/10 dark:bg-btb-primary/20 p-4 rounded-lg mb-6">
                      <div className="w-16 h-16 bg-btb-primary/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mb-4 md:mb-0">
                        <motion.span 
                          className="text-3xl"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >🎮</motion.span>
                      </div>
                      <p className="text-lg font-medium text-center md:text-left">
                        MiMo is an exciting play-to-earn blockchain game where you hunt for rewards while ensuring your assets are well-protected.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="relative">
                        <span className="absolute -top-3 -left-3 w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                        <div className="border-l-4 border-btb-primary pl-4 py-2">
                          <h3 className="text-xl font-bold mb-2">Get Started with BEAR NFTs</h3>
                          <p className="text-gray-700 dark:text-gray-300">
                            Deposit your BEAR NFT to create a <span className="font-semibold">Hunter</span> character with a base power of 10 MiMo. 
                            You'll also receive 1,000,000 MiMo tokens as an initial reward.
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <span className="absolute -top-3 -left-3 w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                        <div className="border-l-4 border-btb-primary pl-4 py-2">
                          <h3 className="text-xl font-bold mb-2">Feed Your Hunter Daily</h3>
                          <p className="text-gray-700 dark:text-gray-300">
                            Feed your Hunter once every day to increase its power by 2%. 
                            Consistent feeding prevents hibernation and maximizes your rewards.
                          </p>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <span className="absolute -top-3 -left-3 w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                        <div className="border-l-4 border-btb-primary pl-4 py-2">
                          <h3 className="text-xl font-bold mb-2">Hunt for MiMo Rewards</h3>
                          <p className="text-gray-700 dark:text-gray-300">
                            Hunt once every 24 hours to earn MiMo tokens based on your Hunter's power. 
                            The longer you feed your Hunter, the more powerful it becomes, and the more rewards you earn.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="relative">
                        <span className="absolute -top-3 -left-3 w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
                        <div className="border-l-4 border-btb-primary pl-4 py-2">
                          <h3 className="text-xl font-bold mb-2">Protect Your Assets</h3>
                          <p className="text-gray-700 dark:text-gray-300">
                            <span className="bg-yellow-100 dark:bg-yellow-900/30 px-1 py-0.5 rounded font-medium">IMPORTANT:</span> Protect your MiMo tokens from being hunted by providing liquidity on Aerodrome with one of these pairs:
                          </p>
                          <ul className="mt-2 space-y-1">
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              <span className="font-medium">MiMo/USDC</span>
                            </li>
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              <span className="font-medium">MiMo/cbBTC</span>
                            </li>
                            <li className="flex items-center">
                              <span className="text-green-500 mr-2">✓</span>
                              <span className="font-medium">MiMo/WETH</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <span className="absolute -top-3 -left-3 w-6 h-6 bg-btb-primary text-white rounded-full flex items-center justify-center text-sm font-bold">5</span>
                        <div className="border-l-4 border-btb-primary pl-4 py-2">
                          <h3 className="text-xl font-bold mb-2">Trade & Earn More</h3>
                          <p className="text-gray-700 dark:text-gray-300">
                            Trade your BEAR NFTs and Hunters on the marketplace. 
                            Redeem MiMo tokens for BEAR NFTs or BTB tokens through the ecosystem's exchange mechanism.
                          </p>
                        </div>
                      </div>
                      
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg mt-6">
                        <h4 className="text-lg font-bold mb-2 flex items-center">
                          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">i</span>
                          Balance Your Strategy
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">
                          You can choose between being a <span className="font-semibold">Hunter</span> (high risk, high reward) 
                          or a <span className="font-semibold">Protector</span> (lower risk, steady income), 
                          or you can implement both strategies with different wallets.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* PLAY TO EARN SECTION */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8 scroll-mt-16"
                id="play-to-earn"
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-8 border border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-green-500 to-btb-primary rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800">
                      <CurrencyDollarIcon className="h-10 w-10 text-white" />
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">
                    Play to Earn
                  </h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center bg-btb-primary/10 dark:bg-btb-primary/20 p-6 rounded-lg">
                      <div className="w-16 h-16 bg-btb-primary/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mb-4 md:mb-0">
                        <motion.span 
                          className="text-3xl"
                          animate={{ scale: [1, 1.1, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >💰</motion.span>
                      </div>
                      <p className="text-lg font-medium text-center md:text-left">
                        MiMo is designed as a true play-to-earn game where your daily activity and strategic decisions
                        directly translate to token rewards and asset growth.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light flex items-center">
                        <CurrencyDollarIcon className="h-6 w-6 mr-2" />
                        Multiple Ways to Earn
                      </h3>
                      
                      <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30 overflow-hidden shadow-sm">
                        <div className="bg-blue-500 text-white p-2 text-center font-bold">
                          Primary Earning Methods
                        </div>
                        <div className="p-5 space-y-5">
                          <div className="flex items-start">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                              <span className="text-xl">🏹</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-lg mb-1">Daily Hunting Rewards</h4>
                              <p className="text-gray-700 dark:text-gray-300">
                                Hunt once every 24 hours to earn MiMo tokens based on your Hunter's power level.
                                Each hunt yields rewards proportional to your Hunter's strength.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                              <span className="text-xl">📈</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-lg mb-1">Hunter Value Growth</h4>
                              <p className="text-gray-700 dark:text-gray-300">
                                Feed your Hunter daily to increase its power by <span className="font-bold text-green-600 dark:text-green-400">2%</span> each day.
                                Higher power Hunters earn more rewards and can be sold for a premium on the marketplace.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-1">
                              <span className="text-xl">💱</span>
                            </div>
                            <div>
                              <h4 className="font-bold text-lg mb-1">Liquidity Provision</h4>
                              <p className="text-gray-700 dark:text-gray-300">
                                Provide liquidity in MiMo pairs on Aerodrome Exchange to protect your assets 
                                and earn trading fees from market activity.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-100 dark:border-purple-800/30 overflow-hidden shadow-sm">
                        <div className="bg-purple-500 text-white p-2 text-center font-bold">
                          Secondary Earning Methods
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="flex items-start">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                              <span className="text-lg">🏪</span>
                            </div>
                            <div>
                              <h4 className="font-bold mb-1">NFT Trading</h4>
                              <p className="text-gray-700 dark:text-gray-300 text-sm">
                                Trade well-maintained Hunters with high power levels for profit on the marketplace.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                              <span className="text-lg">🔄</span>
                            </div>
                            <div>
                              <h4 className="font-bold mb-1">Token Redemption</h4>
                              <p className="text-gray-700 dark:text-gray-300 text-sm">
                                Exchange MiMo tokens for BEAR NFTs or BTB tokens through the ecosystem.
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-start">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                              <span className="text-lg">🔐</span>
                            </div>
                            <div>
                              <h4 className="font-bold mb-1">Staking (Coming Soon)</h4>
                              <p className="text-gray-700 dark:text-gray-300 text-sm">
                                Stake MiMo tokens for additional passive rewards and governance rights.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light flex items-center">
                        <ChartBarIcon className="h-6 w-6 mr-2" />
                        Reward Mechanics
                      </h3>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-bold mb-4 text-center">Hunt Reward Distribution</h4>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-4">
                          <p className="text-center mb-3 font-medium">
                            When you hunt with your Hunter, rewards are distributed as follows:
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-btb-primary/10 dark:bg-btb-primary/20 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-btb-primary">50%</div>
                              <div className="text-sm font-medium mt-1">To Hunter Owner</div>
                            </div>
                            <div className="bg-red-500/10 dark:bg-red-500/20 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-red-500">25%</div>
                              <div className="text-sm font-medium mt-1">Burned</div>
                            </div>
                            <div className="bg-blue-500/10 dark:bg-blue-500/20 rounded-lg p-3 text-center">
                              <div className="text-2xl font-bold text-blue-500">25%</div>
                              <div className="text-sm font-medium mt-1">To Liquidity</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <h4 className="font-bold mb-2">Hunter Power Growth Chart</h4>
                          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                            <div className="h-48 relative mb-2">
                              {/* Simple chart visualization */}
                              <div className="absolute inset-0 flex items-end">
                                <div className="w-1/6 h-[20%] bg-blue-400 dark:bg-blue-600 rounded-t-sm mx-0.5"></div>
                                <div className="w-1/6 h-[35%] bg-blue-400 dark:bg-blue-600 rounded-t-sm mx-0.5"></div>
                                <div className="w-1/6 h-[50%] bg-blue-400 dark:bg-blue-600 rounded-t-sm mx-0.5"></div>
                                <div className="w-1/6 h-[70%] bg-blue-400 dark:bg-blue-600 rounded-t-sm mx-0.5"></div>
                                <div className="w-1/6 h-[85%] bg-blue-400 dark:bg-blue-600 rounded-t-sm mx-0.5"></div>
                                <div className="w-1/6 h-[100%] bg-blue-400 dark:bg-blue-600 rounded-t-sm mx-0.5"></div>
                              </div>
                              <div className="absolute inset-y-0 left-0 flex flex-col justify-between text-xs text-gray-500">
                                <span>100</span>
                                <span>75</span>
                                <span>50</span>
                                <span>25</span>
                                <span>10</span>
                              </div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 px-5">
                              <span>Start</span>
                              <span>30d</span>
                              <span>60d</span>
                              <span>90d</span>
                              <span>120d</span>
                              <span>180d</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* PROTECTION SECTION */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8 scroll-mt-16"
                id="protection"
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-8 border border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800">
                      <ShieldCheckIcon className="h-10 w-10 text-white" />
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">
                    Protection
                  </h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-l-4 border-yellow-500">
                      <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-800/50 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mb-4 md:mb-0">
                        <motion.span 
                          className="text-3xl"
                          animate={{ rotate: [0, 10, 0, -10, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >⚠️</motion.span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold mb-2 text-yellow-800 dark:text-yellow-200">Why Protection Matters</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                          In the MiMo game, unprotected wallets are at risk of having their MiMo tokens hunted by other players.
                          Without protection, you could lose your hard-earned tokens!
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 shadow-sm border border-green-100 dark:border-green-800/30">
                        <h3 className="text-xl font-bold mb-4 flex items-center text-green-700 dark:text-green-300">
                          <ShieldCheckIcon className="h-6 w-6 mr-2" />
                          How to Protect Your MiMo
                        </h3>
                        
                        <div className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-lg mb-4 shadow-sm">
                          <p className="text-lg font-semibold mb-3 text-btb-primary dark:text-btb-primary-light">
                            Add liquidity to one of these pairs on Aerodrome:
                          </p>
                          <ul className="space-y-3">
                            <li className="flex items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                <span className="text-green-500 font-bold">1</span>
                              </div>
                              <span className="font-bold text-gray-800 dark:text-white">MiMo/USDC</span>
                            </li>
                            <li className="flex items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                <span className="text-green-500 font-bold">2</span>
                              </div>
                              <span className="font-bold text-gray-800 dark:text-white">MiMo/cbBTC</span>
                            </li>
                            <li className="flex items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">
                              <div className="w-8 h-8 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                <span className="text-green-500 font-bold">3</span>
                              </div>
                              <span className="font-bold text-gray-800 dark:text-white">MiMo/WETH</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light">How Protection Works</h3>
                        
                        <div className="space-y-4">
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <h4 className="font-bold mb-2 flex items-center">
                              <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">1</span>
                              Automatic Detection
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300">
                              When you provide liquidity to approved pools, your wallet address is automatically 
                              added to the "Protected Addresses" list in the game contract.
                            </p>
                          </div>
                          
                          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                            <h4 className="font-bold mb-2 flex items-center">
                              <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">2</span>
                              Hunting Prevention
                            </h4>
                            <p className="text-gray-700 dark:text-gray-300">
                              Hunters cannot extract MiMo tokens from protected wallets. Every time a 
                              Hunter attempts to hunt, the contract checks if the target address is protected.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* GAME MECHANICS SECTION */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8 pb-10 scroll-mt-16"
                id="mechanics"
              >
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-8 border border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800">
                      <SparklesIcon className="h-10 w-10 text-white" />
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">
                    Game Mechanics
                  </h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center bg-btb-primary/10 dark:bg-btb-primary/20 p-4 rounded-lg mb-6">
                      <div className="w-16 h-16 bg-btb-primary/20 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mb-4 md:mb-0">
                        <motion.span 
                          className="text-3xl"
                          animate={{ rotateY: [0, 360] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        >⚙️</motion.span>
                      </div>
                      <p className="text-lg font-medium text-center md:text-left">
                        The MiMo game is built on a carefully balanced ecosystem that rewards strategy and consistent engagement. Here's how it all works behind the scenes.
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light">Hunter Mechanics</h3>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-bold mb-4">Hunter Power Calculation</h4>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-4">
                          <div className="mb-3">
                            <p className="font-mono font-bold text-center bg-gray-100 dark:bg-gray-800 py-2 rounded">
                              Power = Base Power × (1.02)<sup>Days Fed</sup>
                            </p>
                          </div>
                          <ul className="space-y-2 list-disc pl-5">
                            <li>Base Power: 10 MiMo (starting value)</li>
                            <li>Daily Growth: 2% (compounding)</li>
                            <li>Maximum Hunt Frequency: Once per 24 hours</li>
                            <li>Hibernation: Occurs after 7 days without feeding</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-bold mb-4">Hibernation System</h4>
                        <p className="mb-4">
                          If a Hunter isn't fed for 7 consecutive days, it will enter hibernation mode:
                        </p>
                        <ul className="space-y-2 list-disc pl-5">
                          <li>Cannot hunt while hibernating</li>
                          <li>Requires 3 consecutive days of feeding to wake up</li>
                          <li>10% power penalty applied after waking from hibernation</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <h3 className="text-xl font-bold mb-4 text-btb-primary dark:text-btb-primary-light">Economy Mechanics</h3>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-bold mb-4">Token Economics</h4>
                        <ul className="space-y-3">
                          <li className="flex items-start">
                            <span className="text-green-500 mr-2 mt-0.5">•</span>
                            <div>
                              <span className="font-bold">Initial Distribution:</span>
                              <p className="text-sm">1,000,000 MiMo tokens per BEAR NFT deposit</p>
                            </div>
                          </li>
                          <li className="flex items-start">
                            <span className="text-green-500 mr-2 mt-0.5">•</span>
                            <div>
                              <span className="font-bold">Hunt Rewards:</span>
                              <p className="text-sm">Equal to Hunter's power level in MiMo tokens</p>
                            </div>
                          </li>
                          <li className="flex items-start">
                            <span className="text-green-500 mr-2 mt-0.5">•</span>
                            <div>
                              <span className="font-bold">Burning Mechanism:</span>
                              <p className="text-sm">25% of all hunting rewards are automatically burned</p>
                            </div>
                          </li>
                          <li className="flex items-start">
                            <span className="text-green-500 mr-2 mt-0.5">•</span>
                            <div>
                              <span className="font-bold">Liquidity Growth:</span>
                              <p className="text-sm">25% of hunting rewards go to liquidity pools</p>
                            </div>
                          </li>
                        </ul>
                      </div>
                      
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-bold mb-4">Redemption System</h4>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <p className="mb-3">MiMo tokens can be redeemed for:</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-btb-primary/10 dark:bg-btb-primary/20 p-3 rounded-lg">
                              <h5 className="font-bold text-btb-primary dark:text-btb-primary-light mb-1">BEAR NFTs</h5>
                              <p className="text-sm">1,000,000+ MiMo tokens</p>
                            </div>
                            <div className="bg-btb-primary/10 dark:bg-btb-primary/20 p-3 rounded-lg">
                              <h5 className="font-bold text-btb-primary dark:text-btb-primary-light mb-1">BTB Tokens</h5>
                              <p className="text-sm">Variable rate based on market</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-center">
                      <motion.button
                        onClick={() => setShowGameInterface(true)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-btb-primary text-white px-6 py-3 rounded-lg font-bold tracking-wide flex items-center shadow-md"
                      >
                        Start Playing Now
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Mobile Navigation Button */}
          <div className="md:hidden fixed bottom-6 right-6 z-20">
            <button 
              onClick={() => setShowMobileNav(!showMobileNav)}
              className="bg-btb-primary text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* Mobile Navigation Popup */}
          {showMobileNav && (
            <div className="md:hidden fixed inset-0 z-10 flex items-center justify-center">
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowMobileNav(false)}
              ></div>
              <div className="relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl w-4/5 max-w-sm">
                <div className="absolute top-3 right-3">
                  <button 
                    onClick={() => setShowMobileNav(false)} 
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <h3 className="text-lg font-bold mb-4 text-center text-btb-primary dark:text-btb-primary-light">
                  Jump To Section
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <a 
                    href="#overview" 
                    className="flex flex-col items-center p-3 rounded-lg bg-btb-primary/10 hover:bg-btb-primary/20 transition-colors"
                    onClick={() => setShowMobileNav(false)}
                  >
                    <GlobeAltIcon className="h-6 w-6 mb-1 text-btb-primary" />
                    <span className="text-sm font-semibold">Overview</span>
                  </a>
                  <a 
                    href="#play-to-earn" 
                    className="flex flex-col items-center p-3 rounded-lg bg-btb-primary/10 hover:bg-btb-primary/20 transition-colors"
                    onClick={() => setShowMobileNav(false)}
                  >
                    <CurrencyDollarIcon className="h-6 w-6 mb-1 text-btb-primary" />
                    <span className="text-sm font-semibold">Earn</span>
                  </a>
                  <a 
                    href="#protection" 
                    className="flex flex-col items-center p-3 rounded-lg bg-btb-primary/10 hover:bg-btb-primary/20 transition-colors"
                    onClick={() => setShowMobileNav(false)}
                  >
                    <ShieldCheckIcon className="h-6 w-6 mb-1 text-btb-primary" />
                    <span className="text-sm font-semibold">Protection</span>
                  </a>
                  <a 
                    href="#mechanics" 
                    className="flex flex-col items-center p-3 rounded-lg bg-btb-primary/10 hover:bg-btb-primary/20 transition-colors"
                    onClick={() => setShowMobileNav(false)}
                  >
                    <SparklesIcon className="h-6 w-6 mb-1 text-btb-primary" />
                    <span className="text-sm font-semibold">Mechanics</span>
                  </a>
                </div>
                
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      setShowGameInterface(true);
                      setShowMobileNav(false);
                    }}
                    className="w-full bg-btb-primary hover:bg-blue-600 text-white py-3 rounded-lg font-bold transition-colors"
                  >
                    Launch Game
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}