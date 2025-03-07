'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import { useInView } from 'framer-motion';

const achievements = [
  { 
    id: 1, 
    title: 'Innovative Trading', 
    description: 'Revolutionary bonding curve mechanism',
    icon: '🚀',
    color: 'from-violet-500 to-purple-600'
  },
  { 
    id: 2, 
    title: 'Optimism Powered', 
    description: 'Built on BASE',
    icon: '⚡',
    color: 'from-cyan-400 to-blue-600'
  },
  { 
    id: 3, 
    title: 'Community Governed', 
    description: 'Fully decentralized protocol',
    icon: '🏛️',
    color: 'from-emerald-400 to-teal-600'
  },
  { 
    id: 4, 
    title: 'Yield Optimized', 
    description: 'Advanced IL protection',
    icon: '🛡️',
    color: 'from-rose-400 to-red-600'
  },
];

export default function Stats() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, amount: 0.2 });
  
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 py-24 sm:py-32">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-white/10 blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.2, 0.1]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full border border-white/10"
          animate={{ 
            opacity: [0.1, 0.3, 0.1],
            rotate: [0, 360]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
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
              <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">Leading the DeFi Revolution</span>
            </motion.h2>
            <motion.p 
              className="mt-4 text-lg leading-8 text-white/90"
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              Empowering users with cutting-edge financial tools on the BASE ecosystem
            </motion.p>
          </div>
          
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {achievements.map((item, index) => (
              <motion.div 
                key={item.id} 
                className="relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border-2 border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-white/40"
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                whileHover={{ y: -5, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)" }}
              >
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color}`}></div>
                <div className="p-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <motion.div 
                      className={`h-16 w-16 rounded-full flex items-center justify-center bg-gradient-to-r ${item.color} bg-opacity-20 shadow-lg group-hover:shadow-2xl transition-all duration-300`}
                      whileHover={{ scale: 1.1, rotate: [0, -10, 10, -10, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      <span className="text-3xl transform group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                    </motion.div>
                  </div>
                  <motion.h3 
                    className={`text-xl font-bold tracking-tight bg-gradient-to-r ${item.color} bg-clip-text text-transparent mb-2`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
                    transition={{ 
                      type: "spring", 
                      stiffness: 100, 
                      delay: 0.3 + index * 0.1,
                      duration: 0.8
                    }}
                  >
                    {item.title}
                  </motion.h3>
                  <p className="text-sm font-medium text-white/90">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
