'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const ImpermanentLossProtection: React.FC = () => {
  // IL protection features
  const ilProtectionFeatures = [
    {
      title: 'Dynamic Hedging',
      description: 'Automatically hedges LP positions based on market conditions to minimize IL'
    },
    {
      title: 'Insurance Pool',
      description: 'Dedicated pool funded by a portion of trading fees to compensate for significant IL events'
    },
    {
      title: 'Risk Scoring',
      description: 'Real-time assessment of IL risk for different pool compositions and market conditions'
    },
    {
      title: 'Optimized Rebalancing',
      description: 'Smart rebalancing strategies that minimize IL while maximizing yield'
    },
  ];

  return (
    <div className="py-24 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Impermanent Loss Protection */}
        <div>
          <div className="mx-auto max-w-3xl text-center mb-16">
            <motion.h2 
              className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl font-heading"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              Impermanent Loss Protection
            </motion.h2>
            <motion.p 
              className="mt-4 text-lg text-gray-600 dark:text-gray-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              Advanced strategies to mitigate impermanent loss for liquidity providers
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {ilProtectionFeatures.map((feature, index) => (
              <motion.div
                key={index}
                className="flex items-start"
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-md bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 mr-4">
                  <ShieldCheckIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 md:p-8 shadow-lg">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">IL Protection Calculator</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 md:mb-0">
                  Calculate your potential impermanent loss and see how our protection mechanisms can help
                </p>
              </div>
              <Link 
                href="/calculator"
                className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg transition-all duration-300 whitespace-nowrap"
              >
                Try the Calculator <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpermanentLossProtection;