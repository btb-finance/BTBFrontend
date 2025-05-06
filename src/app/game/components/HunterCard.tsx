'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';
import { formatDistanceToNow } from 'date-fns';

interface HunterCardProps {
  hunter: Hunter;
  onFeed: (hunterId: number) => void;
  onHunt: (hunterId: number) => void;
}

export default function HunterCard({ hunter, onFeed, onHunt }: HunterCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    canFeed: false,
    canHunt: false,
    feedCountdown: '',
    huntCountdown: '',
  });

  // Update countdowns
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      
      // Feeding countdown (20 hours)
      const feedCooldown = hunter.lastFeedTime + 20 * 60 * 60;
      const canFeed = now >= feedCooldown;
      const feedTimeLeft = feedCooldown > now ? feedCooldown - now : 0;
      
      // Hunt countdown (24 hours)
      const huntCooldown = hunter.lastHuntTime + 24 * 60 * 60;
      const canHunt = now >= huntCooldown && hunter.canHuntNow;
      const huntTimeLeft = huntCooldown > now ? huntCooldown - now : 0;
      
      // Format the countdown strings
      const formatTime = (seconds: number) => {
        if (seconds <= 0) return 'Ready';
        
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        
        return `${hours}h ${mins}m`;
      };
      
      setTimeLeft({
        canFeed,
        canHunt,
        feedCountdown: formatTime(feedTimeLeft),
        huntCountdown: formatTime(huntTimeLeft),
      });
    };
    
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, [hunter]);

  // Card status and power calculations
  const getStatusColor = () => {
    if (hunter.inHibernation) return 'bg-red-500';
    if (hunter.recoveryStartTime > 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPowerPercentage = () => {
    const baseValue = 10;
    const power = parseFloat(hunter.power);
    const percentage = Math.min((power / baseValue - 1) * 100, 100);
    return Math.max(percentage, 0);
  };

  // Render the card
  return (
    <motion.div 
      className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-200 dark:border-gray-700"
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      animate={{ scale: isExpanded ? 1.02 : 1 }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Card Header */}
      <div className="relative">
        <div className="h-24 bg-gradient-to-r from-btb-primary to-blue-600"></div>
        <div className="absolute -bottom-10 left-6">
          <div className="rounded-full h-20 w-20 border-4 border-white dark:border-gray-800 bg-gray-100 dark:bg-gray-700 flex items-center justify-center shadow-md">
            <span className="text-4xl">🐻</span>
          </div>
        </div>
        <div className={`absolute top-4 right-4 h-3 w-3 rounded-full ${getStatusColor()}`}></div>
      </div>
      
      {/* Card Content */}
      <div className="pt-12 pb-4 px-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold">Hunter #{hunter.id}</h3>
          <span className="text-sm bg-btb-primary/20 text-btb-primary dark:text-btb-primary-light py-1 px-2 rounded">
            {hunter.inHibernation 
              ? 'Hibernating' 
              : hunter.recoveryStartTime > 0 
                ? 'Recovering' 
                : 'Active'}
          </span>
        </div>
        
        {/* Power Display */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span>Hunter Power</span>
            <span className="font-semibold">{parseFloat(hunter.power).toFixed(2)} MiMo</span>
          </div>
          <div className="bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-btb-primary h-full"
              style={{ width: `${getPowerPercentage()}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {getPowerPercentage().toFixed(0)}% growth from base power
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
            <div className="text-gray-500 dark:text-gray-400">Last Fed</div>
            <div className="font-medium">
              {formatDistanceToNow(hunter.lastFeedTime * 1000, { addSuffix: true })}
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
            <div className="text-gray-500 dark:text-gray-400">Last Hunt</div>
            <div className="font-medium">
              {formatDistanceToNow(hunter.lastHuntTime * 1000, { addSuffix: true })}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFeed(hunter.id);
            }}
            disabled={!timeLeft.canFeed}
            className={`flex-1 py-2 rounded-md text-white ${
              timeLeft.canFeed 
                ? 'bg-green-500 hover:bg-green-600' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {timeLeft.canFeed ? 'Feed' : timeLeft.feedCountdown}
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHunt(hunter.id);
            }}
            disabled={!timeLeft.canHunt}
            className={`flex-1 py-2 rounded-md text-white ${
              timeLeft.canHunt 
                ? 'bg-btb-primary hover:bg-blue-600' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {timeLeft.canHunt ? 'Hunt' : timeLeft.huntCountdown}
          </button>
        </div>
      </div>
      
      {/* Expanded Section */}
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-6 pb-4 bg-gray-50 dark:bg-gray-900"
        >
          <div className="py-3 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-bold mb-2">Hunter Details</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Creation Date</span>
                <span>{new Date(hunter.creationTime * 1000).toLocaleDateString()}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Days Remaining</span>
                <span>{hunter.daysRemaining} days</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Total Hunted</span>
                <span>{parseFloat(hunter.totalHunted).toFixed(2)} MiMo</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Missed Feedings</span>
                <span className={hunter.missedFeedings > 0 ? 'text-red-500' : ''}>
                  {hunter.missedFeedings}
                </span>
              </div>
              
              {!hunter.canHuntNow && (
                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                  {hunter.huntReason || 'Cannot hunt right now'}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}