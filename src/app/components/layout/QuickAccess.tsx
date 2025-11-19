'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';

const quickNavLinks = [
  {
    name: 'Larry Ecosystem',
    description: 'The Legend',
    href: '/larryecosystem',
    icon: '🐺',
    color: 'text-amber-400',
    glow: 'shadow-amber-500/50',
    gradient: 'from-amber-500/20 via-amber-500/10 to-transparent'
  },
  {
    name: 'BTB Finance',
    description: 'Yield & Bonding',
    href: '/btb-finance',
    icon: '💰',
    color: 'text-red-500',
    glow: 'shadow-red-500/50',
    gradient: 'from-red-600/20 via-red-600/10 to-transparent'
  },
  {
    name: 'Megapot',
    description: 'Daily Jackpots',
    href: '/megapot',
    icon: '🎰',
    color: 'text-slate-200',
    glow: 'shadow-slate-400/50',
    gradient: 'from-slate-400/20 via-slate-400/10 to-transparent'
  },
  {
    name: 'Game',
    description: 'Play to Earn',
    href: '/game',
    icon: '🎮',
    color: 'text-indigo-400',
    glow: 'shadow-indigo-500/50',
    gradient: 'from-indigo-500/20 via-indigo-500/10 to-transparent'
  }
];

export default function QuickAccess() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="mb-6 p-1 rounded-2xl bg-black border border-white/10 shadow-2xl w-72 overflow-hidden"
          >
            {/* Noise Texture Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat"></div>

            <div className="relative z-10 bg-black/50 backdrop-blur-md rounded-xl p-3">
              <div className="mb-3 px-2 flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">System Access</h3>
                <div className="h-1 w-1 rounded-full bg-green-500 animate-pulse"></div>
              </div>

              <div className="grid gap-1">
                {quickNavLinks.map((link, index) => (
                  <Link key={index} href={link.href} onClick={() => setIsOpen(false)}>
                    <motion.div
                      whileHover="hover"
                      initial="idle"
                      className="group relative p-3 rounded-lg overflow-hidden"
                    >
                      {/* Hover Scan Effect */}
                      <motion.div
                        variants={{
                          idle: { x: '-100%', opacity: 0 },
                          hover: { x: '100%', opacity: 1 }
                        }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                        className={`absolute inset-0 bg-gradient-to-r ${link.gradient} opacity-0`}
                      />

                      <div className="relative z-10 flex items-center gap-4">
                        <span className="text-xl filter grayscale group-hover:grayscale-0 transition-all duration-300">{link.icon}</span>
                        <div>
                          <div className={`font-bold text-sm text-white/70 group-hover:text-white transition-colors duration-300 uppercase tracking-wider ${link.color}`}>
                            {link.name}
                          </div>
                          <div className="text-[10px] text-white/30 font-medium tracking-wide group-hover:text-white/50 transition-colors duration-300">
                            {link.description}
                          </div>
                        </div>
                      </div>

                      {/* Active Indicator Line */}
                      <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-current opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${link.color}`} />
                    </motion.div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Trigger Orb */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-50 ${isOpen ? 'bg-white' : 'bg-black border border-white/20'}`}
      >
        {/* Pulsing Ring (Only when closed) */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full border border-white/10 animate-ping opacity-20"></span>
        )}

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              className="text-black"
            >
              <XMarkIcon className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="text-white"
            >
              <SparklesIcon className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
