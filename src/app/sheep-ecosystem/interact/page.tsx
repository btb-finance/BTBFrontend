'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ArrowLeftIcon,
  ClockIcon,
  BoltIcon,
  UserGroupIcon,
  ArrowPathIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

// Contract Addresses
const SHEEP_CONTRACT = '0x7bf26dF0E9Db4F70f286c39A9cd3A77Cb7407aa4';
const SHEEPDOG_CONTRACT = '0xa3b5f40a5719208B507F658a11Fb314Ef5e2c0e2';
const WOLF_CONTRACT = '0xf1152a195B93d51457633F96B81B1CF95a96E7A7';

export default function SheepEcosystemInteract() {
  const [sheepAmount, setSheepAmount] = useState<string>('');
  const [sheepDogAmount, setSheepDogAmount] = useState<string>('');
  const [wolfHunger, setWolfHunger] = useState<number>(65); // Default hunger level
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const handleBuySheep = () => {
    // In a real app, this would connect to a wallet and execute a transaction
    alert(`This would buy ${sheepAmount} SHEEP tokens in a real implementation`);
  };
  
  const handleBuySheepDog = () => {
    // In a real app, this would connect to a wallet and execute a transaction
    alert(`This would buy ${sheepDogAmount} SHEEPDOG tokens in a real implementation`);
  };
  
  const handleSimulateWolf = () => {
    // In a real app, this would simulate or interact with the Wolf contract
    setWolfHunger(prev => Math.min(prev + 10, 100));
    alert('Wolf hunger increased!');
  };
  
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      // In production, this would send the email to a database
      console.log('Subscribed with email:', email);
      setTimeout(() => {
        setIsSubscribed(false);
        setEmail('');
      }, 3000);
    }
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <Link href="/sheep-ecosystem" className="flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              <span>Back to Ecosystem</span>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Disclaimer Banner */}
      <div className="bg-amber-500 dark:bg-amber-600">
        <div className="max-w-7xl mx-auto py-2 px-3">
          <div className="flex flex-wrap items-start">
            <div className="flex items-start">
              <span className="flex p-1 rounded-lg bg-amber-800 flex-shrink-0 mt-0.5">
                <svg className="h-3.5 w-3.5 md:h-5 md:w-5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </span>
              <p className="ml-2 font-medium text-white text-xs md:text-sm leading-tight">
                Sheep is a 3rd party app on BTB Finance. Please use at your own risk.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Coming Soon Banner */}
      <div className="bg-green-600 dark:bg-green-700">
        <div className="max-w-7xl mx-auto py-2 px-3">
          <div className="flex flex-col sm:flex-row items-center">
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 text-white animate-pulse" />
              <p className="ml-2 font-medium text-white text-xs md:text-sm">
                Coming Soon: Improved Sheep Ecosystem
              </p>
            </div>
            <div className="mt-2 sm:mt-0 sm:ml-auto">
              <Link href="#notify">
                <button className="flex items-center justify-center px-3 py-1 border border-transparent rounded-md shadow-sm text-xs font-medium text-green-600 bg-white hover:bg-green-50">
                  Get Notified
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-grow py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h1
            className="text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            New Interactive Tools Coming Soon
          </motion.h1>
          
          <motion.p
            className="text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            We're upgrading our ecosystem with new features designed to improve user experience and reduce fees.
            Here's a preview of what's coming in our next update.
          </motion.p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {/* Feature 1: Single-TX Wolf Feeding */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="h-full border-2 border-purple-200 dark:border-purple-800">
                <CardContent className="pt-6 h-full flex flex-col">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                    <BoltIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  
                  <CardTitle className="text-xl mb-2">Single-Transaction Wolf Feeding</CardTitle>
                  <CardDescription className="mb-4 text-base">
                    Feed the Wolf in a single transaction instead of multiple ones - significantly reducing gas fees and improving user experience.
                  </CardDescription>
                  
                  <div className="mt-auto bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Benefits:</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">Pay fees only once per feeding cycle</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">Simplified user experience with fewer clicks</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">Reduced transaction costs by up to 80%</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Feature 2: Shared SheepDog Pool */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="h-full border-2 border-blue-200 dark:border-blue-800">
                <CardContent className="pt-6 h-full flex flex-col">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                    <UserGroupIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  
                  <CardTitle className="text-xl mb-2">Shared SheepDog Protection Pool</CardTitle>
                  <CardDescription className="mb-4 text-base">
                    All users will share a collective SheepDog protection pool, distributing fees across the entire community and maximizing protection efficiency.
                  </CardDescription>
                  
                  <div className="mt-auto bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Benefits:</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">Lower overall protection costs for everyone</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">More equitable fee distribution among participants</span>
                      </li>
                      <li className="flex items-start">
                        <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 mr-2" />
                        <span className="text-gray-600 dark:text-gray-300">Automatic protection management with no extra steps</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
          
          {/* How It Will Work Section */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8 text-center">How It Will Work</h2>
            
            <div className="max-w-3xl mx-auto">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-full w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                </div>
                
                <div className="relative space-y-12">
                  {/* Step 1 */}
                  <motion.div
                    className="flex items-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                  >
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-600 text-white z-10 relative">1</div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Buy Sheep Tokens</h3>
                      <p className="mt-1 text-gray-600 dark:text-gray-300">
                        Purchase Sheep tokens through our new streamlined interface with lower transaction fees.
                      </p>
                    </div>
                  </motion.div>
                  
                  {/* Step 2 */}
                  <motion.div
                    className="flex items-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  >
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-600 text-white z-10 relative">2</div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Automatically Join the Protection Pool</h3>
                      <p className="mt-1 text-gray-600 dark:text-gray-300">
                        All Sheep holders are automatically included in the shared SheepDog protection pool without any additional steps.
                      </p>
                    </div>
                  </motion.div>
                  
                  {/* Step 3 */}
                  <motion.div
                    className="flex items-start"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.6 }}
                  >
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-600 text-white z-10 relative">3</div>
                    </div>
                    <div className="ml-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Feed Wolf in a Single Transaction</h3>
                      <p className="mt-1 text-gray-600 dark:text-gray-300">
                        Wolf feeding will happen in a single transaction, dramatically reducing gas fees while maintaining the same exciting ecosystem mechanics.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Get Notified Section */}
          <div id="notify" className="max-w-2xl mx-auto">
            <Card className="border-2 border-green-200 dark:border-green-800">
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-xl mb-2">Be the First to Know</CardTitle>
                  <CardDescription>
                    Subscribe to get notified when our new ecosystem features are live.
                  </CardDescription>
                </div>
                
                <form onSubmit={handleSubscribe} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                      required
                    />
                    <Button 
                      type="submit" 
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                    >
                      {isSubscribed ? (
                        <span className="flex items-center">
                          <CheckCircleIcon className="w-5 h-5 mr-2" />
                          Subscribed!
                        </span>
                      ) : (
                        "Notify Me"
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    We'll only use your email to send you updates about the Sheep Ecosystem. You can unsubscribe at any time.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
} 