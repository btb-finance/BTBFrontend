import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LockClosedIcon, 
  ClockIcon, 
  CurrencyDollarIcon,
  ArrowPathIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';

// Lock period options
const lockPeriods = [
  { value: '3', label: '3 Months', multiplier: 0.25 },
  { value: '6', label: '6 Months', multiplier: 0.5 },
  { value: '12', label: '1 Year', multiplier: 1 }
];

export default function StakingForm() {
  const [amount, setAmount] = useState('');
  const [lockPeriod, setLockPeriod] = useState('12');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState('');
  
  // Calculate eligible subscriptions based on amount and lock period
  const calculateEligibleSubscriptions = () => {
    const amountValue = parseFloat(amount) || 0;
    const selectedPeriod = lockPeriods.find(period => period.value === lockPeriod);
    const effectiveStake = amountValue * (selectedPeriod?.multiplier || 1);
    
    if (effectiveStake >= 1000000) {
      return 'All subscriptions';
    } else if (effectiveStake >= 500000) {
      return 'Basic subscriptions';
    } else {
      return 'None';
    }
  };
  
  const handleStake = () => {
    setIsLoading(true);
    
    // Simulate staking process
    setTimeout(() => {
      setIsLoading(false);
      alert('Staking successful! You can now enjoy your free subscriptions.');
    }, 2000);
  };
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Staking Form */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Stake Your BTB</h3>
        
        <div className="space-y-6">
          {/* Amount Input */}
          <div>
            <label htmlFor="stake-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount to Stake
            </label>
            <div className="relative">
              <input
                id="stake-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter BTB amount"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-btb-primary/50"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400">BTB</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Minimum 1,000,000 BTB for a full subscription
            </p>
          </div>
          
          {/* Lock Period Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lock Period
            </label>
            <div className="grid grid-cols-3 gap-3">
              {lockPeriods.map((period) => (
                <button
                  key={period.value}
                  type="button"
                  onClick={() => setLockPeriod(period.value)}
                  className={`flex items-center justify-center px-4 py-2 border ${
                    lockPeriod === period.value
                      ? 'border-btb-primary bg-btb-primary/10 text-btb-primary'
                      : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  } rounded-lg transition-colors`}
                >
                  <ClockIcon className="w-4 h-4 mr-2" />
                  {period.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Longer lock periods provide more benefits
            </p>
          </div>
          
          {/* Subscription Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Subscription
            </label>
            <select
              value={selectedSubscription}
              onChange={(e) => setSelectedSubscription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-btb-primary/50"
            >
              <option value="">Select a subscription</option>
              <option value="chatgpt">ChatGPT</option>
              <option value="claude">Claude</option>
              <option value="windsurf">Windsurf IDE</option>
              <option value="github">GitHub Copilot</option>
              <option value="midjourney">Midjourney</option>
              <option value="ideogram">Ideogram</option>
              <option value="canva">Canva Pro</option>
              <option value="coursera">Coursera Plus</option>
              <option value="discord">Discord Nitro</option>
              <option value="telegram">Telegram Premium</option>
            </select>
          </div>
          
          {/* Stake Button */}
          <Button 
            className="w-full"
            size="lg"
            leftIcon={<LockClosedIcon className="w-5 h-5" />}
            isLoading={isLoading}
            onClick={handleStake}
            disabled={!amount || parseFloat(amount) < 1 || !selectedSubscription}
          >
            Stake BTB Tokens
          </Button>
          
          <div className="flex items-start p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <InformationCircleIcon className="w-5 h-5 text-amber-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              By staking, you agree to lock your BTB tokens for the selected period. 
              Your tokens will be returned after the lock period ends.
            </p>
          </div>
          
          <div className="relative mb-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-md z-10"
            >
              <div className="text-center p-4">
                <span className="inline-block px-3 py-1 bg-amber-500/90 text-white text-sm font-semibold rounded-md shadow-md mb-2">
                  Coming Soon
                </span>
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  Staking functionality is not yet available.<br/>This is a demo interface.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </Card>
      
      {/* Staking Info */}
      <Card className="p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
        <h3 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">Staking Summary</h3>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Amount to Stake</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {amount ? `${parseFloat(amount).toLocaleString()} BTB` : '-'}
              </span>
            </div>
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Lock Period</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {lockPeriods.find(period => period.value === lockPeriod)?.label || '-'}
              </span>
            </div>
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Effective Stake</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {amount ? `${(parseFloat(amount) * (lockPeriods.find(period => period.value === lockPeriod)?.multiplier || 1)).toLocaleString()} BTB` : '-'}
              </span>
            </div>
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Eligible For</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {calculateEligibleSubscriptions()}
              </span>
            </div>
            
            <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Unlock Date</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {lockPeriod ? new Date(Date.now() + parseInt(lockPeriod) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString() : '-'}
              </span>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white">How It Works</h4>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-btb-primary/10 flex items-center justify-center mr-3">
                <LockClosedIcon className="w-4 h-4 text-btb-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Stake your BTB tokens and lock them for your chosen period
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-btb-primary/10 flex items-center justify-center mr-3">
                <CurrencyDollarIcon className="w-4 h-4 text-btb-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We pay for your subscription while your tokens remain staked
                </p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-btb-primary/10 flex items-center justify-center mr-3">
                <ArrowPathIcon className="w-4 h-4 text-btb-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically renew your subscription by extending your staking period
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
