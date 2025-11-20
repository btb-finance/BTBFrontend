'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
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
    name: 'BTB Finance',
    description: 'Trade, loop, and borrow with BTB tokens - Full DeFi platform',
    href: '/btb-finance',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>💰</span>
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
    name: 'Game',
    description: 'Play games and earn rewards',
    href: '/game',
    icon: ({ className }: { className?: string }) => (
      <span className={className} style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎮</span>
    ),
    color: 'bg-pink-100 dark:bg-pink-900/30',
    textColor: 'text-pink-600 dark:text-pink-400'
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
        <div className="relative" style={{opacity: 1, transform: showFullButton ? 'translateX(0)' : 'translateX(10px)', transition: 'transform 0.3s'}}>
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
            } shadow-xl flex items-center transition-all duration-300 border-2 ${isNavPopupOpen ? 'border-white/50' : 'border-white/20'} hover:scale-105 active:scale-95`}
          >
            <span
              className="font-medium whitespace-nowrap overflow-hidden mr-2"
              style={{
                opacity: showFullButton ? 1 : 0,
                width: showFullButton ? 'auto' : '0px',
                marginRight: showFullButton ? '0.5rem' : '0px',
                transition: 'opacity 0.3s, width 0.3s, margin-right 0.3s'
              }}
            >
              Quick Access
            </span>
            <SparklesIcon className="h-5 w-5" />
          </button>
          
          {/* Popup Navigation */}
          {isNavPopupOpen && (
            <div
              ref={desktopPopupRef}
              className="absolute right-14 translate-y-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 border border-gray-100 dark:border-gray-700 w-[480px] max-w-[95vw] z-[100] transition-opacity duration-150"
              style={{opacity: 1, transform: 'scale(1)'}}
            >
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 rotate-45 bg-white dark:bg-gray-800 border-r border-b border-gray-100 dark:border-gray-700"></div>
              <div className="mb-3 text-center">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Jump to Live Products</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Quick access to our core features</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {quickNavLinks.map((link, index) => (
                  <Link
                    key={index}
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
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Quick Access Button - Bottom right */}
      <div className="fixed bottom-8 right-4 z-50 md:hidden">
        <div className="relative" style={{opacity: 1}}>
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
            } shadow-xl flex items-center border-2 ${isNavPopupOpen ? 'border-white/50' : 'border-white/20'} hover:scale-105 active:scale-95 transition-transform`}
          >
            <SparklesIcon className={`h-5 w-5 ${showFullButton ? 'mr-2' : ''}`} />
            {showFullButton && (
              <span className="font-medium whitespace-nowrap">
                Quick Access
              </span>
            )}
          </button>

          {/* Mobile Popup Navigation */}
          {isNavPopupOpen && (
            <div
              ref={mobilePopupRef}
              className="fixed right-4 bottom-20 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-3 border border-gray-100 dark:border-gray-700 w-[340px] max-w-[95vw] z-[100] transition-opacity duration-200"
              style={{opacity: 1}}
            >
              <div className="absolute -bottom-2 right-6 transform w-4 h-4 rotate-45 bg-white dark:bg-gray-800 border-b border-r border-gray-100 dark:border-gray-700"></div>
              <div className="mb-3 text-center">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Jump to Live Products</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Quick access to our core features</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {quickNavLinks.map((link, index) => (
                  <Link
                    key={index}
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
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}