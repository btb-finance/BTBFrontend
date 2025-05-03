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

export default function GamePage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="relative isolate">
      {/* Hero section */}
      <div className="relative min-h-[50vh] flex flex-col justify-center overflow-hidden">
        {/* Fun dotted background pattern */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-cyan-400 to-blue-500 dark:from-purple-900 dark:via-cyan-800 dark:to-blue-900"></div>
          <div className="absolute inset-0">
            {[...Array(100)].map((_, i) => (
              <motion.div 
                key={i}
                className="absolute rounded-full bg-btb-primary-light/30 dark:bg-btb-primary-light/20"
                style={{
                  width: Math.random() * 10 + 3 + 'px',
                  height: Math.random() * 10 + 3 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.3, 0.8, 0.3],
                }}
                transition={{
                  duration: Math.random() * 5 + 3,
                  repeat: Infinity,
                  delay: Math.random() * 5,
                }}
              />
            ))}
          </div>
        </div>
        
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 md:py-20 flex flex-col justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl font-bold mb-6 relative">
              <span className="relative inline-block">
                <span className="absolute left-0 top-0 w-full h-full flex flex-wrap justify-center items-center opacity-30">
                  {[...Array(30)].map((_, i) => (
                    <motion.span 
                      key={i}
                      className="inline-block rounded-full bg-btb-primary w-1.5 h-1.5 mx-[2px] my-[4px]"
                      animate={{
                        opacity: [0.5, 1, 0.5],
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: i * 0.05,
                      }}
                    />
                  ))}
                </span>
                <span className="relative text-white dark:text-white font-bold drop-shadow-md">
                  MiMo Game
                </span>
              </span>
            </h1>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mb-2"
            >
              <span className="text-lg font-bold tracking-widest relative text-white dark:text-white bg-btb-primary/80 px-3 py-1 rounded-md shadow-md">
                <span className="absolute top-0 left-0 right-0 flex justify-between px-1.5">
                  {[...Array(12)].map((_, i) => (
                    <motion.span 
                      key={i}
                      className="inline-block h-[2px] w-[2px] rounded-full bg-white"
                      animate={{
                        opacity: [0.3, 0.8, 0.3],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </span>
                PLAY TO EARN
              </span>
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.2 }}
              className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 max-w-3xl mx-auto mb-4 sm:mb-6 tracking-wide bg-white/70 dark:bg-gray-800/70 px-4 py-2 rounded-lg shadow-sm"
            >
              Hunt, earn, and build your digital ecosystem with MiMo - 
              where strategy meets reward in an engaging blockchain experience
            </motion.p>
            
            {/* Coming Soon Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.5 }}
              className="max-w-3xl mx-auto mb-6 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/50 rounded-lg shadow-sm px-4 py-3"
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mr-2 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">
                  Coming Soon! The MiMo game is not live yet. All examples and calculations below are initial information to help you understand how the game will work.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm py-4 sm:py-6 border-y border-btb-primary/10">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-5">
            {[
              { id: 'overview', label: 'OVERVIEW', fullLabel: 'GAME OVERVIEW' },
              { id: 'play-to-earn', label: 'EARN', fullLabel: 'PLAY TO EARN' },
              { id: 'protection', label: 'PROTECT', fullLabel: 'PROTECTION' },
              { id: 'mechanics', label: 'MECHANICS', fullLabel: 'GAME MECHANICS' }
            ].map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-full font-bold transition-all duration-300 text-xs sm:text-sm ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-btb-primary-dark to-btb-primary text-white shadow-md' 
                    : 'bg-white/90 dark:bg-gray-800/90 text-gray-800 dark:text-white hover:bg-white dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative tracking-wide">
                  {activeTab === tab.id && (
                    <div className="absolute -top-1 left-0 right-0 flex justify-between px-1.5">
                      {[...Array(Math.ceil(tab.label.length/2))].map((_, i) => (
                        <motion.span 
                          key={i}
                          className="inline-block h-[2px] w-[2px] rounded-full bg-white"
                          animate={{
                            opacity: [0.3, 0.8, 0.3],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <span className="block sm:hidden">{tab.label}</span>
                  <span className="hidden sm:block">{tab.fullLabel}</span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Sections */}
      <div className="container mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-100 dark:border-gray-700">
              <h2 className="text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">How MiMo Game Works</h2>
              
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
              
              <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-4 text-center">Getting Started Is Easy</h3>
                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-btb-primary text-white px-6 py-3 rounded-lg font-bold tracking-wide flex items-center shadow-md"
                  >
                    Start Your MiMo Adventure
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Play-to-Earn Tab */}
        {activeTab === 'play-to-earn' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-100 dark:border-gray-700">
              <h2 className="text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">Earn While You Play</h2>
              
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
                    
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <h4 className="font-bold mb-2">Earnings Potential</h4>
                      
                      <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg mb-3 border-l-4 border-green-500">
                        <div className="flex items-start">
                          <span className="font-bold text-green-600 dark:text-green-400 text-xl mr-2">1,000,000+</span>
                          <div>
                            <p className="font-bold">MiMo Tokens on Day One</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Initial allocation when creating a Hunter</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="font-medium mb-2">Daily Hunt Power Growth:</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Starting Power:</span>
                            <span className="font-bold text-btb-primary">10 MiMo per day</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">After 30 days:</span>
                            <span className="font-bold text-btb-primary">~18 MiMo per day</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">After 90 days:</span>
                            <span className="font-bold text-btb-primary">~60 MiMo per day</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">After 180 days:</span>
                            <span className="font-bold text-btb-primary">~360 MiMo per day</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">Additional Earning Opportunities:</p>
                        <ul className="space-y-1 text-sm">
                          <li className="flex items-center">
                            <span className="text-green-500 mr-1">✓</span>
                            <span>Trading fees from liquidity provision</span>
                          </li>
                          <li className="flex items-center">
                            <span className="text-green-500 mr-1">✓</span>
                            <span>Selling high-power Hunters on marketplace</span>
                          </li>
                          <li className="flex items-center">
                            <span className="text-green-500 mr-1">✓</span>
                            <span>Redemption of BEAR NFTs (1M+ MiMo per NFT)</span>
                          </li>
                        </ul>
                      </div>
                      
                      <div className="mt-3 text-xs text-gray-500 italic">
                        *Daily growth requires consistent feeding to maintain power increases
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-5 rounded-lg border-l-4 border-yellow-500">
                    <h4 className="font-bold flex items-center">
                      <span className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm mr-2">⚠️</span>
                      Important Reminder
                    </h4>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">
                      Remember to <span className="font-bold">feed your Hunter daily</span> and <span className="font-bold">protect your MiMo tokens</span> by providing liquidity on Aerodrome to maximize your earnings potential.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold mb-6 text-center text-btb-primary dark:text-btb-primary-light">Game Examples & Strategies</h3>
                
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-4 sm:p-6 border border-purple-100 dark:border-purple-800/30 shadow-md mb-8">
                  <h4 className="text-lg font-bold mb-4 text-center">A Day in the MiMo Game</h4>
                  
                  {/* Caption with disclaimer */}
                  <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800/30 text-center">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <span className="font-semibold">Note:</span> These are example player profiles to help illustrate possible gameplay strategies
                    </p>
                  </div>
                  
                  {/* Player cards - scrollable on mobile */}
                  <div className="flex overflow-x-auto pb-2 gap-4 md:grid md:grid-cols-3 md:gap-6 snap-x">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm relative overflow-hidden min-w-[280px] flex-shrink-0 snap-center md:min-w-0">
                      <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                      <div className="flex items-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                          <span className="text-lg sm:text-xl">🧙‍♂️</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-sm sm:text-base">Player: Alice</h5>
                          <p className="text-xs text-gray-500 mb-2">60-day-old Hunter</p>
                          
                          <div className="space-y-1 mt-2 sm:mt-3">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Hunter Power:</span>
                              <span className="font-semibold">32.8 MiMo/day</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Today's Hunt:</span>
                              <span className="font-semibold text-green-600">+16.4 MiMo</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>LP Rewards:</span>
                              <span className="font-semibold text-purple-600">+2.5 MiMo</span>
                            </div>
                            <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-1"></div>
                            <div className="flex justify-between text-xs sm:text-sm font-medium">
                              <span>Total MiMo:</span>
                              <span className="text-btb-primary">1,242,819 MiMo</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 sm:mt-3 text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded text-green-700 dark:text-green-300">
                            Alice provides liquidity with MiMo/USDC for protection
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm relative overflow-hidden min-w-[280px] flex-shrink-0 snap-center md:min-w-0">
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                      <div className="flex items-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                          <span className="text-lg sm:text-xl">🛡️</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-sm sm:text-base">Player: Bob</h5>
                          <p className="text-xs text-gray-500 mb-2">120-day-old Hunter</p>
                          
                          <div className="space-y-1 mt-2 sm:mt-3">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Hunter Power:</span>
                              <span className="font-semibold">108.2 MiMo/day</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Today's Hunt:</span>
                              <span className="font-semibold text-green-600">+54.1 MiMo</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Marketplace Sale:</span>
                              <span className="font-semibold text-blue-600">+50,000 MiMo</span>
                            </div>
                            <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-1"></div>
                            <div className="flex justify-between text-xs sm:text-sm font-medium">
                              <span>Total MiMo:</span>
                              <span className="text-btb-primary">1,389,472 MiMo</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 sm:mt-3 text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-blue-700 dark:text-blue-300">
                            Bob sold a second Hunter NFT on the marketplace
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm relative overflow-hidden min-w-[280px] flex-shrink-0 snap-center md:min-w-0">
                      <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                      <div className="flex items-start">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                          <span className="text-lg sm:text-xl">🌟</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-bold text-sm sm:text-base">Player: Charlie</h5>
                          <p className="text-xs text-gray-500 mb-2">180-day-old Hunter</p>
                          
                          <div className="space-y-1 mt-2 sm:mt-3">
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Hunter Power:</span>
                              <span className="font-semibold">362.1 MiMo/day</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Today's Hunt:</span>
                              <span className="font-semibold text-green-600">+181.0 MiMo</span>
                            </div>
                            <div className="flex justify-between text-xs sm:text-sm">
                              <span>Redeemed BEAR NFT:</span>
                              <span className="font-semibold text-purple-600">-1,100,000 MiMo</span>
                            </div>
                            <div className="h-px w-full bg-gray-200 dark:bg-gray-700 my-1"></div>
                            <div className="flex justify-between text-xs sm:text-sm font-medium">
                              <span>Total MiMo:</span>
                              <span className="text-btb-primary">456,902 MiMo</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 sm:mt-3 text-xs bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-purple-700 dark:text-purple-300">
                            Charlie redeemed MiMo for a BEAR NFT
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mobile scroll indicator */}
                  <div className="flex justify-center mt-2 mb-4 md:hidden">
                    <div className="space-x-1">
                      {[0, 1, 2].map((index) => (
                        <span key={index} className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 sm:mt-6 bg-white/50 dark:bg-gray-800/50 p-3 sm:p-4 rounded-lg">
                    <div className="flex items-start">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center flex-shrink-0 mr-2 sm:mr-3">
                        <span className="text-yellow-600">💡</span>
                      </div>
                      <div>
                        <h5 className="font-bold mb-1 text-sm sm:text-base">Game Strategy Insights:</h5>
                        <ul className="space-y-1 text-xs sm:text-sm">
                          <li className="flex items-start">
                            <span className="text-green-500 mr-1">•</span>
                            <span><span className="font-medium">Alice</span> is building steady growth while protected by LP position</span>
                          </li>
                          <li className="flex items-start">
                            <span className="text-green-500 mr-1">•</span>
                            <span><span className="font-medium">Bob</span> strategically sold a high-power Hunter to another player for profit</span>
                          </li>
                          <li className="flex items-start">
                            <span className="text-green-500 mr-1">•</span>
                            <span><span className="font-medium">Charlie</span> completed the ecosystem cycle by redeeming MiMo for a BEAR NFT</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-btb-primary text-white px-6 py-3 rounded-lg font-bold tracking-wide flex items-center shadow-md"
                  >
                    Launch Game
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Protection Tab */}
        {activeTab === 'protection' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-100 dark:border-gray-700">
              <h2 className="text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">Shield Your MiMo Assets</h2>
              
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
                    
                    <div className="bg-green-500/10 rounded-lg p-4 mb-6">
                      <h4 className="text-lg font-bold mb-2 text-green-700 dark:text-green-300">Benefits of Protection</h4>
                      <ul className="space-y-2">
                        <li className="flex items-start">
                          <span className="text-green-500 mr-2 mt-1">✓</span>
                          <span>Your MiMo tokens <span className="font-bold">cannot be hunted</span> by other players</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-500 mr-2 mt-1">✓</span>
                          <span>Earn <span className="font-bold">trading fees</span> from your liquidity position</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-500 mr-2 mt-1">✓</span>
                          <span><span className="font-bold">Permanent protection</span> as long as you maintain your LP position</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-500 mr-2 mt-1">✓</span>
                          <span>Help create a <span className="font-bold">stable ecosystem</span> for all players</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-500/10 rounded-lg p-6">
                    <h4 className="text-lg font-bold mb-3">Step-by-Step Protection Guide</h4>
                    <ol className="space-y-4">
                      <li className="flex items-start">
                        <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">1</div>
                        <div>
                          <p className="font-bold">Visit Aerodrome Exchange</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Go to the Aerodrome DEX to provide liquidity</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">2</div>
                        <div>
                          <p className="font-bold">Connect Your Wallet</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Make sure it contains the MiMo tokens you want to protect</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">3</div>
                        <div>
                          <p className="font-bold">Add Liquidity to a MiMo Pair</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Choose one of the approved pairs (USDC, cbBTC, or WETH)</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3 mt-0.5 flex-shrink-0">4</div>
                        <div>
                          <p className="font-bold">Maintain Your Position</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Keep your LP position to retain protection status</p>
                        </div>
                      </li>
                    </ol>
                    <div className="mt-6 flex justify-center">
                      <Link 
                        href="https://aerodrome.finance/" 
                        target="_blank" 
                        className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg font-bold hover:shadow-lg transition-all duration-300"
                      >
                        Visit Aerodrome Exchange <ArrowRightIcon className="h-4 w-4 ml-2" />
                      </Link>
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
                      
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h4 className="font-bold mb-2 flex items-center">
                          <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">3</span>
                          Real-Time Verification
                        </h4>
                        <p className="text-gray-700 dark:text-gray-300">
                          The <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">hunt()</code> function checks the
                          <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">protectedAddresses</code> mapping on the blockchain
                          in real-time before each hunt attempt.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6 shadow-sm border border-purple-100 dark:border-purple-800/30">
                    <h3 className="text-xl font-bold mb-4 text-purple-700 dark:text-purple-300">Choose Your Strategy</h3>
                    
                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg shadow-sm">
                        <div className="flex items-center mb-2">
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-xl">🏹</span>
                          </div>
                          <h4 className="text-lg font-bold text-red-600 dark:text-red-400">Hunter Strategy</h4>
                        </div>
                        <div className="ml-13">
                          <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Create and grow Hunters to hunt MiMo tokens from unprotected addresses.
                          </p>
                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-gray-500">Risk Level:</span>
                            <span className="font-bold text-red-500">HIGH</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Reward Potential:</span>
                            <span className="font-bold text-green-500">HIGH</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg shadow-sm">
                        <div className="flex items-center mb-2">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-xl">🛡️</span>
                          </div>
                          <h4 className="text-lg font-bold text-blue-600 dark:text-blue-400">Protection Strategy</h4>
                        </div>
                        <div className="ml-13">
                          <p className="text-gray-700 dark:text-gray-300 mb-2">
                            Provide liquidity to protect your tokens and earn trading fees.
                          </p>
                          <div className="flex justify-between text-sm mt-2">
                            <span className="text-gray-500">Risk Level:</span>
                            <span className="font-bold text-green-500">LOW</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Reward Potential:</span>
                            <span className="font-bold text-yellow-500">MODERATE</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-lg">
                      <h4 className="font-bold mb-2 flex items-center">
                        <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm mr-2">💡</span>
                        Pro Tip
                      </h4>
                      <p className="text-gray-700 dark:text-gray-300">
                        For the best of both worlds, use <span className="font-bold">different wallets</span> for hunting and protection.
                        This balanced approach maximizes your earnings while keeping your main assets secure.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Game Mechanics Tab */}
        {activeTab === 'mechanics' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 border border-gray-100 dark:border-gray-700">
              <h2 className="text-3xl font-bold mb-6 text-btb-primary dark:text-btb-primary-light text-center">Detailed Game Mechanics</h2>
              
              <div className="mb-8">
                <div className="flex flex-col items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg">
                  <div className="w-20 h-20 bg-blue-100 dark:bg-blue-800/50 rounded-full flex items-center justify-center mb-4">
                    <motion.span 
                      className="text-4xl"
                      animate={{ rotate: [0, 5, 0, -5, 0] }}
                      transition={{ duration: 5, repeat: Infinity }}
                    >⚙️</motion.span>
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-center">How MiMo Game Works</h3>
                  <p className="text-center text-gray-700 dark:text-gray-300 max-w-2xl">
                    Understanding the game mechanics will help you optimize your strategy
                    and maximize your earnings while protecting your assets.
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                    <h3 className="text-xl font-bold mb-4 text-purple-700 dark:text-purple-300 flex items-center">
                      <span className="w-8 h-8 bg-purple-100 dark:bg-purple-800/50 rounded-full flex items-center justify-center mr-2 text-purple-600 dark:text-purple-300">🏹</span>
                      Hunter Lifecycle
                    </h3>
                    
                    <div className="relative p-4 bg-white/80 dark:bg-gray-800/80 rounded-lg mb-5">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-t-lg"></div>
                      <h4 className="text-lg font-bold mb-3 text-btb-primary">Creation & Lifecycle</h4>
                      
                      <div className="space-y-4">
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">1</div>
                          <div>
                            <h5 className="font-bold">Creation</h5>
                            <p className="text-gray-700 dark:text-gray-300">
                              Deposit a BEAR NFT to create a Hunter with base power of 10 MiMo.
                              You'll receive 1,000,000 initial MiMo tokens.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">2</div>
                          <div>
                            <h5 className="font-bold">Daily Feeding</h5>
                            <p className="text-gray-700 dark:text-gray-300">
                              Feed your Hunter every day to increase power by 2% and prevent hibernation.
                              Missing feedings will lead to hibernation.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">3</div>
                          <div>
                            <h5 className="font-bold">Daily Hunting</h5>
                            <p className="text-gray-700 dark:text-gray-300">
                              Hunt once every 24 hours to earn MiMo tokens based on your Hunter's power.
                              You cannot hunt from protected addresses.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="relative p-4 bg-white/80 dark:bg-gray-800/80 rounded-lg">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-400 to-red-400 rounded-t-lg"></div>
                      <h4 className="text-lg font-bold mb-3 text-yellow-600 dark:text-yellow-400">Hibernation & Recovery</h4>
                      
                      <div className="space-y-4">
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">4</div>
                          <div>
                            <h5 className="font-bold">Hibernation</h5>
                            <p className="text-gray-700 dark:text-gray-300">
                              Miss 7 consecutive feedings and your Hunter hibernates, reducing power by 30%.
                              Hibernating Hunters cannot hunt or be transferred.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">5</div>
                          <div>
                            <h5 className="font-bold">Recovery</h5>
                            <p className="text-gray-700 dark:text-gray-300">
                              Feed a hibernating Hunter to start the 24-hour recovery process.
                              The Hunter cannot hunt during recovery.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full flex items-center justify-center mr-3 flex-shrink-0 font-bold">6</div>
                          <div>
                            <h5 className="font-bold">Expiration</h5>
                            <p className="text-gray-700 dark:text-gray-300">
                              Hunters have a 365-day lifespan from creation. After this period,
                              they can no longer hunt or grow.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700">
                    <h3 className="text-xl font-bold mb-4 flex items-center text-btb-primary">
                      <span className="w-8 h-8 bg-btb-primary/10 rounded-full flex items-center justify-center mr-2">⏱️</span>
                      Key Timers & Thresholds
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-blue-500 font-bold">24h</span>
                          </div>
                          <div>
                            <h4 className="font-bold">Feeding Interval</h4>
                            <p className="text-xs text-gray-500">Once per day</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-green-500 font-bold">24h</span>
                          </div>
                          <div>
                            <h4 className="font-bold">Hunting Cooldown</h4>
                            <p className="text-xs text-gray-500">Once per day</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-yellow-500 font-bold">7</span>
                          </div>
                          <div>
                            <h4 className="font-bold">Hibernation Threshold</h4>
                            <p className="text-xs text-gray-500">Missed feedings</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-purple-500 font-bold">24h</span>
                          </div>
                          <div>
                            <h4 className="font-bold">Recovery Period</h4>
                            <p className="text-xs text-gray-500">After hibernation</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-red-500 font-bold">365d</span>
                          </div>
                          <div>
                            <h4 className="font-bold">Hunter Lifespan</h4>
                            <p className="text-xs text-gray-500">From creation</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-pink-500 font-bold">30%</span>
                          </div>
                          <div>
                            <h4 className="font-bold">Hibernation Penalty</h4>
                            <p className="text-xs text-gray-500">Power reduction</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-green-100 dark:border-green-800/30 shadow-sm">
                    <h3 className="text-xl font-bold mb-4 text-green-700 dark:text-green-300 flex items-center">
                      <span className="w-8 h-8 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center mr-2 text-green-600 dark:text-green-300">💰</span>
                      MiMo Token Economy
                    </h3>
                    
                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-5 mb-4">
                      <h4 className="text-lg font-bold mb-3 text-btb-primary">Token Distribution</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xl">🎁</span>
                            </div>
                            <span className="font-bold">Initial Reward</span>
                          </div>
                          <span className="font-bold text-green-600">1,000,000 MiMo</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xl">🔄</span>
                            </div>
                            <span className="font-bold">Redemption Cost</span>
                          </div>
                          <span className="font-bold text-purple-600">1,000,000 MiMo + 10% fee</span>
                        </div>
                        
                        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mr-2">
                              <span className="text-xl">🔥</span>
                            </div>
                            <span className="font-bold">Burning Mechanism</span>
                          </div>
                          <span className="font-bold text-red-600">25% of hunt rewards</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-5">
                      <h4 className="text-lg font-bold mb-3 text-btb-primary">Token Utility</h4>
                      
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-sm">01</span>
                          </div>
                          <div>
                            <h5 className="font-bold">Hunting & Rewards</h5>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Earned through daily hunting with your Hunter character
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-sm">02</span>
                          </div>
                          <div>
                            <h5 className="font-bold">Trading & Marketplace</h5>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Buy and sell MiMo tokens on exchanges for other cryptocurrencies
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-sm">03</span>
                          </div>
                          <div>
                            <h5 className="font-bold">BEAR NFT Redemption</h5>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Exchange MiMo tokens back for BEAR NFTs in the ecosystem
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start">
                          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/30 text-teal-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-sm">04</span>
                          </div>
                          <div>
                            <h5 className="font-bold">Liquidity Provision</h5>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Provide liquidity to MiMo pairs on Aerodrome for protection
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-lg border-l-4 border-red-500">
                    <h4 className="font-bold flex items-center mb-2 text-red-700 dark:text-red-300">
                      <span className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm mr-2">!</span>
                      Important Game Rules
                    </h4>
                    
                    <ul className="space-y-3">
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2 mt-1">•</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          <span className="font-bold">Daily Feeding Required:</span> Missing 7 consecutive feedings will put your Hunter into hibernation, reducing its power by 30%.
                        </p>
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2 mt-1">•</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          <span className="font-bold">Cannot Hunt Protected Addresses:</span> Hunters cannot hunt MiMo tokens from addresses that have LP positions with MiMo/USDC, MiMo/cbBTC, or MiMo/WETH on Aerodrome.
                        </p>
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2 mt-1">•</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          <span className="font-bold">Limited Lifespan:</span> Hunters expire after 365 days and can no longer hunt or grow in power after this period.
                        </p>
                      </li>
                      <li className="flex items-start">
                        <span className="text-red-500 mr-2 mt-1">•</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          <span className="font-bold">Hibernating Hunters:</span> Cannot be traded or transferred until they recover through feeding and completing the 24-hour recovery period.
                        </p>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="font-bold flex items-center mb-3 text-blue-700 dark:text-blue-300">
                      <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2">💡</span>
                      Pro Tips
                    </h4>
                    
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          Set daily reminders to feed your Hunter and maximize its power growth
                        </p>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          Consider using two wallets: one for hunting and one for holding protected MiMo
                        </p>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          Hunt early in your Hunter's lifecycle to earn more before its 365-day expiration
                        </p>
                      </li>
                      <li className="flex items-start">
                        <span className="text-blue-500 mr-2">✓</span>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          Consider providing liquidity with a portion of your MiMo to earn fees while protecting your assets
                        </p>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="mb-4 md:mb-0">
                    <h3 className="text-xl font-bold">Ready to start playing?</h3>
                    <p className="text-gray-600 dark:text-gray-400">Join the MiMo ecosystem today!</p>
                  </div>
                  
                  <div className="flex gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="bg-btb-primary text-white px-5 py-2 rounded-lg font-bold tracking-wide flex items-center shadow-md"
                    >
                      Launch Game
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="border border-btb-primary text-btb-primary px-5 py-2 rounded-lg font-bold tracking-wide flex items-center"
                    >
                      Learn More
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Call to Action */}
      <div className="container mx-auto px-4 py-10 sm:py-16">
        <motion.div 
          className="relative overflow-hidden rounded-2xl shadow-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          {/* Background with animated dots */}
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 via-btb-primary/20 to-blue-400/20 dark:from-purple-900/30 dark:via-btb-primary/30 dark:to-blue-900/30"></div>
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-btb-primary/30 dark:bg-btb-primary-light/20"
                style={{
                  width: Math.random() * 6 + 2 + 'px',
                  height: Math.random() * 6 + 2 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                }}
                animate={{
                  y: [0, Math.random() * 20 - 10],
                  x: [0, Math.random() * 20 - 10],
                  opacity: [0.3, 0.7, 0.3],
                }}
                transition={{
                  duration: Math.random() * 5 + 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                }}
              />
            ))}
          </div>
          
          {/* Content */}
          <div className="relative z-10 p-6 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              <span className="relative">
                <span className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-12 h-2 flex justify-center">
                  {[...Array(5)].map((_, i) => (
                    <motion.span 
                      key={i}
                      className="inline-block rounded-full bg-btb-primary w-1.5 h-1.5 mx-0.5"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </span>
                <span className="tracking-wide">READY FOR THE MIMO EXPERIENCE?</span>
              </span>
            </h2>
            <p className="mb-4 max-w-2xl mx-auto text-base sm:text-lg tracking-wide">
              Stay updated on the MiMo ecosystem. Hunt for rewards, protect your assets,
              and prepare to become part of our thriving play-to-earn community.
            </p>
            
            {/* Coming Soon Badge */}
            <div className="mb-6 inline-block bg-yellow-100 dark:bg-yellow-900/40 px-4 py-2 rounded-full text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 font-semibold border border-yellow-200 dark:border-yellow-800/50">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coming Soon - Join Our Waitlist
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link 
                  href="#" 
                  className="inline-flex items-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-btb-primary-dark to-btb-primary text-white rounded-full font-medium transition-all duration-300 shadow-md shadow-btb-primary/20 text-sm sm:text-base"
                >
                  <span className="relative tracking-widest">
                    <span className="absolute -top-1 left-0 right-0 flex justify-between px-1">
                      {[...Array(7)].map((_, i) => (
                        <motion.span 
                          key={i}
                          className="inline-block h-[2px] w-[2px] rounded-full bg-white"
                          animate={{
                            opacity: [0.3, 0.8, 0.3],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                        />
                      ))}
                    </span>
                    JOIN WAITLIST
                  </span>
                </Link>
              </motion.div>
              
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link 
                  href="#" 
                  className="inline-flex items-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 bg-white/80 dark:bg-gray-800/50 text-btb-primary dark:text-btb-primary-light rounded-full font-medium border border-btb-primary/20 dark:border-btb-primary/30 hover:bg-white dark:hover:bg-gray-800/80 transition-all duration-300 shadow-md text-sm sm:text-base"
                >
                  <span className="relative tracking-widest">
                    <span className="absolute -top-1 left-0 right-0 flex justify-between px-1">
                      {[...Array(5)].map((_, i) => (
                        <motion.span 
                          key={i}
                          className="inline-block h-[2px] w-[2px] rounded-full bg-btb-primary"
                          animate={{
                            opacity: [0.3, 0.8, 0.3],
                          }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            delay: i * 0.1,
                          }}
                        />
                      ))}
                    </span>
                    LEARN MORE
                  </span>
                </Link>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}