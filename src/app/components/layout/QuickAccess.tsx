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
    gradient: 'from-amber-500/20 to-yellow-600/20',
    border: 'group-hover:border-amber-500/50',
    text: 'group-hover:text-amber-400'
  },
  {
    name: 'BTB Finance',
    description: 'Yield & Bonding',
    href: '/btb-finance',
    icon: '💰',
    gradient: 'from-red-600/20 to-rose-900/20',
    border: 'group-hover:border-red-500/50',
    text: 'group-hover:text-red-400'
  },
  {
    name: 'Megapot',
    description: 'Daily Jackpots',
    href: '/megapot',
    icon: '🎰',
    gradient: 'from-slate-400/20 to-gray-600/20',
    border: 'group-hover:border-slate-400/50',
    text: 'group-hover:text-slate-300'
  },
  {
    name: 'Game',
    description: 'Play to Earn',
    href: '/game',
    icon: '🎮',
    gradient: 'from-indigo-500/20 to-blue-600/20',
    border: 'group-hover:border-indigo-500/50',
    text: 'group-hover:text-indigo-400'
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
    <div ref={containerRef} className="fixed bottom-8 right-8 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="mb-4 p-4 rounded-3xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-2xl w-80"
          >
            <div className="mb-4 px-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider opacity-50">Quick Jump</h3>
            </div>

            <div className="grid gap-2">
              {quickNavLinks.map((link, index) => (
                <Link key={index} href={link.href} onClick={() => setIsOpen(false)}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`group relative p-3 rounded-xl border border-white/5 bg-white/5 overflow-hidden transition-all duration-300 ${link.border}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${link.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                    <div className="relative z-10 flex items-center gap-4">
                      <span className="text-2xl">{link.icon}</span>
                      <div>
                        <div className={`font-bold text-white transition-colors ${link.text}`}>
                          {link.name}
                        </div>
                        <div className="text-xs text-white/40 font-medium">
                          {link.description}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`group relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isOpen ? 'bg-white text-black' : 'bg-white/10 text-white backdrop-blur-md border border-white/20'}`}
      >
        <div className={`absolute inset-0 rounded-full bg-gradient-to-r from-btb-primary to-btb-primary-light opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${isOpen ? 'hidden' : ''}`} />

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
            >
              <XMarkIcon className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
            >
              <SparklesIcon className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
