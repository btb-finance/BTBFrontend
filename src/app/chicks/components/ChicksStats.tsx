'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/app/components/ui/card';

// Enhanced animated counter with continuous fluctuations
const useAnimatedCounter = (
  initialValue: number, 
  maxValue: number, 
  duration: number = 2000, 
  startDelay: number = 0,
  fluctuationRange: number = 0
) => {
  const [count, setCount] = useState(0);
  const animationRef = useRef<number>();
  const startTimeRef = useRef<number>();
  const currentValueRef = useRef<number>(0);
  
  useEffect(() => {
    let delay: NodeJS.Timeout;
    
    const updateCounter = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsedTime = timestamp - startTimeRef.current;
      
      // Initial animation to reach the initial value
      if (elapsedTime < duration) {
        const progress = elapsedTime / duration;
        currentValueRef.current = initialValue * progress;
      } else {
        // After initial animation, continuously increase with fluctuations
        const additionalProgress = (elapsedTime - duration) / (100000); // Slow continuous growth
        const baseValue = Math.min(initialValue + (maxValue - initialValue) * additionalProgress, maxValue);
        
        // Add random fluctuations
        if (fluctuationRange > 0) {
          const fluctuation = (Math.random() * 2 - 1) * fluctuationRange;
          currentValueRef.current = baseValue + fluctuation;
        } else {
          currentValueRef.current = baseValue;
        }
      }
      
      setCount(Math.floor(currentValueRef.current));
      animationRef.current = requestAnimationFrame(updateCounter);
    };
    
    delay = setTimeout(() => {
      animationRef.current = requestAnimationFrame(updateCounter);
    }, startDelay);
    
    return () => {
      if (delay) clearTimeout(delay);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [initialValue, maxValue, duration, startDelay, fluctuationRange]);
  
  return count;
};

// Format number with commas and handle decimals
const formatNumber = (num: number, decimals: number = 0): string => {
  if (decimals > 0) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  return num.toLocaleString('en-US');
};

// Format currency with $ sign
const formatCurrency = (num: number, decimals: number = 0): string => {
  return '$' + formatNumber(num, decimals);
};

export default function ChicksStats() {
  // Animated counters with continuous fluctuations - adjusted to match memory requirements
  const tvl = useAnimatedCounter(20000, 100000000, 3000, 0, 5000); // Increased fluctuation range
  const chicksPrice = useAnimatedCounter(0.001, 1, 5000, 500, 0.0005); // Increased micro-fluctuations
  const holders = useAnimatedCounter(1, 10000, 4000, 1000, 5); // Added small fluctuations for more dynamic feel
  const apy = useAnimatedCounter(5000, 5005, 2000, 1500, 1); // Increased micro-fluctuations
  
  const stats = [
    {
      name: 'Total Value Locked',
      value: formatCurrency(tvl),
      icon: CurrencyDollarIcon,
      color: 'bg-gradient-to-r from-green-500 to-emerald-600',
      textColor: 'text-green-600 dark:text-green-400'
    },
    {
      name: 'CHICKS Price',
      value: formatCurrency(chicksPrice, 6),
      icon: CurrencyDollarIcon,
      color: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      name: 'Holders',
      value: formatNumber(holders),
      icon: UserGroupIcon,
      color: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      textColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      name: 'APY',
      value: formatNumber(apy, 1) + '%',
      icon: ClockIcon,
      color: 'bg-gradient-to-r from-amber-500 to-orange-600',
      textColor: 'text-amber-600 dark:text-amber-400'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.name}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: index * 0.1 }}
          whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
        >
          <Card className="border border-gray-200 dark:border-gray-800 h-full overflow-hidden">
            <motion.div 
              className={`h-2 ${stat.color}`}
              animate={{ 
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ 
                duration: 10, 
                repeat: Infinity,
                ease: "linear" 
              }}
              style={{ backgroundSize: '200% 200%' }}
            ></motion.div>
            <div className="p-6">
              <div className="flex items-center mb-2">
                <motion.div 
                  className={`p-2 rounded-full ${stat.color} bg-opacity-20 mr-3`}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <stat.icon className="w-5 h-5 text-white" />
                </motion.div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.name}</h3>
              </div>
              <motion.p 
                className={`text-2xl font-bold ${stat.textColor}`}
                animate={{ opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {stat.value}
              </motion.p>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
