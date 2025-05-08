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
      className="bg-gradient-to-br from-white to-blue-50 dark:from-gray-800 dark:to-gray-800/90 rounded-xl overflow-hidden shadow-xl border border-blue-100 dark:border-blue-800/30 hover:border-btb-primary/50 dark:hover:border-btb-primary/50 transition-all duration-300"
      whileHover={{ y: -8, boxShadow: "0 15px 30px -10px rgba(59, 130, 246, 0.3)" }}
      animate={{ scale: isExpanded ? 1.02 : 1 }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {/* Card Header */}
      <div className="relative">
        <div className="h-28 bg-gradient-to-r from-btb-primary via-blue-500 to-indigo-600 relative overflow-hidden">
          {/* Animated particle effects in header */}
          <div className="absolute inset-0">
            {[...Array(15)].map((_, i) => (
              <motion.div 
                key={i}
                className="absolute rounded-full bg-white/20"
                style={{
                  width: Math.random() * 6 + 2 + 'px',
                  height: Math.random() * 6 + 2 + 'px',
                  left: Math.random() * 100 + '%',
                  top: Math.random() * 100 + '%',
                }}
                animate={{
                  y: [0, Math.random() * -20 - 5, 0],
                  x: [0, Math.random() * 10 - 5, 0],
                  opacity: [0.2, 0.6, 0.2],
                }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>
        
        <div className="absolute -bottom-12 left-6">
          <motion.div 
            className="rounded-full h-24 w-24 border-4 border-white dark:border-gray-800 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-700 dark:to-amber-800 flex items-center justify-center shadow-xl"
            animate={{ 
              boxShadow: ["0 10px 25px -15px rgba(251, 191, 36, 0.4)", "0 15px 35px -15px rgba(251, 191, 36, 0.6)", "0 10px 25px -15px rgba(251, 191, 36, 0.4)"]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
          >
            <motion.span 
              className="text-5xl"
              animate={{ rotate: [0, 10, 0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              🐻
            </motion.span>
          </motion.div>
        </div>
        
        <div className="absolute top-4 right-4 flex items-center">
          <div className={`h-4 w-4 rounded-full ${getStatusColor()} ring-2 ring-white shadow-lg flex items-center justify-center text-white text-[8px] font-bold`}>
            {hunter.inHibernation ? "!" : ""}
          </div>
          <span className="ml-2 text-xs font-semibold bg-black/30 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
            {hunter.inHibernation 
              ? 'Hibernating' 
              : hunter.recoveryStartTime > 0 
                ? 'Recovering' 
                : 'Active'}
          </span>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="pt-14 pb-5 px-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-btb-primary to-blue-600 dark:from-btb-primary-light dark:to-blue-400">
              Hunter #{hunter.id}
            </h3>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Created {formatDistanceToNow(new Date(hunter.creationTime * 1000), { addSuffix: true })}
            </div>
          </div>
          
          {timeLeft.canFeed && (
            <motion.div 
              className="bg-green-400/20 dark:bg-green-500/30 border border-green-400/30 dark:border-green-500/30 rounded-full px-2 py-0.5 text-green-700 dark:text-green-300 text-xs font-medium"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              Ready to Feed
            </motion.div>
          )}
        </div>
        
        {/* Power Display */}
        <div className="mb-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-btb-primary dark:text-btb-primary-light mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span className="font-bold text-sm">Hunter Power</span>
            </div>
            <span className="font-bold text-lg text-btb-primary dark:text-btb-primary-light">
              {parseFloat(hunter.power).toFixed(2)}
              <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">MiMo</span>
            </span>
          </div>
          
          <div className="bg-white dark:bg-gray-900 h-4 rounded-full overflow-hidden shadow-inner border border-blue-100 dark:border-blue-900/50 relative mb-1">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-btb-primary via-blue-500 to-indigo-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${getPowerPercentage()}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <div className="absolute inset-0 bg-opacity-50 overflow-hidden flex">
                {[...Array(20)].map((_, i) => (
                  <div 
                    key={i} 
                    className="h-full w-1 bg-white/20 transform -skew-x-12"
                    style={{
                      left: `${i * 8}%`,
                      opacity: 0.5 + Math.random() * 0.5
                    }}
                  ></div>
                ))}
              </div>
            </motion.div>
          </div>
          
          <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
            <span>Base (10)</span>
            <span className="font-medium">
              {getPowerPercentage().toFixed(0)}% growth
            </span>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-xl border border-green-100 dark:border-green-800/30">
            <div className="text-green-700 dark:text-green-400 font-medium flex items-center mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              Feed Status
            </div>
            <div className="text-xs flex justify-between items-center">
              <span>Last Fed:</span>
              <span className="font-medium">{formatDistanceToNow(new Date(hunter.lastFeedTime * 1000), { addSuffix: true })}</span>
            </div>
            <div className="text-xs flex justify-between items-center mt-1">
              <span>Next Feed:</span>
              <span className="font-medium">{timeLeft.feedCountdown}</span>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
            <div className="text-blue-700 dark:text-blue-400 font-medium flex items-center mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Hunt Status
            </div>
            <div className="text-xs flex justify-between items-center">
              <span>Last Hunt:</span>
              <span className="font-medium">{formatDistanceToNow(new Date(hunter.lastHuntTime * 1000), { addSuffix: true })}</span>
            </div>
            <div className="text-xs flex justify-between items-center mt-1">
              <span>Next Hunt:</span>
              <span className="font-medium">{timeLeft.huntCountdown}</span>
            </div>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 mb-5 text-center">
          <div className="bg-gray-100 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Total Hunted</div>
            <div className="font-bold text-btb-primary dark:text-btb-primary-light">
              {parseFloat(hunter.totalHunted).toFixed(0)}
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Days Remaining</div>
            <div className="font-bold text-btb-primary dark:text-btb-primary-light">
              {hunter.daysRemaining}
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="text-[10px] text-gray-500 dark:text-gray-400">Missed Feeds</div>
            <div className={`font-bold ${hunter.missedFeedings > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
              {hunter.missedFeedings}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-between gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFeed(hunter.id);
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white font-medium shadow-lg hover:shadow-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            Feed Hunter
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onHunt(hunter.id);
            }}
            disabled={!hunter.canHuntNow}
            className={`flex-1 py-2.5 px-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center ${
              hunter.canHuntNow 
                ? 'bg-gradient-to-br from-btb-primary to-blue-600 text-white hover:from-btb-primary/90 hover:to-blue-700'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            {hunter.canHuntNow ? 'Hunt Now' : 'Cannot Hunt'}
          </button>
        </div>
      </div>
      
      {/* Expanded Section */}
      {isExpanded && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="px-6 pb-5 bg-gradient-to-b from-blue-50/50 to-gray-50 dark:from-blue-900/10 dark:to-gray-900/50"
        >
          <div className="py-4 border-t border-blue-100 dark:border-blue-800/30">
            <div className="flex items-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-btb-primary dark:text-btb-primary-light mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <h4 className="font-bold text-btb-primary dark:text-btb-primary-light">Hunter Details</h4>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="bg-white/70 dark:bg-gray-800/50 rounded-lg p-2.5 flex justify-between items-center border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  Creation Date
                </span>
                <span className="font-medium">{new Date(hunter.creationTime * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/50 rounded-lg p-2.5 flex justify-between items-center border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  Days Remaining
                </span>
                <span className="font-medium">{hunter.daysRemaining} days</span>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/50 rounded-lg p-2.5 flex justify-between items-center border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  Total Hunted
                </span>
                <span className="font-medium">{parseFloat(hunter.totalHunted).toFixed(2)} MiMo</span>
              </div>
              
              <div className="bg-white/70 dark:bg-gray-800/50 rounded-lg p-2.5 flex justify-between items-center border border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Missed Feedings
                </span>
                <span className={`font-medium ${hunter.missedFeedings > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
                  {hunter.missedFeedings}
                </span>
              </div>
              
              {!hunter.canHuntNow && (
                <div className="mt-3 p-3 bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border border-yellow-200 dark:border-yellow-800/50 text-yellow-800 dark:text-yellow-200 rounded-lg text-sm flex items-start">
                  <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <span className="font-medium">Hunt Status:</span> {hunter.huntReason || 'Cannot hunt right now'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}