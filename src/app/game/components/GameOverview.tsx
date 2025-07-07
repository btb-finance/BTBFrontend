'use client';

import { motion } from 'framer-motion';
import { 
  ChartBarIcon,
  SparklesIcon,
  FireIcon,
  ShieldExclamationIcon,
  GiftIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

interface GameOverviewProps {
  gameStats: {
    mimoBalance: string;
    bearNFTBalance: string;
    hunterNFTBalance: string;
    btbBalance: string;
    totalHunted: string;
    swapRate: string;
  };
  hunterTokens: any[];
  bearTokens: any[];
}

export default function GameOverview({ gameStats, hunterTokens, bearTokens }: GameOverviewProps) {
  const gameFeatures = [
    {
      name: 'Deposit Bears',
      description: 'Deposit your Bear NFTs to receive Hunter NFTs and 1M MiMo tokens as rewards',
      icon: GiftIcon,
      color: 'bg-gradient-to-r from-orange-500 to-amber-600',
      textColor: 'text-orange-600 dark:text-orange-400',
      action: 'Start depositing your Bears to begin the hunt!'
    },
    {
      name: 'Feed Hunters',
      description: 'Feed your Hunter NFTs daily to increase their power and keep them active',
      icon: FireIcon,
      color: 'bg-gradient-to-r from-red-500 to-pink-600',
      textColor: 'text-red-600 dark:text-red-400',
      action: 'Keep your hunters strong with regular feeding'
    },
    {
      name: 'Hunt for MiMo',
      description: 'Use your powerful hunters to hunt MiMo tokens from other players',
      icon: ShieldExclamationIcon,
      color: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      textColor: 'text-purple-600 dark:text-purple-400',
      action: 'Start hunting to earn more MiMo tokens'
    },
    {
      name: 'Redeem Bears',
      description: 'Use 1M MiMo tokens to redeem Bear NFTs from the game treasury',
      icon: ArrowsRightLeftIcon,
      color: 'bg-gradient-to-r from-green-500 to-emerald-600',
      textColor: 'text-green-600 dark:text-green-400',
      action: 'Trade your MiMo tokens for valuable Bears'
    }
  ];

  const activeHunters = hunterTokens.filter(hunter => hunter.isActive);
  const hibernatingHunters = hunterTokens.filter(hunter => hunter.inHibernation);
  const expiredHunters = hunterTokens.filter(hunter => hunter.daysRemaining === 0);

  return (
    <div className="space-y-6">
      {/* Game Stats Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartBarIcon className="h-5 w-5" />
            Game Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {parseFloat(gameStats.mimoBalance).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">MiMo Tokens</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg">
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {gameStats.bearNFTBalance}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Bear NFTs</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {gameStats.hunterNFTBalance}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Hunter NFTs</p>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {parseFloat(gameStats.totalHunted).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Hunted</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hunter Status Overview */}
      {hunterTokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              Hunter Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {activeHunters.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Hunters</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {hibernatingHunters.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Hibernating</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {expiredHunters.length}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How to Play */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gameFeatures.map((feature, index) => (
          <motion.div
            key={feature.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            className="h-full"
          >
            <Card className="border border-gray-200 dark:border-gray-800 h-full overflow-hidden">
              <motion.div 
                className={`h-2 ${feature.color}`}
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
                <div className="flex items-center mb-4">
                  <motion.div 
                    className={`p-3 rounded-full ${feature.color} bg-opacity-20 mr-4`}
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <feature.icon className="w-6 h-6 text-white" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{feature.name}</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{feature.description}</p>
                <motion.div
                  className={`inline-flex items-center ${feature.textColor} text-sm font-medium`}
                  whileHover={{ x: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  {feature.action}
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg">
              <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Deposit Bear NFTs</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Start by depositing your Bear NFTs to receive Hunter NFTs and MiMo tokens</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
              <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Feed Your Hunters</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Feed your hunters daily to increase their power and prevent hibernation</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
              <div className="bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Start Hunting</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">Use your hunters to hunt MiMo tokens and grow your collection</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}