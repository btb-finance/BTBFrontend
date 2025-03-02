'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRightIcon, ShieldCheckIcon, ChartBarIcon, CogIcon, ScaleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

const ImpermanentLossProtection = () => {
  // IL protection features
  const ilProtectionFeatures = [
    {
      title: 'Dynamic Hedging',
      description: 'Automatically hedges LP positions based on market conditions to minimize IL',
      icon: <ShieldCheckIcon className="h-6 w-6" />,
      color: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Insurance Pool',
      description: 'Dedicated pool funded by a portion of trading fees to compensate for significant IL events',
      icon: <ScaleIcon className="h-6 w-6" />,
      color: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Risk Scoring',
      description: 'Real-time assessment of IL risk for different pool compositions and market conditions',
      icon: <ChartBarIcon className="h-6 w-6" />,
      color: 'from-purple-500 to-indigo-600'
    },
    {
      title: 'Optimized Rebalancing',
      description: 'Smart rebalancing strategies that minimize IL while maximizing yield',
      icon: <CogIcon className="h-6 w-6" />,
      color: 'from-amber-500 to-orange-600'
    },
  ];
  
  // Animation variants for staggered animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <section className="py-24 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative">
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

          {/* Background decorative elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-green-500/10 blur-3xl"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
                rotate: [0, 45, 0]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"
              animate={{ 
                scale: [1.2, 1, 1.2],
                opacity: [0.4, 0.6, 0.4],
                rotate: [45, 0, 45]
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {ilProtectionFeatures.map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                variants={itemVariants}
                whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
                transition={{ duration: 0.5 }}
              >
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                />
                <div className="flex items-start">
                  <motion.div 
                    className={`flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br ${feature.color} text-white mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    whileHover={{ rotate: [0, -10, 10, -10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    {feature.icon}
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
                  </div>
                </div>
                
                <motion.div 
                  className="w-full h-1 mt-4 bg-gradient-to-r from-transparent via-green-500/30 to-transparent rounded-full"
                  initial={{ scaleX: 0, opacity: 0 }}
                  whileInView={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 1, delay: 0.5 + (index * 0.1) }}
                />
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            className="mt-12 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 md:p-8 shadow-lg border border-green-100 dark:border-green-800/30 relative overflow-hidden"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            viewport={{ once: true }}
          >
            {/* Decorative elements */}
            <motion.div 
              className="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/30 blur-xl"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{ duration: 5, repeat: Infinity, repeatType: "reverse" }}
            />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">IL Protection Calculator</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 md:mb-0">
                  Calculate your potential impermanent loss and see how our protection mechanisms can help
                </p>
              </div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link 
                  href="/calculator"
                  className="inline-flex items-center px-6 py-3 rounded-lg font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-lg transition-all duration-300 whitespace-nowrap group"
                >
                  Try the Calculator <ArrowRightIcon className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ImpermanentLossProtection;