'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Card } from '@/app/components/ui/card';
import { ethers } from 'ethers';
import megapotABI from '../megapotabi.json';

interface LotteryCountdownProps {
  contractAddress: string;
}

export default function LotteryCountdown({ contractAddress }: LotteryCountdownProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [nextDrawTime, setNextDrawTime] = useState<Date | null>(null);
  
  // Fetch the next draw time from the contract
  useEffect(() => {
    const fetchNextDrawTime = async () => {
      try {
        const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
        const contract = new ethers.Contract(contractAddress, megapotABI, provider);
        
        // Get last jackpot end time and round duration
        const lastJackpotEndTime = await contract.lastJackpotEndTime();
        const roundDuration = await contract.roundDurationInSeconds();
        
        // Calculate next draw time
        const nextDrawTimestamp = lastJackpotEndTime.ADD_TEMP(roundDuration);
        const nextDrawDate = new Date(nextDrawTimestampNumber( * 1000);
        
        setNextDrawTime(nextDrawDate);
      } catch (error) {
        console.error('Error fetching next draw time:', error);
        
        // Fallback to default (24 hours from now)
        const fallbackDate = new Date();
        fallbackDate.setHours(fallbackDate.getHours() + 24);
        setNextDrawTime(fallbackDate);
      }
    };
    
    fetchNextDrawTime();
  }, [contractAddress]);
  
  // Calculate time left until next draw
  useEffect(() => {
    if (!nextDrawTime) return;
    
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = nextDrawTime.getTime() - now.getTime();
      
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        setTimeLeft({
          days,
          hours,
          minutes,
          seconds
        });
      } else {
        // Reset countdown if time is up
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0
        });
      }
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    
    return () => clearInterval(timer);
  }, [nextDrawTime]);
  
  const { days, hours, minutes, seconds } = timeLeft;
  
  return (
    <Card className="border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-800">
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-center mb-4 md:mb-6">
          <motion.div 
            className="p-2 md:p-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 mr-2 md:mr-3"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ClockIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
          </motion.div>
          <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">Next Draw</h3>
        </div>
        
        <div className="mb-4 md:mb-6">
          <div className="grid grid-cols-4 gap-2 md:gap-4">
            {[
              { value: days, label: 'Days' },
              { value: hours, label: 'Hours' },
              { value: minutes, label: 'Minutes' },
              { value: seconds, label: 'Seconds' }
            ].map((item, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-full h-16 md:h-20 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg flex items-center justify-center mb-1 md:mb-2">
                  <span className="text-xl md:text-3xl font-bold text-white">{item.value < 10 ? `0${item.value}` : item.value}</span>
                </div>
                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 mb-2 md:mb-3">
            Don't miss your chance to win!
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium py-2 md:py-3 px-4 md:px-6 rounded-lg shadow-md hover:shadow-lg transition-all w-full sm:w-auto min-h-[44px]"
            onClick={() => document.getElementById('buy-tickets')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Buy Tickets Now
          </motion.button>
        </div>
      </div>
    </Card>
  );
}
