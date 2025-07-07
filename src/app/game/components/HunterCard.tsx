'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import gameService from '../services/gameService';
import { 
  FireIcon, 
  ShieldExclamationIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface HunterCardProps {
  hunter: any;
  onFeed: () => void;
  onHunt: () => void;
}

export default function HunterCard({ hunter, onFeed, onHunt }: HunterCardProps) {
  const [isFeeding, setIsFeeding] = useState(false);
  const [isHunting, setIsHunting] = useState(false);

  const handleFeed = async () => {
    if (!hunter.canFeed || hunter.inHibernation) return;

    try {
      setIsFeeding(true);
      await gameService.feedHunters([parseInt(hunter.tokenId)]);
      onFeed();
    } catch (error) {
      console.error('Error feeding hunter:', error);
    } finally {
      setIsFeeding(false);
    }
  };

  const handleHunt = async () => {
    if (!hunter.canHunt || !hunter.isActive) return;

    try {
      setIsHunting(true);
      await gameService.hunt([parseInt(hunter.tokenId)], []);
      onHunt();
    } catch (error) {
      console.error('Error hunting:', error);
    } finally {
      setIsHunting(false);
    }
  };

  const getStatusInfo = () => {
    if (hunter.daysRemaining === 0) {
      return {
        status: 'Expired',
        color: 'text-red-500',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        icon: ExclamationTriangleIcon,
        description: 'This hunter has expired and cannot be used'
      };
    }
    if (hunter.inHibernation) {
      return {
        status: 'Hibernating',
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        icon: ClockIcon,
        description: 'Feed to wake up from hibernation'
      };
    }
    if (hunter.recoveryStartTime > 0) {
      return {
        status: 'Recovering',
        color: 'text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-900/20',
        icon: ClockIcon,
        description: 'Recovering from hibernation'
      };
    }
    if (!hunter.canFeed && !hunter.canHunt) {
      return {
        status: 'Resting',
        color: 'text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        icon: ClockIcon,
        description: 'Recently fed and hunted, on cooldown'
      };
    }
    if (!hunter.canFeed) {
      return {
        status: 'Fed',
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        icon: FireIcon,
        description: 'Recently fed, ready to hunt'
      };
    }
    if (!hunter.canHunt) {
      return {
        status: 'Ready to Feed',
        color: 'text-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        icon: FireIcon,
        description: 'Ready for feeding'
      };
    }
    return {
      status: 'Active',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      icon: SparklesIcon,
      description: 'Ready for feeding and hunting'
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Hunter Avatar */}
          <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg flex items-center justify-center text-2xl">
            ⚔️
          </div>

          {/* Hunter Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                Hunter #{hunter.tokenId}
              </h4>
              <div className={`px-2 py-1 rounded-full ${statusInfo.bgColor} flex items-center gap-1`}>
                <statusInfo.icon className={`h-3 w-3 ${statusInfo.color}`} />
                <span className={`text-xs font-medium ${statusInfo.color}`}>
                  {statusInfo.status}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Power</p>
                <p className="font-semibold">{parseFloat(hunter.power || '0').toString()}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Days Left</p>
                <p className="font-semibold">{hunter.daysRemaining || 0}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Total Hunted</p>
                <p className="font-semibold">{parseFloat(hunter.totalHunted || '0').toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Missed Feeds</p>
                <p className="font-semibold">{hunter.missedFeedings || 0}</p>
              </div>
            </div>

            {/* Status Description */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              {statusInfo.description}
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleFeed}
                disabled={isFeeding || !hunter.canFeed || hunter.inHibernation || hunter.daysRemaining === 0}
                className="flex-1 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 border-red-200 text-red-700 dark:from-red-900/20 dark:to-pink-900/20 dark:border-red-800 dark:text-red-300"
              >
                {isFeeding ? (
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500"></div>
                    <span className="text-xs">Feeding...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <FireIcon className="h-3 w-3" />
                    <span className="text-xs">Feed</span>
                  </div>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleHunt}
                disabled={isHunting || !hunter.canHunt || !hunter.isActive || hunter.daysRemaining === 0}
                className="flex-1 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-purple-200 text-purple-700 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800 dark:text-purple-300"
              >
                {isHunting ? (
                  <div className="flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-500"></div>
                    <span className="text-xs">Hunting...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <ShieldExclamationIcon className="h-3 w-3" />
                    <span className="text-xs">Hunt</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar for Days Remaining */}
        {hunter.daysRemaining > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span>Lifespan</span>
              <span>{hunter.daysRemaining} days left</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-400 to-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.max(5, (hunter.daysRemaining / 90) * 100)}%` // Assuming 90 days max lifespan
                }}
              ></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}