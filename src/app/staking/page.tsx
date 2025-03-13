'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { 
  LockClosedIcon,
  CurrencyDollarIcon,
  ClockIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  SparklesIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import { Button, MotionButton } from '../components/ui/button';
import { Card, MotionCard, CardContent, CardTitle, CardDescription } from '../components/ui/card';
import SubscriptionCard from './components/SubscriptionCard';
import StakingForm from './components/StakingForm';
import StakingStats from './components/StakingStats';
import CountUp from './components/CountUp';

// CSS variables for subscription card colors
const colorStyles = `
  :root {
    --green-500: #10b981;
    --teal-600: #0d9488;
    --purple-500: #8b5cf6;
    --indigo-600: #4f46e5;
    --indigo-700: #4338ca;
    --blue-400: #60a5fa;
    --blue-500: #3b82f6;
    --blue-600: #2563eb;
    --blue-700: #1d4ed8;
    --cyan-500: #06b6d4;
    --cyan-600: #0891b2;
    --gray-700: #374151;
    --gray-900: #111827;
    --pink-500: #ec4899;
    --rose-600: #e11d48;
    --amber-500: #f59e0b;
    --orange-600: #ea580c;
    --sky-500: #0ea5e9;
  }
`;

// Subscription services data
const subscriptionServices = [
  {
    name: 'ChatGPT',
    description: 'Access OpenAI\'s powerful ChatGPT Plus with all premium features',
    requiredStake: 1000000,
    logo: '/images/subscriptions/chatgpt.png',
    category: 'ai',
    color: 'from-green-500 to-teal-600'
  },
  {
    name: 'Claude',
    description: 'Anthropic\'s advanced AI assistant with enhanced capabilities',
    requiredStake: 1000000,
    logo: '/images/subscriptions/claude.png',
    category: 'ai',
    color: 'from-purple-500 to-indigo-600'
  },
  {
    name: 'Windsurf IDE',
    description: 'Revolutionary AI-powered integrated development environment',
    requiredStake: 1000000,
    logo: '/images/subscriptions/windsurf.png',
    category: 'dev',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    name: 'GitHub Copilot',
    description: 'AI pair programmer that helps you write better code faster',
    requiredStake: 1000000,
    logo: '/images/subscriptions/github.png',
    category: 'dev',
    color: 'from-gray-700 to-gray-900'
  },
  {
    name: 'Midjourney',
    description: 'Generate beautiful AI art and imagery with advanced prompting',
    requiredStake: 1000000,
    logo: '/images/subscriptions/midjourney.png',
    category: 'creative',
    color: 'from-blue-600 to-indigo-700'
  },
  {
    name: 'Ideogram',
    description: 'Create stunning AI-generated images with precise control',
    requiredStake: 1000000,
    logo: '/images/subscriptions/ideogram.png',
    category: 'creative',
    color: 'from-pink-500 to-rose-600'
  },
  {
    name: 'Canva Pro',
    description: 'Professional design platform with premium templates and features',
    requiredStake: 1000000,
    logo: '/images/subscriptions/canva.png',
    category: 'creative',
    color: 'from-blue-400 to-cyan-500'
  },
  {
    name: 'Coursera Plus',
    description: 'Unlimited access to 7,000+ courses from world-class universities',
    requiredStake: 1000000,
    logo: '/images/subscriptions/coursera.png',
    category: 'learning',
    color: 'from-blue-500 to-blue-700'
  },
  {
    name: 'Discord Nitro',
    description: 'Enhanced Discord experience with better emojis and uploads',
    requiredStake: 1000000,
    logo: '/images/subscriptions/discord.png',
    category: 'social',
    color: 'from-indigo-500 to-purple-600'
  },
  {
    name: 'Telegram Premium',
    description: 'Exclusive features for the world\'s fastest messaging app',
    requiredStake: 1000000,
    logo: '/images/subscriptions/telegram.png',
    category: 'social',
    color: 'from-sky-500 to-blue-600'
  }
];

// Category filters
const categories = [
  { id: 'all', name: 'All Subscriptions' },
  { id: 'ai', name: 'AI Assistants' },
  { id: 'dev', name: 'Development Tools' },
  { id: 'creative', name: 'Creative Tools' },
  { id: 'learning', name: 'Learning Platforms' },
  { id: 'social', name: 'Social Media' }
];

