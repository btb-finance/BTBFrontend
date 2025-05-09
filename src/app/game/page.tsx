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
          <div className="relative min-h-[80vh] flex flex-col justify-center overflow-hidden">
            {/* Modern background with mesh gradient */}
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 dark:from-blue-900 dark:via-indigo-950 dark:to-purple-950"></div>
              
              {/* Animated particles */}
              <div className="absolute inset-0">
                {[...Array(60)].map((_, i) => (
                  <motion.div 
                    key={i}
                    className="absolute rounded-full bg-white/40"
                    style={{
                      width: Math.random() * 8 + 2 + 'px',
                      height: Math.random() * 8 + 2 + 'px',
                      left: Math.random() * 100 + '%',
                      top: Math.random() * 100 + '%',
                    }}
                    animate={{
                      y: [0, Math.random() * -40 - 10, 0],
                      x: [0, Math.random() * 20 - 10, 0],
                      opacity: [0.2, 0.8, 0.2],
                    }}
                    transition={{
                      duration: Math.random() * 5 + 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
              
              {/* Subtle grid pattern */}
              <div className="absolute inset-0 opacity-10">
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
            </div>
            
            {/* Hero Content */}
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 flex flex-col justify-center relative z-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-center"
              >
                {/* Game Logo Container */}
                <div className="mb-8 inline-block">
                  <div className="relative h-28 w-28 sm:h-36 sm:w-36 mx-auto bg-gradient-to-br from-white to-blue-100 dark:from-gray-900 dark:to-blue-950 rounded-full shadow-2xl flex items-center justify-center border-4 border-btb-primary">
                    <span className="text-5xl sm:text-6xl">🎮</span>
                    <motion.div 
                      className="absolute -inset-3 rounded-full border-2 border-white/50"
                      animate={{ 
                        scale: [1, 1.15, 1],
                        opacity: [0.7, 0.2, 0.7]
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    ></motion.div>
                    <motion.div 
                      className="absolute -inset-5 rounded-full border border-white/30"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 0.1, 0.5]
                      }}
                      transition={{
                        duration: 4,
                        delay: 0.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    ></motion.div>
                  </div>
                </div>
                
                {/* Title and Subtitle */}
                <div className="bg-black/40 backdrop-blur-md rounded-2xl p-8 sm:p-10 shadow-2xl max-w-3xl mx-auto border border-white/20">
                  <motion.h1 
                    className="text-5xl sm:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                  >
                    MiMo Game
                  </motion.h1>
                  
                  <motion.div 
                    className="mb-6 relative"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.4 }}
                  >
                    <span className="relative inline-block text-xl sm:text-2xl font-bold tracking-widest text-white px-6 py-2">
                      <span className="absolute inset-0 bg-gradient-to-r from-btb-primary to-blue-600 opacity-80 rounded-md -skew-x-6 shadow-lg"></span>
                      <span className="relative">PLAY TO EARN</span>
                    </span>
                  </motion.div>
                  
                  <motion.p 
                    className="text-lg sm:text-xl font-medium text-white mx-auto mb-8 tracking-wide leading-relaxed max-w-2xl"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1, delay: 0.6 }}
                  >
                    Hunt, earn, and build your digital ecosystem with MiMo — 
                    where strategy meets reward in an engaging blockchain experience
                  </motion.p>
                  
                  {/* Testnet Notice */}
                  <motion.div 
                    className="bg-gradient-to-r from-yellow-400/80 to-amber-500/80 text-black dark:text-white px-5 py-3 rounded-lg mb-8 max-w-lg mx-auto shadow-lg"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                  >
                    <p className="text-sm font-medium flex items-center justify-center gap-2">
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Currently running on testnet. Game design may have small changes on mainnet.
                    </p>
                  </motion.div>
                  
                  {/* Launch Game Button */}
                  <div className="relative mx-auto">
                    {/* Animated background particles for the button */}
                    <div className="absolute -inset-4 rounded-full opacity-75 pointer-events-none">
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute rounded-full bg-btb-primary/30"
                          style={{
                            width: Math.random() * 8 + 4 + 'px',
                            height: Math.random() * 8 + 4 + 'px',
                            left: `calc(50% + ${Math.random() * 100 - 50}px)`,
                            top: `calc(50% + ${Math.random() * 60 - 30}px)`,
                          }}
                          animate={{
                            scale: [1, 1.5, 1],
                            opacity: [0.3, 0.7, 0.3],
                            x: [0, Math.random() * 20 - 10, 0],
                            y: [0, Math.random() * 20 - 10, 0],
                          }}
                          transition={{
                            duration: Math.random() * 2 + 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: Math.random(),
                          }}
                        />
                      ))}
                    </div>
                    
                    {/* Energy ring effect */}
                    <motion.div 
                      className="absolute -inset-3 rounded-full border-2 border-blue-400/20 pointer-events-none"
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.4, 0.7, 0.4],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    ></motion.div>
                    
                    <motion.button
                      onClick={() => setShowGameInterface(true)}
                      whileHover={{ 
                        scale: 1.05, 
                        boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.7)", 
                        background: "linear-gradient(90deg, #3B82F6, #4F46E5, #3B82F6)"
                      }}
                      whileTap={{ 
                        scale: 0.95, 
                        boxShadow: "0 5px 15px -3px rgba(59, 130, 246, 0.5)" 
                      }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 1 }}
                      className="relative px-10 py-5 bg-gradient-to-r from-btb-primary to-blue-600 text-white font-bold text-xl rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center mx-auto overflow-hidden group z-10"
                    >
                      {/* Shine effect */}
                      <motion.div
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 pointer-events-none"
                        animate={{ x: ["0%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear", repeatDelay: 1 }}
                      ></motion.div>
                      
                      {/* Button content */}
                      <span className="mr-2 z-10">Launch Game</span>
                      
                      {/* Animated arrow */}
                      <motion.div
                        className="relative z-10"
                        animate={{ 
                          x: [0, 5, 0],
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.5, 
                          ease: "easeInOut",
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </motion.div>
                    </motion.button>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="mt-10 flex flex-wrap gap-4 justify-center">
                  <motion.a
                    href="#overview"
                    whileHover={{ scale: 1.05, boxShadow: "0 4px 15px -2px rgba(255, 255, 255, 0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 1.2 }}
                    className="px-6 py-3 bg-white text-blue-700 font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center"
                  >
                    Explore Features
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </motion.a>
                  <motion.a
                    href="#play-to-earn"
                    whileHover={{ scale: 1.05, boxShadow: "0 4px 15px -2px rgba(255, 255, 255, 0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 1.2 }}
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
          <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-lg py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                <a href="#overview" className="relative overflow-hidden bg-gradient-to-r from-btb-primary/10 to-blue-500/10 dark:from-btb-primary/20 dark:to-blue-600/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:from-btb-primary/20 hover:to-blue-500/20 transition-all duration-300 group border border-blue-200/30 dark:border-blue-800/30">
                  <span className="absolute inset-0 bg-btb-primary/5 dark:bg-btb-primary/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                  <GlobeAltIcon className="h-5 w-5 sm:mr-2 text-btb-primary dark:text-blue-400 z-10" />
                  <span className="text-[10px] sm:text-sm font-bold mt-1 sm:mt-0 z-10">Overview</span>
                </a>
                <a href="#play-to-earn" className="relative overflow-hidden bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:from-green-500/20 hover:to-emerald-500/20 transition-all duration-300 group border border-green-200/30 dark:border-green-800/30">
                  <span className="absolute inset-0 bg-green-500/5 dark:bg-green-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                  <CurrencyDollarIcon className="h-5 w-5 sm:mr-2 text-green-600 dark:text-green-400 z-10" />
                  <span className="text-[10px] sm:text-sm font-bold mt-1 sm:mt-0 z-10">Earn</span>
                </a>
                <a href="#protection" className="relative overflow-hidden bg-gradient-to-r from-amber-500/10 to-yellow-500/10 dark:from-amber-500/20 dark:to-yellow-500/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:from-amber-500/20 hover:to-yellow-500/20 transition-all duration-300 group border border-amber-200/30 dark:border-amber-800/30">
                  <span className="absolute inset-0 bg-amber-500/5 dark:bg-amber-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                  <ShieldCheckIcon className="h-5 w-5 sm:mr-2 text-amber-600 dark:text-amber-400 z-10" />
                  <span className="text-[10px] sm:text-sm font-bold mt-1 sm:mt-0 z-10">Protect</span>
                </a>
                <a href="#mechanics" className="relative overflow-hidden bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 px-2 sm:px-3 py-2 rounded-lg flex flex-col sm:flex-row items-center justify-center sm:justify-start hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300 group border border-purple-200/30 dark:border-purple-800/30">
                  <span className="absolute inset-0 bg-purple-500/5 dark:bg-purple-500/10 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
                  <SparklesIcon className="h-5 w-5 sm:mr-2 text-purple-600 dark:text-purple-400 z-10" />
                  <span className="text-[10px] sm:text-sm font-bold mt-1 sm:mt-0 z-10">Mechanics</span>
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                  {/* Background decorative elements */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {/* Grid pattern */}
                    <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btb-primary" />
                        </pattern>
                        <pattern id="overviewGrid" width="100" height="100" patternUnits="userSpaceOnUse">
                          <rect width="100" height="100" fill="url(#smallGrid)" />
                          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="1" className="text-btb-primary" />
                        </pattern>
                      </defs>
                      <rect width="100%" height="100%" fill="url(#overviewGrid)" />
                    </svg>
                    
                    {/* Decorative gradients */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-btb-primary/5 dark:bg-btb-primary/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
                  </div>
                
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-10">
                      {/* Animated rings */}
                      {[...Array(3)].map((_, i) => (
                        <motion.div 
                          key={i}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-btb-primary/30 dark:border-btb-primary/40"
                          style={{ 
                            width: `${50 + i * 15}px`, 
                            height: `${50 + i * 15}px`,
                            zIndex: 10 - i
                          }}
                          animate={{ 
                            scale: [1, 1.1, 1],
                            opacity: [0.6, 0.4, 0.6]
                          }}
                          transition={{ 
                            duration: 3 + i * 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.5
                          }}
                        />
                      ))}
                      
                      {/* Icon container */}
                      <motion.div 
                        className="relative w-20 h-20 bg-gradient-to-br from-btb-primary to-blue-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800 z-20"
                        animate={{ 
                          boxShadow: [
                            "0 4px 12px rgba(59, 130, 246, 0.3)", 
                            "0 8px 24px rgba(59, 130, 246, 0.5)", 
                            "0 4px 12px rgba(59, 130, 246, 0.3)"
                          ]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 rounded-full overflow-hidden opacity-20"
                        >
                          <div className="w-full h-full bg-gradient-to-br from-transparent via-white to-transparent" />
                        </motion.div>
                        <GlobeAltIcon className="h-10 w-10 text-white" />
                      </motion.div>
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  
                  <motion.h2 
                    className="text-2xl sm:text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-btb-primary via-blue-600 to-btb-primary text-center relative z-10"
                    animate={{ 
                      backgroundPosition: ["0% center", "100% center", "0% center"]
                    }}
                    transition={{ 
                      duration: 10, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    style={{ backgroundSize: "200% auto" }}
                  >
                    Game Overview
                  </motion.h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center bg-gradient-to-r from-btb-primary/10 to-blue-500/10 dark:from-btb-primary/20 dark:to-blue-600/20 p-6 rounded-lg mb-6 backdrop-blur-sm border border-btb-primary/10 dark:border-btb-primary/20 shadow-md overflow-hidden relative">
                      {/* Animated particles */}
                      {[...Array(8)].map((_, i) => (
                        <motion.div 
                          key={i}
                          className="absolute rounded-full bg-btb-primary/30 dark:bg-btb-primary/40"
                          style={{
                            width: Math.random() * 6 + 2 + 'px',
                            height: Math.random() * 6 + 2 + 'px',
                            left: Math.random() * 100 + '%',
                            top: Math.random() * 100 + '%',
                          }}
                          animate={{
                            y: [0, Math.random() * -30 - 10, 0],
                            x: [0, Math.random() * 30 - 15, 0],
                            opacity: [0.3, 0.6, 0.3],
                          }}
                          transition={{
                            duration: Math.random() * 4 + 3,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      ))}

                      <div className="w-20 h-20 bg-gradient-to-br from-btb-primary/20 to-blue-500/20 dark:from-btb-primary/30 dark:to-blue-500/30 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mb-4 md:mb-0 shadow-inner relative z-10 backdrop-blur-md border border-white/10 dark:border-white/5">
                        <motion.div 
                          className="absolute inset-0 rounded-full bg-gradient-to-r from-btb-primary/20 to-blue-500/20 blur-md"
                          animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.5, 0.8, 0.5]
                          }}
                          transition={{ 
                            duration: 3, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                        />
                        <motion.span 
                          className="text-4xl relative z-10"
                          animate={{ 
                            scale: [1, 1.15, 1],
                            rotate: [0, 5, 0, -5, 0]
                          }}
                          transition={{ 
                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                            rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                          }}
                        >🎮</motion.span>
                      </div>
                      
                      <motion.p 
                        className="text-lg font-medium text-center md:text-left relative z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                      >
                        MiMo is an exciting play-to-earn blockchain game where you hunt for rewards while ensuring your assets are well-protected.
                      </motion.p>
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                  {/* Background shield pattern */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Shield pattern */}
                    <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
                      {[...Array(10)].map((_, i) => (
                        <svg 
                          key={i}
                          className="absolute"
                          style={{
                            width: `${Math.random() * 40 + 20}px`,
                            height: `${Math.random() * 40 + 20}px`,
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            opacity: Math.random() * 0.5 + 0.3,
                            transform: `rotate(${Math.random() * 360}deg)`
                          }}
                          xmlns="http://www.w3.org/2000/svg" 
                          viewBox="0 0 24 24" 
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.75.75 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                        </svg>
                      ))}
                    </div>
                    
                    {/* Warm glow background */}
                    <motion.div 
                      className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/5 dark:bg-yellow-500/10 rounded-full blur-3xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.7, 0.5]
                      }}
                      transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      style={{
                        transform: "translate(20%, -30%)"
                      }}
                    />
                    
                    <motion.div 
                      className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/5 dark:bg-orange-500/10 rounded-full blur-3xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0.7, 0.5]
                      }}
                      transition={{
                        duration: 8,
                        delay: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      style={{
                        transform: "translate(-30%, 30%)"
                      }}
                    />
                  </div>
                
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-10">
                      {/* Animated shield pulse */}
                      {[...Array(3)].map((_, i) => (
                        <motion.div 
                          key={i}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-400/50 dark:border-yellow-500/50"
                          style={{ 
                            width: `${50 + i * 15}px`, 
                            height: `${50 + i * 15}px`,
                            zIndex: 10 - i
                          }}
                          animate={{ 
                            scale: [1, 1.2, 1],
                            opacity: [0.7, 0.3, 0.7]
                          }}
                          transition={{ 
                            duration: 3 + i * 0.5,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.3
                          }}
                        />
                      ))}
                      
                      {/* Main shield icon with glow */}
                      <motion.div 
                        className="relative w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800 z-20 overflow-hidden"
                        animate={{ 
                          boxShadow: [
                            "0 4px 12px rgba(234, 179, 8, 0.3)", 
                            "0 8px 24px rgba(234, 179, 8, 0.5)", 
                            "0 4px 12px rgba(234, 179, 8, 0.3)"
                          ]
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                      >
                        {/* Radial shine effect */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-yellow-400/0 via-yellow-400/70 to-yellow-400/0"
                          animate={{ 
                            rotate: [0, 360],
                            opacity: [0.3, 0.6, 0.3]
                          }}
                          transition={{ 
                            rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                            opacity: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                          }}
                        />
                        
                        {/* Shield icon with slight bobbing */}
                        <motion.div
                          animate={{ 
                            y: [0, -2, 0, 2, 0],
                            scale: [1, 1.05, 1]
                          }}
                          transition={{ 
                            y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                            scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                          }}
                        >
                          <ShieldCheckIcon className="h-10 w-10 text-white relative z-10" />
                        </motion.div>
                      </motion.div>
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  
                  <motion.h2 
                    className="text-2xl sm:text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-center relative z-10"
                    animate={{ 
                      backgroundPosition: ["0% center", "100% center", "0% center"]
                    }}
                    transition={{ 
                      duration: 8, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    style={{ backgroundSize: "200% auto" }}
                  >
                    Protection
                  </motion.h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/30 dark:to-amber-900/30 p-6 rounded-lg border-l-4 border-yellow-500 shadow-md relative overflow-hidden">
                      {/* Animated alert particles */}
                      {[...Array(5)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-1.5 h-1.5 rounded-full bg-yellow-500"
                          style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                          }}
                          animate={{
                            y: [0, -15, 0],
                            x: [0, Math.random() * 10 - 5, 0],
                            opacity: [0, 0.8, 0],
                            scale: [0, 1, 0]
                          }}
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            delay: Math.random() * 5,
                            repeatDelay: Math.random() * 3,
                          }}
                        />
                      ))}
                    
                      <div className="relative w-20 h-20 bg-gradient-to-br from-yellow-400/20 to-amber-500/20 dark:from-yellow-400/30 dark:to-amber-500/30 rounded-full flex items-center justify-center mr-4 flex-shrink-0 mb-4 md:mb-0 border border-yellow-400/30 dark:border-yellow-400/40 shadow-inner z-10 backdrop-blur-sm">
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-br from-yellow-300/20 to-amber-500/20"
                            animate={{ 
                              scale: [1, 1.2, 1],
                              opacity: [0.3, 0.6, 0.3]
                            }}
                            transition={{ 
                              duration: 3, 
                              repeat: Infinity, 
                              ease: "easeInOut" 
                            }}
                          />
                        </div>
                        
                        <motion.span 
                          className="text-4xl relative z-10"
                          animate={{ 
                            rotate: [0, 10, 0, -10, 0],
                            scale: [1, 1.1, 1]
                          }}
                          transition={{ 
                            rotate: { duration: 1.5, repeat: Infinity },
                            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                          }}
                        >⚠️</motion.span>
                      </div>
                      
                      <div className="relative z-10">
                        <motion.h3 
                          className="text-xl font-bold mb-2 text-yellow-800 dark:text-yellow-200"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                        >
                          Why Protection Matters
                        </motion.h3>
                        <motion.p 
                          className="text-gray-700 dark:text-gray-300"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.6, delay: 0.4 }}
                        >
                          In the MiMo game, unprotected wallets are at risk of having their MiMo tokens hunted by other players.
                          Without protection, you could lose your hard-earned tokens!
                        </motion.p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <motion.div 
                        className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 shadow-md border border-green-100 dark:border-green-800/30 relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7 }}
                        whileHover={{ 
                          boxShadow: "0 10px 25px -5px rgba(74, 222, 128, 0.2)",
                          borderColor: "rgba(74, 222, 128, 0.4)"
                        }}
                      >
                        {/* Background patterns */}
                        <div className="absolute inset-0 overflow-hidden opacity-10 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="absolute top-0 left-0 w-32 h-32 text-green-500 transform -translate-x-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="currentColor">
                            <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.75.75 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                          </svg>
                          
                          {/* Subtle gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-green-300/5 to-blue-300/5 dark:from-green-300/10 dark:to-blue-300/10"></div>
                        </div>
                        
                        <motion.h3 
                          className="text-xl font-bold mb-4 flex items-center text-green-700 dark:text-green-300 relative"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        >
                          <motion.div
                            animate={{ 
                              scale: [1, 1.1, 1],
                              rotate: [0, 10, 0, -10, 0]
                            }}
                            transition={{ 
                              scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                              rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                            }}
                          >
                            <ShieldCheckIcon className="h-6 w-6 mr-2" />
                          </motion.div>
                          How to Protect Your MiMo
                        </motion.h3>
                        
                        <motion.div 
                          className="bg-white/80 dark:bg-gray-800/80 p-4 rounded-lg mb-4 shadow-md backdrop-blur-sm border border-green-100/50 dark:border-green-900/30 relative overflow-hidden"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                        >
                          {/* Animated particles */}
                          {[...Array(8)].map((_, i) => (
                            <motion.div 
                              key={i}
                              className="absolute rounded-full bg-green-500/30"
                              style={{
                                width: Math.random() * 4 + 2 + 'px',
                                height: Math.random() * 4 + 2 + 'px',
                                left: Math.random() * 100 + '%',
                                top: Math.random() * 100 + '%',
                              }}
                              animate={{
                                y: [0, Math.random() * -30 - 10, 0],
                                x: [0, Math.random() * 20 - 10, 0],
                                opacity: [0.3, 0.6, 0.3],
                              }}
                              transition={{
                                duration: Math.random() * 4 + 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                          ))}
                        
                          <motion.p 
                            className="text-lg font-semibold mb-3 text-btb-primary dark:text-btb-primary-light relative z-10"
                            animate={{ 
                              backgroundPosition: ["0% center", "100% center", "0% center"]
                            }}
                            transition={{ 
                              duration: 8, 
                              repeat: Infinity, 
                              ease: "easeInOut" 
                            }}
                            style={{ 
                              backgroundSize: "200% auto",
                              backgroundImage: "linear-gradient(90deg, #34D399, #3B82F6, #34D399)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent"
                            }}
                          >
                            Add liquidity to one of these pairs on Aerodrome:
                          </motion.p>
                          
                          <ul className="space-y-3 relative z-10">
                            {[
                              { number: "1", label: "MiMo/USDC" },
                              { number: "2", label: "MiMo/cbBTC" },
                              { number: "3", label: "MiMo/WETH" }
                            ].map((item, i) => (
                              <motion.li 
                                key={i}
                                className="flex items-center bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md border border-green-100/50 dark:border-green-900/30 overflow-hidden"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5, delay: 0.3 + (i * 0.1) }}
                                whileHover={{ 
                                  backgroundColor: "rgba(240, 253, 244, 1)",
                                  borderColor: "rgba(74, 222, 128, 0.3)"
                                }}
                              >
                                <div className="relative w-8 h-8 flex-shrink-0 mr-3">
                                  {/* Animated ring */}
                                  <motion.div 
                                    className="absolute inset-0 rounded-full border border-green-300"
                                    animate={{ 
                                      scale: [1, 1.3, 1],
                                      opacity: [0.7, 0, 0.7]
                                    }}
                                    transition={{ 
                                      duration: 2,
                                      repeat: Infinity,
                                      delay: i * 0.3,
                                      ease: "easeInOut"
                                    }}
                                  />
                                  
                                  <div className="absolute inset-0 bg-green-100 dark:bg-green-800/50 rounded-full flex items-center justify-center">
                                    <span className="text-green-500 font-bold">{item.number}</span>
                                  </div>
                                </div>
                                <span className="font-bold text-gray-800 dark:text-white">{item.label}</span>
                                
                                {/* Subtle highlight animation */}
                                <motion.div
                                  className="absolute inset-0 bg-gradient-to-r from-transparent via-green-200/20 to-transparent"
                                  animate={{
                                    x: ["-100%", "200%"],
                                  }}
                                  transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    repeatDelay: 2 + i,
                                    ease: "easeInOut"
                                  }}
                                />
                              </motion.li>
                            ))}
                          </ul>
                        </motion.div>
                      </motion.div>
                    </div>
                    
                    <div className="space-y-6">
                      <motion.div 
                        className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md border border-gray-200 dark:border-gray-700 relative overflow-hidden"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        whileHover={{ 
                          boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.2)",
                          borderColor: "rgba(59, 130, 246, 0.3)"
                        }}
                      >
                        {/* Subtle animated background pattern */}
                        <div className="absolute inset-0 overflow-hidden opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                          <svg className="absolute w-full h-full" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <pattern id="protectionGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-btb-primary" />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#protectionGrid)" />
                          </svg>
                          
                          {/* Animated shield icons */}
                          {[...Array(5)].map((_, i) => (
                            <motion.div
                              key={i} 
                              className="absolute text-blue-500/10 w-16 h-16"
                              style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                transform: `rotate(${Math.random() * 40 - 20}deg)`
                              }}
                              animate={{
                                y: [0, Math.random() * 10 - 5, 0],
                                rotate: [0, Math.random() * 20 - 10, 0],
                                opacity: [0.05, 0.15, 0.05]
                              }}
                              transition={{
                                duration: Math.random() * 5 + 5,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: i * 0.5
                              }}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.75.75 0 00.374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 00-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08zm3.094 8.016a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                              </svg>
                            </motion.div>
                          ))}
                        </div>
                      
                        <motion.h3 
                          className="text-xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-btb-primary via-blue-600 to-btb-primary relative z-10"
                          animate={{ 
                            backgroundPosition: ["0% center", "100% center", "0% center"]
                          }}
                          transition={{ 
                            duration: 8, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                          style={{ 
                            backgroundSize: "200% auto"
                          }}
                        >
                          How Protection Works
                        </motion.h3>
                        
                        <div className="space-y-4 relative z-10">
                          {[
                            {
                              number: "1",
                              title: "Automatic Detection",
                              content: "When you provide liquidity to approved pools, your wallet address is automatically added to the \"Protected Addresses\" list in the game contract."
                            },
                            {
                              number: "2",
                              title: "Hunting Prevention",
                              content: "Hunters cannot extract MiMo tokens from protected wallets. Every time a Hunter attempts to hunt, the contract checks if the target address is protected."
                            }
                          ].map((item, i) => (
                            <motion.div 
                              key={i}
                              className="bg-gradient-to-r from-blue-50 to-blue-50/50 dark:from-blue-900/20 dark:to-blue-900/10 p-4 rounded-lg relative overflow-hidden border border-blue-100/50 dark:border-blue-900/30"
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.5, delay: 0.5 + (i * 0.2) }}
                              whileHover={{ 
                                backgroundColor: "rgba(239, 246, 255, 1)",
                                borderColor: "rgba(59, 130, 246, 0.3)"
                              }}
                            >
                              {/* Animated particles */}
                              {[...Array(3)].map((_, j) => (
                                <motion.div 
                                  key={j}
                                  className="absolute rounded-full bg-blue-500/30"
                                  style={{
                                    width: Math.random() * 3 + 1 + 'px',
                                    height: Math.random() * 3 + 1 + 'px',
                                    left: Math.random() * 100 + '%',
                                    top: Math.random() * 100 + '%',
                                  }}
                                  animate={{
                                    y: [0, Math.random() * -20 - 5, 0],
                                    x: [0, Math.random() * 10 - 5, 0],
                                    opacity: [0.2, 0.5, 0.2],
                                  }}
                                  transition={{
                                    duration: Math.random() * 3 + 2,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: j * 0.3
                                  }}
                                />
                              ))}
                              
                              <h4 className="font-bold mb-2 flex items-center relative z-10">
                                <motion.div 
                                  className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0"
                                  animate={{ 
                                    scale: [1, 1.1, 1],
                                    boxShadow: [
                                      "0 0 0 rgba(59, 130, 246, 0.5)",
                                      "0 0 8px rgba(59, 130, 246, 0.5)",
                                      "0 0 0 rgba(59, 130, 246, 0.5)"
                                    ]
                                  }}
                                  transition={{ 
                                    duration: 2.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                    delay: i * 0.3
                                  }}
                                >
                                  {item.number}
                                </motion.div>
                                {item.title}
                              </h4>
                              <p className="text-gray-700 dark:text-gray-300 relative z-10">
                                {item.content}
                              </p>
                              
                              {/* Subtle highlight animation */}
                              <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-200/30 to-transparent"
                                animate={{
                                  x: ["-100%", "200%"],
                                }}
                                transition={{
                                  duration: 3,
                                  repeat: Infinity,
                                  repeatDelay: 2 + i,
                                  ease: "easeInOut"
                                }}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 sm:p-8 border border-gray-100 dark:border-gray-700 relative overflow-hidden">
                  {/* Decorative background elements */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Animated gears in background */}
                    <svg className="absolute opacity-[0.03] dark:opacity-[0.05] w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
                      <motion.g
                        animate={{ rotate: 360 }}
                        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
                      >
                        <path d="M501.1 395.7L384 278.6c-23.1-23.1-57.6-27.6-85.4-13.9L192 158.1V96L64 0 0 64l96 128h62.1l106.6 106.6c-13.6 27.8-9.2 62.3 13.9 85.4l117.1 117.1c14.6 14.6 38.2 14.6 52.7 0l52.7-52.7c14.5-14.6 14.5-38.2 0-52.7zM331.7 225c28.3 0 54.9 11 74.9 31l19.4 19.4c15.8-6.9 30.8-16.5 43.8-29.5 37.1-37.1 49.7-89.3 37.9-136.7-2.2-9-13.5-12.1-20.1-5.5l-74.4 74.4-42.1-11.3-11.3-42.1 74.4-74.4c6.6-6.6 3.4-17.9-5.7-20.2-47.4-11.7-99.6.9-136.6 37.9-28.5 28.5-41.9 66.1-41.2 103.6l82.1 82.1c8.1-1.9 16.5-2.9 24.7-2.9zm-103.9 82l-56.7-56.7L18.7 402.8c-25 25-25 65.5 0 90.5s65.5 25 90.5 0l123.6-123.6c-7.6-19.9-9.9-41.6-5-62.7z" />
                      </motion.g>
                    </svg>
                    
                    {/* Gradient orbs */}
                    <motion.div 
                      className="absolute top-1/4 -right-20 w-80 h-80 rounded-full bg-gradient-to-br from-purple-500/5 to-pink-500/5 dark:from-purple-500/10 dark:to-pink-500/10 blur-3xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        x: [0, -20, 0],
                        opacity: [0.5, 0.7, 0.5]
                      }}
                      transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                    
                    <motion.div 
                      className="absolute bottom-1/4 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-blue-500/5 to-purple-500/5 dark:from-blue-500/10 dark:to-purple-500/10 blur-3xl"
                      animate={{
                        scale: [1, 1.2, 1],
                        x: [0, 20, 0],
                        opacity: [0.5, 0.7, 0.5]
                      }}
                      transition={{
                        duration: 10,
                        delay: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </div>
                
                  <div className="relative">
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 z-10">
                      {/* Animated rings */}
                      {[...Array(3)].map((_, i) => (
                        <motion.div 
                          key={i}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                          style={{ 
                            width: `${50 + i * 15}px`, 
                            height: `${50 + i * 15}px`,
                            zIndex: 10 - i,
                            borderColor: `rgba(168, 85, 247, ${0.3 - i * 0.05})`
                          }}
                          animate={{ 
                            scale: [1, 1.1, 1],
                            opacity: [0.6, 0.4, 0.6],
                            rotate: [0, 45, 0]
                          }}
                          transition={{ 
                            duration: 4 + i * 0.7,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.5
                          }}
                        />
                      ))}
                      
                      {/* Icon container with sparkle animation */}
                      <motion.div 
                        className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-800 z-20 overflow-hidden"
                        animate={{ 
                          boxShadow: [
                            "0 4px 12px rgba(168, 85, 247, 0.3)", 
                            "0 8px 24px rgba(168, 85, 247, 0.5)", 
                            "0 4px 12px rgba(168, 85, 247, 0.3)"
                          ]
                        }}
                        transition={{ 
                          duration: 3, 
                          repeat: Infinity, 
                          ease: "easeInOut" 
                        }}
                      >
                        {/* Sparkle effects */}
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute bg-white w-1 rounded-full"
                            style={{
                              height: Math.random() * 10 + 10 + 'px',
                              left: `${Math.random() * 100}%`,
                              top: `${Math.random() * 100}%`,
                              rotate: `${Math.random() * 360}deg`,
                              transformOrigin: 'center',
                              opacity: 0
                            }}
                            animate={{
                              opacity: [0, 0.8, 0],
                              scale: [0, 1, 0]
                            }}
                            transition={{
                              duration: 1,
                              repeat: Infinity,
                              delay: Math.random() * 5,
                              repeatDelay: Math.random() * 4 + 2
                            }}
                          />
                        ))}
                        
                        {/* Icon */}
                        <motion.div
                          animate={{ 
                            scale: [1, 1.1, 1],
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity, 
                            ease: "easeInOut" 
                          }}
                        >
                          <SparklesIcon className="h-10 w-10 text-white" />
                        </motion.div>
                      </motion.div>
                    </div>
                    <div className="h-8"></div> {/* Spacer */}
                  </div>
                  
                  <motion.h2 
                    className="text-2xl sm:text-3xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 text-center relative z-10"
                    animate={{ 
                      backgroundPosition: ["0% center", "100% center", "0% center"]
                    }}
                    transition={{ 
                      duration: 10, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                    style={{ backgroundSize: "200% auto" }}
                  >
                    Game Mechanics
                  </motion.h2>
                  
                  <div className="mb-8">
                    <div className="flex flex-col md:flex-row items-center justify-center rounded-lg mb-6 overflow-hidden relative">
                      {/* Animated background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 overflow-hidden">
                        {/* Animated gear patterns */}
                        <div className="absolute inset-0 opacity-10">
                          {[...Array(6)].map((_, i) => (
                            <motion.div
                              key={i}
                              className="absolute rounded-full border-2 border-dashed border-purple-500/30"
                              style={{
                                width: `${Math.random() * 100 + 50}px`,
                                height: `${Math.random() * 100 + 50}px`,
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                              }}
                              animate={{
                                rotate: [0, 360],
                              }}
                              transition={{
                                duration: Math.random() * 20 + 20,
                                repeat: Infinity,
                                ease: "linear"
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="backdrop-blur-sm p-6 rounded-lg shadow-md border border-purple-200/30 dark:border-purple-800/30 flex flex-col md:flex-row items-center w-full z-10">
                        <div className="relative w-20 h-20 mr-6 flex-shrink-0 mb-4 md:mb-0">
                          {/* Spinning gear */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            >
                              <svg className="w-16 h-16 text-purple-500/80 dark:text-purple-400/80" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                                <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336c44.2 0 80-35.8 80-80s-35.8-80-80-80s-80 35.8-80 80s35.8 80 80 80z"/>
                              </svg>
                            </motion.div>
                          </div>
                          
                          {/* Overlaid gear in opposite direction */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                              animate={{ rotate: -360 }}
                              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            >
                              <svg className="w-12 h-12 text-pink-500/80 dark:text-pink-400/80" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
                                <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336c44.2 0 80-35.8 80-80s-35.8-80-80-80s-80 35.8-80 80s35.8 80 80 80z"/>
                              </svg>
                            </motion.div>
                          </div>
                        </div>
                        
                        <motion.p 
                          className="text-lg font-medium text-center md:text-left"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 1, delay: 0.3 }}
                        >
                          The MiMo game is built on a carefully balanced ecosystem that rewards strategy and consistent engagement. Here's how it all works behind the scenes.
                        </motion.p>
                      </div>
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
                      <div className="relative">
                        {/* Animated background glow */}
                        <motion.div 
                          className="absolute -inset-2 rounded-xl bg-gradient-to-r from-purple-500/20 via-btb-primary/30 to-blue-500/20 blur-xl opacity-70 pointer-events-none"
                          animate={{ 
                            rotate: [0, 180],
                            scale: [0.9, 1.1, 0.9]
                          }}
                          transition={{ 
                            rotate: { duration: 10, repeat: Infinity, ease: "linear" },
                            scale: { duration: 5, repeat: Infinity, ease: "easeInOut" }
                          }}
                        ></motion.div>
                        
                        {/* Particles around button */}
                        {[...Array(6)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute rounded-full bg-btb-primary/60 dark:bg-btb-primary-light/60"
                            style={{
                              width: Math.random() * 6 + 2 + 'px',
                              height: Math.random() * 6 + 2 + 'px',
                              left: `calc(50% + ${Math.random() * 120 - 60}px)`,
                              top: `calc(50% + ${Math.random() * 60 - 30}px)`,
                              zIndex: 1,
                            }}
                            animate={{
                              x: [0, Math.random() * 20 - 10, 0],
                              y: [0, Math.random() * 20 - 10, 0],
                              opacity: [0.4, 0.8, 0.4],
                              scale: [1, Math.random() * 0.5 + 1, 1],
                            }}
                            transition={{
                              duration: Math.random() * 3 + 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        ))}
                        
                        <motion.button
                          onClick={() => setShowGameInterface(true)}
                          whileHover={{ 
                            scale: 1.05, 
                            boxShadow: "0 10px 25px -5px rgba(59, 130, 246, 0.6)"
                          }}
                          whileTap={{ scale: 0.95 }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                          className="relative bg-gradient-to-r from-btb-primary via-blue-600 to-btb-primary bg-size-200 text-white px-8 py-3.5 rounded-xl font-bold tracking-wide flex items-center shadow-md z-10 group overflow-hidden border border-white/10"
                        >
                          {/* Animated gradient background */}
                          <motion.div 
                            className="absolute inset-0 bg-gradient-to-r from-btb-primary via-blue-600 to-btb-primary bg-size-200"
                            animate={{
                              backgroundPosition: ["0% center", "100% center", "0% center"],
                            }}
                            transition={{
                              duration: 5,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                          
                          {/* Shine effect */}
                          <motion.div
                            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:opacity-100 opacity-0 transition-opacity duration-300"
                            animate={{ x: ["0%", "200%"] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 0.5 }}
                          ></motion.div>
                          
                          {/* Content */}
                          <span className="mr-2 z-10 relative">Start Playing Now</span>
                          
                          <motion.svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            className="h-5 w-5 z-10 relative" 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                            animate={{ x: [0, 5, 0] }}
                            transition={{ 
                              repeat: Infinity, 
                              duration: 1.2, 
                              ease: "easeInOut" 
                            }}
                          >
                            <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                          </motion.svg>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Mobile Navigation Button */}
          <div className="md:hidden fixed bottom-6 right-6 z-20">
            <div className="relative">
              {/* Ripple effect */}
              <motion.div
                className="absolute inset-0 rounded-full bg-btb-primary opacity-30"
                initial={{ scale: 1 }}
                animate={{ 
                  scale: [1, 1.5, 1.5],
                  opacity: [0.3, 0, 0],
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 2,
                  repeatDelay: 1,
                  ease: "easeOut"
                }}
              />
              
              {/* Second ripple with delay */}
              <motion.div
                className="absolute inset-0 rounded-full bg-btb-primary opacity-30"
                initial={{ scale: 1 }}
                animate={{ 
                  scale: [1, 1.5, 1.5],
                  opacity: [0.3, 0, 0],
                }}
                transition={{ 
                  repeat: Infinity,
                  duration: 2,
                  delay: 0.6,
                  repeatDelay: 1,
                  ease: "easeOut"
                }}
              />
              
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowMobileNav(!showMobileNav)}
                className="bg-gradient-to-r from-btb-primary to-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl relative z-10 border border-white/10"
              >
                <motion.div
                  animate={{ rotate: showMobileNav ? 90 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </motion.div>
              </motion.button>
            </div>
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
                  <div className="relative">
                    {/* Button glow effect */}
                    <motion.div 
                      className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-btb-primary to-purple-500 rounded-lg blur-md opacity-70"
                      animate={{ 
                        opacity: [0.5, 0.8, 0.5],
                        backgroundPosition: ["0% center", "100% center", "0% center"] 
                      }}
                      transition={{ 
                        opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                        backgroundPosition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                      }}
                      style={{ backgroundSize: "200% 100%" }}
                    ></motion.div>
                    
                    <motion.button
                      onClick={() => {
                        setShowGameInterface(true);
                        setShowMobileNav(false);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full bg-gradient-to-r from-btb-primary to-blue-600 text-white py-3.5 rounded-lg font-bold transition-all duration-300 z-10 border border-white/10 shadow-lg overflow-hidden"
                    >
                      {/* Shine effect */}
                      <motion.div
                        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        animate={{ x: ["0%", "200%"] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear", repeatDelay: 0.5 }}
                      ></motion.div>
                      
                      <span className="relative z-10 flex items-center justify-center">
                        Launch Game
                        <motion.svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          className="h-5 w-5 ml-2" 
                          viewBox="0 0 20 20" 
                          fill="currentColor"
                          animate={{ x: [0, 4, 0] }}
                          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                        >
                          <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </motion.svg>
                      </span>
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}