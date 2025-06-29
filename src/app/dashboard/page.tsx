'use client';

import { motion } from 'framer-motion';
import { Card } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { 
  WalletIcon, 
  ChartBarIcon, 
  BanknotesIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { useWallet } from '../context/WalletContext';

export default function Dashboard() {
  const { isConnected, connectWallet } = useWallet();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6 font-heading">Dashboard</h1>
          <Card className="p-8 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center justify-center py-12">
              <WalletIcon className="h-16 w-16 text-btb-primary mb-4" />
              <h2 className="text-2xl font-semibold mb-2 font-heading">Connect Your Wallet</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                Connect your wallet to view your portfolio, positions, and personalized insights.
              </p>
              <Button size="lg" onClick={connectWallet} className="bg-btb-primary hover:bg-btb-primary-dark">
                Connect Wallet
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div 
        className="max-w-4xl mx-auto text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-5 bg-btb-gradient bg-clip-text text-transparent font-heading">
          Manage All Your DeFi in One Place
        </h1>
        
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 max-w-3xl mx-auto">
          One unified dashboard to monitor and optimize all your DeFi yields across protocols.
        </p>
        
        <Card className="p-6 md:p-10 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-btb-primary-light/30 dark:border-btb-primary-dark/50">
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-xl md:text-2xl font-semibold mb-4 text-btb-primary dark:text-btb-primary-light font-heading">Coming Soon</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-6 max-w-2xl mx-auto">
              {[
                { icon: ChartBarIcon, text: "Yield farming optimization" },
                { icon: BanknotesIcon, text: "Multi-chain portfolio tracking" },
                { icon: ArrowTrendingUpIcon, text: "Automated yield strategies" },
                { icon: ShieldCheckIcon, text: "Risk assessment tools" },
                { icon: CurrencyDollarIcon, text: "Real-time yield comparisons" },
                { icon: WalletIcon, text: "Advanced position management" }
              ].map((feature, index) => (
                <motion.div 
                  key={index}
                  className="flex items-center p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <feature.icon className="h-5 w-5 text-btb-primary mr-3" />
                  <span className="text-gray-700 dark:text-gray-300">{feature.text}</span>
                </motion.div>
              ))}
            </div>
            
            <Button size="lg" className="btn-primary mt-2">
              Join Waitlist
            </Button>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-4">
              We're working hard to bring you the ultimate DeFi dashboard experience.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}