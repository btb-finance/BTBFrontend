'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGame, Hunter } from './GameContext';
import { formatDistanceToNow } from 'date-fns';
import { useWalletConnection } from '../../hooks/useWalletConnection';

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
      
      // Debug timestamps
      console.log('Current time (Unix):', now);
      console.log('Last feed time (Unix):', hunter.lastFeedTime);
      console.log('Last hunt time (Unix):', hunter.lastHuntTime);
      
      // Check if timestamps are in the future
      const isFeedTimeInFuture = hunter.lastFeedTime > now;
      const isHuntTimeInFuture = hunter.lastHuntTime > now;
      
      if (isFeedTimeInFuture || isHuntTimeInFuture) {
        console.warn('⚠️ Warning: Timestamps are in the future. This may indicate an issue with the contract or blockchain time.');
        console.warn('Feed time in future:', isFeedTimeInFuture, 'Hunt time in future:', isHuntTimeInFuture);
      }
      
      // Constants (these would ideally be read from the contract)
      // The contract has RECOVERY_PERIOD which is for feeding
      const FEED_COOLDOWN_SECONDS = 86400; // 24 hours in seconds (contract uses days)
      const HUNT_COOLDOWN_SECONDS = 86400; // 24 hours in seconds
      
      // For times in the future, we'll treat them as if they were now
      const effectiveLastFeedTime = isFeedTimeInFuture ? now : hunter.lastFeedTime;
      const effectiveLastHuntTime = isHuntTimeInFuture ? now : hunter.lastHuntTime;
      
      // Feeding countdown
      const feedCooldown = effectiveLastFeedTime + FEED_COOLDOWN_SECONDS;
      // Can feed if enough time has passed since last feeding
      const canFeed = now >= feedCooldown;
      const feedTimeLeft = feedCooldown > now ? feedCooldown - now : 0;
      
      console.log('Feed cooldown ends (Unix):', feedCooldown);
      console.log('Can feed now:', canFeed);
      console.log('Feed time left (seconds):', feedTimeLeft);
      
      // Hunt countdown
      const huntCooldown = effectiveLastHuntTime + HUNT_COOLDOWN_SECONDS;
      // Can hunt if: cooldown period is over AND hunter is active (can hunt)
      const canHunt = now >= huntCooldown && hunter.canHuntNow;
      const huntTimeLeft = huntCooldown > now ? huntCooldown - now : 0;
      
      console.log('Hunt cooldown ends (Unix):', huntCooldown);
      console.log('Can hunt now:', canHunt);
      console.log('Hunt time left (seconds):', huntTimeLeft);
      
      // If the hunter has the canHuntNow flag set to true (directly from contract),
      // we can override our calculation for UX purposes
      const huntStatus = hunter.canHuntNow ? 'Ready' : 'Can\'t Hunt';
      
      // Format the countdown strings
      const formatTime = (seconds: number) => {
        if (seconds <= 0) return 'Ready';
        
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        
        return `${hours}h ${mins}m`;
      };
      
      setTimeLeft({
        canFeed,
        canHunt: hunter.canHuntNow ? true : false,
        feedCountdown: formatTime(feedTimeLeft),
        huntCountdown: hunter.canHuntNow ? huntStatus : formatTime(huntTimeLeft),
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
              {new Date(hunter.lastFeedTime * 1000).toLocaleString()} 
              <div className="text-xs text-gray-500">Unix: {hunter.lastFeedTime}</div>
            </div>
          </div>
          <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded">
            <div className="text-gray-500 dark:text-gray-400">Last Hunt</div>
            <div className="font-medium">
              {new Date(hunter.lastHuntTime * 1000).toLocaleString()}
              <div className="text-xs text-gray-500">Unix: {hunter.lastHuntTime}</div>
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
            className={`flex-1 py-2 rounded-md text-white ${
              'bg-green-500 hover:bg-green-600' 
            }`}
          >
            Feed
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHunt(hunter.id);
            }}
            disabled={!hunter.canHuntNow}
            className={`flex-1 py-2 rounded-md text-white ${
              hunter.canHuntNow 
                ? 'bg-btb-primary hover:bg-blue-600' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {hunter.canHuntNow ? 'Hunt' : 'Cannot Hunt'}
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