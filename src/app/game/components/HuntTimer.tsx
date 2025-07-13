'use client';

import { useState, useEffect } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';

interface HuntTimerProps {
  hunterId: number;
  initialTimeRemaining: number;
  onTimerComplete?: () => void;
  showIcon?: boolean;
  className?: string;
}

export default function HuntTimer({ 
  hunterId, 
  initialTimeRemaining, 
  onTimerComplete, 
  showIcon = true,
  className = '' 
}: HuntTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining);
  const [isReady, setIsReady] = useState(initialTimeRemaining === 0);

  useEffect(() => {
    setTimeRemaining(initialTimeRemaining);
    setIsReady(initialTimeRemaining === 0);
  }, [initialTimeRemaining]);

  useEffect(() => {
    if (timeRemaining <= 0) {
      setIsReady(true);
      onTimerComplete?.();
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = Math.max(0, prev - 1);
        if (newTime === 0) {
          setIsReady(true);
          onTimerComplete?.();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, onTimerComplete]);

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return 'Ready to hunt!';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const getStatusColor = () => {
    if (isReady) return 'text-green-500';
    if (timeRemaining < 300) return 'text-yellow-500'; // Less than 5 minutes
    return 'text-gray-400';
  };

  const getBackgroundColor = () => {
    if (isReady) return 'bg-green-50 border-green-200';
    if (timeRemaining < 300) return 'bg-yellow-50 border-yellow-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${getBackgroundColor()} ${className}`}>
      {showIcon && (
        <ClockIcon className={`h-4 w-4 ${getStatusColor()}`} />
      )}
      <span className={`text-sm font-medium ${getStatusColor()}`}>
        {isReady ? (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Ready to hunt!
          </span>
        ) : (
          formatTime(timeRemaining)
        )}
      </span>
    </div>
  );
}