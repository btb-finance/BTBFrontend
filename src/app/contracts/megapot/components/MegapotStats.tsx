'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  CurrencyDollarIcon,
  TicketIcon,
  UserIcon,
  TrophyIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/app/components/ui/card';
import { ethers } from 'ethers';
import megapotABI from '../megapotabi.json';

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

// Truncate ethereum address
const truncateAddress = (address: string): string => {
  if (!address || address === '0x0000000000000000000000000000000000000000') return 'No Winner Yet';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Create Basescan link for address
const getBasescanLink = (address: string): string => {
  if (!address || address === '0x0000000000000000000000000000000000000000') return '';
  return `https://basescan.org/address/${address}`;
};

interface MegapotStatsProps {
  jackpotAmount: number | null;
  ticketPrice: number | null;
  participants: number | null;
  lastWinner: string | null;
  isLoading: boolean;
  contractAddress: string;
}

export default function MegapotStats({ 
  jackpotAmount, 
  ticketPrice, 
  participants, 
  lastWinner, 
  isLoading,
  contractAddress
}: MegapotStatsProps) {
  // Always call hooks unconditionally
  const animatedJackpot = useAnimatedCounter(50000, 100000, 3000, 0, 5000);
  const animatedPrice = useAnimatedCounter(1, 1, 2000, 500, 0);
  const animatedParticipants = useAnimatedCounter(1000, 5000, 4000, 1000, 10);
  const [ticketsSold, setTicketsSold] = useState<number>(0);
  const [maxTickets, setMaxTickets] = useState<number>(10000);
  
  // Fetch tickets sold data
  useEffect(() => {
    const fetchTicketsSold = async () => {
      try {
        const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(contractAddress, megapotABI, provider);
        
        // Get tickets count total
        const ticketCountTotalBps = await contract.ticketCountTotalBps();
        // Convert from basis points (multiply by 10000)
        const actualTicketCount = ticketCountTotalBps.div(10000).toNumber();
        setTicketsSold(actualTicketCount);
        
        // Set max tickets to a reasonable value above current count
        setMaxTickets(Math.max(10000, actualTicketCount * 2));
      } catch (error) {
        console.error('Error fetching tickets sold:', error);
        // Use fallback value
        setTicketsSold(5000);
      }
    };
    
    fetchTicketsSold();
  }, [contractAddress]);
  
  // Use real data if available, otherwise use animated values
  const jackpot = isLoading ? animatedJackpot : (jackpotAmount ?? 0);
  const price = isLoading ? animatedPrice : (ticketPrice ?? 0);
  const participantsCount = isLoading ? animatedParticipants : (participants ?? 0);
  
  const stats = [
    {
      name: 'Current Jackpot',
      value: jackpot !== null ? formatCurrency(jackpot) : 'N/A',
      icon: TrophyIcon,
      color: 'bg-gradient-to-r from-amber-500 to-orange-600',
      textColor: 'text-amber-600 dark:text-amber-400'
    },
    {
      name: 'Ticket Price',
      value: ticketPrice !== null ? formatCurrency(ticketPrice, 2) : 'N/A',
      icon: TicketIcon,
      color: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      name: 'Participants',
      value: participantsCount !== null ? formatNumber(participantsCount) : 'N/A',
      icon: UserIcon,
      color: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      textColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      name: 'Last Winner',
      value: lastWinner !== null ? truncateAddress(lastWinner) : 'N/A',
      link: lastWinner !== null ? getBasescanLink(lastWinner) : '',
      icon: CurrencyDollarIcon,
      color: 'bg-gradient-to-r from-green-500 to-emerald-600',
      textColor: 'text-green-600 dark:text-green-400'
    }
  ];

  return (
    <Card className="border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-800">
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center mb-4 md:mb-6">
          <motion.div 
            className="p-2 md:p-3 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 mr-2 md:mr-3"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ChartBarIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </motion.div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Lottery Stats</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className={`${stat.color} rounded-lg p-3 md:p-4 flex items-center`}
            >
              <div className="bg-white/20 rounded-full p-2 mr-3">
                <stat.icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-white/80">{stat.name}</p>
                {stat.link ? (
                  <a 
                    href={stat.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-base md:text-lg font-bold text-white hover:underline"
                  >
                    {stat.value}
                  </a>
                ) : (
                  <p className="text-base md:text-lg font-bold text-white">{stat.value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 md:mt-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 md:p-4">
            <h4 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3">Tickets Sold This Round</h4>
            <div className="relative h-4 md:h-5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <motion.div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-btb-primary to-btb-primary-light"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(100, (ticketsSold / maxTickets) * 100)}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1 md:mt-2 text-xs md:text-sm text-gray-600 dark:text-gray-400">
              <span>0</span>
              <span>{formatNumber(ticketsSold)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
