'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useInView } from 'framer-motion';

const stats = [
  { 
    id: 1, 
    name: 'Total Value Locked', 
    value: '$100M+',
    icon: '💰',
    color: 'from-pink-500 to-rose-500'
  },
  { 
    id: 2, 
    name: 'BTB Token Holders', 
    value: '50,000+',
    icon: '👥',
    color: 'from-blue-500 to-indigo-500'
  },
  { 
    id: 3, 
    name: 'Yield Farming Pools', 
    value: '100+',
    icon: '🌊',
    color: 'from-green-500 to-emerald-500'
  },
  { 
    id: 4, 
    name: 'Global Community', 
    value: '100,000+',
    icon: '🌎',
    color: 'from-amber-500 to-orange-500'
  },
];

export default function Stats() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.2 });
  
  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-btb-primary-dark via-btb-primary to-btb-primary-light py-24 sm:py-32">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full border border-white/10 opacity-20"></div>
      </div>
      
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8" ref={containerRef}>
        <motion.div 
          className="mx-auto max-w-2xl lg:max-w-none"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center">
            <motion.h2 
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl font-heading"
              initial={{ opacity: 0, y: -20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Leading the DeFi Revolution
            </motion.h2>
            <motion.p 
              className="mt-4 text-lg leading-8 text-white/90"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Join the BTB Finance ecosystem and be part of the future of decentralized finance
            </motion.p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <motion.div 
                key={stat.id} 
                className="relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl"
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)" }}
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.color}"></div>
                <div className="p-8 text-center">
                  <div className="mb-4 flex justify-center">
                    <span className="text-4xl">{stat.icon}</span>
                  </div>
                  <motion.p 
                    className="text-4xl font-bold text-white tracking-tight"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 100, 
                      delay: 0.3 + index * 0.1,
                      duration: 0.8
                    }}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="mt-2 text-sm font-medium text-white/80">{stat.name}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