// Benefits of staking
const stakingBenefits = [
  {
    title: 'Free Premium Subscriptions',
    description: 'Stake BTB tokens and get access to premium subscriptions at no additional cost',
    icon: SparklesIcon
  },
  {
    title: 'Flexible Lock Periods',
    description: 'Choose lock periods from 3 months to 1 year with higher rewards for longer commitments',
    icon: ClockIcon
  },
  {
    title: 'Automatic Renewals',
    description: 'Your subscriptions are automatically renewed as long as your tokens remain staked',
    icon: ArrowPathIcon
  },
  {
    title: 'Governance Rights',
    description: 'Staked tokens grant you voting power in the BTB ecosystem governance',
    icon: CheckCircleIcon
  }
];

export default function StakingPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filteredServices, setFilteredServices] = useState(subscriptionServices);
  const [mounted, setMounted] = useState(false);
  
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.8]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 100]);
  
  useEffect(() => {
    setMounted(true);
    
    // Add CSS variables to document
    const style = document.createElement('style');
    style.innerHTML = colorStyles;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredServices(subscriptionServices);
    } else {
      setFilteredServices(subscriptionServices.filter(service => service.category === selectedCategory));
    }
  }, [selectedCategory]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <div ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-btb-primary/10 via-btb-primary/5 to-transparent dark:from-btb-primary/20 dark:via-btb-primary/10 dark:to-transparent">
        <motion.div 
          style={{ opacity, scale, y }}
          className="container mx-auto px-4 py-24 relative z-10"
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1 mb-6 rounded-full bg-btb-primary/10 border border-btb-primary/20"
            >
              <p className="text-sm font-medium text-btb-primary">BTB Staking</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="mb-4"
            >
              <span className="inline-block px-3 py-1 bg-amber-500/90 text-white text-sm font-semibold rounded-md shadow-md">
                Coming Soon
              </span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-btb-primary to-btb-primary-light bg-clip-text text-transparent"
            >
              Stake BTB, Get Premium Subscriptions Free
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg mb-8 text-gray-600 dark:text-gray-300"
            >
              Lock your BTB tokens and enjoy premium subscriptions to top services with no additional cost.
              We pay for your subscriptions while your tokens remain staked.
              <span className="block mt-2 text-amber-600 dark:text-amber-400 font-medium">This is a demo - staking functionality is not yet available.</span>
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap justify-center gap-4"
            >
              <Button 
                size="lg" 
                leftIcon={<LockClosedIcon className="w-5 h-5" />}
                onClick={() => {
                  const stakingForm = document.getElementById('staking-form');
                  stakingForm?.scrollIntoView({ behavior: 'smooth' });
                }}
                disabled
              >
                Stake BTB Now
              </Button>
              <Link href="/buy-token">
                <Button 
                  variant="outline" 
                  size="lg"
                  leftIcon={<CurrencyDollarIcon className="w-5 h-5" />}
                  disabled
                >
                  Buy BTB Token
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.div>
        
        {/* Enhanced animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large gradient orbs */}
          <motion.div 
            className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-btb-primary/20 blur-3xl"
            animate={{ 
              x: [0, 60, 0],
              y: [0, 40, 0],
            }}
            transition={{ 
              repeat: Infinity,
              duration: 15,
              ease: "easeInOut" 
            }}
          />
          <motion.div 
            className="absolute top-1/4 -right-20 w-60 h-60 rounded-full bg-btb-primary-light/20 blur-3xl"
            animate={{ 
              x: [0, -40, 0],
              y: [0, 60, 0],
            }}
            transition={{ 
              repeat: Infinity,
              duration: 20,
              ease: "easeInOut" 
            }}
          />
          <motion.div 
            className="absolute bottom-10 left-1/3 w-40 h-40 rounded-full bg-btb-primary-dark/20 blur-3xl"
            animate={{ 
              x: [0, 50, 0],
              y: [0, -30, 0],
            }}
            transition={{ 
              repeat: Infinity,
              duration: 18,
              ease: "easeInOut" 
            }}
          />
          
          {/* Floating particles */}
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-2 h-2 rounded-full bg-btb-primary/30"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, Math.random() * 30 - 15],
                x: [0, Math.random() * 30 - 15],
                opacity: [0.3, 0.8, 0.3],
                scale: [1, Math.random() * 0.5 + 0.8, 1],
              }}
              transition={{
                repeat: Infinity,
                duration: Math.random() * 5 + 10,
                ease: "easeInOut",
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Staking Stats */}
        <StakingStats />
        
        {/* Staking Benefits */}
        <div className="max-w-7xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Benefits of BTB Staking</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Stake your BTB tokens and unlock a world of premium services and benefits
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stakingBenefits.map((benefit, index) => (
              <MotionCard
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-6"
                isHoverable
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-btb-primary/10 flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-btb-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{benefit.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{benefit.description}</p>
                </div>
              </MotionCard>
            ))}
          </div>
        </div>
        
        {/* Staking Form */}
        <div id="staking-form" className="max-w-7xl mx-auto mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Stake Your BTB Tokens</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Lock your BTB tokens to receive free premium subscriptions and other benefits
            </p>
          </div>
          
          <StakingForm />
        </div>
        
        {/* Available Subscriptions */}
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Available Subscriptions</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Stake 1,000,000 BTB tokens for 1 year to get any of these premium subscriptions for free
            </p>
          </div>
          
          {/* Category Filters */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="mb-2"
              >
                {category.name}
              </Button>
            ))}
          </div>
          
          {/* Subscription Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {filteredServices.map((service, index) => (
                <SubscriptionCard 
                  key={service.name} 
                  service={service} 
                  index={index} 
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="max-w-7xl mx-auto mt-20 relative">
          <MotionCard
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            variant="gradient"
            className="p-8 md:p-12 overflow-hidden"
          >
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Pulsing circles */}
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={`pulse-${i}`}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20"
                  initial={{ width: 100, height: 100, opacity: 0 }}
                  animate={{ 
                    width: [100, 500],
                    height: [100, 500],
                    opacity: [0.5, 0],
                  }}
                  transition={{ 
                    repeat: Infinity,
                    duration: 4,
                    delay: i * 1.3,
                    ease: "easeOut" 
                  }}
                />
              ))}
              
              {/* Floating particles */}
              {Array.from({ length: 10 }).map((_, i) => (
                <motion.div
                  key={`cta-particle-${i}`}
                  className="absolute w-1 h-1 rounded-full bg-white/40"
                  style={{
                    top: `${Math.random() * 100}%`,
                    left: `${Math.random() * 100}%`,
                  }}
                  animate={{
                    y: [0, Math.random() * 50 - 25],
                    x: [0, Math.random() * 50 - 25],
                    opacity: [0.3, 0.7, 0.3],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: Math.random() * 5 + 5,
                    ease: "easeInOut",
                    delay: Math.random() * 2,
                  }}
                />
              ))}
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Ready to Start Staking?</h2>
                <p className="text-white/90 mb-6 max-w-2xl">
                  Join <span className="font-bold"><CountUp start={1000} end={1250} duration={3} separator="," /></span> other BTB holders who are already enjoying free premium subscriptions worth <span className="font-bold"><CountUp start={100} end={150} duration={3} prefix="$" /></span> per month.
                </p>
                
                <div className="flex flex-wrap gap-4">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={{ 
                      boxShadow: ["0px 0px 0px 0px rgba(255,255,255,0)", "0px 0px 20px 5px rgba(255,255,255,0.3)", "0px 0px 0px 0px rgba(255,255,255,0)"],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "loop"
                    }}
                  >
                    <Button 
                      variant="glass" 
                      size="lg" 
                      leftIcon={<LockClosedIcon className="w-5 h-5" />}
                      rightIcon={<ArrowRightIcon className="w-5 h-5" />}
                      onClick={() => {
                        const stakingForm = document.getElementById('staking-form');
                        stakingForm?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Start Staking Now
                    </Button>
                  </motion.div>
                  
                  <Button 
                    variant="outline" 
                    size="lg"
                    leftIcon={<QuestionMarkCircleIcon className="w-5 h-5" />}
                  >
                    <Link href="/faq">Learn More</Link>
                  </Button>
                </div>
                
                <motion.div 
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="mt-6 flex flex-wrap gap-6 text-sm text-white/80"
                >
                  <div className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2" />
                    <span>No additional fees</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2" />
                    <span>Automatic renewals</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-400 mr-2" />
                    <span>Unstake anytime</span>
                  </div>
                </motion.div>
              </div>
              
              <div className="hidden md:block">
                <motion.div 
                  className="relative w-40 h-40"
                  animate={{ 
                    rotate: 360,
                  }}
                  transition={{ 
                    repeat: Infinity,
                    duration: 20,
                    ease: "linear" 
                  }}
                >
                  <div className="absolute inset-0 rounded-full border-4 border-dashed border-white/30" />
                </motion.div>
              </div>
            </div>
          </MotionCard>
        </div>
      </div>
    </div>
  );
}
