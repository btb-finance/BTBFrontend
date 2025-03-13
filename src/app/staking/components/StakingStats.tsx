import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  CurrencyDollarIcon,
  UserGroupIcon,
  ClockIcon,
  TicketIcon
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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      clearTimeout(delay);
    };
  }, [initialValue, maxValue, duration, startDelay, fluctuationRange]);
  
  return count;
};

export default function StakingStats() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Animated stats with continuous growth and fluctuations
  const totalStaked = useAnimatedCounter(42500000, 100000000, 3000, 0, 50000);
  const activeStakers = useAnimatedCounter(1250, 5000, 3000, 200, 5);
  const averageLockTime = useAnimatedCounter(9, 12, 3000, 400, 0.2);
  const subscriptionsIssued = useAnimatedCounter(850, 3000, 3000, 600, 3);
  
  const stats = [
    {
      name: 'Total BTB Staked',
      value: mounted ? `${totalStaked.toLocaleString()} BTB` : '0 BTB',
      icon: CurrencyDollarIcon,
      color: 'bg-blue-500/10 text-blue-500',
      valueClass: 'text-blue-500'
    },
    {
      name: 'Active Stakers',
      value: mounted ? activeStakers.toLocaleString() : '0',
      icon: UserGroupIcon,
      color: 'bg-green-500/10 text-green-500',
      valueClass: 'text-green-500'
    },
    {
      name: 'Average Lock Time',
      value: mounted ? `${averageLockTime.toFixed(1)} months` : '0 months',
      icon: ClockIcon,
      color: 'bg-purple-500/10 text-purple-500',
      valueClass: 'text-purple-500'
    },
    {
      name: 'Subscriptions Issued',
      value: mounted ? subscriptionsIssued.toLocaleString() : '0',
      icon: TicketIcon,
      color: 'bg-amber-500/10 text-amber-500',
      valueClass: 'text-amber-500'
    }
  ];
  
  return (
    <div className="max-w-7xl mx-auto mb-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="p-6 h-full">
              <div className="flex items-start">
                <div className={`w-12 h-12 rounded-full ${stat.color} flex items-center justify-center mr-4`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{stat.name}</p>
                  <h3 className={`text-2xl font-bold ${stat.valueClass}`}>{stat.value}</h3>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
