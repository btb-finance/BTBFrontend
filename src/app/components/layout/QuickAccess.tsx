'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';

// Define the navigation links
const quickNavLinks = [
  {
    name: 'Larry Ecosystem',
    description: 'Trade, leverage & borrow with LARRY',
    href: '/larryecosystem',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🐺</span>
    ),
    color: 'bg-emerald-100 dark:bg-emerald-900/30',
    textColor: 'text-emerald-600 dark:text-emerald-400'
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
  }
];

export default function QuickAccess() {
  const [isNavPopupOpen, setIsNavPopupOpen] = useState(false);
  const [showFullButton, setShowFullButton] = useState(true);
  
  // Separate button refs to exclude them from outside click handling
  const desktopButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const desktopPopupRef = useRef<HTMLDivElement>(null);
  const mobilePopupRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Only add the event listener if the popup is open
    if (!isNavPopupOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the popups and not on the buttons
      const isClickInDesktopPopup = desktopPopupRef.current && desktopPopupRef.current.contains(event.target as Node);
      const isClickInMobilePopup = mobilePopupRef.current && mobilePopupRef.current.contains(event.target as Node);
      const isClickOnDesktopButton = desktopButtonRef.current && desktopButtonRef.current.contains(event.target as Node);
      const isClickOnMobileButton = mobileButtonRef.current && mobileButtonRef.current.contains(event.target as Node);
      
      const isClickInsideComponents = 
        isClickInDesktopPopup || 
        isClickInMobilePopup || 
        isClickOnDesktopButton || 
        isClickOnMobileButton;
      
      if (!isClickInsideComponents) {
        setIsNavPopupOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNavPopupOpen]);
  
  useEffect(() => {
    // Set a timeout to change the button style after 10 seconds
    const timeout = setTimeout(() => {
      setShowFullButton(false);
    }, 10000);
    
    return () => {
      clearTimeout(timeout);
    };
  }, []);

  return (
    <>
      {/* Desktop Quick Access Button - Right side */}
      <div className="fixed bottom-1/2 right-0 z-50 hidden md:block">
        <motion.div
          initial={{ opacity: 1, x: 0 }}
          animate={{ 
            opacity: 1, 
            x: showFullButton ? 0 : 10
          }}
          transition={{ duration: 0.3 }}
          className="relative"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group"
          >
            <button
              ref={desktopButtonRef}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newState = !isNavPopupOpen;
                setIsNavPopupOpen(newState);
              }}
              className={`bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light text-white ${
                showFullButton 
                  ? 'py-2.5 px-5 rounded-l-full' 
                  : 'p-3 rounded-l-full'
              } shadow-xl flex items-center transition-all duration-300 border-2 ${isNavPopupOpen ? 'border-white/50' : 'border-white/20'}`}
            >
              <AnimatePresence>
                {showFullButton && (
                  <motion.span 
                    key="button-text"
                    initial={{ opacity: 1, width: 'auto' }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0, marginRight: 0 }}
                    transition={{ duration: 0.3 }}
                    className="font-medium whitespace-nowrap overflow-hidden mr-2"
                  >
                    Quick Access
                  </motion.span>
                )}
              </AnimatePresence>
              <SparklesIcon className="h-5 w-5" />
            </button>
          </motion.div>
          
          {/* Popup Navigation */}
          <AnimatePresence mode="wait">
            {isNavPopupOpen ? (
              <motion.div
                key="popup"
                ref={desktopPopupRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className="absolute right-14 translate-y-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 border border-gray-100 dark:border-gray-700 w-[480px] max-w-[95vw] z-[100]"
              >
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-gray-100 dark:border-gray-700"></div>
                <div className="mb-3 text-center">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Jump to Live Products</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quick access to our core features</p>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {quickNavLinks.map((link, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.1 }}
                    >
                      <Link
                        href={link.href}
                        className="flex flex-col items-center text-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsNavPopupOpen(false)}
                      >
                        <div className={`${link.color} ${link.textColor} p-2 rounded-full mb-2`}>
                          {typeof link.icon === 'function' 
                            ? <link.icon className="h-5 w-5" /> 
                            : React.createElement(link.icon as React.ComponentType<{ className: string }>, { className: "h-5 w-5" })}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{link.name}</div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Mobile Quick Access Button - Bottom right */}
      <div className="fixed bottom-8 right-4 z-50 md:hidden">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group"
          >
            <button
              ref={mobileButtonRef}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const newState = !isNavPopupOpen;
                setIsNavPopupOpen(newState);
              }}
              className={`bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light text-white ${
                showFullButton 
                  ? 'py-2.5 px-5 rounded-full' 
                  : 'p-3 rounded-full'
              } shadow-xl flex items-center border-2 ${isNavPopupOpen ? 'border-white/50' : 'border-white/20'}`}
            >
              <SparklesIcon className={`h-5 w-5 ${showFullButton ? 'mr-2' : ''}`} />
              {showFullButton && (
                <span className="font-medium whitespace-nowrap">
                  Quick Access
                </span>
              )}
            </button>
          </motion.div>
          
          {/* Mobile Popup Navigation */}
          <AnimatePresence mode="wait">
            {isNavPopupOpen ? (
              <motion.div
                key="mobile-popup"
                ref={mobilePopupRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed right-4 bottom-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-3 border border-gray-100 dark:border-gray-700 w-[340px] max-w-[95vw] z-[100]"
              >
                <div className="absolute -bottom-2 right-6 transform w-4 h-4 rotate-45 bg-white dark:bg-gray-800 border-b border-r border-gray-100 dark:border-gray-700"></div>
                <div className="mb-3 text-center">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Jump to Live Products</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Quick access to our core features</p>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  {quickNavLinks.map((link, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.1 }}
                    >
                      <Link
                        href={link.href}
                        className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setIsNavPopupOpen(false)}
                      >
                        <div className={`${link.color} ${link.textColor} p-1.5 rounded-full mb-1`}>
                          {typeof link.icon === 'function' 
                            ? <link.icon className="h-4 w-4" /> 
                            : React.createElement(link.icon as React.ComponentType<{ className: string }>, { className: "h-4 w-4" })}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-white text-xs">{link.name}</div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}