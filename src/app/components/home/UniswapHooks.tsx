'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, CurrencyDollarIcon, ClockIcon, ShieldCheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const UniswapHooks: React.FC = () => {
  // Uniswap hooks features
  const hooksFeatures = [
    {
      title: 'Dynamic Fee Adjustment',
      description: 'Automatically adjusts trading fees based on market volatility and liquidity conditions'
    },
    {
      title: 'Just-In-Time Liquidity',
      description: 'Concentrates liquidity around the current price to maximize capital efficiency'
    },
    {
      title: 'MEV Protection',
      description: 'Shields traders from front-running and sandwich attacks through advanced order routing'
    },
    {
      title: 'Cross-Chain Integration',
      description: 'Seamlessly bridges liquidity across multiple chains for unified trading experience'
    },
  ];

  return (
    <div className="py-24 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 45, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.6, 0.4],
            rotate: [45, 0, 45]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative">
        {/* Uniswap Hooks Integration */}
        <div className="mb-24">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <motion.h2 
              className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl font-heading"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Uniswap Hooks Integration
            </motion.h2>
            <motion.p 
              className="mt-4 text-lg text-gray-600 dark:text-gray-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              Leveraging Uniswap v4's hook system for enhanced trading and liquidity provision
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hooksFeatures.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-md p-6 border-2 border-transparent hover:border-purple-500/20 dark:hover:border-purple-400/20 hover:shadow-xl transition-all duration-300 group relative overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -5 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                />
                <motion.div 
                  className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-md bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 mb-4 group-hover:scale-110 transition-transform duration-300"
                  whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  {index === 0 && <CurrencyDollarIcon className="h-6 w-6" />}
                  {index === 1 && <ClockIcon className="h-6 w-6" />}
                  {index === 2 && <ShieldCheckIcon className="h-6 w-6" />}
                  {index === 3 && <GlobeAltIcon className="h-6 w-6" />}
                </motion.div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-10 text-center relative z-10">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 blur-2xl -z-10"
              animate={{
                opacity: [0.5, 0.8, 0.5],
                scale: [0.8, 1, 0.8]
              }}
              transition={{ duration: 4, repeat: Infinity }}
            />
            <Link 
              href="/hooks"
              className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg transition-all duration-300"
            >
              Explore Uniswap Hooks <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniswapHooks;