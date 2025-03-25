'use client';

import { motion } from 'framer-motion';
import { 
  RocketLaunchIcon, 
  ShieldCheckIcon, 
  BanknotesIcon, 
  ArrowsRightLeftIcon,
  BoltIcon,
  UserGroupIcon,
  CubeTransparentIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/app/components/ui/card';

// A component to display CHICKS ecosystem features instead of live stats
export default function ChicksStats() {
  const features = [
    {
      name: 'Now Live on Mainnet',
      description: 'CHICKS has officially launched on Base mainnet - start earning rewards today!',
      icon: RocketLaunchIcon,
      color: 'bg-gradient-to-r from-red-500 to-pink-600',
      textColor: 'text-red-600 dark:text-red-400'
    },
    {
      name: 'Sustainable Yield',
      description: 'Earn rewards through our innovative backing system designed for long-term growth',
      icon: BanknotesIcon,
      color: 'bg-gradient-to-r from-green-500 to-emerald-600',
      textColor: 'text-green-600 dark:text-green-400'
    },
    {
      name: 'Advanced Security',
      description: 'Multiple audits and security measures to protect your investments',
      icon: ShieldCheckIcon,
      color: 'bg-gradient-to-r from-blue-500 to-indigo-600',
      textColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      name: 'Growing Community',
      description: 'Join thousands of active users building the future of DeFi together',
      icon: UserGroupIcon,
      color: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      textColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      name: 'Lightning Fast',
      description: 'Transactions confirmed in seconds with minimal gas fees on Base',
      icon: BoltIcon,
      color: 'bg-gradient-to-r from-amber-500 to-orange-600',
      textColor: 'text-amber-600 dark:text-amber-400'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {features.map((feature, index) => (
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
                Learn more
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
